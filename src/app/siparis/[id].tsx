/**
 * Sipariş detayı (Trendyol/Amazon'dan uyanlar): tarihli zaman çizelgesi, tahmini teslim, kargo takip
 * bağlantısı, hazırlanırken iptal (token iadesi), teslimden sonra 14 gün içinde iade talebi ve
 * ürün değerlendirme (doğrulanmış alıcı). Kurallar sunucuda (0034_shop_plus).
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { CheckCircle2, Circle, Coins, ExternalLink, MapPin, PackageX, RotateCcw, Star, Truck, XCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Stars } from '@/components/product-card';
import { GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  cancelMyOrder,
  deliveryEstimate,
  fetchOrderExtras,
  requestReturn,
  reviewProduct,
  trackingUrl,
  type OrderEvent,
  type OrderStatusKey,
  type ReturnRequest,
} from '@/lib/shop-api';
import { formatTokens, useStore } from '@/store/app-store';

const LABEL: Record<OrderStatusKey, string> = {
  preparing: 'Sipariş alındı, hazırlanıyor',
  shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi',
  problem: 'Sorun bildirildi',
  cancelled: 'İptal edildi',
};
const RETURN_LABEL: Record<ReturnRequest['status'], { text: string; color: string }> = {
  requested: { text: 'İade talebin inceleniyor', color: Colors.gold },
  approved: { text: 'İade onaylandı, tokenlerin iade edildi', color: Colors.success },
  rejected: { text: 'İade talebin reddedildi', color: Colors.live },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function SiparisDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const { refreshShop, myId } = store;
  const order = store.orders.find((o) => o.id === id);
  const [extras, setExtras] = useState<{
    id: string;
    history: OrderEvent[];
    ret: ReturnRequest | null;
    reviewed: Record<string, number>;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');

  const load = useCallback(async () => {
    if (!myId || !id) return;
    const data = await fetchOrderExtras(String(id), myId);
    setExtras({ id: String(id), ...data });
  }, [myId, id]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshShop();
      if (myId && id)
        fetchOrderExtras(String(id), myId).then((data) => {
          if (alive) setExtras({ id: String(id), ...data });
        });
      return () => {
        alive = false;
      };
    }, [refreshShop, myId, id]),
  );

  if (!order) {
    return (
      <SubScreen title="Sipariş">
        {store.orders.length ? (
          <EmptyState
            icon={<PackageX size={40} color={Colors.textMuted} />}
            title="Sipariş bulunamadı"
            action={<OutlineButton label="Siparişlerim" onPress={() => router.replace('/siparisler' as Href)} />}
          />
        ) : (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        )}
      </SubScreen>
    );
  }

  const ex = extras?.id === order.id ? extras : null;
  const shippedAt = ex?.history.find((h) => h.status === 'shipped')?.at;
  const deliveredAt = ex?.history.filter((h) => h.status === 'delivered').pop()?.at;
  const estimate = deliveryEstimate(order.status, shippedAt);
  const track = trackingUrl(order.carrier, order.trackingNo);
  const returnOpenUntil = deliveredAt ? new Date(new Date(deliveredAt).getTime() + 14 * 86400000) : null;
  const canReturn = order.status === 'delivered' && !ex?.ret && !!returnOpenUntil && returnOpenUntil > new Date();
  const a = order.address;

  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'İşlem yapılamadı.');
      return false;
    }
    setInfo(done);
    await Promise.all([refreshShop(), load()]);
    return true;
  };

  const cancel = () =>
    run(async () => {
      setConfirmCancel(false);
      const r = await cancelMyOrder(order.id);
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, 'Siparişin iptal edildi; tokenlerin cüzdanına iade edildi.');

  const sendReturn = async () => {
    if (reason.trim().length < 5) return setError('İade nedenini kısaca yaz (en az 5 karakter).');
    const ok = await run(async () => {
      const r = await requestReturn(order.id, reason.trim());
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, 'İade talebin alındı. İnceleyip sana bildirim göndereceğiz.');
    if (ok) {
      setReturnOpen(false);
      setReason('');
    }
  };

  const sendReview = async (productId: string) => {
    if (!rating) return setError('Yıldız seç.');
    const ok = await run(async () => {
      const r = await reviewProduct(order.id, productId, rating, reviewText.trim());
      return r.ok ? { ok: true } : { ok: false, error: r.error };
    }, 'Değerlendirmen için teşekkürler!');
    if (ok) {
      setReviewing(null);
      setRating(0);
      setReviewText('');
    }
  };

  return (
    <SubScreen title={`Sipariş #${order.shortId}`}>
      <View style={styles.pad}>
        <VText variant="caption">{order.date}</VText>

        {/* Zaman çizelgesi */}
        <GlassCard style={styles.card}>
          {(ex?.history.length ? ex.history : [{ status: order.status, at: '' }]).map((h, i, arr) => {
            const last = i === arr.length - 1;
            const bad = h.status === 'cancelled' || h.status === 'problem';
            return (
              <View key={`${h.status}-${h.at}-${i}`} style={styles.event}>
                <View style={{ alignItems: 'center' }}>
                  {bad ? (
                    <XCircle size={20} color={h.status === 'problem' ? Colors.live : Colors.textMuted} />
                  ) : (
                    <CheckCircle2 size={20} color={last ? Colors.cyan : Colors.success} />
                  )}
                  {!last ? <View style={styles.eventLine} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: last ? 0 : 14 }}>
                  <VText variant="label">{LABEL[h.status] ?? h.status}</VText>
                  {h.at ? <VText variant="caption">{when(h.at)}</VText> : null}
                </View>
              </View>
            );
          })}
          {order.status === 'preparing' || order.status === 'shipped' ? (
            <View style={styles.event}>
              <Circle size={20} color={Colors.textMuted} />
              <View style={{ flex: 1 }}>
                <VText variant="label" color={Colors.textMuted}>
                  Teslim edilecek
                </VText>
                {estimate ? <VText variant="caption">{estimate}</VText> : null}
              </View>
            </View>
          ) : null}
        </GlassCard>

        {order.trackingNo ? (
          <Pressable style={styles.row} disabled={!track} onPress={() => track && Linking.openURL(track)}>
            <Truck size={18} color={Colors.cyan} />
            <VText variant="label" style={{ flex: 1 }} selectable>
              {order.carrier ?? 'Kargo'} · {order.trackingNo}
            </VText>
            {track ? (
              <>
                <VText variant="caption" color={Colors.cyan}>
                  Kargo takibi
                </VText>
                <ExternalLink size={14} color={Colors.cyan} />
              </>
            ) : null}
          </Pressable>
        ) : null}

        {ex?.ret ? (
          <GlassCard style={[styles.card, { gap: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RotateCcw size={16} color={RETURN_LABEL[ex.ret.status].color} />
              <VText variant="label" color={RETURN_LABEL[ex.ret.status].color}>
                {RETURN_LABEL[ex.ret.status].text}
              </VText>
            </View>
            <VText variant="caption">
              {ex.ret.date} · Nedenin: {ex.ret.reason}
            </VText>
            {ex.ret.adminNote ? <VText variant="caption">Not: {ex.ret.adminNote}</VText> : null}
          </GlassCard>
        ) : null}

        {/* Ürünler + değerlendirme */}
        <VText variant="heading" style={{ marginTop: Spacing.lg }}>
          Ürünler
        </VText>
        {order.items.map((it) => {
          const p = store.productOf(it.productId);
          const img = it.image ?? p?.image;
          const myRating = ex?.reviewed[it.productId];
          return (
            <GlassCard key={it.productId} style={[styles.card, { gap: 8 }]}>
              <Pressable style={styles.item} onPress={() => p && router.push(`/magaza/${p.id}` as Href)}>
                {img ? <Image source={{ uri: img }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                <View style={{ flex: 1 }}>
                  <VText variant="label" numberOfLines={2}>
                    {it.name ?? p?.name ?? 'Ürün'}
                  </VText>
                  <VText variant="caption">
                    {it.qty} adet · {formatTokens(it.price * it.qty)} token
                  </VText>
                </View>
              </Pressable>
              {order.status === 'delivered' ? (
                reviewing === it.productId ? (
                  <View style={{ gap: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} yıldız`}>
                          <Star size={28} color={Colors.gold} fill={n <= rating ? Colors.gold : 'transparent'} />
                        </Pressable>
                      ))}
                    </View>
                    <TextInput
                      value={reviewText}
                      onChangeText={setReviewText}
                      placeholder="Ürün hakkında düşüncelerin (isteğe bağlı)"
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      maxLength={500}
                      style={[styles.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 }]}
                    />
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <PrimaryButton label={busy ? 'Gönderiliyor…' : 'Gönder'} onPress={() => sendReview(it.productId)} style={{ flex: 1 }} />
                      <OutlineButton label="Vazgeç" onPress={() => setReviewing(null)} style={{ flex: 1 }} />
                    </View>
                  </View>
                ) : myRating ? (
                  <Pressable
                    style={styles.inline}
                    onPress={() => {
                      setReviewing(it.productId);
                      setRating(myRating);
                    }}>
                    <Stars value={myRating} size={13} />
                    <VText variant="caption" color={Colors.cyan}>
                      Değerlendirdin · düzenle
                    </VText>
                  </Pressable>
                ) : (
                  <OutlineButton
                    label="Ürünü değerlendir"
                    iconLeft={<Star size={16} color={Colors.gold} />}
                    onPress={() => {
                      setReviewing(it.productId);
                      setRating(0);
                      setReviewText('');
                    }}
                  />
                )
              ) : null}
            </GlassCard>
          );
        })}

        {/* Teslimat ve tutar */}
        <GlassCard style={[styles.card, { gap: 8 }]}>
          <View style={styles.inline}>
            <MapPin size={15} color={Colors.textSecondary} />
            <VText variant="caption" style={{ flex: 1 }}>
              {a.fullName} · {a.mahalle ? `${a.mahalle}, ${a.street} No: ${a.building}${a.flat ? ` D: ${a.flat}` : ''}, ` : ''}
              {a.ilce ?? a.district}/{a.il ?? a.city}
            </VText>
          </View>
          <View style={styles.inline}>
            <Coins size={15} color={Colors.gold} />
            <VText variant="label" style={{ flex: 1 }}>
              Toplam
            </VText>
            <VText variant="bodyBold" color={Colors.gold}>
              {formatTokens(order.total)} token
            </VText>
          </View>
        </GlassCard>

        {error ? (
          <VText variant="caption" color={Colors.live} style={styles.msg}>
            {error}
          </VText>
        ) : null}
        {info && !error ? (
          <VText variant="caption" color={Colors.success} style={styles.msg}>
            {info}
          </VText>
        ) : null}

        {/* İptal (hazırlanırken) */}
        {order.status === 'preparing' ? (
          confirmCancel ? (
            <GlassCard style={[styles.card, { gap: 10 }]}>
              <VText variant="label">Sipariş iptal edilsin mi? {formatTokens(order.total)} token cüzdanına iade edilir.</VText>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PrimaryButton label={busy ? 'İptal ediliyor…' : 'Evet, iptal et'} onPress={cancel} style={{ flex: 1 }} />
                <OutlineButton label="Vazgeç" onPress={() => setConfirmCancel(false)} style={{ flex: 1 }} />
              </View>
            </GlassCard>
          ) : (
            <OutlineButton label="Siparişi iptal et" onPress={() => setConfirmCancel(true)} style={{ marginTop: Spacing.lg }} />
          )
        ) : null}

        {/* İade (teslimden sonra 14 gün) */}
        {canReturn ? (
          returnOpen ? (
            <GlassCard style={[styles.card, { gap: 10 }]}>
              <VText variant="label">İade nedeni</VText>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Ör. ürün hasarlı geldi, beklediğim gibi değil"
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={500}
                style={[styles.input, { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 }]}
              />
              <VText variant="caption">Talebin onaylanırsa ödediğin tokenler cüzdanına iade edilir.</VText>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PrimaryButton label={busy ? 'Gönderiliyor…' : 'İade talebi gönder'} onPress={sendReturn} style={{ flex: 1 }} />
                <OutlineButton label="Vazgeç" onPress={() => setReturnOpen(false)} style={{ flex: 1 }} />
              </View>
            </GlassCard>
          ) : (
            <OutlineButton
              label="İade talebi oluştur"
              iconLeft={<RotateCcw size={16} color={Colors.text} />}
              onPress={() => setReturnOpen(true)}
              style={{ marginTop: Spacing.lg }}
            />
          )
        ) : null}
        {order.status === 'delivered' && !ex?.ret && returnOpenUntil ? (
          <VText variant="caption" style={styles.msg}>
            {canReturn
              ? `İade için son gün: ${returnOpenUntil.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}`
              : 'İade süresi (14 gün) doldu.'}
          </VText>
        ) : null}
        <View style={{ height: Spacing.xl }} />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  card: { padding: 14, marginTop: Spacing.md },
  event: { flexDirection: 'row', gap: 12 },
  eventLine: { width: 2, flex: 1, backgroundColor: Colors.border, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  img: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surfaceStrong },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    paddingHorizontal: 12,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  msg: { marginTop: Spacing.md, textAlign: 'center' },
});
