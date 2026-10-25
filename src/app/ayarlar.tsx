import { router, type Href } from 'expo-router';
import {
  Award,
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  FileText,
  Info,
  KeyRound,
  Lock,
  LogOut,
  Package,
  ScanFace,
  PlayCircle,
  RotateCcw,
  Shield,
  Trophy,
  UserPen,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useStore, type Settings } from '@/store/app-store';
import { useAuth } from '@/store/auth';

const PRIVACY = [
  'VOPILA, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında kişisel verilerini yalnızca hizmeti sunmak için işler.',
  'Paylaştığın içerikler, profil bilgilerin ve arena oyların hesabınla ilişkilendirilir. Verilerin üçüncü kişilere satılmaz.',
  'Hesabını sildiğinde kişisel verilerin yasal saklama süreleri dışında kalıcı olarak silinir. Talepler için destek@vopila.app adresine yazabilirsin.',
];
const TERMS = [
  'VOPILA’yı kullanarak topluluk kurallarına uymayı kabul edersin: nefret söylemi, taciz ve telif ihlali içeren içerikler kaldırılır.',
  'Token’lar yalnızca arena yarışmalarında kazanılır, para ile satın alınamaz ve nakde çevrilemez. Mağazadaki ürünler stokla sınırlıdır.',
  'Hileli oy kullanımı tespit edilen hesapların token’ları ve ödülleri iptal edilebilir.',
];

const go = (p: string) => router.push(p as Href);

export default function Ayarlar() {
  const { state, updateSettings, resetDemo } = useStore();
  const [open, setOpen] = useState<'privacy' | 'terms' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [note, setNote] = useState('');
  const auth = useAuth();
  // Face ID'yi açarken şifre sorulur
  const [bioPw, setBioPw] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const bioLabel = auth.biometric.label;

  const toggleBiometric = async (on: boolean) => {
    setNote('');
    if (!on) {
      await auth.disableBiometric();
      setBioPw(null);
      setNote(`${bioLabel} ile giriş kapatıldı.`);
    } else setBioPw('');
  };
  const confirmBiometric = async () => {
    const email = auth.session?.user.email;
    if (!email || bioPw === null || bioBusy) return;
    setBioBusy(true);
    const res = await auth.enableBiometric(email, bioPw, true);
    setBioBusy(false);
    if (res.ok) {
      setBioPw(null);
      setNote(`${bioLabel} ile giriş açıldı. Bir dahaki girişte şifre yazmana gerek yok.`);
    } else if (res.error) setNote(res.error);
  };

  // Gizli hesap ayarı giriş yapılmışsa Supabase'deki profilde tutulur
  const settingValue = (key: keyof Settings) =>
    key === 'privateAccount' && auth.profile ? auth.profile.is_private : state.settings[key];
  const changeSetting = async (key: keyof Settings, v: boolean) => {
    updateSettings({ [key]: v });
    if (key === 'privateAccount' && auth.profile) {
      const res = await auth.saveProfile({ is_private: v });
      if (!res.ok) setNote(res.error);
    }
  };

  const toggles: { key: keyof Settings; label: string; desc: string; icon: ReactNode }[] = [
    { key: 'pushNotifications', label: 'Bildirimler', desc: 'Beğeni, yorum ve takip bildirimleri', icon: <Bell size={20} color={Colors.cyan} /> },
    { key: 'arenaReminders', label: 'Arena hatırlatmaları', desc: 'Sezon bitişi ve oylama hatırlatmaları', icon: <Trophy size={20} color={Colors.gold} /> },
    { key: 'privateAccount', label: 'Gizli hesap', desc: 'Paylaşımlarını ve takipçi/takip listelerini yalnızca takipçilerin görür', icon: <Lock size={20} color={Colors.cyanSoft} /> },
    { key: 'autoplayVideos', label: 'Videoları otomatik oynat', desc: 'Akışta videolar sessiz başlar', icon: <PlayCircle size={20} color={Colors.cyanSoft} /> },
  ];

  return (
    <SubScreen title="Ayarlar">
      <View style={styles.pad}>
        <Section title="Hesap">
          <Row icon={<UserPen size={20} color={Colors.cyan} />} label="Profili düzenle" onPress={() => go('/profil-duzenle')} />
          <Row icon={<Coins size={20} color={Colors.gold} />} label="Token cüzdanım" onPress={() => go('/cuzdan')} />
          <Row icon={<Package size={20} color={Colors.cyanSoft} />} label="Siparişlerim" onPress={() => go('/siparisler')} />
          <Row icon={<Award size={20} color={Colors.gold} />} label="Rozetlerim" onPress={() => go('/rozetler')} last />
        </Section>

        {auth.session ? (
          <Section title="Güvenlik">
            <Row
              icon={<KeyRound size={20} color={Colors.cyan} />}
              label="Şifreyi değiştir"
              onPress={() => go('/yeni-sifre')}
              last={!auth.biometric.available}
            />
            {auth.biometric.available ? (
              <View style={[styles.row, { borderBottomWidth: 0, flexWrap: 'wrap' }]}>
                <ScanFace size={20} color={Colors.cyanSoft} />
                <View style={{ flex: 1 }}>
                  <VText variant="label">{bioLabel} ile giriş</VText>
                  <VText variant="caption">Şifre yazmadan hızlı ve güvenli giriş</VText>
                </View>
                <Switch
                  value={auth.biometric.enabled || bioPw !== null}
                  onValueChange={toggleBiometric}
                  trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
                  thumbColor="#fff"
                />
                {bioPw !== null && !auth.biometric.enabled ? (
                  <View style={styles.bioBox}>
                    <VText variant="caption">Açmak için şifreni yaz:</VText>
                    <View style={styles.bioRow}>
                      <TextInput
                        value={bioPw}
                        onChangeText={setBioPw}
                        onSubmitEditing={confirmBiometric}
                        secureTextEntry
                        autoCapitalize="none"
                        autoComplete="current-password"
                        placeholder="Şifren"
                        placeholderTextColor={Colors.textMuted}
                        style={styles.bioInput}
                      />
                      <Pressable onPress={confirmBiometric} hitSlop={8}>
                        <VText variant="label" color={Colors.cyan}>
                          {bioBusy ? 'Bekle…' : 'Onayla'}
                        </VText>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </Section>
        ) : null}

        <Section title="Tercihler">
          {toggles.map((t, i) => (
            <View key={t.key} style={[styles.row, i === toggles.length - 1 && { borderBottomWidth: 0 }]}>
              {t.icon}
              <View style={{ flex: 1 }}>
                <VText variant="label">{t.label}</VText>
                <VText variant="caption">{t.desc}</VText>
              </View>
              <Switch
                value={settingValue(t.key)}
                onValueChange={(v) => changeSetting(t.key, v)}
                trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </Section>

        <Section title="Yasal">
          <Expand
            icon={<Shield size={20} color={Colors.cyanSoft} />}
            label="Gizlilik Politikası (KVKK)"
            open={open === 'privacy'}
            onPress={() => setOpen(open === 'privacy' ? null : 'privacy')}
            paragraphs={PRIVACY}
          />
          <Expand
            icon={<FileText size={20} color={Colors.cyanSoft} />}
            label="Kullanım Koşulları"
            open={open === 'terms'}
            onPress={() => setOpen(open === 'terms' ? null : 'terms')}
            paragraphs={TERMS}
            last
          />
        </Section>

        <Section title="Diğer">
          <View style={styles.row}>
            <Info size={20} color={Colors.textSecondary} />
            <VText variant="label" style={{ flex: 1 }}>
              Uygulama sürümü
            </VText>
            <VText variant="caption">1.0.0</VText>
          </View>
          {confirmReset ? (
            <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }]}>
              <VText variant="label">Tüm demo verileri (beğeniler, siparişler, oylar) silinsin mi?</VText>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    resetDemo();
                    setConfirmReset(false);
                    setNote('Demo verileri sıfırlandı.');
                  }}>
                  <VText variant="label" color={Colors.live}>
                    Evet, sıfırla
                  </VText>
                </Pressable>
                <Pressable onPress={() => setConfirmReset(false)}>
                  <VText variant="label" color={Colors.textSecondary}>
                    Vazgeç
                  </VText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Row icon={<RotateCcw size={20} color={Colors.textSecondary} />} label="Demo verilerini sıfırla" onPress={() => setConfirmReset(true)} />
          )}
          <Row
            icon={<LogOut size={20} color={Colors.live} />}
            label="Çıkış Yap"
            danger
            onPress={() =>
              auth.session
                ? auth.signOut()
                : setNote('Demo modundasın; Supabase bağlanınca buradan çıkış yapabileceksin.')
            }
            last
          />
        </Section>

        {note ? (
          <VText variant="caption" color={Colors.cyan} style={{ textAlign: 'center', marginTop: 4 }}>
            {note}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: Spacing.lg }}>
      <VText variant="caption" style={styles.sectionTitle}>
        {title.toLocaleUpperCase('tr-TR')}
      </VText>
      <GlassCard>{children}</GlassCard>
    </View>
  );
}

function Row({ icon, label, onPress, last, danger }: { icon: ReactNode; label: string; onPress: () => void; last?: boolean; danger?: boolean }) {
  return (
    <Pressable style={[styles.row, last && { borderBottomWidth: 0 }]} onPress={onPress}>
      {icon}
      <VText variant="label" color={danger ? Colors.live : Colors.text} style={{ flex: 1 }}>
        {label}
      </VText>
      {!danger ? <ChevronRight size={18} color={Colors.textMuted} /> : null}
    </Pressable>
  );
}

function Expand({
  icon,
  label,
  open,
  onPress,
  paragraphs,
  last,
}: {
  icon: ReactNode;
  label: string;
  open: boolean;
  onPress: () => void;
  paragraphs: string[];
  last?: boolean;
}) {
  return (
    <View style={[styles.expand, last && { borderBottomWidth: 0 }]}>
      <Pressable style={styles.expandHead} onPress={onPress}>
        {icon}
        <VText variant="label" style={{ flex: 1 }}>
          {label}
        </VText>
        {open ? <ChevronUp size={18} color={Colors.cyan} /> : <ChevronDown size={18} color={Colors.textMuted} />}
      </Pressable>
      {open ? (
        <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
          {paragraphs.map((p) => (
            <VText key={p} variant="body" style={{ fontSize: 13 }}>
              {p}
            </VText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bioBox: { width: '100%', marginTop: 10 },
  bioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  bioInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 15,
  },
  pad: { paddingHorizontal: Spacing.screen },
  sectionTitle: { letterSpacing: 1, marginBottom: 6, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  expand: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  expandHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
});
