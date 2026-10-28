/**
 * Yönetici paneli işlemleri. Hepsi sunucuda yönetici + iki adımlı doğrulama (aal2) ister
 * ve denetim kaydına yazılır (0015_admin.sql). Normal kullanıcı çağırırsa sunucu reddeder.
 */
import type { NewsArticle, Product } from '@/data/mock';
import { AUTHOR, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import type { OrderStatusKey, RemoteOrder } from '@/lib/shop-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

const err = (e: { message?: string; code?: string }) => {
  const m = (e.message ?? '').toLowerCase();
  if (m.includes('not_allowed')) return 'Bu işlem için yönetici ve iki adımlı doğrulama gerekli.';
  if (m.includes('tracking_required')) return 'Kargoya verirken takip numarası gir.';
  if (m.includes('invalid_prizes')) return 'Üç ödül de 0’dan büyük olmalı.';
  if (m.includes('invalid_image') || m.includes('invalid_url')) return 'Bağlantı https:// ile başlamalı.';
  if (m.includes('invalid_title')) return 'Başlık en az 5 karakter olmalı.';
  if (m.includes('invalid_name')) return 'Ürün adı gerekli.';
  return toTurkish(e);
};
const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data });

export type AdminStatus = 'none' | 'needs_2fa' | 'ok';

export async function fetchAdminStatus(): Promise<AdminStatus> {
  const { data } = await supabase.rpc('admin_status');
  return (data as AdminStatus) ?? 'none';
}

export type Overview = Record<
  'users' | 'users_today' | 'posts_today' | 'open_reports' | 'pending_rewards' | 'orders_preparing' | 'orders_problem' | 'open_tickets' | 'suspended',
  number
>;

export async function fetchOverview(): Promise<ApiResult<Overview>> {
  const { data, error } = await supabase.rpc('admin_overview');
  if (error) return { ok: false, error: err(error) };
  return ok(data as Overview);
}

// ─── Siparişler ─────────────────────────────────────────────────────────────

export type AdminOrder = RemoteOrder & { userName: string; username: string };

export async function fetchAllOrders(status?: OrderStatusKey): Promise<ApiResult<AdminOrder[]>> {
  let q = supabase
    .from('orders')
    .select(
      `id, total, status, carrier, tracking_no, address, created_at, order_items(product_id, qty, unit_price), user:profiles!orders_user_id_fkey(${AUTHOR})`,
    )
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((o: any) => {
      const u = (Array.isArray(o.user) ? o.user[0] : o.user) as DbAuthor | null;
      return {
        id: o.id,
        shortId: String(o.id).slice(0, 8).toUpperCase(),
        total: o.total,
        status: o.status,
        carrier: o.carrier,
        trackingNo: o.tracking_no,
        date: new Date(o.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        address: o.address,
        items: (o.order_items ?? []).map((i: any) => ({ productId: i.product_id, qty: i.qty, price: i.unit_price })),
        userName: u?.name ?? '—',
        username: u?.username ?? '',
      };
    }),
  );
}

export async function updateOrder(id: string, status: OrderStatusKey, carrier?: string, tracking?: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_update_order', {
    p_order: id,
    p_status: status,
    p_carrier: carrier ?? null,
    p_tracking: tracking ?? null,
  });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

// ─── Ürünler ────────────────────────────────────────────────────────────────

export type AdminProduct = Product & { active: boolean };

export async function fetchAllProducts(): Promise<ApiResult<AdminProduct[]>> {
  const { data, error } = await supabase
    .from('products')
    .select('id, name, category, price, image_url, description, stock, active')
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      image: p.image_url ?? '',
      description: p.description,
      stock: p.stock,
      active: p.active,
    })),
  );
}

export async function saveProduct(p: Omit<AdminProduct, 'id'> & { id?: string }): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('admin_upsert_product', {
    p_id: p.id ?? null,
    p_name: p.name,
    p_category: p.category,
    p_price: p.price,
    p_stock: p.stock,
    p_description: p.description,
    p_image_url: p.image || null,
    p_active: p.active,
  });
  if (error) return { ok: false, error: err(error) };
  return ok(data as string);
}

/** Ürün görselini herkese açık "catalog" kovasına yükler, adresini döner. */
export async function uploadCatalogImage(uri: string, mimeType = 'image/jpeg'): Promise<ApiResult<string>> {
  const ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
  const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('catalog').upload(path, body, { contentType: mimeType });
  if (error) return { ok: false, error: err(error) };
  return ok(supabase.storage.from('catalog').getPublicUrl(path).data.publicUrl);
}

// ─── Haberler ve arenalar ───────────────────────────────────────────────────

export async function fetchAllNews(): Promise<ApiResult<NewsArticle[]>> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(200);
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((n: any) => ({
      id: n.id,
      category: n.category,
      title: n.title,
      summary: n.summary,
      body: n.body ?? [],
      aiSummary: n.ai_summary ?? [],
      image: n.image_url ?? '',
      video: n.video_url ?? undefined,
      readTime: n.read_time,
      time: new Date(n.published_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      live: n.is_live,
      special: n.is_special,
    })),
  );
}

export async function saveNews(n: Partial<NewsArticle> & Pick<NewsArticle, 'title' | 'category'>): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('admin_upsert_news', {
    p_id: n.id ?? null,
    p_category: n.category,
    p_title: n.title,
    p_summary: n.summary ?? '',
    p_body: n.body ?? [],
    p_ai_summary: n.aiSummary ?? [],
    p_image_url: n.image || null,
    p_video_url: n.video || null,
    p_read_time: n.readTime ?? '',
    p_is_live: !!n.live,
    p_is_special: !!n.special,
  });
  if (error) return { ok: false, error: err(error) };
  return ok(data as string);
}

export async function deleteNews(id: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_delete_news', { p_id: id });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

export type DbArena = { key: string; name: string; tagline: string; description: string; image: string; prizes: number[] };

export async function fetchArenasDb(): Promise<ApiResult<DbArena[]>> {
  const { data, error } = await supabase.from('arenas').select('key, name, tagline, description, image_url, prizes').order('sort_order');
  if (error) return { ok: false, error: err(error) };
  return ok((data ?? []).map((a) => ({ ...a, image: a.image_url ?? '' })) as DbArena[]);
}

export async function saveArena(a: DbArena): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_update_arena', {
    p_key: a.key,
    p_name: a.name,
    p_tagline: a.tagline,
    p_description: a.description,
    p_image_url: a.image || null,
    p_prizes: a.prizes,
  });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

// ─── Şikayetler ─────────────────────────────────────────────────────────────

export type ReportGroup = {
  key: string;
  firstReportId: string;
  targetType: 'post' | 'comment' | 'user' | 'moment' | 'live' | 'highlight';
  targetId: string;
  count: number;
  reasons: Record<string, number>;
  details: string[];
  lastAt: string;
  preview: { text: string; authorId?: string; authorName?: string; hidden?: boolean } | null;
};

export async function fetchOpenReports(): Promise<ApiResult<ReportGroup[]>> {
  const { data, error } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, details, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) return { ok: false, error: err(error) };
  const groups = new Map<string, ReportGroup>();
  for (const r of data ?? []) {
    const key = `${r.target_type}:${r.target_id}`;
    const g =
      groups.get(key) ??
      ({
        key,
        firstReportId: r.id,
        targetType: r.target_type,
        targetId: r.target_id,
        count: 0,
        reasons: {},
        details: [],
        lastAt: r.created_at,
        preview: null,
      } as ReportGroup);
    g.count++;
    g.reasons[r.reason] = (g.reasons[r.reason] ?? 0) + 1;
    if (r.details) g.details.push(r.details);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort((a, b) => b.count - a.count);

  // Şikayet edilen içeriğin önizlemesi
  const ids = (t: string) => list.filter((g) => g.targetType === t).map((g) => g.targetId);
  const [posts, comments, users] = await Promise.all([
    ids('post').length
      ? supabase.from('posts').select(`id, caption, is_hidden, author:profiles!posts_author_id_fkey(${AUTHOR})`).in('id', ids('post'))
      : Promise.resolve({ data: [] as any[] }),
    ids('comment').length
      ? supabase.from('comments').select(`id, text, is_hidden, author:profiles!comments_author_id_fkey(${AUTHOR})`).in('id', ids('comment'))
      : Promise.resolve({ data: [] as any[] }),
    ids('user').length ? supabase.from('profiles').select(`${AUTHOR}, bio`).in('id', ids('user')) : Promise.resolve({ data: [] as any[] }),
  ]);
  const author = (a: any) => (Array.isArray(a) ? a[0] : a) as DbAuthor | null;
  for (const g of list) {
    if (g.targetType === 'post') {
      const p = (posts.data ?? []).find((x: any) => x.id === g.targetId);
      if (p) g.preview = { text: p.caption, authorId: author(p.author)?.id, authorName: author(p.author)?.name, hidden: p.is_hidden };
    } else if (g.targetType === 'comment') {
      const c = (comments.data ?? []).find((x: any) => x.id === g.targetId);
      if (c) g.preview = { text: c.text, authorId: author(c.author)?.id, authorName: author(c.author)?.name, hidden: c.is_hidden };
    } else if (g.targetType === 'user') {
      const u = (users.data ?? []).find((x: any) => x.id === g.targetId);
      if (u) g.preview = { text: u.bio || `@${u.username}`, authorId: u.id, authorName: u.name };
    }
  }
  return ok(list);
}

export async function resolveReport(reportId: string, decision: 'remove' | 'dismiss' | 'sensitive'): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_report: reportId, p_decision: decision });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

// ─── Kullanıcılar ───────────────────────────────────────────────────────────

export type AdminUser = ReturnType<typeof toUser> & { status: 'active' | 'suspended' | 'banned'; createdAt: string };

export async function searchUsers(q: string, onlyRestricted = false): Promise<ApiResult<AdminUser[]>> {
  let req = supabase.from('profiles').select(`${AUTHOR}, status, created_at`).order('created_at', { ascending: false }).limit(50);
  const term = q.trim().replace(/[%_,()]/g, '');
  if (term) req = req.or(`username.ilike.%${term}%,name.ilike.%${term}%`);
  if (onlyRestricted) req = req.neq('status', 'active');
  const { data, error } = await req;
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((u: any) => ({
      ...toUser(u),
      status: u.status,
      createdAt: new Date(u.created_at).toLocaleDateString('tr-TR'),
    })),
  );
}

export async function setUserStatus(id: string, status: 'active' | 'suspended' | 'banned', reason: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_set_user_status', { p_user: id, p_status: status, p_reason: reason });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

/** Hesaba (resmî) kullanıcı adı ve ad verir; "VOPILA" içeren adlar yalnızca bununla verilebilir. */
export async function setIdentity(id: string, username: string, name: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_set_identity', { p_user: id, p_username: username, p_name: name });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

// ─── Bekleyen ödüller ───────────────────────────────────────────────────────

export type AdminReward = {
  id: string;
  userId: string;
  userName: string;
  username: string;
  amount: number;
  reason: string;
  flags: { kind: string; share?: number; same_day?: number; in_one_hour?: number }[];
  date: string;
};

export async function fetchPendingRewards(): Promise<ApiResult<AdminReward[]>> {
  const { data, error } = await supabase
    .from('pending_rewards')
    .select(`id, user_id, amount, reason, flags, created_at, user:profiles!pending_rewards_user_id_fkey(${AUTHOR})`)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((r: any) => {
      const u = (Array.isArray(r.user) ? r.user[0] : r.user) as DbAuthor | null;
      return {
        id: r.id,
        userId: r.user_id,
        userName: u?.name ?? '—',
        username: u?.username ?? '',
        amount: r.amount,
        reason: r.reason,
        flags: r.flags ?? [],
        date: new Date(r.created_at).toLocaleDateString('tr-TR'),
      };
    }),
  );
}

export async function reviewReward(id: string, approve: boolean, note: string): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_review_reward', { p_reward: id, p_approve: approve, p_note: note || null });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

// ─── Destek ve denetim kaydı ────────────────────────────────────────────────

export type AdminTicket = {
  id: string;
  userId: string;
  userName: string;
  username: string;
  topic: string;
  message: string;
  status: 'open' | 'answered' | 'closed';
  reply: string | null;
  date: string;
};

export async function fetchTickets(status?: 'open' | 'answered' | 'closed'): Promise<ApiResult<AdminTicket[]>> {
  let q = supabase
    .from('support_tickets')
    .select(`id, user_id, topic, message, status, admin_reply, created_at, user:profiles!support_tickets_user_id_fkey(${AUTHOR})`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return { ok: false, error: err(error) };
  return ok(
    (data ?? []).map((t: any) => {
      const u = (Array.isArray(t.user) ? t.user[0] : t.user) as DbAuthor | null;
      return {
        id: t.id,
        userId: t.user_id,
        userName: u?.name ?? '—',
        username: u?.username ?? '',
        topic: t.topic,
        message: t.message,
        status: t.status,
        reply: t.admin_reply,
        date: new Date(t.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      };
    }),
  );
}

export async function answerTicket(id: string, reply: string, close: boolean): Promise<ApiResult> {
  const { error } = await supabase.rpc('admin_answer_ticket', { p_id: id, p_reply: reply, p_close: close });
  if (error) return { ok: false, error: err(error) };
  return ok(undefined);
}

export type AuditRow = { id: number; actor: string; action: string; targetType: string | null; targetId: string | null; details: unknown; date: string };

export async function fetchAuditLog(): Promise<ApiResult<AuditRow[]>> {
  const { data, error } = await supabase.rpc('admin_audit_log', { p_limit: 200 });
  if (error) return { ok: false, error: err(error) };
  return ok(
    ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      actor: r.actor_name,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      details: r.details,
      date: new Date(r.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    })),
  );
}
