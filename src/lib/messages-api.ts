/**
 * Mesajlaşma (DM): sohbet listesi, mesajlar, gönderme, okundu işareti ve canlı güncelleme.
 * Kurallar sunucuda (0008_messaging.sql): yalnızca üyeler okur/yazar, engel varsa yazılamaz.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { timeAgo, type ApiResult } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { uploadToStorage, type UploadProgress } from '@/lib/upload';
import { fileSize, MAX_DM_BYTES, tooBigMessage } from '@/lib/media-prep';
import { toTurkish } from '@/store/auth';

export type Conversation = {
  id: string;
  otherId: string;
  otherUsername: string;
  otherName: string;
  otherAvatar: string;
  otherVerified: boolean;
  lastKind: MessageKind;
  lastText: string;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
};

export type MessageKind = 'text' | 'post' | 'image' | 'video' | 'audio' | 'unsent';

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: MessageKind;
  text: string;
  postId: string | null;
  /** Fotoğraf / video / ses dosyası (gizli 'dm' deposunda) */
  mediaPath: string | null;
  /** Sesli mesaj süresi */
  durationMs: number | null;
  createdAt: string;
  /** Kalp bırakan üyeler */
  hearts: string[];
};

/** Gelen kutusunda son mesajın özeti */
export function kindPreview(kind: MessageKind, text: string) {
  if (kind === 'image') return '📷 Fotoğraf';
  if (kind === 'video') return '🎬 Video';
  if (kind === 'audio') return '🎤 Sesli mesaj';
  if (kind === 'post') return text || 'Bir gönderi paylaştı';
  if (kind === 'unsent') return 'Mesaj geri alındı';
  return text;
}

const toMessage = (r: any): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  kind: r.kind,
  text: r.text,
  postId: r.post_id,
  mediaPath: r.media_path ?? null,
  durationMs: r.duration_ms ?? null,
  hearts: Array.isArray(r.hearts) ? r.hearts : [],
  createdAt: r.created_at,
});

/** Mesaj hatalarını sade Türkçeye çevirir. */
function messageError(err: { message?: string; code?: string }) {
  const msg = (err.message ?? '').toLowerCase();
  if (msg.includes('row-level security') || msg.includes('blocked'))
    return 'Bu kişiye mesaj gönderemezsin.';
  if (msg.includes('user_not_found')) return 'Bu kullanıcı bulunamadı.';
  if (msg.includes('invalid_recipient')) return 'Kendine mesaj gönderemezsin.';
  return toTurkish(err);
}

export async function fetchConversations(myId: string): Promise<ApiResult<Conversation[]>> {
  const { data, error } = await supabase.rpc('my_conversations');
  if (error) return { ok: false, error: messageError(error) };
  return {
    ok: true,
    data: ((data ?? []) as any[]).map((r) => ({
      id: r.id,
      otherId: r.other_id,
      otherUsername: r.other_username,
      otherName: r.other_name,
      otherAvatar: r.other_avatar ?? '',
      otherVerified: r.other_verified,
      lastKind: r.last_kind,
      lastText: r.last_text,
      lastFromMe: r.last_sender === myId,
      lastAt: r.last_at,
      unread: r.unread ?? 0,
    })),
  };
}

/** Bir kişiyle olan sohbeti bulur ya da açar; sohbet kimliğini döner. */
export async function openDm(otherId: string): Promise<ApiResult<string>> {
  const { data, error } = await supabase.rpc('get_or_create_dm', { p_other: otherId });
  if (error) return { ok: false, error: messageError(error) };
  return { ok: true, data: data as string };
}

/** Sohbetin diğer üyesi (başlıkta göstermek için). */
export async function fetchConversationPeer(
  conversationId: string,
  myId: string,
): Promise<ApiResult<{ id: string; username: string; name: string; avatar: string; verified: boolean } | null>> {
  const { data, error } = await supabase
    .from('conversation_members')
    .select('user_id, profile:profiles!conversation_members_user_id_fkey(id, username, name, avatar_url, verified)')
    .eq('conversation_id', conversationId)
    .neq('user_id', myId)
    .maybeSingle();
  if (error) return { ok: false, error: messageError(error) };
  const p: any = data ? (Array.isArray(data.profile) ? data.profile[0] : data.profile) : null;
  if (!p) return { ok: true, data: null };
  return { ok: true, data: { id: p.id, username: p.username, name: p.name, avatar: p.avatar_url ?? '', verified: p.verified } };
}

/** En yeni mesajlar (eskiden yeniye sıralı döner). `before` ile daha eskileri yüklenir. */
export async function fetchMessages(conversationId: string, before?: string): Promise<ApiResult<Message[]>> {
  let q = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, kind, text, post_id, media_path, duration_ms, created_at, hearts')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) return { ok: false, error: messageError(error) };
  return { ok: true, data: (data ?? []).map(toMessage).reverse() };
}

export async function sendMessage(
  myId: string,
  conversationId: string,
  input: { text?: string; postId?: string },
): Promise<ApiResult<Message>> {
  const text = (input.text ?? '').trim().slice(0, 1000);
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: myId,
      kind: input.postId ? 'post' : 'text',
      text,
      post_id: input.postId ?? null,
    })
    .select('id, conversation_id, sender_id, kind, text, post_id, media_path, duration_ms, created_at, hearts')
    .single();
  if (error) return { ok: false, error: messageError(error) };
  return { ok: true, data: toMessage(data) };
}

/**
 * Fotoğraf, video ya da sesli mesaj gönderir: dosya gizli 'dm' deposuna
 * <sohbet>/<gönderen>/ klasörüne yüklenir (yalnızca sohbetin üyeleri açabilir), sonra mesaj yazılır.
 */
export async function sendMediaMessage(
  myId: string,
  conversationId: string,
  input: { uri: string; kind: 'image' | 'video' | 'audio'; mimeType?: string | null; durationMs?: number },
  onProgress?: UploadProgress,
): Promise<ApiResult<Message>> {
  const mime =
    input.mimeType ||
    (input.kind === 'audio'
      ? input.uri.startsWith('blob:')
        ? 'audio/webm'
        : 'audio/mp4'
      : input.kind === 'video'
        ? 'video/mp4'
        : 'image/jpeg');
  const ext = mime.includes('webm') ? 'webm' : mime.includes('png') ? 'png' : mime.includes('quicktime') ? 'mov'
    : mime.startsWith('video') ? 'mp4' : mime.startsWith('audio') ? 'm4a' : 'jpg';
  const path = `${conversationId}/${myId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  try {
    const size = await fileSize(input.uri);
    if (size && size > MAX_DM_BYTES) return { ok: false, error: tooBigMessage(MAX_DM_BYTES) };
    await uploadToStorage('dm', path, input.uri, mime, { onProgress });
  } catch (e: any) {
    const msg = String(e?.message ?? '');
    return { ok: false, error: /^(Dosya|Oturum)/.test(msg) ? msg : 'Dosya okunamadı, tekrar dene.' };
  }
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: myId,
      kind: input.kind,
      text: '',
      media_path: path,
      duration_ms: input.kind === 'audio' ? Math.min(Math.round(input.durationMs ?? 0), 120000) : null,
    })
    .select('id, conversation_id, sender_id, kind, text, post_id, media_path, duration_ms, created_at, hearts')
    .single();
  if (error) {
    await supabase.storage.from('dm').remove([path]);
    return { ok: false, error: messageError(error) };
  }
  return { ok: true, data: toMessage(data) };
}

/** Gizli medya için 1 saatlik bağlantı (bellekte saklanır). */
const urlCache = new Map<string, { url: string; until: number }>();
export async function dmMediaUrl(path: string): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.until > Date.now()) return hit.url;
  const { data, error } = await supabase.storage.from('dm').createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  urlCache.set(path, { url: data.signedUrl, until: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/** Bir kişiye doğrudan gönder (sohbet yoksa açılır). "Arkadaşına gönder" bunu kullanır. */
export async function sendToUser(
  myId: string,
  otherId: string,
  input: { text?: string; postId?: string },
): Promise<ApiResult<Message>> {
  const conv = await openDm(otherId);
  if (!conv.ok) return conv;
  return sendMessage(myId, conv.data, input);
}

export async function markRead(conversationId: string) {
  await supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
}

/** Sohbete gelen yeni mesajları canlı dinler. Dönen fonksiyon dinlemeyi kapatır. */
export function subscribeToConversation(
  conversationId: string,
  onMessage: (m: Message) => void,
  onUpdate?: (m: Message) => void,
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`dm:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(toMessage(payload.new)),
    )
    // Geri alma ve kalp tepkisi (0037)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onUpdate?.(toMessage(payload.new)),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** Bana gelen her yeni mesajı dinler (gelen kutusu ve okunmamış rozeti için). */
export function subscribeToInbox(onMessage: (m: Message) => void): () => void {
  const channel = supabase
    .channel('dm:inbox')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      onMessage(toMessage(payload.new)),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

/** "14:32", "Dün", "3 gün önce" gibi sohbet zamanı. */
export function chatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  return timeAgo(iso);
}

/**
 * "Yazıyor…" göstergesi: gizli yayın kanalı (yalnız sohbet üyeleri; 0036). Mesaj veritabanına yazılmaz.
 * `ping()` yazarken çağrılır (en fazla 2 sn'de bir gönderir); karşı taraf yazınca `onTyping(true)`,
 * 4 sn sinyal gelmezse `onTyping(false)`.
 */
export function subscribeTyping(conversationId: string, myId: string, onTyping: (typing: boolean) => void) {
  const channel: RealtimeChannel = supabase.channel(`typing:${conversationId}`, { config: { private: true } });
  let hide: ReturnType<typeof setTimeout> | null = null;
  let lastSent = 0;
  channel
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.from === myId) return;
      if (hide) clearTimeout(hide);
      if (payload?.stop) {
        onTyping(false);
        return;
      }
      onTyping(true);
      hide = setTimeout(() => onTyping(false), 4000);
    })
    .subscribe();
  return {
    ping() {
      const now = Date.now();
      if (now - lastSent < 2000) return;
      lastSent = now;
      channel.send({ type: 'broadcast', event: 'typing', payload: { from: myId } });
    },
    stop() {
      lastSent = 0;
      channel.send({ type: 'broadcast', event: 'typing', payload: { from: myId, stop: true } });
    },
    close() {
      if (hide) clearTimeout(hide);
      supabase.removeChannel(channel);
    },
  };
}

/** Gönderimi geri al: mesaj iki taraftan da kalkar, varsa dosyası depodan silinir (0037). */
export async function unsendMessage(messageId: string): Promise<ApiResult> {
  const { data, error } = await supabase.rpc('unsend_message', { p_id: messageId });
  if (error) return { ok: false, error: messageError(error) };
  if (typeof data === 'string' && data) await supabase.storage.from('dm').remove([data]);
  return { ok: true, data: undefined };
}

/** Mesaja kalp bırak / kaldır (0037). */
export async function heartMessage(messageId: string, on: boolean): Promise<ApiResult> {
  const { error } = await supabase.rpc('heart_message', { p_id: messageId, p_on: on });
  if (error) return { ok: false, error: messageError(error) };
  return { ok: true, data: undefined };
}
