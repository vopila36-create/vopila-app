-- ============================================================================
-- VOPILA — Sosyal ekler
--  1) Yorum yanıtları (parent_id; yanıt aynı gönderide olmalı, yanıta yanıt tek seviye)
--  2) @bahsetme bildirimi (gönderi açıklaması ve yorumlarda) + yanıt bildirimi
--  3) Mesajlaşma düzeltmesi: yeni sohbette karşı tarafın ilk mesajı "okunmamış" sayılsın
-- ============================================================================

-- ─── 1) Yorum yanıtları ─────────────────────────────────────────────────────

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;
create index if not exists comments_parent_idx on public.comments (parent_id);

create or replace function private.validate_comment_parent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_post uuid;
  v_parent_parent uuid;
begin
  if new.parent_id is null then
    return new;
  end if;
  select c.post_id, c.parent_id into v_post, v_parent_parent from public.comments c where c.id = new.parent_id;
  if v_post is null or v_post <> new.post_id then
    raise exception 'invalid_parent' using errcode = 'P0001';
  end if;
  -- Tek seviye: yanıta yanıt verilirse ana yoruma bağlanır (Instagram gibi)
  if v_parent_parent is not null then
    new.parent_id := v_parent_parent;
  end if;
  return new;
end;
$$;
revoke execute on function private.validate_comment_parent() from public, anon, authenticated;
drop trigger if exists comments_validate_parent on public.comments;
create trigger comments_validate_parent before insert on public.comments
  for each row execute function private.validate_comment_parent();

-- ─── 2) Bildirimler: bahsetme ve yanıt ──────────────────────────────────────

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('like', 'comment', 'follow', 'arena', 'token', 'order', 'mention', 'reply'));

-- Metindeki @kullaniciadi'larına bildirim (en fazla 10 kişi; kendine, engelliye ve
-- içeriği göremeyecek kişiye gitmez)
create or replace function private.notify_mentions(p_text text, p_actor uuid, p_post uuid, p_what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  select po.author_id into v_author from public.posts po where po.id = p_post;
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select distinct p.id, 'mention', p_actor,
         a.name || ' ' || p_what || ' senden bahsetti.', '/gonderi/' || p_post::text
  from (
    select lower(m[1]) as uname
    from regexp_matches(coalesce(p_text, ''), '@([A-Za-z0-9_]{3,20})', 'g') as m
    limit 10
  ) u
  join public.profiles p on p.username = u.uname
  join public.profiles a on a.id = p_actor
  where p.id <> p_actor
    and not private.blocked_pair(p.id, p_actor)
    -- Gizli hesabın gönderisinde bahsedilen kişi gönderiyi göremiyorsa bildirim gitmez
    and (
      p.id = v_author
      or not coalesce((select pr.is_private from public.profiles pr where pr.id = v_author), false)
      or exists (select 1 from public.follows f where f.follower_id = p.id and f.following_id = v_author and f.status = 'accepted')
    );
end;
$$;
revoke execute on function private.notify_mentions(text, uuid, uuid, text) from public, anon, authenticated;

create or replace function private.on_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_mentions(new.caption, new.author_id, new.id, 'bir gönderide');
  return null;
end;
$$;
revoke execute on function private.on_post_mentions() from public, anon, authenticated;
drop trigger if exists posts_mentions on public.posts;
create trigger posts_mentions after insert on public.posts
  for each row execute function private.on_post_mentions();

create or replace function private.on_comment_extras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.notify_mentions(new.text, new.author_id, new.post_id, 'bir yorumda');
  -- Yanıt bildirimi: ana yorumun sahibine (kendisi değilse)
  if new.parent_id is not null then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select c.author_id, 'reply', new.author_id,
           a.name || ' yorumuna yanıt verdi: "' || left(new.text, 60) || '"', '/gonderi/' || new.post_id::text
    from public.comments c
    join public.profiles a on a.id = new.author_id
    where c.id = new.parent_id and c.author_id <> new.author_id
      and not private.blocked_pair(c.author_id, new.author_id);
  end if;
  return null;
end;
$$;
revoke execute on function private.on_comment_extras() from public, anon, authenticated;
drop trigger if exists comments_extras on public.comments;
create trigger comments_extras after insert on public.comments
  for each row execute function private.on_comment_extras();

-- ─── 3) Mesajlaşma: yeni sohbette karşı tarafın "son okuma"sı en başta ─────

create or replace function private.get_or_create_dm(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
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

  v_key := least(v_uid::text, p_other::text) || ':' || greatest(v_uid::text, p_other::text);

  insert into public.conversations (dm_key) values (v_key) on conflict (dm_key) do nothing;
  select c.id into v_id from public.conversations c where c.dm_key = v_key;

  insert into public.conversation_members (conversation_id, user_id, last_read_at)
  values (v_id, v_uid, now()), (v_id, p_other, '-infinity')
  on conflict do nothing;

  return v_id;
end;
$$;
