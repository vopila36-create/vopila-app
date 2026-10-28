/** Yardım ve destek: sık sorulanlar + sorun bildir (destek talebi) + taleplerim. */
import { router, type Href } from 'expo-router';
import { BookOpen, Check, ChevronDown, ChevronUp, LifeBuoy, Send } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Row, Section } from '@/components/settings-ui';
import { Chip, GlassCard } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { fetchMyTickets, sendTicket, TICKET_TOPICS, type Ticket, type TicketTopic } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

const FAQ: { q: string; a: string }[] = [
  { q: 'Token nasıl kazanılır?', a: 'Arenalarda yarışıp sezon sonunda ilk 3’e girerek. Token satın alınamaz ve nakde çevrilemez.' },
  { q: 'Ödülüm neden “inceleniyor”?', a: 'Sistem oylarda olağandışı bir durum görürse ödül kısa bir güvenlik incelemesinden sonra hesabına geçer.' },
  { q: 'Hesabımı nasıl gizli yaparım?', a: 'Ayarlar > Gizlilik > Gizli hesap. Gizli hesapta paylaşımlarını yalnızca onayladığın takipçiler görür.' },
  { q: 'Birini nasıl engellerim ya da şikayet ederim?', a: 'Profilinin sağ üstündeki ••• menüsünden. Gönderi ve yorumları da kendi menülerinden şikayet edebilirsin.' },
  { q: 'Siparişim ne zaman gelir?', a: 'Siparişlerim ekranında durumunu ve kargo takip numarasını görebilirsin.' },
];

const STATUS: Record<Ticket['status'], string> = { open: 'Açık', answered: 'Yanıtlandı', closed: 'Kapandı' };

export default function Destek() {
  const { myId } = useStore();
  const [open, setOpen] = useState<number | null>(null);
  const [topic, setTopic] = useState<TicketTopic>('hata');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchMyTickets(myId).then((res) => {
      if (!cancelled && res.ok) setTickets(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const send = async () => {
    if (!myId || sending) return;
    if (message.trim().length < 10) {
      setNotice({ ok: false, text: 'Sorunu en az 10 karakterle anlat.' });
      return;
    }
    setSending(true);
    const res = await sendTicket(myId, topic, message);
    setSending(false);
    if (!res.ok) {
      setNotice({ ok: false, text: res.error });
      return;
    }
    setMessage('');
    setNotice({ ok: true, text: 'Talebin alındı. Ekibimiz en kısa sürede dönüş yapacak.' });
    const list = await fetchMyTickets(myId);
    if (list.ok) setTickets(list.data);
  };

  return (
    <SubScreen title="Yardım ve Destek">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Sık sorulanlar">
          {FAQ.map((f, i) => (
            <View key={f.q} style={[styles.faq, i === FAQ.length - 1 && { borderBottomWidth: 0 }]}>
              <Pressable style={styles.faqHead} onPress={() => setOpen(open === i ? null : i)}>
                <VText variant="label" style={{ flex: 1 }}>
                  {f.q}
                </VText>
                {open === i ? <ChevronUp size={18} color={Colors.cyan} /> : <ChevronDown size={18} color={Colors.textMuted} />}
              </Pressable>
              {open === i ? (
                <VText style={{ paddingHorizontal: 14, paddingBottom: 14, fontSize: 13 }}>{f.a}</VText>
              ) : null}
            </View>
          ))}
        </Section>

        <Section title="Kurallar">
          <Row
            icon={<BookOpen size={20} color={Colors.cyanSoft} />}
            label="Topluluk kuralları"
            onPress={() => router.push('/topluluk-kurallari' as Href)}
            last
          />
        </Section>

        {myId ? (
          <>
            <Section title="Sorun bildir">
              <View style={{ padding: 12, gap: 10 }}>
                <View style={styles.topics}>
                  {TICKET_TOPICS.map((t) => (
                    <Chip key={t.key} label={t.label} active={topic === t.key} onPress={() => setTopic(t.key)} />
                  ))}
                </View>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Ne oldu? Ne zaman, hangi ekranda?"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  maxLength={2000}
                  style={styles.input}
                />
                <Pressable onPress={send} disabled={sending} style={[styles.send, sending && { opacity: 0.6 }]}>
                  {sending ? (
                    <ActivityIndicator color={Colors.onCyan} />
                  ) : (
                    <>
                      <Send size={16} color={Colors.onCyan} />
                      <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
                        Gönder
                      </VText>
                    </>
                  )}
                </Pressable>
                {notice ? (
                  <VText variant="caption" color={notice.ok ? Colors.cyan : Colors.live}>
                    {notice.text}
                  </VText>
                ) : null}
              </View>
            </Section>

            {tickets.length ? (
              <Section title="Taleplerim">
                {tickets.map((t, i) => (
                  <View key={t.id} style={[styles.ticket, i === tickets.length - 1 && { borderBottomWidth: 0 }]}>
                    {t.status === 'open' ? <LifeBuoy size={18} color={Colors.gold} /> : <Check size={18} color={Colors.cyan} />}
                    <View style={{ flex: 1 }}>
                      <VText color={Colors.text} numberOfLines={2}>
                        {t.message}
                      </VText>
                      <VText variant="caption">
                        {TICKET_TOPICS.find((x) => x.key === t.topic)?.label} · {STATUS[t.status]} · {t.time}
                      </VText>
                      {t.reply ? (
                        <VText variant="caption" color={Colors.cyan} style={{ marginTop: 4 }}>
                          VOPILA Destek: {t.reply}
                        </VText>
                      ) : null}
                    </View>
                  </View>
                ))}
              </Section>
            ) : null}
          </>
        ) : (
          <GlassCard style={{ padding: 14, marginTop: Spacing.lg }}>
            <VText>Sorun bildirmek için giriş yapmalısın.</VText>
          </GlassCard>
        )}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  faq: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: {
    minHeight: 110,
    textAlignVertical: 'top',
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.regular,
    fontSize: 14,
  },
  send: {
    flexDirection: 'row',
    gap: 8,
    height: 46,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticket: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
});
