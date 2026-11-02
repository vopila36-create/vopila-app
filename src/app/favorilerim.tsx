/** Favorilerim (Trendyol/Amazon'daki gibi): kalp ile kaydedilen ürünler. */
import { router, type Href } from 'expo-router';
import { Heart } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { Colors, Spacing } from '@/constants/theme';
import { useStore } from '@/store/app-store';

export default function Favorilerim() {
  const store = useStore();
  const list = store.favoriteIds.map((id) => store.productOf(id)).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <SubScreen title="Favorilerim">
      {list.length ? (
        <View style={styles.grid}>
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </View>
      ) : (
        <View style={{ paddingHorizontal: Spacing.screen }}>
          <EmptyState
            icon={<Heart size={40} color={Colors.textMuted} />}
            title="Favorin yok"
            text="Beğendiğin ürünlerdeki kalbe dokun; burada biriksin, stok azalınca kaçırma."
            action={<OutlineButton label="Mağazaya git" onPress={() => router.push('/magaza' as Href)} />}
          />
        </View>
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: Spacing.screen },
});
