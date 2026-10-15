import { describe, it, expect } from 'vitest';
import { buildWildMoveset, wildMoveMinLevel, syntheticTackle } from '../logic.js';

/**
 * Сбор сета дикого строго по уровню (H1/H2): только level-up атаки
 * с min level_learned_at <= level, порядок по возрастанию min,
 * фолбэк — самая ранняя level-up / синтетический Tackle.
 *
 * Строгость относительно filterMovesByLevel (battle/core.ts, чужой файл):
 * machine/egg/tutor-записи сюда не попадают даже фолбэком — только level-up.
 */

const det = (name: string, levels: number[], method = 'level-up') => ({
  name,
  power: 40,
  accuracy: 100,
  pp: 35,
  type: { name: 'normal' },
  damage_class: { name: 'physical' },
  meta: {},
  version_group_details: levels.map((lv) => ({
    level_learned_at: lv,
    move_learn_method: { name: method },
  })),
});

const names = (list: any[]) => list.map((m) => m.name);

describe('wildMoveMinLevel', () => {
  it('минимум по всем версиям', () => {
    expect(wildMoveMinLevel(det('flail', [25, 5]))).toBe(5);
  });

  it('без level-up записей — null (машина/яйцо не уровень)', () => {
    expect(wildMoveMinLevel(det('tm-move', [0], 'machine'))).toBeNull();
    expect(wildMoveMinLevel(det('egg-move', [0], 'egg'))).toBeNull();
    expect(wildMoveMinLevel({ name: 'broken' })).toBeNull();
  });
});

describe('buildWildMoveset', () => {
  it('маджикарп 5 уровня: только сплэш, без гидропомпы', () => {
    const pool = [
      det('splash', [1]),
      det('tackle', [15]),
      det('hydro-pump', [30]),
    ];
    expect(names(buildWildMoveset(pool, 5))).toEqual(['splash']);
  });

  it('тот же маджикарп на 30: всё по порядку изучения', () => {
    const pool = [
      det('hydro-pump', [30]),
      det('splash', [1]),
      det('tackle', [15]),
    ];
    expect(names(buildWildMoveset(pool, 30))).toEqual(['splash', 'tackle', 'hydro-pump']);
  });

  it('берётся минимальный уровень из всех версий', () => {
    expect(names(buildWildMoveset([det('flail', [25, 5])], 5))).toEqual(['flail']);
  });

  it('машинные/яичные атаки исключены даже фолбэком — только level-up', () => {
    const pool = [
      det('tm-move', [0], 'machine'),
      det('egg-move', [0], 'egg'),
    ];
    const out = buildWildMoveset(pool, 50);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('tackle');
  });

  it('машинная не пролезает рядом с level-up', () => {
    const pool = [det('splash', [1]), det('tm-fire', [0], 'machine')];
    expect(names(buildWildMoveset(pool, 1))).toEqual(['splash']);
  });

  it('ничего известного — самая ранняя level-up, не Tackle из пустоты', () => {
    const pool = [det('hydro-pump', [30]), det('tackle', [15])];
    expect(names(buildWildMoveset(pool, 5))).toEqual(['tackle']);
  });

  it('пусто: синтетический Tackle с боевыми полями', () => {
    const out = buildWildMoveset([], 5);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('tackle');
    expect(out[0].power).toBe(40);
    expect(out[0].damage_class.name).toBe('physical');
  });

  it('мусор на входе: тоже Tackle, не падение', () => {
    expect(buildWildMoveset(undefined as any, 5)[0].name).toBe('tackle');
    expect(buildWildMoveset(null as any, 0)[0].name).toBe('tackle');
    expect(buildWildMoveset([null, undefined] as any, 5)[0].name).toBe('tackle');
  });

  it('большой пул не режется: годные в конце списка находятся', () => {
    // Регресс мест сбора в core.ts: slice(0, 20) в порядке PokeAPI и top-30
    // по убыванию выкидывали низкоуровневые атаки ДО фильтра. Хелпер берёт
    // весь пул — вызывающий обязан передать все детали без нарезки.
    const filler = Array.from({ length: 40 }, (_, i) => det(`late-${i}`, [50 + i]));
    const pool = [...filler, det('splash', [1]), det('tackle', [5])];
    expect(names(buildWildMoveset(pool, 5))).toEqual(['splash', 'tackle']);
  });
});

describe('syntheticTackle', () => {
  it('боеготов: урон, точность, PP, физика', () => {
    const t = syntheticTackle();
    expect(t.name).toBe('tackle');
    expect(t.power).toBe(40);
    expect(t.accuracy).toBe(100);
    expect(t.pp).toBe(35);
    expect(t.damage_class.name).toBe('physical');
  });
});
