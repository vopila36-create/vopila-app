/** Yönetici: şikayet kuyruğu — içeriği kaldır, şikayeti reddet, kullanıcıyı askıya al. */
import { router, useFocusEffect, type Href } from 'expo-router';
import { Flag } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AdminScreen, Notice, SmallButton } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { fetchOpenReports, resolveReport, setUserStatus, type ReportGroup } from '@/lib/admin-api';
import { REPORT_REASONS } from '@/lib/social-api';

const TYPE: Record<string, string> = {
  post: 'Gönderi',
  comment: 'Yorum',
  user: 'Profil',
  moment: 'An',
  live: 'Canlı yayın',
  highlight: 'Öne Çıkan',
  review: 'Ürün değerlendirmesi',
};
const reasonLabel = (k: string) => REPORT_REASONS.find((r) => r.key === k)?.label ?? k;

export default function YonetimSikayetler() {
  const [list, setList] = useState<ReportGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchOpenReports();
    if (r.ok) setList(r.data);
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <AdminScreen title="Şikayetler">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <VText variant="caption">
          Aynı içerik için gelen şikayetler birlikte gösterilir. 5 güvenilir şikayette içerik otomatik gizlenir; kararı sen verirsin.
        </VText>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((g) => <ReportCard key={g.key} g={g} onDone={load} />)
        ) : (
          <EmptyState icon={<Flag size={40} color={Colors.textMuted} />} title="Açık şikayet yok" />
        )}
      </View>
    </AdminScreen>
  );
}

function ReportCard({ g, onDone }: { g: ReportGroup; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const decide = async (d: 'remove' | 'dismiss' | 'sensitive') => {
    setBusy(d);
    const r = await resolveReport(g.firstReportId, d);
    setBusy(null);
    if (!r.ok) setMsg(r.error);
    else onDone();
  };

  const suspend = async () => {
    if (!g.preview?.authorId) return;
    setBusy('suspend');
    const r = await setUserStatus(g.preview.authorId, 'suspended', `Şikayet: ${Object.keys(g.reasons).join(', ')}`);
    setBusy(null);
    setMsg(r.ok ? 'Hesap askıya alındı (paylaşım ve yorum yapamaz).' : r.error);
  };

  const open = () => {
    if (g.targetType === 'post') router.push(`/gonderi/${g.targetId}` as Href);
    else if (g.targetType === 'user') router.push(`/kullanici/${g.targetId}` as Href);
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <View style={styles.type}>
          <VText variant="caption" style={{ fontFamily: Fonts.bold }}>
            {TYPE[g.targetType] ?? g.targetType}
          </VText>
        </View>
        <VText variant="label" color={Colors.live} style={{ flex: 1 }}>
          {g.count} şikayet
        </VText>
        {g.preview?.hidden ? (
          <VText variant="caption" color={Colors.gold}>
            Otomatik gizlendi
          </VText>
        ) : null}
      </View>
      <Pressable onPress={open} style={styles.preview}>
        {g.preview ? (
          <>
            <VText variant="label">{g.preview.authorName}</VText>
            <VText color={Colors.text} numberOfLines={4}>
              {g.preview.text || '(metin yok)'}
            </VText>
          </>
        ) : (
          <VText variant="caption">İçerik bulunamadı (silinmiş olabilir).</VText>
        )}
      </Pressable>
      <VText variant="caption">
        {Object.entries(g.reasons)
          .map(([k, n]) => `${reasonLabel(k)} (${n})`)
          .join(' · ')}
      </VText>
      {g.details.slice(0, 3).map((d, i) => (
        <VText key={i} variant="caption" style={{ fontStyle: 'italic' }}>
          “{d}”
        </VText>
      ))}
      <View style={styles.actions}>
        <SmallButton label="İçeriği kaldır" color={Colors.live} filled onPress={() => decide('remove')} busy={busy === 'remove'} />
        {g.targetType === 'post' ? (
          <SmallButton label="Hassas işaretle" color={Colors.gold} onPress={() => decide('sensitive')} busy={busy === 'sensitive'} />
        ) : null}
        <SmallButton label="Sorun yok" onPress={() => decide('dismiss')} busy={busy === 'dismiss'} />
        {g.preview?.authorId ? (
          <SmallButton label="Hesabı askıya al" color={Colors.gold} onPress={suspend} busy={busy === 'suspend'} />
        ) : null}
      </View>
      <Notice text={msg} ok={msg?.startsWith('Hesap')} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  type: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.pill, backgroundColor: Colors.surfaceRaised },
  preview: { padding: 10, borderRadius: Radius.sm, backgroundColor: Colors.surface, gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
});
