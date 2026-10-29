/**
 * Kapalı beta davetleri (0029_beta_invites.sql). Kayıt sunucuda yalnızca geçerli davet koduyla açılır;
 * buradaki kontrol yalnızca kullanıcıya erken ve anlaşılır uyarı vermek içindir.
 */
import type { ApiResult } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

/** Davet bağlantısı: tarayıcıda beta sürümünde kayıt ekranını kodla açar. */
export const INVITE_LINK_BASE = 'https://beta.vopila.com/davet/';
export const inviteLink = (code: string) => `${INVITE_LINK_BASE}${code}`;

/** Kullanıcının yazdığı kodu sadeleştirir (büyük harf, yalnızca harf/rakam, en çok 8). */
export const cleanInviteCode = (t: string) =>
  t
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);

export type InviteStatus = 'ok' | 'invalid' | 'used' | 'expired' | 'revoked' | 'not_required';

export const INVITE_MESSAGES: Record<Exclude<InviteStatus, 'ok' | 'not_required'>, string> = {
  invalid: 'Davet kodu geçersiz. Kodu sana davet gönderen kişiden kontrol et.',
  used: 'Bu davet kodu daha önce kullanılmış. Yeni bir davet iste.',
  expired: 'Bu davet kodunun süresi dolmuş. Yeni bir davet iste.',
  revoked: 'Bu davet kodu iptal edilmiş. Yeni bir davet iste.',
};

export async function inviteStatus(code: string): Promise<InviteStatus | null> {
  const { data, error } = await supabase.rpc('invite_status', { p_code: cleanInviteCode(code) });
  if (error) return null;
  return data as InviteStatus;
}

/** Kayıt için davet gerekiyor mu (kapalı beta açık mı)? Bilinmiyorsa true. */
export async function inviteRequired(): Promise<boolean> {
  return (await inviteStatus('')) !== 'not_required';
}

// ─── Yönetici ────────────────────────────────────────────────────────────────

export type InviteRow = {
  code: string;
  note: string | null;
  maxUses: number;
  usedCount: number;
  status: Exclude<InviteStatus, 'not_required'>;
  usedBy: string[];
  createdAt: string;
};

const adminErr = (e: { message?: string; code?: string }) =>
  (e.message ?? '').includes('not_allowed') ? 'Bu işlem için yönetici ve iki adımlı doğrulama gerekli.' : toTurkish(e);

export async function fetchInvites(): Promise<ApiResult<InviteRow[]>> {
  const { data, error } = await supabase.rpc('admin_list_invites');
  if (error) return { ok: false, error: adminErr(error) };
  return {
    ok: true,
    data: ((data ?? []) as any[]).map((r) => ({
      code: r.code,
      note: r.note,
      maxUses: r.max_uses,
      usedCount: r.used_count,
      status: r.status,
      usedBy: r.used_by ?? [],
      createdAt: new Date(r.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
    })),
  };
}

export async function createInvites(count: number, uses: number, note: string): Promise<ApiResult<string[]>> {
  const { data, error } = await supabase.rpc('admin_create_invites', {
    p_count: count,
    p_uses: uses,
    p_note: note.trim() || null,
  });
  if (error) return { ok: false, error: adminErr(error) };
  return { ok: true, data: (data ?? []) as string[] };
}

export async function revokeInvite(code: string): Promise<ApiResult<null>> {
  const { error } = await supabase.rpc('admin_revoke_invite', { p_code: code });
  if (error) return { ok: false, error: adminErr(error) };
  return { ok: true, data: null };
}

/** Kapalı beta anahtarını okur (required verilmezse) ya da değiştirir. */
export async function adminInviteRequired(required?: boolean): Promise<ApiResult<boolean>> {
  const { data, error } = await supabase.rpc('admin_invite_required', { p_required: required ?? null });
  if (error) return { ok: false, error: adminErr(error) };
  return { ok: true, data: !!data };
}
