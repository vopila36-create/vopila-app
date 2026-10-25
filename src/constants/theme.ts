/**
 * VOPILA tasarım sistemi — taslak görsellerdeki renk tonlarından alındı.
 * Koyu lacivert zemin, turkuaz/cyan neon vurgu, altın detaylar.
 */

export const Colors = {
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
} as const;

export const Gradients = {
  screen: ['#0A1C38', '#050D1D', '#02060F'] as const,
  cyanButton: ['#4BE3F7', '#19BFE0'] as const,
  cardFade: ['transparent', 'rgba(3, 9, 20, 0.92)'] as const,
  gold: ['#FFD47A', '#E09A2A'] as const,
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
