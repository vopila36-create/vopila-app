-- ============================================================================
-- VOPILA — 0037 düzeltmesi: geri alınan fotoğraf/video/ses dosyası da 30 gün delil olarak kalır.
--  * unsend_message artık dosya yolunu dönmez (uygulama dosyayı silmez).
--  * Gönderen, arşivdeki (geri alınmış) dosyasını saklama süresi bitmeden silemez.
--  * Gece işi: 30 günü dolan arşiv kayıtlarının dosyaları ve kayıtları silinir.
-- ============================================================================
create or replace function private.dm_media_archived(p_name text)
returns boolean
language sql
stable security definer
set search_path = ''
as $$
  select exists (select 1 from private.unsent_messages u where u.media_path = p_name);
$$;
revoke execute on function private.dm_media_archived(text) from public, anon;
grant execute on function private.dm_media_archived(text) to authenticated;

drop policy if exists "dm: gönderen siler" on storage.objects;
create policy "dm: gönderen siler" on storage.objects for delete to authenticated
  using (
    bucket_id = 'dm'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and not private.dm_media_archived(name)
  );

create or replace function public.unsend_message(p_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform private.require_aal();
  perform private.unsend_message(p_id);
  return null;
end;
$$;

create or replace function private.purge_unsent_messages()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects o
   using private.unsent_messages u
   where o.bucket_id = 'dm' and o.name = u.media_path
     and u.unsent_at < now() - interval '30 days';
  delete from private.unsent_messages where unsent_at < now() - interval '30 days';
end;
$$;
revoke execute on function private.purge_unsent_messages() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'vopila-unsent-retention';
select cron.schedule('vopila-unsent-retention', '17 3 * * *', $$select private.purge_unsent_messages()$$);
