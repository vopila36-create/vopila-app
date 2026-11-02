/**
 * Geçirdiğin süre: uygulama ön plandayken geçen süre gün gün telefonda tutulur.
 * Günlük sınır aşılınca (günde bir kez) hatırlatma gösterilir. Sınır hesapta saklanır (syncDailyLimit).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';
import { Alert, AppState } from 'react-native';

import { fetchMySettings } from '@/lib/settings-api';

const KEY = 'vopila-usage-v1';
const LIMIT_KEY = 'vopila-usage-limit-v1';
const KEEP_DAYS = 14;

type Usage = { days: Record<string, number>; warned?: string };

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function read(): Promise<Usage> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Usage) : { days: {} };
  } catch {
    return { days: {} };
  }
}

async function write(u: Usage) {
  const keep = Object.keys(u.days).sort().slice(-KEEP_DAYS);
  const days: Record<string, number> = {};
  for (const k of keep) days[k] = u.days[k];
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...u, days })).catch(() => {});
}

/** Son 7 günün dakikaları (eskiden yeniye). */
export async function lastWeek(): Promise<{ day: string; minutes: number }[]> {
  const u = await read();
  const out: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    out.push({ day: k, minutes: Math.round((u.days[k] ?? 0) / 60) });
  }
  return out;
}

/** Bugün uygulamada geçen süre (saniye). */
export async function todaySeconds(): Promise<number> {
  const u = await read();
  return u.days[dayKey()] ?? 0;
}

export async function getDailyLimit(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(LIMIT_KEY).catch(() => null);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function setDailyLimit(minutes: number | null) {
  if (minutes) await AsyncStorage.setItem(LIMIT_KEY, String(minutes)).catch(() => {});
  else await AsyncStorage.removeItem(LIMIT_KEY).catch(() => {});
}

/**
 * Hesaptaki günlük sınırı (user_settings.daily_limit_min) telefona alır: sınır hesapla birlikte taşınır,
 * başka telefonda da aynı kalır. Sunucuya ulaşılamazsa telefondaki değer kullanılır.
 */
export async function syncDailyLimit(myId: string): Promise<number | null> {
  const res = await fetchMySettings(myId);
  if (!res.ok) return getDailyLimit();
  const minutes = res.data.daily_limit_min && res.data.daily_limit_min > 0 ? res.data.daily_limit_min : null;
  await setDailyLimit(minutes);
  return minutes;
}

/** Uygulama açıkken süreyi sayar (kök yerleşimde bir kez çağrılır). */
export function useUsageTracker() {
  useEffect(() => {
    let since = AppState.currentState === 'active' ? Date.now() : 0;

    const flush = async () => {
      if (!since) return;
      const secs = Math.min((Date.now() - since) / 1000, 3600);
      since = AppState.currentState === 'active' ? Date.now() : 0;
      if (secs < 1) return;
      const u = await read();
      const k = dayKey();
      u.days[k] = (u.days[k] ?? 0) + secs;
      const limit = await getDailyLimit();
      if (limit && u.days[k] >= limit * 60 && u.warned !== k) {
        u.warned = k;
        Alert.alert(
          'Mola zamanı',
          `Bugün VOPILA'da ${limit} dakikayı doldurdun. Kısa bir ara vermeye ne dersin? Sınırı Ayarlar > Geçirdiğin süre bölümünden değiştirebilirsin.`,
        );
      }
      await write(u);
    };

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') since = Date.now();
      else flush();
    });
    // Uygulama uzun süre açık kalırsa dakikada bir kaydet
    const t = setInterval(flush, 60_000);
    return () => {
      sub.remove();
      clearInterval(t);
      flush();
    };
  }, []);
}
