import { BellOff } from 'lucide-react-native';

import { RelationListScreen } from '@/components/relation-list';
import { Colors } from '@/constants/theme';

export default function SessizeAlinanlar() {
  return (
    <RelationListScreen
      kind="mutes"
      title="Sessize Alınanlar"
      intro="Sessize aldığın kişilerin gönderileri ve anları akışında görünmez. Takip etmeye devam edersin; sessize alındıklarını bilmezler."
      emptyTitle="Sessize aldığın kimse yok"
      removeLabel="Sesi aç"
      icon={<BellOff size={40} color={Colors.textMuted} />}
    />
  );
}
