import { router, useLocalSearchParams, type Href } from 'expo-router';
import { FileQuestion, MessageCircle, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PostCard } from '@/components/post-card';
import { ReportSheet, type ReportTarget } from '@/components/report-sheet';
import { RichText } from '@/components/rich-text';
import { Avatar, GlassCard, OutlineButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ME_ID, type Comment } from '@/data/mock';
import { deleteComment } from '@/lib/settings-api';
import { useMe, useStore } from '@/store/app-store';

export default function GonderiDetay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const me = useMe();
  const post = store.getPost(String(id));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);

  // Akışta yoksa (ör. mesajla gelen) gönderiyi sunucudan getir, sonra yorumlarını yükle
  const { loadComments, loadPost } = store;
  const [lookup, setLookup] = useState<'loading' | 'done'>('loading');
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadPost(String(id)).then(() => {
      if (cancelled) return;
      setLookup('done');
      loadComments(String(id));
    });
    return () => {
      cancelled = true;
    };
  }, [id, loadComments, loadPost]);

  if (!post && lookup === 'loading') {
    return (
      <SubScreen title="Gönderi">
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </SubScreen>
    );
  }

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
  // Ana yorumlar ve altlarındaki yanıtlar (tek seviye, Instagram gibi)
  const topLevel = comments.filter((c) => !c.parentId || !comments.some((p) => p.id === c.parentId));
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  const send = async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setError(null);
    const res = await store.addComment(post.id, t, replyTo?.id);
    setSending(false);
    if (res.ok) {
      setText('');
      setReplyTo(null);
    } else setError(res.error ?? 'Yorum gönderilemedi.');
  };

  // Kendi yorumunu ya da kendi gönderindeki herhangi bir yorumu silebilirsin
  const removeComment = async (commentId: string) => {
    const res = await deleteComment(commentId);
    if (!res.ok) setError(res.error);
    else loadComments(post.id);
  };

  const startReply = (c: Comment) => {
    const author = c.authorId === ME_ID ? me : store.userOf(c.authorId);
    setReplyTo({ id: c.id, name: author.name });
    setText(c.authorId === ME_ID ? '' : `@${author.username} `);
  };

  const renderComment = (c: Comment, reply = false) => {
    const author = c.authorId === ME_ID ? me : store.userOf(c.authorId);
    return (
      <View key={c.id} style={[styles.comment, reply && { marginLeft: 46 }]}>
        <Pressable onPress={() => router.push((c.authorId === ME_ID ? '/profil' : `/kullanici/${c.authorId}`) as Href)}>
          <Avatar uri={author.avatar} size={reply ? 28 : 36} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={styles.bubble}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <VText variant="label" style={{ fontFamily: Fonts.bold }}>
                {author.name}
              </VText>
              <VText variant="caption">{c.time}</VText>
            </View>
            <RichText text={c.text} style={{ marginTop: 2 }} />
          </View>
          <View style={styles.commentActions}>
            <Pressable onPress={() => startReply(c)} hitSlop={6}>
              <VText variant="caption" color={Colors.textSecondary} style={{ fontFamily: Fonts.semibold }}>
                Yanıtla
              </VText>
            </Pressable>
            {post.remote && (c.authorId === ME_ID || post.authorId === ME_ID) ? (
              <Pressable onPress={() => removeComment(c.id)} hitSlop={6}>
                <VText variant="caption" color={Colors.live}>
                  Sil
                </VText>
              </Pressable>
            ) : null}
            {c.authorId !== ME_ID ? (
              <Pressable onPress={() => setReportTarget({ type: 'comment', id: c.id })} hitSlop={6}>
                <VText variant="caption" color={Colors.textMuted}>
                  Şikayet et
                </VText>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SubScreen title="Gönderi">
        <View style={styles.pad}>
          <PostCard post={post} detail />

          <VText variant="heading" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
            Yorumlar ({comments.length})
          </VText>

          {replyTo ? (
            <View style={styles.replyBar}>
              <VText variant="caption" style={{ flex: 1 }}>
                {replyTo.name} kişisine yanıt veriyorsun
              </VText>
              <Pressable
                onPress={() => {
                  setReplyTo(null);
                  setText('');
                }}
                hitSlop={8}>
                <VText variant="caption" color={Colors.cyan}>
                  Vazgeç
                </VText>
              </Pressable>
            </View>
          ) : null}
          <GlassCard style={styles.inputCard}>
            <Avatar uri={me.avatar} size={34} />
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? 'Yanıtını yaz…' : 'Bir yorum yaz…'}
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              onSubmitEditing={send}
              returnKeyType="send"
              maxLength={300}
            />
            <Pressable
              onPress={send}
              disabled={!text.trim() || sending}
              style={[styles.send, (!text.trim() || sending) && { opacity: 0.4 }]}
              accessibilityLabel="Gönder">
              {sending ? <ActivityIndicator size="small" color={Colors.onCyan} /> : <Send size={18} color={Colors.onCyan} />}
            </Pressable>
          </GlassCard>
          {error ? (
            <VText variant="caption" color={Colors.live} style={{ marginTop: 6 }}>
              {error}
            </VText>
          ) : null}

          {comments.length ? (
            <View style={{ gap: 10, marginTop: Spacing.md }}>
              {topLevel.map((c) => (
                <View key={c.id} style={{ gap: 8 }}>
                  {renderComment(c)}
                  {repliesOf(c.id).map((r) => renderComment(r, true))}
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={<MessageCircle size={36} color={Colors.textMuted} />}
              title="İlk yorumu sen yap"
              text="Düşüncelerini paylaş, sohbeti başlat."
            />
          )}
        </View>
        <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
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
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 4, marginLeft: 6 },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
    borderRadius: Radius.sm,
    backgroundColor: Colors.cyanDim,
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
