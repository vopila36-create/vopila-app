/**
 * Giriş / Kayıt ekranı. Oturum açılmamışsa uygulama buraya yönlendirir (bkz. _layout.tsx).
 * Adımlar: form (giriş ya da kayıt) → kod (e-postaya gelen 6 haneli kod) / unuttum (şifremi unuttum).
 * 3 hatalı şifre denemesinde bekletme yok: e-postaya kod gönderilir ve kodla giriş yapılır.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { ArrowLeft, Eye, EyeOff, FingerprintPattern, MailCheck, ScanFace } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { Logo } from '@/components/ui/screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { checkBirthDate } from '@/lib/age-api';
import { isReservedName, RESERVED_NAME_ERROR } from '@/lib/reserved';
import { hasNonAsciiEmail, normalizeEmail, useAuth, type CodePurpose, type Result } from '@/store/auth';

type Mode = 'giris' | 'kayit';
type Step = 'form' | 'kod' | 'unuttum';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Kaç hatalı şifreden sonra kodla girişe geçilir */
const MAX_FAILED = 3;
/** "Kodu tekrar gönder" için saniye */
const RESEND_SECONDS = 60;

export default function Giris() {
  const insets = useSafeAreaInsets();
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('giris');
  const [step, setStep] = useState<Step>('form');
  const [purpose, setPurpose] = useState<CodePurpose>('login');
  const [name, setName] = useState('');
  const [birth, setBirth] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [failed, setFailed] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Tekrar gönderme sayacı
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Face ID açıksa ekran açılınca bir kez kendiliğinden sor
  const bioAsked = useRef(false);
  useEffect(() => {
    if (!auth.biometric.enabled || bioAsked.current) return;
    bioAsked.current = true;
    auth.signInWithBiometric().then((res) => {
      if (!res.ok && res.error) setError(res.error);
    });
  }, [auth]);

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  /** Bir işlemi "bekle" durumunda çalıştırır; tekrar basılmayı engeller. */
  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    clearMessages();
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  /** E-postayı kontrol eder; sorun varsa hatayı gösterip null döner. */
  const checkedEmail = () => {
    const clean = normalizeEmail(email);
    if (hasNonAsciiEmail(clean)) {
      setError('E-posta adresinde Türkçe karakter (ç, ğ, ö, ş, ü) olamaz. Örnek: ad@gmail.com');
      return null;
    }
    if (!EMAIL_RE.test(clean)) {
      setError('Geçerli bir e-posta adresi yaz.');
      return null;
    }
    return clean;
  };

  const openCodeStep = (p: CodePurpose, message?: string) => {
    setPurpose(p);
    setStep('kod');
    setCode('');
    setCooldown(RESEND_SECONDS);
    setInfo(message ?? 'E-postana 6 haneli bir kod gönderdik.');
  };

  /** E-postaya giriş kodu gönderip kod adımına geçer. */
  const sendCodeAndOpen = async (p: CodePurpose, addr: string, message?: string) => {
    const res = await auth.sendLoginCode(addr);
    if (res.ok) openCodeStep(p, message);
    else setError(res.error);
  };

  const submitForm = () =>
    run(async () => {
      if (mode === 'kayit' && !name.trim()) return setError('Adını yaz.');
      if (mode === 'kayit' && isReservedName(name)) return setError(RESERVED_NAME_ERROR);
      const addr = checkedEmail();
      if (!addr) return;
      if (password.length < 6) return setError('Şifre en az 6 karakter olmalı.');

      if (mode === 'kayit') {
        // 5651 s. Kanun: 15 yaşını doldurmamış kişiye hesap açılmaz (sunucu da kontrol eder)
        const age = checkBirthDate(birth);
        if (!age.ok) return setError(age.error);
        const res = await auth.signUp(name, addr, password, age.iso);
        if (!res.ok) setError(res.error);
        else if (res.needsCode) openCodeStep('signup', res.info);
        return;
      }

      const res: Result = await auth.signIn(addr, password);
      if (res.ok) return; // Yönlendirmeyi _layout.tsx yapar
      if (res.code === 'email_not_confirmed') {
        return sendCodeAndOpen('login', addr, 'E-postan henüz doğrulanmamış. E-postana gelen kodla giriş yap.');
      }
      if (res.code !== 'invalid_credentials') return setError(res.error);

      const n = failed + 1;
      if (n >= MAX_FAILED) {
        // Bekletme yok: doğrudan e-posta koduyla girişe geç
        setFailed(0);
        return sendCodeAndOpen(
          'login',
          addr,
          `${MAX_FAILED} kez hatalı şifre girdin. Beklemene gerek yok: e-postana gönderdiğimiz kodla giriş yap.`,
        );
      }
      setFailed(n);
      setError(
        MAX_FAILED - n === 1
          ? 'E-posta veya şifre hatalı. Bir kez daha yanlış olursa e-postana giriş kodu göndereceğiz.'
          : res.error,
      );
    });

  const startCodeLogin = () =>
    run(async () => {
      const addr = checkedEmail();
      if (addr) await sendCodeAndOpen('login', addr);
    });

  const submitForgot = () =>
    run(async () => {
      const addr = checkedEmail();
      if (addr)
        await sendCodeAndOpen('recovery', addr, 'E-postana gelen kodu yaz; ardından yeni şifreni belirleyeceksin.');
    });

  const submitCode = () =>
    run(async () => {
      const digits = code.replace(/\D/g, '');
      if (digits.length < 6) return setError('E-postana gelen 6 haneli kodu yaz.');
      const res = await auth.verifyCode(email, digits, purpose);
      if (!res.ok) setError(res.error);
      // Başarılıysa yönlendirmeyi _layout.tsx yapar (şifre sıfırlamada yeni şifre ekranına)
    });

  const resend = () => {
    if (cooldown > 0) return;
    run(async () => {
      const res = purpose === 'signup' ? await auth.resendSignupCode(email) : await auth.sendLoginCode(email);
      if (res.ok) {
        setInfo('Yeni kodu gönderdik.');
        setCooldown(RESEND_SECONDS);
      } else setError(res.error);
    });
  };

  const backToForm = () => {
    setStep('form');
    setCode('');
    clearMessages();
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('form');
    clearMessages();
  };

  const bioLogin = () =>
    run(async () => {
      const res = await auth.signInWithBiometric();
      if (!res.ok && res.error) setError(res.error);
    });

  const google = () =>
    run(async () => {
      const res = await auth.signInWithGoogle();
      if (!res.ok && res.error) setError(res.error);
    });

  const BioIcon = auth.biometric.label === 'Parmak izi' ? FingerprintPattern : ScanFace;

  const title =
    step === 'kod'
      ? 'Kodu gir'
      : step === 'unuttum'
        ? 'Şifreni mi unuttun?'
        : mode === 'giris'
          ? 'Tekrar hoş geldin'
          : 'Aramıza katıl';
  const subtitle =
    step === 'kod'
      ? `${normalizeEmail(email)} adresine gönderilen 6 haneli kodu yaz.`
      : step === 'unuttum'
        ? 'E-postanı yaz, sana bir kod gönderelim. Kodla girip yeni şifreni belirleyeceksin.'
        : mode === 'giris'
          ? 'Keşfetmeye kaldığın yerden devam et.'
          : 'Paylaş, arenalarda yarış, token kazan.';

  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled">
          <View style={{ alignSelf: 'center' }}>
            <Logo tagline />
          </View>

          {step !== 'form' ? (
            <Pressable onPress={backToForm} hitSlop={10} style={styles.back} accessibilityLabel="Geri dön">
              <ArrowLeft size={18} color={Colors.textSecondary} />
              <VText variant="label" color={Colors.textSecondary}>
                Geri dön
              </VText>
            </Pressable>
          ) : null}

          <VText variant="title" style={styles.welcome}>
            {title}
          </VText>
          <VText variant="body" color={Colors.textSecondary} style={styles.sub}>
            {subtitle}
          </VText>

          {step === 'form' ? (
            <>
              <View style={styles.tabs}>
                {(['giris', 'kayit'] as const).map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => switchMode(m)}
                    style={[styles.tab, mode === m && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === m }}>
                    <VText variant="label" color={mode === m ? Colors.onCyan : Colors.textSecondary}>
                      {m === 'giris' ? 'Giriş Yap' : 'Kayıt Ol'}
                    </VText>
                  </Pressable>
                ))}
              </View>

              {mode === 'kayit' ? (
                <>
                  <Field label="Ad Soyad" value={name} onChangeText={setName} maxLength={60} autoComplete="name" />
                  <Field
                    label="Doğum tarihi (zorunlu)"
                    value={birth}
                    onChangeText={(t) => {
                      const d = t.replace(/\D/g, '').slice(0, 8);
                      setBirth([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.'));
                    }}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="05.09.2004"
                  />
                </>
              ) : null}
              <EmailField value={email} onChange={setEmail} />
              <Field
                label="Şifre"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                autoComplete={mode === 'giris' ? 'current-password' : 'new-password'}
                textContentType={mode === 'giris' ? 'password' : 'newPassword'}
                onSubmitEditing={submitForm}
                right={
                  <Pressable onPress={() => setShowPw((s) => !s)} hitSlop={10} accessibilityLabel="Şifreyi göster">
                    {showPw ? <EyeOff size={20} color={Colors.textMuted} /> : <Eye size={20} color={Colors.textMuted} />}
                  </Pressable>
                }
              />

              {mode === 'giris' ? (
                <View style={styles.linkRow}>
                  <Pressable onPress={startCodeLogin} hitSlop={8}>
                    <VText variant="caption" color={Colors.cyan}>
                      E-posta koduyla giriş
                    </VText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStep('unuttum');
                      clearMessages();
                    }}
                    hitSlop={8}>
                    <VText variant="caption" color={Colors.cyan}>
                      Şifremi unuttum
                    </VText>
                  </Pressable>
                </View>
              ) : null}

              <Messages error={error} info={info} />

              <PrimaryButton
                label={busy ? 'Lütfen bekle…' : mode === 'giris' ? 'Giriş Yap' : 'Hesap Oluştur'}
                onPress={submitForm}
                style={{ marginTop: Spacing.lg, opacity: busy ? 0.6 : 1 }}
              />

              {mode === 'kayit' ? (
                <VText variant="caption" style={{ textAlign: 'center', marginTop: Spacing.md }}>
                  Hesap oluşturarak{' '}
                  <VText variant="caption" color={Colors.cyan} onPress={() => router.push('/yasal/kosullar' as Href)}>
                    Kullanım Koşulları
                  </VText>
                  ’nı kabul etmiş ve{' '}
                  <VText variant="caption" color={Colors.cyan} onPress={() => router.push('/yasal/aydinlatma' as Href)}>
                    Aydınlatma Metni
                  </VText>
                  ’ni okumuş olursun.
                </VText>
              ) : null}

              {mode === 'giris' && auth.biometric.enabled ? (
                <OutlineButton
                  label={`${auth.biometric.label} ile giriş`}
                  onPress={bioLogin}
                  iconLeft={<BioIcon size={20} color={Colors.cyan} />}
                  style={{ marginTop: Spacing.md, opacity: busy ? 0.6 : 1 }}
                />
              ) : null}

              <View style={styles.orRow}>
                <View style={styles.line} />
                <VText variant="caption">veya</VText>
                <View style={styles.line} />
              </View>

              <OutlineButton
                label="Google ile devam et"
                onPress={google}
                iconLeft={<VText style={styles.g}>G</VText>}
                style={{ opacity: busy ? 0.6 : 1 }}
              />

              <VText variant="caption" style={styles.legal}>
                Devam ederek Kullanım Koşulları’nı ve Gizlilik Politikası’nı kabul etmiş olursun.
              </VText>
            </>
          ) : null}

          {step === 'unuttum' ? (
            <>
              <EmailField value={email} onChange={setEmail} onSubmit={submitForgot} />
              <Messages error={error} info={info} />
              <PrimaryButton
                label={busy ? 'Lütfen bekle…' : 'Kod gönder'}
                onPress={submitForgot}
                style={{ marginTop: Spacing.lg, opacity: busy ? 0.6 : 1 }}
              />
            </>
          ) : null}

          {step === 'kod' ? (
            <>
              <View style={styles.mailIcon}>
                <MailCheck size={34} color={Colors.cyan} />
              </View>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
                onSubmitEditing={submitCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                placeholder="••••••"
                placeholderTextColor={Colors.textMuted}
                maxLength={10}
                autoFocus
                style={styles.codeInput}
                accessibilityLabel="Doğrulama kodu"
              />
              <Messages error={error} info={info} />
              <PrimaryButton
                label={busy ? 'Lütfen bekle…' : 'Doğrula ve giriş yap'}
                onPress={submitCode}
                style={{ marginTop: Spacing.lg, opacity: busy ? 0.6 : 1 }}
              />
              <Pressable onPress={resend} disabled={cooldown > 0} style={styles.resend} hitSlop={8}>
                <VText variant="label" color={cooldown > 0 ? Colors.textMuted : Colors.cyan}>
                  {cooldown > 0 ? `Kodu tekrar gönder (${cooldown} sn)` : 'Kodu tekrar gönder'}
                </VText>
              </Pressable>
              <VText variant="caption" style={styles.hint}>
                Kod gelmediyse e-postanın Spam / Gereksiz klasörüne de bak.
              </VText>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Messages({ error, info }: { error: string; info: string }) {
  return (
    <>
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
    </>
  );
}

function EmailField({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit?: () => void }) {
  return (
    <Field
      label="E-posta"
      value={value}
      // Yazarken ı → i düzeltilir (Türkçe klavyede "gmaıl" hatası olmasın)
      onChangeText={(t) => onChange(t.replace(/[ıİ]/g, 'i').replace(/\s/g, '').toLowerCase())}
      onSubmitEditing={onSubmit}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      keyboardType="email-address"
      textContentType="emailAddress"
    />
  );
}

function Field({ label, right, ...input }: TextInputProps & { label: string; right?: ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <VText variant="label" color={Colors.textSecondary}>
        {label}
      </VText>
      <View style={styles.inputWrap}>
        <TextInput {...input} placeholderTextColor={Colors.textMuted} style={styles.input} />
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.screen },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xl },
  welcome: { textAlign: 'center', marginTop: 32 },
  sub: { textAlign: 'center', marginTop: 6 },
  tabs: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    padding: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  tab: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.md - 4 },
  tabActive: { backgroundColor: Colors.cyan },
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
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  msg: { marginTop: Spacing.md, textAlign: 'center', lineHeight: 18 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: Spacing.lg },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  g: { fontFamily: Fonts.bold, fontSize: 17, color: Colors.text },
  legal: { textAlign: 'center', marginTop: Spacing.xl, lineHeight: 18 },
  mailIcon: {
    alignSelf: 'center',
    marginTop: Spacing.xl,
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cyanDim,
  },
  codeInput: {
    marginTop: Spacing.lg,
    height: 64,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceStrong,
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 28,
    letterSpacing: 10,
    textAlign: 'center',
  },
  resend: { alignSelf: 'center', marginTop: Spacing.lg },
  hint: { textAlign: 'center', marginTop: Spacing.sm },
});
