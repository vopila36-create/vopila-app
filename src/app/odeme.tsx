import { router, type Href } from 'expo-router';
import { CheckCircle2, Coins, MapPin, ShoppingCart } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatTokens, useStore, type Address, type Order } from '@/store/app-store';

const EMPTY: Address = { fullName: '', phone: '', city: '', district: '', line: '' };

const FIELDS: { key: keyof Address; label: string; placeholder: string; keyboard?: KeyboardTypeOptions; multiline?: boolean }[] = [
  { key: 'fullName', label: 'Ad Soyad', placeholder: 'Örn. Kerem Taş' },
  { key: 'phone', label: 'Telefon', placeholder: '05XX XXX XX XX', keyboard: 'phone-pad' },
  { key: 'city', label: 'İl', placeholder: 'Örn. İstanbul' },
  { key: 'district', label: 'İlçe', placeholder: 'Örn. Kadıköy' },
  { key: 'line', label: 'Açık adres', placeholder: 'Mahalle, sokak, bina ve daire no', multiline: true },
];

function validate(a: Address): Partial<Record<keyof Address, string>> {
  const e: Partial<Record<keyof Address, string>> = {};
  if (a.fullName.trim().split(/\s+/).length < 2) e.fullName = 'Ad ve soyadını yaz.';
  if (a.phone.replace(/\D/g, '').length < 10) e.phone = 'Geçerli bir telefon numarası yaz.';
  if (a.city.trim().length < 2) e.city = 'İl gerekli.';
  if (a.district.trim().length < 2) e.district = 'İlçe gerekli.';
  if (a.line.trim().length < 10) e.line = 'Açık adresi biraz daha ayrıntılı yaz.';
  return e;
}

export default function Odeme() {
  const store = useStore();
  const [address, setAddress] = useState<Address>(store.state.address ?? EMPTY);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Order | null>(null);
  const errors = validate(address);
  const go = (href: string) => router.replace(href as Href);

  if (done) {
    return (
      <SubScreen title="Sipariş Alındı">
        <EmptyState
          icon={<CheckCircle2 size={56} color={Colors.success} />}
          title="Siparişin alındı!"
          text={`Sipariş no: #${done.id}\n${formatTokens(done.total)} token cüzdanından düşüldü. Ürünün hazırlanınca kargoya verilecek.`}
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

  const submit = () => {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length) {
      setError('Lütfen adres bilgilerini kontrol et.');
      return;
    }
    const res = store.placeOrder({
      fullName: address.fullName.trim(),
      phone: address.phone.trim(),
      city: address.city.trim(),
      district: address.district.trim(),
      line: address.line.trim(),
    });
    if (res.ok && res.order) setDone(res.order);
    else setError(res.error ?? 'Sipariş oluşturulamadı.');
  };

  return (
    <SubScreen title="Ödeme">
      <View style={styles.pad}>
        <View style={styles.inline}>
          <MapPin size={18} color={Colors.cyan} />
          <VText variant="heading">Teslimat Adresi</VText>
        </View>

        {FIELDS.map((f) => {
          const err = touched ? errors[f.key] : undefined;
          return (
            <View key={f.key} style={{ marginTop: Spacing.md }}>
              <VText variant="label" style={{ marginBottom: 6 }}>
                {f.label}
              </VText>
              <TextInput
                value={address[f.key]}
                onChangeText={(t) => setAddress((a) => ({ ...a, [f.key]: t }))}
                placeholder={f.placeholder}
                placeholderTextColor={Colors.textMuted}
                keyboardType={f.keyboard}
                multiline={f.multiline}
                style={[styles.input, f.multiline && { height: 84, textAlignVertical: 'top', paddingTop: 12 }, err && styles.inputErr]}
              />
              {err ? (
                <VText variant="caption" color={Colors.live} style={{ marginTop: 4 }}>
                  {err}
                </VText>
              ) : null}
            </View>
          );
        })}

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

        {error ? (
          <VText variant="label" color={Colors.live} style={{ marginTop: Spacing.md }}>
            {error}
          </VText>
        ) : null}

        <PrimaryButton label="Siparişi Onayla" onPress={submit} style={{ marginTop: Spacing.lg }} />
        <VText variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
          Onayladığında tokenler cüzdanından düşülür ve sipariş hazırlanmaya başlar.
        </VText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  inputErr: { borderColor: Colors.live },
  summary: { padding: 14, gap: 8, marginTop: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  divider: { height: 1, backgroundColor: Colors.border },
  total: { fontFamily: Fonts.extrabold, fontSize: 18, color: Colors.gold },
});
