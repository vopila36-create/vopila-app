/**
 * "Arkadaşına gönder" (uçak simgesi): alttan açılan pencere.
 * Kişileri seç, isteğe bağlı not yaz, gönder → her kişinin mesaj kutusuna düşer.
 * Gerçek gönderi ise gönderi kartı olarak, değilse (örnek gönderi / haber) yazı olarak gider.
 * "Diğer uygulamalarla paylaş" telefonun kendi paylaşım menüsünü açar.
 */
import { Check, Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PeoplePicker } from '@/components/people-picker';
import { PrimaryButton } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { sendToUser } from '@/lib/messages-api';
import { isRealId } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

/** Gönderilecek şey: gerçek gönderi kimliği ve/veya paylaşım metni. */
export type SendPayload = { postId?: string; title: string; link?: string };

export function SendSheet({ payload, onClose }: { payload: SendPayload | null; onClose: () => void }) {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: string | null } | null>(null);

  const close = () => {
    setSelected([]);
    setNote('');
    setResult(null);
    onClose();
  };

  const shareOutside = async () => {
    if (!payload) return;
    try {
      await Share.share({ message: payload.link ? `${payload.title} — ${payload.link}` : payload.title });
    } catch {
      // Kullanıcı vazgeçti
    }
  };

  const send = async () => {
    if (!payload || !store.myId || !selected.length || sending) return;
    setSending(true);
    const realPost = payload.postId && isRealId(payload.postId) ? payload.postId : undefined;
    // Gerçek gönderi değilse başlık + bağlantı yazı olarak gider; not varsa onun önüne eklenir
    const text = realPost
      ? note.trim()
      : [note.trim(), `${payload.title}${payload.link ? `\n${payload.link}` : ''}`].filter(Boolean).join('\n\n');
    let sent = 0;
    let failed: string | null = null;
    for (const uid of selected) {
      const res = await sendToUser(store.myId, uid, { postId: realPost, text });
      if (res.ok) sent++;
      else failed = res.error;
    }
    setSending(false);
    setResult({ sent, failed });
    store.refreshInbox();
  };

  return (
    <Modal visible={!!payload} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <VText variant="heading" style={{ flex: 1 }}>
              Gönder
            </VText>
            <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>

          {result ? (
            <View style={styles.done}>
              <Check size={40} color={Colors.cyan} />
              <VText variant="heading" style={{ textAlign: 'center' }}>
                {result.sent ? `${result.sent} kişiye gönderildi` : 'Gönderilemedi'}
              </VText>
              {result.failed ? (
                <VText variant="caption" color={Colors.live} style={{ textAlign: 'center' }}>
                  {result.failed}
                </VText>
              ) : null}
              <PrimaryButton label="Tamam" onPress={close} style={{ alignSelf: 'stretch', marginTop: 8 }} />
            </View>
          ) : !store.myId ? (
            <View style={styles.done}>
              <VText style={{ textAlign: 'center' }}>Arkadaşlarına göndermek için giriş yapmalısın.</VText>
              <OutsideButton onPress={shareOutside} />
            </View>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
                <PeoplePicker
                  multi
                  selected={selected}
                  onToggle={(u) => setSelected((s) => (s.includes(u.id) ? s.filter((x) => x !== u.id) : [...s, u.id]))}
                />
              </ScrollView>
              {selected.length ? (
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Bir not ekle…"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.note}
                  maxLength={500}
                />
              ) : null}
              <View style={styles.actions}>
                <OutsideButton onPress={shareOutside} />
                <Pressable
                  onPress={send}
                  disabled={!selected.length || sending}
                  style={[styles.sendBtn, (!selected.length || sending) && { opacity: 0.45 }]}>
                  {sending ? (
                    <ActivityIndicator size="small" color={Colors.onCyan} />
                  ) : (
                    <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                      {selected.length > 1 ? `${selected.length} kişiye gönder` : 'Gönder'}
                    </VText>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function OutsideButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.outside} accessibilityLabel="Diğer uygulamalarla paylaş">
      <Share2 size={18} color={Colors.text} />
      <VText variant="caption" color={Colors.text}>
        Diğer uygulamalar
      </VText>
    </Pressable>
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
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderStrong, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  note: {
    marginTop: 10,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  outside: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  sendBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: { alignItems: 'center', gap: 10, paddingVertical: 20 },
});
