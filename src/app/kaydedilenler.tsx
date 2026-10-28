/** Kaydedilenler: kaydettiğin gönderiler (yalnızca sen görürsün). */
import { Bookmark } from 'lucide-react-native';
import { View } from 'react-native';

import { PostGrid } from '@/components/post-grid';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { useStore } from '@/store/app-store';

export default function Kaydedilenler() {
  const store = useStore();
  const list = store.savedPostList;
  return (
    <SubScreen title="Kaydedilenler">
      <View style={{ paddingHorizontal: Spacing.screen, gap: 12 }}>
        <VText variant="caption">Kaydettiğin gönderileri yalnızca sen görürsün. {list.length} gönderi.</VText>
        {list.length ? (
          <PostGrid posts={list} />
        ) : (
          <EmptyState
            icon={<Bookmark size={40} color={Colors.cyan} />}
            title="Henüz bir şey kaydetmedin"
            text="Beğendiğin gönderilerin altındaki kaydet simgesine dokun; burada toplansın."
          />
        )}
      </View>
    </SubScreen>
  );
}
