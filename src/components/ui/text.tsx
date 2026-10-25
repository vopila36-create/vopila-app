import { StyleSheet, Text, type TextProps } from 'react-native';

import { Colors, Fonts } from '@/constants/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyBold' | 'caption' | 'label';

type Props = TextProps & {
  variant?: Variant;
  color?: string;
};

export function VText({ variant = 'body', color, style, ...rest }: Props) {
  return <Text style={[styles[variant], color ? { color } : null, style]} {...rest} />;
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
