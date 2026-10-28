/**
 * "VOPILA" adı ayrılmış: kullanıcı adında ya da görünen adda kullanılamaz (yalnızca yönetici verir).
 * Asıl kontrol sunucuda (0021_reserved_names.sql); bu yalnızca kullanıcıya erken uyarı içindir.
 */
const LOOKALIKE: Record<string, string> = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', ı: 'i', '3': 'e', '4': 'a', '@': 'a' };

export function isReservedName(text: string): boolean {
  const flat = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase('tr-TR')
    .replace(/./g, (c) => LOOKALIKE[c] ?? c)
    .replace(/[^a-z]/g, '')
    .replace(/([a-z])\1+/g, '$1');
  return /[vw]op[il]+a/.test(flat);
}

export const RESERVED_NAME_ERROR = '“VOPILA” adı resmî hesaplara ayrılmıştır; kullanıcı adında ya da adında kullanılamaz.';
