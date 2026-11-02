/** Gönderiyi düzenle (Instagram gibi): açıklama, konum ve etiketlenen kişiler. Fotoğraflar değiştirilemez. */
import { router, useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { TagPeople } from '@/components/tag-people';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { ME_ID, type User } from '@/data/mock';
import { editPost, setPostTags } from '@/lib/posts-api';
import { useStore } from '@/store/app-store';

export default function GonderiDuzenle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  const post = store.getPost(String(id));

  const [caption, setCaption] = useState(post?.caption ?? '');
  const [location, setLocation] = useState(post?.location ?? '');
  const [tags, setTags] = useState<User[]>(() => (post?.tagged ?? []).map((u) => store.userOf(u)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!post || post.authorId !== ME_ID || !post.remote) {
    return (
      <SubScreen title="Gönderiyi Düzenle">
        <VText style={{ textAlign: 'center', marginTop: 40 }}>Bu gönderiyi düzenleyemezsin.</VText>
      </SubScreen>
    );
  }

  const save = async () => {
    if (saving) return;
    if (!caption.trim()) {
      setError('Açıklama boş olamaz.');
      return;
    }
    setSaving(true);
    setError(null);
    const before = (post.tagged ?? []).filter((t) => t !== ME_ID);
    const after = tags.map((u) => u.id);
    const changedText = caption.trim() !== post.caption || location.trim() !== post.location;
    if (changedText) {
      const res = await editPost(post.id, caption.trim(), location.trim());
      if (!res.ok) {
        setSaving(false);
        setError(res.error);
        return;
      }
    }
    const tagRes = await setPostTags(post.id, before, after);
    setSaving(false);
    store.patchPost(post.id, {
      caption: caption.trim(),
      location: location.trim(),
      edited: post.edited || changedText,
      tagged: tagRes.ok ? after : post.tagged,
    });
    if (!tagRes.ok) {
      setError(tagRes.error);
      return;
    }
    router.back();
  };

  return (
    <SubScreen
      title="Gönderiyi Düzenle"
      right={
        <Pressable onPress={save} hitSlop={8} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.cyan} />
          ) : (
            <VText variant="label" color={Colors.cyan} style={{ fontFamily: Fonts.bold }}>
              Bitti
            </VText>
          )}
        </Pressable>
      }>
      <View style={styles.pad}>
        <VText variant="label" style={styles.label}>
          Açıklama
        </VText>
        <TextInput
          value={caption}
          onChangeText={(t) => {
            setCaption(t);
            setError(null);
          }}
          multiline
          maxLength={500}
          placeholder="Açıklama yaz…"
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]}
        />
        <VText variant="caption" style={{ alignSelf: 'flex-end', marginTop: 4 }}>
          {caption.length}/500
        </VText>

        <VText variant="label" style={styles.label}>
          Konum
        </VText>
        <View style={styles.inputRow}>
          <MapPin size={18} color={Colors.cyan} />
          <TextInput
            value={location}
            onChangeText={setLocation}
            maxLength={80}
            placeholder="Konum ekle"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.inputFlat]}
          />
        </View>

        <VText variant="label" style={styles.label}>
          Etiketlenen kişiler
        </VText>
        <TagPeople value={tags} onChange={setTags} />

        {error ? (
          <VText variant="label" color={Colors.live} style={{ marginTop: Spacing.md }}>
            {error}
          </VText>
        ) : null}
        <VText variant="caption" style={{ marginTop: Spacing.lg }}>
          Düzenlenen gönderilerde saat bilgisinin yanında “düzenlendi” yazar. Fotoğraf ve videolar değiştirilemez.
        </VText>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, paddingBottom: 40 },
  label: { marginTop: Spacing.xl, marginBottom: 8 },
  input: {
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  inputFlat: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingLeft: 0 },
});
