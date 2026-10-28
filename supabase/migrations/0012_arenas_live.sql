-- ============================================================================
-- VOPILA — Arenalar canlı (Aşama 4)
--  1) Sezonlar otomatik kapanır: her 15 dakikada süresi dolan sezonlar ödüllendirilir,
--     yeni 7 günlük sezon açılır (pg_cron → private.settle_due_seasons)
--  2) Seviye puanı (level_xp) ve keşif puanı (discovery_points) sunucuda işlenir
--  3) Arena özeti: üye sayısı, açık sezon ve bitiş zamanı, gönderi sayısı
-- ============================================================================

-- ─── 1) Otomatik sezon kapanışı ─────────────────────────────────────────────

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'vopila-settle-seasons') then
    perform cron.unschedule('vopila-settle-seasons');
  end if;
  perform cron.schedule('vopila-settle-seasons', '*/15 * * * *', 'select private.settle_due_seasons();');
end $$;

-- ─── 2) Seviye ve keşif puanı ───────────────────────────────────────────────
-- Kurallar (kullanıcı değiştiremez; profiles'ta bu sütunlara yazma izni yok):
--   arenaya gönderi: +10 seviye · aldığın her oy: +puan (1–5) seviye · oy vermek: +1 seviye
--   arena ödülü: +ödül/5 seviye · gönderi paylaşmak: +5 keşif · aldığın beğeni: +1 keşif (geri alınırsa −1)

create or replace function private.add_points(p_user uuid, p_xp integer, p_discovery integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profiles
     set level_xp = greatest(0, level_xp + p_xp),
         discovery_points = greatest(0, discovery_points + p_discovery)
   where id = p_user;
$$;
revoke execute on function private.add_points(uuid, integer, integer) from public, anon, authenticated;

create or replace function private.points_on_entry()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.add_points(new.author_id, 10, 0); return null; end; $$;

create or replace function private.points_on_vote()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform private.add_points(e.author_id, new.score, 0) from public.arena_entries e where e.id = new.entry_id;
  perform private.add_points(new.voter_id, 1, 0);
  return null;
end;
$$;

create or replace function private.points_on_prize()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.amount > 0 and new.ref like 'season:%' then
    perform private.add_points(new.user_id, new.amount / 5, 0);
  end if;
  return null;
end;
$$;

create or replace function private.points_on_post()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.add_points(new.author_id, 0, 5); return null; end; $$;

create or replace function private.points_on_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.add_points(p.author_id, 0, 1) from public.posts p where p.id = new.post_id and p.author_id <> new.user_id;
    return null;
  end if;
  perform private.add_points(p.author_id, 0, -1) from public.posts p where p.id = old.post_id and p.author_id <> old.user_id;
  return null;
end;
$$;

revoke execute on function private.points_on_entry() from public, anon, authenticated;
revoke execute on function private.points_on_vote() from public, anon, authenticated;
revoke execute on function private.points_on_prize() from public, anon, authenticated;
revoke execute on function private.points_on_post() from public, anon, authenticated;
revoke execute on function private.points_on_like() from public, anon, authenticated;

drop trigger if exists arena_entries_points on public.arena_entries;
create trigger arena_entries_points after insert on public.arena_entries
  for each row execute function private.points_on_entry();
drop trigger if exists arena_votes_points on public.arena_votes;
create trigger arena_votes_points after insert on public.arena_votes
  for each row execute function private.points_on_vote();
drop trigger if exists token_ledger_points on public.token_ledger;
create trigger token_ledger_points after insert on public.token_ledger
  for each row execute function private.points_on_prize();
drop trigger if exists posts_points on public.posts;
create trigger posts_points after insert on public.posts
  for each row execute function private.points_on_post();
drop trigger if exists likes_points on public.likes;
create trigger likes_points after insert or delete on public.likes
  for each row execute function private.points_on_like();

-- ─── 3) Arena özeti ─────────────────────────────────────────────────────────

create or replace view public.arena_stats
with (security_invoker = true)
as
select
  a.key,
  (select count(*)::integer from public.arena_members m where m.arena_key = a.key) as members,
  s.id as season_id,
  s.ends_at,
  (select count(*)::integer from public.arena_entries e where e.season_id = s.id) as entries
from public.arenas a
left join public.arena_seasons s on s.arena_key = a.key and s.status = 'open';

revoke all on table public.arena_stats from anon, authenticated;
grant select on table public.arena_stats to anon, authenticated;
