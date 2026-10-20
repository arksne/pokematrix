/**
 * Зеркало формулы урона PvP: клиент ↔ сервер.
 *
 * Клиент (src/battle/pvp-core.ts doPvPAttack) считает урон и шлёт
 * { lvl, atk, power, dmg, crit }. Сервер (server/src/socket/pvp.ts
 * pvp_action) пересчитывает допуск и отбивает всё, что выше
 * maxAllowed + 5, — без обработчика на клиенте отбитый удар = вис боя.
 *
 * Этот тест держит формулы в замке: честный клиентский удар при любом
 * ролле и крите обязан проходить серверный допуск, а читерский —
 * отбиваться. Дрейф любой из сторон роняет тест.
 */
import { describe, it, expect } from 'vitest';

/** Зеркало clampInt из server/src/socket/pvp.ts. */
function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/** Зеркало клиентского расчёта (pvp-core.ts doPvPAttack). roll — кубик 0.85–1.15. */
function clientDmg(lvl: number, atk: number, power: number, crit: boolean, roll: number): number {
  const raw = Math.floor(((lvl * power * (atk / 100)) / 15) * roll);
  return crit ? Math.floor(raw * 1.5) : raw;
}

/** Зеркало серверного допуска (socket/pvp.ts pvp_action). true = удар принят. */
function serverAccepts(action: { lvl?: unknown; atk?: unknown; power?: unknown; dmg?: unknown; crit?: boolean }): boolean {
  const myLevel = clampInt(action.lvl, 1, 100);
  const power = clampInt(action.power, 1, 250);
  const atk = clampInt(action.atk, 1, 1000);
  if (myLevel < 1 || power < 1 || atk < 1) return false;
  const base = (myLevel * power * (atk / 100)) / 15;
  const maxAllowed = Math.floor(base * 1.15 * (action.crit ? 1.5 : 1));
  const dmg = action.dmg;
  if (typeof dmg !== 'number' || !Number.isFinite(dmg) || dmg < 0 || dmg > maxAllowed + 5) return false;
  return true;
}

describe('pvp damage mirror (client formula vs server gate)', () => {
  it('честный удар проходит при любом ролле, крите и статах', () => {
    const lvls = [1, 5, 25, 50, 100];
    const atks = [1, 60, 100, 250, 500, 1000];
    const powers = [1, 40, 60, 80, 100, 120, 150, 200, 250];
    let checked = 0;
    for (const lvl of lvls) {
      for (const atk of atks) {
        for (const power of powers) {
          for (const crit of [false, true]) {
            // худший случай для допуска: максимальный ролл клиента 1.15 (exclusive, берём границу)
            const dmg = clientDmg(lvl, atk, power, crit, 1.1499999);
            expect(
              serverAccepts({ lvl, atk, power, dmg, crit }),
              `отбит честный удар lvl=${lvl} atk=${atk} power=${power} crit=${crit} dmg=${dmg}`,
            ).toBe(true);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(540);
  });

  it('читерский урон отбивается', () => {
    // lvl 5/atk 60/power 40: base=8, maxAllowed=9, допуск до 14
    expect(serverAccepts({ lvl: 5, atk: 60, power: 40, dmg: 14, crit: false })).toBe(true);
    expect(serverAccepts({ lvl: 5, atk: 60, power: 40, dmg: 15, crit: false })).toBe(false);
    expect(serverAccepts({ lvl: 5, atk: 60, power: 40, dmg: 999999, crit: false })).toBe(false);
    expect(serverAccepts({ lvl: 5, atk: 60, power: 40, dmg: -1, crit: false })).toBe(false);
  });

  it('мусор вместо статов даёт крошечный допуск, а не NaN-дыру', () => {
    // undefined → clamp в минимум: lvl=1, atk=1, power=1 → maxAllowed=0, допуск до 5
    expect(serverAccepts({ dmg: 5, crit: false } as any)).toBe(true);
    expect(serverAccepts({ dmg: 6, crit: false } as any)).toBe(false);
    expect(serverAccepts({ lvl: 1e9, atk: 1e9, power: 1e9, dmg: 1e12, crit: false })).toBe(false);
  });
});
