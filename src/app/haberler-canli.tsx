import { router, type Href } from 'expo-router';
import { ChevronRight, Radio } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { liveUpdates, newsById } from '@/data/mock';

export default function CanliGelismeler() {
  return (
    <SubScreen title="Canlı Gelişmeler">
      <View style={styles.pad}>
        <View style={styles.intro}>
          <Radio size={20} color={Colors.live} />
          <VText variant="body" style={{ flex: 1 }}>
            Dünya genelindeki önemli gelişmeler, anlık olarak. Detayı olan başlıklara dokunarak haberi aç.
          </VText>
        </View>
        <GlassCard style={{ paddingVertical: 8 }}>
          {liveUpdates.map((u, i) => {
            const article = u.articleId ? newsById(u.articleId) : undefined;
            return (
              <Pressable
                key={u.id}
                disabled={!article}
                onPress={() => article && router.push(`/haber/${article.id}` as Href)}
                style={styles.row}>
                <View style={styles.rail}>
                  <View style={[styles.dot, u.fresh && { backgroundColor: Colors.live }]} />
                  {i < liveUpdates.length - 1 ? <View style={styles.line} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 14 }}>
                  <VText variant="label" color={u.fresh ? Colors.live : Colors.cyan}>
                    {u.time}
                    {u.fresh ? ' · YENİ' : ''}
                  </VText>
                  <VText variant="body" color={Colors.text} style={{ marginTop: 2 }}>
                    {u.text}
                  </VText>
                  {article ? (
                    <VText variant="caption" color={Colors.cyan} style={{ marginTop: 4 }}>
                      Habere git: {article.title}
                    </VText>
                  ) : (
                    <VText variant="caption" style={{ marginTop: 4 }}>
                      Ayrıntılar takip ediliyor.
                    </VText>
                  )}
                </View>
                {article ? <ChevronRight size={18} color={Colors.textSecondary} /> : null}
              </Pressable>
            );
          })}
        </GlassCard>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  intro: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: Spacing.lg },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingTop: 10, alignItems: 'flex-start' },
  rail: { width: 12, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.textMuted, marginTop: 4 },
  line: { flex: 1, width: 1, backgroundColor: Colors.border, marginTop: 4 },
});
