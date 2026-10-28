-- ============================================================================
-- VOPILA — Ayarlar paketi (Instagram karşılaştırması) + bildirim görünürlük düzeltmesi
--  0) Güvenlik: bahsetme/yanıt bildirimi yalnızca gönderiyi görebilen kişiye gider
--     (tek görünürlük kaynağı: private.can_view_user_as)
--  1) Kullanıcı ayarları: bildirim tercihleri, yorum / bahsetme / mesaj izinleri, gizli kelimeler
--  2) Kısıtla ve sessize al
--  3) Arşiv (gönderi yalnızca sahibine görünür)
--  4) Destek talepleri
--  5) Verilerimi indir (KVKK) ve hesabı sil (mağaza şartı)
-- ============================================================================

-- ─── 0) Tek görünürlük kuralı ───────────────────────────────────────────────

-- "Bu kişi (viewer) hedefin içeriğini görebilir mi?" — can_view_user'ın herhangi bir kişi için hali
create or replace function private.can_view_user_as(p_viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.blocked_pair(target, p_viewer)
    and (
      (p_viewer is not null and target = p_viewer)
      or (
        coalesce((select p.status from public.profiles p where p.id = target), 'active') <> 'banned'
        and (
          not coalesce((select p.is_private from public.profiles p where p.id = target), false)
          or exists (
            select 1 from public.follows f
            where f.follower_id = p_viewer and f.following_id = target and f.status = 'accepted'
          )
        )
      )
    );
$$;
revoke execute on function private.can_view_user_as(uuid, uuid) from public, anon, authenticated;

create or replace function private.can_view_user(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_view_user_as((select auth.uid()), target);
$$;

-- ─── 1) Kullanıcı ayarları ──────────────────────────────────────────────────

create table if not exists public.user_settings (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  -- Bildirim tercihleri: {"like": false, ...} — anahtar yoksa açık sayılır
  notif            jsonb not null default '{}',
  -- Gönderilerime kim yorum yapabilir
  comment_policy   text not null default 'everyone' check (comment_policy in ('everyone', 'following', 'followers', 'nobody')),
  -- Benden kim bahsedebilir
  mention_policy   text not null default 'everyone' check (mention_policy in ('everyone', 'following', 'nobody')),
  -- Bana kim mesaj atabilir
  message_policy   text not null default 'everyone' check (message_policy in ('everyone', 'following')),
  hidden_words     text[] not null default '{}' check (cardinality(hidden_words) <= 100),
  daily_limit_min  integer check (daily_limit_min is null or daily_limit_min between 10 and 600),
  updated_at       timestamptz not null default now()
);

alter table public.user_settings enable row level security;
drop policy if exists "user_settings: sahibi okur" on public.user_settings;
create policy "user_settings: sahibi okur" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "user_settings: sahibi ekler" on public.user_settings;
create policy "user_settings: sahibi ekler" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "user_settings: sahibi günceller" on public.user_settings;
create policy "user_settings: sahibi günceller" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on table public.user_settings from anon, authenticated;
grant select on table public.user_settings to authenticated;
grant insert (user_id, notif, comment_policy, mention_policy, message_policy, hidden_words, daily_limit_min)
  on table public.user_settings to authenticated;
grant update (notif, comment_policy, mention_policy, message_policy, hidden_words, daily_limit_min, updated_at)
  on table public.user_settings to authenticated;

-- Bir kişinin bir izin ayarı, karşı taraf için izin veriyor mu?
-- everyone: herkes · following: sahibinin takip ettikleri · followers: sahibini takip edenler · nobody: kimse
create or replace function private.policy_allows(p_policy text, p_owner uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_owner = p_actor then true
    when coalesce(p_policy, 'everyone') = 'everyone' then true
    when p_policy = 'following' then exists (
      select 1 from public.follows f where f.follower_id = p_owner and f.following_id = p_actor and f.status = 'accepted')
    when p_policy = 'followers' then exists (
      select 1 from public.follows f where f.follower_id = p_actor and f.following_id = p_owner and f.status = 'accepted')
    else false
  end;
$$;
revoke execute on function private.policy_allows(text, uuid, uuid) from public, anon, authenticated;

-- ─── 2) Kısıtla ve sessize al ───────────────────────────────────────────────

create table if not exists public.restricts (
  restricter_id  uuid not null references public.profiles (id) on delete cascade,
  restricted_id  uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (restricter_id, restricted_id),
  check (restricter_id <> restricted_id)
);
create index if not exists restricts_restricted_idx on public.restricts (restricted_id);

create table if not exists public.mutes (
  muter_id    uuid not null references public.profiles (id) on delete cascade,
  muted_id    uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);
create index if not exists mutes_muted_idx on public.mutes (muted_id);

alter table public.restricts enable row level security;
alter table public.mutes enable row level security;

drop policy if exists "restricts: sahibi yönetir" on public.restricts;
create policy "restricts: sahibi yönetir" on public.restricts
  for all to authenticated
  using ((select auth.uid()) = restricter_id) with check ((select auth.uid()) = restricter_id);
drop policy if exists "mutes: sahibi yönetir" on public.mutes;
create policy "mutes: sahibi yönetir" on public.mutes
  for all to authenticated
  using ((select auth.uid()) = muter_id) with check ((select auth.uid()) = muter_id);

revoke all on table public.restricts, public.mutes from anon, authenticated;
grant select, delete on table public.restricts, public.mutes to authenticated;
grant insert (restricter_id, restricted_id) on table public.restricts to authenticated;
grant insert (muter_id, muted_id) on table public.mutes to authenticated;

create or replace function private.is_restricted(p_owner uuid, p_actor uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.restricts r where r.restricter_id = p_owner and r.restricted_id = p_actor);
$$;
revoke execute on function private.is_restricted(uuid, uuid) from public;
grant execute on function private.is_restricted(uuid, uuid) to anon, authenticated;

-- ─── Bildirim kapısı: tercih kapalıysa ya da gönderen kısıtlıysa bildirim yazılmaz ─

create or replace function private.notification_gate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind in ('like', 'comment', 'follow', 'mention', 'reply') and not coalesce(
    (select (s.notif ->> new.kind)::boolean from public.user_settings s where s.user_id = new.user_id), true
  ) then
    return null;
  end if;
  if new.actor_id is not null and new.kind in ('comment', 'reply', 'mention', 'like')
     and private.is_restricted(new.user_id, new.actor_id) then
    return null;
  end if;
  return new;
end;
$$;
revoke execute on function private.notification_gate() from public, anon, authenticated;
drop trigger if exists notifications_gate on public.notifications;
create trigger notifications_gate before insert on public.notifications
  for each row execute function private.notification_gate();

-- ─── 0+1) Bahsetme ve yanıt bildirimleri: görünürlük + izin kontrolü ────────

create or replace function private.notify_mentions(p_text text, p_actor uuid, p_post uuid, p_what text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_hidden boolean;
begin
  select po.author_id, po.is_hidden into v_author, v_hidden from public.posts po where po.id = p_post;
  if v_author is null or v_hidden then
    return;
  end if;
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select distinct p.id, 'mention', p_actor,
         a.name || ' ' || p_what || ' senden bahsetti.', '/gonderi/' || p_post::text
  from (
    select lower(m[1]) as uname
    from regexp_matches(coalesce(p_text, ''), '@([A-Za-z0-9_]{3,20})', 'g') as m
    limit 10
  ) u
  join public.profiles p on p.username = u.uname
  join public.profiles a on a.id = p_actor
  left join public.user_settings s on s.user_id = p.id
  where p.id <> p_actor
    and not private.blocked_pair(p.id, p_actor)
    and private.can_view_user_as(p.id, v_author)
    and private.policy_allows(s.mention_policy, p.id, p_actor);
end;
$$;
revoke execute on function private.notify_mentions(text, uuid, uuid, text) from public, anon, authenticated;

create or replace function private.on_comment_extras()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
  v_post_hidden boolean;
begin
  -- Gizlenen (ör. gizli kelime) yorumdan bildirim çıkmaz
  if new.is_hidden then
    return null;
  end if;
  perform private.notify_mentions(new.text, new.author_id, new.post_id, 'bir yorumda');
  if new.parent_id is not null then
    select po.author_id, po.is_hidden into v_author, v_post_hidden from public.posts po where po.id = new.post_id;
    if v_author is null or v_post_hidden then
      return null;
    end if;
    insert into public.notifications (user_id, kind, actor_id, text, href)
    select c.author_id, 'reply', new.author_id,
           a.name || ' yorumuna yanıt verdi: "' || left(new.text, 60) || '"', '/gonderi/' || new.post_id::text
    from public.comments c
    join public.profiles a on a.id = new.author_id
    where c.id = new.parent_id
      and c.author_id <> new.author_id
      and not c.is_hidden
      and not private.blocked_pair(c.author_id, new.author_id)
      and private.can_view_user_as(c.author_id, v_author);
  end if;
  return null;
end;
$$;

-- Yorum bildirimi de gizlenen yorumlarda çıkmasın
create or replace function private.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_hidden then
    return null;
  end if;
  insert into public.notifications (user_id, kind, actor_id, text, href)
  select po.author_id, 'comment', new.author_id,
         pr.name || ' yorum yaptı: "' || left(new.text, 60) || '"', '/gonderi/' || new.post_id::text
  from public.posts po
  join public.profiles pr on pr.id = new.author_id
  where po.id = new.post_id and po.author_id <> new.author_id;
  return null;
end;
$$;

-- ─── 1) Yorum izni + gizli kelimeler ────────────────────────────────────────

create or replace function private.can_comment(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.policy_allows(s.comment_policy, po.author_id, (select auth.uid()))
  from public.posts po
  left join public.user_settings s on s.user_id = po.author_id
  where po.id = p_post;
$$;
revoke execute on function private.can_comment(uuid) from public;
grant execute on function private.can_comment(uuid) to authenticated;

drop policy if exists "comments: kendi adına yorum yapar" on public.comments;
create policy "comments: kendi adına yorum yapar" on public.comments
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and exists (select 1 from public.posts p where p.id = post_id)
    and coalesce(private.can_comment(post_id), false)
  );

-- Gönderi sahibinin gizli kelimelerinden biri geçen yorum otomatik gizlenir (yalnızca yazan görür)
create or replace function private.apply_hidden_words()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
  v_words text[];
begin
  select po.author_id into v_owner from public.posts po where po.id = new.post_id;
  if v_owner is null or v_owner = new.author_id then
    return new;
  end if;
  select s.hidden_words into v_words from public.user_settings s where s.user_id = v_owner;
  if v_words is not null and exists (
    select 1 from unnest(v_words) w
    where length(btrim(w)) > 0 and position(lower(btrim(w)) in lower(new.text)) > 0
  ) then
    new.is_hidden := true;
  end if;
  return new;
end;
$$;
revoke execute on function private.apply_hidden_words() from public, anon, authenticated;
drop trigger if exists comments_hidden_words on public.comments;
create trigger comments_hidden_words before insert on public.comments
  for each row execute function private.apply_hidden_words();

-- Kısıtlanan kişinin yorumu yalnızca kendisine ve gönderi sahibine görünür
drop policy if exists "comments: görünür gönderilerin yorumları" on public.comments;
create policy "comments: görünür gönderilerin yorumları" on public.comments
  for select to anon, authenticated
  using (
    exists (select 1 from public.posts p where p.id = comments.post_id)
    and not private.blocked_pair(comments.author_id, (select auth.uid()))
    and (not comments.is_hidden or comments.author_id = (select auth.uid()) or private.is_admin())
    and (
      comments.author_id = (select auth.uid())
      -- Not: alt sorguda posts da author_id içerdiği için sütunlar tabloyla birlikte yazılmalı
      or not exists (
        select 1 from public.posts p
        where p.id = comments.post_id
          and p.author_id <> (select auth.uid())
          and private.is_restricted(p.author_id, comments.author_id)
      )
    )
  );

-- ─── 1) Mesaj izni ──────────────────────────────────────────────────────────
-- "following": yalnızca karşı tarafın takip ettiği kişiler yazabilir; ama karşı taraf bu sohbete
-- daha önce yazdıysa (konuşma başlamışsa) cevap verilebilir.
create or replace function private.can_message(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(bool_and(
    private.policy_allows(s.message_policy, m.user_id, (select auth.uid()))
    or exists (select 1 from public.messages x where x.conversation_id = p_conversation and x.sender_id = m.user_id)
  ), true)
  from public.conversation_members m
  left join public.user_settings s on s.user_id = m.user_id
  where m.conversation_id = p_conversation and m.user_id <> (select auth.uid());
$$;
revoke execute on function private.can_message(uuid) from public;
grant execute on function private.can_message(uuid) to authenticated;

drop policy if exists "messages: üye kendi adına yazar" on public.messages;
create policy "messages: üye kendi adına yazar" on public.messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and private.is_member(conversation_id)
    and not private.dm_blocked(conversation_id)
    and private.can_message(conversation_id)
    and (post_id is null or exists (select 1 from public.posts p where p.id = post_id))
  );

-- ─── 3) Arşiv ───────────────────────────────────────────────────────────────

alter table public.posts add column if not exists archived_at timestamptz;
grant update (archived_at) on table public.posts to authenticated;

drop policy if exists "posts: görünür hesapların gönderileri" on public.posts;
create policy "posts: görünür hesapların gönderileri" on public.posts
  for select to anon, authenticated
  using (
    private.can_view_user(author_id)
    and (not is_hidden or author_id = (select auth.uid()) or private.is_admin())
    and (archived_at is null or author_id = (select auth.uid()))
  );

-- ─── 4) Destek talepleri ────────────────────────────────────────────────────

create table if not exists public.support_tickets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  topic       text not null check (topic in ('hesap', 'arena', 'magaza', 'guvenlik', 'hata', 'oneri', 'diger')),
  message     text not null check (char_length(btrim(message)) between 10 and 2000),
  status      text not null default 'open' check (status in ('open', 'answered', 'closed')),
  created_at  timestamptz not null default now()
);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;
drop policy if exists "support_tickets: sahibi ya da yönetici görür" on public.support_tickets;
create policy "support_tickets: sahibi ya da yönetici görür" on public.support_tickets
  for select to authenticated using ((select auth.uid()) = user_id or private.is_admin());
drop policy if exists "support_tickets: kendi adına yazar" on public.support_tickets;
create policy "support_tickets: kendi adına yazar" on public.support_tickets
  for insert to authenticated with check ((select auth.uid()) = user_id);
revoke all on table public.support_tickets from anon, authenticated;
grant select on table public.support_tickets to authenticated;
grant insert (user_id, topic, message) on table public.support_tickets to authenticated;

insert into private.rate_limits (table_name, max_count, per_seconds) values ('support_tickets', 5, 3600)
on conflict (table_name) do nothing;
drop trigger if exists guard_user_write on public.support_tickets;
create trigger guard_user_write before insert on public.support_tickets
  for each row execute function private.guard_user_write('user_id', 'created_at');
drop trigger if exists force_insert_timestamps on public.support_tickets;
create trigger force_insert_timestamps before insert on public.support_tickets
  for each row execute function private.force_insert_timestamps();

-- ─── 5) Verilerimi indir ve hesabı sil ──────────────────────────────────────

create or replace function private.export_my_data()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'olusturulma', now(),
    'hesap', (select jsonb_build_object('email', u.email, 'kayit_tarihi', u.created_at) from auth.users u where u.id = v_uid),
    'profil', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'ayarlar', (select to_jsonb(s) from public.user_settings s where s.user_id = v_uid),
    'gonderiler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', po.id, 'aciklama', po.caption, 'konum', po.location, 'arena', po.arena_key,
        'tarih', po.created_at, 'arsiv', po.archived_at,
        'medya', (select coalesce(jsonb_agg(pm.storage_path order by pm.position), '[]') from public.post_media pm where pm.post_id = po.id)
      ) order by po.created_at)
      from public.posts po where po.author_id = v_uid), '[]'),
    'yorumlar', coalesce((
      select jsonb_agg(jsonb_build_object('gonderi', c.post_id, 'metin', c.text, 'tarih', c.created_at) order by c.created_at)
      from public.comments c where c.author_id = v_uid), '[]'),
    'begeniler', coalesce((
      select jsonb_agg(jsonb_build_object('gonderi', l.post_id, 'tarih', l.created_at)) from public.likes l where l.user_id = v_uid), '[]'),
    'kaydedilenler', coalesce((
      select jsonb_agg(jsonb_build_object('gonderi', s.post_id, 'tarih', s.created_at)) from public.saves s where s.user_id = v_uid), '[]'),
    'takip_ettiklerim', coalesce((
      select jsonb_agg(jsonb_build_object('kullanici', p.username, 'durum', f.status, 'tarih', f.created_at))
      from public.follows f join public.profiles p on p.id = f.following_id where f.follower_id = v_uid), '[]'),
    'takipcilerim', coalesce((
      select jsonb_agg(jsonb_build_object('kullanici', p.username, 'tarih', f.created_at))
      from public.follows f join public.profiles p on p.id = f.follower_id
      where f.following_id = v_uid and f.status = 'accepted'), '[]'),
    'gonderdigim_mesajlar', coalesce((
      select jsonb_agg(jsonb_build_object('sohbet', m.conversation_id, 'metin', m.text, 'gonderi', m.post_id, 'tarih', m.created_at) order by m.created_at)
      from public.messages m where m.sender_id = v_uid), '[]'),
    'anlar', coalesce((
      select jsonb_agg(jsonb_build_object('baslik', mo.title, 'tarih', mo.created_at)) from public.moments mo where mo.author_id = v_uid), '[]'),
    'arena_oylarim', coalesce((
      select jsonb_agg(jsonb_build_object('giris', v.entry_id, 'puan', v.score, 'tarih', v.created_at)) from public.arena_votes v where v.voter_id = v_uid), '[]'),
    'siparisler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'toplam', o.total, 'adres', o.address, 'durum', o.status, 'tarih', o.created_at,
        'urunler', (select coalesce(jsonb_agg(jsonb_build_object('urun', oi.product_id, 'adet', oi.qty, 'fiyat', oi.unit_price)), '[]')
                    from public.order_items oi where oi.order_id = o.id)
      ) order by o.created_at)
      from public.orders o where o.user_id = v_uid), '[]'),
    'token_hareketleri', coalesce((
      select jsonb_agg(jsonb_build_object('miktar', t.amount, 'aciklama', t.reason, 'tarih', t.created_at) order by t.created_at)
      from public.token_ledger t where t.user_id = v_uid), '[]'),
    'destek_talepleri', coalesce((
      select jsonb_agg(jsonb_build_object('konu', st.topic, 'mesaj', st.message, 'durum', st.status, 'tarih', st.created_at))
      from public.support_tickets st where st.user_id = v_uid), '[]')
  );
end;
$$;
revoke execute on function private.export_my_data() from public, anon;
grant execute on function private.export_my_data() to authenticated;

create or replace function public.export_my_data()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.export_my_data(); $$;
revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

-- Silinen hesapların siparişleri yasal saklama için (fatura / e-arşiv) özet olarak tutulur
create table if not exists private.retained_orders (
  order_id    uuid primary key,
  user_ref    text not null,
  snapshot    jsonb not null,
  deleted_at  timestamptz not null default now()
);

-- Hesabı kalıcı sil: siparişler saklanır, gerisi (profil, gönderi, yorum, mesaj...) silinir.
-- Dosyalar uygulama tarafından önceden silinir (Storage API).
create or replace function private.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  insert into private.retained_orders (order_id, user_ref, snapshot)
  select o.id, md5(v_uid::text), jsonb_build_object(
    'toplam', o.total, 'adres', o.address, 'durum', o.status, 'tarih', o.created_at,
    'urunler', (select coalesce(jsonb_agg(jsonb_build_object('urun', oi.product_id, 'adet', oi.qty, 'fiyat', oi.unit_price)), '[]')
                from public.order_items oi where oi.order_id = o.id))
  from public.orders o where o.user_id = v_uid
  on conflict (order_id) do nothing;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values (v_uid, 'account_deleted', 'user', md5(v_uid::text), '{}');

  delete from private.admins where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;
revoke execute on function private.delete_my_account() from public, anon;
grant execute on function private.delete_my_account() to authenticated;

create or replace function public.delete_my_account()
returns void language sql security invoker set search_path = ''
as $$ select private.delete_my_account(); $$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
