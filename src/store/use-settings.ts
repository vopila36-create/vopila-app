/** Sunucudaki kişisel ayarları (user_settings) okur; değişiklik ekranda hemen görünür, sonra kaydedilir. */
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, fetchMySettings, saveMySettings, type UserSettings } from '@/lib/settings-api';
import { useStore } from '@/store/app-store';

export function useMySettings() {
  const { myId } = useStore();
  const [loaded, setLoaded] = useState<{ owner: string; value: UserSettings } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    fetchMySettings(myId).then((res) => {
      if (cancelled) return;
      if (res.ok) setLoaded({ owner: myId, value: res.data });
      else setError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [myId]);

  const settings = loaded && loaded.owner === myId ? loaded.value : null;

  const save = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!myId) return;
      const before = settings ?? DEFAULT_SETTINGS;
      setLoaded({ owner: myId, value: { ...before, ...patch } });
      setSaved(false);
      const res = await saveMySettings(myId, patch);
      if (!res.ok) {
        setLoaded({ owner: myId, value: before });
        setError(res.error);
        return;
      }
      setError(null);
      setSaved(true);
    },
    [myId, settings],
  );

  return { myId, settings, save, error, saved };
}
