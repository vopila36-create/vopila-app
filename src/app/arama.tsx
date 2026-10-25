import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { BadgeCheck, ChevronRight, Search, SearchX, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { arenas, ME_ID, news, users } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

type Tab = 'people' | 'posts' | 'arenas' | 'news';
const TABS: [Tab, string][] = [
  ['people', 'Kişiler'],
  ['posts', 'Gönderiler'],
  ['arenas', 'Arenalar'],
  ['news', 'Haberler'],
];
const SUGGESTIONS = ['Lofoten', 'Kapadokya', 'Otomobil', 'Doğa', 'Uzay', 'Deniz'];

/** Türkçe karakterleri dikkate alan küçük harf karşılaştırması. */
const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

export default function Arama() {
  const store = useStore();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  const query = norm(q.trim());

  const results = useMemo(() => {
    const has = (s: string) => norm(s).includes(query);
    return {
      people: users.filter((u) => u.id !== ME_ID && (has(u.name) || has(u.username) || has(u.location))),
      posts: store.allPosts.filter((p) => has(p.caption) || has(p.location)),
      arenas: arenas.filter((a) => has(a.name) || has(a.tagline)),
      news: news.filter((n) => has(n.title) || has(n.category)),
    };
  }, [query, store.allPosts]);

  const count = { people: results.people.length, posts: results.posts.length, arenas: results.arenas.length, news: results.news.length };

  return (
    <SubScreen title="Ara">
      <View style={styles.pad}>
        <View style={styles.searchBox}>
          <Search size={20} color={Colors.cyan} />
          <TextInput
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder="Kişi, gönderi, arena veya haber ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            returnKeyType="search"
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="Temizle">
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!query ? (
        <View style={styles.pad}>
          <VText variant="heading" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Popüler aramalar
          </VText>
          <View style={styles.wrap}>
            {SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => setQ(s)} />
            ))}
          </View>
          <VText variant="heading" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Önerilen kişiler
          </VText>
          <View style={{ gap: 8 }}>
            {users
              .filter((u) => u.id !== ME_ID)
              .slice(0, 4)
              .map((u) => (
                <PersonRow key={u.id} id={u.id} />
              ))}
          </View>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.map(([key, label]) => (
              <Chip key={key} label={`${label} (${count[key]})`} active={tab === key} onPress={() => setTab(key)} />
            ))}
          </ScrollView>
          <View style={[styles.pad, { gap: 8 }]}>
            {tab === 'people' && results.people.map((u) => <PersonRow key={u.id} id={u.id} />)}
            {tab === 'posts' &&
              results.posts.map((p) => {
                const cover = p.media[0];
                return (
                  <ResultRow
                    key={p.id}
                    image={cover.type === 'video' ? cover.poster ?? cover.uri : cover.uri}
                    title={p.caption}
                    sub={p.location}
                    onPress={() => router.push(`/gonderi/${p.id}` as Href)}
                  />
                );
              })}
            {tab === 'arenas' &&
              results.arenas.map((a) => (
                <ResultRow
                  key={a.key}
                  image={a.image}
                  title={`${a.name} Arenası`}
                  sub={`${formatCount(a.members)} üye · ${a.tagline}`}
                  onPress={() => router.push(`/arena/${a.key}` as Href)}
                />
              ))}
            {tab === 'news' &&
              results.news.map((n) => (
                <ResultRow
                  key={n.id}
                  image={n.image}
                  title={n.title}
                  sub={`${n.category} · ${n.time}`}
                  onPress={() => router.push(`/haber/${n.id}` as Href)}
                />
              ))}
            {count[tab] === 0 ? (
              <EmptyState
                icon={<SearchX size={40} color={Colors.textMuted} />}
                title="Sonuç bulunamadı"
                text={`"${q.trim()}" için bu sekmede sonuç yok. Diğer sekmelere göz at.`}
              />
            ) : null}
          </View>
        </>
      )}
    </SubScreen>
  );
}

function PersonRow({ id }: { id: string }) {
  const store = useStore();
  const u = users.find((x) => x.id === id)!;
  const following = store.isFollowing(u.id);
  return (
    <GlassCard style={styles.row}>
      <Pressable style={styles.rowMain} onPress={() => router.push(`/kullanici/${u.id}` as Href)}>
        <Avatar uri={u.avatar} size={44} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <VText variant="bodyBold">{u.name}</VText>
            {u.verified ? <BadgeCheck size={14} color="#fff" fill={Colors.cyan} /> : null}
          </View>
          <VText variant="caption">
            @{u.username} · {formatCount(u.followers)} takipçi
          </VText>
        </View>
      </Pressable>
      <Pressable
        onPress={() => store.toggleFollow(u.id)}
        style={[styles.followBtn, following && styles.followingBtn]}>
        <VText variant="label" color={following ? Colors.text : Colors.onCyan} style={{ fontSize: 12 }}>
          {following ? 'Takipte' : 'Takip Et'}
        </VText>
      </Pressable>
    </GlassCard>
  );
}

function ResultRow({ image, title, sub, onPress }: { image: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <GlassCard style={styles.row}>
        <Image source={{ uri: image }} style={styles.thumb} contentFit="cover" />
        <View style={{ flex: 1 }}>
          <VText variant="label" numberOfLines={2}>
            {title}
          </VText>
          <VText variant="caption" numberOfLines={1}>
            {sub}
          </VText>
        </View>
        <ChevronRight size={18} color={Colors.textSecondary} />
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    marginTop: Spacing.sm,
  },
  input: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tabs: { paddingHorizontal: Spacing.screen, gap: 8, paddingVertical: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm },
  followBtn: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
});
