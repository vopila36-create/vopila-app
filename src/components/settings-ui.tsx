/** Ayar ekranlarının ortak parçaları: bölüm, satır, aç/kapa, seçenek listesi. */
import { Check, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <VText variant="caption" style={styles.sectionTitle}>
        {title.toLocaleUpperCase('tr-TR')}
      </VText>
      <GlassCard>{children}</GlassCard>
      {note ? (
        <VText variant="caption" style={{ marginTop: 6, marginHorizontal: 4 }}>
          {note}
        </VText>
      ) : null}
    </View>
  );
}

export function Row({
  icon,
  label,
  value,
  onPress,
  last,
  danger,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, last && styles.last, pressed && { opacity: 0.7 }]} onPress={onPress}>
      {icon}
      <VText variant="label" color={danger ? Colors.live : Colors.text} style={{ flex: 1 }}>
        {label}
      </VText>
      {value ? (
        <VText variant="caption" numberOfLines={1} style={{ maxWidth: 140 }}>
          {value}
        </VText>
      ) : null}
      {!danger ? <ChevronRight size={18} color={Colors.textMuted} /> : null}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
  last,
}: {
  icon?: ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.last]}>
      {icon}
      <View style={{ flex: 1 }}>
        <VText variant="label">{label}</VText>
        {desc ? <VText variant="caption">{desc}</VText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
        thumbColor="#fff"
      />
    </View>
  );
}

/** Tek seçimli liste (ör. "Kimler yorum yapabilir?"). */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string; desc?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      {options.map((o, i) => (
        <Pressable
          key={o.key}
          onPress={() => onChange(o.key)}
          style={({ pressed }) => [styles.row, i === options.length - 1 && styles.last, pressed && { opacity: 0.7 }]}>
          <View style={{ flex: 1 }}>
            <VText variant="label">{o.label}</VText>
            {o.desc ? <VText variant="caption">{o.desc}</VText> : null}
          </View>
          <View style={[styles.radio, value === o.key && styles.radioOn]}>
            {value === o.key ? <Check size={13} color={Colors.onCyan} strokeWidth={3} /> : null}
          </View>
        </Pressable>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { letterSpacing: 1, marginBottom: 6, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  last: { borderBottomWidth: 0 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
});
