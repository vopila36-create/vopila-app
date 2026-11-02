-- ============================================================================
-- VOPILA — Anlar'da beğeni (önceden yalnızca telefonda tutuluyordu).
--  * Kişi yalnızca görebildiği bir anı beğenebilir (moments RLS'i geçerli).
--  * Beğeniyi beğenen kişi ve anın sahibi görür; sahibi kaç kişinin beğendiğini bilir.
-- ============================================================================

create table if not exists public.moment_likes (
  moment_id  uuid not null references public.moments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);
create index if not exists moment_likes_user_idx on public.moment_likes (user_id);

alter table public.moment_likes enable row level security;
revoke all on table public.moment_likes from anon, authenticated;
grant select, insert, delete on table public.moment_likes to authenticated;

drop policy if exists "aal2 gerekli" on public.moment_likes;
create policy "aal2 gerekli" on public.moment_likes as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());

drop policy if exists "moment_likes: kendi ve sahibi görür" on public.moment_likes;
create policy "moment_likes: kendi ve sahibi görür" on public.moment_likes for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.moments m where m.id = moment_id and m.author_id = (select auth.uid()))
  );

drop policy if exists "moment_likes: görebildiği anı beğenir" on public.moment_likes;
create policy "moment_likes: görebildiği anı beğenir" on public.moment_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.moments m where m.id = moment_id)
  );

drop policy if exists "moment_likes: kendi beğenisini kaldırır" on public.moment_likes;
create policy "moment_likes: kendi beğenisini kaldırır" on public.moment_likes for delete to authenticated
  using (user_id = (select auth.uid()));
