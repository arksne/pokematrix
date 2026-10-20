import { describe, it, expect } from 'vitest';
import { isStaleBuild } from '../version.js';

/**
 * Баннер свежести сборки: когда показывать «обнови игру».
 * Правило: оба значения — похожие на git-хэш, и это разные коммиты
 * (префиксы одного коммита разной длины — не stale).
 */
describe('isStaleBuild', () => {
  it('одинаковые коммиты — не stale', () => {
    expect(isStaleBuild('5fe9016', '5fe9016')).toBe(false);
    expect(isStaleBuild('5fe9016b83d74', '5fe9016')).toBe(false);
    expect(isStaleBuild('5fe9016', '5fe9016b83d74')).toBe(false);
  });

  it('разные коммиты — stale', () => {
    expect(isStaleBuild('28cf807', '5fe9016')).toBe(true);
    expect(isStaleBuild('ABCDEF1', 'abcdef2')).toBe(true);
  });

  it('мусор, dev и пусто — молчим, не stale', () => {
    for (const [s, c] of [
      ['dev', '5fe9016'], ['5fe9016', 'dev'], ['', ''], ['dev', 'dev'],
      [null, '5fe9016'], ['5fe9016', undefined], ['???', '5fe9016'],
      ['5fe9016', 'zzz'], ['1', '5fe9016'],
    ] as Array<[unknown, unknown]>) {
      expect(isStaleBuild(s, c), JSON.stringify([s, c])).toBe(false);
    }
  });
});
