import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  Activity,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  Eye,
  FolderOpen,
  Heart,
  ImageIcon,
  Lock,
  MapPin,
  Package,
  Pencil,
  PlayCircle,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react-native';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard, OutlineButton, SectionHeader } from '@/components/ui/primitives';
import { AppHeader, Screen } from '@/components/ui/screen';
import { EmptyState } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, Fonts, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { arenaByKey, badges, levelInfo, ME_ID, myFollowerIds, type ArenaKey, type Post } from '@/data/mock';
import { formatCount, formatTokens, useMe, useStore } from '@/store/app-store';

const TABS = [
  { key: 'posts', label: 'Paylaşımlar', Icon: ImageIcon },
  { key: 'videos', label: 'Videolar', Icon: PlayCircle },
  { key: 'collections', label: 'Koleksiyonlar', Icon: FolderOpen },
  { key: 'saved', label: 'Kaydedilenler', Icon: Bookmark },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const go = (path: string) => router.push(path as Href);

export default function Profil() {
  const store = useStore();
  const me = useMe();
  const [tab, setTab] = useState<TabKey>('posts');
  const [period, setPeriod] = useState<7 | 30>(30);

  const myPosts = useMemo(() => store.allPosts.filter((p) => p.authorId === ME_ID), [store.allPosts]);
  const totalLikes = myPosts.reduce((s, p) => s + store.likeCount(p), 0) + 600;
  const savedPosts = store.savedPostList;
  const lvl = levelInfo(store.myXp);
  const current = lvl.current;
  const levelPct = `${Math.round(lvl.progress * 100)}%` as const;
  const impact = period === 30 ? { views: 48200, eng: 3600, growth: '+%72' } : { views: 11900, eng: 940, growth: '+%18' };

  const collections = useMemo(() => {
    const map = new Map<ArenaKey, Post[]>();
    myPosts.forEach((p) => {
      if (p.arenaKey) map.set(p.arenaKey, [...(map.get(p.arenaKey) ?? []), p]);
    });
    return [...map.entries()];
  }, [myPosts]);

  const gridPosts =
    tab === 'posts' ? myPosts : tab === 'videos' ? myPosts.filter((p) => p.media[0]?.type === 'video') : tab === 'saved' ? savedPosts : [];

  return (
    <Screen
      header={
        <AppHeader
          right={
            <>
              <Pressable hitSlop={8} onPress={() => go('/arama')} accessibilityLabel="Ara">
                <Search size={24} color={Colors.text} strokeWidth={1.8} />
              </Pressable>
              <Pressable hitSlop={8} onPress={() => go('/ayarlar')} accessibilityLabel="Ayarlar">
                <Settings size={24} color={Colors.text} strokeWidth={1.8} />
              </Pressable>
            </>
          }
        />
      }>
      {/* Üst bilgi */}
      <View style={styles.top}>
        <Image source={{ uri: me.cover }} style={styles.cover} contentFit="cover" />
        <LinearGradient
          colors={[scrim(0.92), scrim(0.45)]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient colors={['transparent', scrim(0.92)]} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <OnDark>
        <View style={styles.topRow}>
          <Pressable style={styles.avatarGlow} onPress={() => go('/profil-duzenle')}>
            <Avatar uri={me.avatar} size={100} ring />
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <VText variant="heading" style={{ fontSize: 23, lineHeight: 29, flexShrink: 1 }} numberOfLines={1}>
                {me.name}
              </VText>
              {me.verified ? <BadgeCheck size={21} color="#fff" fill={OnImage.accent} /> : null}
            </View>
            <VText variant="body">@{me.username}</VText>
            <VText variant="body" color={OnImage.text} style={{ marginTop: 6, fontSize: 13 }} numberOfLines={3}>
              {me.bio}
            </VText>
          </View>
        </View>
        <View style={styles.metaRow}>
          <MapPin size={14} color={OnImage.accent} />
          <VText variant="caption" color={OnImage.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
            {me.location}
          </VText>
          <CalendarDays size={14} color={OnImage.accent} style={{ marginLeft: 10 }} />
          <VText variant="caption" color={OnImage.textSecondary}>
            VOPILA&apos;da 1+ Yıl
          </VText>
        </View>
        <View style={styles.actionRow}>
          <OutlineButton
            label="Profili Düzenle"
            iconLeft={<Pencil size={16} color={OnImage.text} />}
            style={{ flex: 1 }}
            onPress={() => go('/profil-duzenle')}
          />
          <Pressable style={styles.wallet} onPress={() => go('/cuzdan')}>
            <Coins size={18} color={OnImage.gold} />
            <VText variant="label" color={OnImage.gold}>
              {formatTokens(store.balance)} Token
            </VText>
          </Pressable>
        </View>
        </OnDark>
      </View>

      {/* İstatistikler */}
      <View style={styles.pad}>
        <GlassCard style={styles.stats}>
          <Stat
            icon={<Sparkles size={20} color={Colors.gold} fill={Colors.gold} />}
            value={formatCount(me.discoveryPoints)}
            label="Keşif Puanı"
            accent
            onPress={() => go('/seviye')}
          />
          <Divider />
          <Stat
            icon={<Users size={20} color={Colors.cyanSoft} />}
            value={formatCount(myFollowerIds.length)}
            label="Takipçi"
            onPress={() => go('/takip?tab=takipciler')}
          />
          <Divider />
          <Stat
            icon={<UserCheck size={20} color={Colors.cyanSoft} />}
            value={formatCount(store.followingIds.length)}
            label="Takip"
            onPress={() => go('/takip?tab=takip')}
          />
          <Divider />
          <Stat icon={<Heart size={20} color={Colors.heart} fill={Colors.heart} />} value={formatCount(totalLikes)} label="Beğeni" onPress={() => go('/istatistikler')} />
        </GlassCard>

        {/* Kısayollar */}
        <View style={styles.shortcuts}>
          <Shortcut icon={<Plus size={18} color={Colors.cyan} />} label="Paylaş" onPress={() => go('/olustur')} />
          <Shortcut icon={<ShoppingBag size={18} color={Colors.gold} />} label="Mağaza" onPress={() => go('/magaza')} />
          <Shortcut icon={<Package size={18} color={Colors.cyanSoft} />} label="Siparişlerim" onPress={() => go('/siparisler')} />
        </View>
      </View>

      {/* Arenalarım */}
      <View style={[styles.pad, { marginTop: Spacing.xl }]}>
        <SectionHeader title="Arenalarım" action="Tüm Arenalarım" onAction={() => go('/arena-listesi')} />
      </View>
      {store.joinedArenas.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hList}>
          {store.joinedArenas.map((key) => {
            const a = arenaByKey(key);
            return (
              <Pressable key={key} style={styles.myArena} onPress={() => go(`/arena/${key}`)}>
                <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <LinearGradient colors={['transparent', 'rgba(3,9,20,0.9)']} style={StyleSheet.absoluteFill} />
                <OnDark>
                <VText variant="label" style={styles.myArenaLabel} numberOfLines={2}>
                  {a.name}
                </VText>
                </OnDark>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.pad}>
          <Pressable onPress={() => go('/arena-listesi')}>
            <GlassCard style={{ padding: 14 }}>
              <VText>Henüz bir arenaya katılmadın. Arenaları keşfetmek için dokun.</VText>
            </GlassCard>
          </Pressable>
        </View>
      )}

      {/* Seviye + Profil etkisi */}
      <View style={[styles.pad, styles.stack]}>
        <Pressable onPress={() => go('/seviye')}>
          <GlassCard style={styles.level}>
            <View style={styles.hex}>
              <Crown size={30} color={Colors.gold} fill={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <VText variant="caption" color={Colors.text}>
                {current.number}. Seviye
              </VText>
              <VText variant="heading" numberOfLines={1}>
                {current.name}
              </VText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: levelPct }]} />
              </View>
              <VText variant="caption">
                <VText variant="caption" color={Colors.cyan}>
                  {lvl.inLevel}
                </VText>{' '}
                / {lvl.span} puan
              </VText>
            </View>
            <ChevronRight size={18} color={Colors.text} />
          </GlassCard>
        </Pressable>

        <GlassCard style={styles.impact}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Activity size={16} color={Colors.cyan} />
            <Pressable style={{ flex: 1 }} onPress={() => go('/istatistikler')}>
              <VText variant="label">Profil Etkisi</VText>
            </Pressable>
            <Pressable style={styles.period} onPress={() => setPeriod((p) => (p === 30 ? 7 : 30))} hitSlop={6}>
              <VText variant="caption">Son {period} Gün</VText>
              <ChevronDown size={12} color={Colors.textMuted} />
            </Pressable>
          </View>
          <Pressable style={{ flexDirection: 'row', marginTop: 12 }} onPress={() => go('/istatistikler')}>
            <Impact icon={<Eye size={14} color={Colors.cyan} />} value={formatCount(impact.views)} label="Görüntüleme" />
            <Impact icon={<Users size={14} color={Colors.cyan} />} value={formatCount(impact.eng)} label="Etkileşim" />
            <Impact icon={<TrendingUp size={14} color={Colors.success} />} value={impact.growth} label="Keşif Artışı" color={Colors.success} />
          </Pressable>
        </GlassCard>
      </View>

      {/* Rozetler */}
      <View style={[styles.pad, { marginTop: Spacing.xl }]}>
        <SectionHeader title="Arena Başarıları" action="Tüm Rozetler" onAction={() => go('/rozetler')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
          {badges
            .filter((b) => b.earned)
            .map((b) => (
              <Pressable key={b.id} style={styles.badgeItem} onPress={() => go('/rozetler')}>
                <View style={styles.badge}>
                  <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                </View>
                <VText variant="caption" color={Colors.text} style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={2}>
                  {b.name}
                </VText>
              </Pressable>
            ))}
          <Pressable style={styles.badgeItem} onPress={() => go('/rozetler')}>
            <View style={[styles.badge, styles.badgeLocked]}>
              <Lock size={20} color={Colors.textMuted} />
            </View>
            <VText variant="caption" style={{ textAlign: 'center', fontSize: 11 }}>
              Sıradaki Rozet
            </VText>
          </Pressable>
        </ScrollView>
      </View>

      {/* İçerik sekmeleri */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.map(({ key, label, Icon }) => {
          const on = key === tab;
          return (
            <Pressable key={key} onPress={() => setTab(key)} style={styles.tab}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon size={18} color={on ? Colors.cyan : Colors.textSecondary} />
                <VText
                  variant="label"
                  color={on ? Colors.cyan : Colors.textSecondary}
                  style={on ? { fontFamily: Fonts.bold } : undefined}>
                  {label}
                </VText>
              </View>
              <View style={[styles.tabLine, on && { backgroundColor: Colors.cyan }]} />
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'collections' ? (
        <View style={[styles.pad, { gap: 10, marginTop: Spacing.md }]}>
          {collections.length ? (
            collections.map(([key, list]) => {
              const a = arenaByKey(key);
              return (
                <Pressable key={key} style={styles.collection} onPress={() => go(`/arena/${key}`)}>
                  <View style={styles.collectionImages}>
                    {list.slice(0, 3).map((p) => (
                      <Image key={p.id} source={{ uri: cover(p) }} style={styles.collectionImg} contentFit="cover" />
                    ))}
                  </View>
                  <View style={{ flex: 1 }}>
                    <VText variant="bodyBold">{a.name} Koleksiyonu</VText>
                    <VText variant="caption">{list.length} paylaşım</VText>
                  </View>
                  <ChevronRight size={18} color={Colors.textSecondary} />
                </Pressable>
              );
            })
          ) : (
            <EmptyState icon={<FolderOpen size={40} color={Colors.textMuted} />} title="Henüz koleksiyon yok" text="Arenalara gönderi paylaştıkça koleksiyonların burada oluşur." />
          )}
        </View>
      ) : gridPosts.length ? (
        <View style={[styles.pad, styles.grid]}>
          {gridPosts.map((p) => (
            <Pressable key={p.id} style={styles.gridItem} onPress={() => go(`/gonderi/${p.id}`)}>
              <Image source={{ uri: cover(p) }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {p.media[0]?.type === 'video' ? (
                <View style={styles.gridVideo}>
                  <PlayCircle size={22} color="#fff" />
                </View>
              ) : null}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.6)']} style={[StyleSheet.absoluteFill, { top: '60%' }]} />
              <OnDark>
              <View style={styles.gridFoot}>
                <Heart size={13} color="#fff" />
                <VText variant="caption" color="#fff" style={{ flex: 1 }}>
                  {formatCount(store.likeCount(p))}
                </VText>
              </View>
              </OnDark>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.pad}>
          <EmptyState
            icon={tab === 'saved' ? <Bookmark size={40} color={Colors.textMuted} /> : <ImageIcon size={40} color={Colors.textMuted} />}
            title={tab === 'saved' ? 'Kaydedilen gönderi yok' : tab === 'videos' ? 'Henüz video yok' : 'Henüz paylaşım yok'}
            text={tab === 'saved' ? 'Akışta beğendiğin gönderileri kaydet, burada görünsün.' : 'İlk paylaşımını yap, profilin canlansın.'}
            action={tab === 'saved' ? <OutlineButton label="Akışa git" onPress={() => go('/akis')} /> : <OutlineButton label="Paylaşım oluştur" onPress={() => go('/olustur')} />}
          />
        </View>
      )}
    </Screen>
  );
}

const cover = (p: Post) => {
  const m = p.media[0];
  return m?.type === 'video' ? m.poster ?? m.uri : m?.uri;
};

function Stat({
  icon,
  value,
  label,
  accent,
  onPress,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  accent?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.stat} onPress={onPress}>
      {icon}
      <View style={{ flexShrink: 1 }}>
        <VText variant="bodyBold" style={{ fontSize: 15 }}>
          {value}
        </VText>
        <VText variant="caption" color={accent ? Colors.cyan : Colors.textSecondary} style={{ fontSize: 10.5 }} numberOfLines={1}>
          {label}
        </VText>
      </View>
    </Pressable>
  );
}

function Shortcut({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.shortcut} onPress={onPress}>
      {icon}
      <VText variant="label" numberOfLines={1}>
        {label}
      </VText>
    </Pressable>
  );
}

function Divider() {
  return <View style={{ width: 1, alignSelf: 'stretch', backgroundColor: Colors.border }} />;
}

function Impact({ icon, value, label, color = Colors.text }: { icon: ReactNode; value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon}
        <VText variant="bodyBold" color={color} style={{ fontSize: 14 }}>
          {value}
        </VText>
      </View>
      <VText variant="caption" style={{ fontSize: 10.5 }}>
        {label}
      </VText>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  top: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
  cover: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarGlow: {
    borderRadius: 60,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 14 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  wallet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 44,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSoft,
  },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  shortcuts: { flexDirection: 'row', gap: 8, marginTop: 10 },
  shortcut: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hList: { paddingHorizontal: Spacing.screen, gap: 8 },
  myArena: {
    width: 92,
    height: 118,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  myArenaLabel: { position: 'absolute', left: 8, right: 6, bottom: 8, fontSize: 12 },
  stack: { gap: 10, marginTop: Spacing.lg },
  level: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  hex: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(245,182,66,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 6 },
  fill: { height: 5, borderRadius: 3, backgroundColor: Colors.cyan },
  impact: { padding: 14 },
  period: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeItem: { width: 72, alignItems: 'center', gap: 6 },
  badge: {
    width: 60,
    height: 60,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  badgeLocked: {
    borderStyle: 'dashed',
    borderColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { paddingHorizontal: Spacing.screen, gap: 22, marginTop: Spacing.xl },
  tab: { paddingTop: 4 },
  tabLine: { height: 3, borderRadius: 2, marginTop: 8, backgroundColor: 'transparent' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.md },
  gridItem: { width: '32%', aspectRatio: 0.78, borderRadius: Radius.sm, overflow: 'hidden', backgroundColor: Colors.surfaceStrong },
  gridVideo: { position: 'absolute', top: 8, left: 8 },
  gridFoot: {
    position: 'absolute',
    left: 6,
    right: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  collectionImages: { flexDirection: 'row', gap: 3 },
  collectionImg: { width: 40, height: 52, borderRadius: 6 },
});
