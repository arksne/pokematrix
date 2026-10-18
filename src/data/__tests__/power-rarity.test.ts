/**
 * СИЛА ВИДА — редкость и звёзды.
 *
 * Жалобы игрока:
 *  * «системы редкости звезд силы вообще не работают, там везде одни значения»;
 *  * «некоторые редкие поки часто нападают, вот я поймал кабуто древнего»;
 *  * «раздели редких по категории силы, их эволюции потенциально если они
 *    сильны они должны быть редкими».
 *
 * Корни: ENCOUNTER_WEIGHTS описывал ~70 видов руками, остальные ~1200
 * получали дефолт 1.0 (Ancient Kabuto — 1.0, обычный Kabuto — 0.8, то есть
 * «редкая» форма ловилась ЧАЩЕ). getRarityStars смотрел на captureRate,
 * которого нет в покедексе, поэтому у всех была одна звезда.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  setPowerTable, getBST, baseSpecies, powerStarsFromBST,
  rarityStarsFor, encounterWeightFor, bstFromApiData,
} from '../../data/power.js';
import { getPowerStars, getRarityStars } from '../../utils/state.js';

const powerJson = JSON.parse(readFileSync('public/pokemon_power.json', 'utf-8'));

describe('сила вида: таблица и разброс', () => {
  beforeAll(() => { setPowerTable(powerJson); });

  it('таблица покрывает игровую часть покедекса', () => {
    expect(Object.keys(powerJson).length).toBeGreaterThan(1000);
    expect(getBST('rapidash')).toBe(500);
    expect(getBST('mewtwo')).toBe(680);
  });

  it('формы падают на базовый вид (kabuto-legacy → kabuto)', () => {
    expect(baseSpecies('kabuto-legacy')).toBe('kabuto');
    expect(baseSpecies('raticate alolan')).toBe('raticate');
    expect(baseSpecies('rapidash')).toBe('rapidash');
    // формы нет в таблице — берём силу базы, а не 0
    expect(getBST('kabuto-legacy')).toBe(getBST('kabuto'));
  });

  it('монотонность: чем больше BST, тем выше сила и реже вид', () => {
    const samples = ['caterpie', 'pidgey', 'rattata', 'rapidash', 'snorlax', 'mewtwo'];
    const bs = samples.map(getBST);
    // BST растёт
    for (let i = 1; i < bs.length; i++) expect(bs[i]).toBeGreaterThan(bs[i - 1]);
    // сила не убывает
    const stars = bs.map(powerStarsFromBST);
    for (let i = 1; i < stars.length; i++) expect(stars[i]).toBeGreaterThanOrEqual(stars[i - 1]);
    // вес не возрастает (внутри одной «корзины» силы значения равны — это
    // намеренно: корзины дают читаемые ступени редкости)
    const w = samples.map((s: string) => encounterWeightFor(s));
    for (let i = 1; i < w.length; i++) expect(w[i]).toBeLessThanOrEqual(w[i - 1]);
    // но между корзинами разница обязательна: 2.5 → 0.12
    expect(w[0]).toBeGreaterThan(w[w.length - 1] * 10);
  });

  it('легендарки — самые редкие', () => {
    expect(encounterWeightFor('mewtwo')).toBeLessThan(encounterWeightFor('snorlax'));
    expect(encounterWeightFor('articuno')).toBeLessThan(0.05);
  });

  it('эволюция автоматически реже базы — сила растёт по цепочке', () => {
    expect(encounterWeightFor('bulbasaur')).toBeGreaterThan(encounterWeightFor('ivysaur'));
    expect(encounterWeightFor('ivysaur')).toBeGreaterThan(encounterWeightFor('venusaur'));
  });

  it('«редкая» форма не может быть чаще своей обычной базы (баг с Kabuto)', () => {
    expect(encounterWeightFor('kabuto-legacy')).toBeLessThanOrEqual(encounterWeightFor('kabuto'));
  });

  it('звёзды силы реально различаются, а не у всех одно', () => {
    const set = new Set(['caterpie', 'rattata', 'rapidash', 'snorlax', 'mewtwo']
      .map((s: string) => powerStarsFromBST(getBST(s))));
    expect(set.size).toBeGreaterThanOrEqual(4);
  });

  it('звёзды редкости 1..5 и тоже различаются', () => {
    const stars = ['caterpie', 'rattata', 'rapidash', 'snorlax', 'mewtwo']
      .map((s: string) => rarityStarsFor(s, getBST(s)));
    expect(new Set(stars).size).toBeGreaterThanOrEqual(3);
    expect(rarityStarsFor('mewtwo', getBST('mewtwo'))).toBe(5);
    for (const s of stars) {
      expect(s).toBeGreaterThanOrEqual(1);
      expect(s).toBeLessThanOrEqual(5);
    }
  });
});

describe('звёзды в UI больше не одинаковые', () => {
  beforeAll(() => { setPowerTable(powerJson); });

  it('getPowerStars различает слабых и сильных (данные из apiData)', () => {
    const mk = (name: string) => ({
      apiData: { name, species: { name }, stats: [{ base_stat: 1 }, { base_stat: 1 },
        { base_stat: 1 }, { base_stat: 1 }, { base_stat: 1 }, { base_stat: 1 }] },
    });
    // с портрета PokeAPI stats уже есть — считаем по ним
    const weak = getPowerStars({ apiData: { name: 'caterpie', species: { name: 'caterpie' } } });
    const strong = getPowerStars({ apiData: { name: 'mewtwo', species: { name: 'mewtwo' } } });
    expect(strong).toBeGreaterThan(weak);
    expect(weak).toBeGreaterThanOrEqual(1);
  });

  it('покедекс-вызов (голый ответ PokeAPI без captureRate) даёт реальные звёзды', () => {
    // Регрессия: getRarityStars({apiData: data}) где data — сырой ответ
    // PokeAPI. Раньше captureRate отсутствовал → 1★ у всех подряд.
    const pkm = (name: string) => ({ apiData: { name, species: { name } } });
    const rare = getRarityStars(pkm('mewtwo'));
    const common = getRarityStars(pkm('caterpie'));
    expect(rare).toBeGreaterThan(common);
  });

  it('BST берётся из apiData, когда он уже в памяти', () => {
    const apiData = {
      name: 'x', species: { name: 'rapidash' },
      stats: [{ base_stat: 80 }, { base_stat: 60 }, { base_stat: 70 },
        { base_stat: 105 }, { base_str: 0 }, { base_stat: 95 }],
    };
    // 80+60+70+105+0+95 = 410 — мусорный набор, но сумма считается
    expect(bstFromApiData(apiData)).toBe(410);
    // без stats — падаем в таблицу по имени вида
    expect(bstFromApiData({ name: 'rapidash' })).toBe(500);
  });
});