/**
 * Ana Sahne keşif bölümleri (gerçek veri): öne çıkan haber, gündemdeki gönderiler ve etiketler,
 * bu ayın arena liderleri, takip önerileri. Sunucu: 0023_home_discovery.sql.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { BadgeCheck, Crown, Hash, Newspaper } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PostGrid } from '@/components/post-grid';
import { Avatar, BottomFade, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius, Spacing } from '@/constants/theme';
import { arenas } from '@/data/mock';
import { loadDiscover, type Discover } from '@/lib/discover-api';
import { formatCount, useStore } from '@/store/app-store';

export function HomeDiscover() {
  const store = useStore();
  const { myId } = store;
  const [data, setData] = useState<{ uid: string; d: Discover } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    loadDiscover(myId, { posts: 12, tags: 10, people: 10 }).then((d) => {
      if (alive) setData({ uid: myId, d });
    });
    return () => {
      alive = false;
    };
  }, [myId, version]);
  // Ekrana her dönüşte tazele
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  const d = data && data.uid === myId ? data.d : null;
  const topNews = store.allNews.find((n) => n.image);
  // Bu ayın arena liderleri: her arenanın 1. sırası (yeterli oy almışsa)
  const leaders = arenas
    .map((a) => ({ arena: a, top: store.rankedEntries(a.key).find((e) => e.qualified) }))
    .filter((x) => x.top)
    .slice(0, 6);

  return (
    <View style={{ gap: Spacing.xl }}>
      {/* Öne çıkan haber (gerçek kaynaklar) */}
      {topNews ? (
        <View style={styles.pad}>
          <SectionHeader title="Öne Çıkan Haber" action="Haberler" onAction={() => router.navigate('/haberler' as Href)} />
          <Pressable style={styles.news} onPress={() => router.push(`/haber/${topNews.id}` as Href)}>
            <Image source={{ uri: topNews.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BottomFade />
            <OnDark>
              <View style={styles.newsTag}>
                <Newspaper size={12} color={OnImage.text} />
                <VText style={styles.newsTagText}>{(topNews.sourceName ?? topNews.category).toLocaleUpperCase('tr-TR')}</VText>
              </View>
              <View style={styles.newsBody}>
                <VText variant="heading" numberOfLines={2}>
                  {topNews.title}
                </VText>
                <VText variant="caption" numberOfLines={2} style={{ marginTop: 4 }}>
                  {topNews.summary}
                </VText>
              </View>
            </OnDark>
          </Pressable>
        </View>
      ) : null}

      {/* Gündemdeki gönderiler */}
      {d?.posts.length ? (
        <View style={styles.pad}>
          <SectionHeader
            title="Gündemde"
            subtitle="Son günlerde en çok beğenilen ve konuşulanlar"
            action="Akış"
            onAction={() => router.navigate('/akis' as Href)}
          />
          <PostGrid posts={d.posts.slice(0, 9)} />
        </View>
      ) : null}

      {/* Gündemdeki etiketler */}
      {d?.tags.length ? (
        <View>
          <View style={styles.pad}>
            <SectionHeader title="Gündemdeki Etiketler" action={null} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
            {d.tags.map((t) => (
              <Pressable key={t.tag} style={styles.tag} onPress={() => router.push(`/etiket/${encodeURIComponent(t.tag)}` as Href)}>
                <Hash size={14} color={Colors.cyan} />
                <VText variant="label">{t.tag}</VText>
                <VText variant="caption">{t.posts}</VText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Bu ayın arena liderleri */}
      {leaders.length ? (
        <View>
          <View style={styles.pad}>
            <SectionHeader
              title="Arena Liderleri"
              subtitle="Bu ay her arenanın 1. sırası"
              action="Liderlik"
              onAction={() => router.push('/liderlik' as Href)}
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
            {leaders.map(({ arena, top }) => (
              <Pressable key={arena.key} style={styles.leader} onPress={() => router.push(`/arena/giris/${top!.id}` as Href)}>
                <Image source={{ uri: top!.image || arena.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <BottomFade />
                <OnDark>
                  <View style={styles.crown}>
                    <Crown size={13} color={OnImage.gold} fill={OnImage.gold} />
                  </View>
                  <View style={styles.leaderBody}>
                    <VText variant="label" numberOfLines={1}>
                      {store.userOf(top!.authorId).name}
                    </VText>
                    <VText variant="caption" numberOfLines={1}>
                      {arena.name} · {top!.average.toFixed(1)} ★
                    </VText>
                  </View>
                </OnDark>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Takip önerileri */}
      {d?.people.length ? (
        <View style={styles.pad}>
          <SectionHeader title="Kimi Takip Etmeli" subtitle="Topluluktan öne çıkan kâşifler" action={null} />
          <GlassCard style={{ paddingVertical: 4 }}>
            {d.people.slice(0, 6).map((p, i, arr) => {
              const status = store.followStatus(p.id);
              const following = status !== 'none';
              return (
                <View key={p.id} style={[styles.person, i < arr.length - 1 && styles.personBorder]}>
                  <Pressable style={styles.personMain} onPress={() => router.push(`/kullanici/${p.id}` as Href)}>
                    <Avatar uri={p.avatar} size={42} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <VText variant="bodyBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                          {p.name}
                        </VText>
                        {p.verified ? <BadgeCheck size={14} color="#fff" fill={Colors.cyan} /> : null}
                      </View>
                      <VText variant="caption" numberOfLines={1}>
                        @{p.username} · {formatCount(p.followers)} takipçi
                      </VText>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => store.toggleFollow(p.id)} style={[styles.followBtn, following && styles.followingBtn]}>
                    <VText variant="label" color={following ? Colors.text : Colors.onCyan} style={{ fontSize: 12, fontFamily: Fonts.bold }}>
                      {status === 'pending' ? 'İstek' : following ? 'Takipte' : 'Takip Et'}
                    </VText>
                  </Pressable>
                </View>
              );
            })}
          </GlassCard>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  hList: { paddingHorizontal: Spacing.screen, gap: 10 },
  news: { height: 210, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  newsTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(4, 10, 23, 0.6)',
  },
  newsTagText: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 0.8, color: OnImage.text },
  newsBody: { position: 'absolute', left: 14, right: 14, bottom: 14 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  leader: { width: 132, height: 170, borderRadius: Radius.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  crown: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4, 10, 23, 0.6)',
  },
  leaderBody: { position: 'absolute', left: 8, right: 8, bottom: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  personBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  personMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  followBtn: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
});
