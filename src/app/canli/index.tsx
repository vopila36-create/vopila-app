/**
 * Canlı yayın: altyapı (LiveKit) bağlanana kadar "Yakında" ekranı.
 * Örnek yayınlar ve sahte "talebin alındı" akışı beta kullanıcılarını yanıltmasın diye kaldırıldı
 * (eski tasarım git geçmişinde: canli/index.tsx, canli/[id].tsx).
 */
import { router, type Href } from 'expo-router';
import { Radio } from 'lucide-react-native';
import { View } from 'react-native';

import { OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { Colors, Spacing } from '@/constants/theme';

export default function CanliListe() {
  return (
    <SubScreen title="Canlı">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <EmptyState
          icon={<Radio size={44} color={Colors.live} />}
          title="Canlı yayın çok yakında"
          text="Topluluğunla anlık buluşabileceğin canlı yayınlar üzerinde çalışıyoruz. Hazır olduğunda burada olacak."
          action={<OutlineButton label="Akışa dön" onPress={() => router.replace('/akis' as Href)} />}
        />
      </View>
    </SubScreen>
  );
}
