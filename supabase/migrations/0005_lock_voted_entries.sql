-- ============================================================================
-- VOPILA — oy almış arena girişi hiçbir yoldan silinemez (sezon açıkken)
-- 0004'teki kural yalnızca doğrudan geri çekmeyi engelliyordu; gönderinin kendisi
-- silinince giriş de otomatik (cascade) siliniyordu. Bu tetikleyici her silme yolunu
-- kapsar: doğrudan silme ya da gönderiyi silme. Kullanıcı isteğiyle yapılan silmelerde
-- çalışır; sistem (sezon kapanışı, yönetici, hesap silme) etkilenmez.
-- Sezon bittikten sonra gönderi silinebilir.
-- ============================================================================

create or replace function private.protect_voted_entries()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.role()) in ('authenticated', 'anon')
     and old.vote_count > 0
     and exists (select 1 from public.arena_seasons s where s.id = old.season_id and s.status = 'open')
  then
    raise exception 'entry_has_votes' using
      errcode = 'P0001',
      hint = 'Oy almış arena gönderisi sezon bitene kadar silinemez.';
  end if;
  return old;
end;
$$;
revoke execute on function private.protect_voted_entries() from public, anon, authenticated;

drop trigger if exists protect_voted_entries on public.arena_entries;
create trigger protect_voted_entries before delete on public.arena_entries
  for each row execute function private.protect_voted_entries();
