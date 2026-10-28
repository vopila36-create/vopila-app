/** Topluluk kuralları (yayından önce hukukçu tarafından gözden geçirilecek). */
import { View } from 'react-native';

import { GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';

const RULES: { title: string; text: string }[] = [
  { title: 'Saygılı ol', text: 'Nefret söylemi, taciz, zorbalık ve tehdit yasaktır. Farklı görüşlere saygı göster.' },
  { title: 'Kendi içeriğini paylaş', text: 'Başkasının fotoğrafını, videosunu ya da eserini izinsiz paylaşma. Telif ihlali içerikler kaldırılır.' },
  { title: 'Güvenli içerik', text: 'Çıplaklık, cinsel içerik, şiddet ve tehlikeli davranışları özendiren paylaşımlar yasaktır. Çocukların güvenliğini tehlikeye atan içerik derhal kaldırılır ve yetkililere bildirilir.' },
  { title: 'Dürüst yarış', text: 'Arenalarda sahte hesap, oy halkası, toplu hesap ya da bot kullanmak yasaktır. Hile tespit edilirse oylar ve ödüller iptal edilir, hesap kapatılabilir.' },
  { title: 'Gerçek ol', text: 'Başkasının kimliğine bürünme, yanıltıcı ya da sahte bilgi yayma. Yapay zekâ ile üretilmiş içeriği belirt.' },
  { title: 'Spam yapma', text: 'Toplu mesaj, tekrarlayan yorum ve dolandırıcılık amaçlı bağlantılar yasaktır.' },
  { title: 'Kurala uymayan içerik', text: 'Şikayet edilen içerik ekibimizce incelenir. Kuralları ihlal eden hesaplar uyarılabilir, kısıtlanabilir ya da kapatılabilir.' },
];

export default function ToplulukKurallari() {
  return (
    <SubScreen title="Topluluk Kuralları">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 10 }}>
        <VText variant="caption">VOPILA’yı herkes için güvenli ve keyifli tutmak için bu kurallara uyarız.</VText>
        {RULES.map((r, i) => (
          <GlassCard key={r.title} style={{ padding: 14, gap: 4 }}>
            <VText variant="bodyBold" color={Colors.text}>
              {i + 1}. {r.title}
            </VText>
            <VText style={{ fontSize: 13 }}>{r.text}</VText>
          </GlassCard>
        ))}
      </View>
    </SubScreen>
  );
}
