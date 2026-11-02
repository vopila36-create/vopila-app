/** Mağazada son bakılan ürünler (telefonda tutulur; Trendyol/Amazon'daki "Son baktıkların"). */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'vopila-recent-products-v1';
const MAX = 20;

export async function recentlyViewed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function markViewed(productId: string) {
  const list = await recentlyViewed();
  const next = [productId, ...list.filter((x) => x !== productId)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}
