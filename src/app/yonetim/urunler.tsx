/** Yönetici: ürünler (satışta olmayanlar dahil). Dokun → düzenle, + → yeni ürün. */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Package, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AdminScreen, Notice } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { fetchAllProducts, type AdminProduct } from '@/lib/admin-api';
import { formatTokens } from '@/store/app-store';

export default function YonetimUrunler() {
  const [list, setList] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchAllProducts().then((r) => {
        if (!alive) return;
        if (r.ok) setList(r.data);
        else setError(r.error);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <AdminScreen
      title="Ürünler"
      right={
        <Pressable onPress={() => router.push('/yonetim/urun' as Href)} hitSlop={10} accessibilityLabel="Yeni ürün">
          <Plus size={24} color={Colors.text} />
        </Pressable>
      }>
      <View style={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/yonetim/urun?id=${p.id}` as Href)}>
              <GlassCard style={[styles.row, !p.active && { opacity: 0.55 }]}>
                {p.image ? <Image source={{ uri: p.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
                <View style={{ flex: 1 }}>
                  <VText variant="label" numberOfLines={1}>
                    {p.name}
                  </VText>
                  <VText variant="caption">
                    {p.category} · {formatTokens(p.price)} token · stok {p.stock}
                    {p.active ? '' : ' · SATIŞTA DEĞİL'}
                  </VText>
                </View>
                {p.stock <= 2 && p.active ? (
                  <VText variant="caption" color={Colors.live}>
                    Az stok
                  </VText>
                ) : null}
              </GlassCard>
            </Pressable>
          ))
        ) : (
          <EmptyState icon={<Package size={40} color={Colors.textMuted} />} title="Henüz ürün yok" />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  img: { width: 54, height: 54, borderRadius: Radius.sm, backgroundColor: Colors.surfaceStrong },
});
