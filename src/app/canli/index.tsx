import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { CheckCircle2, Eye, Radio, Video } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, BottomFade, Chip, GlassCard, PrimaryButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius, Spacing } from '@/constants/theme';
import { arenaByKey, arenas, liveStreams, userById, type ArenaKey } from '@/data/mock';
import { formatCount } from '@/store/app-store';

export default function CanliListe() {
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [arena, setArena] = useState<ArenaKey | null>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (title.trim().length < 3) {
      setError('Yayın başlığı en az 3 karakter olmalı.');
      return;
    }
    setError('');
    setSent(true);
  };

  return (
    <SubScreen title="Canlı">
      <View style={styles.pad}>
        <VText variant="title">Canlı Yayınlar</VText>
        <VText variant="body">Topluluğunla anlık buluş, yayınları izle ve sohbete katıl.</VText>

        {/* Yayın başlat */}
        <GlassCard highlighted={formOpen} style={{ marginTop: Spacing.lg, padding: 14 }}>
          {!formOpen ? (
            <Pressable style={styles.startRow} onPress={() => setFormOpen(true)}>
              <View style={styles.startIcon}>
                <Video size={22} color={Colors.live} />
              </View>
              <View style={{ flex: 1 }}>
                <VText variant="bodyBold">Yayın Başlat</VText>
                <VText variant="caption">Kendi canlı yayınını aç.</VText>
              </View>
              <VText variant="label" color={Colors.cyan}>
                Başla
              </VText>
            </Pressable>
          ) : sent ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <CheckCircle2 size={36} color={Colors.success} />
              <VText variant="bodyBold" style={{ marginTop: 8, textAlign: 'center' }}>
                Yayın talebin alındı
              </VText>
              <VText style={{ textAlign: 'center', marginTop: 4 }}>
                “{title.trim()}”{arena ? ` · ${arenaByKey(arena).name} Arenası` : ''}. Canlı yayın altyapısı (LiveKit)
                bağlandığında buradan kameranla yayın açabileceksin.
              </VText>
              <Pressable
                style={{ marginTop: 12 }}
                onPress={() => {
                  setSent(false);
                  setFormOpen(false);
                  setTitle('');
                  setArena(null);
                }}>
                <VText variant="label" color={Colors.cyan}>
                  Tamam
                </VText>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 10 }}>
              <VText variant="bodyBold">Yeni canlı yayın</VText>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Yayın başlığı (ör. Pist günü canlı)"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
                maxLength={60}
              />
              <VText variant="caption">Arena (isteğe bağlı)</VText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {arenas.map((a) => (
                  <Chip key={a.key} label={a.name} active={arena === a.key} onPress={() => setArena(arena === a.key ? null : a.key)} />
                ))}
              </ScrollView>
              {error ? (
                <VText variant="caption" color={Colors.live}>
                  {error}
                </VText>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
                <PrimaryButton label="Yayını Başlat" icon={<Radio size={16} color={Colors.onCyan} />} onPress={submit} />
                <Pressable onPress={() => setFormOpen(false)} hitSlop={8}>
                  <VText variant="label" color={Colors.textSecondary}>
                    Vazgeç
                  </VText>
                </Pressable>
              </View>
            </View>
          )}
        </GlassCard>

        <VText variant="heading" style={{ marginTop: Spacing.xl, marginBottom: Spacing.md }}>
          Şu An Yayında
        </VText>
        <View style={{ gap: 12 }}>
          {liveStreams.map((s) => {
            const host = userById(s.hostId);
            return (
              <Pressable key={s.id} style={styles.card} onPress={() => router.push(`/canli/${s.id}` as Href)}>
                <Image source={{ uri: s.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <BottomFade />
                <OnDark>
                <View style={styles.topRow}>
                  <View style={styles.liveTag}>
                    <View style={styles.liveDot} />
                    <VText style={styles.liveText}>CANLI</VText>
                  </View>
                  <View style={styles.viewers}>
                    <Eye size={13} color="#fff" />
                    <VText variant="caption" color="#fff">
                      {formatCount(s.viewers)}
                    </VText>
                  </View>
                </View>
                <View style={styles.bottom}>
                  <Avatar uri={host.avatar} size={36} ring />
                  <View style={{ flex: 1 }}>
                    <VText variant="bodyBold" numberOfLines={1}>
                      {s.title}
                    </VText>
                    <VText variant="caption" color={OnImage.textSecondary} numberOfLines={1}>
                      {host.name}
                      {s.arenaKey ? ` · ${arenaByKey(s.arenaKey).name} Arenası` : ''}
                    </VText>
                  </View>
                </View>
                </OnDark>
              </Pressable>
            );
          })}
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  startRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  startIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.liveSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    paddingHorizontal: 14,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  card: {
    height: 200,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
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
  bottom: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
