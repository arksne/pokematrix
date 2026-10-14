import { describe, it, expect, vi } from 'vitest';
import { store } from '../store.js';
import { GameStore } from '../store.js';

/**
 * Нормализация типов туториала в store.checkTutorialProgress.
 * Без неё короткие имена ('catch','battle','heal','item' из старого
 * комментария npcs.ts) молча не совпадают с quest.type (*_x) и прогресс
 * не двигается.
 */

describe('normalizeTutorialType', () => {
  it('канон проходит как есть', () => {
    for (const t of ['catch_x', 'defeat_x', 'use_item', 'explore', 'earn_money', 'collect_drop', 'take', 'complete']) {
      expect((GameStore as any).normalizeTutorialType(t)).toBe(t);
    }
  });

  it('легаси-алиасы маппятся на канон', () => {
    const cases: Record<string, string> = {
      catch: 'catch_x',
      battle: 'defeat_x',
      defeat: 'defeat_x',
      heal: 'use_item',
      item: 'use_item',
      use: 'use_item',
      money: 'earn_money',
      earn: 'earn_money',
      drop: 'collect_drop',
      collect: 'collect_drop',
    };
    for (const [from, to] of Object.entries(cases)) {
      expect((GameStore as any).normalizeTutorialType(from)).toBe(to);
    }
  });

  it('неизвестный тип не меняется', () => {
    expect((GameStore as any).normalizeTutorialType('boss_win')).toBe('boss_win');
  });
});

describe('checkTutorialProgress emit', () => {
  it('короткое имя уходит нормализованным', () => {
    const fn = vi.fn();
    const off = store.on('tutorial:progress', fn);
    try {
      store.checkTutorialProgress('catch', 1, 'pokeball');
      expect(fn).toHaveBeenCalledWith('catch_x', 1, 'pokeball');
    } finally {
      off();
    }
  });

  it('канон уходит без изменений', () => {
    const fn = vi.fn();
    const off = store.on('tutorial:progress', fn);
    try {
      store.checkTutorialProgress('defeat_x', 2, undefined);
      expect(fn).toHaveBeenCalledWith('defeat_x', 2, undefined);
    } finally {
      off();
    }
  });
});
