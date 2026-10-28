/**
 * Arenalar (gerçek): açık sezonlardaki gönderiler ve sıralama, oy verme, arena üyeliği,
 * arena özeti (üye, sezon bitişi) ve incelemedeki ödüller. Kurallar sunucuda.
 */
import type { ArenaEntry, ArenaKey, User } from '@/data/mock';
import { AUTHOR, localId, toUser, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import { mediaUrls, supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type ArenaStat = { members: number; seasonId: string | null; endsAt: string | null; entries: number };

/** Oy / katılım hatalarını sade Türkçeye çevirir. */
export function arenaError(err: { message?: string; code?: string } | null | undefined) {
  const msg = (err?.message ?? '').toLowerCase();
  if (msg.includes('cannot_vote_own_entry')) return 'Kendi gönderine oy veremezsin.';
  if (msg.includes('already_voted')) return 'Bu gönderiye zaten oy verdin.';
  if (msg.includes('account_too_new'))
    return 'Hile önlemi: hesabın 3 günlük olunca oy verebilirsin. O zamana kadar paylaşıp yarışabilirsin.';
  if (msg.includes('season_closed')) return 'Bu sezon kapandı. Yeni sezonda tekrar dene.';
  if (msg.includes('invalid_score')) return 'Puan 1 ile 5 arasında olmalı.';
  if (msg.includes('entry_has_votes')) return 'Oy almış arena gönderisi sezon bitene kadar silinemez.';
  if (msg.includes('entry_not_found')) return 'Bu gönderi artık yarışmada değil.';
  return toTurkish(err);
}

export async function fetchArenaStats(): Promise<ApiResult<Record<string, ArenaStat>>> {
  const { data, error } = await supabase.from('arena_stats').select('key, members, season_id, ends_at, entries');
  if (error) return { ok: false, error: toTurkish(error) };
  const out: Record<string, ArenaStat> = {};
  for (const r of data ?? [])
    out[r.key] = { members: r.members ?? 0, seasonId: r.season_id, endsAt: r.ends_at, entries: r.entries ?? 0 };
  return { ok: true, data: out };
}

/** Açık sezonlardaki tüm gerçek arena gönderileri (sunucunun sıralamasıyla) + benim oylarım. */
export async function fetchArenaEntries(
  myId: string,
  seasonIds: string[],
): Promise<ApiResult<{ entries: ArenaEntry[]; authors: User[] }>> {
  if (!seasonIds.length) return { ok: true, data: { entries: [], authors: [] } };
  const { data, error } = await supabase
    .from('arena_rankings')
    .select('id, season_id, arena_key, author_id, post_id, title, image_path, vote_count, score_total')
    .in('season_id', seasonIds)
    .limit(300);
  if (error) return { ok: false, error: toTurkish(error) };
  const rows = data ?? [];
  const ids = rows.map((r) => r.id);
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id)));

  const [urls, votes, profiles] = await Promise.all([
    mediaUrls(rows.map((r) => r.image_path).filter(Boolean) as string[]),
    ids.length
      ? supabase.from('arena_votes').select('entry_id, score').eq('voter_id', myId).in('entry_id', ids)
      : Promise.resolve({ data: [] as { entry_id: string; score: number }[] }),
    authorIds.length ? supabase.from('profiles').select(AUTHOR).in('id', authorIds) : Promise.resolve({ data: [] }),
  ]);
  const myVotes = new Map((votes.data ?? []).map((v) => [v.entry_id, v.score]));

  const entries: ArenaEntry[] = rows.map((r) => ({
    id: r.id,
    arenaKey: r.arena_key as ArenaKey,
    authorId: localId(r.author_id, myId),
    image: (r.image_path && urls[r.image_path]) || '',
    title: r.title || 'Gönderi',
    votes: r.vote_count,
    totalScore: r.score_total,
    remote: true,
    postId: r.post_id,
    myVote: myVotes.get(r.id),
  }));
  const authors = ((profiles.data ?? []) as DbAuthor[]).filter((a) => a.id !== myId).map(toUser);
  return { ok: true, data: { entries, authors } };
}

export async function voteEntry(entryId: string, score: number): Promise<ApiResult> {
  const { error } = await supabase.rpc('vote_entry', { p_entry_id: entryId, p_score: score });
  if (error) return { ok: false, error: arenaError(error) };
  return { ok: true, data: undefined };
}

export async function fetchMyArenas(myId: string): Promise<ArenaKey[]> {
  const { data } = await supabase.from('arena_members').select('arena_key').eq('user_id', myId);
  return (data ?? []).map((r) => r.arena_key as ArenaKey);
}

export async function setArenaMember(myId: string, key: ArenaKey, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('arena_members').insert({ user_id: myId, arena_key: key })
    : await supabase.from('arena_members').delete().eq('user_id', myId).eq('arena_key', key);
  if (error && error.code !== '23505') return { ok: false, error: arenaError(error) };
  return { ok: true, data: undefined };
}

export type PendingReward = { id: string; amount: number; reason: string; status: 'pending' | 'approved' | 'rejected' };

export async function fetchMyPendingRewards(myId: string): Promise<PendingReward[]> {
  const { data } = await supabase
    .from('pending_rewards')
    .select('id, amount, reason, status')
    .eq('user_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  return (data ?? []) as PendingReward[];
}

/** "2 gün 4 saat" gibi kalan süre. */
export function timeLeft(iso: string | null | undefined) {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'kapanıyor';
  const h = Math.floor(ms / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return h % 24 ? `${d} gün ${h % 24} saat` : `${d} gün`;
  if (h >= 1) return `${h} saat`;
  return `${Math.max(1, Math.floor(ms / 60_000))} dk`;
}

// ─── Aylık kazananlar ───────────────────────────────────────────────────────

export type Winner = {
  place: number;
  userId: string | null;
  name: string;
  username: string;
  avatar: string;
  prize: number;
  status: 'awarded' | 'review';
};
export type SeasonResult = { seasonId: string; arenaKey: ArenaKey; period: string; winners: Winner[] };

/** Her arenanın en son biten ayının ilk 3'ü (herkese açık). */
export async function fetchLatestWinners(): Promise<Record<string, SeasonResult>> {
  const { data } = await supabase
    .from('season_winners')
    .select(`season_id, arena_key, place, user_id, prize, status, period, created_at, user:profiles!season_winners_user_id_fkey(${AUTHOR})`)
    .order('created_at', { ascending: false })
    .limit(60);
  const out: Record<string, SeasonResult> = {};
  for (const r of (data ?? []) as any[]) {
    const cur = out[r.arena_key];
    // Arenanın yalnızca en son biten sezonu
    if (cur && cur.seasonId !== r.season_id) continue;
    const u = (Array.isArray(r.user) ? r.user[0] : r.user) as DbAuthor | null;
    const winner: Winner = {
      place: r.place,
      userId: r.user_id,
      name: u?.name ?? 'Silinmiş hesap',
      username: u?.username ?? '',
      avatar: u?.avatar_url ?? '',
      prize: r.prize,
      status: r.status,
    };
    if (!cur) out[r.arena_key] = { seasonId: r.season_id, arenaKey: r.arena_key, period: r.period, winners: [winner] };
    else cur.winners.push(winner);
  }
  for (const k of Object.keys(out)) out[k].winners.sort((a, b) => a.place - b.place);
  return out;
}
