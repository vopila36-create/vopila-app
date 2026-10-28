/** Yeni Öne Çıkan: başlık + an arşivinden seç (süresi dolmuş anlar dahil). */
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Check, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { createHighlight, fetchMyMomentArchive, type ArchivedMoment } from '@/lib/highlights-api';
import { useStore } from '@/store/app-store';

const CLOSE_FRIENDS_ERROR = 'Yakın Arkadaşlar’a özel anlar Öne Çıkanlar’a eklenemez.';

export default function YeniOneCikan() {
  const { myId } = useStore();
  const [archive, setArchive] = useState<ArchivedMoment[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchMyMomentArchive(myId).then((l) => {
      if (alive) setArchive(l);
    });
    return () => {
      alive = false;
    };
  }, [myId]);

  const toggle = (m: ArchivedMoment) => {
    if (m.closeFriends) {
      setError(CLOSE_FRIENDS_ERROR);
      return;
    }
    setError(null);
    setSelected((s) => (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]));
  };

  const save = async () => {
    if (!myId || busy) return;
    if (!title.trim()) return setError('Albüme bir başlık ver.');
    if (!selected.length) return setError('En az bir an seç.');
    setBusy(true);
    const r = await createHighlight(myId, title, selected);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    router.back();
  };

  return (
    <SubScreen title="Yeni Öne Çıkan">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.md }}>
        <VText variant="body">Seçtiğin anlar profilinde kalıcı bir albümde durur; profilini görebilen herkes görür.</VText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Albüm başlığı (ör. Gezi)"
          placeholderTextColor={Colors.textMuted}
          maxLength={20}
          style={styles.input}
        />
        <VText variant="label">Anlarından seç ({selected.length})</VText>
        {archive === null ? (
          <ActivityIndicator color={Colors.cyan} />
        ) : !archive.length ? (
          <EmptyState icon={<Star size={40} color={Colors.textMuted} />} title="Henüz anın yok" text="An paylaştıkça burada birikir." />
        ) : (
          <View style={styles.grid}>
            {archive.map((m) => {
              const on = selected.includes(m.id);
              return (
                <Pressable key={m.id} style={[styles.cell, m.closeFriends && { opacity: 0.45 }]} onPress={() => toggle(m)}>
                  {m.items[0].type === 'video' ? (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceStrong }]} />
                  ) : (
                    <Image source={{ uri: m.items[0].uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  )}
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={Colors.onCyan} /> : null}</View>
                  <View style={styles.date}>
                    <VText style={styles.dateText}>
                      {new Date(m.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                    </VText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {error ? <VText color={Colors.live}>{error}</VText> : null}
        <PrimaryButton label={busy ? 'Kaydediliyor…' : 'Albümü oluştur'} onPress={save} />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: '32%', aspectRatio: 0.65, borderRadius: Radius.sm, overflow: 'hidden' },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
  date: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(4,10,23,0.6)',
  },
  dateText: { color: '#fff', fontSize: 11, fontFamily: Fonts.semibold },
});
