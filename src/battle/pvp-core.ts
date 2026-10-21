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
  // Сервер пересылает это второму игроку
  const mon = state.pvpMyMon;
  state.socket.emit('pvp_action', { battleId, action: {
    type: 'mon_data',
    name: mon.nickname || mon.apiData?.name,
    lvl: mon.baseLevel + (mon.candiesEaten || 0),
    hp: mon.currentHp,
    maxHp: mon.maxHp,
    sprite: getSpriteUrl(mon)
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

  // Создаём кнопки для каждой атаки
  topMoves.forEach((m, i) => {
    // Асинхронная загрузка деталей атаки с сайта лиги (для определения типа)
    fetchSiteMoveDetail(m).then(d => {
      if (seq !== pvpRenderSeq) return; // рендер уже протух
      state.pvpMovesDetailed[i] = d;
      const btns = movesDiv.querySelectorAll('.reborn-move-link');
      if (btns[i]) {
        btns[i].classList.remove('move-type-physical', 'move-type-special', 'move-type-status');
        if (d.damage_class?.name) btns[i].classList.add(`move-type-${d.damage_class.name}`);
      }
    }).catch(() => {});

    const btn = document.createElement('span');
    btn.className = 'reborn-move-link';
    btn.textContent = m.name;
    btn.style.opacity = state.pvpMyTurn ? '1' : '0.5'; // Затемняем если не мой ход
    btn.onclick = () => {
      if (!state.pvpMyTurn) { showToast('Сейчас ход соперника!', true); return; }
      doPvPAttack(i);
    };
    movesDiv.appendChild(btn);
  });
}

/**
 * doPvPAttack — выполнить PvP-атаку.
 *
 * УПРОЩЁННАЯ ФОРМУЛА (не использует calculateDamage):
 *   rawDmg = ((lvl * power * (atk / 100)) / 15) * random(0.85-1.15)
 *   crit = 6.25% × 1.5
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Вычисляет урон по упрощённой формуле
 *   2. Добавляет запись в лог
 *   3. Переключает state.pvpMyTurn = false
 *   4. Отправляет данные атаки на сервер через socket
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из кнопок атак в updatePvPUI()
 */
export function doPvPAttack(moveIdx) {
  if (!state.pvpMyMon || !state.pvpBattleId) return;
  const detailed = state.pvpMovesDetailed[moveIdx];
  const moveName = detailed?.name || 'Атака';
  const lvl = state.pvpMyMon.baseLevel + (state.pvpMyMon.candiesEaten || 0);
  const atk = (state.pvpMyMon.apiData?.stats?.[1]?.base_stat || 60); // Base Attack
  const power = detailed?.power || 60;
  // Упрощённая формула урона (без учёта STAB, типов, защит и т.д.)
  const rawDmg = Math.floor(((lvl * power * (atk / 100)) / 15) * (0.85 + Math.random() * 0.3));
  const crit = Math.random() < 0.0625; // 1/16 шанс крита
  const dmg = crit ? Math.floor(rawDmg * 1.5) : rawDmg;

  const logEl = document.getElementById('pvp-log');
  logEl.innerHTML = `Вы: ${moveName}! ${crit ? '💥Крит! ' : ''}(-${dmg})\n${logEl.innerHTML}`;

  state.pvpMyTurn = false; // Передаём ход оппоненту
  // Отправляем данные атаки + статы для server-authoritative валидации
  state.socket.emit('pvp_action', {
    battleId: state.pvpBattleId,
    action: { type: 'attack', moveName, dmg, crit, lvl, atk, power },
  });
  updatePvPUI();
}

/**
 * endPvP — завершить PvP-бой.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Показывает toast с результатом (победа/поражение)
 *   2. При победе: +500 кредитов
 *   3. Закрывает модалку
 *   4. Отправляет результат на сервер
 *   5. Сбрасывает state.pvpBattleId
 *   6. Откладывает автосейв до сеттл-подтверждения (deferSettleSave):
 *      мгновенный сейв слал протухшую версию и получал 409 с тостом
 *      «более новая версия» ровно в конце боя.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из обработчика socket → 'pvp_result'
 */
export function endPvP(won, announce = true) {
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
}
