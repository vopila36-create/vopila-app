/** Yönetici: kullanıcı ara, hesap durumunu değiştir (aktif / askıda / yasaklı), yaş itirazını sonuçlandır. */
import { router, useFocusEffect, type Href } from 'expo-router';
import { Search, Users } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AdminScreen, Notice, SmallButton } from '@/components/admin-ui';
import { Avatar, Chip, GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { searchUsers, setUserStatus, type AdminUser } from '@/lib/admin-api';
import { adminAgeGroupOf, adminSetAgeGroup, AGE_LABEL, type AgeGroup } from '@/lib/age-api';

const STATUS = {
  active: { label: 'Aktif', color: Colors.success },
  suspended: { label: 'Askıda', color: Colors.gold },
  banned: { label: 'Yasaklı', color: Colors.live },
} as const;

export default function YonetimKullanicilar() {
  const [q, setQ] = useState('');
  const [onlyRestricted, setOnlyRestricted] = useState(false);
  const [list, setList] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(() => {
      searchUsers(q, onlyRestricted).then((r) => {
        if (!alive) return;
        if (r.ok) setList(r.data);
        else setError(r.error);
      });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, onlyRestricted, version]);

  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  return (
    <AdminScreen title="Kullanıcılar">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
        <View style={styles.search}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Ad ya da kullanıcı adı"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Hepsi" active={!onlyRestricted} onPress={() => setOnlyRestricted(false)} />
          <Chip label="Askıda / yasaklı" active={onlyRestricted} onPress={() => setOnlyRestricted(true)} />
        </View>
        <VText variant="caption">
          Askıda: giriş yapar ama paylaşamaz, yorum ve mesaj atamaz. Yasaklı: içerikleri herkesten gizlenir.
        </VText>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          list.map((u) => <UserRow key={u.id} u={u} onDone={() => setVersion((v) => v + 1)} />)
        ) : (
          <EmptyState icon={<Users size={40} color={Colors.textMuted} />} title="Kullanıcı bulunamadı" />
        )}
      </View>
    </AdminScreen>
  );
}

function UserRow({ u, onDone }: { u: AdminUser; onDone: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showAge, setShowAge] = useState(false);
  const st = STATUS[u.status];
  const change = async (s: AdminUser['status']) => {
    setBusy(s);
    const r = await setUserStatus(u.id, s, 'Yönetici paneli');
    setBusy(null);
    if (!r.ok) setMsg(r.error);
    else onDone();
  };
  return (
    <GlassCard style={{ padding: 12, gap: 8 }}>
      <Pressable style={styles.row} onPress={() => router.push(`/kullanici/${u.id}` as Href)}>
        <Avatar uri={u.avatar} size={40} />
        <View style={{ flex: 1 }}>
          <VText variant="label" numberOfLines={1}>
            {u.name}
          </VText>
          <VText variant="caption">
            @{u.username} · {u.createdAt}
          </VText>
        </View>
        <View style={[styles.badge, { borderColor: st.color }]}>
          <VText style={{ fontFamily: Fonts.bold, fontSize: 11, color: st.color }}>{st.label}</VText>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {u.status !== 'active' ? <SmallButton label="Aktif yap" onPress={() => change('active')} busy={busy === 'active'} /> : null}
        {u.status !== 'suspended' ? (
          <SmallButton label="Askıya al" color={Colors.gold} onPress={() => change('suspended')} busy={busy === 'suspended'} />
        ) : null}
        {u.status !== 'banned' ? (
          <SmallButton label="Yasakla" color={Colors.live} onPress={() => change('banned')} busy={busy === 'banned'} />
        ) : null}
        <SmallButton label="Yaş" color={Colors.cyanSoft} onPress={() => setShowAge((v) => !v)} />
      </View>
      {showAge ? <AgeEditor userId={u.id} /> : null}
      <Notice text={msg} />
    </GlassCard>
  );
}

/** Yaş itirazı (Yönetmelik md. 10): insan incelemesiyle yaş grubunu değiştirir; denetim kaydına yazılır. */
function AgeEditor({ userId }: { userId: string }) {
  const [group, setGroup] = useState<AgeGroup | null>(null);
  const [busy, setBusy] = useState<AgeGroup | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminAgeGroupOf(userId).then((g) => {
      if (alive) setGroup(g ?? 'unknown');
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const set = async (g: AgeGroup) => {
    setBusy(g);
    const r = await adminSetAgeGroup(userId, g, 'Yaş itirazı incelemesi');
    setBusy(null);
    if (!r.ok) setMsg(r.error);
    else setGroup(g);
  };

  if (!group) return <ActivityIndicator color={Colors.cyan} />;
  return (
    <View style={{ gap: 8 }}>
      <VText variant="caption">Kayıtlı yaş grubu: {AGE_LABEL[group]}</VText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['under15', 'teen', 'adult'] as AgeGroup[]).map((g) => (
          <Chip key={g} label={busy === g ? '…' : AGE_LABEL[g]} active={group === g} onPress={() => set(g)} />
        ))}
      </View>
      <Notice text={msg} />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1 },
});
