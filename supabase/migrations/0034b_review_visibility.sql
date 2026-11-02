-- ============================================================================
-- VOPILA — 0034 düzeltmesi (güvenlik incelemesi): ürün yorumları da hesap görünürlüğüne uysun.
--  * Yorum yalnızca yazarını görebilene görünür (engel, 18 altı koruması, askı — can_view_user).
--  * Sipariş numarası (order_id) başkalarına hiç açılmaz: sütun izni kaldırılır; kişi kendi siparişindeki
--    değerlendirmelerini my_order_reviews ile alır.
-- ============================================================================
drop policy if exists "product_reviews: görünürlük" on public.product_reviews;
create policy "product_reviews: görünürlük" on public.product_reviews as restrictive for select to authenticated
  using (user_id = (select auth.uid()) or private.can_view_user(user_id));

revoke select on public.product_reviews from authenticated;
grant select (id, product_id, user_id, rating, text, created_at) on public.product_reviews to authenticated;

create or replace function private.my_order_reviews(p_order uuid)
returns table (product_id text, rating smallint)
language sql stable security definer set search_path = ''
as $$
  select r.product_id, r.rating from public.product_reviews r
   where r.order_id = p_order and r.user_id = (select auth.uid());
$$;
revoke execute on function private.my_order_reviews(uuid) from public, anon;
grant execute on function private.my_order_reviews(uuid) to authenticated;

create or replace function public.my_order_reviews(p_order uuid)
returns table (product_id text, rating smallint)
language plpgsql stable security invoker set search_path = ''
as $$
begin
  perform private.require_aal();
  return query select * from private.my_order_reviews(p_order);
end;
$$;
revoke execute on function public.my_order_reviews(uuid) from public, anon;
grant execute on function public.my_order_reviews(uuid) to authenticated;
