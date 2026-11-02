/**
 * Kullanıcı adı kontrolü (Instagram gibi): her ad yalnızca bir kişiye ait; yazarken anında
 * "kullanılabilir / alınmış" gösterilir. Asıl kontrol sunucuda (0022_usernames.sql).
 */
import { useEffect, useState } from 'react';

import { VText } from '@/components/ui/text';
import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export type UsernameStatus = 'ok' | 'taken' | 'invalid' | 'reserved';

const TR_ASCII: Record<string, string> = { ı: 'i', ş: 's', ğ: 'g', ü: 'u', ö: 'o', ç: 'c', â: 'a', î: 'i', û: 'u' };

/** Kullanıcı adı alanına yazılanı izin verilen biçime çevirir (küçük harf, rakam, _; Türkçe harfler karşılığına). */
export const cleanUsername = (t: string) =>
  t
    .toLocaleLowerCase('tr-TR')
    .replace(/[ışğüöçâîû]/g, (c) => TR_ASCII[c])
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 20);

export async function usernameStatus(name: string): Promise<UsernameStatus | null> {
  const { data, error } = await supabase.rpc('username_status', { p_username: name });
  return error ? null : (data as UsernameStatus);
}

export const USERNAME_MESSAGES: Record<UsernameStatus, string> = {
  ok: 'Kullanılabilir',
  taken: 'Bu kullanıcı adı alınmış. Başka bir tane dene.',
  invalid: 'Kullanıcı adı 3-20 karakter olmalı; yalnızca küçük harf, rakam ve _ içerebilir.',
  reserved: '“VOPILA” adı resmî hesaplara ayrılmıştır.',
};

/** Yazmayı bırakınca (400 ms) sunucuya sorar. `skip` true ise (ör. mevcut adın) sormaz. */
export function useUsernameCheck(name: string, skip = false) {
  const [result, setResult] = useState<{ name: string; status: UsernameStatus | null } | null>(null);
  useEffect(() => {
    if (skip || name.length < 3) return;
    let alive = true;
    const t = setTimeout(() => {
      usernameStatus(name).then((status) => {
        if (alive) setResult({ name, status });
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, skip]);
  if (skip || !name) return null;
  if (name.length < 3) return 'invalid' as const;
  return result && result.name === name ? result.status : 'checking';
}

export function UsernameHint({ status }: { status: UsernameStatus | 'checking' | null }) {
  if (!status) return null;
  const text = status === 'checking' ? 'Kontrol ediliyor…' : (status === 'ok' ? '✓ ' : '') + USERNAME_MESSAGES[status];
  const color = status === 'ok' ? Colors.success : status === 'checking' ? Colors.textMuted : Colors.live;
  return (
    <VText variant="caption" color={color} style={{ marginTop: -4 }}>
      {text}
    </VText>
  );
}
