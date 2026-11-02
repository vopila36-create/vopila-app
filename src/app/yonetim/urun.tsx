/** Yönetici: ürün ekle / düzenle (görsel yükleme dahil). */
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { ImagePlus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Chip } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Product } from '@/data/mock';
import { fetchAllProducts, saveProduct, saveProductImages, uploadCatalogImage } from '@/lib/admin-api';
import { useStore } from '@/store/app-store';

const CATEGORIES: Product['category'][] = ['Elektronik', 'Kozmetik', 'Ev & Yaşam', 'Moda', 'Spor'];

export default function YonetimUrun() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const store = useStore();
  const [form, setForm] = useState({
    name: '',
    category: 'Elektronik' as Product['category'],
    price: '',
    stock: '',
    description: '',
    images: [] as string[],
    active: true,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof typeof form, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchAllProducts().then((r) => {
      const p = r.ok ? r.data.find((x) => x.id === id) : undefined;
      if (alive && p)
        setForm({
          name: p.name,
          category: p.category,
          price: String(p.price),
          stock: String(p.stock),
          description: p.description,
          images: p.images?.length ? p.images : p.image ? [p.image] : [],
          active: p.active,
        });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (res.canceled) return;
    setUploading(true);
    const up = await uploadCatalogImage(res.assets[0].uri, res.assets[0].mimeType ?? 'image/jpeg');
    setUploading(false);
    if (up.ok) setForm((f) => ({ ...f, images: [...f.images, up.data].slice(0, 8) }));
    else setMsg({ ok: false, text: up.error });
  };
  const removeImage = (i: number) => setForm((f) => ({ ...f, images: f.images.filter((_, j) => j !== i) }));
  const makeCover = (i: number) =>
    setForm((f) => ({ ...f, images: [f.images[i], ...f.images.filter((_, j) => j !== i)] }));

  const save = async () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim() || !Number.isInteger(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
      setMsg({ ok: false, text: 'Ad, fiyat (tam sayı token) ve stok gerekli.' });
      return;
    }
    setBusy(true);
    const r = await saveProduct({
      id,
      name: form.name,
      category: form.category,
      price,
      stock,
      description: form.description,
      image: form.images[0] ?? '',
      active: form.active,
    });
    if (r.ok) {
      const g = await saveProductImages(r.data, form.images);
      if (!g.ok) {
        setBusy(false);
        setMsg({ ok: false, text: g.error });
        return;
      }
    }
    setBusy(false);
    if (!r.ok) {
      setMsg({ ok: false, text: r.error });
      return;
    }
    await store.refreshShop();
    router.back();
  };

  return (
    <AdminScreen title={id ? 'Ürünü Düzenle' : 'Yeni Ürün'}>
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <VText variant="label" style={{ marginBottom: 6 }}>
          Görseller ({form.images.length}/8) · ilki kapak; kapak yapmak için dokun
        </VText>
        <View style={styles.thumbs}>
          {form.images.map((uri, i) => (
            <Pressable key={`${uri}-${i}`} style={[styles.thumb, i === 0 && { borderColor: Colors.gold }]} onPress={() => makeCover(i)}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              <Pressable style={styles.thumbX} onPress={() => removeImage(i)} hitSlop={6} accessibilityLabel="Görseli kaldır">
                <VText style={{ color: '#fff', fontSize: 12 }}>✕</VText>
              </Pressable>
            </Pressable>
          ))}
          {form.images.length < 8 ? (
            <Pressable onPress={pickImage} style={[styles.thumb, styles.thumbAdd]}>
              <ImagePlus size={24} color={Colors.cyan} />
              <VText variant="caption" style={{ fontSize: 10 }}>
                {uploading ? 'Yükleniyor…' : 'Ekle'}
              </VText>
            </Pressable>
          ) : null}
        </View>
        <Field label="Ürün adı" value={form.name} onChange={(v) => set('name', v)} max={80} />
        <VText variant="label" style={{ marginTop: Spacing.md, marginBottom: 6 }}>
          Kategori
        </VText>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Chip key={c} label={c} active={form.category === c} onPress={() => set('category', c)} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Fiyat (token)" value={form.price} onChange={(v) => set('price', v.replace(/\D/g, ''))} keyboard="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Stok" value={form.stock} onChange={(v) => set('stock', v.replace(/\D/g, ''))} keyboard="number-pad" />
          </View>
        </View>
        <Field label="Açıklama" value={form.description} onChange={(v) => set('description', v)} multiline max={600} />
        <View style={styles.switchRow}>
          <VText variant="label" style={{ flex: 1 }}>
            Satışta
          </VText>
          <Switch
            value={form.active}
            onValueChange={(v) => set('active', v)}
            trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }}
            thumbColor="#fff"
          />
        </View>
        <Notice text={msg?.text ?? null} ok={msg?.ok} />
        <View style={{ alignItems: 'flex-end', marginTop: Spacing.lg }}>
          <SmallButton label="Kaydet" filled onPress={save} busy={busy || uploading} />
        </View>
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  image: {
    height: 180,
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  thumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceStrong,
  },
  thumbAdd: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', gap: 2 },
  thumbX: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
