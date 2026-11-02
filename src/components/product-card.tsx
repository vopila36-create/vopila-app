/**
 * Mağaza ürün kartı (Trendyol/Amazon tarzı): görsel, favori kalbi, stok rozeti, puan, fiyat, sepete ekle.
 * Mağaza ana sayfası, Favorilerim ve "Benzer ürünler" bu kartı kullanır.
 */
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, Coins, Heart, Plus, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Product } from '@/data/mock';
import { formatTokens, useStore } from '@/store/app-store';

export function ProductCard({ p, style }: { p: Product; style?: StyleProp<ViewStyle> }) {
  const store = useStore();
  const [added, setAdded] = useState(false);
  const fav = store.favoriteIds.includes(p.id);
  const affordable = p.price <= store.balance;
  const soldOut = p.stock <= 0;
  const inCart = store.state.cart[p.id] ?? 0;
  const full = inCart >= p.stock;

  const add = () => {
    if (soldOut || full) return;
    store.addToCart(p.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <Pressable style={[styles.card, style]} onPress={() => router.push(`/magaza/${p.id}` as Href)}>
      <View>
        <Image source={{ uri: p.image }} style={[styles.img, soldOut && { opacity: 0.45 }]} contentFit="cover" transition={200} />
        {store.myId ? (
          <Pressable
            style={styles.heart}
            onPress={() => store.toggleFavorite(p.id)}
            hitSlop={8}
            accessibilityLabel={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}>
            <Heart size={18} color={fav ? Colors.heart : '#fff'} fill={fav ? Colors.heart : 'transparent'} />
          </Pressable>
        ) : null}
        {soldOut ? (
          <View style={[styles.tag, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <VText style={styles.tagText}>Tükendi</VText>
          </View>
        ) : p.stock <= 3 ? (
          <View style={[styles.tag, { backgroundColor: Colors.live }]}>
            <VText style={styles.tagText}>Son {p.stock} ürün</VText>
          </View>
        ) : (p.soldCount ?? 0) >= 10 ? (
          <View style={[styles.tag, { backgroundColor: Colors.gold }]}>
            <VText style={[styles.tagText, { color: Colors.onCyan }]}>Çok satan</VText>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 10, gap: 4, flex: 1 }}>
        <VText variant="caption" style={{ fontSize: 10.5 }}>
          {p.category}
        </VText>
        <VText variant="label" numberOfLines={2} style={{ minHeight: 34 }}>
          {p.name}
        </VText>
        {p.rating?.count ? (
          <View style={styles.ratingRow}>
            <Star size={12} color={Colors.gold} fill={Colors.gold} />
            <VText variant="caption" style={{ fontSize: 11 }}>
              {p.rating.average.toFixed(1)} ({p.rating.count})
            </VText>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Coins size={14} color={Colors.gold} />
          <VText variant="bodyBold" color={Colors.gold}>
            {formatTokens(p.price)}
          </VText>
        </View>
        {!affordable && !soldOut ? (
          <VText variant="caption" color={Colors.textMuted} style={{ fontSize: 10.5 }}>
            {formatTokens(p.price - store.balance)} token eksik
          </VText>
        ) : null}
        <Pressable
          style={[
            styles.addBtn,
            added && { backgroundColor: Colors.success, borderColor: Colors.success },
            (soldOut || full) && { opacity: 0.45 },
          ]}
          disabled={soldOut || full}
          onPress={add}>
          {added ? <Check size={14} color={Colors.onCyan} /> : <Plus size={14} color={Colors.onCyan} />}
          <VText style={styles.addText}>{soldOut ? 'Tükendi' : full ? 'Sepette' : added ? 'Eklendi' : 'Sepete ekle'}</VText>
        </Pressable>
      </View>
    </Pressable>
  );
}

/** Yıldızlar (yuvarlanmış tam yıldız). */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} color={Colors.gold} fill={i <= Math.round(value) ? Colors.gold : 'transparent'} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48.5%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  img: { width: '100%', aspectRatio: 1.1 },
  heart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: { position: 'absolute', left: 8, bottom: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill },
  tagText: { fontFamily: Fonts.bold, fontSize: 10.5, color: '#fff' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    marginTop: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyan,
    borderWidth: 1,
    borderColor: Colors.cyan,
  },
  addText: { fontFamily: Fonts.bold, fontSize: 12, color: Colors.onCyan },
});
