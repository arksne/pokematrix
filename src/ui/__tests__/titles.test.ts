import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import { TITLES, getTitleById, isTitleId } from '../../data/titles.js';
import { AVATARS } from '../../data/avatars.js';

/**
 * Титулы тренеркарты: выдача, активный, сводка.
 * Чистая логика состояния (без DOM).
 */

beforeEach(() => {
  (state as any).titles = [];
  (state as any).activeTitle = null;
});

async function card() {
  return import('../trainer-card.js');
}

describe('titles data', () => {
  it('10 титулов пачки Пьютера, id уникальны', () => {
    expect(TITLES.length).toBe(10);
    const ids = TITLES.map((t) => t.id);
    expect(new Set(ids).size).toBe(10);
    for (const t of TITLES) {
      expect(t.icon.trim().length).toBeGreaterThan(0);
      expect(t.name.trim().length).toBeGreaterThan(0);
    }
  });

  it('getTitleById/isTitleId', () => {
    expect(getTitleById('rockBane')?.name).toBe('Гроза скал');
    expect(getTitleById('nope')).toBeUndefined();
    expect(isTitleId('undefeated')).toBe(true);
    expect(isTitleId('nope')).toBe(false);
  });
});

describe('grantTitle/setActiveTitle', () => {
  it('выдача нового, повтор — отказ, первый сразу активен', async () => {
    const m = await card();
    expect(m.grantTitle('pathfinder')).toBe(true);
    expect((state as any).titles).toEqual(['pathfinder']);
    expect((state as any).activeTitle).toBe('pathfinder');
    expect(m.grantTitle('pathfinder')).toBe(false);
    expect(m.grantTitle('nope')).toBe(false);
  });

  it('активный только из заработанных', async () => {
    const m = await card();
    expect(m.setActiveTitle('rockBane')).toBe(false); // не заработан
    m.grantTitle('rockBane');
    m.grantTitle('courier');
    expect(m.setActiveTitle('courier')).toBe(true);
    expect((state as any).activeTitle).toBe('courier');
    expect(m.setActiveTitle(null)).toBe(true);
    expect((state as any).activeTitle).toBeNull();
    expect(m.setActiveTitle('nope')).toBe(false);
  });

  it('getActiveTitle: только заработанный и активный', async () => {
    const m = await card();
    expect(m.getActiveTitle()).toBeUndefined();
    m.grantTitle('breeder');
    expect(m.getActiveTitle()?.id).toBe('breeder');
    (state as any).activeTitle = 'nope';
    expect(m.getActiveTitle()).toBeUndefined();
  });

  it('сводка считает титулы', async () => {
    const m = await card();
    expect(m.getTrainerSummary().titles).toBe(0);
    m.grantTitle('wanderer');
    m.grantTitle('tempered');
    expect(m.getTrainerSummary().titles).toBe(2);
  });
});

describe('аватары квестовые', () => {
  it('пак вырос до 32, новые id на месте', () => {
    expect(AVATARS.length).toBe(32);
    for (const id of ['trail-scout', 'swift-courier', 'crowned-champ', 'coin-magnate', 'egg-keeper', 'stone-crusher']) {
      expect(AVATARS.some((a) => a.id === id), id).toBe(true);
    }
  });
});
