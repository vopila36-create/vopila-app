import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Plus, Sparkles, Users } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/post-card';
import { Avatar, BottomFade, OutlineButton, SectionHeader } from '@/components/ui/primitives';
import { AppHeader, Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { ME_ID, moments, userById } from '@/data/mock';
import { useStore } from '@/store/app-store';

export default function Akis() {
  const [tab, setTab] = useState<'following' | 'forYou'>('following');
  const store = useStore();
  const insets = useSafeAreaInsets();

  const list = useMemo(() => {
    const following = store.state.following;
    if (tab === 'forYou') {
      // Önce takip etmediğin kişilerden öneriler, sonra en çok beğenilenler
      const others = store.allPosts.filter((p) => p.authorId !== ME_ID);
      const discover = others.filter((p) => !following.includes(p.authorId)).sort((a, b) => b.likes - a.likes);
      const popular = others.filter((p) => following.includes(p.authorId)).sort((a, b) => b.likes - a.likes);
      return [...discover, ...popular];
    }
    // Takip ettiklerin + senin yeni paylaşımların, en yeniden eskiye
    return store.allPosts.filter((p) => following.includes(p.authorId) || store.state.myPosts.includes(p));
  }, [tab, store.allPosts, store.state.following, store.state.myPosts]);

  const followingCount = store.state.following.length;
  const feedNote =
    tab === 'following'
      ? `Takip ettiğin ${followingCount} kişinin paylaşımları · ${list.length} gönderi`
      : 'Henüz takip etmediğin kâşiflerden öneriler ve en popüler paylaşımlar';

  return (
    <View style={{ flex: 1 }}>
      <Screen header={<AppHeader />}>
        <View style={styles.pad}>
          <VText variant="title">Akış</VText>

          <View style={styles.segment}>
            {(
              [
                ['following', 'Takip Ettiklerin'],
                ['forYou', 'Sana Özel'],
              ] as const
            ).map(([key, label]) => {
              const active = tab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[styles.segmentItem, active && styles.segmentActive]}>
                  <VText
                    variant="label"
                    color={active ? Colors.onCyan : Colors.text}
                    style={active ? { fontFamily: Fonts.bold } : undefined}>
                    {label}
                  </VText>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader
            title="Anlar"
            subtitle="Keşfedenlerin en yeni paylaşımları"
            onAction={() => router.push(`/an/${moments[0].id}` as Href)}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moments}>
          {moments.map((m, i) => {
            const author = userById(m.authorId);
            return (
              <Pressable
                key={m.id}
                onPress={() => router.push(`/an/${m.id}` as Href)}
                style={[styles.moment, i < 2 && styles.momentNew]}>
                <Image source={{ uri: m.items[0] }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <BottomFade />
                <View style={styles.progress}>
                  {m.items.slice(0, 4).map((it, b) => (
                    <View key={it} style={[styles.progressBar, b === 0 && { backgroundColor: Colors.cyan }]} />
                  ))}
                </View>
                <View style={styles.momentBody}>
                  <Avatar uri={author.avatar} size={30} ring />
                  <VText variant="label" style={{ marginTop: 6, fontSize: 12 }} numberOfLines={2}>
                    {m.title}
                  </VText>
                  <VText variant="caption" color={Colors.cyan} style={{ fontSize: 10 }}>
                    {m.items.length} yeni paylaşım
                  </VText>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.pad, { gap: 14, marginTop: Spacing.lg }]}>
          <View style={styles.feedNote}>
            {tab === 'following' ? (
              <Users size={16} color={Colors.cyan} />
            ) : (
              <Sparkles size={16} color={Colors.gold} />
            )}
            <VText variant="caption" color={Colors.textSecondary} style={{ flex: 1 }}>
              {feedNote}
            </VText>
          </View>
          {list.length ? (
            list.map((p) => <PostCard key={p.id} post={p} />)
          ) : (
            <EmptyState
              icon={<Users size={40} color={Colors.cyan} />}
              title="Henüz kimseyi takip etmiyorsun"
              text="Sana Özel sekmesinden yeni insanlar keşfet ve takip etmeye başla."
              action={<OutlineButton label="Keşfet" onPress={() => setTab('forYou')} />}
            />
          )}
        </View>
      </Screen>

      <Pressable
        onPress={() => router.push('/kamera' as Href)}
        accessibilityLabel="Kamerayı aç ve yeni gönderi oluştur"
        style={[styles.fab, { bottom: TabBarHeight + Math.max(insets.bottom, 10) + 14 }]}>
        <LinearGradient colors={Gradients.cyanButton} style={styles.fabInner}>
          <Plus size={28} color={Colors.onCyan} strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  segment: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentItem: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  segmentActive: {
    backgroundColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  feedNote: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  moments: { paddingHorizontal: Spacing.screen, gap: 10 },
  moment: {
    width: 92,
    height: 168,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  momentNew: { borderColor: Colors.borderStrong, borderWidth: 1.5 },
  progress: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 3 },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)' },
  momentBody: { position: 'absolute', left: 8, right: 6, bottom: 8 },
  fab: {
    position: 'absolute',
    right: 18,
    borderRadius: 30,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.7,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  fabInner: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
