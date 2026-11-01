import { describe, it, expect, vi } from 'vitest';
import { looksLikeStaleChunk, healStaleChunk, RELOAD_GUARD_KEY, RELOAD_GUARD_MS } from '../stale-chunk.js';

/**
 * Если игрок держал мини-приложение открытым в момент деплоя, приложение
 * умирало с «Failed to fetch dynamically imported module» — видели это на живом
 * проде. Лечение: одна перезагрузка страницы (index.html с no-cache принесёт
 * новые чанки). Тесты фиксируют: какие сообщения считаем деплой-гонкой, что
 * перезагружаемся ровно один раз за окно и что отсутствие sessionStorage не
 * ломает лечение.
 */

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
    clear: () => map.clear(),
    _map: map,
  } as unknown as Storage & { _map: Map<string, string> };
}

describe('looksLikeStaleChunk', () => {
  it('узнаёт настоящие сообщения Vite/браузера', () => {
    expect(
      looksLikeStaleChunk('TypeError: Failed to fetch dynamically imported module: https://x/assets/init-CgplV6yc.js')
    ).toBe(true);
    expect(looksLikeStaleChunk('Importing a module script failed.')).toBe(true);
    expect(looksLikeStaleChunk('error loading dynamically imported module')).toBe(true);
  });

  it('не трогает обычные ошибки', () => {
    expect(looksLikeStaleChunk('TypeError: Cannot read properties of null')).toBe(false);
    expect(looksLikeStaleChunk('NetworkError when attempting to fetch resource.')).toBe(false);
    expect(looksLikeStaleChunk('')).toBe(false);
  });
});

describe('healStaleChunk', () => {
  it('перезагружает страницу и запоминает момент', () => {
    const storage = fakeStorage();
    const reload = vi.fn();
    const ok = healStaleChunk('Failed to fetch dynamically imported module: /assets/init-x.js', {
      storage, reload, now: () => 1_000_000, warn: () => {},
    });
    expect(ok).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(RELOAD_GUARD_KEY)).toBe('1000000');
  });

  it('второй раз в окне не перезагружает (защита от цикла)', () => {
    const storage = fakeStorage({ [RELOAD_GUARD_KEY]: '1000000' });
    const reload = vi.fn();
    const ok = healStaleChunk('Failed to fetch dynamically imported module: /assets/x.js', {
      storage, reload, now: () => 1_000_000 + RELOAD_GUARD_MS - 1000, warn: () => {},
    });
    expect(ok).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('после окна снова можно перезагрузиться', () => {
    const storage = fakeStorage({ [RELOAD_GUARD_KEY]: '1000000' });
    const reload = vi.fn();
    const ok = healStaleChunk('Failed to fetch dynamically imported module: /assets/x.js', {
      storage, reload, now: () => 1_000_000 + RELOAD_GUARD_MS + 1, warn: () => {},
    });
    expect(ok).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('посторонние ошибки не вызывают перезагрузку', () => {
    const reload = vi.fn();
    expect(healStaleChunk('Cannot read properties of undefined', { storage: fakeStorage(), reload, warn: () => {} })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('без storage (приватный режим) всё равно лечит', () => {
    const reload = vi.fn();
    const ok = healStaleChunk('Failed to fetch dynamically imported module: /assets/x.js', {
      storage: null, reload, now: () => 5, warn: () => {},
    });
    expect(ok).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('падающее хранилище не мешает перезагрузке', () => {
    const broken = {
      getItem: () => { throw new Error('SecurityError'); },
      setItem: () => { throw new Error('SecurityError'); },
      removeItem: () => {},
      key: () => null,
      length: 0,
      clear: () => {},
    } as unknown as Storage;
    const reload = vi.fn();
    const ok = healStaleChunk('Failed to fetch dynamically imported module: /assets/x.js', {
      storage: broken, reload, now: () => 5, warn: () => {},
    });
    expect(ok).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
