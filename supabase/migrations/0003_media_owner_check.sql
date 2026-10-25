-- ============================================================================
-- VOPILA — gizli medya: dosya sahibi kontrolü
-- Açık: bir kullanıcı kendi (herkese açık) gönderisine BAŞKASININ dosya yolunu
-- (poster_path / arena image_path) yazarak gizli hesabın dosyasına erişebilirdi.
-- Düzeltme:
--  1) Depolama kuralı, dosyayı yalnızca KLASÖR SAHİBİNİN kendi gönderisi / anı /
--     arena girişi üzerinden açar ({uid}/... klasörü = içeriğin yazarı).
--  2) Ekleme kuralları tüm yol sütunlarını yazarın kendi klasörüyle sınırlar.
-- ============================================================================

drop policy if exists "storage: görünür içeriğin dosyaları" on storage.objects;
create policy "storage: görünür içeriğin dosyaları" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'media'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.post_media pm
        join public.posts p on p.id = pm.post_id
        where (pm.storage_path = storage.objects.name or pm.poster_path = storage.objects.name)
          and p.author_id::text = (storage.foldername(storage.objects.name))[1]
      )
      or exists (
        select 1
        from public.moment_items mi
        join public.moments m on m.id = mi.moment_id
        where mi.storage_path = storage.objects.name
          and m.author_id::text = (storage.foldername(storage.objects.name))[1]
      )
      or exists (
        select 1
        from public.arena_entries ae
        where ae.image_path = storage.objects.name
          and ae.author_id::text = (storage.foldername(storage.objects.name))[1]
      )
    )
  );

-- Gönderi medyası: video kapağı (poster_path) da yazarın kendi klasöründe olmalı
drop policy if exists "post_media: kendi gönderisine ekler" on public.post_media;
create policy "post_media: kendi gönderisine ekler" on public.post_media
  for insert to authenticated
  with check (
    exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and split_part(storage_path, '/', 1) = (select auth.uid())::text
    and (poster_path is null or split_part(poster_path, '/', 1) = (select auth.uid())::text)
  );

-- Arena girişi: görsel yolu da yazarın kendi klasöründe olmalı
drop policy if exists "arena_entries: kendi gönderisiyle katılır" on public.arena_entries;
create policy "arena_entries: kendi gönderisiyle katılır" on public.arena_entries
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (image_path is null or split_part(image_path, '/', 1) = (select auth.uid())::text)
    and exists (select 1 from public.posts p where p.id = post_id and p.author_id = (select auth.uid()))
    and exists (
      select 1 from public.arena_seasons s
      where s.id = season_id and s.status = 'open' and s.ends_at > now()
    )
  );
