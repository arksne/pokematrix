import { describe, it, expect, beforeEach } from 'vitest';
import { BattleStateMachine, ensurePlayerTurnAfterFaint, isPhaseStuckForMenu } from '../state-machine.js';
import { BattlePhase } from '../types.js';

/**
 * Жалоба 1: «атаки работают, а предмет/смена/побег — "Подождите... идёт ход
 * противника"». Корень — core.ts:handlePlayerFaint: авто-замена показывала
 * меню, но фазу оставляла в ENEMY_TURN. Атаки терпят re-entry, а кнопки
 * меню требуют строго PLAYER_TURN. Фикс — ensurePlayerTurnAfterFaint в
 * handlePlayerFaint (переход ENEMY_TURN→PLAYER_TURN).
 */
describe('phase-faint — возврат хода после авто-замены', () => {
  let sm: BattleStateMachine;
  beforeEach(() => { sm = BattleStateMachine.create(); });

  it('ENEMY_TURN → PLAYER_TURN после faint-замены', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    sm.transition(BattlePhase.ENEMY_TURN);
    expect(ensurePlayerTurnAfterFaint(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.PLAYER_TURN);
  });

  it('PLAYER_TURN — уже ход игрока, ничего не трогаем', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    const logLen = sm.getTransitionLog().length;
    expect(ensurePlayerTurnAfterFaint(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.PLAYER_TURN);
    expect(sm.getTransitionLog()).toHaveLength(logLen);
  });

  it.each([
    BattlePhase.VICTORY,
    BattlePhase.DEFEAT,
    BattlePhase.IDLE,
    BattlePhase.WILD_START,
  ])('из %s после faint меню не возвращаем — false', (phase) => {
    sm.forcePhase(phase);
    expect(ensurePlayerTurnAfterFaint(sm)).toBe(false);
    expect(sm.phase).toBe(phase);
  });
});

describe('phase-faint — детектор залипания для кнопок меню', () => {
  it('ENEMY_TURN при живых обоих — залипло (предмет/смена/побег откажут)', () => {
    expect(isPhaseStuckForMenu(BattlePhase.ENEMY_TURN, 50, 50)).toBe(true);
  });

  it('PLAYER_TURN — не залипло', () => {
    expect(isPhaseStuckForMenu(BattlePhase.PLAYER_TURN, 50, 50)).toBe(false);
  });

  it('мёртвый боец — не залипание, а конец боя', () => {
    expect(isPhaseStuckForMenu(BattlePhase.ENEMY_TURN, 0, 50)).toBe(false);
    expect(isPhaseStuckForMenu(BattlePhase.ENEMY_TURN, 50, 0)).toBe(false);
    expect(isPhaseStuckForMenu(BattlePhase.ENEMY_TURN, 0, 0)).toBe(false);
  });

  it('терминальные фазы — не залипание', () => {
    expect(isPhaseStuckForMenu(BattlePhase.VICTORY, 50, 50)).toBe(false);
    expect(isPhaseStuckForMenu(BattlePhase.IDLE, 50, 50)).toBe(false);
  });
});
