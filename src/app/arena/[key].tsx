import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Crown,
  Plus,
  ShieldCheck,
  Star,
  Trophy,
  Users,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { WinnersCard } from '@/components/winners-card';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { arenaByKey, ME_ID, MIN_VOTES_FOR_RANK } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

const PRIZE_COLORS = [Colors.gold, '#C9D3E0', '#D08B5B'];

export default function ArenaDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const arena = arenaByKey(key ?? '');
  const store = useStore();
  const joined = store.joinedArenas.includes(arena.key);
  const entries = store.rankedEntries(arena.key);
  const go = (href: string) => router.push(href as Href);

  return (
    <SubScreen title={`${arena.name} Arenası`}>
      <View style={styles.hero}>
        <Image source={{ uri: arena.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={['transparent', scrim(0.92)]} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <OnDark>
        <View style={styles.heroBody}>
          <View style={styles.row}>
            <VText variant="title" style={{ flexShrink: 1 }} numberOfLines={1}>
              {arena.name} Arenası
            </VText>
            <BadgeCheck size={22} color="#fff" fill={OnImage.accent} />
          </View>
          <VText variant="body" color={OnImage.text}>
            {arena.tagline}
          </VText>
          <View style={[styles.row, { marginTop: 8, gap: 14 }]}>
            <View style={styles.row}>
              <Users size={14} color={OnImage.textSecondary} />
              <VText variant="caption" color={OnImage.textSecondary}>
                {formatCount(store.arenaMeta(arena.key).members)} Üye
              </VText>
            </View>
            <View style={styles.row}>
              <Clock size={14} color={OnImage.accent} />
              <VText variant="caption" color={OnImage.textSecondary}>
                Ay sonuna (gece 12): {store.arenaMeta(arena.key).endsIn}
              </VText>
            </View>
          </View>
        </View>
        </OnDark>
      </View>

      <View style={styles.pad}>
        <View style={styles.actions}>
          <PrimaryButton
            label="Gönderi Paylaş"
            icon={<ArrowRight size={16} color={Colors.onCyan} />}
            onPress={() => go(`/olustur?arena=${arena.key}`)}
            style={{ flex: 1 }}
          />
          <OutlineButton
            label={joined ? 'Katıldın' : 'Katıl'}
            iconLeft={joined ? <Check size={16} color={Colors.cyan} /> : <Plus size={16} color={Colors.text} />}
            onPress={() => store.toggleJoinArena(arena.key)}
            style={{ flex: 1, height: 42 }}
          />
        </View>
        {joined ? (
          <Pressable onPress={() => store.toggleJoinArena(arena.key)} hitSlop={6}>
            <VText variant="caption" style={{ textAlign: 'right', marginTop: 6 }}>
              Arenadan ayrılmak için dokun
            </VText>
          </Pressable>
        ) : null}

        <VText variant="body" style={{ marginTop: Spacing.lg }}>
          {arena.description}
        </VText>

        {/* Geçen ayın kazananları */}
        <View style={{ marginTop: Spacing.lg }}>
          <WinnersCard arenaKey={arena.key} />
        </View>

        {/* Ödüller */}
        <GlassCard style={styles.card}>
          <SectionHeader title="Bu Ayın Ödülleri" action={null} icon={<Trophy size={18} color={Colors.gold} />} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {store.arenaMeta(arena.key).prizes.map((p, i) => (
              <View key={i} style={[styles.prize, { borderColor: PRIZE_COLORS[i] }]}>
                <Crown size={18} color={PRIZE_COLORS[i]} fill={PRIZE_COLORS[i]} />
                <VText variant="caption" color={Colors.text}>
                  {i + 1}. sıra
                </VText>
                <VText variant="bodyBold" color={PRIZE_COLORS[i]}>
                  {p} Token
                </VText>
              </View>
            ))}
          </View>
        </GlassCard>

        {/* Kurallar */}
        <GlassCard style={styles.card}>
          <SectionHeader title="Yarışma Kuralları" action={null} icon={<ShieldCheck size={18} color={Colors.cyan} />} />
          {[
            'Kendi gönderine oy veremezsin.',
            'Her gönderiye yalnızca bir kez 1-5 yıldız verebilirsin.',
            `Sıralamaya girmek için en az ${MIN_VOTES_FOR_RANK} oy gerekir.`,
            'Her sezon ayın 1’inde başlar, ayın son günü gece 12’de biter; ertesi ayın sezonu hemen açılır.',
            'Sezon bitince ilk 3 otomatik belirlenir, kazananlar ve ödülleri burada yayınlanır, tokenler cüzdana yüklenir.',
            'Hile önlemi: oy verebilmek için hesabın en az 3 günlük olmalı; şüpheli oylar incelenir.',
          ].map((r) => (
            <View key={r} style={styles.rule}>
              <View style={styles.bullet} />
              <VText variant="body" style={{ flex: 1, fontSize: 13 }}>
                {r}
              </VText>
            </View>
          ))}
        </GlassCard>

        {/* Gönderiler */}
        <View style={{ marginTop: Spacing.xl }}>
          <SectionHeader
            title="Yarışan Gönderiler"
            subtitle="Dokun, incele ve puanla"
            action="Liderlik Tablosu"
            onAction={() => go(`/liderlik?arena=${arena.key}`)}
          />
          {entries.length ? (
            <View style={styles.grid}>
              {entries.map((e) => {
                const author = store.userOf(e.authorId);
                const isMe = e.authorId === ME_ID;
                return (
                  <Pressable key={e.id} style={styles.entry} onPress={() => go(`/arena/giris/${e.id}`)}>
                    <Image source={{ uri: e.image }} style={styles.entryImg} contentFit="cover" />
                    <View style={styles.rankBadge}>
                      <VText style={styles.rankText}>#{e.rank}</VText>
                    </View>
                    {e.myVote ? (
                      <View style={styles.myVote}>
                        <Star size={11} color={Colors.onCyan} fill={Colors.onCyan} />
                        <VText style={styles.myVoteText}>{e.myVote}</VText>
                      </View>
                    ) : isMe ? (
                      <View style={[styles.myVote, { backgroundColor: Colors.gold }]}>
                        <VText style={styles.myVoteText}>Senin</VText>
                      </View>
                    ) : null}
                    <View style={{ padding: 8, gap: 2 }}>
                      <VText variant="label" numberOfLines={1}>
                        {e.title}
                      </VText>
                      <VText variant="caption" numberOfLines={1}>
                        {author.name}
                      </VText>
                      <View style={styles.row}>
                        <Star size={12} color={Colors.gold} fill={Colors.gold} />
                        <VText variant="caption" color={Colors.text}>
                          {e.average ? e.average.toFixed(1) : '—'}
                        </VText>
                        <VText variant="caption" numberOfLines={1} style={{ flexShrink: 1 }}>
                          · {e.votes} oy
                        </VText>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <VText variant="body">Henüz gönderi yok. İlk paylaşan sen ol!</VText>
          )}
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hero: { height: 240 },
  heroBody: { position: 'absolute', left: Spacing.screen, right: Spacing.screen, bottom: 10, gap: 2 },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  card: { padding: 14, marginTop: Spacing.lg },
  prize: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    backgroundColor: Colors.surfaceRaised,
  },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cyan, marginTop: 7 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  entry: {
    width: '48.5%',
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  entryImg: { width: '100%', aspectRatio: 1 },
  rankBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: scrim(0.75),
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  rankText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.text },
  myVote: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
  },
  myVoteText: { fontFamily: Fonts.bold, fontSize: 11, color: Colors.onCyan },
});
