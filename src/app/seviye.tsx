import { router, type Href } from 'expo-router';
import { CheckCircle2, Crown, Heart, Lock, MessageCircle, Star, Trophy, Upload } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GlassCard, PrimaryButton, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { levelInfo, levels } from '@/data/mock';
import { useStore } from '@/store/app-store';

const WAYS = [
  { Icon: Upload, text: 'Arenaya gönderi paylaş', points: '+20 puan' },
  { Icon: Star, text: 'Başka bir gönderiyi puanla', points: '+5 puan' },
  { Icon: Heart, text: 'Gönderin beğeni alsın', points: '+1 puan' },
  { Icon: MessageCircle, text: 'Yorum yap', points: '+2 puan' },
  { Icon: Trophy, text: 'Arenada ilk 3\'e gir', points: '+100 puan' },
];

export default function Seviye() {
  const XP = useStore().myXp;
  const { current: level, next, inLevel, span } = levelInfo(XP);
  const idx = levels.indexOf(level);

  return (
    <SubScreen title="Seviyem">
      <View style={styles.pad}>
        <GlassCard style={styles.hero} highlighted>
          <View style={styles.hex}>
            <Crown size={40} color={Colors.gold} fill={Colors.gold} />
          </View>
          <VText variant="caption" color={Colors.text}>
            {level.number}. Seviye
          </VText>
          <VText variant="title">{level.name}</VText>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, (inLevel / span) * 100)}%` }]} />
          </View>
          <VText variant="body">
            {next ? (
              <>
                <VText variant="bodyBold" color={Colors.cyan}>
                  {inLevel}
                </VText>{' '}
                / {span} puan · Sonraki: {next.name}
              </>
            ) : (
              'En üst seviyedesin!'
            )}
          </VText>
        </GlassCard>

        <View style={{ marginTop: Spacing.xl }}>
          <SectionHeader title="Tüm Seviyeler" action={null} />
          <GlassCard style={{ paddingHorizontal: 12 }}>
            {levels.map((l, i) => {
              const reached = i <= idx;
              const current = i === idx;
              return (
                <View key={l.number} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={[styles.num, current && { borderColor: Colors.gold, backgroundColor: Colors.goldSoft }]}>
                    <VText style={[styles.numText, current && { color: Colors.gold }]}>{l.number}</VText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <VText variant="label" color={reached ? Colors.text : Colors.textMuted}>
                      {l.name}
                      {current ? ' · şu an' : ''}
                    </VText>
                    <VText variant="caption">{l.points} puan</VText>
                  </View>
                  {reached ? <CheckCircle2 size={18} color={Colors.success} /> : <Lock size={16} color={Colors.textMuted} />}
                </View>
              );
            })}
          </GlassCard>
        </View>

        <View style={{ marginTop: Spacing.xl }}>
          <SectionHeader title="Nasıl puan kazanırım?" action={null} />
          <GlassCard style={{ paddingHorizontal: 12 }}>
            {WAYS.map(({ Icon, text, points }, i) => (
              <View key={text} style={[styles.row, i > 0 && styles.rowBorder]}>
                <Icon size={18} color={Colors.cyan} />
                <VText variant="body" style={{ flex: 1, fontSize: 13 }} color={Colors.text}>
                  {text}
                </VText>
                <VText variant="label" color={Colors.gold}>
                  {points}
                </VText>
              </View>
            ))}
          </GlassCard>
        </View>

        <PrimaryButton
          label="Arenalara Git"
          onPress={() => router.push('/arena-listesi' as Href)}
          style={{ marginTop: Spacing.xl }}
        />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  hero: { alignItems: 'center', padding: 20, gap: 4 },
  hex: {
    width: 80,
    height: 80,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  track: { alignSelf: 'stretch', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 10 },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.cyan },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  num: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.text },
});
