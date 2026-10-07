// ─────────────────────────────────────────────────────────────
// state-machine.ts — КОНЕЧНЫЙ АВТОМАТ ФАЗ БОЯ
// ─────────────────────────────────────────────────────────────
// BattleStateMachine — класс, управляющий переходами между фазами.
//
// Фазы (BattlePhase):
//   IDLE → WILD/GYM/ELITE/CHAMPION/PVP_START → PLAYER_TURN →
//   ENEMY_TURN → ANIMATING → ... → VICTORY/DEFEAT → IDLE
//
// Каждый переход валидируется по BATTLE_TRANSITIONS.
// Можно подписаться на события: 'phase:change', 'phase:X'.
//
// Используется в:
//   core.ts     — переходы фаз в бою (battle.transition())
//   ai.ts       — чтение текущей фазы
//   pvp-core.ts — синхронизация фаз с оппонентом
//   тесты       — BattleStateMachine.create() изолированный экземпляр
//
// Зависит от:
//   types.js    — BattlePhase, BATTLE_TRANSITIONS, BattleStateData
// ─────────────────────────────────────────────────────────────

import {
  BattlePhase,
  BATTLE_TRANSITIONS,
  INITIAL_BATTLE_STATE,
  BattleStateData,
} from './types.js';
export type { BattleStateData };
export { BattlePhase, BATTLE_TRANSITIONS, INITIAL_BATTLE_STATE };

type Listener = (...args: any[]) => void;

/**
 * BattleStateMachine — инстанциируемый класс состояния боя.
 * - Фазовые переходы с валидацией
 * - Ивент-система (emit/on/off)
 * - Изолированное состояние (можно создавать для тестов)
 */
export class BattleStateMachine {
  private _phase: BattlePhase = BattlePhase.IDLE;
  private _state: BattleStateData = { ...INITIAL_BATTLE_STATE };
  private _listeners = new Map<string, Set<Listener>>();
  private _transitionLog: string[] = [];

  // ── Геттеры ──

  get phase(): BattlePhase { return this._phase; }
  get state(): BattleStateData { return this._state; }

  /** Только для legacy-совместимости — прямое чтение/запись полей */
  get s(): BattleStateData { return this._state; }

  // ── Фазовые переходы ──

  /** Перейти в фазу `to`. Возвращает false если переход запрещён. */
  transition(to: BattlePhase): boolean {
    if (this._phase === to) return true; // Same phase is always allowed (re-entry)
    const allowed = BATTLE_TRANSITIONS[this._phase];
    if (!allowed?.includes(to)) {
      console.warn(
        `[BattleSM] Invalid transition: ${this._phase} → ${to}. ` +
        `Allowed: ${allowed?.join(', ') || 'none'}`
      );
      return false;
    }
    const from = this._phase;
    this._phase = to;
    this._transitionLog.push(`${from} → ${to}`);
    this.emit('phase:change', { from, to });
    this.emit(`phase:${to}`, { from });
    return true;
  }

  /** Проверить возможен ли переход (без выполнения) */
  canTransition(to: BattlePhase): boolean {
    if (this._phase === to) return true;
    return BATTLE_TRANSITIONS[this._phase]?.includes(to) ?? false;
  }

  /** Принудительно установить фазу (без валидации — для restore) */
  forcePhase(phase: BattlePhase): void {
    const from = this._phase;
    this._phase = phase;
    this.emit('phase:change', { from, to: phase });
  }

  // ── Управление состоянием ──

  /** Частичное обновление полей состояния */
  patch(partial: Partial<BattleStateData>): void {
    Object.assign(this._state, partial);
  }

  /** Сброс в начальное состояние + IDLE */
  reset(): void {
    this._state = { ...INITIAL_BATTLE_STATE };
    const from = this._phase;
    this._phase = BattlePhase.IDLE;
    this._transitionLog = [];
    this.emit('phase:change', { from, to: BattlePhase.IDLE });
  }

  /** Полный снимок состояния */
  snapshot(): BattleStateData {
    return { ...this._state };
  }

  // ── Ивент-система ──

  on(event: string, fn: Listener): () => void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(fn);
    return () => { this._listeners.get(event)?.delete(fn); };
  }

  off(event: string, fn: Listener): void {
    this._listeners.get(event)?.delete(fn);
  }

  emit(event: string, ...args: any[]): void {
    const set = this._listeners.get(event);
    if (set) set.forEach(fn => fn(...args));
  }

  /** Удалить все подписки */
  clearListeners(): void {
    this._listeners.clear();
  }

  // ── Диагностика ──

  getTransitionLog(): string[] {
    return [...this._transitionLog];
  }

  /** Фабрика для тестов — чистый экземпляр */
  static create(): BattleStateMachine {
    return new BattleStateMachine();
  }
}

/**
 * recoverStuckTurn — вернуть ход игроку из залипшего ENEMY_TURN.
 *
 * КОНТЕКСТ: ход врага (runEnemyTurnBody в core.ts) может упасть с исключением
 * ПОСЛЕ `transition(ENEMY_TURN)`, но ДО `showPlayerMenuAfterDelay()`. Тогда фаза
 * навсегда остаётся ENEMY_TURN, и все кнопки боя (побег, смена, предмет, атаки)
 * отвечают тостом «Подождите...». Зовётся только из catch-веток.
 *
 * Возвращает true, если итоговая фаза — PLAYER_TURN (включая случай, когда она
 * уже была PLAYER_TURN и делать ничего не надо). В терминальных фазах
 * (VICTORY/DEFEAT/IDLE) и в стартовых фазах ничего не трогает — false.
 */
export function recoverStuckTurn(sm: BattleStateMachine): boolean {
  const phase = sm.phase;
  if (phase === BattlePhase.PLAYER_TURN) return true;
  if (phase !== BattlePhase.ENEMY_TURN) return false;
  return sm.transition(BattlePhase.PLAYER_TURN);
}

/**
 * leaveBattleToIdle — увести автомат в IDLE при выходе из боя.
 *
 * КОНТЕКСТ: кнопка «выход из боя» (btn-leave-battle) доступна из фаз конца боя
 * (VICTORY/DEFEAT), а побег — из PLAYER_TURN. Прямой transition(IDLE) покрывает
 * эти случаи, но если фаза по какой-то причине другая (например, ENEMY_TURN —
 * из карты переходов IDLE туда не входит), делаем forcePhase: торчать в боевой
 * фазе с закрытой модалкой и пустым battle_state хуже, чем принудительный сброс.
 *
 * Возвращает true, если итоговая фаза — IDLE.
 */
export function leaveBattleToIdle(sm: BattleStateMachine): boolean {
  if (sm.phase === BattlePhase.IDLE) return true;
  if (!sm.transition(BattlePhase.IDLE)) {
    sm.forcePhase(BattlePhase.IDLE);
  }
  // Каст `as BattlePhase`: TS наследует суженный тип геттера phase через
  // инициализатор поверх аннотации и считает финальное сравнение с IDLE
  // «непреднамеренным». Каст разрывает цепочку сужения.
  const landed = sm.phase as BattlePhase;
  return landed === BattlePhase.IDLE;
}
