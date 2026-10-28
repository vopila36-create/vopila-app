import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  ArrowRight,
  ChevronRight,
  Compass,
  FileText,
  Flame,
  Orbit,
  Play,
  Radio,
  Trophy,
  Utensils,
  Waves,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  BottomFade,
  GlassCard,
  OutlineButton,
  PlayBadge,
  SectionHeader,
} from '@/components/ui/primitives';
import { AppHeader, Screen } from '@/components/ui/screen';
import { VText } from '@/components/ui/text';
import { bgAlpha, Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { img, interests, newsById } from '@/data/mock';

const QUICK: { title: string; sub: string; Icon: LucideIcon; color: string; href: string }[] = [
  { title: 'Akış', sub: 'Topluluklarla bağlan', Icon: Waves, color: Colors.cyan, href: '/akis' },
  { title: 'Haberler', sub: 'Dünyayı keşfet', Icon: FileText, color: Colors.cyan, href: '/haberler' },
  { title: 'Arenalar', sub: 'Yarışmalara katıl', Icon: Trophy, color: Colors.gold, href: '/arenalar' },
  { title: 'Canlı', sub: 'Şimdi izle', Icon: Radio, color: Colors.live, href: '/canli' },
];

const INTEREST_ICONS: Record<string, LucideIcon> = {
  'doga-kesif': Compass,
  'uzay-bilim': Orbit,
  lezzet: Utensils,
  motor: Flame,
};

export default function AnaSahne() {
  const featured = newsById('n6');

  return (
    <Screen header={<AppHeader tagline />}>
      {/* Karşılama alanı */}
      <View style={styles.hero}>
        <Image source={{ uri: img.mountain2 }} style={styles.heroImage} contentFit="cover" />
        <LinearGradient
          colors={[bgAlpha(0.95), bgAlpha(0.55), bgAlpha(0.1)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['transparent', Colors.bg]}
          start={{ x: 0, y: 0.6 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <VText variant="display">Bugün</VText>
          <VText variant="display" color={Colors.cyan}>
            Ne Keşfetmek{'\n'}İstersin?
          </VText>
          <VText style={styles.heroText}>
            Sınırların ötesinde ilham veren içerikler, insanlar ve deneyimler seni bekliyor.
          </VText>
          <View style={styles.heroActions}>
            <OutlineButton
              label="Keşfe Başla"
              icon={<ArrowRight size={18} color={Colors.cyan} />}
              onPress={() => router.navigate('/akis' as Href)}
            />
            <Pressable style={styles.heroPlay} onPress={() => router.push('/haber/n6' as Href)}>
              <PlayBadge size={38}>
                <Play size={16} color="#fff" fill="#fff" />
              </PlayBadge>
              <View>
                <VText variant="label">Sınırların Ötesinde</VText>
                <VText style={styles.overline}>VOPILA ÖZEL</VText>
              </View>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Hızlı erişim kutuları */}
      <View style={styles.quickRow}>
        {QUICK.map(({ title, sub, Icon, color, href }) => (
          <Pressable key={title} style={{ flex: 1 }} onPress={() => router.navigate(href as Href)}>
            <GlassCard style={styles.quick}>
              <Icon size={28} color={color} strokeWidth={1.8} />
              <VText variant="label" style={{ marginTop: 8 }}>
                {title}
              </VText>
              <VText variant="caption" style={{ textAlign: 'center', fontSize: 10.5 }}>
                {sub}
              </VText>
            </GlassCard>
          </Pressable>
        ))}
      </View>

      {/* İlgi alanları */}
      <View style={styles.section}>
        <SectionHeader
          title="İlgi Alanlarını Keşfet"
          action="Tüm Alanlar"
          onAction={() => router.push('/ilgi' as Href)}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
        {interests.map((it) => {
          const Icon = INTEREST_ICONS[it.key] ?? Compass;
          return (
            <Pressable key={it.key} style={styles.interest} onPress={() => router.push(`/ilgi/${it.key}` as Href)}>
              <Image source={{ uri: it.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <BottomFade />
              <View style={styles.interestIcon}>
                <Icon size={18} color={it.color} />
              </View>
              <View style={styles.interestBody}>
                <View style={{ flex: 1 }}>
                  <VText variant="bodyBold" style={{ fontSize: 16 }}>
                    {it.title}
                  </VText>
                  <VText variant="caption" color={Colors.textSecondary}>
                    {it.text}
                  </VText>
                </View>
                <View style={styles.circleBtn}>
                  <ChevronRight size={18} color="#fff" />
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Öne çıkanlar */}
      <View style={styles.section}>
        <SectionHeader title="Öne Çıkan Keşifler" onAction={() => router.navigate('/akis' as Href)} />
        <Pressable style={styles.featured} onPress={() => router.push('/haber/n6' as Href)}>
          <Image source={{ uri: featured?.image ?? img.whale }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <BottomFade />
          <View style={styles.badge}>
            <VText style={styles.badgeText}>VOPILA ÖZEL</VText>
          </View>
          <View style={styles.featuredBody}>
            <View style={{ flex: 1 }}>
              <VText variant="heading">Mavi Dünyanın Sırları</VText>
              <VText variant="caption" color={Colors.textSecondary}>
                Okyanusların derinliklerinde keşfedilmeyi bekleyen yaşam.
              </VText>
            </View>
            <PlayBadge size={48}>
              <Play size={20} color="#fff" fill="#fff" />
            </PlayBadge>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { height: 330, marginBottom: Spacing.sm },
  heroImage: { position: 'absolute', top: 0, bottom: 0, right: 0, left: 0 },
  heroContent: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.xl },
  heroText: { marginTop: Spacing.md, maxWidth: 260 },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xl,
    gap: 12,
  },
  heroPlay: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  overline: { fontFamily: Fonts.semibold, fontSize: 10, letterSpacing: 1.5, color: Colors.textMuted },
  quickRow: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.screen },
  quick: { alignItems: 'center', paddingVertical: 14, paddingHorizontal: 4, minHeight: 112 },
  section: { paddingHorizontal: Spacing.screen, marginTop: Spacing.xxl },
  hList: { paddingHorizontal: Spacing.screen, gap: 12 },
  interest: {
    width: 250,
    height: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  interestIcon: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  interestBody: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featured: {
    height: 170,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: bgAlpha(0.6),
  },
  badgeText: { fontFamily: Fonts.bold, fontSize: 10, letterSpacing: 1, color: Colors.text },
  featuredBody: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
});
