/** Yönetici: denetim kaydı — panelde ve sistemde yapılan önemli işlemler. */
import { useFocusEffect } from 'expo-router';
import { History } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AdminScreen, Notice } from '@/components/admin-ui';
import { GlassCard } from '@/components/ui/primitives';
import { EmptyState } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { fetchAuditLog, type AuditRow } from '@/lib/admin-api';

const ACTION: Record<string, string> = {
  order_update: 'Sipariş güncellendi',
  product_upsert: 'Ürün kaydedildi',
  news_upsert: 'Haber kaydedildi',
  news_delete: 'Haber silindi',
  arena_update: 'Arena güncellendi',
  ticket_answer: 'Destek yanıtlandı',
  reward_approved: 'Ödül onaylandı',
  reward_rejected: 'Ödül reddedildi',
  report_remove: 'Şikayet: içerik kaldırıldı',
  report_dismiss: 'Şikayet reddedildi',
  account_deleted: 'Hesap silindi (kullanıcı)',
  invites_created: 'Beta daveti oluşturuldu',
  invite_revoked: 'Beta daveti iptal edildi',
  beta_invite_required: 'Kapalı beta ayarı değişti',
};
const label = (a: string) => ACTION[a] ?? (a.startsWith('user_status:') ? `Hesap durumu: ${a.split(':')[1]}` : a);

export default function YonetimKayitlar() {
  const [list, setList] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchAuditLog().then((r) => {
        if (!alive) return;
        if (r.ok) setList(r.data);
        else setError(r.error);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <AdminScreen title="Denetim Kaydı">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Notice text={error} />
        {list === null ? (
          <ActivityIndicator color={Colors.cyan} style={{ marginTop: 40 }} />
        ) : list.length ? (
          <GlassCard>
            {list.map((r, i) => (
              <View key={r.id} style={[styles.row, i === list.length - 1 && { borderBottomWidth: 0 }]}>
                <VText variant="label">{label(r.action)}</VText>
                <VText variant="caption">
                  {r.date} · @{r.actor}
                  {r.targetType ? ` · ${r.targetType} ${r.targetId?.slice(0, 8) ?? ''}` : ''}
                </VText>
              </View>
            ))}
          </GlassCard>
        ) : (
          <EmptyState icon={<History size={40} color={Colors.textMuted} />} title="Kayıt yok" />
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  row: { padding: 12, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 2 },
});
