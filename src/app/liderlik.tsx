import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Coins, Crown, Star, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { WinnersCard } from '@/components/winners-card';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { arenaByKey, arenas, ME_ID, MIN_VOTES_FOR_RANK, type ArenaKey } from '@/data/mock';
import { useStore, type RankedEntry } from '@/store/app-store';

const MEDAL = [Colors.gold, '#C9D3E0', '#D08B5B'];

export default function Liderlik() {
  const params = useLocalSearchParams<{ arena?: string }>();
  const [key, setKey] = useState<ArenaKey>(arenaByKey(params.arena ?? 'otomobil').key);
  const store = useStore();
  const arena = arenaByKey(key);
  const ranked = store.rankedEntries(key);
  const podium = ranked.slice(0, 3);

  const open = (e: RankedEntry) => router.push(`/arena/giris/${e.id}` as Href);

  return (
    <SubScreen title="Liderlik Tablosu">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {arenas.map((a) => (
          <Chip key={a.key} label={a.name} active={a.key === key} onPress={() => setKey(a.key)} />
        ))}
      </ScrollView>

      <View style={styles.pad}>
        <VText variant="caption">
          {arena.name} Arenası · Ay sonuna {store.arenaMeta(key).endsIn} · Sıralama için en az {MIN_VOTES_FOR_RANK} oy
        </VText>
        <View style={{ marginTop: Spacing.md }}>
          <WinnersCard arenaKey={key} />
        </View>

        {ranked.length ? (
          <>
            {/* Podyum: 2 - 1 - 3 */}
            <View style={styles.podium}>
              {[1, 0, 2].map((i) => {
                const e = podium[i];
                if (!e) return <View key={i} style={{ flex: 1 }} />;
                const u = store.userOf(e.authorId);
                const tall = i === 0;
                return (
                  <Pressable key={e.id} style={[styles.podiumCol, { marginTop: tall ? 0 : 24 }]} onPress={() => open(e)}>
                    <Crown size={tall ? 24 : 18} color={MEDAL[i]} fill={MEDAL[i]} />
                    <View style={[styles.podiumAvatar, { borderColor: MEDAL[i] }]}>
                      <Avatar uri={u.avatar} size={tall ? 68 : 54} />
                    </View>
                    <VText variant="label" numberOfLines={1} style={{ marginTop: 6 }}>
                      {e.authorId === ME_ID ? 'Sen' : u.name.split(' ')[0]}
                    </VText>
                    <View style={styles.inline}>
                      <Star size={12} color={Colors.gold} fill={Colors.gold} />
                      <VText variant="caption" color={Colors.text}>
                        {e.average.toFixed(2)}
                      </VText>
                    </View>
                    <View style={[styles.podiumBase, { height: tall ? 64 : 44, borderColor: MEDAL[i] }]}>
                      <VText style={[styles.podiumRank, { color: MEDAL[i] }]}>{i + 1}</VText>
                      <View style={styles.inline}>
                        <Coins size={11} color={Colors.gold} />
                        <VText variant="caption" color={Colors.gold} style={{ fontSize: 10.5 }}>
                          {store.arenaMeta(arena.key).prizes[i]}
                        </VText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <GlassCard style={{ padding: 8, marginTop: Spacing.lg }}>
              {ranked.map((e) => {
                const u = store.userOf(e.authorId);
                const isMe = e.authorId === ME_ID;
                return (
                  <Pressable key={e.id} style={[styles.row, isMe && styles.rowMe]} onPress={() => open(e)}>
                    <VText variant="bodyBold" style={{ width: 28, textAlign: 'center' }}>
                      {e.rank}
                    </VText>
                    <Avatar uri={u.avatar} size={36} />
                    <View style={{ flex: 1 }}>
                      <VText variant="label" numberOfLines={1}>
                        {isMe ? `Sen (${u.name})` : u.name}
                      </VText>
                      <VText variant="caption" numberOfLines={1}>
                        {e.title} · {e.votes} oy
                      </VText>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={styles.inline}>
                        <Star size={12} color={Colors.gold} fill={Colors.gold} />
                        <VText variant="label">{e.average ? e.average.toFixed(2) : '—'}</VText>
                      </View>
                      {!e.qualified ? (
                        <VText variant="caption" color={Colors.textMuted} style={{ fontSize: 10 }}>
                          yetersiz oy
                        </VText>
                      ) : e.rank <= 3 ? (
                        <VText variant="caption" color={Colors.gold} style={{ fontSize: 10.5 }}>
                          +{store.arenaMeta(arena.key).prizes[e.rank - 1]} token
                        </VText>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </GlassCard>
          </>
        ) : (
          <EmptyState
            icon={<Trophy size={40} color={Colors.textMuted} />}
            title="Henüz sıralama yok"
            text="Bu arenada ilk gönderiyi sen paylaş."
          />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  chips: { paddingHorizontal: Spacing.screen, gap: 8, paddingBottom: Spacing.md },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  podium: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: Spacing.lg },
  podiumCol: { flex: 1, alignItems: 'center' },
  podiumAvatar: { borderWidth: 2, borderRadius: 50, padding: 2, marginTop: 4 },
  podiumBase: {
    alignSelf: 'stretch',
    marginTop: 8,
    borderTopLeftRadius: Radius.md,
    borderTopRightRadius: Radius.md,
    borderWidth: 1,
    borderBottomWidth: 0,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumRank: { fontFamily: Fonts.extrabold, fontSize: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  rowMe: { backgroundColor: Colors.cyanDim, borderWidth: 1, borderColor: Colors.borderStrong },
});
