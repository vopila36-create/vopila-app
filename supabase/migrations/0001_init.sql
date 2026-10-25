-- ============================================================================
-- VOPILA — ilk veritabanı şeması (2. aşama)
-- Yerel demo hafızasının (src/store/app-store.tsx) ve örnek verilerin
-- (src/data/mock.ts) yaptığı her şeyin sunucu karşılığı.
--
-- Güvenlik ilkeleri:
--  * public şemadaki her tabloda RLS açık; erişim açık GRANT'larla verilir
--    (yeni projelerde tablolar Data API'ye otomatik açılmıyor).
--  * Token, oy sayacı, sipariş gibi kritik yazmalar yalnızca `private` şemasındaki
--    SECURITY DEFINER fonksiyonlarla yapılır; bu şema API'ye açık değildir.
--  * Yetkilendirmede user_metadata ASLA kullanılmaz (yalnızca ilk görünen ad/foto için).
--
-- Dosya tekrar çalıştırılabilir olacak şekilde yazıldı (if not exists / or replace /
-- drop policy if exists / on conflict do nothing).
-- ============================================================================

create schema if not exists private;
grant usage on schema private to anon, authenticated;

-- ============================================================================
-- 1) PROFİLLER
-- ============================================================================

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  username          text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  name              text not null check (char_length(name) between 1 and 60),
  bio               text not null default '' check (char_length(bio) <= 150),
  location          text not null default '' check (char_length(location) <= 80),
  avatar_url        text,
  cover_url         text,
  is_private        boolean not null default false,
  verified          boolean not null default false,
  discovery_points  integer not null default 0 check (discovery_points >= 0),
  level_xp          integer not null default 0 check (level_xp >= 0),
  created_at        timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Herkes profilleri görebilir (ad, foto, biyografi); gizli hesapta içerik kısıtı diğer tablolarda.
drop policy if exists "profiles: herkes okuyabilir" on public.profiles;
create policy "profiles: herkes okuyabilir" on public.profiles
  for select to anon, authenticated
  using (true);

drop policy if exists "profiles: kendi profilini günceller" on public.profiles;
create policy "profiles: kendi profilini günceller" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
-- Puan / seviye / doğrulama rozeti kullanıcı tarafından değiştirilemez (sütun bazlı izin)
grant update (username, name, bio, location, avatar_url, cover_url, is_private)
  on table public.profiles to authenticated;

-- Yeni kullanıcı kaydında otomatik profil.
-- Google'dan gelen ad/foto YALNIZCA ilk görünen değerler içindir; yetki için kullanılmaz.
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
begin
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

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ============================================================================
-- 2) TAKİP
-- ============================================================================

-- status: 'accepted' = takip ediyor, 'pending' = gizli hesaba gönderilmiş, onay bekleyen istek.
-- Yetki kontrolleri YALNIZCA 'accepted' satırları sayar.
create table if not exists public.follows (
  follower_id   uuid not null references public.profiles (id) on delete cascade,
  following_id  uuid not null references public.profiles (id) on delete cascade,
  status        text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
alter table public.follows add column if not exists status text not null default 'accepted'
  check (status in ('pending', 'accepted'));
create index if not exists follows_following_idx on public.follows (following_id, status);

alter table public.follows enable row level security;

-- Durumu istemci değil veritabanı belirler: hedef gizli hesapsa 'pending', değilse 'accepted'.
create or replace function private.follows_set_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((select p.is_private from public.profiles p where p.id = new.following_id), false) then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;
  return new;
end;
$$;
revoke execute on function private.follows_set_status() from public, anon, authenticated;

drop trigger if exists follows_set_status on public.follows;
create trigger follows_set_status before insert on public.follows
  for each row execute function private.follows_set_status();

-- Onay: yalnızca 'pending' → 'accepted' geçişine izin ver (geri alma = satırı silmek).
create or replace function private.follows_guard_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.follower_id <> old.follower_id or new.following_id <> old.following_id
     or not (old.status = 'pending' and new.status = 'accepted') then
    raise exception 'invalid_follow_update';
  end if;
  return new;
end;
$$;
revoke execute on function private.follows_guard_update() from public, anon, authenticated;

drop trigger if exists follows_guard_update on public.follows;
create trigger follows_guard_update before update on public.follows
  for each row execute function private.follows_guard_update();

-- Satırları doğrudan yalnızca ilgili iki kişi görür (bekleyen istekler dahil);
-- başkalarının listeleri gizlilik kuralını uygulayan get_followers / get_following'den gelir.
drop policy if exists "follows: tarafları görür" on public.follows;
create policy "follows: tarafları görür" on public.follows
  for select to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

drop policy if exists "follows: kendi adına takip eder" on public.follows;
create policy "follows: kendi adına takip eder" on public.follows
  for insert to authenticated
  with check ((select auth.uid()) = follower_id);

-- Takip isteğini yalnızca takip EDİLEN kişi onaylayabilir.
drop policy if exists "follows: isteği hedef onaylar" on public.follows;
create policy "follows: isteği hedef onaylar" on public.follows
  for update to authenticated
  using ((select auth.uid()) = following_id)
  with check ((select auth.uid()) = following_id);

-- Takibi bırakan (takipçi) ya da takipçiyi çıkaran / isteği reddeden (hedef) silebilir.
drop policy if exists "follows: kendi takibini bırakır" on public.follows;
drop policy if exists "follows: taraflar silebilir" on public.follows;
create policy "follows: taraflar silebilir" on public.follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

revoke all on table public.follows from anon, authenticated;
grant select, delete on table public.follows to authenticated;
-- status'u istemci yazamaz (tetikleyici belirler); yalnızca onay için güncelleyebilir.
grant insert (follower_id, following_id) on table public.follows to authenticated;
grant update (status) on table public.follows to authenticated;

-- Bir kullanıcının içeriğini / listelerini görebilir miyim?
-- (hesap açık, ya da benim hesabım, ya da onu takip ediyorum)
-- follows tablosuna RLS'siz bakması gerektiği için SECURITY DEFINER (özyinelemeyi önler).
create or replace function private.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target = (select auth.uid())
    or not coalesce((select p.is_private from public.profiles p where p.id = target), false)
    or exists (
      select 1 from public.follows f
      where f.follower_id = (select auth.uid()) and f.following_id = target
        and f.status = 'accepted'
    );
$$;

revoke execute on function private.can_view_user(uuid) from public;
grant execute on function private.can_view_user(uuid) to anon, authenticated;

-- Takipçi / takip listeleri (gizli hesapta yalnızca sahibi ve takipçileri)
create or replace function private.followers_of(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_view_user(target) then
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
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_view_user(target) then
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

-- Sayılar herkese açık
create or replace function private.follow_counts(target uuid)
returns table (followers bigint, following bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.follows f where f.following_id = target and f.status = 'accepted'),
    (select count(*) from public.follows f where f.follower_id = target and f.status = 'accepted');
$$;

revoke execute on function private.followers_of(uuid) from public;
revoke execute on function private.following_of(uuid) from public;
revoke execute on function private.follow_counts(uuid) from public;
grant execute on function private.followers_of(uuid) to anon, authenticated;
grant execute on function private.following_of(uuid) to anon, authenticated;
grant execute on function private.follow_counts(uuid) to anon, authenticated;

-- API'ye açık ince sarmalayıcılar (SECURITY INVOKER)
create or replace function public.get_followers(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.followers_of(target); $$;

create or replace function public.get_following(target uuid)
returns table (user_id uuid, username text, name text, avatar_url text, followed_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select * from private.following_of(target); $$;

create or replace function public.get_follow_counts(target uuid)
returns table (followers bigint, following bigint)
language sql stable security invoker set search_path = ''
as $$ select * from private.follow_counts(target); $$;

grant execute on function public.get_followers(uuid) to anon, authenticated;
grant execute on function public.get_following(uuid) to anon, authenticated;
grant execute on function public.get_follow_counts(uuid) to anon, authenticated;

-- ============================================================================
-- 3) ARENALAR (gönderiler arenaya bağlanabildiği için önce)
-- ============================================================================

create table if not exists public.arenas (
  key          text primary key check (key ~ '^[a-z_]{2,30}$'),
  name         text not null,
  tagline      text not null default '',
  description  text not null default '',
  image_url    text,
  prizes       integer[] not null default '{500,300,150}' check (array_length(prizes, 1) = 3),
  sort_order   smallint not null default 0
);

alter table public.arenas enable row level security;
drop policy if exists "arenas: herkes okuyabilir" on public.arenas;
create policy "arenas: herkes okuyabilir" on public.arenas
  for select to anon, authenticated using (true);
revoke all on table public.arenas from anon, authenticated;
grant select on table public.arenas to anon, authenticated;

create table if not exists public.arena_members (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  arena_key  text not null references public.arenas (key) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (user_id, arena_key)
);
create index if not exists arena_members_arena_idx on public.arena_members (arena_key);

alter table public.arena_members enable row level security;
drop policy if exists "arena_members: herkes okuyabilir" on public.arena_members;
create policy "arena_members: herkes okuyabilir" on public.arena_members
  for select to anon, authenticated using (true);
drop policy if exists "arena_members: kendi katılır" on public.arena_members;
create policy "arena_members: kendi katılır" on public.arena_members
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "arena_members: kendi ayrılır" on public.arena_members;
create policy "arena_members: kendi ayrılır" on public.arena_members
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.arena_members from anon, authenticated;
grant select on table public.arena_members to anon;
grant select, insert, delete on table public.arena_members to authenticated;

create table if not exists public.arena_seasons (
  id          uuid primary key default gen_random_uuid(),
  arena_key   text not null references public.arenas (key) on delete cascade,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'settled')),
  settled_at  timestamptz,
  check (ends_at > starts_at)
);
-- Her arenada aynı anda tek açık sezon
create unique index if not exists arena_seasons_one_open_idx
  on public.arena_seasons (arena_key) where status = 'open';
create index if not exists arena_seasons_arena_idx on public.arena_seasons (arena_key);

alter table public.arena_seasons enable row level security;
drop policy if exists "arena_seasons: herkes okuyabilir" on public.arena_seasons;
create policy "arena_seasons: herkes okuyabilir" on public.arena_seasons
  for select to anon, authenticated using (true);
revoke all on table public.arena_seasons from anon, authenticated;
grant select on table public.arena_seasons to anon, authenticated;

-- ============================================================================
-- 4) GÖNDERİLER, MEDYA, BEĞENİ, KAYDETME, YORUM
-- ============================================================================

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  caption     text not null default '' check (char_length(caption) <= 500),
  location    text not null default '' check (char_length(location) <= 80),
  arena_key   text references public.arenas (key) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_arena_idx on public.posts (arena_key);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;

drop policy if exists "posts: görünür hesapların gönderileri" on public.posts;
create policy "posts: görünür hesapların gönderileri" on public.posts
  for select to anon, authenticated
  using (private.can_view_user(author_id));

drop policy if exists "posts: kendi adına paylaşır" on public.posts;
create policy "posts: kendi adına paylaşır" on public.posts
  for insert to authenticated
  with check ((select auth.uid()) = author_id);

drop policy if exists "posts: kendi gönderisini düzenler" on public.posts;
create policy "posts: kendi gönderisini düzenler" on public.posts
  for update to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

drop policy if exists "posts: kendi gönderisini siler" on public.posts;
create policy "posts: kendi gönderisini siler" on public.posts
  for delete to authenticated
  using ((select auth.uid()) = author_id);

revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon;
grant select, insert, delete on table public.posts to authenticated;
grant update (caption, location) on table public.posts to authenticated;

create table if not exists public.post_media (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.posts (id) on delete cascade,
  type          text not null check (type in ('image', 'video')),
  storage_path  text not null,
  poster_path   text,
  position      smallint not null default 0 check (position between 0 and 4),
  unique (post_id, position)
);

alter table public.post_media enable row level security;

drop policy if exists "post_media: görünür gönderilerin medyası" on public.post_media;
create policy "post_media: görünür gönderilerin medyası" on public.post_media
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));

drop policy if exists "post_media: kendi gönderisine ekler" on public.post_media;
create policy "post_media: kendi gönderisine ekler" on public.post_media
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    -- Dosya kullanıcının kendi klasöründe olmalı: {uid}/...
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );

drop policy if exists "post_media: kendi gönderisinden siler" on public.post_media;
create policy "post_media: kendi gönderisinden siler" on public.post_media
  for delete to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid())));

revoke all on table public.post_media from anon, authenticated;
grant select on table public.post_media to anon;
grant select, insert, delete on table public.post_media to authenticated;

create table if not exists public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists likes_post_idx on public.likes (post_id);

alter table public.likes enable row level security;
drop policy if exists "likes: görünür gönderilerin beğenileri" on public.likes;
create policy "likes: görünür gönderilerin beğenileri" on public.likes
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "likes: kendi adına beğenir" on public.likes;
create policy "likes: kendi adına beğenir" on public.likes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p where p.id = post_id)
  );
drop policy if exists "likes: kendi beğenisini geri alır" on public.likes;
create policy "likes: kendi beğenisini geri alır" on public.likes
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.likes from anon, authenticated;
grant select on table public.likes to anon;
grant select, insert, delete on table public.likes to authenticated;

create table if not exists public.saves (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists saves_post_idx on public.saves (post_id);

alter table public.saves enable row level security;
-- Kaydedilenler kişiye özeldir
drop policy if exists "saves: yalnızca sahibi" on public.saves;
create policy "saves: yalnızca sahibi" on public.saves
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "saves: kendi kaydeder" on public.saves;
create policy "saves: kendi kaydeder" on public.saves
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.posts p where p.id = post_id)
  );
drop policy if exists "saves: kendi kaldırır" on public.saves;
create policy "saves: kendi kaldırır" on public.saves
  for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.saves from anon, authenticated;
grant select, insert, delete on table public.saves to authenticated;

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  author_id   uuid not null references public.profiles (id) on delete cascade,
  text        text not null check (char_length(text) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_author_idx on public.comments (author_id);

alter table public.comments enable row level security;
drop policy if exists "comments: görünür gönderilerin yorumları" on public.comments;
create policy "comments: görünür gönderilerin yorumları" on public.comments
  for select to anon, authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "comments: kendi adına yorum yapar" on public.comments;
create policy "comments: kendi adına yorum yapar" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p where p.id = post_id)
  );
-- Yorumu yazan ya da gönderinin sahibi silebilir
drop policy if exists "comments: yazan veya gönderi sahibi siler" on public.comments;
create policy "comments: yazan veya gönderi sahibi siler" on public.comments
  for delete to authenticated
  using (
    (select auth.uid()) = author_id
    or exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
  );
revoke all on table public.comments from anon, authenticated;
grant select on table public.comments to anon;
grant select, insert, delete on table public.comments to authenticated;

-- ============================================================================
-- 5) ANLAR (24 saatlik hikâyeler)
-- ============================================================================

create table if not exists public.moments (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles (id) on delete cascade,
  title       text not null default '' check (char_length(title) <= 40),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
create index if not exists moments_author_idx on public.moments (author_id, created_at desc);
create index if not exists moments_expires_idx on public.moments (expires_at);

create table if not exists public.moment_items (
  id            uuid primary key default gen_random_uuid(),
  moment_id     uuid not null references public.moments (id) on delete cascade,
  type          text not null check (type in ('image', 'video')),
  storage_path  text not null,
  position      smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists moment_items_moment_idx on public.moment_items (moment_id, position);

alter table public.moments enable row level security;
alter table public.moment_items enable row level security;

drop policy if exists "moments: süresi dolmamış ve görünür" on public.moments;
create policy "moments: süresi dolmamış ve görünür" on public.moments
  for select to anon, authenticated
  using (expires_at > now() and private.can_view_user(author_id));
drop policy if exists "moments: kendi ekler" on public.moments;
create policy "moments: kendi ekler" on public.moments
  for insert to authenticated with check ((select auth.uid()) = author_id);
drop policy if exists "moments: kendi siler" on public.moments;
create policy "moments: kendi siler" on public.moments
  for delete to authenticated using ((select auth.uid()) = author_id);

drop policy if exists "moment_items: görünür anın ögeleri" on public.moment_items;
create policy "moment_items: görünür anın ögeleri" on public.moment_items
  for select to anon, authenticated
  using (exists (select 1 from public.moments m where m.id = moment_id));
drop policy if exists "moment_items: kendi anına ekler" on public.moment_items;
create policy "moment_items: kendi anına ekler" on public.moment_items
  for insert to authenticated
  with check (
    exists (select 1 from public.moments m where m.id = moment_id and m.author_id = (select auth.uid()))
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
  );
drop policy if exists "moment_items: kendi anından siler" on public.moment_items;
create policy "moment_items: kendi anından siler" on public.moment_items
  for delete to authenticated
  using (exists (select 1 from public.moments m where m.id = moment_id and m.author_id = (select auth.uid())));

revoke all on table public.moments from anon, authenticated;
revoke all on table public.moment_items from anon, authenticated;
grant select on table public.moments, public.moment_items to anon;
grant select, insert, delete on table public.moments, public.moment_items to authenticated;

-- ============================================================================
-- 6) ARENA GİRİŞLERİ VE OYLAR
-- ============================================================================

create table if not exists public.arena_entries (
  id           uuid primary key default gen_random_uuid(),
  season_id    uuid not null references public.arena_seasons (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  post_id      uuid not null references public.posts (id) on delete cascade,
  title        text not null default '' check (char_length(title) <= 60),
  image_path   text,
  -- Sayaçlar yalnızca oy tetikleyicisi tarafından güncellenir (istemci yazamaz)
  vote_count   integer not null default 0 check (vote_count >= 0),
  score_total  integer not null default 0 check (score_total >= 0),
  created_at   timestamptz not null default now(),
  unique (season_id, post_id)
);
create index if not exists arena_entries_season_idx on public.arena_entries (season_id);
create index if not exists arena_entries_author_idx on public.arena_entries (author_id);
create index if not exists arena_entries_post_idx on public.arena_entries (post_id);

alter table public.arena_entries enable row level security;

-- Yarışma herkese açıktır
drop policy if exists "arena_entries: herkes okuyabilir" on public.arena_entries;
create policy "arena_entries: herkes okuyabilir" on public.arena_entries
  for select to anon, authenticated using (true);
drop policy if exists "arena_entries: kendi gönderisiyle katılır" on public.arena_entries;
create policy "arena_entries: kendi gönderisiyle katılır" on public.arena_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and exists (
      select 1 from public.arena_seasons s
      where s.id = season_id and s.status = 'open' and s.ends_at > now()
    )
  );
drop policy if exists "arena_entries: açık sezonda geri çeker" on public.arena_entries;
create policy "arena_entries: açık sezonda geri çeker" on public.arena_entries
  for delete to authenticated
  using (
    (select auth.uid()) = author_id
    and exists (select 1 from public.arena_seasons s where s.id = season_id and s.status = 'open')
  );

revoke all on table public.arena_entries from anon, authenticated;
grant select on table public.arena_entries to anon;
grant select, delete on table public.arena_entries to authenticated;
-- vote_count / score_total dışındaki sütunlar eklenebilir
grant insert (season_id, author_id, post_id, title, image_path) on table public.arena_entries to authenticated;

create table if not exists public.arena_votes (
  entry_id    uuid not null references public.arena_entries (id) on delete cascade,
  voter_id    uuid not null references public.profiles (id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  created_at  timestamptz not null default now(),
  primary key (entry_id, voter_id)
);
create index if not exists arena_votes_voter_idx on public.arena_votes (voter_id);

alter table public.arena_votes enable row level security;

-- Tek tek oylar gizli: herkes yalnızca kendi verdiği oyu görür (toplamlar arena_entries'te)
drop policy if exists "arena_votes: kendi oyunu görür" on public.arena_votes;
create policy "arena_votes: kendi oyunu görür" on public.arena_votes
  for select to authenticated using ((select auth.uid()) = voter_id);
drop policy if exists "arena_votes: kendi adına oy verir" on public.arena_votes;
create policy "arena_votes: kendi adına oy verir" on public.arena_votes
  for insert to authenticated with check ((select auth.uid()) = voter_id);
-- Oylar değiştirilemez ve silinemez (update/delete politikası yok)

revoke all on table public.arena_votes from anon, authenticated;
grant select, insert on table public.arena_votes to authenticated;

-- Oy kuralları: kendi gönderisine oy yok, sezon açık olmalı, hesap en az 3 günlük olmalı
create or replace function private.validate_vote()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_author   uuid;
  v_status   text;
  v_ends     timestamptz;
  v_joined   timestamptz;
begin
  if new.voter_id is distinct from (select auth.uid()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  select e.author_id, s.status, s.ends_at
    into v_author, v_status, v_ends
  from public.arena_entries e
  join public.arena_seasons s on s.id = e.season_id
  where e.id = new.entry_id;

  if not found then
    raise exception 'entry_not_found' using errcode = 'P0002';
  end if;
  if v_author = new.voter_id then
    raise exception 'cannot_vote_own_entry' using errcode = 'P0001';
  end if;
  if v_status <> 'open' or v_ends <= now() then
    raise exception 'season_closed' using errcode = 'P0001';
  end if;

  select p.created_at into v_joined from public.profiles p where p.id = new.voter_id;
  if v_joined is null or v_joined > now() - interval '3 days' then
    raise exception 'account_too_new' using errcode = 'P0001';
  end if;

  new.created_at := now();
  return new;
end;
$$;

-- Oy sayacını güncelle (istemci arena_entries'e yazamadığı için SECURITY DEFINER)
create or replace function private.apply_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.arena_entries
     set vote_count = vote_count + 1,
         score_total = score_total + new.score
   where id = new.entry_id;
  return null;
end;
$$;

revoke execute on function private.validate_vote() from public, anon, authenticated;
revoke execute on function private.apply_vote() from public, anon, authenticated;

drop trigger if exists arena_votes_validate on public.arena_votes;
create trigger arena_votes_validate
  before insert on public.arena_votes
  for each row execute function private.validate_vote();

drop trigger if exists arena_votes_apply on public.arena_votes;
create trigger arena_votes_apply
  after insert on public.arena_votes
  for each row execute function private.apply_vote();

-- Uygulamanın çağıracağı oy fonksiyonu: hata kodlarını sade metne çevirir
create or replace function public.vote_entry(p_entry_id uuid, p_score integer)
returns table (vote_count integer, average numeric)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  begin
    insert into public.arena_votes (entry_id, voter_id, score)
    values (p_entry_id, (select auth.uid()), p_score::smallint);
  exception
    when unique_violation then
      raise exception 'already_voted' using errcode = 'P0001';
    when check_violation then
      raise exception 'invalid_score' using errcode = 'P0001';
  end;

  return query
    select e.vote_count, round(e.score_total::numeric / nullif(e.vote_count, 0), 2)
    from public.arena_entries e
    where e.id = p_entry_id;
end;
$$;

revoke execute on function public.vote_entry(uuid, integer) from public, anon;
grant execute on function public.vote_entry(uuid, integer) to authenticated;

-- Sıralama görünümü (RLS'e uyar: security_invoker)
-- Puan geçerli sayılması için en az 20 oy gerekir (az oyla 1. olmayı engeller)
create or replace view public.arena_rankings
with (security_invoker = true)
as
select
  e.id,
  e.season_id,
  s.arena_key,
  e.author_id,
  e.post_id,
  e.title,
  e.image_path,
  e.vote_count,
  e.score_total,
  round(e.score_total::numeric / nullif(e.vote_count, 0), 2) as average,
  (e.vote_count >= 20) as qualified,
  row_number() over (
    partition by e.season_id
    order by (e.vote_count >= 20) desc,
             (e.score_total::numeric / nullif(e.vote_count, 0)) desc nulls last,
             e.vote_count desc,
             e.created_at asc
  ) as rank
from public.arena_entries e
join public.arena_seasons s on s.id = e.season_id;

revoke all on table public.arena_rankings from anon, authenticated;
grant select on table public.arena_rankings to anon, authenticated;

-- ============================================================================
-- 7) ROZETLER
-- ============================================================================

create table if not exists public.badges (
  id           text primary key,
  name         text not null,
  image_url    text,
  description  text not null default '',
  sort_order   smallint not null default 0
);

create table if not exists public.user_badges (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  badge_id    text not null references public.badges (id) on delete cascade,
  awarded_at  timestamptz not null default now(),
  primary key (user_id, badge_id)
);
create index if not exists user_badges_badge_idx on public.user_badges (badge_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Kazanılan rozetler herkese açık; rozetleri yalnızca sistem verir
drop policy if exists "badges: herkes okuyabilir" on public.badges;
create policy "badges: herkes okuyabilir" on public.badges
  for select to anon, authenticated using (true);
drop policy if exists "user_badges: herkes okuyabilir" on public.user_badges;
create policy "user_badges: herkes okuyabilir" on public.user_badges
  for select to anon, authenticated using (true);

revoke all on table public.badges from anon, authenticated;
revoke all on table public.user_badges from anon, authenticated;
grant select on table public.badges, public.user_badges to anon, authenticated;

-- ============================================================================
-- 8) TOKEN CÜZDANI
-- ============================================================================

-- Her token hareketi bir satır; bakiye bunların toplamı. İstemci bu tabloya ASLA yazamaz.
create table if not exists public.token_ledger (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      integer not null check (amount <> 0),
  reason      text not null,
  -- Aynı ödülün iki kez verilmesini engeller (ör. 'season:<id>:rank:1')
  ref         text unique,
  created_at  timestamptz not null default now()
);
create index if not exists token_ledger_user_idx on public.token_ledger (user_id, created_at desc);

alter table public.token_ledger enable row level security;
drop policy if exists "token_ledger: kendi hareketlerini görür" on public.token_ledger;
create policy "token_ledger: kendi hareketlerini görür" on public.token_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.token_ledger from anon, authenticated;
grant select on table public.token_ledger to authenticated;

create or replace view public.my_token_balance
with (security_invoker = true)
as
select coalesce(sum(l.amount), 0)::integer as balance
from public.token_ledger l
where l.user_id = (select auth.uid());

revoke all on table public.my_token_balance from anon, authenticated;
grant select on table public.my_token_balance to authenticated;

-- ============================================================================
-- 9) MAĞAZA VE SİPARİŞLER
-- ============================================================================

create table if not exists public.products (
  id           text primary key,
  name         text not null,
  category     text not null check (category in ('Elektronik', 'Kozmetik', 'Ev & Yaşam', 'Moda', 'Spor')),
  price        integer not null check (price > 0),
  image_url    text,
  description  text not null default '',
  stock        integer not null default 0 check (stock >= 0),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.products enable row level security;
drop policy if exists "products: satıştakiler herkese açık" on public.products;
create policy "products: satıştakiler herkese açık" on public.products
  for select to anon, authenticated using (active);
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon, authenticated;

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  total       integer not null check (total > 0),
  -- { fullName, phone, city, district, line }
  address     jsonb not null,
  status      text not null default 'preparing' check (status in ('preparing', 'shipped', 'delivered', 'cancelled')),
  created_at  timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

create table if not exists public.order_items (
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  text not null references public.products (id),
  qty         integer not null check (qty > 0),
  unit_price  integer not null check (unit_price > 0),
  primary key (order_id, product_id)
);
create index if not exists order_items_product_idx on public.order_items (product_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders: kendi siparişlerini görür" on public.orders;
create policy "orders: kendi siparişlerini görür" on public.orders
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "order_items: kendi siparişinin kalemleri" on public.order_items;
create policy "order_items: kendi siparişinin kalemleri" on public.order_items
  for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid())));

revoke all on table public.orders from anon, authenticated;
revoke all on table public.order_items from anon, authenticated;
grant select on table public.orders, public.order_items to authenticated;

-- Sipariş: stok + bakiye kontrolü, sipariş kaydı, token düşümü, stok azaltma — tek işlemde.
-- items: [{ "product_id": "pr1", "qty": 1 }, ...]
create or replace function private.place_order(p_items jsonb, p_address jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_total    integer := 0;
  v_balance  integer;
  v_order    uuid;
  r          record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  if coalesce(trim(p_address ->> 'fullName'), '') = ''
     or coalesce(trim(p_address ->> 'phone'), '') = ''
     or coalesce(trim(p_address ->> 'city'), '') = ''
     or coalesce(trim(p_address ->> 'district'), '') = ''
     or char_length(coalesce(trim(p_address ->> 'line'), '')) < 10 then
    raise exception 'invalid_address' using errcode = 'P0001';
  end if;

  -- Aynı kullanıcının eşzamanlı siparişleriyle bakiyenin iki kez harcanmasını engelle
  perform pg_advisory_xact_lock(hashtext('order:' || v_uid::text));

  -- Bilinmeyen ürün varsa reddet (sessizce atlanmasın)
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
    where not exists (select 1 from public.products p where p.id = i.product_id)
  ) then
    raise exception 'unknown_product' using errcode = 'P0001';
  end if;

  -- Önce ürünleri sabit sırada kilitle (deadlock olmasın); sonra güncel stok/fiyatı oku
  perform 1 from public.products p
   where p.id in (select i.product_id from jsonb_to_recordset(p_items) as i(product_id text, qty integer))
   order by p.id
   for update;

  for r in
    select i.product_id, sum(i.qty)::integer as qty, p.price, p.stock, p.active
    from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
    join public.products p on p.id = i.product_id
    group by i.product_id, p.price, p.stock, p.active
    order by i.product_id
  loop
    if r.qty is null or r.qty <= 0 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;
    if not r.active or r.stock < r.qty then
      raise exception 'out_of_stock:%', r.product_id using errcode = 'P0001';
    end if;
    v_total := v_total + r.price * r.qty;
  end loop;

  if v_total = 0 then
    raise exception 'unknown_product' using errcode = 'P0001';
  end if;

  select coalesce(sum(l.amount), 0) into v_balance from public.token_ledger l where l.user_id = v_uid;
  if v_balance < v_total then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, total, address)
  values (v_uid, v_total, p_address)
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, unit_price)
  select v_order, i.product_id, sum(i.qty)::integer, p.price
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id
  group by i.product_id, p.price;

  update public.products p
     set stock = p.stock - x.qty
    from (
      select i.product_id, sum(i.qty)::integer as qty
      from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
      group by i.product_id
    ) x
   where p.id = x.product_id;

  insert into public.token_ledger (user_id, amount, reason, ref)
  values (v_uid, -v_total, 'Mağaza siparişi', 'order:' || v_order::text);

  return v_order;
end;
$$;

revoke execute on function private.place_order(jsonb, jsonb) from public, anon;
grant execute on function private.place_order(jsonb, jsonb) to authenticated;

create or replace function public.place_order(p_items jsonb, p_address jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.place_order(p_items, p_address); $$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

-- ============================================================================
-- 10) SEZON SONU: ÖDÜL DAĞITIMI (yalnızca sistem / zamanlanmış görev)
-- ============================================================================

-- İlk 3'e (en az 20 oy, kişi başına en iyi gönderisi) token ödülü yazar, sezonu kapatır
-- ve aynı arenada 7 günlük yeni sezonu açar. anon/authenticated ÇAĞIRAMAZ.
create or replace function private.settle_season(p_season_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season   public.arena_seasons%rowtype;
  v_prizes   integer[];
  v_arena    text;
  v_awarded  integer := 0;
  r          record;
begin
  select * into v_season from public.arena_seasons where id = p_season_id for update;
  if not found or v_season.status <> 'open' then
    return 0;
  end if;
  if v_season.ends_at > now() then
    raise exception 'season_not_finished' using errcode = 'P0001';
  end if;

  select a.prizes, a.name into v_prizes, v_arena from public.arenas a where a.key = v_season.arena_key;

  for r in
    select author_id, row_number() over (order by avg_score desc, vote_count desc, created_at asc) as place
    from (
      select distinct on (e.author_id)
        e.author_id,
        e.score_total::numeric / e.vote_count as avg_score,
        e.vote_count,
        e.created_at
      from public.arena_entries e
      where e.season_id = p_season_id and e.vote_count >= 20
      order by e.author_id, e.score_total::numeric / e.vote_count desc, e.vote_count desc
    ) best
    order by place
    limit 3
  loop
    insert into public.token_ledger (user_id, amount, reason, ref)
    values (
      r.author_id,
      v_prizes[r.place::integer],
      v_arena || ' Arenası — ' || r.place || '. ödülü',
      'season:' || p_season_id::text || ':rank:' || r.place
    )
    on conflict (ref) do nothing;
    v_awarded := v_awarded + 1;
  end loop;

  update public.arena_seasons set status = 'settled', settled_at = now() where id = p_season_id;

  insert into public.arena_seasons (arena_key, starts_at, ends_at)
  values (v_season.arena_key, now(), now() + interval '7 days');

  return v_awarded;
end;
$$;

-- Süresi dolan tüm sezonları kapatır (zamanlanmış görev bunu çağırır)
create or replace function private.settle_due_seasons()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  r record;
begin
  for r in select id from public.arena_seasons where status = 'open' and ends_at <= now() loop
    perform private.settle_season(r.id);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

revoke execute on function private.settle_season(uuid) from public, anon, authenticated;
revoke execute on function private.settle_due_seasons() from public, anon, authenticated;

-- Zamanlanmış görev (Database > Extensions'tan pg_cron açıldıktan sonra çalıştır):
-- select cron.schedule('vopila-settle-seasons', '*/15 * * * *', $$ select private.settle_due_seasons(); $$);

-- ============================================================================
-- 11) HABERLER VE CANLI YAYINLAR
-- ============================================================================

create table if not exists public.news_articles (
  id            text primary key,
  category      text not null check (category in ('Gündem', 'Teknoloji', 'Finans', 'Spor', 'Dünya', 'Bilim')),
  title         text not null,
  summary       text not null default '',
  body          text[] not null default '{}',
  ai_summary    text[] not null default '{}',
  image_url     text,
  video_url     text,
  read_time     text not null default '',
  is_live       boolean not null default false,
  is_special    boolean not null default false,
  published_at  timestamptz not null default now()
);
create index if not exists news_articles_published_idx on public.news_articles (published_at desc);

create table if not exists public.live_updates (
  id           bigint generated always as identity primary key,
  text         text not null,
  article_id   text references public.news_articles (id) on delete set null,
  happened_at  timestamptz not null default now()
);
create index if not exists live_updates_happened_idx on public.live_updates (happened_at desc);
create index if not exists live_updates_article_idx on public.live_updates (article_id);

alter table public.news_articles enable row level security;
alter table public.live_updates enable row level security;
drop policy if exists "news_articles: herkes okuyabilir" on public.news_articles;
create policy "news_articles: herkes okuyabilir" on public.news_articles
  for select to anon, authenticated using (true);
drop policy if exists "live_updates: herkes okuyabilir" on public.live_updates;
create policy "live_updates: herkes okuyabilir" on public.live_updates
  for select to anon, authenticated using (true);
revoke all on table public.news_articles from anon, authenticated;
revoke all on table public.live_updates from anon, authenticated;
grant select on table public.news_articles, public.live_updates to anon, authenticated;

create table if not exists public.live_streams (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 80),
  arena_key   text references public.arenas (key) on delete set null,
  -- requested: kullanıcı talep etti; live: yayında; ended: bitti (LiveKit bağlanınca yönetilecek)
  status      text not null default 'requested' check (status in ('requested', 'live', 'ended')),
  viewers     integer not null default 0 check (viewers >= 0),
  image_url   text,
  video_url   text,
  started_at  timestamptz not null default now()
);
create index if not exists live_streams_host_idx on public.live_streams (host_id);
create index if not exists live_streams_status_idx on public.live_streams (status, started_at desc);

alter table public.live_streams enable row level security;
drop policy if exists "live_streams: yayındakiler herkese, taleplerini sahibi görür" on public.live_streams;
create policy "live_streams: yayındakiler herkese, taleplerini sahibi görür" on public.live_streams
  for select to anon, authenticated
  using (status = 'live' or host_id = (select auth.uid()));
drop policy if exists "live_streams: kendi adına talep eder" on public.live_streams;
create policy "live_streams: kendi adına talep eder" on public.live_streams
  for insert to authenticated
  with check ((select auth.uid()) = host_id and status = 'requested');
drop policy if exists "live_streams: kendi başlığını düzenler" on public.live_streams;
create policy "live_streams: kendi başlığını düzenler" on public.live_streams
  for update to authenticated
  using ((select auth.uid()) = host_id)
  with check ((select auth.uid()) = host_id);
revoke all on table public.live_streams from anon, authenticated;
grant select on table public.live_streams to anon, authenticated;
grant insert (host_id, title, arena_key) on table public.live_streams to authenticated;
grant update (title, arena_key) on table public.live_streams to authenticated;

-- ============================================================================
-- 12) BİLDİRİMLER
-- ============================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('like', 'comment', 'follow', 'arena', 'token', 'order')),
  actor_id    uuid references public.profiles (id) on delete set null,
  text        text not null,
  href        text not null default '/',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_actor_idx on public.notifications (actor_id);

alter table public.notifications enable row level security;
drop policy if exists "notifications: kendi bildirimlerini görür" on public.notifications;
create policy "notifications: kendi bildirimlerini görür" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "notifications: kendi bildirimini okundu yapar" on public.notifications;
create policy "notifications: kendi bildirimini okundu yapar" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Bildirimleri sistem üretir (tetikleyiciler)
create or replace function private.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Yeni takip ya da bekleyen istek → hedefe; istek onaylanınca → istek sahibine bildirim
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select new.following_id, 'follow', new.follower_id,
           case when new.status = 'pending'
                then p.name || ' seni takip etmek istiyor.'
                else p.name || ' seni takip etmeye başladı.' end,
           case when new.status = 'pending' then '/takip-istekleri'
                else '/kullanici/' || new.follower_id::text end
    from public.profiles p where p.id = new.follower_id;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select new.follower_id, 'follow', new.following_id,
           p.name || ' takip isteğini kabul etti.', '/kullanici/' || new.following_id::text
    from public.profiles p where p.id = new.following_id;
  end if;
  return null;
end;
$$;

create or replace function private.notify_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select po.author_id, 'like', new.user_id,
         pr.name || ' gönderini beğendi.', '/gonderi/' || new.post_id::text
  from public.posts po
  join public.profiles pr on pr.id = new.user_id
  where po.id = new.post_id and po.author_id <> new.user_id;
  return null;
end;
$$;

create or replace function private.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select po.author_id, 'comment', new.author_id,
         pr.name || ' yorum yaptı: "' || left(new.text, 60) || '"', '/gonderi/' || new.post_id::text
  from public.posts po
  join public.profiles pr on pr.id = new.author_id
  where po.id = new.post_id and po.author_id <> new.author_id;
  return null;
end;
$$;

create or replace function private.notify_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount > 0 then
    insert into public.notifications (user_id, kind, text, href)
    values (new.user_id, 'token', new.amount || ' token kazandın! ' || new.reason, '/cuzdan');
  end if;
  return null;
end;
$$;

revoke execute on function private.notify_follow() from public, anon, authenticated;
revoke execute on function private.notify_like() from public, anon, authenticated;
revoke execute on function private.notify_comment() from public, anon, authenticated;
revoke execute on function private.notify_token() from public, anon, authenticated;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert or update of status on public.follows
  for each row execute function private.notify_follow();

-- Hesap gizliden açığa geçince bekleyen tüm istekler otomatik kabul edilir.
create or replace function private.accept_pending_on_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted'
    where following_id = new.id and status = 'pending';
  end if;
  return null;
end;
$$;
revoke execute on function private.accept_pending_on_public() from public, anon, authenticated;

drop trigger if exists profiles_accept_pending on public.profiles;
create trigger profiles_accept_pending after update of is_private on public.profiles
  for each row execute function private.accept_pending_on_public();
drop trigger if exists likes_notify on public.likes;
create trigger likes_notify after insert on public.likes
  for each row execute function private.notify_like();
drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function private.notify_comment();
drop trigger if exists token_ledger_notify on public.token_ledger;
create trigger token_ledger_notify after insert on public.token_ledger
  for each row execute function private.notify_token();

-- ============================================================================
-- 13) PROFİL ETKİSİ (yalnızca hesap sahibi)
-- ============================================================================

-- auth.uid() ile çalışır: herkes yalnızca KENDİ istatistiğini alabilir.
create or replace function public.my_profile_impact(p_days integer default 30)
returns table (likes_received bigint, comments_received bigint, new_followers bigint, posts_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.likes l join public.posts p on p.id = l.post_id
      where p.author_id = (select auth.uid()) and l.created_at > now() - make_interval(days => p_days)),
    (select count(*) from public.comments c join public.posts p on p.id = c.post_id
      where p.author_id = (select auth.uid()) and c.created_at > now() - make_interval(days => p_days)),
    (select count(*) from public.follows f
      where f.following_id = (select auth.uid()) and f.status = 'accepted'
        and f.created_at > now() - make_interval(days => p_days)),
    (select count(*) from public.posts p where p.author_id = (select auth.uid()));
$$;

revoke execute on function public.my_profile_impact(integer) from public, anon;
grant execute on function public.my_profile_impact(integer) to authenticated;

-- ============================================================================
-- 14) DOSYA DEPOLAMA (fotoğraf / video / profil fotoğrafı)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, 104857600, -- 100 MB (60 sn video için yeterli)
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'video/mp4', 'video/quicktime']),
  ('avatars', 'avatars', true, 5242880, -- 5 MB
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Herkes okuyabilir (kovalar public); yazma yalnızca kullanıcının kendi klasörüne: {uid}/dosya
-- Not: üzerine yazma (upsert) için INSERT + SELECT + UPDATE birlikte gerekir.
drop policy if exists "storage: kendi klasörünü görür" on storage.objects;
create policy "storage: kendi klasörünü görür" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('media', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "storage: kendi klasörüne yükler" on storage.objects;
create policy "storage: kendi klasörüne yükler" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('media', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "storage: kendi dosyasını günceller" on storage.objects;
create policy "storage: kendi dosyasını günceller" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('media', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id in ('media', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "storage: kendi dosyasını siler" on storage.objects;
create policy "storage: kendi dosyasını siler" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('media', 'avatars')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============================================================================
-- 15) BAŞLANGIÇ VERİLERİ (sahte kullanıcı YOK)
-- ============================================================================

insert into public.arenas (key, name, tagline, description, image_url, prizes, sort_order) values
  ('yemek', 'Yemek', 'Lezzet avcılarının sahnesi.', 'En iştah açıcı tabağını paylaş, topluluk puanlasın.',
   'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=75&auto=format&fit=crop', '{500,300,150}', 1),
  ('dekorasyon', 'Dekorasyon', 'Yaşam alanlarına ilham.', 'Evinin en güzel köşesini göster.',
   'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=75&auto=format&fit=crop', '{400,250,100}', 2),
  ('otomobil', 'Otomobil', 'Motor tutkunlarının buluşma noktası.', 'Aracının en iyi karesini paylaş.',
   'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&q=75&auto=format&fit=crop', '{600,350,200}', 3),
  ('kombin', 'Kombin', 'Tarzını konuştur.', 'Günün kombinini paylaş, stil puanını topla.',
   'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=75&auto=format&fit=crop', '{450,250,120}', 4),
  ('doga', 'Doğa', 'Doğayı seven, keşfeden, paylaşan bir topluluk.', 'En etkileyici doğa kareni yarıştır.',
   'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=75&auto=format&fit=crop', '{500,300,150}', 5),
  ('evcil', 'Evcil Hayvan', 'Patili dostların arenası.', 'Dostunun en tatlı anını paylaş.',
   'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800&q=75&auto=format&fit=crop', '{400,200,100}', 6),
  ('sanat', 'Sanat', 'Yaratıcılığın sınırı yok.', 'Eserini sergile, topluluk değerlendirsin.',
   'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800&q=75&auto=format&fit=crop', '{450,250,120}', 7)
on conflict (key) do nothing;

-- Her arena için 7 günlük ilk açık sezon (zaten açık sezonu olanlara dokunmaz)
insert into public.arena_seasons (arena_key, starts_at, ends_at)
select a.key, now(), now() + interval '7 days'
from public.arenas a
where not exists (select 1 from public.arena_seasons s where s.arena_key = a.key and s.status = 'open');

insert into public.badges (id, name, image_url, description, sort_order) values
  ('b1', 'Doğa Kaşifi', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400&q=75&auto=format&fit=crop', 'Doğa Arenası''nda ilk 10''a gir.', 1),
  ('b2', 'Yol Hikayeleri', 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&q=75&auto=format&fit=crop', '10 farklı şehirden paylaşım yap.', 2),
  ('b3', 'Gurme Ruh', 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=75&auto=format&fit=crop', 'Yemek Arenası''nda 100 oy topla.', 3),
  ('b4', 'Otomobil Tutkunu', 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400&q=75&auto=format&fit=crop', 'Otomobil Arenası''nda ilk 3''e gir.', 4),
  ('b5', 'Kreatif Zihin', 'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=400&q=75&auto=format&fit=crop', 'Sanat Arenası''na 5 eser gönder.', 5),
  ('b6', 'Okyanus Ruhu', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=400&q=75&auto=format&fit=crop', '5 sualtı videosu paylaş.', 6),
  ('b7', 'Patili Dost', 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&q=75&auto=format&fit=crop', 'Evcil Hayvan Arenası''na katıl.', 7)
on conflict (id) do nothing;

insert into public.products (id, name, category, price, image_url, description, stock) values
  ('pr1', '55" 4K Akıllı Televizyon', 'Elektronik', 9500, 'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800&q=75&auto=format&fit=crop', 'HDR destekli, ince çerçeveli 55 inç 4K akıllı televizyon.', 5),
  ('pr2', 'Profesyonel Makyaj Seti', 'Kozmetik', 1800, 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=800&q=75&auto=format&fit=crop', 'Far paleti, fırça seti ve bakım ürünlerinden oluşan tam set.', 20),
  ('pr3', 'Kablosuz Kulaklık', 'Elektronik', 2200, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=75&auto=format&fit=crop', 'Aktif gürültü engelleme, 30 saat pil ömrü.', 12),
  ('pr4', 'Akıllı Saat', 'Elektronik', 3400, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=75&auto=format&fit=crop', 'Nabız, uyku ve antrenman takibi.', 8),
  ('pr5', 'Parfüm Seti', 'Kozmetik', 1200, 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=75&auto=format&fit=crop', 'Üç farklı notadan oluşan özel koleksiyon.', 25),
  ('pr6', 'Kahve Makinesi', 'Ev & Yaşam', 2600, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=75&auto=format&fit=crop', 'Espresso ve süt köpürtücülü ev tipi makine.', 10),
  ('pr7', 'Spor Ayakkabı', 'Spor', 1500, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&q=75&auto=format&fit=crop', 'Hafif, nefes alan koşu ayakkabısı.', 30),
  ('pr8', 'Deri Ceket', 'Moda', 2900, 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&q=75&auto=format&fit=crop', 'Hakiki deri, klasik kesim ceket.', 6)
on conflict (id) do nothing;

insert into public.news_articles (id, category, title, summary, body, ai_summary, image_url, video_url, read_time, is_live, is_special, published_at) values
  ('n1', 'Gündem', 'Dünya, Yeni Bir Uzay Çağına Giriyor',
   'Uluslararası uzay ittifakı, Ay''da kalıcı yaşam için ilk ortak üssün 2028''de kurulacağını duyurdu.',
   array['Uluslararası uzay ittifakı bugün yaptığı açıklamada, Ay''ın güney kutbunda kurulacak ilk ortak yaşam üssünün 2028 yılında faaliyete geçeceğini duyurdu.',
         'Projeye 14 ülkenin uzay ajansı katılıyor. Üs, başlangıçta dört kişilik bir ekibin altı ay boyunca yaşayabileceği şekilde tasarlandı.',
         'Uzmanlar, bu adımın Mars yolculukları için kritik bir deneme alanı olacağını vurguluyor.'],
   array['Ay''da ilk ortak üs 2028''de açılacak.', '14 ülke projede yer alıyor.', 'Üs, Mars görevleri için test alanı olacak.'],
   'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1200&q=75&auto=format&fit=crop',
   'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
   '3 dk okuma', true, false, now() - interval '35 minutes'),
  ('n2', 'Teknoloji', 'Yeni nesil uydu ile internet her yere ulaşacak',
   'Alçak yörünge uyduları, kırsal bölgelere fiber hızında bağlantı getiriyor.',
   array['Yeni fırlatılan uydu ağı, dünyanın en ücra köşelerine bile yüksek hızlı internet sağlamayı hedefliyor.',
         'Şirket, hizmetin önümüzdeki yıl Türkiye dahil 40 ülkede kullanıma açılacağını açıkladı.'],
   array['Alçak yörünge uyduları kırsala hızlı internet getiriyor.', 'Hizmet gelecek yıl 40 ülkede başlıyor.'],
   'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&q=75&auto=format&fit=crop', null,
   '4 dk', false, false, now() - interval '1 hour'),
  ('n3', 'Finans', 'Dünya borsaları yeni haftaya yükselişle başladı',
   'Enflasyon verilerinin beklentilerin altında gelmesi piyasalara moral verdi.',
   array['Küresel piyasalar haftaya pozitif başladı. Teknoloji hisseleri yükselişe öncülük etti.',
         'Analistler, merkez bankalarının faiz kararlarının önümüzdeki haftalarda belirleyici olacağını belirtiyor.'],
   array['Borsalar haftaya yükselişle başladı.', 'Teknoloji hisseleri öne çıktı.'],
   'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=75&auto=format&fit=crop', null,
   '3 dk', false, false, now() - interval '2 hours'),
  ('n4', 'Dünya', 'İklim zirvesinde tarihi anlaşma imzalandı',
   '190 ülke, 2035 için yeni emisyon hedeflerinde uzlaştı.',
   array['Uzun süren müzakerelerin ardından iklim zirvesinde tarihi bir anlaşmaya varıldı.',
         'Anlaşma, yenilenebilir enerjiye geçişi hızlandırmak için yeni bir fon da içeriyor.'],
   array['190 ülke yeni emisyon hedefinde anlaştı.', 'Yenilenebilir enerji için fon kuruldu.'],
   'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=75&auto=format&fit=crop', null,
   '5 dk', false, false, now() - interval '3 hours'),
  ('n5', 'Spor', 'Milli takım Euro yolunda güçlü adım attı',
   'Deplasmanda alınan galibiyet, gruptaki liderliği getirdi.',
   array['Milli takım, zorlu deplasmandan üç puanla döndü ve grubunda liderliğe yükseldi.',
         'Teknik direktör, takımın oyununu "olgun" olarak nitelendirdi.'],
   array['Deplasmanda galibiyet alındı.', 'Takım grubunda lider.'],
   'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=75&auto=format&fit=crop', null,
   '2 dk', false, false, now() - interval '4 hours'),
  ('n6', 'Bilim', 'Okyanusların Gizli Zekâsı',
   'Balinaların iletişim dili, sandığımızdan çok daha gelişmiş olabilir.',
   array['Yapay zekâ destekli yeni bir araştırma, balinaların seslerinde dil benzeri yapılar tespit etti.',
         'Bilim insanları, bu bulguların hayvan iletişimine bakışımızı değiştirebileceğini söylüyor.'],
   array['Balina seslerinde dil benzeri yapılar bulundu.', 'Araştırmada yapay zekâ kullanıldı.'],
   'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1200&q=75&auto=format&fit=crop',
   'https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4',
   '4 dk okuma', false, true, now() - interval '5 hours'),
  ('n7', 'Teknoloji', 'Yapay zekâ düzenlemesi için küresel toplantı başladı',
   'Ülkeler ortak güvenlik standartlarını görüşüyor.',
   array['Cenevre''de başlayan toplantıda yapay zekâ için ortak güvenlik ilkeleri ele alınıyor.'],
   array['Yapay zekâ için ortak kurallar görüşülüyor.'],
   'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=75&auto=format&fit=crop', null,
   '3 dk', false, false, now() - interval '6 hours')
on conflict (id) do nothing;

-- Canlı gelişmeler yalnızca tablo boşsa eklenir (kimlik sütunu otomatik)
insert into public.live_updates (text, article_id, happened_at)
select v.text, v.article_id, v.happened_at
from (values
  ('Avrupa''da yeni enerji anlaşması resmen imzalandı.', 'n4', now() - interval '10 minutes'),
  ('Yapay zekâ düzenlemesi için küresel toplantı başladı.', 'n7', now() - interval '25 minutes'),
  ('Akdeniz''de 5.1 büyüklüğünde deprem meydana geldi.', null, now() - interval '44 minutes'),
  ('Yeni nesil batarya teknolojisi tanıtıldı.', 'n2', now() - interval '62 minutes'),
  ('Borsa İstanbul güne yükselişle başladı.', 'n3', now() - interval '90 minutes'),
  ('Milli takımın aday kadrosu açıklandı.', 'n5', now() - interval '117 minutes')
) as v(text, article_id, happened_at)
where not exists (select 1 from public.live_updates);
