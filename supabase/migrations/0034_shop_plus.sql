-- ============================================================================
-- VOPILA — Mağaza (Trendyol/Amazon'dan token mağazasına uyanlar):
--  * Ürün: çoklu görsel, satış sayısı; favoriler
--  * Doğrulanmış alıcı yorumları (yalnız teslim edilmiş siparişteki ürüne, sipariş başına 1) + puan özeti
--  * Sipariş: kalem adı/görseli kopyası, tarihli durum geçmişi, siparişe özel bildirim bağlantısı
--  * Müşteri iptali (hazırlanırken) ve iade talebi (teslimden sonra 14 gün; yönetici onaylarsa token iadesi)
--  * İade/iptal iadesinde "token kazandın" bildirimi gitmez (ayrı sipariş bildirimi var)
-- ============================================================================

-- ─── Ürün ──────────────────────────────────────────────────────────────────
alter table public.products add column if not exists images text[] not null default '{}';
alter table public.products add column if not exists sold_count integer not null default 0;
alter table public.products add column if not exists updated_at timestamptz not null default now();

create or replace function private.admin_set_product_images(p_id text, p_images text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if coalesce(array_length(p_images, 1), 0) > 8 then
    raise exception 'too_many_images' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_images, '{}')) u where u !~ '^https://') then
    raise exception 'invalid_image' using errcode = 'P0001';
  end if;
  update public.products
     set images = coalesce(p_images, '{}'),
         image_url = coalesce(p_images[1], image_url),
         updated_at = now()
   where id = p_id;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function private.admin_set_product_images(text, text[]) from public, anon;
grant execute on function private.admin_set_product_images(text, text[]) to authenticated;
create or replace function public.admin_set_product_images(p_id text, p_images text[])
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_set_product_images(p_id, p_images); end; $$;
revoke execute on function public.admin_set_product_images(text, text[]) from public, anon;
grant execute on function public.admin_set_product_images(text, text[]) to authenticated;

-- ─── Favoriler ───────────────────────────────────────────────────────────────
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.favorites enable row level security;
revoke all on table public.favorites from anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;
drop policy if exists "aal2 gerekli" on public.favorites;
create policy "aal2 gerekli" on public.favorites as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "favorites: sahibi" on public.favorites;
create policy "favorites: sahibi" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─── Sipariş kalemi kopyası ve durum geçmişi ────────────────────────────────
alter table public.order_items add column if not exists name text;
alter table public.order_items add column if not exists image_url text;
update public.order_items oi set name = p.name, image_url = p.image_url
  from public.products p where p.id = oi.product_id and oi.name is null;

create table if not exists public.order_status_history (
  id       bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  status   text not null,
  at       timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, at);
alter table public.order_status_history enable row level security;
revoke all on table public.order_status_history from anon, authenticated;
grant select on table public.order_status_history to authenticated;
drop policy if exists "order_status_history: sipariş sahibi ve yönetici" on public.order_status_history;
create policy "order_status_history: sipariş sahibi ve yönetici" on public.order_status_history for select to authenticated
  using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
    or private.is_admin()
  );
insert into public.order_status_history (order_id, status, at)
select o.id, 'preparing', o.created_at from public.orders o
 where not exists (select 1 from public.order_status_history h where h.order_id = o.id);
insert into public.order_status_history (order_id, status, at)
select o.id, o.status, coalesce(o.status_changed_at, o.created_at) from public.orders o
 where o.status <> 'preparing'
   and not exists (select 1 from public.order_status_history h where h.order_id = o.id and h.status = o.status);

create or replace function private.log_order_status()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status) values (new.id, new.status);
  end if;
  return null;
end;
$$;
revoke execute on function private.log_order_status() from public, anon, authenticated;
drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status after insert or update of status on public.orders
  for each row execute function private.log_order_status();

-- Durum bildirimi siparişin kendi sayfasına götürür
create or replace function private.notify_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.notifications (user_id, kind, text, href)
    values (new.user_id, 'order',
      case new.status
        when 'shipped' then 'Siparişin kargoya verildi' || coalesce(' (' || new.carrier || ', takip no: ' || new.tracking_no || ')', '') || '.'
        when 'delivered' then 'Siparişin teslim edildi. Ürünü değerlendirmeyi unutma!'
        when 'problem' then 'Siparişinle ilgili bir sorun var. Ekibimiz seninle iletişime geçecek.'
        when 'cancelled' then 'Siparişin iptal edildi; tokenlerin cüzdanına iade edildi.'
        else 'Siparişin yeniden hazırlanıyor.'
      end,
      '/siparis/' || new.id::text);
  end if;
  return null;
end;
$$;

-- İptal/iade iadeleri "token kazandın" diye bildirilmez (sipariş bildirimi zaten gider)
create or replace function private.notify_token()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.amount > 0 and coalesce(new.ref, '') !~ '^(refund|return):' then
    insert into public.notifications (user_id, kind, text, href)
    values (new.user_id, 'token', new.amount || ' token kazandın! ' || new.reason, '/cuzdan');
  end if;
  return null;
end;
$$;

-- Sipariş: kalem adı/görseli kopyalanır, satış sayısı artar, bildirim siparişe bağlanır
create or replace function private.place_order_v2(p_items jsonb, p_address_id uuid, p_consent boolean)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_addr     public.addresses%rowtype;
  v_total    integer := 0;
  v_balance  integer;
  v_order    uuid;
  r          record;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consent_required' using errcode = 'P0001';
  end if;
  select * into v_addr from public.addresses a where a.id = p_address_id and a.user_id = v_uid;
  if not found then
    raise exception 'invalid_address' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_cart' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext('order:' || v_uid::text));

  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
    where not exists (select 1 from public.products p where p.id = i.product_id)
  ) then
    raise exception 'unknown_product' using errcode = 'P0001';
  end if;

  perform 1 from public.products p
   where p.id in (select i.product_id from jsonb_to_recordset(p_items) as i(product_id text, qty integer))
   order by p.id
   for update;

  for r in
    select i.product_id, sum(i.qty)::integer as qty, p.price, p.stock, p.active
    from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
    join public.products p on p.id = i.product_id
    group by i.product_id, p.price, p.stock, p.active
    order by i.product_id
  loop
    if r.qty is null or r.qty <= 0 or r.qty > 20 then
      raise exception 'invalid_quantity' using errcode = 'P0001';
    end if;
    if not r.active or r.stock < r.qty then
      raise exception 'out_of_stock:%', r.product_id using errcode = 'P0001';
    end if;
    v_total := v_total + r.price * r.qty;
  end loop;

  select coalesce(sum(l.amount), 0) into v_balance from public.token_ledger l where l.user_id = v_uid;
  if v_balance < v_total then
    raise exception 'insufficient_balance' using errcode = 'P0001';
  end if;

  insert into public.orders (user_id, total, address, kvkk_consent_at)
  values (v_uid, v_total, private.address_snapshot(v_addr), now())
  returning id into v_order;

  insert into public.order_items (order_id, product_id, qty, unit_price, name, image_url)
  select v_order, i.product_id, sum(i.qty)::integer, p.price, p.name, p.image_url
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id
  group by i.product_id, p.price, p.name, p.image_url;

  update public.products p
     set stock = p.stock - x.qty, sold_count = p.sold_count + x.qty
    from (
      select i.product_id, sum(i.qty)::integer as qty
      from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
      group by i.product_id
    ) x
   where p.id = x.product_id;

  insert into public.token_ledger (user_id, amount, reason, ref)
  values (v_uid, -v_total, 'Mağaza siparişi', 'order:' || v_order::text);

  insert into public.notifications (user_id, kind, text, href)
  values (v_uid, 'order', 'Siparişin alındı, hazırlanıyor. Kargoya verilince haber vereceğiz.', '/siparis/' || v_order::text);

  return v_order;
end;
$$;

-- Ortak iptal: token iadesi (bir kez) + stok ve satış sayısı geri
create or replace function private.refund_cancelled_order(p_order uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order;
  insert into public.token_ledger (user_id, amount, reason, ref)
  values (v.user_id, v.total, 'Sipariş iptali iadesi', 'refund:' || p_order::text)
  on conflict (ref) do nothing;
  if found then
    update public.products p set stock = p.stock + oi.qty, sold_count = greatest(p.sold_count - oi.qty, 0)
      from public.order_items oi where oi.order_id = p_order and oi.product_id = p.id;
  end if;
end;
$$;
revoke execute on function private.refund_cancelled_order(uuid) from public, anon, authenticated;

create or replace function private.admin_update_order(p_order uuid, p_status text, p_carrier text, p_tracking text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.orders%rowtype;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_status not in ('preparing', 'shipped', 'delivered', 'problem', 'cancelled') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;
  select * into v_old from public.orders where id = p_order for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v_old.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'order_cancelled' using errcode = 'P0001';
  end if;
  if p_status = 'shipped' and coalesce(nullif(btrim(p_tracking), ''), v_old.tracking_no) is null then
    raise exception 'tracking_required' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_status,
         carrier = coalesce(nullif(btrim(p_carrier), ''), carrier),
         tracking_no = coalesce(nullif(btrim(p_tracking), ''), tracking_no),
         status_changed_at = case when p_status <> v_old.status then now() else status_changed_at end
   where id = p_order;

  if p_status = 'cancelled' and v_old.status <> 'cancelled' then
    perform private.refund_cancelled_order(p_order);
  end if;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'order_update', 'order', p_order::text,
          jsonb_build_object('from', v_old.status, 'to', p_status, 'carrier', p_carrier, 'tracking', p_tracking));
end;
$$;

-- Müşteri iptali: yalnızca "hazırlanıyor"ken (kargoya verilmeden)
create or replace function private.cancel_my_order(p_order uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order and user_id = (select auth.uid()) for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'preparing' then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;
  update public.orders set status = 'cancelled', status_changed_at = now() where id = p_order;
  perform private.refund_cancelled_order(p_order);
end;
$$;
revoke execute on function private.cancel_my_order(uuid) from public, anon;
grant execute on function private.cancel_my_order(uuid) to authenticated;
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.cancel_my_order(p_order); end; $$;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- ─── İade talebi ─────────────────────────────────────────────────────────────
create table if not exists public.return_requests (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null unique references public.orders (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (char_length(btrim(reason)) between 5 and 500),
  status      text not null default 'requested' check (status in ('requested', 'approved', 'rejected')),
  admin_note  text check (char_length(admin_note) <= 300),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.return_requests enable row level security;
revoke all on table public.return_requests from anon, authenticated;
grant select on table public.return_requests to authenticated;
drop policy if exists "return_requests: sahibi ve yönetici" on public.return_requests;
create policy "return_requests: sahibi ve yönetici" on public.return_requests for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

create or replace function private.request_return(p_order uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v public.orders%rowtype;
  v_id uuid;
  v_delivered timestamptz;
begin
  select * into v from public.orders where id = p_order and user_id = (select auth.uid());
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if v.status <> 'delivered' then
    raise exception 'not_delivered' using errcode = 'P0001';
  end if;
  select max(at) into v_delivered from public.order_status_history where order_id = p_order and status = 'delivered';
  if coalesce(v_delivered, v.status_changed_at, v.created_at) < now() - interval '14 days' then
    raise exception 'return_window_closed' using errcode = 'P0001';
  end if;
  if private.banned_category(p_reason) is not null then
    raise exception 'content_blocked:%', private.banned_category(p_reason) using errcode = 'P0001';
  end if;
  insert into public.return_requests (order_id, user_id, reason)
  values (p_order, v.user_id, btrim(p_reason))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'return_exists' using errcode = 'P0001';
end;
$$;
revoke execute on function private.request_return(uuid, text) from public, anon;
grant execute on function private.request_return(uuid, text) to authenticated;
create or replace function public.request_return(p_order uuid, p_reason text)
returns uuid language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.request_return(p_order, p_reason); end; $$;
revoke execute on function public.request_return(uuid, text) from public, anon;
grant execute on function public.request_return(uuid, text) to authenticated;

-- Yönetici: iade talebini onayla (token iadesi) ya da reddet
create or replace function private.admin_resolve_return(p_id uuid, p_approve boolean, p_note text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r public.return_requests%rowtype; v_total integer;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select * into r from public.return_requests where id = p_id for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if r.status <> 'requested' then
    raise exception 'already_resolved' using errcode = 'P0001';
  end if;
  update public.return_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
         resolved_at = now()
   where id = p_id;
  if p_approve then
    select total into v_total from public.orders where id = r.order_id;
    insert into public.token_ledger (user_id, amount, reason, ref)
    values (r.user_id, v_total, 'İade', 'return:' || r.order_id::text)
    on conflict (ref) do nothing;
  end if;
  insert into public.notifications (user_id, kind, text, href)
  values (r.user_id, 'order',
    case when p_approve then 'İade talebin onaylandı; ' || v_total || ' token cüzdanına iade edildi.'
         else 'İade talebin reddedildi.' || coalesce(' Not: ' || nullif(btrim(p_note), ''), '') end,
    '/siparis/' || r.order_id::text);
  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), case when p_approve then 'return_approved' else 'return_rejected' end,
          'order', r.order_id::text, jsonb_build_object('note', p_note));
end;
$$;
revoke execute on function private.admin_resolve_return(uuid, boolean, text) from public, anon;
grant execute on function private.admin_resolve_return(uuid, boolean, text) to authenticated;
create or replace function public.admin_resolve_return(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_resolve_return(p_id, p_approve, p_note); end; $$;
revoke execute on function public.admin_resolve_return(uuid, boolean, text) from public, anon;
grant execute on function public.admin_resolve_return(uuid, boolean, text) to authenticated;

-- ─── Doğrulanmış alıcı yorumları ─────────────────────────────────────────────
create table if not exists public.product_reviews (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  text not null references public.products (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  text        text not null default '' check (char_length(text) <= 500),
  created_at  timestamptz not null default now(),
  unique (order_id, product_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews (product_id, created_at desc);
alter table public.product_reviews enable row level security;
revoke all on table public.product_reviews from anon, authenticated;
grant select, delete on table public.product_reviews to authenticated;
drop policy if exists "aal2 gerekli" on public.product_reviews;
create policy "aal2 gerekli" on public.product_reviews as restrictive for all to anon, authenticated
  using (private.aal_ok()) with check (private.aal_ok());
drop policy if exists "product_reviews: herkes okur" on public.product_reviews;
create policy "product_reviews: herkes okur" on public.product_reviews for select to authenticated using (true);
drop policy if exists "product_reviews: sahibi siler" on public.product_reviews;
create policy "product_reviews: sahibi siler" on public.product_reviews for delete to authenticated
  using (user_id = (select auth.uid()));
drop trigger if exists block_banned_text on public.product_reviews;
create trigger block_banned_text before insert or update of text on public.product_reviews
  for each row execute function private.block_banned_text();

create or replace function private.review_product(p_order uuid, p_product text, p_rating integer, p_text text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if not private.is_active_user(v_uid) then
    raise exception 'account_suspended' using errcode = 'P0001';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'invalid_rating' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.orders o join public.order_items oi on oi.order_id = o.id
     where o.id = p_order and o.user_id = v_uid and o.status = 'delivered' and oi.product_id = p_product
  ) then
    raise exception 'not_verified_buyer' using errcode = 'P0001';
  end if;
  insert into public.product_reviews (order_id, product_id, user_id, rating, text)
  values (p_order, p_product, v_uid, p_rating, left(btrim(coalesce(p_text, '')), 500))
  on conflict (order_id, product_id) do update set rating = excluded.rating, text = excluded.text, created_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function private.review_product(uuid, text, integer, text) from public, anon;
grant execute on function private.review_product(uuid, text, integer, text) to authenticated;
create or replace function public.review_product(p_order uuid, p_product text, p_rating integer, p_text text default '')
returns uuid language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.review_product(p_order, p_product, p_rating, p_text); end; $$;
revoke execute on function public.review_product(uuid, text, integer, text) from public, anon;
grant execute on function public.review_product(uuid, text, integer, text) to authenticated;

create or replace view public.product_ratings with (security_invoker = true) as
  select product_id, round(avg(rating)::numeric, 1) as average, count(*)::integer as count
    from public.product_reviews group by product_id;
grant select on public.product_ratings to authenticated;

-- Yorumlar şikâyet edilebilir; kaldırma kararı yorumu siler ve yazara ihlal yazar
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('post', 'comment', 'user', 'moment', 'live', 'highlight', 'review'));

create or replace function private.report_set_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.target_author_id := case new.target_type
    when 'post' then (select author_id from public.posts where id = new.target_id)
    when 'comment' then (select author_id from public.comments where id = new.target_id)
    when 'moment' then (select author_id from public.moments where id = new.target_id)
    when 'highlight' then (select owner_id from public.highlights where id = new.target_id)
    when 'review' then (select user_id from public.product_reviews where id = new.target_id)
    when 'user' then new.target_id
    else null end;
  return new;
end;
$$;

create or replace function private.admin_resolve_report(p_report uuid, p_decision text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.reports%rowtype;
  v_author uuid;
begin
  if not private.is_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_decision not in ('remove', 'dismiss', 'sensitive') then
    raise exception 'invalid_decision' using errcode = 'P0001';
  end if;
  select * into r from public.reports where id = p_report;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  v_author := r.target_author_id;

  if r.target_type = 'post' then
    if p_decision = 'sensitive' then
      update public.posts set sensitive = true, is_hidden = false where id = r.target_id;
    else
      update public.posts set is_hidden = (p_decision = 'remove') where id = r.target_id;
    end if;
  elsif r.target_type = 'comment' then
    update public.comments set is_hidden = (p_decision = 'remove') where id = r.target_id;
  elsif r.target_type = 'moment' then
    if p_decision = 'remove' then
      delete from public.highlight_items hi
       where hi.storage_path in (select mi.storage_path from public.moment_items mi where mi.moment_id = r.target_id);
      delete from public.moments where id = r.target_id;
    end if;
  elsif r.target_type = 'highlight' then
    if p_decision = 'remove' then
      delete from public.highlights where id = r.target_id;
    end if;
  elsif r.target_type = 'review' then
    if p_decision = 'remove' then
      delete from public.product_reviews where id = r.target_id;
    end if;
  end if;

  update public.reports
     set status = case when p_decision = 'dismiss' then 'dismissed' else 'resolved' end,
         resolved_by = (select auth.uid()), resolved_at = now()
   where target_type = r.target_type and target_id = r.target_id and status = 'open';

  if p_decision = 'remove' then
    perform private.add_strike(v_author, r.reason, r.target_type, r.target_id);
  end if;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'report_' || p_decision, r.target_type, r.target_id::text,
          jsonb_build_object('reason', r.reason, 'author', v_author));
end;
$$;
