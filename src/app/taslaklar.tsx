/** Gönderi taslakları: dokununca paylaşma ekranında kaldığın yerden devam edilir. */
import { router, useFocusEffect, type Href } from 'expo-router';
import { FileEdit, ImageOff, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MediaView } from '@/components/ui/media';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { arenaByKey } from '@/data/mock';
import { deleteDraft, listDrafts, type Draft } from '@/lib/drafts';
import { timeAgo } from '@/lib/posts-api';
import { useStore } from '@/store/app-store';

export default function Taslaklar() {
  const { myId } = useStore();
  const [drafts, setDrafts] = useState<Draft[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      listDrafts(myId).then((l) => {
        if (alive) setDrafts(l);
      });
      return () => {
        alive = false;
      };
    }, [myId]),
  );

  const remove = async (id: string) => {
    await deleteDraft(myId, id);
    setDrafts(await listDrafts(myId));
  };

  return (
    <SubScreen title="Taslaklar">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
        <VText variant="caption">Taslaklar yalnızca bu telefonda saklanır.</VText>
        {drafts && !drafts.length ? (
          <EmptyState
            icon={<FileEdit size={40} color={Colors.textMuted} />}
            title="Taslağın yok"
            text="Paylaşma ekranında “Taslağa kaydet” dersen burada görünür."
          />
        ) : null}
        {(drafts ?? []).map((d) => (
          <Pressable key={d.id} onPress={() => router.push(`/olustur?draft=${d.id}` as Href)}>
            <GlassCard style={styles.row}>
              <View style={styles.thumb}>
                {d.media[0] ? (
                  <MediaView type={d.media[0].type} uri={d.media[0].uri} />
                ) : (
                  <View style={styles.noMedia}>
                    <ImageOff size={20} color={Colors.textMuted} />
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <VText variant="label" numberOfLines={2}>
                  {d.caption || 'Açıklama yok'}
                </VText>
                <VText variant="caption" numberOfLines={1}>
                  {d.media.length} medya{d.arenaKey ? ` · ${arenaByKey(d.arenaKey).name} Arenası` : ''} · {timeAgo(d.savedAt)}
                </VText>
              </View>
              <Pressable onPress={() => remove(d.id)} hitSlop={10} accessibilityLabel="Taslağı sil">
                <Trash2 size={20} color={Colors.live} />
              </Pressable>
            </GlassCard>
          </Pressable>
        ))}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  thumb: { width: 64, height: 80, borderRadius: Radius.sm, overflow: 'hidden' },
  noMedia: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceStrong },
});
