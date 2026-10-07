import { describe, it, expect } from 'vitest';
import { transportStatus } from '../location.js';

/**
 * Транспорт C3: паром 3ч, поезд 2ч. Чистая функция статуса рейса.
 */

describe('transportStatus', () => {
  it('нет рейса: none', () => {
    expect(transportStatus(null, 1000)).toEqual({ phase: 'none', msLeft: 0 });
    expect(transportStatus(undefined, 1000)).toEqual({ phase: 'none', msLeft: 0 });
    expect(transportStatus({}, 1000)).toEqual({ phase: 'none', msLeft: 0 });
  });

  it('в пути: aboard + остаток', () => {
    const tr = { vehicle: 'train', arriveAt: 10000 };
    expect(transportStatus(tr, 4000)).toEqual({ phase: 'aboard', msLeft: 6000 });
  });

  it('время вышло: arrived', () => {
    const tr = { vehicle: 'ferry', arriveAt: 10000 };
    expect(transportStatus(tr, 10000)).toEqual({ phase: 'arrived', msLeft: 0 });
    expect(transportStatus(tr, 99999)).toEqual({ phase: 'arrived', msLeft: 0 });
  });

  it('неизвестный транспорт: none', () => {
    expect(transportStatus({ vehicle: 'rocket', arriveAt: 99999 }, 1000))
      .toEqual({ phase: 'none', msLeft: 0 });
  });
});
