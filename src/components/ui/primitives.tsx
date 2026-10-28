import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { OnTheme, VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';

/** Yarı saydam, ince cyan kenarlıklı kart (taslaklardaki cam görünümü). */
export function GlassCard({
  children,
  style,
  highlighted,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.card, highlighted && styles.cardHighlighted, style]}>{children}</View>
  );
}

/** Başlık + sağda "Tümünü Gör >" bağlantısı. */
export function SectionHeader({
  title,
  subtitle,
  action = 'Tümünü Gör',
  onAction,
  icon,
}: {
  title: string;
  subtitle?: string;
  action?: string | null;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1 }}>
        <View style={styles.row}>
          {icon}
          <VText variant="heading">{title}</VText>
        </View>
        {subtitle ? (
          <VText variant="caption" style={{ marginTop: 2 }}>
            {subtitle}
          </VText>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} style={styles.row}>
          <VText variant="label" color={Colors.cyan}>
            {action}
          </VText>
          <ChevronRight size={16} color={Colors.cyan} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Dolu cyan buton. */
export function PrimaryButton({
  label,
  onPress,
  icon,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}>
      <LinearGradient
        colors={Gradients.cyanButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryButton}>
        <VText style={styles.primaryLabel}>{label}</VText>
        {icon}
      </LinearGradient>
    </Pressable>
  );
}

/** Cyan kenarlıklı boş buton. */
export function OutlineButton({
  label,
  onPress,
  icon,
  iconLeft,
  style,
}: {
  label: string;
  onPress?: () => void;
  icon?: ReactNode;
  iconLeft?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.outlineButton, { opacity: pressed ? 0.8 : 1 }, style]}>
      {iconLeft}
      <VText variant="label">{label}</VText>
      {icon}
    </Pressable>
  );
}

/** Sekme/filtre hapı (Gündem, Teknoloji...). */
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <OnTheme>
      <VText
        variant="label"
        color={active ? Colors.onCyan : Colors.text}
        style={active ? { fontFamily: Fonts.bold } : undefined}>
        {label}
      </VText>
      </OnTheme>
    </Pressable>
  );
}

/** Yuvarlak profil fotoğrafı, istenirse cyan halkalı. */
export function Avatar({ uri, size = 40, ring }: { uri: string; size?: number; ring?: boolean }) {
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' },
        ring && { borderWidth: 2, borderColor: Colors.cyan },
      ]}>
      {uri ? (
        <Image source={{ uri }} style={{ flex: 1 }} contentFit="cover" transition={200} />
      ) : (
        // Fotoğraf yüklenmemişse boş profil simgesi
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.surfaceRaised }}>
          <UserRound size={size * 0.55} color={Colors.textMuted} />
        </View>
      )}
    </View>
  );
}

/** Görselin üstüne alttan karartma (yazı okunabilsin). */
export function BottomFade({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <LinearGradient
      colors={Gradients.cardFade}
      style={[StyleSheet.absoluteFill, style]}
      start={{ x: 0, y: 0.3 }}
      end={{ x: 0, y: 1 }}
      pointerEvents="none"
    />
  );
}

/** Yuvarlak oynat düğmesi. */
export function PlayBadge({ size = 44, children }: { size?: number; children: ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.85)',
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  cardHighlighted: {
    borderColor: Colors.borderStrong,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 42,
    borderRadius: Radius.md,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  primaryLabel: { fontFamily: Fonts.bold, fontSize: 14, color: Colors.onCyan },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.cyan,
    backgroundColor: 'rgba(34, 211, 238, 0.06)',
  },
  chip: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: Colors.cyan,
    borderColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
});
