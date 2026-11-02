/**
 * Gönderiler için Supabase işlemleri: dosya yükleme, gönderi oluşturma, akış,
 * beğeni, kaydetme ve yorumlar. Güvenlik kuralları sunucuda (RLS) — burası yalnızca çağırır.
 * Giriş yapan kullanıcının kendi içerikleri ekranlarla uyumlu olsun diye `ME_ID` ile döner.
 */
import { ME_ID, type ArenaKey, type Comment, type Media, type Post, type User } from '@/data/mock';
import { fileSize, MAX_POST_BYTES, shrinkImage, tooBigMessage } from '@/lib/media-prep';
import { mediaUrls, supabase } from '@/lib/supabase';
import { uploadToStorage, type UploadProgress } from '@/lib/upload';
import { toTurkish } from '@/store/auth';

export type ApiResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export type DbAuthor = {
  id: string;
  username: string;
  name: string;
  avatar_url: string | null;
  verified: boolean;
  protected_media?: boolean;
};

export const AUTHOR = 'id, username, name, avatar_url, verified, protected_media';

/** Profili sunucuda gizlenen yazar (18 yaş altı, ilişki yok): adı ve fotoğrafı gösterilmez. */
export function hiddenUser(id: string): User {
  return {
    id,
    name: 'VOPILA kullanıcısı',
    username: 'vopila',
    avatar: '',
    verified: false,
    bio: '',
    location: '',
    cover: '',
    followers: 0,
    following: 0,
    discoveryPoints: 0,
    protected: true,
    hidden: true,
  };
}
const POST_SELECT =
  `id, author_id, caption, location, arena_key, created_at, sensitive, ai_generated, comments_off, pinned_at, edited_at, ` +
  `post_media(type, storage_path, poster_path, position), ` +
  `author:profiles!posts_author_id_fkey(${AUTHOR}), likes(count), comments(count), ` +
  `post_tags(user_id, user:profiles!post_tags_user_id_fkey(${AUTHOR}))`;
const COMMENT_SELECT =
  `id, text, created_at, author_id, parent_id, author:profiles!comments_author_id_fkey(${AUTHOR}), comment_likes(count)`;

/** "3 saat önce" gibi kısa zaman metni. */
export function timeAgo(iso: string) {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return 'şimdi';
  if (sec < 3600) return `${Math.floor(sec / 60)} dk önce`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} saat önce`;
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Veritabanındaki profil satırını ekranların kullandığı kullanıcı biçimine çevirir. */
export function toUser(a: DbAuthor): User {
  return {
    id: a.id,
    name: a.name,
    username: a.username,
    avatar: a.avatar_url ?? '',
    verified: a.verified,
    bio: '',
    location: '',
    cover: '',
    followers: 0,
    following: 0,
    discoveryPoints: 0,
    protected: !!a.protected_media,
  };
}

export const localId = (id: string, myId: string) => (id === myId ? ME_ID : id);
export const one = <T>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const countOf = (v: unknown) => (one(v as { count: number }[]) as { count: number } | null)?.count ?? 0;

// ─── Akış ───────────────────────────────────────────────────────────────────

export type Feed = { posts: Post[]; authors: User[]; liked: string[]; saved: string[] };

/** En yeni 50 gerçek gönderi + benim beğendiklerim ve kaydettiklerim. */
export async function fetchFeed(myId: string): Promise<ApiResult<Feed>> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .is('archived_at', null)
    .limit(50);
  if (error) return { ok: false, error: toTurkish(error) };

  const { posts, authors } = await mapPostRows((data ?? []) as any[], myId);

  const ids = posts.map((p) => p.id);
  const [likes, saves] = await Promise.all([
    ids.length
      ? supabase.from('likes').select('post_id').eq('user_id', myId).in('post_id', ids)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    supabase.from('saves').select('post_id').eq('user_id', myId),
  ]);

  return {
    ok: true,
    data: {
      posts,
      authors,
      liked: (likes.data ?? []).map((l) => l.post_id),
      saved: (saves.data ?? []).map((s) => s.post_id),
    },
  };
}

/** Belirli gönderiler: bir kullanıcının paylaşımları ya da #etiket araması. */
export async function fetchPosts(
  myId: string,
  filter: { authorId?: string; tag?: string; ids?: string[]; archived?: boolean; hideArchived?: boolean },
): Promise<ApiResult<{ posts: Post[]; authors: User[] }>> {
  let q = supabase.from('posts').select(POST_SELECT).order('created_at', { ascending: false }).limit(60);
  if (filter.authorId) q = q.eq('author_id', filter.authorId);
  // Arşivdekiler yalnızca Arşiv ekranında (sahibine) gösterilir
  if (filter.archived) q = q.not('archived_at', 'is', null);
  else if (!filter.ids || filter.hideArchived) q = q.is('archived_at', null);
  if (filter.tag) q = q.ilike('caption', `%#${filter.tag.replace(/[%_]/g, '')}%`);
  if (filter.ids) q = q.in('id', filter.ids.length ? filter.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data, error } = await q;
  if (error) return { ok: false, error: toTurkish(error) };
  const mapped = await mapPostRows((data ?? []) as any[], myId);
  // Profilde sabitlenen gönderiler en üstte (Instagram gibi)
  if (filter.authorId && !filter.archived) {
    const pinAt = new Map((data ?? []).map((r: any) => [r.id as string, r.pinned_at ? Date.parse(r.pinned_at) : 0]));
    mapped.posts.sort((a, b) => (pinAt.get(b.id) ?? 0) - (pinAt.get(a.id) ?? 0));
  }
  return { ok: true, data: mapped };
}

/** Verilen gönderilerden hangilerini beğendim / kaydettim. */
export async function fetchMyFlags(myId: string, ids: string[]): Promise<{ liked: string[]; saved: string[] }> {
  if (!ids.length) return { liked: [], saved: [] };
  const [likes, saves] = await Promise.all([
    supabase.from('likes').select('post_id').eq('user_id', myId).in('post_id', ids),
    supabase.from('saves').select('post_id').eq('user_id', myId).in('post_id', ids),
  ]);
  return {
    liked: (likes.data ?? []).map((l) => l.post_id),
    saved: (saves.data ?? []).map((s) => s.post_id),
  };
}

async function mapPostRows(rows: any[], myId: string): Promise<{ posts: Post[]; authors: User[] }> {
  const paths = rows.flatMap((r) =>
    (r.post_media ?? []).flatMap((m: any) => [m.storage_path, m.poster_path].filter(Boolean)),
  );
  const urls = await mediaUrls(paths);

  const authors: User[] = [];
  const posts: Post[] = rows.map((r) => {
    const author = one(r.author) as DbAuthor | null;
    if (author && author.id !== myId) authors.push(toUser(author));
    const tagged: string[] = [];
    for (const t of r.post_tags ?? []) {
      const u = one(t.user) as DbAuthor | null;
      if (!u) continue;
      if (u.id !== myId) authors.push(toUser(u));
      tagged.push(localId(u.id, myId));
    }
    const media: Media[] = [...(r.post_media ?? [])]
      .sort((a: any, b: any) => a.position - b.position)
      .map((m: any) => ({
        type: m.type,
        uri: urls[m.storage_path] ?? '',
        poster: m.poster_path ? (urls[m.poster_path] ?? undefined) : undefined,
      }))
      .filter((m: Media) => m.uri);
    return {
      id: r.id,
      authorId: localId(r.author_id, myId),
      location: r.location,
      time: timeAgo(r.created_at),
      media,
      caption: r.caption,
      likes: countOf(r.likes),
      comments: [],
      commentCount: countOf(r.comments),
      arenaKey: r.arena_key ?? undefined,
      sensitive: !!r.sensitive,
      aiGenerated: !!r.ai_generated,
      commentsOff: !!r.comments_off,
      pinned: !!r.pinned_at,
      edited: !!r.edited_at,
      tagged,
      remote: true,
    };
  });
  return { posts, authors };
}

// ─── Gönderi oluşturma ──────────────────────────────────────────────────────

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

function fileType(m: Media) {
  const ext = m.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  if (MIME[ext]) return { ext, contentType: MIME[ext] };
  return m.type === 'video' ? { ext: 'mp4', contentType: 'video/mp4' } : { ext: 'jpg', contentType: 'image/jpeg' };
}

/** Telefondaki dosyayı kullanıcının kendi klasörüne ({uid}/...) yükler, dosya yolunu döner. */
export async function uploadMedia(myId: string, m: Media, index: number, onProgress?: UploadProgress) {
  // Fotoğraf küçültülür (JPEG); video boyutu yüklemeden önce kontrol edilir (media-prep.ts)
  const uri = m.type === 'image' ? await shrinkImage(m.uri) : m.uri;
  const { ext, contentType } = uri === m.uri ? fileType(m) : { ext: 'jpg', contentType: 'image/jpeg' };
  const size = await fileSize(uri);
  if (size && size > MAX_POST_BYTES) throw new Error(tooBigMessage(MAX_POST_BYTES));
  const path = `${myId}/${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  // Dosya belleğe alınmadan, yüzde bildirerek yüklenir (upload.ts)
  await uploadToStorage('media', path, uri, contentType, { onProgress });
  return path;
}

export type NewPost = {
  media: Media[];
  caption: string;
  location?: string;
  arenaKey?: ArenaKey;
  title?: string;
  /** Hassas içerik (18 altına gösterilmez) */
  sensitive?: boolean;
  /** Yapay zekâ ile üretildi */
  aiGenerated?: boolean;
  /** Etiketlenen kişilerin kimlikleri */
  tags?: string[];
};

/**
 * Dosyaları yükler, gönderiyi ve medya satırlarını yazar; arena seçildiyse açık sezona katılır.
 * Bir adım başarısız olursa yüklenenler geri alınır (yarım gönderi kalmaz).
 */
export async function createRemotePost(
  myId: string,
  input: NewPost,
  onProgress?: UploadProgress,
): Promise<ApiResult<{ id: string }>> {
  const uploaded: string[] = [];
  let postId: string | null = null;
  try {
    const n = input.media.length;
    for (const [i, m] of input.media.entries())
      uploaded.push(await uploadMedia(myId, m, i, onProgress && ((f) => onProgress((i + f) / n))));

    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({
        author_id: myId,
        caption: input.caption,
        location: input.location ?? '',
        arena_key: input.arenaKey ?? null,
        sensitive: !!input.sensitive,
        ai_generated: !!input.aiGenerated,
      })
      .select('id')
      .single();
    if (postErr) throw postErr;
    postId = post.id as string;

    const { error: mediaErr } = await supabase.from('post_media').insert(
      input.media.map((m, i) => ({ post_id: postId, type: m.type, storage_path: uploaded[i], position: i })),
    );
    if (mediaErr) throw mediaErr;

    // Etiketler: izin vermeyen kişi sessizce atlanır, gönderi yine paylaşılır
    for (const uid of (input.tags ?? []).slice(0, 20)) {
      await supabase.from('post_tags').insert({ post_id: postId, user_id: uid });
    }

    if (input.arenaKey) {
      const { data: season } = await supabase
        .from('arena_seasons')
        .select('id')
        .eq('arena_key', input.arenaKey)
        .eq('status', 'open')
        .maybeSingle();
      if (!season) throw new Error('season_closed');
      const coverIndex = input.media.findIndex((m) => m.type === 'image');
      const { error: entryErr } = await supabase.from('arena_entries').insert({
        season_id: season.id,
        author_id: myId,
        post_id: postId,
        title: (input.title || input.caption).slice(0, 60),
        image_path: coverIndex >= 0 ? uploaded[coverIndex] : null,
      });
      if (entryErr) throw entryErr;
    }

    return { ok: true, data: { id: postId } };
  } catch (e: any) {
    if (postId) await supabase.from('posts').delete().eq('id', postId);
    if (uploaded.length) await supabase.storage.from('media').remove(uploaded);
    if (String(e?.message ?? '').includes('season_closed'))
      return { ok: false, error: 'Bu arenanın sezonu şu an kapalı. Arenasız paylaşabilirsin.' };
    if (/^(Dosya|Oturum)/.test(String(e?.message ?? ''))) return { ok: false, error: String(e.message) };
    if (String(e?.message ?? '').toLowerCase().includes('exceeded the maximum allowed size'))
      return { ok: false, error: 'Dosya çok büyük. Daha kısa bir video ya da başka bir fotoğraf seç.' };
    return { ok: false, error: toTurkish(e) };
  }
}

// ─── Beğeni, kaydetme, yorum ────────────────────────────────────────────────

export async function setLike(myId: string, postId: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('likes').insert({ user_id: myId, post_id: postId })
    : await supabase.from('likes').delete().eq('user_id', myId).eq('post_id', postId);
  // Aynı beğeni zaten varsa sorun değil
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

export async function setSave(myId: string, postId: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('saves').insert({ user_id: myId, post_id: postId })
    : await supabase.from('saves').delete().eq('user_id', myId).eq('post_id', postId);
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

export type CommentsResult = { comments: Comment[]; authors: User[] };

function mapComments(rows: any[], myId: string): CommentsResult {
  const authors: User[] = [];
  const comments = rows.map((r) => {
    const author = one(r.author) as DbAuthor | null;
    if (author && author.id !== myId) authors.push(toUser(author));
    return {
      id: r.id,
      authorId: localId(r.author_id, myId),
      text: r.text,
      time: timeAgo(r.created_at),
      parentId: r.parent_id ?? undefined,
      likes: countOf(r.comment_likes),
      liked: false,
    };
  });
  return { comments, authors };
}

export async function fetchComments(myId: string, postId: string): Promise<ApiResult<CommentsResult>> {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) return { ok: false, error: toTurkish(error) };
  const res = mapComments(data ?? [], myId);
  const ids = res.comments.map((c) => c.id);
  if (ids.length) {
    const { data: mine } = await supabase.from('comment_likes').select('comment_id').eq('user_id', myId).in('comment_id', ids);
    const set = new Set((mine ?? []).map((m) => m.comment_id as string));
    for (const c of res.comments) c.liked = set.has(c.id);
  }
  return { ok: true, data: res };
}

/** Yorumu beğen / beğeniyi geri al. */
export async function setCommentLike(myId: string, commentId: string, on: boolean): Promise<ApiResult> {
  const { error } = on
    ? await supabase.from('comment_likes').insert({ user_id: myId, comment_id: commentId })
    : await supabase.from('comment_likes').delete().eq('user_id', myId).eq('comment_id', commentId);
  if (error && error.code !== '23505') return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

// ─── Gönderi yönetimi (sahibi) ──────────────────────────────────────────────

/** Açıklama ve konumu düzenler (sunucu "düzenlendi" işaretini koyar). */
export async function editPost(postId: string, caption: string, location: string): Promise<ApiResult> {
  const { error } = await supabase
    .from('posts')
    .update({ caption: caption.slice(0, 500), location: location.slice(0, 80) })
    .eq('id', postId);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

/** Yorumları kapat/aç ya da profilde sabitle/kaldır. */
export async function setPostFlags(postId: string, flags: { commentsOff?: boolean; pinned?: boolean }): Promise<ApiResult> {
  const update: Record<string, unknown> = {};
  if (flags.commentsOff !== undefined) update.comments_off = flags.commentsOff;
  if (flags.pinned !== undefined) update.pinned_at = flags.pinned ? new Date().toISOString() : null;
  const { error } = await supabase.from('posts').update(update).eq('id', postId);
  if (error) {
    if (String(error.message).includes('pin_limit')) return { ok: false, error: 'En fazla 3 gönderi sabitleyebilirsin.' };
    return { ok: false, error: toTurkish(error) };
  }
  return { ok: true, data: undefined };
}

/** Gönderiyi kalıcı olarak siler; dosyaları da depodan kaldırır. */
export async function deletePost(postId: string): Promise<ApiResult> {
  const { data: media } = await supabase.from('post_media').select('storage_path, poster_path').eq('post_id', postId);
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) return { ok: false, error: toTurkish(error) };
  const paths = (media ?? []).flatMap((m: any) => [m.storage_path, m.poster_path]).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from('media').remove(paths);
  return { ok: true, data: undefined };
}

/** Gönderideki etiketleri verilen listeye eşitler (eklenenler eklenir, çıkarılanlar silinir). */
export async function setPostTags(postId: string, before: string[], after: string[]): Promise<ApiResult> {
  const add = after.filter((id) => !before.includes(id));
  const remove = before.filter((id) => !after.includes(id));
  if (remove.length) {
    const { error } = await supabase.from('post_tags').delete().eq('post_id', postId).in('user_id', remove);
    if (error) return { ok: false, error: toTurkish(error) };
  }
  for (const id of add) {
    const { error } = await supabase.from('post_tags').insert({ post_id: postId, user_id: id });
    if (error && error.code !== '23505') {
      if (String(error.message).includes('tag_removed')) return { ok: false, error: 'Bu kişi kendini bu gönderiden kaldırdı; yeniden etiketlenemez.' };
      if (String(error.message).includes('tag_limit')) return { ok: false, error: 'Bir gönderide en fazla 20 kişi etiketlenebilir.' };
      if (error.code === '42501') return { ok: false, error: 'Seçtiğin kişilerden biri etiketlenmeye izin vermiyor.' };
      return { ok: false, error: toTurkish(error) };
    }
  }
  return { ok: true, data: undefined };
}

/** Kendimi bir gönderiden etiket olarak kaldırırım. */
export async function removeMyTag(myId: string, postId: string): Promise<ApiResult> {
  const { error } = await supabase.from('post_tags').delete().eq('post_id', postId).eq('user_id', myId);
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: undefined };
}

/** Bir kişinin etiketlendiği gönderiler (profilde "Etiketlenenler" sekmesi). */
export async function fetchTaggedPosts(myId: string, userId: string): Promise<ApiResult<{ posts: Post[]; authors: User[] }>> {
  const { data, error } = await supabase
    .from('post_tags')
    .select('post_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) return { ok: false, error: toTurkish(error) };
  const ids = (data ?? []).map((d) => d.post_id as string);
  if (!ids.length) return { ok: true, data: { posts: [], authors: [] } };
  return fetchPosts(myId, { ids, hideArchived: true });
}

export async function addRemoteComment(
  myId: string,
  postId: string,
  text: string,
  parentId?: string,
): Promise<ApiResult<Comment>> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: myId, text, parent_id: parentId ?? null })
    .select(COMMENT_SELECT)
    .single();
  if (error) return { ok: false, error: toTurkish(error) };
  return { ok: true, data: mapComments([data], myId).comments[0] };
}
