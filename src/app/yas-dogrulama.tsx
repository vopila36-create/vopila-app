/** Yaş doğrulama: kayıtlı yaş grubu, 15–18 yaş korumaları ve e-Devlet doğrulaması (yakında). */
import { router, type Href } from 'expo-router';
import { BadgeCheck, CalendarDays, Check, Landmark } from 'lucide-react-native';
import { View } from 'react-native';

import { GlassCard, OutlineButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { AGE_LABEL, METHOD_LABEL } from '@/lib/age-api';
import { useAge } from '@/store/age';

const TEEN_RULES = [
  'Hesabın gizli açılır (istersen herkese açık yapabilirsin).',
  'Takipçi ve takip listen yalnızca sana görünür.',
  'Sana yalnızca senin takip ettiğin hesaplar mesaj gönderebilir.',
  'Aramada ve önerilerde yalnızca takip ilişkin olan kişilere görünürsün.',
  'Videolar kendiliğinden oynamaz, Reels akışı bir süre sonra durur.',
  'Canlı yayın açamazsın, sana kişiye özel reklam gösterilmez.',
];

export default function YasDogrulama() {
  const { age } = useAge();
  return (
    <SubScreen title="Yaş doğrulama">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg }}>
        <GlassCard style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <CalendarDays size={22} color={Colors.cyan} />
            <VText variant="bodyBold" style={{ flex: 1 }}>
              {age ? AGE_LABEL[age.group] : 'Yükleniyor…'}
            </VText>
          </View>
          {age ? (
            <VText variant="caption">
              {METHOD_LABEL[age.method]}. Doğum tarihin saklanmaz; yalnızca yaş grubun kayıtlıdır.
            </VText>
          ) : null}
        </GlassCard>

        <GlassCard style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Landmark size={22} color={Colors.cyanSoft} />
            <VText variant="bodyBold" style={{ flex: 1 }}>
              e-Devlet ile doğrula
            </VText>
            {age?.method === 'edevlet' ? <BadgeCheck size={20} color={Colors.success} /> : null}
          </View>
          <VText variant="caption">
            Yasa gereği tüm hesapların yaşı 31 Mart 2027&apos;ye kadar e-Devlet üzerinden doğrulanacak. e-Devlet yalnızca
            15 ve 18 yaşından büyük olup olmadığını bildirir; adın, T.C. kimlik numaran ve doğum tarihin VOPILA ile
            paylaşılmaz. Bu doğrulama yakında açılacak; açıldığında sana bildirim göndereceğiz.
          </VText>
        </GlassCard>

        <View style={{ gap: 8 }}>
          <VText variant="heading">15–18 yaş korumaları</VText>
          {TEEN_RULES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
              <Check size={16} color={Colors.cyan} style={{ marginTop: 3 }} />
              <VText variant="body" style={{ flex: 1 }}>
                {r}
              </VText>
            </View>
          ))}
        </View>

        <OutlineButton label="Yaşım yanlış kayıtlı — itiraz et" onPress={() => router.push('/destek?konu=yas' as Href)} />
      </View>
    </SubScreen>
  );
}
