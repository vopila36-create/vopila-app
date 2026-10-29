/**
 * Giriş sistemi: oturum (kim giriş yaptı) ve Supabase'deki profil satırı.
 * - E-posta + şifre ile kayıt/giriş, Google ile giriş, çıkış, profil güncelleme
 * - E-postaya gelen 6 haneli kodla giriş (şifre gerekmez) ve "Şifremi unuttum"
 * - Face ID / parmak izi ile giriş (bilgiler telefonun şifreli kasasında tutulur)
 * `.env` doldurulmamışsa (isSupabaseConfigured = false) uygulama eskisi gibi demo modunda çalışır.
 */
import type { Session } from '@supabase/supabase-js';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, Platform } from 'react-native';

import { authRedirectUrl, isSupabaseConfigured, signInWithGoogle, supabase } from '@/lib/supabase';

export type DbProfile = {
  id: string;
  username: string;
  name: string;
  bio: string;
  location: string;
  avatar_url: string | null;
  cover_url: string | null;
  is_private: boolean;
  verified: boolean;
  discovery_points: number;
  level_xp: number;
  created_at: string;
};

export type ProfilePatch = Partial<Pick<DbProfile, 'username' | 'name' | 'bio' | 'location' | 'is_private'>>;

/** Galeriden seçilen yeni profil fotoğrafı (base64 ile birlikte, yüklemek için). */
export type PickedImage = { uri: string; base64: string; mimeType?: string };

export type Result =
  | { ok: true; info?: string; needsCode?: boolean }
  | { ok: false; error: string; code?: string };

/** Kod ne için isteniyor: kodla giriş, kayıt doğrulama ya da şifre sıfırlama. */
export type CodePurpose = 'login' | 'signup' | 'recovery';

/**
 * E-postayı düzeltir: boşlukları atar, küçük harfe çevirir ve Türkçe klavyenin
 * noktasız ı / İ harflerini i yapar ("gmaıl.com" → "gmail.com").
 */
export function normalizeEmail(email: string) {
  return email.trim().replace(/[ıİ]/g, 'i').toLowerCase();
}

/** E-postada hâlâ İngilizce dışı harf (ç, ğ, ö, ş, ü...) var mı? */
export const hasNonAsciiEmail = (email: string) => /[^\x20-\x7E]/.test(email);

/** Supabase'in İngilizce hata mesajlarını sade Türkçeye çevirir. */
/** E-posta gönderildi mesajı (Resend SMTP üzerinden 6 haneli kod gelir). */
const EMAIL_SENT_INFO =
  'E-postanı kontrol et: noreply@vopila.com adresinden gelen 6 haneli kodu aşağıya yaz. Gelmediyse gereksiz (spam) klasörüne de bak.';

export function toTurkish(err: { message?: string; code?: string } | null | undefined): string {
  const code = err?.code ?? '';
  const msg = (err?.message ?? '').toLowerCase();
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-posta veya şifre hatalı.';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'E-posta adresin henüz doğrulanmadı. "E-posta koduyla giriş" ile e-postana kod isteyebilirsin.';
  if (code === 'user_already_exists' || msg.includes('already registered'))
    return 'Bu e-posta ile zaten bir hesap var. "Giriş Yap" sekmesinden giriş yapabilirsin.';
  if (code === 'otp_expired' || msg.includes('token has expired') || msg.includes('token is invalid'))
    return 'Kod hatalı ya da süresi dolmuş. Yeni kod iste.';
  if (code === 'otp_disabled' || msg.includes('signups not allowed'))
    return 'Bu e-posta ile kayıtlı bir hesap yok. "Kayıt Ol" sekmesinden hesap oluşturabilirsin.';
  if (code === 'same_password') return 'Yeni şifre eski şifrenle aynı olamaz.';
  if (code === 'weak_password' || msg.includes('password should be')) return 'Şifre en az 6 karakter olmalı.';
  if (code === 'email_address_invalid' || msg.includes('invalid format') || msg.includes('is invalid'))
    return 'Geçerli bir e-posta adresi yaz.';
  if (code === 'over_email_send_rate_limit' || msg.includes('email rate limit'))
    return 'E-posta gönderim sınırına ulaşıldı. Bu, sunucu ayarından kaynaklanıyor; kısa süre içinde düzeltilecek.';
  if (code.startsWith('over_') || msg.includes('rate limit') || msg.includes('security purposes'))
    return 'Yeni kodu birkaç saniye sonra isteyebilirsin.';
  // Sunucudaki güvenlik kuralları (0006_anti_abuse.sql)
  if (msg.includes('rate_limited')) return 'Çok hızlı işlem yapıyorsun. Biraz bekleyip tekrar dene.';
  if (msg.includes('account_suspended'))
    return 'Hesabın topluluk kurallarını ihlal ettiği için kısıtlandı. Destek ekibiyle iletişime geçebilirsin.';
  if (msg === 'blocked' || msg.includes('"blocked"')) return 'Bu kullanıcıyla etkileşim kuramazsın.';
  // Yaş kuralları (0017_age_rules.sql)
  if (msg.includes('minor_dm_not_allowed'))
    return 'Bu kişi 18 yaşından küçük; ona yalnızca onun takip ettiği hesaplar mesaj gönderebilir.';
  if (msg.includes('content_blocked')) {
    const cat = msg.split('content_blocked:')[1]?.trim().split(/\W/)[0];
    const what =
      cat === 'cinsel' ? 'cinsel ifade' : cat === 'siddet' ? 'tehdit' : cat === 'hakaret' ? 'hakaret' : 'küfür';
    return `Yazdığın metin ${what} içeriyor ve topluluk kurallarına aykırı. Lütfen düzenleyip tekrar dene.`;
  }
  if (msg.includes('parent_locked')) return 'Bu ayar ebeveyn denetimi nedeniyle kilitli.';
  if (msg.includes('parent_code_invalid')) return 'Kod hatalı ya da süresi dolmuş. Çocuğundan yeni kod iste.';
  if (msg.includes('parent_must_be_adult')) return 'Ebeveyn denetimini yalnızca 18 yaşından büyükler bağlayabilir.';
  if (msg.includes('parent_only_for_teens')) return 'Ebeveyn kodu yalnızca 15–18 yaş hesaplar için oluşturulur.';
  if (msg.includes('parent_already_linked')) return 'Hesabın zaten bir ebeveyne bağlı.';
  if (msg.includes('under_15')) return "VOPILA'yı kullanmak için en az 15 yaşında olmalısın.";
  if (msg.includes('username_taken')) return 'Bu kullanıcı adı alınmış. Başka bir tane dene.';
  if (msg.includes('username_reserved') || msg.includes('reserved_name'))
    return '“VOPILA” adı resmî hesaplara ayrılmıştır; kullanıcı adında ya da adında kullanılamaz.';
  if (msg.includes('invalid_username') || msg.includes('username_invalid')) return 'Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam ve _ içerebilir.';
  if (msg.includes('invite_invalid'))
    return 'VOPILA şu an kapalı betada: kayıt için geçerli bir davet kodu gerekli. Kodu kontrol et ya da yeni davet iste.';
  if (msg.includes('birth_date_required')) return 'Doğum tarihini yaz. Kayıt için zorunlu.';
  if (msg.includes('invalid_birth_date')) return 'Geçerli bir doğum tarihi yaz.';
  if (msg.includes('age_already_set')) return 'Yaş bilgin zaten kayıtlı. Değiştirmek için Destek üzerinden itiraz et.';
  if (msg.includes('database error saving new user'))
    return 'Hesap oluşturulamadı. Davet kodunun, kullanıcı adının ve doğum tarihinin doğru olduğunu kontrol edip tekrar dene.';
  if (msg.includes('provider is not enabled')) return 'Google ile giriş henüz açılmadı. Şimdilik e-posta ile devam et.';
  if (code === '23505' || msg.includes('duplicate key')) return 'Bu kullanıcı adı alınmış, başka bir tane dene.';
  if (msg.includes('network') || msg.includes('fetch')) return 'İnternet bağlantısı yok gibi görünüyor. Bağlantını kontrol et.';
  return 'Bir sorun oluştu, lütfen tekrar dene.';
}

/** base64 metnini yüklenebilir bayt dizisine çevirir. */
function base64ToBytes(b64: string) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─── Face ID / parmak izi ───────────────────────────────────────────────────

/** Telefonun şifreli kasasında (Keychain / Keystore) tutulan giriş bilgisi. */
const BIO_KEY = 'vopila_bio_creds';
type BioCreds = { email: string; password: string };
/**
 * Kasa ayarı: bilgi yalnızca bu telefonda kalır (yedeğe / başka cihaza geçmez) ve
 * telefonda ekran kilidi şifresi yoksa okunamaz.
 * Not: mağaza sürümünde `requireAuthentication: true` ile okuma işletim sistemi
 * düzeyinde Face ID'ye bağlanabilir (Expo Go'da iPhone'da desteklenmediği için şimdilik kapalı).
 */
const BIO_STORE_OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export type Biometric = {
  /** Telefonda Face ID / parmak izi var ve tanımlı mı */
  available: boolean;
  /** Bu telefonda biyometrik giriş açık mı */
  enabled: boolean;
  /** Ekranda görünecek ad: "Face ID", "Yüz tanıma" ya da "Parmak izi" */
  label: string;
};

async function detectBiometric(): Promise<Biometric> {
  const none: Biometric = { available: false, enabled: false, label: 'Face ID' };
  if (Platform.OS === 'web') return none;
  try {
    const [hasHw, enrolled, types] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
    const label = face ? (Platform.OS === 'ios' ? 'Face ID' : 'Yüz tanıma') : 'Parmak izi';
    const stored = await SecureStore.getItemAsync(BIO_KEY);
    return { available: hasHw && enrolled, enabled: hasHw && enrolled && !!stored, label };
  } catch {
    return none;
  }
}

async function askBiometric(label: string, purpose: string) {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: `${label} ile ${purpose}`,
    cancelLabel: 'Vazgeç',
    fallbackLabel: 'Telefon şifresini kullan',
  });
  return res.success;
}

// ─── Context ────────────────────────────────────────────────────────────────

type Auth = ReturnType<typeof useBuildAuth>;
const AuthContext = createContext<Auth | null>(null);

function useBuildAuth() {
  const [session, setSession] = useState<Session | null>(null);
  // Profil, hangi kullanıcıya ait olduğuyla birlikte tutulur (çıkışta otomatik boşalır)
  const [loaded, setLoaded] = useState<{ userId: string; data: DbProfile | null } | null>(null);
  // Demo modunda beklenecek bir şey yok
  const [ready, setReady] = useState(!isSupabaseConfigured);
  // "Şifremi unuttum" ile kodla girildiyse, ana sayfa yerine yeni şifre ekranına gidilir
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [biometric, setBiometric] = useState<Biometric>({ available: false, enabled: false, label: 'Face ID' });

  const sessionUserId = session?.user.id ?? null;
  const token = session?.access_token ?? null;

  // İki adımlı doğrulama: hesapta açıksa, kod girilene kadar (oturum "aal2" olana kadar) kullanıcı
  // "doğrulanmamış" sayılır; veriler yüklenmez (sunucu da zaten izin vermez — 0011_security_fixes.sql).
  // Kullanıcıya göre tutulur ki saatlik oturum yenilemesinde ekran gidip gelmesin.
  const [aal, setAal] = useState<{ userId: string; need: boolean } | null>(null);
  useEffect(() => {
    if (!token || !sessionUserId) return;
    let alive = true;
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data, error }) => {
      // Kontrol edilemezse güvenli taraf: kod iste
      const need = !!error || (data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2');
      if (alive) setAal({ userId: sessionUserId, need });
    });
    return () => {
      alive = false;
    };
  }, [token, sessionUserId]);
  /** null: kontrol ediliyor · true: kod gerekli · false: tamam */
  const mfaRequired: boolean | null = !sessionUserId ? false : aal?.userId === sessionUserId ? aal.need : null;

  const userId = mfaRequired === false ? sessionUserId : null;
  const profile = loaded && loaded.userId === userId ? loaded.data : null;

  // Açılışta kayıtlı oturumu yükle, sonra değişiklikleri dinle
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    detectBiometric().then(setBiometric);
  }, []);

  const fetchProfile = useCallback(async (id: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    return (data as DbProfile | null) ?? null;
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchProfile(userId).then((data) => {
      if (alive) setLoaded({ userId, data });
    });
    return () => {
      alive = false;
    };
  }, [userId, fetchProfile]);

  const loadProfile = useCallback(async () => {
    if (userId) setLoaded({ userId, data: await fetchProfile(userId) });
  }, [userId, fetchProfile]);

  /** Biyometrik girişi aç: önce Face ID / parmak izi onayı, sonra bilgiler şifreli kasaya. */
  const enableBiometric = useCallback(
    async (email: string, password: string, verifyPassword = false): Promise<Result> => {
      if (!biometric.available) return { ok: false, error: `Bu telefonda ${biometric.label} kullanılamıyor.` };
      if (verifyPassword) {
        // Ayarlar'dan açılırken şifrenin doğru olduğundan emin ol
        const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
        if (error)
          return {
            ok: false,
            error: error.code === 'invalid_credentials' ? 'Şifre hatalı.' : toTurkish(error),
          };
      }
      if (!(await askBiometric(biometric.label, 'girişi aç'))) return { ok: false, error: '' };
      const creds: BioCreds = { email: normalizeEmail(email), password };
      await SecureStore.setItemAsync(BIO_KEY, JSON.stringify(creds), BIO_STORE_OPTS);
      setBiometric((b) => ({ ...b, enabled: true }));
      return { ok: true };
    },
    [biometric.available, biometric.label],
  );

  const disableBiometric = useCallback(async () => {
    await SecureStore.deleteItemAsync(BIO_KEY).catch(() => {});
    setBiometric((b) => ({ ...b, enabled: false }));
  }, []);

  /** Şifre değişince kasadaki bilgiyi güncelle (Face ID girişi bozulmasın). */
  const updateStoredPassword = useCallback(
    async (email: string, password: string) => {
      if (!biometric.enabled) return;
      await SecureStore.setItemAsync(BIO_KEY, JSON.stringify({ email: normalizeEmail(email), password }), BIO_STORE_OPTS);
    },
    [biometric.enabled],
  );

  /** Şifreyle girişten sonra (ve henüz açık değilse) biyometrik girişi teklif et. */
  const offerBiometric = useCallback(
    (email: string, password: string) => {
      if (!biometric.available || biometric.enabled) return;
      Alert.alert(
        `${biometric.label} ile giriş`,
        `Bir dahaki sefere şifre yazmadan ${biometric.label} ile giriş yapmak ister misin?`,
        [
          { text: 'Şimdi değil', style: 'cancel' },
          { text: 'Evet, aç', onPress: () => void enableBiometric(email, password) },
        ],
      );
    },
    [biometric.available, biometric.enabled, biometric.label, enableBiometric],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<Result> => {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
      if (error) return { ok: false, error: toTurkish(error), code: error.code };
      offerBiometric(email, password);
      return { ok: true };
    },
    [offerBiometric],
  );

  const signInWithBiometric = useCallback(async (): Promise<Result> => {
    if (!biometric.enabled) return { ok: false, error: '' };
    if (!(await askBiometric(biometric.label, 'giriş yap'))) return { ok: false, error: '' };
    const raw = await SecureStore.getItemAsync(BIO_KEY);
    if (!raw) {
      setBiometric((b) => ({ ...b, enabled: false }));
      return { ok: false, error: `${biometric.label} bilgisi bulunamadı. Şifrenle giriş yap.` };
    }
    const creds = JSON.parse(raw) as BioCreds;
    const { error } = await supabase.auth.signInWithPassword(creds);
    if (error?.code === 'invalid_credentials') {
      // Şifre başka yerden değiştirilmiş: eski bilgiyi sil
      await disableBiometric();
      return {
        ok: false,
        error: `Şifren değişmiş. Yeni şifrenle giriş yap; sonra ${biometric.label} girişini yeniden açabilirsin.`,
      };
    }
    return error ? { ok: false, error: toTurkish(error) } : { ok: true };
  }, [biometric.enabled, biometric.label, disableBiometric]);

  const signUp = useCallback(
    async (
      name: string,
      username: string,
      email: string,
      password: string,
      birthDate: string,
      inviteCode?: string,
    ): Promise<Result> => {
    const { data, error } = await supabase.auth.signUp({
      email: normalizeEmail(email),
      password,
      // Doğum tarihi yalnızca yaş grubunu hesaplamak için gider; sunucu tarihi hemen siler (0017).
      // Davet kodu kapalı betada zorunlu; sunucu kontrol edip harcar ve hesap bilgisinden siler (0029).
      options: {
        data: { full_name: name.trim(), username, birth_date: birthDate, ...(inviteCode ? { invite_code: inviteCode } : {}) },
        emailRedirectTo: authRedirectUrl(),
      },
    });
    if (error) return { ok: false, error: toTurkish(error), code: error.code };
    // E-posta doğrulaması açıkken var olan bir adres hata vermez, kimliksiz kullanıcı döner
    if (data.user && data.user.identities?.length === 0)
      return { ok: false, error: toTurkish({ code: 'user_already_exists' }) };
    if (!data.session) return { ok: true, needsCode: true, info: EMAIL_SENT_INFO };
    return { ok: true };
  }, []);

  /** Şifresiz giriş / şifremi unuttum: e-postaya 6 haneli kod gönderir (yeni hesap açmaz). */
  const sendLoginCode = useCallback(async (email: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizeEmail(email),
      // E-postalar Resend (noreply@vopila.com) ile gider; şablonda 6 haneli kod ({{ .Token }}) vardır.
      // Yönlendirme adresi eski bağlantılı e-postalar için kalıyor (auth-callback).
      options: { shouldCreateUser: false, emailRedirectTo: authRedirectUrl() },
    });
    if (error) return { ok: false, error: toTurkish(error), code: error.code };
    return { ok: true, info: EMAIL_SENT_INFO };
  }, []);

  /** Kayıt doğrulama kodunu tekrar gönderir. */
  const resendSignupCode = useCallback(async (email: string): Promise<Result> => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizeEmail(email),
      options: { emailRedirectTo: authRedirectUrl() },
    });
    if (error) return { ok: false, error: toTurkish(error), code: error.code };
    return { ok: true, info: 'Yeni kodu gönderdik.' };
  }, []);

  /** E-postaya gelen kodu doğrular; doğruysa giriş yapılmış olur. */
  const verifyCode = useCallback(async (email: string, code: string, purpose: CodePurpose): Promise<Result> => {
    // Yönlendirme oturum açılır açılmaz yapıldığı için bayrak önceden kurulur
    if (purpose === 'recovery') setPasswordRecovery(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.replace(/\D/g, ''),
      type: 'email',
    });
    if (error) {
      setPasswordRecovery(false);
      return { ok: false, error: toTurkish(error), code: error.code };
    }
    return { ok: true };
  }, []);

  /** Yeni şifre belirler (şifremi unuttum akışının son adımı). */
  const setNewPassword = useCallback(
    async (password: string): Promise<Result> => {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, error: toTurkish(error), code: error.code };
      setPasswordRecovery(false);
      if (data.user.email) await updateStoredPassword(data.user.email, password);
      return { ok: true };
    },
    [updateStoredPassword],
  );

  const google = useCallback(async (): Promise<Result> => {
    const res = await signInWithGoogle();
    if (res.ok) return { ok: true };
    if (res.cancelled) return { ok: false, error: '' };
    return { ok: false, error: toTurkish({ message: res.error }) };
  }, []);

  const signOut = useCallback(async () => {
    setPasswordRecovery(false);
    await supabase.auth.signOut();
  }, []);

  /** Profil bilgilerini (ve istenirse yeni fotoğrafı) kaydeder. */
  const saveProfile = useCallback(
    async (patch: ProfilePatch, newAvatar?: PickedImage | null): Promise<Result> => {
      if (!userId) return { ok: false, error: 'Önce giriş yapmalısın.' };
      const update: Record<string, unknown> = { ...patch };

      if (newAvatar) {
        const type = newAvatar.mimeType ?? 'image/jpeg';
        const ext = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
        // Her seferinde yeni dosya adı: eski fotoğraf önbellekte takılı kalmasın
        const path = `${userId}/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, base64ToBytes(newAvatar.base64), { contentType: type, upsert: true });
        if (upErr) return { ok: false, error: 'Fotoğraf yüklenemedi. Tekrar dene.' };
        update.avatar_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      }

      const { data, error } = await supabase.from('profiles').update(update).eq('id', userId).select('*').single();
      if (error) return { ok: false, error: toTurkish(error) };
      setLoaded({ userId, data: data as DbProfile });
      return { ok: true };
    },
    [userId],
  );

  return useMemo(
    () => ({
      /** Supabase bağlı mı (değilse demo modu) */
      enabled: isSupabaseConfigured,
      ready,
      session,
      profile,
      /** İki adımlı doğrulama kodu bekleniyor mu (null: kontrol ediliyor) */
      mfaRequired,
      /** Doğrulanmış kullanıcı kimliği (kod gerekiyorsa null) */
      userId,
      passwordRecovery,
      biometric,
      signIn,
      signUp,
      sendLoginCode,
      resendSignupCode,
      verifyCode,
      setNewPassword,
      signInWithGoogle: google,
      signInWithBiometric,
      enableBiometric,
      disableBiometric,
      signOut,
      saveProfile,
      refreshProfile: loadProfile,
    }),
    [
      ready,
      session,
      profile,
      mfaRequired,
      userId,
      passwordRecovery,
      biometric,
      signIn,
      signUp,
      sendLoginCode,
      resendSignupCode,
      verifyCode,
      setNewPassword,
      google,
      signInWithBiometric,
      enableBiometric,
      disableBiometric,
      signOut,
      saveProfile,
      loadProfile,
    ],
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useBuildAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const a = useContext(AuthContext);
  if (!a) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return a;
}
