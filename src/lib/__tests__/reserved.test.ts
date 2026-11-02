import { describe, expect, it } from '@jest/globals';

import { isReservedName } from '@/lib/reserved';

describe('isReservedName — "VOPILA" adı resmî hesaplara ayrılmış', () => {
  it.each(['vopila', 'VOPILA', 'vopila_resmi', 'v0p1la', 'wopila', 'voppiilaa', 'Vopıla', 'v.o.p.i.l.a', 'v0p!la'])(
    '%s reddedilir',
    (name) => expect(isReservedName(name)).toBe(true),
  );

  it.each(['ayse', 'popular', 'villa', 'vopi', 'kasif_34'])('%s serbest', (name) =>
    expect(isReservedName(name)).toBe(false),
  );
});
