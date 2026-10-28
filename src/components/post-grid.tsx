/** Gönderi ızgarası (3 sütun): kapak görseli, video simgesi; dokununca gönderi açılır. */
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { PlayCircle } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Colors, Radius } from '@/constants/theme';
import type { Post } from '@/data/mock';

export function PostGrid({ posts, overlay }: { posts: Post[]; overlay?: (p: Post) => ReactNode }) {
  return (
    <View style={styles.grid}>
      {posts.map((p) => {
        const cover = p.media[0];
        const uri = cover ? (cover.type === 'video' ? cover.poster ?? '' : cover.uri) : '';
        return (
          <Pressable key={p.id} style={styles.item} onPress={() => router.push(`/gonderi/${p.id}` as Href)}>
            {uri ? (
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceStrong }]} />
            )}
            {cover?.type === 'video' ? (
              <View style={{ position: 'absolute', top: 6, left: 6 }}>
                <PlayCircle size={20} color="#fff" />
              </View>
            ) : null}
            {overlay?.(p)}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  item: { width: '32%', aspectRatio: 0.8, borderRadius: Radius.sm, overflow: 'hidden' },
});
