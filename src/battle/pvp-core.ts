// ─────────────────────────────────────────────────────────────
// pvp-core.ts — PVP БОЙ (КЛИЕНТСКАЯ ЧАСТЬ)
// ─────────────────────────────────────────────────────────────
// Отвечает за UI и логику PvP-боя на стороне клиента.
// Взаимодействует с сервером через Socket.IO (state.socket).
//
// ОСНОВНЫЕ ФУНКЦИИ:
//   openPvPArena — открыть арену PvP-боя
//   updatePvPUI — обновить интерфейс боя (HP, ходы, кнопки)
//   doPvPAttack — выполнить атаку игрока
//   endPvP — завершить PvP-бой (победа/поражение)
//
// ОТЛИЧИЯ ОТ WILD/GYM БОЯ:
//   - Данные оппонента приходят через Socket.IO (не PokeAPI)
//   - Упрощённый расчёт урона (не использует calculateDamage из logic.ts)
//   - Ходы переключаются: мой ход → ход оппонента → мой ход
//   - Нет авто-охоты, предметов в бою, смены покемона
//   - Простая формула: lvl * power * atk / 15 * рандом
//
// ЗАВИСИМОСТИ:
//   state — глобальное состояние игры
//   socket — Socket.IO клиент (state.socket)
//   showToast — уведомления
//   autoSave — автосохранение
//   updateMoneyDisplay — обновление денег в UI
// ─────────────────────────────────────────────────────────────

import { state } from '../game/state.js';
import { fetchSiteMoveDetail } from '../data/sitemove.js';
import { store } from '../game/store.js';
import { showToast } from '../utils/dom.js';
import { getSpriteUrl } from '../utils/sprite.js';
import { autoSave } from '../game/save.js';
import { updateMoneyDisplay } from '../ui/location.js';
import { checkAchievement } from '../ui/achievements.js';
import { calculateDamage, checkAccuracy, getTypeMultiplier, statStageModify, isStatusImmune, applyStatusEffect } from './logic.js';
import { calculateStat } from './stats.js';
import { HEAL_HP } from '../data/item-effects.js';
import { normMoveName, isChargeMove, canHitHidden, hideVerb, isOhkoMove, getFixedDamage, hasFixedDamage, isTrapChipMove } from './special-moves.js';

/** Нормализация способности. */
function normAbil(a?: string | null): string {
  return (a || '').toLowerCase().replace(/[^a-z]/g, '');
}

/** Заземлён ли мон (для ловушек/террейна/травы): не летающий тип и не левитация. */
export function isGrounded(types: ArrayLike<unknown>, ability?: string | null): boolean {
  const ts = Array.from(types || []).map((t: any) => (typeof t === 'string' ? t : t?.type?.name)).filter(Boolean) as string[];
  if (ts.includes('flying')) return false;
  if (normAbil(ability) === 'levitate') return false;
  return true;
}

/** Зарядные атаки с укрытием: fly/dig/dive/bounce + что их бьёт. */
const HIDDEN_KINDS: Record<string, string> = {
  fly: 'fly', bounce: 'fly', 'sky-drop': 'fly',
  dig: 'dig',
  dive: 'dive',
  'phantom-force': 'phantom', 'shadow-force': 'phantom',
};
const HITS_HIDDEN: Record<string, string[]> = {
  fly: ['thunder', 'hurricane', 'smack-down', 'thousand-arrows', 'gust', 'twister'],
  dig: ['earthquake', 'magnitude'],
  dive: ['surf', 'whirlpool'],
  phantom: [],
};
/** Пробивают защиту (protect/detect). */
const PIERCE_PROTECT = new Set(['phantom-force', 'shadow-force', 'feint', 'hyperspace-hole', 'hyperspace-fury']);
/** Статус-атаки с фиксированным уроном по сну/заморозке не будят. */
const DREAM_EATER_LIKE = new Set(['dream-eater', 'nightmare']);
/** Двухходовки с баффом на зарядке: move -> [stat, delta]. */
const CHARGE_BUFFS: Record<string, Array<[string, number]>> = {
  geomancy: [['spa', 2], ['spd', 2], ['spe', 2]],
  'skull-bash': [['def', 1]],
};
/** Перезарядка после удара. */
const RECHARGE_MOVES = new Set(['hyper-beam', 'giga-impact', 'roar-of-time', 'frenzy-plant', 'blast-burn', 'hydro-cannon', 'rock-wrecker', 'meteor-assault']);
/** Контрудар при промахе (урон себе = половина макс HP). */
const CRASH_MOVES = new Set(['jump-kick', 'high-jump-kick']);
/** Статусное состояние: названия статусов для лога. */
const STATUS_NAMES: Record<string, string> = {
  brn: 'ожог', par: 'паралич', psn: 'отравление', tox: 'сильный яд', slp: 'сон', frz: 'заморозка',
};
/** Маппинг ailment PokeAPI -> наш статус. */
export function ailmentToStatus(ailment?: string | null): string | null {
  const a = (ailment || '').toLowerCase().replace(/[^a-z-]/g, '');
  if (a === 'paralysis') return 'par';
  if (a === 'burn') return 'brn';
  if (a === 'poison') return 'psn';
  if (a === 'toxic') return 'tox';
  if (a === 'sleep') return 'slp';
  if (a === 'freeze') return 'frz';
  return null;
}

/** Зарядные атаки с укрытием (полный список). */
const CHARGE_MOVES = new Set(['fly', 'dig', 'dive', 'solarbeam', 'solarblade', 'skullbash', 'razorwind', 'freezeshock', 'iceburn', 'skyattack', 'phantomforce', 'shadow-force', 'geomancy', 'bounce', 'meteor-assault']);
/** Карта погоды/террейна в типы calculateDamage. */
const PVP_WEATHER: Record<string, string> = {
  sun: 'sun', harshsun: 'sun', rain: 'rain', sandstorm: 'sandstorm', hail: 'hail',
};
/** Защитные приёмы (успех падает с каждым подряд). */
const PROTECT_MOVES = new Set(['protect', 'detect']);
/** Принудительная смена уроном (Roar/Whirlwind — нет, только эти). */
const FORCED_SWITCH_MOVES = new Set(['dragon-tail', 'circle-throw']);

/** Поле боя (симметрично считается обеими сторонами из общего потока ходов). */
export interface PvpFieldState {
  weather: { type: string | null; untilRound: number };
  terrain: { type: string | null; untilRound: number };
  myScreens: { light: number; reflect: number }; // untilRound
  foeScreens: { light: number; reflect: number };
  myHazards: { rocks: boolean; spikes: number; toxic: number; sticky: boolean };
  foeHazards: { rocks: boolean; spikes: number; toxic: number; sticky: boolean };
}
export const pvpField: PvpFieldState = {
  weather: { type: null, untilRound: 0 },
  terrain: { type: null, untilRound: 0 },
  myScreens: { light: 0, reflect: 0 },
  foeScreens: { light: 0, reflect: 0 },
  myHazards: { rocks: false, spikes: 0, toxic: 0, sticky: false },
  foeHazards: { rocks: false, spikes: 0, toxic: 0, sticky: false },
};
export function resetPvpField(): void {
  pvpField.weather = { type: null, untilRound: 0 };
  pvpField.terrain = { type: null, untilRound: 0 };
  pvpField.myScreens = { light: 0, reflect: 0 };
  pvpField.foeScreens = { light: 0, reflect: 0 };
  pvpField.myHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
  pvpField.foeHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
}
function curRound(): number { return Number(state.pvpRound) || 0; }
function fieldActive(slot: { type: string | null; untilRound: number }): string | null {
  return slot.type && curRound() < slot.untilRound ? slot.type : null;
}
/** Погода для calculateDamage (Cloud Nine / Air Lock подавляют). */
export function pvpWeatherForCalc(myAbility?: string | null, foeAbility?: string | null): string {
  const norm = (a?: string | null) => (a || '').toLowerCase().replace(/[^a-z]/g, '');
  if (['cloudnine', 'airlock'].includes(norm(myAbility)) || ['cloudnine', 'airlock'].includes(norm(foeAbility))) return 'clear';
  const w = fieldActive(pvpField.weather);
  return (w && PVP_WEATHER[w]) || 'clear';
}
export function pvpTerrainActive(): string | null {
  return fieldActive(pvpField.terrain);
}
function screenUp(screens: { light: number; reflect: number }, kind: 'light' | 'reflect'): boolean {
  return curRound() < screens[kind];
}
/** Каждый волевой ход (атака/смена/предмет/зарядка/dbond) двигает общий счётчик. */
export function pvpAdvanceRound(logLines: string[] = []): void {
  state.pvpRound = curRound() + 1;
  if (pvpField.weather.type && curRound() >= pvpField.weather.untilRound) {
    logLines.push('Погода рассеялась.');
    pvpField.weather = { type: null, untilRound: 0 };
  }
  if (pvpField.terrain.type && curRound() >= pvpField.terrain.untilRound) {
    logLines.push('Террейн рассеялся.');
    pvpField.terrain = { type: null, untilRound: 0 };
  }
}
/** Волатильное состояние одного активного бойца (НЕ пишется в сейв). */
export interface PvpVolatile {
  confusedTurns: number;
  protectStreak: number;
  protectActive: boolean;
  charging: string | null;
  lockedMove: { name: string; turnsLeft: number } | null;
  rechargeNeeded: boolean;
  perishUntilRound: number | null;
  dbond: null | 'destiny' | { grudge: string };
  encoreMove: string | null;
  encoreUntilRound: number;
  tauntUntilRound: number;
  disabledMove: string | null;
  disabledUntilRound: number;
  flinchPending: boolean;
  actedStint: boolean;
  substituteHp: number;
  trapName: string | null;
  trapUntilRound: number | null;
  lastMoveName: string | null;
  lastMoveDamaging: boolean;
}
export function freshPvpVolatile(): PvpVolatile {
  return {
    confusedTurns: 0, protectStreak: 0, protectActive: false, charging: null,
    lockedMove: null, rechargeNeeded: false, perishUntilRound: null,
    dbond: null, encoreMove: null, encoreUntilRound: 0, tauntUntilRound: 0,
    disabledMove: null, disabledUntilRound: 0, flinchPending: false, actedStint: false,
    substituteHp: 0, trapName: null, trapUntilRound: null,
    lastMoveName: null, lastMoveDamaging: false,
  };
}
/** Своё волатильное состояние (сбрасывается при смене/нокауте/старте боя). */
export const pvpVol: PvpVolatile = freshPvpVolatile();
export function resetPvpVol(): void {
  const f = freshPvpVolatile();
  for (const k of Object.keys(f) as Array<keyof PvpVolatile>) (pvpVol as any)[k] = (f as any)[k];
}
/** Волатильное состояние соперника (то, что нам видно из реплея его ходов). */
export const pvpFoeVol: PvpVolatile = freshPvpVolatile();
export function resetPvpFoeVol(): void {
  const f = freshPvpVolatile();
  for (const k of Object.keys(f) as Array<keyof PvpVolatile>) (pvpFoeVol as any)[k] = (f as any)[k];
}

/** Подписи статов для лога баффов. */
const STAGE_LABELS: Record<string, string> = {
  atk: 'Атака', def: 'Защита', spa: 'Спец. атака', spd: 'Спец. защита', spe: 'Скорость',
};

/**
 * Танцы и баффы: самобаффы стадий (как в диком бою, без статусов).
 * Формат: slug мува → [стадия, дельта]. Кап ±6 держит statStageModify.
 * Неизвестные статус-атаки — 0 урона без эффекта.
 */
const DANCE_BUFFS: Record<string, Array<[string, number]>> = {
  'swords-dance': [['atk', 2]],
  'dragon-dance': [['atk', 1], ['spe', 1]],
  'calm-mind': [['spa', 1], ['spd', 1]],
  'nasty-plot': [['spa', 2]],
  'iron-defense': [['def', 2]],
  'amnesia': [['spd', 2]],
  'agility': [['spe', 2]],
  'bulk-up': [['atk', 1], ['def', 1]],
  'quiver-dance': [['spa', 1], ['spd', 1], ['spe', 1]],
  'growth': [['spa', 1]],
  'howl': [['atk', 1]],
  'meditate': [['atk', 1]],
  'harden': [['def', 1]],
  'withdraw': [['def', 1]],
  'defense-curl': [['def', 1]],
  'barrier': [['def', 2]],
  'acid-armor': [['def', 2]],
  'cosmic-power': [['def', 1], ['spd', 1]],
  'coil': [['atk', 1], ['def', 1]],
  'work-up': [['atk', 1], ['spa', 1]],
  'shell-smash': [['atk', 2], ['spa', 2], ['spe', 2], ['def', -1], ['spd', -1]],
  'shift-gear': [['atk', 1], ['spe', 2]],
};

/** Слаг мува: 'Hyper Beam' → 'hyper-beam'. */
function moveSlug(name: unknown): string {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** Базовые статы [hp,atk,def,spa,spd,spe] из apiData (нули → 50). */
function baseStatsOf(mon: any): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const v = Number(mon?.apiData?.stats?.[i]?.base_stat);
    out.push(Number.isFinite(v) && v > 0 ? v : 50);
  }
  return out;
}

/** Посчитанные на уровне статы {patk,pdef,satk,sdef} для обмена в mon_data. */
export function battleStatsOf(mon: any, level: number): { patk: number; pdef: number; satk: number; sdef: number } {
  const calc = (stat: string) => {
    try {
      return Math.max(1, Math.floor(Number(calculateStat(mon, stat, { level })) || 1));
    } catch { return 50; }
  };
  return { patk: calc('attack'), pdef: calc('defense'), satk: calc('special-attack'), sdef: calc('special-defense') };
}

/**
 * showPvpPanel — открыть панель PvP (M-18: вкладка «PvP-Арена»).
 * Раньше открывала торговый центр (там была кнопка ⚔); трейд остался
 * только в ПЦ, а вызовы — из тренеркарты и с арены.
 */
export async function showPvpPanel() {
  const { openPvpArenaLobby } = await import('../ui/pvp-arena.js');
  openPvpArenaLobby();
}

/**
 * openPvPArena — открыть арену PvP-боя с оппонентом.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Создаёт модалку pvp-modal (если её нет) с полным UI боя
 *   2. Устанавливает state.pvpBattleId, pvpOpponentName, pvpMyTurn
 *   3. Находит первого живого покемона → state.pvpMyMon
 *   4. Загружает атаки покемона (только level-up, топ-4 по уровню)
 *   5. Отправляет данные о своём покемоне оппоненту через socket
 *   6. Обработчик "Сдаться" — отправляет pvp_end с surrender
 *
 * ЧТО ПРИНИМАЕТ:
 *   battleId — ID боя от сервера
 *   opponent — имя оппонента
 *   myFirst — true если я хожу первый
 *
 * ОТКУДА ВЫЗЫВАЕТСЯ: из обработчика socket → 'pvp_start'
 */
export function openPvPArena(battleId, opponent, myFirst) {
  const alive = state.myTeam.find(m => m.currentHp > 0);
  if (!alive) { showToast('Нет живых покемонов!', true); return; }
  state.pvpOpponentName = opponent;
  state.pvpMyTurn = myFirst;
  state.pvpMyMon = alive;
  state.pvpEndSent = false; // новый бой — pvp_end ещё не слали
  // Участники и уровни соперника — для XP в конце боя.
  state.pvpParticipants = alive?.uid ? [alive.uid] : [];
  state.pvpEnemyLvls = [];
  (state as any).pvpEnemyBaseExp = [];
  state.pvpOppMon = null;
  state.pvpOppTeam = null;
  state.pvpRound = 0;
  state.pvpItemsUsed = 0;
  (state as any).pvpFoeActed = false;
  (state as any).pvpWasHit = false;
  resetPvpField();
  resetPvpVol();
  resetPvpFoeVol();
  trackPvpParticipant(alive);
  if (state.pvpReplaceTimer) { clearTimeout(state.pvpReplaceTimer); state.pvpReplaceTimer = null; }
  state.pvpAwaitingReplacement = false;

  // ── Создание модалки (если ещё не создана) ──
  let modal = document.getElementById('pvp-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pvp-modal';
    modal.className = 'modal-overlay';
    modal.style.display = 'none';
    modal.innerHTML = `
      <div class="reborn-battle-arena" style="max-width:440px;width:95%;">
        <div class="text-center p-8"><span id="pvp-opponent-name" class="fw-bold"></span></div>
        <div class="text-center fs-09" id="pvp-turn-indicator"></div>
        <div class="text-center fs-09" id="pvp-opp-team" style="margin:2px 0;"></div>
        <div class="reborn-pokemon-row">
          <div class="reborn-side-panel">
            <div class="reborn-poke-header"><span id="pvp-my-name"></span> <span id="pvp-my-lvl"></span></div>
            <div class="reborn-hp-bar"><div class="reborn-hp-fill" id="pvp-my-hp-fill"></div></div>
            <div class="reborn-hp-text" id="pvp-my-hp"></div>
            <div class="reborn-sprite-box"><img class="reborn-sprite" id="pvp-my-sprite" src=""></div>
            <div class="text-center fs-09" id="pvp-my-team" style="margin-top:2px;"></div>
          </div>
          <div class="reborn-side-panel">
            <div class="reborn-poke-header"><span id="pvp-opp-name"></span> <span id="pvp-opp-lvl"></span></div>
            <div class="reborn-hp-bar"><div class="reborn-hp-fill" id="pvp-opp-hp-fill"></div></div>
            <div class="reborn-hp-text" id="pvp-opp-hp"></div>
            <div class="reborn-sprite-box"><img class="reborn-sprite" id="pvp-opp-sprite" src=""></div>
          </div>
        </div>
        <div class="reborn-center-panel">
          <div class="reborn-moves" id="pvp-moves"></div>
          <div class="reborn-log-container"><div class="reborn-battle-log" id="pvp-log"></div></div>
        </div>
        <button class="tma-btn w-full mt-8" id="btn-pvp-leave">Сдаться</button>
        <button class="tma-btn w-full mt-8" id="btn-pvp-switch" style="margin-top:6px;">🔄 Смена</button>
        <button class="tma-btn w-full mt-8" id="btn-pvp-baton" style="margin-top:6px;">↪️ Baton Pass</button>
        <button class="tma-btn w-full mt-8" id="btn-pvp-item" style="margin-top:6px;">🎒 Предмет</button>
      </div>
    `;
    document.body.appendChild(modal);
    // Обработчик кнопки "Сдаться"
    document.getElementById('btn-pvp-leave').addEventListener('click', () => {      modal.style.display = 'none';
      state.socket.emit('pvp_end', { battleId: state.pvpBattleId, action: { type: 'surrender' } });
      state.pvpBattleId = null;
      state.pvpEndSent = true;
      // Сеттл поднимет версию (победителю — награда, мне на арене — утешительные):
      // сейв только после подтверждения, иначе 409 + тост (см. deferSettleSave).
      deferSettleSave();
      updateMoneyDisplay();
    });
    // Добровольная смена: ход сгорает (как договорились в опроснике).
    document.getElementById('btn-pvp-switch').addEventListener('click', () => {
      if (!state.pvpBattleId || !state.pvpMyTurn) return;
      openPvpSwitchPicker('switch');
    });
    // Baton Pass: только если у активного есть этот приём.
    document.getElementById('btn-pvp-baton').addEventListener('click', () => {
      if (!state.pvpBattleId || !state.pvpMyTurn) return;
      const knows = ((state.pvpMyMon as any)?.apiData?.moves || []).some((m: any) => moveSlug(m?.move?.name) === 'baton-pass');
      if (!knows) { showToast('Нет приёма Baton Pass!', true); return; }
      openPvpSwitchPicker('baton');
    });
    // Предметы в бою (лимит 3 за бой).
    document.getElementById('btn-pvp-item').addEventListener('click', () => {
      if (!state.pvpBattleId || !state.pvpMyTurn) return;
      openPvpItemPicker();
    });
  }

  // ── Заполнение UI ──
  document.getElementById('pvp-opponent-name').textContent = `⚔ Бой с ${opponent}`;
  document.getElementById('pvp-opp-name').textContent = opponent;       // Имя оппонента
  document.getElementById('pvp-opp-lvl').textContent = '';              // Уровень — пока неизвестен
  document.getElementById('pvp-opp-hp').textContent = '?/?';            // HP — пока неизвестно
  document.getElementById('pvp-opp-hp-fill').style.width = '100%';     // HP бар — полный
  (document.getElementById('pvp-opp-sprite') as HTMLImageElement).src = ''; // Спрайт — пока пусто
  document.getElementById('pvp-log').innerHTML = '';
  renderPvpTeams();
  updatePvPUI();                                                        // UI своего покемона
  modal.style.display = 'flex';

  // ── Отправка данных о своём покемоне оппоненту ──
  // Сервер пересылает это второму игроку. Типы/статы/стадии нужны обеим
  // сторонам для честного урона (STAB, эффективность, защита) — как в диком.
  // Стадии боя не должны утекать в сейв: снапшот восстанавливаем в endPvP.
  sendMyMonData(battleId);
}

/**
 * Отправка своего покемона оппоненту (mon_data): старт боя и пересинхрон
 * после реконнекта (pvp_rejoin). Типы/статы/стадии — для честного урона.
 */
export function sendMyMonData(battleId: unknown): void {
  const mon = state.pvpMyMon;
  if (!mon || !state.socket) return;
  const myLvl = mon.baseLevel + (mon.candiesEaten || 0);
  // Снапшот стадий — только при смене бойца (не при каждом ресинке, иначе
  // переподключение посреди баффов зафиксирует +6 как «стартовые»).
  if ((state as any).pvpStageBackupUid !== mon.uid) {
    state.pvpStageBackup = JSON.parse(JSON.stringify(mon.statStages || {}));
    (state as any).pvpStageBackupUid = mon.uid;
  }
  const myTypes = (mon.apiData?.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
  const myBaseExp = Number(mon.apiData?.base_experience);
  state.socket.emit('pvp_action', { battleId, action: {
    type: 'mon_data',
    name: mon.nickname || mon.apiData?.name,
    lvl: myLvl,
    hp: mon.currentHp,
    maxHp: mon.maxHp,
    sprite: getSpriteUrl(mon),
    types: myTypes,
    ability: mon.abilityName || mon.ability || null,
    held: mon.heldItem || null,
    status: mon.status || null,
    baseExp: Number.isFinite(myBaseExp) && myBaseExp > 0 ? myBaseExp : 50,
    stats: baseStatsOf(mon),
    calc: battleStatsOf(mon, myLvl),
    stages: { ...(mon.statStages || {}) },
    team: (state.myTeam || []).slice(0, 6).map((m: any) => ({
      name: m?.nickname || m?.apiData?.name || '?',
      hp: m?.currentHp ?? 0,
      maxHp: m?.maxHp ?? 1,
    })),
  }});
  trackPvpParticipant(mon);
}

/** Закрыть модалку боя, если событие относится к текущему бою (или без привязки). */
export function closePvpModalIf(battleId?: unknown): void {
  try {
    if (battleId && state.pvpBattleId && battleId !== state.pvpBattleId) return;
    const modal = document.getElementById('pvp-modal');
    if (modal) modal.style.display = 'none';
    state.pvpBattleId = null;
    state.pvpMyTurn = false;
  } catch { /* ignore */ }
}

/** Участник боя — для XP в конце (только вышедшие на поле). */
export function trackPvpParticipant(mon: any): void {
  try {
    if (!mon?.uid) return;
    const list = Array.isArray(state.pvpParticipants) ? state.pvpParticipants : [];
    if (!list.includes(mon.uid)) list.push(mon.uid);
    state.pvpParticipants = list;
  } catch { /* ignore */ }
}

/** Полосы команд: свои 6 (точка = жив/пал/текущий) + чужие по последнему снимку. */
export function renderPvpTeams(): void {
  try {
    const myBox = document.getElementById('pvp-my-team');
    if (myBox) {
      myBox.innerHTML = (state.myTeam || []).slice(0, 6).map((m: any) => {
        const alive = (m?.currentHp || 0) > 0;
        const cur = state.pvpMyMon && m?.uid && state.pvpMyMon.uid === m.uid;
        const dot = alive ? '🟢' : '🔴';
        return `<span style="${cur ? 'outline:2px solid #34c759;border-radius:50%;' : ''}margin:0 1px;" title="${(m?.nickname || m?.apiData?.name || '?') + ' ' + (m?.currentHp || 0) + '/' + (m?.maxHp || '?')}">${dot}</span>`;
      }).join('');
    }
    const oppBox = document.getElementById('pvp-opp-team');
    if (oppBox) {
      const team = Array.isArray(state.pvpOppTeam) ? state.pvpOppTeam : [];
      const curName = state.pvpOppMon?.name;
      oppBox.innerHTML = team.slice(0, 6).map((m: any) => {
        const alive = (Number(m?.hp) || 0) > 0;
        const cur = curName && m?.name === curName;
        const dot = alive ? '🟢' : '🔴';
        return `<span style="${cur ? 'outline:2px solid #ff9500;border-radius:50%;' : ''}margin:0 1px;" title="${m?.name || '?'}: ${m?.hp ?? '?'}">${dot}</span>`;
      }).join('');
    }
  } catch { /* ignore */ }
}

/**
 * Выбор бойца: добровольная смена ('switch', ход сгорает), замена после
 * нокаута ('faint', быстрейший ходит первым) или Baton Pass ('baton',
 * ход сгорает, стадии и кукла переносятся).
 */
export function openPvpSwitchPicker(mode: 'switch' | 'faint' | 'baton'): void {
  try { document.getElementById('pvp-switch-modal')?.remove(); } catch { /* ignore */ }
  if (mode !== 'faint' && pvpVol.trapUntilRound != null && pvpRoundNow() < pvpVol.trapUntilRound) {
    showToast('Ловушка держит! Смена невозможна!', true);
    return;
  }
  const box = document.createElement('div');
  box.id = 'pvp-switch-modal';
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
  const alive = (state.myTeam || []).filter((m: any) => m && (m.currentHp || 0) > 0
    && (!state.pvpMyMon || m.uid !== state.pvpMyMon.uid));
  const title = mode === 'faint' ? 'Ваш покемон пал! Кто выходит?'
    : mode === 'baton' ? 'Baton Pass: кого выпускаем? (стадии перейдут)' : 'Кого выпускаем? (ход сгорит)';
  box.innerHTML = `<div style="background:#1c1c2e;border-radius:12px;padding:16px;max-width:320px;width:90%;">
    <div style="font-weight:bold;margin-bottom:10px;text-align:center;">${title}</div>
    <div id="pvp-switch-list"></div>
    ${mode === 'faint' ? '' : '<button id="pvp-switch-cancel" class="tma-btn w-full" style="margin-top:8px;">Отмена</button>'}
  </div>`;
  document.body.appendChild(box);
  const list = document.getElementById('pvp-switch-list');
  for (const m of alive) {
    const b = document.createElement('button');
    b.className = 'tma-btn w-full';
    b.style.marginTop = '6px';
    b.textContent = `${m.nickname || m.apiData?.name || '?'} Ур.${(m.baseLevel || 1) + (m.candiesEaten || 0)} HP ${m.currentHp}/${m.maxHp}`;
    b.onclick = () => { try { box.remove(); } catch {} pvpPickFighter(m, mode); };
    list?.appendChild(b);
  }
  if (mode !== 'faint') {
    (document.getElementById('pvp-switch-cancel') as any).onclick = () => { try { box.remove(); } catch {} };
  }
}

/** Поставить бойца на поле: смена / замена после нокаута / Baton Pass. */
export function pvpPickFighter(mon: any, mode: 'switch' | 'faint' | 'baton'): void {
  if (!mon || !state.pvpBattleId) return;
  if (mode !== 'faint' && pvpVol.trapUntilRound != null && pvpRoundNow() < pvpVol.trapUntilRound) {
    showToast('Ловушка держит! Смена невозможна!', true);
    return;
  }
  const outgoing = state.pvpMyMon;
  const baton = mode === 'baton';
  // Baton Pass переносит стадии и куклу; обычная смена/нокаут всё сбрасывают.
  const carry = baton && outgoing
    ? { stages: { ...((outgoing as any).statStages || {}) }, sub: pvpVol.substituteHp || 0 }
    : null;
  if (outgoing && outgoing !== mon) {
    (outgoing as any).statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    (outgoing as any).status = (outgoing as any).status || null;
  }
  state.pvpMyMon = mon;
  state.pvpEndSent = false; // новая фаза боя — будущий pvp_end разрешён
  if (mon.statStages == null) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  resetSwitchVolatile(carry);
  trackPvpParticipant(mon);
  sendMyMonData(state.pvpBattleId);
  if (mode === 'switch' || mode === 'baton') {
    pvpSend({ type: 'switch', name: mon.nickname || mon.apiData?.name, baton: baton || undefined });
  }
  state.pvpMyTurn = false;
  const logEl = document.getElementById('pvp-log');
  if (logEl) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `Вы выпускаете: ${mon.nickname || mon.apiData?.name}!${baton ? ' (Baton Pass)' : ''}`;
    logEl.prepend(logEntry);
  }
  renderPvpTeams();
  updatePvPUI();
  if (!applyEntryHazards(mon)) return;
  if (mode === 'faint') {
    // Быстрейший ходит первым (считается одинаково с обеих сторон).
    state.pvpMyTurn = myApproxSpeed() > foeApproxSpeed();
    renderPvpTeams();
    updatePvPUI();
  }
}

/** Мой покемон упал: есть кем продолжить — выбор, иначе поражение. */
export function handleMyFaint(): void {
  const others = (state.myTeam || []).filter((m: any) => m && (m.currentHp || 0) > 0);
  if (others.length === 0) {
    endPvP(false);
    return;
  }
  showToast('Ваш покемон пал! Выберите следующего.', true);
  state.pvpMyTurn = false;
  openPvpSwitchPicker('faint');
  updatePvPUI();
}

/** Соперник упал: ждём замену до 15с, иначе забираем победу (клиент соперника мёртв). */
export function waitPvpReplacement(): void {
  if (!state.pvpBattleId || state.pvpAwaitingReplacement) return;
  state.pvpAwaitingReplacement = true;
  state.pvpMyTurn = false;
  showToast('Соперник повержен! Ждём замену…', false);
  const ind = document.getElementById('pvp-turn-indicator');
  if (ind) ind.textContent = '⏳ Ждём замену соперника…';
  if (state.pvpReplaceTimer) clearTimeout(state.pvpReplaceTimer);
  state.pvpReplaceTimer = setTimeout(() => {
    state.pvpReplaceTimer = null;
    if (state.pvpAwaitingReplacement && state.pvpBattleId) {
      state.pvpAwaitingReplacement = false;
      endPvP(true);
    }
  }, 15000);
  updatePvPUI();
}

/** Бой точно окончен: снять ожидание замены (награда/сдача/выход). */
export function clearPvpReplaceWait(): void {
  state.pvpAwaitingReplacement = false;
  if (state.pvpReplaceTimer) { clearTimeout(state.pvpReplaceTimer); state.pvpReplaceTimer = null; }
}

/** XP участникам боя — РОВНО как в диком бою: floor(baseExp × lvl / 7).
 * baseExp и уровень — усреднённые по увиденным соперникам; проигравшим —
 * половина (утешение). Lucky Egg ×1.5 — как в диком. */
export async function grantPvpExp(won: boolean): Promise<void> {
  try {
    const { grantBattleExp } = await import('../ui/inventory.js');
    const uids = [...new Set(state.pvpParticipants || [])];
    const lvls = (state.pvpEnemyLvls || []).filter((n) => Number.isFinite(n) && (n as number) > 0) as number[];
    const bases = ((state as any).pvpEnemyBaseExp || []).filter((n: unknown) => Number.isFinite(n) && (n as number) > 0) as number[];
    const avgLvl = lvls.length ? lvls.reduce((a, b) => a + b, 0) / lvls.length : 5;
    const avgBase = bases.length ? bases.reduce((a, b) => a + b, 0) / bases.length : 50;
    let total = 0;
    let ups = 0;
    for (const m of state.myTeam || []) {
      if (!m?.uid || !uids.includes(m.uid)) continue;
      let gain = Math.floor(avgBase * avgLvl / 7);
      if (!won) gain = Math.floor(gain / 2);
      if (m.heldItem === 'luckyEgg') gain = Math.floor(gain * 1.5);
      if (gain <= 0) continue;
      ups += await grantBattleExp(m, gain);
      total += gain;
    }
    state.pvpParticipants = [];
    if (total > 0) showToast(`PvP-опыт: +${total} EXP${ups ? ` (уровни: ${ups})` : ''}`, false);
  } catch { /* ignore */ }
}

/**
 * Отложенный сейв конца боя/сделки: серверный сеттл (pvp_end / trade_confirm)
 * поднимает save_version, а ответ с новой версией (pvp_reward /
 * pvp_arena_update / trade_settled) приходит чуть позже. Мгновенный autoSave()
 * слал протухшую версию → 409 → resolveSaveConflict видел свежеоштампованное
 * облако «новее» → applyCloudSave + тост «Загружена более новая версия» ровно
 * в момент окончания быстрого боя (~15с). Поэтому сейв ждёт подтверждения;
 * фолбэк 4с — на случай потерянного пакета (второй pvp_end — no-op без награды:
 * версия не менялась, сейв безопасен).
 */
const SETTLE_SAVE_DELAY_MS = 4000;
export function deferSettleSave(): void {
  state.settlePending = true;
  state.saveDirty = true;
  if (state.settleTimer) clearTimeout(state.settleTimer);
  state.settleTimer = setTimeout(() => { confirmSettleSave(); }, SETTLE_SAVE_DELAY_MS);
}

/** Сеттл подтверждён или сработал фолбэк: версия уже принята из ответа
 *  сервера — сейв безопасен. */
export function confirmSettleSave(): void {
  if (state.settleTimer) { clearTimeout(state.settleTimer); state.settleTimer = null; }
  if (!state.settlePending) return;
  state.settlePending = false;
  autoSave();
}

/**
 * updatePvPUI — обновить интерфейс PvP-боя.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Обновляет HP бар, имя, уровень, спрайт своего покемона
 *   2. Показывает индикатор хода (🎯 мой ход / ⏳ ожидание)
 *   3. Загружает кнопки атак (только level-up, топ-4 по уровню)
 *   4. Блокирует кнопки если не мой ход (opacity: 0.5)
 *
 * АТАКИ: берутся из apiData.moves, фильтруются по level-up,
 * сортируются по уровню изучения (от высокого к низкому),
 * выбираются топ-4.
 */
/**
 * Счётчик рендеров updatePvPUI: функция асинхронна (fetch мувсета) и дёргается
 * по 2–3 раза на событие (open + каждый attack/hp_update). Без барьера два
 * перекрывшихся вызова давали 4+4=8 кнопок атак: чистка идёт ДО await,
 * вставка — ПОСЛЕ. Протухший рендер отваливается, не трогая DOM.
 */
let pvpRenderSeq = 0;

export async function updatePvPUI() {
  if (!state.pvpMyMon) return;
  const seq = ++pvpRenderSeq;
  const mon = state.pvpMyMon;
  const curLvl = mon.baseLevel + (mon.candiesEaten || 0);
  // ── Свой покемон ──
  document.getElementById('pvp-my-name').textContent = mon.nickname || mon.apiData?.name;
  document.getElementById('pvp-my-lvl').textContent = `Lv${curLvl}`;
  document.getElementById('pvp-my-hp').textContent = `${mon.currentHp}/${mon.maxHp}`;
  document.getElementById('pvp-my-hp-fill').style.width = `${Math.max(0, (mon.currentHp / mon.maxHp) * 100)}%`;
  const sprite = getSpriteUrl(mon);
  (document.getElementById('pvp-my-sprite') as HTMLImageElement).src = sprite;

  // ── Индикатор хода ──
  // Пока ждём замену соперника — не затираем текст ожидания чужим ходом.
  if (!state.pvpAwaitingReplacement) {
    document.getElementById('pvp-turn-indicator').textContent = state.pvpMyTurn ? '🎯 Ваш ход!' : '⏳ Ожидание хода соперника...';
  }
  document.getElementById('pvp-turn-indicator').style.color = state.pvpMyTurn ? '#34c759' : '#ff9500';

  // Бары команд: HP и нокауты обновляются каждый тик UI.
  renderPvpTeams();

  // ── Загрузка атак ──
  // ТОЛЬКО реальные мувы покемона (apiData.moves — 4 боевых слота из сейва:
  // стартовые, выученные по уровню, TM). Раньше список собирался из всего
  // лёрнсета PokeAPI (топ-4 по уровню) — в бою показывались «рандомные» атаки,
  // которых у мона нет. Фолбэк на лёрнсет — только для старых сейвов без moves.
  const movesDiv = document.getElementById('pvp-moves');
  movesDiv.innerHTML = '';
  state.pvpMovesDetailed = [];

  const savedMoves = (mon.apiData?.moves || [])
    .filter((m: any) => m?.move?.name)
    .slice(0, 4)
    .map((m: any) => ({ name: m.move.name, url: m.move.url || '' }));

  const speciesId = mon.apiData?.id;
  let topMoves: Array<{ name: string; url: string; level?: number }> = [];
  if (savedMoves.length > 0) {
    topMoves = savedMoves;
  } else if (!speciesId) {
    movesDiv.innerHTML = '<span class="text-muted">Нет данных о покемоне</span>';
    return;
  } else {
    const seen = new Set();
    const lm = [];
    try {
      const r = await fetch(`/api/pokeapi/pokemon/${speciesId}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const pokeData = await r.json();
      for (const entry of pokeData.moves || []) {
        if (!entry.move?.url) continue;
        const vgd = entry.version_group_details || [];
        let learnLevel = 0;
        let isLevelUp = false;
        for (const detail of vgd) {
          if (detail.move_learn_method?.name === 'level-up') {
            learnLevel = detail.level_learned_at || 0;
            isLevelUp = true;
            break;
          }
        }
        if (isLevelUp && learnLevel <= curLvl && !seen.has(entry.move.name)) {
          seen.add(entry.move.name);
          lm.push({ name: entry.move.name, url: entry.move.url, level: learnLevel });
        }
      }
    } catch (err) {
      console.warn('[pvp] не удалось загрузить список атак:', err);
      movesDiv.innerHTML = '<span class="text-muted">Не удалось загрузить атаки</span>';
      return;
    }

    // Сортируем: последние выученные атаки — первыми
    lm.sort((a, b) => b.level - a.level);
    topMoves = lm.slice(0, 4); // Топ-4 атаки
  }
  state.pvpMovesDetailed = topMoves.map(() => null);

  // Протухший рендер (новее уже стартовал): выходим до вставки в DOM,
  // иначе два перекрывшихся вызова дают задвоенные кнопки (4+4=8).
  if (seq !== pvpRenderSeq) return;
  // Чистим ПЕРЕД вставкой: чистка в начале функции уже могла устареть,
  // пока шёл fetch (параллельный вызов успел вставить свои кнопки).
  movesDiv.innerHTML = '';

  // Создаём кнопки для каждой атаки. Детали (тип/сила/точность) догружаются
  // асинхронно: имя и заглушка — сразу, сила и класс — по готовности.
  // PP в PvP нет (не синхронизируется между клиентами), только сила.
  topMoves.forEach((m, i) => {
    const btn = document.createElement('span');
    btn.className = 'reborn-move-link';
    btn.style.opacity = state.pvpMyTurn ? '1' : '0.5'; // Затемняем если не мой ход
    btn.textContent = m.name;
    btn.onclick = () => {
      if (!state.pvpMyTurn) { showToast('Сейчас ход соперника!', true); return; }
      doPvPAttack(i);
    };
    movesDiv.appendChild(btn);
    // Асинхронная загрузка деталей атаки (тип для цвета, сила для кнопки
    // и полный объект — для честного урона в doPvPAttack).
    fetchSiteMoveDetail(m).then(d => {
      if (seq !== pvpRenderSeq) return; // рендер уже протух
      state.pvpMovesDetailed[i] = d;
      const btns = movesDiv.querySelectorAll('.reborn-move-link');
      if (btns[i]) {
        btns[i].classList.remove('move-type-physical', 'move-type-special', 'move-type-status');
        if (d.damage_class?.name) btns[i].classList.add(`move-type-${d.damage_class.name}`);
        (btns[i] as any).textContent = `${d.name || m.name}${d.power != null ? ` · ${d.power}` : ' · —'}`;
        (btns[i] as any).title = `Тип: ${d.type?.name || '?'} / ${d.damage_class?.name || '?'} · Точн.: ${d.accuracy ?? '—'}`;
      }
    }).catch(() => {});
  });
}


/* ═══════════ ФАЗА 2: полный бой ═══════════ */

/** PP слота: инициализация по деталям, списание за использование. */
export function ensurePvpPP(mon: any): void {
  if (!mon) return;
  if (!Array.isArray(mon.movesPP)) mon.movesPP = [];
  const names: string[] = (mon.apiData?.moves || []).slice(0, 4).map((m: any) => moveSlug(m?.move?.name));
  mon.movesPP.length = names.length;
  for (let i = 0; i < names.length; i++) {
    const d = (state.pvpMovesDetailed || [])[i];
    const max = Number.isFinite(Number(d?.pp)) && Number(d.pp) > 0 ? Number(d.pp) : 15;
    if (!mon.movesPP[i] || typeof mon.movesPP[i].current !== 'number') mon.movesPP[i] = { current: max, max };
  }
}
function anyPpLeft(mon: any): boolean {
  if (!Array.isArray(mon?.movesPP) || mon.movesPP.length === 0) return true;
  return mon.movesPP.some((p: any) => (p?.current || 0) > 0);
}
function consumePp(mon: any, moveIdx: number): void {
  const p = mon?.movesPP?.[moveIdx];
  if (p && p.current > 0) p.current -= 1;
}

/** Короткий лог боя. */
function pvpLog(html: string): void {
  try {
    const logEl = document.getElementById('pvp-log');
    if (!logEl) return;
    const div = document.createElement('div');
    div.innerHTML = html;
    (logEl as any).prepend ? (logEl as any).prepend(div) : logEl.appendChild(div);
  } catch { /* ignore */ }
}

/** Типы/способность/предмет свои и соперника. */
function myTypes(): string[] {
  return ((state.pvpMyMon?.apiData?.types) || []).map((t: any) => t?.type?.name || t).filter(Boolean);
}
function foeTypes(): string[] {
  const o: any = state.pvpOppMon || {};
  return Array.isArray(o.types) ? o.types.map((t: any) => (typeof t === 'string' ? t : t?.type?.name)).filter(Boolean) : [];
}
function myAbility(): string | null { return state.pvpMyMon?.abilityName || state.pvpMyMon?.ability || null; }
function foeAbility(): string | null { return (state.pvpOppMon as any)?.ability || null; }
function myMon(): any { return state.pvpMyMon; }
function myLvl(): number { const m = state.pvpMyMon; return (m?.baseLevel || 1) + (m?.candiesEaten || 0); }

/** Отправить волевое действие (ход сгорает, раунд тикает, ход переходит). */
function pvpSend(action: any): void {
  if (!state.socket || !state.pvpBattleId) return;
  pvpAdvanceRound([]);
  pvpVol.actedStint = true;
  // Трекинг для Grudge/Sucker/Payback/Revenge + сброс окон.
  if (action && action.moveName) {
    pvpVol.lastMoveName = moveSlug(action.moveName);
    pvpVol.lastMoveDamaging = action.damageClass === 'physical' || action.damageClass === 'special';
  }
  if (!PROTECT_MOVES.has(moveSlug(action?.moveName || ''))) pvpVol.protectStreak = 0;
  (state as any).pvpFoeActed = false;
  (state as any).pvpWasHit = false;
  state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action });
  state.pvpMyTurn = false;
  try { renderPvpTeams(); updatePvPUI(); } catch { /* ignore */ }
}

/** Начало своего хода: остаточный урон, ловушки, perish, погода. Возвращает false если ходить некому. */
export function beginOwnTurn(): boolean {
  const mon = state.pvpMyMon;
  if (!mon || !state.pvpBattleId) return false;
  // Защита живёт один чужой ход: к своему следующему ходу она истекла.
  if (pvpVol.protectActive) pvpVol.protectActive = false;
  // Perish Song: обратный отсчёт идёт в начале хода.
  if (pvpVol.perishUntilRound != null && state.pvpRound >= pvpVol.perishUntilRound) {
    mon.currentHp = 0;
    pvpLog(`<b>${mon.nickname || mon.apiData?.name}</b>: обратный отсчёт — нокаут!`);
    renderPvpTeams();
    updatePvPUI();
    sendOwnFaint();
    handleMyFaint();
    return false;
  }
  // Ловушка держит и бьёт.
  if (pvpVol.trapUntilRound != null && (mon.currentHp || 0) > 0) {
    if (state.pvpRound >= pvpVol.trapUntilRound) {
      pvpVol.trapUntilRound = null;
      pvpVol.trapName = null;
      pvpLog(`${trapName(mon)} отпустила!`);
    } else {
      const dmg = Math.max(1, Math.floor((mon.maxHp || 1) / 8));
      mon.currentHp = Math.max(0, mon.currentHp - dmg);
      pvpLog(`${trapName(mon)} держит! −${dmg} HP`);
      renderPvpTeams();
      updatePvPUI();
      if (mon.currentHp <= 0) { sendOwnFaint(); handleMyFaint(); return false; }
    }
  }
  // Ожог/яд/токсик.
  const st = (mon as any).status;
  if ((st === 'brn' || st === 'psn' || st === 'tox') && (mon.currentHp || 0) > 0) {
    let dmg = 0;
    if (st === 'brn' || st === 'psn') dmg = Math.max(1, Math.floor((mon.maxHp || 1) / 16));
    else {
      mon.toxCounter = (Number((mon as any).toxCounter) || 0) + 1;
      dmg = Math.max(1, Math.floor((mon.maxHp || 1) / 16) * (mon.toxCounter as number));
    }
    mon.currentHp = Math.max(0, mon.currentHp - dmg);
    const label = st === 'brn' ? 'Ожог' : st === 'psn' ? 'Отравление' : 'Токсин';
    pvpLog(`${label} жжёт! −${dmg} HP`);
    renderPvpTeams();
    updatePvPUI();
    if (mon.currentHp <= 0) { sendOwnFaint(); handleMyFaint(); return false; }
  }
  // Погода бьёт / трава лечит.
  try {
    const w = pvpWeatherForCalc(myAbility(), foeAbility());
    const myT = myTypes();
    if ((w === 'sandstorm' || w === 'hail') && (mon.currentHp || 0) > 0) {
      const immune = w === 'sandstorm'
        ? (myT.includes('rock') || myT.includes('ground') || myT.includes('steel'))
        : myT.includes('ice');
      if (!immune) {
        const dmg = Math.max(1, Math.floor((mon.maxHp || 1) / 16));
        mon.currentHp = Math.max(0, mon.currentHp - dmg);
        pvpLog(`${w === 'sandstorm' ? 'Песчаная буря' : 'Град'} бьёт! −${dmg} HP`);
        renderPvpTeams();
        updatePvPUI();
        if (mon.currentHp <= 0) { sendOwnFaint(); handleMyFaint(); return false; }
      }
    }
    if (pvpTerrainActive() === 'grassy' && isGrounded(myT, myAbility()) && (mon.currentHp || 0) > 0 && mon.currentHp < mon.maxHp) {
      const heal = Math.max(1, Math.floor(mon.maxHp / 16));
      mon.currentHp = Math.min(mon.maxHp, mon.currentHp + heal);
      pvpLog(`Трава лечит! +${heal} HP`);
      renderPvpTeams();
      updatePvPUI();
    }
  } catch { /* ignore */ }
  return true;
}
function trapName(mon: any): string {
  return pvpVol.trapName === 'mean-look' ? 'Взгляд' : pvpVol.trapName === 'block' ? 'Блок' : 'Ловушка';
}

/** Отправить свой нокаут (общий путь: урон, остаток, perish). */
export function sendOwnFaint(): void {
  if (!state.socket || !state.pvpBattleId || !state.pvpMyMon) return;
  state.socket.emit('pvp_action', {
    battleId: state.pvpBattleId,
    action: {
      type: 'hp_update', hp: 0, maxHp: state.pvpMyMon.maxHp || 1, faint: true,
      stages: { ...(state.pvpMyMon.statStages || {}) },
    },
  });
  state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: { type: 'fainted' } });
}

/**
 * doPvPAttack — выполнить PvP-атаку. Полная механика дикого боя:
 * STAB, эффективность, физ/спец, точность, фикс-урон, OHKO, криты,
 * статусы, погода/террейн/экраны, ловушки, protect/substitute,
 * зарядка, перезарядка, forced switch, perish, destiny/grudge,
 * taunt/encore/disable, PP, борьба, отдача/дренаж.
 *
 * Порядок: блокировки (перезарядка/замок/таунт/encore/disable/фейк) →
 * PP → остаток хода → свой статус → конфузия → защита/замена/зарядка/
 * погода/террейн/ловушки/хазард/очистка/perish/dbond/grudge →
 * точность → урон calculateDamage → отдача/дрейн → отправка + лог.
 */

/** Звуковые приёмы пробивают Substitute (PokeAPI флагов не даёт). */
const PVP_SOUND: Set<string> = new Set([
  'boomburst', 'bug-buzz', 'chatter', 'disarming-voice', 'echoed-voice',
  'grass-whistle', 'growl', 'hyper-voice', 'metal-sound', 'noble-roar',
  'overdrive', 'perish-song', 'relic-song', 'round', 'screech', 'sing',
  'snore', 'sparkling-aria', 'supersonic', 'uproar', 'torch-song',
  'psychic-noise', 'alluring-voice',
]);
/** Вызывают путаницу (шанс из meta или 100%). */
const CONFUSING_MOVES = new Set([
  'supersonic', 'confuse-ray', 'swagger', 'flatter', 'teeter-dance',
  'sweet-kiss', 'chatter', 'dynamic-punch', 'water-pulse', 'psybeam',
  'signal-beam', 'dizzy-punch', 'rock-climb', 'needle-arm', 'hurricane',
  'strange-steam', 'psycho-boost',
]);
/** Отдача: доля от нанесённого (если meta.drain < 0 — берётся он). */
const PVP_RECOIL_MOVES = new Set([
  'brave-bird', 'flare-blitz', 'wild-charge', 'volt-tackle', 'head-smash',
  'double-edge', 'take-down', 'submission', 'wood-hammer', 'head-charge',
  'light-of-ruin', 'chloroblast',
]);
/** Погода по муву. */
const WEATHER_MOVES: Record<string, string> = {
  'sunny-day': 'sun', 'rain-dance': 'rain', sandstorm: 'sandstorm', hail: 'hail', snowscape: 'hail',
};
/** Террейн по муву. */
const TERRAIN_MOVES: Record<string, string> = {
  'electric-terrain': 'electric', 'grassy-terrain': 'grassy',
  'misty-terrain': 'misty', 'psychic-terrain': 'psychic',
};
/** Экраны по муву. */
const SCREEN_MOVES: Record<string, 'light' | 'reflect'> = {
  'light-screen': 'light', reflect: 'reflect', 'aurora-veil': 'reflect',
};
/** Ловушки по муву. */
const HAZARD_MOVES: Record<string, 'rocks' | 'spikes' | 'toxic' | 'sticky'> = {
  'stealth-rock': 'rocks', spikes: 'spikes', 'toxic-spikes': 'toxic', 'sticky-web': 'sticky',
};
/** Замок на 2-3 хода. */
const LOCK_MOVES = new Set(['outrage', 'petal-dance', 'thrash', 'raging-fury']);
/** Предметы, разрешённые в бою (лимит 3 за бой). */
const PVP_USABLE_ITEMS = new Set([
  'potion', 'superPotion', 'hyperPotion', 'maxPotion', 'fullRestore', 'ether', 'maxEther',
]);

function pvpRoundNow(): number { return Number(state.pvpRound) || 0; }
function myHeld(): string | null { return (state.pvpMyMon as any)?.heldItem || null; }
function foeHeld(): string | null { return (state.pvpOppMon as any)?.held || null; }
function foeStatus(): string | null { return (state.pvpOppMon as any)?.status || null; }
/** Приблизительная скорость для правила «быстрый ходит первым»
 * (только базовые статы+уровень+стадии+паралич — одинаково с обеих сторон). */
export function pvpApproxSpeed(baseSpe: number, lvl: number, stages: any, status: string | null): number {
  const b = Number.isFinite(Number(baseSpe)) && Number(baseSpe) > 0 ? Number(baseSpe) : 50;
  const l = Number.isFinite(Number(lvl)) && Number(lvl) > 0 ? Number(lvl) : 5;
  let v = Math.floor(((2 * b + 31) * l) / 100) + 5;
  const s = Math.max(-6, Math.min(6, Number(stages?.spe) || 0));
  const mult = s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
  v = Math.floor(v * mult);
  if (status === 'par') v = Math.floor(v / 4);
  return Math.max(1, v);
}
export function myApproxSpeed(): number {
  const m = state.pvpMyMon;
  const base = Number(m?.apiData?.stats?.[5]?.base_stat) || 50;
  return pvpApproxSpeed(base, (m?.baseLevel || 1) + (m?.candiesEaten || 0), m?.statStages, m?.status || null);
}
export function foeApproxSpeed(): number {
  const o: any = state.pvpOppMon || {};
  const base = Number(o?.stats?.[5]) || 50;
  return pvpApproxSpeed(base, Number(o?.lvl) || 5, o?.stages, o?.status || null);
}

/** Сброс волатильности при смене/нокауте. baton — пронести стадии+куклу. */
export function resetSwitchVolatile(carry: { stages: any; sub: number } | null): void {
  resetPvpVol();
  pvpVol.actedStint = false;
  pvpVol.protectStreak = 0;
  if (carry && state.pvpMyMon) {
    state.pvpMyMon.statStages = { ...(carry.stages || {}) };
    pvpVol.substituteHp = carry.sub || 0;
  }
}

/** Входящие ловушки на нового бойца. Возвращает false если тут же упал. */
export function applyEntryHazards(mon: any): boolean {
  if (!mon || (mon.currentHp || 0) <= 0) return true;
  const hz = pvpField.foeHazards;
  const types: string[] = ((mon.apiData?.types) || []).map((t: any) => t?.type?.name || t).filter(Boolean);
  const ab = (mon as any).abilityName || (mon as any).ability || null;
  const grounded = isGrounded(types, ab);
  let dmg = 0;
  if (hz.rocks) {
    const mult = getTypeMultiplier('rock', types);
    dmg += Math.max(1, Math.floor(((mon.maxHp || 1) / 8) * mult));
  }
  if (grounded) {
    if (hz.spikes === 1) dmg += Math.max(1, Math.floor((mon.maxHp || 1) / 8));
    else if (hz.spikes === 2) dmg += Math.max(1, Math.floor((mon.maxHp || 1) / 6));
    else if (hz.spikes >= 3) dmg += Math.max(1, Math.floor((mon.maxHp || 1) / 4));
    if (hz.toxic === 1 && !types.includes('poison') && !types.includes('steel')) {
      (mon as any).status = 'psn';
      pvpLog(`${mon.nickname || mon.apiData?.name} отравлен шипами!`);
    } else if (hz.toxic >= 2 && !types.includes('poison') && !types.includes('steel')) {
      (mon as any).status = 'tox';
      (mon as any).toxCounter = 1;
      pvpLog(`${mon.nickname || mon.apiData?.name} сильно отравлен!`);
    }
    if (hz.sticky) {
      if (!mon.statStages) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      mon.statStages = statStageModify(mon.statStages, 'spe', -1);
      pvpLog('Липкая паутина: скорость −1!');
    }
  }
  if (types.includes('poison') && (hz.toxic > 0)) {
    pvpField.foeHazards.toxic = 0;
    pvpLog('Ядовитые шипы впитаны!');
  }
  if (dmg > 0) {
    mon.currentHp = Math.max(0, mon.currentHp - dmg);
    pvpLog(`Входящий урон: −${dmg} HP`);
    renderPvpTeams();
    updatePvPUI();
    if (mon.currentHp <= 0) {
      sendOwnFaint();
      handleMyFaint();
      return false;
    }
  }
  return true;
}

/** Выбор предмета в бою. */
export function openPvpItemPicker(): void {
  try { document.getElementById('pvp-item-modal')?.remove(); } catch { /* ignore */ }
  if (!state.pvpBattleId || !state.pvpMyTurn) return;
  if ((state.pvpItemsUsed || 0) >= 3) { showToast('Предметы на этот бой кончились (3)!', true); return; }
  const inv = (state as any).inventory || {};
  const usable = [...PVP_USABLE_ITEMS].filter((id) => (inv[id] || 0) > 0);
  if (usable.length === 0) { showToast('Нет usable-предметов!', true); return; }
  const box = document.createElement('div');
  box.id = 'pvp-item-modal';
  box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
  const names: Record<string, string> = {
    potion: 'Аптечка +20', superPotion: 'Супер +50', hyperPotion: 'Гипер +200',
    maxPotion: 'Макс (фулл)', fullRestore: 'Фулл-рестор (фулл+статус)',
    ether: 'Эфир (+10 PP)', maxEther: 'Макс-эфир (фулл PP)',
  };
  box.innerHTML = `<div style="background:#1c1c2e;border-radius:12px;padding:16px;max-width:320px;width:90%;">
    <div style="font-weight:bold;margin-bottom:10px;text-align:center;">Предмет? (ход сгорит)</div>
    <div id="pvp-item-list"></div>
    <button id="pvp-item-cancel" class="tma-btn w-full" style="margin-top:8px;">Отмена</button>
  </div>`;
  document.body.appendChild(box);
  const list = document.getElementById('pvp-item-list');
  for (const id of usable) {
    const b = document.createElement('button');
    b.className = 'tma-btn w-full';
    b.style.marginTop = '6px';
    b.textContent = `${names[id] || id} ×${inv[id]}`;
    b.onclick = () => { try { box.remove(); } catch { /* ignore */ } usePvpItem(id); };
    list?.appendChild(b);
  }
  (document.getElementById('pvp-item-cancel') as any).onclick = () => { try { box.remove(); } catch { /* ignore */ } };
}

/** Применить предмет в бою: эффект + ход сопернику. */
export function usePvpItem(itemId: string): void {
  const mon = state.pvpMyMon;
  if (!mon || !state.pvpBattleId || !state.pvpMyTurn) return;
  const inv = (state as any).inventory || {};
  if ((state.pvpItemsUsed || 0) >= 3) { showToast('Предметы на этот бой кончились (3)!', true); return; }
  if ((inv[itemId] || 0) <= 0) { showToast('Нет такого предмета!', true); return; }
  // Спящий/замороженный действовать не может.
  if (mon.status === 'slp' || mon.status === 'frz') { showToast('Покемон не может действовать!', true); return; }
  let used = false;
  let label = '';
  if (['potion', 'superPotion', 'hyperPotion', 'maxPotion'].includes(itemId)) {
    if ((mon.currentHp || 0) <= 0 || (mon.currentHp || 0) >= (mon.maxHp || 1)) {
      showToast('HP полное или покемон без сознания!', true);
      return;
    }
    const amount: any = { potion: 20, superPotion: 50, hyperPotion: 200, maxPotion: 'full' }[itemId];
    mon.currentHp = amount === 'full' ? mon.maxHp : Math.min(mon.maxHp, mon.currentHp + amount);
    label = `+${amount === 'full' ? mon.maxHp : amount} HP`;
    used = true;
  } else if (itemId === 'fullRestore') {
    if ((mon.currentHp || 0) <= 0) { showToast('Без сознания — не поможет!', true); return; }
    mon.currentHp = mon.maxHp;
    (mon as any).status = null;
    label = 'полное восстановление';
    used = true;
  } else if (itemId === 'ether' || itemId === 'maxEther') {
    ensurePvpPP(mon);
    const entries = (mon.movesPP || []).map((p: any, i: number) => ({ p, i }))
      .filter((e: any) => e.p && e.p.current < e.p.max);
    if (entries.length === 0) { showToast('PP полные!', true); return; }
    entries.sort((a: any, b: any) => (a.p.current / a.p.max) - (b.p.current / b.p.max));
    const e = entries[0];
    e.p.current = itemId === 'maxEther' ? e.p.max : Math.min(e.p.max, e.p.current + 10);
    label = `PP восстановлены`;
    used = true;
  }
  if (!used) return;
  (state as any).inventory[itemId] = ((state as any).inventory[itemId] || 1) - 1;
  state.pvpItemsUsed = (state.pvpItemsUsed || 0) + 1;
  pvpLog(`Вы: предмет! ${label}`);
  pvpSend({ type: 'item', item: itemId, label });
}

export function doPvPAttack(moveIdx: number): void {
  const mon = state.pvpMyMon;
  if (!mon || !state.pvpBattleId) return;
  ensurePvpPP(mon);
  const lvl = (mon.baseLevel || 1) + (mon.candiesEaten || 0);
  const myT = myTypes();
  const myAb = myAbility();
  const foe: any = state.pvpOppMon || {};
  const foeT: string[] = Array.isArray(foe.types)
    ? foe.types.map((t: any) => (typeof t === 'string' ? t : t?.type?.name)).filter(Boolean)
    : [];
  const foeAb: string | null = foe.ability || null;

  // --- 0. Перезарядка ---
  if (pvpVol.rechargeNeeded) {
    pvpVol.rechargeNeeded = false;
    pvpLog(`Вы: ${mon.nickname || mon.apiData?.name}! Перезарядка…`);
    pvpSend({ type: 'attack', moveName: 'Перезарядка', dmg: 0, crit: false, lvl,
      moveType: 'normal', damageClass: 'physical', recharging: true });
    return;
  }

  // --- Детали приёма ---
  let detailed: any = (state.pvpMovesDetailed || [])[moveIdx] || null;
  if (!detailed) {
    const entry = mon.apiData?.moves?.[moveIdx];
    const nm = entry?.move?.name;
    if (!nm) { showToast('Нет такой атаки', true); return; }
    detailed = { name: nm, power: 60, type: { name: 'normal' }, damage_class: { name: 'physical' }, accuracy: 100, pp: 15, meta: {} };
  }
  let moveName: string = detailed.name || 'Атака';
  let slug = moveSlug(moveName);
  let dcat: string = detailed.damage_class?.name || 'status';
  let isDamaging = dcat === 'physical' || dcat === 'special' || !!detailed.power || isOhkoMove(detailed) || hasFixedDamage(detailed);

  // --- Замок (Outrage и т.п.): только этот приём ---
  if (pvpVol.lockedMove && pvpVol.lockedMove.turnsLeft > 0 && slug !== pvpVol.lockedMove.name) {
    showToast(`Замок: только ${pvpVol.lockedMove.name}!`, true);
    return;
  }
  // --- Таунт: только дамажащие + защита ---
  if (pvpRoundNow() < pvpVol.tauntUntilRound && dcat === 'status' && !PROTECT_MOVES.has(slug) && !(pvpVol.charging && pvpVol.charging === slug)) {
    showToast('Насмешка! Только атакующие приёмы!', true);
    return;
  }
  // --- Encore: только заданный приём ---
  if (pvpVol.encoreMove && pvpRoundNow() < pvpVol.encoreUntilRound && slug !== pvpVol.encoreMove) {
    showToast(`На бис: только ${pvpVol.encoreMove}!`, true);
    return;
  }
  // --- Disable: приём заблокирован ---
  if (pvpVol.disabledMove === slug && pvpRoundNow() < pvpVol.disabledUntilRound) {
    showToast(`${moveName} отключён!`, true);
    return;
  }
  // --- Fake Out: только первым действием ---
  if (slug === 'fake-out' && pvpVol.actedStint) {
    showToast('Fake Out — только первым ходом!', true);
    return;
  }
  // --- Sucker Punch: только если соперник бил дамагом ---
  if (slug === 'sucker-punch' && !pvpFoeVol.lastMoveDamaging) {
    pvpLog(`Вы: ${moveName}! Но противник не атакует — не вышло.`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true,
      moveType: detailed.type?.name, damageClass: detailed.damage_class?.name });
    return;
  }

  // --- PP (борьба если всё пусто) ---
  let struggling = false;
  let ppIdx = (mon.apiData?.moves || []).findIndex((m: any) => moveSlug(m?.move?.name) === slug);
  if (ppIdx < 0) ppIdx = moveIdx;
  const ppEntry = mon.movesPP && mon.movesPP[ppIdx];
  const anyPp = Array.isArray(mon.movesPP) && mon.movesPP.some((p: any) => (p?.current || 0) > 0);
  if (ppEntry && (ppEntry.current || 0) <= 0) {
    if (!anyPp) {
      struggling = true;
      detailed = { name: 'Struggle', power: 50, type: { name: '???' }, damage_class: { name: 'physical' }, accuracy: 100, pp: 999, meta: {} };
      moveName = 'Struggle';
      slug = 'struggle';
      dcat = 'physical';
      isDamaging = true;
    } else {
      showToast('Нет PP! Смени атаку.', true);
      return;
    }
  }

  // --- Остаток хода: яд/погода/ловушки/perish ---
  if (!beginOwnTurn()) return;

  // --- Свой статус: сон/мороз/паралич/путаница ---
  const st = (mon as any).status;
  const sendStalled = (why: string, label: string) => {
    pvpLog(label);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, statusBlocked: why,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
  };
  if (st === 'slp') {
    (mon as any).sleepTurns = Number((mon as any).sleepTurns) || 2;
    (mon as any).sleepTurns -= 1;
    if ((mon as any).sleepTurns > 0) {
      sendStalled('slp', `Вы спите… Zzz`);
      return;
    }
    (mon as any).status = null;
    pvpLog(`Вы проснулись!`);
  } else if (st === 'frz') {
    const thaw = Math.random() < 0.2 || pvpWeatherForCalc(myAbility(), foeAbility()) === 'sun';
    if (!thaw) {
      sendStalled('frz', `Вы заморожены и не можете двигаться!`);
      return;
    }
    (mon as any).status = null;
    pvpLog(`Вы оттаяли!`);
  } else if (st === 'par' && Math.random() < 0.25) {
    sendStalled('par', `Вы парализованы и не можете двигаться!`);
    return;
  }
  if (pvpVol.flinchPending) {
    pvpVol.flinchPending = false;
    pvpLog(`Вы вздрогнули и не смогли ходить!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, flinched: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }
  if (ppEntry && !struggling) ppEntry.current -= 1;
  if (pvpVol.confusedTurns > 0) {
    pvpVol.confusedTurns -= 1;
    if (pvpVol.confusedTurns <= 0) {
      pvpLog(`Вы пришли в себя!`);
    } else if (Math.random() < 0.5) {
      const atkC = { patk: 0, pdef: 0, satk: 0, sdef: 0 };
      try { Object.assign(atkC, battleStatsOf(mon, lvl)); } catch { /* ignore */ }
      const raw = Math.floor(Math.floor(Math.floor(((2 * lvl) / 5 + 2) * 40 * Math.max(1, atkC.patk) / Math.max(1, atkC.pdef)) / 50) + 2);
      const selfDmg = Math.max(1, Math.floor(raw * (0.85 + Math.random() * 0.15)));
      mon.currentHp = Math.max(0, mon.currentHp - selfDmg);
      pvpLog(`Вы: путаница! Ударили себя: −${selfDmg} HP`);
      renderPvpTeams();
      updatePvPUI();
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, confused: true,
        myHp: mon.currentHp, myMaxHp: mon.maxHp,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      if (mon.currentHp <= 0) { sendOwnFaint(); handleMyFaint(); }
      return;
    }
  }

  // --- Зарядка: unleash или старт ---
  if (pvpVol.charging && pvpVol.charging !== slug) {
    showToast(`Завершите ${pvpVol.charging}!`, true);
    return;
  }
  const unleashing = !!(pvpVol.charging && pvpVol.charging === slug);
  if (unleashing) pvpVol.charging = null;
  if (CHARGE_MOVES.has(slug) && !unleashing) {
    pvpVol.charging = slug;
    if (CHARGE_BUFFS[slug]) {
      if (!mon.statStages) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      for (const [s2, d2] of CHARGE_BUFFS[slug]) {
        mon.statStages = statStageModify(mon.statStages, s2 as string, d2 as number);
      }
    }
    pvpLog(`Вы: ${moveName}! ${hideVerb(slug)}`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, charging: { move: slug },
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Танцы-баффы ---
  const dance = detailed?.name ? DANCE_BUFFS[moveSlug(detailed.name)] : undefined;
  if (detailed && dance) {
    if (!mon.statStages) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const [stat, delta] of dance) {
      mon.statStages = statStageModify(mon.statStages, stat as string, delta as number);
    }
    const buffText = dance
      .map(([stat, delta]) => `${STAGE_LABELS[stat] || stat} ${(delta as number) > 0 ? '+' : ''}${delta}`)
      .join(', ');
    pvpLog(`Вы: ${moveName}! ${buffText}`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, dance: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Protect / Detect ---
  if (PROTECT_MOVES.has(slug)) {
    const chance = 1 / Math.pow(2, pvpVol.protectStreak || 0);
    if (Math.random() < chance) {
      pvpVol.protectStreak = (pvpVol.protectStreak || 0) + 1;
      pvpVol.protectActive = true;
      pvpLog(`Вы: ${moveName}! Защита!`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, protect: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    } else {
      pvpVol.protectStreak = 0;
      pvpLog(`Вы: ${moveName}! Не вышло…`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, protectFailed: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    }
    return;
  }

  // --- Substitute ---
  if (slug === 'substitute') {
    if ((mon.currentHp || 0) <= Math.floor((mon.maxHp || 1) / 4)) {
      showToast('Не хватает HP для замены!', true);
      return;
    }
    pvpVol.substituteHp = Math.floor((mon.maxHp || 1) / 4);
    mon.currentHp -= pvpVol.substituteHp;
    pvpLog(`Вы: ${moveName}! Кукла создана (−${pvpVol.substituteHp} HP)!`);
    renderPvpTeams();
    updatePvPUI();
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, substitute: true, myHp: mon.currentHp,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Погода / террейн / экраны / ловушки / очистки / perish / dbond / taunt / encore / disable ---
  const fieldAction = pvpFieldMove(mon, slug, moveName, lvl, detailed);
  if (fieldAction) return;

  // --- Статус-атаки без урона (thunder wave, will-o-wisp, …) ---
  if (!isDamaging) {
    const ail = ailmentToStatus(detailed?.meta?.ailment?.name);
    const isConf = (detailed?.meta?.ailment?.name || '').toLowerCase() === 'confusion' || CONFUSING_MOVES.has(slug);
    if (!ail && !isConf) {
      pvpLog(`Вы: ${moveName}! Но ничего не произошло…`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, noEffect: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      return;
    }
    const acc = checkAccuracy(detailed && Number.isFinite(Number(detailed.accuracy)) ? detailed : { accuracy: 100, name: moveName });
    if (!acc.hit) {
      pvpLog(`Вы: ${moveName}! Промах!`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      return;
    }
    pvpLog(`Вы: ${moveName}!`);
    const chance = Number(detailed?.meta?.ailment_chance);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl,
      ailment: ail || (isConf ? 'confusion' : undefined),
      ailChance: Number.isFinite(chance) ? chance : 100,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Dream Eater: только по спящему ---
  if (DREAM_EATER_LIKE.has(slug) && foeStatus() !== 'slp') {
    pvpLog(`Вы: ${moveName}! Но противник не спит — не сработало.`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, noEffect: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Скрывшийся соперник: проверка дотягиваемости ---
  const foeKind = pvpFoeVol.charging ? (HIDDEN_KINDS[pvpFoeVol.charging] || null) : null;
  if (foeKind && !canHitHidden(slug, foeKind)) {
    pvpLog(`Вы: ${moveName}! Не достаёт спрятавшегося!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, evaded: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Точность ---
  const acc = checkAccuracy(detailed && Number.isFinite(Number(detailed.accuracy)) ? detailed : { accuracy: 100, name: moveName });
  if (!acc.hit) {
    pvpLog(`Вы: ${moveName}! Промах!`);
    if (CRASH_MOVES.has(slug)) {
      const crash = Math.max(1, Math.floor((mon.maxHp || 1) / 2));
      mon.currentHp = Math.max(0, mon.currentHp - crash);
      pvpLog(`Контрудар! Вы: −${crash} HP`);
      renderPvpTeams();
      updatePvPUI();
      if (mon.currentHp <= 0) { renderPvpTeams(); updatePvPUI(); sendOwnFaint(); handleMyFaint(); return; }
    }
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return;
  }

  // --- Честный урон ---
  const opp = state.pvpOppMon || {};
  const oppStats = Array.isArray(opp.stats) ? opp.stats : [];
  const statAt = (i: number) => { const v = Number(oppStats[i]); return Number.isFinite(v) && v > 0 ? v : 50; };
  let dmg = 0;
  let crit = false;
  let mods = '';
  try {
    const res = calculateDamage({
      move: struggling ? { name: 'Struggle', power: 50, type: { name: '???' }, damage_class: { name: 'physical' } } : detailed,
      attacker: mon,
      defender: {
        apiData: {
          types: foeT.map((t: any) => ({ type: { name: t } })),
          stats: [0, 1, 2, 3, 4, 5].map((i) => ({ base_stat: statAt(i) })),
        },
        ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
        statStages: opp.stages || null,
        currentHp: opp.currentHp,
        maxHp: opp.maxHp,
      },
      attackerLevel: lvl,
      defenderLevel: opp.lvl || lvl,
      defenderCurrentHp: opp.currentHp,
      defenderMaxHp: opp.maxHp,
      attackerCurrentHp: mon.currentHp,
      attackerMaxHp: mon.maxHp,
      attackerAbilityName: myAb || undefined,
      defenderAbilityName: foeAb || undefined,
      attackerHeldItem: myHeld() || undefined,
      defenderHeldItem: foeHeld() || undefined,
      weather: pvpWeatherForCalc(myAb, foeAb),
    });
    dmg = res.damage;
    crit = res.isCrit;
    mods = (res.messages || []).map((m: string) => String(m).replace(/[!.]+$/, '').toLowerCase()).join(', ');
  } catch {
    dmg = 1;
  }
  // Экраны соперника режут урон вдвое.
  if (dmg > 0) {
    if ((dcat === 'physical' && screenUp(pvpField.foeScreens, 'reflect'))
      || (dcat === 'special' && screenUp(pvpField.foeScreens, 'light'))) {
      dmg = Math.max(1, Math.floor(dmg / 2));
      mods = mods ? `${mods}, экран` : 'экран';
    }
  }
  // Террейн усиливает.
  if (dmg > 0 && isGrounded(myT, myAb)) {
    const terr = pvpTerrainActive();
    const mt = detailed?.type?.name;
    if ((terr === 'grassy' && mt === 'grass') || (terr === 'electric' && mt === 'electric') || (terr === 'psychic' && mt === 'psychic')) {
      dmg = Math.floor(dmg * 1.3);
    }
  }
  // Facade вдвое по статусу. Payback/Revenge/Avalanche — условия.
  if (slug === 'facade' && mon.status) dmg = dmg * 2;
  if (slug === 'payback' && (pvpFoeVol.lastMoveName || (state as any).pvpFoeActed)) dmg = dmg * 2;
  if ((slug === 'revenge' || slug === 'avalanche') && (state as any).pvpWasHit) dmg = dmg * 2;

  // Отдача / дренирование.
  let recoil = 0;
  const drainPct = Number(detailed?.meta?.drain);
  if (Number.isFinite(drainPct) && drainPct < 0) recoil = Math.floor(dmg * (-(drainPct as number) / 100));
  else if (PVP_RECOIL_MOVES.has(slug)) recoil = Math.floor(dmg / 4);
  if (struggling) recoil = Math.max(1, Math.floor((mon.maxHp || 1) / 4));
  let healed = 0;
  if (Number.isFinite(drainPct) && (drainPct as number) > 0 && dmg > 0 && !DREAM_EATER_LIKE.has(slug)) {
    healed = Math.floor(dmg * ((drainPct as number) / 100));
  }
  if (recoil > 0 && dmg > 0) mon.currentHp = Math.max(0, mon.currentHp - recoil);
  if (healed > 0) mon.currentHp = Math.min(mon.maxHp, mon.currentHp + healed);

  pvpLog(dmg > 0
    ? `Вы: ${moveName}! −${dmg} HP${mods ? ` — ${mods}` : ''}${recoil > 0 ? ` (отдача ${recoil})` : ''}${healed > 0 ? ` (+${healed} HP)` : ''}`
    : `Вы: ${moveName}!${mods ? ` — ${mods}` : ''}`);
  const atkCalc = { patk: 0, pdef: 0, satk: 0, sdef: 0 };
  try { Object.assign(atkCalc, battleStatsOf(mon, lvl)); } catch { /* ignore */ }
  const effSend = getTypeMultiplier(detailed?.type?.name, foeT.length ? foeT : undefined);
  const stabSend = myT.includes(detailed?.type?.name) ? 1.5 : 1;
  const flChance = slug === 'fake-out' ? 100 : (Number(detailed?.meta?.flinch_chance) || 0);
  pvpSend({ type: 'attack', moveName, dmg, crit, lvl,
    atk: atkCalc.patk, power: typeof detailed?.power === 'number' ? detailed.power : 60,
    moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name,
    eff: effSend, stab: stabSend, mods, calc: atkCalc,
    forcedSwitch: FORCED_SWITCH_MOVES.has(slug) || undefined,
    trap: isTrapChipMove(slug) ? { name: slug, turns: 4 } : undefined,
    flinchChance: flChance || undefined,
    ailment: undefined, ailChance: undefined,
  });
  // Замок: тики, в конце — путаница.
  if (pvpVol.lockedMove && pvpVol.lockedMove.name === slug) {
    pvpVol.lockedMove.turnsLeft -= 1;
    if (pvpVol.lockedMove.turnsLeft <= 0) {
      pvpVol.lockedMove = null;
      pvpVol.confusedTurns = 2 + Math.floor(Math.random() * 2);
      pvpLog('Вы запутались от усталости!');
    }
  } else if (LOCK_MOVES.has(slug) && dmg >= 0) {
    pvpVol.lockedMove = { name: slug, turnsLeft: 2 + (Math.random() < 0.5 ? 1 : 0) };
  }
  if (RECHARGE_MOVES.has(slug)) pvpVol.rechargeNeeded = true;
  if (recoil > 0 && (mon.currentHp || 0) <= 0) {
    renderPvpTeams();
    updatePvPUI();
    sendOwnFaint();
    handleMyFaint();
    return;
  }
}

/** Полевые/статусные ходы без урона. Возвращает true если ход выполнен. */
function pvpFieldMove(mon: any, slug: string, moveName: string, lvl: number, detailed: any): boolean {
  const wtype = WEATHER_MOVES[slug];
  if (wtype) {
    pvpField.weather = { type: wtype, untilRound: pvpRoundNow() + 10 };
    pvpLog(`Вы: ${moveName}! Погода: ${wtype}!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, weather: wtype,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  const terr = TERRAIN_MOVES[slug];
  if (terr) {
    pvpField.terrain = { type: terr, untilRound: pvpRoundNow() + 10 };
    pvpLog(`Вы: ${moveName}! Террейн: ${terr}!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, terrain: terr,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  const scr = SCREEN_MOVES[slug];
  if (scr) {
    if (slug === 'aurora-veil' && pvpWeatherForCalc(myAbility(), foeAbility()) !== 'hail') {
      pvpLog(`Вы: ${moveName}! Но нет града — не вышло.`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, noEffect: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      return true;
    }
    pvpField.myScreens[scr] = pvpRoundNow() + 10;
    pvpLog(`Вы: ${moveName}! Стена!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, screens: scr,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  const hz = HAZARD_MOVES[slug];
  if (hz) {
    if (hz === 'rocks') pvpField.myHazards.rocks = true;
    else if (hz === 'spikes') pvpField.myHazards.spikes = Math.min(3, pvpField.myHazards.spikes + 1);
    else if (hz === 'toxic') pvpField.myHazards.toxic = Math.min(2, pvpField.myHazards.toxic + 1);
    else pvpField.myHazards.sticky = true;
    pvpLog(`Вы: ${moveName}! Ловушки!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, hazard: hz,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'defog') {
    pvpField.myHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    pvpField.foeHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    pvpField.myScreens = { light: 0, reflect: 0 };
    pvpField.foeScreens = { light: 0, reflect: 0 };
    pvpLog(`Вы: ${moveName}! Поле очищено!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, clearAll: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'rapid-spin') {
    pvpField.foeHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    if (!mon.statStages) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    mon.statStages = statStageModify(mon.statStages, 'spe', 1);
    pvpLog(`Вы: ${moveName}! Очистился, скорость +1!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, rapidSpin: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'haze') {
    mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    pvpLog(`Вы: ${moveName}! Все стадии сброшены!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, haze: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'perish-song') {
    pvpVol.perishUntilRound = pvpRoundNow() + 6;
    pvpLog(`Вы: ${moveName}! Обратный отсчёт начался!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, perish: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'destiny-bond') {
    pvpVol.dbond = 'destiny';
    pvpLog(`Вы: ${moveName}! Затаили судьбу…`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, dbondSet: 'destiny',
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'grudge') {
    pvpVol.dbond = { grudge: '' };
    pvpLog(`Вы: ${moveName}! Затаили злобу…`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, dbondSet: 'grudge',
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'taunt') {
    pvpLog(`Вы: ${moveName}! Насмешка!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, taunt: true,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'encore') {
    const foeLast = pvpFoeVol.lastMoveName;
    if (!foeLast) {
      pvpLog(`Вы: ${moveName}! Но противник ещё не ходил.`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, noEffect: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      return true;
    }
    pvpLog(`Вы: ${moveName}! На бис: ${foeLast}!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, encore: { move: foeLast },
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  if (slug === 'disable') {
    const foeLast = pvpFoeVol.lastMoveName;
    if (!foeLast) {
      pvpLog(`Вы: ${moveName}! Но противник ещё не ходил.`);
      pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true, noEffect: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
      return true;
    }
    pvpLog(`Вы: ${moveName}! ${foeLast} отключён!`);
    pvpSend({ type: 'attack', moveName, dmg: 0, crit: false, lvl, disabled: { move: foeLast },
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name });
    return true;
  }
  return false;
}

/**
 * applyIncomingPvpAction — разобрать ход соперника.
 * Держит обе стороны синхронными: раунд тикает на каждое волевое действие,
 * поле/ловушки/статусы применяются зеркально.
 */
export function applyIncomingPvpAction(action: any): void {
  if (!action || typeof action !== 'object' || !state.pvpBattleId) return;
  const mon = state.pvpMyMon;
  const foeName = (state as any).pvpOpponentName || 'Соперник';

  // Мои входящие HP/статус: обновить трекинг оппонента (меня для него).
  if (action.type === 'hp_update') return; // обрабатывается в socket.ts

  if (action.type === 'mon_data') return; // обрабатывается в socket.ts

  // --- Предмет соперника: просто ход ---
  if (action.type === 'item') {
    pvpFoeVol.lastMoveName = null;
    pvpFoeVol.lastMoveDamaging = false;
    (state as any).pvpFoeActed = true;
    const logs: string[] = [];
    pvpAdvanceRound(logs);
    for (const l of logs) pvpLog(l);
    pvpLog(`${foeName}: предмет (${(action as any).label || (action as any).item || '???'})!`);
    state.pvpMyTurn = true;
    renderPvpTeams();
    updatePvPUI();
    return;
  }

  // --- Destiny Bond / Grudge по мне ---
  if (action.type === 'dbond') {
    const logs: string[] = [];
    pvpAdvanceRound(logs);
    for (const l of logs) pvpLog(l);
    if ((action as any).kind === 'grudge') {
      const last = pvpVol.lastMoveName;
      if (last && mon && Array.isArray((mon as any).movesPP)) {
        const idx = ((mon as any).apiData?.moves || []).findIndex((m: any) => moveSlug(m?.move?.name) === last);
        if (idx >= 0 && (mon as any).movesPP[idx]) {
          (mon as any).movesPP[idx].current = 0;
          pvpLog(`Злоба! Ваш ${last} лишился PP!`);
        }
      } else {
        pvpLog(`Злоба соперника не сработала.`);
      }
      state.pvpMyTurn = true;
      updatePvPUI();
      return;
    }
    // destiny: мой активный падает
    if (mon && (mon.currentHp || 0) > 0) {
      mon.currentHp = 0;
      pvpLog(`Судьбоносная связь! ${mon.nickname || mon.apiData?.name} падает!`);
      renderPvpTeams();
      updatePvPUI();
      sendOwnFaint();
      handleMyFaint();
    } else {
      state.pvpMyTurn = true;
      updatePvPUI();
    }
    return;
  }

  // --- Смена соперника: просто ход ---
  if (action.type === 'switch') {
    pvpFoeVol.lastMoveName = null;
    pvpFoeVol.lastMoveDamaging = false;
    pvpFoeVol.charging = null;
    (state as any).pvpFoeActed = true;
    const logs: string[] = [];
    pvpAdvanceRound(logs);
    for (const l of logs) pvpLog(l);
    pvpLog(`${foeName}: замена покемона!`);
    state.pvpMyTurn = true;
    updatePvPUI();
    return;
  }

  if (action.type !== 'attack') return;
  const a = action as any;
  const moveName: string = a.moveName || 'Атака';
  const slug = moveSlug(moveName);
  const logs: string[] = [];
  pvpAdvanceRound(logs);
  for (const l of logs) pvpLog(l);
  // Трекинг последнего хода (sucker punch / encore / disable).
  pvpFoeVol.lastMoveName = slug;
  pvpFoeVol.lastMoveDamaging = (a.damageClass === 'physical' || a.damageClass === 'special');
  pvpFoeVol.charging = null;
  if (a.charging && a.charging.move) pvpFoeVol.charging = a.charging.move;
  (state as any).pvpFoeActed = true;
  if (!mon) { state.pvpMyTurn = true; updatePvPUI(); return; }
  const myT = myTypes();
  const myAb = myAbility();

  const replyHpUnchanged = () => {
    if (state.socket && state.pvpBattleId && state.pvpMyMon) {
      state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: {
        type: 'hp_update', hp: state.pvpMyMon.currentHp, maxHp: state.pvpMyMon.maxHp || 1,
        stages: { ...(state.pvpMyMon.statStages || {}) }, status: (state.pvpMyMon as any).status || null,
      } });
    }
  };
  const passTurn = () => { state.pvpMyTurn = true; renderPvpTeams(); updatePvPUI(); };

  // --- Служебные флаги без урона ---
  if (a.confused) {
    pvpLog(`${foeName}: ${moveName}! Ударил себя в путанице!`);
    passTurn();
    return;
  }
  if (a.recharging) {
    pvpLog(`${foeName}: ${moveName}! Перезаряжается…`);
    passTurn();
    return;
  }
  if (a.missed) {
    if (a.statusBlocked === 'slp') pvpLog(`${foeName}: спит… Zzz`);
    else if (a.statusBlocked === 'frz') pvpLog(`${foeName}: заморожен!`);
    else if (a.statusBlocked === 'par') pvpLog(`${foeName}: парализован!`);
    else if (a.flinched) pvpLog(`${foeName}: вздрогнул!`);
    else if (a.protectFailed) pvpLog(`${foeName}: ${moveName}! Не вышло…`);
    else if (a.evaded) pvpLog(`${foeName}: ${moveName}! Мимо — цель скрылась!`);
    else if (a.noEffect) pvpLog(`${foeName}: ${moveName}! Но ничего не произошло…`);
    else pvpLog(`${foeName}: ${moveName}! — промах`);
    passTurn();
    return;
  }
  if (a.protect) {
    pvpLog(`${foeName}: ${moveName}! Защита!`);
    passTurn();
    return;
  }
  if (a.substitute) {
    pvpLog(`${foeName}: ${moveName}! Кукла-замена!`);
    if (typeof a.myHp === 'number' && state.pvpOppMon) {
      (state.pvpOppMon as any).currentHp = a.myHp;
      renderPvpTeams();
    }
    passTurn();
    return;
  }
  if (a.charging) {
    pvpLog(`${foeName}: ${moveName}! ${hideVerb(slug)}`);
    passTurn();
    return;
  }
  if (a.dance) {
    pvpLog(`${foeName}: ${moveName}! Усиливается!`);
    passTurn();
    return;
  }
  if (a.weather) {
    pvpField.weather = { type: a.weather, untilRound: pvpRoundNow() + 10 };
    pvpLog(`${foeName}: ${moveName}! Погода: ${a.weather}!`);
    passTurn();
    return;
  }
  if (a.terrain) {
    pvpField.terrain = { type: a.terrain, untilRound: pvpRoundNow() + 10 };
    pvpLog(`${foeName}: ${moveName}! Террейн: ${a.terrain}!`);
    passTurn();
    return;
  }
  if (a.screens) {
    if (a.screens === 'light') pvpField.foeScreens.light = pvpRoundNow() + 10;
    else pvpField.foeScreens.reflect = pvpRoundNow() + 10;
    pvpLog(`${foeName}: ${moveName}! Стена!`);
    passTurn();
    return;
  }
  if (a.hazard) {
    if (a.hazard === 'rocks') pvpField.foeHazards.rocks = true;
    else if (a.hazard === 'spikes') pvpField.foeHazards.spikes = Math.min(3, pvpField.foeHazards.spikes + 1);
    else if (a.hazard === 'toxic') pvpField.foeHazards.toxic = Math.min(2, pvpField.foeHazards.toxic + 1);
    else pvpField.foeHazards.sticky = true;
    pvpLog(`${foeName}: ${moveName}! Ловушки на нашей стороне!`);
    passTurn();
    return;
  }
  if (a.clearAll) {
    pvpField.myHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    pvpField.foeHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    pvpField.myScreens = { light: 0, reflect: 0 };
    pvpField.foeScreens = { light: 0, reflect: 0 };
    pvpLog(`${foeName}: ${moveName}! Поле очищено!`);
    passTurn();
    return;
  }
  if (a.rapidSpin) {
    pvpField.myHazards = { rocks: false, spikes: 0, toxic: 0, sticky: false };
    pvpLog(`${foeName}: ${moveName}! Очистился!`);
    passTurn();
    return;
  }
  if (a.haze) {
    mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    pvpLog(`${foeName}: ${moveName}! Стадии сброшены!`);
    replyHpUnchanged();
    passTurn();
    return;
  }
  if (a.perish) {
    pvpVol.perishUntilRound = pvpRoundNow() + 6;
    pvpLog(`${foeName}: ${moveName}! Обратный отсчёт начался!`);
    passTurn();
    return;
  }
  if (a.dbondSet) {
    pvpLog(`${foeName}: ${moveName}! ${a.dbondSet === 'destiny' ? 'Затаил судьбу…' : 'Затаил злобу…'}`);
    passTurn();
    return;
  }
  if (a.taunt) {
    pvpVol.tauntUntilRound = pvpRoundNow() + 6;
    pvpLog(`${foeName}: ${moveName}! Насмешка! Только атаки!`);
    passTurn();
    return;
  }
  if (a.encore && a.encore.move) {
    pvpVol.encoreMove = a.encore.move;
    pvpVol.encoreUntilRound = pvpRoundNow() + 6;
    pvpLog(`${foeName}: ${moveName}! На бис: ${a.encore.move}!`);
    passTurn();
    return;
  }
  if (a.disabled && a.disabled.move) {
    pvpVol.disabledMove = a.disabled.move;
    pvpVol.disabledUntilRound = pvpRoundNow() + 8;
    pvpLog(`${foeName}: ${moveName}! ${a.disabled.move} отключён!`);
    passTurn();
    return;
  }

  // --- Моя защита: блокирует дамаг и статусы ---
  if (pvpVol.protectActive && !PIERCE_PROTECT.has(slug)) {
    pvpVol.protectActive = false;
    pvpLog(`Вы защитились от ${moveName}!`);
    replyHpUnchanged();
    passTurn();
    return;
  }
  // --- Мой Substitute: поглощает дамаг, блокирует статусы ---
  const subUp = pvpVol.substituteHp > 0;
  const ailIn = a.ailment || null;
  if (subUp && !PIERCE_PROTECT.has(slug) && !PVP_SOUND.has(slug)) {
    if (ailIn) {
      pvpLog(`Заменитель принял ${moveName} на себя!`);
      replyHpUnchanged();
      passTurn();
      return;
    }
    const dmgIn = Math.max(0, Number(a.dmg) || 0);
    if (dmgIn > 0) {
      const absorbed = Math.min(pvpVol.substituteHp, dmgIn);
      pvpVol.substituteHp -= absorbed;
      if (pvpVol.substituteHp <= 0) {
        pvpVol.substituteHp = 0;
        pvpLog(`Заменитель разрушен! (поглощено ${absorbed})`);
      } else {
        pvpLog(`Заменитель принял удар! (−${absorbed})`);
      }
      replyHpUnchanged();
      passTurn();
      return;
    }
  }
  // --- Моё укрытие (зарядка): проверка дотягиваемости ---
  if (pvpVol.charging) {
    const kind = HIDDEN_KINDS[pvpVol.charging] || null;
    if (kind && !canHitHidden(slug, kind)) {
      pvpLog(`Вы скрылись от ${moveName}!`);
      replyHpUnchanged();
      passTurn();
      return;
    }
  }

  // --- Статус по мне ---
  if (ailIn && !(mon as any).status) {
    const ailName: string = ailIn === 'confusion' ? 'confusion' : ailIn;
    let immune = false;
    let why = '';
    if (ailIn !== 'confusion') {
      const mapped = ailIn === 'tox' ? 'poison' : ailIn === 'psn' ? 'poison' : ailIn === 'brn' ? 'burn' : ailIn === 'par' ? 'paralysis' : ailIn === 'slp' ? 'sleep' : 'freeze';
      if (isStatusImmune(mapped, { types: myTypes(), abilityName: myAb })) { immune = true; why = 'иммунитет'; }
      if (!immune && pvpTerrainActive() === 'misty' && isGrounded(myT, myAb)) { immune = true; why = 'туманный террейн'; }
      if (!immune && ailIn === 'slp' && pvpTerrainActive() === 'electric' && isGrounded(myT, myAb)) { immune = true; why = 'электро-террейн'; }
    } else {
      if (normAbil(myAbility()) === 'owntempo') { immune = true; why = 'Own Tempo'; }
    }
    const chance = Number(a.ailChance);
    const roll = Number.isFinite(chance) ? chance : 100;
    if (!immune && Math.random() * 100 < roll) {
      if (ailIn === 'confusion') {
        pvpVol.confusedTurns = 2 + Math.floor(Math.random() * 3);
        pvpLog(`Вы запутались!`);
      } else {
        (mon as any).status = ailIn;
        if (ailIn === 'slp') (mon as any).sleepTurns = 1 + Math.floor(Math.random() * 3);
        if (ailIn === 'tox') (mon as any).toxCounter = 1;
        const label = STATUS_NAMES[ailIn] || ailIn;
        pvpLog(`Вы: ${label}! (от ${moveName})`);
      }
      renderPvpTeams();
      updatePvPUI();
    } else if (immune) {
      pvpLog(`Вы: ${moveName}! Не действует (${why}).`);
    }
  }

  // --- Вздрагивание ---
  const flChance = slug === 'fake-out' ? 100 : (Number(a.flinchChance) || 0);
  if (flChance > 0 && (mon.currentHp || 0) > 0 && Math.random() * 100 < flChance) {
    pvpVol.flinchPending = true;
    pvpLog(`Вы вздрогнули!`);
  }

  // --- Ловушка на мне ---
  if (a.trap && a.trap.name && (mon.currentHp || 0) > 0) {
    pvpVol.trapName = a.trap.name;
    pvpVol.trapUntilRound = pvpRoundNow() + 8;
    pvpLog(`Вы попались: ${trapName(mon)}!`);
  }

  // --- Урон по мне ---
  const dmg: number = Math.max(0, Math.floor(Number(a.dmg) || 0));
  let mods: string = typeof a.mods === 'string' ? a.mods : '';
  if (!mods && a.moveType) {
    try {
      const myT2 = (state.pvpMyMon?.apiData?.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
      const eff = getTypeMultiplier(a.moveType, myT2);
      const parts: string[] = [];
      if (a.crit) parts.push('критический удар');
      if (eff > 1) parts.push('суперэффективно');
      else if (eff > 0 && eff < 1) parts.push('малоэффективно');
      else if (eff === 0) parts.push('атака не возымела эффекта');
      mods = parts.join(', ');
    } catch { /* ignore */ }
  }
  pvpLog(dmg > 0
    ? `${foeName}: ${moveName}! −${dmg} HP${mods ? ` — ${mods}` : ''}`
    : `${foeName}: ${moveName}!${mods ? ` — ${mods}` : ''}`);
  if (dmg > 0) {
    mon.currentHp = Math.max(0, (mon.currentHp || 0) - dmg);
    (state as any).pvpWasHit = true;
  }
  // Сброс принудительной сменой.
  let forced = !!a.forcedSwitch && (mon.currentHp || 0) > 0;
  if (forced) {
    const others = (state.myTeam || []).filter((m: any) => m && (m.currentHp || 0) > 0
      && (!state.pvpMyMon || m.uid !== state.pvpMyMon.uid));
    if (others.length === 0) forced = false;
    else {
      const pick = others[Math.floor(Math.random() * others.length)];
      pvpLog(`Вынужденная замена: ${pick.nickname || pick.apiData?.name}!`);
      const carryStages = { ...(mon.statStages || {}) };
      mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      state.pvpMyMon = pick;
      if (pick.statStages == null) pick.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      resetSwitchVolatile(null);
      trackPvpParticipant(pick);
      sendMyMonData(state.pvpBattleId);
      if (!applyEntryHazards(pick)) return;
    }
  }
  const fainted = (mon.currentHp || 0) <= 0 && !forced;
  const faintedAfterForce = (state.pvpMyMon.currentHp || 0) <= 0;
  renderPvpTeams();
  updatePvPUI();
  if (state.socket && state.pvpBattleId) {
    state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: {
      type: 'hp_update', hp: state.pvpMyMon.currentHp, maxHp: state.pvpMyMon.maxHp || 1,
      fainted: faintedAfterForce,
      stages: { ...(state.pvpMyMon.statStages || {}) },
      status: (state.pvpMyMon as any).status || null,
    } });
    if (faintedAfterForce) {
      state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: { type: 'fainted' } });
    }
  }
  // Grudge получателя: если у МЕНЯ активен grudge и я упал — шлём dbond.
  if (faintedAfterForce && pvpVol.dbond && typeof pvpVol.dbond === 'object' && (pvpVol.dbond as any).grudge !== undefined) {
    if (state.socket && state.pvpBattleId) {
      state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: { type: 'dbond', kind: 'grudge' } });
    }
  }
  // Destiny получателя: если у меня активен destiny и я упал — забираю его.
  if (faintedAfterForce && pvpVol.dbond === 'destiny') {
    if (state.socket && state.pvpBattleId) {
      state.socket.emit('pvp_action', { battleId: state.pvpBattleId, action: { type: 'dbond', kind: 'destiny' } });
    }
  }
  // Волатильность НЕ сбрасываем: protect/charging/taunt/encore/perish/dbond
  // живут до своего срабатывания или моей смены/нокаута.
  if (faintedAfterForce) { handleMyFaint(); return; }
  state.pvpMyTurn = true;
  renderPvpTeams();
  updatePvPUI();
}


/**
 * endPvP — завершить PvP-бой (победа/поражение).
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Показывает toast с результатом (победа/поражение)
 *   2. При победе: +500 кредитов
 *   3. Закрывает модалку (с паузой на нокаут — мгновенное гашение читалось как кик)
 *   4. Отправляет результат на сервер
 *   5. Сбрасывает state.pvpBattleId
 *   6. Откладывает автосейв до сеттл-подтверждения (deferSettleSave):
 *      мгновенный сейв слал протухшую версию и получал 409 с тостом
 *      «более новая версия» ровно в конце боя.
 *
 * Двойной вызов (hp_update{fainted} + следом fainted) шлёт pvp_end ОДИН раз:
 * сервер идемпотентен, но второй тост/таймер — мусор в UI.
 * ГДЕ ВЫЗЫВАЕТСЯ: из обработчика socket → 'pvp_result'
 */
export function endPvP(won, announce = true) {
  // Дубль (hp_update{fainted} + следом fainted): второй вызов — молча, иначе
  // двоятся тост победы и лишние таймеры. Сервер и так идемпотентен.
  if (announce && state.pvpEndSent) return;
  if (announce) state.pvpEndSent = true;
  showToast(won ? '🏆 Победа в PvP!' : '💀 Поражение в PvP...', !won);
  if (won) checkAchievement('pvp_win');
  resetPvpVol();
  resetPvpFoeVol();
  // Награда теперь выдается сервером (слушаем pvp_reward)
  // Модалку гасим с паузой: мгновенное закрытие в момент нокаута читалось
  // как «кик из боя». Бой уже учтён (pvpBattleId сброшен ниже), тапы harmless.
  const modal = document.getElementById('pvp-modal');
  setTimeout(() => { try { if (modal) modal.style.display = 'none'; } catch { /* ignore */ } }, 1200);
  // announce=false — бой уже закрыт сервером (AFK-таймаут/монета): pvp_end не шлём,
  // иначе будет двойное начисление и лишний цикл. Сеттл ТАМ теперь полный
  // (награда+версия), поэтому сейв — тоже только после подтверждения.
  if (announce) {
    state.socket.emit('pvp_end', { battleId: state.pvpBattleId, action: { type: won ? 'win' : 'lose' } });
    state.pvpBattleId = null;
    clearPvpReplaceWait();
    deferSettleSave();
  } else {
    state.pvpBattleId = null;
    clearPvpReplaceWait();
    deferSettleSave();
  }
  // Стадии боя не утекают в сейв: восстанавливаем стартовые (иначе +6 атаки
  // после каждого танца навсегда).
  try {
    if (state.pvpMyMon && state.pvpStageBackup) {
      state.pvpMyMon.statStages = { ...(state.pvpStageBackup || {}) };
    }
  } catch { /* ignore */ }
  state.pvpStageBackup = null;
  (state as any).pvpStageBackupUid = null;
}
