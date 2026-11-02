/**
 * Supabase istemcisi (giriş, veritabanı, dosya depolama).
 * Adres ve anahtar `.env` dosyasından gelir (bkz. `.env.example`).
 * Publishable anahtar uygulamada bulunabilir; service_role / secret anahtar ASLA buraya konmaz.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** `.env` doldurulmadıysa false — ekranlar bu durumda yerel demo verisiyle çalışmaya devam eder. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

const isWeb = Platform.OS === 'web';

export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_PUBLISHABLE_KEY || 'placeholder-key',
  {
    auth: {
      // Telefonda oturum AsyncStorage'da; web'de tarayıcının varsayılan depolaması kullanılır
      ...(isWeb ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      // Kodu biz `signInWithGoogle` içinde elle değiştiriyoruz; otomatik algılama çift değişime yol açar
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  },
);

// Uygulama ön plandayken oturum yenilemesini çalıştır, arka planda durdur (Supabase'in RN önerisi)
if (!isWeb) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Web'de Google açılır penceresi geri döndüğünde pencereyi kapatıp sonucu ana sayfaya iletir
WebBrowser.maybeCompleteAuthSession();

/** Google girişinden sonra dönülecek adres (Supabase > Auth > URL Configuration'a eklenmeli). */
export const authRedirectUrl = () => Linking.createURL('auth-callback');

export type GoogleSignInResult = { ok: true } | { ok: false; cancelled?: boolean; error?: string };

/**
 * "Google ile giriş yap": Google'ın hesap seçme ekranını açar (cihazda kayıtlı hesaplar listelenir),
 * dönüşte gelen kodu oturuma çevirir. Expo Go'da, telefonda ve web'de çalışır.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'Supabase henüz yapılandırılmadı (.env eksik).' };

  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Her seferinde hesap seçiciyi göster (kayıtlı hesaplar arasından seçim)
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data?.url) return { ok: false, error: error?.message ?? 'Giriş başlatılamadı.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return { ok: false, cancelled: true };

  return completeAuthFromUrl(result.url);
}

/** Dönüş adresindeki `code` parametresini oturuma çevirir (deep link ile gelindiğinde de kullanılır). */
export async function completeAuthFromUrl(url: string): Promise<GoogleSignInResult> {
  const { queryParams } = Linking.parse(url);
  const errorDescription = queryParams?.error_description ?? queryParams?.error;
  if (errorDescription) return { ok: false, error: String(errorDescription) };

  const code = queryParams?.code;
  if (typeof code !== 'string' || !code) return { ok: false, error: 'Giriş kodu alınamadı.' };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Oturumu kapat. */
export async function signOut() {
  await supabase.auth.signOut();
}

/** Profil fotoğrafının herkese açık adresi ('avatars' kovası açıktır). */
export function avatarUrl(path: string) {
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/**
 * Gönderi / an dosyaları ('media' kovası) GİZLİDİR: yalnızca o içeriği görmeye yetkili kişi
 * kısa süreli imzalı bir adres alabilir (gizli hesabın fotoğrafını takipçi olmayan açamaz).
 * Yetki yoksa ilgili adres null döner.
 */
// İmzalı adres süresi kısa tutulur (bağlantı kopyalanıp paylaşılsa bile kısa sürede geçersiz olur)
export async function mediaUrls(paths: string[], expiresInSec = 30 * 60): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (!unique.length) return {};
  const { data } = await supabase.storage.from('media').createSignedUrls(unique, expiresInSec);
  const out: Record<string, string | null> = {};
  for (const p of unique) out[p] = null;
  for (const item of data ?? []) if (item.path) out[item.path] = item.error ? null : item.signedUrl;
  return out;
}
