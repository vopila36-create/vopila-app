/** Profil bağlantısı ve QR: https://vopila.app/u/<kullanıcı adı> (alan adı açılınca web'de de çalışır). */
export const PROFILE_LINK_BASE = 'https://vopila.app/u/';

export const profileLink = (username: string) => `${PROFILE_LINK_BASE}${username}`;

/** QR / bağlantıdan kullanıcı adını çıkarır; VOPILA bağlantısı değilse null. */
export function usernameFromLink(text: string): string | null {
  const m = text.trim().match(/^(?:https?:\/\/(?:www\.)?vopila\.app\/u\/|vopila:\/\/u\/)([a-z0-9_]{3,20})\/?$/i);
  return m ? m[1].toLowerCase() : null;
}
