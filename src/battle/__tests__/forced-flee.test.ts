import { describe, it, expect } from 'vitest';
import { isForcedFleeMove, canEscapeFromTrap } from '../special-moves.js';

/**
 * Жалоба 5: «атаки заставляющие сбегать недоработаны, кнопки уйти нет».
 * Корни — core.ts:fleeWildBattle: transition(IDLE) из ENEMY_TURN запрещён
 * картой (телепорт дикого залипал), модалка не гасилась (бой кончился, а
 * окно без кнопок). Фикс — leaveBattleToIdle + скрытие модалки, кнопки
 * переиспользуем (btn-run/btn-leave-battle уже есть, новых id нет).
 */
describe('forced-flee — какие атаки выгоняют из боя', () => {
  it.each(['roar', 'whirlwind', 'teleport'])('%s — forced-flee', (name) => {
    expect(isForcedFleeMove(name)).toBe(true);
  });

  it('регистр/дефисы не важны', () => {
    expect(isForcedFleeMove('Roar')).toBe(true);
    expect(isForcedFleeMove('WHIRLWIND')).toBe(true);
    expect(isForcedFleeMove('Teleport')).toBe(true);
  });

  it('обычные атаки — не flee', () => {
    expect(isForcedFleeMove('tackle')).toBe(false);
    expect(isForcedFleeMove('giga-drain')).toBe(false);
    expect(isForcedFleeMove(null)).toBe(false);
  });
});

describe('forced-flee — ловушка держит телепорт, рык выгоняет дикого', () => {
  it('без ловушки — уйти можно', () => {
    expect(canEscapeFromTrap(false, false)).toBe(true);
    expect(canEscapeFromTrap(null, undefined)).toBe(true);
  });

  it('прямая ловушка (mean-look) держит', () => {
    expect(canEscapeFromTrap(true, false)).toBe(false);
  });

  it('волатильная ловушка (bind-семья) держит телепорт', () => {
    expect(canEscapeFromTrap(false, true)).toBe(false);
  });

  it('обе сразу — тоже держит', () => {
    expect(canEscapeFromTrap(true, true)).toBe(false);
  });
});
