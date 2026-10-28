/**
 * Topluluk kuralları: yasak içerikler (kaldırılır + ihlal), hassas içerikler (Instagram modeli: kaldırılmaz,
 * örtülü gösterilir, 18 altına gösterilmez) ve ceza basamakları. Yayından önce hukukçu gözden geçirecek.
 */
import { Ban, EyeOff, Scale } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

/** Yasak: kaldırılır, hesaba ihlal yazılır */
const FORBIDDEN: { title: string; items: string[] }[] = [
  {
    title: 'Çıplaklık ve cinsel içerik',
    items: [
      'Pornografi, cinsel ilişki, cinsel organ ve tamamen çıplak görüntüler yüklenemez.',
      'Cinsel hizmet teklifi, cinsel içerikli mesaj veya görüntü isteme ve gönderme yasaktır.',
      'Reşit olmayanları cinselleştiren her türlü içerik ağır ihlaldir: hesap kapatılır ve yetkililere bildirilir.',
    ],
  },
  {
    title: 'Küfür ve hakaret',
    items: [
      'Yorum, mesaj, açıklama ve profilde küfür, argo hakaret ve aşağılayıcı sözler yasaktır; sistem bunları otomatik engeller.',
      'Bir kişiyi görünüşü, ailesi ya da özel hayatı üzerinden küçük düşürmek yasaktır.',
    ],
  },
  {
    title: 'Taciz, zorbalık ve tehdit',
    items: [
      'Bir kişiyi hedef alan tekrar eden olumsuz yorumlar, ısrarlı mesajlar, toplu saldırı çağrısı yasaktır.',
      'Öldürme, yaralama ya da zarar verme tehdidi ve kişisel bilgileri (adres, telefon) ifşa etmek yasaktır.',
    ],
  },
  {
    title: 'Nefret söylemi',
    items: ['Etnik köken, din, cinsiyet, engellilik, yaş ya da hastalık üzerinden insanları aşağılamak veya şiddete çağırmak yasaktır.'],
  },
  {
    title: 'Ağır şiddet ve tehlikeli içerik',
    items: [
      'Gerçek şiddetin ayrıntılı, kanlı görüntüleri (parçalanma, ölü beden, işkence), hayvanlara eziyet yasaktır.',
      'Kendine zarar vermeyi, intiharı ya da yeme bozukluğunu özendiren içerik yasaktır; bu konuda yardım arayanlar desteğe yönlendirilir.',
      'Uyuşturucu, silah, sahte belge satışı ve terör örgütü propagandası yasaktır (terör propagandası ağır ihlaldir).',
    ],
  },
  {
    title: 'Dürüstlük',
    items: [
      'Spam, dolandırıcılık bağlantıları, sahte hesap ve başkasının kimliğine bürünmek yasaktır.',
      'Arenalarda sahte hesap, oy alışverişi ya da bot kullanmak yasaktır; oylar ve ödüller iptal edilir.',
      'Başkasının fotoğrafını, videosunu ya da eserini izinsiz paylaşmak telif ihlalidir.',
    ],
  },
];

/** Hassas (Instagram "hassas içerik" modeli): kaldırılmaz; örtülü gösterilir, önerilmez, 18 altına gösterilmez */
const SENSITIVE = [
  'Kan, yara, kaza ya da ameliyat gibi tıbbi görüntüler',
  'Kavga ve şiddet tasviri (ayrıntılı ve kanlı olmayan)',
  'Avlanma, kesim ya da ölü hayvan görüntüleri',
  'Cinsel açıdan imalı içerik: transparan ya da çok açık kıyafet, kışkırtıcı pozlar',
  'Sigara, alkol ve ilaç kullanımı',
  'Korku, ürkütücü ve rahatsız edici görüntüler',
  'Mucize zayıflama, abartılı sağlık iddiaları ve kozmetik işlemler',
];

const LADDER = ['Uyarı', '1 gün kısıtlama', '3 gün kısıtlama', '7 gün kısıtlama', '30 gün kısıtlama', 'Hesap kapatılır'];

export default function ToplulukKurallari() {
  return (
    <SubScreen title="Topluluk Kuralları">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg, paddingBottom: Spacing.xxl }}>
        <VText variant="body" color={Colors.textSecondary}>
          VOPILA’yı herkes için güvenli tutmak için bu kurallara uyarız. Kuralları ihlal eden içerikleri şikâyet
          edebilirsin; ekibimiz inceler.
        </VText>

        <Header icon={<Ban size={20} color={Colors.live} />} title="Yasak içerikler" note="Kaldırılır ve hesabına ihlal yazılır." />
        {FORBIDDEN.map((f) => (
          <GlassCard key={f.title} style={{ padding: 14, gap: 6 }}>
            <VText variant="bodyBold">{f.title}</VText>
            {f.items.map((i) => (
              <VText key={i} style={{ fontSize: 13 }}>
                • {i}
              </VText>
            ))}
          </GlassCard>
        ))}

        <Header
          icon={<EyeOff size={20} color={Colors.gold} />}
          title="Hassas içerikler"
          note="Kaldırılmaz ama örtülü gösterilir, keşfette önerilmez ve 18 yaş altına hiç gösterilmez. Paylaşırken “Hassas içerik” olarak işaretle."
        />
        <GlassCard style={{ padding: 14, gap: 6 }}>
          {SENSITIVE.map((s) => (
            <VText key={s} style={{ fontSize: 13 }}>
              • {s}
            </VText>
          ))}
        </GlassCard>

        <Header
          icon={<Scale size={20} color={Colors.cyan} />}
          title="İhlal ve cezalar"
          note="İhlaller 1 yıl sayılır. Kısıtlamada hesabını görebilirsin ama paylaşım, yorum ve mesaj gönderemezsin."
        />
        <GlassCard style={{ padding: 14, gap: 6 }}>
          {LADDER.map((l, i) => (
            <VText key={l} style={{ fontSize: 13 }}>
              {i + 1}. ihlal: {l}
            </VText>
          ))}
          <VText variant="caption" style={{ marginTop: 4 }}>
            Çocuk güvenliği ve terör propagandası gibi ağır ihlallerde hesap ilk seferde kapatılır. Her karara Destek
            üzerinden itiraz edebilirsin; itirazları bir kişi inceler. Hesap durumunu Ayarlar &gt; Hesap durumu
            bölümünden görebilirsin.
          </VText>
        </GlassCard>

        <VText variant="caption">
          Kendi gönderine gelen yorumları silebilir ya da şikâyet edebilirsin. Engellediğin kişiler seninle etkileşim kuramaz.
        </VText>
      </View>
    </SubScreen>
  );
}

function Header({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {icon}
        <VText variant="heading">{title}</VText>
      </View>
      <VText variant="caption">{note}</VText>
    </View>
  );
}
