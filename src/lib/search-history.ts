/**
 * Arama geçmişi (Instagram'daki "Son aramalar"): açılan kişiler ve aranan kelimeler.
 * Telefonda, hesaba özel anahtarla tutulur; sunucuya gönderilmez. Kullanıcı tek tek ya da tümden silebilir.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type HistoryItem =
  | { kind: 'user'; id: string; name: string; username: string; avatar: string; verified: boolean }
  | { kind: 'query'; text: string };

const MAX = 15;
const keyOf = (owner: string) => `vopila-search-history-v1:${owner}`;
const sameItem = (a: HistoryItem, b: HistoryItem) =>
  a.kind === 'user' && b.kind === 'user' ? a.id === b.id : a.kind === 'query' && b.kind === 'query' && a.text === b.text;

export async function loadHistory(owner: string): Promise<HistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(owner));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as HistoryItem[]).filter((x) => x && (x.kind === 'user' || x.kind === 'query')) : [];
  } catch {
    return [];
  }
}

async function save(owner: string, list: HistoryItem[]) {
  await AsyncStorage.setItem(keyOf(owner), JSON.stringify(list)).catch(() => {});
}

export async function addHistory(owner: string, item: HistoryItem): Promise<HistoryItem[]> {
  const list = await loadHistory(owner);
  const next = [item, ...list.filter((x) => !sameItem(x, item))].slice(0, MAX);
  await save(owner, next);
  return next;
}

export async function removeHistory(owner: string, item: HistoryItem): Promise<HistoryItem[]> {
  const next = (await loadHistory(owner)).filter((x) => !sameItem(x, item));
  await save(owner, next);
  return next;
}

export async function clearHistory(owner: string) {
  await AsyncStorage.removeItem(keyOf(owner)).catch(() => {});
}
