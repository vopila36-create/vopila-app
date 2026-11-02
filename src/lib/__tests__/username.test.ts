import { describe, expect, it, jest } from '@jest/globals';

import { cleanUsername } from '@/lib/username';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

describe('cleanUsername — kullanıcı adı alanı', () => {
  it.each([
    ['Ayşe', 'ayse'],
    ['IŞIK', 'isik'],
    ['Çağrı Gül', 'cagrigul'],
    ['Öykü', 'oyku'],
    ['ılık', 'ilik'],
    ['ali veli', 'aliveli'],
    ['ali.veli-34', 'aliveli34'],
    ['ali_veli', 'ali_veli'],
    ['A'.repeat(30), 'a'.repeat(20)],
  ])('%s → %s', (input, out) => expect(cleanUsername(input)).toBe(out));
});
