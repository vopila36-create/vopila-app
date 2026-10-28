-- ============================================================================
-- VOPILA — Yaş kuralları (5651 s. Kanun ek md. 4/7 + Sosyal Ağ Sağlayıcılarda Yaş Doğrulama
-- Yönetmeliği, yürürlük 1 Kasım 2026)
--  * 15 yaşını doldurmamış kişiye hizmet yok: kayıt reddedilir; mevcut hesap kapatılır (itiraz hakkı).
--  * 15–18 yaş: hesap gizli açılır, takipçi/takip listesi yalnızca kendisine görünür, yalnızca
--    kendisinin takip ettiği kişiler mesaj atabilir, aramada/önerilerde bulunamaz (ilişkisi olanlar hariç).
--  * Doğum tarihi SAKLANMAZ; yalnızca yaş grubu (bilinmiyor / 15 altı / 15-18 / 18+) ve yöntemi tutulur.
--  * e-Devlet belirteci (Siber Güvenlik Başkanlığı) servisi bağlanınca yöntem 'edevlet' olur.
-- ============================================================================

create table if not exists private.user_age (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  age_group   text not null check (age_group in ('unknown', 'under15', 'teen', 'adult')),
  method      text not null check (method in ('self', 'edevlet', 'admin')),
  updated_at  timestamptz not null default now()
);

create or replace function private.age_group_of(p_user uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce((select a.age_group from private.user_age a where a.user_id = p_user), 'unknown');
$$;

create or replace function private.is_minor(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.age_group_of(p_user) in ('teen', 'under15');
$$;

-- Doğum tarihinden yaş grubu (Türkiye saatine göre bugün)
create or replace function private.age_group_from(p_birth date)
returns text
language plpgsql stable set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Istanbul')::date;
  v_age integer;
begin
  if p_birth is null or p_birth > v_today or p_birth < v_today - interval '120 years' then
    raise exception 'invalid_birth_date' using errcode = 'P0001';
  end if;
  v_age := extract(year from age(v_today, p_birth))::integer;
  return case when v_age < 15 then 'under15' when v_age < 18 then 'teen' else 'adult' end;
end;
$$;

-- Yaş grubunu yaz + 15-18 ise hesabı gizliye al
create or replace function private.apply_age_group(p_user uuid, p_group text, p_method text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Önce gizliye al (15 altı olarak işaretlenen hesap artık kendi profilini güncelleyemez)
  if p_group in ('teen', 'under15') then
    update public.profiles set is_private = true where id = p_user and not is_private;
  end if;
  insert into private.user_age (user_id, age_group, method, updated_at)
  values (p_user, p_group, p_method, now())
  on conflict (user_id) do update set age_group = excluded.age_group, method = excluded.method, updated_at = now();
end;
$$;

-- 15 yaş altı hesap: hiçbir işlem yapamaz (destek/itiraz ve hesap silme hariç)
create or replace function private.is_active_user(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = p_user), false)
     and private.age_group_of(p_user) <> 'under15';
$$;

-- Kayıt: doğum tarihi kayıt formundan gelir, yaş grubu hesaplanır, tarih hemen silinir.
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
    -- Veri en aza indirme (KVKK md. 4): doğum tarihi saklanmaz
    update auth.users set raw_user_meta_data = raw_user_meta_data - 'birth_date' where id = new.id;
  end if;

  return new;
end;
$$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

-- Kendi yaş durumum
create or replace function private.my_age()
returns table (age_group text, method text)
language sql stable security definer set search_path = ''
as $$
  select private.age_group_of((select auth.uid())),
         coalesce((select a.method from private.user_age a where a.user_id = (select auth.uid())), 'self');
$$;

-- Eski hesaplar için tek seferlik beyan (yaş grubu bilinmiyorsa). Sonradan değişiklik yalnızca
-- e-Devlet doğrulaması ya da yönetici (itiraz incelemesi) ile yapılır.
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
  return v_group;
end;
$$;

-- Yönetici: yaş itirazı sonucu yaş grubunu değiştirir (insan incelemesi — Yönetmelik md. 10)
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
  else
    perform private.apply_age_group(p_user, p_group, 'admin');
  end if;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'age_group:' || p_group, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function private.admin_age_group_of(p_user uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return private.age_group_of(p_user);
end;
$$;

-- ─── 15–18 yaş kuralları ─────────────────────────────────────────────────────

-- Takipçi / takip listesi: 15-18 yaştaki kişinin listesi yalnızca kendisine görünür
create or replace function private.followers_of(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_view_user(target) then
    return;
  end if;
  if private.is_minor(target) and target is distinct from (select auth.uid()) then
    return;
  end if;
  return query
    select p.id, p.username, p.name, p.avatar_url, f.created_at
    from public.follows f
    join public.profiles p on p.id = f.follower_id
    where f.following_id = target and f.status = 'accepted'
    order by f.created_at desc;
end;
$$;

create or replace function private.following_of(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.can_view_user(target) then
    return;
  end if;
  if private.is_minor(target) and target is distinct from (select auth.uid()) then
    return;
  end if;
  return query
    select p.id, p.username, p.name, p.avatar_url, f.created_at
    from public.follows f
    join public.profiles p on p.id = f.following_id
    where f.follower_id = target and f.status = 'accepted'
    order by f.created_at desc;
end;
$$;

-- Mesaj: 15-18 yaştaki kişiye yalnızca onun takip ettiği hesaplar yazabilir
create or replace function private.minor_accepts_from(p_minor uuid, p_sender uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not private.is_minor(p_minor)
      or exists (select 1 from public.follows f
                 where f.follower_id = p_minor and f.following_id = p_sender and f.status = 'accepted');
$$;

create or replace function private.can_message(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(bool_and(
    private.minor_accepts_from(m.user_id, (select auth.uid()))
    and (
      private.policy_allows(s.message_policy, m.user_id, (select auth.uid()))
      or exists (select 1 from public.messages x where x.conversation_id = p_conversation and x.sender_id = m.user_id)
    )
  ), true)
  from public.conversation_members m
  left join public.user_settings s on s.user_id = m.user_id
  where m.conversation_id = p_conversation and m.user_id <> (select auth.uid());
$$;

create or replace function private.get_or_create_dm(p_other uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_key  text;
  v_id   uuid;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if p_other is null or p_other = v_uid then
    raise exception 'invalid_recipient' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_other and p.status <> 'banned') then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;
  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if private.blocked_pair(v_uid, p_other) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;
  if not private.minor_accepts_from(p_other, v_uid) then
    raise exception 'minor_dm_not_allowed' using errcode = 'P0001';
  end if;

  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);

  insert into public.conversations (dm_key) values (v_key) on conflict (dm_key) do nothing;
  select c.id into v_id from public.conversations c where c.dm_key = v_key;

  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (v_id, v_uid, now()), (v_id, p_other, '-infinity')
  on conflict do nothing;

  return v_id;
end;
$$;

-- Kişi arama: 15-18 yaştaki hesaplar yalnızca takip ilişkisi olanlara çıkar; 15 altı ve yasaklılar hiç çıkmaz
create or replace function private.search_people(p_query text)
returns table (id uuid, username text, name text, avatar_url text, verified boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  q text := regexp_replace(btrim(coalesce(p_query, '')), '[%_\\]', '', 'g');
begin
  if char_length(q) < 2 then
    return;
  end if;
  return query
    select p.id, p.username, p.name, p.avatar_url, p.verified
    from public.profiles p
    where p.id is distinct from v_uid
      and p.status <> 'banned'
      and not private.blocked_pair(p.id, v_uid)
      and (p.username ilike '%' || q || '%' or p.name ilike '%' || q || '%')
      and private.age_group_of(p.id) <> 'under15'
      and (
        not private.is_minor(p.id)
        or exists (select 1 from public.follows f
                   where (f.follower_id = v_uid and f.following_id = p.id)
                      or (f.follower_id = p.id and f.following_id = v_uid))
      )
    order by (p.username = lower(q)) desc, p.verified desc, p.username
    limit 20;
end;
$$;

-- Yetkiler: özel şemadaki fonksiyonlar dışarıya kapalı; ince sarmalayıcılar public'te
revoke execute on function
  private.age_group_of(uuid), private.is_minor(uuid), private.age_group_from(date),
  private.apply_age_group(uuid, text, text), private.my_age(), private.declare_birth_date(date),
  private.admin_set_age_group(uuid, text, text), private.admin_age_group_of(uuid),
  private.minor_accepts_from(uuid, uuid), private.search_people(text)
from public, anon, authenticated;
-- public sarmalayıcılar (SECURITY INVOKER) bunları giriş yapmış kullanıcı olarak çağırır
grant execute on function private.my_age(), private.declare_birth_date(date), private.search_people(text),
  private.admin_set_age_group(uuid, text, text), private.admin_age_group_of(uuid) to authenticated;

create or replace function public.my_age()
returns table (age_group text, method text)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.my_age(); end; $$;

create or replace function public.declare_birth_date(p_birth date)
returns text
language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); return private.declare_birth_date(p_birth); end; $$;

create or replace function public.search_people(p_query text)
returns table (id uuid, username text, name text, avatar_url text, verified boolean)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.search_people(p_query); end; $$;

create or replace function public.admin_set_age_group(p_user uuid, p_group text, p_reason text default null)
returns void
language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_set_age_group(p_user, p_group, p_reason); end; $$;

create or replace function public.admin_age_group_of(p_user uuid)
returns text
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return private.admin_age_group_of(p_user); end; $$;

revoke execute on function public.my_age(), public.declare_birth_date(date), public.search_people(text),
  public.admin_set_age_group(uuid, text, text), public.admin_age_group_of(uuid) from public, anon;
grant execute on function public.my_age(), public.declare_birth_date(date), public.search_people(text),
  public.admin_set_age_group(uuid, text, text), public.admin_age_group_of(uuid) to authenticated;

-- Destek: yaş itirazı konusu
alter table public.support_tickets drop constraint if exists support_tickets_topic_check;
alter table public.support_tickets add constraint support_tickets_topic_check
  check (topic in ('hesap', 'arena', 'magaza', 'guvenlik', 'hata', 'oneri', 'diger', 'yas'));
