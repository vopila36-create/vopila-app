-- ============================================================================
-- VOPILA — Yaş geçişleri (otomatik güvenlik incelemesi + eksik)
--  * Doğum tarihi saklanmadığı için gençler sonsuza dek 15-18 kalıyordu. Artık yalnızca yaş grubunun
--    DEĞİŞECEĞİ AY saklanır (15'i/18'i doldurduğu ayın ertesi ayının 1'i); her gece geçiş yapılır.
--  * 15-18 olmaktan çıkan hesabın ebeveyn bağlantısı ve bekleyen kodu silinir; kilitler yalnızca
--    18 altıyken uygulanır; bağlantı yalnızca hâlâ 15-18 olan gence kurulur.
-- ============================================================================

alter table private.user_age add column if not exists next_change date;

create or replace function private.next_age_change(p_birth date)
returns date
language plpgsql stable set search_path = ''
as $$
declare
  g text := private.age_group_from(p_birth);
  d date;
begin
  if g = 'under15' then d := p_birth + interval '15 years';
  elsif g = 'teen' then d := p_birth + interval '18 years';
  else return null;
  end if;
  return (date_trunc('month', d) + interval '1 month')::date;
end;
$$;
revoke execute on function private.next_age_change(date) from public, anon, authenticated;

create or replace function private.apply_age_group(p_user uuid, p_group text, p_method text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_group in ('teen', 'under15') then
    update public.profiles set is_private = true where id = p_user and not is_private;
  end if;
  update public.profiles set protected_media = (p_group in ('teen', 'under15'))
   where id = p_user and protected_media is distinct from (p_group in ('teen', 'under15'));
  insert into private.user_age (user_id, age_group, method, updated_at)
  values (p_user, p_group, p_method, now())
  on conflict (user_id) do update set age_group = excluded.age_group, method = excluded.method, updated_at = now();
  if p_group <> 'teen' then
    delete from public.parent_links where child_id = p_user;
    delete from private.parent_codes where child_id = p_user;
  end if;
end;
$$;
revoke execute on function private.apply_age_group(uuid, text, text) from public, anon, authenticated;

create or replace function private.set_next_change(p_user uuid, p_birth date)
returns void
language sql security definer set search_path = ''
as $$
  update private.user_age set next_change = private.next_age_change(p_birth) where user_id = p_user;
$$;
revoke execute on function private.set_next_change(uuid, date) from public, anon, authenticated;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base_username text;
  candidate     text;
  display_name  text;
  v_birth       text := new.raw_user_meta_data ->> 'birth_date';
  v_group       text;
begin
  if v_birth is not null then
    begin
      v_group := private.age_group_from(v_birth::date);
    exception when others then
      raise exception 'invalid_birth_date' using errcode = 'P0001';
    end;
    if v_group = 'under15' then
      raise exception 'under_15' using errcode = 'P0001';
    end if;
  end if;

  base_username := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 14);
  if char_length(base_username) < 3 then
    base_username := 'kasif';
  end if;

  candidate := base_username;
  while exists (select 1 from public.profiles p where p.username = candidate) loop
    candidate := base_username || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  display_name := left(coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    candidate
  ), 60);

  insert into public.profiles (id, username, name, avatar_url)
  values (
    new.id,
    candidate,
    display_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;

  if v_group is not null then
    perform private.apply_age_group(new.id, v_group, 'self');
    perform private.set_next_change(new.id, v_birth::date);
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' where id = new.id;
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create or replace function private.declare_birth_date(p_birth date)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if private.age_group_of(v_uid) <> 'unknown' then
    raise exception 'age_already_set' using errcode = 'P0001';
  end if;
  v_group := private.age_group_from(p_birth);
  perform private.apply_age_group(v_uid, v_group, 'self');
  perform private.set_next_change(v_uid, p_birth);
  return v_group;
end;
$$;

create or replace function private.admin_set_age_group(p_user uuid, p_group text, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_group not in ('unknown', 'under15', 'teen', 'adult') then
    raise exception 'invalid_age_group' using errcode = 'P0001';
  end if;
  if p_group = 'unknown' then
    delete from private.user_age where user_id = p_user;
    delete from public.parent_links where child_id = p_user;
  else
    perform private.apply_age_group(p_user, p_group, 'admin');
    update private.user_age set next_change = null where user_id = p_user;
  end if;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'age_group:' || p_group, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function private.age_transitions()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  n integer := 0;
begin
  for r in select user_id, age_group, next_change from private.user_age
           where next_change is not null and next_change <= v_today loop
    if r.age_group = 'under15' then
      perform private.apply_age_group(r.user_id, 'teen', 'self');
      update private.user_age set next_change = (r.next_change + interval '3 years')::date where user_id = r.user_id;
    elsif r.age_group = 'teen' then
      perform private.apply_age_group(r.user_id, 'adult', 'self');
      update private.user_age set next_change = null where user_id = r.user_id;
      insert into public.notifications (user_id, kind, text, href)
      values (r.user_id, 'parent', '18 yaşını doldurdun! 15–18 yaş kısıtlamaları ve ebeveyn denetimi kaldırıldı.', '/yas-dogrulama');
    else
      update private.user_age set next_change = null where user_id = r.user_id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;
revoke execute on function private.age_transitions() from public, anon, authenticated;

-- Her gece 00:10 (Türkiye saati = 21:10 UTC)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'vopila-age-transitions') then perform cron.unschedule('vopila-age-transitions'); end if;
  perform cron.schedule('vopila-age-transitions', '10 21 * * *', 'select private.age_transitions();');
end $$;

create or replace function private.parent_link(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_child uuid;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if private.age_group_of(v_uid) <> 'adult' then
    raise exception 'parent_must_be_adult' using errcode = 'P0001';
  end if;
  -- Deneme sınırı: saatte 10. Yanlış kodda hata fırlatılmaz (kayıt geri alınmasın), null döner.
  delete from private.parent_link_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.parent_link_attempts where user_id = v_uid) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into private.parent_link_attempts (user_id) values (v_uid);

  select c.child_id into v_child from private.parent_codes c
   where c.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex') and c.expires_at > now();
  if v_child is null or v_child = v_uid or private.age_group_of(v_child) <> 'teen' then
    return null;
  end if;
  insert into public.parent_links (child_id, parent_id) values (v_child, v_uid);
  delete from private.parent_codes where child_id = v_child;
  update public.profiles set is_private = true where id = v_child and not is_private;
  perform private.parent_notify(v_child, v_uid, 'Ebeveyn denetimi bağlandı. Ayarlarını Ayarlar > Ebeveyn denetimi bölümünde görebilirsin.');
  return v_child;
end;
$$;

create or replace function private.guard_profile_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and old.id = (select auth.uid())
     and not private.is_active_user(old.id) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if (select auth.role()) = 'authenticated'
     and old.id = (select auth.uid())
     and old.is_private and not new.is_private
     and private.is_minor(old.id)
     and exists (select 1 from public.parent_links l where l.child_id = old.id and l.lock_private) then
    raise exception 'parent_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function private.guard_settings_parent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id = (select auth.uid())
     and new.comment_policy in ('everyone', 'followers')
     and private.is_minor(new.user_id)
     and exists (select 1 from public.parent_links l where l.child_id = new.user_id and l.lock_comments) then
    new.comment_policy := 'following';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_settings_parent() from public, anon, authenticated;
