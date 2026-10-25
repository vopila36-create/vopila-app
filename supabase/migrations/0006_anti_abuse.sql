-- ============================================================================
-- VOPILA — Güvenlik Paketi 1: hile, spam ve kötüye kullanıma karşı
--  1) Hesap durumu (active / suspended / banned) — askıdaki hesap yazamaz, banlı hesabın içeriği gizlenir
--  2) Yönetici rolü + denetim kaydı (rol asla user_metadata'dan gelmez)
--  3) Hız sınırları (bot / spam)
--  4) Engelle + Şikayet (çok şikayet alan içerik otomatik gizlenir)
--  5) Ödül hilesi tespiti: şüpheli kazananın ödülü bekletilir, yönetici onaylar
-- Tüm kurallar sunucuda; uygulama tarafı atlatamaz.
-- ============================================================================

-- ─── 1) HESAP DURUMU ────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended', 'banned'));
-- status sütunu kullanıcıya açık değildir (profiles UPDATE izni sütun bazlı ve status yok)

create or replace function private.is_active_user(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.status = 'active' from public.profiles p where p.id = p_user), false);
$$;
revoke execute on function private.is_active_user(uuid) from public;
grant execute on function private.is_active_user(uuid) to anon, authenticated;

-- ─── 2) YÖNETİCİ ROLÜ + DENETİM KAYDI ───────────────────────────────────────

create table if not exists private.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.admins a where a.user_id = (select auth.uid()));
$$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- Uygulama "yönetici miyim?" diye sorabilsin (admin ekranlarını göstermek için)
create or replace function public.am_i_admin()
returns boolean
language sql stable security invoker set search_path = ''
as $$ select private.is_admin(); $$;
grant execute on function public.am_i_admin() to authenticated;

create table if not exists private.audit_log (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  action       text not null,
  target_type  text,
  target_id    text,
  details      jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists audit_log_created_idx on private.audit_log (created_at desc);

-- ─── 3) HIZ SINIRLARI ──────────────────────────────────────────────────────

create table if not exists private.rate_limits (
  table_name   text primary key,
  max_count    integer not null check (max_count > 0),
  per_seconds  integer not null check (per_seconds > 0)
);

insert into private.rate_limits (table_name, max_count, per_seconds) values
  ('posts',          20, 3600),  -- saatte 20 gönderi
  ('comments',       10,   60),  -- dakikada 10 yorum
  ('likes',          60,   60),  -- dakikada 60 beğeni
  ('saves',          60,   60),
  ('follows',        30,   60),  -- dakikada 30 takip
  ('moments',        30, 3600),
  ('arena_members',  30,   60),
  ('arena_entries',  10, 3600),
  ('arena_votes',   100, 3600),  -- saatte 100 oy
  ('live_streams',    5, 3600),
  ('orders',          5, 3600),
  ('reports',        20, 3600)
on conflict (table_name) do nothing;

-- ─── 4a) ENGELLEME ──────────────────────────────────────────────────────────

create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;
drop policy if exists "blocks: kendi engellediklerini görür" on public.blocks;
create policy "blocks: kendi engellediklerini görür" on public.blocks
  for select to authenticated using ((select auth.uid()) = blocker_id);
drop policy if exists "blocks: kendi adına engeller" on public.blocks;
create policy "blocks: kendi adına engeller" on public.blocks
  for insert to authenticated with check ((select auth.uid()) = blocker_id);
drop policy if exists "blocks: engeli kaldırır" on public.blocks;
create policy "blocks: engeli kaldırır" on public.blocks
  for delete to authenticated using ((select auth.uid()) = blocker_id);
revoke all on table public.blocks from anon, authenticated;
grant select, delete on table public.blocks to authenticated;
grant insert (blocker_id, blocked_id) on table public.blocks to authenticated;

-- İki kişi arasında (herhangi bir yönde) engel var mı?
create or replace function private.blocked_pair(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks bl
    where (bl.blocker_id = a and bl.blocked_id = b) or (bl.blocker_id = b and bl.blocked_id = a)
  );
$$;
revoke execute on function private.blocked_pair(uuid, uuid) from public;
grant execute on function private.blocked_pair(uuid, uuid) to anon, authenticated;

-- Bu kişi beni engellemiş mi? (profilini göremem)
create or replace function private.is_blocked_by(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks bl where bl.blocker_id = target and bl.blocked_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_blocked_by(uuid) from public;
grant execute on function private.is_blocked_by(uuid) to anon, authenticated;

-- Engellenince iki yöndeki takip de silinir
create or replace function private.on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows f
   where (f.follower_id = new.blocker_id and f.following_id = new.blocked_id)
      or (f.follower_id = new.blocked_id and f.following_id = new.blocker_id);
  return null;
end;
$$;
revoke execute on function private.on_block() from public, anon, authenticated;
drop trigger if exists blocks_cleanup on public.blocks;
create trigger blocks_cleanup after insert on public.blocks
  for each row execute function private.on_block();

-- Görünürlük: engel varsa ya da hesap banlıysa içerik görünmez
create or replace function private.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.blocked_pair(target, (select auth.uid()))
    and (
      target = (select auth.uid())
      or (
        coalesce((select p.status from public.profiles p where p.id = target), 'active') <> 'banned'
        and (
          not coalesce((select p.is_private from public.profiles p where p.id = target), false)
          or exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.following_id = target
              and f.status = 'accepted'
          )
        )
      )
    );
$$;

-- Beni engelleyen kişinin profili bana görünmez
drop policy if exists "profiles: herkes okuyabilir" on public.profiles;
create policy "profiles: herkes okuyabilir" on public.profiles
  for select to anon, authenticated
  using (not private.is_blocked_by(id));

-- ─── 4b) ŞİKAYET ────────────────────────────────────────────────────────────

alter table public.posts add column if not exists is_hidden boolean not null default false;
alter table public.comments add column if not exists is_hidden boolean not null default false;
-- is_hidden kullanıcıya açık değil (posts UPDATE izni yalnızca caption, location)

create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles (id) on delete cascade,
  target_type  text not null check (target_type in ('post', 'comment', 'user', 'moment', 'live')),
  target_id    uuid not null,
  reason       text not null check (reason in (
                 'spam', 'nefret', 'taciz', 'ciplaklik', 'siddet', 'sahte_hesap',
                 'telif', 'hile', 'cocuk_guvenligi', 'diger')),
  details      text not null default '' check (char_length(details) <= 500),
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at   timestamptz not null default now(),
  resolved_by  uuid references auth.users (id) on delete set null,
  resolved_at  timestamptz,
  unique (reporter_id, target_type, target_id)
);
create index if not exists reports_target_idx on public.reports (target_type, target_id, status);
create index if not exists reports_status_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;
drop policy if exists "reports: kendi şikayetlerini ya da yönetici hepsini görür" on public.reports;
create policy "reports: kendi şikayetlerini ya da yönetici hepsini görür" on public.reports
  for select to authenticated
  using ((select auth.uid()) = reporter_id or private.is_admin());
drop policy if exists "reports: kendi adına şikayet eder" on public.reports;
create policy "reports: kendi adına şikayet eder" on public.reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);
revoke all on table public.reports from anon, authenticated;
grant select on table public.reports to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on table public.reports to authenticated;

-- 5 farklı kişi aynı gönderiyi/yorumu şikayet ederse yönetici bakana kadar otomatik gizlenir
create or replace function private.auto_hide_reported()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare n integer;
begin
  select count(*) into n from public.reports r
   where r.target_type = new.target_type and r.target_id = new.target_id and r.status = 'open';
  if n >= 5 then
    if new.target_type = 'post' then
      update public.posts set is_hidden = true where id = new.target_id;
    elsif new.target_type = 'comment' then
      update public.comments set is_hidden = true where id = new.target_id;
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function private.auto_hide_reported() from public, anon, authenticated;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function private.auto_hide_reported();

-- Gizlenen içerik yalnızca sahibine ve yöneticiye görünür
drop policy if exists "posts: görünür hesapların gönderileri" on public.posts;
create policy "posts: görünür hesapların gönderileri" on public.posts
  for select to anon, authenticated
  using (
    private.can_view_user(author_id)
    and (not is_hidden or author_id = (select auth.uid()) or private.is_admin())
  );

drop policy if exists "comments: görünür gönderilerin yorumları" on public.comments;
create policy "comments: görünür gönderilerin yorumları" on public.comments
  for select to anon, authenticated
  using (
    exists (select 1 from public.posts p where p.id = post_id)
    and not private.blocked_pair(author_id, (select auth.uid()))
    and (not is_hidden or author_id = (select auth.uid()) or private.is_admin())
  );

-- ─── 1+3+4) YAZMA KORUMASI: askı, hız sınırı, engel ──────────────────────────
-- Tetikleyici argümanları: (kullanıcı sütunu, zaman sütunu)

create or replace function private.guard_user_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_limit  record;
  v_count  integer;
  v_target uuid;
begin
  -- Sistem işlemleri (sezon kapanışı, yönetici, servis) sınırlanmaz
  if (select auth.role()) is distinct from 'authenticated' then
    return new;
  end if;

  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;

  select * into v_limit from private.rate_limits where table_name = tg_table_name;
  if found then
    execute format(
      'select count(*) from public.%I where %I = $1 and %I > now() - make_interval(secs => $2)',
      tg_table_name, tg_argv[0], tg_argv[1])
      into v_count using v_uid, v_limit.per_seconds;
    if v_count >= v_limit.max_count then
      raise exception 'rate_limited' using errcode = 'P0001';
    end if;
  end if;

  -- Engel varsa takip / oy yok
  if tg_table_name = 'follows' then
    v_target := new.following_id;
  elsif tg_table_name = 'arena_votes' then
    select e.author_id into v_target from public.arena_entries e where e.id = new.entry_id;
  end if;
  if v_target is not null and private.blocked_pair(v_uid, v_target) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  return new;
end;
$$;
revoke execute on function private.guard_user_write() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('posts', 'author_id', 'created_at'),
    ('post_media', 'post_id', 'post_id'),
    ('comments', 'author_id', 'created_at'),
    ('likes', 'user_id', 'created_at'),
    ('saves', 'user_id', 'created_at'),
    ('follows', 'follower_id', 'created_at'),
    ('moments', 'author_id', 'created_at'),
    ('moment_items', 'moment_id', 'moment_id'),
    ('arena_members', 'user_id', 'joined_at'),
    ('arena_entries', 'author_id', 'created_at'),
    ('arena_votes', 'voter_id', 'created_at'),
    ('live_streams', 'host_id', 'started_at'),
    ('orders', 'user_id', 'created_at'),
    ('reports', 'reporter_id', 'created_at'),
    ('blocks', 'blocker_id', 'created_at')
  ) as t(tbl, user_col, time_col) loop
    execute format('drop trigger if exists guard_user_write on public.%I', r.tbl);
    execute format(
      'create trigger guard_user_write before insert on public.%I
         for each row execute function private.guard_user_write(%L, %L)',
      r.tbl, r.user_col, r.time_col);
  end loop;
end $$;

-- Askıdaki kullanıcı profilini de değiştiremez
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated'
     and old.id = (select auth.uid())
     and not private.is_active_user(old.id) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function private.guard_profile_update() from public, anon, authenticated;
drop trigger if exists guard_profile_update on public.profiles;
create trigger guard_profile_update before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ─── 5) ÖDÜL HİLESİ TESPİTİ + BEKLETME ──────────────────────────────────────

create table if not exists public.pending_rewards (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  season_id    uuid not null references public.arena_seasons (id) on delete cascade,
  entry_id     uuid references public.arena_entries (id) on delete set null,
  place        smallint not null,
  amount       integer not null check (amount > 0),
  reason       text not null,
  ref          text not null unique,
  flags        jsonb not null default '[]',
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text
);
create index if not exists pending_rewards_status_idx on public.pending_rewards (status, created_at desc);
create index if not exists pending_rewards_user_idx on public.pending_rewards (user_id);

alter table public.pending_rewards enable row level security;
drop policy if exists "pending_rewards: kendi ödülünü ya da yönetici hepsini görür" on public.pending_rewards;
create policy "pending_rewards: kendi ödülünü ya da yönetici hepsini görür" on public.pending_rewards
  for select to authenticated
  using ((select auth.uid()) = user_id or private.is_admin());
revoke all on table public.pending_rewards from anon, authenticated;
grant select on table public.pending_rewards to authenticated;

create table if not exists private.fraud_flags (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  season_id   uuid,
  entry_id    uuid,
  kind        text not null,
  details     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Bir arena girişinin oylarında hile izi arar; bulunan şüpheleri liste olarak döner
create or replace function private.detect_vote_fraud(p_entry uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e        public.arena_entries%rowtype;
  v_total  integer;
  v_ring   integer;
  v_empty  integer;
  v_batch  integer;
  v_burst  integer;
  v_flags  jsonb := '[]';
begin
  select * into e from public.arena_entries where id = p_entry;
  if not found then
    return v_flags;
  end if;
  select count(*) into v_total from public.arena_votes where entry_id = p_entry;
  if v_total = 0 then
    return v_flags;
  end if;

  -- Oy halkası: bu girişe oy verenlerin yarısından fazlasına, kazanan da aynı sezonda oy vermiş
  select count(*) into v_ring
  from public.arena_votes v
  where v.entry_id = p_entry
    and exists (
      select 1 from public.arena_votes w
      join public.arena_entries e2 on e2.id = w.entry_id
      where w.voter_id = e.author_id and e2.author_id = v.voter_id and e2.season_id = e.season_id
    );
  if v_ring::numeric / v_total >= 0.5 then
    v_flags := v_flags || jsonb_build_object('kind', 'vote_ring', 'share', round(v_ring::numeric / v_total, 2));
  end if;

  -- İçi boş hesaplar: oy verenlerin %60'ından fazlasının hiç gönderisi yok
  select count(*) into v_empty
  from public.arena_votes v
  where v.entry_id = p_entry
    and not exists (select 1 from public.posts p where p.author_id = v.voter_id);
  if v_total >= 10 and v_empty::numeric / v_total >= 0.6 then
    v_flags := v_flags || jsonb_build_object('kind', 'empty_accounts', 'share', round(v_empty::numeric / v_total, 2));
  end if;

  -- Toplu açılmış hesaplar: oy verenlerin yarısından fazlası aynı gün kaydolmuş
  select coalesce(max(c), 0) into v_batch
  from (
    select count(*) as c
    from public.arena_votes v
    join public.profiles pr on pr.id = v.voter_id
    where v.entry_id = p_entry
    group by pr.created_at::date
  ) x;
  if v_batch >= 10 and v_batch::numeric / v_total >= 0.5 then
    v_flags := v_flags || jsonb_build_object('kind', 'batch_accounts', 'same_day', v_batch);
  end if;

  -- Ani oy patlaması: oyların %60'ından fazlası 1 saat içinde gelmiş
  select coalesce(max(c), 0) into v_burst
  from (
    select (
      select count(*) from public.arena_votes v2
      where v2.entry_id = p_entry
        and v2.created_at >= v.created_at and v2.created_at < v.created_at + interval '1 hour'
    ) as c
    from public.arena_votes v
    where v.entry_id = p_entry
  ) x;
  if v_total >= 20 and v_burst::numeric / v_total >= 0.6 then
    v_flags := v_flags || jsonb_build_object('kind', 'vote_burst', 'in_one_hour', v_burst);
  end if;

  return v_flags;
end;
$$;
revoke execute on function private.detect_vote_fraud(uuid) from public, anon, authenticated;

-- Sezon kapanışı: temiz kazanana token hemen, şüpheliye bekleyen ödül + yönetici incelemesi
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
  v_awarded  integer := 0;
  v_flags    jsonb;
  v_reason   text;
  v_ref      text;
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
    v_reason := v_arena || ' Arenası — ' || r.place || '. ödülü';
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
              'Tebrikler! ' || v_arena || ' Arenası''nda ' || r.place
              || '. oldun. Ödülün kısa bir güvenlik incelemesinden sonra hesabına geçecek.',
              '/cuzdan');
    end if;
    v_awarded := v_awarded + 1;
  end loop;

  update public.arena_seasons set status = 'settled', settled_at = now() where id = p_season_id;

  insert into public.arena_seasons (arena_key, starts_at, ends_at)
  values (v_season.arena_key, now(), now() + interval '7 days');

  return v_awarded;
end;
$$;
revoke execute on function private.settle_season(uuid) from public, anon, authenticated;

-- ─── YÖNETİCİ İŞLEMLERİ (hepsi denetim kaydına yazılır) ─────────────────────

create or replace function private.admin_review_reward(p_reward uuid, p_approve boolean, p_note text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare r public.pending_rewards%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from public.pending_rewards where id = p_reward for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'pending' then
    return r.status;
  end if;

  if p_approve then
    insert into public.token_ledger (user_id, amount, reason, ref)
    values (r.user_id, r.amount, r.reason, r.ref)
    on conflict (ref) do nothing;
  else
    insert into public.notifications (user_id, kind, text, href)
    values (r.user_id, 'arena',
            'Arena ödülün incelendi ve kurallara aykırı oylar tespit edildiği için verilmedi.', '/cuzdan');
  end if;

  update public.pending_rewards
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewed_by = (select auth.uid()), reviewed_at = now(), review_note = p_note
   where id = p_reward;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), case when p_approve then 'reward_approved' else 'reward_rejected' end,
          'pending_reward', p_reward::text, jsonb_build_object('note', p_note, 'user_id', r.user_id, 'amount', r.amount));

  return case when p_approve then 'approved' else 'rejected' end;
end;
$$;

create or replace function private.admin_set_user_status(p_user uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_status not in ('active', 'suspended', 'banned') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  update public.profiles set status = p_status where id = p_user;
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'user_status:' || p_status, 'user', p_user::text, jsonb_build_object('reason', p_reason));
end;
$$;

-- decision: 'remove' = içerik gizli kalır, şikayetler çözüldü; 'dismiss' = içerik geri açılır, şikayetler reddedildi
create or replace function private.admin_resolve_report(p_report uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare r public.reports%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision not in ('remove', 'dismiss') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if r.target_type = 'post' then
    update public.posts set is_hidden = (p_decision = 'remove') where id = r.target_id;
  elsif r.target_type = 'comment' then
    update public.comments set is_hidden = (p_decision = 'remove') where id = r.target_id;
  end if;

  update public.reports
     set status = case when p_decision = 'remove' then 'resolved' else 'dismissed' end,
         resolved_by = (select auth.uid()), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'report_' || p_decision, r.target_type, r.target_id::text, '{}');
end;
$$;

revoke execute on function private.admin_review_reward(uuid, boolean, text) from public, anon;
revoke execute on function private.admin_set_user_status(uuid, text, text) from public, anon;
revoke execute on function private.admin_resolve_report(uuid, text) from public, anon;
grant execute on function private.admin_review_reward(uuid, boolean, text) to authenticated;
grant execute on function private.admin_set_user_status(uuid, text, text) to authenticated;
grant execute on function private.admin_resolve_report(uuid, text) to authenticated;

-- API'ye açık ince sarmalayıcılar (yetki kontrolü içeride)
create or replace function public.admin_review_reward(p_reward uuid, p_approve boolean, p_note text default null)
returns text language sql security invoker set search_path = ''
as $$ select private.admin_review_reward(p_reward, p_approve, p_note); $$;
create or replace function public.admin_set_user_status(p_user uuid, p_status text, p_reason text default null)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_user_status(p_user, p_status, p_reason); $$;
create or replace function public.admin_resolve_report(p_report uuid, p_decision text)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_resolve_report(p_report, p_decision); $$;

revoke execute on function public.admin_review_reward(uuid, boolean, text) from public, anon;
revoke execute on function public.admin_set_user_status(uuid, text, text) from public, anon;
revoke execute on function public.admin_resolve_report(uuid, text) from public, anon;
grant execute on function public.admin_review_reward(uuid, boolean, text) to authenticated;
grant execute on function public.admin_set_user_status(uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text) to authenticated;
