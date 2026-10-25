import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { Eye, Heart, TrendingUp, Users } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Chip, GlassCard, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { ME_ID } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

const PERIODS = [
  { days: 7, label: '7 gün', views: 11900, eng: 940, growth: 18 },
  { days: 30, label: '30 gün', views: 48200, eng: 3600, growth: 72 },
  { days: 90, label: '90 gün', views: 131500, eng: 9800, growth: 140 },
] as const;

/** Basit, tekrarlanabilir sahte günlük görüntülenme dağılımı. */
function dailyBars(total: number, count: number) {
  const raw = Array.from({ length: count }, (_, i) => 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7 + total)));
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((r) => Math.round((r / sum) * total));
}

export default function Istatistikler() {
  const store = useStore();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>(PERIODS[1]);

  const bars = useMemo(() => dailyBars(period.views, period.days === 7 ? 7 : 12), [period]);
  const max = Math.max(...bars);

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

        <View style={styles.kpis}>
          <Kpi icon={<Eye size={16} color={Colors.cyan} />} value={formatCount(period.views)} label="Görüntüleme" />
          <Kpi icon={<Users size={16} color={Colors.cyan} />} value={formatCount(period.eng)} label="Etkileşim" />
          <Kpi icon={<TrendingUp size={16} color={Colors.success} />} value={`+%${period.growth}`} label="Keşif Artışı" color={Colors.success} />
        </View>

        <GlassCard style={{ padding: 14, marginTop: Spacing.lg }}>
          <VText variant="bodyBold">Görüntülenme</VText>
          <VText variant="caption">
            Son {period.label} · {period.days === 7 ? 'günlük' : 'dönemlik'} dağılım
          </VText>
          <View style={styles.chart}>
            {bars.map((b, i) => (
              <View key={i} style={styles.barCol}>
                <View style={[styles.bar, { height: `${Math.max(8, (b / max) * 100)}%` }, i === bars.length - 1 && styles.barNow]} />
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <VText variant="caption">Başlangıç</VText>
            <VText variant="caption">Bugün</VText>
          </View>
        </GlassCard>

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
  chart: { height: 140, flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: 12 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 4, backgroundColor: 'rgba(34,211,238,0.45)' },
  barNow: { backgroundColor: Colors.cyan },
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
