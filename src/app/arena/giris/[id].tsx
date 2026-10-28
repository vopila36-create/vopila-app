import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft, ChevronRight, Crown, Star, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StarRating } from '@/components/ui/media';
import { Avatar, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { arenaByKey, arenas, ME_ID, MIN_VOTES_FOR_RANK } from '@/data/mock';
import { useMe, useStore } from '@/store/app-store';

export default function EntryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const me = useMe();
  const [voting, setVoting] = useState(false);
  // Gönderinin hangi arenada olduğunu bul (gerçek girişler, benim yerel girişlerim ve örnekler)
  const base = arenas.flatMap((a) => store.rankedEntries(a.key)).find((e) => e.id === id);
  if (!base) {
    return (
      <SubScreen title="Gönderi">
        <EmptyState
          icon={<Trophy size={40} color={Colors.textMuted} />}
          title="Gönderi bulunamadı"
          text="Bu gönderi kaldırılmış olabilir."
          action={<OutlineButton label="Arenalara dön" onPress={() => router.replace('/arenalar' as Href)} />}
        />
      </SubScreen>
    );
  }

  const arena = arenaByKey(base.arenaKey);
  const ranked = store.rankedEntries(base.arenaKey);
  const idx = ranked.findIndex((e) => e.id === id);
  const entry = ranked[idx];
  const isMine = entry.authorId === ME_ID;
  const author = isMine ? me : store.userOf(entry.authorId);
  const prev = ranked[idx - 1];
  const next = ranked[idx + 1];
  const nextUnvoted = ranked.find((e, i) => i !== idx && !e.myVote && e.authorId !== ME_ID);

  const goEntry = (entryId: string) => {
    setFeedback(null);
    router.replace(`/arena/giris/${entryId}` as Href);
  };

  const onVote = async (score: number) => {
    if (voting) return;
    setVoting(true);
    const res = await store.vote(entry, score);
    setVoting(false);
    setFeedback(res.ok ? { ok: true, text: `${score} yıldız verdin. Teşekkürler!` } : { ok: false, text: res.error ?? 'Oy verilemedi.' });
  };

  return (
    <SubScreen title={`${arena.name} Arenası`}>
      <View style={styles.pad}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: entry.image || arena.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          <OnDark>
          <View style={styles.rank}>
            {entry.rank <= 3 ? <Crown size={14} color={OnImage.gold} fill={OnImage.gold} /> : null}
            <VText variant="label">#{entry.rank}</VText>
          </View>
          </OnDark>
        </View>

        <VText variant="title" style={{ marginTop: Spacing.lg, fontSize: 24, lineHeight: 30 }}>
          {entry.title}
        </VText>

        <Pressable style={styles.author} onPress={() => router.push((isMine ? "/profil" : `/kullanici/${author.id}`) as Href)}>
          <Avatar uri={author.avatar} size={36} />
          <View style={{ flex: 1 }}>
            <VText variant="bodyBold">{isMine ? 'Sen' : author.name}</VText>
            <VText variant="caption">@{author.username}</VText>
          </View>
          <ChevronRight size={18} color={Colors.textSecondary} />
        </Pressable>

        <View style={styles.stats}>
          <Stat label="Sıra" value={`#${entry.rank}`} />
          <Stat label="Ortalama" value={entry.average ? entry.average.toFixed(2) : '—'} star />
          <Stat label="Oy" value={String(entry.votes)} />
        </View>
        {!entry.qualified ? (
          <VText variant="caption" color={Colors.gold} style={{ marginTop: 6 }}>
            Sıralamaya girmek için en az {MIN_VOTES_FOR_RANK} oy gerekiyor ({entry.votes}/{MIN_VOTES_FOR_RANK}).
          </VText>
        ) : null}

        {/* Oylama */}
        <GlassCard style={styles.voteCard} highlighted={!isMine && !entry.myVote}>
          {isMine ? (
            <>
              <VText variant="heading">Bu senin gönderin</VText>
              <VText variant="body" style={{ marginTop: 4 }}>
                Kendi gönderine oy veremezsin. Diğer kullanıcıların puanlarını burada takip edebilirsin.
              </VText>
            </>
          ) : entry.myVote ? (
            <>
              <VText variant="heading">Oyun kaydedildi</VText>
              <View style={{ marginTop: 10 }}>
                <StarRating value={entry.myVote} disabled />
              </View>
              <VText variant="caption" style={{ marginTop: 8 }}>
                Her gönderiye yalnızca bir kez oy verebilirsin.
              </VText>
            </>
          ) : (
            <>
              <VText variant="heading">Bu gönderiyi puanla</VText>
              <VText variant="caption" style={{ marginTop: 2 }}>
                1 ile 5 yıldız arasında seç. Oyun değiştirilemez.
              </VText>
              <View style={{ marginTop: 12 }}>
                <StarRating onChange={onVote} size={36} />
              </View>
            </>
          )}
          {feedback ? (
            <VText variant="label" color={feedback.ok ? Colors.success : Colors.live} style={{ marginTop: 10 }}>
              {feedback.text}
            </VText>
          ) : null}
        </GlassCard>

        {nextUnvoted ? (
          <PrimaryButton
            label="Sıradaki gönderiyi puanla"
            icon={<ChevronRight size={16} color={Colors.onCyan} />}
            onPress={() => goEntry(nextUnvoted.id)}
            style={{ marginTop: Spacing.lg }}
          />
        ) : null}

        <View style={styles.nav}>
          <OutlineButton
            label="Önceki"
            iconLeft={<ChevronLeft size={16} color={prev ? Colors.text : Colors.textMuted} />}
            onPress={() => prev && goEntry(prev.id)}
            style={[{ flex: 1 }, !prev && { opacity: 0.4 }]}
          />
          <OutlineButton
            label="Sonraki"
            icon={<ChevronRight size={16} color={next ? Colors.text : Colors.textMuted} />}
            onPress={() => next && goEntry(next.id)}
            style={[{ flex: 1 }, !next && { opacity: 0.4 }]}
          />
        </View>

        <Pressable style={styles.link} onPress={() => router.push(`/liderlik?arena=${arena.key}` as Href)}>
          <Trophy size={14} color={Colors.cyan} />
          <VText variant="label" color={Colors.cyan}>
            Liderlik tablosunu gör
          </VText>
        </Pressable>
      </View>
    </SubScreen>
  );
}

function Stat({ label, value, star }: { label: string; value: string; star?: boolean }) {
  return (
    <GlassCard style={styles.stat}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {star ? <Star size={14} color={Colors.gold} fill={Colors.gold} /> : null}
        <VText variant="heading">{value}</VText>
      </View>
      <VText variant="caption">{label}</VText>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  rank: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: scrim(0.75),
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.md },
  stats: { flexDirection: 'row', gap: 8, marginTop: Spacing.lg },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  voteCard: { padding: 16, marginTop: Spacing.lg, alignItems: 'center' },
  nav: { flexDirection: 'row', gap: 10, marginTop: Spacing.md },
  link: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.lg },
});
