import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomFade } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { arenaByKey, interests } from '@/data/mock';

export default function IlgiAlanlari() {
  return (
    <SubScreen title="İlgi Alanları">
      <View style={styles.pad}>
        <VText style={{ marginBottom: Spacing.lg }}>
          Seni heyecanlandıran alanı seç; topluluğu, paylaşımları ve arenayı keşfet.
        </VText>
        <View style={{ gap: 12 }}>
          {interests.map((it) => (
            <Pressable key={it.key} style={styles.card} onPress={() => router.push(`/ilgi/${it.key}` as Href)}>
              <Image source={{ uri: it.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <BottomFade />
              <OnDark>
              <View style={[styles.tag, { borderColor: it.color }]}>
                <VText variant="caption" color={it.color}>
                  {arenaByKey(it.arenaKey).name} Arenası
                </VText>
              </View>
              <View style={styles.body}>
                <View style={{ flex: 1 }}>
                  <VText variant="heading">{it.title}</VText>
                  <VText variant="caption" color={OnImage.textSecondary}>
                    {it.text}
                  </VText>
                </View>
                <View style={styles.circle}>
                  <ChevronRight size={18} color="#fff" />
                </View>
              </View>
              </OnDark>
            </Pressable>
          ))}
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  card: { height: 170, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  tag: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: scrim(0.6),
  },
  body: { position: 'absolute', left: 14, right: 14, bottom: 14, flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
