-- ============================================================================
-- VOPILA — Güvenlik Paketi 1 sıkılaştırma
--  1) Toplu şikayetle sansür engeli: yalnızca görebildiğin içeriği şikayet edebilirsin;
--     otomatik gizleme yalnızca "güvenilir" şikayetçileri sayar (≥7 günlük, aktif hesap);
--     yöneticinin daha önce temize çıkardığı içerik için eşik 5 → 15.
--  2) Hız sınırı yarış durumu: aynı anda gönderilen isteklerle sınır aşılamaz (kullanıcı+tablo kilidi).
--  3) Askıdaki hesap mevcut içeriğini de düzenleyemez (UPDATE de korunur).
-- ============================================================================

-- 1a) Yalnızca görebildiğin şeyi şikayet edebilirsin (alt sorgular ilgili tabloların RLS'iyle çalışır)
drop policy if exists "reports: kendi adına şikayet eder" on public.reports;
create policy "reports: kendi adına şikayet eder" on public.reports
  for insert to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and (
      (target_type = 'post'    and exists (select 1 from public.posts p where p.id = target_id))
      or (target_type = 'comment' and exists (select 1 from public.comments c where c.id = target_id))
      or (target_type = 'user'    and exists (select 1 from public.profiles pr where pr.id = target_id))
      or (target_type = 'moment'  and exists (select 1 from public.moments m where m.id = target_id))
      or (target_type = 'live'    and exists (select 1 from public.live_streams l where l.id = target_id))
    )
  );

-- 1b) Otomatik gizleme yalnızca güvenilir şikayetçileri sayar
create or replace function private.auto_hide_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n          integer;
  threshold  integer := 5;
begin
  -- Yönetici daha önce bu içeriği temize çıkardıysa çok daha yüksek eşik
  if exists (
    select 1 from public.reports r
    where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'dismissed'
  ) then
    threshold := 15;
  end if;

  select count(distinct r.reporter_id) into n
  from public.reports r
  join public.profiles pr on pr.id = r.reporter_id
  where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open'
    and pr.status = 'active'
    and pr.created_at <= now() - interval '7 days';

  if n >= threshold then
    if new.target_type = 'post' then
      update public.posts set is_hidden = true where id = new.target_id;
    elsif new.target_type = 'comment' then
      update public.comments set is_hidden = true where id = new.target_id;
    end if;
  end if;
  return null;
end;
$$;

-- 2) Hız sınırı: aynı kullanıcı + tablo için sayımdan önce kilit
create or replace function private.guard_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_limit  record;
  v_count  integer;
  v_target uuid;
begin
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;

  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;

  select * into v_limit from private.rate_limits where table_name = tg_table_name;
  if found then
    -- Eşzamanlı isteklerin aynı sayımı görüp sınırı aşmasını engeller
    perform pg_advisory_xact_lock(hashtext(tg_table_name), hashtext(v_uid::text));
    execute format(
      'select count(*) from public.%I where %I = $1 and %I > now() - make_interval(secs => $2)',
      tg_table_name, tg_argv[0], tg_argv[1])
      into v_count using v_uid, v_limit.per_seconds;
    if v_count >= v_limit.max_count then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  if tg_table_name = 'follows' then
    v_target := new.following_id;
  elsif tg_table_name = 'arena_votes' then
    select e.author_id into v_target from public.arena_entries e where e.id = new.entry_id;
  end if;
  if v_target is not null and private.blocked_pair(v_uid, v_target) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

-- 3) Askıdaki hesap düzenleme de yapamaz (silme serbest: kullanıcı kendi içeriğini kaldırabilir)
create or replace function private.guard_user_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' and not private.is_active_user((select auth.uid())) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_user_update() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['posts', 'follows', 'live_streams', 'notifications'] loop
    execute format('drop trigger if exists guard_user_update on public.%I', t);
    execute format(
      'create trigger guard_user_update before update on public.%I
         for each row execute function private.guard_user_update()', t);
  end loop;
end $$;
