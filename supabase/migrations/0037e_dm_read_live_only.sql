-- ============================================================================
-- VOPILA — 0037 düzeltmesi: DM dosyası yalnız hâlâ bir mesajda kullanılıyorsa açılabilir.
-- Sahipsiz (hesabı silinmiş kişinin, yarım kalan) ve geri alınmış dosyalar gece temizliğini beklerken de okunamaz.
-- ============================================================================
create or replace function private.dm_media_live(p_name text)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.messages m where m.media_path = p_name);
$$;
revoke execute on function private.dm_media_live(text) from public, anon;
grant execute on function private.dm_media_live(text) to authenticated;

drop policy if exists "dm: üyeler okur" on storage.objects;
create policy "dm: üyeler okur" on storage.objects for select to authenticated
  using (bucket_id = 'dm' and private.dm_path_member(name) and private.dm_media_live(name));
