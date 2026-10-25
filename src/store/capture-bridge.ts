/**
 * Kamera ekranında çekilen (veya galeriden seçilen) medyayı paylaşım ekranına taşır.
 * Kamera "Kullan" deyince buraya yazar; paylaşım ekranı odaklandığında alır.
 */
import type { Media } from '@/data/mock';

let pending: Media[] = [];

export function setPendingMedia(media: Media[]) {
  pending = [...pending, ...media];
}

/** Bekleyen medyayı verir ve kuyruğu boşaltır. */
export function takePendingMedia(): Media[] {
  const out = pending;
  pending = [];
  return out;
}
