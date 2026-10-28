/** Yönetici: haberler — listele, düzenle, sil, elle ekle (otomatik haber kaynakları ayrıca bağlanacak). */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Newspaper, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AdminScreen, Notice, SmallButton } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { NewsArticle } from '@/data/mock';
import { deleteNews, fetchAllNews } from '@/lib/admin-api';

export default function YonetimHaberler() {
  const [list, setList] = useState<NewsArticle[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchAllNews();
    if (r.ok) setList(r.data);
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const remove = async (id: string) => {
    setConfirm(null);
    const r = await deleteNews(id);
    if (!r.ok) setError(r.error);
    load();
  };

  return (
    <AdminScreen
      title="Haberler"
      right={
        <Pressable onPress={() => router.push('/yonetim/haber' as Href)} hitSlop={10} accessibilityLabel="Haber ekle">
          <Plus size={24} color={Colors.text} />
        </Pressable>
      }>
      <View style={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((n) => (
            <GlassCard key={n.id} style={styles.row}>
              {n.image ? <Image source={{ uri: n.image }} style={styles.img} contentFit="cover" /> : <View style={styles.img} />}
              <Pressable style={{ flex: 1 }} onPress={() => router.push(`/yonetim/haber?id=${n.id}` as Href)}>
                <VText variant="label" numberOfLines={2}>
                  {n.title}
                </VText>
                <VText variant="caption">
                  {n.category} · {n.time}
                  {n.live ? ' · CANLI' : ''}
                </VText>
              </Pressable>
              {confirm === n.id ? (
                <SmallButton label="Evet, sil" color={Colors.live} filled onPress={() => remove(n.id)} />
              ) : (
                <SmallButton label="Sil" color={Colors.live} onPress={() => setConfirm(n.id)} />
              )}
            </GlassCard>
          ))
        ) : (
          <EmptyState icon={<Newspaper size={40} color={Colors.textMuted} />} title="Haber yok" />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  img: { width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.surfaceStrong },
});
