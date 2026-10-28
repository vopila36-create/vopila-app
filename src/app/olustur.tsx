import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { Camera, ImagePlus, MapPin, Trophy, Video, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { MediaView } from '@/components/ui/media';
import { Chip, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { arenas, type ArenaKey, type Media } from '@/data/mock';
import { useStore } from '@/store/app-store';
import { takePendingMedia } from '@/store/capture-bridge';

const MAX_MEDIA = 5;

export default function Olustur() {
  const params = useLocalSearchParams<{ arena?: string }>();
  const store = useStore();
  const initialArena = arenas.find((a) => a.key === params.arena)?.key;

  const [media, setMedia] = useState<Media[]>([]);
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [arenaKey, setArenaKey] = useState<ArenaKey | undefined>(initialArena);
  const [title, setTitle] = useState('');
  const [sensitive, setSensitive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const addAssets = (assets: ImagePicker.ImagePickerAsset[]) => {
    const picked: Media[] = assets.map((a) => ({ type: a.type === 'video' ? 'video' : 'image', uri: a.uri }));
    setMedia((m) => [...m, ...picked].slice(0, MAX_MEDIA));
    setError(null);
  };

  const pickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('Galeriye erişim izni gerekli. Ayarlardan izin verebilirsin.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_MEDIA - media.length,
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!res.canceled) addAssets(res.assets);
    } catch {
      setError('Galeri açılamadı. Lütfen tekrar dene.');
    }
  };

  /** Uygulama içi kamerayı aç; çekilen medya geri dönünce aşağıdaki odak etkisiyle eklenir. */
  const openCamera = (kind: 'images' | 'videos') => {
    router.push(`/kamera?from=olustur&mode=${kind === 'videos' ? 'video' : 'picture'}` as Href);
  };

  // Kameradan (veya kameranın galeri kısayolundan) gelen medyayı ekle
  useFocusEffect(
    useCallback(() => {
      const incoming = takePendingMedia();
      if (incoming.length) {
        setMedia((m) => [...m, ...incoming].slice(0, MAX_MEDIA));
        setError(null);
      }
    }, []),
  );

  const publish = async () => {
    if (publishing) return;
    if (!media.length) {
      setError('Paylaşmak için en az bir fotoğraf ya da video seç.');
      return;
    }
    if (!caption.trim()) {
      setError('Gönderine kısa bir açıklama yaz.');
      return;
    }
    setPublishing(true);
    setError(null);
    const res = await store.createPost({
      media,
      caption: caption.trim(),
      location: location.trim() || undefined,
      arenaKey,
      title: title.trim() || undefined,
      sensitive,
    });
    setPublishing(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace((arenaKey ? `/arena/${arenaKey}` : `/gonderi/${res.post.id}`) as Href);
  };

  const full = media.length >= MAX_MEDIA;

  return (
    <SubScreen
      title="Yeni Gönderi"
      right={
        <Pressable onPress={publish} hitSlop={8} disabled={publishing}>
          {publishing ? (
            <ActivityIndicator size="small" color={Colors.cyan} />
          ) : (
            <VText variant="label" color={Colors.cyan} style={{ fontFamily: Fonts.bold }}>
              Paylaş
            </VText>
          )}
        </Pressable>
      }>
      <View style={styles.pad}>
        {/* Medya seçimi */}
        {media.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {media.map((m, i) => (
              <View key={`${m.uri}-${i}`} style={styles.preview}>
                <MediaView type={m.type} uri={m.uri} />
                <Pressable
                  style={styles.remove}
                  onPress={() => setMedia((list) => list.filter((_, j) => j !== i))}
                  hitSlop={6}
                  accessibilityLabel="Kaldır">
                  <X size={14} color="#fff" />
                </Pressable>
                {i === 0 ? (
                  <View style={styles.coverTag}>
                    <VText variant="caption" color="#fff" style={{ fontSize: 10 }}>
                      Kapak
                    </VText>
                  </View>
                ) : null}
              </View>
            ))}
            {!full ? (
              <Pressable style={[styles.preview, styles.addMore]} onPress={pickFromGallery}>
                <ImagePlus size={26} color={Colors.cyan} />
                <VText variant="caption" color={Colors.cyan}>
                  Ekle
                </VText>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : (
          <GlassCard style={styles.picker} highlighted>
            <ImagePlus size={44} color={Colors.cyan} />
            <VText variant="heading" style={{ marginTop: 10 }}>
              Fotoğraf veya kısa video ekle
            </VText>
            <VText style={{ textAlign: 'center', marginTop: 4 }}>
              En fazla {MAX_MEDIA} medya seçebilirsin. Videolar en çok 60 saniye.
            </VText>
            <View style={styles.pickerRow}>
              <OutlineButton label="Fotoğraf Çek" iconLeft={<Camera size={16} color={Colors.text} />} onPress={() => openCamera('images')} style={{ flex: 1 }} />
              <OutlineButton label="Video Çek" iconLeft={<Video size={16} color={Colors.text} />} onPress={() => openCamera('videos')} style={{ flex: 1 }} />
            </View>
            <PrimaryButton
              label="Galeriden Seç"
              icon={<ImagePlus size={16} color={Colors.onCyan} />}
              onPress={pickFromGallery}
              style={{ marginTop: 10, alignSelf: 'stretch' }}
            />
          </GlassCard>
        )}

        {media.length && !full ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <OutlineButton label="Fotoğraf Çek" iconLeft={<Camera size={16} color={Colors.text} />} onPress={() => openCamera('images')} style={{ flex: 1 }} />
            <OutlineButton label="Video Çek" iconLeft={<Video size={16} color={Colors.text} />} onPress={() => openCamera('videos')} style={{ flex: 1 }} />
          </View>
        ) : null}

        {/* Açıklama ve konum */}
        <VText variant="label" style={styles.label}>
          Açıklama
        </VText>
        <TextInput
          value={caption}
          onChangeText={(t) => {
            setCaption(t);
            setError(null);
          }}
          placeholder="Bu anı anlat…"
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={500}
          style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
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
            placeholder="Örn. Kapadokya, Türkiye"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.inputFlat]}
          />
        </View>

        {/* Arena */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.xl }}>
          <Trophy size={18} color={Colors.gold} />
          <VText variant="label">Arenaya gönder (isteğe bağlı)</VText>
        </View>
        <VText variant="caption" style={{ marginTop: 4 }}>
          Bir arena seçersen gönderin yarışmaya katılır ve diğer kullanıcılar puanlar.
        </VText>
        <View style={styles.chips}>
          <Chip label="Arenasız" active={!arenaKey} onPress={() => setArenaKey(undefined)} />
          {arenas.map((a) => (
            <Chip key={a.key} label={a.name} active={arenaKey === a.key} onPress={() => setArenaKey(a.key)} />
          ))}
        </View>
        {arenaKey ? (
          <>
            <VText variant="label" style={styles.label}>
              Yarışma başlığı
            </VText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Örn. Gece sürüşü"
              placeholderTextColor={Colors.textMuted}
              maxLength={40}
              style={styles.input}
            />
          </>
        ) : null}

        <View style={styles.sensitiveRow}>
          <View style={{ flex: 1 }}>
            <VText variant="label">Hassas içerik</VText>
            <VText variant="caption">
              Kan, yara, kavga, av, açık kıyafet, sigara/alkol ya da ürkütücü görüntü içeriyorsa işaretle. 18 yaş altına
              gösterilmez, diğerlerine örtülü görünür. Çıplaklık ve pornografi yüklenemez.
            </VText>
          </View>
          <Switch
            value={sensitive}
            onValueChange={setSensitive}
            trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
            thumbColor="#fff"
          />
        </View>

        {error ? (
          <View style={styles.error}>
            <VText variant="label" color={Colors.live}>
              {error}
            </VText>
          </View>
        ) : null}

        <PrimaryButton
          label={publishing ? 'Yükleniyor…' : arenaKey ? 'Paylaş ve Yarışmaya Katıl' : 'Paylaş'}
          onPress={publish}
          style={{ marginTop: Spacing.xl, opacity: publishing ? 0.6 : 1 }}
        />
        {publishing ? (
          <VText variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
            Fotoğraf ve videolar yükleniyor, bu birkaç saniye sürebilir.
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  sensitiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: Spacing.lg,
    padding: 14,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  picker: { alignItems: 'center', padding: 24 },
  pickerRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  preview: {
    width: 120,
    height: 160,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  addMore: { alignItems: 'center', justifyContent: 'center', gap: 4, borderStyle: 'dashed', borderColor: Colors.borderStrong },
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
  coverTag: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  error: {
    marginTop: Spacing.lg,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.liveSoft,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
});
