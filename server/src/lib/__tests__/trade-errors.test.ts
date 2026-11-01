import { describe, it, expect } from 'vitest';
import {
  isExpectedTradeFailure,
  tradeFailureMessage,
  tradeFailureDetail,
  TRADE_FAILURE_PREFIX,
} from '../trade-errors.js';

/**
 * Прод-логи 01.11: восемь строк уровня error про «Покемон ta-mon-toctou больше
 * не в коллекции». Это ожидаемые отказы (включая проверку TOCTOU в
 * tools/prod-check), а не сбои сервера — они не должны выглядеть как аварии.
 */
describe('isExpectedTradeFailure', () => {
  it('отказ бизнес-логики распознаётся', () => {
    expect(
      isExpectedTradeFailure(new Error(`${TRADE_FAILURE_PREFIX}Покемон ta-mon-toctou больше не в коллекции`))
    ).toBe(true);
    expect(isExpectedTradeFailure(new Error('Trade failed: нет места в команде'))).toBe(true);
  });

  it('настоящие ошибки не считаются ожидаемыми', () => {
    expect(isExpectedTradeFailure(new Error('Connection terminated unexpectedly'))).toBe(false);
    expect(isExpectedTradeFailure(new Error(''))).toBe(false);
    // Строка с тем же текстом — тот же отказ: код не должен зависеть от того,
    // бросили Error или строку.
    expect(isExpectedTradeFailure('Trade failed: строка')).toBe(true);
    expect(isExpectedTradeFailure(null)).toBe(false);
    expect(isExpectedTradeFailure({ message: 'x' })).toBe(false);
  });
});

describe('tradeFailureMessage', () => {
  it('убирает служебный префикс', () => {
    expect(tradeFailureMessage(new Error(`${TRADE_FAILURE_PREFIX}Покемон не найден`))).toBe('Покемон не найден');
  });

  it('для неожиданных ошибок — общий текст, внутренности не утекают игроку', () => {
    expect(tradeFailureMessage(new Error('relation "users" does not exist'))).toBe('Ошибка выполнения обмена');
    expect(tradeFailureMessage(new Error('boom'), 'Не вышло')).toBe('Не вышло');
  });
});

describe('tradeFailureDetail', () => {
  it('даёт короткую строку для лога', () => {
    expect(tradeFailureDetail(new Error('Trade failed: x'))).toBe('Trade failed: x');
    expect(tradeFailureDetail('plain')).toBe('plain');
    expect(tradeFailureDetail({ a: 1 })).toBe('{"a":1}');
  });

  it('не падает на циклических объектах', () => {
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(typeof tradeFailureDetail(cyclic)).toBe('string');
  });
});
