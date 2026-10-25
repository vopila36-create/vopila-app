import { Tabs } from 'expo-router';

import { VopilaTabBar } from '@/components/tab-bar';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <VopilaTabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Ana Sahne' }} />
      <Tabs.Screen name="akis" options={{ title: 'Akış' }} />
      <Tabs.Screen name="haberler" options={{ title: 'Haberler' }} />
      <Tabs.Screen name="arenalar" options={{ title: 'Arenalar' }} />
      <Tabs.Screen name="profil" options={{ title: 'Profil' }} />
    </Tabs>
  );
}
