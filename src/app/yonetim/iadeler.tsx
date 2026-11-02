/** Yönetici: iade talepleri. Onaylanırsa siparişin tokenleri müşteriye iade edilir ve bildirim gider. */
import { useFocusEffect } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { fetchReturns, resolveReturn, type AdminReturn } from '@/lib/admin-api';
import { formatTokens } from '@/store/app-store';

const FILTERS: { key: AdminReturn['status']; label: string }[] = [
  { key: 'requested', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'rejected', label: 'Reddedilen' },
];

export default function YonetimIadeler() {
  const [status, setStatus] = useState<AdminReturn['status']>('requested');
  const [data, setData] = useState<{ key: string; list: AdminReturn[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [okText, setOkText] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (s: AdminReturn['status']) => {
    const r = await fetchReturns(s);
    if (r.ok) setData({ key: s, list: r.data });
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchReturns(status).then((r) => {
        if (!alive) return;
        if (r.ok) setData({ key: status, list: r.data });
        else setError(r.error);
      });
      return () => {
        alive = false;
      };
    }, [status]),
  );

  const decide = async (r: AdminReturn, approve: boolean) => {
    setBusy(r.id);
    setError(null);
    const res = await resolveReturn(r.id, approve, notes[r.id] ?? '');
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setOkText(approve ? `#${r.shortId}: ${formatTokens(r.total)} token iade edildi.` : `#${r.shortId}: talep reddedildi.`);
    await load(status);
  };

  const list = data?.key === status ? data.list : null;

  return (
    <AdminScreen title="İade Talepleri">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <View style={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
          ))}
        </View>
        <Notice text={error} />
        <Notice text={!error ? okText : null} ok />

        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
        ) : !list.length ? (
          <EmptyState icon={<RotateCcw size={40} color={Colors.textMuted} />} title="Talep yok" />
        ) : (
          <View style={{ gap: 10, marginTop: Spacing.md }}>
            {list.map((r) => (
              <GlassCard key={r.id} style={{ padding: 12, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <VText style={styles.code}>#{r.shortId}</VText>
                  <VText variant="caption" style={{ flex: 1 }}>
                    {r.date}
                  </VText>
                  <VText variant="label" color={Colors.gold}>
                    {formatTokens(r.total)} token
                  </VText>
                </View>
                <VText variant="caption">
                  {r.userName} (@{r.username}) · {r.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}
                </VText>
                <VText>Neden: {r.reason}</VText>
                {r.adminNote ? <VText variant="caption">Not: {r.adminNote}</VText> : null}
                {r.status === 'requested' ? (
                  <>
                    <Field
                      label="Müşteriye not (isteğe bağlı)"
                      value={notes[r.id] ?? ''}
                      onChange={(v) => setNotes((n) => ({ ...n, [r.id]: v }))}
                      max={300}
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <SmallButton label="Onayla ve iade et" filled busy={busy === r.id} onPress={() => decide(r, true)} />
                      <SmallButton label="Reddet" color={Colors.live} busy={busy === r.id} onPress={() => decide(r, false)} />
                    </View>
                  </>
                ) : null}
              </GlassCard>
            ))}
          </View>
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
  code: { fontFamily: Fonts.bold, fontSize: 15, color: Colors.text },
});
