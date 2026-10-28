import { router, type Href } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, Coins, ShieldCheck, ShoppingBag, Trophy } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GlassCard, OutlineButton, PrimaryButton, SectionHeader } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { formatTokens, useStore } from '@/store/app-store';

export default function Cuzdan() {
  const { ledger, balance, pendingRewards } = useStore();
  const earned = ledger.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const spent = Math.abs(ledger.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0));

  return (
    <SubScreen title="Cüzdanım">
      <View style={styles.pad}>
        {pendingRewards.length ? (
          <GlassCard style={styles.pending}>
            <ShieldCheck size={22} color={Colors.gold} />
            <View style={{ flex: 1 }}>
              <VText variant="bodyBold" color={Colors.text}>
                {pendingRewards.reduce((s, r) => s + r.amount, 0)} token ödülün inceleniyor
              </VText>
              <VText variant="caption">
                {pendingRewards.map((r) => r.reason).join(' · ')} — Kısa bir güvenlik incelemesinden sonra hesabına geçecek.
              </VText>
            </View>
          </GlassCard>
        ) : null}
        <GlassCard style={styles.hero} highlighted>
          <View style={styles.coin}>
            <Coins size={34} color={Colors.gold} />
          </View>
          <VText variant="caption">Toplam Bakiye</VText>
          <VText style={styles.balance}>{formatTokens(balance)}</VText>
          <VText variant="label" color={Colors.gold}>
            Token
          </VText>
          <View style={styles.split}>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <VText variant="bodyBold" color={Colors.success}>
                +{formatTokens(earned)}
              </VText>
              <VText variant="caption">Kazanılan</VText>
            </View>
            <View style={styles.vdiv} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <VText variant="bodyBold" color={Colors.live}>
                {spent ? `−${formatTokens(spent)}` : '0'}
              </VText>
              <VText variant="caption">Harcanan</VText>
            </View>
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <PrimaryButton
            label="Mağaza"
            icon={<ShoppingBag size={16} color={Colors.onCyan} />}
            onPress={() => router.push('/magaza' as Href)}
            style={{ flex: 1 }}
          />
          <OutlineButton
            label="Arenalar"
            iconLeft={<Trophy size={16} color={Colors.text} />}
            onPress={() => router.push('/arena-listesi' as Href)}
            style={{ flex: 1, height: 42 }}
          />
        </View>

        <GlassCard style={styles.info}>
          <VText variant="bodyBold">Token nasıl kazanılır?</VText>
          <VText variant="body" style={{ fontSize: 13, marginTop: 4 }}>
            Arenalara gönderi paylaş, topluluktan yıldız topla. Sezon sonunda ilk 3&apos;e girersen tokenler
            otomatik olarak cüzdanına yüklenir. Tokenler parayla satın alınamaz.
          </VText>
        </GlassCard>

        <View style={{ marginTop: Spacing.xl }}>
          <SectionHeader title="Hareketler" action={null} />
          <GlassCard style={{ paddingHorizontal: 12 }}>
            {ledger.map((l, i) => {
              const plus = l.amount > 0;
              return (
                <View key={l.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                  <View style={[styles.icon, { backgroundColor: plus ? 'rgba(52,211,153,0.15)' : Colors.liveSoft }]}>
                    {plus ? (
                      <ArrowDownLeft size={16} color={Colors.success} />
                    ) : (
                      <ArrowUpRight size={16} color={Colors.live} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <VText variant="label" numberOfLines={2}>
                      {l.reason}
                    </VText>
                    <VText variant="caption">{l.date}</VText>
                  </View>
                  <VText variant="bodyBold" color={plus ? Colors.success : Colors.live}>
                    {plus ? '+' : '−'}
                    {formatTokens(Math.abs(l.amount))}
                  </VText>
                </View>
              );
            })}
          </GlassCard>
        </View>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: Spacing.md, borderColor: 'rgba(245,182,66,0.5)' },
  pad: { paddingHorizontal: Spacing.screen },
  hero: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 16 },
  coin: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.goldSoft,
    borderWidth: 1,
    borderColor: Colors.gold,
    marginBottom: 10,
  },
  balance: { fontFamily: Fonts.extrabold, fontSize: 40, color: Colors.text, lineHeight: 46 },
  split: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 16 },
  vdiv: { width: 1, backgroundColor: Colors.border },
  actions: { flexDirection: 'row', gap: 10, marginTop: Spacing.lg },
  info: { padding: 14, marginTop: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.border },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
