/**
 * "Şifremi unuttum" akışının son adımı: e-posta koduyla giriş yapıldıktan sonra yeni şifre belirlenir.
 * Ayarlar'dan "Şifreyi değiştir" ile açılınca önce mevcut şifre sunucuda doğrulanır (0032).
 */
import { router, type Href } from 'expo-router';
import { Eye, EyeOff, KeyRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/store/auth';

const MIN_PASSWORD = 8;

export default function YeniSifre() {
  const auth = useAuth();
  // Şifremi unuttum akışında mevcut şifre bilinmez; Ayarlar'dan gelince sorulur
  const changing = !auth.passwordRecovery;
  const [current, setCurrent] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const save = async () => {
    if (busy) return;
    setError('');
    if (changing && !current) return setError('Mevcut şifreni yaz.');
    if (pw.length < MIN_PASSWORD) return setError(`Yeni şifre en az ${MIN_PASSWORD} karakter olmalı.`);
    if (pw !== pw2) return setError('İki şifre birbirinin aynısı olmalı.');
    if (changing && pw === current) return setError('Yeni şifre eskisiyle aynı olamaz.');
    setBusy(true);
    if (changing) {
      const { data, error: rpcErr } = await supabase.rpc('verify_my_password', { p_password: current });
      if (rpcErr || data === 'wrong' || data === 'rate_limited') {
        setBusy(false);
        return setError(
          data === 'rate_limited'
            ? 'Çok fazla hatalı deneme. 15 dakika sonra tekrar dene ya da "Şifremi unuttum" ile e-posta kodu kullan.'
            : data === 'wrong'
              ? 'Mevcut şifren hatalı.'
              : 'Şifre kontrol edilemedi. Bağlantını kontrol edip tekrar dene.',
        );
      }
    }
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
          {changing
            ? 'Güvenliğin için önce mevcut şifreni yaz, sonra yeni şifreni belirle.'
            : 'Hesabına giriş yaptın. Şimdi yeni şifreni belirle; bundan sonra bu şifreyle giriş yapacaksın.'}
        </VText>

        {changing ? (
          <>
            <VText variant="label" color={Colors.textSecondary} style={{ marginTop: Spacing.xl }}>
              Mevcut şifre
            </VText>
            <View style={styles.inputWrap}>
              <TextInput
                value={current}
                onChangeText={setCurrent}
                secureTextEntry={!show}
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </>
        ) : null}

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
            placeholder={`En az ${MIN_PASSWORD} karakter`}
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
