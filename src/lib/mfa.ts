/**
 * İki adımlı doğrulama (TOTP): Google Authenticator / Microsoft Authenticator gibi uygulamalardaki
 * 6 haneli kod. Supabase Auth MFA kullanılır; açıkken girişte şifreden sonra kod istenir.
 */
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type Enrollment = { factorId: string; qr: string; secret: string; uri: string };

const mfaError = (e: { message?: string; code?: string }) => {
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('invalid') || msg.includes('code')) return 'Kod hatalı ya da süresi geçmiş. Uygulamadaki yeni kodu dene.';
  if (msg.includes('aal2')) return 'Bu işlem için önce iki adımlı doğrulama kodunu girmelisin.';
  return toTurkish(e);
};

/** Doğrulanmış TOTP kaydı varsa kimliğini döner. */
export async function activeFactor(): Promise<string | null> {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.[0]?.id ?? null;
}

/** Oturum açıldı ama ikinci adım (kod) henüz girilmedi mi? */
export async function needsSecondStep(): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
}

/** Kurulumu başlat: QR kod ve gizli anahtar döner (önce yarım kalmış kayıtlar temizlenir). */
export async function startEnroll(): Promise<{ ok: true; data: Enrollment } | { ok: false; error: string }> {
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `VOPILA ${Date.now()}` });
  if (error || !data) return { ok: false, error: mfaError(error ?? {}) };
  return { ok: true, data: { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri } };
}

/** Uygulamadaki 6 haneli kodu doğrular (kurulumu tamamlamak ya da girişte ikinci adım için). */
export async function verifyCode(factorId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, '') });
  if (error) return { ok: false, error: mfaError(error) };
  return { ok: true };
}

export async function disable(factorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: mfaError(error) };
  return { ok: true };
}
