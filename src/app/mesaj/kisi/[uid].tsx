/** Bir kişiyle sohbeti açar (yoksa oluşturur) ve sohbet ekranına geçer. Profildeki "Mesaj" buraya gelir. */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { MessageCircleOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { Colors } from '@/constants/theme';
import { openDm } from '@/lib/messages-api';
import { useStore } from '@/store/app-store';

export default function SohbetAc() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { myId } = useStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !myId) return;
    let cancelled = false;
    openDm(String(uid)).then((res) => {
      if (cancelled) return;
      if (res.ok) router.replace(`/mesaj/${res.data}` as Href);
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, myId]);

  if (!myId || error) {
    return (
      <SubScreen title="Mesaj">
        <EmptyState
          icon={<MessageCircleOff size={40} color={Colors.textMuted} />}
          title={myId ? 'Sohbet açılamadı' : 'Mesajlaşmak için giriş yap'}
          text={error ?? undefined}
          action={<OutlineButton label="Geri" onPress={() => router.back()} />}
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen title="Mesaj">
      <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
    </SubScreen>
  );
}
