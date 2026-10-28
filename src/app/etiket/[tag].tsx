/** #etiket sayfası: açıklamasında bu etiket geçen gönderiler (gerçekler önce, örnekler sonra). */
import { useLocalSearchParams } from 'expo-router';
import { Hash } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { posts as demoPosts, type Post } from '@/data/mock';
import { fetchPosts } from '@/lib/posts-api';
import { useStore } from '@/store/app-store';

export default function Etiket() {
  const { tag: raw } = useLocalSearchParams<{ tag: string }>();
  const tag = decodeURIComponent(String(raw ?? '')).replace(/^#/, '');
  const store = useStore();
  const [real, setReal] = useState<{ tag: string; list: Post[] } | null>(null);

  useEffect(() => {
    if (!store.myId || !tag) return;
    let cancelled = false;
    fetchPosts(store.myId, { tag }).then((res) => {
      if (!cancelled) setReal({ tag, list: res.ok ? res.data.posts : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [store.myId, tag]);

  const needle = `#${tag}`.toLocaleLowerCase('tr-TR');
  const list = useMemo(() => {
    const demo = demoPosts.filter((p) => p.caption.toLocaleLowerCase('tr-TR').includes(needle));
    return [...(real?.tag === tag ? real.list : []), ...demo];
  }, [real, tag, needle]);

  const loading = !!store.myId && real?.tag !== tag;

  return (
    <SubScreen title={`#${tag}`}>
      <View style={{ paddingHorizontal: Spacing.screen, gap: 14 }}>
        <VText variant="caption">{loading ? 'Yükleniyor…' : `${list.length} gönderi`}</VText>
        {loading ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
        ) : list.length ? (
          list.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <EmptyState
            icon={<Hash size={40} color={Colors.cyan} />}
            title="Bu etikette henüz gönderi yok"
            text={`Paylaşımlarına #${tag} ekleyerek ilk sen başlat.`}
          />
        )}
      </View>
    </SubScreen>
  );
}
