/** Uygulaman ve medya (Instagram'daki gibi): tema ve video oynatma tercihleri. */
import { reloadAppAsync } from 'expo';
import { PlayCircle } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { ChoiceList, Section, ToggleRow } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, saveThemePref, Spacing, themePref, type ThemePref } from '@/constants/theme';
import { useStore } from '@/store/app-store';

export default function UygulamaVeMedya() {
  const { state, updateSettings } = useStore();
  const [themeNote, setThemeNote] = useState('');

  // Tema açılışta okunur: seçim kaydedilir ve uygulama yeniden başlatılır
  const changeTheme = (pref: ThemePref) => {
    if (pref === themePref) return;
    saveThemePref(pref);
    if (Platform.OS === 'web') {
      globalThis.location?.reload();
      return;
    }
    reloadAppAsync('Tema değişti').catch(() => setThemeNote('Yeni tema, uygulamayı kapatıp açtığında görünecek.'));
  };

  return (
    <SubScreen title="Uygulaman ve medya">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Tema" note="Tema değişince uygulama bir saniyeliğine yeniden açılır.">
          <ChoiceList<ThemePref>
            value={themePref}
            onChange={changeTheme}
            options={[
              { key: 'dark', label: 'Koyu', desc: 'Lacivert zemin, turkuaz vurgular' },
              { key: 'light', label: 'Açık', desc: 'Beyaz zemin' },
              { key: 'pink', label: 'Pembe', desc: 'Açık pembe zemin, pembe vurgular' },
              { key: 'system', label: 'Telefona göre', desc: 'Telefonun açık/koyu ayarını izler' },
            ]}
          />
        </Section>
        {themeNote ? (
          <VText variant="caption" color={Colors.gold} style={{ marginTop: 6 }}>
            {themeNote}
          </VText>
        ) : null}

        <Section title="Video">
          <ToggleRow
            icon={<PlayCircle size={20} color={Colors.cyanSoft} />}
            label="Videoları otomatik oynat"
            desc="Kapalıyken videolar dokununca başlar (veri tasarrufu)"
            value={state.settings.autoplayVideos}
            onChange={(v) => updateSettings({ autoplayVideos: v })}
            last
          />
        </Section>
      </View>
    </SubScreen>
  );
}
