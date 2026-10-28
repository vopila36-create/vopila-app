/**
 * Yakın Arkadaşlar (Instagram gibi): "★ Yakın Arkadaşlar" olarak paylaşılan anları yalnızca bu
 * listedekiler görür. Listeye eklenen kişiye bildirim gitmez, listeyi yalnızca sen görürsün.
 */
import { Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { PeoplePicker } from '@/components/people-picker';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { User } from '@/data/mock';
import { fetchCloseFriends, setCloseFriend } from '@/lib/close-friends-api';
import { useStore } from '@/store/app-store';

export default function YakinArkadaslar() {
  const { myId } = useStore();
  const [ids, setIds] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!myId) return;
    let alive = true;
    fetchCloseFriends(myId).then((r) => {
      if (!alive) return;
      if (r.ok) setIds(r.data.map((u) => u.id));
      else setError(r.error);
    });
    return () => {
      alive = false;
    };
  }, [myId]);

  const toggle = async (u: User) => {
    if (!myId || !ids) return;
    const on = !ids.includes(u.id);
    // Ekranda hemen değişsin; sunucu reddederse geri al
    setIds((l) => (l ? (on ? [u.id, ...l] : l.filter((x) => x !== u.id)) : l));
    const r = await setCloseFriend(myId, u.id, on);
    if (!r.ok) {
      setError(r.error);
      setIds((l) => (l ? (on ? l.filter((x) => x !== u.id) : [u.id, ...l]) : l));
    }
  };

  return (
    <SubScreen title="Yakın Arkadaşlar">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.md }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Star size={20} color="#22C55E" fill="#22C55E" />
          <VText variant="body" style={{ flex: 1 }}>
            “★ Yakın Arkadaşlar” seçerek paylaştığın anları yalnızca bu listedekiler görür; anın çerçevesi yeşil olur.
            Listeye eklediğin kişiye bildirim gitmez, listeyi yalnızca sen görürsün.
          </VText>
        </View>
        <VText variant="label" color={Colors.success}>
          {ids ? `Listende ${ids.length} kişi var` : 'Yükleniyor…'}
        </VText>
        {error ? <VText color={Colors.live}>{error}</VText> : null}
        <PeoplePicker selected={ids ?? []} onToggle={toggle} multi />
      </View>
    </SubScreen>
  );
}
