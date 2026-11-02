/** Bildirim ayarları: hangi olaylarda bildirim gelsin (sunucuda uygulanır) + telefon tercihleri. */
import { AtSign, CornerDownRight, Heart, MessageCircle, UserPlus } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Section, ToggleRow } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import type { NotifKind } from '@/lib/settings-api';
import { useMySettings } from '@/store/use-settings';

const KINDS: { key: NotifKind; label: string; desc: string; icon: React.ReactNode }[] = [
  { key: 'like', label: 'Beğeniler', desc: 'Gönderin beğenildiğinde', icon: <Heart size={20} color={Colors.heart} /> },
  { key: 'comment', label: 'Yorumlar', desc: 'Gönderine yorum yapıldığında', icon: <MessageCircle size={20} color={Colors.cyan} /> },
  { key: 'reply', label: 'Yanıtlar', desc: 'Yorumuna yanıt verildiğinde', icon: <CornerDownRight size={20} color={Colors.cyan} /> },
  { key: 'mention', label: 'Bahsetmeler', desc: 'Biri senden @ ile bahsettiğinde', icon: <AtSign size={20} color={Colors.cyan} /> },
  { key: 'follow', label: 'Takipçiler', desc: 'Yeni takipçi ve takip istekleri', icon: <UserPlus size={20} color={Colors.cyanSoft} /> },
];

export default function BildirimAyarlari() {
  const { myId, settings, save, error } = useMySettings();

  return (
    <SubScreen title="Bildirimler">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        {/* Telefon bildirimleri (push) henüz yok; gelince "Tüm bildirimler" ve arena hatırlatmaları buraya eklenecek */}
        <VText variant="caption" style={{ marginBottom: Spacing.md }}>
          Bildirimler şimdilik uygulama içinde görünür. Telefon bildirimleri (uygulama kapalıyken) yakında geliyor.
        </VText>

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
