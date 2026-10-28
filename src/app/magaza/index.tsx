import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, Coins, Info, Package, Plus, ShoppingCart, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip, GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Product } from '@/data/mock';
import { formatTokens, useStore } from '@/store/app-store';


export default function Magaza() {
  const store = useStore();
  const [cat, setCat] = useState<string>('Tümü');
  const [added, setAdded] = useState<string | null>(null);
  const products = store.catalog;
  const CATEGORIES = ['Tümü', ...Array.from(new Set(products.map((p) => p.category)))];
  const list = cat === 'Tümü' ? products : products.filter((p) => p.category === cat);
  const go = (href: string) => router.push(href as Href);

  const add = (p: Product) => {
    store.addToCart(p.id);
    setAdded(p.id);
    setTimeout(() => setAdded((cur) => (cur === p.id ? null : cur)), 1500);
  };

  return (
    <SubScreen
      title="Token Mağazası"
      right={
        <Pressable onPress={() => go('/sepet')} hitSlop={8} accessibilityLabel="Sepet">
          <ShoppingCart size={24} color={Colors.text} />
          {store.cartCount ? (
            <View style={styles.badge}>
              <VText style={styles.badgeText}>{store.cartCount}</VText>
            </View>
          ) : null}
        </Pressable>
      }>
      <View style={styles.pad}>
        {/* Bakiye */}
        <GlassCard style={styles.balance} highlighted>
          <View style={styles.coin}>
            <Coins size={26} color={Colors.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <VText variant="caption">Token Bakiyen</VText>
            <VText style={styles.balanceText}>{formatTokens(store.balance)}</VText>
          </View>
          <Pressable style={styles.smallBtn} onPress={() => go('/cuzdan')}>
            <Wallet size={16} color={Colors.text} />
            <VText variant="label">Cüzdan</VText>
          </Pressable>
        </GlassCard>

        <Pressable style={styles.info} onPress={() => go('/arena-listesi')}>
          <Info size={16} color={Colors.cyan} />
          <VText variant="caption" color={Colors.textSecondary} style={{ flex: 1 }}>
            Tokenler satın alınamaz; yalnızca arena yarışmalarını kazanarak elde edilir.{' '}
            <VText variant="caption" color={Colors.cyan}>
              Token nasıl kazanılır?
            </VText>
          </VText>
        </Pressable>

        <Pressable style={styles.ordersLink} onPress={() => go('/siparisler')}>
          <Package size={18} color={Colors.cyan} />
          <VText variant="label" style={{ flex: 1 }}>
            Siparişlerim
          </VText>
          <VText variant="caption">{store.orders.length} sipariş</VText>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} />
        ))}
      </ScrollView>

      <View style={[styles.pad, styles.grid]}>
        {list.map((p) => {
          const affordable = p.price <= store.balance;
          const justAdded = added === p.id;
          return (
            <Pressable key={p.id} style={styles.card} onPress={() => go(`/magaza/${p.id}`)}>
              <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" transition={200} />
              <View style={{ padding: 10, gap: 4, flex: 1 }}>
                <VText variant="caption" style={{ fontSize: 10.5 }}>
                  {p.category}
                </VText>
                <VText variant="label" numberOfLines={2} style={{ minHeight: 34 }}>
                  {p.name}
                </VText>
                <View style={styles.priceRow}>
                  <Coins size={14} color={Colors.gold} />
                  <VText variant="bodyBold" color={Colors.gold}>
                    {formatTokens(p.price)}
                  </VText>
                </View>
                {!affordable ? (
                  <VText variant="caption" color={Colors.textMuted} style={{ fontSize: 10.5 }}>
                    {formatTokens(p.price - store.balance)} token eksik
                  </VText>
                ) : null}
                <Pressable
                  style={[styles.addBtn, justAdded && { backgroundColor: Colors.success, borderColor: Colors.success }]}
                  onPress={() => add(p)}>
                  {justAdded ? <Check size={14} color={Colors.onCyan} /> : <Plus size={14} color={Colors.onCyan} />}
                  <VText style={styles.addText}>{justAdded ? 'Eklendi' : 'Sepete ekle'}</VText>
                </Pressable>
              </View>
            </Pressable>
          );
        })}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: Fonts.bold, fontSize: 10, color: Colors.onCyan },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  coin: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: { fontFamily: Fonts.extrabold, fontSize: 26, color: Colors.text },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  info: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: Spacing.md },
  ordersLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.md,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chips: { paddingHorizontal: Spacing.screen, gap: 8, paddingVertical: Spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48.5%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  img: { width: '100%', aspectRatio: 1.1 },
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
