/**
 * Ürün detayı (Trendyol/Amazon'dan uyanlar): kaydırmalı galeri, favori, doğrulanmış alıcı puanı ve yorumları,
 * tahmini teslim, stok, benzer ürünler. Ürün "Son baktıkların"a eklenir.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { BadgeCheck, Check, Coins, Flag, Heart, Minus, PackageX, Plus, RotateCcw, ShoppingCart, Truck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ProductCard, Stars } from '@/components/product-card';
import { ReportSheet, type ReportTarget } from '@/components/report-sheet';
import { Avatar, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { markViewed } from '@/lib/recently-viewed';
import { deliveryEstimate, fetchReviews, type Review } from '@/lib/shop-api';
import { formatTokens, useStore } from '@/store/app-store';

export default function UrunDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const product = store.productOf(id ?? '');
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [slide, setSlide] = useState(0);
  const [width, setWidth] = useState(0);
  const [reviews, setReviews] = useState<{ id: string; list: Review[] } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  useEffect(() => {
    if (!id) return;
    markViewed(String(id));
    let alive = true;
    fetchReviews(String(id)).then((list) => {
      if (alive) setReviews({ id: String(id), list });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!product) {
    return (
      <SubScreen title="Ürün">
        <EmptyState
          icon={<PackageX size={40} color={Colors.textMuted} />}
          title="Ürün bulunamadı"
          action={<OutlineButton label="Mağazaya dön" onPress={() => router.replace('/magaza' as Href)} />}
        />
      </SubScreen>
    );
  }

  const inCart = store.state.cart[product.id] ?? 0;
  const maxQty = Math.max(0, product.stock - inCart);
  const total = product.price * qty;
  const affordable = store.cartTotal + total <= store.balance;
  const images = product.images?.length ? product.images : [product.image];
  const fav = store.favoriteIds.includes(product.id);
  const list = reviews?.id === product.id ? reviews.list : [];
  const similar = store.catalog.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 8);

  const addToCart = () => {
    if (maxQty <= 0) return;
    store.setCartQty(product.id, inCart + Math.min(qty, maxQty));
    setAdded(true);
  };

  return (
    <SubScreen
      title={product.category}
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          {store.myId ? (
            <Pressable onPress={() => store.toggleFavorite(product.id)} hitSlop={8} accessibilityLabel={fav ? 'Favorilerden çıkar' : 'Favorilere ekle'}>
              <Heart size={24} color={fav ? Colors.heart : Colors.text} fill={fav ? Colors.heart : 'transparent'} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/sepet' as Href)} hitSlop={8} accessibilityLabel="Sepet">
            <ShoppingCart size={24} color={Colors.text} />
            {store.cartCount ? (
              <View style={styles.badge}>
                <VText style={styles.badgeText}>{store.cartCount}</VText>
              </View>
            ) : null}
          </Pressable>
        </View>
      }>
      <View style={styles.pad}>
        <View style={styles.imgWrap} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setSlide(Math.round(e.nativeEvent.contentOffset.x / width))}>
              {images.map((uri, i) => (
                <Image key={`${uri}-${i}`} source={{ uri }} style={{ width, height: '100%' }} contentFit="cover" transition={200} />
              ))}
            </ScrollView>
          ) : null}
          {images.length > 1 ? (
            <View style={styles.dots}>
              {images.map((_, i) => (
                <View key={i} style={[styles.dot, i === slide && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>
        <VText variant="title" style={{ marginTop: Spacing.lg, fontSize: 24, lineHeight: 30 }}>
          {product.name}
        </VText>
        {product.rating?.count ? (
          <View style={styles.ratingRow}>
            <Stars value={product.rating.average} />
            <VText variant="label">{product.rating.average.toFixed(1)}</VText>
            <VText variant="caption">· {product.rating.count} değerlendirme</VText>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Coins size={20} color={Colors.gold} />
          <VText style={styles.price}>{formatTokens(product.price)}</VText>
          <VText variant="caption">token</VText>
        </View>
        <VText variant="body" style={{ marginTop: Spacing.md }}>
          {product.description}
        </VText>

        <GlassCard style={styles.card}>
          <View style={styles.line}>
            <Truck size={16} color={Colors.cyan} />
            <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
              Ücretsiz kargo · {deliveryEstimate('preparing')}
            </VText>
          </View>
          <View style={styles.line}>
            <Check size={16} color={product.stock > 0 ? Colors.success : Colors.live} />
            <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
              {product.stock > 0 ? `Stokta ${product.stock} adet` : 'Stokta yok'}
              {inCart ? ` · Sepetinde ${inCart} adet` : ''}
            </VText>
          </View>
          <View style={styles.line}>
            <RotateCcw size={16} color={Colors.cyanSoft} />
            <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
              Teslimden sonra 14 gün içinde iade talebi
            </VText>
          </View>
        </GlassCard>

        <View style={styles.qtyRow}>
          <VText variant="label">Adet</VText>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => setQty((q) => Math.max(1, q - 1))} hitSlop={6}>
              <Minus size={16} color={Colors.text} />
            </Pressable>
            <VText variant="bodyBold" style={{ minWidth: 28, textAlign: 'center' }}>
              {qty}
            </VText>
            <Pressable style={styles.stepBtn} onPress={() => setQty((q) => Math.min(Math.max(1, maxQty), q + 1))} hitSlop={6}>
              <Plus size={16} color={Colors.text} />
            </Pressable>
          </View>
          <View style={{ flex: 1 }} />
          <VText variant="caption">Toplam</VText>
          <VText variant="bodyBold" color={Colors.gold}>
            {formatTokens(total)}
          </VText>
        </View>

        <VText variant="caption" color={affordable ? Colors.success : Colors.gold} style={{ marginTop: 8 }}>
          {affordable
            ? `Bakiyen yeterli (${formatTokens(store.balance)} token).`
            : `Bakiyen yetersiz: ${formatTokens(store.cartTotal + total - store.balance)} token daha kazanmalısın.`}
        </VText>

        {added ? (
          <VText variant="label" color={Colors.success} style={{ marginTop: 8 }}>
            Sepete eklendi!
          </VText>
        ) : null}
        {maxQty <= 0 && product.stock > 0 ? (
          <VText variant="caption" color={Colors.gold} style={{ marginTop: 8 }}>
            Stoktaki tüm ürünler sepetinde.
          </VText>
        ) : null}

        <View style={styles.actions}>
          <OutlineButton
            label="Sepete Ekle"
            iconLeft={<ShoppingCart size={16} color={Colors.text} />}
            onPress={addToCart}
            style={[{ flex: 1 }, maxQty <= 0 && { opacity: 0.4 }]}
          />
          <PrimaryButton
            label="Hemen Al"
            onPress={() => {
              addToCart();
              router.push('/sepet' as Href);
            }}
            style={{ flex: 1 }}
          />
        </View>

        {/* Doğrulanmış alıcı yorumları */}
        <VText variant="heading" style={{ marginTop: Spacing.xxl }}>
          Değerlendirmeler
        </VText>
        <VText variant="caption" style={{ marginTop: 2 }}>
          Yalnızca bu ürünü satın alıp teslim alanlar değerlendirebilir.
        </VText>
        {list.length ? (
          <View style={{ gap: 8, marginTop: Spacing.md }}>
            {list.map((r) => (
              <GlassCard key={r.id} style={{ padding: 12, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Avatar uri={r.avatar} size={28} />
                  <View style={{ flex: 1 }}>
                    <VText variant="label" numberOfLines={1}>
                      {r.name}
                    </VText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <BadgeCheck size={12} color={Colors.success} />
                      <VText variant="caption" style={{ fontSize: 11 }}>
                        Doğrulanmış alıcı · {r.date}
                      </VText>
                    </View>
                  </View>
                  <Stars value={r.rating} size={12} />
                  {store.myId && r.userId !== store.myId ? (
                    <Pressable onPress={() => setReportTarget({ type: 'review', id: r.id })} hitSlop={8} accessibilityLabel="Yorumu şikâyet et">
                      <Flag size={14} color={Colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
                {r.text ? <VText>{r.text}</VText> : null}
              </GlassCard>
            ))}
          </View>
        ) : (
          <VText variant="caption" style={{ marginTop: Spacing.sm }}>
            Henüz değerlendirme yok.
          </VText>
        )}

        {similar.length ? (
          <>
            <VText variant="heading" style={{ marginTop: Spacing.xxl, marginBottom: Spacing.md }}>
              Benzer ürünler
            </VText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {similar.map((p) => (
                <ProductCard key={p.id} p={p} style={{ width: 160 }} />
              ))}
            </ScrollView>
          </>
        ) : null}
        <View style={{ height: Spacing.xl }} />
      </View>
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
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
  imgWrap: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotOn: { backgroundColor: '#fff', width: 16 },
  price: { fontFamily: Fonts.extrabold, fontSize: 24, color: Colors.gold },
  card: { padding: 14, marginTop: Spacing.lg, gap: 10 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.lg },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.xl },
});
