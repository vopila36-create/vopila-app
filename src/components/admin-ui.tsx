/** Yönetici paneli ortak parçaları: yetki kapısı, form alanı, küçük buton. */
import { router, useFocusEffect, type Href } from 'expo-router';
import { ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { fetchAdminStatus, type AdminStatus } from '@/lib/admin-api';

/** Yalnızca yönetici + iki adımlı doğrulamalı oturumda içeriği gösterir. */
export function AdminScreen({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const [status, setStatus] = useState<AdminStatus | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchAdminStatus().then((s) => {
        if (alive) setStatus(s);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  if (status === null)
    return (
      <SubScreen title={title}>
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </SubScreen>
    );
  if (status === 'none')
    return (
      <SubScreen title={title}>
        <EmptyState icon={<ShieldAlert size={44} color={Colors.live} />} title="Bu bölüm yalnızca yöneticiler içindir" />
      </SubScreen>
    );
  if (status === 'needs_2fa')
    return (
      <SubScreen title={title}>
        <EmptyState
          icon={<ShieldCheck size={44} color={Colors.gold} />}
          title="Önce iki adımlı doğrulamayı aç"
          text="Yönetici paneli, hesabın ele geçirilmesine karşı yalnızca iki adımlı doğrulamayla açılır. Kurulum 2 dakika sürer; sonra bu sayfaya geri dön."
          action={
            <View style={{ gap: 10, alignSelf: 'stretch' }}>
              <PrimaryButton label="İki adımlı doğrulamayı aç" onPress={() => router.push('/iki-adimli' as Href)} />
              <OutlineButton label="Geri" onPress={() => router.back()} />
            </View>
          }
        />
      </SubScreen>
    );
  return (
    <SubScreen title={title} right={right}>
      {children}
    </SubScreen>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboard,
  multiline,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboard?: KeyboardTypeOptions;
  multiline?: boolean;
  max?: number;
}) {
  return (
    <View style={{ marginTop: Spacing.md }}>
      <VText variant="label" style={{ marginBottom: 6 }}>
        {label}
      </VText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={keyboard}
        multiline={multiline}
        maxLength={max}
        autoCapitalize={keyboard === 'url' ? 'none' : undefined}
        style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }]}
      />
    </View>
  );
}

export function SmallButton({
  label,
  onPress,
  color = Colors.cyan,
  filled,
  busy,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  filled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={[styles.small, { borderColor: color }, filled && { backgroundColor: color }, busy && { opacity: 0.5 }]}>
      {busy ? (
        <ActivityIndicator size="small" color={filled ? Colors.onCyan : color} />
      ) : (
        <VText variant="caption" color={filled ? Colors.onCyan : color} style={{ fontFamily: Fonts.bold }}>
          {label}
        </VText>
      )}
    </Pressable>
  );
}

export function Notice({ text, ok }: { text: string | null; ok?: boolean }) {
  if (!text) return null;
  return (
    <VText variant="caption" color={ok ? Colors.cyan : Colors.live} style={{ marginTop: 8 }}>
      {text}
    </VText>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  small: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
