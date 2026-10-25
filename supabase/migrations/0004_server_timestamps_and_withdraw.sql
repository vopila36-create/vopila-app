-- ============================================================================
-- VOPILA — sunucu tarafı zaman damgaları ve arena geri çekme kuralı
-- 1) Tarihleri istemci değil sunucu belirler: kimse geçmiş/gelecek tarihli gönderi,
--    yorum, beğeni yazamaz; "An"lar her zaman 24 saat sonra biter.
-- 2) Oy almış arena girişi geri çekilemez: geri çekip aynı gönderiyle yeniden
--    katılarak düşük oyları silme (sıralama hilesi) engellenir.
-- ============================================================================

-- Ekleme sırasında zaman sütunlarını sunucu saatine sabitler (sütunu olmayan tablolarda yok sayılır)
create or replace function private.force_insert_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new := jsonb_populate_record(
    new,
    jsonb_build_object('created_at', now(), 'joined_at', now())
  );
  if tg_table_name = 'moments' then
    new.expires_at := now() + interval '24 hours';
  end if;
  return new;
end;
$$;
revoke execute on function private.force_insert_timestamps() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array[
    'posts', 'comments', 'likes', 'saves', 'moments', 'moment_items',
    'follows', 'arena_members', 'arena_entries', 'live_streams'
  ] loop
    execute format('drop trigger if exists force_insert_timestamps on public.%I', t);
    execute format(
      'create trigger force_insert_timestamps before insert on public.%I
         for each row execute function private.force_insert_timestamps()', t);
  end loop;
end $$;

-- live_streams'in zaman sütunu started_at
create or replace function private.force_started_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.started_at := now();
  return new;
end;
$$;
revoke execute on function private.force_started_at() from public, anon, authenticated;
drop trigger if exists force_started_at on public.live_streams;
create trigger force_started_at before insert on public.live_streams
  for each row execute function private.force_started_at();

-- Arena: yalnızca hiç oy almamış giriş, açık sezonda geri çekilebilir
drop policy if exists "arena_entries: açık sezonda geri çeker" on public.arena_entries;
create policy "arena_entries: açık sezonda geri çeker" on public.arena_entries
  for delete to authenticated
  using (
    (select auth.uid()) = author_id
    and vote_count = 0
    and exists (select 1 from public.arena_seasons s where s.id = season_id and s.status = 'open')
  );
