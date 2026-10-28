import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Check, ChevronRight, Clock, Coins, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomFade } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { arenas } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

export default function ArenaListesi() {
  const { joinedArenas, arenaMeta } = useStore();

  return (
    <SubScreen title="Tüm Arenalar">
      <View style={styles.pad}>
        <VText variant="body" style={{ marginBottom: Spacing.lg }}>
          Arenalarda yarış, topluluktan puan topla ve sezon sonunda token kazan. Tokenler yalnızca arenalarda
          kazanılır; mağazada ürünlere harcanır.
        </VText>
        {arenas.map((a) => {
          const joined = joinedArenas.includes(a.key);
          return (
            <Pressable key={a.key} style={styles.card} onPress={() => router.push(`/arena/${a.key}` as Href)}>
              <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <BottomFade style={{ opacity: 1 }} />
              {joined ? (
                <View style={styles.joined}>
                  <Check size={12} color={Colors.onCyan} />
                  <VText style={styles.joinedText}>Katıldın</VText>
                </View>
              ) : null}
              <View style={styles.body}>
                <View style={{ flex: 1 }}>
                  <VText variant="heading" numberOfLines={1}>
                    {a.name} Arenası
                  </VText>
                  <VText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {a.tagline}
                  </VText>
                  <View style={styles.meta}>
                    <View style={styles.inline}>
                      <Users size={12} color={Colors.textSecondary} />
                      <VText variant="caption" color={Colors.textSecondary}>
                        {formatCount(arenaMeta(a.key).members)}
                      </VText>
                    </View>
                    <View style={styles.inline}>
                      <Clock size={12} color={Colors.cyan} />
                      <VText variant="caption" color={Colors.textSecondary}>
                        {arenaMeta(a.key).endsIn}
                      </VText>
                    </View>
                    <View style={styles.inline}>
                      <Coins size={12} color={Colors.gold} />
                      <VText variant="caption" color={Colors.gold}>
                        {a.prizes[0]} / {a.prizes[1]} / {a.prizes[2]}
                      </VText>
                    </View>
                  </View>
                </View>
                <View style={styles.arrow}>
                  <ChevronRight size={18} color="#fff" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  card: {
    height: 150,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  joined: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
  },
  joinedText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.onCyan },
  body: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  arrow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
