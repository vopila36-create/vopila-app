/** Verilerimi indir (KVKK md.11): hesabındaki tüm bilgilerin bir kopyası (JSON). */
import { Download, FileJson } from 'lucide-react-native';
import { useState } from 'react';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { ActivityIndicator, Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { exportMyData } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

const INCLUDED = [
  'Hesap ve profil bilgilerin',
  'Gönderilerin, yorumların ve anların',
  'Beğendiklerin ve kaydettiklerin',
  'Takip ettiklerin ve takipçilerin',
  'Gönderdiğin mesajlar',
  'Arena oyların, token hareketlerin ve siparişlerin',
  'Ayarların ve destek taleplerin',
];

export default function Verilerim() {
  const { myId } = useStore();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const download = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const res = await exportMyData();
    setBusy(false);
    if (!res.ok) {
      setNotice({ ok: false, text: res.error });
      return;
    }
    const json = JSON.stringify(res.data, null, 2);
    const name = `vopila-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
    try {
      if (Platform.OS === 'web') {
        // Tarayıcı: dosya olarak indir
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setNotice({ ok: true, text: `Verilerin "${name}" dosyası olarak indirildi.` });
        return;
      }
      // Telefon: dosya oluşturulur, paylaşım menüsünden Dosyalar'a kaydedilir ya da e-postayla gönderilir
      const file = new File(Paths.cache, name);
      if (file.exists) file.delete();
      file.create();
      file.write(json);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'VOPILA verilerim', UTI: 'public.json' });
      } else {
        await Share.share({ title: 'VOPILA verilerim', message: json });
      }
      setNotice({ ok: true, text: 'Verilerin dosya olarak hazırlandı. Paylaşım menüsünden kaydedebilir ya da e-postana gönderebilirsin.' });
    } catch {
      setNotice({ ok: false, text: 'Dosya hazırlanamadı. Tekrar dene.' });
    }
  };

  return (
    <SubScreen title="Verilerimi İndir">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 14 }}>
        <GlassCard style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FileJson size={20} color={Colors.cyan} />
            <VText variant="bodyBold" color={Colors.text}>
              Dosyada neler var?
            </VText>
          </View>
          {INCLUDED.map((t) => (
            <VText key={t} style={{ fontSize: 13 }}>
              • {t}
            </VText>
          ))}
          <VText variant="caption" style={{ marginTop: 4 }}>
            KVKK kapsamında kişisel verilerinin bir kopyasını alma hakkın var. Fotoğraf ve videoların dosya adlarıyla listelenir.
          </VText>
        </GlassCard>

        {myId ? (
          <Pressable onPress={download} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color={Colors.onCyan} />
            ) : (
              <>
                <Download size={18} color={Colors.onCyan} />
                <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                  Verilerimi hazırla
                </VText>
              </>
            )}
          </Pressable>
        ) : (
          <VText>Bunun için giriş yapmalısın.</VText>
        )}
        {notice ? (
          <VText variant="caption" color={notice.ok ? Colors.cyan : Colors.live}>
            {notice.text}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    gap: 8,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
