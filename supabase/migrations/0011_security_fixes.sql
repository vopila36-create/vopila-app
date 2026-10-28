-- ============================================================================
-- VOPILA — Güvenlik düzeltmeleri (otomatik güvenlik incelemesi bulguları)
--  1) İki adımlı doğrulama SUNUCUDA zorunlu: hesabında doğrulanmış 2FA olan kullanıcının oturumu
--     kod girilmeden ("aal2" olmadan) hiçbir tabloya, dosyaya ve fonksiyona erişemez.
--     (Uygulamadaki kod ekranı atlanıp doğrudan API'ye gidilse bile.)
--  2) Kısıtlanan kişinin yorumu giriş yapmamış ziyaretçiye de görünmez (NULL karşılaştırması düzeltildi).
-- ============================================================================

-- ─── 1) aal2 kontrolü ───────────────────────────────────────────────────────

-- Oturum yeterince doğrulanmış mı? (2FA yoksa her zaman evet; varsa kod girilmiş olmalı)
create or replace function private.aal_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is null
    or coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = (select auth.uid()) and f.status = 'verified'
    );
$$;
revoke execute on function private.aal_ok() from public;
grant execute on function private.aal_ok() to anon, authenticated;

-- Her tabloya kısıtlayıcı (restrictive) kural: diğer kurallarla birlikte VE olarak uygulanır
do $$
declare t text;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "aal2 gerekli" on public.%I', t);
    execute format(
      'create policy "aal2 gerekli" on public.%I as restrictive for all to authenticated
         using (private.aal_ok()) with check (private.aal_ok())', t);
  end loop;
end $$;

drop policy if exists "storage: aal2 gerekli" on storage.objects;
create policy "storage: aal2 gerekli" on storage.objects
  as restrictive for all to authenticated
  using (private.aal_ok()) with check (private.aal_ok());

-- Tablo kurallarını atlayan (SECURITY DEFINER) fonksiyonlarda da aynı kontrol.
-- Hepsi auth.uid() ile çalıştığı için ortak bir kapı fonksiyonu kullanılır.
create or replace function private.require_aal()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.aal_ok() then
    raise exception 'mfa_required' using errcode = '42501', hint = 'İki adımlı doğrulama kodu gerekli.';
  end if;
end;
$$;
revoke execute on function private.require_aal() from public;
grant execute on function private.require_aal() to anon, authenticated;

-- API'ye açık sarmalayıcıları kapıdan geçir (iç fonksiyonlar değişmez)
create or replace function public.export_my_data()
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.export_my_data(); end; $$;

create or replace function public.delete_my_account()
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.delete_my_account(); end; $$;

create or replace function public.get_or_create_dm(p_other uuid)
returns uuid language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.get_or_create_dm(p_other); end; $$;

create or replace function public.my_conversations()
returns table (
  id uuid, other_id uuid, other_username text, other_name text, other_avatar text, other_verified boolean,
  last_kind text, last_text text, last_sender uuid, last_at timestamptz, unread integer
)
language plpgsql stable security invoker set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.my_conversations(); end; $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.mark_conversation_read(p_conversation); end; $$;

create or replace function public.place_order(p_items jsonb, p_address jsonb)
returns uuid language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.place_order(p_items, p_address); end; $$;

create or replace function public.admin_review_reward(p_reward uuid, p_approve boolean, p_note text default null)
returns text language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.admin_review_reward(p_reward, p_approve, p_note); end; $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default null)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_set_user_status(p_user, p_status, p_reason); end; $$;

create or replace function public.admin_resolve_report(p_report uuid, p_decision text)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_resolve_report(p_report, p_decision); end; $$;

create or replace function public.get_followers(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.followers_of(target); end; $$;

create or replace function public.get_following(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language plpgsql stable security invoker set search_path = ''
as $$ begin perform private.require_aal(); return query select * from private.following_of(target); end; $$;

create or replace function public.am_i_admin()
returns boolean language plpgsql stable security invoker set search_path = ''
as $$ begin return private.aal_ok() and private.is_admin(); end; $$;

-- ─── 2) Kısıtlanan yorum: giriş yapmamış ziyaretçi için de gizli ────────────

drop policy if exists "comments: görünür gönderilerin yorumları" on public.comments;
create policy "comments: görünür gönderilerin yorumları" on public.comments
  for select to anon, authenticated
  using (
    exists (select 1 from public.posts p where p.id = comments.post_id)
    and not private.blocked_pair(comments.author_id, (select auth.uid()))
    and (not comments.is_hidden or comments.author_id = (select auth.uid()) or private.is_admin())
    and (
      comments.author_id = (select auth.uid())
      -- "is distinct from": oturumsuz (NULL) ziyaretçide de doğru çalışır
      or not exists (
        select 1 from public.posts p
        where p.id = comments.post_id
          and p.author_id is distinct from (select auth.uid())
          and private.is_restricted(p.author_id, comments.author_id)
      )
    )
  );

-- ─── 3) Bildirim tercihleri: yalnızca doğru/yanlış değerler; kapı bozuk veriye dayanıklı ─
-- (Bozuk bir değer başkalarının bu kişiye bildirim üreten işlemlerini bozmasın)
create or replace function private.notif_is_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (select 1 from jsonb_each(p) e where jsonb_typeof(e.value) <> 'boolean');
$$;
update public.user_settings set notif = '{}' where not private.notif_is_valid(notif);
alter table public.user_settings drop constraint if exists user_settings_notif_valid;
alter table public.user_settings add constraint user_settings_notif_valid check (private.notif_is_valid(notif));

create or replace function private.notification_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('like', 'comment', 'follow', 'mention', 'reply') and exists (
    select 1 from public.user_settings s where s.user_id = new.user_id and (s.notif -> new.kind) = 'false'::jsonb
  ) then
    return null;
  end if;
  if new.actor_id is not null and new.kind in ('comment', 'reply', 'mention', 'like')
     and private.is_restricted(new.user_id, new.actor_id) then
    return null;
  end if;
  return new;
end;
$$;

-- ─── 4) Kısıtlanan kişinin yorumundan başkalarına bahsetme / yanıt bildirimi gitmez ─
-- (Yorum yalnızca yazan ve gönderi sahibine görünür; bildirim metni onu sızdırmasın)
create or replace function private.on_comment_extras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_post_hidden boolean;
begin
  if new.is_hidden then
    return null;
  end if;
  select po.author_id, po.is_hidden into v_author, v_post_hidden from public.posts po where po.id = new.post_id;
  if v_author is null or v_post_hidden or private.is_restricted(v_author, new.author_id) then
    return null;
  end if;
  perform private.notify_mentions(new.text, new.author_id, new.post_id, 'bir yorumda');
  if new.parent_id is not null then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select c.author_id, 'reply', new.author_id,
           a.name || ' yorumuna yanıt verdi: "' || left(new.text, 60) || '"', '/gonderi/' || new.post_id::text
    from public.comments c
    join public.profiles a on a.id = new.author_id
    where c.id = new.parent_id
      and c.author_id <> new.author_id
      and not c.is_hidden
      and not private.blocked_pair(c.author_id, new.author_id)
      and private.can_view_user_as(c.author_id, v_author);
  end if;
  return null;
end;
$$;
