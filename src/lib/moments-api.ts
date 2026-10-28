/**
 * Anlar (24 saatlik hikâyeler). Süresi dolanlar ve görme yetkin olmayanlar sunucu kuralıyla
 * (RLS) zaten gelmez; dosyalar gizli kovadan kısa süreli imzalı adreslerle açılır.
 */
import type { Media, Moment, User } from '@/data/mock';
import { AUTHOR, localId, one, toUser, uploadMedia, type ApiResult, type DbAuthor } from '@/lib/posts-api';
import { mediaUrls, supabase } from '@/lib/supabase';
import { toTurkish } from '@/store/auth';

export async function fetchMoments(myId: string): Promise<ApiResult<{ moments: Moment[]; authors: User[] }>> {
  const { data, error } = await supabase
    .from('moments')
    .select(`id, author_id, title, created_at, moment_items(type, storage_path, position), author:profiles!moments_author_id_fkey(${AUTHOR})`)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return { ok: false, error: toTurkish(error) };

  const rows = (data ?? []) as any[];
  const urls = await mediaUrls(rows.flatMap((r) => (r.moment_items ?? []).map((i: any) => i.storage_path)));
  const authors: User[] = [];
  const moments: Moment[] = rows
    .map((r) => {
      const a = one(r.author) as DbAuthor | null;
      if (a && a.id !== myId) authors.push(toUser(a));
      const media: Media[] = [...(r.moment_items ?? [])]
        .sort((x: any, y: any) => x.position - y.position)
        .map((i: any) => ({ type: i.type, uri: urls[i.storage_path] ?? '' }))
        .filter((m: Media) => m.uri);
      return {
        id: r.id,
        authorId: localId(r.author_id, myId),
        title: r.title || '',
        items: media.map((m) => m.uri),
        media,
        remote: true,
      };
    })
    .filter((m) => m.items.length);
  return { ok: true, data: { moments, authors } };
}

/** An paylaş: dosyaları yükler, anı ve ögelerini yazar; hata olursa geri alır. */
export async function createMoment(myId: string, media: Media[], title: string): Promise<ApiResult<{ id: string }>> {
  const uploaded: string[] = [];
  let momentId: string | null = null;
  try {
    for (const [i, m] of media.entries()) uploaded.push(await uploadMedia(myId, m, i));
    const { data, error } = await supabase
      .from('moments')
      .insert({ author_id: myId, title: title.slice(0, 40) })
      .select('id')
      .single();
    if (error) throw error;
    momentId = data.id as string;
    const { error: itemsErr } = await supabase
      .from('moment_items')
      .insert(media.map((m, i) => ({ moment_id: momentId, type: m.type, storage_path: uploaded[i], position: i })));
    if (itemsErr) throw itemsErr;
    return { ok: true, data: { id: momentId } };
  } catch (e: any) {
    if (momentId) await supabase.from('moments').delete().eq('id', momentId);
    if (uploaded.length) await supabase.storage.from('media').remove(uploaded);
    return { ok: false, error: toTurkish(e) };
  }
}

export async function deleteMoment(id: string): Promise<ApiResult> {
  const { error } = await supabase.from('moments').delete().eq('id', id);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}
