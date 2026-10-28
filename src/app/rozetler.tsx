/**
 * Arena Başarıları. Kendi rozetlerinde kilitliler de görünür; başkasının sayfasında
 * yalnızca kazandığı rozetler gösterilir (rozetler herkese açık).
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Award, CheckCircle2, Lock } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, scrim, Spacing } from '@/constants/theme';
import { badges, earnedBadgesOf, ME_ID, userById, users } from '@/data/mock';

export default function Rozetler() {
  const params = useLocalSearchParams<{ user?: string }>();
  const ownerId = params.user && users.some((u) => u.id === params.user) ? params.user : ME_ID;
  const isMe = ownerId === ME_ID;
  const owner = userById(ownerId);

  const earned = earnedBadgesOf(ownerId);
  const list = isMe ? badges : earned;

  return (
    <SubScreen title={isMe ? 'Arena Başarıları' : `${owner.name} · Rozetler`}>
      <View style={styles.pad}>
        {isMe ? (
          <>
            <VText variant="body">
              {badges.length} rozetten {earned.length} tanesini kazandın. Arenalarda yarışarak yeni rozetlerin kilidini aç.
            </VText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${(earned.length / badges.length) * 100}%` }]} />
            </View>
          </>
        ) : (
          <VText variant="body">
            {owner.name} arenalarda {earned.length} rozet kazandı.
          </VText>
        )}

        {list.length ? (
          <View style={{ gap: 10, marginTop: Spacing.lg }}>
            {list.map((b) => {
              const has = earned.some((e) => e.id === b.id);
              return (
                <Pressable key={b.id} disabled={has} onPress={() => router.push('/arena-listesi' as Href)}>
                  <GlassCard style={[styles.card, !has && { opacity: 0.75 }]}>
                    <View style={[styles.badge, { borderColor: has ? Colors.gold : Colors.textMuted }]}>
                      <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      {!has ? (
                        <View style={styles.lock}>
                          <Lock size={18} color="#fff" />
                        </View>
                      ) : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <VText variant="bodyBold">{b.name}</VText>
                      <VText variant="caption" color={Colors.textSecondary}>
                        {b.description}
                      </VText>
                    </View>
                    {has ? (
                      <CheckCircle2 size={20} color={Colors.success} />
                    ) : (
                      <VText variant="caption" color={Colors.cyan}>
                        Kilitli
                      </VText>
                    )}
                  </GlassCard>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon={<Award size={40} color={Colors.textMuted} />} title="Henüz rozet yok" text={`${owner.name} henüz bir rozet kazanmadı.`} />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 12 },
  fill: { height: 6, borderRadius: 3, backgroundColor: Colors.gold },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  badge: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden', borderWidth: 2 },
  lock: {
    ...StyleSheet.absoluteFill,
    backgroundColor: scrim(0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
