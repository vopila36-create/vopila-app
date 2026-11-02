/**
 * Token Mağazası (Trendyol/Amazon'dan uyanlar): arama, sıralama, filtreler (bakiyeme uygun, stokta),
 * favoriler, puanlar, stok rozetleri, son baktıkların. Tokenler satın alınamaz; arenalarda kazanılır.
 */
import { router, type Href } from 'expo-router';
import { Coins, Heart, Info, Package, Search, ShoppingCart, Wallet, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { recentlyViewed } from '@/lib/recently-viewed';
import { formatTokens, useStore } from '@/store/app-store';

const SORTS = [
  { key: 'recommended', label: 'Önerilen' },
  { key: 'priceAsc', label: 'Fiyat ↑' },
  { key: 'priceDesc', label: 'Fiyat ↓' },
  { key: 'newest', label: 'En yeni' },
  { key: 'bestseller', label: 'Çok satan' },
  { key: 'rating', label: 'En beğenilen' },
] as const;
type SortKey = (typeof SORTS)[number]['key'];

const norm = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export default function Magaza() {
  const store = useStore();
  const [cat, setCat] = useState<string>('Tümü');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recommended');
  const [affordableOnly, setAffordableOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const products = store.catalog;
  const CATEGORIES = ['Tümü', ...Array.from(new Set(products.map((p) => p.category)))];
  const go = (href: string) => router.push(href as Href);

  useEffect(() => {
    let alive = true;
    recentlyViewed().then((ids) => {
      if (alive) setRecent(ids);
    });
    return () => {
      alive = false;
    };
  }, []);

  const q = norm(query.trim());
  const filtered = products.filter(
    (p) =>
      (cat === 'Tümü' || p.category === cat) &&
      (!q || norm(`${p.name} ${p.category} ${p.description}`).includes(q)) &&
      (!affordableOnly || p.price <= store.balance) &&
      (!inStockOnly || p.stock > 0),
  );
  const score = (p: (typeof products)[number]) =>
    (p.stock > 0 ? 1000 : 0) + (p.soldCount ?? 0) * 2 + (p.rating?.average ?? 0) * (p.rating?.count ?? 0);
  const list = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'priceAsc':
        return a.price - b.price;
      case 'priceDesc':
        return b.price - a.price;
      case 'newest':
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
      case 'bestseller':
        return (b.soldCount ?? 0) - (a.soldCount ?? 0);
      case 'rating':
        return (b.rating?.average ?? 0) - (a.rating?.average ?? 0) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0);
      default:
        return score(b) - score(a);
    }
  });
  const recentProducts = recent.map((id) => store.productOf(id)).filter((p): p is NonNullable<typeof p> => !!p).slice(0, 10);
  const browsing = !q && cat === 'Tümü' && !affordableOnly && !inStockOnly;

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

        {store.myId ? (
          <Pressable style={styles.ordersLink} onPress={() => go('/favorilerim')}>
            <Heart size={18} color={Colors.heart} />
            <VText variant="label" style={{ flex: 1 }}>
              Favorilerim
            </VText>
            <VText variant="caption">{store.favoriteIds.length} ürün</VText>
          </Pressable>
        ) : null}
        <Pressable style={styles.ordersLink} onPress={() => go('/siparisler')}>
          <Package size={18} color={Colors.cyan} />
          <VText variant="label" style={{ flex: 1 }}>
            Siparişlerim
          </VText>
          <VText variant="caption">{store.orders.length} sipariş</VText>
        </Pressable>
      </View>

      <View style={[styles.pad, { marginTop: Spacing.md }]}>
        <View style={styles.search}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ürün, kategori ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCorrect={false}
            accessibilityLabel="Mağazada ara"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Aramayı temizle">
              <X size={18} color={Colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
        <Chip label="Bakiyeme uygun" active={affordableOnly} onPress={() => setAffordableOnly((v) => !v)} />
        <Chip label="Stokta olanlar" active={inStockOnly} onPress={() => setInStockOnly((v) => !v)} />
        {SORTS.map((s2) => (
          <Chip key={s2.key} label={s2.label} active={sort === s2.key} onPress={() => setSort(s2.key)} />
        ))}
      </ScrollView>

      {browsing && recentProducts.length ? (
        <View style={{ marginBottom: Spacing.md }}>
          <VText variant="label" style={[styles.pad, { marginBottom: 8 }]}>
            Son baktıkların
          </VText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
            {recentProducts.map((p) => (
              <ProductCard key={p.id} p={p} style={{ width: 150 }} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {store.catalogLoading ? (
        <View style={[styles.pad, { alignItems: 'center', paddingVertical: 30 }]}>
          <ActivityIndicator color={Colors.cyan} />
          <VText variant="caption" style={{ marginTop: 8 }}>
            Ürünler yükleniyor…
          </VText>
        </View>
      ) : !list.length ? (
        <EmptyState
          icon={<Search size={40} color={Colors.textMuted} />}
          title={products.length ? 'Sonuç bulunamadı' : 'Mağaza şu an boş'}
          text={products.length ? 'Aramanı ya da filtrelerini değiştirmeyi dene.' : 'Yeni ürünler eklendiğinde burada görünecek.'}
        />
      ) : (
        <View style={[styles.pad, styles.grid]}>
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </View>
      )}
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
  chips: { paddingHorizontal: Spacing.screen, gap: 8, paddingVertical: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 15 },
});
