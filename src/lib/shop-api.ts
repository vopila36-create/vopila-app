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
  items: { productId: string; qty: number; price: number; name?: string; image?: string }[];
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
  if (msg.includes('order_locked')) return 'Sipariş kargoya verildiği için artık değiştirilemez ya da iptal edilemez.';
  if (msg.includes('not_verified_buyer')) return 'Yalnızca teslim aldığın ürünleri değerlendirebilirsin.';
  if (msg.includes('invalid_rating')) return '1 ile 5 arasında yıldız seç.';
  if (msg.includes('not_delivered')) return 'İade talebi yalnızca teslim edilmiş siparişler için açılabilir.';
  if (msg.includes('return_window_closed')) return 'İade süresi doldu (teslimden sonra 14 gün).';
  if (msg.includes('return_exists')) return 'Bu sipariş için zaten bir iade talebin var.';
  if (msg.includes('too_many_addresses')) return 'En fazla 10 adres kaydedebilirsin.';
  if (msg.includes('addresses_phone_check') || msg.includes('phone'))
    return 'Telefon numarası 05 ile başlayan 11 haneli bir cep telefonu olmalı.';
  return toTurkish(err);
}

const dateTr = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });

// ─── Ürünler ve cüzdan ──────────────────────────────────────────────────────

export async function fetchProducts(): Promise<Product[] | null> {
  const [{ data, error }, ratings] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, category, price, image_url, images, description, stock, sold_count, created_at')
      .order('price', { ascending: true }),
    supabase.from('product_ratings').select('product_id, average, count'),
  ]);
  if (error) return null;
  const rate = new Map(
    (ratings.data ?? []).map((r) => [r.product_id as string, { average: Number(r.average), count: r.count as number }]),
  );
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as Product['category'],
    price: p.price,
    image: p.image_url ?? p.images?.[0] ?? '',
    images: (p.images ?? []).length ? p.images : p.image_url ? [p.image_url] : [],
    description: p.description,
    stock: p.stock,
    soldCount: p.sold_count ?? 0,
    rating: rate.get(p.id),
    createdAt: p.created_at,
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
    .select('id, total, status, carrier, tracking_no, address, created_at, order_items(product_id, qty, unit_price, name, image_url)')
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
    items: (o.order_items ?? []).map((i: any) => ({
      productId: i.product_id,
      qty: i.qty,
      price: i.unit_price,
      name: i.name ?? undefined,
      image: i.image_url ?? undefined,
    })),
  }));
}

export async function changeOrderAddress(orderId: string, addressId: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('change_order_address', { p_order: orderId, p_address_id: addressId });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

// ─── Favoriler (Trendyol/Amazon'daki gibi) ──────────────────────────────────

export async function fetchFavorites(myId: string): Promise<string[]> {
  const { data } = await supabase
    .from('favorites')
    .select('product_id')
    .eq('user_id', myId)
    .order('created_at', { ascending: false });
  return (data ?? []).map((r) => r.product_id as string);
}

export async function setFavorite(myId: string, productId: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('favorites').upsert({ user_id: myId, product_id: productId }, { ignoreDuplicates: true })
    : await supabase.from('favorites').delete().eq('user_id', myId).eq('product_id', productId);
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

// ─── Doğrulanmış alıcı yorumları ────────────────────────────────────────────

export type Review = {
  id: string;
  userId: string;
  name: string;
  username: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
};

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('product_reviews')
    .select('id, user_id, rating, text, created_at, user:profiles(name, username, avatar_url)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    // Profili gizli (18 altı vb.) olan alıcının adı gösterilmez
    name: r.user?.name ?? 'VOPILA kullanıcısı',
    username: r.user?.username ?? '',
    avatar: r.user?.avatar_url ?? '',
    rating: r.rating,
    text: r.text,
    date: dateTr(r.created_at),
  }));
}

export async function reviewProduct(orderId: string, productId: string, rating: number, text: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('review_product', {
    p_order: orderId,
    p_product: productId,
    p_rating: rating,
    p_text: text,
  });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

export async function deleteReview(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('product_reviews').delete().eq('id', id);
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

// ─── Sipariş detayı: zaman çizelgesi, iptal, iade ───────────────────────────

export type OrderEvent = { status: OrderStatusKey; at: string };
export type ReturnRequest = {
  id: string;
  status: 'requested' | 'approved' | 'rejected';
  reason: string;
  adminNote: string | null;
  date: string;
};

export async function fetchOrderExtras(
  orderId: string,
  myId: string,
): Promise<{ history: OrderEvent[]; ret: ReturnRequest | null; reviewed: Record<string, number> }> {
  const [h, r, rv] = await Promise.all([
    supabase.from('order_status_history').select('status, at').eq('order_id', orderId).order('at'),
    supabase.from('return_requests').select('id, status, reason, admin_note, created_at').eq('order_id', orderId).maybeSingle(),
    // Sipariş numarası başkalarına açık değil; kendi değerlendirmelerim ayrı fonksiyonla (0034b)
    supabase.rpc('my_order_reviews', { p_order: orderId }),
  ]);
  return {
    history: (h.data ?? []).map((x) => ({ status: x.status as OrderStatusKey, at: x.at as string })),
    ret: r.data
      ? {
          id: r.data.id,
          status: r.data.status,
          reason: r.data.reason,
          adminNote: r.data.admin_note,
          date: dateTr(r.data.created_at),
        }
      : null,
    reviewed: Object.fromEntries(((rv.data ?? []) as { product_id: string; rating: number }[]).map((x) => [x.product_id, x.rating])),
  };
}

export async function cancelMyOrder(orderId: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('cancel_my_order', { p_order: orderId });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

export async function requestReturn(orderId: string, reason: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('request_return', { p_order: orderId, p_reason: reason });
  if (error) return { ok: false, error: shopError(error) };
  return { ok: true, data: undefined };
}

/** Kargo firmasının takip sayfası (bilinen firmalar için). */
export function trackingUrl(carrier: string | null, no: string | null): string | null {
  if (!carrier || !no) return null;
  const c = carrier.toLocaleLowerCase('tr-TR');
  const n = encodeURIComponent(no);
  if (c.includes('yurtiçi') || c.includes('yurtici')) return `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${n}`;
  if (c.includes('aras')) return `https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${n}`;
  if (c.includes('mng')) return `https://www.mngkargo.com.tr/gonderi-takip?code=${n}`;
  if (c.includes('ptt')) return `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${n}`;
  if (c.includes('sürat') || c.includes('surat')) return `https://www.suratkargo.com.tr/KargoTakip/?kargotakipno=${n}`;
  if (c.includes('ups')) return `https://www.ups.com/track?tracknum=${n}`;
  return null;
}

/** Tahmini teslim metni (Trendyol/Amazon'daki gibi; hafta sonları sayılmaz). */
export function deliveryEstimate(status: OrderStatusKey, shippedAt?: string | null): string | null {
  const fmt = (d: Date) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
  const addBusiness = (from: Date, days: number) => {
    const d = new Date(from);
    while (days > 0) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) days--;
    }
    return d;
  };
  if (status === 'preparing') return `Tahmini teslim: ${fmt(addBusiness(new Date(), 3))} – ${fmt(addBusiness(new Date(), 5))}`;
  if (status === 'shipped') {
    const base = shippedAt ? new Date(shippedAt) : new Date();
    return `Tahmini teslim: ${fmt(addBusiness(base, 1))} – ${fmt(addBusiness(base, 3))}`;
  }
  return null;
}
