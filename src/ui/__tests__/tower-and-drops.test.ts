/**
 * Два бага, которые игрок назвал «недоделанными».
 *
 * 1. ЭТАЖИ БАШНИ БЫЛИ КОСМЕТИЧЕСКИМИ.
 *    Кнопка «⬆ Подняться» работала, подпись «Этаж 3 из 5» показывалась —
 *    а звери были той же силы. Причина: бонус этажа (towerLevel) считался
 *    ТОЛЬКО в ветке getWildLevel, где локация задаёт wildMinLvl/wildMaxLvl —
 *    таких локаций всего 3. Все 12 башен шли по обычным веткам, где уровень
 *    возвращался как есть. «Тупо блуждаешь по этажам, когда хочешь».
 *
 * 2. ДРОПОВ НЕ БЫЛО НИГДЕ.
 *    `state.serverDropConfig?.monsterDrops ?? MONSTER_DROP_TABLE` — сервер
 *    при отсутствии строки в БД отдаёт пустой ОБЪЕКТ {}, а не null, поэтому
 *    `??` не срабатывал никогда и локальная таблица (475 видов с дропами)
 *    не использовалась. Квест туториала «выбей предмет» был невыполним.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { specialMechanic, towerLevel, towerCap, climbFloor } from '../../battle/special-loc.js';
import { REGIONS } from '../../data/regions.js';

const coreSrc = readFileSync('src/battle/core.ts', 'utf8');
const locSrc = readFileSync('src/ui/location.ts', 'utf8');

describe('этажи башни влияют на силу врагов', () => {
  const allLocs: any = {};
  for (const region of Object.values(REGIONS) as any[]) {
    for (const [id, loc] of Object.entries(region?.locations || {}) as any[]) allLocs[id] = loc;
  }
  const towers = Object.entries(allLocs).filter(([, l]: any) => specialMechanic(l)?.kind === 'tower');

  it('башни в игре есть (и их много)', () => {
    expect(towers.length).toBeGreaterThanOrEqual(10);
  });

  it('бонус этажа применяется ОДИН РАЗ на выход, а не в одной ветке', () => {
    // Раньше towerLevel стоял только внутри ветки wildMinLvl/wildMaxLvl.
    const fn = coreSrc.slice(coreSrc.indexOf('function getWildLevel()'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).toMatch(/towerLevel\(base, floor, per\)/);
    // бонус применяется ВНЕ условия про min/max
    expect(body).not.toMatch(/wildMinLvl[\s\S]{0,200}towerLevel/);
  });

  it('базовый уровень вынесен в отдельную функцию', () => {
    expect(coreSrc).toMatch(/function baseWildLevel\(loc: any\): number/);
  });

  it('потолок башни держит уровень в разумных пределах', () => {
    for (const [, loc] of towers as any[]) {
      const mech = specialMechanic(loc);
      const cap = towerCap(100, mech);
      expect(cap).toBeGreaterThan(100);
      expect(cap).toBeLessThanOrEqual(100 + 9 * 3);
    }
  });

  it('чем выше этаж — тем сильнее звери (монотонно)', () => {
    const mech = { kind: 'tower' as const, floors: 5, perFloorLvl: 3 };
    const l1 = towerLevel(30, 1, mech.perFloorLvl);
    const l3 = towerLevel(30, 3, mech.perFloorLvl);
    const l5 = towerLevel(30, 5, mech.perFloorLvl);
    expect(l3).toBeGreaterThan(l1);
    expect(l5).toBeGreaterThan(l3);
    expect(l5 - l1).toBe(4 * 3);
  });

  it('подъём ограничен числом этажей башни', () => {
    const mech = { kind: 'tower' as const, floors: 3, perFloorLvl: 2 };
    expect(climbFloor(1, mech)).toBe(2);
    expect(climbFloor(2, mech)).toBe(3);
    expect(climbFloor(3, mech)).toBe(3);   // потолок
  });
});

describe('дропы работают и квест туториала выполним', () => {
  it('пустой серверный конфиг НЕ перебивает локальную таблицу', () => {
    // Регрессия: `??` не срабатывал на пустом объекте от сервера.
    expect(locSrc).not.toMatch(/monsterDrops \?\? MONSTER_DROP_TABLE/);
    expect(locSrc).toMatch(/Object\.keys\(serverMonster\)\.length > 0/);
  });

  it('локальная таблица дропов непустая и покрывает виды Пьютера', () => {
    // Читаем исходник: drops.js — обычный JS-модуль, и его таблица
    // импортируется в приложении как статический объект.
    const src = readFileSync('src/data/drops.js', 'utf8');
    const entries = src.match(/^\s*([\w\-]+):\s*\[/gm) || [];
    expect(entries.length).toBeGreaterThan(300);
    for (const mon of ['pidgey', 'rattata', 'caterpie', 'ekans', 'kabuto']) {
      expect(src, `${mon} без дропа`).toMatch(new RegExp(`^\\s*${mon}:\\s*\\[`, 'm'));
    }
  });

  it('на тренировочной зоне дроп гарантирован (квест tutorial_6 выполним)', () => {
    // Точечно: только тренировочная зона. Никаких глобальных правок —
    // в остальных локациях шансы обычные.
    expect(locSrc).toMatch(/const trainingZone = state\.currentLocationId === 'pewterCity_trainingGrounds'/);
    expect(locSrc).toMatch(/guaranteed \|\| Math\.random\(\) < entry\.chance/);
    expect(locSrc).toMatch(/if \(!drops\.length && trainingZone\)/);
    // и НЕ глобально: стартовая область не трогается
    expect(locSrc).not.toMatch(/starterArea = isStarterArea/);
  });

  it('выбивание предмета засчитывается в туториальный прогресс', () => {
    expect(coreSrc).toMatch(/checkTutorialProgress\('collect_drop'/);
  });
});