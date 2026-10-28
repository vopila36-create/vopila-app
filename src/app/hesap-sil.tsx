/**
 * Hesabı kalıcı sil (App Store ve Google Play şartı). Onay cümlesi yazılmadan silinmez.
 * Siparişler yasal saklama süresi boyunca kimliksiz özet olarak tutulur; gerisi silinir.
 */
import { router, type Href } from 'expo-router';
import { AlertTriangle, Download } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { deleteMyAccount } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

const PHRASE = 'HESABIMI SİL';

const GONE = [
  'Profilin, fotoğrafların ve videoların',
  'Gönderilerin, yorumların, anların ve beğenilerin',
  'Mesajların ve takip bilgilerin',
  'Token bakiyen ve arena geçmişin (geri alınamaz)',
];

export default function HesapSil() {
  const { myId } = useStore();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = text.trim().toLocaleUpperCase('tr-TR') === PHRASE;

  const remove = async () => {
    if (!myId || !ready || busy) return;
    setBusy(true);
    setError(null);
    const res = await deleteMyAccount(myId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace('/giris' as Href);
  };

  return (
    <SubScreen title="Hesabı Sil">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 14 }}>
        <GlassCard style={styles.warn}>
          <AlertTriangle size={22} color={Colors.live} />
          <VText color={Colors.text} style={{ flex: 1 }}>
            Hesabını silersen bu işlem geri alınamaz. Aynı e-postayla yeniden kayıt olabilirsin ama eski içeriğin geri gelmez.
          </VText>
        </GlassCard>

        <GlassCard style={{ padding: 16, gap: 6 }}>
          <VText variant="bodyBold" color={Colors.text}>
            Silinecekler
          </VText>
          {GONE.map((g) => (
            <VText key={g} style={{ fontSize: 13 }}>
              • {g}
            </VText>
          ))}
          <VText variant="caption" style={{ marginTop: 6 }}>
            Siparişlerin yasal zorunluluk (fatura) nedeniyle adın olmadan özet olarak saklanır.
          </VText>
        </GlassCard>

        <Pressable style={styles.link} onPress={() => router.push('/verilerim' as Href)}>
          <Download size={16} color={Colors.cyan} />
          <VText variant="label" color={Colors.cyan}>
            Silmeden önce verilerimin bir kopyasını al
          </VText>
        </Pressable>

        <VText variant="label">Onaylamak için “{PHRASE}” yaz:</VText>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={PHRASE}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          style={styles.input}
        />

        <Pressable onPress={remove} disabled={!ready || busy || !myId} style={[styles.btn, (!ready || busy) && { opacity: 0.4 }]}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <VText variant="label" color="#fff" style={{ fontFamily: Fonts.bold }}>
              Hesabımı kalıcı olarak sil
            </VText>
          )}
        </Pressable>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  warn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderColor: 'rgba(239,68,68,0.5)' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.semibold,
    fontSize: 15,
  },
  btn: { height: 50, borderRadius: Radius.pill, backgroundColor: Colors.live, alignItems: 'center', justifyContent: 'center' },
});
