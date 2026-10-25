import { Image } from 'expo-image';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Bookmark, ChevronDown, ChevronRight, ChevronUp, Clock, Newspaper, Play, Share2, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { VideoPlayer } from '@/components/ui/media';
import { GlassCard, OutlineButton, PlayBadge, SectionHeader } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { news, newsById } from '@/data/mock';

export default function HaberDetay() {
  const { id, ozet } = useLocalSearchParams<{ id: string; ozet?: string }>();
  const article = newsById(String(id));
  const [summaryOpen, setSummaryOpen] = useState(ozet === '1');
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [shareNote, setShareNote] = useState('');

  if (!article) {
    return (
      <SubScreen title="Haber">
        <EmptyState
          icon={<Newspaper size={44} color={Colors.textMuted} />}
          title="Haber bulunamadı"
          text="Bu haber kaldırılmış ya da bağlantı hatalı olabilir."
          action={<OutlineButton label="Haberlere dön" onPress={() => router.replace('/haberler' as Href)} />}
        />
      </SubScreen>
    );
  }

  const related = news.filter((n) => n.id !== article.id && n.category === article.category);
  const more = related.length ? related : news.filter((n) => n.id !== article.id).slice(0, 3);

  const onShare = async () => {
    try {
      await Share.share({ message: `${article.title} — VOPILA'da oku` });
      setShareNote('');
    } catch {
      setShareNote('Paylaşım bu cihazda açılamadı.');
    }
  };

  return (
    <SubScreen
      title={article.category}
      right={
        <>
          <Pressable onPress={() => setSaved((v) => !v)} hitSlop={8} accessibilityLabel="Kaydet">
            <Bookmark size={22} color={saved ? Colors.cyan : Colors.text} fill={saved ? Colors.cyan : 'transparent'} />
          </Pressable>
          <Pressable onPress={onShare} hitSlop={8} accessibilityLabel="Paylaş">
            <Share2 size={22} color={Colors.text} />
          </Pressable>
        </>
      }>
      <View style={styles.pad}>
        <View style={styles.hero}>
          {article.video && playing ? (
            <VideoPlayer uri={article.video} autoPlay />
          ) : (
            <Pressable style={StyleSheet.absoluteFill} onPress={() => article.video && setPlaying(true)} disabled={!article.video}>
              <Image source={{ uri: article.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {article.video ? (
                <View style={styles.center}>
                  <PlayBadge size={58}>
                    <Play size={24} color="#fff" fill="#fff" />
                  </PlayBadge>
                </View>
              ) : null}
            </Pressable>
          )}
          {article.live ? (
            <View style={styles.liveTag}>
              <View style={styles.liveDot} />
              <VText style={styles.liveText}>CANLI</VText>
            </View>
          ) : null}
        </View>

        <View style={styles.meta}>
          <VText style={styles.cat}>{article.category.toLocaleUpperCase('tr-TR')}</VText>
          <Clock size={13} color={Colors.textMuted} />
          <VText variant="caption">
            {article.time} · {article.readTime}
          </VText>
        </View>
        <VText variant="title" style={{ fontSize: 26, lineHeight: 32 }}>
          {article.title}
        </VText>
        <VText variant="body" color={Colors.textSecondary} style={{ marginTop: 8, fontSize: 15, lineHeight: 22 }}>
          {article.summary}
        </VText>

        {/* Yapay zekâ özeti */}
        <GlassCard highlighted={summaryOpen} style={{ marginTop: Spacing.lg }}>
          <Pressable style={styles.summaryHead} onPress={() => setSummaryOpen((v) => !v)}>
            <Sparkles size={18} color={Colors.cyan} />
            <VText variant="bodyBold" style={{ flex: 1 }}>
              Yapay Zekâ Özeti
            </VText>
            {summaryOpen ? <ChevronUp size={18} color={Colors.cyan} /> : <ChevronDown size={18} color={Colors.cyan} />}
          </Pressable>
          {summaryOpen ? (
            <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
              {article.aiSummary.map((s) => (
                <View key={s} style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={styles.bullet} />
                  <VText variant="body" color={Colors.text} style={{ flex: 1 }}>
                    {s}
                  </VText>
                </View>
              ))}
              <VText variant="caption" style={{ marginTop: 4 }}>
                Bu özet yapay zekâ ile otomatik oluşturuldu.
              </VText>
            </View>
          ) : null}
        </GlassCard>

        <View style={{ marginTop: Spacing.lg, gap: 14 }}>
          {article.body.map((p) => (
            <VText key={p} variant="body" color={Colors.text} style={{ fontSize: 15.5, lineHeight: 24 }}>
              {p}
            </VText>
          ))}
        </View>

        {shareNote ? (
          <VText variant="caption" color={Colors.live} style={{ marginTop: 10 }}>
            {shareNote}
          </VText>
        ) : null}

        <View style={{ marginTop: Spacing.xxl }}>
          <SectionHeader title={related.length ? 'Benzer Haberler' : 'Diğer Haberler'} action={null} />
          <View style={{ gap: 10 }}>
            {more.map((n) => (
              <Pressable key={n.id} style={styles.row} onPress={() => router.push(`/haber/${n.id}` as Href)}>
                <Image source={{ uri: n.image }} style={styles.rowImage} contentFit="cover" />
                <View style={{ flex: 1 }}>
                  <VText variant="label" numberOfLines={2}>
                    {n.title}
                  </VText>
                  <VText variant="caption" style={{ marginTop: 2 }}>
                    {n.category} · {n.readTime}
                  </VText>
                </View>
                <ChevronRight size={16} color={Colors.textSecondary} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm },
  hero: {
    height: 220,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  liveTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.live,
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.live },
  liveText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.lg, marginBottom: 6 },
  cat: { fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 0.8, color: Colors.cyan, marginRight: 4 },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.cyan, marginTop: 7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowImage: { width: 72, height: 60, borderRadius: Radius.sm },
});
