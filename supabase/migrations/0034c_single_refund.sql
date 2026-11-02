-- ============================================================================
-- VOPILA — 0034 düzeltmesi (güvenlik incelemesi): bir sipariş için token en fazla bir kez iade edilir.
-- İptal iadesi ('refund:') ile iade onayı ('return:') ayrı anahtarlar kullandığı için, iadesi onaylanmış
-- bir sipariş sonradan iptal edilirse (ya da tersi) iki kez ödeme yapılabiliyordu.
-- ============================================================================
create or replace function private.order_refunded(p_order uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.token_ledger l
     where l.ref in ('refund:' || p_order::text, 'return:' || p_order::text)
  );
$$;
revoke execute on function private.order_refunded(uuid) from public, anon, authenticated;

create or replace function private.refund_cancelled_order(p_order uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order for update;
  -- Daha önce iade (onaylı iade talebi ya da önceki iptal) yapıldıysa ikinci kez ödenmez
  if private.order_refunded(p_order) then
    return;
  end if;
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
  -- Sipariş kilitlenir; iptal edilmiş ya da zaten iade edilmişse onaylanamaz
  select total into v_total from public.orders where id = r.order_id for update;
  if p_approve and (private.order_refunded(r.order_id)
                    or exists (select 1 from public.orders where id = r.order_id and status = 'cancelled')) then
    raise exception 'already_refunded' using errcode = 'P0001';
  end if;
  update public.return_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         admin_note = nullif(left(btrim(coalesce(p_note, '')), 300), ''),
         resolved_at = now()
   where id = p_id;
  if p_approve then
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
