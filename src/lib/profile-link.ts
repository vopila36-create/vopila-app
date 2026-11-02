/**
 * Profil bağlantısı ve QR: https://beta.vopila.com/u/<kullanıcı adı>. Android'de uygulama yüklüyse doğrudan
 * uygulamada açılır (app.json intentFilters + beta.vopila.com/.well-known/assetlinks.json), yoksa web sürümünde.
 * Yayında vopila.com'a taşınacak; eski vopila.com / vopila.app bağlantıları da okunur.
 */
export const PROFILE_LINK_BASE = 'https://beta.vopila.com/u/';

export const profileLink = (username: string) => `${PROFILE_LINK_BASE}${username}`;

/** QR / bağlantıdan kullanıcı adını çıkarır; VOPILA bağlantısı değilse null. Eski vopila.app QR'ları da okunur. */
export function usernameFromLink(text: string): string | null {
  const m = text.trim().match(/^(?:https?:\/\/(?:www\.|beta\.)?vopila\.(?:com|app)\/u\/|vopila:\/\/u\/)([a-z0-9_]{3,20})\/?$/i);
  return m ? m[1].toLowerCase() : null;
}
