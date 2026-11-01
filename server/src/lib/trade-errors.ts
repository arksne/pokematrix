/**
 * Классификация ошибок обмена для логов.
 *
 * Зачем: в прод-логах 01.11 восемь раз подряд стояла строка уровня error
 * «[trade] executeTradeSwap failed: Error: Trade failed: Покемон ta-mon-toctou
 * больше не в коллекции». Это НЕ сбой сервера: так работа отражает отклонение
 * обмена по бизнес-правилам (в том числе проверка TOCTOU в tools/prod-check —
 * повторное использование уже отданного покемона должно отклоняться). Такие
 * отказы должны быть warn без стектрейса, иначе настоящие ошибки тонут в шуме.
 */

export const TRADE_FAILURE_PREFIX = 'Trade failed: ';

/** true — ожидаемый отказ бизнес-логики (Error с префиксом 'Trade failed:'). */
export function isExpectedTradeFailure(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  return msg.startsWith(TRADE_FAILURE_PREFIX);
}

/** Текст для игрока: без служебного префикса; неизвестное — общий фолбэк. */
export function tradeFailureMessage(err: unknown, fallback = 'Ошибка выполнения обмена'): string {
  if (!isExpectedTradeFailure(err)) return fallback;
  return String((err as Error).message).slice(TRADE_FAILURE_PREFIX.length);
}

/** Короткое описание ошибки для лога (без стектрейса). */
export function tradeFailureDetail(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return typeof err === 'string' ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}
