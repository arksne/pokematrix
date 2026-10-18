/**
 * Покедекс по вкладкам, со всей доступной информацией.
 *
 * Просьба игрока: «покедекс надо сделать удобнее, чтоб там была вся инфа
 * которая есть, но удобно и во вкладках». Раньше карточка была одним
 * монолитным блоком, а половина данных лежала в проекте и не показывалась:
 * RU-имена способностей, дроп, вес появления, канонные уровни эволюции,
 * день/ночь и диапазон уровней на локациях ловли.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const dexSrc = readFileSync('src/ui/pokedex.ts', 'utf8');
const css = readFileSync('style.css', 'utf8');

describe('покедекс: вкладки', () => {
  it('пять вкладок: обзор, статы, где ловить, эволюция, атаки', () => {
    for (const label of ['Обзор', 'Статы', 'Где ловить', 'Эволюция', 'Атаки']) {
      expect(dexSrc, label).toContain(label);
    }
    expect(dexSrc).toMatch(/const tabs: Array<\[string, string\]>/);
  });

  it('вкладки кликабельны и переключают панели', () => {
    expect(dexSrc).toMatch(/detailEl\.querySelectorAll\('\.dex-tab'\)/);
    expect(dexSrc).toMatch(/classList\.toggle\('active'/);
    expect(dexSrc).toMatch(/p\.hidden = p\.dataset\.panel !== key/);
  });

  it('в шапке остались навигация, шайни и статус', () => {
    expect(dexSrc).toMatch(/pokedex-detail-back/);
    expect(dexSrc).toMatch(/btn-shiny-toggle/);
    expect(dexSrc).toMatch(/pokedex-detail-status/);
    expect(dexSrc).toMatch(/showPokedexInfo\('\$\{prevName\}'\)/);
  });

  it('CSS вкладок есть и контейнер стал шире', () => {
    expect(css).toMatch(/\.dex-tab\s*\{/);
    expect(css).toMatch(/\.dex-tab\.active\s*\{/);
    expect(css).toMatch(/\.dex-panel\[hidden\]\s*\{\s*display:\s*none/);
    const container = css.slice(css.indexOf('.pokedex-container {'));
    expect(container.slice(0, 200)).toMatch(/max-width:\s*6\d\dpx/);
  });
});

describe('покедекс: ранее не показанные данные теперь видны', () => {
  it('способности с русским именем и пометкой «реализована/нет»', () => {
    expect(dexSrc).toMatch(/getAbilityNameRu/);
    expect(dexSrc).toMatch(/isAbilityImplemented/);
    expect(dexSrc).toMatch(/не реализована/);
  });

  it('дроп с покемона', () => {
    expect(dexSrc).toMatch(/MONSTER_DROP_TABLE/);
    expect(dexSrc).toMatch(/Падает/);
  });

  it('редкость из силы вида + вес появления + BST', () => {
    expect(dexSrc).toMatch(/encounterWeightFor/);
    expect(dexSrc).toMatch(/rarityStarsFor/);
    expect(dexSrc).toMatch(/BST/);
  });

  it('канонные уровни эволюции лиги', () => {
    expect(dexSrc).toMatch(/levelEvolutionsFor/);
    expect(dexSrc).toMatch(/Канон лиги \(уровни\)/);
  });

  it('на локациях ловли видны уровни, босс и «не ловится»', () => {
    expect(dexSrc).toMatch(/wildMinLvl/);
    expect(dexSrc).toMatch(/wildMaxLvl/);
    expect(dexSrc).toMatch(/noCatch/);
    expect(dexSrc).toMatch(/bossLvl/);
  });
});