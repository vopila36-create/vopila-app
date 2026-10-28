/** Yakın Arkadaşlar listesi (0027_close_friends.sql): yalnızca sahibi görür; eklenen kişiye bildirim gitmez. */
import { AUTHOR, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import type { User } from '@/data/mock';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export async function fetchCloseFriends(myId: string): Promise<ApiResult<User[]>> {
  const { data, error } = await supabase
    .from('close_friends')
    .select(`friend_id, friend:profiles!close_friends_friend_id_fkey(${AUTHOR})`)
    .eq('owner_id', myId)
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: toTurkish(error) };
  const list = (data ?? [])
    .map((r: any) => (Array.isArray(r.friend) ? r.friend[0] : r.friend) as DbAuthor | null)
    .filter((a): a is DbAuthor => !!a)
    .map(toUser);
  return { ok: true, data: list };
}

export async function setCloseFriend(myId: string, friendId: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('close_friends').insert({ owner_id: myId, friend_id: friendId })
    : await supabase.from('close_friends').delete().eq('owner_id', myId).eq('friend_id', friendId);
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}
