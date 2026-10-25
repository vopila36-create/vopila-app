import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/manrope';
import { DarkTheme, router, Stack, ThemeProvider, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, type ReactNode } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { AppStoreProvider } from '@/store/app-store';
import { AuthProvider, useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.bg, primary: Colors.cyan, card: Colors.bg },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!loaded && !error) return null;

  return (
    <AuthProvider>
      <AppStoreProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <WebPhoneFrame>
            <RootStack />
          </WebPhoneFrame>
        </ThemeProvider>
      </AppStoreProvider>
    </AuthProvider>
  );
}

/** Giriş yapılmamışsa giriş ekranına, giriş yapılınca ana sayfaya yönlendirir. */
function RootStack() {
  const { enabled, ready, session, passwordRecovery } = useAuth();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  const onAuthScreen = first === 'giris' || first === 'auth-callback';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    if (!enabled || !ready) return;
    if (!session && !onAuthScreen) router.replace('/giris' as Href);
    // "Şifremi unuttum" ile kodla girildiyse önce yeni şifre belirlenir
    else if (session && first === 'giris') router.replace((passwordRecovery ? '/yeni-sifre' : '/') as Href);
  }, [enabled, ready, session, onAuthScreen, first, passwordRecovery]);

  // Oturum bilgisi gelene kadar açılış ekranı görünür kalır
  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bg },
        animation: 'slide_from_right',
      }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="giris" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="yeni-sifre" options={{ gestureEnabled: false }} />
      <Stack.Screen name="olustur" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="an/[id]" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
      <Stack.Screen
        name="kamera"
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: false }}
      />
    </Stack>
  );
}

/**
 * Bilgisayar tarayıcısında uygulamayı ortada telefon boyutunda gösterir
 * (uygulama telefon için tasarlandı; geniş ekranda yayılmasın). Telefonda etkisi yok.
 */
function WebPhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  if (Platform.OS !== 'web' || width <= 500) return <>{children}</>;
  const framed = height >= 760;
  return (
    <View style={frame.outer}>
      <View style={[frame.phone, framed && frame.phoneFramed]}>{children}</View>
    </View>
  );
}

const frame = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#01040B', alignItems: 'center', justifyContent: 'center' },
  phone: { width: 430, height: '100%', overflow: 'hidden', backgroundColor: Colors.bg },
  phoneFramed: {
    height: 900,
    maxHeight: '96%',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.18,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
});
