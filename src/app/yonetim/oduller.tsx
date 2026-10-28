/** Yönetici: hile şüphesiyle bekletilen arena ödülleri — onayla (token verilir) ya da reddet. */
import { useFocusEffect } from 'expo-router';
import { Award } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { fetchPendingRewards, reviewReward, type AdminReward } from '@/lib/admin-api';
import { formatTokens } from '@/store/app-store';

const FLAG: Record<string, (f: AdminReward['flags'][number]) => string> = {
  vote_ring: (f) => `Oy halkası: oy verenlerin %${Math.round((f.share ?? 0) * 100)}’ine kazanan da oy vermiş`,
  empty_accounts: (f) => `Boş hesaplar: oy verenlerin %${Math.round((f.share ?? 0) * 100)}’inin hiç gönderisi yok`,
  batch_accounts: (f) => `Toplu hesaplar: ${f.same_day} oy aynı gün açılmış hesaplardan`,
  vote_burst: (f) => `Ani oy patlaması: ${f.in_one_hour} oy 1 saat içinde`,
};

export default function YonetimOduller() {
  const [list, setList] = useState<AdminReward[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetchPendingRewards();
    if (r.ok) setList(r.data);
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <AdminScreen title="Bekleyen Ödüller">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <VText variant="caption">
          Sistem kazananın oylarında hile izi gördüğünde ödülü bekletir. Onaylarsan token verilir ve kazananlar listesinde
          “ödül verildi” görünür; reddedersen verilmez ve listeden kalkar.
        </VText>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((r) => <RewardCard key={r.id} r={r} onDone={load} />)
        ) : (
          <EmptyState icon={<Award size={40} color={Colors.textMuted} />} title="İncelenecek ödül yok" />
        )}
      </View>
    </AdminScreen>
  );
}

function RewardCard({ r, onDone }: { r: AdminReward; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'ok' | 'no' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const decide = async (approve: boolean) => {
    setBusy(approve ? 'ok' : 'no');
    const res = await reviewReward(r.id, approve, note);
    setBusy(null);
    if (!res.ok) setMsg(res.error);
    else onDone();
  };
  return (
    <GlassCard style={{ padding: 14, gap: 6 }}>
      <VText variant="bodyBold">
        {r.userName} (@{r.username}) · {formatTokens(r.amount)} token
      </VText>
      <VText variant="caption">
        {r.reason} · {r.date}
      </VText>
      {r.flags.map((f, i) => (
        <VText key={i} variant="caption" color={Colors.gold}>
          • {(FLAG[f.kind] ?? (() => f.kind))(f)}
        </VText>
      ))}
      <Field label="Not (isteğe bağlı)" value={note} onChange={setNote} max={300} />
      <View style={styles.actions}>
        <SmallButton label="Onayla, token ver" filled onPress={() => decide(true)} busy={busy === 'ok'} />
        <SmallButton label="Reddet" color={Colors.live} onPress={() => decide(false)} busy={busy === 'no'} />
      </View>
      <Notice text={msg} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: 8, marginTop: 8 } });
