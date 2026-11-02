/**
 * Açıklama / yorum metni: @kullanıcıadı profile, #etiket etiket sayfasına götürür (vurgulu).
 */
import { router, type Href } from 'expo-router';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import { VText } from '@/components/ui/text';
import { Colors, Fonts } from '@/constants/theme';
import { users } from '@/data/mock';
import { profileIdByUsername } from '@/lib/social-api';
import { useMe, useStore } from '@/store/app-store';

const TOKEN = /([@#][\p{L}\p{N}_]{2,30})/gu;

export function RichText({
  text,
  color = Colors.text,
  numberOfLines,
  style,
}: {
  text: string;
  color?: string;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  const me = useMe();
  const { myId } = useStore();

  const openMention = async (raw: string) => {
    const username = raw.toLowerCase();
    if (username === me.username.toLowerCase()) {
      router.push('/profil' as Href);
      return;
    }
    // Örnek kişiler yalnızca oturumsuz önizlemede; oturumda yalnızca gerçek kullanıcı adları
    const demo = myId ? undefined : users.find((u) => u.username.toLowerCase() === username);
    if (demo) {
      router.push(`/kullanici/${demo.id}` as Href);
      return;
    }
    const id = await profileIdByUsername(username);
    if (id) router.push(`/kullanici/${id}` as Href);
  };

  const parts = text.split(TOKEN);
  return (
    <VText color={color} numberOfLines={numberOfLines} style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('@') && part.length > 1)
          return (
            <Text key={i} style={{ color: Colors.cyan, fontFamily: Fonts.semibold }} onPress={() => openMention(part.slice(1))}>
              {part}
            </Text>
          );
        if (part.startsWith('#') && part.length > 1)
          return (
            <Text
              key={i}
              style={{ color: Colors.cyan, fontFamily: Fonts.semibold }}
              onPress={() => router.push(`/etiket/${encodeURIComponent(part.slice(1))}` as Href)}>
              {part}
            </Text>
          );
        return part;
      })}
    </VText>
  );
}
