import { describe, expect, it } from '@jest/globals';

import { profileLink, usernameFromLink } from '@/lib/profile-link';

describe('profil bağlantısı ve QR okuma', () => {
  it('bağlantı üretir ve geri okunur', () => {
    expect(usernameFromLink(profileLink('ayse_34'))).toBe('ayse_34');
  });

  it.each([
    ['https://vopila.com/u/Ayse', 'ayse'],
    ['https://www.vopila.com/u/ayse/', 'ayse'],
    ['http://vopila.app/u/eski_qr', 'eski_qr'],
    ['vopila://u/uygulama', 'uygulama'],
    ['  https://beta.vopila.com/u/bosluklu  ', 'bosluklu'],
  ])('%s → %s', (link, user) => expect(usernameFromLink(link)).toBe(user));

  it.each([
    'https://evil.com/u/ayse',
    'https://vopila.com.evil.com/u/ayse',
    'https://vopila.com/u/ab',
    'https://vopila.com/u/ayse?x=1',
    'https://vopila.com/p/123',
    'ayse',
  ])('VOPILA profil bağlantısı olmayan %s → null', (link) => expect(usernameFromLink(link)).toBeNull());
});
