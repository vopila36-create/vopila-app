/** Keşif verileri (0023_home_discovery.sql): gündemdeki gönderiler ve etiketler, takip önerileri. */
import type { Post } from '@/data/mock';
import { fetchPosts } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';

export type Person = { id: string; username: string; name: string; avatar: string; verified: boolean; followers: number };
export type Discover = { posts: Post[]; tags: { tag: string; posts: number }[]; people: Person[] };

export async function loadDiscover(
  myId: string,
  limits: { posts: number; tags: number; people: number },
): Promise<Discover> {
  const [tp, tt, sp] = await Promise.all([
    supabase.rpc('trending_posts', { p_limit: limits.posts }),
    supabase.rpc('trending_tags', { p_limit: limits.tags }),
    supabase.rpc('suggest_people', { p_limit: limits.people }),
  ]);
  const ids: string[] = (tp.data ?? []).map((r: { post_id: string }) => r.post_id);
  let posts: Post[] = [];
  if (ids.length) {
    const res = await fetchPosts(myId, { ids });
    if (res.ok) {
      const byId = new Map(res.data.posts.map((p) => [p.id, p]));
      posts = ids.map((id) => byId.get(id)).filter((p): p is Post => !!p);
    }
  }
  return {
    posts,
    tags: tt.data ?? [],
    people: (sp.data ?? []).map((p: any) => ({
      id: p.id,
      username: p.username,
      name: p.name,
      avatar: p.avatar_url ?? '',
      verified: p.verified,
      followers: p.followers,
    })),
  };
}

