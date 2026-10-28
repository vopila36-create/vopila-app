-- ============================================================================
-- VOPILA — Token ve Mağaza (Aşama 5)
--  0) Güvenlik: silinen gönderi / arena girişinin puanı geri alınır (puan kasma engeli)
--  1) Adreslerim: birden fazla adres, bir varsayılan; il/ilçe/mahalle, cadde/sokak, bina, daire,
--     kurye notu. Adresi yalnızca sahibi görür (KVKK); siparişte adresin kopyası saklanır.
--  2) Sipariş: KVKK onayı zorunlu, adres siparişe sabitlenir, yalnızca "Hazırlanıyor"ken değişir;
--     kargo firması + takip no; durumlar: Hazırlanıyor → Kargoda → Teslim edildi (+ Sorunlu, İptal)
--     ve her değişiklikte bildirim. Yönetici siparişleri görür ve günceller (denetim kaydıyla).
-- ============================================================================

-- ─── 0) Puan kasma engeli ───────────────────────────────────────────────────

create or replace function private.points_off_entry()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform private.add_points(old.author_id, -10, 0); return null; end; $$;

create or replace function private.points_off_post()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  -- Gönderinin kazandırdığı keşif puanı (+5 ve aldığı beğeniler) geri alınır
  perform private.add_points(old.author_id, 0,
    -5 - (select count(*)::integer from public.likes l where l.post_id = old.id and l.user_id <> old.author_id));
  return old;
end;
$$;
revoke execute on function private.points_off_entry() from public, anon, authenticated;
revoke execute on function private.points_off_post() from public, anon, authenticated;

drop trigger if exists arena_entries_points_off on public.arena_entries;
create trigger arena_entries_points_off after delete on public.arena_entries
  for each row execute function private.points_off_entry();
-- Beğeniler gönderiyle birlikte silinmeden ÖNCE sayılsın
drop trigger if exists posts_points_off on public.posts;
create trigger posts_points_off before delete on public.posts
  for each row execute function private.points_off_post();

-- Gönderi silinirken beğenilerin tek tek düşürülmesi iki kez saymasın
create or replace function private.points_on_like()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.add_points(p.author_id, 0, 1) from public.posts p where p.id = new.post_id and p.author_id <> new.user_id;
    return null;
  end if;
  -- Gönderi silinmişse (cascade) puan zaten posts_points_off ile düşüldü
  perform private.add_points(p.author_id, 0, -1) from public.posts p where p.id = old.post_id and p.author_id <> old.user_id;
  return null;
end;
$$;

-- ─── 1) Adreslerim ──────────────────────────────────────────────────────────

create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null default 'Ev' check (char_length(btrim(title)) between 1 and 30),
  full_name     text not null check (char_length(btrim(full_name)) between 3 and 80),
  phone         text not null check (phone ~ '^05[0-9]{9}$'),
  il            text not null check (char_length(il) between 2 and 40),
  ilce          text not null check (char_length(ilce) between 2 and 40),
  mahalle       text not null check (char_length(mahalle) between 2 and 80),
  street        text not null check (char_length(btrim(street)) between 2 and 120),
  building_no   text not null check (char_length(btrim(building_no)) between 1 and 20),
  flat_no       text not null default '' check (char_length(flat_no) <= 20),
  courier_note  text not null default '' check (char_length(courier_note) <= 200),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id, created_at);
create unique index if not exists addresses_one_default_idx on public.addresses (user_id) where is_default;

alter table public.addresses enable row level security;
drop policy if exists "addresses: yalnızca sahibi" on public.addresses;
create policy "addresses: yalnızca sahibi" on public.addresses
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "aal2 gerekli" on public.addresses;
create policy "aal2 gerekli" on public.addresses as restrictive for all to authenticated
  using (private.aal_ok()) with check (private.aal_ok());
revoke all on table public.addresses from anon, authenticated;
grant select, delete on table public.addresses to authenticated;
grant insert (user_id, title, full_name, phone, il, ilce, mahalle, street, building_no, flat_no, courier_note, is_default)
  on table public.addresses to authenticated;
grant update (title, full_name, phone, il, ilce, mahalle, street, building_no, flat_no, courier_note, is_default)
  on table public.addresses to authenticated;

-- En fazla 10 adres; ilk adres varsayılan olur; yeni varsayılan seçilince eskisi kalkar
create or replace function private.addresses_before()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if (select count(*) from public.addresses a where a.user_id = new.user_id) >= 10 then
      raise exception 'too_many_addresses' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.addresses a where a.user_id = new.user_id and a.is_default) then
      new.is_default := true;
    end if;
    new.created_at := now();
  end if;
  if new.is_default and (tg_op = 'INSERT' or not old.is_default) then
    update public.addresses set is_default = false where user_id = new.user_id and is_default and id <> new.id;
  end if;
  return new;
end;
$$;
revoke execute on function private.addresses_before() from public, anon, authenticated;
drop trigger if exists addresses_before on public.addresses;
create trigger addresses_before before insert or update on public.addresses
  for each row execute function private.addresses_before();

-- Varsayılan adres silinirse en eski adres varsayılan olur
create or replace function private.addresses_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_default then
    update public.addresses set is_default = true
     where id = (select a.id from public.addresses a where a.user_id = old.user_id order by a.created_at limit 1);
  end if;
  return null;
end;
$$;
revoke execute on function private.addresses_after_delete() from public, anon, authenticated;
drop trigger if exists addresses_after_delete on public.addresses;
create trigger addresses_after_delete after delete on public.addresses
  for each row execute function private.addresses_after_delete();

-- Siparişe yazılan adres kopyası (eski ekranlarla uyum için city/district/line da var)
create or replace function private.address_snapshot(a public.addresses)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'title', a.title, 'fullName', a.full_name, 'phone', a.phone,
    'il', a.il, 'ilce', a.ilce, 'mahalle', a.mahalle, 'street', a.street,
    'building', a.building_no, 'flat', a.flat_no, 'note', a.courier_note,
    'city', a.il, 'district', a.ilce,
    'line', a.mahalle || ', ' || a.street || ' No: ' || a.building_no
            || case when a.flat_no <> '' then ' Daire: ' || a.flat_no else '' end
  );
$$;
revoke execute on function private.address_snapshot(public.addresses) from public, anon, authenticated;

-- ─── 2) Siparişler ──────────────────────────────────────────────────────────

alter table public.orders add column if not exists carrier text check (carrier is null or char_length(carrier) <= 60);
alter table public.orders add column if not exists tracking_no text check (tracking_no is null or char_length(tracking_no) <= 60);
alter table public.orders add column if not exists kvkk_consent_at timestamptz;
alter table public.orders add column if not exists status_changed_at timestamptz not null default now();
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('preparing', 'shipped', 'delivered', 'problem', 'cancelled'));

-- Yönetici tüm siparişleri ve kalemlerini görür (kargo işlemleri için)
drop policy if exists "orders: yönetici görür" on public.orders;
create policy "orders: yönetici görür" on public.orders
  for select to authenticated using (private.is_admin());
drop policy if exists "order_items: yönetici görür" on public.order_items;
create policy "order_items: yönetici görür" on public.order_items
  for select to authenticated using (private.is_admin());

-- Sipariş: kayıtlı adres + KVKK onayı. Stok, bakiye, token düşümü tek işlemde.
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

  -- Hız sınırı ve askı kontrolü (orders tablosunun tetikleyicisi de uygular)
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

  insert into public.order_items (order_id, product_id, qty, unit_price)
  select v_order, i.product_id, sum(i.qty)::integer, p.price
  from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
  join public.products p on p.id = i.product_id
  group by i.product_id, p.price;

  update public.products p
     set stock = p.stock - x.qty
    from (
      select i.product_id, sum(i.qty)::integer as qty
      from jsonb_to_recordset(p_items) as i(product_id text, qty integer)
      group by i.product_id
    ) x
   where p.id = x.product_id;

  insert into public.token_ledger (user_id, amount, reason, ref)
  values (v_uid, -v_total, 'Mağaza siparişi', 'order:' || v_order::text);

  insert into public.notifications (user_id, kind, text, href)
  values (v_uid, 'order', 'Siparişin alındı, hazırlanıyor. Kargoya verilince haber vereceğiz.', '/siparisler');

  return v_order;
end;
$$;
revoke execute on function private.place_order_v2(jsonb, uuid, boolean) from public, anon;
grant execute on function private.place_order_v2(jsonb, uuid, boolean) to authenticated;

-- Eski (adres metni alan, KVKK onaysız) sipariş fonksiyonu kaldırılır
drop function if exists public.place_order(jsonb, jsonb);
drop function if exists private.place_order(jsonb, jsonb);

create or replace function public.place_order(p_items jsonb, p_address_id uuid, p_consent boolean)
returns uuid language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); return private.place_order_v2(p_items, p_address_id, p_consent); end; $$;
revoke execute on function public.place_order(jsonb, uuid, boolean) from public, anon;
grant execute on function public.place_order(jsonb, uuid, boolean) to authenticated;

-- Teslimat adresini değiştir: yalnızca sipariş sahibi ve yalnızca "Hazırlanıyor"ken
create or replace function private.change_order_address(p_order uuid, p_address_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_addr public.addresses%rowtype;
begin
  select * into v_addr from public.addresses a where a.id = p_address_id and a.user_id = v_uid;
  if not found then
    raise exception 'invalid_address' using errcode = 'P0001';
  end if;
  update public.orders set address = private.address_snapshot(v_addr)
   where id = p_order and user_id = v_uid and status = 'preparing';
  if not found then
    raise exception 'order_locked' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function private.change_order_address(uuid, uuid) from public, anon;
grant execute on function private.change_order_address(uuid, uuid) to authenticated;

create or replace function public.change_order_address(p_order uuid, p_address_id uuid)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.change_order_address(p_order, p_address_id); end; $$;
revoke execute on function public.change_order_address(uuid, uuid) from public, anon;
grant execute on function public.change_order_address(uuid, uuid) to authenticated;

-- Yönetici: durum, kargo firması, takip numarası (yönetici paneli bunu çağıracak)
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
  if p_status = 'shipped' and coalesce(nullif(btrim(p_tracking), ''), v_old.tracking_no) is null then
    raise exception 'tracking_required' using errcode = 'P0001';
  end if;

  update public.orders
     set status = p_status,
         carrier = coalesce(nullif(btrim(p_carrier), ''), carrier),
         tracking_no = coalesce(nullif(btrim(p_tracking), ''), tracking_no),
         status_changed_at = case when p_status <> v_old.status then now() else status_changed_at end
   where id = p_order;

  -- İptalde tokenler iade edilir (bir kez)
  if p_status = 'cancelled' and v_old.status <> 'cancelled' then
    insert into public.token_ledger (user_id, amount, reason, ref)
    values (v_old.user_id, v_old.total, 'Sipariş iptali iadesi', 'refund:' || p_order::text)
    on conflict (ref) do nothing;
    -- Stok geri eklenir
    update public.products p set stock = p.stock + oi.qty
      from public.order_items oi where oi.order_id = p_order and oi.product_id = p.id;
  end if;

  insert into private.audit_log (actor_id, action, target_type, target_id, details)
  values ((select auth.uid()), 'order_update', 'order', p_order::text,
          jsonb_build_object('from', v_old.status, 'to', p_status, 'carrier', p_carrier, 'tracking', p_tracking));
end;
$$;
revoke execute on function private.admin_update_order(uuid, text, text, text) from public, anon;
grant execute on function private.admin_update_order(uuid, text, text, text) to authenticated;

create or replace function public.admin_update_order(p_order uuid, p_status text, p_carrier text default null, p_tracking text default null)
returns void language plpgsql security invoker set search_path = ''
as $$ begin perform private.require_aal(); perform private.admin_update_order(p_order, p_status, p_carrier, p_tracking); end; $$;
revoke execute on function public.admin_update_order(uuid, text, text, text) from public, anon;
grant execute on function public.admin_update_order(uuid, text, text, text) to authenticated;

-- Durum değişince müşteriye bildirim
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
        when 'delivered' then 'Siparişin teslim edildi. İyi günlerde kullan!'
        when 'problem' then 'Siparişinle ilgili bir sorun var. Ekibimiz seninle iletişime geçecek.'
        when 'cancelled' then 'Siparişin iptal edildi; tokenlerin cüzdanına iade edildi.'
        else 'Siparişin yeniden hazırlanıyor.'
      end,
      '/siparisler');
  end if;
  return null;
end;
$$;
revoke execute on function private.notify_order_status() from public, anon, authenticated;
drop trigger if exists orders_notify_status on public.orders;
create trigger orders_notify_status after update of status on public.orders
  for each row execute function private.notify_order_status();
