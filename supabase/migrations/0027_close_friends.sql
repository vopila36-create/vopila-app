-- ============================================================================
-- VOPILA — Yakın Arkadaşlar (Instagram gibi)
--  * close_friends: listeyi yalnızca sahibi görür ve yönetir; listeye eklenen kişiye bildirim gitmez.
--  * moments.close_friends: true ise an yalnızca sahibine ve yakın arkadaş listesindekilere görünür
--    (an ögeleri ve dosyaları da: onlar da anın görünürlüğüne bağlı).
-- ============================================================================

create table if not exists public.close_friends (
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, friend_id),
  check (owner_id <> friend_id)
);
create index if not exists close_friends_friend_idx on public.close_friends (friend_id);
alter table public.close_friends enable row level security;

drop policy if exists "aal2 gerekli" on public.close_friends;
create policy "aal2 gerekli" on public.close_friends as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "close_friends: sahibi görür" on public.close_friends;
create policy "close_friends: sahibi görür" on public.close_friends for select to authenticated
  using (owner_id = (select auth.uid()));
drop policy if exists "close_friends: sahibi ekler" on public.close_friends;
create policy "close_friends: sahibi ekler" on public.close_friends for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_active_user(owner_id));
drop policy if exists "close_friends: sahibi çıkarır" on public.close_friends;
create policy "close_friends: sahibi çıkarır" on public.close_friends for delete to authenticated
  using (owner_id = (select auth.uid()));
grant select, insert, delete on public.close_friends to authenticated;

create or replace function private.is_close_friend(p_owner uuid, p_viewer uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.close_friends c where c.owner_id = p_owner and c.friend_id = p_viewer);
$$;
grant execute on function private.is_close_friend(uuid, uuid) to anon, authenticated;

alter table public.moments add column if not exists close_friends boolean not null default false;
grant insert (close_friends) on public.moments to authenticated;

drop policy if exists "moments: yakın arkadaş anları" on public.moments;
create policy "moments: yakın arkadaş anları" on public.moments as restrictive for select to anon, authenticated
  using (
    not close_friends
    or author_id = (select auth.uid())
    or private.is_close_friend(author_id, (select auth.uid()))
  );
