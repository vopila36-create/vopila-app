import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';
import { useInk } from '@/components/ui/text';

/**
 * Kısa video oynatıcı. `autoPlay` ile sessiz otomatik oynatma, aksi halde dokununca oynar.
 * Kontroller cihazın kendi oynatıcı kontrolleridir.
 */
export function VideoPlayer({
  uri,
  autoPlay = false,
  loop = true,
  muted = false,
  controls = true,
  style,
}: {
  uri: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = muted;
    if (autoPlay) p.play();
  });

  return (
    <VideoView
      player={player}
      style={[{ width: '100%', height: '100%', backgroundColor: '#000' }, style]}
      contentFit="cover"
      nativeControls={controls}
    />
  );
}

/** Görsel ya da video — kapak görseli verilmişse oynatılana kadar onu gösterir. */
export function MediaView({
  type,
  uri,
  poster,
  style,
}: {
  type: 'image' | 'video';
  uri: string;
  poster?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const [started, setStarted] = useState(false);
  if (type === 'image') {
    return (
      <View style={[StyleSheet.absoluteFill, style]}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      </View>
    );
  }
  if (!started && poster) {
    return (
      <Pressable style={[StyleSheet.absoluteFill, style]} onPress={() => setStarted(true)}>
        <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </Pressable>
    );
  }
  return (
    <View style={[StyleSheet.absoluteFill, style]}>
      <VideoPlayer uri={uri} autoPlay />
    </View>
  );
}

/** 1-5 yıldız puanlama. `value` boşsa ve `onChange` varsa seçilebilir. */
export function StarRating({
  value = 0,
  onChange,
  size = 28,
  disabled,
}: {
  value?: number;
  onChange?: (v: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  const ink = useInk();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const on = n <= Math.round(value);
        return (
          <Pressable
            key={n}
            disabled={disabled || !onChange}
            onPress={() => onChange?.(n)}
            hitSlop={4}
            accessibilityLabel={`${n} yıldız`}>
            <Star size={size} color={ink(on ? Colors.gold : Colors.textMuted)} fill={on ? ink(Colors.gold) : 'transparent'} />
          </Pressable>
        );
      })}
    </View>
  );
}
