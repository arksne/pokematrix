import { describe, it, expect } from 'vitest';
import { isTrapChipMove, isHeldByTrap, tickTrapBind, clearTrapState } from '../special-moves.js';

/**
 * Жалоба 6: «все атаки ловушки на перед остались» — Bind/Fire Spin/Whirlpool
 * + hazards. Корни — core.ts:
 *  - проверки побега/смены/телепорта смотрели только прямой m.trapped
 *    (mean-look), а bind-семья ставит vol.trapped — не держала;
 *  - tickBindTurns чистил только bindChip, vol.trapped залипал навсегда.
 * Фикс — проверки через isHeldByTrap (оба флага), тик через tickTrapBind
 * (чистит и чип, и trapped), сброс через clearTrapState + clearBattleState.
 * Entry hazards (шипы/стелс) в движке не реализованы — шипов нет, чистить
 * нечего; ловушки-атаки теперь живут ровно bindTurns и отпускают.
 */
describe('trap — какие атаки ставят чип-ловушку', () => {
  it.each([
    'bind', 'wrap', 'fire-spin', 'whirlpool', 'clamp',
    'sand-tomb', 'magma-storm', 'infestation', 'snap-trap',
  ])('%s — чип-ловушка', (name) => {
    expect(isTrapChipMove(name)).toBe(true);
  });

  it('tackle/roar — не ловушки', () => {
    expect(isTrapChipMove('tackle')).toBe(false);
    expect(isTrapChipMove('roar')).toBe(false);
    expect(isTrapChipMove(null)).toBe(false);
  });
});

describe('trap — держат оба флага', () => {
  it('прямой trapped держит', () => {
    expect(isHeldByTrap({ trapped: true, vol: {} })).toBe(true);
  });

  it('волатильный trapped держит (bind-семья)', () => {
    expect(isHeldByTrap({ trapped: false, vol: { trapped: true } })).toBe(true);
  });

  it('без флагов — свободен', () => {
    expect(isHeldByTrap({ trapped: false, vol: {} })).toBe(false);
    expect(isHeldByTrap(null)).toBe(false);
  });
});

describe('trap — тик отпускает вовремя', () => {
  it('5 ходов: держит, на нуле — отпускает оба флага', () => {
    let vol: any = { bindChip: true, bindTurns: 2, trapped: true };
    let n = tickTrapBind(vol);
    expect(n).toMatchObject({ bindChip: true, bindTurns: 1, trapped: true });
    vol = { bindChip: n.bindChip, bindTurns: n.bindTurns, trapped: n.trapped };
    n = tickTrapBind(vol);
    expect(n).toMatchObject({ bindChip: false, bindTurns: 0, trapped: false });
  });

  it('без чипа — не держит счётчик', () => {
    expect(tickTrapBind({ bindChip: false, bindTurns: 5, trapped: false }).bindChip).toBe(false);
    expect(tickTrapBind(null as any).bindChip).toBe(false);
  });
});

describe('trap — сброс чистит оба флага', () => {
  it('clearTrapState снимает прямую и волатильную', () => {
    const mon: any = { trapped: true, vol: { trapped: true, bindChip: true, bindTurns: 3 } };
    clearTrapState(mon);
    expect(mon.trapped).toBe(false);
    expect(mon.vol.trapped).toBe(false);
    expect(mon.vol.bindChip).toBe(false);
    expect(isHeldByTrap(mon)).toBe(false);
  });

  it('null — безопасно', () => {
    expect(clearTrapState(null)).toBeNull();
  });
});
