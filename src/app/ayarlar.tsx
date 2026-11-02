/**
 * Ayarlar (Instagram düzenine göre): Hesap · Etkinliğin · Bildirimler · Gizlilik · Etkileşimler ·
 * Güvenlik · Tercihler · Destek · Yasal · Hesap işlemleri.
 */
import { reloadAppAsync } from 'expo';
import { router, type Href } from 'expo-router';
import {
  Archive,
  Award,
  Ban,
  Bell,
  BellOff,
  Bookmark,
  BookOpen,
  CalendarDays,
  Coins,
  Download,
  FileEdit,
  FileText,
  History,
  Heart,
  Info,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MonitorSmartphone,
  Package,
  PlayCircle,
  QrCode,
  ScanFace,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldMinus,
  Sparkles,
  Star,
  Timer,
  Trash2,
  UserPen,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ChoiceList, Row, Section, ToggleRow } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, saveThemePref, Spacing, themePref, type ThemePref } from '@/constants/theme';
import { fetchAdminStatus, type AdminStatus } from '@/lib/admin-api';
import { profileLink } from '@/lib/profile-link';
import { signOutEverywhere } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';
import Constants from 'expo-constants';
import { useAuth } from '@/store/auth';

const go = (p: string) => router.push(p as Href);

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function Ayarlar() {
  const { state, updateSettings, myId } = useStore();
  const [themeNote, setThemeNote] = useState('');
  // Tema açılışta okunur: seçim kaydedilir ve uygulama yeniden başlatılır
  const changeTheme = (pref: ThemePref) => {
    if (pref === themePref) return;
    saveThemePref(pref);
    if (Platform.OS === 'web') {
      globalThis.location?.reload();
      return;
    }
    reloadAppAsync('Tema değişti').catch(() =>
      setThemeNote('Yeni tema, uygulamayı kapatıp açtığında görünecek.'),
    );
  };
  const [confirmEverywhere, setConfirmEverywhere] = useState(false);
  const [note, setNote] = useState('');
  const auth = useAuth();
  // Davet: profil bağlantımla birlikte paylaşım menüsü
  const invite = () => {
    const u = auth.profile?.username;
    // Kapalı betada kayıt davet koduyla açılır; davet kodunu yönetici verir
    Share.share({
      message: u
        ? `VOPILA'yı keşfet: https://beta.vopila.com (şu an kapalı beta, kayıt davet koduyla). Beni takip et: ${profileLink(u)}`
        : "VOPILA'yı keşfet: https://beta.vopila.com",
    }).catch(() => {});
  };
  // Face ID'yi açarken şifre sorulur
  const [bioPw, setBioPw] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const bioLabel = auth.biometric.label;
  const signedIn = !!auth.session;

  // Yönetici hesabıysa panel satırı gösterilir
  const [adminStatus, setAdminStatus] = useState<AdminStatus>('none');
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchAdminStatus().then((s) => {
      if (alive) setAdminStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [myId]);

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
  const privateAccount = auth.profile ? auth.profile.is_private : state.settings.privateAccount;
  const setPrivate = async (v: boolean) => {
    updateSettings({ privateAccount: v });
    if (auth.profile) {
      const res = await auth.saveProfile({ is_private: v });
      if (!res.ok) setNote(res.error);
      else setNote(v ? 'Hesabın artık gizli. Yeni takipçileri sen onaylarsın.' : 'Hesabın artık herkese açık. Bekleyen istekler onaylandı.');
    }
  };

  const everywhere = async () => {
    setConfirmEverywhere(false);
    const res = await signOutEverywhere();
    if (!res.ok) setNote(res.error);
  };

  return (
    <SubScreen title="Ayarlar ve Etkinlik">
      <View style={styles.pad}>
        {adminStatus !== 'none' ? (
          <Section title="Yönetim">
            <Row
              icon={<ShieldCheck size={20} color={Colors.gold} />}
              label="Yönetici Paneli"
              value={adminStatus === 'needs_2fa' ? '2FA gerekli' : undefined}
              onPress={() => go('/yonetim')}
              last
            />
          </Section>
        ) : null}
        <Section title="Hesap">
          <Row icon={<UserPen size={20} color={Colors.cyan} />} label="Profili düzenle" onPress={() => go('/profil-duzenle')} />
          <Row icon={<QrCode size={20} color={Colors.cyan} />} label="QR kod" onPress={() => go('/qr-kod')} />
          <Row icon={<UserPlus size={20} color={Colors.cyan} />} label="Arkadaşlarını davet et" onPress={invite} />
          <Row icon={<Coins size={20} color={Colors.gold} />} label="Token cüzdanım" onPress={() => go('/cuzdan')} />
          <Row icon={<Package size={20} color={Colors.cyanSoft} />} label="Siparişlerim" onPress={() => go('/siparisler')} />
          <Row icon={<MapPin size={20} color={Colors.cyanSoft} />} label="Adreslerim" onPress={() => go('/adreslerim')} />
          <Row icon={<Award size={20} color={Colors.gold} />} label="Rozetlerim" onPress={() => go('/rozetler')} last />
        </Section>

        <Section title="VOPILA'yı nasıl kullanıyorsun">
          <Row icon={<Bookmark size={20} color={Colors.cyan} />} label="Kaydedilenler" onPress={() => go('/kaydedilenler')} />
          <Row icon={<Archive size={20} color={Colors.cyanSoft} />} label="Arşiv" onPress={() => go('/arsiv')} />
          <Row icon={<FileEdit size={20} color={Colors.cyanSoft} />} label="Taslaklar" onPress={() => go('/taslaklar')} />
          <Row icon={<History size={20} color={Colors.cyanSoft} />} label="Hareketlerin" onPress={() => go('/hareketlerin')} />
          <Row icon={<Timer size={20} color={Colors.cyanSoft} />} label="Geçirdiğin süre" onPress={() => go('/hareketlerin?tab=sure')} />
          <Row icon={<Sparkles size={20} color={Colors.cyan} />} label="İlgi alanların" onPress={() => go('/ilgi-alanlarim')} />
          <Row icon={<Bell size={20} color={Colors.cyan} />} label="Bildirimler" onPress={() => go('/bildirim-ayarlari')} last />
        </Section>

        <Section title="İçeriğini kimler görebilir">
          <Row icon={<Star size={20} color="#22C55E" />} label="Yakın Arkadaşlar" onPress={() => go('/yakin-arkadaslar')} />
          <ToggleRow
            icon={<Lock size={20} color={Colors.cyanSoft} />}
            label="Gizli hesap"
            desc="Paylaşımlarını ve takipçi/takip listelerini yalnızca onayladığın takipçiler görür"
            value={privateAccount}
            onChange={setPrivate}
          />
          <Row icon={<UserPlus size={20} color={Colors.cyanSoft} />} label="Takip istekleri" onPress={() => go('/takip-istekleri')} />
          <Row icon={<Ban size={20} color={Colors.live} />} label="Engellenen hesaplar" onPress={() => go('/engellenenler')} last />
        </Section>

        <Section title="Başkaları seninle nasıl etkileşim kurabilir">
          <Row icon={<MessageCircle size={20} color={Colors.cyan} />} label="Mesajlar" onPress={() => go('/mesajlar')} />
          <Row
            icon={<Users size={20} color={Colors.cyanSoft} />}
            label="Bahsetmeler, mesaj izni ve gizli kelimeler"
            onPress={() => go('/etkilesim-ayarlari')}
          />
          <Row icon={<ShieldMinus size={20} color={Colors.cyanSoft} />} label="Kısıtlanan hesaplar" onPress={() => go('/kisitlananlar')} />
          <Row icon={<BellOff size={20} color={Colors.cyanSoft} />} label="Sessize alınan hesaplar" onPress={() => go('/sessize-alinanlar')} last />
        </Section>

        {signedIn ? (
          <Section title="Güvenlik">
            <Row icon={<KeyRound size={20} color={Colors.cyan} />} label="Şifreyi değiştir" onPress={() => go('/yeni-sifre')} />
            <Row icon={<Mail size={20} color={Colors.cyan} />} label="E-posta adresini değiştir" onPress={() => go('/eposta-degistir')} />
            <Row icon={<ShieldCheck size={20} color={Colors.success} />} label="İki adımlı doğrulama" onPress={() => go('/iki-adimli')} />
            <Row icon={<CalendarDays size={20} color={Colors.cyanSoft} />} label="Yaş doğrulama" onPress={() => go('/yas-dogrulama')} />
            <Row icon={<Users size={20} color={Colors.cyanSoft} />} label="Ebeveyn denetimi" onPress={() => go('/ebeveyn-denetimi')} />
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
              <Confirm
                text="Bu hesap açık olan tüm telefon ve tarayıcılardan çıkış yapılsın mı? Bu cihazdan da çıkılır."
                yes="Evet, hepsinden çık"
                onYes={everywhere}
                onNo={() => setConfirmEverywhere(false)}
                last
              />
            ) : (
              <Row
                icon={<MonitorSmartphone size={20} color={Colors.cyanSoft} />}
                label="Tüm cihazlardan çıkış yap"
                onPress={() => setConfirmEverywhere(true)}
                last
              />
            )}
          </Section>
        ) : null}

        <Section title="Tema" note="Tema değişince uygulama bir saniyeliğine yeniden açılır.">
          <ChoiceList<ThemePref>
            value={themePref}
            onChange={changeTheme}
            options={[
              { key: 'dark', label: 'Koyu', desc: 'Lacivert zemin, turkuaz vurgular' },
              { key: 'light', label: 'Açık', desc: 'Beyaz zemin' },
              { key: 'pink', label: 'Pembe', desc: 'Açık pembe zemin, pembe vurgular' },
              { key: 'system', label: 'Telefona göre', desc: 'Telefonun açık/koyu ayarını izler' },
            ]}
          />
        </Section>
        {themeNote ? (
          <VText variant="caption" color={Colors.gold} style={{ marginTop: -8, marginBottom: 8 }}>
            {themeNote}
          </VText>
        ) : null}

        <Section title="Uygulama tercihleri">
          <ToggleRow
            icon={<PlayCircle size={20} color={Colors.cyanSoft} />}
            label="Videoları otomatik oynat"
            desc="Akışta videolar sessiz başlar"
            value={state.settings.autoplayVideos}
            onChange={(v) => updateSettings({ autoplayVideos: v })}
          />
          <ToggleRow
            icon={<Heart size={20} color={Colors.heart} />}
            label="Beğeni sayılarını gizle"
            desc="Başkalarının gönderilerinde beğeni sayısı görünmez; kendi gönderilerinde görmeye devam edersin"
            value={!!state.settings.hideLikeCounts}
            onChange={(v) => updateSettings({ hideLikeCounts: v })}
            last
          />
        </Section>

        <Section title="Destek">
          <Row icon={<LifeBuoy size={20} color={Colors.cyan} />} label="Yardım ve sorun bildir" onPress={() => go('/destek')} />
          <Row icon={<ShieldAlert size={20} color={Colors.gold} />} label="Hesap durumu" onPress={() => go('/hesap-durumu')} />
          <Row icon={<BookOpen size={20} color={Colors.cyanSoft} />} label="Topluluk kuralları" onPress={() => go('/topluluk-kurallari')} last />
        </Section>

        <Section title="Yasal">
          <Row icon={<Shield size={20} color={Colors.cyanSoft} />} label="Aydınlatma Metni ve Gizlilik" onPress={() => go('/yasal/aydinlatma')} />
          <Row icon={<FileText size={20} color={Colors.cyanSoft} />} label="Kullanım Koşulları" onPress={() => go('/yasal/kosullar')} />
          <Row icon={<Users size={20} color={Colors.cyanSoft} />} label="Çocukları Koruma Önlemleri" onPress={() => go('/yasal/cocuk-koruma')} />
          <Row icon={<FileText size={20} color={Colors.cyanSoft} />} label="Telif ve İçerik Bildirimi" onPress={() => go('/yasal/telif')} />
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Info size={20} color={Colors.textSecondary} />
            <VText variant="label" style={{ flex: 1 }}>
              Uygulama sürümü
            </VText>
            <VText variant="caption">{APP_VERSION}</VText>
          </View>
        </Section>

        <Section title="Hesap işlemleri">
          {myId ? (
            <>
              <Row icon={<Download size={20} color={Colors.cyanSoft} />} label="Verilerimi indir" onPress={() => go('/verilerim')} />
              <Row icon={<Trash2 size={20} color={Colors.live} />} label="Hesabı sil" onPress={() => go('/hesap-sil')} />
            </>
          ) : null}
          <Row
            icon={<LogOut size={20} color={Colors.live} />}
            label="Çıkış Yap"
            danger
            onPress={() => {
              if (auth.session) auth.signOut();
              else router.replace('/giris' as Href);
            }}
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

function Confirm({ text, yes, onYes, onNo, last }: { text: string; yes: string; onYes: () => void; onNo: () => void; last?: boolean }) {
  return (
    <View style={[styles.row, { flexDirection: 'column', alignItems: 'stretch' }, last && { borderBottomWidth: 0 }]}>
      <VText variant="label">{text}</VText>
      <View style={{ flexDirection: 'row', gap: 20, marginTop: 10 }}>
        <Pressable onPress={onYes}>
          <VText variant="label" color={Colors.live}>
            {yes}
          </VText>
        </Pressable>
        <Pressable onPress={onNo}>
          <VText variant="label" color={Colors.textSecondary}>
            Vazgeç
          </VText>
        </Pressable>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
