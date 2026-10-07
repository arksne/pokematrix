import { describe, it, expect } from 'vitest';
import { filterMovesByLevel } from '../core.js';

/**
 * Атаки по уровню (H1/H2): дикие и лидеры знают только level-up атаки
 * с min level_learned_at <= level. Раньше сортировка брала топ по УБЫВАНИЮ
 * уровня изучения — отсюда Гидропомпа у Маджикарпа 5 уровня.
 */

const det = (name, levels) => ({
  name,
  power: 40,
  accuracy: 100,
  pp: 35,
  type: { name: 'normal' },
  damage_class: { name: 'physical' },
  meta: {},
  version_group_details: levels.map((lv) => ({
    level_learned_at: lv,
    move_learn_method: { name: 'level-up' },
  })),
});

const names = (list) => list.map((m) => m.name);

describe('filterMovesByLevel', () => {
  it('маджикарп 5 уровня: только сплэш, без гидропомпы', () => {
    const pool = [
      det('splash', [1]),
      det('tackle', [15]),
      det('hydro-pump', [30]),
    ];
    expect(names(filterMovesByLevel(pool, 5))).toEqual(['splash']);
  });

  it('тот же маджикарп на 30: всё по порядку изучения', () => {
    const pool = [
      det('hydro-pump', [30]),
      det('splash', [1]),
      det('tackle', [15]),
    ];
    expect(names(filterMovesByLevel(pool, 30))).toEqual(['splash', 'tackle', 'hydro-pump']);
  });

  it('берётся минимальный уровень из всех версий', () => {
    const pool = [det('flail', [25, 5])];
    expect(names(filterMovesByLevel(pool, 5))).toEqual(['flail']);
  });

  it('не-level-up методы (машина/яйцо) не считаются', () => {
    const pool = [{
      name: 'tm-move', power: 90, accuracy: 100, pp: 15,
      type: { name: 'fire' }, damage_class: { name: 'special' }, meta: {},
      version_group_details: [{ level_learned_at: 0, move_learn_method: { name: 'machine' } }],
    }];
    const out = filterMovesByLevel(pool, 50);
    expect(names(out)).toEqual(['tm-move']);
  });

  it('пусто: синтетический Tackle с боевыми полями', () => {
    const out = filterMovesByLevel([], 5);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('tackle');
    expect(out[0].power).toBe(40);
    expect(out[0].damage_class.name).toBe('physical');
  });

  it('мусор на входе: тоже Tackle, не падение', () => {
    expect(filterMovesByLevel(undefined, 5)[0].name).toBe('tackle');
    expect(filterMovesByLevel(null, 0)[0].name).toBe('tackle');
  });
});
