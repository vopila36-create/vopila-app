/**
 * Adres ekle / düzenle: il → ilçe → mahalle listeden seçilir; cadde/sokak, bina ve daire ayrı;
 * kurye notu isteğe bağlı. Adresi yalnızca sen görürsün (KVKK).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { PlacePicker } from '@/components/place-picker';
import { Chip } from '@/components/ui/primitives';
import { SubScreen } from '@/components/ui/sub-screen';
import { VText } from '@/components/ui/text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { saveAddress, type AddressInput } from '@/lib/shop-api';
import { ilceler, iller, mahalleler } from '@/lib/tr-adres';
import { useStore } from '@/store/app-store';

const TITLES = ['Ev', 'İş', 'Diğer'];

type Errors = Partial<Record<keyof AddressInput, string>>;

function validate(a: AddressInput): Errors {
  const e: Errors = {};
  if (a.fullName.trim().split(/\s+/).length < 2) e.fullName = 'Ad ve soyadını yaz.';
  const digits = a.phone.replace(/\D/g, '').replace(/^90/, '').replace(/^5/, '05');
  if (!/^05\d{9}$/.test(digits)) e.phone = '05 ile başlayan 11 haneli cep telefonu yaz.';
  if (!a.il) e.il = 'İl seç.';
  if (!a.ilce) e.ilce = 'İlçe seç.';
  if (!a.mahalle) e.mahalle = 'Mahalle ya da köy seç.';
  if (a.street.trim().length < 2) e.street = 'Cadde / sokak gerekli.';
  if (!a.buildingNo.trim()) e.buildingNo = 'Bina no gerekli.';
  return e;
}

export default function AdresDuzenle() {
  const { id, sonra } = useLocalSearchParams<{ id?: string; sonra?: string }>();
  const store = useStore();
  const existing = id ? store.addresses.find((a) => a.id === id) : undefined;

  const [form, setForm] = useState<AddressInput>(
    existing ?? {
      title: 'Ev',
      fullName: store.addresses[0]?.fullName ?? '',
      phone: store.addresses[0]?.phone ?? '',
      il: '',
      ilce: '',
      mahalle: '',
      street: '',
      buildingNo: '',
      flatNo: '',
      courierNote: '',
      isDefault: store.addresses.length === 0,
    },
  );
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = touched ? validate(form) : {};
  const set = <K extends keyof AddressInput>(k: K, v: AddressInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setTouched(true);
    if (Object.keys(validate(form)).length || !store.myId || saving) return;
    setSaving(true);
    setError(null);
    const res = await saveAddress(store.myId, form, existing?.id);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await store.refreshShop();
    // Ödeme sırasında eklendiyse ödemeye seçili olarak dön
    if (sonra === 'odeme') router.replace(`/odeme?adres=${res.data.id}`);
    else router.back();
  };

  const input = (k: keyof AddressInput, label: string, placeholder: string, opts?: { keyboard?: KeyboardTypeOptions; max?: number; multiline?: boolean }) => (
    <View style={{ marginTop: Spacing.md, flex: 1 }}>
      <VText variant="label" style={{ marginBottom: 6 }}>
        {label}
      </VText>
      <TextInput
        value={String(form[k] ?? '')}
        onChangeText={(t) => set(k, t as never)}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        keyboardType={opts?.keyboard}
        maxLength={opts?.max}
        multiline={opts?.multiline}
        style={[styles.input, opts?.multiline && { height: 76, textAlignVertical: 'top', paddingTop: 12 }, errors[k] ? styles.inputErr : null]}
      />
      {errors[k] ? (
        <VText variant="caption" color={Colors.live} style={{ marginTop: 4 }}>
          {errors[k]}
        </VText>
      ) : null}
    </View>
  );

  return (
    <SubScreen title={existing ? 'Adresi Düzenle' : 'Yeni Adres'}>
      <View style={styles.pad}>
        <View style={styles.privacy}>
          <Lock size={14} color={Colors.cyan} />
          <VText variant="caption" style={{ flex: 1 }}>
            Adresini yalnızca sen görürsün. Sipariş verdiğinde yalnızca teslimat için kargo firmasıyla paylaşılır.
          </VText>
        </View>

        <VText variant="label" style={{ marginTop: Spacing.md, marginBottom: 6 }}>
          Adres adı
        </VText>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {TITLES.map((t) => (
            <Chip key={t} label={t} active={form.title === t} onPress={() => set('title', t)} />
          ))}
        </View>

        {input('fullName', 'Ad Soyad', 'Teslim alacak kişi', { max: 80 })}
        {input('phone', 'Cep telefonu', '05XX XXX XX XX', { keyboard: 'phone-pad', max: 16 })}

        <PlacePicker
          label="İl"
          value={form.il}
          placeholder="İl seç"
          options={iller}
          error={errors.il}
          onChange={(v) => setForm((f) => ({ ...f, il: v, ilce: '', mahalle: '' }))}
        />
        <PlacePicker
          label="İlçe"
          value={form.ilce}
          placeholder={form.il ? 'İlçe seç' : 'Önce il seç'}
          options={() => ilceler(form.il)}
          disabled={!form.il}
          error={errors.ilce}
          onChange={(v) => setForm((f) => ({ ...f, ilce: v, mahalle: '' }))}
        />
        <PlacePicker
          label="Mahalle / Köy"
          value={form.mahalle}
          placeholder={form.ilce ? 'Mahalle ya da köy seç' : 'Önce ilçe seç'}
          options={() => mahalleler(form.il, form.ilce)}
          disabled={!form.ilce}
          error={errors.mahalle}
          onChange={(v) => set('mahalle', v)}
        />

        {input('street', 'Cadde / Sokak', 'Örn. Atatürk Cd. ya da 372. Sk.', { max: 120 })}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {input('buildingNo', 'Bina no', 'Örn. 12A', { max: 20 })}
          {input('flatNo', 'Daire (isteğe bağlı)', 'Örn. 5', { max: 20 })}
        </View>
        {input('courierNote', 'Kurye notu (isteğe bağlı)', 'Örn. Zile basın, kapıcıya bırakabilirsiniz', { max: 200, multiline: true })}

        <View style={styles.defaultRow}>
          <VText variant="label" style={{ flex: 1 }}>
            Varsayılan adresim yap
          </VText>
          <Switch
            value={!!form.isDefault}
            onValueChange={(v) => set('isDefault', v)}
            trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
            thumbColor="#fff"
          />
        </View>

        {error ? (
          <VText variant="label" color={Colors.live} style={{ marginTop: Spacing.md }}>
            {error}
          </VText>
        ) : null}

        <Pressable onPress={save} disabled={saving} style={[styles.btn, saving && { opacity: 0.6 }]}>
          {saving ? (
            <ActivityIndicator color={Colors.onCyan} />
          ) : (
            <VText variant="label" color={Colors.onCyan} style={{ fontFamily: Fonts.bold }}>
              Adresi Kaydet
            </VText>
          )}
        </Pressable>
      </View>
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: Spacing.screen },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    color: Colors.text,
    fontFamily: Fonts.medium,
    fontSize: 14,
  },
  inputErr: { borderColor: Colors.live },
  defaultRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  btn: {
    marginTop: Spacing.xl,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: Colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
