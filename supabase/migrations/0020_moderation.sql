-- ============================================================================
-- VOPILA — İçerik denetimi
--  1) Yasaklı ifade filtresi: küfür, hakaret, cinsel ifade, tehdit. Yorum, gönderi açıklaması, mesaj,
--     profil adı/kullanıcı adı/biyografide varsa kayıt reddedilir (content_blocked). Yazım hileleri
--     (5→s, 1→i, harf tekrarı, Türkçe karakter) sadeleştirilir.
--  2) İhlal sistemi (Meta/Instagram modeli): yönetici şikâyet üzerine içeriği kaldırınca yazarına ihlal
--     yazılır; ihlaller 1 yıl sayılır. 1: uyarı · 2: 1 gün · 3: 3 gün · 4: 7 gün · 5: 30 gün kısıtlama ·
--     6: hesap kapatılır. Ağır ihlal (çocuk güvenliği, terör) → hesap doğrudan kapatılır.
--     Kısıtlama süresi dolunca 15 dakikada bir otomatik kalkar. "Hesap durumu" ekranı.
--  3) Yorum izni ayarı kaldırıldı: herkes yorum yapabilir; gönderi sahibi yorumları siler/şikâyet eder.
--  4) 0019 düzeltmeleri: "hassas" işaretini yazar sonradan kaldıramaz; filtre yaşı doğrulanmamış
--     (bilinmeyen / giriş yapmamış) izleyiciye de uygulanır (yalnızca 18+ olanlar görür).
-- ============================================================================

-- ─── 1) Yasaklı ifadeler ─────────────────────────────────────────────────────
create table if not exists private.banned_terms (
  term      text primary key,               -- sadeleştirilmiş biçim
  category  text not null check (category in ('kufur', 'hakaret', 'cinsel', 'siddet', 'nefret')),
  exact     boolean not null default false  -- true: yalnızca tam kelime · false: kelime başı (ekler dahil)
);

-- Türkçe küçük harf → Türkçe karakter sadeleştirme → yazım hileleri → harf tekrarlarını tekle
create or replace function private.normalize_tr(p text)
returns text
language sql immutable set search_path = ''
as $$
  select regexp_replace(
           translate(lower(replace(replace(coalesce(p, ''), 'I', 'ı'), 'İ', 'i')),
                     'ığüşöçâîû0134579@$!|',
                     'igusocaiuoieastgasii'),
           '([a-z])\1+', '\1', 'g');
$$;

-- Metinde yasaklı ifade varsa kategorisini döner
create or replace function private.banned_category(p text)
returns text
language sql stable security definer set search_path = ''
as $$
  with t as (select ' ' || regexp_replace(private.normalize_tr(p), '[^a-z]+', ' ', 'g') || ' ' as s)
  select b.category from private.banned_terms b, t
  where (b.exact and position(' ' || b.term || ' ' in t.s) > 0)
     or (not b.exact and position(' ' || b.term in t.s) > 0)
  limit 1;
$$;

insert into private.banned_terms (term, category, exact)
select private.normalize_tr(x.term), x.category, x.exact from (values
  -- küfür (kelime başı: ekli biçimler de yakalanır)
  ('orospu', 'kufur', false), ('orosbu', 'kufur', false), ('siktir', 'kufur', false), ('sikerim', 'kufur', false),
  ('sikeyim', 'kufur', false), ('siktim', 'kufur', false), ('sikik', 'kufur', false), ('amına', 'kufur', false),
  ('amcık', 'kufur', false), ('yarrak', 'kufur', false), ('dalyarak', 'kufur', false), ('pezevenk', 'kufur', false),
  ('kahpe', 'kufur', false), ('gavat', 'kufur', false), ('kaltak', 'kufur', false), ('sürtük', 'kufur', false),
  ('götveren', 'kufur', false), ('yavşak', 'kufur', false), ('ibne', 'kufur', false), ('sikko', 'kufur', false),
  -- küfür kısaltmaları (yalnızca tam kelime)
  ('amk', 'kufur', true), ('amq', 'kufur', true), ('aq', 'kufur', true), ('mk', 'kufur', true), ('sg', 'kufur', true),
  ('oç', 'kufur', true), ('piç', 'kufur', true), ('puşt', 'kufur', true), ('göt', 'kufur', true), ('orsp', 'kufur', true),
  -- hakaret
  ('şerefsiz', 'hakaret', false), ('haysiyetsiz', 'hakaret', false), ('gerizekalı', 'hakaret', false),
  ('salak', 'hakaret', false), ('aptal', 'hakaret', false), ('dangalak', 'hakaret', false), ('ahmak', 'hakaret', false),
  ('beyinsiz', 'hakaret', false), ('embesil', 'hakaret', false), ('hıyar', 'hakaret', true),
  -- cinsel ifade
  ('porno', 'cinsel', false), ('sakso', 'cinsel', false), ('seks', 'cinsel', true), ('sex', 'cinsel', true),
  ('nude', 'cinsel', true), ('nudes', 'cinsel', true),
  -- tehdit
  ('öldürürüm', 'siddet', false), ('öldüreceğim', 'siddet', false), ('gebertirim', 'siddet', false),
  ('geberteceğim', 'siddet', false)
) as x(term, category, exact)
on conflict (term) do nothing;

-- Tetikleyici: metin alanlarında yasaklı ifade varsa kayıt reddedilir
create or replace function private.block_banned_text()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  j jsonb := to_jsonb(new);
  v_new text := concat_ws(' ', j ->> 'text', j ->> 'caption', j ->> 'name', j ->> 'username', j ->> 'bio');
  v_cat text;
begin
  if tg_op = 'UPDATE' then
    -- Yalnızca metin değiştiyse kontrol et (sistem güncellemeleri etkilenmesin)
    if v_new is not distinct from concat_ws(' ', to_jsonb(old) ->> 'text', to_jsonb(old) ->> 'caption',
         to_jsonb(old) ->> 'name', to_jsonb(old) ->> 'username', to_jsonb(old) ->> 'bio') then
      return new;
    end if;
  end if;
  v_cat := private.banned_category(v_new);
  if v_cat is not null then
    raise exception 'content_blocked:%', v_cat using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.block_banned_text() from public, anon, authenticated;

drop trigger if exists block_banned_text on public.comments;
create trigger block_banned_text before insert or update of text on public.comments
  for each row execute function private.block_banned_text();
drop trigger if exists block_banned_text on public.posts;
create trigger block_banned_text before insert or update of caption on public.posts
  for each row execute function private.block_banned_text();
drop trigger if exists block_banned_text on public.messages;
create trigger block_banned_text before insert or update of text on public.messages
  for each row execute function private.block_banned_text();
drop trigger if exists block_banned_text on public.profiles;
create trigger block_banned_text before insert or update of name, username, bio on public.profiles
  for each row execute function private.block_banned_text();

-- ─── 2) İhlaller ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists suspended_until timestamptz;

create table if not exists private.strikes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  reason       text not null,
  target_type  text,
  target_id    uuid,
  severe       boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists strikes_user_idx on private.strikes (user_id, created_at desc);

alter table public.reports drop constraint if exists reports_reason_check;
alter table public.reports add constraint reports_reason_check check (reason in
  ('spam', 'nefret', 'taciz', 'ciplaklik', 'siddet', 'sahte_hesap', 'telif', 'hile', 'cocuk_guvenligi',
   'kufur', 'hassas', 'teror', 'diger'));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'arena', 'token', 'order', 'mention', 'reply', 'support', 'parent', 'moderation'));

create or replace function private.reason_label(p text)
returns text
language sql immutable set search_path = ''
as $$
  select case p
    when 'spam' then 'spam' when 'nefret' then 'nefret söylemi' when 'taciz' then 'taciz veya zorbalık'
    when 'ciplaklik' then 'çıplaklık veya cinsel içerik' when 'siddet' then 'şiddet'
    when 'sahte_hesap' then 'sahte hesap' when 'telif' then 'telif ihlali' when 'hile' then 'hile'
    when 'cocuk_guvenligi' then 'çocuk güvenliği' when 'kufur' then 'küfür veya hakaret'
    when 'hassas' then 'rahatsız edici içerik' when 'teror' then 'terör veya şiddet örgütü propagandası'
    else 'topluluk kuralları ihlali' end;
$$;

-- İhlal yaz ve cezayı uygula
create or replace function private.add_strike(p_user uuid, p_reason text, p_type text, p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_severe boolean := p_reason in ('cocuk_guvenligi', 'teror');
  n integer;
  v_days integer;
  v_text text;
begin
  if p_user is null then return; end if;
  insert into private.strikes (user_id, reason, target_type, target_id, severe)
  values (p_user, p_reason, p_type, p_target, v_severe);
  select count(*) into n from private.strikes where user_id = p_user and created_at > now() - interval '1 year';

  if v_severe or n >= 6 then
    update public.profiles set status = 'banned', suspended_until = null where id = p_user;
    v_text := 'Hesabın topluluk kurallarını ' || case when v_severe then 'ağır şekilde ' else 'tekrar tekrar ' end
              || 'ihlal ettiği için kapatıldı (' || private.reason_label(p_reason) || '). İtiraz için Destek’e yazabilirsin.';
  else
    v_days := case n when 1 then 0 when 2 then 1 when 3 then 3 when 4 then 7 else 30 end;
    if v_days = 0 then
      v_text := 'İçeriğin kaldırıldı (' || private.reason_label(p_reason) || '). Bu bir uyarı; tekrarında hesabın kısıtlanır. Hesap durumunu Ayarlar > Hesap durumu bölümünde görebilirsin.';
    else
      update public.profiles
         set status = case when status = 'banned' then status else 'suspended' end,
             suspended_until = greatest(coalesce(suspended_until, now()), now() + make_interval(days => v_days))
       where id = p_user;
      v_text := 'İçeriğin kaldırıldı (' || private.reason_label(p_reason) || '). Bu ' || n || '. ihlalin; hesabın '
                || v_days || ' gün paylaşım, yorum ve mesaj gönderemez. Ayrıntılar: Ayarlar > Hesap durumu.';
    end if;
  end if;
  insert into public.notifications (user_id, kind, text, href) values (p_user, 'moderation', v_text, '/hesap-durumu');
end;
$$;
revoke execute on function private.add_strike(uuid, text, text, uuid) from public, anon, authenticated;

-- Yönetici kararı: "kaldır" ihlal yazar; "hassas" ve "sorun yok" yazmaz
create or replace function private.admin_resolve_report(p_report uuid, p_decision text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reports%rowtype;
  v_author uuid;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision not in ('remove', 'dismiss', 'sensitive') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if r.target_type = 'post' then
    select author_id into v_author from public.posts where id = r.target_id;
    if p_decision = 'sensitive' then
      update public.posts set sensitive = true, is_hidden = false where id = r.target_id;
    else
      update public.posts set is_hidden = (p_decision = 'remove') where id = r.target_id;
    end if;
  elsif r.target_type = 'comment' then
    select author_id into v_author from public.comments where id = r.target_id;
    update public.comments set is_hidden = (p_decision = 'remove') where id = r.target_id;
  elsif r.target_type = 'moment' then
    select author_id into v_author from public.moments where id = r.target_id;
    if p_decision = 'remove' then
      delete from public.moments where id = r.target_id;
    end if;
  elsif r.target_type = 'user' then
    v_author := r.target_id;
  end if;

  update public.reports
     set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_by = (select auth.uid()), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  if p_decision = 'remove' then
    perform private.add_strike(v_author, r.reason, r.target_type, r.target_id);
  end if;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'report_' || p_decision, r.target_type, r.target_id::text,
          jsonb_build_object('reason', r.reason, 'author', v_author));
end;
$$;

-- Elle durum değişikliği: aktif yapınca kısıtlama süresi silinir; elle askı süresizdir
create or replace function private.admin_set_user_status(p_user uuid, p_status text, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.profiles set status = p_status, suspended_until = null where id = p_user;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'user_status:' || p_status, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- Süresi dolan kısıtlamaları kaldır
create or replace function private.lift_suspensions()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare n integer;
begin
  with x as (
    update public.profiles set status = 'active', suspended_until = null
     where status = 'suspended' and suspended_until is not null and suspended_until <= now()
    returning id
  )
  insert into public.notifications (user_id, kind, text, href)
  select id, 'moderation', 'Hesap kısıtlaman sona erdi. Topluluk kurallarına uyduğun için teşekkürler.', '/hesap-durumu' from x;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function private.lift_suspensions() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vopila-lift-suspensions') then perform cron.unschedule('vopila-lift-suspensions'); end if;
  perform cron.schedule('vopila-lift-suspensions', '*/15 * * * *', 'select private.lift_suspensions();');
end $$;

-- Hesap durumu (Instagram "Account Status" benzeri)
create or replace function private.my_account_status()
returns table (status text, suspended_until timestamptz, strike_count integer,
               strikes jsonb)
language sql stable security definer set search_path = ''
as $$
  select p.status, p.suspended_until,
         (select count(*)::integer from private.strikes s where s.user_id = p.id and s.created_at > now() - interval '1 year'),
         coalesce((select jsonb_agg(jsonb_build_object(
                     'reason', private.reason_label(s.reason), 'type', s.target_type, 'severe', s.severe,
                     'at', s.created_at, 'expires', s.created_at + interval '1 year') order by s.created_at desc)
                   from private.strikes s where s.user_id = p.id and s.created_at > now() - interval '1 year'), '[]'::jsonb)
  from public.profiles p where p.id = (select auth.uid());
$$;
grant execute on function private.my_account_status() to authenticated;
revoke execute on function private.my_account_status() from public, anon;

create or replace function public.my_account_status()
returns table (status text, suspended_until timestamptz, strike_count integer, strikes jsonb)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.my_account_status(); end; $$;
revoke execute on function public.my_account_status() from public, anon;
grant execute on function public.my_account_status() to authenticated;

-- ─── 3) Yorum izni ayarı kaldırıldı ──────────────────────────────────────────
update public.user_settings s set comment_policy = 'everyone'
 where comment_policy <> 'everyone'
   and not exists (select 1 from public.parent_links l where l.child_id = s.user_id and l.lock_comments);

-- ─── 4) 0019 düzeltmeleri ────────────────────────────────────────────────────
revoke update (sensitive) on public.posts from authenticated;

-- Yalnızca yaşı 18+ olarak kayıtlı izleyici filtresiz görür (bilinmeyen / giriş yok → filtreli)
create or replace function private.viewer_is_adult()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(private.age_group_of((select auth.uid())) = 'adult', false);
$$;
grant execute on function private.viewer_is_adult() to anon, authenticated;

drop policy if exists "posts: 18 altı içerik filtresi" on public.posts;
create policy "posts: 18 altı içerik filtresi" on public.posts as restrictive for select to anon, authenticated
  using (
    (select private.viewer_is_adult())
    or author_id = (select auth.uid())
    or (not sensitive and private.minor_safe_post(id))
  );

drop policy if exists "arena_entries: 18 altı içerik filtresi" on public.arena_entries;
create policy "arena_entries: 18 altı içerik filtresi" on public.arena_entries as restrictive for select to anon, authenticated
  using (
    (select private.viewer_is_adult())
    or author_id = (select auth.uid())
    or post_id is null
    or private.minor_safe_post(post_id)
  );
