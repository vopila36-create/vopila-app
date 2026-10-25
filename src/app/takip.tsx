/**
 * Takipçilerim / Takip Ettiklerim listeleri (profildeki "Takipçi" ve "Takip" rakamlarından açılır).
 */
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ChevronRight, Lock, Search, UserPlus, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { EmptyState, SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import {
  followerIdsOf,
  followingIdsOf,
  ME_ID,
  myFollowerIds,
  privateUserIds,
  userById,
  users,
} from '@/data/mock';
import { useStore } from '@/store/app-store';

type Tab = 'takipciler' | 'takip';

const normalize = (s: string) => s.toLocaleLowerCase('tr-TR');

export default function Takip() {
  const params = useLocalSearchParams<{ tab?: string; user?: string }>();
  const store = useStore();
  const [tab, setTab] = useState<Tab>(params.tab === 'takip' ? 'takip' : 'takipciler');
  const [query, setQuery] = useState('');

  const ownerId = params.user && users.some((u) => u.id === params.user) ? params.user : ME_ID;
  const isMe = ownerId === ME_ID;
  const owner = userById(ownerId);
  // Gizli hesap: listeleri yalnızca hesap sahibi ve onu takip edenler görür
  const locked = !isMe && privateUserIds.includes(ownerId) && !store.isFollowing(ownerId);

  const byIds = (ids: string[]) => ids.map((id) => userById(id));
  const followers = isMe
    ? byIds(myFollowerIds)
    : byIds([...followerIdsOf(ownerId), ...(store.isFollowing(ownerId) ? [ME_ID] : [])]);
  const following = isMe
    ? users.filter((u) => u.id !== ME_ID && store.isFollowing(u.id))
    : byIds(followingIdsOf(ownerId));

  const list = (tab === 'takipciler' ? followers : following).filter((u) => {
    const q = normalize(query.trim());
    return !q || normalize(u.name).includes(q) || normalize(u.username).includes(q);
  });

  const labels = isMe
    ? { followers: 'Takipçilerim', following: 'Takip Ettiklerim' }
    : { followers: 'Takipçiler', following: 'Takip Edilenler' };

  if (locked) {
    return (
      <SubScreen title={`@${owner.username}`}>
        <EmptyState
          icon={<Lock size={44} color={Colors.textSecondary} />}
          title="Bu hesap gizli"
          text={`${owner.name} adlı kişinin takipçi ve takip listelerini görmek için onu takip etmelisin.`}
          action={
            <Pressable onPress={() => store.toggleFollow(ownerId)} style={[styles.followBtn, { height: 40, paddingHorizontal: 20 }]}>
              <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                Takip Et
              </VText>
            </Pressable>
          }
        />
      </SubScreen>
    );
  }

  return (
    <SubScreen title={isMe ? 'Takip' : `@${owner.username}`}>
      <View style={styles.pad}>
        {/* Sekmeler */}
        <View style={styles.segment}>
          {(
            [
              ['takipciler', `${labels.followers} (${followers.length})`],
              ['takip', `${labels.following} (${following.length})`],
            ] as const
          ).map(([key, label]) => {
            const active = tab === key;
            return (
              <Pressable key={key} onPress={() => setTab(key)} style={[styles.segmentItem, active && styles.segmentActive]}>
                <VText
                  variant="label"
                  numberOfLines={1}
                  color={active ? Colors.onCyan : Colors.text}
                  style={active ? { fontFamily: Fonts.bold } : undefined}>
                  {label}
                </VText>
              </Pressable>
            );
          })}
        </View>

        {/* Arama */}
        <View style={styles.search}>
          <Search size={18} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kişi ara"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
          />
        </View>

        {list.length ? (
          <GlassCard>
            {list.map((u, i) => {
              const isSelf = u.id === ME_ID;
              const iFollow = store.isFollowing(u.id);
              const followsMe = myFollowerIds.includes(u.id);
              return (
                <View key={u.id} style={[styles.person, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                  <Pressable
                    style={styles.personMain}
                    onPress={() => router.push((isSelf ? '/profil' : `/kullanici/${u.id}`) as Href)}>
                    <Avatar uri={isSelf ? store.state.profile.avatar : u.avatar} size={44} />
                    <View style={{ flex: 1 }}>
                      <VText variant="label" numberOfLines={1}>
                        {isSelf ? `${store.state.profile.name} (Sen)` : u.name}
                      </VText>
                      <VText variant="caption" numberOfLines={1}>
                        @{isSelf ? store.state.profile.username : u.username}
                        {!isSelf && followsMe && !(isMe && tab === 'takipciler') ? ' · Seni takip ediyor' : ''}
                      </VText>
                    </View>
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </Pressable>
                  {isSelf ? null : (
                  <Pressable
                    onPress={() => store.toggleFollow(u.id)}
                    style={[styles.followBtn, iFollow && styles.followingBtn]}
                    accessibilityLabel={iFollow ? 'Takipten çık' : 'Takip et'}>
                    <VText variant="caption" color={iFollow ? Colors.text : Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                      {iFollow
                        ? isMe && tab === 'takip'
                          ? 'Takipten çık'
                          : 'Takip ediliyor'
                        : followsMe
                          ? 'Geri takip et'
                          : 'Takip et'}
                    </VText>
                  </Pressable>
                  )}
                </View>
              );
            })}
          </GlassCard>
        ) : query.trim() ? (
          <EmptyState icon={<Search size={40} color={Colors.cyan} />} title="Sonuç bulunamadı" text={`"${query.trim()}" ile eşleşen kimse yok.`} />
        ) : tab === 'takipciler' ? (
          <EmptyState icon={<Users size={40} color={Colors.cyan} />} title="Henüz takipçin yok" text="Paylaşım yaptıkça ve arenalarda yarıştıkça seni takip edenler burada görünecek." />
        ) : (
          <EmptyState
            icon={<UserPlus size={40} color={Colors.cyan} />}
            title="Henüz kimseyi takip etmiyorsun"
            text="Yeni kâşifleri keşfetmek için aramayı kullan."
            action={
              <Pressable onPress={() => router.push('/arama' as Href)}>
                <VText variant="label" color={Colors.cyan}>
                  Kişi ara
                </VText>
              </Pressable>
            }
          />
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen, paddingTop: Spacing.sm, gap: Spacing.md },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentItem: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, paddingHorizontal: 6 },
  segmentActive: { backgroundColor: Colors.cyan },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { flex: 1, color: Colors.text, fontFamily: Fonts.medium, fontSize: 14 },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  personMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  followBtn: { paddingHorizontal: 12, height: 32, borderRadius: Radius.pill, backgroundColor: Colors.cyan, justifyContent: 'center' },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: Colors.borderStrong },
});
