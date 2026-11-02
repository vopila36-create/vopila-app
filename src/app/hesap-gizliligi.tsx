/** Hesap gizliliği (Instagram'daki gibi ayrı ekran): gizli hesap aç/kapa ve ne anlama geldiği. */
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Section, ToggleRow } from '@/components/settings-ui';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { useStore } from '@/store/app-store';
import { useAuth } from '@/store/auth';

export default function HesapGizliligi() {
  const auth = useAuth();
  const { state, updateSettings } = useStore();
  const [note, setNote] = useState('');
  // Giriş yapılmışsa gizlilik Supabase'deki profilde tutulur (sunucu uygular)
  const isPrivate = auth.profile ? auth.profile.is_private : state.settings.privateAccount;

  const setPrivate = async (v: boolean) => {
    updateSettings({ privateAccount: v });
    if (!auth.profile) return;
    const res = await auth.saveProfile({ is_private: v });
    if (!res.ok) setNote(res.error);
    else setNote(v ? 'Hesabın artık gizli. Yeni takipçileri sen onaylarsın.' : 'Hesabın artık herkese açık. Bekleyen istekler onaylandı.');
  };

  return (
    <SubScreen title="Hesap gizliliği">
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Section title="Hesap">
          <ToggleRow icon={<Lock size={20} color={Colors.cyanSoft} />} label="Gizli hesap" value={isPrivate} onChange={setPrivate} last />
        </Section>
        <VText style={{ marginTop: Spacing.md }}>
          Hesabın herkese açıkken profilini ve gönderilerini VOPILA&apos;daki herkes görebilir.
        </VText>
        <VText style={{ marginTop: Spacing.sm }}>
          Hesabın gizliyken paylaşımlarını, anlarını, arena gönderilerini ve takipçi/takip listelerini yalnızca
          onayladığın takipçiler görebilir. Profil fotoğrafın ve adın herkese görünmeye devam eder.
        </VText>
        <VText variant="caption" style={{ marginTop: Spacing.sm }}>
          18 yaşından küçük hesaplar her zaman korumalıdır; bu ayardan bağımsız olarak yalnızca ilişkili kişilere görünür.
        </VText>
        {note ? (
          <VText variant="caption" color={Colors.cyan} style={{ marginTop: Spacing.md }}>
            {note}
          </VText>
        ) : null}
      </View>
    </SubScreen>
  );
}
