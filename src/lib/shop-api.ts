/**
 * Mağaza ve cüzdan (gerçek): ürünler, token hareketleri, adreslerim, sipariş verme, siparişlerim,
 * siparişin adresini değiştirme. Kurallar sunucuda (0014_shop.sql).
 */
import type { Product } from '@/data/mock';
import type { ApiResult } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type SavedAddress = {
  id: string;
  title: string;
  fullName: string;
  phone: string;
  il: string;
  ilce: string;
  mahalle: string;
  street: string;
  buildingNo: string;
  flatNo: string;
  courierNote: string;
  isDefault: boolean;
};

export type AddressInput = Omit<SavedAddress, 'id' | 'isDefault'> & { isDefault?: boolean };

export type OrderStatusKey = 'preparing' | 'shipped' | 'delivered' | 'problem' | 'cancelled';

export type RemoteOrder = {
  id: string;
  shortId: string;
  total: number;
  status: OrderStatusKey;
  carrier: string | null;
  trackingNo: string | null;
  date: string;
  address: {
    title?: string;
    fullName: string;
    phone: string;
    il?: string;
    ilce?: string;
    mahalle?: string;
    street?: string;
    building?: string;
    flat?: string;
    note?: string;
    city: string;
    district: string;
    line: string;
  };
  items: { productId: string; qty: number; price: number }[];
};

export type LedgerRow = { id: string; amount: number; reason: string; date: string };

/** Mağaza / sipariş hatalarını sade Türkçeye çevirir. */
export function shopError(err: { message?: string; code?: string } | null | undefined) {
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('consent_required')) return 'Devam etmek için kişisel verilerin işlenmesine onay vermelisin.';
  if (msg.includes('invalid_address')) return 'Teslimat adresi bulunamadı. Adresini kontrol et.';
  if (msg.includes('insufficient_balance')) return 'Token bakiyen yetersiz.';
  if (msg.includes('out_of_stock')) return 'Sepetindeki bir ürünün stoğu tükendi. Sepetini güncelle.';
  if (msg.includes('unknown_product')) return 'Sepetindeki bir ürün artık satışta değil.';
  if (msg.includes('invalid_quantity')) return 'Bir üründen en fazla 20 adet alabilirsin.';
  if (msg.includes('empty_cart')) return 'Sepetin boş.';
  if (msg.includes('order_locked')) return 'Sipariş kargoya verildiği için adres artık değiştirilemez.';
  if (msg.includes('too_many_addresses')) return 'En fazla 10 adres kaydedebilirsin.';
  if (msg.includes('addresses_phone_check') || msg.includes('phone'))
    return 'Telefon numarası 05 ile başlayan 11 haneli bir cep telefonu olmalı.';
  return toTurkish(err);
}

const dateTr = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Ürünler ve cüzdan ──────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[] | null> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price, image_url, description, stock')
    .order('price', { ascending: true });
  if (error) return null;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as Product['category'],
    price: p.price,
    image: p.image_url ?? '',
    description: p.description,
    stock: p.stock,
  }));
}

export async function fetchLedger(myId: string): Promise<LedgerRow[]> {
  const { data } = await supabase
    .from('token_ledger')
    .select('id, amount, reason, created_at')
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(200);
  return (data ?? []).map((l) => ({ id: String(l.id), amount: l.amount, reason: l.reason, date: dateTr(l.created_at) }));
}

// ─── Adreslerim ─────────────────────────────────────────────────────────────

const toAddress = (a: any): SavedAddress => ({
  id: a.id,
  title: a.title,
  fullName: a.full_name,
  phone: a.phone,
  il: a.il,
  ilce: a.ilce,
  mahalle: a.mahalle,
  street: a.street,
  buildingNo: a.building_no,
  flatNo: a.flat_no,
  courierNote: a.courier_note,
  isDefault: a.is_default,
});

const toRow = (a: AddressInput) => ({
  title: a.title.trim() || 'Ev',
  full_name: a.fullName.trim(),
  phone: a.phone.replace(/\D/g, '').replace(/^90/, '').replace(/^5/, '05'),
  il: a.il,
  ilce: a.ilce,
  mahalle: a.mahalle,
  street: a.street.trim(),
  building_no: a.buildingNo.trim(),
  flat_no: a.flatNo.trim(),
  courier_note: a.courierNote.trim(),
  ...(a.isDefault ? { is_default: true } : {}),
});

export async function fetchAddresses(myId: string): Promise<SavedAddress[]> {
  const { data } = await supabase.from('addresses').select('*').eq('user_id', myId).order('created_at');
  return (data ?? []).map(toAddress);
}

export async function saveAddress(myId: string, input: AddressInput, id?: string): Promise<ApiResult<SavedAddress>> {
  const row = toRow(input);
  const { data, error } = id
    ? await supabase.from('addresses').update(row).eq('id', id).select('*').single()
    : await supabase.from('addresses').insert({ ...row, user_id: myId }).select('*').single();
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: toAddress(data) };
}

export async function deleteAddress(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

export async function setDefaultAddress(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('addresses').update({ is_default: true }).eq('id', id);
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

/** Adresin tek satırlık özeti. */
export const addressLine = (a: Pick<SavedAddress, 'mahalle' | 'street' | 'buildingNo' | 'flatNo' | 'ilce' | 'il'>) =>
  `${a.mahalle}, ${a.street} No: ${a.buildingNo}${a.flatNo ? ` Daire: ${a.flatNo}` : ''}, ${a.ilce}/${a.il}`;

// ─── Siparişler ─────────────────────────────────────────────────────────────

export async function placeOrder(
  items: { productId: string; qty: number }[],
  addressId: string,
  consent: boolean,
): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('place_order', {
    p_items: items.map((i) => ({ product_id: i.productId, qty: i.qty })),
    p_address_id: addressId,
    p_consent: consent,
  });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: data as string };
}

export async function fetchOrders(myId: string): Promise<RemoteOrder[]> {
  const { data } = await supabase
    .from('orders')
    .select('id, total, status, carrier, tracking_no, address, created_at, order_items(product_id, qty, unit_price)')
    .eq('user_id', myId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((o: any) => ({
    id: o.id,
    shortId: String(o.id).slice(0, 8).toUpperCase(),
    total: o.total,
    status: o.status,
    carrier: o.carrier,
    trackingNo: o.tracking_no,
    date: dateTr(o.created_at),
    address: o.address,
    items: (o.order_items ?? []).map((i: any) => ({ productId: i.product_id, qty: i.qty, price: i.unit_price })),
  }));
}

export async function changeOrderAddress(orderId: string, addressId: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('change_order_address', { p_order: orderId, p_address_id: addressId });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}
