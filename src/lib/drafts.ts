/**
 * Gönderi taslakları (Instagram gibi telefonda saklanır, hesaba göre ayrı).
 * Seçilen fotoğraf / videolar uygulamanın kendi klasörüne kopyalanır; telefon geçici dosyaları
 * silse de taslak bozulmaz. Web'de dosya kopyalanamadığı için yalnızca yazılar saklanır.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { ArenaKey, Media } from '@/data/mock';

export type Draft = {
  id: string;
  media: Media[];
  caption: string;
  location: string;
  arenaKey?: ArenaKey;
  title: string;
  sensitive: boolean;
  aiGenerated: boolean;
  savedAt: string;
};

const MAX_DRAFTS = 20;
const isWeb = Platform.OS === 'web';
const storeKey = (uid: string | null) => `vopila-drafts-v1:${uid ?? 'local'}`;

async function readAll(uid: string | null): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(storeKey(uid));
    const list = raw ? (JSON.parse(raw) as Draft[]) : [];
    // Web'de sayfa yenilenince geçici (blob:) dosyalar kaybolur
    return isWeb ? list.map((d) => ({ ...d, media: d.media.filter((m) => !m.uri.startsWith('blob:')) })) : list;
  } catch {
    return [];
  }
}

async function writeAll(uid: string | null, list: Draft[]) {
  await AsyncStorage.setItem(storeKey(uid), JSON.stringify(list.slice(0, MAX_DRAFTS))).catch(() => {});
}

export const listDrafts = readAll;

export async function getDraft(uid: string | null, id: string) {
  return (await readAll(uid)).find((d) => d.id === id) ?? null;
}

function draftDir(id: string) {
  return new Directory(Paths.document, 'drafts', id);
}

/** Medyayı taslak klasörüne kopyalar (zaten oradaysa olduğu gibi bırakır). */
async function persistMedia(id: string, media: Media[]): Promise<Media[]> {
  if (isWeb) return media;
  const dir = draftDir(id);
  dir.create({ idempotent: true, intermediates: true });
  const out: Media[] = [];
  for (const [i, m] of media.entries()) {
    if (m.uri.startsWith(dir.uri)) {
      out.push(m);
      continue;
    }
    try {
      const src = new File(m.uri);
      const ext = (src.name.split('.').pop() || (m.type === 'video' ? 'mp4' : 'jpg')).toLowerCase();
      const dest = new File(dir, `${Date.now()}-${i}.${ext}`);
      await src.copy(dest);
      out.push({ ...m, uri: dest.uri });
    } catch {
      out.push(m); // kopyalanamazsa geçici adresle devam
    }
  }
  return out;
}

/** Taslağı kaydeder ya da günceller; kimliğini döner. */
export async function saveDraft(uid: string | null, input: Omit<Draft, 'id' | 'savedAt'> & { id?: string }) {
  const id = input.id ?? `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
  const media = await persistMedia(id, input.media);
  const draft: Draft = { ...input, id, media, savedAt: new Date().toISOString() };
  const list = (await readAll(uid)).filter((d) => d.id !== id);
  await writeAll(uid, [draft, ...list]);
  return id;
}

export async function deleteDraft(uid: string | null, id: string) {
  await writeAll(uid, (await readAll(uid)).filter((d) => d.id !== id));
  if (!isWeb) {
    try {
      const dir = draftDir(id);
      if (dir.exists) dir.delete();
    } catch {}
  }
}
