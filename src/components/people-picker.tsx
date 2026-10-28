/**
 * Kişi seçici: son sohbetler + takip ettiklerin + arama.
 * "Yeni mesaj" ve "arkadaşına gönder" penceresinde kullanılır. Yalnızca gerçek kullanıcılar listelenir.
 */
import { Check, Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { User } from '@/data/mock';
import { toUser } from '@/lib/posts-api';
import { fetchFollowing, searchProfiles } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export function PeoplePicker({
  selected,
  onToggle,
  multi = false,
}: {
  selected: string[];
  onToggle: (user: User) => void;
  multi?: boolean;
}) {
  const store = useStore();
  const myId = store.myId;
  const [query, setQuery] = useState('');
  const [following, setFollowing] = useState<User[] | null>(null);
  const [found, setFound] = useState<{ q: string; list: User[] }>({ q: '', list: [] });

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchFollowing(myId).then((res) => {
      if (!cancelled) setFollowing(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const term = query.trim().replace(/^@/, '');
  useEffect(() => {
    if (!myId || term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      searchProfiles(myId, term).then((res) => {
        if (!cancelled && res.ok) setFound({ q: term, list: res.data });
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, myId]);

  // Son sohbetlerdeki kişiler önce, sonra takip ettiklerin (tekrarsız)
  const suggestions = useMemo(() => {
    const recent = store.inbox.map((c) =>
      toUser({ id: c.otherId, username: c.otherUsername, name: c.otherName, avatar_url: c.otherAvatar, verified: c.otherVerified }),
    );
    const seen = new Set<string>();
    return [...recent, ...(following ?? [])].filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  }, [store.inbox, following]);

  const searching = term.length >= 2;
  const list = searching ? (found.q === term ? found.list : []) : suggestions;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.search}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kişi ara"
          placeholderTextColor={Colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <VText variant="caption">{searching ? 'Sonuçlar' : 'Son sohbetler ve takip ettiklerin'}</VText>
      {!searching && following === null ? (
        <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 20 }} />
      ) : list.length ? (
        list.map((u) => {
          const on = selected.includes(u.id);
          return (
            <Pressable key={u.id} onPress={() => onToggle(u)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
              <Avatar uri={u.avatar} size={44} />
              <View style={{ flex: 1 }}>
                <VText variant="label" numberOfLines={1}>
                  {u.name}
                </VText>
                <VText variant="caption" numberOfLines={1}>
                  @{u.username}
                </VText>
              </View>
              {multi ? (
                <View style={[styles.check, on && styles.checkOn]}>{on ? <Check size={14} color={Colors.onCyan} /> : null}</View>
              ) : null}
            </Pressable>
          );
        })
      ) : (
        <VText style={{ textAlign: 'center', marginVertical: 16 }}>
          {searching ? 'Bu isimde biri bulunamadı.' : 'Henüz kimseyi takip etmiyorsun. Yukarıdan isim arayabilirsin.'}
        </VText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.cyan, borderColor: Colors.cyan },
});
