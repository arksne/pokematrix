import { describe, it, expect } from 'vitest';
import { calcDrainHeal, drainPctOf, applyDrainHeal } from '../special-moves.js';

/**
 * Жалоба 4: «Мега/Гига Дрейн не пополняют ХП, так же и с др. атаками».
 * Корни — core.ts: ветка дрэйна дикого (6868) не звала updateWildHpUI и не
 * писала лог (HP росло в S, а бар стоял), ветка игрока (5392) — без лога.
 * Фикс — обе ветки идут через чистое ядро applyDrainHeal (Big Root ×1.3,
 * кап по maxHp) + лог и update*HpUI. Ниже — тесты на каждую drain-атаку
 * (положительные дрэйны из moves_db: 11 шт., bouncy-bubble — 100%).
 */
const POSITIVE_DRAINS: Array<[string, number]> = [
  ['absorb', 50],
  ['mega-drain', 50],
  ['giga-drain', 50],
  ['leech-life', 50],
  ['dream-eater', 50],
  ['drain-punch', 50],
  ['horn-leech', 50],
  ['parabolic-charge', 50],
  ['draining-kiss', 75],
  ['oblivion-wing', 75],
  ['bouncy-bubble', 100],
];

describe('drain-heal — процент лечения по каждой drain-атаке', () => {
  it.each(POSITIVE_DRAINS)('%s — дрэйн %s%%', (name, pct) => {
    expect(drainPctOf(name)).toBe(pct);
    // Канон регистра/дефисов: Giga-Drain и giga_drain — та же атака.
    expect(drainPctOf(name.toUpperCase().replace(/-/g, '_'))).toBe(pct);
  });

  it('не-дрэйн — 0 (tackle, ember, counter-отдача)', () => {
    expect(drainPctOf('tackle')).toBe(0);
    expect(drainPctOf('take-down')).toBe(0); // отдача, не лечение
    expect(drainPctOf(null)).toBe(0);
  });
});

describe('drain-heal — чистое применение лечения', () => {
  it.each(POSITIVE_DRAINS)('%s лечит %s%% урона', (name, pct) => {
    const pctGot = drainPctOf(name);
    expect(pctGot).toBe(pct);
    // Урон 80 → лечение floor(80*pct/100).
    const healed = applyDrainHeal(10, 100, 80, pctGot, false);
    expect(healed).toBe(10 + Math.floor((80 * pct) / 100));
  });

  it('giga-drain 50%: лечит половину урона', () => {
    expect(applyDrainHeal(10, 100, 80, 50)).toBe(50);
  });

  it('bouncy-bubble 100%: лечит весь урон', () => {
    expect(applyDrainHeal(10, 100, 40, 100)).toBe(50);
  });

  it('кап по maxHp — выше максимума не лечит', () => {
    expect(applyDrainHeal(95, 100, 80, 50)).toBe(100);
  });

  it('Big Root ×1.3 (как calcDrainHeal)', () => {
    expect(applyDrainHeal(10, 100, 80, 50, true)).toBe(10 + calcDrainHeal(80, 50, true));
    expect(calcDrainHeal(80, 50, true)).toBe(52);
  });

  it('нулевой урон/процент — HP не меняется', () => {
    expect(applyDrainHeal(30, 100, 0, 50)).toBe(30);
    expect(applyDrainHeal(30, 100, 40, 0)).toBe(30);
  });
});
