/**
 * Ayarlar: bildirim tercihleri, yorum/bahsetme/mesaj izinleri, gizli kelimeler, kısıtla, sessize al,
 * arşiv, etkinliğin, destek, verilerimi indir, hesabı sil. Kurallar sunucuda (0010_settings.sql).
 */
import type { Comment, Post, User } from '@/data/mock';
import { AUTHOR, fetchPosts, one, timeAgo, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type NotifKind = 'like' | 'comment' | 'follow' | 'mention' | 'reply';
export type CommentPolicy = 'everyone' | 'following' | 'followers' | 'nobody';
export type MentionPolicy = 'everyone' | 'following' | 'nobody';
export type MessagePolicy = 'everyone' | 'following';

export type UserSettings = {
  notif: Partial<Record<NotifKind, boolean>>;
  comment_policy: CommentPolicy;
  mention_policy: MentionPolicy;
  message_policy: MessagePolicy;
  hidden_words: string[];
  daily_limit_min: number | null;
};

export const DEFAULT_SETTINGS: UserSettings = {
  notif: {},
  comment_policy: 'everyone',
  mention_policy: 'everyone',
  message_policy: 'everyone',
  hidden_words: [],
  daily_limit_min: null,
};

export async function fetchMySettings(myId: string): Promise<ApiResult<UserSettings>> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('notif, comment_policy, mention_policy, message_policy, hidden_words, daily_limit_min')
    .eq('user_id', myId)
    .maybeSingle();
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: { ...DEFAULT_SETTINGS, ...(data ?? {}) } as UserSettings };
}

export async function saveMySettings(myId: string, patch: Partial<UserSettings>): Promise<ApiResult> {
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: myId, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

// ─── Kısıtla ve sessize al ──────────────────────────────────────────────────

type Relation = 'restricts' | 'mutes';
const COLS: Record<Relation, { me: string; other: string; fk: string }> = {
  restricts: { me: 'restricter_id', other: 'restricted_id', fk: 'restricts_restricted_id_fkey' },
  mutes: { me: 'muter_id', other: 'muted_id', fk: 'mutes_muted_id_fkey' },
};

export async function fetchRelation(myId: string, rel: Relation): Promise<ApiResult<User[]>> {
  const c = COLS[rel];
  const { data, error } = await supabase
    .from(rel)
    .select(`${c.other}, person:profiles!${c.fk}(${AUTHOR})`)
    .eq(c.me, myId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: toTurkish(error) };
  return {
    ok: true,
    data: (data ?? [])
      .map((r: any) => one(r.person) as DbAuthor | null)
      .filter((a): a is DbAuthor => !!a)
      .map(toUser),
  };
}

export async function fetchRelationIds(myId: string, rel: Relation): Promise<string[]> {
  const c = COLS[rel];
  const { data } = await supabase.from(rel).select(c.other).eq(c.me, myId);
  return (data ?? []).map((r: any) => r[c.other] as string);
}

export async function setRelation(myId: string, rel: Relation, target: string, on: boolean): Promise<ApiResult> {
  const c = COLS[rel];
  const row = rel === 'mutes' ? { muter_id: myId, muted_id: target } : { restricter_id: myId, restricted_id: target };
  const { error } = on
    ? await supabase.from(rel).insert(row as never)
    : await supabase.from(rel).delete().eq(c.me, myId).eq(c.other, target);
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

// ─── Arşiv ──────────────────────────────────────────────────────────────────

export async function setArchived(postId: string, archived: boolean): Promise<ApiResult> {
  const { error } = await supabase
    .from('posts')
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq('id', postId);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

export const fetchArchived = (myId: string) => fetchPosts(myId, { authorId: myId, archived: true });

// ─── Etkinliğin ─────────────────────────────────────────────────────────────

export async function fetchLikedPosts(myId: string): Promise<ApiResult<{ posts: Post[]; authors: User[] }>> {
  const { data, error } = await supabase
    .from('likes')
    .select('post_id, created_at')
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return { ok: false, error: toTurkish(error) };
  const ids = (data ?? []).map((l) => l.post_id);
  const res = await fetchPosts(myId, { ids });
  if (!res.ok) return res;
  // Beğenme sırasını koru
  const byId = new Map(res.data.posts.map((p) => [p.id, p]));
  return { ok: true, data: { posts: ids.map((id) => byId.get(id)).filter((p): p is Post => !!p), authors: res.data.authors } };
}

export type MyComment = Comment & { postId: string };

export async function fetchMyComments(myId: string): Promise<ApiResult<MyComment[]>> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, text, created_at')
    .eq('author_id', myId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: toTurkish(error) };
  return {
    ok: true,
    data: (data ?? []).map((c) => ({ id: c.id, postId: c.post_id, authorId: myId, text: c.text, time: timeAgo(c.created_at) })),
  };
}

export async function deleteComment(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

// ─── Destek ─────────────────────────────────────────────────────────────────

export type TicketTopic = 'hesap' | 'arena' | 'magaza' | 'guvenlik' | 'hata' | 'oneri' | 'diger';
export const TICKET_TOPICS: { key: TicketTopic; label: string }[] = [
  { key: 'hesap', label: 'Hesabım' },
  { key: 'guvenlik', label: 'Güvenlik' },
  { key: 'arena', label: 'Arena ve ödüller' },
  { key: 'magaza', label: 'Mağaza ve sipariş' },
  { key: 'hata', label: 'Bir şey çalışmıyor' },
  { key: 'oneri', label: 'Öneri' },
  { key: 'diger', label: 'Diğer' },
];

export type Ticket = {
  id: string;
  topic: TicketTopic;
  message: string;
  status: 'open' | 'answered' | 'closed';
  time: string;
  reply: string | null;
};

export async function sendTicket(myId: string, topic: TicketTopic, message: string): Promise<ApiResult> {
  const { error } = await supabase.from('support_tickets').insert({ user_id: myId, topic, message: message.trim() });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

export async function fetchMyTickets(myId: string): Promise<ApiResult<Ticket[]>> {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('id, topic, message, status, created_at, admin_reply')
    .eq('user_id', myId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: toTurkish(error) };
  return {
    ok: true,
    data: (data ?? []).map((t) => ({
      id: t.id,
      topic: t.topic,
      message: t.message,
      status: t.status,
      time: timeAgo(t.created_at),
      reply: t.admin_reply ?? null,
    })),
  };
}

// ─── Verilerim ve hesap silme ───────────────────────────────────────────────

export async function exportMyData(): Promise<ApiResult<unknown>> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data };
}

/** Kullanıcının bir kovadaki tüm dosyalarını siler ({uid}/... klasörü). */
async function removeAllFiles(bucket: 'media' | 'avatars', myId: string) {
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.storage.from(bucket).list(myId, { limit: 1000 });
    const paths = (data ?? []).filter((f) => f.name).map((f) => `${myId}/${f.name}`);
    if (!paths.length) return;
    await supabase.storage.from(bucket).remove(paths);
  }
}

/** Hesabı kalıcı siler: önce dosyalar, sonra hesap (siparişler yasal süre boyunca özet olarak saklanır). */
export async function deleteMyAccount(myId: string): Promise<ApiResult> {
  try {
    await removeAllFiles('media', myId);
    await removeAllFiles('avatars', myId);
  } catch {
    // Dosya silme başarısız olsa da hesap silinir; kalan dosyalar sahipsiz kalır ve sonra temizlenir
  }
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { ok: false, error: toTurkish(error) };
  await supabase.auth.signOut({ scope: 'local' });
  return { ok: true, data: undefined };
}

/** Bu hesabın açık olduğu tüm cihazlardan çıkış. */
export async function signOutEverywhere(): Promise<ApiResult> {
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}
