import { router, type Href } from 'expo-router';
import { Coins, Heart, MessageCircle, Package, Trophy, UserPlus, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { notifications, userById, type AppNotification } from '@/data/mock';
import { useStore } from '@/store/app-store';

const KIND: Record<AppNotification['kind'], { Icon: LucideIcon; color: string }> = {
  like: { Icon: Heart, color: Colors.heart },
  comment: { Icon: MessageCircle, color: Colors.cyan },
  follow: { Icon: UserPlus, color: Colors.cyanSoft },
  arena: { Icon: Trophy, color: Colors.gold },
  token: { Icon: Coins, color: Colors.gold },
  order: { Icon: Package, color: Colors.success },
};

export default function Bildirimler() {
  const store = useStore();
  const read = store.state.readNotifications;
  const unreadCount = notifications.filter((n) => !read.includes(n.id)).length;

  const open = (n: AppNotification) => {
    store.markNotificationsRead([n.id]);
    router.push(n.href as Href);
  };

  return (
    <SubScreen
      title="Bildirimler"
      right={
        unreadCount ? (
          <Pressable onPress={() => store.markNotificationsRead(notifications.map((n) => n.id))} hitSlop={8}>
            <VText variant="caption" color={Colors.cyan} style={{ fontFamily: Fonts.semibold }}>
              Tümünü okundu say
            </VText>
          </Pressable>
        ) : null
      }>
      <View style={styles.pad}>
        <VText variant="caption" style={{ marginBottom: Spacing.md }}>
          {unreadCount ? `${unreadCount} okunmamış bildirimin var.` : 'Tüm bildirimleri okudun.'}
        </VText>
        <View style={{ gap: 8 }}>
          {notifications.map((n) => {
            const unread = !read.includes(n.id);
            const { Icon, color } = KIND[n.kind];
            const actor = n.actorId ? userById(n.actorId) : null;
            return (
              <Pressable key={n.id} onPress={() => open(n)}>
                <GlassCard highlighted={unread} style={styles.row}>
                  <View>
                    {actor ? (
                      <Avatar uri={actor.avatar} size={44} />
                    ) : (
                      <View style={[styles.iconCircle, { borderColor: color }]}>
                        <Icon size={20} color={color} />
                      </View>
                    )}
                    {actor ? (
                      <View style={[styles.kindBadge, { backgroundColor: color }]}>
                        <Icon size={10} color="#fff" fill={n.kind === 'like' ? '#fff' : 'transparent'} />
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <VText color={Colors.text} style={unread ? { fontFamily: Fonts.semibold } : undefined}>
                      {n.text}
                    </VText>
                    <VText variant="caption">{n.time} önce</VText>
                  </View>
                  {unread ? <View style={styles.dot} /> : null}
                </GlassCard>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceStrong,
  },
  kindBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.bg,
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.cyan },
});
