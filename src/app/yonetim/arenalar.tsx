/** Yönetici: arenaların adı, açıklaması, görseli ve 1./2./3. ödül miktarları. */
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { fetchArenasDb, saveArena, type DbArena } from '@/lib/admin-api';

export default function YonetimArenalar() {
  const [list, setList] = useState<DbArena[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchArenasDb().then((r) => {
        if (!alive) return;
        if (r.ok) setList(r.data);
        else setError(r.error);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <AdminScreen title="Arenalar">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <VText variant="caption">
          Ödül değişiklikleri o ayın sonunda dağıtılacak ödüllere uygulanır. Sezon takvimi (her ayın 1’i – son günü gece 12)
          otomatiktir.
        </VText>
        <Notice text={error} />
        {list === null ? <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} /> : list.map((a) => <ArenaCard key={a.key} a={a} />)}
      </View>
    </AdminScreen>
  );
}

function ArenaCard({ a }: { a: DbArena }) {
  const [f, setF] = useState({ ...a, p1: String(a.prizes[0]), p2: String(a.prizes[1]), p3: String(a.prizes[2]) });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const num = (v: string) => v.replace(/\D/g, '');
  const save = async () => {
    setBusy(true);
    const r = await saveArena({
      key: a.key,
      name: f.name,
      tagline: f.tagline,
      description: f.description,
      image: f.image,
      prizes: [Number(f.p1), Number(f.p2), Number(f.p3)],
    });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Kaydedildi.' } : { ok: false, text: r.error });
  };
  return (
    <GlassCard style={{ padding: 14 }}>
      <VText variant="heading">{a.name} Arenası</VText>
      <Field label="Ad" value={f.name} onChange={(v) => setF((x) => ({ ...x, name: v }))} max={40} />
      <Field label="Kısa slogan" value={f.tagline} onChange={(v) => setF((x) => ({ ...x, tagline: v }))} max={80} />
      <Field label="Açıklama" value={f.description} onChange={(v) => setF((x) => ({ ...x, description: v }))} multiline max={300} />
      <Field label="Görsel bağlantısı (https://)" value={f.image} onChange={(v) => setF((x) => ({ ...x, image: v }))} keyboard="url" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['p1', 'p2', 'p3'] as const).map((k, i) => (
          <View key={k} style={{ flex: 1 }}>
            <Field label={`${i + 1}. ödül`} value={f[k]} onChange={(v) => setF((x) => ({ ...x, [k]: num(v) }))} keyboard="number-pad" />
          </View>
        ))}
      </View>
      <View style={{ alignItems: 'flex-end', marginTop: 10 }}>
        <SmallButton label="Kaydet" filled onPress={save} busy={busy} />
      </View>
      <Notice text={msg?.text ?? null} ok={msg?.ok} />
    </GlassCard>
  );
}
