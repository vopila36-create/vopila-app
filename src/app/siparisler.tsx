/**
 * Siparişlerim: durum (Hazırlanıyor → Kargoda → Teslim edildi; Sorunlu / İptal), kargo firması ve
 * takip numarası, teslimat adresi. Adres yalnızca "Hazırlanıyor"ken değiştirilebilir.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { AlertTriangle, Check, ChevronRight, Coins, MapPin, Package, Pencil, Truck, XCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { addressLine, changeOrderAddress, type OrderStatusKey, type RemoteOrder } from '@/lib/shop-api';
import { formatTokens, useStore } from '@/store/app-store';

const STATUS: Record<OrderStatusKey, { label: string; color: string }> = {
  preparing: { label: 'Hazırlanıyor', color: Colors.gold },
  shipped: { label: 'Kargoda', color: Colors.cyan },
  delivered: { label: 'Teslim edildi', color: Colors.success },
  problem: { label: 'Sorunlu', color: Colors.live },
  cancelled: { label: 'İptal edildi', color: Colors.textMuted },
};
const STEPS: OrderStatusKey[] = ['preparing', 'shipped', 'delivered'];

export default function Siparisler() {
  const store = useStore();
  const { refreshShop } = store;
  useFocusEffect(
    useCallback(() => {
      refreshShop();
    }, [refreshShop]),
  );

  if (!store.orders.length) {
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
        {store.orders.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
      </View>
    </SubScreen>
  );
}

function OrderCard({ order: o }: { order: RemoteOrder }) {
  const store = useStore();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const st = STATUS[o.status] ?? STATUS.preparing;
  const stepIdx = STEPS.indexOf(o.status);
  const a = o.address;

  const change = async (addressId: string) => {
    setError(null);
    const res = await changeOrderAddress(o.id, addressId);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    await store.refreshShop();
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <VText variant="bodyBold">#{o.shortId}</VText>
          <VText variant="caption">{o.date}</VText>
        </View>
        <View style={[styles.status, { borderColor: st.color }]}>
          <VText style={[styles.statusText, { color: st.color }]}>{st.label}</VText>
        </View>
      </View>

      {o.status === 'problem' || o.status === 'cancelled' ? (
        <View style={styles.inline}>
          {o.status === 'problem' ? <AlertTriangle size={15} color={Colors.live} /> : <XCircle size={15} color={Colors.textMuted} />}
          <VText variant="caption" style={{ flex: 1 }}>
            {o.status === 'problem'
              ? 'Siparişinle ilgili bir sorun var; ekibimiz seninle iletişime geçecek.'
              : 'Sipariş iptal edildi, tokenlerin cüzdanına iade edildi.'}
          </VText>
        </View>
      ) : (
        <View style={styles.steps}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flex: 1, gap: 4 }}>
              <View style={[styles.stepBar, i <= stepIdx && { backgroundColor: st.color }]} />
              <VText variant="caption" style={{ fontSize: 10 }} color={i <= stepIdx ? Colors.text : Colors.textMuted}>
                {STATUS[s].label}
              </VText>
            </View>
          ))}
        </View>
      )}

      {o.trackingNo ? (
        <View style={styles.tracking}>
          <Truck size={16} color={Colors.cyan} />
          <VText variant="label" style={{ flex: 1 }} selectable>
            {o.carrier ?? 'Kargo'} · Takip no: {o.trackingNo}
          </VText>
        </View>
      ) : null}

      {o.items.map((it) => {
        // Ürün adı/görseli sipariş anındaki kopyadan (ürün kaldırılsa da görünür)
        const p = store.productOf(it.productId);
        const img = it.image ?? p?.image;
        return (
          <Pressable key={it.productId} style={styles.item} onPress={() => p && router.push(`/magaza/${p.id}` as Href)}>
            {img ? <Image source={{ uri: img }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
            <VText variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {it.qty} × {it.name ?? p?.name ?? 'Ürün'}
            </VText>
            <VText variant="caption" color={Colors.gold}>
              {formatTokens(it.price * it.qty)}
            </VText>
          </Pressable>
        );
      })}

      <Pressable style={styles.detail} onPress={() => router.push(`/siparis/${o.id}` as Href)}>
        <VText variant="label" color={Colors.cyan} style={{ flex: 1 }}>
          Sipariş detayı · {o.status === 'preparing' ? 'iptal' : o.status === 'delivered' ? 'değerlendir, iade' : 'zaman çizelgesi'}
        </VText>
        <ChevronRight size={16} color={Colors.cyan} />
      </Pressable>

      <View style={styles.divider} />
      <View style={styles.foot}>
        <MapPin size={14} color={Colors.textSecondary} />
        <VText variant="caption" numberOfLines={3} style={{ flex: 1 }}>
          {a.fullName} · {a.mahalle ? `${a.mahalle}, ${a.street} No: ${a.building}${a.flat ? ` D: ${a.flat}` : ''}, ` : ''}
          {a.ilce ?? a.district}/{a.il ?? a.city}
        </VText>
        <Coins size={14} color={Colors.gold} />
        <VText variant="bodyBold" color={Colors.gold}>
          {formatTokens(o.total)}
        </VText>
      </View>

      {o.status === 'preparing' ? (
        editing ? (
          <View style={{ gap: 6 }}>
            <VText variant="label">Yeni teslimat adresini seç:</VText>
            {store.addresses.map((ad) => (
              <Pressable key={ad.id} style={styles.pick} onPress={() => change(ad.id)}>
                <Check size={14} color={Colors.cyan} />
                <VText variant="caption" color={Colors.text} style={{ flex: 1 }} numberOfLines={2}>
                  {ad.title} · {addressLine(ad)}
                </VText>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/adres-duzenle' as Href)}>
              <VText variant="caption" color={Colors.cyan}>
                + Yeni adres ekle
              </VText>
            </Pressable>
            <Pressable onPress={() => setEditing(false)}>
              <VText variant="caption" color={Colors.textSecondary}>
                Vazgeç
              </VText>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.inline} onPress={() => setEditing(true)}>
            <Pencil size={14} color={Colors.cyan} />
            <VText variant="caption" color={Colors.cyan} style={{ fontFamily: Fonts.semibold }}>
              Teslimat adresini değiştir
            </VText>
          </Pressable>
        )
      ) : null}
      {error ? (
        <VText variant="caption" color={Colors.live}>
          {error}
        </VText>
      ) : null}
    </GlassCard>
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
  tracking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanDim,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  img: { width: 44, height: 44, borderRadius: 8, backgroundColor: Colors.surfaceStrong },
  divider: { height: 1, backgroundColor: Colors.border },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
});
