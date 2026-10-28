/**
 * Etkileşim ayarları: kimler yorum yapabilir, kimler senden bahsedebilir, kimler mesaj atabilir,
 * gizli kelimeler. Hepsi sunucuda uygulanır (0010_settings.sql).
 */
import { router, type Href } from 'expo-router';
import { Plus, ShieldMinus, X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceList, Row, Section } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import type { CommentPolicy, MentionPolicy, MessagePolicy } from '@/lib/settings-api';
import { useMySettings } from '@/store/use-settings';

export default function EtkilesimAyarlari() {
  const { myId, settings, save, error } = useMySettings();
  const [word, setWord] = useState('');

  if (!myId) {
    return (
      <SubScreen title="Etkileşimler">
        <VText style={{ textAlign: 'center', marginTop: 40 }}>Bu ayarlar için giriş yapmalısın.</VText>
      </SubScreen>
    );
  }
  if (!settings) {
    return (
      <SubScreen title="Etkileşimler">
        <ActivityIndicator color={Colors.cyan} style={{ marginTop: 60 }} />
      </SubScreen>
    );
  }

  const addWord = () => {
    const w = word.trim().toLocaleLowerCase('tr-TR');
    if (!w || settings.hidden_words.includes(w) || settings.hidden_words.length >= 100) return;
    save({ hidden_words: [...settings.hidden_words, w] });
    setWord('');
  };

  return (
    <SubScreen title="Etkileşimler">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Gönderilerime kim yorum yapabilir?">
          <ChoiceList<CommentPolicy>
            value={settings.comment_policy}
            onChange={(v) => save({ comment_policy: v })}
            options={[
              { key: 'everyone', label: 'Herkes' },
              { key: 'following', label: 'Takip ettiğim kişiler' },
              { key: 'followers', label: 'Takipçilerim' },
              { key: 'nobody', label: 'Yorumlar kapalı' },
            ]}
          />
        </Section>

        <Section title="Benden kim bahsedebilir? (@)">
          <ChoiceList<MentionPolicy>
            value={settings.mention_policy}
            onChange={(v) => save({ mention_policy: v })}
            options={[
              { key: 'everyone', label: 'Herkes' },
              { key: 'following', label: 'Takip ettiğim kişiler' },
              { key: 'nobody', label: 'Hiç kimse', desc: 'Bahsedilsen de bildirim gelmez' },
            ]}
          />
        </Section>

        <Section title="Bana kim mesaj atabilir?">
          <ChoiceList<MessagePolicy>
            value={settings.message_policy}
            onChange={(v) => save({ message_policy: v })}
            options={[
              { key: 'everyone', label: 'Herkes' },
              {
                key: 'following',
                label: 'Yalnızca takip ettiklerim',
                desc: 'Sen önce yazdıysan diğerleri de cevap verebilir',
              },
            ]}
          />
        </Section>

        <Section
          title="Gizli kelimeler"
          note="Bu kelimelerden birini içeren yorumlar gönderilerinde otomatik gizlenir; yalnızca yazan kişi görür, sana bildirim gelmez.">
          <View style={styles.addRow}>
            <TextInput
              value={word}
              onChangeText={setWord}
              onSubmitEditing={addWord}
              placeholder="Kelime ya da ifade ekle"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              maxLength={40}
              autoCapitalize="none"
            />
            <Pressable onPress={addWord} style={styles.addBtn} accessibilityLabel="Ekle">
              <Plus size={18} color={Colors.onCyan} />
            </Pressable>
          </View>
          {settings.hidden_words.length ? (
            <View style={styles.chips}>
              {settings.hidden_words.map((w) => (
                <Pressable
                  key={w}
                  style={styles.chip}
                  onPress={() => save({ hidden_words: settings.hidden_words.filter((x) => x !== w) })}
                  accessibilityLabel={`${w} kaldır`}>
                  <VText variant="caption" color={Colors.text}>
                    {w}
                  </VText>
                  <X size={12} color={Colors.textSecondary} />
                </Pressable>
              ))}
            </View>
          ) : (
            <VText variant="caption" style={{ padding: 14, paddingTop: 0 }}>
              Henüz kelime eklemedin.
            </VText>
          )}
        </Section>

        <Section title="Kişiler">
          <Row
            icon={<ShieldMinus size={20} color={Colors.cyanSoft} />}
            label="Kısıtlanan hesaplar"
            onPress={() => router.push('/kisitlananlar' as Href)}
            last
          />
        </Section>

        {error ? (
          <VText variant="caption" color={Colors.live} style={{ marginTop: 8 }}>
            {error}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  input: {
    flex: 1,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.cyan, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
});
