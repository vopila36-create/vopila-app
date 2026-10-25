/**
 * Google girişinden dönüş adresi. Normalde `signInWithGoogle` kodu kendisi işler;
 * uygulama bu adresle doğrudan açılırsa (deep link) kodu burada oturuma çevirip ana sayfaya döner.
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    const go = () => router.replace('/' as Href);
    if (typeof code === 'string' && code) {
      supabase.auth.exchangeCodeForSession(code).finally(go);
    } else {
      go();
    }
  }, [code]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg }}>
      <ActivityIndicator color={Colors.cyan} />
    </View>
  );
}
