import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchPokeAPI,
  clearPokeCache,
  POKE_DISK_PREFIX,
  POKE_TTL_MS,
  POKE_MAX_ENTRIES,
  POKE_DISK_MAX_ENTRY_BYTES,
} from '../api.js';

/**
 * Клиентский кэш PokeAPI — это не микрооптимизация: клиент дёргает прокси на
 * каждого встреченного покемона, его вид, эволюцию, атаки и покедекс, а дампы
 * весят до 400 КБ. Без кэша один и тот же покемон качается заново десятки раз
 * за сессию, и трафик Neon (5 ГБ/мес) снова уйдёт в лимит.
 *
 * Тесты проверяют контракт: один сетевой запрос на повторные вызовы, дедуп
 * одновременных вызовов, TTL в памяти, попадание из localStorage после
 * «перезагрузки» (очистки памяти), устойчивость к битому хранилищу.
 */

/** Мини-localStorage: в node-окружении Vitest его нет. */
function installFakeStorage() {
  const store = new Map<string, string>();
  const fake = {
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
    _store: store,
  };
  vi.stubGlobal('localStorage', fake);
  return fake;
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as any;
}

let storage: ReturnType<typeof installFakeStorage>;

beforeEach(() => {
  storage = installFakeStorage();
  clearPokeCache();
});

afterEach(() => {
  clearPokeCache();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchPokeAPI: кэш и дедупликация', () => {
  it('повторный вызов не идёт в сеть (память)', async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse({ id: 25, name: 'pikachu' }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchPokeAPI('pokemon/25');
    const second = await fetchPokeAPI('pokemon/25');

    expect(first).toEqual({ id: 25, name: 'pikachu' });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pokeapi/pokemon/25');
  });

  it('полный URL pokeapi.co нормализуется и тоже кэшируется', async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse({ id: 6 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPokeAPI('https://pokeapi.co/api/v2/pokemon-species/6');
    await fetchPokeAPI('pokemon-species/6');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/pokeapi/pokemon-species/6');
  });

  it('одновременные вызовы одного пути — один сетевой запрос', async () => {
    let release!: (v: any) => void;
    const gate = new Promise((r) => { release = r; });
    const fetchMock = vi.fn((_url: string) => gate.then(() => jsonResponse({ id: 1 })));
    vi.stubGlobal('fetch', fetchMock);

    const p1 = fetchPokeAPI('pokemon/1');
    const p2 = fetchPokeAPI('pokemon/1');
    release(null);
    const [a, b] = await Promise.all([p1, p2]);

    expect(a).toEqual(b);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ошибка HTTP не кэшируется и пробрасывается', async () => {
    const fetchMock = vi.fn(async (_url: string) => jsonResponse({}, false, 500));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPokeAPI('pokemon/999')).rejects.toThrow('PokeAPI error: 500');
    // Второй вызов снова идёт в сеть: отрицательный результат не запомнили.
    await expect(fetchPokeAPI('pokemon/999')).rejects.toThrow('PokeAPI error: 500');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('запись в памяти живёт TTL и потом истекает', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 4 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    await fetchPokeAPI('pokemon/4');
    vi.setSystemTime(Date.now() + POKE_TTL_MS - 1000);
    await fetchPokeAPI('pokemon/4');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Диск тоже истёк — иначе после TTL памяти ответ придёт с диска.
    vi.setSystemTime(Date.now() + POKE_TTL_MS + 24 * 60 * 60 * 1000);
    await fetchPokeAPI('pokemon/4');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('вытесняет старые записи, не давая памяти расти безгранично', async () => {
    const fetchMock = vi.fn(async (url: string) => jsonResponse({ url }));
    vi.stubGlobal('fetch', fetchMock);

    for (let i = 0; i < POKE_MAX_ENTRIES + 5; i++) await fetchPokeAPI(`pokemon/${i}`);
    // Чистим диск, чтобы проверять именно память: иначе вытесненная запись
    // просто поднимется из localStorage и сети не будет.
    storage._store.clear();

    const before = fetchMock.mock.calls.length;
    await fetchPokeAPI('pokemon/0'); // вытеснена из памяти -> снова в сеть
    expect(fetchMock.mock.calls.length).toBe(before + 1);
    // А свежая запись всё ещё в памяти — в сеть не идёт.
    await fetchPokeAPI(`pokemon/${POKE_MAX_ENTRIES + 4}`);
    expect(fetchMock.mock.calls.length).toBe(before + 1);
  });

  it('данные переживают «перезагрузку» через localStorage', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 7, name: 'squirtle' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPokeAPI('pokemon/7');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Перезагрузка страницы: память пуста, localStorage — нет.
    const saved = new Map(storage._store);
    storage._store.clear();
    for (const [k, v] of saved) storage._store.set(k, v);
    clearPokeCache();
    for (const [k, v] of saved) storage._store.set(k, v);

    const again = await fetchPokeAPI('pokemon/7');
    expect(again).toEqual({ id: 7, name: 'squirtle' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('очень крупные ответы не кладутся на диск (покедекс не съест квоту)', async () => {
    const huge = { blob: 'x'.repeat(POKE_DISK_MAX_ENTRY_BYTES + 1000) };
    const fetchMock = vi.fn(async () => jsonResponse(huge));
    vi.stubGlobal('fetch', fetchMock);

    await fetchPokeAPI('pokemon/huge');
    const diskKeys = Array.from(storage._store.keys()).filter((k) => k.startsWith(POKE_DISK_PREFIX));
    expect(diskKeys).toHaveLength(0);
  });

  it('битая запись в localStorage не ломает загрузку', async () => {
    storage.setItem(`${POKE_DISK_PREFIX}pokemon/9`, '{это не json');
    const fetchMock = vi.fn(async () => jsonResponse({ id: 9 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPokeAPI('pokemon/9')).resolves.toEqual({ id: 9 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('мутации полученного объекта не портят кэш (каждый вызов — своя копия)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 25, stats: [{ base_stat: 35 }], currentHp: 100 }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchPokeAPI('pokemon/25');
    first.currentHp = 1;
    first.stats[0].base_stat = 0;
    first.extra = 'мусор';

    const second = await fetchPokeAPI('pokemon/25');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.currentHp).toBe(100);
    expect(second.stats[0].base_stat).toBe(35);
    expect(second.extra).toBeUndefined();
    expect(second).not.toBe(first);
  });

  it('без localStorage (запрещённое хранилище) функция продолжает работать', async () => {
    vi.stubGlobal('localStorage', undefined);
    const fetchMock = vi.fn(async () => jsonResponse({ id: 10 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchPokeAPI('pokemon/10')).resolves.toEqual({ id: 10 });
    await expect(fetchPokeAPI('pokemon/10')).resolves.toEqual({ id: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1); // память всё равно работает
  });
});

