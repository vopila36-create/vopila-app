/** İki adımlı doğrulama: aç (QR / anahtar + kod) ya da kapat. */
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { ExternalLink, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { activeFactor, disable, startEnroll, verifyCode, type Enrollment } from '@/lib/mfa';
import { useStore } from '@/store/app-store';

export default function IkiAdimli() {
  const { myId } = useStore();
  const [factor, setFactor] = useState<string | null | undefined>(undefined);
  const [enroll, setEnroll] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    activeFactor().then((f) => {
      if (!cancelled) setFactor(f);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const begin = async () => {
    setBusy(true);
    setNotice(null);
    const res = await startEnroll();
    setBusy(false);
    if (res.ok) setEnroll(res.data);
    else setNotice({ ok: false, text: res.error });
  };

  const confirm = async () => {
    if (!enroll || busy) return;
    setBusy(true);
    const res = await verifyCode(enroll.factorId, code);
    setBusy(false);
    if (!res.ok) {
      setNotice({ ok: false, text: res.error });
      return;
    }
    setFactor(enroll.factorId);
    setEnroll(null);
    setCode('');
    setNotice({ ok: true, text: 'İki adımlı doğrulama açıldı. Bundan sonra girişte uygulamadaki kod da istenecek.' });
  };

  const turnOff = async () => {
    if (!factor || busy) return;
    setBusy(true);
    const res = await disable(factor);
    setBusy(false);
    if (!res.ok) {
      setNotice({ ok: false, text: res.error });
      return;
    }
    setFactor(null);
    setNotice({ ok: true, text: 'İki adımlı doğrulama kapatıldı.' });
  };

  return (
    <SubScreen title="İki Adımlı Doğrulama">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 14 }}>
        <GlassCard style={styles.head}>
          {factor ? <ShieldCheck size={28} color={Colors.success} /> : <ShieldOff size={28} color={Colors.textSecondary} />}
          <View style={{ flex: 1 }}>
            <VText variant="bodyBold" color={Colors.text}>
              {factor === undefined ? 'Kontrol ediliyor…' : factor ? 'Açık' : 'Kapalı'}
            </VText>
            <VText variant="caption">
              Açıkken şifren ele geçirilse bile, telefonundaki doğrulama uygulamasının kodu olmadan hesabına girilemez.
            </VText>
          </View>
        </GlassCard>

        {!myId ? (
          <VText>Bunun için giriş yapmalısın.</VText>
        ) : factor === undefined ? (
          <ActivityIndicator color={Colors.cyan} />
        ) : factor ? (
          <Pressable onPress={turnOff} disabled={busy} style={[styles.btn, styles.btnOutline]}>
            <VText variant="label" style={{ fontFamily: Fonts.bold }}>
              {busy ? 'Bekle…' : 'Kapat'}
            </VText>
          </Pressable>
        ) : enroll ? (
          <GlassCard style={{ padding: 16, gap: 12 }}>
            <VText variant="label">1. Google Authenticator ya da Microsoft Authenticator uygulamasını indir.</VText>
            <VText variant="label">2. Aşağıdaki butona dokun ya da QR kodu başka bir telefondan tara:</VText>
            <Pressable style={styles.openBtn} onPress={() => Linking.openURL(enroll.uri).catch(() => {})}>
              <ExternalLink size={16} color={Colors.cyan} />
              <VText variant="label" color={Colors.cyan}>
                Doğrulama uygulamasında aç
              </VText>
            </Pressable>
            <View style={styles.qr}>
              <Image source={{ uri: enroll.qr }} style={{ width: 180, height: 180 }} contentFit="contain" />
            </View>
            <VText variant="caption">Elle eklemek için anahtar:</VText>
            <VText selectable style={styles.secret}>
              {enroll.secret}
            </VText>
            <VText variant="label">3. Uygulamada görünen 6 haneli kodu yaz:</VText>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="000000"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Pressable onPress={confirm} disabled={busy || code.length !== 6} style={[styles.btn, (busy || code.length !== 6) && { opacity: 0.5 }]}>
              {busy ? (
                <ActivityIndicator color={Colors.onCyan} />
              ) : (
                <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                  Doğrula ve aç
                </VText>
              )}
            </Pressable>
          </GlassCard>
        ) : (
          <Pressable onPress={begin} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color={Colors.onCyan} />
            ) : (
              <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                İki adımlı doğrulamayı aç
              </VText>
            )}
          </Pressable>
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  btn: { height: 50, borderRadius: Radius.pill, backgroundColor: Colors.cyan, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  qr: { alignSelf: 'center', padding: 10, borderRadius: Radius.md, backgroundColor: '#fff' },
  secret: { fontFamily: Fonts.bold, fontSize: 15, letterSpacing: 1.5, color: Colors.text },
  input: {
    height: 52,
    textAlign: 'center',
    letterSpacing: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
});
