/**
 * Hesap durumu (Instagram "Hesap Durumu" benzeri): kısıtlama, son 1 yıldaki ihlaller ve ceza basamakları.
 * Ceza kuralları sunucuda (0020_moderation.sql).
 */
import { router, useFocusEffect, type Href } from 'expo-router';
import { CircleAlert, CircleCheck, ShieldAlert } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { GlassCard, OutlineButton } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Strike = { reason: string; type: string | null; severe: boolean; at: string; expires: string };
type Status = { status: 'active' | 'suspended' | 'banned'; suspendedUntil: string | null; count: number; strikes: Strike[] };

const LADDER = ['Uyarı', '1 gün kısıtlama', '3 gün kısıtlama', '7 gün kısıtlama', '30 gün kısıtlama', 'Hesap kapatılır'];
const date = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const TYPE: Record<string, string> = { post: 'Gönderi', comment: 'Yorum', moment: 'An', user: 'Hesap', live: 'Canlı yayın' };

export default function HesapDurumu() {
  const [data, setData] = useState<Status | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    supabase.rpc('my_account_status').then(({ data: rows, error }) => {
      if (!alive) return;
      const r = !error && rows?.[0];
      setData(
        r
          ? { status: r.status, suspendedUntil: r.suspended_until, count: r.strike_count, strikes: r.strikes ?? [] }
          : null,
      );
    });
    return () => {
      alive = false;
    };
  }, [version]);
  useFocusEffect(useCallback(() => setVersion((v) => v + 1), []));

  return (
    <SubScreen title="Hesap durumu">
      <View style={{ paddingHorizontal: Spacing.screen, gap: Spacing.lg }}>
        {data === undefined ? (
          <ActivityIndicator color={Colors.cyan} />
        ) : data === null ? (
          <VText>Hesap durumu şu an alınamadı. İnternet bağlantını kontrol et.</VText>
        ) : (
          <>
            <GlassCard style={{ padding: 16, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {data.status === 'active' ? (
                  <CircleCheck size={26} color={Colors.success} />
                ) : (
                  <ShieldAlert size={26} color={data.status === 'banned' ? Colors.live : Colors.gold} />
                )}
                <VText variant="bodyBold" style={{ flex: 1 }}>
                  {data.status === 'active'
                    ? 'Hesabında sorun yok'
                    : data.status === 'banned'
                      ? 'Hesabın kapatıldı'
                      : 'Hesabın kısıtlandı'}
                </VText>
              </View>
              {data.status === 'suspended' ? (
                <VText variant="body">
                  {data.suspendedUntil
                    ? `${dateTime(data.suspendedUntil)} tarihine kadar paylaşım yapamaz, yorum ve mesaj gönderemezsin.`
                    : 'Destek ekibi inceleme yapana kadar paylaşım yapamaz, yorum ve mesaj gönderemezsin.'}
                </VText>
              ) : null}
              <VText variant="caption">Son 1 yıldaki ihlal sayın: {data.count}</VText>
            </GlassCard>

            {data.strikes.length ? (
              <View style={{ gap: 8 }}>
                <VText variant="heading">Kaldırılan içeriklerin</VText>
                {data.strikes.map((s) => (
                  <GlassCard key={s.at} style={{ padding: 12, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <CircleAlert size={16} color={s.severe ? Colors.live : Colors.gold} />
                      <VText variant="label" style={{ flex: 1 }}>
                        {(s.type && TYPE[s.type]) || 'İçerik'} · {s.reason}
                      </VText>
                    </View>
                    <VText variant="caption">
                      {date(s.at)} · {s.severe ? 'ağır ihlal' : `${date(s.expires)} tarihinde sayımdan düşer`}
                    </VText>
                  </GlassCard>
                ))}
              </View>
            ) : null}

            <View style={{ gap: 6 }}>
              <VText variant="heading">Nasıl işler?</VText>
              <VText variant="body" color={Colors.textSecondary}>
                Topluluk kurallarına aykırı bir içeriğin kaldırıldığında hesabına bir ihlal yazılır. İhlaller 1 yıl sayılır:
              </VText>
              {LADDER.map((l, i) => (
                <VText key={l} variant="body">
                  {i + 1}. ihlal: {l}
                </VText>
              ))}
              <VText variant="caption">
                Çocuk güvenliği ve terör propagandası gibi ağır ihlallerde hesap ilk seferde kapatılır. Kısıtlamada hesabını
                görebilir ama paylaşım, yorum ve mesaj gönderemezsin.
              </VText>
            </View>

            <OutlineButton label="Karara itiraz et" onPress={() => router.push('/destek' as Href)} />
            <OutlineButton label="Topluluk kuralları" onPress={() => router.push('/topluluk-kurallari' as Href)} />
          </>
        )}
      </View>
    </SubScreen>
  );
}
