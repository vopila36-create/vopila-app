import { router, type Href } from 'expo-router';
import {
  BadgeCheck,
  Bookmark,
  Flag,
  Heart,
  Link2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trophy,
} from 'lucide-react-native';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,

  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ReportSheet, type ReportTarget } from '@/components/report-sheet';
import { RichText } from '@/components/rich-text';
import { SendSheet, type SendPayload } from '@/components/send-sheet';
import { MediaView } from '@/components/ui/media';
import { Avatar, GlassCard } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { arenaByKey, ME_ID, type Post } from '@/data/mock';
import { formatCount, useMe, useStore } from '@/store/app-store';

/** Akış ve gönderi detayında kullanılan gönderi kartı. */
export function PostCard({ post, detail }: { post: Post; detail?: boolean }) {
  const store = useStore();
  const me = useMe();
  const author = post.authorId === ME_ID ? me : store.userOf(post.authorId);
  const liked = store.isLiked(post.id);
  const saved = store.isSaved(post.id);
  const commentCount = store.commentCount(post);

  const [page, setPage] = useState(0);
  const [width, setWidth] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const openAuthor = () =>
    router.push((post.authorId === ME_ID ? '/profil' : `/kullanici/${post.authorId}`) as Href);
  const openDetail = () => {
    if (!detail) router.push(`/gonderi/${post.id}` as Href);
  };

  // Uçak simgesi: arkadaşına mesajla gönder (ya da diğer uygulamalarla paylaş)
  const [sendPayload, setSendPayload] = useState<SendPayload | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const share = () =>
    setSendPayload({
      postId: post.id,
      title: `${author.name} VOPILA'da paylaştı: "${post.caption}"`,
      link: `vopila://gonderi/${post.id}`,
    });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const flash = (text: string) => {
    setMenuOpen(false);
    setFeedback(text);
    setTimeout(() => setFeedback(null), 2500);
  };

  return (
    <GlassCard style={{ padding: 12 }}>
      <View style={styles.head}>
        <Pressable onPress={openAuthor} style={styles.authorRow}>
          <Avatar uri={author.avatar} size={42} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <VText variant="bodyBold" numberOfLines={1}>
                {author.name}
              </VText>
              {author.verified ? <BadgeCheck size={16} color="#fff" fill={Colors.cyan} /> : null}
            </View>
            <VText variant="caption" numberOfLines={1}>
              {post.location}
            </VText>
          </View>
        </Pressable>
        <VText variant="caption">{post.time}</VText>
        <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={10} accessibilityLabel="Seçenekler">
          <MoreHorizontal size={20} color={Colors.text} />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.menu}>
          <MenuItem
            icon={<Bookmark size={16} color={Colors.text} />}
            label={saved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}
            onPress={() => {
              store.toggleSave(post.id);
              flash(saved ? 'Kaydedilenlerden çıkarıldı.' : 'Kaydedilenlere eklendi.');
            }}
          />
          <MenuItem
            icon={<Link2 size={16} color={Colors.text} />}
            label="Arkadaşına gönder / paylaş"
            onPress={() => {
              setMenuOpen(false);
              share();
            }}
          />
          {post.authorId !== ME_ID ? (
            <MenuItem
              icon={<Flag size={16} color={Colors.live} />}
              label="Şikayet et"
              danger
              onPress={() => {
                setMenuOpen(false);
                setReportTarget({ type: 'post', id: post.id });
              }}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.media} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {post.media.length > 1 && width ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onScroll}
            onScroll={onScroll}
            scrollEventThrottle={32}>
            {post.media.map((m, i) => (
              <Pressable key={`${m.uri}-${i}`} style={{ width, height: '100%' }} onPress={openDetail}>
                <MediaView type={m.type} uri={m.uri} poster={m.poster} />
              </Pressable>
            ))}
          </ScrollView>
        ) : post.media[0]?.type === 'video' ? (
          <MediaView type="video" uri={post.media[0].uri} poster={post.media[0].poster} />
        ) : (
          <Pressable style={StyleSheet.absoluteFill} onPress={openDetail}>
            {post.media[0] ? <MediaView type="image" uri={post.media[0].uri} /> : null}
          </Pressable>
        )}
        {post.media.length > 1 ? (
          <>
            <View style={styles.counter} pointerEvents="none">
              <VText variant="caption" color="#fff">
                {page + 1}/{post.media.length}
              </VText>
            </View>
            <View style={styles.dots} pointerEvents="none">
              {post.media.map((m, i) => (
                <View key={`${m.uri}-d${i}`} style={[styles.dotItem, i === page && styles.dotOn]} />
              ))}
            </View>
          </>
        ) : null}
      </View>

      {post.arenaKey ? (
        <Pressable onPress={() => router.push(`/arena/${post.arenaKey}` as Href)} style={styles.arenaChip}>
          <Trophy size={13} color={Colors.gold} />
          <VText variant="caption" color={Colors.gold} style={{ fontFamily: Fonts.semibold }}>
            {arenaByKey(post.arenaKey).name} Arenası
          </VText>
        </Pressable>
      ) : null}

      <Pressable onPress={openDetail} disabled={detail}>
        <RichText text={post.caption} style={{ marginTop: 10 }} numberOfLines={detail ? undefined : 3} />
      </Pressable>

      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={() => store.toggleLike(post.id)} hitSlop={6} accessibilityLabel="Beğen">
          <Heart size={22} color={liked ? Colors.heart : Colors.text} fill={liked ? Colors.heart : 'transparent'} />
          <VText variant="label">{formatCount(store.likeCount(post))}</VText>
        </Pressable>
        <Pressable style={styles.action} onPress={openDetail} hitSlop={6} accessibilityLabel="Yorumlar">
          <MessageCircle size={21} color={Colors.text} />
          <VText variant="label">{commentCount}</VText>
        </Pressable>
        <Pressable onPress={share} hitSlop={6} accessibilityLabel="Paylaş">
          <Send size={20} color={Colors.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => store.toggleSave(post.id)} hitSlop={6} accessibilityLabel="Kaydet">
          <Bookmark size={21} color={saved ? Colors.cyan : Colors.text} fill={saved ? Colors.cyan : 'transparent'} />
        </Pressable>
      </View>

      {feedback ? (
        <View style={styles.feedback}>
          <VText variant="caption" color={Colors.cyan}>
            {feedback}
          </VText>
        </View>
      ) : null}
      <SendSheet payload={sendPayload} onClose={() => setSendPayload(null)} />
      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
    </GlassCard>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}>
      {icon}
      <VText variant="label" color={danger ? Colors.live : Colors.text}>
        {label}
      </VText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  authorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  menu: {
    marginBottom: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    paddingVertical: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  media: { height: 260, borderRadius: Radius.md, overflow: 'hidden', backgroundColor: Colors.surfaceStrong },
  counter: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  dots: { position: 'absolute', bottom: 10, alignSelf: 'center', flexDirection: 'row', gap: 5 },
  dotItem: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotOn: { backgroundColor: Colors.cyan, width: 16 },
  arenaChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,182,66,0.5)',
    backgroundColor: Colors.goldSoft,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 12 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  feedback: {
    marginTop: 10,
    padding: 8,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanDim,
  },
});
