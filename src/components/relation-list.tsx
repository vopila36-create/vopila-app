/** Kısıtlanan / sessize alınan hesaplar listesi (kaldırma butonuyla). */
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { User } from '@/data/mock';
import { fetchRelation } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

export function RelationListScreen({
  kind,
  title,
  intro,
  emptyTitle,
  removeLabel,
  icon,
}: {
  kind: 'mutes' | 'restricts';
  title: string;
  intro: string;
  emptyTitle: string;
  removeLabel: string;
  icon: ReactNode;
}) {
  const store = useStore();
  const myId = store.myId;
  const [list, setList] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchRelation(myId, kind).then((res) => {
      if (cancelled) return;
      if (res.ok) setList(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [myId, kind]);

  const remove = async (u: User) => {
    const res = await store.toggleRelation(kind, u.id);
    if (!res.ok) setError(res.error ?? 'İşlem yapılamadı.');
    else setList((l) => (l ?? []).filter((x) => x.id !== u.id));
  };

  return (
    <SubScreen title={title}>
      <View style={styles.pad}>
        <VText variant="caption">{intro}</VText>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
        {!myId ? (
          <EmptyState icon={icon} title="Önce giriş yapmalısın" />
        ) : list === null && !error ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list?.length ? (
          <GlassCard>
            {list.map((u, i) => (
              <View key={u.id} style={[styles.row, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                <Pressable style={styles.main} onPress={() => router.push(`/kullanici/${u.id}` as Href)}>
                  <Avatar uri={u.avatar} size={44} />
                  <View style={{ flex: 1 }}>
                    <VText variant="label" numberOfLines={1}>
                      {u.name}
                    </VText>
                    <VText variant="caption" numberOfLines={1}>
                      @{u.username}
                    </VText>
                  </View>
                </Pressable>
                <Pressable style={styles.btn} onPress={() => remove(u)}>
                  <VText variant="caption" style={{ fontFamily: Fonts.bold }}>
                    {removeLabel}
                  </VText>
                </Pressable>
              </View>
            ))}
          </GlassCard>
        ) : (
          <EmptyState icon={icon} title={emptyTitle} text="Bir profilin sağ üstündeki ••• menüsünden ekleyebilirsin." />
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
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    justifyContent: 'center',
  },
});
