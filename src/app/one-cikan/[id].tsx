/** Öne Çıkan albüm izleyici: tam ekran, sağa/sola dokununca ileri/geri. Sahibi albümü silebilir. */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoPlayer } from '@/components/ui/media';
import { OnDark, VText } from '@/components/ui/text';
import { Fonts } from '@/constants/theme';
import { deleteHighlight, fetchHighlight, type Highlight } from '@/lib/highlights-api';
import { useScreenshotGuard } from '@/lib/screen-guard';
import { useStore } from '@/store/app-store';

export default function OneCikanIzle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { myId, userOf } = useStore();
  const insets = useSafeAreaInsets();
  const [hl, setHl] = useState<{ id: string; data: Highlight | null } | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchHighlight(String(id)).then((data) => {
      if (alive) setHl({ id: String(id), data });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const data = hl && hl.id === String(id) ? hl.data : undefined;
  const own = !!data && data.ownerId === myId;
  // 18 yaş altı birinin albümünde ekran görüntüsü engeli
  useScreenshotGuard(!!data && !own && !!userOf(data.ownerId).protected);

  if (data === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={[styles.root, styles.center, { gap: 12 }]}>
        <VText color="#fff">Albüm bulunamadı.</VText>
        <Pressable onPress={() => router.back()}>
          <VText color="#fff" style={{ fontFamily: Fonts.bold }}>
            Geri dön
          </VText>
        </Pressable>
      </View>
    );
  }

  const item = data.items[Math.min(index, data.items.length - 1)];
  const next = () => (index < data.items.length - 1 ? setIndex(index + 1) : router.back());
  const prev = () => setIndex(Math.max(0, index - 1));
  const remove = async () => {
    const r = await deleteHighlight(data.id);
    if (r.ok) router.back();
  };

  return (
    <OnDark>
      <View style={styles.root}>
        {item.type === 'video' ? (
          <VideoPlayer key={item.uri} uri={item.uri} autoPlay loop={false} controls={false} />
        ) : (
          <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        )}
        <View style={styles.taps}>
          <Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel="Önceki" />
          <Pressable style={{ flex: 2 }} onPress={next} accessibilityLabel="Sonraki" />
        </View>
        <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
          <View style={styles.bars}>
            {data.items.map((m, i) => (
              <View key={`${m.uri}-${i}`} style={[styles.bar, i <= index && { backgroundColor: '#fff' }]} />
            ))}
          </View>
          <View style={styles.head}>
            <VText variant="bodyBold" style={{ flex: 1 }}>
              {data.title}
            </VText>
            {own ? (
              <Pressable onPress={remove} hitSlop={10} accessibilityLabel="Albümü sil">
                <Trash2 size={22} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Kapat">
              <X size={26} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </OnDark>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  taps: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 12, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16 },
});
