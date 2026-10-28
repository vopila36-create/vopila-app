/** Ebeveyn denetimi (0018_parental_controls.sql). */
import { toTurkish } from '@/store/auth';
import { supabase } from '@/lib/supabase';

export type ParentLink = {
  role: 'parent' | 'child';
  otherId: string;
  otherUsername: string;
  otherName: string;
  otherAvatar: string;
  status: 'active' | 'unlink_requested';
  dailyLimitMin: number | null;
  lockPrivate: boolean;
  lockComments: boolean;
};

type Res<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function fetchParentLinks(): Promise<ParentLink[] | null> {
  const { data, error } = await supabase.rpc('my_parent_links');
  if (error) return null;
  return (data ?? []).map((r: any) => ({
    role: r.role,
    otherId: r.other_id,
    otherUsername: r.other_username,
    otherName: r.other_name,
    otherAvatar: r.other_avatar ?? '',
    status: r.status,
    dailyLimitMin: r.daily_limit_min,
    lockPrivate: r.lock_private,
    lockComments: r.lock_comments,
  }));
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<Res<T>> {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? { ok: false, error: toTurkish(error) } : { ok: true, data: data as T };
}

export const createParentCode = () => call<string>('parent_create_code');
/** Yanlış ya da süresi dolmuş kodda sunucu boş döner (deneme sınırı geri alınmasın diye hata fırlatmaz). */
export async function linkParent(code: string): Promise<Res<string>> {
  const r = await call<string | null>('parent_link', { p_code: code });
  if (!r.ok) return r;
  if (!r.data) return { ok: false, error: 'Kod hatalı ya da süresi dolmuş. Çocuğundan yeni kod iste.' };
  return { ok: true, data: r.data };
}
export const setParentControls = (child: string, dailyLimit: number | null, lockPrivate: boolean, lockComments: boolean) =>
  call('parent_set_controls', {
    p_child: child,
    p_daily_limit: dailyLimit,
    p_lock_private: lockPrivate,
    p_lock_comments: lockComments,
  });
export const unlinkChild = (child: string) => call('parent_unlink', { p_child: child });
export const keepLink = (child: string) => call('parent_keep_link', { p_child: child });
export const requestUnlink = () => call('child_request_unlink');
