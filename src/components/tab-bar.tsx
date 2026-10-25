import type { BottomTabBarProps } from 'expo-router/tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { FileText, Home, Trophy, User, Waves, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, TabBarHeight } from '@/constants/theme';

const ICONS: Record<string, LucideIcon> = {
  index: Home,
  akis: Waves,
  haberler: FileText,
  arenalar: Trophy,
  profil: User,
};

/** Taslaktaki alt menü: aktif sekme cyan, altında parlayan çizgi. */
export function VopilaTabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <LinearGradient
        colors={['rgba(6,14,30,0.92)', 'rgba(3,8,18,0.99)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const Icon = ICONS[route.name] ?? Home;
          const color = focused ? Colors.cyan : Colors.textSecondary;

          const onPress = () => {
            const event = emitter.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigateToTab(route.key);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              style={styles.item}>
              <Icon size={24} color={color} strokeWidth={focused ? 2.2 : 1.7} />
              <VText
                style={[styles.label, { color, fontFamily: focused ? Fonts.bold : Fonts.medium }]}>
                {options.title ?? route.name}
              </VText>
              <View style={[styles.indicator, focused && styles.indicatorOn]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', height: TabBarHeight - 10, paddingTop: 10 },
  item: { flex: 1, alignItems: 'center', gap: 4 },
  label: { fontSize: 11.5 },
  indicator: { width: 34, height: 3, borderRadius: 2, marginTop: 2 },
  indicatorOn: {
    backgroundColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
});
