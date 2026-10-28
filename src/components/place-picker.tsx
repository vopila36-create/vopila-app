/** Aramalı seçim listesi (il / ilçe / mahalle). Alttan açılan pencere. */
import { Check, ChevronDown, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnTheme, VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { trLower } from '@/lib/tr-adres';

export function PlacePicker({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: () => string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [list, setList] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const t = trLower(q.trim());
    return t ? list.filter((x) => trLower(x).includes(t)) : list;
  }, [q, list]);

  const show = () => {
    if (disabled) return;
    setList(options());
    setQ('');
    setOpen(true);
  };

  return (
    <View style={{ marginTop: Spacing.md }}>
      <VText variant="label" style={{ marginBottom: 6 }}>
        {label}
      </VText>
      <Pressable
        onPress={show}
        style={[styles.field, disabled && { opacity: 0.45 }, error ? { borderColor: Colors.live } : null]}
        accessibilityRole="button"
        accessibilityLabel={`${label} seç`}>
        <VText style={{ flex: 1 }} color={value ? Colors.text : Colors.textMuted} numberOfLines={1}>
          {value || placeholder}
        </VText>
        <ChevronDown size={18} color={Colors.textSecondary} />
      </Pressable>
      {error ? (
        <VText variant="caption" color={Colors.live} style={{ marginTop: 4 }}>
          {error}
        </VText>
      ) : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <OnTheme>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.head}>
            <VText variant="heading" style={{ flex: 1 }}>
              {label} seç
            </VText>
            <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Kapat">
              <X size={22} color={Colors.text} />
            </Pressable>
          </View>
          <View style={styles.search}>
            <Search size={18} color={Colors.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Ara"
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(x) => x}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={30}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
                onPress={() => {
                  onChange(item);
                  setOpen(false);
                }}>
                <VText variant="label" style={{ flex: 1 }}>
                  {item}
                </VText>
                {item === value ? <Check size={18} color={Colors.cyan} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={
              <VText style={{ textAlign: 'center', padding: 20 }}>Sonuç yok.</VText>
            }
          />
        </View>
        </OnTheme>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.surfaceStrong,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.screen,
    paddingTop: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
