/**
 * Reels sıralaması: kullanıcının en çok izlediği konular daha sık ve daha önde çıkar,
 * ama başka konular da arada görünür (keşif). Görülmüş içerikler geriye düşer.
 *
 * Yöntem: her içeriğe bir ağırlık verilir (ilgi × ek puan × görülme cezası), sonra
 * ağırlıklı rastgele sıralama yapılır. Aynı oturumda sıra sabit kalsın diye tohum (seed) kullanılır.
 */

/** Konunun ağırlığı: hiç izlenmemiş konu 1, en çok izlenen konu 6. */
export function topicWeight(interests: Record<string, number>, topic: string) {
  const max = Math.max(0, ...Object.values(interests));
  if (!max) return 1;
  return 1 + 5 * ((interests[topic] ?? 0) / max);
}

/** Basit, tekrarlanabilir rastgele sayı (0–1). */
function seededRandom(seed: number, id: string) {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) + 1) / 4294967297;
}

const SEEN_PENALTY = 0.15;

export function rankByInterest<T>(
  items: T[],
  opts: {
    idOf: (item: T) => string;
    topicOf: (item: T) => string;
    interests: Record<string, number>;
    seen: string[];
    seed: number;
    /** İçeriğe özel ek ağırlık (ör. canlı haber, yüksek puanlı arena gönderisi). Varsayılan 1. */
    boost?: (item: T) => number;
  },
): T[] {
  const seen = new Set(opts.seen);
  const scored = items.map((item) => {
    const id = opts.idOf(item);
    const w =
      topicWeight(opts.interests, opts.topicOf(item)) * (opts.boost?.(item) ?? 1) * (seen.has(id) ? SEEN_PENALTY : 1);
    // Ağırlıklı rastgele sıralama (Efraimidis–Spirakis): büyük ağırlık → öne çıkma olasılığı yüksek
    const key = Math.pow(seededRandom(opts.seed, id), 1 / Math.max(w, 0.0001));
    return { item, key };
  });
  scored.sort((a, b) => b.key - a.key);
  return scored.map((s) => s.item);
}
