/**
 * Takip istekleri: gizli hesaba gelen istekleri onayla ya da reddet.
 * (Bildirimdeki "seni takip etmek istiyor" buraya açılır.)
 */
import { router, type Href } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { User } from '@/data/mock';
import { answerFollowRequest, fetchFollowRequests } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export default function TakipIstekleri() {
  const store = useStore();
  const myId = store.myId;
  const [list, setList] = useState<User[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchFollowRequests(myId).then((res) => {
      if (cancelled) return;
      if (res.ok) setList(res.data);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const answer = async (u: User, accept: boolean) => {
    if (!myId || busy) return;
    setBusy(u.id);
    const res = await answerFollowRequest(myId, u.id, accept);
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setList((l) => (l ?? []).filter((x) => x.id !== u.id));
  };

  if (!myId) {
    return (
      <SubScreen title="Takip İstekleri">
        <EmptyState icon={<UserPlus size={40} color={Colors.cyan} />} title="Önce giriş yapmalısın" />
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Takip İstekleri">
      <View style={styles.pad}>
        {error ? (
          <VText variant="caption" color={Colors.live}>
            {error}
          </VText>
        ) : null}
        {list === null && !error ? (
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
                {busy === u.id ? (
                  <ActivityIndicator size="small" color={Colors.cyan} />
                ) : (
                  <>
                    <Pressable style={styles.accept} onPress={() => answer(u, true)}>
                      <VText variant="caption" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                        Onayla
                      </VText>
                    </Pressable>
                    <Pressable style={styles.reject} onPress={() => answer(u, false)}>
                      <VText variant="caption" style={{ fontFamily: Fonts.bold }}>
                        Sil
                      </VText>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </GlassCard>
        ) : (
          <EmptyState
            icon={<UserPlus size={40} color={Colors.cyan} />}
            title="Bekleyen istek yok"
            text="Hesabın gizliyse, seni takip etmek isteyenler burada görünür."
          />
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  accept: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, backgroundColor: Colors.cyan, justifyContent: 'center' },
  reject: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    justifyContent: 'center',
  },
});
