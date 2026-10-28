/**
 * İki adımlı doğrulama kapısı: hesapta açıksa, şifreyle girişten sonra 6 haneli kod girilmeden
 * uygulama açılmaz. Kod doğrulanınca oturum "aal2" olur ve kapı kalkar.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { ShieldCheck } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { activeFactor, needsSecondStep, verifyCode } from '@/lib/mfa';
import { useAuth } from '@/store/auth';

export function MfaGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const token = session?.access_token ?? null;
  // Hangi oturum için kontrol edildi (oturum değişince yeniden kontrol edilir)
  const [checked, setChecked] = useState<{ token: string | null; need: boolean; factorId: string | null } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    needsSecondStep().then(async (need) => {
      const factorId = need ? await activeFactor() : null;
      if (!cancelled) setChecked({ token, need: need && !!factorId, factorId });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return <>{children}</>;
  const state = checked?.token === token ? checked : null;
  if (!state) return <View style={{ flex: 1, backgroundColor: Colors.bg }} />;
  if (!state.need) return <>{children}</>;

  const submit = async () => {
    if (!state.factorId || busy || code.replace(/\D/g, '').length !== 6) return;
    setBusy(true);
    setError(null);
    const res = await verifyCode(state.factorId, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCode('');
    // Yeni oturum belirteci gelince yukarıdaki kontrol yeniden çalışır ve kapı kalkar
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <ShieldCheck size={48} color={Colors.cyan} />
      <VText variant="title" style={{ marginTop: 16, textAlign: 'center' }}>
        İki adımlı doğrulama
      </VText>
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
