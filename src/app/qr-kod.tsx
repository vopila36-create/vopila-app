/**
 * QR kod: "QR kodum" (profil bağlantım, paylaş / kopyala) ve "Tara" (kamerayla başkasının VOPILA
 * QR'ını okut → profiline git). Yalnızca VOPILA profil bağlantıları açılır.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { Copy, ScanLine, Share2 } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Chip, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { profileLink, usernameFromLink } from '@/lib/profile-link';
import { useAuth } from '@/store/auth';

export default function QrKod() {
  // Yalnızca sunucudaki gerçek kullanıcı adı (örnek profil değil)
  const username = useAuth().profile?.username ?? null;
  const [tab, setTab] = useState<'mine' | 'scan'>('mine');
  const [note, setNote] = useState<string | null>(null);
  const link = username ? profileLink(username) : '';

  const share = async () => {
    try {
      await Share.share({ message: `VOPILA'da beni takip et: ${link}` });
    } catch {}
  };
  const copy = async () => {
    await Clipboard.setStringAsync(link);
    setNote('Bağlantı kopyalandı.');
  };

  return (
    <SubScreen title="QR kod">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="QR kodum" active={tab === 'mine'} onPress={() => setTab('mine')} />
          <Chip label="Tara" active={tab === 'scan'} onPress={() => setTab('scan')} />
        </View>

        {tab === 'mine' && !username ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : tab === 'mine' ? (
          <>
            <GlassCard style={styles.card}>
              {/* Okunurluk için QR her temada beyaz zeminde siyah */}
              <View style={styles.qrBox}>
                <QRCode value={link} size={220} color="#000" backgroundColor="#fff" />
              </View>
              <VText variant="heading" style={{ marginTop: 12 }}>
                @{username}
              </VText>
              <VText variant="caption" selectable>
                {link}
              </VText>
            </GlassCard>
            <PrimaryButton label="Profilimi paylaş" icon={<Share2 size={16} color={Colors.onCyan} />} onPress={share} />
            <OutlineButton label="Bağlantıyı kopyala" iconLeft={<Copy size={16} color={Colors.text} />} onPress={copy} />
            {note ? <VText color={Colors.success}>{note}</VText> : null}
            <VText variant="caption">
              Arkadaşın VOPILA’da Ayarlar &gt; QR kod &gt; Tara ile bu kodu okutunca profiline gider.
            </VText>
          </>
        ) : (
          <Scanner />
        )}
      </View>
    </SubScreen>
  );
}

function Scanner() {
  const [perm, requestPerm] = useCameraPermissions();
  const [msg, setMsg] = useState<string | null>(null);
  const handled = useRef(false);

  if (Platform.OS === 'web') {
    return <VText>QR okutma telefonda çalışır.</VText>;
  }
  if (!perm) return null;
  if (!perm.granted) {
    return (
      <GlassCard style={styles.card}>
        <ScanLine size={40} color={Colors.cyan} />
        <VText style={{ textAlign: 'center', marginTop: 8 }}>QR okutmak için kamera izni gerekli.</VText>
        <PrimaryButton label="Kamerayı aç" onPress={requestPerm} style={{ marginTop: 12, alignSelf: 'stretch' }} />
      </GlassCard>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.camera}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return;
            const username = usernameFromLink(data);
            if (!username) {
              setMsg('Bu bir VOPILA profil kodu değil.');
              return;
            }
            handled.current = true;
            router.replace(`/u/${username}` as Href);
          }}
        />
        <View style={styles.frame} pointerEvents="none" />
      </View>
      <VText variant="caption" style={{ textAlign: 'center' }}>
        Kodu çerçevenin içine getir.
      </VText>
      {msg ? (
        <VText color={Colors.live} style={{ textAlign: 'center', fontFamily: Fonts.semibold }}>
          {msg}
        </VText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', padding: 20 },
  qrBox: { padding: 14, borderRadius: Radius.md, backgroundColor: '#fff' },
  camera: { height: 360, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  frame: {
    position: 'absolute',
    top: 70,
    left: '18%',
    right: '18%',
    bottom: 70,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#fff',
  },
});
