/**
 * Ayarlar ve hareketler (Instagram düzeni, VOPILA'ya uyarlanmış): en üstte arama, Hesap Merkezi,
 * kullanım, gizlilik, etkileşim, ne göreceğin, uygulama ve medya, aile, alışveriş, profil, destek, giriş.
 * Satırlar tek bir listeden üretilir; arama bu listeyi etiket, açıklama ve anahtar kelimelere göre süzer.
 */
import { router, type Href } from 'expo-router';
import {
  Archive,
  Award,
  Ban,
  Bell,
  BellOff,
  Bookmark,
  BookOpen,
  Coins,
  EyeOff,
  FileEdit,
  Heart,
  History,
  Info,
  LifeBuoy,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Palette,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  ShieldMinus,
  Sparkles,
  Star,
  Timer,
  UserCircle,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';

import { Row, Section, SettingsSearch, ToggleRow } from '@/components/settings-ui';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { Colors, Spacing } from '@/constants/theme';
import { fetchAdminStatus, type AdminStatus } from '@/lib/admin-api';
import { profileLink } from '@/lib/profile-link';
import { useStore } from '@/store/app-store';
import { useAuth } from '@/store/auth';

const go = (p: string) => router.push(p as Href);

type Item = {
  key: string;
  label: string;
  desc?: string;
  Icon: LucideIcon;
  color?: string;
  /** Aramada bulunması için ek kelimeler */
  keywords?: string;
  href?: string;
  onPress?: () => void;
  toggle?: { value: boolean; onChange: (v: boolean) => void };
  value?: string;
  danger?: boolean;
};
type Group = { title: string; items: Item[] };

const norm = (s: string) => s.toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[̀-ͯ]/g, '');

export default function Ayarlar() {
  const { state, updateSettings, myId } = useStore();
  const auth = useAuth();
  const [query, setQuery] = useState('');

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

  // Davet: kapalı betada kayıt davet koduyla açılır; davet kodunu yönetici verir
  const invite = () => {
    const u = auth.profile?.username;
    Share.share({
      message: u
        ? `VOPILA'yı keşfet: https://beta.vopila.com (şu an kapalı beta, kayıt davet koduyla). Beni takip et: ${profileLink(u)}`
        : "VOPILA'yı keşfet: https://beta.vopila.com",
    }).catch(() => {});
  };

  const isPrivate = auth.profile ? auth.profile.is_private : state.settings.privateAccount;

  // React Compiler ekranı zaten önbelleğe alır; liste her çizimde kurulur
  const groups: Group[] = (() => {
    const g: Group[] = [];
    if (adminStatus !== 'none')
      g.push({
        title: 'Yönetim',
        items: [
          {
            key: 'admin',
            label: 'Yönetici Paneli',
            Icon: ShieldCheck,
            color: Colors.gold,
            href: '/yonetim',
            value: adminStatus === 'needs_2fa' ? '2FA gerekli' : undefined,
          },
        ],
      });
    g.push(
      {
        title: 'Hesabın',
        items: [
          {
            key: 'center',
            label: 'Hesap Merkezi',
            desc: 'Şifre, güvenlik, kişisel bilgiler',
            Icon: UserCircle,
            color: Colors.cyan,
            keywords: 'şifre e-posta eposta iki adımlı 2fa face id parmak izi biyometrik yaş verilerim indir hesabı sil cihaz çıkış profil düzenle',
            href: '/hesap-merkezi',
          },
        ],
      },
      {
        title: "VOPILA'yı nasıl kullanıyorsun",
        items: [
          { key: 'saved', label: 'Kaydedilenler', Icon: Bookmark, href: '/kaydedilenler' },
          { key: 'archive', label: 'Arşiv', Icon: Archive, href: '/arsiv' },
          { key: 'drafts', label: 'Taslaklar', Icon: FileEdit, href: '/taslaklar' },
          { key: 'activity', label: 'Hareketlerin', desc: 'Beğenilerin ve yorumların', Icon: History, href: '/hareketlerin' },
          { key: 'notif', label: 'Bildirimler', Icon: Bell, href: '/bildirim-ayarlari' },
          { key: 'time', label: 'Geçirdiğin süre', desc: 'Günlük süre sınırı', Icon: Timer, href: '/hareketlerin?tab=sure' },
        ],
      },
      {
        title: 'İçeriğini kimler görebilir',
        items: [
          {
            key: 'privacy',
            label: 'Hesap gizliliği',
            Icon: Lock,
            value: isPrivate ? 'Gizli' : 'Herkese açık',
            keywords: 'gizli hesap',
            href: '/hesap-gizliligi',
          },
          { key: 'close', label: 'Yakın Arkadaşlar', Icon: Star, color: '#22C55E', href: '/yakin-arkadaslar' },
          { key: 'requests', label: 'Takip istekleri', Icon: UserPlus, href: '/takip-istekleri' },
          { key: 'blocked', label: 'Engellenenler', Icon: Ban, color: Colors.live, href: '/engellenenler' },
        ],
      },
      {
        title: 'Başkaları seninle nasıl etkileşim kurabilir',
        items: [
          { key: 'messages', label: 'Mesajlar', Icon: MessageCircle, href: '/mesajlar' },
          {
            key: 'interact',
            label: 'Bahsetmeler ve mesaj izni',
            desc: 'Kimler senden bahsedebilir, kimler mesaj atabilir',
            Icon: Users,
            keywords: 'etiket mention',
            href: '/etkilesim-ayarlari',
          },
          {
            key: 'hidden',
            label: 'Gizli kelimeler',
            desc: 'Rahatsız edici yorum ve mesajları gizle',
            Icon: EyeOff,
            keywords: 'filtre kelime',
            href: '/etkilesim-ayarlari',
          },
          { key: 'restricted', label: 'Kısıtlananlar', Icon: ShieldMinus, href: '/kisitlananlar' },
        ],
      },
      {
        title: 'Ne göreceğin',
        items: [
          { key: 'muted', label: 'Sessize alınan hesaplar', Icon: BellOff, href: '/sessize-alinanlar' },
          {
            key: 'interests',
            label: 'Önerilen içerik',
            desc: 'İlgi alanların ve akış tercihlerin',
            Icon: Sparkles,
            keywords: 'ilgi alanları keşfet',
            href: '/ilgi-alanlarim',
          },
          {
            key: 'likes',
            label: 'Beğeni sayılarını gizle',
            desc: 'Başkalarının gönderilerinde beğeni sayısı görünmez',
            Icon: Heart,
            color: Colors.heart,
            toggle: { value: !!state.settings.hideLikeCounts, onChange: (v) => updateSettings({ hideLikeCounts: v }) },
          },
        ],
      },
      {
        title: 'Uygulaman ve medya',
        items: [
          {
            key: 'appmedia',
            label: 'Uygulaman ve medya',
            desc: 'Tema, videoları otomatik oynatma',
            Icon: Palette,
            keywords: 'tema koyu açık pembe video otomatik oynat',
            href: '/uygulama-ve-medya',
          },
        ],
      },
      {
        title: 'Aile merkezi',
        items: [
          {
            key: 'parent',
            label: 'Ebeveyn denetimi',
            desc: '15–18 yaş hesaplar için aile gözetimi',
            Icon: Users,
            keywords: 'aile çocuk',
            href: '/ebeveyn-denetimi',
          },
        ],
      },
      {
        title: 'Alışveriş',
        items: [
          { key: 'orders', label: 'Siparişlerim', Icon: Package, href: '/siparisler', keywords: 'kargo iade iptal' },
          { key: 'favorites', label: 'Favorilerim', Icon: Heart, color: Colors.heart, href: '/favorilerim', keywords: 'beğendiğim ürün' },
          { key: 'addresses', label: 'Adreslerim', Icon: MapPin, href: '/adreslerim' },
          { key: 'wallet', label: 'Token cüzdanım', Icon: Coins, color: Colors.gold, href: '/cuzdan', keywords: 'bakiye' },
        ],
      },
      {
        title: 'Profilin',
        items: [
          { key: 'qr', label: 'QR kod', Icon: QrCode, href: '/qr-kod' },
          { key: 'badges', label: 'Rozetlerim', Icon: Award, color: Colors.gold, href: '/rozetler' },
          { key: 'invite', label: 'Arkadaşlarını davet et', Icon: UserPlus, onPress: invite },
        ],
      },
      {
        title: 'Daha fazla bilgi ve destek',
        items: [
          { key: 'help', label: 'Yardım', desc: 'Sık sorulanlar ve sorun bildir', Icon: LifeBuoy, href: '/destek', keywords: 'destek' },
          { key: 'status', label: 'Hesap durumu', Icon: ShieldAlert, color: Colors.gold, href: '/hesap-durumu', keywords: 'ihlal askı' },
          { key: 'rules', label: 'Topluluk kuralları', Icon: BookOpen, href: '/topluluk-kurallari' },
          {
            key: 'about',
            label: 'Hakkında',
            desc: 'Gizlilik, kullanım koşulları, sürüm',
            Icon: Info,
            keywords: 'kvkk aydınlatma yasal telif sürüm',
            href: '/hakkinda',
          },
        ],
      },
      {
        title: 'Giriş',
        items: [
          {
            key: 'logout',
            label: auth.profile ? `@${auth.profile.username} hesabından çıkış yap` : 'Çıkış yap',
            Icon: LogOut,
            color: Colors.live,
            danger: true,
            onPress: () => {
              if (auth.session) auth.signOut();
              else router.replace('/giris' as Href);
            },
          },
        ],
      },
    );
    return g;
  })();

  const q = norm(query.trim());
  const results = q
    ? groups
        .flatMap((gr) => gr.items)
        .filter((it) => norm(`${it.label} ${it.desc ?? ''} ${it.keywords ?? ''}`).includes(q))
    : null;

  const renderItem = (it: Item, last: boolean) => {
    const icon = <it.Icon size={20} color={it.color ?? Colors.cyanSoft} />;
    if (it.toggle)
      return <ToggleRow key={it.key} icon={icon} label={it.label} desc={it.desc} value={it.toggle.value} onChange={it.toggle.onChange} last={last} />;
    return (
      <Row
        key={it.key}
        icon={icon}
        label={it.label}
        desc={it.desc}
        value={it.value}
        danger={it.danger}
        onPress={it.onPress ?? (() => it.href && go(it.href))}
        last={last}
      />
    );
  };

  return (
    <SubScreen title="Ayarlar ve hareketler">
      <View style={{ paddingHorizontal: Spacing.screen, paddingBottom: Spacing.xl }}>
        <SettingsSearch value={query} onChange={setQuery} />
        {results ? (
          results.length ? (
            <Section title="Sonuçlar">{results.map((it, i) => renderItem(it, i === results.length - 1))}</Section>
          ) : (
            <EmptyState icon={<Info size={36} color={Colors.textMuted} />} title="Sonuç yok" text={`"${query.trim()}" için ayar bulunamadı.`} />
          )
        ) : (
          groups.map((gr) => (
            <Section key={gr.title} title={gr.title}>
              {gr.items.map((it, i) => renderItem(it, i === gr.items.length - 1))}
            </Section>
          ))
        )}
      </View>
    </SubScreen>
  );
}
