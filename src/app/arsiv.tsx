/** Arşiv: profilden kaldırdığın ama silmediğin gönderiler (yalnızca sen görürsün), geri alınabilir. */
import { Archive, RotateCcw } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PostGrid } from '@/components/post-grid';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { Post } from '@/data/mock';
import { fetchArchived, setArchived } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

export default function Arsiv() {
  const store = useStore();
  const myId = store.myId;
  const [list, setList] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchArchived(myId).then((res) => {
      if (cancelled) return;
      if (res.ok) setList(res.data.posts);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const restore = async (p: Post) => {
    const res = await setArchived(p.id, false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setList((l) => (l ?? []).filter((x) => x.id !== p.id));
    store.refreshFeed();
  };

  return (
    <SubScreen title="Arşiv">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <VText variant="caption">
          Arşivlediğin gönderiler profilinden ve akıştan kalkar, silinmez. Köşedeki ok ile geri koyabilirsin.
        </VText>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
        {!myId ? (
          <EmptyState icon={<Archive size={40} color={Colors.textMuted} />} title="Önce giriş yapmalısın" />
        ) : list === null && !error ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list?.length ? (
          <PostGrid
            posts={list}
            overlay={(p) => (
              <Pressable style={styles.restore} onPress={() => restore(p)} hitSlop={6} accessibilityLabel="Profile geri koy">
                <RotateCcw size={16} color="#fff" />
              </Pressable>
            )}
          />
        ) : (
          <EmptyState
            icon={<Archive size={40} color={Colors.textMuted} />}
            title="Arşivin boş"
            text="Kendi gönderinin ••• menüsünden “Arşivle”yi seçebilirsin."
          />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  restore: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
