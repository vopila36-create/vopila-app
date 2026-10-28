/**
 * Öne Çıkanlar (0028_highlights.sql): profilde kalıcı an albümleri + kendi an arşivim.
 * Albüme eklenen anın ögeleri kopyalanır; an silinse ya da süresi dolsa da albüm kalır.
 */
import type { Media } from '@/data/mock';
import type { ApiResult } from '@/lib/posts-api';
import { mediaUrls, supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export type Highlight = { id: string; ownerId: string; title: string; items: Media[]; cover: string };
export type ArchivedMoment = { id: string; title: string; createdAt: string; closeFriends: boolean; items: Media[] };

function hlError(e: { message?: string; code?: string }) {
  const m = (e.message ?? '').toLowerCase();
  if (m.includes('close_friends_moment')) return 'Yakın Arkadaşlar’a özel anlar Öne Çıkanlar’a eklenemez.';
  if (m.includes('highlight_full')) return 'Bir albüme en çok 100 öge eklenebilir.';
  return toTurkish(e);
}

export async function fetchHighlights(ownerId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('id, owner_id, title, created_at, highlight_items(type, storage_path, position)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: true });
  if (error || !data) return [];
  const urls = await mediaUrls(data.flatMap((h: any) => (h.highlight_items ?? []).map((i: any) => i.storage_path)));
  return data
    .map((h: any) => {
      const items: Media[] = [...(h.highlight_items ?? [])]
        .sort((a: any, b: any) => a.position - b.position)
        .map((i: any) => ({ type: i.type, uri: urls[i.storage_path] ?? '' }))
        .filter((m: Media) => m.uri);
      return { id: h.id, ownerId: h.owner_id, title: h.title, items, cover: items[0]?.uri ?? '' };
    })
    .filter((h) => h.items.length);
}

export async function fetchHighlight(id: string): Promise<Highlight | null> {
  const { data } = await supabase.from('highlights').select('owner_id').eq('id', id).maybeSingle();
  if (!data) return null;
  return (await fetchHighlights(data.owner_id)).find((h) => h.id === id) ?? null;
}

/** Kendi anlarım (süresi dolmuşlar dahil) — albüme eklemek için */
export async function fetchMyMomentArchive(myId: string): Promise<ArchivedMoment[]> {
  const { data, error } = await supabase
    .from('moments')
    .select('id, title, created_at, close_friends, moment_items(type, storage_path, position)')
    .eq('author_id', myId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const urls = await mediaUrls(data.flatMap((m: any) => (m.moment_items ?? []).map((i: any) => i.storage_path)));
  return data
    .map((m: any) => ({
      id: m.id,
      title: m.title || '',
      createdAt: m.created_at,
      closeFriends: !!m.close_friends,
      items: [...(m.moment_items ?? [])]
        .sort((a: any, b: any) => a.position - b.position)
        .map((i: any) => ({ type: i.type, uri: urls[i.storage_path] ?? '' }))
        .filter((x: Media) => x.uri),
    }))
    .filter((m) => m.items.length);
}

/** Yeni albüm oluşturur ve seçilen anları ekler. */
export async function createHighlight(myId: string, title: string, momentIds: string[]): Promise<ApiResult<string>> {
  const { data, error } = await supabase
    .from('highlights')
    .insert({ owner_id: myId, title: title.trim().slice(0, 20) })
    .select('id')
    .single();
  if (error) return { ok: false, error: hlError(error) };
  for (const m of momentIds) {
    const r = await supabase.rpc('add_moment_to_highlight', { p_highlight: data.id, p_moment: m });
    if (r.error) {
      await supabase.from('highlights').delete().eq('id', data.id);
      return { ok: false, error: hlError(r.error) };
    }
  }
  return { ok: true, data: data.id as string };
}

export async function deleteHighlight(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('highlights').delete().eq('id', id);
  return error ? { ok: false, error: hlError(error) } : { ok: true, data: undefined };
}
