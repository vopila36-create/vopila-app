/** Yeni mesaj: kişi seç → o kişiyle sohbet açılır. */
import { router, type Href } from 'expo-router';
import { View } from 'react-native';

import { PeoplePicker } from '@/components/people-picker';
import { SubScreen } from '@/components/ui/sub-screen';
import { Spacing } from '@/constants/theme';

export default function YeniMesaj() {
  return (
    <SubScreen title="Yeni Mesaj">
      <View style={{ paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm }}>
        <PeoplePicker selected={[]} onToggle={(u) => router.replace(`/mesaj/kisi/${u.id}` as Href)} />
      </View>
    </SubScreen>
  );
}
