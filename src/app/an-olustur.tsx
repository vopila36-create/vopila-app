/** An paylaş: 24 saat görünen fotoğraf / kısa video (en fazla 5). */
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Camera, Clock, ImagePlus, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MediaView } from '@/components/ui/media';
import { Chip, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { Media } from '@/data/mock';
import { useStore } from '@/store/app-store';
import { takePendingMedia } from '@/store/capture-bridge';

const MAX_ITEMS = 5;

export default function AnOlustur() {
  const store = useStore();
  const [media, setMedia] = useState<Media[]>([]);
  const [title, setTitle] = useState('');
  const [closeFriends, setCloseFriends] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Kameradan gelen medya
  useFocusEffect(
    useCallback(() => {
      const incoming = takePendingMedia();
      if (incoming.length) setMedia((m) => [...m, ...incoming].slice(0, MAX_ITEMS));
    }, []),
  );

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Galeriye erişim izni gerekli.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_ITEMS - media.length,
        quality: 0.85,
        videoMaxDuration: 15,
      });
      if (!res.canceled)
        setMedia((m) =>
          [...m, ...res.assets.map((a) => ({ type: a.type === 'video' ? 'video' : 'image', uri: a.uri }) as Media)].slice(
            0,
            MAX_ITEMS,
          ),
        );
    } catch {
      setError('Galeri açılamadı.');
    }
  };

  const publish = async () => {
    if (!media.length || sending) {
      setError('En az bir fotoğraf ya da video seç.');
      return;
    }
    setSending(true);
    setError(null);
    const res = await store.createMoment(media, title.trim(), closeFriends);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? 'An paylaşılamadı.');
      return;
    }
    router.replace('/akis' as Href);
  };

  return (
    <SubScreen title="An Paylaş">
      <View style={styles.pad}>
        <View style={styles.note}>
          <Clock size={16} color={Colors.cyan} />
          <VText variant="caption" style={{ flex: 1 }}>
            Anlar 24 saat sonra kendiliğinden kaybolur. Gizli hesapsan yalnızca takipçilerin görür.
          </VText>
        </View>

        {media.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {media.map((m, i) => (
              <View key={`${m.uri}-${i}`} style={styles.preview}>
                <MediaView type={m.type} uri={m.uri} />
                <Pressable
                  style={styles.remove}
                  onPress={() => setMedia((l) => l.filter((_, j) => j !== i))}
                  hitSlop={6}
                  accessibilityLabel="Kaldır">
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            ))}
            {media.length < MAX_ITEMS ? (
              <Pressable style={[styles.preview, styles.addMore]} onPress={pick}>
                <ImagePlus size={26} color={Colors.cyan} />
              </Pressable>
            ) : null}
          </ScrollView>
        ) : (
          <GlassCard highlighted style={styles.picker}>
            <ImagePlus size={44} color={Colors.cyan} />
            <VText variant="heading" style={{ marginTop: 10 }}>
              Anını seç
            </VText>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' }}>
              <OutlineButton
                label="Kamera"
                iconLeft={<Camera size={16} color={Colors.text} />}
                onPress={() => router.push('/kamera?from=an' as Href)}
                style={{ flex: 1 }}
              />
              <PrimaryButton label="Galeri" icon={<ImagePlus size={16} color={Colors.onCyan} />} onPress={pick} style={{ flex: 1 }} />
            </View>
          </GlassCard>
        )}

        <VText variant="label" style={{ marginTop: Spacing.xl, marginBottom: 8 }}>
          Başlık (isteğe bağlı)
        </VText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Örn. Zirve yolculuğu"
          placeholderTextColor={Colors.textMuted}
          maxLength={40}
          style={styles.input}
        />

        <VText variant="label" style={{ marginTop: Spacing.xl, marginBottom: 8 }}>
          Kimler görsün?
        </VText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Herkes" active={!closeFriends} onPress={() => setCloseFriends(false)} />
          <Chip label="★ Yakın Arkadaşlar" active={closeFriends} onPress={() => setCloseFriends(true)} />
        </View>
        {closeFriends ? (
          <Pressable onPress={() => router.push('/yakin-arkadaslar' as Href)} style={{ marginTop: 8 }}>
            <VText variant="caption" color={Colors.success}>
              Yalnızca Yakın Arkadaşlar listendekiler görür. Listeyi düzenlemek için dokun.
            </VText>
          </Pressable>
        ) : null}

        {error ? (
          <VText variant="label" color={Colors.live} style={{ marginTop: 12 }}>
            {error}
          </VText>
        ) : null}

        <Pressable onPress={publish} disabled={sending} style={[styles.publish, sending && { opacity: 0.6 }]}>
          {sending ? (
            <ActivityIndicator color={Colors.onCyan} />
          ) : (
            <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
              Anı Paylaş
            </VText>
          )}
        </Pressable>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg },
  picker: { alignItems: 'center', padding: 24 },
  preview: {
    width: 110,
    height: 190,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addMore: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: Colors.borderStrong },
  remove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  publish: {
    marginTop: Spacing.xl,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
