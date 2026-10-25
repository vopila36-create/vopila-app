import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Bell, Search } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Spacing, TabBarHeight } from '@/constants/theme';
import { notifications } from '@/data/mock';
import { useStore } from '@/store/app-store';

/** Tüm ekranların koyu lacivert degrade zemini + kaydırılabilir içerik. */
export function Screen({
  children,
  header = <AppHeader />,
  scroll = true,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <View style={{ paddingTop: insets.top }}>{header}</View>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: TabBarHeight + insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </View>
  );
}

/** Sol üstte VOPILA logosu, sağda arama ve bildirim. */
export function AppHeader({
  tagline = false,
  right,
}: {
  tagline?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Logo tagline={tagline} />
      <View style={styles.headerIcons}>
        {right ?? (
          <>
            <SearchButton />
            <BellButton />
          </>
        )}
      </View>
    </View>
  );
}

/** Arama sayfasını açan büyüteç. */
export function SearchButton() {
  return (
    <Pressable hitSlop={8} onPress={() => router.push('/arama' as Href)} accessibilityLabel="Ara">
      <Search size={24} color={Colors.text} strokeWidth={1.8} />
    </Pressable>
  );
}

/** Bildirimleri açan zil; okunmamış bildirim varsa altın nokta. */
export function BellButton() {
  const { state } = useStore();
  const unread = notifications.some((n) => !state.readNotifications.includes(n.id));
  return (
    <Pressable hitSlop={8} onPress={() => router.push('/bildirimler' as Href)} accessibilityLabel="Bildirimler">
      <Bell size={24} color={Colors.text} strokeWidth={1.8} />
      {unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

export function Logo({ tagline }: { tagline?: boolean }) {
  return (
    <View>
      <View style={styles.logoRow}>
        <Image
          source={require('@/assets/images/logo-mark.png')}
          style={styles.mark}
          contentFit="contain"
        />
        <VText style={styles.wordmark}>VOPILA</VText>
      </View>
      {tagline ? <VText style={styles.tagline}>DISCOVER WHAT STANDS OUT</VText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
    paddingVertical: Spacing.sm,
  },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  dot: {
    position: 'absolute',
    top: -1,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.gold,
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: { width: 52, height: 28 },
  wordmark: {
    fontFamily: Fonts.medium,
    fontSize: 20,
    letterSpacing: 5,
    color: Colors.text,
  },
  tagline: {
    fontFamily: Fonts.semibold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: Colors.textSecondary,
    marginTop: 2,
    marginLeft: 60,
  },
});
