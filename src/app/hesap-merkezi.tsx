/**
 * Hesap Merkezi (Instagram'daki gibi): kişisel bilgiler, şifre ve güvenlik, yaş, veriler ve hesap silme tek yerde.
 */
import { router, type Href } from 'expo-router';
import {
  CalendarDays,
  Download,
  KeyRound,
  Mail,
  MonitorSmartphone,
  ScanFace,
  ShieldCheck,
  Trash2,
  UserPen,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Row, Section } from '@/components/settings-ui';
import { Avatar } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { signOutEverywhere } from '@/lib/settings-api';
import { useAuth } from '@/store/auth';

const go = (p: string) => router.push(p as Href);

export default function HesapMerkezi() {
  const auth = useAuth();
  const [note, setNote] = useState('');
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  // Face ID / parmak izi açılırken şifre sorulur
  const [bioPw, setBioPw] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const bioLabel = auth.biometric.label;
  const p = auth.profile;

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
  const everywhere = async () => {
    setConfirmEverywhere(false);
    const res = await signOutEverywhere();
    if (!res.ok) setNote(res.error);
  };

  return (
    <SubScreen title="Hesap Merkezi">
      <View style={styles.pad}>
        <VText variant="body" color={Colors.textSecondary}>
          Hesap ayarlarını, şifreni ve güvenliğini buradan yönet.
        </VText>

        {p ? (
          <Pressable style={styles.me} onPress={() => go('/profil-duzenle')}>
            <Avatar uri={p.avatar_url ?? ''} size={52} />
            <View style={{ flex: 1 }}>
              <VText variant="bodyBold">{p.name}</VText>
              <VText variant="caption">@{p.username}</VText>
              <VText variant="caption">{auth.session?.user.email}</VText>
            </View>
          </Pressable>
        ) : null}

        <Section title="Hesap ayarları">
          <Row
            icon={<UserPen size={20} color={Colors.cyan} />}
            label="Kişisel bilgiler"
            desc="Ad, kullanıcı adı, biyografi, profil fotoğrafı"
            onPress={() => go('/profil-duzenle')}
          />
          <Row icon={<Mail size={20} color={Colors.cyan} />} label="E-posta adresi" desc={auth.session?.user.email} onPress={() => go('/eposta-degistir')} />
          <Row
            icon={<CalendarDays size={20} color={Colors.cyanSoft} />}
            label="Yaş doğrulama"
            desc="Yaş grubun ve 15–18 yaş korumaları"
            onPress={() => go('/yas-dogrulama')}
            last
          />
        </Section>

        <Section title="Şifre ve güvenlik">
          <Row icon={<KeyRound size={20} color={Colors.cyan} />} label="Şifreyi değiştir" onPress={() => go('/yeni-sifre')} />
          <Row
            icon={<ShieldCheck size={20} color={Colors.success} />}
            label="İki adımlı doğrulama"
            desc="Girişte doğrulama uygulamasından kod iste"
            onPress={() => go('/iki-adimli')}
          />
          {auth.biometric.available ? (
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
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
          {confirmEverywhere ? (
            <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch', borderBottomWidth: 0 }]}>
              <VText variant="label">Bu hesap açık olan tüm telefon ve tarayıcılardan çıkış yapılsın mı? Bu cihazdan da çıkılır.</VText>
              <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
                <Pressable onPress={everywhere}>
                  <VText variant="label" color={Colors.live}>
                    Evet, hepsinden çık
                  </VText>
                </Pressable>
                <Pressable onPress={() => setConfirmEverywhere(false)}>
                  <VText variant="label" color={Colors.textSecondary}>
                    Vazgeç
                  </VText>
                </Pressable>
              </View>
            </View>
          ) : (
            <Row
              icon={<MonitorSmartphone size={20} color={Colors.cyanSoft} />}
              label="Giriş yapılan yerler"
              desc="Tüm cihazlardan çıkış yap"
              onPress={() => setConfirmEverywhere(true)}
              last
            />
          )}
        </Section>

        <Section title="Bilgilerin ve izinlerin">
          <Row
            icon={<Download size={20} color={Colors.cyanSoft} />}
            label="Bilgilerini indir"
            desc="Hesabındaki tüm bilgilerin bir kopyası (KVKK)"
            onPress={() => go('/verilerim')}
          />
          <Row
            icon={<Trash2 size={20} color={Colors.live} />}
            label="Hesabı sil"
            desc="Hesabın ve tüm içeriğin kalıcı olarak silinir"
            onPress={() => go('/hesap-sil')}
            last
          />
        </Section>

        {note ? (
          <VText variant="caption" color={Colors.cyan} style={{ textAlign: 'center', marginTop: 10 }}>
            {note}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.md,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
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
});
