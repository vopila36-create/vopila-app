-- ============================================================================
-- VOPILA — 18 yaş altı koruması (2) ve ebeveyn denetimi
-- (Sosyal Ağ Sağlayıcılarda Yaş Doğrulama Yönetmeliği md. 8–9)
--  1) 15–18 yaş profilleri veri katmanında gizlenir: yalnızca kendisi, takip ilişkisi olan,
--     ortak sohbeti olan, bağlı ebeveyni ve yönetici görür. 15 altı: yalnızca kendisi + yönetici.
--     (Uygulama dışından doğrudan tabloya yapılan aramalar da artık bu hesapları bulamaz.)
--  2) protected_media: 18 altı hesapların görsellerinde ekran görüntüsü koruması işareti.
--  3) Ebeveyn denetimi: genç tek kullanımlık kod üretir, ebeveyn (18+) kodu girer.
--     Ebeveyn: günlük süre sınırı, hesap gizli kalsın, yalnızca takip edilenler yorum yapsın.
--     Genç bağlantıyı tek başına kaldıramaz: istek ebeveynin onayına düşer (md. 9).
-- ============================================================================

-- ─── 1) Ekran görüntüsü koruması işareti ─────────────────────────────────────
alter table public.profiles add column if not exists protected_media boolean not null default false;

create or replace function private.apply_age_group(p_user uuid, p_group text, p_method text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- Önce gizliye al (15 altı olarak işaretlenen hesap artık kendi profilini güncelleyemez)
  if p_group in ('teen', 'under15') then
    update public.profiles set is_private = true where id = p_user and not is_private;
  end if;
  update public.profiles set protected_media = (p_group in ('teen', 'under15'))
   where id = p_user and protected_media is distinct from (p_group in ('teen', 'under15'));
  insert into private.user_age (user_id, age_group, method, updated_at)
  values (p_user, p_group, p_method, now())
  on conflict (user_id) do update set age_group = excluded.age_group, method = excluded.method, updated_at = now();
end;
$$;
revoke execute on function private.apply_age_group(uuid, text, text) from public, anon, authenticated;

update public.profiles p set protected_media = true
 where exists (select 1 from private.user_age a where a.user_id = p.id and a.age_group in ('teen', 'under15'));

-- ─── 3a) Ebeveyn bağlantısı tabloları ────────────────────────────────────────
create table if not exists public.parent_links (
  child_id        uuid primary key references public.profiles (id) on delete cascade,
  parent_id       uuid not null references public.profiles (id) on delete cascade,
  status          text not null default 'active' check (status in ('active', 'unlink_requested')),
  daily_limit_min integer check (daily_limit_min is null or daily_limit_min between 15 and 600),
  lock_private    boolean not null default true,
  lock_comments   boolean not null default false,
  created_at      timestamptz not null default now(),
  check (child_id <> parent_id)
);
create index if not exists parent_links_parent_idx on public.parent_links (parent_id);
alter table public.parent_links enable row level security;

drop policy if exists "aal2 gerekli" on public.parent_links;
create policy "aal2 gerekli" on public.parent_links as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "parent_links: taraflar görür" on public.parent_links;
create policy "parent_links: taraflar görür" on public.parent_links for select to authenticated
  using ((select auth.uid()) in (child_id, parent_id));
-- Yazma yalnızca aşağıdaki fonksiyonlarla

create table if not exists private.parent_codes (
  child_id    uuid primary key references auth.users (id) on delete cascade,
  code_hash   text not null,
  expires_at  timestamptz not null
);

create table if not exists private.parent_link_attempts (
  user_id  uuid not null,
  at       timestamptz not null default now()
);
create index if not exists parent_link_attempts_idx on private.parent_link_attempts (user_id, at);

-- ─── 1b) Profil görünürlüğü (veri katmanı) ───────────────────────────────────
create or replace function private.profile_visible(p_target uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_group text := private.age_group_of(p_target);
begin
  if v_group in ('unknown', 'adult') then
    return true;
  end if;
  if v_uid is not null and v_uid = p_target then
    return true;
  end if;
  if private.is_admin() then
    return true;
  end if;
  if v_group = 'under15' or v_uid is null then
    return false;
  end if;
  -- 15–18: yalnızca ilişkisi olanlar
  return exists (select 1 from public.follows f
                 where (f.follower_id = v_uid and f.following_id = p_target)
                    or (f.follower_id = p_target and f.following_id = v_uid))
      or exists (select 1 from public.conversation_members a
                 join public.conversation_members b on b.conversation_id = a.conversation_id
                 where a.user_id = v_uid and b.user_id = p_target)
      or exists (select 1 from public.parent_links l where l.child_id = p_target and l.parent_id = v_uid);
end;
$$;
grant execute on function private.profile_visible(uuid) to anon, authenticated;

drop policy if exists "profiles: 18 yaş altı koruması" on public.profiles;
create policy "profiles: 18 yaş altı koruması" on public.profiles as restrictive for select to anon, authenticated
  using (private.profile_visible(id));

-- ─── 3b) Gencin hesabını kilitleyen ebeveyn ayarları ─────────────────────────
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
  -- Ebeveyn "hesap gizli kalsın" dediyse genç hesabını herkese açamaz
  if (select auth.role()) = 'authenticated'
     and old.id = (select auth.uid())
     and old.is_private and not new.is_private
     and exists (select 1 from public.parent_links l where l.child_id = old.id and l.lock_private) then
    raise exception 'parent_locked' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- "Yalnızca takip edilenler yorum yapsın" kilidi: genç ayarı gevşetemez (sessizce korunur)
create or replace function private.guard_settings_parent()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.user_id = (select auth.uid())
     and new.comment_policy in ('everyone', 'followers')
     and exists (select 1 from public.parent_links l where l.child_id = new.user_id and l.lock_comments) then
    new.comment_policy := 'following';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_settings_parent() from public, anon, authenticated;
drop trigger if exists guard_settings_parent on public.user_settings;
create trigger guard_settings_parent before insert or update on public.user_settings
  for each row execute function private.guard_settings_parent();

-- ─── 3c) Bildirim türü ───────────────────────────────────────────────────────
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'arena', 'token', 'order', 'mention', 'reply', 'support', 'parent'));

create or replace function private.parent_notify(p_user uuid, p_actor uuid, p_text text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, kind, actor_id, text, href)
  values (p_user, 'parent', p_actor, left(p_text, 300), '/ebeveyn-denetimi');
$$;

-- ─── 3d) İşlemler ────────────────────────────────────────────────────────────

-- Genç: 15 dakika geçerli, 8 karakterlik tek kullanımlık kod üretir
create or replace function private.parent_create_code()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := extensions.gen_random_bytes(8);
  i integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if private.age_group_of(v_uid) <> 'teen' then
    raise exception 'parent_only_for_teens' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.parent_links l where l.child_id = v_uid) then
    raise exception 'parent_already_linked' using errcode = 'P0001';
  end if;
  for i in 0..7 loop
    v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;
  insert into private.parent_codes (child_id, code_hash, expires_at)
  values (v_uid, encode(extensions.digest(v_code, 'sha256'), 'hex'), now() + interval '15 minutes')
  on conflict (child_id) do update set code_hash = excluded.code_hash, expires_at = excluded.expires_at;
  return v_code;
end;
$$;

-- Ebeveyn (18+): kodu girer, hesaplar bağlanır
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
  -- Deneme sınırı: saatte 10
  delete from private.parent_link_attempts where at < now() - interval '1 hour';
  if (select count(*) from private.parent_link_attempts where user_id = v_uid) >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into private.parent_link_attempts (user_id) values (v_uid);

  select c.child_id into v_child from private.parent_codes c
   where c.code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex') and c.expires_at > now();
  if v_child is null then
    raise exception 'parent_code_invalid' using errcode = 'P0001';
  end if;
  if v_child = v_uid then
    raise exception 'parent_code_invalid' using errcode = 'P0001';
  end if;
  insert into public.parent_links (child_id, parent_id) values (v_child, v_uid);
  delete from private.parent_codes where child_id = v_child;
  update public.profiles set is_private = true where id = v_child and not is_private;
  perform private.parent_notify(v_child, v_uid, 'Ebeveyn denetimi bağlandı. Ayarlarını Ayarlar > Ebeveyn denetimi bölümünde görebilirsin.');
  return v_child;
end;
$$;

-- Ebeveyn: denetim ayarları
create or replace function private.parent_set_controls(p_child uuid, p_daily_limit integer, p_lock_private boolean, p_lock_comments boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not exists (select 1 from public.parent_links l where l.child_id = p_child and l.parent_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_daily_limit is not null and (p_daily_limit < 15 or p_daily_limit > 600) then
    raise exception 'invalid_limit' using errcode = 'P0001';
  end if;
  update public.parent_links
     set daily_limit_min = p_daily_limit, lock_private = coalesce(p_lock_private, true), lock_comments = coalesce(p_lock_comments, false)
   where child_id = p_child;
  if coalesce(p_lock_private, true) then
    update public.profiles set is_private = true where id = p_child and not is_private;
  end if;
  if coalesce(p_lock_comments, false) then
    insert into public.user_settings (user_id, comment_policy) values (p_child, 'following')
    on conflict (user_id) do update set comment_policy = 'following'
      where public.user_settings.comment_policy in ('everyone', 'followers');
  end if;
  perform private.parent_notify(p_child, v_uid, 'Ebeveynin denetim ayarlarını güncelledi.');
end;
$$;

-- Ebeveyn: bağlantıyı kaldırır (gencin kaldırma isteğini onaylamak da budur)
create or replace function private.parent_unlink(p_child uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  delete from public.parent_links where child_id = p_child and parent_id = v_uid;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.parent_notify(p_child, v_uid, 'Ebeveyn denetimi kaldırıldı.');
end;
$$;

-- Genç: bağlantıyı kaldırmak için ebeveyninden onay ister
create or replace function private.child_request_unlink()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_parent uuid;
begin
  update public.parent_links set status = 'unlink_requested' where child_id = v_uid
  returning parent_id into v_parent;
  if v_parent is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.parent_notify(v_parent, v_uid, 'Çocuğun ebeveyn denetimini kaldırmak istiyor. Onaylamak ya da reddetmek için dokun.');
end;
$$;

-- Ebeveyn: kaldırma isteğini reddeder
create or replace function private.parent_keep_link(p_child uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  update public.parent_links set status = 'active' where child_id = p_child and parent_id = v_uid;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform private.parent_notify(p_child, v_uid, 'Ebeveynin denetimin devam etmesini istedi.');
end;
$$;

-- Bağlantılarım (ebeveyn ya da genç olarak); karşı tarafın profili bağlantı sayesinde görünür
create or replace function private.my_parent_links()
returns table (role text, other_id uuid, other_username text, other_name text, other_avatar text,
               status text, daily_limit_min integer, lock_private boolean, lock_comments boolean)
language sql stable security definer set search_path = ''
as $$
  select case when l.parent_id = (select auth.uid()) then 'parent' else 'child' end,
         p.id, p.username, p.name, p.avatar_url, l.status, l.daily_limit_min, l.lock_private, l.lock_comments
  from public.parent_links l
  join public.profiles p on p.id = case when l.parent_id = (select auth.uid()) then l.child_id else l.parent_id end
  where (select auth.uid()) in (l.parent_id, l.child_id);
$$;

revoke execute on function private.parent_notify(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function private.parent_create_code(), private.parent_link(text),
  private.parent_set_controls(uuid, integer, boolean, boolean), private.parent_unlink(uuid),
  private.child_request_unlink(), private.parent_keep_link(uuid), private.my_parent_links() from public, anon;
grant execute on function private.parent_create_code(), private.parent_link(text),
  private.parent_set_controls(uuid, integer, boolean, boolean), private.parent_unlink(uuid),
  private.child_request_unlink(), private.parent_keep_link(uuid), private.my_parent_links() to authenticated;

-- public sarmalayıcılar (iki adımlı doğrulama kontrolüyle)
create or replace function public.parent_create_code() returns text language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); return private.parent_create_code(); end; $$;
create or replace function public.parent_link(p_code text) returns uuid language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); return private.parent_link(p_code); end; $$;
create or replace function public.parent_set_controls(p_child uuid, p_daily_limit integer, p_lock_private boolean, p_lock_comments boolean)
returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.parent_set_controls(p_child, p_daily_limit, p_lock_private, p_lock_comments); end; $$;
create or replace function public.parent_unlink(p_child uuid) returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.parent_unlink(p_child); end; $$;
create or replace function public.child_request_unlink() returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.child_request_unlink(); end; $$;
create or replace function public.parent_keep_link(p_child uuid) returns void language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); perform private.parent_keep_link(p_child); end; $$;
create or replace function public.my_parent_links()
returns table (role text, other_id uuid, other_username text, other_name text, other_avatar text,
               status text, daily_limit_min integer, lock_private boolean, lock_comments boolean)
language plpgsql stable set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.my_parent_links(); end; $$;

revoke execute on function public.parent_create_code(), public.parent_link(text),
  public.parent_set_controls(uuid, integer, boolean, boolean), public.parent_unlink(uuid),
  public.child_request_unlink(), public.parent_keep_link(uuid), public.my_parent_links() from public, anon;
grant execute on function public.parent_create_code(), public.parent_link(text),
  public.parent_set_controls(uuid, integer, boolean, boolean), public.parent_unlink(uuid),
  public.child_request_unlink(), public.parent_keep_link(uuid), public.my_parent_links() to authenticated;
