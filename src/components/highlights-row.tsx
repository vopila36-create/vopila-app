/** Profildeki Öne Çıkanlar satırı (yuvarlak albümler). Kendi profilinde "Yeni" düğmesi de görünür. */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { fetchHighlights, type Highlight } from '@/lib/highlights-api';

export function HighlightsRow({ ownerId, own }: { ownerId: string | null; own?: boolean }) {
  const [list, setList] = useState<{ owner: string; items: Highlight[] } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!ownerId) return;
      let alive = true;
      fetchHighlights(ownerId).then((items) => {
        if (alive) setList({ owner: ownerId, items });
      });
      return () => {
        alive = false;
      };
    }, [ownerId]),
  );

  const items = list && list.owner === ownerId ? list.items : [];
  if (!ownerId || (!own && !items.length)) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {own ? (
        <Pressable style={styles.item} onPress={() => router.push('/one-cikan/yeni' as Href)} accessibilityLabel="Yeni öne çıkan">
          <View style={[styles.circle, styles.add]}>
            <Plus size={26} color={Colors.text} />
          </View>
          <VText variant="caption" numberOfLines={1}>
            Yeni
          </VText>
        </Pressable>
      ) : null}
      {items.map((h) => (
        <Pressable key={h.id} style={styles.item} onPress={() => router.push(`/one-cikan/${h.id}` as Href)}>
          <View style={styles.circle}>
            {h.items[0]?.type === 'video' ? (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceStrong }]} />
            ) : (
              <Image source={{ uri: h.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
            )}
          </View>
          <VText variant="caption" numberOfLines={1} color={Colors.text}>
            {h.title}
          </VText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.screen, gap: 14, paddingVertical: Spacing.sm },
  item: { width: 68, alignItems: 'center', gap: 5 },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
  },
  add: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: Colors.textMuted },
});
