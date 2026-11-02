/**
 * Arena Başarıları. Kendi rozetlerinde kilitliler de görünür; başkasının sayfasında
 * yalnızca kazandığı rozetler gösterilir (rozetler herkese açık).
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { Award, CheckCircle2, Lock } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, scrim, Spacing } from '@/constants/theme';
import { badges as demoBadges, earnedBadgesOf, ME_ID, userById, users } from '@/data/mock';
import { fetchBadges, type BadgeItem } from '@/lib/profile-stats-api';
import { isRealId } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export default function Rozetler() {
  const params = useLocalSearchParams<{ user?: string }>();
  const store = useStore();
  const myId = store.myId;
  // Oturumda rozetler sunucudan (badges / user_badges); örnekler yalnızca oturumsuz önizlemede
  const realTarget = myId ? (params.user && isRealId(params.user) && params.user !== myId ? params.user : myId) : null;
  const [server, setServer] = useState<{ id: string; list: BadgeItem[] | null } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!realTarget) return;
      let alive = true;
      fetchBadges(realTarget).then((list) => {
        if (alive) setServer({ id: realTarget, list });
      });
      return () => {
        alive = false;
      };
    }, [realTarget]),
  );

  const demoOwnerId = params.user && users.some((u) => u.id === params.user) ? params.user : ME_ID;
  const isMe = realTarget ? realTarget === myId : demoOwnerId === ME_ID;
  const owner = realTarget ? store.userOf(realTarget === myId ? ME_ID : realTarget) : userById(demoOwnerId);
  const all: BadgeItem[] = realTarget
    ? (server?.id === realTarget ? (server.list ?? []) : [])
    : demoBadges.map((b) => ({ ...b, earned: earnedBadgesOf(demoOwnerId).some((e) => e.id === b.id) }));
  const badges = all;
  const earned = all.filter((b) => b.earned);
  const list = isMe ? badges : earned;
  const loading = !!realTarget && server?.id !== realTarget;

  return (
    <SubScreen title={isMe ? 'Arena Başarıları' : `${owner.name} · Rozetler`}>
      <View style={styles.pad}>
        {isMe ? (
          <>
            <VText variant="body">
              {badges.length} rozetten {earned.length} tanesini kazandın. Arenalarda yarışarak yeni rozetlerin kilidini aç.
            </VText>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${badges.length ? (earned.length / badges.length) * 100 : 0}%` }]} />
            </View>
          </>
        ) : (
          <VText variant="body">
            {owner.name} arenalarda {earned.length} rozet kazandı.
          </VText>
        )}

        {loading ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
        ) : list.length ? (
          <View style={{ gap: 10, marginTop: Spacing.lg }}>
            {list.map((b) => {
              const has = b.earned;
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
