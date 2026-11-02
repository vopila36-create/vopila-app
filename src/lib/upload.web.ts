/** Web'de dosya yükleme: yükleme yüzdesi bildirilir (telefon sürümü: upload.ts). */
import { storageErrorText, storageHeaders, storageObjectUrl } from '@/lib/supabase';

/** 0–1 arası ilerleme. */
export type UploadProgress = (fraction: number) => void;

export async function uploadToStorage(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
  opts: { upsert?: boolean; onProgress?: UploadProgress } = {},
): Promise<void> {
  const { upsert = false, onProgress } = opts;
  const blob = await fetch(uri).then((r) => r.blob());
  const headers = await storageHeaders(contentType, upsert);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', storageObjectUrl(bucket, path));
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(Math.min(e.loaded / e.total, 1));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(storageErrorText(xhr.status, xhr.responseText)));
    xhr.onerror = () => reject(new Error(storageErrorText(0)));
    xhr.send(blob);
  });
  onProgress?.(1);
}
