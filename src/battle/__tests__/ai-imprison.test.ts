import { describe, it, expect } from 'vitest';
import { selectEnemyMove } from '../ai.js';

const moves = [
  { name: 'tackle', power: 40, type: { name: 'normal' }, damage_class: { name: 'physical' } },
  { name: 'swords-dance', power: null, type: { name: 'normal' }, damage_class: { name: 'status' }, target: { name: 'user' } },
  { name: 'ember', power: 40, type: { name: 'fire' }, damage_class: { name: 'special' } },
];
const pp = [{ current: 10, max: 10 }, { current: 10, max: 10 }, { current: 10, max: 10 }];
const attacker = { types: [{ type: { name: 'fire' } }] };
const defender = { apiData: { types: [{ type: { name: 'grass' } }] } };
const noMult = () => 1;

/** Imprison: ИИ не предлагает запрещённые атаки. */
describe('selectEnemyMove: banned (imprison)', () => {
  const base = { moves, movesPP: pp, attacker, defender, isTrainer: false, getTypeMultiplier: noMult };

  it('без бана — выбирает как обычно', () => {
    const r = selectEnemyMove(base);
    expect(r).not.toBeNull();
    expect(r.index).toBeGreaterThanOrEqual(0);
  });

  it('забаненное не выбирается', () => {
    for (let i = 0; i < 30; i++) {
      const r = selectEnemyMove({ ...base, banned: ['tackle', 'ember', 'swords-dance'].slice(0, 2) });
      expect(['swords-dance']).toContain(r.move.name);
    }
  });

  it('все забанены — бьёт чем есть, не виснет', () => {
    const r = selectEnemyMove({ ...base, banned: ['tackle', 'swords-dance', 'ember'] });
    expect(r).not.toBeNull();
    expect(r.index).toBeGreaterThanOrEqual(0);
  });

  it('тренер тоже уважает бан', () => {
    for (let i = 0; i < 10; i++) {
      const r = selectEnemyMove({ ...base, isTrainer: true, banned: ['ember'] });
      expect(r.move.name).not.toBe('ember');
    }
  });
});
