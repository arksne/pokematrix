/**
 * Эволюция по уровню.
 *
 * Жалобы игрока:
 *  * «покемоны не эволюционируют с конфет»;
 *  * «а вот дикие наоборот эволюционируют даже если просрали свой лв,
 *    эволюции вообще на другом уровне».
 *
 * Обе поломки — одна причина: уровень эволюции брался из PokeAPI
 * `evolution_details`, где `min_level` зависит от версии игры и иногда null.
 * null в levelDetailMet означал «эволюция на любом уровне» — дикий
 * эволюционировал сразу при поимке. А канон лиги (public/pokemon_evo.json)
 * с этими переходами раньше вообще не использовался.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { setEvoTable, evolutionLevelFor, levelEvolutionsFor } from '../../data/power.js';
import { levelDetailMet } from '../evolution.js';

const evoJson = JSON.parse(readFileSync('public/pokemon_evo.json', 'utf-8'));

const ctx: any = {
  locationId: 'pewterCity', isDaytime: true, knownMoves: [], teamSpecies: [], teamTypes: [],
};

describe('канон эволюции по уровню', () => {
  beforeAll(() => { setEvoTable(evoJson); });

  it('таблица разобрана: уровни есть, диапазон правдоподобный', () => {
    expect(Object.keys(evoJson).length).toBeGreaterThan(300);
    const levels = Object.values(evoJson).flat().map((e: any) => e.level);
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...levels)).toBeLessThanOrEqual(70);
    expect(levels.every((l: any) => Number.isInteger(l) && l > 0)).toBe(true);
  });

  it('известные переходы берут канонные уровни', () => {
    expect(evolutionLevelFor('bulbasaur', 'ivysaur')).toBe(16);
    expect(evolutionLevelFor('ivysaur', 'venusaur')).toBe(32);
    expect(evolutionLevelFor('geodude', 'graveler')).toBe(25);
    expect(evolutionLevelFor('rattata', 'raticate')).toBe(20);
    expect(evolutionLevelFor('kabuto', 'kabutops')).toBe(40);
    expect(evolutionLevelFor('abra', 'kadabra')).toBe(16);
  });

  it('каменные переходы (Alakazam, Golem) не выдумывают уровень', () => {
    // PokeAPI отдаёт для них level-up деталь с min_level null
    expect(evolutionLevelFor('graveler', 'golem')).toBeNull();
    expect(levelEvolutionsFor('graveler')).toEqual([]);
  });

  it('неизвестный вид не ломает проверку', () => {
    expect(evolutionLevelFor('no-such-mon', 'whatever')).toBeNull();
    expect(levelEvolutionsFor('no-such-mon')).toEqual([]);
  });
});

describe('уровень эволюции соблюдается (баг «диные эволюционируют на чужом уровне»)', () => {
  beforeAll(() => { setEvoTable(evoJson); });

  const detail = (minLevel: number | null) => ({ trigger: 'level-up', minLevel });

  it('канон запрещает эволюцию ниже нужного уровня', () => {
    const mon: any = { gender: 'male', happiness: 70 };
    // Bulbasaur→Ivysaur = 16. PokeAPI здесь отдаёт корректные 16, но если бы
    // отдал null — канон всё равно держит уровень.
    expect(levelDetailMet(detail(null), mon, ctx, 15, 16)).toBe(false);
    expect(levelDetailMet(detail(null), mon, ctx, 16, 16)).toBe(true);
    expect(levelDetailMet(detail(null), mon, ctx, 17, 16)).toBe(true);
  });

  it('null из PokeAPI больше НЕ значит «на любом уровне»', () => {
    const mon: any = { gender: 'male', happiness: 70 };
    // Регрессия: без канона detail(null) проходил на ЛЮБОМ уровне.
    expect(levelDetailMet(detail(null), mon, ctx, 1, 16)).toBe(false);
  });

  it('без канона поведение прежнее (min_level из PokeAPI)', () => {
    const mon: any = { gender: 'male', happiness: 70 };
    expect(levelDetailMet(detail(20), mon, ctx, 19, null)).toBe(false);
    expect(levelDetailMet(detail(20), mon, ctx, 20, null)).toBe(true);
  });

  it('конфеты действительно поднимают порог: эффективный уровень = base + candies', () => {
    const mon: any = { gender: 'male', happiness: 70 };
    // Тот же Bulbasaur: база 5 + 11 конфет = 16 → эволюция разрешена
    const base = 5, candies = 11;
    const eff = base + candies;
    expect(levelDetailMet(detail(null), mon, ctx, eff, 16)).toBe(true);
    // Без конфет — нельзя
    expect(levelDetailMet(detail(null), mon, ctx, base, 16)).toBe(false);
  });
});