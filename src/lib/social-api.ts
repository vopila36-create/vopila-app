/**
 * Gerçek kullanıcılar: profil, takip / takip isteği, takipçi listeleri, kişi arama, engelle, şikayet.
 * Gizlilik ve engel kuralları sunucuda (RLS + private.can_view_user) uygulanır.
 */
import type { User } from '@/data/mock';
import { AUTHOR, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

/** Gerçek (Supabase) kullanıcı kimliği mi? Örnek verideki kimlikler "u_ayse" gibidir. */
export const isRealId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export type FollowStatus = 'none' | 'pending' | 'accepted';

export type RealProfile = User & { isPrivate: boolean; followers: number; following: number };

export async function fetchProfile(id: string): Promise<ApiResult<RealProfile | null>> {
  const [{ data, error }, counts] = await Promise.all([
    supabase.from('profiles').select(`${AUTHOR}, bio, location, cover_url, is_private, discovery_points`).eq('id', id).maybeSingle(),
    supabase.rpc('get_follow_counts', { target: id }),
  ]);
  if (error) return { ok: false, error: toTurkish(error) };
  if (!data) return { ok: true, data: null };
  const c = (Array.isArray(counts.data) ? counts.data[0] : counts.data) as { followers: number; following: number } | null;
  return {
    ok: true,
    data: {
      ...toUser(data as DbAuthor),
      bio: data.bio ?? '',
      location: data.location ?? '',
      cover: data.cover_url ?? '',
      discoveryPoints: data.discovery_points ?? 0,
      isPrivate: data.is_private,
      followers: Number(c?.followers ?? 0),
      following: Number(c?.following ?? 0),
    },
  };
}

/** Benim takip ettiklerim (onaylı ve bekleyen istekler). */
export async function fetchMyFollowing(myId: string): Promise<ApiResult<Record<string, FollowStatus>>> {
  const { data, error } = await supabase.from('follows').select('following_id, status').eq('follower_id', myId);
  if (error) return { ok: false, error: toTurkish(error) };
  const out: Record<string, FollowStatus> = {};
  for (const r of data ?? []) out[r.following_id] = r.status as FollowStatus;
  return { ok: true, data: out };
}

/** Takip et: hedef gizli hesapsa sunucu durumu "pending" (istek) yapar. */
export async function follow(myId: string, target: string): Promise<ApiResult<FollowStatus>> {
  const { error } = await supabase.from('follows').insert({ follower_id: myId, following_id: target });
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  const { data } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', myId)
    .eq('following_id', target)
    .maybeSingle();
  return { ok: true, data: (data?.status as FollowStatus) ?? 'accepted' };
}

export async function unfollow(myId: string, target: string): Promise<ApiResult> {
  const { error } = await supabase.from('follows').delete().eq('follower_id', myId).eq('following_id', target);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

type ListRow = { user_id: string; username: string; name: string; avatar_url: string | null };
const listToUsers = (rows: ListRow[]) =>
  rows.map((r) => toUser({ id: r.user_id, username: r.username, name: r.name, avatar_url: r.avatar_url, verified: false }));

export async function fetchFollowers(target: string): Promise<ApiResult<User[]>> {
  const { data, error } = await supabase.rpc('get_followers', { target });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: listToUsers((data ?? []) as ListRow[]) };
}

export async function fetchFollowing(target: string): Promise<ApiResult<User[]>> {
  const { data, error } = await supabase.rpc('get_following', { target });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: listToUsers((data ?? []) as ListRow[]) };
}

/** Bana gelen bekleyen takip istekleri. */
export async function fetchFollowRequests(myId: string): Promise<ApiResult<User[]>> {
  const { data, error } = await supabase
    .from('follows')
    .select(`follower_id, created_at, follower:profiles!follows_follower_id_fkey(${AUTHOR})`)
    .eq('following_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) return { ok: false, error: toTurkish(error) };
  return {
    ok: true,
    data: (data ?? [])
      .map((r: any) => (Array.isArray(r.follower) ? r.follower[0] : r.follower) as DbAuthor | null)
      .filter((a): a is DbAuthor => !!a)
      .map(toUser),
  };
}

export async function answerFollowRequest(myId: string, follower: string, accept: boolean): Promise<ApiResult> {
  const { error } = accept
    ? await supabase.from('follows').update({ status: 'accepted' }).eq('follower_id', follower).eq('following_id', myId)
    : await supabase.from('follows').delete().eq('follower_id', follower).eq('following_id', myId);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

/** Kullanıcı adı ya da ada göre kişi arama (kendim hariç). */
export async function searchProfiles(myId: string | null, query: string): Promise<ApiResult<User[]>> {
  const q = query.trim().replace(/[%_,()]/g, '');
  if (q.length < 2) return { ok: true, data: [] };
  // Sunucuda arama: 18 yaş altı hesaplar yalnızca takip ilişkisi olanlara çıkar (0017_age_rules.sql)
  const { data, error } = await supabase.rpc('search_people', { p_query: q });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: ((data ?? []) as DbAuthor[]).filter((p) => p.id !== myId).map(toUser) };
}

/** Kullanıcı adlarından kimlik bulur (@bahsetme bağlantıları için). */
export async function profileIdByUsername(username: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
  return data?.id ?? null;
}

// ─── Engelle ve şikayet ─────────────────────────────────────────────────────

export async function fetchBlocked(myId: string): Promise<ApiResult<User[]>> {
  const { data, error } = await supabase
    .from('blocks')
    .select(`blocked_id, blocked:profiles!blocks_blocked_id_fkey(${AUTHOR})`)
    .eq('blocker_id', myId);
  if (error) return { ok: false, error: toTurkish(error) };
  return {
    ok: true,
    data: (data ?? [])
      .map((r: any) => (Array.isArray(r.blocked) ? r.blocked[0] : r.blocked) as DbAuthor | null)
      .filter((a): a is DbAuthor => !!a)
      .map(toUser),
  };
}

export async function setBlocked(myId: string, target: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('blocks').insert({ blocker_id: myId, blocked_id: target })
    : await supabase.from('blocks').delete().eq('blocker_id', myId).eq('blocked_id', target);
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

export type ReportReason =
  | 'spam'
  | 'nefret'
  | 'taciz'
  | 'ciplaklik'
  | 'siddet'
  | 'sahte_hesap'
  | 'telif'
  | 'hile'
  | 'cocuk_guvenligi'
  | 'kufur'
  | 'hassas'
  | 'teror'
  | 'diger';

export const REPORT_REASONS: { key: ReportReason; label: string }[] = [
  { key: 'kufur', label: 'Küfür ya da hakaret' },
  { key: 'taciz', label: 'Taciz, zorbalık ya da tehdit' },
  { key: 'ciplaklik', label: 'Çıplaklık ya da cinsel içerik' },
  { key: 'nefret', label: 'Nefret söylemi' },
  { key: 'siddet', label: 'Şiddet ya da tehlikeli davranış' },
  { key: 'hassas', label: 'Rahatsız edici (kan, yaralanma vb.)' },
  { key: 'spam', label: 'Spam ya da dolandırıcılık' },
  { key: 'sahte_hesap', label: 'Sahte hesap' },
  { key: 'telif', label: 'Telif hakkı ihlali' },
  { key: 'hile', label: 'Arena hilesi' },
  { key: 'cocuk_guvenligi', label: 'Çocuk güvenliği' },
  { key: 'teror', label: 'Terör propagandası' },
  { key: 'diger', label: 'Diğer' },
];

export async function report(
  myId: string,
  target: { type: 'post' | 'comment' | 'user' | 'moment' | 'live' | 'highlight' | 'review'; id: string },
  reason: ReportReason,
  details = '',
): Promise<ApiResult> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: myId,
    target_type: target.type,
    target_id: target.id,
    reason,
    details: details.slice(0, 500),
  });
  // Aynı şeyi ikinci kez şikayet etmek hata değil
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}
