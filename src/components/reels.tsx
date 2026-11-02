import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { OnDark, VText } from '@/components/ui/text';
import { useAge } from '@/store/age';
import { useStore } from '@/store/app-store';
import { Colors, OnImage } from '@/constants/theme';

/** autoplay: 15–18 yaşta video kendiliğinden başlamaz (Yaş Doğrulama Yönetmeliği). */
export type ReelState = { active: boolean; height: number; autoplay: boolean };

/** 15–18 yaş: sonsuz kaydırma yok; bu kadar içerikten sonra akış durur. */
const TEEN_LIMIT = 20;

/** İzlenme süresi en fazla bu kadar sayılır (videoyu açık bırakıp gitmek ilgiyi şişirmesin). */
const MAX_DWELL_SEC = 30;
/** Bundan kısa bakışlar "kaydırıp geçti" sayılır, ilgi eklenmez. */
const MIN_DWELL_SEC = 1.5;

/**
 * Instagram Reels gibi tam ekran, dikey kaydırmalı liste.
 * Her içerikte ne kadar kalındığını `onDwell` ile bildirir (ilgi algoritması bunu kullanır).
 */
export function ReelPager<T>({
  data,
  keyOf,
  renderItem,
  onDwell,
  overlay,
}: {
  data: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T, state: ReelState) => ReactNode;
  onDwell?: (item: T, seconds: number) => void;
  /** Üstte sabit duran başlık / filtreler. */
  overlay?: ReactNode;
}) {
  const { isTeen } = useAge();
  const [height, setHeight] = useState(0);
  const [index, setIndex] = useState(0);
  const [focused, setFocused] = useState(true);
  // İçeriğe gelinen an; ekran odaklanınca başlatılır
  const since = useRef(0);

  const report = useCallback(
    (i: number) => {
      const item = data[i];
      const secs = Math.min((Date.now() - since.current) / 1000, MAX_DWELL_SEC);
      since.current = Date.now();
      if (item && secs >= MIN_DWELL_SEC) onDwell?.(item, secs);
    },
    [data, onDwell],
  );

  // Sekmeden çıkınca video dursun ve o ana kadarki izlenme kaydedilsin
  const indexRef = useRef(0);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      since.current = Date.now();
      return () => {
        setFocused(false);
        report(indexRef.current);
      };
    }, [report]),
  );

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!height) return;
    const next = Math.round(e.nativeEvent.contentOffset.y / height);
    if (next !== index) {
      report(index);
      indexRef.current = next;
      setIndex(next);
    }
  };

  // Ayarlar > Videoları otomatik oynat
  const autoplayOn = useStore().state.settings.autoplayVideos;

  return (
    <OnDark>
    <View style={styles.root} onLayout={(e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height)}>
      {height ? (
        <FlatList
          data={isTeen ? data.slice(0, TEEN_LIMIT) : data}
          keyExtractor={keyOf}
          renderItem={({ item, index: i }) => (
            <View style={{ height }}>
              {renderItem(item, { active: focused && i === index, height, autoplay: !isTeen && autoplayOn })}
            </View>
          )}
          ListFooterComponent={
            isTeen && data.length > TEEN_LIMIT ? (
              <View style={[styles.end, { height }]}>
                <VText variant="title" color="#fff" style={{ textAlign: 'center' }}>
                  Bugünlük bu kadar
                </VText>
                <VText color={Colors.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>
                  Biraz ara ver. Yeni içerikler için daha sonra tekrar gel.
                </VText>
              </View>
            ) : undefined
          }
          pagingEnabled
          snapToInterval={height}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          showsVerticalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
          windowSize={3}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          removeClippedSubviews
        />
      ) : null}
      {overlay ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {overlay}
        </View>
      ) : null}
    </View>
    </OnDark>
  );
}

/** Reels sağ sütunundaki yuvarlak işlem butonu (gönder, detay vb.). */
export function ReelAction({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.action} accessibilityLabel={label}>
      <View style={styles.actionCircle}>{icon}</View>
      {label ? (
        <VText variant="caption" color="#fff" style={styles.actionLabel}>
          {label}
        </VText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  end: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  action: { alignItems: 'center', gap: 4 },
  actionCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionLabel: {
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 4,
    color: OnImage.text,
  },
});
