import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Coins,
  Crown,
  MessageCircle,
  SlidersHorizontal,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  Avatar,
  BottomFade,
  Chip,
  GlassCard,
  PrimaryButton,
  SectionHeader,
} from '@/components/ui/primitives';
import { SearchButton } from '@/components/ui/screen';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { bgAlpha, Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { arenaByKey, arenas, levelInfo, ME_ID, userById, type ArenaKey } from '@/data/mock';
import { formatCount, formatTokens, useStore } from '@/store/app-store';

/** Arena Merkezi: sıralaman, kategoriler, liderlik tablosu (Arenalar sekmesindeki kupa simgesinden açılır). */
export default function ArenaMerkezi() {
  const store = useStore();
  const [active, setActive] = useState<ArenaKey>('otomobil');
  const [pickerOpen, setPickerOpen] = useState(false);
  const arena = arenaByKey(active);
  const ranked = store.rankedEntries(active);
  const mine = ranked.find((e) => e.authorId === ME_ID);
  const top5 = ranked.slice(0, 5);

  const { current: level, next, progress, toNext } = levelInfo(store.myXp);

  const go = (href: string) => router.push(href as Href);

  const onCategory = (key: ArenaKey) => {
    if (key === active) go(`/arena/${key}`);
    else setActive(key);
  };

  return (
    <SubScreen
      title="Arena Merkezi"
      right={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <SearchButton />
          <Pressable style={styles.tokenPill} onPress={() => go('/magaza')} accessibilityLabel="Mağaza">
            <Coins size={15} color={Colors.gold} />
            <VText variant="label" color={Colors.gold} style={{ fontSize: 12 }}>
              {formatTokens(store.balance)}
            </VText>
          </Pressable>
          <Pressable hitSlop={8} onPress={() => go('/arena-listesi')} accessibilityLabel="Tüm arenalar">
            <SlidersHorizontal size={22} color={Colors.text} strokeWidth={1.8} />
          </Pressable>
        </View>
      }>
      <View style={styles.pad}>
        <VText variant="body">Tutkularını paylaş, yarış, keşfet.</VText>

        {/* Haftalık sıralama */}
        <GlassCard style={styles.rankCard}>
          <VText variant="bodyBold">Bu Ayki Sıralaman</VText>
          <View style={styles.rankRow}>
            <VText style={styles.rankBig}>{mine ? `#${mine.rank}` : '—'}</VText>
            <View>
              <VText style={styles.points}>{mine ? formatCount(Math.round(mine.totalScore)) : '0'}</VText>
              <VText variant="caption">Puan</VText>
            </View>
            <View style={{ flex: 1 }} />
            <Pressable style={styles.activeArena} onPress={() => go(`/arena/${active}`)}>
              <Image source={{ uri: arena.image }} style={styles.activeThumb} contentFit="cover" />
              <View style={{ flexShrink: 1 }}>
                <VText variant="caption" style={{ fontSize: 10 }}>
                  Aktif Arenan
                </VText>
                <VText variant="label" style={{ fontSize: 12 }} numberOfLines={1}>
                  {arena.name}
                </VText>
              </View>
              <ChevronRight size={14} color={Colors.textSecondary} />
            </Pressable>
          </View>
          <Pressable style={styles.levelRow} onPress={() => go('/seviye')}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Crown size={14} color={Colors.gold} fill={Colors.gold} />
            <VText variant="label" style={{ fontSize: 12 }}>
              Seviye {level.number}
            </VText>
          </Pressable>
          <VText variant="caption">
            {mine ? '' : 'Bu arenada henüz gönderin yok. '}
            {next ? `Sonraki seviyeye ${toNext} puan kaldı.` : 'En üst seviyedesin!'}
          </VText>
        </GlassCard>
      </View>

      {/* Kategoriler */}
      <View style={[styles.pad, { marginTop: Spacing.xl }]}>
        <SectionHeader title="Arena Kategorileri" onAction={() => go('/arena-listesi')} />
        <View style={styles.grid}>
          {arenas.map((c, i) => {
            const selected = c.key === active;
            return (
              <Pressable
                key={c.key}
                onPress={() => onCategory(c.key)}
                onLongPress={() => go(`/arena/${c.key}`)}
                style={[styles.cat, i >= 4 && styles.catWide, selected && styles.catSelected]}>
                <Image source={{ uri: c.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                <BottomFade />
                <VText variant="label" style={styles.catLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {c.name}
                </VText>
              </Pressable>
            );
          })}
        </View>
        <VText variant="caption" style={{ marginTop: 8 }}>
          Seçili kategoriye tekrar dokunarak arenaya girebilirsin.
        </VText>
      </View>

      {/* Seçili arena */}
      <View style={[styles.pad, { marginTop: Spacing.lg }]}>
        <Pressable onPress={() => go(`/arena/${active}`)}>
          <GlassCard style={styles.arenaCard}>
            <Image source={{ uri: arena.image }} style={styles.arenaBg} contentFit="cover" />
            <LinearGradient
              colors={[bgAlpha(1), bgAlpha(0.2)]}
              start={{ x: 0.35, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <VText variant="heading" style={{ fontSize: 21, flexShrink: 1 }} numberOfLines={1}>
                {arena.name} Arenası
              </VText>
              <BadgeCheck size={18} color="#fff" fill={Colors.cyan} />
            </View>
            <VText variant="body" numberOfLines={2}>
              {arena.tagline}
            </VText>
            <View style={styles.arenaFoot}>
              <View style={{ gap: 4 }}>
                <View style={styles.inline}>
                  <Users size={14} color={Colors.textSecondary} />
                  <VText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {formatCount(store.arenaMeta(active).members)} Üye
                  </VText>
                </View>
                <View style={styles.inline}>
                  <MessageCircle size={14} color={Colors.textSecondary} />
                  <VText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
                    {ranked.length} Gönderi
                  </VText>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <PrimaryButton
                label="Gönderi Paylaş"
                icon={<ArrowRight size={16} color={Colors.onCyan} />}
                onPress={() => go(`/olustur?arena=${active}`)}
              />
            </View>
          </GlassCard>
        </Pressable>
      </View>

      {/* Liderlik tablosu */}
      <View style={[styles.pad, { marginTop: Spacing.lg }]}>
        <GlassCard style={{ padding: 12 }}>
          <View style={styles.lbHead}>
            <VText variant="heading">Liderlik Tablosu</VText>
            <Pressable style={[styles.inline, { flexShrink: 1 }]} onPress={() => setPickerOpen((v) => !v)} hitSlop={6}>
              <VText variant="label" color={Colors.cyan} numberOfLines={1} style={{ flexShrink: 1 }}>
                {arena.name} Arenası
              </VText>
              <ChevronDown size={16} color={Colors.cyan} />
            </Pressable>
          </View>
          {pickerOpen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
              {arenas.map((a) => (
                <Chip
                  key={a.key}
                  label={a.name}
                  active={a.key === active}
                  onPress={() => {
                    setActive(a.key);
                    setPickerOpen(false);
                  }}
                />
              ))}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              {top5.map((r) => {
                const u = userById(r.authorId);
                const isMe = r.authorId === ME_ID;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() => go(`/arena/giris/${r.id}`)}
                    style={[styles.lbRow, isMe && styles.lbMe]}>
                    <View style={{ width: 22, alignItems: 'center' }}>
                      {r.rank === 1 ? (
                        <Crown size={18} color={Colors.gold} fill={Colors.gold} />
                      ) : (
                        <VText variant="bodyBold">{r.rank}</VText>
                      )}
                    </View>
                    <Avatar uri={u.avatar} size={28} />
                    <VText variant="label" style={{ flex: 1, fontSize: 12.5 }} numberOfLines={1}>
                      {isMe ? `Sen (${u.name.split(' ')[0]})` : u.name}
                    </VText>
                    <Crown size={12} color={Colors.gold} fill={Colors.gold} />
                    <VText variant="label" style={{ fontSize: 12.5 }}>
                      {formatCount(Math.round(r.totalScore))}
                    </VText>
                  </Pressable>
                );
              })}
              {!top5.length ? (
                <VText variant="caption" style={{ padding: 8 }}>
                  Bu arenada henüz gönderi yok. İlk sen paylaş!
                </VText>
              ) : null}
            </View>
            <Pressable style={styles.lbImage} onPress={() => go(`/liderlik?arena=${active}`)}>
              <Image source={{ uri: arena.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.lbArrow}>
                <ChevronRight size={18} color="#fff" />
              </View>
            </Pressable>
          </View>
          <Pressable style={styles.lbAll} onPress={() => go(`/liderlik?arena=${active}`)}>
            <Trophy size={14} color={Colors.cyan} />
            <VText variant="label" color={Colors.cyan}>
              Tüm sıralamayı gör
            </VText>
          </Pressable>
        </GlassCard>
      </View>

      {/* Tüm arenalar */}
      <View style={[styles.pad, { marginTop: Spacing.xl }]}>
        <SectionHeader title="Tüm Arenalarda Gez" onAction={() => go('/arena-listesi')} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.screen, gap: 8 }}>
        {arenas.map((a) => (
          <Pressable key={a.key} style={styles.tile} onPress={() => go(`/arena/${a.key}`)}>
            <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
            <BottomFade />
            <VText variant="label" style={styles.tileLabel} numberOfLines={1}>
              {a.name}
            </VText>
          </Pressable>
        ))}
      </ScrollView>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  tokenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: Colors.goldSoft,
  },
  rankCard: { padding: 14, marginTop: Spacing.lg, gap: 6 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginVertical: 4 },
  rankBig: { fontFamily: Fonts.extrabold, fontSize: 38, color: Colors.text },
  points: { fontFamily: Fonts.bold, fontSize: 22, color: Colors.text },
  activeArena: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceRaised,
  },
  activeThumb: { width: 44, height: 30, borderRadius: 6 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  fill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.cyan,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cat: {
    width: '23.3%',
    height: 72,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catWide: { width: '31.6%' },
  catSelected: {
    borderColor: Colors.cyan,
    borderWidth: 2,
    shadowColor: Colors.cyan,
    shadowOpacity: 0.7,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  catLabel: { position: 'absolute', left: 6, right: 4, bottom: 6, fontSize: 11, letterSpacing: -0.2 },
  arenaCard: { padding: 16, gap: 4 },
  arenaBg: { position: 'absolute', right: 0, top: 0, bottom: 0, left: 0, opacity: 0.6 },
  arenaFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  lbHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: Radius.sm,
  },
  lbMe: { backgroundColor: Colors.cyanDim, borderWidth: 1, borderColor: Colors.borderStrong },
  lbImage: { width: 96, borderRadius: Radius.md, overflow: 'hidden' },
  lbArrow: {
    position: 'absolute',
    right: 8,
    bottom: '42%',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  lbAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  tile: {
    width: 92,
    height: 104,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileLabel: { position: 'absolute', left: 6, right: 6, bottom: 6, fontSize: 11.5 },
});
