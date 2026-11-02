import { beforeEach, describe, expect, it } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { addHistory, clearHistory, loadHistory, removeHistory, type HistoryItem } from '@/lib/search-history';

const q = (text: string): HistoryItem => ({ kind: 'query', text });
const u = (id: string): HistoryItem => ({ kind: 'user', id, name: id, username: id, avatar: '', verified: false });

beforeEach(() => AsyncStorage.clear());

describe('arama geçmişi', () => {
  it('en yeni başta, tekrar aranan öne taşınır (çift kayıt yok)', async () => {
    await addHistory('me', q('kedi'));
    await addHistory('me', u('ali'));
    const list = await addHistory('me', q('kedi'));
    expect(list).toEqual([q('kedi'), u('ali')]);
  });

  it('en fazla 15 kayıt tutar', async () => {
    for (let i = 0; i < 20; i++) await addHistory('me', q(`a${i}`));
    const list = await loadHistory('me');
    expect(list).toHaveLength(15);
    expect(list[0]).toEqual(q('a19'));
  });

  it('hesaplar birbirinin geçmişini görmez', async () => {
    await addHistory('ayse', q('gizli arama'));
    expect(await loadHistory('burak')).toEqual([]);
  });

  it('tek tek ve tümden silinir', async () => {
    await addHistory('me', q('bir'));
    await addHistory('me', u('ali'));
    expect(await removeHistory('me', u('ali'))).toEqual([q('bir')]);
    await clearHistory('me');
    expect(await loadHistory('me')).toEqual([]);
  });

  it('bozuk kayıt uygulamayı çökertmez', async () => {
    await AsyncStorage.setItem('vopila-search-history-v1:me', '{bozuk');
    expect(await loadHistory('me')).toEqual([]);
    await AsyncStorage.setItem('vopila-search-history-v1:me', JSON.stringify([{ kind: 'kotu' }, q('iyi'), null]));
    expect(await loadHistory('me')).toEqual([q('iyi')]);
  });
});
