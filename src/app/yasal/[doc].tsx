/** Yasal metinler: aydınlatma metni, kullanım koşulları, çocukları koruma önlemleri, telif bildirimi. */
import { useLocalSearchParams } from 'expo-router';
import { FileText, TriangleAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { LEGAL_DRAFT, legalDoc } from '@/data/legal';

export default function YasalMetin() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const d = legalDoc(String(doc));
  if (!d) {
    return (
      <SubScreen title="Yasal">
        <EmptyState icon={<FileText size={40} color={Colors.textMuted} />} title="Metin bulunamadı" />
      </SubScreen>
    );
  }
  return (
    <SubScreen title={d.title}>
      <View style={styles.pad}>
        {LEGAL_DRAFT ? (
          <View style={styles.draft}>
            <TriangleAlert size={18} color={Colors.gold} />
            <VText variant="caption" color={Colors.gold} style={{ flex: 1 }}>
              Taslak metin — yayından önce hukukçu tarafından gözden geçirilecek.
            </VText>
          </View>
        ) : null}
        <VText variant="caption">Son güncelleme: {d.updated}</VText>
        {d.intro ? (
          <VText variant="body" color={Colors.textSecondary}>
            {d.intro}
          </VText>
        ) : null}
        {d.sections.map((s) => (
          <View key={s.h} style={{ gap: 6 }}>
            <VText variant="bodyBold">{s.h}</VText>
            {s.p.map((p) => (
              <VText key={p} variant="body" color={Colors.text} style={{ lineHeight: 22 }}>
                {p}
              </VText>
            ))}
          </View>
        ))}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold,
  },
});
