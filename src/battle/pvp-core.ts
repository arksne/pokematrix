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
import { calculateDamage, checkAccuracy, getTypeMultiplier, statStageModify } from './logic.js';
import { calculateStat } from './stats.js';

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
  state.pvpBattleId = battleId;
  state.pvpOpponentName = opponent;
  state.pvpMyTurn = myFirst;
  state.pvpMyMon = alive;
  state.pvpEndSent = false; // новый бой — pvp_end ещё не слали

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
        <div class="reborn-pokemon-row">
          <div class="reborn-side-panel">
            <div class="reborn-poke-header"><span id="pvp-my-name"></span> <span id="pvp-my-lvl"></span></div>
            <div class="reborn-hp-bar"><div class="reborn-hp-fill" id="pvp-my-hp-fill"></div></div>
            <div class="reborn-hp-text" id="pvp-my-hp"></div>
            <div class="reborn-sprite-box"><img class="reborn-sprite" id="pvp-my-sprite" src=""></div>
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
      </div>
    `;
    document.body.appendChild(modal);
    // Обработчик кнопки "Сдаться"
    document.getElementById('btn-pvp-leave').addEventListener('click', () => {
      modal.style.display = 'none';
      state.socket.emit('pvp_end', { battleId: state.pvpBattleId, action: { type: 'surrender' } });
      state.pvpBattleId = null;
      state.pvpEndSent = true;
      // Сеттл поднимет версию (победителю — награда, мне на арене — утешительные):
      // сейв только после подтверждения, иначе 409 + тост (см. deferSettleSave).
      deferSettleSave();
      updateMoneyDisplay();
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
  state.pvpStageBackup = JSON.parse(JSON.stringify(mon.statStages || {}));
  const myTypes = (mon.apiData?.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
  state.socket.emit('pvp_action', { battleId, action: {
    type: 'mon_data',
    name: mon.nickname || mon.apiData?.name,
    lvl: myLvl,
    hp: mon.currentHp,
    maxHp: mon.maxHp,
    sprite: getSpriteUrl(mon),
    types: myTypes,
    stats: baseStatsOf(mon),
    calc: battleStatsOf(mon, myLvl),
    stages: { ...(mon.statStages || {}) },
  }});
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
  document.getElementById('pvp-turn-indicator').textContent = state.pvpMyTurn ? '🎯 Ваш ход!' : '⏳ Ожидание хода соперника...';
  document.getElementById('pvp-turn-indicator').style.color = state.pvpMyTurn ? '#34c759' : '#ff9500';

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

/**
 * doPvPAttack — выполнить PvP-атаку.
 *
 * ПОЛНАЯ формула дикого боя (calculateDamage): STAB ×1.5, эффективность по
 * типам оппонента, физ/спец разделение по настоящим статам, точность
 * (промахи), фикс-урон (Seismic Toss...), OHKO, криты. Статус-танцы из
 * DANCE_BUFFS баффают стадии вместо урона.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Точность (промах — ход переходит, урона нет)
 *   2. Танцы — стадии, остальное — calculateDamage
 *   3. Богатая запись в лог (как в диком бою)
 *   4. Переключает state.pvpMyTurn = false
 *   5. Отправляет данные атаки на сервер через socket
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из кнопок атак в updatePvPUI()
 */
export function doPvPAttack(moveIdx) {
  if (!state.pvpMyMon || !state.pvpBattleId) return;
  const detailed = state.pvpMovesDetailed[moveIdx];
  const moveName = detailed?.name || 'Атака';
  const mon = state.pvpMyMon;
  const lvl = mon.baseLevel + (mon.candiesEaten || 0);
  const logEl = document.getElementById('pvp-log');
  const opp = state.pvpOppMon || {};

  // ── Статус-танцы: бафф стадий вместо урона ──
  const dance = detailed?.name ? DANCE_BUFFS[moveSlug(detailed.name)] : undefined;
  if (detailed && dance) {
    if (!mon.statStages) mon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const [stat, delta] of dance) {
      mon.statStages = statStageModify(mon.statStages, stat, delta as number);
    }
    const buffText = dance
      .map(([stat, delta]) => `${STAGE_LABELS[stat] || stat} ${delta > 0 ? '+' : ''}${delta}`)
      .join(', ');
    logEl.innerHTML = `Вы: ${moveName}! ${buffText}\n${logEl.innerHTML}`;
    state.pvpMyTurn = false;
    state.socket.emit('pvp_action', {
      battleId: state.pvpBattleId,
      action: {
        type: 'attack', moveName, dmg: 0, crit: false, lvl, dance: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name,
      },
    });
    updatePvPUI();
    return;
  }

  // ── Точность (как в диком бою) ──
  const acc = checkAccuracy(detailed || { accuracy: 100, name: moveName });
  if (!acc.hit) {
    logEl.innerHTML = `Вы: ${moveName}! — промах\n${logEl.innerHTML}`;
    state.pvpMyTurn = false;
    state.socket.emit('pvp_action', {
      battleId: state.pvpBattleId,
      action: {
        type: 'attack', moveName, dmg: 0, crit: false, lvl, missed: true,
        moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name,
      },
    });
    updatePvPUI();
    return;
  }

  // ── Честный урон: та же формула, что в диком бою ──
  const oppTypes = Array.isArray(opp.types) ? opp.types : [];
  const myTypes = (mon.apiData?.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
  const oppStats = Array.isArray(opp.stats) ? opp.stats : [];
  const statAt = (i: number) => {
    const v = Number(oppStats[i]);
    return Number.isFinite(v) && v > 0 ? v : 50;
  };
  const eff = getTypeMultiplier(detailed?.type?.name, oppTypes.length ? oppTypes : undefined);
  const stab = myTypes.includes(detailed?.type?.name) ? 1.5 : 1;
  let dmg = 0;
  let crit = false;
  let mods = '';
  try {
    const res = calculateDamage({
      move: detailed || { name: moveName, power: 60, type: { name: 'normal' }, damage_class: { name: 'physical' } },
      attacker: mon,
      defender: {
        apiData: {
          types: oppTypes.map((t: any) => ({ type: { name: typeof t === 'string' ? t : t?.type?.name } })),
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
    });
    dmg = res.damage;
    crit = res.isCrit;
    mods = (res.messages || []).map((m: string) => String(m).replace(/[!.]+$/, '').toLowerCase()).join(', ');
  } catch {
    // Фолбэк, если калькулятор упал: минимальный чип-урон, бой не висит.
    dmg = 1;
  }

  logEl.innerHTML = dmg > 0
    ? `Вы: ${moveName}! −${dmg} HP${mods ? ` — ${mods}` : ''}\n${logEl.innerHTML}`
    : `Вы: ${moveName}!${mods ? ` — ${mods}` : ''}\n${logEl.innerHTML}`;

  state.pvpMyTurn = false; // Передаём ход оппоненту
  // Отправляем данные атаки + статы для server-authoritative валидации.
  // eff/stab/missed — для богатого лога оппонента и серверного кэпа.
  const atkCalc = { patk: 0, pdef: 0, satk: 0, sdef: 0 };
  try { Object.assign(atkCalc, battleStatsOf(mon, lvl)); } catch { /* ignore */ }
  state.socket.emit('pvp_action', {
    battleId: state.pvpBattleId,
    action: {
      type: 'attack', moveName, dmg, crit, lvl,
      atk: atkCalc.patk, power: detailed?.power ?? 60,
      moveType: detailed?.type?.name, damageClass: detailed?.damage_class?.name,
      eff, stab, mods, calc: atkCalc,
    },
  });
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
  // Награда теперь выдается сервером (слушаем pvp_reward)
  // Модалку гасим с паузой: мгновенное закрытие в момент нокаута читалось
  // как «кик из боя». Бой уже учтён (pvpBattleId сброшен ниже), тапы harmless.
  const modal = document.getElementById('pvp-modal');
  setTimeout(() => { try { if (modal) modal.style.display = 'none'; } catch { /* ignore */ } }, 1200);
  // announce=false — бой уже закрыт сервером (AFK-таймаут): pvp_end не шлём,
  // иначе будет двойное начисление и лишний цикл. Сеттла с подъёмом версии
  // там тоже нет (только рейтинг) — сейв безопасен сразу.
  if (announce) {
    state.socket.emit('pvp_end', { battleId: state.pvpBattleId, action: { type: won ? 'win' : 'lose' } });
    state.pvpBattleId = null;
    deferSettleSave();
  } else {
    state.pvpBattleId = null;
    autoSave();
  }
  // Стадии боя не утекают в сейв: восстанавливаем стартовые (иначе +6 атаки
  // после каждого танца навсегда).
  try {
    if (state.pvpMyMon && state.pvpStageBackup) {
      state.pvpMyMon.statStages = { ...(state.pvpStageBackup || {}) };
    }
  } catch { /* ignore */ }
  state.pvpStageBackup = null;
}
