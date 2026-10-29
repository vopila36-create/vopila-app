/** Profil bağlantısı ve QR: https://vopila.com/u/<kullanıcı adı> (web yönlendirme sayfası açılınca tarayıcıda da çalışır). */
export const PROFILE_LINK_BASE = 'https://vopila.com/u/';

export const profileLink = (username: string) => `${PROFILE_LINK_BASE}${username}`;

/** QR / bağlantıdan kullanıcı adını çıkarır; VOPILA bağlantısı değilse null. Eski vopila.app QR'ları da okunur. */
export function usernameFromLink(text: string): string | null {
  const m = text.trim().match(/^(?:https?:\/\/(?:www\.)?vopila\.(?:com|app)\/u\/|vopila:\/\/u\/)([a-z0-9_]{3,20})\/?$/i);
  return m ? m[1].toLowerCase() : null;
}
