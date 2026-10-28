/**
 * Gerçek (Supabase) kullanıcının profil sayfası: bilgiler, sayılar, paylaşımlar,
 * Takip Et / İstek Gönderildi / Takip Ediliyor, Mesaj, Engelle ve Şikayet.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import {
  BadgeCheck,
  Ban,
  BellOff,
  Clock,
  Flag,
  ImageOff,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PlayCircle,
  ShieldMinus,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ReportSheet, type ReportTarget } from '@/components/report-sheet';
import { Avatar, GlassCard, OutlineButton, PrimaryButton } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Post } from '@/data/mock';
import { fetchPosts } from '@/lib/posts-api';
import { fetchProfile, setBlocked, type RealProfile } from '@/lib/social-api';
import { formatCount, useStore } from '@/store/app-store';

export function RealProfileScreen({ id }: { id: string }) {
  const store = useStore();
  const [profile, setProfile] = useState<RealProfile | null | undefined>(undefined);
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const status = store.followStatus(id);

  const load = useCallback(async () => {
    const [p, list] = await Promise.all([fetchProfile(id), fetchPosts(store.myId ?? '', { authorId: id })]);
    if (!p.ok) {
      setError(p.error);
      return;
    }
    setProfile(p.data);
    if (list.ok) setPosts(list.data.posts);
  }, [id, store.myId]);

  // Takip durumu değişince (ör. istek onaylanınca) sayılar ve gizli gönderiler yeniden yüklensin
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchProfile(id), fetchPosts(store.myId ?? '', { authorId: id })]).then(([p, list]) => {
      if (cancelled) return;
      if (!p.ok) {
        setError(p.error);
        return;
      }
      setProfile(p.data);
      if (list.ok) setPosts(list.data.posts);
    });
    return () => {
      cancelled = true;
    };
  }, [id, store.myId, status]);

  if (profile === undefined && !error) {
    return (
      <SubScreen title="Profil">
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </SubScreen>
    );
  }

  if (!profile) {
    return (
      <SubScreen title="Profil">
        <EmptyState
          icon={<Users size={40} color={Colors.textMuted} />}
          title="Kullanıcı bulunamadı"
          text={error ?? 'Bu hesap kaldırılmış ya da sana görünmüyor olabilir.'}
          action={<OutlineButton label="Aramaya Git" onPress={() => router.replace('/arama' as Href)} />}
        />
      </SubScreen>
    );
  }

  const locked = profile.isPrivate && status !== 'accepted';

  const onFollow = async () => {
    const res = await store.toggleFollow(id);
    if (!res.ok) setNotice(res.error ?? 'İşlem yapılamadı.');
  };

  const onRelation = async (kind: 'mutes' | 'restricts') => {
    setMenuOpen(false);
    const res = await store.toggleRelation(kind, id);
    if (!res.ok) {
      setNotice(res.error ?? 'İşlem yapılamadı.');
      return;
    }
    setNotice(
      kind === 'mutes'
        ? res.on
          ? `${profile.name} sessize alındı. Gönderileri ve anları akışında görünmeyecek; bundan haberi olmaz.`
          : `${profile.name} artık sessizde değil.`
        : res.on
          ? `${profile.name} kısıtlandı. Gönderilerine yaptığı yorumları yalnızca o ve sen görürsün; bildirim gelmez.`
          : `${profile.name} için kısıtlama kaldırıldı.`,
    );
  };

  const onBlock = async () => {
    setMenuOpen(false);
    if (!store.myId) return;
    const res = await setBlocked(store.myId, id, true);
    if (!res.ok) {
      setNotice(res.error);
      return;
    }
    await store.refreshFeed();
    setNotice(`${profile.name} engellendi. Artık birbirinizin içeriğini görmeyeceksiniz.`);
    load();
  };

  return (
    <SubScreen
      title={`@${profile.username}`}
      right={
        <Pressable onPress={() => setMenuOpen((v) => !v)} hitSlop={10} accessibilityLabel="Seçenekler">
          <MoreHorizontal size={22} color={Colors.text} />
        </Pressable>
      }>
      {menuOpen ? (
        <View style={styles.menu}>
          <Pressable style={styles.menuItem} onPress={() => onRelation('mutes')}>
            <BellOff size={16} color={Colors.text} />
            <VText variant="label">{store.mutedIds.includes(id) ? 'Sessizden çıkar' : 'Sessize al'}</VText>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => onRelation('restricts')}>
            <ShieldMinus size={16} color={Colors.text} />
            <VText variant="label">{store.restrictedIds.includes(id) ? 'Kısıtlamayı kaldır' : 'Kısıtla'}</VText>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={() => { setMenuOpen(false); setReportTarget({ type: 'user', id }); }}>
            <Flag size={16} color={Colors.live} />
            <VText variant="label" color={Colors.live}>Şikayet et</VText>
          </Pressable>
          <Pressable style={styles.menuItem} onPress={onBlock}>
            <Ban size={16} color={Colors.live} />
            <VText variant="label" color={Colors.live}>Engelle</VText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.top}>
        {profile.cover ? <Image source={{ uri: profile.cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <LinearGradient colors={['rgba(4,10,23,0.35)', Colors.bg]} style={StyleSheet.absoluteFill} />
        <View style={styles.topRow}>
          <Avatar uri={profile.avatar} size={92} ring />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <VText variant="heading" style={{ fontSize: 22, lineHeight: 28, flexShrink: 1 }} numberOfLines={1}>
                {profile.name}
              </VText>
              {profile.verified ? <BadgeCheck size={20} color="#fff" fill={Colors.cyan} /> : null}
              {profile.isPrivate ? <Lock size={16} color={Colors.textSecondary} /> : null}
            </View>
            <VText>@{profile.username}</VText>
            {profile.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={13} color={Colors.cyan} />
                <VText variant="caption" color={Colors.textSecondary}>
                  {profile.location}
                </VText>
              </View>
            ) : null}
          </View>
        </View>
        {profile.bio ? (
          <VText color={Colors.text} style={{ marginTop: 12 }}>
            {profile.bio}
          </VText>
        ) : null}
        <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
          {status === 'accepted' ? (
            <OutlineButton label="Takip Ediliyor" iconLeft={<UserCheck size={16} color={Colors.text} />} onPress={onFollow} style={{ flex: 1 }} />
          ) : status === 'pending' ? (
            <OutlineButton label="İstek Gönderildi" iconLeft={<Clock size={16} color={Colors.text} />} onPress={onFollow} style={{ flex: 1 }} />
          ) : (
            <PrimaryButton label="Takip Et" icon={<UserPlus size={16} color={Colors.onCyan} />} onPress={onFollow} style={{ flex: 1 }} />
          )}
          <OutlineButton
            label="Mesaj"
            iconLeft={<MessageCircle size={16} color={Colors.text} />}
            onPress={() => router.push(`/mesaj/kisi/${id}` as Href)}
            style={{ flex: 1 }}
          />
        </View>
        {notice ? (
          <VText variant="caption" color={Colors.cyan} style={{ marginTop: 8 }}>
            {notice}
          </VText>
        ) : null}
      </View>

      <View style={styles.pad}>
        <GlassCard style={styles.stats}>
          <Stat value={formatCount(profile.discoveryPoints)} label="Keşif Puanı" icon={<Sparkles size={16} color={Colors.gold} />} />
          <Stat
            value={formatCount(profile.followers)}
            label="Takipçi"
            icon={<Users size={16} color={Colors.cyanSoft} />}
            onPress={locked ? undefined : () => router.push(`/takip?user=${id}&tab=takipciler` as Href)}
          />
          <Stat
            value={formatCount(profile.following)}
            label="Takip"
            icon={<UserCheck size={16} color={Colors.cyanSoft} />}
            onPress={locked ? undefined : () => router.push(`/takip?user=${id}&tab=takip` as Href)}
          />
          <Stat value={String(posts.length)} label="Gönderi" icon={<PlayCircle size={16} color={Colors.cyanSoft} />} />
        </GlassCard>

        <VText variant="heading" style={styles.h}>
          Paylaşımlar
        </VText>
        {locked ? (
          <EmptyState
            icon={<Lock size={40} color={Colors.textSecondary} />}
            title="Bu hesap gizli"
            text={
              status === 'pending'
                ? 'Takip isteğin gönderildi. Onaylanınca paylaşımlarını görebileceksin.'
                : 'Paylaşımlarını görmek için takip et.'
            }
          />
        ) : posts.length ? (
          <View style={styles.grid}>
            {posts.map((p) => {
              const cover = p.media[0];
              const uri = cover ? (cover.type === 'video' ? cover.poster ?? cover.uri : cover.uri) : '';
              return (
                <Pressable key={p.id} style={styles.gridItem} onPress={() => router.push(`/gonderi/${p.id}` as Href)}>
                  {cover?.type === 'video' && !cover.poster ? (
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.surfaceStrong }]} />
                  ) : uri ? (
                    <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : null}
                  {cover?.type === 'video' ? (
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

      <ReportSheet target={reportTarget} onClose={() => setReportTarget(null)} />
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
  top: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.xl, paddingBottom: Spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  pad: { paddingHorizontal: Spacing.screen },
  stats: { flexDirection: 'row', paddingVertical: 14 },
  h: { marginTop: Spacing.xl, marginBottom: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  gridItem: { width: '32%', aspectRatio: 0.8, borderRadius: Radius.sm, overflow: 'hidden' },
  menu: {
    marginHorizontal: Spacing.screen,
    marginTop: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
    paddingVertical: 4,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
});
