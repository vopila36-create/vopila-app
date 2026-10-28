/**
 * Ebeveyn denetimi (Yaş Doğrulama Yönetmeliği md. 9):
 *  - 15–18 yaş: ebeveyn kodu oluşturur; bağlıysa ayarları görür, kaldırmak için ebeveyninden onay ister.
 *  - 18+: çocuğunun kodunu girip bağlar; günlük süre, gizli hesap ve yorum kilidini yönetir.
 */
import { useFocusEffect } from 'expo-router';
import { KeyRound, ShieldCheck, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { Section, ToggleRow } from '@/components/settings-ui';
import { Avatar, Chip, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  createParentCode,
  fetchParentLinks,
  keepLink,
  linkParent,
  requestUnlink,
  setParentControls,
  unlinkChild,
  type ParentLink,
} from '@/lib/parent-api';
import { useAge } from '@/store/age';

const LIMITS: (number | null)[] = [null, 30, 60, 90, 120, 180];

export default function EbeveynDenetimi() {
  const { age, refresh: refreshAge } = useAge();
  const [links, setLinks] = useState<ParentLink[] | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetchParentLinks().then((l) => {
      if (alive) setLinks(l ?? []);
    });
    return () => {
      alive = false;
    };
  }, [version]);
  useFocusEffect(reload);

  const done = () => {
    reload();
    refreshAge();
  };

  const group = age?.group;
  const myParent = links?.find((l) => l.role === 'child');
  const children = links?.filter((l) => l.role === 'parent') ?? [];

  return (
    <SubScreen title="Ebeveyn denetimi">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg }}>
        <VText variant="body" color={Colors.textSecondary}>
          18 yaşından küçük kullanıcıların hesabı bir ebeveyne bağlanabilir. Ebeveyn günlük kullanım süresini sınırlar,
          hesabın gizli kalmasını ve yalnızca takip edilenlerin yorum yapmasını sağlar. Genç, denetimi ebeveyninin onayı
          olmadan kaldıramaz.
        </VText>

        {links === null ? (
          <ActivityIndicator color={Colors.cyan} />
        ) : group === 'teen' ? (
          myParent ? (
            <ChildView link={myParent} onDone={done} />
          ) : (
            <CreateCode />
          )
        ) : group === 'adult' ? (
          <>
            <LinkChild onDone={done} />
            {children.map((c) => (
              <ChildControls key={c.otherId} link={c} onDone={done} />
            ))}
          </>
        ) : (
          <VText variant="caption">Ebeveyn denetimi yaş bilgin kaydedildikten sonra kullanılabilir.</VText>
        )}
      </View>
    </SubScreen>
  );
}

/** Genç: ebeveyne verilecek tek kullanımlık kod */
function CreateCode() {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const make = async () => {
    setBusy(true);
    setError(null);
    const r = await createParentCode();
    setBusy(false);
    if (r.ok) setCode(r.data);
    else setError(r.error);
  };
  return (
    <GlassCard style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <KeyRound size={22} color={Colors.cyan} />
        <VText variant="bodyBold" style={{ flex: 1 }}>
          Ebeveynini bağla
        </VText>
      </View>
      {code ? (
        <>
          <VText style={styles.code}>{code.replace(/(.{4})(?=.)/g, '$1 ')}</VText>
          <VText variant="caption">
            Kod 15 dakika geçerli ve tek kullanımlık. Ebeveynin kendi VOPILA hesabında Ayarlar &gt; Ebeveyn denetimi
            bölümüne bu kodu girsin.
          </VText>
        </>
      ) : (
        <VText variant="caption">Ebeveynin de VOPILA hesabı olmalı. Kod oluştur ve ona göster.</VText>
      )}
      <PrimaryButton label={busy ? 'Oluşturuluyor…' : code ? 'Yeni kod oluştur' : 'Kod oluştur'} onPress={make} />
      {error ? <VText color={Colors.live}>{error}</VText> : null}
    </GlassCard>
  );
}

/** Genç: bağlı ebeveyn ve ayarları (salt okunur) */
function ChildView({ link, onDone }: { link: ParentLink; onDone: () => void }) {
  const [msg, setMsg] = useState<string | null>(null);
  const ask = async () => {
    const r = await requestUnlink();
    if (!r.ok) setMsg(r.error);
    else onDone();
  };
  return (
    <>
      <GlassCard style={{ padding: 16, gap: 10 }}>
        <View style={styles.head}>
          <Avatar uri={link.otherAvatar} size={40} />
          <View style={{ flex: 1 }}>
            <VText variant="bodyBold">{link.otherName}</VText>
            <VText variant="caption">@{link.otherUsername} · ebeveynin</VText>
          </View>
          <ShieldCheck size={22} color={Colors.success} />
        </View>
        <Rule on={link.dailyLimitMin != null} text={link.dailyLimitMin ? `Günlük süre: ${link.dailyLimitMin} dakika` : 'Günlük süre sınırı yok'} />
        <Rule on={link.lockPrivate} text={link.lockPrivate ? 'Hesabın gizli kalır' : 'Hesabını herkese açabilirsin'} />
        <Rule
          on={link.lockComments}
          text={link.lockComments ? 'Yalnızca takip ettiklerin yorum yapabilir' : 'Yorum ayarını kendin seçersin'}
        />
      </GlassCard>
      {link.status === 'unlink_requested' ? (
        <VText variant="caption">Kaldırma isteğin ebeveyninin onayını bekliyor.</VText>
      ) : (
        <OutlineButton label="Denetimin kaldırılmasını iste" onPress={ask} />
      )}
      {msg ? <VText color={Colors.live}>{msg}</VText> : null}
    </>
  );
}

function Rule({ on, text }: { on: boolean; text: string }) {
  return (
    <View style={styles.head}>
      <View style={[styles.dot, { backgroundColor: on ? Colors.cyan : Colors.textMuted }]} />
      <VText variant="body" style={{ flex: 1 }}>
        {text}
      </VText>
    </View>
  );
}

/** Ebeveyn: çocuğunun kodunu girer */
function LinkChild({ onDone }: { onDone: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    if (busy || code.replace(/\s/g, '').length < 12) return;
    setBusy(true);
    const r = await linkParent(code);
    setBusy(false);
    if (!r.ok) setMsg({ ok: false, text: r.error });
    else {
      setCode('');
      setMsg({ ok: true, text: 'Hesap bağlandı. Aşağıdan denetim ayarlarını seçebilirsin.' });
      onDone();
    }
  };
  return (
    <GlassCard style={{ padding: 16, gap: 12 }}>
      <View style={styles.head}>
        <Users size={22} color={Colors.cyan} />
        <VText variant="bodyBold" style={{ flex: 1 }}>
          Çocuğumun hesabını bağla
        </VText>
      </View>
      <VText variant="caption">
        Çocuğun kendi hesabında Ayarlar &gt; Ebeveyn denetimi bölümünden kod oluştursun, o kodu buraya yaz.
      </VText>
      <TextInput
        value={code}
        onChangeText={(t) => {
          const c = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
          setCode(c.replace(/(.{4})(?=.)/g, '$1 '));
        }}
        onSubmitEditing={submit}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD EFGH 2345"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
      <PrimaryButton label={busy ? 'Bağlanıyor…' : 'Bağla'} onPress={submit} />
      {msg ? <VText color={msg.ok ? Colors.success : Colors.live}>{msg.text}</VText> : null}
    </GlassCard>
  );
}

/** Ebeveyn: bağlı çocuğun denetim ayarları */
function ChildControls({ link, onDone }: { link: ParentLink; onDone: () => void }) {
  const [limit, setLimit] = useState<number | null>(link.dailyLimitMin);
  const [lockPrivate, setLockPrivate] = useState(link.lockPrivate);
  const [lockComments, setLockComments] = useState(link.lockComments);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    const r = await setParentControls(link.otherId, limit, lockPrivate, lockComments);
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: 'Kaydedildi.' } : { ok: false, text: r.error });
    if (r.ok) onDone();
  };
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    const r = await fn();
    if (!r.ok) setMsg({ ok: false, text: r.error ?? '' });
    else onDone();
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.head}>
        <Avatar uri={link.otherAvatar} size={40} />
        <View style={{ flex: 1 }}>
          <VText variant="bodyBold">{link.otherName}</VText>
          <VText variant="caption">@{link.otherUsername}</VText>
        </View>
      </View>

      {link.status === 'unlink_requested' ? (
        <GlassCard highlighted style={{ padding: 14, gap: 10 }}>
          <VText variant="bodyBold">Denetimin kaldırılmasını istiyor</VText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <OutlineButton label="Reddet" onPress={() => run(() => keepLink(link.otherId))} style={{ flex: 1 }} />
            <OutlineButton label="Kaldır" onPress={() => run(() => unlinkChild(link.otherId))} style={{ flex: 1 }} />
          </View>
        </GlassCard>
      ) : null}

      <Section title="Günlük süre sınırı" note="Süre dolunca uygulama o gün için kilitlenir.">
        <View style={styles.chips}>
          {LIMITS.map((l) => (
            <Chip key={String(l)} label={l ? `${l} dk` : 'Sınır yok'} active={limit === l} onPress={() => setLimit(l)} />
          ))}
        </View>
      </Section>
      <Section title="Gizlilik">
        <ToggleRow label="Hesap gizli kalsın" desc="Çocuğun hesabını herkese açamaz." value={lockPrivate} onChange={setLockPrivate} />
        <ToggleRow
          label="Yalnızca takip ettikleri yorum yapsın"
          value={lockComments}
          onChange={setLockComments}
          last
        />
      </Section>
      <PrimaryButton label={busy ? 'Kaydediliyor…' : 'Kaydet'} onPress={save} />
      <OutlineButton label="Denetimi kaldır" onPress={() => run(() => unlinkChild(link.otherId))} />
      {msg ? <VText color={msg.ok ? Colors.success : Colors.live}>{msg.text}</VText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  code: { fontFamily: Fonts.bold, fontSize: 26, letterSpacing: 4, textAlign: 'center', color: Colors.cyan },
  input: {
    height: 54,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 20,
    letterSpacing: 2,
    textAlign: 'center',
  },
});
