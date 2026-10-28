import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { BadgeCheck, Info, PlusSquare, Send, SlidersHorizontal, Star, Trophy } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReelAction, ReelPager } from '@/components/reels';
import { SendSheet, type SendPayload } from '@/components/send-sheet';
import { StarRating } from '@/components/ui/media';
import { Avatar, Chip, OutlineButton } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { DarkScreenGradient, Fonts, OnImage, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import { arenaByKey, ME_ID, type ArenaKey } from '@/data/mock';
import { rankByInterest } from '@/lib/feed-rank';
import { formatCount, useMe, useStore, type RankedEntry } from '@/store/app-store';

const topicOf = (e: { arenaKey: ArenaKey }) => `arena:${e.arenaKey}`;

/**
 * Arenalar sekmesi: takip edilen arenaların gönderileri tam ekran, dikey kaydırmalı.
 * Sıra kullanıcının en çok izlediği arenalara göre ağırlıklıdır; kaydırırken puan verilir.
 */
export default function Arenalar() {
  const store = useStore();
  const insets = useSafeAreaInsets();
  const joined = store.joinedArenas;
  const [filter, setFilter] = useState<ArenaKey | 'all'>('all');

  const { rankedEntries, refreshArenas } = store;
  // Sekmeye her gelişte gerçek sıralama ve oylar tazelensin
  useFocusEffect(
    useCallback(() => {
      refreshArenas();
    }, [refreshArenas]),
  );
  const allEntries = useMemo(() => joined.flatMap((k) => rankedEntries(k)), [joined, rankedEntries]);

  // Sıra yalnızca açılışta ve filtre değişince hesaplanır; oy verince ya da izledikçe
  // içerik yer değiştirip kullanıcının elinden kaçmasın.
  const computeOrder = (f: ArenaKey | 'all') =>
    rankByInterest(
      allEntries.filter((e) => f === 'all' || e.arenaKey === f),
      {
        idOf: (e) => e.id,
        topicOf,
        interests: store.state.interests,
        seen: store.state.seenReels,
        seed: Math.floor(Math.random() * 1e9),
        // Yüksek puanlı gönderiler biraz daha öne
        boost: (e) => 0.7 + (e.average || 3) / 5,
      },
    ).map((e) => e.id);
  const [order, setOrder] = useState<string[]>(() => computeOrder('all'));

  const byId = useMemo(() => new Map(allEntries.map((e) => [e.id, e])), [allEntries]);
  const items = useMemo(() => {
    const inFilter = (e: RankedEntry) => filter === 'all' || e.arenaKey === filter;
    const ordered = order.map((id) => byId.get(id)).filter((e): e is RankedEntry => !!e && inFilter(e));
    // Sonradan katılınan arenaların gönderileri sona eklenir
    const extra = allEntries.filter((e) => inFilter(e) && !order.includes(e.id));
    return [...ordered, ...extra];
  }, [order, byId, allEntries, filter]);

  const pickFilter = (f: ArenaKey | 'all') => {
    setFilter(f);
    setOrder(computeOrder(f));
  };

  const overlay = (
    <View style={{ paddingTop: insets.top + 6 }}>
      <View style={styles.topRow}>
        <VText variant="title" style={styles.shadow}>
          Arenalar
        </VText>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={() => router.push(`/olustur${filter === 'all' ? '' : `?arena=${filter}`}` as Href)} accessibilityLabel="Arenaya gönderi paylaş">
          <PlusSquare size={24} color="#fff" />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => router.push('/arena-merkezi' as Href)} accessibilityLabel="Arena Merkezi">
          <Trophy size={24} color={OnImage.gold} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => router.push('/arena-listesi' as Href)} accessibilityLabel="Takip ettiğin arenalar">
          <SlidersHorizontal size={22} color="#fff" />
        </Pressable>
      </View>
      {joined.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="Tümü" active={filter === 'all'} onPress={() => pickFilter('all')} />
          {joined.map((k) => (
            <Chip key={k} label={arenaByKey(k).name} active={filter === k} onPress={() => pickFilter(k)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  if (!joined.length || !items.length) {
    return (
      <OnDark>
      <View style={{ flex: 1 }}>
        <LinearGradient colors={DarkScreenGradient} style={StyleSheet.absoluteFill} />
        {overlay}
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.screen }}>
          <EmptyState
            icon={<Trophy size={44} color={OnImage.gold} />}
            title={joined.length ? 'Bu arenada henüz gönderi yok' : 'Henüz bir arena takip etmiyorsun'}
            text={
              joined.length
                ? 'İlk paylaşan sen ol, topluluk puanlasın.'
                : 'Takip ettiğin arenaların gönderileri burada tam ekran akar. Hemen birkaç arenaya katıl.'
            }
            action={
              <OutlineButton
                label={joined.length ? 'Gönderi Paylaş' : 'Arenaları Keşfet'}
                onPress={() =>
                  router.push((joined.length ? `/olustur${filter === 'all' ? '' : `?arena=${filter}`}` : '/arena-listesi') as Href)
                }
              />
            }
          />
        </View>
      </View>
      </OnDark>
    );
  }

  return (
    <ReelPager
      data={items}
      keyOf={(e) => e.id}
      overlay={overlay}
      onDwell={(e, secs) => store.addInterest(topicOf(e), secs, e.id)}
      renderItem={(e) => <EntryReel entry={e} bottom={TabBarHeight + Math.max(insets.bottom, 10) + 12} />}
    />
  );
}

function EntryReel({ entry, bottom }: { entry: RankedEntry; bottom: number }) {
  const store = useStore();
  const me = useMe();
  const arena = arenaByKey(entry.arenaKey);
  const isMine = entry.authorId === ME_ID;
  const author = isMine ? me : store.userOf(entry.authorId);
  const [message, setMessage] = useState<string | null>(null);

  const [voting, setVoting] = useState(false);
  const vote = async (score: number) => {
    if (voting) return;
    setVoting(true);
    const res = await store.vote(entry, score);
    setVoting(false);
    if (!res.ok) {
      setMessage(res.error ?? 'Oy verilemedi.');
      return;
    }
    // Puan vermek güçlü bir ilgi işaretidir
    store.addInterest(topicOf(entry), 8, entry.id);
    setMessage(`${score} yıldız verdin. Teşekkürler!`);
  };

  const [sendPayload, setSendPayload] = useState<SendPayload | null>(null);
  const send = () =>
    setSendPayload({
      title: `${author.name} — "${entry.title}" · ${arena.name} Arenası (VOPILA)`,
      link: `vopila://arena/giris/${entry.id}`,
    });

  return (
    <View style={{ flex: 1 }}>
      <Image source={{ uri: entry.image || arena.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'transparent', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.22, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Sağ sütun */}
      <View style={[styles.side, { bottom: bottom + 120 }]}>
        <ReelAction icon={<Send size={22} color="#fff" />} label="Gönder" onPress={send} />
        <ReelAction
          icon={<Info size={22} color="#fff" />}
          label="Detay"
          onPress={() => router.push(`/arena/giris/${entry.id}` as Href)}
        />
        <ReelAction
          icon={<Trophy size={22} color={OnImage.gold} />}
          label={entry.qualified ? `#${entry.rank}` : 'Sıra'}
          onPress={() => router.push(`/liderlik?arena=${entry.arenaKey}` as Href)}
        />
      </View>

      {/* Alt bilgi + puanlama */}
      <View style={[styles.bottom, { paddingBottom: bottom }]}>
        <Pressable onPress={() => router.push(`/arena/${entry.arenaKey}` as Href)} style={styles.arenaChip}>
          <Trophy size={13} color={OnImage.gold} />
          <VText variant="caption" color={OnImage.gold} style={{ fontFamily: Fonts.semibold }}>
            {arena.name} Arenası
          </VText>
        </Pressable>

        <Pressable
          style={styles.authorRow}
          onPress={() => router.push((isMine ? '/profil' : `/kullanici/${entry.authorId}`) as Href)}>
          <Avatar uri={author.avatar} size={34} />
          <VText variant="bodyBold" color="#fff" style={styles.shadow} numberOfLines={1}>
            {isMine ? 'Sen' : author.name}
          </VText>
          {author.verified ? <BadgeCheck size={15} color="#fff" fill={OnImage.accent} /> : null}
        </Pressable>

        <VText variant="heading" color="#fff" style={[styles.shadow, { marginTop: 6 }]} numberOfLines={2}>
          {entry.title}
        </VText>
        <View style={styles.stats}>
          <Star size={14} color={OnImage.gold} fill={OnImage.gold} />
          <VText variant="caption" color="#fff">
            {entry.votes ? entry.average.toFixed(1) : '—'} · {formatCount(entry.votes)} oy
          </VText>
        </View>

        <View style={styles.rateBox}>
          {isMine ? (
            <VText variant="caption" color={OnImage.textSecondary}>
              Bu senin gönderin. Diğer kâşifler puanlıyor.
            </VText>
          ) : entry.myVote ? (
            <View style={styles.rateRow}>
              <VText variant="label" color="#fff">
                Puanın
              </VText>
              <StarRating value={entry.myVote} size={22} disabled />
            </View>
          ) : (
            <View style={styles.rateRow}>
              <VText variant="label" color="#fff">
                Puan ver
              </VText>
              <StarRating onChange={vote} size={30} />
            </View>
          )}
          {message ? (
            <VText variant="caption" color={OnImage.accent} style={{ marginTop: 4 }}>
              {message}
            </VText>
          ) : null}
        </View>
      </View>
      <SendSheet payload={sendPayload} onClose={() => setSendPayload(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: Spacing.screen },
  chips: { gap: 8, paddingHorizontal: Spacing.screen, paddingVertical: 10 },
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 6 },
  side: { position: 'absolute', right: 12, gap: 18, alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 72, bottom: 0, paddingHorizontal: Spacing.screen },
  arenaChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,182,66,0.6)',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  rateBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
  },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
