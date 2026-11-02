/** Hakkında: yasal metinler ve uygulama sürümü. */
import Constants from 'expo-constants';
import { router, type Href } from 'expo-router';
import { FileText, Info, Shield, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Row, Section } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

const go = (p: string) => router.push(p as Href);
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function Hakkinda() {
  return (
    <SubScreen title="Hakkında">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Yasal">
          <Row icon={<Shield size={20} color={Colors.cyanSoft} />} label="Aydınlatma Metni ve Gizlilik" onPress={() => go('/yasal/aydinlatma')} />
          <Row icon={<FileText size={20} color={Colors.cyanSoft} />} label="Kullanım Koşulları" onPress={() => go('/yasal/kosullar')} />
          <Row icon={<Users size={20} color={Colors.cyanSoft} />} label="Çocukları Koruma Önlemleri" onPress={() => go('/yasal/cocuk-koruma')} />
          <Row icon={<FileText size={20} color={Colors.cyanSoft} />} label="Telif ve İçerik Bildirimi" onPress={() => go('/yasal/telif')} last />
        </Section>
        <Section title="Uygulama">
          <View style={styles.row}>
            <Info size={20} color={Colors.textSecondary} />
            <VText variant="label" style={{ flex: 1 }}>
              Sürüm
            </VText>
            <VText variant="caption">{APP_VERSION}</VText>
          </View>
        </Section>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
});
