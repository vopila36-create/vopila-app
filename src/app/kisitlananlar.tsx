import { ShieldMinus } from 'lucide-react-native';

import { RelationListScreen } from '@/components/relation-list';
import { Colors } from '@/constants/theme';

export default function Kisitlananlar() {
  return (
    <RelationListScreen
      kind="restricts"
      title="Kısıtlanan Hesaplar"
      intro="Kısıtladığın kişilerin gönderilerine yaptığı yorumları yalnızca kendileri ve sen görürsün; onlardan bildirim gelmez. Kısıtlandıklarını bilmezler."
      emptyTitle="Kısıtladığın kimse yok"
      removeLabel="Kaldır"
      icon={<ShieldMinus size={40} color={Colors.textMuted} />}
    />
  );
}
