/** Yönetici: siparişler — durum, kargo firması, takip numarası (müşteriye bildirim gider). */
import { useFocusEffect } from 'expo-router';
import { MapPin, Phone, Truck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { fetchAllOrders, updateOrder, type AdminOrder } from '@/lib/admin-api';
import type { OrderStatusKey } from '@/lib/shop-api';
import { formatTokens, useStore } from '@/store/app-store';

const LABEL: Record<OrderStatusKey, string> = {
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoda',
  delivered: 'Teslim edildi',
  problem: 'Sorunlu',
  cancelled: 'İptal',
};
const COLOR: Record<OrderStatusKey, string> = {
  preparing: Colors.gold,
  shipped: Colors.cyan,
  delivered: Colors.success,
  problem: Colors.live,
  cancelled: Colors.textMuted,
};
const CARRIERS = ['Yurtiçi Kargo', 'Aras Kargo', 'MNG Kargo', 'PTT Kargo', 'Sürat Kargo', 'Hepsijet', 'Trendyol Express'];

export default function YonetimSiparisler() {
  const [filter, setFilter] = useState<OrderStatusKey | 'all'>('preparing');
  const [list, setList] = useState<AdminOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: OrderStatusKey | 'all') => {
    const r = await fetchAllOrders(f === 'all' ? undefined : f);
    if (r.ok) setList(r.data);
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  return (
    <AdminScreen title="Siparişler">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="Tümü" active={filter === 'all'} onPress={() => setFilter('all')} />
        {(Object.keys(LABEL) as OrderStatusKey[]).map((k) => (
          <Chip key={k} label={LABEL[k]} active={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((o) => <OrderAdminCard key={o.id} order={o} onSaved={() => load(filter)} />)
        ) : (
          <EmptyState icon={<Truck size={40} color={Colors.textMuted} />} title="Bu durumda sipariş yok" />
        )}
      </View>
    </AdminScreen>
  );
}

function OrderAdminCard({ order: o, onSaved }: { order: AdminOrder; onSaved: () => void }) {
  const store = useStore();
  const [status, setStatus] = useState<OrderStatusKey>(o.status);
  const [carrier, setCarrier] = useState(o.carrier ?? '');
  const [tracking, setTracking] = useState(o.trackingNo ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const a = o.address;
  const dirty = status !== o.status || carrier !== (o.carrier ?? '') || tracking !== (o.trackingNo ?? '');

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const r = await updateOrder(o.id, status, carrier, tracking);
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    setMsg({ ok: true, text: 'Kaydedildi, müşteriye bildirim gitti.' });
    onSaved();
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <VText variant="bodyBold">#{o.shortId}</VText>
          <VText variant="caption">
            {o.date} · {o.userName} (@{o.username})
          </VText>
        </View>
        <View style={[styles.badge, { borderColor: COLOR[o.status] }]}>
          <VText style={{ fontFamily: Fonts.bold, fontSize: 11, color: COLOR[o.status] }}>{LABEL[o.status]}</VText>
        </View>
      </View>

      {o.items.map((it) => (
        <VText key={it.productId} variant="label" style={{ fontSize: 13 }}>
          {it.qty} × {store.productOf(it.productId)?.name ?? it.productId} · {formatTokens(it.price * it.qty)} token
        </VText>
      ))}

      <View style={styles.addr}>
        <View style={styles.inline}>
          <MapPin size={14} color={Colors.cyan} />
          <VText variant="label" selectable style={{ flex: 1 }}>
            {a.fullName}
          </VText>
        </View>
        <VText selectable style={{ fontSize: 13 }}>
          {a.mahalle ? `${a.mahalle}, ${a.street} No: ${a.building}${a.flat ? ` Daire: ${a.flat}` : ''}` : a.line}
        </VText>
        <VText selectable style={{ fontSize: 13 }}>
          {a.ilce ?? a.district} / {a.il ?? a.city}
        </VText>
        <View style={styles.inline}>
          <Phone size={13} color={Colors.textSecondary} />
          <VText selectable variant="caption">
            {a.phone}
          </VText>
        </View>
        {a.note ? <VText variant="caption">Kurye notu: {a.note}</VText> : null}
      </View>

      <VText variant="label" style={{ marginTop: 6 }}>
        Durum
      </VText>
      <View style={styles.statusRow}>
        {(Object.keys(LABEL) as OrderStatusKey[]).map((k) => (
          <Chip key={k} label={LABEL[k]} active={status === k} onPress={() => setStatus(k)} />
        ))}
      </View>
      {status === 'shipped' || o.trackingNo ? (
        <>
          <View style={styles.statusRow}>
            {CARRIERS.map((c) => (
              <Chip key={c} label={c} active={carrier === c} onPress={() => setCarrier(c)} />
            ))}
          </View>
          <Field label="Kargo firması" value={carrier} onChange={setCarrier} placeholder="Örn. Yurtiçi Kargo" max={60} />
          <Field label="Takip numarası" value={tracking} onChange={setTracking} placeholder="Kargo takip no" max={60} />
        </>
      ) : null}
      {status === 'cancelled' && o.status !== 'cancelled' ? (
        <VText variant="caption" color={Colors.gold}>
          İptal edilirse {formatTokens(o.total)} token müşteriye iade edilir ve stok geri eklenir.
        </VText>
      ) : null}
      {dirty ? (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
          <SmallButton label="Kaydet ve bildir" filled onPress={save} busy={busy} />
        </View>
      ) : null}
      <Notice text={msg?.text ?? null} ok={msg?.ok} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.md },
  card: { padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
  addr: { padding: 10, borderRadius: Radius.sm, backgroundColor: Colors.surface, gap: 2, marginTop: 4 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
