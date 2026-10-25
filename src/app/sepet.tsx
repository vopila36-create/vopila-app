import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { AlertTriangle, Coins, Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { formatTokens, useStore } from '@/store/app-store';

export default function Sepet() {
  const store = useStore();
  const { cartItems, cartTotal, balance } = store;
  const remaining = balance - cartTotal;
  const insufficient = remaining < 0;
  const go = (href: string) => router.push(href as Href);

  if (!cartItems.length) {
    return (
      <SubScreen title="Sepetim">
        <EmptyState
          icon={<ShoppingCart size={44} color={Colors.textMuted} />}
          title="Sepetin boş"
          text="Kazandığın tokenlerle mağazadan ürün seçebilirsin."
          action={<PrimaryButton label="Mağazaya git" onPress={() => go('/magaza')} />}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Sepetim">
      <View style={styles.pad}>
        {cartItems.map(({ product, qty }) => (
          <GlassCard key={product.id} style={styles.item}>
            <Pressable onPress={() => go(`/magaza/${product.id}`)}>
              <Image source={{ uri: product.image }} style={styles.img} contentFit="cover" />
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <VText variant="label" numberOfLines={2}>
                {product.name}
              </VText>
              <View style={styles.inline}>
                <Coins size={13} color={Colors.gold} />
                <VText variant="bodyBold" color={Colors.gold}>
                  {formatTokens(product.price * qty)}
                </VText>
              </View>
              <View style={styles.inline}>
                <View style={styles.stepper}>
                  <Pressable style={styles.stepBtn} onPress={() => store.setCartQty(product.id, qty - 1)} hitSlop={6}>
                    <Minus size={14} color={Colors.text} />
                  </Pressable>
                  <VText variant="bodyBold" style={{ minWidth: 22, textAlign: 'center' }}>
                    {qty}
                  </VText>
                  <Pressable style={styles.stepBtn} onPress={() => store.setCartQty(product.id, qty + 1)} hitSlop={6}>
                    <Plus size={14} color={Colors.text} />
                  </Pressable>
                </View>
                <View style={{ flex: 1 }} />
                <Pressable onPress={() => store.setCartQty(product.id, 0)} hitSlop={8} accessibilityLabel="Kaldır">
                  <Trash2 size={18} color={Colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </GlassCard>
        ))}

        <GlassCard style={styles.summary}>
          <Row label="Toplam" value={`${formatTokens(cartTotal)} token`} />
          <Row label="Bakiyen" value={`${formatTokens(balance)} token`} />
          <View style={styles.divider} />
          <Row
            label="Alışveriş sonrası"
            value={`${formatTokens(remaining)} token`}
            color={insufficient ? Colors.live : Colors.success}
            bold
          />
          <Row label="Kargo" value="Ücretsiz" />
        </GlassCard>

        {insufficient ? (
          <Pressable style={styles.warn} onPress={() => go('/arena-listesi')}>
            <AlertTriangle size={18} color={Colors.gold} />
            <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
              Bakiyen yetersiz. {formatTokens(-remaining)} token daha kazanmak için{' '}
              <VText variant="label" color={Colors.cyan}>
                arenalara katıl
              </VText>{' '}
              ya da sepetten ürün çıkar.
            </VText>
          </Pressable>
        ) : null}

        <PrimaryButton
          label="Ödemeye Geç"
          onPress={() => !insufficient && go('/odeme')}
          style={[{ marginTop: Spacing.lg }, insufficient && { opacity: 0.4 }]}
        />
        <OutlineButton label="Alışverişe devam et" onPress={() => go('/magaza')} style={{ marginTop: 10 }} />
      </View>
    </SubScreen>
  );
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <VText variant="body">{label}</VText>
      <VText variant={bold ? 'bodyBold' : 'label'} color={color}>
        {value}
      </VText>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, gap: 10 },
  item: { flexDirection: 'row', gap: 12, padding: 10 },
  img: { width: 84, height: 84, borderRadius: Radius.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 3,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceRaised,
  },
  summary: { padding: 14, gap: 8, marginTop: Spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 2 },
  warn: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSoft,
  },
});
