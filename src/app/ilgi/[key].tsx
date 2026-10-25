import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Compass, ImagePlus, PlayCircle, Trophy, Users } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { arenaByKey, interests, ME_ID, userById } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

export default function IlgiDetay() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const store = useStore();
  const it = interests.find((i) => i.key === key);

  if (!it) {
    return (
      <SubScreen title="İlgi Alanı">
        <EmptyState
          icon={<Compass size={40} color={Colors.textMuted} />}
          title="Bu alan bulunamadı"
          action={<OutlineButton label="Tüm Alanlar" onPress={() => router.replace('/ilgi' as Href)} />}
        />
      </SubScreen>
    );
  }

  const arena = arenaByKey(it.arenaKey);
  const related = store.allPosts.filter((p) => p.arenaKey === it.arenaKey);
  const people = Array.from(new Set(related.map((p) => p.authorId))).filter((id) => id !== ME_ID);

  return (
    <SubScreen title={it.title}>
      <View style={styles.hero}>
        <Image source={{ uri: it.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['transparent', Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          <VText variant="title" style={{ fontSize: 26 }}>
            {it.title}
          </VText>
          <VText color={Colors.text}>{it.text}</VText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <Users size={14} color={it.color} />
            <VText variant="caption" color={Colors.textSecondary}>
              {formatCount(arena.members)} üye
            </VText>
          </View>
        </View>
      </View>

      <View style={styles.pad}>
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <PrimaryButton
            label="Arenaya Git"
            icon={<Trophy size={16} color={Colors.onCyan} />}
            onPress={() => router.push(`/arena/${arena.key}` as Href)}
          />
          <OutlineButton
            label="Paylaşım Yap"
            iconLeft={<ImagePlus size={16} color={Colors.text} />}
            onPress={() => router.push(`/olustur?arena=${arena.key}` as Href)}
          />
        </View>

        {people.length ? (
          <>
            <VText variant="heading" style={styles.h}>
              Bu alandaki kâşifler
            </VText>
            <View style={{ flexDirection: 'row', gap: 14, flexWrap: 'wrap' }}>
              {people.map((id) => {
                const u = userById(id);
                return (
                  <Pressable key={id} style={{ alignItems: 'center', width: 70 }} onPress={() => router.push(`/kullanici/${id}` as Href)}>
                    <Avatar uri={u.avatar} size={56} ring />
                    <VText variant="caption" color={Colors.text} numberOfLines={1} style={{ marginTop: 4 }}>
                      {u.name.split(' ')[0]}
                    </VText>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <VText variant="heading" style={styles.h}>
          Paylaşımlar
        </VText>
        {related.length ? (
          <View style={styles.grid}>
            {related.map((p) => {
              const c = p.media[0];
              return (
                <Pressable key={p.id} style={styles.gridItem} onPress={() => router.push(`/gonderi/${p.id}` as Href)}>
                  <Image source={{ uri: c.type === 'video' ? c.poster ?? c.uri : c.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {c.type === 'video' ? (
                    <View style={{ position: 'absolute', top: 6, left: 6 }}>
                      <PlayCircle size={20} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={<ImagePlus size={36} color={Colors.textMuted} />}
            title="Henüz paylaşım yok"
            text="İlk paylaşımı sen yap!"
          />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 240 },
  heroBody: { position: 'absolute', left: Spacing.screen, right: Spacing.screen, bottom: Spacing.lg, gap: 2 },
  pad: { paddingHorizontal: Spacing.screen },
  h: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridItem: { width: '32%', aspectRatio: 0.8, borderRadius: Radius.sm, overflow: 'hidden' },
});
