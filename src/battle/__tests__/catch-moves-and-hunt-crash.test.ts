/**
 * Регрессии боя, найденные игроком в проде.
 *
 * 1. ПОЙМАННЫЙ МОНСТР ПОМНИТ НЕ ТЕ АТАКИ, ЧТО БИЛ.
 *    newMon.apiData = S.activeWild, а S.activeWild.moves — это произвольный
 *    порядок PokeAPI (у Рапидаша первым шёл Megahorn). В бою покемон использовал
 *    мувсет из learnset, а в монстре сохранялся совсем другой набор.
 *
 * 2. ОШИБКА БОЯ ГЛУШИТСЯ.
 *    В catch у startHunt стояло только `setTimeout(() => modal.style.display =
 *    'none', 1000)` — игрок видел пустой экран и «выкинуло из боя» без слов.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { moveNameToSlug, wildMovesFromLearnset } from '../../data/learnset.js';
import type { SiteLearnset } from '../../data/learnset.js';

const coreSrc = readFileSync('src/battle/core.ts', 'utf8');

describe('пойманный монстр помнит боевые атаки', () => {
  it('в catch атаки берутся из wildMovesDetailed, а не из apiData.moves', () => {
    expect(coreSrc).toMatch(/S\.wildMovesDetailed[\s\S]{0,400}newMon\.apiData\.moves = battleMoves/);
  });

  it('запись идёт в оба места — и в боевого, и в монстра', () => {
    expect(coreSrc).toMatch(/S\.activeWild\.moves = battleMoves/);
    expect(coreSrc).toMatch(/newMon\.apiData\.moves = battleMoves/);
  });

  it('в записи нет сырого PokeAPI-списка (тот самый баг)', () => {
    // apiData целиком остаётся общим, но moves перезаписываются явно
    expect(coreSrc).toMatch(/const battleMoves = \(S\.wildMovesDetailed \|\| \[\]\)/);
  });

  it('slug атаки строится корректно для записи в apiData', () => {
    expect(moveNameToSlug('Flame Charge')).toBe('flame-charge');
    expect(moveNameToSlug('Thunderbolt')).toBe('thunderbolt');
  });

  it('движок в бою и покедекс читают одну таблицу обучения', () => {
    const ls: SiteLearnset = {
      levelup: [[1, 'Ember'], [1, 'Growl'], [1, 'Megahorn'], [1, 'Tackle'],
        [15, 'Flame Charge'], [20, 'Agility'], [25, 'Flame Wheel'], [30, 'Stomp']],
      egg: [],
    };
    // Дикий ур.20 знает только то, что <=20 — из выбранного набора
    const known = wildMovesFromLearnset(ls, 20);
    expect(known.every((m: string) =>
      ls.levelup.some(([l, n]: [number, string]) => n === m && l <= 20))).toBe(true);
  });
});

describe('ошибка боя не выкидывает молча', () => {
  it('в catch остаётся видимое сообщение об ошибке', () => {
    expect(coreSrc).toMatch(/Бой не начался:/);
  });

  it('охота останавливается, чтобы не бить в ту же ошибку по кругу', () => {
    expect(coreSrc).toMatch(/stopAutoHunt\?\.\(\)|stopAutoHunt\(\)/);
  });

  it('модалка не прячется мгновенно (было 1000мс — игрок ничего не успевал прочесть)', () => {
    const m = coreSrc.match(/modal\.style\.display = 'none'; \}, (\d+)\)/);
    expect(m).toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(3000);
  });

  it('ошибка по-прежнему уходит в клиентский отчётчик', () => {
    expect(coreSrc).toMatch(/startHunt failed:/);
  });
});