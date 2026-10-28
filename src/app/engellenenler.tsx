/** Engellenen hesaplar: listele ve engeli kaldır. */
import { Ban } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { User } from '@/data/mock';
import { fetchBlocked, setBlocked } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export default function Engellenenler() {
  const store = useStore();
  const myId = store.myId;
  const [list, setList] = useState<User[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchBlocked(myId).then((res) => {
      if (cancelled) return;
      if (res.ok) setList(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const unblock = async (u: User) => {
    if (!myId || busy) return;
    setBusy(u.id);
    const res = await setBlocked(myId, u.id, false);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setList((l) => (l ?? []).filter((x) => x.id !== u.id));
    store.refreshFeed();
  };

  return (
    <SubScreen title="Engellenen Hesaplar">
      <View style={styles.pad}>
        <VText variant="caption">
          Engellediğin kişiler profilini, gönderilerini ve anlarını göremez, sana mesaj atamaz. Engellendiklerini bilmezler.
        </VText>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
        {!myId ? (
          <EmptyState icon={<Ban size={40} color={Colors.textMuted} />} title="Önce giriş yapmalısın" />
        ) : list === null && !error ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list?.length ? (
          <GlassCard>
            {list.map((u, i) => (
              <View key={u.id} style={[styles.row, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                <Avatar uri={u.avatar} size={44} />
                <View style={{ flex: 1 }}>
                  <VText variant="label" numberOfLines={1}>
                    {u.name}
                  </VText>
                  <VText variant="caption" numberOfLines={1}>
                    @{u.username}
                  </VText>
                </View>
                {busy === u.id ? (
                  <ActivityIndicator size="small" color={Colors.cyan} />
                ) : (
                  <Pressable style={styles.btn} onPress={() => unblock(u)}>
                    <VText variant="caption" style={{ fontFamily: Fonts.bold }}>
                      Engeli kaldır
                    </VText>
                  </Pressable>
                )}
              </View>
            ))}
          </GlassCard>
        ) : (
          <EmptyState icon={<Ban size={40} color={Colors.textMuted} />} title="Engellediğin kimse yok" />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, gap: Spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  btn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    justifyContent: 'center',
  },
});
