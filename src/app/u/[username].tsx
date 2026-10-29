/** Profil bağlantısı (vopila.com/u/<kullanıcı adı>, QR): kullanıcıyı bulup profiline yönlendirir. */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { UserX } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { Colors } from '@/constants/theme';
import { profileIdByUsername } from '@/lib/social-api';
import { useStore } from '@/store/app-store';

export default function ProfilBaglantisi() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { myId } = useStore();
  const [notFound, setNotFound] = useState<string | null>(null);

  useEffect(() => {
    const name = String(username ?? '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name)) return;
    let alive = true;
    // 18 yaş altı hesaplar ilişkisi olmayanlara bulunamaz (sunucu kuralı)
    profileIdByUsername(name).then((id) => {
      if (!alive) return;
      if (!id) setNotFound(name);
      else router.replace((id === myId ? '/profil' : `/kullanici/${id}`) as Href);
    });
    return () => {
      alive = false;
    };
  }, [username, myId]);

  const invalid = !/^[a-z0-9_]{3,20}$/.test(String(username ?? '').toLowerCase());
  return (
    <SubScreen title="Profil">
      {invalid || notFound ? (
        <EmptyState
          icon={<UserX size={44} color={Colors.textMuted} />}
          title="Kullanıcı bulunamadı"
          text="Bağlantı hatalı olabilir ya da hesap kapatılmış veya gizlenmiş olabilir."
          action={<OutlineButton label="Ana sayfaya dön" onPress={() => router.replace('/' as Href)} />}
        />
      ) : (
        <View style={{ paddingTop: 60 }}>
          <ActivityIndicator color={Colors.cyan} />
        </View>
      )}
    </SubScreen>
  );
}
