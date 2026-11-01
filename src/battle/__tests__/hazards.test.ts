import { describe, it, expect } from 'vitest';
import {
  emptyHazards,
  hazardMoveKind,
  addHazard,
  hasHazards,
  clearHazards,
  hazardEntryEffect,
  type HazardSet,
} from '../hazards.js';

/**
 * Ловушки в обычных боях. Раньше Stealth Rock / Spikes / Toxic Spikes /
 * Sticky Web работали только в PvP, а в PvE были пустышкой («ничего не
 * произошло»). Эти тесты фиксируют правила.
 */
describe('hazardMoveKind — распознавание атак-ловушек', () => {
  it('четыре канонные ловушки', () => {
    expect(hazardMoveKind('stealth-rock')).toBe('rocks');
    expect(hazardMoveKind('spikes')).toBe('spikes');
    expect(hazardMoveKind('toxic-spikes')).toBe('toxic');
    expect(hazardMoveKind('sticky-web')).toBe('sticky');
  });

  it('обычные атаки — не ловушки', () => {
    expect(hazardMoveKind('tackle')).toBeNull();
    expect(hazardMoveKind('defog')).toBeNull();
    expect(hazardMoveKind('')).toBeNull();
  });
});

describe('addHazard — лимиты слоёв', () => {
  it('камни и паутина ставятся один раз', () => {
    const h = emptyHazards();
    addHazard(h, 'rocks');
    addHazard(h, 'rocks');
    addHazard(h, 'sticky');
    addHazard(h, 'sticky');
    expect(h.rocks).toBe(true);
    expect(h.sticky).toBe(true);
  });

  it('шипы — максимум 3 слоя, токсичные — 2', () => {
    const h = emptyHazards();
    for (let i = 0; i < 5; i++) addHazard(h, 'spikes');
    for (let i = 0; i < 5; i++) addHazard(h, 'toxic');
    expect(h.spikes).toBe(3);
    expect(h.toxic).toBe(2);
  });

  it('hasHazards / clearHazards', () => {
    const h = emptyHazards();
    expect(hasHazards(h)).toBe(false);
    addHazard(h, 'spikes');
    expect(hasHazards(h)).toBe(true);
    clearHazards(h);
    expect(hasHazards(h)).toBe(false);
  });
});

describe('hazardEntryEffect — что получает входящий', () => {
  const withRocks = (): HazardSet => {
    const h = emptyHazards();
    h.rocks = true;
    return h;
  };

  it('камни: 1/8 HP без множителя', () => {
    const res = hazardEntryEffect(withRocks(), 80);
    expect(res.damage).toBe(10);
    expect(res.lines.join(' ')).toMatch(/Камни/);
  });

  it('камни: множитель по типу (2× → 1/4 HP, 0.25× → минимум 1)', () => {
    expect(hazardEntryEffect(withRocks(), 80, { rocksMultiplier: 2 }).damage).toBe(20);
    expect(hazardEntryEffect(withRocks(), 80, { rocksMultiplier: 0.25 }).damage).toBe(2);
    expect(hazardEntryEffect(withRocks(), 3, { rocksMultiplier: 0.25 }).damage).toBe(1);
  });

  it('шипы: 1/8, 1/6, 1/4 по слоям', () => {
    const mk = (n: number) => {
      const h = emptyHazards();
      h.spikes = n;
      return hazardEntryEffect(h, 120);
    };
    expect(mk(1).damage).toBe(15);
    expect(mk(2).damage).toBe(20);
    expect(mk(3).damage).toBe(30);
  });

  it('воздушные покемоны не получают шипы/паутину, но камни их достают', () => {
    const h = emptyHazards();
    h.rocks = true;
    h.spikes = 3;
    h.sticky = true;
    const flying = hazardEntryEffect(h, 120, { grounded: false });
    expect(flying.damage).toBe(15); // только камни
    expect(flying.speedDrop).toBe(false);
    const ground = hazardEntryEffect(h, 120, { grounded: true });
    expect(ground.damage).toBe(45);
    expect(ground.speedDrop).toBe(true);
  });

  it('токсичные шипы: 1 слой — обычный яд, 2 слоя — токсичный', () => {
    const h = emptyHazards();
    h.toxic = 1;
    expect(hazardEntryEffect(h, 100).status).toBe('psn');
    h.toxic = 2;
    expect(hazardEntryEffect(h, 100).status).toBe('tox');
  });

  it('не накладывают статус, если он уже есть', () => {
    const h = emptyHazards();
    h.toxic = 2;
    expect(hazardEntryEffect(h, 100, { hasStatus: true }).status).toBeNull();
  });

  it('пустые ловушки ничего не делают; нулевой maxHP безопасен', () => {
    const res = hazardEntryEffect(emptyHazards(), 100);
    expect(res).toEqual({ damage: 0, status: null, speedDrop: false, lines: [] });
    expect(hazardEntryEffect(withRocks(), 0).damage).toBe(0);
  });
});
