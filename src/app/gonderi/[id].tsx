import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FileQuestion, MessageCircle, Send } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { Avatar, GlassCard, OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ME_ID, userById } from '@/data/mock';
import { useMe, useStore } from '@/store/app-store';

export default function GonderiDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const me = useMe();
  const post = store.getPost(String(id));
  const [text, setText] = useState('');

  if (!post) {
    return (
      <SubScreen title="Gönderi">
        <EmptyState
          icon={<FileQuestion size={40} color={Colors.textMuted} />}
          title="Gönderi bulunamadı"
          text="Bu gönderi kaldırılmış olabilir."
          action={<OutlineButton label="Akışa Dön" onPress={() => router.navigate('/akis' as Href)} />}
        />
      </SubScreen>
    );
  }

  const comments = store.commentsFor(post);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    store.addComment(post.id, t);
    setText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubScreen title="Gönderi">
        <View style={styles.pad}>
          <PostCard post={post} detail />

          <VText variant="heading" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Yorumlar ({comments.length})
          </VText>

          <GlassCard style={styles.inputCard}>
            <Avatar uri={me.avatar} size={34} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Bir yorum yaz…"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={300}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim()}
              style={[styles.send, !text.trim() && { opacity: 0.4 }]}
              accessibilityLabel="Gönder">
              <Send size={18} color={Colors.onCyan} />
            </Pressable>
          </GlassCard>

          {comments.length ? (
            <View style={{ gap: 10, marginTop: Spacing.md }}>
              {comments.map((c) => {
                const author = c.authorId === ME_ID ? me : userById(c.authorId);
                return (
                  <View key={c.id} style={styles.comment}>
                    <Pressable
                      onPress={() =>
                        router.push((c.authorId === ME_ID ? '/profil' : `/kullanici/${c.authorId}`) as Href)
                      }>
                      <Avatar uri={author.avatar} size={36} />
                    </Pressable>
                    <View style={styles.bubble}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <VText variant="label" style={{ fontFamily: Fonts.bold }}>
                          {author.name}
                        </VText>
                        <VText variant="caption">{c.time}</VText>
                      </View>
                      <VText color={Colors.text} style={{ marginTop: 2 }}>
                        {c.text}
                      </VText>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <EmptyState
              icon={<MessageCircle size={36} color={Colors.textMuted} />}
              title="İlk yorumu sen yap"
              text="Düşüncelerini paylaş, sohbeti başlat."
            />
          )}
        </View>
      </SubScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  inputCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingLeft: 10 },
  input: {
    flex: 1,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    paddingVertical: 8,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  comment: { flexDirection: 'row', gap: 10 },
  bubble: {
    flex: 1,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
