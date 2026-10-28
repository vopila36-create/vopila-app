/** Gerçek bildirimler (beğeni, yorum, takip, bahsetme, yanıt, arena, token, sipariş). */
import type { AppNotification, User } from '@/data/mock';
import { AUTHOR, localId, one, timeAgo, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export async function fetchNotifications(
  myId: string,
): Promise<ApiResult<{ list: AppNotification[]; actors: User[] }>> {
  const { data, error } = await supabase
    .from('notifications')
    .select(`id, kind, actor_id, text, href, read_at, created_at, actor:profiles!notifications_actor_id_fkey(${AUTHOR})`)
    .eq('user_id', myId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return { ok: false, error: toTurkish(error) };
  const actors: User[] = [];
  const list = (data ?? []).map((r: any) => {
    const a = one(r.actor) as DbAuthor | null;
    if (a && a.id !== myId) actors.push(toUser(a));
    return {
      id: r.id,
      kind: r.kind,
      actorId: r.actor_id ? localId(r.actor_id, myId) : undefined,
      text: r.text,
      // Ekran "… önce" ekliyor
      time: timeAgo(r.created_at).replace(/ önce$/, ''),
      href: r.href,
      read: !!r.read_at,
      remote: true,
    } as AppNotification;
  });
  return { ok: true, data: { list, actors } };
}

export async function markNotificationsRead(myId: string, ids?: string[]) {
  let q = supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', myId).is('read_at', null);
  if (ids) q = q.in('id', ids);
  await q;
}
