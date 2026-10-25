-- ============================================================================
-- VOPILA — gönderi/an dosyalarını gizli yap
-- Önceden 'media' kovası herkese açıktı: gizli hesabın fotoğrafları, adresi bilen
-- herkes tarafından açılabiliyordu. Artık dosyayı yalnızca o gönderiyi görebilen kişi açar.
-- Uygulama bu dosyaları kısa süreli imzalı adreslerle gösterir (createSignedUrl).
-- Profil fotoğrafları ('avatars') herkese açık kalır.
-- ============================================================================

update storage.buckets set public = false where id = 'media';

-- Politika kontrolleri dosya yoluna göre arama yaptığı için
create index if not exists post_media_storage_path_idx on public.post_media (storage_path);
create index if not exists post_media_poster_path_idx on public.post_media (poster_path);
create index if not exists moment_items_storage_path_idx on public.moment_items (storage_path);
create index if not exists arena_entries_image_path_idx on public.arena_entries (image_path);

-- Dosyayı görebilir: kendi dosyası, ya da görmeye yetkili olduğu bir gönderinin / anın /
-- arena girişinin dosyası. Alt sorgular ilgili tabloların kendi kurallarıyla (RLS) çalışır,
-- yani gizli hesabın gönderisi yalnızca takipçilerine görünür.
drop policy if exists "storage: görünür içeriğin dosyaları" on storage.objects;
create policy "storage: görünür içeriğin dosyaları" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from public.post_media pm
        where pm.storage_path = storage.objects.name or pm.poster_path = storage.objects.name
      )
      or exists (select 1 from public.moment_items mi where mi.storage_path = storage.objects.name)
      or exists (select 1 from public.arena_entries ae where ae.image_path = storage.objects.name)
    )
  );
