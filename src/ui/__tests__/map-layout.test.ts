import { describe, it, expect } from 'vitest';
import { computeLayout, iconFor, kindFor, isMapLocked, isServiceLoc, serviceSubsOf } from '../map.js';
import { REGIONS } from '../../data/regions.js';

/**
 * L3/F2: карта регионов — BFS-раскладка графа локаций.
 * Проверяем чистую функцию computeLayout (без DOM): покрытие всех узлов,
 * корень — стартовый город, детерминизм, рёбра только внутри региона.
 */
describe('computeLayout', () => {
  for (const regionKey of ['kanto', 'johto']) {
    it(`${regionKey}: все НЕсервисные локации получили позиции`, () => {
      const ids = Object.keys((REGIONS as any)[regionKey].locations).filter((id) => !isServiceLoc(id));
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
        if (!locs[link] || isServiceLoc(link)) continue; // кросс-регион и сервисы — не узлы
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

describe('F4: подлокации сервисов у каждого города', () => {  const cities = ['celadonCity', 'ceruleanCity', 'fuchsiaCity', 'palletTown',
    'vermilionCity', 'viridianCity', 'pewterCity', 'lavenderTown', 'saffronCity',
    'blackthornCity', 'cherrygroveCity', 'cianwoodCity', 'ecruteakCity',
    'newBarkTown', 'olivineCity', 'violetCity', 'azaleaTown', 'goldenrodCity',
    'mahoganyTown'];
  const locsOf = (regionKey: string) => (REGIONS as any)[regionKey].locations;
  const findLoc = (id: string) => locsOf('kanto')[id] || locsOf('johto')[id];

  it('у каждого города есть маркет и центр', () => {
    for (const city of cities) {
      expect(findLoc(`${city}_pokemart`), city).toBeTruthy();
      expect(findLoc(`${city}_pokecenter`), city).toBeTruthy();
    }
  });

  it('двусторонние связи город ↔ подлокации', () => {
    for (const city of cities) {
      const cityLinks = findLoc(city).links || [];
      expect(cityLinks, `${city} → subs`).toEqual(
        expect.arrayContaining([`${city}_pokemart`, `${city}_pokecenter`]),
      );
      for (const sub of [`${city}_pokemart`, `${city}_pokecenter`]) {
        expect(findLoc(sub).links, `${sub} → city`).toContain(city);
      }
    }
  });

  it('подлокации без энкаунтеров, центр лечит', () => {
    for (const city of cities) {
      for (const sub of [`${city}_pokemart`, `${city}_pokecenter`]) {
        expect(findLoc(sub).encounters).toEqual([]);
      }
      expect(findLoc(`${city}_pokecenter`).hasHeal).toBe(true);
    }
  });
});

describe('граф без сервисов (чистка каши)', () => {
  it('isServiceLoc опознаёт сервисы', () => {
    expect(isServiceLoc('pokemart')).toBe(true);
    expect(isServiceLoc('pokecenter')).toBe(true);
    expect(isServiceLoc('celadonCity_pokemart')).toBe(true);
    expect(isServiceLoc('celadonCity_pokecenter')).toBe(true);
    expect(isServiceLoc('celadonCity')).toBe(false);
    expect(isServiceLoc('route1')).toBe(false);
  });

  it('сервисов нет ни в позициях, ни в рёбрах', () => {
    for (const regionKey of ['kanto', 'johto']) {
      const layout = computeLayout(regionKey);
      for (const id of Object.keys(layout.positions)) {
        expect(isServiceLoc(id), id).toBe(false);
      }
      for (const e of layout.edges) {
        expect(isServiceLoc(e.from), `edge ${e.from}`).toBe(false);
        expect(isServiceLoc(e.to), `edge ${e.to}`).toBe(false);
      }
    }
  });

  it('serviceSubsOf находит обе подлокации города', () => {
    const locs = { ...(REGIONS as any).kanto.locations, ...(REGIONS as any).johto.locations };
    expect(serviceSubsOf(locs, 'celadonCity').sort()).toEqual(
      ['celadonCity_pokecenter', 'celadonCity_pokemart'].sort(),
    );
    expect(serviceSubsOf(locs, 'route1')).toEqual([]);
  });
});
