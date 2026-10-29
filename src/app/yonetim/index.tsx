/** Yönetici paneli ana sayfa: özet sayılar + bölümler. */
import { router, useFocusEffect, type Href } from 'expo-router';
import {
  Award,
  FileText,
  Flag,
  History,
  LifeBuoy,
  Newspaper,
  Package,
  ShoppingBag,
  Ticket,
  Trophy,
  Users,
} from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AdminScreen, Notice } from '@/components/admin-ui';
import { Row, Section } from '@/components/settings-ui';
import { GlassCard } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { fetchOverview, type Overview } from '@/lib/admin-api';

const go = (p: string) => router.push(p as Href);

export default function YonetimAna() {
  const [o, setO] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchOverview().then((r) => {
        if (!alive) return;
        if (r.ok) setO(r.data);
        else setError(r.error);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const tile = (label: string, value: number | undefined, warn?: boolean) => (
    <GlassCard style={styles.tile}>
      <VText style={[styles.num, warn && value ? { color: Colors.live } : null]}>{value ?? '—'}</VText>
      <VText variant="caption" style={{ textAlign: 'center' }}>
        {label}
      </VText>
    </GlassCard>
  );

  return (
    <AdminScreen title="Yönetici Paneli">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Notice text={error} />
        <View style={styles.grid}>
          {tile('Kullanıcı', o?.users)}
          {tile('Bugün katılan', o?.users_today)}
          {tile('Bugün gönderi', o?.posts_today)}
          {tile('Açık şikayet', o?.open_reports, true)}
          {tile('Bekleyen ödül', o?.pending_rewards, true)}
          {tile('Hazırlanacak sipariş', o?.orders_preparing, true)}
          {tile('Sorunlu sipariş', o?.orders_problem, true)}
          {tile('Açık destek', o?.open_tickets, true)}
          {tile('Kısıtlı hesap', o?.suspended)}
        </View>

        <Section title="Mağaza">
          <Row icon={<ShoppingBag size={20} color={Colors.gold} />} label="Siparişler ve kargo" value={o?.orders_preparing ? `${o.orders_preparing} bekliyor` : undefined} onPress={() => go('/yonetim/siparisler')} />
          <Row icon={<Package size={20} color={Colors.cyanSoft} />} label="Ürünler" onPress={() => go('/yonetim/urunler')} last />
        </Section>

        <Section title="Topluluk">
          <Row icon={<Ticket size={20} color={Colors.cyan} />} label="Beta davetleri" onPress={() => go('/yonetim/davetler')} />
          <Row icon={<Flag size={20} color={Colors.live} />} label="Şikayet kuyruğu" value={o?.open_reports ? `${o.open_reports}` : undefined} onPress={() => go('/yonetim/sikayetler')} />
          <Row icon={<Users size={20} color={Colors.cyan} />} label="Kullanıcılar (askı / yasak)" onPress={() => go('/yonetim/kullanicilar')} />
          <Row icon={<LifeBuoy size={20} color={Colors.cyan} />} label="Destek talepleri" value={o?.open_tickets ? `${o.open_tickets} açık` : undefined} onPress={() => go('/yonetim/destek')} last />
        </Section>

        <Section title="Arenalar ve içerik">
          <Row icon={<Award size={20} color={Colors.gold} />} label="Bekleyen ödüller (hile incelemesi)" value={o?.pending_rewards ? `${o.pending_rewards}` : undefined} onPress={() => go('/yonetim/oduller')} />
          <Row icon={<Trophy size={20} color={Colors.gold} />} label="Arenalar ve ödül miktarları" onPress={() => go('/yonetim/arenalar')} />
          <Row icon={<Newspaper size={20} color={Colors.cyanSoft} />} label="Haberler" onPress={() => go('/yonetim/haberler')} last />
        </Section>

        <Section title="Güvenlik">
          <Row icon={<History size={20} color={Colors.textSecondary} />} label="Denetim kaydı" onPress={() => go('/yonetim/kayitlar')} last />
        </Section>

        <View style={styles.note}>
          <FileText size={14} color={Colors.textMuted} />
          <VText variant="caption" style={{ flex: 1 }}>
            Paneldeki her işlem kimin, ne zaman yaptığıyla birlikte denetim kaydına yazılır.
          </VText>
        </View>
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: Spacing.sm },
  tile: { width: '31.5%', paddingVertical: 12, alignItems: 'center', gap: 2 },
  num: { fontFamily: Fonts.extrabold, fontSize: 22, color: Colors.text },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.lg },
});
