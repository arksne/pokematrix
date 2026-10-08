import { describe, it, expect } from 'vitest';
import { computeLayout, iconFor, kindFor, isMapLocked } from '../map.js';
import { REGIONS } from '../../data/regions.js';

/**
 * L3/F2: карта регионов — BFS-раскладка графа локаций.
 * Проверяем чистую функцию computeLayout (без DOM): покрытие всех узлов,
 * корень — стартовый город, детерминизм, рёбра только внутри региона.
 */
describe('computeLayout', () => {
  for (const regionKey of ['kanto', 'johto']) {
    it(`${regionKey}: все локации получили позиции`, () => {
      const ids = Object.keys((REGIONS as any)[regionKey].locations);
      const layout = computeLayout(regionKey);
      expect(Object.keys(layout.positions).sort()).toEqual([...ids].sort());
      // Слои покрывают все узлы без дублей
      const flat = layout.layers.flat();
      expect([...flat].sort()).toEqual([...ids].sort());
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBeGreaterThan(0);
    });

    it(`${regionKey}: корень — стартовый город`, () => {
      const layout = computeLayout(regionKey);
      const expected = regionKey === 'kanto' ? 'palletTown' : 'goldenrodCity';
      expect(layout.layers[0]).toEqual([expected]);
      expect(layout.positions[expected].layer).toBe(0);
    });

    it(`${regionKey}: соседи корня лежат в слое 1`, () => {
      const locs = (REGIONS as any)[regionKey].locations;
      const layout = computeLayout(regionKey);
      const start = regionKey === 'kanto' ? 'palletTown' : 'goldenrodCity';
      for (const link of locs[start].links) {
        if (!locs[link]) continue; // кросс-региональный сервис
        expect(layout.positions[link].layer).toBe(1);
      }
    });

    it(`${regionKey}: рёбра только внутри региона`, () => {
      const locs = (REGIONS as any)[regionKey].locations;
      const layout = computeLayout(regionKey);
      for (const e of layout.edges) {
        expect(locs[e.from], `нет узла ${e.from}`).toBeTruthy();
        expect(locs[e.to], `нет узла ${e.to}`).toBeTruthy();
      }
    });

    it(`${regionKey}: детерминирована (два вызова совпадают)`, () => {
      expect(computeLayout(regionKey)).toEqual(computeLayout(regionKey));
    });
  }
});

describe('iconFor/kindFor', () => {
  it('различает типы узлов по id', () => {
    expect(iconFor('pewterStadium')).toBe('⚔️');
    expect(kindFor('pewterStadium')).toBe('stadium');
    expect(iconFor('pokecenter')).toBe('🏥');
    expect(kindFor('pokecenter')).toBe('center');
    expect(iconFor('pokemart')).toBe('🛒');
    expect(kindFor('pokemart')).toBe('market');
    expect(iconFor('route1')).toBe('🛤️');
    expect(kindFor('seaRoute19')).toBe('route');
    expect(iconFor('palletTown')).toBe('🏙️');
    expect(kindFor('palletTown')).toBe('city');
  });
});

describe('isMapLocked', () => {
  it('стартовая зона открыта, остальное закрыто до туториала', () => {
    // state по умолчанию: tutorialStep 0, completedNPCQuests [] → гейт закрыт
    expect(isMapLocked('goldenrodCity')).toBe(false);
    expect(isMapLocked('pokecenter')).toBe(false);
    expect(isMapLocked('palletTown')).toBe(true);
    expect(isMapLocked('pewterStadium')).toBe(true);
  });
});
