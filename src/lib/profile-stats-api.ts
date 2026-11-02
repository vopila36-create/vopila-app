/** Kendi profilim için gerçek sayılar: takipçi/takip, profil etkisi (son N gün) ve rozetler. */
import { supabase } from '@/lib/supabase';

export type FollowCounts = { followers: number; following: number };

export async function fetchFollowCounts(userId: string): Promise<FollowCounts | null> {
  const { data, error } = await supabase.rpc('get_follow_counts', { target: userId });
  if (error) return null;
  const c = (Array.isArray(data) ? data[0] : data) as { followers: number; following: number } | null;
  return { followers: Number(c?.followers ?? 0), following: Number(c?.following ?? 0) };
}

export type Impact = { likes: number; comments: number; newFollowers: number; posts: number };

/** Son `days` günde gönderilerime gelen beğeni/yorum ve yeni takipçiler (0001 my_profile_impact). */
export async function fetchImpact(days: number): Promise<Impact | null> {
  const { data, error } = await supabase.rpc('my_profile_impact', { p_days: days });
  if (error) return null;
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, number> | null;
  return {
    likes: Number(r?.likes_received ?? 0),
    comments: Number(r?.comments_received ?? 0),
    newFollowers: Number(r?.new_followers ?? 0),
    posts: Number(r?.posts_count ?? 0),
  };
}

export type BadgeItem = { id: string; name: string; image: string; description: string; earned: boolean; earnedAt?: string };

/** Tüm rozetler + kullanıcının kazandıkları (rozetleri yalnızca sistem verir). */
export async function fetchBadges(userId: string): Promise<BadgeItem[] | null> {
  const [all, mine] = await Promise.all([
    supabase.from('badges').select('id, name, image_url, description, sort_order').order('sort_order'),
    supabase.from('user_badges').select('badge_id, awarded_at').eq('user_id', userId),
  ]);
  if (all.error || mine.error) return null;
  const earned = new Map((mine.data ?? []).map((r) => [r.badge_id as string, r.awarded_at as string]));
  return (all.data ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    image: b.image_url ?? '',
    description: b.description ?? '',
    earned: earned.has(b.id),
    earnedAt: earned.get(b.id),
  }));
}

/** "Katılım: Ekim 2026" gibi katılım metni. */
export function memberSince(createdAt?: string | null): string {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return `Katılım: ${d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}`;
}
