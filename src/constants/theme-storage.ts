/** Tema seçimini telefonda eşzamanlı saklar (expo-sqlite deposu). Web sürümü: theme-storage.web.ts */
import Storage from 'expo-sqlite/kv-store';

export function readThemeRaw(key: string): string | null {
  return Storage.getItemSync(key);
}

export function writeThemeRaw(key: string, value: string) {
  Storage.setItemSync(key, value);
}
