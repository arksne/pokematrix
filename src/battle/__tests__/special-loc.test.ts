import { describe, it, expect } from 'vitest';
import {
  specialMechanic, towerLevel, towerCap, encounterRateFor, nextFloor,
  TOWER_PER_FLOOR, DARK_RATE,
} from '../special-loc.js';
import { REGIONS } from '../../data/regions.js';

const allLocs: Record<string, any> = {
  ...(REGIONS as any).kanto.locations,
  ...(REGIONS as any).johto.locations,
};
const TOWERS = ['mtMoon', 'pokemonTower', 'burnedTower', 'sproutTower', 'bellTower',
  'tanobyRuins', 'sinjohRuins', 'ruinsOfAlph', 'trainerTower', 'embeddedTower',
  'lostCave', 'unionCave'];
const DARKS = ['darkCave', 'icefallCave', 'alteringCave'];

describe('M-4: механики особых локаций', () => {
  it('обычная локация без механики', () => {
    expect(specialMechanic(allLocs.goldenrodCity)).toBeNull();
    expect(specialMechanic(undefined)).toBeNull();
    expect(specialMechanic({ mechanic: { kind: 'что-то' } })).toBeNull();
  });

  it('башни/руины помечены и имеют этажи', () => {
    for (const id of TOWERS) {
      const m = specialMechanic(allLocs[id]);
      expect(m, `${id}: нет механики`).toBeTruthy();
      expect(m!.kind, id).toBe('tower');
      expect(m!.floors, `${id}: этажи`).toBeGreaterThan(1);
      expect(m!.perFloorLvl, `${id}: прирост за этаж`).toBeGreaterThan(0);
    }
  });

  it('тёмные пещеры помечены и реже встречаются ночью', () => {
    for (const id of DARKS) {
      const m = specialMechanic(allLocs[id]);
      expect(m, `${id}: нет механики`).toBeTruthy();
      expect(m!.kind, id).toBe('dark');
    }
  });

  it('этаж поднимает уровень врага', () => {
    expect(towerLevel(10, 0)).toBe(10);
    expect(towerLevel(10, 3)).toBe(10 + 3 * TOWER_PER_FLOOR);
    expect(towerLevel(10, 3, 2)).toBe(16);
    // Мусорные значения не ломают расчёт
    expect(towerLevel(10, -5)).toBe(10);
    expect(towerLevel(10, 2.7)).toBe(10 + 2 * TOWER_PER_FLOOR);
  });

  it('потолок башни считается по числу этажей', () => {
    const m = specialMechanic(allLocs.embeddedTower)!;
    const cap = towerCap(30, m);
    expect(cap).toBe(30 + (m.floors! - 1) * m.perFloorLvl!);
    expect(towerCap(30, null)).toBe(30);
    expect(towerCap(30, specialMechanic(allLocs.darkCave))).toBe(30);
  });

  it('темнота режет шанс встречи только ночью', () => {
    const dark = specialMechanic(allLocs.darkCave);
    const base = 0.2;
    expect(encounterRateFor(base, dark, true)).toBe(base);
    expect(encounterRateFor(base, dark, false)).toBeCloseTo(base * DARK_RATE, 5);
    // Днём/в башне — без изменений
    expect(encounterRateFor(base, specialMechanic(allLocs.mtMoon), false)).toBe(base);
    expect(encounterRateFor(base, null, false)).toBe(base);
  });

  it('вход в башню = подъём, повторный рендер = тот же этаж', () => {
    const tower = specialMechanic(allLocs.mtMoon);
    expect(nextFloor('route9', 'mtMoon', tower)).toBe(1);
    expect(nextFloor('mtMoon', 'mtMoon', tower)).toBe(0);
    // Небоскрёбы и пещеры этажей не имеют
    expect(nextFloor('route9', 'darkCave', specialMechanic(allLocs.darkCave))).toBe(0);
    expect(nextFloor(null, 'mtMoon', null)).toBe(0);
  });

  it('концы башни связаны с внешним миром (есть куда выйти)', () => {
    for (const id of TOWERS) {
      expect(allLocs[id].links.length, `${id}: из башни некуда идти`).toBeGreaterThan(0);
    }
  });

  it('у всех механикных локаций есть энкаунтеры — иначе механика незаметна', () => {
    for (const id of [...TOWERS, ...DARKS]) {
      const loc = allLocs[id];
      const enc = loc.encounters?.length || 0;
      const dayNight = (loc.dayEncounters?.length || 0) + (loc.nightEncounters?.length || 0);
      expect(enc + dayNight, `${id}: пусто`).toBeGreaterThan(0);
    }
  });
});