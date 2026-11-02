-- Mağaza: token bakiyesi, stok, sipariş gizliliği, iptal ve iade
do $$
declare
  u uuid; v uuid; pid text; ad uuid; ad_v uuid; o uuid; bal int; stk int;
  items1 jsonb; items2 jsonb;
begin
  u := pg_temp.new_user('alici');
  v := pg_temp.new_user('komsu');

  perform pg_temp.act_admin();
  pid := 'test-' || substr(md5(random()::text), 1, 10);
  insert into public.products (id, name, category, price, stock, active)
  values (pid, 'Test ürünü', 'Spor', 100, 2, true);
  insert into public.token_ledger (user_id, amount, reason) values (u, 150, 'test yüklemesi');
  items1 := jsonb_build_array(jsonb_build_object('product_id', pid, 'qty', 1));
  items2 := jsonb_build_array(jsonb_build_object('product_id', pid, 'qty', 2));

  -- Kullanıcı kendine token yazamaz, ürün fiyatını/stoğunu değiştiremez
  perform pg_temp.act_as(u);
  perform pg_temp.fails(format('insert into public.token_ledger (user_id, amount, reason) values (%L, 1000000, %L)', u, 'hile'),
                        'kullanıcı kendine token yazamamalı');
  perform pg_temp.denied(format('update public.products set price = 1, stock = 999 where id = %L', pid),
                         'kullanıcı ürün fiyatını değiştirememeli');

  insert into public.addresses (user_id, title, full_name, phone, il, ilce, mahalle, street, building_no)
  values (u, 'Ev', 'Test Alıcı', '05001112233', 'İstanbul', 'Kadıköy', 'Moda', 'Test Sokak', '1')
  returning id into ad;

  -- Kurallar: onay şart, bakiye yetmeli, stok yetmeli
  perform pg_temp.fails(format('select public.place_order(%L::jsonb, %L, false)', items1, ad),
                        'onaysız sipariş reddedilmeli', 'consent_required');
  perform pg_temp.fails(format('select public.place_order(%L::jsonb, %L, true)', items2, ad),
                        'bakiye yetmezse sipariş reddedilmeli', 'insufficient_balance');
  o := public.place_order(items1, ad, true);
  select coalesce(sum(amount), 0) into bal from public.token_ledger where user_id = u;
  perform pg_temp.ok(bal = 50, 'sipariş sonrası bakiye 50 olmalı (şu an ' || bal || ')');
  perform pg_temp.fails(format('select public.place_order(%L::jsonb, %L, true)', items2, ad),
                        'stok yetmezse sipariş reddedilmeli', 'out_of_stock');

  -- Kullanıcı sipariş durumunu kendisi değiştiremez
  perform pg_temp.denied(format('update public.orders set status = %L where id = %L', 'delivered', o),
                         'kullanıcı sipariş durumunu değiştirememeli');
  perform pg_temp.fails(format('select public.admin_update_order(%L, %L)', o, 'shipped'),
                        'yönetici olmayan sipariş yönetememeli');

  -- Başka kullanıcı siparişi göremez, iptal edemez, başkasının adresini kullanamaz
  perform pg_temp.act_as(v);
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.orders where id = %L', o)) = 0,
                     'başkasının siparişi görünmemeli');
  perform pg_temp.ok(pg_temp.rows(format('select 1 from public.addresses where id = %L', ad)) = 0,
                     'başkasının adresi görünmemeli');
  perform pg_temp.fails(format('select public.cancel_my_order(%L)', o), 'başkasının siparişi iptal edilememeli');
  perform pg_temp.act_admin();
  insert into public.token_ledger (user_id, amount, reason) values (v, 500, 'test yüklemesi');
  perform pg_temp.act_as(v);
  perform pg_temp.fails(format('select public.place_order(%L::jsonb, %L, true)', items1, ad),
                        'başkasının adresiyle sipariş verilememeli', 'invalid_address');

  -- İptal: token ve stok geri gelir; ikinci kez iptal edilemez
  perform pg_temp.act_as(u);
  perform public.cancel_my_order(o);
  select coalesce(sum(amount), 0) into bal from public.token_ledger where user_id = u;
  perform pg_temp.ok(bal = 150, 'iptal sonrası token iade edilmeli (şu an ' || bal || ')');
  perform pg_temp.act_admin();
  select stock into stk from public.products where id = pid;
  perform pg_temp.ok(stk = 2, 'iptal sonrası stok geri gelmeli (şu an ' || stk || ')');
  perform pg_temp.act_as(u);
  perform pg_temp.fails(format('select public.cancel_my_order(%L)', o), 'iptal edilmiş sipariş yeniden iptal edilememeli');

  -- Teslim edilmemiş siparişe yorum ve iade talebi olmaz
  perform pg_temp.fails(format('select public.review_product(%L, %L, 5, %L)', o, pid, 'harika'),
                        'teslim edilmemiş siparişe yorum yapılamamalı');
  perform pg_temp.fails(format('select public.request_return(%L, %L)', o, 'beğenmedim'),
                        'teslim edilmemiş siparişe iade talebi açılamamalı');
end $$;
