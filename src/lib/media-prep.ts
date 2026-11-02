/**
 * Yüklemeden önce medya hazırlığı: fotoğraflar makul boyuta küçültülür (en uzun kenar 1600 px, JPEG %80),
 * dosya boyutu sunucu sınırını aşıyorsa yükleme hiç başlamadan anlaşılır bir uyarı verilir.
 * Böylece büyük dosyalar belleği doldurup uygulamayı çökertmez ve yükleme süresi kısalır.
 */
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Platform } from 'react-native';

/** Gönderi/an dosya sınırı (sunucu: 100 MB). */
export const MAX_POST_BYTES = 95 * 1024 * 1024;
/** Mesaj dosya sınırı (sunucu: 50 MB). */
export const MAX_DM_BYTES = 48 * 1024 * 1024;

const MAX_IMAGE_SIDE = 1600;

/** Dosya boyutu (bayt); okunamazsa null (yükleme yine denenir, sunucu sınırı geçerli). */
export async function fileSize(uri: string): Promise<number | null> {
  try {
    if (Platform.OS !== 'web' && uri.startsWith('file:')) {
      const size = new File(uri).size;
      if (typeof size === 'number') return size;
    }
    const blob = await fetch(uri).then((r) => r.blob());
    return blob.size;
  } catch {
    return null;
  }
}

/** Fotoğrafı en uzun kenarı 1600 px olacak şekilde küçültür (zaten küçükse dokunmaz). */
export async function shrinkImage(uri: string, width?: number, height?: number): Promise<string> {
  if (Platform.OS === 'web') return uri;
  try {
    const w = width ?? 0;
    const h = height ?? 0;
    if (w && h && Math.max(w, h) <= MAX_IMAGE_SIDE) return uri;
    const ctx = ImageManipulator.manipulate(uri);
    // Boyut bilinmiyorsa genişliği sınırla (yükseklik orantılı)
    if (w && h && h > w) ctx.resize({ height: MAX_IMAGE_SIDE });
    else ctx.resize({ width: MAX_IMAGE_SIDE });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

export const tooBigMessage = (limitBytes: number) =>
  `Dosya çok büyük (en fazla ${Math.round(limitBytes / (1024 * 1024))} MB). Daha kısa bir video seç ya da kırp.`;
