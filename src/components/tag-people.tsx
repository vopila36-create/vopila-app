/**
 * Gönderide kişi etiketleme: seçilenler küçük kartlar olarak görünür, "Kişi etiketle" ile kişi seçici açılır.
 * Paylaşma ve düzenleme ekranlarında kullanılır. Etiketlenmeye izin vermeyen kişiyi sunucu reddeder.
 */
import { UserPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PeoplePicker } from '@/components/people-picker';
import { Avatar } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Radius } from '@/constants/theme';
import type { User } from '@/data/mock';

export const MAX_TAGS = 20;

export function TagPeople({ value, onChange }: { value: User[]; onChange: (next: User[]) => void }) {
  const [open, setOpen] = useState(false);
  const toggle = (u: User) => {
    if (value.some((x) => x.id === u.id)) onChange(value.filter((x) => x.id !== u.id));
    else if (value.length < MAX_TAGS) onChange([...value, u]);
  };

  return (
    <View style={{ gap: 10 }}>
      {value.length ? (
        <View style={styles.chips}>
          {value.map((u) => (
            <View key={u.id} style={styles.chip}>
              <Avatar uri={u.avatar} size={22} />
              <VText variant="caption" color={Colors.text} numberOfLines={1} style={{ maxWidth: 120 }}>
                @{u.username}
              </VText>
              <Pressable onPress={() => toggle(u)} hitSlop={8} accessibilityLabel={`${u.name} etiketini kaldır`}>
                <X size={14} color={Colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.button}>
        <UserPlus size={18} color={Colors.cyan} />
        <VText variant="label" color={Colors.cyan} style={{ flex: 1 }}>
          {open ? 'Kişi seçmeyi bitir' : value.length ? `Etiketlenenler (${value.length})` : 'Kişi etiketle'}
        </VText>
      </Pressable>
      {open ? <PeoplePicker selected={value.map((u) => u.id)} onToggle={toggle} multi /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
});
