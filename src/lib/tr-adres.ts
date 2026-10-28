/**
 * Türkiye il / ilçe / mahalle-köy listesi (81 il, 973 ilçe, ~32 bin mahalle, ~18 bin köy).
 * Kaynak: github.com/ubeydeozdmr/turkiye-api (MIT, Ekim 2026 sürümü), uygulamaya gömülü — internetsiz çalışır.
 * Veri yalnızca adres ekranı açılınca yüklenir.
 */
type Tree = Record<string, Record<string, [string, string]>>;

let tree: Tree | null = null;
function load(): Tree {
  if (!tree) tree = require('@/data/tr-adres.json') as Tree;
  return tree;
}

export const iller = () => Object.keys(load());

export const ilceler = (il: string) => Object.keys(load()[il] ?? {});

/** Mahalleler ("... Mah.") ve köyler ("... Köyü") birlikte, alfabetik. */
export function mahalleler(il: string, ilce: string): string[] {
  const row = load()[il]?.[ilce];
  if (!row) return [];
  const [mah, koy] = row;
  return [
    ...(mah ? mah.split('|').map((m) => `${m} Mah.`) : []),
    ...(koy ? koy.split('|').map((k) => `${k} Köyü`) : []),
  ];
}

/** Türkçe karakter duyarlı arama için küçük harf. */
export const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');
