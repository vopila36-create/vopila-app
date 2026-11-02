import { describe, expect, it, jest } from '@jest/globals';

import { kindPreview } from '@/lib/messages-api';

jest.mock('@/lib/supabase', () => ({ supabase: {}, toTurkish: (e: { message?: string }) => e.message ?? '' }));

describe('sohbet listesindeki son mesaj önizlemesi', () => {
  it.each([
    ['image', '', '📷 Fotoğraf'],
    ['video', '', '🎬 Video'],
    ['audio', '', '🎤 Sesli mesaj'],
    ['post', '', 'Bir gönderi paylaştı'],
    ['post', 'buna bak', 'buna bak'],
    ['text', 'selam', 'selam'],
  ] as const)('%s / "%s" → %s', (kind, text, out) => expect(kindPreview(kind, text)).toBe(out));

  it('geri alınan mesajın metni hiçbir yerde görünmez', () => {
    expect(kindPreview('unsent', 'gizli kalmalıydı')).toBe('Mesaj geri alındı');
  });
});
