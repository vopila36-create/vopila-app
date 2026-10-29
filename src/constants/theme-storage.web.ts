/** Web: tema seçimi tarayıcı deposunda (expo-sqlite web derlemesine girmesin diye ayrı dosya). */
export function readThemeRaw(key: string): string | null {
  return globalThis.localStorage?.getItem(key) ?? null;
}

export function writeThemeRaw(key: string, value: string) {
  globalThis.localStorage?.setItem(key, value);
}
