-- ============================================================================
-- VOPILA — Aylık arena sezonları ve kazananlar listesi
--  * Her sezon Türkiye saatiyle ayın 1'i 00:00'da başlar, ayın son günü gece 12'de (ertesi ayın
--    1'i 00:00) biter. Zamanlayıcı 15 dakikada bir kontrol eder → bitişten en geç 15 dk sonra kapanır.
--  * Kapanışta ilk 3 ve kazandıkları ödül herkese açık "season_winners" listesine yazılır,
--    arena üyelerine "kazananlar belli oldu" bildirimi gider, yeni ayın sezonu açılır.
--  * Şüpheli kazanan (hile kontrolü) listede "inceleniyor" görünür; yönetici kararıyla güncellenir.
-- ============================================================================

-- Ay sonu (Türkiye saati): verilen anın içinde bulunduğu ayın bittiği an
create or replace function private.month_end(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('month', p_at at time zone 'Europe/Istanbul') + interval '1 month') at time zone 'Europe/Istanbul';
$$;

create or replace function private.month_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', p_at at time zone 'Europe/Istanbul') at time zone 'Europe/Istanbul';
$$;
revoke execute on function private.month_end(timestamptz) from public, anon, authenticated;
revoke execute on function private.month_start(timestamptz) from public, anon, authenticated;

-- ─── Kazananlar listesi (herkese açık) ──────────────────────────────────────

create table if not exists public.season_winners (
  season_id   uuid not null references public.arena_seasons (id) on delete cascade,
  arena_key   text not null references public.arenas (key) on delete cascade,
  place       smallint not null check (place between 1 and 3),
  user_id     uuid references public.profiles (id) on delete set null,
  entry_id    uuid references public.arena_entries (id) on delete set null,
  prize       integer not null check (prize > 0),
  -- awarded: token verildi · review: güvenlik incelemesinde · rejected: kurallara aykırı, verilmedi
  status      text not null default 'awarded' check (status in ('awarded', 'review', 'rejected')),
  period      text not null,   -- ör. "Ekim 2026"
  created_at  timestamptz not null default now(),
  primary key (season_id, place)
);
create index if not exists season_winners_arena_idx on public.season_winners (arena_key, created_at desc);
create index if not exists season_winners_user_idx on public.season_winners (user_id);

alter table public.season_winners enable row level security;
drop policy if exists "season_winners: herkes okuyabilir" on public.season_winners;
create policy "season_winners: herkes okuyabilir" on public.season_winners
  for select to anon, authenticated using (status <> 'rejected');
-- İki adımlı doğrulama kuralı her tabloda (0011_security_fixes)
drop policy if exists "aal2 gerekli" on public.season_winners;
create policy "aal2 gerekli" on public.season_winners as restrictive for all to authenticated
  using (private.aal_ok()) with check (private.aal_ok());
revoke all on table public.season_winners from anon, authenticated;
grant select on table public.season_winners to anon, authenticated;

-- "Ekim 2026" gibi dönem adı
create or replace function private.period_name(p_at timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select (array['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'])
           [extract(month from (p_at at time zone 'Europe/Istanbul'))::int]
         || ' ' || extract(year from (p_at at time zone 'Europe/Istanbul'))::int;
$$;
revoke execute on function private.period_name(timestamptz) from public, anon, authenticated;

-- ─── Sezon kapanışı (aylık) ─────────────────────────────────────────────────

create or replace function private.settle_season(p_season_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season   public.arena_seasons%rowtype;
  v_prizes   integer[];
  v_arena    text;
  v_period   text;
  v_awarded  integer := 0;
  v_flags    jsonb;
  v_reason   text;
  v_ref      text;
  v_names    text := '';
  r          record;
begin
  select * into v_season from public.arena_seasons where id = p_season_id for update;
  if not found or v_season.status <> 'open' then
    return 0;
  end if;
  if v_season.ends_at > now() then
    raise exception 'season_not_finished' using errcode = 'P0001';
  end if;

  select a.prizes, a.name into v_prizes, v_arena from public.arenas a where a.key = v_season.arena_key;
  -- Sezonun ait olduğu ay (bitişten bir an öncesi)
  v_period := private.period_name(v_season.ends_at - interval '1 second');

  for r in
    select author_id, entry_id,
           row_number() over (order by avg_score desc, vote_count desc, created_at asc) as place
    from (
      select distinct on (e.author_id)
        e.author_id,
        e.id as entry_id,
        e.score_total::numeric / e.vote_count as avg_score,
        e.vote_count,
        e.created_at
      from public.arena_entries e
      join public.profiles pr on pr.id = e.author_id
      where e.season_id = p_season_id and e.vote_count >= 20 and pr.status = 'active'
      order by e.author_id, e.score_total::numeric / e.vote_count desc, e.vote_count desc
    ) best
    order by place
    limit 3
  loop
    v_reason := v_arena || ' Arenası ' || v_period || ' — ' || r.place || '. ödülü';
    v_ref := 'season:' || p_season_id::text || ':rank:' || r.place;
    v_flags := private.detect_vote_fraud(r.entry_id);

    if jsonb_array_length(v_flags) = 0 then
      insert into public.token_ledger (user_id, amount, reason, ref)
      values (r.author_id, v_prizes[r.place::integer], v_reason, v_ref)
      on conflict (ref) do nothing;
    else
      insert into public.pending_rewards (user_id, season_id, entry_id, place, amount, reason, ref, flags)
      values (r.author_id, p_season_id, r.entry_id, r.place, v_prizes[r.place::integer], v_reason, v_ref, v_flags)
      on conflict (ref) do nothing;

      insert into private.fraud_flags (user_id, season_id, entry_id, kind, details)
      select r.author_id, p_season_id, r.entry_id, f ->> 'kind', f
      from jsonb_array_elements(v_flags) f;

      insert into public.notifications (user_id, kind, text, href)
      values (r.author_id, 'arena',
              'Tebrikler! ' || v_arena || ' Arenası ' || v_period || ' sezonunda ' || r.place
              || '. oldun. ' || v_prizes[r.place::integer] || ' token ödülün kısa bir güvenlik incelemesinden sonra hesabına geçecek.',
              '/cuzdan');
    end if;

    insert into public.season_winners (season_id, arena_key, place, user_id, entry_id, prize, status, period)
    values (p_season_id, v_season.arena_key, r.place, r.author_id, r.entry_id, v_prizes[r.place::integer],
            case when jsonb_array_length(v_flags) = 0 then 'awarded' else 'review' end, v_period)
    on conflict (season_id, place) do nothing;

    v_names := v_names || case when v_awarded > 0 then ', ' else '' end || r.place || '. '
               || coalesce((select p.name from public.profiles p where p.id = r.author_id), '?');
    v_awarded := v_awarded + 1;
  end loop;

  update public.arena_seasons set status = 'settled', settled_at = now() where id = p_season_id;

  -- Arena üyelerine sonuç bildirimi (kazananlar zaten kendi bildirimini aldı)
  insert into public.notifications (user_id, kind, text, href)
  select m.user_id, 'arena',
         case when v_awarded > 0
              then v_arena || ' Arenası ' || v_period || ' kazananları belli oldu: ' || v_names || '. Yeni ay başladı!'
              else v_arena || ' Arenası ' || v_period || ' sezonu bitti (yeterli oy alan olmadı). Yeni ay başladı!' end,
         '/arena/' || v_season.arena_key
  from public.arena_members m
  where m.arena_key = v_season.arena_key
    and not exists (select 1 from public.season_winners w where w.season_id = p_season_id and w.user_id = m.user_id);

  -- Yeni ayın sezonu: bu ayın 1'i 00:00 → ay sonu gece 12
  insert into public.arena_seasons (arena_key, starts_at, ends_at)
  values (v_season.arena_key, private.month_start(now()), private.month_end(now()));

  return v_awarded;
end;
$$;
revoke execute on function private.settle_season(uuid) from public, anon, authenticated;

-- Yönetici incelemesi sonucu kazananlar listesine yansısın
create or replace function private.sync_winner_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    update public.season_winners
       set status = case new.status when 'approved' then 'awarded' when 'rejected' then 'rejected' else 'review' end
     where season_id = new.season_id and place = new.place;
  end if;
  return null;
end;
$$;
revoke execute on function private.sync_winner_status() from public, anon, authenticated;
drop trigger if exists pending_rewards_sync_winner on public.pending_rewards;
create trigger pending_rewards_sync_winner after update of status on public.pending_rewards
  for each row execute function private.sync_winner_status();

-- ─── Şu anki sezonlar: bu ayın sonunda (Türkiye saatiyle gece 12) bitsin ────

update public.arena_seasons
   set starts_at = private.month_start(now()),
       ends_at = private.month_end(now())
 where status = 'open';
