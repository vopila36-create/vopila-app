import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { BadgeCheck, ImageOff, Lock, MapPin, PlayCircle, Sparkles, Trophy, UserCheck, UserPlus, Users } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { RealProfileScreen } from '@/components/real-profile';
import { Avatar, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { isRealId } from '@/lib/social-api';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { OnDark, VText } from '@/components/ui/text';
import { Colors, OnImage, Radius, scrim, Spacing } from '@/constants/theme';
import { arenaByKey, arenaEntries, earnedBadgesOf, followerIdsOf, followingIdsOf, ME_ID, privateUserIds, users } from '@/data/mock';
import { formatCount, useStore } from '@/store/app-store';

export default function KullaniciProfil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const store = useStore();
  // Örnek kişiler yalnızca oturumsuz önizlemede; oturumda yalnızca gerçek profiller açılır
  const user = store.myId ? undefined : users.find((u) => u.id === id);

  const isMe = id === ME_ID || (!!store.myId && id === store.myId);
  useEffect(() => {
    if (isMe) router.replace('/profil' as Href);
  }, [isMe]);

  // Gerçek kullanıcı (Supabase) → sunucudan yüklenen profil
  if (!isMe && isRealId(String(id))) return <RealProfileScreen id={String(id)} />;

  if (!user || isMe) {
    return (
      <SubScreen title="Profil">
        <EmptyState
          icon={<Users size={40} color={Colors.textMuted} />}
          title="Kullanıcı bulunamadı"
          action={<OutlineButton label="Aramaya Git" onPress={() => router.replace('/arama' as Href)} />}
        />
      </SubScreen>
    );
  }

  const following = store.isFollowing(user.id);
  const userPosts = store.allPosts.filter((p) => p.authorId === user.id);
  const userBadges = earnedBadgesOf(user.id);
  const arenaKeys = Array.from(new Set(arenaEntries.filter((e) => e.authorId === user.id).map((e) => e.arenaKey)));

  return (
    <SubScreen title={`@${user.username}`}>
      <View style={styles.top}>
        <Image source={{ uri: user.cover }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={[scrim(0.35), scrim(0.92)]} style={StyleSheet.absoluteFill} />
        <OnDark>
        <View style={styles.topRow}>
          <Avatar uri={user.avatar} size={92} ring />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <VText variant="heading" style={{ fontSize: 22, lineHeight: 28 }}>
                {user.name}
              </VText>
              {user.verified ? <BadgeCheck size={20} color="#fff" fill={OnImage.accent} /> : null}
              {privateUserIds.includes(user.id) ? <Lock size={16} color={OnImage.textSecondary} /> : null}
            </View>
            <VText>@{user.username}</VText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <MapPin size={13} color={OnImage.accent} />
              <VText variant="caption" color={OnImage.textSecondary}>
                {user.location}
              </VText>
            </View>
          </View>
        </View>
        <VText color={OnImage.text} style={{ marginTop: 12 }}>
          {user.bio}
        </VText>
        <View style={{ marginTop: 14 }}>
          {following ? (
            <OutlineButton
              label="Takip Ediliyor"
              iconLeft={<UserCheck size={16} color={OnImage.text} />}
              onPress={() => store.toggleFollow(user.id)}
            />
          ) : (
            <PrimaryButton
              label="Takip Et"
              icon={<UserPlus size={16} color={Colors.onCyan} />}
              onPress={() => store.toggleFollow(user.id)}
            />
          )}
        </View>
        </OnDark>
      </View>

      <View style={styles.pad}>
        <GlassCard style={styles.stats}>
          <Stat value={formatCount(user.discoveryPoints)} label="Keşif Puanı" icon={<Sparkles size={16} color={Colors.gold} />} />
          <Stat
            value={formatCount(followerIdsOf(user.id).length + (following ? 1 : 0))}
            label="Takipçi"
            icon={<Users size={16} color={Colors.cyanSoft} />}
            onPress={() => router.push(`/takip?user=${user.id}&tab=takipciler` as Href)}
          />
          <Stat
            value={formatCount(followingIdsOf(user.id).length)}
            label="Takip"
            icon={<UserCheck size={16} color={Colors.cyanSoft} />}
            onPress={() => router.push(`/takip?user=${user.id}&tab=takip` as Href)}
          />
          <Stat value={String(userPosts.length)} label="Gönderi" icon={<PlayCircle size={16} color={Colors.cyanSoft} />} />
        </GlassCard>

        {arenaKeys.length ? (
          <>
            <VText variant="heading" style={styles.h}>
              Yarıştığı Arenalar
            </VText>
            <View style={styles.chips}>
              {arenaKeys.map((k) => (
                <Pressable key={k} style={styles.arenaChip} onPress={() => router.push(`/arena/${k}` as Href)}>
                  <Trophy size={14} color={Colors.gold} />
                  <VText variant="label">{arenaByKey(k).name} Arenası</VText>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {userBadges.length ? (
          <>
            <View style={[styles.h, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
              <VText variant="heading">Arena Başarıları</VText>
              <Pressable onPress={() => router.push(`/rozetler?user=${user.id}` as Href)} hitSlop={8}>
                <VText variant="label" color={Colors.cyan}>
                  Tümünü Gör
                </VText>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              {userBadges.map((b) => (
                <Pressable key={b.id} style={styles.badgeItem} onPress={() => router.push(`/rozetler?user=${user.id}` as Href)}>
                  <View style={styles.badge}>
                    <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  </View>
                  <VText variant="caption" color={Colors.text} style={{ textAlign: 'center', fontSize: 11 }} numberOfLines={2}>
                    {b.name}
                  </VText>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <VText variant="heading" style={styles.h}>
          Paylaşımlar
        </VText>
        {userPosts.length ? (
          <View style={styles.grid}>
            {userPosts.map((p) => {
              const cover = p.media[0];
              const uri = cover.type === 'video' ? cover.poster ?? cover.uri : cover.uri;
              return (
                <Pressable key={p.id} style={styles.gridItem} onPress={() => router.push(`/gonderi/${p.id}` as Href)}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  {cover.type === 'video' ? (
                    <View style={{ position: 'absolute', top: 6, left: 6 }}>
                      <PlayCircle size={20} color="#fff" />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <EmptyState icon={<ImageOff size={36} color={Colors.textMuted} />} title="Henüz paylaşım yok" />
        )}
      </View>
    </SubScreen>
  );
}

function Stat({ value, label, icon, onPress }: { value: string; label: string; icon: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      {icon}
      <VText variant="bodyBold">{value}</VText>
      <VText variant="caption" style={{ fontSize: 10.5 }}>
        {label}
      </VText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeItem: { width: 72, alignItems: 'center', gap: 6 },
  badge: { width: 60, height: 60, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: Colors.gold },
  top: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pad: { paddingHorizontal: Spacing.screen },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  h: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  arenaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(245,182,66,0.5)',
    backgroundColor: Colors.goldSoft,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridItem: { width: '32%', aspectRatio: 0.8, borderRadius: Radius.sm, overflow: 'hidden' },
});
