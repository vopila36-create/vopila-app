import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check, Coins, Minus, PackageX, Plus, ShoppingCart, Truck } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { productById } from '@/data/mock';
import { formatTokens, useStore } from '@/store/app-store';

export default function UrunDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = productById(id ?? '');
  const store = useStore();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

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

  const addToCart = () => {
    if (maxQty <= 0) return;
    store.setCartQty(product.id, inCart + Math.min(qty, maxQty));
    setAdded(true);
  };

  return (
    <SubScreen
      title={product.category}
      right={
        <Pressable onPress={() => router.push('/sepet' as Href)} hitSlop={8} accessibilityLabel="Sepet">
          <ShoppingCart size={24} color={Colors.text} />
          {store.cartCount ? (
            <View style={styles.badge}>
              <VText style={styles.badgeText}>{store.cartCount}</VText>
            </View>
          ) : null}
        </Pressable>
      }>
      <View style={styles.pad}>
        <View style={styles.imgWrap}>
          <Image source={{ uri: product.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        </View>
        <VText variant="title" style={{ marginTop: Spacing.lg, fontSize: 24, lineHeight: 30 }}>
          {product.name}
        </VText>
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
              Ücretsiz kargo · 3-5 iş günü içinde adresine teslim
            </VText>
          </View>
          <View style={styles.line}>
            <Check size={16} color={product.stock > 0 ? Colors.success : Colors.live} />
            <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
              {product.stock > 0 ? `Stokta ${product.stock} adet` : 'Stokta yok'}
              {inCart ? ` · Sepetinde ${inCart} adet` : ''}
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
