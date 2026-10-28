/**
 * Yaş kuralları (0017_age_rules.sql). Doğum tarihi sunucuda saklanmaz; yalnızca yaş grubu tutulur.
 * 'under15' = 15 yaşını doldurmamış (hizmet verilmez), 'teen' = 15-18, 'adult' = 18+.
 */
import { toTurkish } from '@/store/auth';
import { supabase } from '@/lib/supabase';

export type AgeGroup = 'unknown' | 'under15' | 'teen' | 'adult';
export type AgeMethod = 'self' | 'edevlet' | 'admin';
export type AgeStatus = { group: AgeGroup; method: AgeMethod };

export const AGE_LABEL: Record<AgeGroup, string> = {
  unknown: 'Belirtilmedi',
  under15: '15 yaşından küçük',
  teen: '15–18 yaş',
  adult: '18 yaş ve üstü',
};
export const METHOD_LABEL: Record<AgeMethod, string> = {
  self: 'Kendi beyanın',
  edevlet: 'e-Devlet ile doğrulandı',
  admin: 'Destek ekibi inceledi',
};

/** "GG.AA.YYYY" → "YYYY-MM-DD"; geçersizse null. */
export function parseTrDate(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Doğum tarihinden bugünkü yaş (yıl). */
export function ageOn(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

/** Yazılan doğum tarihini kontrol eder: hata mesajı ya da ISO tarih. */
export function checkBirthDate(text: string): { ok: true; iso: string; age: number } | { ok: false; error: string } {
  const iso = parseTrDate(text);
  if (!iso) return { ok: false, error: 'Doğum tarihini GG.AA.YYYY şeklinde yaz (ör. 05.09.2004).' };
  const age = ageOn(iso);
  if (age < 0 || age > 120) return { ok: false, error: 'Geçerli bir doğum tarihi yaz.' };
  if (age < 15) return { ok: false, error: "VOPILA'yı kullanmak için en az 15 yaşında olmalısın (5651 sayılı Kanun)." };
  return { ok: true, iso, age };
}

export async function fetchMyAge(): Promise<AgeStatus | null> {
  const { data, error } = await supabase.rpc('my_age');
  if (error || !data?.[0]) return null;
  return { group: data[0].age_group as AgeGroup, method: data[0].method as AgeMethod };
}

export async function declareBirthDate(iso: string): Promise<{ ok: true; group: AgeGroup } | { ok: false; error: string }> {
  const { data, error } = await supabase.rpc('declare_birth_date', { p_birth: iso });
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, group: data as AgeGroup };
}

export async function adminAgeGroupOf(userId: string): Promise<AgeGroup | null> {
  const { data, error } = await supabase.rpc('admin_age_group_of', { p_user: userId });
  return error ? null : (data as AgeGroup);
}

export async function adminSetAgeGroup(userId: string, group: AgeGroup, reason?: string) {
  const { error } = await supabase.rpc('admin_set_age_group', { p_user: userId, p_group: group, p_reason: reason ?? null });
  return error ? { ok: false as const, error: toTurkish(error) } : { ok: true as const };
}
