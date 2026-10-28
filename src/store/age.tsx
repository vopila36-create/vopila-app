/**
 * Giriş yapan kişinin yaş grubu. 15–18 yaş kuralları (otomatik oynatma ve sonsuz kaydırma yok)
 * uygulamada buradan okunur; asıl kurallar sunucuda (0017_age_rules.sql).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchMyAge, type AgeStatus } from '@/lib/age-api';
import { fetchParentLinks } from '@/lib/parent-api';
import { useAuth } from '@/store/auth';

type AgeCtx = {
  /** null = henüz yüklenmedi (ya da giriş yok) */
  age: AgeStatus | null;
  isTeen: boolean;
  /** Ebeveynin koyduğu günlük süre sınırı (dakika) */
  parentLimit: number | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AgeCtx>({ age: null, isTeen: false, parentLimit: null, refresh: async () => {} });

async function load(): Promise<{ age: AgeStatus; parentLimit: number | null } | null> {
  const age = await fetchMyAge();
  if (!age) return null;
  if (age.group !== 'teen') return { age, parentLimit: null };
  const links = await fetchParentLinks();
  const mine = links?.find((l) => l.role === 'child');
  return { age, parentLimit: mine?.dailyLimitMin ?? null };
}

export function AgeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  // Sonuç sahibinin kimliğiyle tutulur; hesap değişince eskisi kullanılmaz
  const [state, setState] = useState<{ uid: string; age: AgeStatus; parentLimit: number | null } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    load().then((r) => {
      if (!cancelled && r) setState({ uid: userId, ...r });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const r = await load();
    if (r) setState({ uid: userId, ...r });
  }, [userId]);

  const value = useMemo<AgeCtx>(() => {
    const own = state && state.uid === userId ? state : null;
    const age = own?.age ?? null;
    return { age, isTeen: age?.group === 'teen', parentLimit: own?.parentLimit ?? null, refresh };
  }, [state, userId, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAge = () => useContext(Ctx);
