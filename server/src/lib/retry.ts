/**
 * Повтор операции с экспоненциальной паузой.
 *
 * Зачем: в логах прода 2026-10-31 видно каскад «[server] Migration FAILED»
 * (Neon: "exceeded the quota", затем "Connection terminated due to connection
 * timeout") — каждый такой блип ронял контейнер целиком, Render поднимал новый,
 * тот снова падал через секунду. Игрок в это время видел 503. Транзиентную
 * ошибку БД (короткий обрыв, лимит соединений, всплеск квоты) дешевле переждать,
 * чем устраивать crash-loop.
 *
 * Модуль намеренно чистый: sleep и логгер инжектируются, чтобы тесты не спали.
 */

export interface RetryOptions {
  /** Сколько всего попыток (>= 1). По умолчанию 5. */
  attempts?: number;
  /** Пауза перед второй попыткой, мс. Дальше удваивается. По умолчанию 2000. */
  baseDelayMs?: number;
  /** Потолок паузы, мс. По умолчанию 30000. */
  maxDelayMs?: number;
  /** Пауза (инжектируется в тестах). */
  sleep?: (ms: number) => Promise<void>;
  /** Колбэк перед повтором: (ошибка, номер попытки, задержка). */
  onRetry?: (err: unknown, attempt: number, delayMs: number) => void;
}

/** Пауза между попытками: base, 2×base, 4×base… но не больше maxDelayMs. */
export function retryDelayMs(attempt: number, baseDelayMs = 2000, maxDelayMs = 30000): number {
  const safeAttempt = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 1;
  const base = baseDelayMs > 0 ? baseDelayMs : 1;
  const raw = base * 2 ** (safeAttempt - 1);
  return Math.min(raw, maxDelayMs > 0 ? maxDelayMs : raw);
}

/**
 * Выполнить fn с повторами. Возвращает результат первой успешной попытки;
 * после последней неудачи пробрасывает ЕЁ ошибку (не оборачивает).
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, Math.floor(opts.attempts ?? 5));
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  const maxDelayMs = opts.maxDelayMs ?? 30000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= attempts) break;
      const delayMs = retryDelayMs(attempt, baseDelayMs, maxDelayMs);
      try {
        opts.onRetry?.(err, attempt, delayMs);
      } catch {
        /* лог не должен ломать повторы */
      }
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
