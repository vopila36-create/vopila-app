/**
 * "Şifremi unuttum" akışının son adımı: e-posta koduyla giriş yapıldıktan sonra yeni şifre belirlenir.
 * Ayarlar'dan "Şifreyi değiştir" ile de açılabilir.
 */
import { router, type Href } from 'expo-router';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function YeniSifre() {
  const auth = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    if (busy) return;
    setError('');
    if (pw.length < 6) return setError('Şifre en az 6 karakter olmalı.');
    if (pw !== pw2) return setError('İki şifre birbirinin aynısı olmalı.');
    setBusy(true);
    const res = await auth.setNewPassword(pw);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setDone(true);
    setTimeout(() => router.replace('/' as Href), 1200);
  };

  const eye = (
    <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} accessibilityLabel="Şifreyi göster">
      {show ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
    </Pressable>
  );

  return (
    <SubScreen title="Yeni Şifre">
      <View style={styles.pad}>
        <View style={styles.icon}>
          <KeyRound size={32} color={Colors.cyan} />
        </View>
        <VText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: Spacing.md }}>
          Hesabına giriş yaptın. Şimdi yeni şifreni belirle; bundan sonra bu şifreyle giriş yapacaksın.
        </VText>

        <VText variant="label" color={Colors.textSecondary} style={{ marginTop: Spacing.xl }}>
          Yeni şifre
        </VText>
        <View style={styles.inputWrap}>
          <TextInput
            value={pw}
            onChangeText={setPw}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            style={styles.input}
            placeholderTextColor={Colors.textMuted}
            placeholder="En az 6 karakter"
          />
          {eye}
        </View>

        <VText variant="label" color={Colors.textSecondary} style={{ marginTop: Spacing.lg }}>
          Yeni şifre (tekrar)
        </VText>
        <View style={styles.inputWrap}>
          <TextInput
            value={pw2}
            onChangeText={setPw2}
            onSubmitEditing={save}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            style={styles.input}
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {error ? (
          <VText variant="caption" color={Colors.live} style={styles.msg}>
            {error}
          </VText>
        ) : null}
        {done ? (
          <VText variant="caption" color={Colors.success} style={styles.msg}>
            Şifren güncellendi! Ana sayfaya geçiliyor…
          </VText>
        ) : null}

        <PrimaryButton
          label={busy ? 'Kaydediliyor…' : 'Şifreyi kaydet'}
          onPress={save}
          style={{ marginTop: Spacing.xl, opacity: busy ? 0.6 : 1 }}
        />
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.lg },
  icon: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cyanDim,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingHorizontal: 14,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  input: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 15 },
  msg: { marginTop: Spacing.md, textAlign: 'center' },
});
