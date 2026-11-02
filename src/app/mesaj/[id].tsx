/**
 * Sohbet ekranı: mesaj balonları, paylaşılan gönderi kartları, canlı yeni mesajlar.
 * Mesajları yalnızca sohbetin iki üyesi görür (sunucu kuralı).
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { BadgeCheck, ImageOff, ImagePlus, PlayCircle, Send } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DmMediaBubble, VoiceRecorder } from '@/components/dm-media';
import { Avatar } from '@/components/ui/primitives';
import { Screen } from '@/components/ui/screen';
import { SubHeader } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Post } from '@/data/mock';
import {
  chatTime,
  fetchConversationPeer,
  fetchMessages,
  markRead,
  sendMediaMessage,
  sendMessage,
  subscribeToConversation,
  type Message,
} from '@/lib/messages-api';
import { fetchPosts } from '@/lib/posts-api';
import { useStore } from '@/store/app-store';

type Peer = { id: string; username: string; name: string; avatar: string; verified: boolean };

export default function Sohbet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const cid = String(id);
  const { myId, refreshInbox } = useStore();
  const insets = useSafeAreaInsets();

  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [posts, setPosts] = useState<Record<string, Post | null>>({});
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  /** Fotoğraf/video yüklenirken yüzde (0–100); yükleme yoksa null */
  const [upload, setUpload] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const [recording, setRecording] = useState(false);

  // Paylaşılan gönderileri (görme yetkim varsa) getir
  const loadPosts = useCallback(
    async (list: Message[]) => {
      if (!myId) return;
      const ids = Array.from(new Set(list.map((m) => m.postId).filter((x): x is string => !!x)));
      if (!ids.length) return;
      const res = await fetchPosts(myId, { ids });
      const found: Record<string, Post | null> = {};
      for (const pid of ids) found[pid] = null;
      if (res.ok) for (const p of res.data.posts) found[p.id] = p;
      setPosts((prev) => ({ ...prev, ...found }));
    },
    [myId],
  );

  const addIncoming = useCallback(
    (m: Message) => {
      setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
      if (m.postId) loadPosts([m]);
      if (m.senderId !== myId) markRead(cid);
    },
    [cid, myId, loadPosts],
  );

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    Promise.all([fetchConversationPeer(cid, myId), fetchMessages(cid)]).then(([p, m]) => {
      if (cancelled) return;
      if (p.ok) setPeer(p.data);
      if (m.ok) {
        setMessages(m.data);
        setNoMore(m.data.length < 40);
        loadPosts(m.data);
      } else setError(m.error);
      markRead(cid).then(() => refreshInbox());
    });
    const stop = subscribeToConversation(cid, (msg) => {
      if (!cancelled) addIncoming(msg);
    });
    return () => {
      cancelled = true;
      stop();
      // Çıkarken okunmamış rozeti tazelensin
      refreshInbox();
    };
  }, [cid, myId, loadPosts, addIncoming, refreshInbox]);

  const loadOlder = async () => {
    if (loadingOlder || noMore || !messages?.length) return;
    setLoadingOlder(true);
    const res = await fetchMessages(cid, messages[0].createdAt);
    setLoadingOlder(false);
    if (!res.ok) return;
    if (res.data.length < 40) setNoMore(true);
    setMessages((list) => [...res.data, ...(list ?? [])]);
    loadPosts(res.data);
  };

  const send = async () => {
    const t = text.trim();
    if (!t || sending || !myId) return;
    setSending(true);
    setError(null);
    const res = await sendMessage(myId, cid, { text: t });
    setSending(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setText('');
    addIncoming(res.data);
  };

  // Fotoğraf / video gönder
  const pickMedia = async () => {
    if (!myId || sending) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
        videoMaxDuration: 60,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setSending(true);
      setUpload(0);
      setError(null);
      const r = await sendMediaMessage(
        myId,
        cid,
        { uri: a.uri, kind: a.type === 'video' ? 'video' : 'image', mimeType: a.mimeType },
        (f) => setUpload(Math.round(f * 100)),
      );
      setSending(false);
      setUpload(null);
      if (!r.ok) setError(r.error);
      else addIncoming(r.data);
    } catch {
      setSending(false);
      setUpload(null);
      setError('Galeri açılamadı. Fotoğraflara erişim izni vermen gerekebilir.');
    }
  };

  // Sesli mesaj gönder
  const sendVoice = async (uri: string, durationMs: number) => {
    if (!myId) return;
    setError(null);
    const r = await sendMediaMessage(myId, cid, { uri, kind: 'audio', durationMs });
    if (!r.ok) setError(r.error);
    else addIncoming(r.data);
  };

  // Ters liste: en yeni mesaj altta
  const data = useMemo(() => [...(messages ?? [])].reverse(), [messages]);

  const header = (
    <SubHeader
      title={peer?.name ?? 'Sohbet'}
      right={
        peer ? (
          <Pressable onPress={() => router.push(`/kullanici/${peer.id}` as Href)} hitSlop={8} accessibilityLabel="Profili aç">
            <Avatar uri={peer.avatar} size={34} />
          </Pressable>
        ) : null
      }
    />
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={header} scroll={false}>
        {messages === null && !error ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
        ) : (
          <FlatList
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ paddingHorizontal: Spacing.screen, paddingVertical: 12, gap: 6 }}
            onEndReached={loadOlder}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              peer && noMore ? (
                <View style={styles.intro}>
                  <Avatar uri={peer.avatar} size={72} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <VText variant="heading">{peer.name}</VText>
                    {peer.verified ? <BadgeCheck size={16} color="#fff" fill={Colors.cyan} /> : null}
                  </View>
                  <VText variant="caption">@{peer.username} · VOPILA</VText>
                </View>
              ) : loadingOlder ? (
                <ActivityIndicator color={Colors.cyan} style={{ marginVertical: 10 }} />
              ) : undefined
            }
            renderItem={({ item: m, index }) => {
              const mine = m.senderId === myId;
              // Bir önceki (daha yeni) mesajla arada 15 dk'dan fazla varsa saat göster
              const newer = data[index - 1];
              const showTime =
                !newer || new Date(newer.createdAt).getTime() - new Date(m.createdAt).getTime() > 15 * 60 * 1000;
              return (
                <View>
                  <View style={[styles.bubbleRow, mine && { justifyContent: 'flex-end' }]}>
                    <View style={{ maxWidth: '78%', gap: 4 }}>
                      {m.kind === 'image' || m.kind === 'video' || m.kind === 'audio' ? (
                        <DmMediaBubble message={m} mine={mine} />
                      ) : null}
                      {m.kind === 'post' ? (
                        <SharedPost post={m.postId ? posts[m.postId] : null} pending={!!m.postId && !(m.postId in posts)} />
                      ) : null}
                      {m.text ? (
                        <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                          <VText color={mine ? Colors.onCyan : Colors.text}>{m.text}</VText>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  {showTime ? (
                    <VText variant="caption" style={[styles.time, mine && { textAlign: 'right' }]}>
                      {chatTime(m.createdAt)}
                    </VText>
                  ) : null}
                </View>
              );
            }}
          />
        )}

        {error ? (
          <VText variant="caption" color={Colors.live} style={{ paddingHorizontal: Spacing.screen }}>
            {error}
          </VText>
        ) : null}

        {upload !== null ? (
          <VText variant="caption" style={{ textAlign: 'center', paddingVertical: 4 }}>
            Gönderiliyor… %{upload}
          </VText>
        ) : null}
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {!recording ? (
            <>
              <Pressable onPress={pickMedia} disabled={sending} hitSlop={6} style={styles.attach} accessibilityLabel="Fotoğraf ya da video gönder">
                <ImagePlus size={22} color={Colors.cyan} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Mesaj yaz…"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                multiline
                maxLength={1000}
              />
            </>
          ) : null}
          {text.trim() ? (
            <Pressable
              onPress={send}
              disabled={sending}
              style={[styles.send, sending && { opacity: 0.4 }]}
              accessibilityLabel="Gönder">
              {sending ? <ActivityIndicator size="small" color={Colors.onCyan} /> : <Send size={18} color={Colors.onCyan} />}
            </Pressable>
          ) : sending ? (
            <View style={styles.send}>
              <ActivityIndicator size="small" color={Colors.onCyan} />
            </View>
          ) : (
            <VoiceRecorder onSend={sendVoice} onError={setError} onActiveChange={setRecording} />
          )}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

/** Sohbette paylaşılan gönderi kartı (dokununca gönderi açılır). */
function SharedPost({ post, pending }: { post: Post | null | undefined; pending: boolean }) {
  const store = useStore();
  if (pending) {
    return (
      <View style={[styles.shared, { padding: 16, alignItems: 'center' }]}>
        <ActivityIndicator color={Colors.cyan} />
      </View>
    );
  }
  if (!post) {
    return (
      <View style={[styles.shared, styles.sharedGone]}>
        <ImageOff size={18} color={Colors.textMuted} />
        <VText variant="caption">Bu gönderi görüntülenemiyor. Kaldırılmış ya da gizli bir hesaba ait olabilir.</VText>
      </View>
    );
  }
  const author = store.userOf(post.authorId);
  const cover = post.media[0];
  const uri = cover ? (cover.type === 'video' ? cover.poster ?? '' : cover.uri) : '';
  return (
    <Pressable style={styles.shared} onPress={() => router.push(`/gonderi/${post.id}` as Href)}>
      <View style={styles.sharedHead}>
        <Avatar uri={author.avatar} size={24} />
        <VText variant="label" numberOfLines={1} style={{ flex: 1, fontSize: 12.5 }}>
          {author.name}
        </VText>
      </View>
      <View style={styles.sharedMedia}>
        {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        {cover?.type === 'video' ? (
          <View style={styles.play}>
            <PlayCircle size={34} color="#fff" />
          </View>
        ) : null}
      </View>
      {post.caption ? (
        <VText variant="caption" color={Colors.text} numberOfLines={2} style={{ padding: 8 }}>
          {post.caption}
        </VText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 6, paddingVertical: 24 },
  bubbleRow: { flexDirection: 'row' },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  mine: { backgroundColor: Colors.cyan, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: Colors.surfaceRaised, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 6 },
  time: { fontSize: 10.5, marginTop: 2, marginHorizontal: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: Spacing.screen,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  attach: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  send: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shared: {
    width: 230,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  sharedGone: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  sharedHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8 },
  sharedMedia: { height: 230, backgroundColor: Colors.surface },
  play: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
