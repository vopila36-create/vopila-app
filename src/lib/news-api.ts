/**
 * Haberler (gerçek): Türk haber kaynaklarının RSS akışlarından sunucunun 15 dakikada bir çektiği
 * haberler (0016_news_feeds.sql) + yöneticinin elle eklediği haberler. Herkese açık okunur.
 * Telif: yalnızca başlık, kısa özet, görsel ve kaynağa bağlantı — haberin tamamı kaynakta okunur.
 */
import { img, type NewsArticle, type NewsCategory } from '@/data/mock';
import { timeAgo } from '@/lib/posts-api';
import { supabase } from '@/lib/supabase';

/** Görseli olmayan haberlere kategoriye göre yedek görsel. */
const FALLBACK: Record<NewsCategory, string> = {
  Gündem: img.satellite,
  Teknoloji: img.tech,
  Finans: img.stocks,
  Spor: img.football,
  Dünya: img.earth,
  Bilim: img.galaxy,
};

export async function fetchNews(limit = 200): Promise<NewsArticle[] | null> {
  const { data, error } = await supabase
    .from('news_articles')
    .select('id, category, title, summary, body, ai_summary, image_url, video_url, read_time, is_live, is_special, published_at, source_name, source_url')
    .order('published_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  const now = Date.now();
  return (data ?? []).map((n: any) => ({
    id: n.id,
    category: n.category,
    title: n.title,
    summary: n.summary,
    body: n.body ?? [],
    aiSummary: n.ai_summary ?? [],
    image: n.image_url || FALLBACK[n.category as NewsCategory] || img.earth,
    video: n.video_url ?? undefined,
    readTime: n.read_time || '1 dk',
    time: timeAgo(n.published_at),
    live: n.is_live,
    special: n.is_special,
    sourceName: n.source_name ?? undefined,
    sourceUrl: n.source_url ?? undefined,
    publishedAt: n.published_at,
    fresh: now - new Date(n.published_at).getTime() < 30 * 60 * 1000,
  }));
}
