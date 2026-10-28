/** Yönetici: haber ekle / düzenle. Paragraflar ve yapay zekâ özeti satır satır yazılır. */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AdminScreen, Field, Notice, SmallButton } from '@/components/admin-ui';
import { Chip } from '@/components/ui/primitives';
import { VText } from '@/components/ui/text';
import { Colors, Spacing } from '@/constants/theme';
import { newsCategories, type NewsCategory } from '@/data/mock';
import { fetchAllNews, saveNews } from '@/lib/admin-api';

export default function YonetimHaber() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [f, setF] = useState({
    title: '',
    category: 'Gündem' as NewsCategory,
    summary: '',
    body: '',
    ai: '',
    image: '',
    video: '',
    readTime: '3 dk okuma',
    live: false,
    special: false,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetchAllNews().then((r) => {
      const n = r.ok ? r.data.find((x) => x.id === id) : undefined;
      if (alive && n)
        setF({
          title: n.title,
          category: n.category,
          summary: n.summary,
          body: n.body.join('\n\n'),
          ai: n.aiSummary.join('\n'),
          image: n.image,
          video: n.video ?? '',
          readTime: n.readTime,
          live: !!n.live,
          special: !!n.special,
        });
    });
    return () => {
      alive = false;
    };
  }, [id]);

  const save = async () => {
    setBusy(true);
    const r = await saveNews({
      id,
      title: f.title,
      category: f.category,
      summary: f.summary,
      body: f.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
      aiSummary: f.ai.split('\n').map((p) => p.replace(/^[-•]\s*/, '').trim()).filter(Boolean),
      image: f.image.trim(),
      video: f.video.trim() || undefined,
      readTime: f.readTime,
      live: f.live,
      special: f.special,
    });
    setBusy(false);
    if (!r.ok) {
      setMsg(r.error);
      return;
    }
    router.back();
  };

  return (
    <AdminScreen title={id ? 'Haberi Düzenle' : 'Yeni Haber'}>
      <View style={{ paddingHorizontal: Spacing.screen }}>
        <Field label="Başlık" value={f.title} onChange={(v) => set('title', v)} max={140} />
        <VText variant="label" style={{ marginTop: Spacing.md, marginBottom: 6 }}>
          Kategori
        </VText>
        <View style={styles.chips}>
          {newsCategories.map((c) => (
            <Chip key={c} label={c} active={f.category === c} onPress={() => set('category', c)} />
          ))}
        </View>
        <Field label="Kısa özet" value={f.summary} onChange={(v) => set('summary', v)} multiline max={300} />
        <Field label="Metin (paragraflar arasında boş satır)" value={f.body} onChange={(v) => set('body', v)} multiline />
        <Field label="Yapay zekâ özeti (her satır bir madde)" value={f.ai} onChange={(v) => set('ai', v)} multiline />
        <Field label="Görsel bağlantısı (https://)" value={f.image} onChange={(v) => set('image', v)} keyboard="url" />
        <Field label="Video bağlantısı (isteğe bağlı)" value={f.video} onChange={(v) => set('video', v)} keyboard="url" />
        <Field label="Okuma süresi" value={f.readTime} onChange={(v) => set('readTime', v)} max={20} />
        <View style={styles.sw}>
          <VText variant="label" style={{ flex: 1 }}>
            Canlı / son dakika
          </VText>
          <Switch value={f.live} onValueChange={(v) => set('live', v)} trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }} thumbColor="#fff" />
        </View>
        <View style={styles.sw}>
          <VText variant="label" style={{ flex: 1 }}>
            Özel içerik
          </VText>
          <Switch value={f.special} onValueChange={(v) => set('special', v)} trackColor={{ true: Colors.cyan, false: 'rgba(255,255,255,0.15)' }} thumbColor="#fff" />
        </View>
        <Notice text={msg} />
        <View style={{ alignItems: 'flex-end', marginTop: Spacing.lg }}>
          <SmallButton label="Kaydet" filled onPress={save} busy={busy} />
        </View>
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sw: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md },
});
