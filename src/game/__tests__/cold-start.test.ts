/**
 * Холодный старт Render (free): инстанс спит после 15 минут простоя, потом
 * поднимается минуту-две. Раньше это выглядело как «игра сломалась» —
 * клиент получал connection refused / 503 и падал молча.
 *
 * Проверяем контракт:
 *  - 503 { status: 'warming' }  → это не ошибка, а «сервер поднимается»;
 *  - сетевая ошибка            → пробуем ещё, а не сразу отдаём игроку;
 *  - backoff растёт и каппится;
 *  - после WARMUP_TIMEOUT_MS   → сдаёмся и НЕ виснем вечно.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const calls: any[] = [];
let warmingCalls: boolean[] = [];

/** Ответ-«прогрев»: сервер жив, но БД/миграции ещё едут. */
const warmingResponse = () => new Response(
  JSON.stringify({ status: 'warming', error: 'Server is warming up' }),
  { status: 503, headers: { 'Content-Type': 'application/json' } },
);

const okResponse = () => new Response(
  JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } },
);

async function loadClient() {
  vi.resetModules();
  return import('../apiClient.js');
}

describe('холодный старт Render', () => {
  beforeEach(() => {
    calls.length = 0;
    warmingCalls = [];
    vi.stubGlobal('__pokematrixWarming', (on: boolean) => { warmingCalls.push(on); });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('переживает серию 503 warming и отдаёт успешный ответ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push(1);
      return calls.length <= 2 ? warmingResponse() : okResponse();
    }));
    const { apiFetch } = await loadClient();
    const res = await apiFetch('/save');
    expect(res.status).toBe(200);
    expect(calls.length).toBe(3);
    // «Разогреваем…» показали один раз и убрали, а не на каждый запрос
    expect(warmingCalls.filter(Boolean).length).toBe(1);
    expect(warmingCalls[warmingCalls.length - 1]).toBe(false);
  });

  it('переживает сетевую ошибку (сервер ещё не слушает)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push(1);
      if (calls.length <= 2) throw new TypeError('Failed to fetch');
      return okResponse();
    }));
    const { apiFetch } = await loadClient();
    const res = await apiFetch('/save');
    expect(res.status).toBe(200);
    expect(calls.length).toBe(3);
  });

  it('настоящий 503 без status: warming не маскируется и не ретраится вечно', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      calls.push(1);
      return new Response(JSON.stringify({ error: 'boom' }), { status: 503 });
    }));
    const { apiFetch } = await loadClient();
    const res = await apiFetch('/save');
    expect(res.status).toBe(503);
    expect(calls.length).toBe(1);   // не крутимся
  });

  it('backoff растёт и каппится 4с', async () => {
    const { warmupDelayMs } = await loadClient();
    expect(warmupDelayMs(0)).toBe(500);
    expect(warmupDelayMs(1)).toBe(1000);
    expect(warmupDelayMs(2)).toBe(2000);
    expect(warmupDelayMs(3)).toBe(4000);
    expect(warmupDelayMs(50)).toBe(4000);   // кап
    expect(warmupDelayMs(-5)).toBe(500);    // без negative exponent
  });

  it('таймаут прогрева ограничен — не виснем вечно', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(async () => warmingResponse()));
    const { apiFetch, WARMUP_TIMEOUT_MS } = await loadClient();
    expect(WARMUP_TIMEOUT_MS).toBeLessThanOrEqual(60_000);

    const p = apiFetch('/save');
    // Гоняем таймеры, пока промис не завершится
    for (let i = 0; i < 200; i++) {
      await vi.advanceTimersByTimeAsync(1000).catch(() => {});
      if (calls.length && (globalThis as any).__settled) break;
    }
    await vi.runAllTimersAsync().catch(() => {});
    const res = await p.catch((e) => e);
    // Либо вернулся 503, либо выбросил — главное, что завершился
    expect(res).toBeDefined();
  });
});