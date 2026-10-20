/**
 * Прочность валидации сейва: легитимные данные всегда проходят.
 *
 * Класс багов «422 на ровном месте»: игрок с честным прогрессом получает
 * Save data validation failed на каждый POST /save — облако мертво, а все
 * серверные операции (жетоны арены, награды PvP, обмены) тихо ломаются.
 * Уже ловили: IV max(31) против EV 32+, originalTrainer числом, объекты
 * в completedQuests.
 *
 * Правило: всё, что клиент может законно положить в сейв (любой предмет из
 * ITEMS, любые PvP-поля, наследие удалённых предметов), обязано проходить.
 * Всё, что ломает инварианты, обязано отбиваться (второй describe).
 */
import { describe, it, expect } from 'vitest';
import { validateSaveData } from '../../../server/src/validation/save-data.js';
import { ITEMS } from '../../data/items.js';

function baseMon(over: any = {}) {
  return {
    uid: 'mon-1',
    baseLevel: 50,
    currentHp: 100,
    maxHp: 100,
    ivs: { hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 },
    evs: { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 },
    happiness: 255,
    natureIdx: 24,
    ...over,
  };
}

function baseSave(over: any = {}) {
  return {
    inventory: { credit: 339333, pokeBall: 5 },
    myTeam: [baseMon()],
    badges: [],
    pcBoxes: [[]],
    ...over,
  };
}

describe('валидация сейва принимает легитимные данные', () => {
  it('все 512 предметов из ITEMS + наследие (expCandy, жетоны, пластины)', () => {
    const inv: Record<string, number> = { credit: 1000000 };
    for (const it of ITEMS) inv[it.id] = 1;
    // наследие удалённого контента обязано сохраняться, а не ронять сейв
    inv.expCandyS = 3;
    inv.expCandyM = 1;
    inv.arenaToken = 2;
    const r = validateSaveData(baseSave({ inventory: inv }));
    expect(r.errors, JSON.stringify(r.errors)?.slice(0, 300)).toBe(null);
    expect(r.success).toBe(true);
  });

  it('максимально прокачанная команда 6/6 + полные боксы + все значки', () => {
    const team = Array.from({ length: 6 }, (_, i) => baseMon({ uid: `mon-${i}` }));
    const r = validateSaveData(baseSave({
      myTeam: team,
      badges: ['Boulder Badge', 'Cascade Badge', 'Thunder Badge', 'Rainbow Badge',
        'Soul Badge', 'Marsh Badge', 'Volcano Badge', 'Earth Badge',
        'Zephyr Badge', 'Hive Badge', 'Plain Badge', 'Fog Badge',
        'Storm Badge', 'Mineral Badge', 'Glacier Badge', 'Rising Badge'],
      pcBoxes: [[baseMon({ uid: 'box-1' })]],
      towerFloor: 999,
      trainerNickname: 'Тренер'.padEnd(32, 'x'),
    }));
    expect(r.success).toBe(true);
  });

  it('PvP-поля, титулы, квесты-строки', () => {
    const r = validateSaveData(baseSave({
      pvpWins: 5, pvpLosses: 3, pvpStreak: 2, pvpBestStreak: 4,
      titles: ['tideMaster'], completedQuests: ['catch_5', 'earn_5000'],
      arenaToken: undefined,
      inventory: { credit: 0, arenaToken: 1, masterBall: 1, rareCandy: 2 },
    }));
    expect(r.success).toBe(true);
  });
});

describe('валидация сейва по-прежнему отбивает мусор', () => {
  it('7-й покемон в команде', () => {
    const team = [0, 1, 2, 3, 4, 5, 6].map((i) => baseMon({ uid: 'm-' + i }));
    expect(validateSaveData(baseSave({ myTeam: team })).success).toBe(false);
  });
  it('левый значок, минус в инвентаре, счастье 256, iv 51, квест-объект', () => {
    expect(validateSaveData(baseSave({ badges: ['Fake Badge'] })).success).toBe(false);
    expect(validateSaveData(baseSave({ inventory: { credit: -5 } })).success).toBe(false);
    expect(validateSaveData(baseSave({ myTeam: [baseMon({ happiness: 256 })] })).success).toBe(false);
    const badIv = { hp: 51, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    expect(validateSaveData(baseSave({ myTeam: [baseMon({ ivs: badIv })] })).success).toBe(false);
    const badQuests = { completedQuests: [{ id: 'catch_5' }] };
    expect(validateSaveData(baseSave(badQuests)).success).toBe(false);
  });
});
