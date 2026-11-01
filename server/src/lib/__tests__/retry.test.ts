import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff, retryDelayMs } from '../retry.js';

/**
 * Прод-логи показали crash-loop при транзиентных ошибках БД: миграция падала,
 * контейнер умирал, Render поднимал новый, тот падал снова. Здесь проверяем
 * механику повторов, которой это лечится.
 */
describe('retryDelayMs — экспоненциальная пауза', () => {
  it('удваивается и упирается в потолок', () => {
    expect(retryDelayMs(1, 2000, 30000)).toBe(2000);
    expect(retryDelayMs(2, 2000, 30000)).toBe(4000);
    expect(retryDelayMs(3, 2000, 30000)).toBe(8000);
    expect(retryDelayMs(4, 2000, 30000)).toBe(16000);
    expect(retryDelayMs(5, 2000, 30000)).toBe(30000);
    expect(retryDelayMs(9, 2000, 30000)).toBe(30000);
  });

  it('мусорные аргументы не ломают расчёт', () => {
    expect(retryDelayMs(0, 2000, 30000)).toBe(2000);
    expect(retryDelayMs(Number.NaN, 2000, 30000)).toBe(2000);
    expect(retryDelayMs(1, 0, 0)).toBe(1);
  });
});

describe('retryWithBackoff', () => {
  it('успех с первой попытки — без пауз', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => 'ok');
    await expect(retryWithBackoff(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('транзиентная ошибка переживается повтором', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error('Connection terminated unexpectedly');
      return 'recovered';
    });
    await expect(retryWithBackoff(fn, { sleep, attempts: 5 })).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([2000, 4000]);
  });

  it('после всех попыток пробрасывает последнюю ошибку как есть', async () => {
    const sleep = vi.fn(async () => {});
    const boom = new Error('Your account or project has exceeded the quota');
    const fn = vi.fn(async () => {
      throw boom;
    });
    await expect(retryWithBackoff(fn, { sleep, attempts: 3, baseDelayMs: 100 })).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('onRetry получает ошибку, номер попытки и задержку; его падение не мешает', async () => {
    const sleep = vi.fn(async () => {});
    const onRetry = vi.fn(() => {
      throw new Error('логгер сломался');
    });
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error('blip');
      return 42;
    };
    await expect(retryWithBackoff(fn, { sleep, attempts: 2, onRetry })).resolves.toBe(42);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1, 2000);
  });

  it('attempts=1 — ровно одна попытка', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi.fn(async () => {
      throw new Error('nope');
    });
    await expect(retryWithBackoff(fn, { sleep, attempts: 1 })).rejects.toThrow('nope');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
