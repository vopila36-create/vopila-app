/** Yönetici: destek talepleri — yanıtla (kullanıcıya bildirim gider), kapat. */
import { useFocusEffect } from 'expo-router';
import { LifeBuoy } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { answerTicket, fetchTickets, type AdminTicket } from '@/lib/admin-api';
import { TICKET_TOPICS } from '@/lib/settings-api';

type F = 'open' | 'answered' | 'closed';

export default function YonetimDestek() {
  const [filter, setFilter] = useState<F>('open');
  const [list, setList] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f: F) => {
    const r = await fetchTickets(f);
    if (r.ok) setList(r.data);
    else setError(r.error);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(filter);
    }, [load, filter]),
  );

  return (
    <AdminScreen title="Destek Talepleri">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Açık" active={filter === 'open'} onPress={() => setFilter('open')} />
          <Chip label="Yanıtlandı" active={filter === 'answered'} onPress={() => setFilter('answered')} />
          <Chip label="Kapandı" active={filter === 'closed'} onPress={() => setFilter('closed')} />
        </View>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((t) => <TicketCard key={t.id} t={t} onDone={() => load(filter)} />)
        ) : (
          <EmptyState icon={<LifeBuoy size={40} color={Colors.textMuted} />} title="Talep yok" />
        )}
      </View>
    </AdminScreen>
  );
}

function TicketCard({ t, onDone }: { t: AdminTicket; onDone: () => void }) {
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<'answer' | 'close' | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const send = async (close: boolean) => {
    if (reply.trim().length < 2) {
      setMsg('Yanıt yaz.');
      return;
    }
    setBusy(close ? 'close' : 'answer');
    const r = await answerTicket(t.id, reply, close);
    setBusy(null);
    if (!r.ok) setMsg(r.error);
    else onDone();
  };
  return (
    <GlassCard style={{ padding: 14, gap: 6 }}>
      <VText variant="bodyBold">
        {t.userName} (@{t.username})
      </VText>
      <VText variant="caption">
        {TICKET_TOPICS.find((x) => x.key === t.topic)?.label ?? t.topic} · {t.date}
      </VText>
      <VText color={Colors.text}>{t.message}</VText>
      {t.reply ? (
        <VText variant="caption" color={Colors.cyan}>
          Yanıtın: {t.reply}
        </VText>
      ) : null}
      {t.status !== 'closed' ? (
        <>
          <Field label="Yanıt" value={reply} onChange={setReply} multiline max={2000} />
          <View style={styles.actions}>
            <SmallButton label="Yanıtla" filled onPress={() => send(false)} busy={busy === 'answer'} />
            <SmallButton label="Yanıtla ve kapat" onPress={() => send(true)} busy={busy === 'close'} />
          </View>
        </>
      ) : null}
      <Notice text={msg} />
    </GlassCard>
  );
}

const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: 8, marginTop: 8 } });
