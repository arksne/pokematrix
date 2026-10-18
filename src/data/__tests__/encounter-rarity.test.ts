/**
 * Редкость появления диких — по СИЛЕ вида.
 *
 * Жалобы игрока:
 *  * «снорлакс часто нападает и такого оч много»;
 *  * «каждую локу надо проверить на покемонов, которые должны быть редкими
 *    из-за категории силы».
 *
 * Три корня, все найдены и закрыты:
 *  1. startHunt выбирал покемона РАВНОМЕРНО (`array[random]`). Вес по силе
 *     считался, но применялся только в одной из точек входа, поэтому Снорлакс
 *     нападал так же часто, как Пиджи.
 *  2. 6 видов (burmy, farfetchd, mr-mime, nidoran-f/-m, deoxys-normal) не были
 *     в таблице силы и получали дефолтный вес — вели себя как «обычные».
 *  3. Формы вроде giratina-altered не резолвились к базе → тоже дефолт.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  setPowerTable, getBST, encounterWeightFor, powerStarsFromBST,
} from '../../data/power.js';
import { REGIONS } from '../../data/regions.js';

const powerJson = JSON.parse(readFileSync('public/pokemon_power.json', 'utf-8'));
const coreSrc = readFileSync('src/battle/core.ts', 'utf8');

/** Все виды, реально встречающиеся в списках локаций. */
function usedSpecies(): string[] {
  const out = new Set<string>();
  for (const region of Object.values(REGIONS) as any[]) {
    for (const loc of Object.values(region?.locations || {}) as any[]) {
      for (const key of ['encounters', 'dayEncounters', 'nightEncounters']) {
        for (const n of loc?.[key] || []) if (typeof n === 'string') out.add(n);
      }
    }
  }
  return [...out];
}

/**
 * Зоны, где сильные виды — это и есть замысел: места ловки легендарок
 * (лайфурд и встроенная башня), места сильного блуждания (roaming*) и
 * остров Дэксиса. Там 100% сильных — корректно.
 */
const LEGENDARY_ONLY = new Set([
  'navelRock', 'embeddedTower', 'sinjohRuins', 'birthIsland',
  'roamingJohto', 'roamingKanto',
]);

describe('таблица силы покрывает всех диких', () => {
  beforeAll(() => { setPowerTable(powerJson); });

  it('каждый вид из локаций известен системе силы', () => {
    const missing = usedSpecies().filter((s) => !getBST(s));
    expect(missing, `нет BST: ${missing.join(', ')}`).toEqual([]);
  });

  it('формы берут силу базы, а не дефолт', () => {
    expect(getBST('giratina-altered')).toBeGreaterThan(600);
    expect(getBST('kabuto-legacy')).toBe(getBST('kabuto'));
    expect(getBST('deoxys-normal')).toBeGreaterThan(0);
    expect(getBST('nidoran-f')).toBeGreaterThan(0);
  });

  it('ни один вид не падает в «вес по умолчанию»', () => {
    const bad = usedSpecies().filter((s) => encounterWeightFor(s) === 0.5);
    expect(bad, `дефолтный вес (=неизвестен): ${bad.join(', ')}`).toEqual([]);
  });
});

describe('редкость по силе', () => {
  beforeAll(() => { setPowerTable(powerJson); });

  it('вес строго не возрастает с силой', () => {
    const samples = ['caterpie', 'pidgey', 'rattata', 'geodude', 'poliwag',
      'snorlax', 'arcanine', 'lapras', 'dragonite', 'mewtwo'];
    const w = samples.map((s) => encounterWeightFor(s));
    for (let i = 1; i < w.length; i++) {
      expect(w[i], `${samples[i]} должно быть реже ${samples[i - 1]}`)
        .toBeLessThanOrEqual(w[i - 1]);
    }
    // и разброс реально заметный
    expect(w[0]).toBeGreaterThan(w[w.length - 1] * 10);
  });

  it('Снорлакс — редкий, а не «обычный» (жалоба игрока)', () => {
    const snorlax = encounterWeightFor('snorlax');
    expect(getBST('snorlax')).toBeGreaterThanOrEqual(520);
    expect(snorlax).toBeLessThan(0.6);
    // заметно реже обычных
    expect(snorlax).toBeLessThan(encounterWeightFor('pidgey') / 4);
    expect(snorlax).toBeLessThan(encounterWeightFor('meowth') / 4);
  });

  it('легендарки — самые редкие', () => {
    expect(encounterWeightFor('mewtwo')).toBeLessThan(0.05);
    expect(encounterWeightFor('lugia')).toBeLessThan(0.05);
  });
});

describe('локации не «забиты» сильными', () => {
  beforeAll(() => { setPowerTable(powerJson); });

  it('в обычной локации сильный вид не выпадает всегда', () => {
    const problems: string[] = [];
    for (const region of Object.values(REGIONS) as any[]) {
      for (const [locId, loc] of Object.entries(region?.locations || {}) as any) {
        if (LEGENDARY_ONLY.has(locId)) continue;
        const names = [...new Set([
          ...(loc?.encounters || []),
          ...(loc?.dayEncounters || []),
          ...(loc?.nightEncounters || []),
        ])].filter((n: string) => typeof n === 'string');
        if (!names.length) continue;
        const w = names.map((n: string) => encounterWeightFor(n));
        const tot = w.reduce((a, b) => a + b, 0) || 1;
        const strongShare = w
          .filter((_, i) => getBST(names[i]) >= 520)
          .reduce((a, b) => a + b, 0) / tot;
        if (strongShare >= 1) {
          problems.push(`${locId}: 100% сильных (${names.join(', ')})`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('бой выбирает дикого по весу, а не равновероятно', () => {
  it('startHunt использует pickWeightedEncounter', () => {
    expect(coreSrc).toMatch(/pickWeightedEncounter\(encountersArray\)/);
    // регрессия: равномерный выбор делал редкость по силе декоративной
    expect(coreSrc).not.toMatch(/encountersArray\[Math\.floor\(Math\.random\(\) \* encountersArray\.length\)\]/);
  });

  it('взвешенный выбор понимает и строки, и объекты {name, level}', () => {
    expect(coreSrc).toMatch(/const speciesOf = \(e: any\) =>/);
  });

  it('вес берётся из системы силы', () => {
    expect(coreSrc).toMatch(/encounterWeightFor\(speciesOf\(e\)\)/);
  });
});