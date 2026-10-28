/**
 * Giriş yapan kişinin yaş grubu. 15–18 yaş kuralları (otomatik oynatma ve sonsuz kaydırma yok)
 * uygulamada buradan okunur; asıl kurallar sunucuda (0017_age_rules.sql).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchMyAge, type AgeStatus } from '@/lib/age-api';
import { useAuth } from '@/store/auth';

type AgeCtx = {
  /** null = henüz yüklenmedi (ya da giriş yok) */
  age: AgeStatus | null;
  isTeen: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AgeCtx>({ age: null, isTeen: false, refresh: async () => {} });

export function AgeProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  // Sonuç sahibinin kimliğiyle tutulur; hesap değişince eskisi kullanılmaz
  const [state, setState] = useState<{ uid: string; age: AgeStatus } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchMyAge().then((age) => {
      if (!cancelled && age) setState({ uid: userId, age });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const age = await fetchMyAge();
    if (age) setState({ uid: userId, age });
  }, [userId]);

  const value = useMemo<AgeCtx>(() => {
    const age = state && state.uid === userId ? state.age : null;
    return { age, isTeen: age?.group === 'teen', refresh };
  }, [state, userId, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAge = () => useContext(Ctx);
