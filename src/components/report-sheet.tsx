import { Check, Flag, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnTheme, VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { isRealId, report, REPORT_REASONS, type ReportReason } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export type ReportTarget = { type: 'post' | 'comment' | 'user' | 'moment' | 'live' | 'highlight' | 'review'; id: string };

/**
 * Şikayet penceresi: sebep seçilir, sunucuya gönderilir.
 * Örnek (demo) içerik şikayet edilirse yalnızca teşekkür gösterilir.
 */
export function ReportSheet({
  target,
  onClose,
}: {
  target: ReportTarget | null;
  onClose: () => void;
}) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const [sending, setSending] = useState<ReportReason | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setDone(false);
    setError(null);
    onClose();
  };

  const pick = async (reason: ReportReason) => {
    if (!target || sending) return;
    if (!store.myId || !isRealId(target.id)) {
      setDone(true);
      return;
    }
    setSending(reason);
    const res = await report(store.myId, target, reason);
    setSending(null);
    if (res.ok) setDone(true);
    else setError(res.error);
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
<OnTheme>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.head}>
          <Flag size={18} color={Colors.live} />
          <VText variant="heading" style={{ flex: 1 }}>
            {done ? 'Teşekkürler' : 'Neden şikayet ediyorsun?'}
          </VText>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
            <X size={22} color={Colors.text} />
          </Pressable>
        </View>
        {done ? (
          <View style={styles.done}>
            <Check size={40} color={Colors.cyan} />
            <VText style={{ textAlign: 'center' }}>
              Şikayetin alındı. Ekibimiz inceleyecek. Kimin şikayet ettiği karşı tarafa söylenmez.
            </VText>
          </View>
        ) : (
          <ScrollView style={{ maxHeight: 420 }}>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r.key} onPress={() => pick(r.key)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <VText variant="label" style={{ flex: 1 }}>
                  {r.label}
                </VText>
                {sending === r.key ? <ActivityIndicator size="small" color={Colors.cyan} /> : null}
              </Pressable>
            ))}
            {error ? (
              <VText variant="caption" color={Colors.live} style={{ padding: 12 }}>
                {error}
              </VText>
            ) : null}
          </ScrollView>
        )}
      </View>
    </OnTheme>
</Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.surfaceStrong,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.screen,
    paddingTop: 16,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  done: { alignItems: 'center', gap: 12, paddingVertical: 24, paddingHorizontal: 12 },
  title: { fontFamily: Fonts.bold },
});
