/**
 * Yaş kapısı (5651 s. Kanun ek md. 4/7, yürürlük 1 Kasım 2026):
 *  - Yaşı bilinmeyen (eski) hesaba bir kez doğum tarihi sorulur; tarih saklanmaz, yalnızca yaş grubu.
 *  - 15 yaşını doldurmamış hesap kilitlenir: yalnızca itiraz (Destek) ve hesap silme açık kalır.
 * Ekranlar uygulamanın üstüne örtü olarak çizilir; böylece Destek / Hesabı sil sayfalarına gidilebilir.
 * Asıl kural sunucuda: 15 altı hesap hiçbir işlem yapamaz.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { router, useSegments, type Href } from 'expo-router';
import { CalendarDays, ShieldAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VText } from '@/components/ui/text';
import { Colors, Fonts, Gradients, Radius, Spacing } from '@/constants/theme';
import { checkBirthDate, declareBirthDate } from '@/lib/age-api';
import { useAge } from '@/store/age';
import { useAuth } from '@/store/auth';

/** 15 yaş altı kilitliyken açık kalan sayfalar */
const OPEN_ROUTES = ['destek', 'hesap-sil', 'giris', 'auth-callback'];

export function AgeGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { age } = useAge();
  const segments = useSegments();
  const first = segments[0] as string | undefined;

  let cover: ReactNode = null;
  if (session && age?.group === 'unknown') cover = <DeclareAge />;
  else if (session && age?.group === 'under15' && !OPEN_ROUTES.includes(first ?? '')) cover = <Under15 />;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {cover ? <View style={StyleSheet.absoluteFill}>{cover}</View> : null}
    </View>
  );
}

function DeclareAge() {
  const insets = useSafeAreaInsets();
  const { refresh } = useAge();
  const { signOut } = useAuth();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GG.AA.YYYY biçimini yazarken noktaları kendisi ekler
  const onChange = (t: string) => {
    const d = t.replace(/\D/g, '').slice(0, 8);
    setText([d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean).join('.'));
  };

  const submit = async () => {
    if (busy) return;
    setError(null);
    const iso = text.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const check = checkBirthDate(text);
    // 15 altı da sunucuya bildirilir (hesap kilitlenir, itiraz hakkı doğar)
    if (!check.ok && !(iso && check.error.includes('15'))) {
      setError(check.error);
      return;
    }
    const value = check.ok ? check.iso : `${iso![3]}-${iso![2].padStart(2, '0')}-${iso![1].padStart(2, '0')}`;
    setBusy(true);
    const res = await declareBirthDate(value);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await refresh();
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <CalendarDays size={48} color={Colors.cyan} />
      <VText variant="title" style={styles.center}>
        Doğum tarihin
      </VText>
      <VText style={[styles.center, { marginTop: 8 }]}>
        Yasa gereği (5651 sayılı Kanun) 15 yaşından küçükler sosyal ağ kullanamaz; 15–18 yaş için ek koruma
        uygulanır. Tarihin saklanmaz, yalnızca yaş grubun kaydedilir.
      </VText>
      <TextInput
        value={text}
        onChangeText={onChange}
        onSubmitEditing={submit}
        keyboardType="number-pad"
        placeholder="GG.AA.YYYY"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
        maxLength={10}
        accessibilityLabel="Doğum tarihi"
      />
      <Pressable onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
        {busy ? (
          <ActivityIndicator color={Colors.onCyan} />
        ) : (
          <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
            Devam et
          </VText>
        )}
      </Pressable>
      {error ? (
        <VText variant="caption" color={Colors.live} style={[styles.center, { marginTop: 10 }]}>
          {error}
        </VText>
      ) : null}
      <VText variant="caption" style={[styles.center, { marginTop: 18 }]}>
        Yanlış beyan hesabın kapatılmasına yol açabilir. Yaş bilgin daha sonra e-Devlet ile doğrulanacak.
      </VText>
      <Pressable onPress={() => signOut()} style={{ marginTop: 20 }}>
        <VText variant="label" color={Colors.textSecondary}>
          Çıkış yap
        </VText>
      </Pressable>
    </View>
  );
}

function Under15() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
      <LinearGradient colors={Gradients.screen} style={StyleSheet.absoluteFill} />
      <ShieldAlert size={48} color={Colors.live} />
      <VText variant="title" style={styles.center}>
        Hesabın kapatılacak
      </VText>
      <VText style={[styles.center, { marginTop: 8 }]}>
        Türkiye&apos;de 15 yaşını doldurmamış kişiler sosyal ağ kullanamaz (5651 sayılı Kanun ek madde 4). Bu yüzden
        hesabın kullanıma kapatıldı. Yaşın yanlış kaydedildiyse ücretsiz itiraz edebilirsin; itirazını bir kişi
        inceler. İtiraz sonuçlanana kadar verilerin silinmez.
      </VText>
      <Pressable onPress={() => router.push('/destek?konu=yas' as Href)} style={styles.btn}>
        <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
          İtiraz et
        </VText>
      </Pressable>
      <Pressable onPress={() => router.push('/hesap-sil' as Href)} style={styles.btnGhost}>
        <VText variant="label" color={Colors.text}>
          Hesabımı sil
        </VText>
      </Pressable>
      <Pressable onPress={() => signOut()} style={{ marginTop: 20 }}>
        <VText variant="label" color={Colors.textSecondary}>
          Çıkış yap
        </VText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.screen, backgroundColor: Colors.bg },
  center: { textAlign: 'center', marginTop: 16 },
  input: {
    marginTop: 24,
    width: 240,
    height: 58,
    textAlign: 'center',
    letterSpacing: 4,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 22,
  },
  btn: {
    marginTop: 16,
    width: 240,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    marginTop: 10,
    width: 240,
    height: 50,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
