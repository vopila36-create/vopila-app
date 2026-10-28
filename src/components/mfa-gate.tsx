/**
 * İki adımlı doğrulama kapısı: hesapta açıksa, girişten sonra 6 haneli kod girilmeden uygulama açılmaz.
 * Asıl koruma sunucuda (0011_security_fixes.sql: kod girilmemiş oturum hiçbir veriye erişemez);
 * bu ekran kullanıcıya kodu sorar. Kontrol edilemezse güvenli tarafta kalır (kod ister).
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { activeFactor, verifyCode } from '@/lib/mfa';
import { useAuth } from '@/store/auth';

export function MfaGate({ children }: { children: ReactNode }) {
  const { session, mfaRequired, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [factor, setFactor] = useState<{ id: string | null; tries: number } | null>(null);
  const [tries, setTries] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mfaRequired !== true) return;
    let cancelled = false;
    activeFactor()
      .catch(() => null)
      .then((id) => {
        if (!cancelled) setFactor({ id, tries });
      });
    return () => {
      cancelled = true;
    };
  }, [mfaRequired, tries]);

  if (!session || mfaRequired === false) return <>{children}</>;
  if (mfaRequired === null) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;

  const factorId = factor?.tries === tries ? factor.id : undefined;

  const submit = async () => {
    if (!factorId || busy || code.replace(/\D/g, '').length !== 6) return;
    setBusy(true);
    setError(null);
    const res = await verifyCode(factorId, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Doğrulama yeni (aal2) oturum üretir; giriş sistemi bunu görünce kapı kalkar
    setCode('');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <ShieldCheck size={48} color={Colors.cyan} />
      <VText variant="title" style={{ marginTop: 16, textAlign: 'center' }}>
        İki adımlı doğrulama
      </VText>
      {factorId === undefined ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
      ) : factorId === null ? (
        <>
          <VText style={{ textAlign: 'center', marginTop: 8 }}>
            Güvenlik kontrolü yapılamadı. İnternet bağlantını kontrol edip tekrar dene.
          </VText>
          <Pressable onPress={() => setTries((t) => t + 1)} style={styles.btn}>
            <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
              Tekrar dene
            </VText>
          </Pressable>
        </>
      ) : (
        <>
          <VText style={{ textAlign: 'center', marginTop: 8 }}>
            Doğrulama uygulamandaki (Google Authenticator vb.) VOPILA için gösterilen 6 haneli kodu yaz.
          </VText>
          <TextInput
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            onSubmitEditing={submit}
            keyboardType="number-pad"
            autoFocus
            placeholder="000000"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
            textContentType="oneTimeCode"
          />
          <Pressable onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
            {busy ? (
              <ActivityIndicator color={Colors.onCyan} />
            ) : (
              <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                Doğrula
              </VText>
            )}
          </Pressable>
        </>
      )}
      {error ? (
        <VText variant="caption" color={Colors.live} style={{ marginTop: 10, textAlign: 'center' }}>
          {error}
        </VText>
      ) : null}
      <Pressable onPress={() => signOut()} style={{ marginTop: 24 }}>
        <VText variant="label" color={Colors.textSecondary}>
          Farklı hesapla giriş yap
        </VText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.screen, backgroundColor: Colors.bg },
  input: {
    // Web'de arka plan geçişinin (mutlak konumlu) altında kalmasın
    position: 'relative',
    marginTop: 24,
    width: 220,
    height: 58,
    textAlign: 'center',
    letterSpacing: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 26,
  },
  btn: {
    marginTop: 16,
    width: 220,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
