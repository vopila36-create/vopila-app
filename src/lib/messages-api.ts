/**
 * Mesajlaşma (DM): sohbet listesi, mesajlar, gönderme, okundu işareti ve canlı güncelleme.
 * Kurallar sunucuda (0008_messaging.sql): yalnızca üyeler okur/yazar, engel varsa yazılamaz.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { timeAgo, type ApiResult } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type Conversation = {
  id: string;
  otherId: string;
  otherUsername: string;
  otherName: string;
  otherAvatar: string;
  otherVerified: boolean;
  lastKind: 'text' | 'post';
  lastText: string;
  lastFromMe: boolean;
  lastAt: string;
  unread: number;
};

export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  kind: 'text' | 'post';
  text: string;
  postId: string | null;
  createdAt: string;
};

const toMessage = (r: any): Message => ({
  id: r.id,
  conversationId: r.conversation_id,
  senderId: r.sender_id,
  kind: r.kind,
  text: r.text,
  postId: r.post_id,
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
    .select('id, conversation_id, sender_id, kind, text, post_id, created_at')
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
    .select('id, conversation_id, sender_id, kind, text, post_id, created_at')
    .single();
  if (error) return { ok: false, error: messageError(error) };
  return { ok: true, data: toMessage(data) };
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
export function subscribeToConversation(conversationId: string, onMessage: (m: Message) => void): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`dm:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => onMessage(toMessage(payload.new)),
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
