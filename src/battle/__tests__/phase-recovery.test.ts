import { describe, it, expect, beforeEach } from 'vitest';
import { BattleStateMachine, recoverStuckTurn, leaveBattleToIdle } from '../state-machine.js';
import { BattlePhase } from '../types.js';

/**
 * Регресс-тест жалобы «тренер не может сбежать из битвы».
 *
 * Первопричина: исключение в ходе врага (runEnemyTurnBody) прилетало ПОСЛЕ
 * transition(ENEMY_TURN), но ДО showPlayerMenuAfterDelay(). Фаза навсегда
 * оставалась ENEMY_TURN, и обработчик побега (core.ts, btn-run) вечно отвечал
 * тостом «Подождите... идёт ход противника.» — кнопка «не работала», хотя
 * слушатель был на месте.
 *
 * Фикс: catch-ветки хода врага зовут recoverBattleMenu() в core.ts, которая
 * опирается на recoverStuckTurn() ниже. Дополнительно btn-leave-battle теперь
 * уводит автомат в IDLE через leaveBattleToIdle() (раньше фаза оставалась
 * боевой, и следующий startHunt делал невалидный transition в WILD_START).
 */
describe('phase-recovery — возврат хода из залипшего ENEMY_TURN', () => {
  let sm: BattleStateMachine;

  beforeEach(() => { sm = BattleStateMachine.create(); });

  it('ENEMY_TURN → PLAYER_TURN: залипание чинится', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    sm.transition(BattlePhase.ENEMY_TURN);
    expect(recoverStuckTurn(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.PLAYER_TURN);
  });

  it('PLAYER_TURN: уже ход игрока — true без лишнего перехода', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    const logLen = sm.getTransitionLog().length;
    expect(recoverStuckTurn(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.PLAYER_TURN);
    expect(sm.getTransitionLog()).toHaveLength(logLen); // re-entry не логируется
  });

  it.each([
    BattlePhase.VICTORY,
    BattlePhase.DEFEAT,
    BattlePhase.IDLE,
    BattlePhase.WILD_START,
    BattlePhase.ANIMATING,
  ])('из %s восстановления нет — false, фаза не меняется', (phase) => {
    sm.forcePhase(phase);
    expect(recoverStuckTurn(sm)).toBe(false);
    expect(sm.phase).toBe(phase);
  });
});

describe('phase-recovery — выход из боя всегда ведёт в IDLE', () => {
  let sm: BattleStateMachine;

  beforeEach(() => { sm = BattleStateMachine.create(); });

  it.each([
    BattlePhase.PLAYER_TURN, // побег / выход своим ходом
    BattlePhase.VICTORY,     // выход с экрана победы
    BattlePhase.DEFEAT,      // выход с экрана поражения
  ])('из %s — прямой transition в IDLE', (phase) => {
    sm.forcePhase(phase);
    expect(leaveBattleToIdle(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.IDLE);
  });

  it('из ENEMY_TURN — через forcePhase (перехода нет в карте), итог IDLE', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    sm.transition(BattlePhase.ENEMY_TURN);
    // Прямой переход запрещён картой — фиксируем предусловие, иначе тест
    // перестанет проверять fallback.
    expect(sm.canTransition(BattlePhase.IDLE)).toBe(false);
    expect(leaveBattleToIdle(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.IDLE);
  });

  it('из IDLE — no-op, true', () => {
    expect(leaveBattleToIdle(sm)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.IDLE);
  });

  it('после выхода новый wild-бой стартует чисто: IDLE → WILD_START → PLAYER_TURN', () => {
    sm.transition(BattlePhase.WILD_START);
    sm.transition(BattlePhase.PLAYER_TURN);
    sm.transition(BattlePhase.ENEMY_TURN);
    expect(leaveBattleToIdle(sm)).toBe(true);
    // Ровно эта цепочка ломалась без transition(IDLE) в btn-leave-battle:
    // фаза оставалась боевой, и первый transition возвращал false.
    expect(sm.transition(BattlePhase.WILD_START)).toBe(true);
    expect(sm.transition(BattlePhase.PLAYER_TURN)).toBe(true);
  });
});

describe('phase-recovery — контракт побега на уровне автомата', () => {
  it('полный цикл побега: IDLE → WILD_START → PLAYER_TURN → IDLE', () => {
    const sm = BattleStateMachine.create();
    expect(sm.transition(BattlePhase.WILD_START)).toBe(true);
    expect(sm.transition(BattlePhase.PLAYER_TURN)).toBe(true);
    // Побег разрешён только из PLAYER_TURN — проверяем обе стороны:
    // сам побег (PLAYER_TURN → IDLE) и запрет восстановления из чужой фазы.
    expect(sm.transition(BattlePhase.IDLE)).toBe(true);
    expect(sm.phase).toBe(BattlePhase.IDLE);
  });
});
