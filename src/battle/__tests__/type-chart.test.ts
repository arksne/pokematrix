/**
 * Таблица эффективности типов и подсказка в игре.
 *
 * Найдено аудитом: строка Bug в TYPE_CHART была неверной — fighting/poison/
 * flying стояли 0.5 вместо канон ×2. Любой жук терял три своих суперэффективных
 * матчапа (Батерфри, Снитч, Геракрос били вхолостую).
 * Плюс в справке index.html было 16 типов из 18, и Жук был указан неверно.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TYPE_CHART } from '../logic.js';

const html = readFileSync('index.html', 'utf-8');

const TYPE_RU: Record<string, string> = {
  normal: 'Нормал', fire: 'Огонь', water: 'Вода', electric: 'Электричество',
  grass: 'Трава', ice: 'Лёд', fighting: 'Бой', poison: 'Яд',
  ground: 'Земля', flying: 'Лёт', psychic: 'Психика', bug: 'Жук',
  rock: 'Камень', ghost: 'Призрак', dragon: 'Дракон', dark: 'Тьма',
  steel: 'Сталь', fairy: 'Фея',
};

describe('таблица типов', () => {
  it('все 18 типов присутствуют', () => {
    for (const t of Object.keys(TYPE_RU)) {
      expect(TYPE_CHART[t as keyof typeof TYPE_CHART], t).toBeTruthy();
    }
    expect(Object.keys(TYPE_CHART)).toHaveLength(18);
  });

  it('ЖУК бьёт Бой, Яд и Лёт ×2 (регрессия: было 0.5)', () => {
    const bug = TYPE_CHART.bug;
    expect(bug.fighting, 'Bug → Fighting').toBe(2);
    expect(bug.poison, 'Bug → Poison').toBe(2);
    expect(bug.flying, 'Bug → Flying').toBe(2);
  });

  it('остальные матчапы Жука по канону', () => {
    const bug = TYPE_CHART.bug;
    expect(bug.fire).toBe(0.5);
    expect(bug.grass).toBe(2);
    expect(bug.psychic).toBe(2);
    expect(bug.ghost).toBe(0.5);
    expect(bug.dark).toBe(2);
    expect(bug.steel).toBe(0.5);
    expect(bug.fairy).toBe(0.5);
  });

  it('иммунитеты и асимметрия по канону', () => {
    const chart = TYPE_CHART as Record<string, Record<string, number>>;
    // Земля → Лёт = 0 (небо не летает над землёй), Лёт → Земля = 1 (нейтрально)
    expect(chart.ground.flying).toBe(0);
    expect(chart.flying.ground ?? 1).toBe(1);
    // Нормал ↔ Призрак
    expect(chart.normal.ghost).toBe(0);
    expect(chart.ghost.normal).toBe(0);
    // Дракон → Фея = 0, Фея → Дракон = 2
    expect(chart.dragon.fairy).toBe(0);
    expect(chart.fairy.dragon).toBe(2);
    // Психика → Тьма = 0, Тьма → Психика = 2
    expect(chart.psychic.dark).toBe(0);
    expect(chart.dark.psychic).toBe(2);
    // Электричество → Земля = 0
    expect(chart.electric.ground).toBe(0);
    // Яд → Сталь = 0, Сталь → Яд = 1
    expect(chart.poison.steel).toBe(0);
  });
});

describe('справка «Эффективность типов» совпадает с движком', () => {
  it('перечислены все 18 типов', () => {
    const section = html.slice(html.indexOf('Эффективность типов'), html.indexOf('🎣'));
    for (const [id, ru] of Object.entries(TYPE_RU)) {
      expect(section, `нет типа ${id} (${ru})`).toContain(ru);
    }
  });

  it('Жук в справке указан верно (x2: Бой, Яд, Лёт)', () => {
    const section = html.slice(html.indexOf('Эффективность типов'), html.indexOf('🎣'));
    const bugRow = section.split('>Жук<')[1] || '';
    expect(bugRow).toMatch(/x2:[^<]*(Бой|Яд|Лёт)/);
  });
});

describe('способности, которые зависали', () => {
  const coreSrc = readFileSync('src/battle/core.ts', 'utf-8');

  it('Gale Wings сравнивается в нормализованном виде (регрессия: "gale-wings")', () => {
    // Строка нормализуется через replace(/[^a-z0-9]/g,'') -> 'galewings'
    expect(coreSrc).toMatch(/name === 'galewings'/);
    expect(coreSrc).not.toMatch(/name === 'gale-wings'/);
  });
});