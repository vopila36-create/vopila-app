import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronLeft, Eye, Heart, Radio, Send } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VideoPlayer } from '@/components/ui/media';
import { Avatar, OutlineButton } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius } from '@/constants/theme';
import { liveChat, liveStreams, ME_ID, userById } from '@/data/mock';
import { formatCount, useMe, useStore } from '@/store/app-store';

type ChatMsg = { id: string; authorId: string; text: string };

export default function CanliIzle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stream = liveStreams.find((s) => s.id === id);
  const insets = useSafeAreaInsets();
  const { isFollowing, toggleFollow } = useStore();
  const meUser = useMe();
  const [messages, setMessages] = useState<ChatMsg[]>(() =>
    liveChat.map((m, i) => ({ id: `seed${i}`, ...m })),
  );
  const [text, setText] = useState('');
  const [hearts, setHearts] = useState(0);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/canli' as Href));

  if (!stream) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
        <EmptyState
          icon={<Radio size={44} color={Colors.textMuted} />}
          title="Yayın sona erdi"
          text="Bu canlı yayın artık devam etmiyor."
          action={<OutlineButton label="Canlı yayınlara dön" onPress={() => router.replace('/canli' as Href)} />}
        />
      </View>
    );
  }

  const host = userById(stream.hostId);
  const following = isFollowing(host.id);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { id: `m${Date.now()}`, authorId: ME_ID, text: t }]);
    setText('');
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>
        <VideoPlayer uri={stream.video} autoPlay loop controls={false} />
      </View>
      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={[styles.shade, { top: 0, height: 160 }]} pointerEvents="none" />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={[styles.shade, { bottom: 0, height: 360 }]} pointerEvents="none" />
      <OnDark>

      {/* Üst bar */}
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={goBack} style={styles.round} hitSlop={8} accessibilityLabel="Geri">
          <ChevronLeft size={24} color="#fff" />
        </Pressable>
        <Pressable style={styles.host} onPress={() => router.push(`/kullanici/${host.id}` as Href)}>
          <Avatar uri={host.avatar} size={34} ring />
          <View style={{ flexShrink: 1 }}>
            <VText variant="label" numberOfLines={1}>
              {host.name}
            </VText>
            <VText variant="caption" color={OnImage.textSecondary} numberOfLines={1}>
              {stream.title}
            </VText>
          </View>
        </Pressable>
        <Pressable
          onPress={() => toggleFollow(host.id)}
          style={[styles.follow, following && styles.following]}
          hitSlop={6}>
          <VText variant="label" color={following ? OnImage.text : Colors.onCyan} style={{ fontFamily: Fonts.bold, fontSize: 12 }}>
            {following ? 'Takipte' : 'Takip Et'}
          </VText>
        </Pressable>
      </View>
      <View style={[styles.badges, { top: insets.top + 64 }]}>
        <View style={styles.liveTag}>
          <View style={styles.liveDot} />
          <VText style={styles.liveText}>CANLI</VText>
        </View>
        <View style={styles.viewers}>
          <Eye size={13} color="#fff" />
          <VText variant="caption" color="#fff">
            {formatCount(stream.viewers + 1)}
          </VText>
        </View>
      </View>

      {/* Sohbet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <ScrollView
            style={styles.chat}
            contentContainerStyle={{ gap: 8, justifyContent: 'flex-end', flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
            ref={(r) => {
              r?.scrollToEnd({ animated: false });
            }}>
            {messages.map((m) => {
              const u = m.authorId === ME_ID ? { name: 'Sen', avatar: meUser.avatar } : userById(m.authorId);
              return (
                <View key={m.id} style={styles.msg}>
                  <Avatar uri={u.avatar} size={26} />
                  <View style={{ flexShrink: 1 }}>
                    <VText variant="caption" color={OnImage.accent}>
                      {u.name}
                    </VText>
                    <VText variant="body" color="#fff" style={{ fontSize: 13 }}>
                      {m.text}
                    </VText>
                  </View>
                </View>
              );
            })}
          </ScrollView>
          <Pressable onPress={() => setHearts((h) => h + 1)} style={styles.heartBtn} accessibilityLabel="Beğen">
            <Heart size={26} color={Colors.heart} fill={Colors.heart} />
            {hearts ? (
              <VText variant="caption" color="#fff" style={{ marginTop: 2 }}>
                {hearts}
              </VText>
            ) : null}
          </Pressable>
        </View>
        <View style={styles.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Bir şeyler yaz…"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.input}
            onSubmitEditing={send}
            returnKeyType="send"
            maxLength={200}
          />
          <Pressable onPress={send} style={[styles.send, !text.trim() && { opacity: 0.5 }]} disabled={!text.trim()} accessibilityLabel="Gönder">
            <Send size={18} color={Colors.onCyan} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      </OnDark>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  shade: { position: 'absolute', left: 0, right: 0 },
  top: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  host: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  follow: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  following: { backgroundColor: 'rgba(0,0,0,0.4)', borderWidth: 1, borderColor: Colors.borderStrong },
  badges: { position: 'absolute', left: 14, flexDirection: 'row', gap: 8 },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.live,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  viewers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, gap: 10 },
  chat: { flex: 1, maxHeight: 240 },
  msg: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '90%' },
  heartBtn: { alignItems: 'center', paddingBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: Radius.pill,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
