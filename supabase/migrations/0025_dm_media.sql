-- ============================================================================
-- VOPILA — Mesajlarda fotoğraf, video ve sesli mesaj
--  * messages.kind: text | post | image | video | audio; medya mesajında media_path zorunlu ve
--    yol sohbetin ve gönderenin klasöründe olmalı: <sohbet>/<gönderen>/<dosya>.
--  * Gizli 'dm' deposu: yalnızca sohbetin üyeleri okur; yalnızca üye kendi klasörüne yükler.
--    Ses en çok 2 dk (120 000 ms), dosya en çok 50 MB.
-- ============================================================================

alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists duration_ms integer;

alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'post', 'image', 'video', 'audio'));

alter table public.messages drop constraint if exists messages_check;
alter table public.messages add constraint messages_check
  check (kind in ('post', 'image', 'video', 'audio') or char_length(btrim(text)) > 0);

alter table public.messages drop constraint if exists messages_media_check;
alter table public.messages add constraint messages_media_check check (
  (kind in ('image', 'video', 'audio')) = (media_path is not null)
  and (media_path is null or media_path like conversation_id::text || '/' || sender_id::text || '/%')
  and (duration_ms is null or (kind = 'audio' and duration_ms between 0 and 120000))
);

grant insert (media_path, duration_ms), select (media_path, duration_ms) on public.messages to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm', 'dm', false, 52428800, array[
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
  'audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/aac', 'audio/mpeg', 'audio/webm', 'audio/ogg', 'audio/wav'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Yol: <sohbet>/<gönderen>/<dosya>
create or replace function private.dm_path_member(p_name text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case when (storage.foldername(p_name))[1] ~ '^[0-9a-f-]{36}$'
    then private.is_member(((storage.foldername(p_name))[1])::uuid) else false end;
$$;
grant execute on function private.dm_path_member(text) to authenticated;

drop policy if exists "dm: üyeler okur" on storage.objects;
create policy "dm: üyeler okur" on storage.objects for select to authenticated
  using (bucket_id = 'dm' and private.dm_path_member(name));

drop policy if exists "dm: üye kendi klasörüne yükler" on storage.objects;
create policy "dm: üye kendi klasörüne yükler" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dm'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and private.dm_path_member(name)
  );

drop policy if exists "dm: gönderen siler" on storage.objects;
create policy "dm: gönderen siler" on storage.objects for delete to authenticated
  using (bucket_id = 'dm' and (storage.foldername(name))[2] = (select auth.uid())::text);
