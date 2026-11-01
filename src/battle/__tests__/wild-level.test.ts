import { describe, it, expect } from 'vitest';
import { baseWildLevelFor, routeNumber } from '../wild-level.js';

/**
 * Уровни диких покемонов. Два реальных бага, которые ловятся этими тестами:
 *
 *  1. В данных маршруты называются `route1`, `route12`, `seaRoute20`, а таблица
 *     уровней была написана под `route_1` → ни одна ветка не срабатывала, все
 *     маршруты шли в дефолт Lv 10-20 (не тот уровень, что задуман).
 *  2. Стартовый Пьютер-Сити не попадал ни в одну ветку → дефолт Lv 10-20 при
 *     старте с покемоном Lv 5: первый бой ваншот, первый квест обучения
 *     («поймайте покемона») невыполним, из города не выпускает гейт обучения.
 */

const always = (v: number) => () => v;
const LOW = always(0); // нижняя граница диапазона
const HIGH = always(0.999999); // верхняя граница диапазона

describe('baseWildLevelFor', () => {
  it('Пьютер-Сити (стартовый город) — Lv 3-7, а не Lv 10-20', () => {
    expect(baseWildLevelFor('pewterCity', null, LOW)).toBe(3);
    expect(baseWildLevelFor('pewterCity', null, HIGH)).toBe(7);
    // именно это видел новичок: Lv14 STARLY против стартера Lv5
    expect(baseWildLevelFor('pewterCity', null, HIGH)).toBeLessThan(10);
  });

  it('маршруты распознаются БЕЗ подчёркивания (route1, route12, seaRoute20)', () => {
    expect(routeNumber('route1')).toEqual({ num: 1, sea: false });
    expect(routeNumber('route12')).toEqual({ num: 12, sea: false });
    expect(routeNumber('route_2')).toEqual({ num: 2, sea: false }); // обе формы
    expect(routeNumber('seaRoute20')).toEqual({ num: 20, sea: true });
    expect(routeNumber('viridianForest')).toBeNull();
    expect(routeNumber('')).toBeNull();
  });

  it('ранние маршруты заметно слабее средних (раньше были одинаковые Lv 10-20)', () => {
    const r1 = baseWildLevelFor('route1', null, LOW);
    const r1max = baseWildLevelFor('route1', null, HIGH);
    const r16 = baseWildLevelFor('route16', null, LOW);
    const r21 = baseWildLevelFor('route21', null, LOW);
    expect([r1, r1max]).toEqual([5, 12]);
    expect(r16).toBe(20); // 11-16 = 20-30
    expect(r21).toBe(30); // 17-21 = 30-40
    expect(r1max).toBeLessThan(r16);
  });

  it('стартовая зона: палет 3-8, виридиан и лес 5-12', () => {
    expect(baseWildLevelFor('palletTown', null, LOW)).toBe(3);
    expect(baseWildLevelFor('palletTown', null, HIGH)).toBe(8);
    expect(baseWildLevelFor('viridianCity', null, LOW)).toBe(5);
    expect(baseWildLevelFor('viridianForest', null, LOW)).toBe(5);
    expect(baseWildLevelFor('viridianForest', null, HIGH)).toBe(12);
  });

  it('лунные/поздние маршруты по номерам: 16-21 = 30-40, 23 = 38-45, морские = 30-40', () => {
    expect(baseWildLevelFor('route21', null, LOW)).toBe(30);
    expect(baseWildLevelFor('route23', null, LOW)).toBe(38);
    expect(baseWildLevelFor('seaRoute19', null, LOW)).toBe(30);
    expect(baseWildLevelFor('route25', null, LOW)).toBe(20);
  });

  it('Victory Road / Indigo = 40-50', () => {
    expect(baseWildLevelFor('victoryRoad', null, LOW)).toBe(40);
    expect(baseWildLevelFor('indigoPlateau', null, HIGH)).toBe(50);
  });

  it('локция может задать свой диапазон (wildMinLvl/wildMaxLvl)', () => {
    const loc = { wildMinLvl: 50, wildMaxLvl: 55 };
    expect(baseWildLevelFor('route1', loc, LOW)).toBe(50);
    expect(baseWildLevelFor('route1', loc, HIGH)).toBe(55);
  });

  it('неизвестная локация — прежний дефолт Lv 10-20', () => {
    expect(baseWildLevelFor('somewhereUnknown', null, LOW)).toBe(10);
    expect(baseWildLevelFor('somewhereUnknown', null, HIGH)).toBe(20);
  });

  it('пустой id не роняет функцию', () => {
    expect(baseWildLevelFor('', null, LOW)).toBe(10);
    expect(baseWildLevelFor(undefined as any, null, HIGH)).toBe(20);
  });
});
