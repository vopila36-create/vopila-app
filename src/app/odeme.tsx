/**
 * Ödeme: kayıtlı adreslerden teslimat adresi seç (ya da yeni ekle), KVKK onayı ver, siparişi onayla.
 * Stok, bakiye ve token düşümü sunucuda tek işlemde yapılır; adres siparişe sabitlenir.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Check, CheckCircle2, Coins, MapPin, Plus, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { addressLine } from '@/lib/shop-api';
import { formatTokens, useStore } from '@/store/app-store';

export default function Odeme() {
  const { adres } = useLocalSearchParams<{ adres?: string }>();
  const store = useStore();
  const [picked, setPicked] = useState<string | null>(adres ?? null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; total: number } | null>(null);
  const go = (href: string) => router.replace(href as Href);

  const selectedId = picked ?? store.addresses.find((a) => a.isDefault)?.id ?? store.addresses[0]?.id ?? null;

  if (done) {
    return (
      <SubScreen title="Sipariş Alındı">
        <EmptyState
          icon={<CheckCircle2 size={56} color={Colors.success} />}
          title="Siparişin alındı!"
          text={`Sipariş no: #${done.id.slice(0, 8).toUpperCase()}\n${formatTokens(done.total)} token cüzdanından düşüldü. Kargoya verilince bildirim alacaksın.`}
          action={
            <View style={{ gap: 10, alignSelf: 'stretch' }}>
              <PrimaryButton label="Siparişlerim" onPress={() => go('/siparisler')} />
              <OutlineButton label="Mağazaya dön" onPress={() => go('/magaza')} />
            </View>
          }
        />
      </SubScreen>
    );
  }

  if (!store.cartItems.length) {
    return (
      <SubScreen title="Ödeme">
        <EmptyState
          icon={<ShoppingCart size={44} color={Colors.textMuted} />}
          title="Sepetin boş"
          action={<PrimaryButton label="Mağazaya git" onPress={() => go('/magaza')} />}
        />
      </SubScreen>
    );
  }

  const submit = async () => {
    setError(null);
    if (!selectedId) {
      setError('Bir teslimat adresi seç ya da yeni adres ekle.');
      return;
    }
    if (!consent) {
      setError('Devam etmek için aydınlatma metnini onaylamalısın.');
      return;
    }
    if (busy) return;
    setBusy(true);
    const total = store.cartTotal;
    const res = await store.placeOrder(selectedId, consent);
    setBusy(false);
    if (res.ok) setDone({ id: res.orderId, total });
    else setError(res.error);
  };

  return (
    <SubScreen title="Ödeme">
      <View style={styles.pad}>
        <View style={styles.inline}>
          <MapPin size={18} color={Colors.cyan} />
          <VText variant="heading">Teslimat Adresi</VText>
        </View>

        <View style={{ gap: 8, marginTop: Spacing.md }}>
          {store.addresses.map((a) => {
            const on = a.id === selectedId;
            return (
              <Pressable key={a.id} onPress={() => setPicked(a.id)}>
                <GlassCard highlighted={on} style={styles.addr}>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <Check size={13} color={Colors.onCyan} strokeWidth={3} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <VText variant="bodyBold">
                      {a.title} · {a.fullName}
                    </VText>
                    <VText style={{ fontSize: 13 }}>{addressLine(a)}</VText>
                    <VText variant="caption">{a.phone}</VText>
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
          <Pressable style={styles.addBtn} onPress={() => router.push('/adres-duzenle?sonra=odeme' as Href)}>
            <Plus size={16} color={Colors.cyan} />
            <VText variant="label" color={Colors.cyan}>
              {store.addresses.length ? 'Yeni adres ekle' : 'Teslimat adresi ekle'}
            </VText>
          </Pressable>
        </View>

        <GlassCard style={styles.summary}>
          <VText variant="heading" style={{ marginBottom: 4 }}>
            Sipariş Özeti
          </VText>
          {store.cartItems.map(({ product, qty }) => (
            <View key={product.id} style={styles.row}>
              <VText variant="body" numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
                {qty} × {product.name}
              </VText>
              <VText variant="label">{formatTokens(product.price * qty)}</VText>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <VText variant="bodyBold">Toplam</VText>
            <View style={styles.inline}>
              <Coins size={14} color={Colors.gold} />
              <VText style={styles.total}>{formatTokens(store.cartTotal)}</VText>
            </View>
          </View>
          <VText variant="caption">
            Bakiye: {formatTokens(store.balance)} → {formatTokens(store.balance - store.cartTotal)} token
          </VText>
        </GlassCard>

        {/* KVKK aydınlatma ve açık rıza */}
        <Pressable style={styles.consent} onPress={() => setConsent((c) => !c)} accessibilityRole="checkbox" accessibilityState={{ checked: consent }}>
          <View style={[styles.box, consent && styles.radioOn]}>{consent ? <Check size={13} color={Colors.onCyan} strokeWidth={3} /> : null}</View>
          <VText variant="caption" style={{ flex: 1 }} color={Colors.textSecondary}>
            Ad, telefon ve adres bilgilerimin siparişimin teslimi amacıyla VOPILA ve anlaşmalı kargo firmasıyla paylaşılmasını;
            6698 sayılı KVKK kapsamındaki aydınlatma metnini okuduğumu kabul ediyorum. Adres bilgilerim teslimattan sonra
            yasal süre boyunca saklanır.
          </VText>
        </Pressable>

        {error ? (
          <VText variant="label" color={Colors.live} style={{ marginTop: Spacing.md }}>
            {error}
          </VText>
        ) : null}

        <Pressable onPress={submit} disabled={busy} style={[styles.submit, busy && { opacity: 0.6 }]}>
          {busy ? (
            <ActivityIndicator color={Colors.onCyan} />
          ) : (
            <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
              Siparişi Onayla
            </VText>
          )}
        </Pressable>
        <VText variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
          Onayladığında tokenler cüzdanından düşülür ve sipariş hazırlanmaya başlar. Kargoya verilene kadar teslimat
          adresini Siparişlerim’den değiştirebilirsin.
        </VText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addr: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  summary: { padding: 14, gap: 8, marginTop: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { height: 1, backgroundColor: Colors.border },
  total: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.gold },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: Spacing.lg },
  submit: {
    marginTop: Spacing.lg,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
