/** İlgi alanları sunucuda (0024_user_interests.sql): her cihazda aynı kişisel sıralama. */
import { supabase } from '@/lib/supabase';

export async function fetchMyInterests(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('my_interests');
  if (error) return null;
  const out: Record<string, number> = {};
  for (const r of (data ?? []) as { topic: string; score: number }[]) out[r.topic] = r.score;
  return out;
}

/** Biriken izleme sürelerini gönderir (konu → saniye). */
export async function pushInterests(deltas: Record<string, number>) {
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(deltas)) if (v > 0) clean[k] = Math.round(v * 10) / 10;
  if (!Object.keys(clean).length) return;
  await supabase.rpc('bump_interests', { p_deltas: clean });
}

export async function resetMyInterests() {
  const { error } = await supabase.rpc('reset_interests');
  return !error;
}
