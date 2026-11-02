import { describe, expect, it } from '@jest/globals';

import { rankByInterest, topicWeight } from '@/lib/feed-rank';

type Item = { id: string; topic: string };

const items: Item[] = Array.from({ length: 200 }, (_, i) => ({ id: `p${i}`, topic: i % 2 ? 'spor' : 'moda' }));
const base = { idOf: (x: Item) => x.id, topicOf: (x: Item) => x.topic };

describe('topicWeight', () => {
  it('ilgi yoksa her konu eşit (1)', () => {
    expect(topicWeight({}, 'spor')).toBe(1);
  });
  it('en çok izlenen konu 6, izlenmeyen 1', () => {
    const interests = { spor: 10, moda: 0 };
    expect(topicWeight(interests, 'spor')).toBe(6);
    expect(topicWeight(interests, 'moda')).toBe(1);
    expect(topicWeight(interests, 'yemek')).toBe(1);
  });
});

describe('rankByInterest', () => {
  it('hiçbir öğeyi kaybetmez ya da çoğaltmaz', () => {
    const out = rankByInterest(items, { ...base, interests: { spor: 5 }, seen: [], seed: 1 });
    expect(out).toHaveLength(items.length);
    expect(new Set(out.map((x) => x.id)).size).toBe(items.length);
  });

  it('aynı tohumla aynı sıra (oturum içinde sabit)', () => {
    const a = rankByInterest(items, { ...base, interests: {}, seen: [], seed: 42 });
    const b = rankByInterest(items, { ...base, interests: {}, seen: [], seed: 42 });
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
  });

  it('ilgilenilen konu üst sıralarda daha sık çıkar, ama diğer konu da görünür', () => {
    const out = rankByInterest(items, { ...base, interests: { spor: 10 }, seen: [], seed: 7 });
    const top = out.slice(0, 40);
    const spor = top.filter((x) => x.topic === 'spor').length;
    expect(spor).toBeGreaterThan(25);
    expect(spor).toBeLessThan(40);
  });

  it('görülmüş içerik geriye düşer', () => {
    const seen = items.filter((x) => x.topic === 'moda').map((x) => x.id);
    const out = rankByInterest(items, { ...base, interests: {}, seen, seed: 3 });
    const top = out.slice(0, 40);
    expect(top.filter((x) => x.topic === 'spor').length).toBeGreaterThan(30);
  });
});
