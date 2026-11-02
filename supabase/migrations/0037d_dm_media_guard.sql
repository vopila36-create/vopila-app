-- ============================================================================
-- VOPILA — 0037 düzeltmesi (güvenlik incelemesi):
--  * Geri alınmış (arşivdeki) dosyayı sohbet üyeleri artık açamaz; yalnız sunucu arşivi tutar.
--  * Gönderen, hâlâ bir mesajda duran ya da arşivdeki dosyayı silemez (delil korunur).
--  * Sahipsiz DM dosyaları (hesap silinince mesajlarıyla bağı kalmayanlar, yarım kalan yüklemeler)
--    ve süresi dolan arşiv dosyaları gece işiyle temizlenir.
-- Not: Temizlik SQL ile yapılır; dosya kaydı silinir, dosya hiçbir yoldan erişilemez hale gelir.
-- ============================================================================
create or replace function private.dm_media_in_use(p_name text)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages m where m.media_path = p_name)
      or exists (select 1 from private.unsent_messages u where u.media_path = p_name);
$$;
revoke execute on function private.dm_media_in_use(text) from public, anon;
grant execute on function private.dm_media_in_use(text) to authenticated;

drop policy if exists "dm: gönderen siler" on storage.objects;
create policy "dm: gönderen siler" on storage.objects for delete to authenticated
  using (
    bucket_id = 'dm'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and not private.dm_media_in_use(name)
  );

drop policy if exists "dm: üyeler okur" on storage.objects;
create policy "dm: üyeler okur" on storage.objects for select to authenticated
  using (bucket_id = 'dm' and private.dm_path_member(name) and not private.dm_media_archived(name));

create or replace function private.purge_unsent_messages()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  -- Süresi dolan arşiv dosyaları (artık hiçbir mesajda kullanılmıyorsa)
  delete from storage.objects o
   using private.unsent_messages u
   where o.bucket_id = 'dm' and o.name = u.media_path
     and u.unsent_at < now() - interval '30 days'
     and not exists (select 1 from public.messages m where m.media_path = o.name);
  delete from private.unsent_messages where unsent_at < now() - interval '30 days';
  -- Sahipsiz dosyalar: hiçbir mesaja ya da arşive bağlı değil ve en az 1 günlük
  delete from storage.objects o
   where o.bucket_id = 'dm'
     and o.created_at < now() - interval '1 day'
     and not exists (select 1 from public.messages m where m.media_path = o.name)
     and not exists (select 1 from private.unsent_messages u where u.media_path = o.name);
end;
$$;
revoke execute on function private.purge_unsent_messages() from public, anon, authenticated;
