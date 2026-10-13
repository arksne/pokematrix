import { describe, it, expect, vi } from 'vitest';

// ── Мокаем тяжёлые зависимости pokedex.ts, чтобы грузить только чистые хелперы ──
// Пути — относительно этого файла (src/ui/__tests__/).
vi.mock('../../game/state.js', () => ({
  state: { myTeam: [], pcBoxes: [[]] },
}));

vi.mock('../../game/getters.js', () => ({
  getPokedexState: () => ({
    pokedexSeen: new Set(),
    pokedexCaught: new Set(),
    POKEDEX_ALL: [],
    pokedexData: {},
    pokedexTotal: 0,
  }),
}));

vi.mock('../../utils/state.js', () => ({
  getPowerStars: () => 1,
  getRarityStars: () => 1,
}));

vi.mock('../../utils/sprite.js', () => ({
  getTypeColor: () => '#fff',
  getTypeGradient: () => '',
}));

vi.mock('../evolution.js', () => ({
  getEvolutions: async () => [],
}));

vi.mock('../../battle/core.js', () => ({
  evolvesFromMap: {},
}));

vi.mock('../../data/gyms.js', () => ({
  gymLeaders: {},
}));

vi.mock('../../utils/api.js', () => ({
  fetchPokeAPI: async () => ({}),
}));

vi.mock('../../data/learnset.js', () => ({
  fetchSiteLearnset: async () => null,
}));

vi.mock('../../data/regions.js', () => ({
  REGIONS: {
    kanto: {
      name: 'Канто',
      locations: {
        viridianForest: { name: 'Виридианский лес', encounters: ['pikachu', 'caterpie'] },
        pewterCity: { name: 'Пьютер', encounters: [] },
      },
    },
  },
}));

import {
  encounterMatchesSpecies,
  countOwnedSpecies,
  findCatchLocations,
  formatHeightWeight,
  formatLearnsetRows,
} from '../pokedex.js';

function makeMon(species: string, name?: string): any {
  return { apiData: { name: name || species, species: { name: species } } };
}

describe('Покедекс в бою + расширенные данные', () => {
  it('encounterMatchesSpecies: точное совпадение', () => {
    expect(encounterMatchesSpecies('pikachu', 'pikachu')).toBe(true);
  });

  it('encounterMatchesSpecies: форма вида подходит (sandshrew-alola ← sandshrew)', () => {
    expect(encounterMatchesSpecies('sandshrew-alola', 'sandshrew')).toBe(true);
  });

  it('encounterMatchesSpecies: чужой вид не подходит', () => {
    expect(encounterMatchesSpecies('pikachu', 'raichu')).toBe(false);
    expect(encounterMatchesSpecies('pikachualola', 'pikachu')).toBe(false);
  });

  it('encounterMatchesSpecies: регистр не важен, пустые — false', () => {
    expect(encounterMatchesSpecies('Pikachu', 'pikachu')).toBe(true);
    expect(encounterMatchesSpecies('', 'pikachu')).toBe(false);
    expect(encounterMatchesSpecies('pikachu', '')).toBe(false);
  });

  it('countOwnedSpecies: считает команду + PC по виду (не по nickname)', () => {
    const team = [makeMon('pikachu'), makeMon('charmander')];
    (team[0] as any).nickname = 'Молния';
    const boxes = [[makeMon('pikachu'), makeMon('pikachu')], [makeMon('bulbasaur')]];
    expect(countOwnedSpecies('pikachu', team, boxes)).toEqual({ team: 1, pc: 2, total: 3 });
    expect(countOwnedSpecies('mewtwo', team, boxes)).toEqual({ team: 0, pc: 0, total: 0 });
  });

  it('countOwnedSpecies: fallback на apiData.name без species', () => {
    const team = [{ apiData: { name: 'pikachu' } }];
    expect(countOwnedSpecies('pikachu', team, [])).toEqual({ team: 1, pc: 0, total: 1 });
  });

  it('findCatchLocations: находит локации вида (дефолтный мок REGIONS)', () => {
    const locs = findCatchLocations('pikachu');
    expect(locs).toHaveLength(1);
    expect(locs[0]).toMatchObject({ locId: 'viridianForest', locName: 'Виридианский лес', region: 'Канто' });
  });

  it('findCatchLocations: нет локаций — пусто', () => {
    expect(findCatchLocations('mewtwo')).toEqual([]);
  });

  it('findCatchLocations: учитывает day/night и лимит', () => {
    const regions = {
      r1: {
        name: 'R1',
        locations: {
          a: { name: 'A', encounters: ['pikachu'], dayEncounters: ['pikachu'], nightEncounters: ['pikachu'] },
          b: { name: 'B', encounters: [], dayEncounters: ['pikachu'], nightEncounters: [] },
          c: { name: 'C', encounters: [], dayEncounters: [], nightEncounters: ['pikachu'] },
        },
      },
    };
    expect(findCatchLocations('pikachu', regions, 2)).toHaveLength(2);
    expect(findCatchLocations('pikachu', regions)).toHaveLength(3);
  });

  it('formatHeightWeight: дециметры/гектограммы → м/кг', () => {
    expect(formatHeightWeight(7, 69)).toBe('0.7 м / 6.9 кг');
    expect(formatHeightWeight(undefined, 69)).toBe('— / 6.9 кг');
  });

  it('formatLearnsetRows: строки Ур.—имя, пусто — пусто', () => {
    const html = formatLearnsetRows([[1, 'Growl'], [3, 'Vine Whip']]);
    expect(html).toContain('Ур.1 — Growl');
    expect(html).toContain('Ур.3 — Vine Whip');
    expect(formatLearnsetRows([])).toBe('');
  });
});
