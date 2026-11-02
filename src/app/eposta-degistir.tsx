/**
 * E-posta değiştir: mevcut şifre sunucuda doğrulanır (0032) → yeni adrese 6 haneli kod gider →
 * kod girilince adres değişir. Supabase'in "güvenli e-posta değişikliği" açıksa eski adrese de kod
 * gider; o kod da girilmelidir (iki kutu).
 * Not: Supabase > Authentication > Emails > "Change email address" şablonunda {{ .Token }} olmalı.
 * Asıl koruma sunucuda: "Secure email change" açıkken değişiklik eski adresten de onaylanmadan olmaz
 * (oturumu ele geçiren biri şifre sormayı atlasa bile eski adrese erişemez).
 */
import { router, type Href } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { hasNonAsciiEmail, normalizeEmail, toTurkish, useAuth } from '@/store/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EpostaDegistir() {
  const auth = useAuth();
  const oldEmail = auth.session?.user.email ?? '';
  const [step, setStep] = useState<'form' | 'kod'>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codeNew, setCodeNew] = useState('');
  const [codeOld, setCodeOld] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      const addr = normalizeEmail(email);
      if (hasNonAsciiEmail(addr)) return setError('E-posta adresinde Türkçe karakter (ç, ğ, ö, ş, ü) olamaz.');
      if (!EMAIL_RE.test(addr)) return setError('Geçerli bir e-posta adresi yaz.');
      if (addr === oldEmail) return setError('Bu zaten şu anki e-posta adresin.');
      if (!password) return setError('Mevcut şifreni yaz.');
      const { data, error: rpcErr } = await supabase.rpc('verify_my_password', { p_password: password });
      if (rpcErr) return setError('Şifre kontrol edilemedi. Bağlantını kontrol edip tekrar dene.');
      if (data === 'wrong') return setError('Şifren hatalı.');
      if (data === 'rate_limited') return setError('Çok fazla hatalı deneme. 15 dakika sonra tekrar dene.');
      if (data !== 'ok' && data !== 'no_password') return setError('Şifre kontrol edilemedi. Tekrar dene.');
      const { error: upErr } = await supabase.auth.updateUser({ email: addr });
      if (upErr) return setError(toTurkish(upErr));
      setEmail(addr);
      setStep('kod');
      setInfo(`${addr} adresine 6 haneli bir kod gönderdik. Eski adresine (${oldEmail}) de kod geldiyse onu da yaz.`);
    });

  const verify = () =>
    run(async () => {
      const n = codeNew.replace(/\D/g, '');
      const o = codeOld.replace(/\D/g, '');
      if (n.length < 6) return setError('Yeni adresine gelen 6 haneli kodu yaz.');
      const a = await supabase.auth.verifyOtp({ email, token: n, type: 'email_change' });
      if (a.error) return setError(toTurkish(a.error));
      if (o.length >= 6) {
        const b = await supabase.auth.verifyOtp({ email: oldEmail, token: o, type: 'email_change' });
        if (b.error) return setError(toTurkish(b.error));
      }
      const { data } = await supabase.auth.getUser();
      if (data.user?.email === email) {
        setInfo('E-posta adresin değişti. Bundan sonra yeni adresinle giriş yapacaksın.');
        setTimeout(() => router.replace('/ayarlar' as Href), 1500);
      } else {
        setInfo('Kod onaylandı. Eski adresine gelen kodu da girmen gerekiyor; ikisi de onaylanınca adres değişir.');
      }
    });

  return (
    <SubScreen title="E-posta değiştir">
      <View style={styles.pad}>
        <View style={styles.icon}>
          <Mail size={30} color={Colors.cyan} />
        </View>
        <VText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: Spacing.md }}>
          Şu anki adresin: {oldEmail || '—'}
        </VText>

        {step === 'form' ? (
          <>
            <Label text="Yeni e-posta" />
            <TextInput
              value={email}
              onChangeText={(t) => setEmail(t.replace(/[ıİ]/g, 'i').replace(/\s/g, '').toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              style={styles.input}
              placeholderTextColor={Colors.textMuted}
            />
            <Label text="Mevcut şifre" />
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              style={styles.input}
            />
          </>
        ) : (
          <>
            <Label text={`Yeni adrese gelen kod (${email})`} />
            <TextInput
              value={codeNew}
              onChangeText={(t) => setCodeNew(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              style={[styles.input, styles.code]}
            />
            <Label text={`Eski adrese gelen kod (geldiyse)`} />
            <TextInput
              value={codeOld}
              onChangeText={(t) => setCodeOld(t.replace(/\D/g, '').slice(0, 10))}
              keyboardType="number-pad"
              style={[styles.input, styles.code]}
            />
          </>
        )}

        {error ? (
          <VText variant="caption" color={Colors.live} style={styles.msg}>
            {error}
          </VText>
        ) : null}
        {info && !error ? (
          <VText variant="caption" color={Colors.success} style={styles.msg}>
            {info}
          </VText>
        ) : null}

        <PrimaryButton
          label={busy ? 'Lütfen bekle…' : step === 'form' ? 'Kod gönder' : 'Onayla'}
          onPress={step === 'form' ? sendCode : verify}
          style={{ marginTop: Spacing.xl, opacity: busy ? 0.6 : 1 }}
        />
      </View>
    </SubScreen>
  );
}

function Label({ text }: { text: string }) {
  return (
    <VText variant="label" color={Colors.textSecondary} style={{ marginTop: Spacing.lg, marginBottom: 6 }}>
      {text}
    </VText>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.lg },
  icon: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cyanDim,
  },
  input: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  code: { fontFamily: Fonts.bold, fontSize: 22, letterSpacing: 8, textAlign: 'center' },
  msg: { marginTop: Spacing.md, textAlign: 'center', lineHeight: 18 },
});
