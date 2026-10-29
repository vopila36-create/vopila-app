/**
 * Yönetici: kapalı beta davetleri. Kod üret (her kod varsayılan 1 kişilik), bağlantıyı kopyala/paylaş,
 * kimin kullandığını gör, gerekirse iptal et. "Kapalı beta" kapatılınca herkes kodsuz kaydolabilir.
 */
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Section, ToggleRow } from '@/components/settings-ui';
import { Chip, GlassCard, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import {
  adminInviteRequired,
  createInvites,
  fetchInvites,
  inviteLink,
  revokeInvite,
  type InviteRow,
} from '@/lib/invite-api';

const COUNTS = [1, 5, 10, 30];

const STATUS: Record<InviteRow['status'], { label: string; color: string }> = {
  ok: { label: 'Kullanılabilir', color: Colors.success },
  used: { label: 'Kullanıldı', color: Colors.textMuted },
  expired: { label: 'Süresi doldu', color: Colors.textMuted },
  revoked: { label: 'İptal edildi', color: Colors.live },
  invalid: { label: 'Geçersiz', color: Colors.live },
};

const inviteMessage = (code: string) =>
  `VOPILA kapalı betasına davetlisin! Kayıt için: ${inviteLink(code)}\nDavet kodun: ${code} (tek kişilik)`;

export default function YonetimDavetler() {
  const [list, setList] = useState<InviteRow[] | null>(null);
  const [required, setRequired] = useState<boolean | null>(null);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okText, setOkText] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([fetchInvites(), adminInviteRequired()]);
    return { l, r };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load().then(({ l, r }) => {
        if (!alive) return;
        if (l.ok) setList(l.data);
        else setError(l.error);
        if (r.ok) setRequired(r.data);
      });
      return () => {
        alive = false;
      };
    }, [load]),
  );

  const refresh = async () => {
    const { l } = await load();
    if (l.ok) setList(l.data);
  };

  const notify = (text: string) => {
    setError(null);
    setOkText(text);
  };

  const toggle = async (v: boolean) => {
    const r = await adminInviteRequired(v);
    if (!r.ok) return setError(r.error);
    setRequired(r.data);
    notify(r.data ? 'Kapalı beta açık: kayıt yalnızca davet koduyla.' : 'Kapalı beta kapalı: herkes kodsuz kaydolabilir.');
  };

  const create = async () => {
    if (busy) return;
    setBusy(true);
    const r = await createInvites(count, 1, note);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setNote('');
    notify(`${r.data.length} davet kodu oluşturuldu.`);
    await refresh();
  };

  const copyOne = async (code: string) => {
    await Clipboard.setStringAsync(inviteMessage(code));
    notify(`${code} daveti kopyalandı. WhatsApp'a yapıştırıp gönderebilirsin.`);
  };

  const shareOne = async (code: string) => {
    try {
      await Share.share({ message: inviteMessage(code) });
    } catch {}
  };

  const copyAllUnused = async () => {
    const unused = (list ?? []).filter((i) => i.status === 'ok');
    if (!unused.length) return setError('Kullanılabilir davet yok. Önce davet oluştur.');
    await Clipboard.setStringAsync(unused.map((i) => `${i.code}  ${inviteLink(i.code)}`).join('\n'));
    notify(`${unused.length} kullanılabilir davet bağlantısı kopyalandı.`);
  };

  const revoke = async (code: string) => {
    const r = await revokeInvite(code);
    if (!r.ok) return setError(r.error);
    notify(`${code} iptal edildi.`);
    await refresh();
  };

  const usable = (list ?? []).filter((i) => i.status === 'ok').length;
  const used = (list ?? []).reduce((n, i) => n + i.usedCount, 0);

  return (
    <AdminScreen title="Beta Davetleri">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Kayıt" note="Açıkken yeni hesap yalnızca davet koduyla açılır. Mevcut hesaplar etkilenmez.">
          <ToggleRow
            label="Kapalı beta (davetle kayıt)"
            desc={required === null ? 'Yükleniyor…' : required ? 'Açık' : 'Kapalı — herkes kaydolabilir'}
            value={!!required}
            onChange={toggle}
            last
          />
        </Section>

        <Section title="Yeni davet" note="Her kod tek kişiliktir; kullanılınca bir daha kullanılamaz.">
          <View style={{ padding: 12 }}>
            <VText variant="label">Kaç kod?</VText>
            <View style={styles.chips}>
              {COUNTS.map((c) => (
                <Chip key={c} label={String(c)} active={count === c} onPress={() => setCount(c)} />
              ))}
            </View>
            <Field label="Not (isteğe bağlı)" value={note} onChange={setNote} placeholder="ör. Üniversite arkadaşları" max={60} />
            <PrimaryButton
              label={busy ? 'Oluşturuluyor…' : `${count} davet oluştur`}
              onPress={create}
              style={{ marginTop: Spacing.md }}
            />
          </View>
        </Section>

        <Notice text={error} />
        <Notice text={!error ? okText : null} ok />

        <View style={styles.summary}>
          <VText variant="label" style={{ flex: 1 }}>
            {usable} kullanılabilir · {used} kişi katıldı
          </VText>
          <SmallButton label="Kullanılmayanları kopyala" onPress={copyAllUnused} />
        </View>

        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
        ) : !list.length ? (
          <EmptyState icon={<Ticket size={40} color={Colors.textMuted} />} title="Henüz davet yok" text="Yukarıdan davet oluştur." />
        ) : (
          <GlassCard>
            {list.map((i, idx) => (
              <View key={i.code} style={[styles.row, idx === list.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <VText style={styles.code} selectable>
                    {i.code}
                  </VText>
                  <VText variant="caption" color={STATUS[i.status].color} style={{ fontFamily: Fonts.bold }}>
                    {STATUS[i.status].label}
                  </VText>
                </View>
                <VText variant="caption">
                  {i.createdAt}
                  {i.note ? ` · ${i.note}` : ''}
                  {i.usedBy.length ? ` · @${i.usedBy.join(', @')}` : ''}
                </VText>
                {i.status === 'ok' ? (
                  <View style={styles.actions}>
                    <SmallButton label="Kopyala" onPress={() => copyOne(i.code)} filled />
                    <SmallButton label="Paylaş" onPress={() => shareOne(i.code)} />
                    <SmallButton label="İptal et" color={Colors.live} onPress={() => revoke(i.code)} />
                  </View>
                ) : null}
              </View>
            ))}
          </GlassCard>
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, marginTop: 8 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 4 },
  code: { fontFamily: Fonts.extrabold, fontSize: 17, letterSpacing: 2, color: Colors.text },
  actions: { flexDirection: 'row', gap: 8, marginTop: 6 },
});
