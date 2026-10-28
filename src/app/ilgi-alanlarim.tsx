/**
 * İlgi alanların (Instagram "Önerilen içerik" şeffaflığı): hangi konular öne çıkıyor, ne kadar.
 * Haberler ve Arenalar akışındaki sıralama buna göre yapılır; kullanıcı sıfırlayabilir.
 */
import { Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { arenaByKey, type ArenaKey } from '@/data/mock';
import { useStore } from '@/store/app-store';

/** 'news:Spor' → 'Haberler · Spor', 'arena:otomobil' → 'Arena · Otomobil' */
function label(topic: string) {
  const [kind, key] = topic.split(':');
  if (kind === 'news') return `Haberler · ${key}`;
  if (kind === 'arena') return `Arena · ${arenaByKey(key as ArenaKey)?.name ?? key}`;
  return topic;
}

export default function IlgiAlanlarim() {
  const store = useStore();
  const [note, setNote] = useState<string | null>(null);
  const list = Object.entries(store.state.interests)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);
  const max = list[0]?.[1] ?? 1;

  const reset = async () => {
    const ok = await store.resetInterests();
    setNote(ok ? 'İlgi alanların sıfırlandı. Öneriler yeniden öğrenilecek.' : 'Sıfırlanamadı, tekrar dene.');
  };

  return (
    <SubScreen title="İlgi alanların">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg }}>
        <VText variant="body">
          Haberler ve Arenalar akışında neyi ne kadar izlediğine göre bu konular öne çıkar. Bilgi hesabına kaydedilir,
          böylece her cihazda aynı öneriler gelir. Zamanla eski ilgiler söner. Reklam için kullanılmaz.
        </VText>
        {list.length ? (
          <GlassCard style={{ padding: 14, gap: 12 }}>
            {list.map(([topic, score]) => (
              <View key={topic} style={{ gap: 6 }}>
                <VText variant="label">{label(topic)}</VText>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(6, Math.round((score / max) * 100))}%` }]} />
                </View>
              </View>
            ))}
          </GlassCard>
        ) : (
          <EmptyState
            icon={<Sparkles size={40} color={Colors.textMuted} />}
            title="Henüz ilgi alanı yok"
            text="Haberleri ve arenaları izledikçe sana özel konular burada görünecek."
          />
        )}
        <OutlineButton label="İlgi alanlarımı sıfırla" onPress={reset} />
        {note ? <VText color={Colors.success}>{note}</VText> : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' },
  fill: { height: 8, borderRadius: Radius.pill, backgroundColor: Colors.cyan },
});
