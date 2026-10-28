/** Bir arenanın geçen ay kazananları: 1., 2., 3. ve kazandıkları ödül. */
import { router, type Href } from 'expo-router';
import { Clock, Coins, Crown } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { ArenaKey } from '@/data/mock';
import { formatTokens, useStore } from '@/store/app-store';

const MEDAL = ['#F5B642', '#C9D1DB', '#D08A4E'];

export function WinnersCard({ arenaKey }: { arenaKey: ArenaKey }) {
  const store = useStore();
  const result = store.latestWinners[arenaKey];
  if (!result?.winners.length) return null;
  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <Crown size={18} color={Colors.gold} fill={Colors.gold} />
        <VText variant="heading" style={{ flex: 1 }}>
          {result.period} Kazananları
        </VText>
      </View>
      {result.winners.map((w) => {
        const isMe = w.userId && w.userId === store.myId;
        return (
          <Pressable
            key={w.place}
            disabled={!w.userId}
            onPress={() => router.push((isMe ? '/profil' : `/kullanici/${w.userId}`) as Href)}
            style={[styles.row, isMe && styles.me]}>
            <View style={[styles.medal, { backgroundColor: MEDAL[w.place - 1] }]}>
              <VText style={styles.medalText}>{w.place}</VText>
            </View>
            <Avatar uri={w.avatar} size={36} />
            <View style={{ flex: 1 }}>
              <VText variant="label" numberOfLines={1}>
                {isMe ? `Sen (${w.name})` : w.name}
              </VText>
              {w.status === 'review' ? (
                <View style={styles.inline}>
                  <Clock size={11} color={Colors.textSecondary} />
                  <VText variant="caption" style={{ fontSize: 11 }}>
                    Ödül inceleniyor
                  </VText>
                </View>
              ) : w.username ? (
                <VText variant="caption" style={{ fontSize: 11 }}>
                  @{w.username}
                </VText>
              ) : null}
            </View>
            <View style={styles.inline}>
              <Coins size={14} color={Colors.gold} />
              <VText variant="label" color={Colors.gold} style={{ fontFamily: Fonts.bold }}>
                {formatTokens(w.prize)}
              </VText>
            </View>
          </Pressable>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: Radius.sm },
  me: { backgroundColor: Colors.cyanDim },
  medal: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  medalText: { fontFamily: Fonts.extrabold, fontSize: 12, color: '#1A1205' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
