/**
 * Telefonda dosya yükleme: dosya belleğe alınmadan doğrudan diskten gönderilir (büyük videoda uygulama
 * çökmez) ve yükleme yüzdesi bildirilir. Web sürümü: upload.web.ts.
 */
import { createUploadTask, FileSystemUploadType } from 'expo-file-system/legacy';

import { storageErrorText, storageHeaders, storageObjectUrl, supabase } from '@/lib/supabase';

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
  if (uri.startsWith('file:')) {
    const task = createUploadTask(
      storageObjectUrl(bucket, path),
      uri,
      { httpMethod: 'POST', uploadType: FileSystemUploadType.BINARY_CONTENT, headers: await storageHeaders(contentType, upsert) },
      (p) => {
        if (p.totalBytesExpectedToSend > 0) onProgress?.(Math.min(p.totalBytesSent / p.totalBytesExpectedToSend, 1));
      },
    );
    let res;
    try {
      res = await task.uploadAsync();
    } catch {
      throw new Error(storageErrorText(0));
    }
    if (!res || res.status < 200 || res.status >= 300) throw new Error(storageErrorText(res?.status ?? 0, res?.body));
    onProgress?.(1);
    return;
  }
  // content:// gibi doğrudan okunamayan adresler: eski yöntem (küçük dosyalar için yeterli)
  const body = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, body, { contentType, upsert });
  if (error) throw new Error(storageErrorText(0, error.message));
  onProgress?.(1);
}
