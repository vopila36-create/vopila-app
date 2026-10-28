import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Clock, LayoutList, Radio, Send, Sparkles } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReelAction, ReelPager } from '@/components/reels';
import { SendSheet, type SendPayload } from '@/components/send-sheet';
import { VideoPlayer } from '@/components/ui/media';
import { OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing, TabBarHeight } from '@/constants/theme';
import type { NewsArticle, NewsCategory } from '@/data/mock';
import { rankByInterest } from '@/lib/feed-rank';
import { useStore } from '@/store/app-store';

const TAG_COLORS: Record<NewsCategory, string> = {
  Gündem: Colors.cyan,
  Teknoloji: Colors.cyan,
  Finans: Colors.gold,
  Spor: '#F87171',
  Dünya: '#60A5FA',
  Bilim: Colors.purple,
};

const topicOf = (n: NewsArticle) => `news:${n.category}`;

/**
 * Haberler sekmesi: tüm haberler tam ekran, dikey kaydırmalı.
 * Kullanıcının en çok izlediği konular (Spor, Teknoloji…) öne çıkar; canlı haberler her zaman öncelikli.
 */
export default function Haberler() {
  const store = useStore();
  // Sekmeye her gelişte yeni haberleri çek (sunucu 15 dakikada bir günceller)
  const { refreshNews } = store;
  useFocusEffect(
    useCallback(() => {
      refreshNews();
    }, [refreshNews]),
  );
  // Gerçek haberler ilk geldiğinde sıra bir kez yeniden kurulur
  return <NewsReels key={store.newsReady ? 'real' : 'demo'} />;
}

function NewsReels() {
  const store = useStore();
  const insets = useSafeAreaInsets();

  // Sıra açılışta bir kez hesaplanır; izledikçe içerik yer değiştirmez
  const [items] = useState(() =>
    rankByInterest(store.allNews.slice(0, 150), {
      idOf: (n) => n.id,
      topicOf,
      interests: store.state.interests,
      seen: store.state.seenReels,
      seed: Math.floor(Math.random() * 1e9),
      boost: (n) => (n.live ? 2.5 : n.special ? 1.5 : 1),
    }),
  );

  const overlay = (
    <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
      <View style={{ flex: 1 }}>
        <VText variant="title" style={styles.shadow}>
          Haberler
        </VText>
        <VText variant="caption" color="#fff" style={styles.shadow}>
          Sana özel · ilgilendiğin konular önde
        </VText>
      </View>
      <Pressable hitSlop={8} onPress={() => router.push('/haberler-canli' as Href)} accessibilityLabel="Canlı gelişmeler">
        <Radio size={23} color={Colors.live} />
      </Pressable>
      <Pressable hitSlop={8} onPress={() => router.push('/haber-merkezi' as Href)} accessibilityLabel="Haber Merkezi (liste görünümü)">
        <LayoutList size={23} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <ReelPager
      data={items}
      keyOf={(n) => n.id}
      overlay={overlay}
      onDwell={(n, secs) => store.addInterest(topicOf(n), secs, n.id)}
      renderItem={(n, { active }) => (
        <NewsReel article={n} active={active} bottom={TabBarHeight + Math.max(insets.bottom, 10) + 12} />
      )}
    />
  );
}

function NewsReel({ article, active, bottom }: { article: NewsArticle; active: boolean; bottom: number }) {
  const store = useStore();

  const hasAi = article.aiSummary.length > 0;
  const open = (ozet?: boolean) => {
    // Haberi açmak güçlü bir ilgi işaretidir
    store.addInterest(topicOf(article), ozet ? 4 : 6, article.id);
    // Otomatik haber: haberin tamamı kaynağında (uygulama içi tarayıcıda) okunur
    if (!ozet && article.sourceUrl) {
      WebBrowser.openBrowserAsync(article.sourceUrl).catch(() => {});
      return;
    }
    router.push((ozet ? `/haber/${article.id}?ozet=1` : `/haber/${article.id}`) as Href);
  };

  const [sendPayload, setSendPayload] = useState<SendPayload | null>(null);
  const send = () => setSendPayload({ title: `${article.title} — VOPILA Haberler`, link: `vopila://haber/${article.id}` });

  return (
    <View style={{ flex: 1 }}>
      {article.video && active ? (
        <View style={StyleSheet.absoluteFill}>
          <VideoPlayer uri={article.video} autoPlay controls={false} />
        </View>
      ) : (
        <Image source={{ uri: article.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.side, { bottom: bottom + 150 }]}>
        <ReelAction icon={<Send size={22} color="#fff" />} label="Gönder" onPress={send} />
        {hasAi ? (
          <ReelAction icon={<Sparkles size={22} color={Colors.cyan} />} label="AI Özet" onPress={() => open(true)} />
        ) : null}
      </View>

      <View style={[styles.bottom, { paddingBottom: bottom }]}>
        {article.live ? (
          <View style={[styles.tag, { borderColor: Colors.live }]}>
            <View style={styles.liveDot} />
            <VText style={[styles.tagText, { color: Colors.live }]}>CANLI</VText>
          </View>
        ) : (
          <View style={[styles.tag, { borderColor: TAG_COLORS[article.category] }]}>
            <VText style={[styles.tagText, { color: TAG_COLORS[article.category] }]}>
              {article.category.toLocaleUpperCase('tr-TR')}
            </VText>
          </View>
        )}

        <VText variant="title" color="#fff" style={[styles.shadow, { fontSize: 24, marginTop: 8 }]} numberOfLines={3}>
          {article.title}
        </VText>
        <VText color="#fff" style={[styles.shadow, { marginTop: 6, opacity: 0.92 }]} numberOfLines={3}>
          {article.summary}
        </VText>
        <View style={styles.meta}>
          <Clock size={13} color={Colors.textSecondary} />
          <VText variant="caption">
            {article.sourceName ? `${article.sourceName} · ` : ''}
            {article.time}
          </VText>
        </View>

        <View style={styles.buttons}>
          <PrimaryButton
            label={article.sourceName ? `Habere Git · ${article.sourceName}` : 'Habere Git'}
            onPress={() => open()}
            style={{ flex: 1 }}
          />
          {hasAi ? (
            <OutlineButton
              label="AI Özet"
              iconLeft={<Sparkles size={15} color={Colors.text} />}
              onPress={() => open(true)}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
      </View>
      <SendSheet payload={sendPayload} onClose={() => setSendPayload(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingHorizontal: Spacing.screen },
  shadow: { textShadowColor: 'rgba(0,0,0,0.85)', textShadowRadius: 6 },
  side: { position: 'absolute', right: 12, gap: 18, alignItems: 'center' },
  bottom: { position: 'absolute', left: 0, right: 64, bottom: 0, paddingHorizontal: Spacing.screen },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  tagText: { fontFamily: Fonts.bold, fontSize: 11, letterSpacing: 1 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.live },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
