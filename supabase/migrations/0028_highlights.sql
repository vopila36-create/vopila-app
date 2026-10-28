-- ============================================================================
-- VOPILA — Öne Çıkanlar (profilde kalıcı an albümleri) ve an arşivi
--  * Sahibi süresi dolmuş anlarını görebilir (arşiv); başkaları göremez.
--  * highlights: albüm (en çok 20 karakter başlık); highlight_items: anın ögelerinin kopyası
--    (an silinse de albüm kalır). Albümü profili görebilen herkes görür (can_view_user).
--  * Yakın Arkadaşlar anları albüme eklenemez (gizlilikleri bozulmasın).
--  * Albüm dosyaları: sahibinin klasöründeki ve albümde olan dosyalar, albümü görebilenlere açık.
-- ============================================================================

-- An arşivi: sahibi kendi süresi dolmuş anlarını görür
drop policy if exists "moments: sahibi arşivini görür" on public.moments;
create policy "moments: sahibi arşivini görür" on public.moments for select to authenticated
  using (author_id = (select auth.uid()));

create table if not exists public.highlights (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 20),
  created_at  timestamptz not null default now()
);
create index if not exists highlights_owner_idx on public.highlights (owner_id, created_at);

create table if not exists public.highlight_items (
  id            uuid primary key default gen_random_uuid(),
  highlight_id  uuid not null references public.highlights (id) on delete cascade,
  type          text not null check (type in ('image', 'video')),
  storage_path  text not null,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists highlight_items_hl_idx on public.highlight_items (highlight_id, position);
create index if not exists highlight_items_path_idx on public.highlight_items (storage_path);

alter table public.highlights enable row level security;
alter table public.highlight_items enable row level security;

drop policy if exists "aal2 gerekli" on public.highlights;
create policy "aal2 gerekli" on public.highlights as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "aal2 gerekli" on public.highlight_items;
create policy "aal2 gerekli" on public.highlight_items as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());

drop policy if exists "highlights: profili görebilen görür" on public.highlights;
create policy "highlights: profili görebilen görür" on public.highlights for select to anon, authenticated
  using (private.can_view_user(owner_id));
drop policy if exists "highlights: sahibi oluşturur" on public.highlights;
create policy "highlights: sahibi oluşturur" on public.highlights for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_active_user(owner_id));
drop policy if exists "highlights: sahibi düzenler" on public.highlights;
create policy "highlights: sahibi düzenler" on public.highlights for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "highlights: sahibi siler" on public.highlights;
create policy "highlights: sahibi siler" on public.highlights for delete to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "highlight_items: albümü görebilen görür" on public.highlight_items;
create policy "highlight_items: albümü görebilen görür" on public.highlight_items for select to anon, authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_items.highlight_id));
drop policy if exists "highlight_items: sahibi siler" on public.highlight_items;
create policy "highlight_items: sahibi siler" on public.highlight_items for delete to authenticated
  using (exists (select 1 from public.highlights h where h.id = highlight_items.highlight_id and h.owner_id = (select auth.uid())));
-- Ekleme yalnızca add_moment_to_highlight ile

grant select, insert, delete on public.highlights to authenticated;
grant update (title) on public.highlights to authenticated;
grant select on public.highlights, public.highlight_items to anon;
grant select, delete on public.highlight_items to authenticated;

-- Anı albüme ekle: ögeler kopyalanır (an silinse de kalır); yalnızca kendi, yakın arkadaşa özel olmayan anı
create or replace function private.add_moment_to_highlight(p_highlight uuid, p_moment uuid)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_next integer;
  n integer;
begin
  if not exists (select 1 from public.highlights h where h.id = p_highlight and h.owner_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.moments m where m.id = p_moment and m.author_id = v_uid) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from public.moments m where m.id = p_moment and m.close_friends) then
    raise exception 'close_friends_moment' using errcode = 'P0001';
  end if;
  select coalesce(max(position) + 1, 0) into v_next from public.highlight_items where highlight_id = p_highlight;
  insert into public.highlight_items (highlight_id, type, storage_path, position)
  select p_highlight, mi.type, mi.storage_path, v_next + mi.position
  from public.moment_items mi
  where mi.moment_id = p_moment
    and mi.storage_path like v_uid::text || '/%'
    and not exists (select 1 from public.highlight_items x where x.highlight_id = p_highlight and x.storage_path = mi.storage_path);
  get diagnostics n = row_count;
  if (select count(*) from public.highlight_items where highlight_id = p_highlight) > 100 then
    raise exception 'highlight_full' using errcode = 'P0001';
  end if;
  return n;
end;
$$;
grant execute on function private.add_moment_to_highlight(uuid, uuid) to authenticated;
revoke execute on function private.add_moment_to_highlight(uuid, uuid) from public, anon;

create or replace function public.add_moment_to_highlight(p_highlight uuid, p_moment uuid)
returns integer language plpgsql set search_path = ''
as $$ begin perform private.require_aal(); return private.add_moment_to_highlight(p_highlight, p_moment); end; $$;
revoke execute on function public.add_moment_to_highlight(uuid, uuid) from public, anon;
grant execute on function public.add_moment_to_highlight(uuid, uuid) to authenticated;

-- Albüm dosyaları: albümü görebilenler (sahibinin klasöründeki dosya + albümde kayıtlı)
drop policy if exists "storage: öne çıkan dosyaları" on storage.objects;
create policy "storage: öne çıkan dosyaları" on storage.objects for select to anon, authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1 from public.highlight_items hi
      join public.highlights h on h.id = hi.highlight_id
      where hi.storage_path = objects.name and h.owner_id::text = (storage.foldername(objects.name))[1]
    )
  );
