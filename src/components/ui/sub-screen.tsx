import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

/** Geri düğmesi + başlık olan alt sayfa başlığı. */
export function SubHeader({ title, right }: { title?: string; right?: ReactNode }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        style={styles.back}
        accessibilityLabel="Geri">
        <ChevronLeft size={26} color={Colors.text} />
      </Pressable>
      <VText variant="heading" numberOfLines={1} style={styles.title}>
        {title}
      </VText>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

/** Alt menüsüz sayfalar için: zemin + geri düğmeli başlık + kaydırılabilir içerik. */
export function SubScreen({
  title,
  right,
  children,
  scroll = true,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <Screen header={<SubHeader title={title} right={right} />} scroll={scroll}>
      {children}
    </Screen>
  );
}

/** İçerik yokken gösterilen boş durum kutusu. */
export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      {icon}
      <VText variant="heading" style={{ marginTop: 12, textAlign: 'center' }}>
        {title}
      </VText>
      {text ? <VText style={{ textAlign: 'center', marginTop: 6 }}>{text}</VText> : null}
      {action ? <View style={{ marginTop: 16 }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 52,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { flex: 1, textAlign: 'center', marginHorizontal: 8 },
  right: { minWidth: 40, flexDirection: 'row', justifyContent: 'flex-end', gap: 14 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
