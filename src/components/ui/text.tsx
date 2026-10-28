import { createContext, useContext, type ReactNode } from 'react';
import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts, OnImage } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyBold' | 'caption' | 'label';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
};

/** Resim / video üstündeki alan: içindeki yazılar her temada açık renk olur. */
const OnDarkCtx = createContext(false);
export function OnDark({ children }: { children: ReactNode }) {
  return <OnDarkCtx.Provider value>{children}</OnDarkCtx.Provider>;
}
/** Koyu katmanın içinden açılan pencereler (gönder, şikâyet) temanın renklerine döner. */
export function OnTheme({ children }: { children: ReactNode }) {
  return <OnDarkCtx.Provider value={false}>{children}</OnDarkCtx.Provider>;
}
export const useOnDark = () => useContext(OnDarkCtx);

/** Koyu katmanda temanın yazı renkleri açık karşılıklarına çevrilir (açık/pembe temada okunur kalsın). */
const ON_DARK: Record<string, string> = {
  [Colors.text]: OnImage.text,
  [Colors.textSecondary]: OnImage.textSecondary,
  [Colors.textMuted]: OnImage.textMuted,
  [Colors.cyan]: OnImage.accent,
  [Colors.cyanSoft]: OnImage.accent,
  [Colors.gold]: OnImage.gold,
};
/** Koyu katmandaysa rengi okunur karşılığına çevirir (ikonlar için de kullanılır). */
export function useInk() {
  const onDark = useContext(OnDarkCtx);
  return (c: string) => (onDark ? (ON_DARK[c] ?? c) : c);
}

export function VText({ variant = 'body', color, style, ...rest }: Props) {
  const onDark = useContext(OnDarkCtx);
  const c = color && onDark ? (ON_DARK[color] ?? color) : color;
  // Stil dosyasında verilen tema rengi de koyu katmanda açık karşılığına çevrilir
  let s2 = style;
  if (onDark && style) {
    const flat = StyleSheet.flatten(style);
    const mapped = typeof flat?.color === 'string' ? ON_DARK[flat.color] : undefined;
    if (mapped) s2 = [style, { color: mapped }];
  }
  return <Text style={[styles[variant], onDark && dark[variant], c ? { color: c } : null, s2]} {...rest} />;
}

const styles = StyleSheet.create({
  display: { fontFamily: Fonts.extrabold, fontSize: 36, lineHeight: 42, color: Colors.text },
  title: { fontFamily: Fonts.extrabold, fontSize: 30, lineHeight: 36, color: Colors.text },
  heading: { fontFamily: Fonts.bold, fontSize: 19, lineHeight: 24, color: Colors.text },
  body: { fontFamily: Fonts.regular, fontSize: 14, lineHeight: 20, color: Colors.textSecondary },
  bodyBold: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 20, color: Colors.text },
  caption: { fontFamily: Fonts.medium, fontSize: 12, lineHeight: 16, color: Colors.textMuted },
  label: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 17, color: Colors.text },
});

const dark = StyleSheet.create({
  display: { color: OnImage.text },
  title: { color: OnImage.text },
  heading: { color: OnImage.text },
  body: { color: OnImage.textSecondary },
  bodyBold: { color: OnImage.text },
  caption: { color: OnImage.textMuted },
  label: { color: OnImage.text },
});
