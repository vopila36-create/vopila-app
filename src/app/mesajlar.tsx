/**
 * Mesajlar (gelen kutusu): sohbetler en yeniden eskiye, okunmamışlar vurgulu.
 * Yeni mesaj gelince liste canlı güncellenir (app-store gelen kutusunu dinler).
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { BadgeCheck, MessageCircle, PenSquare, Search } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, GlassCard, OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { chatTime, kindPreview } from '@/lib/messages-api';
import { useStore } from '@/store/app-store';

const norm = (s: string) => s.toLocaleLowerCase('tr-TR');

export default function Mesajlar() {
  const store = useStore();
  const [query, setQuery] = useState('');

  const { refreshInbox } = store;
  useFocusEffect(
    useCallback(() => {
      refreshInbox();
    }, [refreshInbox]),
  );

  if (!store.myId) {
    return (
      <SubScreen title="Mesajlar">
        <EmptyState
          icon={<MessageCircle size={40} color={Colors.cyan} />}
          title="Mesajlaşmak için giriş yap"
          action={<OutlineButton label="Giriş Yap" onPress={() => router.push('/giris' as Href)} />}
        />
      </SubScreen>
    );
  }

  const q = norm(query.trim());
  const list = store.inbox.filter((c) => !q || norm(c.otherName).includes(q) || norm(c.otherUsername).includes(q));

  return (
    <SubScreen
      title="Mesajlar"
      right={
        <Pressable hitSlop={10} onPress={() => router.push('/mesaj/yeni' as Href)} accessibilityLabel="Yeni mesaj">
          <PenSquare size={22} color={Colors.text} />
        </Pressable>
      }>
      <View style={styles.pad}>
        <View style={styles.search}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Sohbetlerde ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {list.length ? (
          <GlassCard>
            {list.map((c, i) => {
              const unread = c.unread > 0;
              const preview =
                c.lastKind === 'post' ? (c.lastText ? `Gönderi: ${c.lastText}` : 'Bir gönderi paylaştı') : kindPreview(c.lastKind, c.lastText);
              return (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/mesaj/${c.id}` as Href)}
                  style={({ pressed }) => [styles.row, i === list.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}>
                  <Avatar uri={c.otherAvatar} size={50} ring={unread} />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <VText variant="label" style={unread ? { fontFamily: Fonts.bold } : undefined} numberOfLines={1}>
                        {c.otherName}
                      </VText>
                      {c.otherVerified ? <BadgeCheck size={14} color="#fff" fill={Colors.cyan} /> : null}
                    </View>
                    <VText
                      variant="caption"
                      color={unread ? Colors.text : Colors.textSecondary}
                      style={unread ? { fontFamily: Fonts.semibold } : undefined}
                      numberOfLines={1}>
                      {c.lastFromMe ? 'Sen: ' : ''}
                      {preview}
                    </VText>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <VText variant="caption">{chatTime(c.lastAt)}</VText>
                    {unread ? <View style={styles.dot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </GlassCard>
        ) : (
          <EmptyState
            icon={<MessageCircle size={40} color={Colors.cyan} />}
            title={q ? 'Sonuç yok' : 'Henüz mesajın yok'}
            text={
              q
                ? undefined
                : 'Bir gönderinin altındaki uçak simgesiyle arkadaşlarına gönder ya da bir profilden "Mesaj" ile sohbet başlat.'
            }
            action={q ? undefined : <OutlineButton label="Yeni Mesaj" onPress={() => router.push('/mesaj/yeni' as Href)} />}
          />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, gap: Spacing.md },
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
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.cyan },
});
