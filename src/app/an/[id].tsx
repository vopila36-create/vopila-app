import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Heart, Pause, Play, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoPlayer } from '@/components/ui/media';
import { Avatar } from '@/components/ui/primitives';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, OnImage } from '@/constants/theme';
import { ME_ID, type Moment } from '@/data/mock';
import { useScreenshotGuard } from '@/lib/screen-guard';
import { deleteMoment, fetchMyMomentLikes, setMomentLike } from '@/lib/moments-api';
import { useMe, useStore } from '@/store/app-store';

const DURATION = 5000;
const VIDEO_DURATION = 15000;
const TICK = 50;

type Pos = { mi: number; ii: number; done: boolean };

/** Bir sonraki/önceki hikâye ögesinin konumu. */
function step(moments: Moment[], p: Pos, dir: 1 | -1): Pos {
  if (dir === 1) {
    if (p.ii < moments[p.mi].items.length - 1) return { ...p, ii: p.ii + 1 };
    if (p.mi < moments.length - 1) return { mi: p.mi + 1, ii: 0, done: false };
    return { ...p, done: true };
  }
  if (p.ii > 0) return { ...p, ii: p.ii - 1 };
  if (p.mi > 0) return { mi: p.mi - 1, ii: moments[p.mi - 1].items.length - 1, done: false };
  return p;
}

/** Tam ekran "Anlar" (hikâye) görüntüleyici. */
export default function AnGoruntuleyici() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const store = useStore();
  const me = useMe();
  // Açıldığı andaki liste sabit kalsın (arkada yenilenirse sıra kaymasın)
  const [moments] = useState(() => store.allMoments);

  const startIndex = Math.max(0, moments.findIndex((m) => m.id === id));
  const [pos, setPos] = useState<Pos>({ mi: startIndex, ii: 0, done: false });
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  // Beğeni sunucuda (0030): anın tamamı için tek beğeni; örnek anlarda yalnızca ekranda
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const myId = store.myId;
  useEffect(() => {
    if (!myId) return;
    let alive = true;
    const ids = moments.filter((m) => m.remote).map((m) => m.id);
    fetchMyMomentLikes(myId, ids).then((list) => {
      if (alive) setLiked((l) => ({ ...Object.fromEntries(list.map((x) => [x, true])), ...l }));
    });
    return () => {
      alive = false;
    };
  }, [myId, moments]);
  const [deleting, setDeleting] = useState(false);
  const elapsed = useRef(0);

  const momentIndex = pos.mi;
  const itemIndex = pos.ii;
  const moment = moments[momentIndex];
  const isMine = moment?.authorId === ME_ID;
  const author = isMine ? me : store.userOf(moment?.authorId ?? '');
  useScreenshotGuard(!isMine && !!author.protected);
  const following = store.isFollowing(author.id);
  const item = moment?.media?.[itemIndex] ?? { type: 'image' as const, uri: moment?.items[itemIndex] ?? '' };
  const duration = item.type === 'video' ? VIDEO_DURATION : DURATION;

  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace('/akis' as Href)), []);

  const go = useCallback(
    (dir: 1 | -1) => {
      elapsed.current = 0;
      setProgress(0);
      setPos((p) => step(moments, p, dir));
    },
    [moments],
  );

  const remove = async () => {
    if (!moment?.remote || deleting) return;
    setDeleting(true);
    setPaused(true);
    await deleteMoment(moment.id);
    await store.refreshMoments();
    close();
  };

  // Son hikâye bitince kapat
  useEffect(() => {
    if (pos.done) close();
  }, [pos.done, close]);

  // Otomatik ilerleme
  useEffect(() => {
    if (paused || pos.done) return;
    const t = setInterval(() => {
      elapsed.current += TICK;
      setProgress(Math.min(1, elapsed.current / duration));
      if (elapsed.current >= duration) {
        clearInterval(t);
        go(1);
      }
    }, TICK);
    return () => clearInterval(t);
  }, [paused, pos, go, duration]);

  const next = () => go(1);
  const prev = () => go(-1);

  if (!moment) return <View style={styles.root} />;

  const key = `${moment.id}-${itemIndex}`;

  return (
    <View style={styles.root}>
      {item.type === 'video' ? (
        <View key={key} style={StyleSheet.absoluteFill}>
          <VideoPlayer uri={item.uri} autoPlay loop={false} controls={false} />
        </View>
      ) : (
        <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      )}
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={styles.topShade} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.bottomShade} />
      <OnDark>

      {/* Dokunma alanları */}
      <View style={StyleSheet.absoluteFill}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Pressable style={{ flex: 1 }} onPress={prev} accessibilityLabel="Önceki" />
          <Pressable style={{ flex: 1.4 }} onPress={next} accessibilityLabel="Sonraki" />
        </View>
      </View>

      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.bars}>
          {moment.items.map((it, i) => (
            <View key={`${it}-${i}`} style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(i < itemIndex ? 1 : i === itemIndex ? progress : 0) * 100}%` },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <Pressable
            style={styles.author}
            onPress={() => router.push((isMine ? '/profil' : `/kullanici/${author.id}`) as Href)}>
            <Avatar uri={author.avatar} size={38} ring />
            <View>
              <VText variant="bodyBold">{author.name}</VText>
              <VText variant="caption" color="rgba(255,255,255,0.8)">
                {moment.closeFriends ? '★ Yakın Arkadaşlar · ' : ''}
                {moment.title}
              </VText>
            </View>
          </Pressable>
          <Pressable onPress={() => setPaused((p) => !p)} hitSlop={10} accessibilityLabel={paused ? 'Devam et' : 'Duraklat'}>
            {paused ? <Play size={24} color="#fff" /> : <Pause size={24} color="#fff" />}
          </Pressable>
          <Pressable onPress={close} hitSlop={10} accessibilityLabel="Kapat">
            <X size={28} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {isMine ? (
          moment.remote ? (
            <Pressable onPress={remove} style={[styles.follow, styles.following]}>
              <VText variant="label" color={OnImage.text}>
                {deleting ? 'Siliniyor…' : 'Anı sil'}
              </VText>
            </Pressable>
          ) : null
        ) : (
          <Pressable
            onPress={() => store.toggleFollow(author.id)}
            style={[styles.follow, following && styles.following]}>
            <VText variant="label" color={following ? OnImage.text : Colors.onCyan}>
              {following ? 'Takip ediliyor' : 'Takip Et'}
            </VText>
          </Pressable>
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={async () => {
            const on = !liked[moment.id];
            setLiked((l) => ({ ...l, [moment.id]: on }));
            if (moment.remote && myId) {
              const r = await setMomentLike(myId, moment.id, on);
              if (!r.ok) setLiked((l) => ({ ...l, [moment.id]: !on }));
            }
          }}
          hitSlop={10}
          accessibilityLabel="Beğen">
          <Heart size={30} color={liked[moment.id] ? Colors.heart : '#fff'} fill={liked[moment.id] ? Colors.heart : 'transparent'} />
        </Pressable>
      </View>
      </OnDark>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 160 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 12 },
  bars: { flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  barFill: { height: 3, backgroundColor: Colors.cyan },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  follow: {
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  following: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
});
