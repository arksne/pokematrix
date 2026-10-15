import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import {
  ensureBreedBoxes, breedCandidateList, areBreedingCompatible,
  layEggFromPair, buildHatchling, releaseEggToBackpack,
} from '../daycare.js';

/**
 * Сквозной путь разведения «положить пару → яйцо → вылупить» —
 * чистые функции/состояние, без DOM.
 * Покрывает: форму боксов, кладку яйца из пары (донор/IV/таймер/шайни),
 * сборку вылупившегося (ур.1, наследование IV, симпатия), снятие привязки
 * яйца к боксу, фильтр кандидатов (яйца — не родители).
 */

const species = (name: string) => ({ name, species: { name } });
const mkMon = (over: any = {}) => ({
  uid: `u-${Math.random().toString(36).slice(2)}`,
  nickname: null,
  gender: 'male',
  breedLetter: 'A',
  apiData: {
    name: 'pikachu',
    ...species('pikachu'),
    types: [{ type: { name: 'electric' } }],
    stats: [],
    moves: [],
    abilities: [{ ability: { name: 'static' }, is_hidden: false }],
  },
  ivs: { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 },
  evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
  baseLevel: 5, candiesEaten: 0, hasBred: false, isEgg: false,
  maxHp: 50, currentHp: 50,
  ...over,
});

beforeEach(() => {
  state.myTeam = [];
  state.pcBoxes = [[]];
  state.breedBoxes = [];
  state.eggs = [];
  state.daycareMons = [];
});

describe('ensureBreedBoxes', () => {
  it('создаёт ровно 3 пустых бокса', () => {
    const boxes = ensureBreedBoxes();
    expect(boxes).toHaveLength(3);
    for (const b of boxes) expect(b).toEqual({ a: null, b: null, readyAt: 0 });
  });

  it('идемпотентна и чинит короткий массив', () => {
    state.breedBoxes = [{ a: mkMon(), b: null, readyAt: 0 }];
    const boxes = ensureBreedBoxes();
    expect(boxes).toHaveLength(3);
    expect(boxes[0].a).toBeTruthy();
  });
});

describe('layEggFromPair (кладка)', () => {
  const NOW = 1_700_000_000_000;
  const DAY = 24 * 3600 * 1000;

  it('вид/родители/уведомление: пара → яйцо того же вида', () => {
    const m1 = mkMon({ uid: 'a', gender: 'male' });
    const m2 = mkMon({ uid: 'b', gender: 'female' });
    const egg = layEggFromPair(m1, m2, NOW, () => 0, 'egg-1');
    expect(egg.uid).toBe('egg-1');
    expect(egg.species).toBe('pikachu');
    expect(egg.parent1Uid).toBe('a');
    expect(egg.parent2Uid).toBe('b');
    expect(egg.notified).toBe(false);
  });

  it('таймер вылупления 5–9 дней от nowMs', () => {
    const m1 = mkMon({ uid: 'a', gender: 'male' });
    const m2 = mkMon({ uid: 'b', gender: 'female' });
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      const egg = layEggFromPair(m1, m2, NOW, () => r);
      const dt = egg.readyTime - NOW;
      expect(dt).toBeGreaterThanOrEqual(5 * DAY);
      expect(dt).toBeLessThanOrEqual(9 * DAY);
    }
  });

  it('без Дитто донор 50/50: rand<0.5 → первый, иначе второй', () => {
    const m1 = mkMon({ uid: 'a', gender: 'male', apiData: { name: 'a', ...species('a') } });
    const m2 = mkMon({ uid: 'b', gender: 'female', apiData: { name: 'b', ...species('b') } });
    // NB: прочие rand-вызовы не важны — вид определяется первым броском
    expect(layEggFromPair(m1, m2, NOW, () => 0).species).toBe('a');
    expect(layEggFromPair(m1, m2, NOW, () => 0.99).species).toBe('b');
  });

  it('с Дитто вид всегда второго родителя (оба порядка)', () => {
    const ditto = mkMon({ uid: 'd', gender: null, apiData: { name: 'x', ...species('ditto') } });
    const mate = mkMon({ uid: 'm', gender: 'female', apiData: { name: 'y', ...species('pikachu') } });
    expect(layEggFromPair(ditto, mate, NOW, () => 0.99).species).toBe('pikachu');
    expect(layEggFromPair(mate, ditto, NOW, () => 0).species).toBe('pikachu');
  });

  it('IV — лучший ген родителей ±1-2 (кламп 0..50)', () => {
    const m1 = mkMon({ uid: 'a', gender: 'male', ivs: { hp: 40, atk: 50, def: 0, spa: 5, spd: 5, spe: 5 } });
    const m2 = mkMon({ uid: 'b', gender: 'female', ivs: { hp: 30, atk: 50, def: 0, spa: 5, spd: 5, spe: 5 } });
    for (let i = 0; i < 200; i++) {
      const egg = layEggFromPair(m1, m2, NOW);
      expect(egg.ivs.hp).toBeGreaterThanOrEqual(38);
      expect(egg.ivs.hp).toBeLessThanOrEqual(42);
      expect(egg.ivs.atk).toBeLessThanOrEqual(50); // потолок, не выше
      expect(egg.ivs.atk).toBeGreaterThanOrEqual(48);
      expect(egg.ivs.def).toBeGreaterThanOrEqual(0); // пол, не ниже
      expect(egg.ivs.def).toBeLessThanOrEqual(2);
    }
  });

  it('shinyBoost только при двойном перфекте', () => {
    const perfect = () => ({ ivs: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } });
    const m1 = mkMon({ uid: 'a', gender: 'male', ...perfect() });
    const m2 = mkMon({ uid: 'b', gender: 'female', ...perfect() });
    expect(layEggFromPair(m1, m2, NOW).shinyBoost).toBe(true);
    const m3 = mkMon({ uid: 'c', gender: 'female', ivs: { hp: 49, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 } });
    expect(layEggFromPair(m1, m3, NOW).shinyBoost).toBe(false);
  });
});

describe('buildHatchling (вылупление)', () => {
  const pokeData = {
    name: 'pikachu', id: 25,
    species: { name: 'pikachu' },
    types: [{ type: { name: 'electric' } }],
    stats: [{ base_stat: 35 }],
    moves: [{ move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } }],
    abilities: [{ ability: { name: 'static' }, is_hidden: false }],
  };
  const eggOf = (over: any = {}) => ({
    uid: 'egg-1', species: 'pikachu', shinyBoost: false,
    ivs: { hp: 11, atk: 22, def: 33, spa: 44, spd: 45, spe: 46 },
    ...over,
  });

  it('уровень 1, EV 0, IV наследуются из яйца 1:1', () => {
    const mon = buildHatchling(pokeData, eggOf(), () => 0.5, { uid: 'm1', trainerId: 't1' });
    expect(mon.uid).toBe('m1');
    expect(mon.originalTrainer).toBe('t1');
    expect(mon.baseLevel).toBe(1);
    expect(mon.candiesEaten).toBe(0);
    expect(mon.evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(mon.ivs).toEqual(eggOf().ivs);
    expect(mon.isEgg).toBe(false);
    expect(mon.hasBred).toBe(false);
    expect(mon.caughtLocation).toBe('breeding');
  });

  it('характер/пол/буква валидны; способность — видимая', () => {
    for (let i = 0; i < 50; i++) {
      const mon = buildHatchling(pokeData, eggOf(), Math.random, { uid: `x${i}`, trainerId: 't' });
      expect(mon.natureIdx).toBeGreaterThanOrEqual(0);
      expect(['A', 'T', 'G']).toContain(mon.breedLetter);
      expect(['male', 'female']).toContain(mon.gender);
      expect(mon.abilityName).toBe('static');
    }
  });

  it('шайни: буст + малый бросок → true; без буста + большой → false', () => {
    const shiny = buildHatchling(pokeData, eggOf({ shinyBoost: true }), () => 0, { uid: 's', trainerId: 't' });
    expect(shiny.isShiny).toBe(true);
    const plain = buildHatchling(pokeData, eggOf({ shinyBoost: false }), () => 0.999, { uid: 'p', trainerId: 't' });
    expect(plain.isShiny).toBe(false);
  });

  it('без IV в яйце — случайные 0..50, без падения', () => {
    const mon = buildHatchling(pokeData, { uid: 'e', shinyBoost: false }, () => 0.5, { uid: 'm', trainerId: 't' });
    for (const v of Object.values(mon.ivs) as number[]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(50);
    }
  });
});

describe('releaseEggToBackpack', () => {
  it('снимает boxIdx, возвращает true', () => {
    const eggs = [{ uid: 'e1', boxIdx: 2 }];
    expect(releaseEggToBackpack(eggs, 'e1')).toBe(true);
    expect('boxIdx' in eggs[0]).toBe(false);
  });

  it('чужой uid — false, массив не тронут', () => {
    const eggs = [{ uid: 'e1', boxIdx: 2 }];
    expect(releaseEggToBackpack(eggs, 'nope')).toBe(false);
    expect(eggs[0].boxIdx).toBe(2);
  });
});

describe('breedCandidateList: фильтр', () => {
  it('в команду + PC попадают неспаривавшиеся; яйца и спаривавшиеся — нет', () => {
    const teamMon = mkMon({ uid: 't1', gender: 'male' });
    const eggMon = mkMon({ uid: 'e1', gender: 'female', isEgg: true });
    const bredMon = mkMon({ uid: 'b1', gender: 'female', hasBred: true });
    state.myTeam = [teamMon, eggMon];
    state.pcBoxes = [[bredMon, mkMon({ uid: 'p1', gender: 'female' })]];
    const uids = breedCandidateList().map(({ m }: any) => m.uid);
    expect(uids).toContain('t1');
    expect(uids).toContain('p1');
    expect(uids).not.toContain('e1'); // яйцо — не родитель
    expect(uids).not.toContain('b1'); // уже спаривался
  });
});

describe('сквозка: совместимая пара проходит фильтры целиком', () => {
  it('пара в боксах совместима и даёт яйцо того же вида', () => {
    const m1 = mkMon({ uid: 'a', gender: 'male' });
    const m2 = mkMon({ uid: 'b', gender: 'female' });
    expect(areBreedingCompatible(m1, m2)).toBe(true);
    state.myTeam = [m1, m2];
    // пару можно собрать из кандидатов
    const uids = breedCandidateList().map(({ m }: any) => m.uid);
    expect(uids).toEqual(expect.arrayContaining(['a', 'b']));
    // кладка даёт яйцо вида родителей
    const egg = layEggFromPair(m1, m2, Date.now(), () => 0.1);
    expect(egg.species).toBe('pikachu');
    // из яйца собирается вылупившийся 1 уровня
    const mon = buildHatchling({ name: 'pikachu', moves: [], abilities: [] }, egg, () => 0.5, { uid: 'n', trainerId: 't' });
    expect(mon.baseLevel).toBe(1);
    expect(mon.ivs).toEqual(egg.ivs);
  });
});
