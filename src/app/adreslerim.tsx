/** Adreslerim: kayıtlı adresler, varsayılanı seç, düzenle, sil, yeni ekle (en fazla 10). */
import { router, useFocusEffect, type Href } from 'expo-router';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { addressLine, deleteAddress, setDefaultAddress, type SavedAddress } from '@/lib/shop-api';
import { useStore } from '@/store/app-store';

export default function Adreslerim() {
  const store = useStore();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { refreshShop } = store;
  useFocusEffect(
    useCallback(() => {
      refreshShop();
    }, [refreshShop]),
  );

  const makeDefault = async (a: SavedAddress) => {
    const res = await setDefaultAddress(a.id);
    if (!res.ok) setError(res.error);
    await refreshShop();
  };

  const remove = async (a: SavedAddress) => {
    setConfirm(null);
    const res = await deleteAddress(a.id);
    if (!res.ok) setError(res.error);
    await refreshShop();
  };

  return (
    <SubScreen
      title="Adreslerim"
      right={
        store.addresses.length < 10 ? (
          <Pressable onPress={() => router.push('/adres-duzenle' as Href)} hitSlop={10} accessibilityLabel="Yeni adres">
            <Plus size={24} color={Colors.text} />
          </Pressable>
        ) : null
      }>
      <View style={styles.pad}>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
        {store.addresses.length ? (
          store.addresses.map((a) => (
            <GlassCard key={a.id} highlighted={a.isDefault} style={styles.card}>
              <View style={styles.head}>
                <MapPin size={18} color={Colors.cyan} />
                <VText variant="bodyBold" style={{ flex: 1 }}>
                  {a.title}
                </VText>
                {a.isDefault ? (
                  <View style={styles.badge}>
                    <VText variant="caption" color={Colors.onCyan} style={{ fontFamily: Fonts.bold, fontSize: 10 }}>
                      VARSAYILAN
                    </VText>
                  </View>
                ) : null}
              </View>
              <VText color={Colors.text}>
                {a.fullName} · {a.phone}
              </VText>
              <VText style={{ fontSize: 13 }}>{addressLine(a)}</VText>
              {a.courierNote ? (
                <VText variant="caption" style={{ fontStyle: 'italic' }}>
                  Kurye notu: {a.courierNote}
                </VText>
              ) : null}
              {confirm === a.id ? (
                <View style={styles.actions}>
                  <VText variant="label" style={{ flex: 1 }}>
                    Bu adres silinsin mi?
                  </VText>
                  <Pressable onPress={() => remove(a)}>
                    <VText variant="label" color={Colors.live}>
                      Sil
                    </VText>
                  </Pressable>
                  <Pressable onPress={() => setConfirm(null)}>
                    <VText variant="label" color={Colors.textSecondary}>
                      Vazgeç
                    </VText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.actions}>
                  {!a.isDefault ? (
                    <Pressable style={styles.action} onPress={() => makeDefault(a)}>
                      <Star size={15} color={Colors.gold} />
                      <VText variant="caption" color={Colors.text}>
                        Varsayılan yap
                      </VText>
                    </Pressable>
                  ) : null}
                  <View style={{ flex: 1 }} />
                  <Pressable style={styles.action} onPress={() => router.push(`/adres-duzenle?id=${a.id}` as Href)}>
                    <Pencil size={15} color={Colors.text} />
                    <VText variant="caption" color={Colors.text}>
                      Düzenle
                    </VText>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => setConfirm(a.id)}>
                    <Trash2 size={15} color={Colors.live} />
                    <VText variant="caption" color={Colors.live}>
                      Sil
                    </VText>
                  </Pressable>
                </View>
              )}
            </GlassCard>
          ))
        ) : (
          <EmptyState
            icon={<MapPin size={44} color={Colors.cyan} />}
            title="Kayıtlı adresin yok"
            text="Siparişlerin için bir teslimat adresi ekle. Adresini yalnızca sen görürsün."
            action={<PrimaryButton label="Adres Ekle" onPress={() => router.push('/adres-duzenle' as Href)} />}
          />
        )}
        <VText variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>
          {store.addresses.length}/10 adres
        </VText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, gap: 12 },
  card: { padding: 14, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: Colors.cyan },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
