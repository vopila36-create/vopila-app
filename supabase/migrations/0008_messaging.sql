-- ============================================================================
-- VOPILA — Mesajlaşma (DM) ve gönderi iletme ("arkadaşına gönder")
--  * İki kişilik sohbetler; her çift için tek sohbet (dm_key).
--  * Mesajı yalnızca sohbetin üyeleri görür ve yazar; engel varsa yazılamaz.
--  * Sohbet ve üyelik satırlarını istemci doğrudan yazamaz (yalnızca fonksiyonlar).
--  * Paylaşılan gönderi alıcıya kendi görme yetkisine göre görünür (posts RLS).
--  * Hız sınırı + askıya alınmış hesap koruması (guard_user_write), sunucu saati.
-- ============================================================================

create table if not exists public.conversations (
  id               uuid primary key default gen_random_uuid(),
  -- İki kişilik sohbetin anahtarı: küçük_uuid:büyük_uuid (aynı çift için ikinci sohbet açılmaz)
  dm_key           text unique,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  last_read_at     timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  sender_id        uuid not null references public.profiles (id) on delete cascade,
  kind             text not null default 'text' check (kind in ('text', 'post')),
  text             text not null default '' check (char_length(text) <= 1000),
  -- Gönderi silinirse mesaj kalır, "Bu gönderi artık yok" gösterilir
  post_id          uuid references public.posts (id) on delete set null,
  created_at       timestamptz not null default now(),
  check (kind = 'post' or char_length(btrim(text)) > 0)
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);
create index if not exists messages_post_idx on public.messages (post_id);

-- ─── Yardımcılar ────────────────────────────────────────────────────────────

create or replace function private.is_member(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation and m.user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated;

-- Sohbetteki diğer kişiyle aramda (herhangi bir yönde) engel var mı?
create or replace function private.dm_blocked(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
    where m.conversation_id = p_conversation
      and m.user_id <> (select auth.uid())
      and private.blocked_pair(m.user_id, (select auth.uid()))
  );
$$;
revoke execute on function private.dm_blocked(uuid) from public;
grant execute on function private.dm_blocked(uuid) to authenticated;

-- ─── Güvenlik kuralları ─────────────────────────────────────────────────────

alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations: üyeler görür" on public.conversations;
create policy "conversations: üyeler görür" on public.conversations
  for select to authenticated using (private.is_member(id));

drop policy if exists "conversation_members: üyeler görür" on public.conversation_members;
create policy "conversation_members: üyeler görür" on public.conversation_members
  for select to authenticated using (private.is_member(conversation_id));

drop policy if exists "messages: üyeler okur" on public.messages;
create policy "messages: üyeler okur" on public.messages
  for select to authenticated using (private.is_member(conversation_id));

drop policy if exists "messages: üye kendi adına yazar" on public.messages;
create policy "messages: üye kendi adına yazar" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and private.is_member(conversation_id)
    and not private.dm_blocked(conversation_id)
    -- Gönderi iletirken gönderiyi kendisi görebiliyor olmalı (posts RLS)
    and (post_id is null or exists (select 1 from public.posts p where p.id = post_id))
  );

revoke all on table public.conversations from anon, authenticated;
revoke all on table public.conversation_members from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
grant select on table public.conversations, public.conversation_members to authenticated;
grant select on table public.messages to authenticated;
grant insert (conversation_id, sender_id, kind, text, post_id) on table public.messages to authenticated;

-- ─── Tetikleyiciler ─────────────────────────────────────────────────────────

-- Sunucu saati
drop trigger if exists force_insert_timestamps on public.messages;
create trigger force_insert_timestamps before insert on public.messages
  for each row execute function private.force_insert_timestamps();

-- Hız sınırı (dakikada 30 mesaj) + askıdaki hesap yazamaz
insert into private.rate_limits (table_name, max_count, per_seconds) values ('messages', 30, 60)
on conflict (table_name) do nothing;
drop trigger if exists guard_user_write on public.messages;
create trigger guard_user_write before insert on public.messages
  for each row execute function private.guard_user_write('sender_id', 'created_at');

-- Sohbet listesinde en yeni mesaj üstte olsun; gönderen kendi mesajını okumuş sayılır
create or replace function private.on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.conversation_members set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return null;
end;
$$;
revoke execute on function private.on_message() from public, anon, authenticated;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function private.on_message();

-- ─── Fonksiyonlar ───────────────────────────────────────────────────────────

-- Bir kişiyle olan sohbeti bulur, yoksa açar (kendine, engelliye, banlıya açılmaz)
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

  insert into public.conversation_members (conversation_id, user_id)
  values (v_id, v_uid), (v_id, p_other)
  on conflict do nothing;

  return v_id;
end;
$$;

-- Sohbet listem: karşı kişi, son mesaj, okunmamış mesaj sayısı (engelli kişilerle olanlar gizli)
create or replace function private.my_conversations()
returns table (
  id               uuid,
  other_id         uuid,
  other_username   text,
  other_name       text,
  other_avatar     text,
  other_verified   boolean,
  last_kind        text,
  last_text        text,
  last_sender      uuid,
  last_at          timestamptz,
  unread           integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    o.user_id,
    p.username,
    p.name,
    p.avatar_url,
    p.verified,
    lm.kind,
    lm.text,
    lm.sender_id,
    lm.created_at,
    (select count(*)::integer from public.messages x
      where x.conversation_id = c.id and x.sender_id <> me.user_id and x.created_at > me.last_read_at)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  join lateral (
    select m.kind, m.text, m.sender_id, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
    and not private.blocked_pair(o.user_id, me.user_id)
    and p.status <> 'banned'
  order by c.last_message_at desc
  limit 100;
$$;

create or replace function private.mark_conversation_read(p_conversation uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.conversation_members set last_read_at = now()
   where conversation_id = p_conversation and user_id = (select auth.uid());
$$;

revoke execute on function private.get_or_create_dm(uuid) from public, anon;
revoke execute on function private.my_conversations() from public, anon;
revoke execute on function private.mark_conversation_read(uuid) from public, anon;
grant execute on function private.get_or_create_dm(uuid) to authenticated;
grant execute on function private.my_conversations() to authenticated;
grant execute on function private.mark_conversation_read(uuid) to authenticated;

-- API'ye açık ince sarmalayıcılar
create or replace function public.get_or_create_dm(p_other uuid)
returns uuid language sql security invoker set search_path = ''
as $$ select private.get_or_create_dm(p_other); $$;

create or replace function public.my_conversations()
returns table (
  id uuid, other_id uuid, other_username text, other_name text, other_avatar text, other_verified boolean,
  last_kind text, last_text text, last_sender uuid, last_at timestamptz, unread integer
)
language sql stable security invoker set search_path = ''
as $$ select * from private.my_conversations(); $$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.mark_conversation_read(p_conversation); $$;

revoke execute on function public.get_or_create_dm(uuid) from public, anon;
revoke execute on function public.my_conversations() from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.my_conversations() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ─── Canlı güncelleme ───────────────────────────────────────────────────────
-- Sohbet ekranı yeni mesajları anında alır (Realtime, RLS'e uyar: yalnızca üyeler)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
