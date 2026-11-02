/** Hareketlerin: beğendiklerin, yorumların ve geçirdiğin süre (günlük sınır). */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Heart, MessageCircle, Timer, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PostGrid } from '@/components/post-grid';
import { ChoiceList, Section } from '@/components/settings-ui';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Post } from '@/data/mock';
import { deleteComment, fetchLikedPosts, fetchMyComments, saveMySettings, type MyComment } from '@/lib/settings-api';
import { getDailyLimit, lastWeek, setDailyLimit, syncDailyLimit } from '@/lib/usage';
import { useStore } from '@/store/app-store';

type Tab = 'likes' | 'comments' | 'time';

export default function Hareketlerin() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'sure' ? 'time' : 'likes');

  return (
    <SubScreen title="Hareketlerin">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        <Chip label="Beğendiklerin" active={tab === 'likes'} onPress={() => setTab('likes')} />
        <Chip label="Yorumların" active={tab === 'comments'} onPress={() => setTab('comments')} />
        <Chip label="Geçirdiğin süre" active={tab === 'time'} onPress={() => setTab('time')} />
      </ScrollView>
      <View style={{ paddingHorizontal: Spacing.screen }}>
        {tab === 'likes' ? <Likes /> : tab === 'comments' ? <Comments /> : <TimeSpent />}
      </View>
    </SubScreen>
  );
}

function Likes() {
  const { myId } = useStore();
  const [list, setList] = useState<Post[] | null>(null);
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchLikedPosts(myId).then((res) => {
      if (!cancelled) setList(res.ok ? res.data.posts : []);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);
  if (!myId) return <EmptyState icon={<Heart size={40} color={Colors.textMuted} />} title="Önce giriş yapmalısın" />;
  if (list === null) return <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />;
  return list.length ? (
    <PostGrid posts={list} />
  ) : (
    <EmptyState icon={<Heart size={40} color={Colors.textMuted} />} title="Henüz bir gönderi beğenmedin" />
  );
}

function Comments() {
  const { myId } = useStore();
  const [list, setList] = useState<MyComment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchMyComments(myId).then((res) => {
      if (!cancelled) setList(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const remove = async (c: MyComment) => {
    const res = await deleteComment(c.id);
    if (!res.ok) setError(res.error);
    else setList((l) => (l ?? []).filter((x) => x.id !== c.id));
  };

  if (!myId) return <EmptyState icon={<MessageCircle size={40} color={Colors.textMuted} />} title="Önce giriş yapmalısın" />;
  if (list === null) return <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />;
  if (!list.length) return <EmptyState icon={<MessageCircle size={40} color={Colors.textMuted} />} title="Henüz yorum yapmadın" />;
  return (
    <GlassCard>
      {error ? (
        <VText variant="caption" color={Colors.live} style={{ padding: 12 }}>
          {error}
        </VText>
      ) : null}
      {list.map((c, i) => (
        <View key={c.id} style={[styles.commentRow, i === list.length - 1 && { borderBottomWidth: 0 }]}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/gonderi/${c.postId}` as Href)}>
            <VText color={Colors.text} numberOfLines={2}>
              {c.text}
            </VText>
            <VText variant="caption">{c.time}</VText>
          </Pressable>
          <Pressable onPress={() => remove(c)} hitSlop={8} accessibilityLabel="Yorumu sil">
            <Trash2 size={18} color={Colors.textSecondary} />
          </Pressable>
        </View>
      ))}
    </GlassCard>
  );
}

const LIMITS = [
  { key: '0', label: 'Sınır yok' },
  { key: '30', label: '30 dakika' },
  { key: '60', label: '1 saat' },
  { key: '120', label: '2 saat' },
  { key: '180', label: '3 saat' },
] as const;

function TimeSpent() {
  const { myId } = useStore();
  const [week, setWeek] = useState<{ day: string; minutes: number }[] | null>(null);
  const [limit, setLimit] = useState<string>('0');

  useEffect(() => {
    let cancelled = false;
    // Oturumda sınır hesaptan okunur (başka telefonda değiştirildiyse de doğru görünür)
    Promise.all([lastWeek(), myId ? syncDailyLimit(myId) : getDailyLimit()]).then(([w, l]) => {
      if (cancelled) return;
      setWeek(w);
      setLimit(l ? String(l) : '0');
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const changeLimit = async (v: string) => {
    setLimit(v);
    const minutes = Number(v) || null;
    await setDailyLimit(minutes);
    if (myId) saveMySettings(myId, { daily_limit_min: minutes });
  };

  if (!week) return <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />;
  const max = Math.max(1, ...week.map((d) => d.minutes));
  const avg = Math.round(week.reduce((s, d) => s + d.minutes, 0) / week.length);
  const today = week[week.length - 1].minutes;

  return (
    <View>
      <GlassCard style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Timer size={18} color={Colors.cyan} />
          <VText variant="label">Bugün {today} dk · Günlük ortalama {avg} dk</VText>
        </View>
        <View style={styles.chart}>
          {week.map((d) => (
            <View key={d.day} style={styles.barCol}>
              <View style={[styles.bar, { height: `${Math.max(4, (d.minutes / max) * 100)}%` }]} />
              <VText variant="caption" style={{ fontSize: 10 }}>
                {new Date(d.day).toLocaleDateString('tr-TR', { weekday: 'short' })}
              </VText>
            </View>
          ))}
        </View>
        <VText variant="caption">Bu süre yalnızca bu telefonda ölçülür.</VText>
      </GlassCard>
      <Section title="Günlük sınır" note="Sınıra ulaşınca bir kez mola hatırlatması gösterilir.">
        <ChoiceList value={limit} onChange={changeLimit} options={LIMITS.map((l) => ({ key: l.key, label: l.label }))} />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { gap: 8, paddingHorizontal: Spacing.screen, paddingBottom: Spacing.md },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 8, marginVertical: 14 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  bar: { width: '70%', borderRadius: Radius.sm, backgroundColor: Colors.cyan },
  label: { fontFamily: Fonts.bold },
});
