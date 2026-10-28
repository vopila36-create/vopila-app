import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { ChevronRight, Clock, FileText, Globe, Play, Radio, Sparkles } from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomFade, Chip, GlassCard, PlayBadge, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { newsCategories, type NewsArticle, type NewsCategory } from '@/data/mock';
import { useStore } from '@/store/app-store';

const TAG_COLORS: Record<NewsCategory, string> = {
  Gündem: Colors.cyan,
  Teknoloji: Colors.cyan,
  Finans: Colors.gold,
  Spor: '#F87171',
  Dünya: '#60A5FA',
  Bilim: Colors.purple,
};

const open = (id: string, ozet?: boolean) =>
  router.push((ozet ? `/haber/${id}?ozet=1` : `/haber/${id}`) as Href);

/** Haber Merkezi: kategorilere göre manşet ve liste görünümü (Haberler sekmesindeki liste simgesinden açılır). */
export default function HaberMerkezi() {
  const [cat, setCat] = useState<NewsCategory>('Gündem');
  const [showAll, setShowAll] = useState(false);
  const store = useStore();
  const news = store.allNews;
  const liveUpdates = store.liveFeed;

  // "Gündem" tüm haberleri gösterir; diğerleri kategoriye göre süzer.
  const filtered = useMemo(
    () => (cat === 'Gündem' ? news : news.filter((n) => n.category === cat)),
    [cat, news],
  );
  const headline = filtered.find((n) => n.live) ?? filtered[0];
  const rest = filtered.filter((n) => n.id !== headline?.id && !n.special);
  const special = news.find((n) => n.special);

  return (
    <SubScreen title="Haber Merkezi">
      <View style={styles.pad}>
        <VText variant="body">Dünyayı daha geniş bir perspektiften takip et.</VText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {newsCategories.map((c) => (
          <Chip
            key={c}
            label={c}
            active={c === cat}
            onPress={() => {
              setCat(c);
              setShowAll(false);
            }}
          />
        ))}
      </ScrollView>

      {/* Manşet */}
      {headline ? (
        <View style={styles.pad}>
          <Pressable style={styles.headline} onPress={() => open(headline.id)}>
            <Image source={{ uri: headline.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BottomFade />
            <OnDark>
            {headline.live ? (
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <VText style={styles.liveText}>CANLI</VText>
              </View>
            ) : (
              <View style={[styles.liveTag, styles.catTag]}>
                <VText style={[styles.liveText, { color: TAG_COLORS[headline.category] }]}>
                  {headline.category.toLocaleUpperCase('tr-TR')}
                </VText>
              </View>
            )}
            <View style={styles.devTag}>
              <Sparkles size={13} color={OnImage.accent} />
              <VText variant="caption" color={OnImage.text}>
                Son Gelişme
              </VText>
            </View>
            {headline.video ? (
              <View style={styles.headlinePlay}>
                <PlayBadge size={46}>
                  <Play size={20} color="#fff" fill="#fff" />
                </PlayBadge>
              </View>
            ) : null}
            <View style={styles.headlineBody}>
              <VText variant="heading" style={{ fontSize: 22, lineHeight: 28 }} numberOfLines={2}>
                {headline.title}
              </VText>
              <VText variant="body" color={OnImage.textSecondary} style={{ marginTop: 4 }} numberOfLines={2}>
                {headline.summary}
              </VText>
              <View style={styles.metaRow}>
                <Meta icon={<Globe size={14} color={OnImage.textSecondary} />} text={headline.category} />
                <Meta icon={<Clock size={14} color={OnImage.textSecondary} />} text={headline.readTime} />
                <View style={{ flex: 1 }} />
                <Pressable style={styles.inline} onPress={() => open(headline.id, true)} hitSlop={8}>
                  <Sparkles size={14} color={OnImage.accent} />
                  <VText variant="label" color={OnImage.accent}>
                    Yapay Zekâ Özeti
                  </VText>
                  <ChevronRight size={14} color={OnImage.accent} />
                </Pressable>
              </View>
            </View>
            </OnDark>
          </Pressable>
        </View>
      ) : null}

      {/* Sana Özel */}
      {rest.length ? (
        <View style={[styles.pad, { marginTop: Spacing.lg }]}>
          <GlassCard style={{ paddingVertical: 14 }}>
            <View style={{ paddingHorizontal: 14 }}>
              <SectionHeader
                title="Sana Özel"
                subtitle="İlgi alanlarına göre seçilen günün öne çıkan haberleri."
                icon={<Sparkles size={20} color={Colors.cyan} />}
                action={showAll ? 'Daralt' : 'Tümünü Gör'}
                onAction={() => setShowAll((v) => !v)}
              />
            </View>
            {showAll ? (
              <View style={{ paddingHorizontal: 14, gap: 10 }}>
                {rest.map((n) => (
                  <NewsRow key={n.id} item={n} />
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
                {rest.map((n) => (
                  <Pressable key={n.id} style={styles.newsCard} onPress={() => open(n.id)}>
                    <Image source={{ uri: n.image }} style={styles.newsImage} contentFit="cover" />
                    <View style={{ padding: 8, flex: 1 }}>
                      <VText style={[styles.newsTag, { color: TAG_COLORS[n.category] }]}>
                        {n.category.toLocaleUpperCase('tr-TR')}
                      </VText>
                      <VText variant="label" numberOfLines={3} style={{ fontSize: 12.5 }}>
                        {n.title}
                      </VText>
                      <View style={[styles.metaRow, { marginTop: 'auto' }]}>
                        <Meta icon={<Clock size={12} color={Colors.textMuted} />} text={n.readTime} />
                        <View style={{ flex: 1 }} />
                        <ChevronRight size={14} color={Colors.text} />
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </GlassCard>
        </View>
      ) : null}

      {/* Canlı Gelişmeler */}
      <View style={[styles.pad, { marginTop: Spacing.lg }]}>
        <GlassCard style={{ padding: 14 }}>
          <SectionHeader
            title="Canlı Gelişmeler"
            subtitle="Dünya genelindeki önemli gelişmeler, anlık olarak."
            icon={<Radio size={20} color={Colors.live} />}
            onAction={() => router.push('/haberler-canli' as Href)}
          />
          {liveUpdates.slice(0, 4).map((u, i, arr) => (
            <Pressable
              key={u.id}
              style={styles.timelineRow}
              onPress={() =>
                u.articleId ? open(u.articleId) : router.push('/haberler-canli' as Href)
              }>
              <View style={styles.timelineRail}>
                <View style={[styles.timelineDot, u.fresh && { backgroundColor: Colors.live }]} />
                {i < arr.length - 1 ? <View style={styles.timelineLine} /> : null}
              </View>
              <VText
                variant="label"
                color={u.fresh ? Colors.live : Colors.textSecondary}
                style={{ width: 46 }}>
                {u.time}
              </VText>
              <VText variant="body" color={Colors.text} style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>
                {u.text}
              </VText>
              <ChevronRight size={16} color={Colors.textSecondary} />
            </Pressable>
          ))}
        </GlassCard>
      </View>

      {/* VOPILA Özel dosya */}
      {special ? (
        <View style={[styles.pad, { marginTop: Spacing.lg }]}>
          <Pressable style={styles.special} onPress={() => open(special.id)}>
            <Image source={{ uri: special.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BottomFade />
            <OnDark>
            <View style={styles.specialBadge}>
              <VText style={styles.badgeText}>VOPILA ÖZEL</VText>
            </View>
            <View style={styles.headlinePlay}>
              <PlayBadge size={46}>
                <Play size={20} color="#fff" fill="#fff" />
              </PlayBadge>
            </View>
            <View style={styles.headlineBody}>
              <VText variant="heading">{special.title}</VText>
              <VText variant="caption" color={OnImage.textSecondary} numberOfLines={2}>
                {special.summary}
              </VText>
              <View style={styles.metaRow}>
                <Meta icon={<Clock size={14} color={OnImage.textSecondary} />} text={special.readTime} />
                <View style={{ flex: 1 }} />
                <FileText size={14} color={OnImage.accent} />
                <VText variant="label" color={OnImage.accent}>
                  Özel Dosya
                </VText>
              </View>
            </View>
            </OnDark>
          </Pressable>
        </View>
      ) : null}
    </SubScreen>
  );
}

function NewsRow({ item }: { item: NewsArticle }) {
  return (
    <Pressable style={styles.row} onPress={() => open(item.id)}>
      <Image source={{ uri: item.image }} style={styles.rowImage} contentFit="cover" />
      <View style={{ flex: 1 }}>
        <VText style={[styles.newsTag, { color: TAG_COLORS[item.category] }]}>
          {item.category.toLocaleUpperCase('tr-TR')}
        </VText>
        <VText variant="label" numberOfLines={2}>
          {item.title}
        </VText>
        <VText variant="caption" style={{ marginTop: 2 }}>
          {item.time} · {item.readTime}
        </VText>
      </View>
      <ChevronRight size={16} color={Colors.textSecondary} />
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 10 }}>
      {icon}
      <VText variant="caption" color={Colors.textSecondary}>
        {text}
      </VText>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  chips: { paddingHorizontal: Spacing.screen, gap: 8, paddingVertical: Spacing.lg },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headline: {
    height: 290,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  liveTag: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.live,
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  catTag: { borderColor: Colors.border, backgroundColor: scrim(0.6) },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.live },
  liveText: { fontFamily: Fonts.bold, fontSize: 11, color: '#fff', letterSpacing: 0.5 },
  devTag: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: scrim(0.6),
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headlinePlay: { position: 'absolute', right: 16, top: '28%' },
  headlineBody: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  newsCard: {
    width: 128,
    height: 210,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newsImage: { width: '100%', height: 92 },
  newsTag: { fontFamily: Fonts.bold, fontSize: 9.5, letterSpacing: 0.6, marginBottom: 3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rowImage: { width: 72, height: 60, borderRadius: Radius.sm },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34 },
  timelineRail: { width: 10, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  timelineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.textMuted },
  timelineLine: {
    position: 'absolute',
    top: '60%',
    bottom: '-40%',
    width: 1,
    backgroundColor: Colors.border,
  },
  special: {
    height: 190,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  specialBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: scrim(0.6),
  },
  badgeText: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, color: OnImage.text },
});
