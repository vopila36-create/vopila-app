import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Coins, MapPin, Package } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { productById } from '@/data/mock';
import { formatTokens, useStore, type OrderStatus } from '@/store/app-store';

const STATUS_COLOR: Record<OrderStatus, string> = {
  Hazırlanıyor: Colors.gold,
  Kargoda: Colors.cyan,
  'Teslim edildi': Colors.success,
};

const STEPS: OrderStatus[] = ['Hazırlanıyor', 'Kargoda', 'Teslim edildi'];

export default function Siparisler() {
  const { state } = useStore();

  if (!state.orders.length) {
    return (
      <SubScreen title="Siparişlerim">
        <EmptyState
          icon={<Package size={44} color={Colors.textMuted} />}
          title="Henüz siparişin yok"
          text="Arenalarda kazandığın tokenlerle mağazadan ürün alabilirsin."
          action={<PrimaryButton label="Mağazaya git" onPress={() => router.push('/magaza' as Href)} />}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Siparişlerim">
      <View style={styles.pad}>
        {state.orders.map((o) => {
          const color = STATUS_COLOR[o.status];
          const stepIdx = STEPS.indexOf(o.status);
          return (
            <GlassCard key={o.id} style={styles.card}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  <VText variant="bodyBold">#{o.id}</VText>
                  <VText variant="caption">{o.date}</VText>
                </View>
                <View style={[styles.status, { borderColor: color }]}>
                  <VText style={[styles.statusText, { color }]}>{o.status}</VText>
                </View>
              </View>

              <View style={styles.steps}>
                {STEPS.map((s, i) => (
                  <View key={s} style={{ flex: 1, gap: 4 }}>
                    <View style={[styles.stepBar, i <= stepIdx && { backgroundColor: color }]} />
                    <VText variant="caption" style={{ fontSize: 10 }} color={i <= stepIdx ? Colors.text : Colors.textMuted}>
                      {s}
                    </VText>
                  </View>
                ))}
              </View>

              {o.items.map((it) => {
                const p = productById(it.productId);
                if (!p) return null;
                return (
                  <Pressable key={it.productId} style={styles.item} onPress={() => router.push(`/magaza/${p.id}` as Href)}>
                    <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" />
                    <VText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                      {it.qty} × {p.name}
                    </VText>
                    <VText variant="caption" color={Colors.gold}>
                      {formatTokens(it.price * it.qty)}
                    </VText>
                  </Pressable>
                );
              })}

              <View style={styles.divider} />
              <View style={styles.foot}>
                <MapPin size={14} color={Colors.textSecondary} />
                <VText variant="caption" numberOfLines={2} style={{ flex: 1 }}>
                  {o.address.fullName} · {o.address.district}/{o.address.city}
                </VText>
                <Coins size={14} color={Colors.gold} />
                <VText variant="bodyBold" color={Colors.gold}>
                  {formatTokens(o.total)}
                </VText>
              </View>
            </GlassCard>
          );
        })}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, gap: 12 },
  card: { padding: 14, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  statusText: { fontFamily: Fonts.bold, fontSize: 11 },
  steps: { flexDirection: 'row', gap: 6 },
  stepBar: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  img: { width: 44, height: 44, borderRadius: 8 },
  divider: { height: 1, backgroundColor: Colors.border },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
