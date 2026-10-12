import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ITEMS } from '../../data/items.js';
import {
  HEAL_HP, CURE_ONE, CURE_ALL, EXP_CANDY_XP, WING_EV,
  BERRY_MANUAL, REVIVE_MODE,
} from '../../data/item-effects.js';
import { STONE_ITEM_MAP } from '../../data/stones.js';

/**
 * Аудит итемов: какие работают, какие нет.
 * Источник истины — код, а не слова: useItem (inventory.ts) разбирается
 * по case-меткам, боевые эффекты — по ссылкам в src/battle/*.
 */

const INV_SRC = readFileSync(join(process.cwd(), 'src', 'ui', 'inventory.ts'), 'utf8');
const CORE_SRC = readFileSync(join(process.cwd(), 'src', 'battle', 'core.ts'), 'utf8');
const LOGIC_SRC = readFileSync(join(process.cwd(), 'src', 'battle', 'logic.ts'), 'utf8');
const STATS_SRC = readFileSync(join(process.cwd(), 'src', 'battle', 'stats.ts'), 'utf8');
const SPECIAL_SRC = readFileSync(join(process.cwd(), 'src', 'battle', 'special-moves.ts'), 'utf8');

function useItemCases(): Set<string> {
  const out = new Set<string>();
  for (const m of INV_SRC.matchAll(/case '([a-zA-Z0-9_-]+)'/g)) out.add(m[1]);
  return out;
}

function battleRefs(id: string): boolean {
  // Ищем и закавыченный id ('charcoal'), и ключ таблицы (charcoal:),
  // иначе таблицы TYPE_BOOST/GEM_TYPE/PUNCH_MOVES не засчитываются.
  const forms = [`'${id}'`, `"${id}"`, `${id}:`];
  return forms.some(
    (q) => CORE_SRC.includes(q) || LOGIC_SRC.includes(q) || STATS_SRC.includes(q) || SPECIAL_SRC.includes(q),
  );
}

describe('аудит итемов: покрытие', () => {
  const cases = useItemCases();

  it('case-метки useItem покрывают таблицы эффектов', () => {
    for (const id of Object.keys(HEAL_HP)) {
      if (['potion', 'superPotion', 'fullRestore'].includes(id)) continue; // свои кейсы
      expect(cases.has(id), `${id} из HEAL_HP без case`).toBe(true);
    }
    for (const id of [...Object.keys(CURE_ONE), ...CURE_ALL]) {
      if (['antidote', 'paralyzeHeal', 'awakening', 'burnHeal', 'healingHerb'].includes(id)) continue;
      expect(cases.has(id), `${id} из CURE без case`).toBe(true);
    }
    for (const id of Object.keys(EXP_CANDY_XP)) {
      expect(cases.has(id), `${id} без case`).toBe(true);
    }
    for (const id of Object.keys(WING_EV)) {
      expect(cases.has(id), `${id} без case`).toBe(true);
    }
    for (const id of Object.keys(REVIVE_MODE)) {
      expect(cases.has(id), `${id} без case`).toBe(true);
    }
    for (const id of BERRY_MANUAL) {
      expect(cases.has(id), `ягода ${id} без case`).toBe(true);
    }
    expect(cases.has('maxEther')).toBe(true);
    expect(cases.has('abilityCapsule')).toBe(true);
    expect(cases.has('abilityPatch')).toBe(true);
    expect(cases.has('ppMax')).toBe(true);
  });

  it('все камни эволюции из данных есть в STONE_ITEM_MAP', () => {
    const stones = (ITEMS as any[]).filter(
      (i) => i.category === 'evolutionStones' && i.implemented && i.id !== 'evolutionStone',
    );
    expect(stones.length).toBeGreaterThan(0);
    for (const s of stones) {
      expect(s.id in STONE_ITEM_MAP, `${s.id} без маппинга`).toBe(true);
    }
  });

  it('каждый usable+implemented предмет куда-то ведёт (не «скоро будет» молча)', () => {
    const_impl();
    function const_impl() {
      const tmRe = /^tm\d{1,3}$/;
      const uncovered: string[] = [];
      for (const it of ITEMS as any[]) {
        if (!it.isUsable || !it.implemented) continue;
        const id = it.id as string;
        const ok =
          cases.has(id) ||                       // прямой case в useItem
          tmRe.test(id) ||                        // номерные ТМ — generic
          (it.category === 'evolutionStones' && id in STONE_ITEM_MAP) || // камни — generic
          it.category === 'battle' ||             // held — надевается через default
          it.category === 'training';             // held — надевается через default
        if (!ok) uncovered.push(`${id} (${it.category})`);
      }
      // Удалённые по требованию хозяина (2026-10-11) — их здесь быть не должно.
      // Полный список в отчёте; тест гарантирует, что они действительно ушли
      // из данных, а не висят мёртвым грузом.
      const deletedIds = [
        'abomasite', 'charizarditeX', 'fightiniumZ-Held', 'rustedSword',
        'legendPlate', 'blankPlate', 'boosterEnergy', 'dynamaxCandy',
        'hm01', 'hm08', 'healthMochi', 'powerWeight', 'machoBrace',
        'courageCandy', 'sootheBell', 'cleanseTag', 'figyBerry', 'micleBerry',
      ];
      const byId = new Map((ITEMS as any[]).map((i) => [i.id, i]));
      for (const id of deletedIds) {
        expect(byId.has(id), `${id} должен быть удалён из items.ts`).toBe(false);
      }
      const unexpected = uncovered;
      expect(unexpected, 'внезапно без обработчика: ' + unexpected.join(', ')).toEqual([]);
    }
  });

  it('ключевые held-предметы имеют эффект в бою', () => {
    const noFx = new Set((ITEMS as any[])
      .filter((i) => i.category === 'battle')
      .filter((it) => !battleRefs(it.id))
      .map((it) => it.id));
    for (const mustWork of ['choiceBand', 'leftovers', 'lifeOrb', 'focusSash', 'charcoal', 'muscleBand', 'scopeLens', 'kingsRock', 'quickClaw', 'weaknessPolicy', 'shellBell', 'rockyHelmet', 'airBalloon', 'eviolite', 'assaultVest', 'expertBelt', 'dracoPlate', 'normalGem', 'punchingGlove', 'lightBall', 'thickClub', 'soulDew', 'metalPowder', 'deepSeaScale', 'whiteHerb', 'mentalHerb', 'powerHerb', 'loadedDice', 'cellBattery', 'throatSpray', 'destinyKnot', 'blunderPolicy']) {
      expect(noFx.has(mustWork), `${mustWork} должен работать`).toBe(false);
    }
  });

  it('удалённое — действительно удалено (мёртвый груз по требованию хозяина)', () => {
    const byId = new Map((ITEMS as any[]).map((i) => [i.id, i]));
    // Меги, Z-кристаллы, ржавые, маски, приводы, плиты без типа, boosterEnergy
    for (const id of ['abomasite', 'charizarditeX', 'mewtwoniteX', 'fightiniumZ-Held', 'pikaniumZ-Held', 'rustedSword', 'rustedShield', 'legendPlate', 'blankPlate', 'boosterEnergy', 'cornerstoneMask', 'hearthflameMask', 'wellspringMask', 'burnDrive', 'chillDrive', 'douseDrive', 'shockDrive']) {
      expect(byId.has(id), id).toBe(false);
    }
    // dynamax, HM, моти, силовые, статовые конфеты, соска/метка/благовония, пинч-ягоды
    for (const id of ['dynamaxCandy', 'hm01', 'hm08', 'healthMochi', 'powerWeight', 'machoBrace', 'courageCandy', 'toughCandyXl', 'sootheBell', 'cleanseTag', 'pureIncense', 'figyBerry', 'liechiBerry', 'lansatBerry', 'starfBerry', 'micleBerry']) {
      expect(byId.has(id), id).toBe(false);
    }
  });

  it('жетоны и билеты используются кодом', () => {
    const transportSrc = readFileSync(join(process.cwd(), 'src', 'data', 'transport.ts'), 'utf8');
    const arenaSrc = readFileSync(join(process.cwd(), 'src', 'battle', 'arena.ts'), 'utf8');
    const socketSrc = readFileSync(join(process.cwd(), 'src', 'network', 'socket.ts'), 'utf8');
    const allCode = INV_SRC + CORE_SRC + transportSrc + arenaSrc + socketSrc;
    for (const id of ['trainTicket', 'ferryTicket', 'arenaToken']) {
      expect(allCode.includes(`'${id}'`), id).toBe(true);
    }
  });
});
