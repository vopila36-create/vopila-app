/**
 * Profil Etkisi: seçilen dönemde gönderilerine gelen beğeni ve yorumlar, yeni takipçiler (my_profile_impact)
 * ve en çok beğenilen gönderilerin. Tüm sayılar sunucudan gelir.
 */
import { Image } from 'expo-image';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Heart, ImageIcon, MessageCircle, UserPlus } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Chip, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ME_ID } from '@/data/mock';
import { fetchImpact, type Impact } from '@/lib/profile-stats-api';
import { formatCount, useStore } from '@/store/app-store';

const PERIODS = [
  { days: 7, label: '7 gün' },
  { days: 30, label: '30 gün' },
  { days: 90, label: '90 gün' },
] as const;

export default function Istatistikler() {
  const store = useStore();
  const myId = store.myId;
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1]);
  const [data, setData] = useState<{ key: string; impact: Impact | null } | null>(null);
  const key = `${myId}:${period.days}`;

  useFocusEffect(
    useCallback(() => {
      if (!myId) return;
      let alive = true;
      fetchImpact(period.days).then((impact) => {
        if (alive) setData({ key: `${myId}:${period.days}`, impact });
      });
      return () => {
        alive = false;
      };
    }, [myId, period.days]),
  );
  const impact = data?.key === key ? data.impact : null;
  const loading = !!myId && data?.key !== key;

  const topPosts = useMemo(
    () =>
      store.allPosts
        .filter((p) => p.authorId === ME_ID)
        .sort((a, b) => store.likeCount(b) - store.likeCount(a))
        .slice(0, 4),
    [store],
  );

  return (
    <SubScreen title="Profil Etkisi">
      <View style={styles.pad}>
        <View style={styles.chips}>
          {PERIODS.map((p) => (
            <Chip key={p.days} label={p.label} active={p.days === period.days} onPress={() => setPeriod(p)} />
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 30 }} />
        ) : (
          <>
            <View style={styles.kpis}>
              <Kpi icon={<Heart size={16} color={Colors.heart} />} value={formatCount(impact?.likes ?? 0)} label="Beğeni" />
              <Kpi icon={<MessageCircle size={16} color={Colors.cyan} />} value={formatCount(impact?.comments ?? 0)} label="Yorum" />
            </View>
            <View style={[styles.kpis, { marginTop: 8 }]}>
              <Kpi
                icon={<UserPlus size={16} color={Colors.success} />}
                value={`+${formatCount(impact?.newFollowers ?? 0)}`}
                label="Yeni takipçi"
                color={Colors.success}
              />
              <Kpi icon={<ImageIcon size={16} color={Colors.cyanSoft} />} value={formatCount(impact?.posts ?? 0)} label="Toplam gönderi" />
            </View>
            <VText variant="caption" style={{ marginTop: 8 }}>
              Son {period.label} içinde gönderilerine gelen etkileşimler.
            </VText>
          </>
        )}

        <View style={{ marginTop: Spacing.xl }}>
          <SectionHeader title="En Çok Beğenilenler" action={null} />
          <View style={{ gap: 8 }}>
            {topPosts.map((p, i) => {
              const m = p.media[0];
              return (
                <Pressable key={p.id} style={styles.row} onPress={() => router.push(`/gonderi/${p.id}` as Href)}>
                  <VText variant="bodyBold" color={Colors.gold} style={{ width: 18 }}>
                    {i + 1}
                  </VText>
                  <Image source={{ uri: m?.type === 'video' ? m.poster ?? m.uri : m?.uri }} style={styles.thumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <VText variant="label" numberOfLines={1}>
                      {p.caption}
                    </VText>
                    <VText variant="caption">{p.location}</VText>
                  </View>
                  <Heart size={14} color={Colors.heart} fill={Colors.heart} />
                  <VText variant="label">{formatCount(store.likeCount(p))}</VText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </SubScreen>
  );
}

function Kpi({ icon, value, label, color = Colors.text }: { icon: ReactNode; value: string; label: string; color?: string }) {
  return (
    <GlassCard style={styles.kpi}>
      {icon}
      <VText variant="bodyBold" color={color} style={{ fontSize: 17, marginTop: 4 }}>
        {value}
      </VText>
      <VText variant="caption" numberOfLines={1}>
        {label}
      </VText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  chips: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
  kpis: { flexDirection: 'row', gap: 8 },
  kpi: { flex: 1, padding: 12, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
});
