/** Bildirim ayarları: hangi olaylarda bildirim gelsin (sunucuda uygulanır) + telefon tercihleri. */
import { AtSign, Bell, CornerDownRight, Heart, MessageCircle, Trophy, UserPlus } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Section, ToggleRow } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { NotifKind } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';
import { useMySettings } from '@/store/use-settings';

const KINDS: { key: NotifKind; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'like', label: 'Beğeniler', desc: 'Gönderin beğenildiğinde', icon: <Heart size={20} color={Colors.heart} /> },
  { key: 'comment', label: 'Yorumlar', desc: 'Gönderine yorum yapıldığında', icon: <MessageCircle size={20} color={Colors.cyan} /> },
  { key: 'reply', label: 'Yanıtlar', desc: 'Yorumuna yanıt verildiğinde', icon: <CornerDownRight size={20} color={Colors.cyan} /> },
  { key: 'mention', label: 'Bahsetmeler', desc: 'Biri senden @ ile bahsettiğinde', icon: <AtSign size={20} color={Colors.cyan} /> },
  { key: 'follow', label: 'Takipçiler', desc: 'Yeni takipçi ve takip istekleri', icon: <UserPlus size={20} color={Colors.cyanSoft} /> },
];

export default function BildirimAyarlari() {
  const store = useStore();
  const { myId, settings, save, error } = useMySettings();

  return (
    <SubScreen title="Bildirimler">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Telefon">
          <ToggleRow
            icon={<Bell size={20} color={Colors.cyan} />}
            label="Tüm bildirimler"
            desc="Kapatırsan hiçbir bildirim gösterilmez"
            value={store.state.settings.pushNotifications}
            onChange={(v) => store.updateSettings({ pushNotifications: v })}
          />
          <ToggleRow
            icon={<Trophy size={20} color={Colors.gold} />}
            label="Arena hatırlatmaları"
            desc="Sezon bitişi ve oylama hatırlatmaları"
            value={store.state.settings.arenaReminders}
            onChange={(v) => store.updateSettings({ arenaReminders: v })}
            last
          />
        </Section>

        {!myId ? (
          <VText variant="caption" style={{ marginTop: Spacing.lg }}>
            Ayrıntılı bildirim ayarları için giriş yapmalısın.
          </VText>
        ) : !settings ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 30 }} />
        ) : (
          <Section title="Etkileşimler" note="Kapattığın türde bildirim oluşturulmaz.">
            {KINDS.map((k, i) => (
              <ToggleRow
                key={k.key}
                icon={k.icon}
                label={k.label}
                desc={k.desc}
                value={settings.notif[k.key] !== false}
                onChange={(v) => save({ notif: { ...settings.notif, [k.key]: v } })}
                last={i === KINDS.length - 1}
              />
            ))}
          </Section>
        )}
        {error ? (
          <VText variant="caption" color={Colors.live} style={{ marginTop: 8 }}>
            {error}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}
