import Storage from 'expo-sqlite/kv-store';
import { Appearance, Platform } from 'react-native';

/**
 * VOPILA tasarım sistemi — taslak görsellerdeki renk tonlarından alındı.
 * Koyu lacivert zemin, turkuaz/cyan neon vurgu, altın detaylar.
 */

/**
 * Tema: Koyu (varsayılan) · Açık · Pembe · Telefona göre. Seçim telefonda saklanır ve uygulama AÇILIRKEN okunur;
 * ekranlar renkleri açılışta sabitlediği için tema değişince uygulama yeniden başlatılır (bkz. setThemePref).
 */
export type ThemePref = 'dark' | 'light' | 'pink' | 'system';
const THEME_KEY = 'vopila-theme';

// Telefonda expo-sqlite deposu; web'de tarayıcının deposu (expo-sqlite web'de eşzamanlı çalışmaz)
const isWeb = Platform.OS === 'web';

function readThemePref(): ThemePref {
  try {
    const v = isWeb ? globalThis.localStorage?.getItem(THEME_KEY) : Storage.getItemSync(THEME_KEY);
    return v === 'light' || v === 'pink' || v === 'system' ? v : 'dark';
  } catch {
    return 'dark';
  }
}

export const themePref: ThemePref = readThemePref();
export const isPink = themePref === 'pink';
/** Açık zeminli tema mı (Açık, Pembe ya da telefon açık modda) — durum çubuğu yazısı koyu olur. */
export const isLight =
  themePref === 'light' || isPink || (themePref === 'system' && Appearance.getColorScheme() === 'light');

/** Seçimi kaydeder; ardından uygulama yeniden başlatılmalı (reloadAppAsync). */
export function saveThemePref(pref: ThemePref) {
  try {
    if (isWeb) globalThis.localStorage?.setItem(THEME_KEY, pref);
    else Storage.setItemSync(THEME_KEY, pref);
  } catch {}
}

type Palette = {
  bg: string;
  bgDeep: string;
  bgTop: string;
  surface: string;
  surfaceStrong: string;
  surfaceRaised: string;
  border: string;
  borderStrong: string;
  cyan: string;
  cyanSoft: string;
  cyanDim: string;
  gold: string;
  goldSoft: string;
  live: string;
  liveSoft: string;
  success: string;
  heart: string;
  purple: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  onCyan: string;
};

/** Koyu: koyu lacivert zemin, turkuaz/cyan neon vurgu, altın detaylar (taslak görsellerden). */
const DARK: Palette = {
  // Zemin
  bg: '#040A17',
  bgDeep: '#020611',
  bgTop: '#0A1C38',
  surface: 'rgba(13, 28, 52, 0.72)',
  surfaceStrong: '#0B1A31',
  surfaceRaised: 'rgba(22, 42, 74, 0.6)',
  border: 'rgba(92, 170, 230, 0.18)',
  borderStrong: 'rgba(34, 211, 238, 0.55)',
  // Vurgular
  cyan: '#22D3EE',
  cyanSoft: '#67E8F9',
  cyanDim: 'rgba(34, 211, 238, 0.16)',
  gold: '#F5B642',
  goldSoft: 'rgba(245, 182, 66, 0.16)',
  live: '#EF4444',
  liveSoft: 'rgba(239, 68, 68, 0.16)',
  success: '#34D399',
  heart: '#F43F5E',
  purple: '#A78BFA',
  // Yazı
  text: '#F4F8FF',
  textSecondary: '#A9B8CF',
  textMuted: '#6F819C',
  onCyan: '#04121F',
};

/** Açık: beyaz / açık gri-mavi zemin, okunurluk için koyulaştırılmış turkuaz ve altın. */
const LIGHT: Palette = {
  bg: '#F4F7FB',
  bgDeep: '#E9EFF6',
  bgTop: '#FFFFFF',
  surface: 'rgba(255, 255, 255, 0.92)',
  surfaceStrong: '#FFFFFF',
  surfaceRaised: 'rgba(226, 235, 246, 0.9)',
  border: 'rgba(15, 40, 80, 0.12)',
  borderStrong: 'rgba(8, 145, 178, 0.55)',
  cyan: '#0891B2',
  cyanSoft: '#0E7490',
  cyanDim: 'rgba(8, 145, 178, 0.12)',
  gold: '#A16207',
  goldSoft: 'rgba(161, 98, 7, 0.14)',
  live: '#DC2626',
  liveSoft: 'rgba(220, 38, 38, 0.12)',
  success: '#059669',
  heart: '#E11D48',
  purple: '#7C3AED',
  text: '#0B1626',
  textSecondary: '#3B4A5E',
  textMuted: '#55657A',
  onCyan: '#FFFFFF',
};

/** Pembe: açık pembe zemin, pembe vurgu, mor ve altın detaylar. */
const PINK: Palette = {
  bg: '#F8D7E5',
  bgDeep: '#F1C1D5',
  bgTop: '#FBE3ED',
  surface: 'rgba(253, 236, 243, 0.94)',
  surfaceStrong: '#FDECF3',
  surfaceRaised: 'rgba(243, 196, 216, 0.9)',
  border: 'rgba(157, 23, 77, 0.2)',
  borderStrong: 'rgba(190, 24, 93, 0.6)',
  cyan: '#C2185B',
  cyanSoft: '#9D174D',
  cyanDim: 'rgba(194, 24, 91, 0.14)',
  gold: '#9A6213',
  goldSoft: 'rgba(154, 98, 19, 0.16)',
  live: '#C81E1E',
  liveSoft: 'rgba(200, 30, 30, 0.14)',
  success: '#047857',
  heart: '#BE123C',
  purple: '#7E22CE',
  text: '#2A0A1C',
  textSecondary: '#5A2E44',
  textMuted: '#7A4862',
  onCyan: '#FFFFFF',
};

export const Colors: Palette = isPink ? PINK : isLight ? LIGHT : DARK;

/**
 * Resim / video üstündeki yazılar için renkler: her temada koyu gölge + açık yazı (Instagram gibi).
 * Bunları <OnDark> içinde VText zaten kendiliğinden kullanır; doğrudan renk verirken bunları kullan.
 */
export const OnImage = {
  text: '#F4F8FF',
  textSecondary: '#D3DCEA',
  textMuted: '#B4C1D4',
  /** Koyu zeminde okunur vurgu rengi */
  accent: isPink ? '#F9A8D4' : '#67E8F9',
  gold: '#F5B642',
} as const;

/** Reels gibi her temada koyu kalan alanların zemini. */
export const DarkScreenGradient = ['#0A1C38', '#050D1D', '#02060F'] as const;

/** Resim üstü koyu gölge (temadan bağımsız). */
export const scrim = (alpha: number) => `rgba(4, 10, 23, ${alpha})`;

/** Zemin rengi, istenen saydamlıkla (ör. resim üstü başlık ve etiketler temaya uysun). */
export function bgAlpha(alpha: number): string {
  const h = Colors.bg.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Tuple = readonly [string, string, ...string[]];
export const Gradients: { screen: Tuple; cyanButton: Tuple; cardFade: Tuple; gold: Tuple } = isPink
  ? {
      screen: ['#FBE3ED', '#F8D7E5', '#F1C1D5'],
      cyanButton: ['#E0457F', '#C2185B'],
      cardFade: ['transparent', 'rgba(3, 9, 20, 0.85)'],
      gold: ['#F5C35B', '#C98516'],
    }
  : isLight
  ? {
      screen: ['#FFFFFF', '#F4F7FB', '#E9EFF6'],
      cyanButton: ['#22B8D6', '#0891B2'],
      // Görsel üstündeki yazılar beyaz kalır; geçiş her iki temada koyu
      cardFade: ['transparent', 'rgba(3, 9, 20, 0.85)'],
      gold: ['#F5C35B', '#C98516'],
    }
  : {
      screen: ['#0A1C38', '#050D1D', '#02060F'],
      cyanButton: ['#4BE3F7', '#19BFE0'],
      cardFade: ['transparent', 'rgba(3, 9, 20, 0.92)'],
      gold: ['#FFD47A', '#E09A2A'],
    };

export const Fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screen: 18,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/** Alt menü yüksekliği — ekranların son öğesi menünün arkasında kalmasın diye. */
export const TabBarHeight = 72;
