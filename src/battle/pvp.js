// ─────────────────────────────────────────────────────────────
// pvp.js — PVP СИСТЕМА (КЛИЕНТ)
// ─────────────────────────────────────────────────────────────
// Отвечает за весь PvP-флоу на клиенте: очередь, матчинг, арена, ходы.
// Взаимодействует с сервером через Socket.IO.
//
// АРХИТЕКТУРА:
//   pvp.js (этот файл)       — управление очередью, UI, события Socket.IO
//   pvp-core.ts              — UI арены, атаки, расчёт урона (старая версия)
//   socket.ts (src/network)  — настройка Socket.IO соединения
//
// ПОТОК PVP:
//   1. showPvpPanel() → панель с рейтингом
//   2. joinPvpQueue() → отправка 'pvp:join_queue' на сервер
//   3. Сервер ищет оппонента → 'pvp:matched'
//   4. showPvpMatchModal() → "Соперник найден!"
//   5. openPvpBattleArena() → арена с кнопками атак
//   6. submitPvpMove() → отправка хода на сервер
//   7. Сервер обрабатывает → 'pvp:turn_result'
//   8. handlePvpTurnResult() → обновление HP, лога
//   9. 'pvp:battle_end' → конец боя
//
// СОСТОЯНИЕ (локальные переменные модуля):
//   pvpSocket — ссылка на Socket.IO клиент
//   pvpBattleId — ID текущего боя
//   pvpOpponent — данные оппонента
//   pvpMyTurn — true если мой ход
//   isInPvpQueue — true если в очереди
//   pvpMonData — данные моего покемона
//
// ЗАВИСИМОСТИ:
//   config.js — API_BASE (URL сервера)
//   state.js — глобальное состояние (state.socket)
//   save.js — getCloudAuthHeaders (для запросов рейтинга)
//   dom.js — showToast (уведомления)
// ─────────────────────────────────────────────────────────────

import { API_BASE } from '../game/config.js';
import { state } from '../game/state.js';
import { getCloudAuthHeaders } from '../game/save.js';
import { showToast } from '../utils/dom.js';
function getSocket() { return state.socket; }

// ═══ ЛОКАЛЬНОЕ СОСТОЯНИЕ PVP ═══
let pvpSocket = null;          // Ссылка на Socket.IO клиент (отдельная от state.socket)
let pvpBattleId = null;        // ID текущего PvP боя (устанавливается при match)
let pvpOpponent = null;        // Данные оппонента { username, rating, ... }
let pvpMyTurn = false;         // Флаг: мой ход сейчас?
let isInPvpQueue = false;      // Флаг: в поиске соперника?
let pvpMonData = null;         // Данные моего покемона для отправки хода
let queueStatusCallback = null;// Callback для обновления статуса очереди

// ═══════════════════════════════════════════════════════════════
// ИНИЦИАЛИЗАЦИЯ
// ═══════════════════════════════════════════════════════════════

/**
 * initPvpSocket — инициализировать PvP Socket.IO обработчики.
 * Вызывается при подключении сокета или при открытии PvP панели.
 *
 * РЕГИСТРИРУЕТ СОБЫТИЯ:
 *   pvp:matched      — найден соперник
 *   pvp:turn_result  — результат хода
 *   pvp:battle_end   — бой завершён
 *   pvp:error        — ошибка
 *   pvp:queue_status — статус очереди
 *
 * ЧТО ПРИНИМАЕТ: clientSocket — инстанс Socket.IO
 */
export function initPvpSocket(clientSocket) {
  pvpSocket = clientSocket;

  if (!pvpSocket) return;

  // Событие: найден соперник
  pvpSocket.on('pvp:matched', (data) => {
    if (!data || !data.battleId) return;
    isInPvpQueue = false;
    pvpBattleId = data.battleId;
    pvpOpponent = data.opponent;
    pvpMyTurn = data.first || false;
    showPvpMatchModal(data.opponent, data.first);
    updateQueueStatusUI({ inQueue: false });
  });

  // Событие: результат хода (сервер прислал обновление)
  pvpSocket.on('pvp:turn_result', (data) => {
    if (!data || !data.turn) return;
    handlePvpTurnResult(data);
  });

  // Событие: бой завершён
  pvpSocket.on('pvp:battle_end', (data) => {
    if (!data) return;
    endPvpBattle(data);
  });

  // Событие: ошибка
  pvpSocket.on('pvp:error', (data) => {
    const msg = data?.message || 'Ошибка PvP';
    showToast(msg, true);
  });

  // Событие: статус очереди (позиция, кол-во игроков)
  pvpSocket.on('pvp:queue_status', (data) => {
    updateQueueStatusUI(data);
    if (queueStatusCallback) queueStatusCallback(data);
  });
}

// ═══════════════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ОЧЕРЕДЬЮ
// ═══════════════════════════════════════════════════════════════

/**
 * joinPvpQueue — встать в очередь на PvP бой.
 * Отправляет 'pvp:join_queue' на сервер.
 * Сервер ищет оппонента с таким же рейтингом.
 * При нахождении — приходит событие 'pvp:matched'.
 */
export function joinPvpQueue() {
  if (!pvpSocket || !pvpSocket.connected) {
    showToast('Нет подключения к серверу', true);
    return;
  }
  if (isInPvpQueue) {
    showToast('Вы уже в очереди', false);
    return;
  }
  isInPvpQueue = true;
  pvpSocket.emit('pvp:join_queue');
  updateQueueStatusUI({ position: -1, inQueue: true });
}

/**
 * leavePvpQueue — выйти из очереди PvP.
 * Отправляет 'pvp:leave_queue' на сервер.
 */
export function leavePvpQueue() {
  isInPvpQueue = false;
  if (pvpSocket && pvpSocket.connected) {
    pvpSocket.emit('pvp:leave_queue');
  }
  updateQueueStatusUI({ position: -1, inQueue: false });
}

// ═══════════════════════════════════════════════════════════════
// UI: СТАТУС ОЧЕРЕДИ
// ═══════════════════════════════════════════════════════════════

/**
 * updateQueueStatusUI — обновить статус очереди в UI.
 * inQueue = true → "В поиске соперника..."
 * inQueue = false → "Ожидание"
 */
function updateQueueStatusUI(data) {
  const statusEl = document.getElementById('pvp-queue-status');
  if (!statusEl) return;
  if (data.inQueue) {
    statusEl.textContent = 'В поиске соперника...';
    statusEl.className = 'pvp-status searching';
  } else {
    statusEl.textContent = 'Ожидание';
    statusEl.className = 'pvp-status idle';
  }
}

// ═══════════════════════════════════════════════════════════════
// UI: МОДАЛКА НАЙДЕННОГО СОПЕРНИКА
// ═══════════════════════════════════════════════════════════════

/**
 * showPvpMatchModal — показать модалку "Соперник найден!".
 * Показывает имя оппонента и кто ходит первым.
 * Кнопка "Начать битву" → openPvpBattleArena()
 *
 * Использует cloneNode для замены кнопки (чтобы сбросить старые обработчики).
 */
function showPvpMatchModal(opponent, goesFirst) {
  let modal = document.getElementById('pvp-match-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pvp-match-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="selection-modal-card" style="max-width:360px;text-align:center;padding:24px;">
        <div style="font-size:3rem;margin-bottom:12px;">⚔</div>
        <h3 style="margin:0 0 8px;">Соперник найден!</h3>
        <p style="margin:4px 0;font-size:1.1rem;font-weight:bold;" id="pvp-opponent-name">${opponent?.username || 'Неизвестный'}</p>
        <p style="margin:4px 0;font-size:0.85rem;color:var(--tma-text-muted);" id="pvp-first-info"></p>
        <button class="tma-btn" id="btn-pvp-start" style="margin-top:12px;padding:10px 32px;font-size:1rem;">Начать битву</button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('pvp-opponent-name').textContent = opponent?.username || 'Неизвестный';
  document.getElementById('pvp-first-info').textContent = goesFirst ? 'Вы ходите первым!' : 'Противник ходит первым!';

  // Замена кнопки для сброса обработчиков
  const startBtn = document.getElementById('btn-pvp-start');
  const newBtn = startBtn.cloneNode(true);
  startBtn.parentNode.replaceChild(newBtn, startBtn);
  newBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    openPvpBattleArena();
  });

  modal.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
// UI: АРЕНА PVP БОЯ
// ═══════════════════════════════════════════════════════════════

/**
 * openPvpBattleArena — открыть арену PvP-боя (CORE UI).
 * Создаёт модалку pvp-arena с: HP барами, логом, кнопками атак.
 * Кнопка "Сдаться" отправляет 'pvp:surrender' на сервер.
 *
 * Арена показывает:
 *   - Противника (спрайт, имя, HP)
 *   - Себя (имя, HP)
 *   - Лог боя
 *   - Кнопки атак (4 штуки)
 *   - Индикатор хода
 */
function openPvpBattleArena() {
  let arena = document.getElementById('pvp-arena');
  if (!arena) {
    arena = document.createElement('div');
    arena.id = 'pvp-arena';
    arena.className = 'modal-overlay';
    arena.innerHTML = `
      <div class="selection-modal-card" style="max-width:420px;width:95%;padding:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--tma-border);padding-bottom:8px;margin-bottom:12px;">
          <h3 style="margin:0;">⚔ PvP Битва</h3>
          <button class="tma-btn" id="btn-pvp-surrender" style="padding:4px 12px;font-size:0.75rem;background:#ff3b30;margin:0;">Сдаться</button>
        </div>

        <!-- Opponent -->
        <div style="text-align:center;margin-bottom:12px;padding:8px;background:var(--tma-bg-secondary);border-radius:8px;">
          <div style="font-size:2rem;" id="pvp-opp-sprite">❓</div>
          <div style="font-weight:bold;" id="pvp-opp-name">${pvpOpponent?.username || 'Противник'}</div>
          <div style="font-size:0.8rem;" id="pvp-opp-mon-name">-</div>
          <div class="hp-bar-container" style="margin:4px auto;max-width:200px;">
            <div class="hp-bar-fill" id="pvp-opp-hp-fill" style="width:100%;"></div>
          </div>
          <div style="font-size:0.75rem;" id="pvp-opp-hp-text">HP: ?/?</div>
        </div>

        <!-- VS -->
        <div style="text-align:center;font-size:1.2rem;font-weight:bold;margin:4px 0;">VS</div>

        <!-- Player -->
        <div style="text-align:center;margin-bottom:12px;padding:8px;background:var(--tma-bg-secondary);border-radius:8px;">
          <div style="font-weight:bold;" id="pvp-my-name">Вы</div>
          <div style="font-size:0.8rem;" id="pvp-my-mon-name">-</div>
          <div class="hp-bar-container" style="margin:4px auto;max-width:200px;">
            <div class="hp-bar-fill" id="pvp-my-hp-fill" style="width:100%;"></div>
          </div>
          <div style="font-size:0.75rem;" id="pvp-my-hp-text">HP: ?/?</div>
        </div>

        <!-- Battle Log -->
        <div id="pvp-log" style="background:rgba(0,0,0,0.2);border-radius:6px;padding:8px;max-height:80px;overflow-y:auto;font-size:0.75rem;margin-bottom:8px;white-space:pre-wrap;"></div>

        <!-- Move Buttons -->
        <div id="pvp-move-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;"></div>

        <!-- Turn Indicator -->
        <div id="pvp-turn-indicator" style="text-align:center;font-size:0.8rem;margin-top:8px;color:var(--tma-text-muted);">Ожидание хода...</div>
      </div>
    `;
    document.body.appendChild(arena);

    // Surrender button
    arena.querySelector('#btn-pvp-surrender').addEventListener('click', () => {
      if (confirm('Сдаться?')) {
        if (pvpSocket && pvpBattleId) {
          pvpSocket.emit('pvp:surrender', { battleId: pvpBattleId });
        }
        arena.style.display = 'none';
      }
    });
  }

  arena.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
// ОТПРАВКА ХОДА И ОБРАБОТКА РЕЗУЛЬТАТОВ
// ═══════════════════════════════════════════════════════════════

/**
 * submitPvpMove — отправить ход на сервер.
 * Отправляет 'pvp:submit_move' с данными: ID боя, атака, покемон.
 * После отправки: pvpMyTurn = false, ждём ответа от сервера.
 *
 * ЧТО ПРИНИМАЕТ:
 *   moveData — { name, type, power, ... } данные атаки
 *
 * ТРЕБУЕТ: pvpMonData (данные покемона, установленные через setPvpMonData)
 */
export function submitPvpMove(moveData) {
  if (!pvpSocket || !pvpBattleId || !pvpMyTurn) return;
  if (!pvpMonData) {
    showToast('Нет данных о покемоне', true);
    return;
  }

  pvpSocket.emit('pvp:submit_move', {
    battleId: pvpBattleId,
    move: moveData,
    pokemon: pvpMonData,
  });

  pvpMyTurn = false; // Ждём ход оппонента
  updatePvpTurnIndicator(false);
}

/**
 * handlePvpTurnResult — обработать результат хода от сервера.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Добавляет записи в лог (кто что сделал, урон, криты)
 *   2. Обновляет HP бары (свои и оппонента)
 *   3. Переключает ход (если бой не окончен)
 *
 * action.by: 'p1' = я, 'p2' = оппонент
 * action.move: { name } данные атаки
 * action.dmg: нанесённый урон
 * action.crit: был ли критический удар
 * action.fainted: покемон потерял сознание?
 */
export function handlePvpTurnResult(result) {
  const logEl = document.getElementById('pvp-log');
  if (!logEl) return;

  // Логирование действий
  if (result.actions && Array.isArray(result.actions)) {
    result.actions.forEach(action => {
      const who = action.by === 'p1' ? 'Вы' : 'Противник';
      const critText = action.crit ? '💥 Крит! ' : '';
      const faintText = action.fainted ? ' (Покемон потерял сознание!)' : '';
      logEl.innerHTML = `${who}: ${action.move?.name || 'Атака'} (-${action.dmg})${critText}${faintText}\n${logEl.innerHTML}`;
    });
  }

  // Обновление HP
  if (result.yourHp !== null && result.yourMaxHp) {
    updatePvpHp('my', result.yourHp, result.yourMaxHp);
  }
  if (result.opponentHp !== null && result.opponentMaxHp) {
    updatePvpHp('opp', result.opponentHp, result.opponentMaxHp);
  }

  // Переключение хода
  if (!result.battleOver && result.actions) {
    pvpMyTurn = !pvpMyTurn; // Если был ход оппонента — теперь мой
    updatePvpTurnIndicator(pvpMyTurn);
  }
}

// ═══════════════════════════════════════════════════════════════
// ЗАВЕРШЕНИЕ БОЯ
// ═══════════════════════════════════════════════════════════════

/**
 * endPvpBattle — завершить PvP бой.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Закрывает арену
 *   2. Сбрасывает всё PvP состояние
 *   3. Показывает результат: победа/поражение/ничья/сдача/дисконнект
 *   4. Отображает изменение рейтинга
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из обработчика 'pvp:battle_end' (initPvpSocket)
 */
export function endPvpBattle(data) {
  const arena = document.getElementById('pvp-arena');
  if (arena) arena.style.display = 'none';

  // Сброс состояния
  pvpBattleId = null;
  pvpOpponent = null;
  pvpMyTurn = false;
  pvpMonData = null;

  // Результат
  if (data.winner === 'draw') {
    showToast('Ничья!', false);
  } else if (data.winner === 'p1') {
    showToast('🏆 Победа!', false);
  } else if (data.winner === 'p2') {
    showToast('Поражение', true);
  }
  if (data.surrender) {
    showToast('Соперник сдался!', false);
  }
  if (data.disconnect) {
    showToast('Соперник отключился! Победа!', false);
  }
  if (data.yourRatingChange) {
    const change = data.yourRatingChange.new - data.yourRatingChange.old;
    const sign = change >= 0 ? '+' : '';
    showToast(`Рейтинг: ${data.yourRatingChange.old} → ${data.yourRatingChange.new} (${sign}${change})`, false);
  }
}

// ═══════════════════════════════════════════════════════════════
// UI: ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════════════════════════

/**
 * updatePvpHp — обновить HP бар (цвет + текст).
 * who = 'my' | 'opp' — свой или оппонента
 * Цвет: зелёный (>50%), оранжевый (25-50%), красный (<25%)
 */
function updatePvpHp(who, current, max) {
  const hpFill = document.getElementById(`pvp-${who}-hp-fill`);
  const hpText = document.getElementById(`pvp-${who}-hp-text`);
  if (hpFill) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    hpFill.style.width = `${pct}%`;
    if (pct < 25) hpFill.style.background = '#ff3b30';       // Красный
    else if (pct < 50) hpFill.style.background = '#ff9500';  // Оранжевый
    else hpFill.style.background = '#34c759';                 // Зелёный
  }
  if (hpText) {
    hpText.textContent = `HP: ${Math.max(0, current)}/${max}`;
  }
}

/**
 * updatePvpTurnIndicator — обновить индикатор хода в UI.
 * yourTurn = true → "Ваш ход! Выберите атаку." (зелёный)
 * yourTurn = false → "Ожидание хода противника..." (серый)
 */
function updatePvpTurnIndicator(yourTurn) {
  const el = document.getElementById('pvp-turn-indicator');
  if (!el) return;
  if (yourTurn) {
    el.textContent = 'Ваш ход! Выберите атаку.';
    el.style.color = '#34c759';
  } else {
    el.textContent = 'Ожидание хода противника...';
    el.style.color = 'var(--tma-text-muted)';
  }
}

// ═══════════════════════════════════════════════════════════════
// ГЛАВНАЯ ТОЧКА ВХОДА: PVP ПАНЕЛЬ
// ═══════════════════════════════════════════════════════════════

/**
 * showPvpPanel — показать панель PvP арены (главная точка входа).
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Инициализирует PvP сокет (если ещё не)
 *   2. Создаёт модалку pvp-panel с:
 *      - Рейтингом и статистикой (победы/поражения)
 *      - Кнопками "Найти бой" / "Отмена"
 *      - Информацией о PvP
 *   3. Загружает рейтинг с сервера
 *   4. Показывает панель
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из UI (кнопка "PvP Арена")
 */
export function showPvpPanel() {
  // Инициализация сокета если ещё нет
  if (!pvpSocket) {
    const _socket = getSocket();
    if (_socket) {
      initPvpSocket(_socket);
    } else {
      showToast('Сокет не инициализирован', true);
      return;
    }
  }

  // Создание модалки (один раз)
  let panel = document.getElementById('pvp-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'pvp-panel';
    panel.className = 'modal-overlay';
    panel.innerHTML = `
      <div class="selection-modal-card" style="max-width:380px;width:95%;padding:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--tma-border);padding-bottom:8px;margin-bottom:16px;">
          <h3 style="margin:0;">⚔ PvP Арена</h3>
          <button class="tma-btn" id="btn-pvp-panel-close" style="padding:4px 10px;font-size:0.75rem;background:#ff3b30;margin:0;">✕</button>
        </div>

        <!-- Rating info -->
        <div id="pvp-rating-display" style="text-align:center;margin-bottom:16px;padding:12px;background:var(--tma-bg-secondary);border-radius:8px;">
          <div style="font-size:0.75rem;color:var(--tma-text-muted);">Ваш рейтинг</div>
          <div style="font-size:2rem;font-weight:bold;" id="pvp-rating-value">-</div>
          <div style="font-size:0.75rem;color:var(--tma-text-muted);" id="pvp-stats-value">Побед: - | Поражений: -</div>
        </div>

        <!-- Queue controls -->
        <div style="text-align:center;margin-bottom:12px;">
          <div id="pvp-queue-status" class="pvp-status idle">Ожидание</div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
            <button class="tma-btn" id="btn-pvp-join-queue" style="padding:10px 24px;font-size:1rem;">🔍 Найти бой</button>
            <button class="tma-btn" id="btn-pvp-leave-queue" style="padding:10px 24px;font-size:1rem;background:#ff3b30;display:none;">Отмена</button>
          </div>
        </div>

        <div style="border-top:1px solid var(--tma-border);padding-top:12px;margin-top:8px;">
          <p style="font-size:0.75rem;color:var(--tma-text-muted);text-align:center;margin:0;">
            После начала битвы выбирайте атаки по очереди.<br>
            Победа повышает рейтинг, поражение — понижает.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // Close button
    panel.querySelector('#btn-pvp-panel-close').addEventListener('click', () => {
      panel.style.display = 'none';
    });

    // Join queue
    panel.querySelector('#btn-pvp-join-queue').addEventListener('click', () => {
      joinPvpQueue();
      document.getElementById('btn-pvp-join-queue').style.display = 'none';
      document.getElementById('btn-pvp-leave-queue').style.display = 'inline-block';
    });

    // Leave queue
    panel.querySelector('#btn-pvp-leave-queue').addEventListener('click', () => {
      leavePvpQueue();
      document.getElementById('btn-pvp-join-queue').style.display = 'inline-block';
      document.getElementById('btn-pvp-leave-queue').style.display = 'none';
    });
  }

  // Load rating
  loadPvpRating();

  panel.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════
// ДАННЫЕ РЕЙТИНГА И ПОКЕМОНА
// ═══════════════════════════════════════════════════════════════

/**
 * loadPvpRating — загрузить PvP рейтинг с сервера.
 * GET /battle/rating с заголовками авторизации.
 * Обновляет: pvp-rating-value, pvp-stats-value
 */
async function loadPvpRating() {
  try {
    const res = await fetch(`${API_BASE}/battle/rating`, {
      headers: getCloudAuthHeaders(),
    });
    const data = await res.json();
    const ratingEl = document.getElementById('pvp-rating-value');
    const statsEl = document.getElementById('pvp-stats-value');
    if (ratingEl) ratingEl.textContent = data.rating ?? 1000;     // По умолчанию 1000
    if (statsEl) statsEl.textContent = `Побед: ${data.wins || 0} | Поражений: ${data.losses || 0}`;
  } catch (e) {
    console.warn('Failed to load PvP rating:', e);
  }
}

/**
 * setPvpMonData — установить данные покемона для отправки хода.
 * Эти данные отправляются на сервер при submitPvpMove().
 * Должны быть установлены ДО начала боя.
 */
export function setPvpMonData(monData) {
  pvpMonData = monData;
}

/**
 * setArenaPokemon — установить покемона в арене (спрайт + имя + HP).
 * who = 'my' | 'opp' — свой или оппонент
 * monData = { name, level, sprite, currentHp, stats: { hp } }
 */
export function setArenaPokemon(who, monData) {
  const nameEl = document.getElementById(`pvp-${who}-mon-name`);
  const spriteEl = who === 'opp' ? document.getElementById('pvp-opp-sprite') : null;
  if (nameEl && monData) {
    nameEl.textContent = `${monData.name || 'Покемон'} Lv${monData.level || '?'}`;
  }
  if (spriteEl && monData?.sprite) {
    spriteEl.textContent = '';
    spriteEl.innerHTML = `<img src="${monData.sprite}" style="width:64px;height:64px;">`;
  }
  if (monData?.stats) {
    updatePvpHp(who, monData.currentHp || monData.stats.hp, monData.stats.hp);
  }
}

/**
 * setPvpMoveButtons — создать кнопки атак в арене.
 * moves — массив { name, type, ... }
 * Каждая кнопка: имя + type-badge (тип атаки).
 * При клике: submitPvpMove() + блокировка всех кнопок до след. хода.
 */
export function setPvpMoveButtons(moves) {
  const container = document.getElementById('pvp-move-buttons');
  if (!container) return;

  container.innerHTML = '';
  if (!moves || moves.length === 0) return;

  moves.forEach((move) => {
    const btn = document.createElement('button');
    btn.className = 'tma-btn';
    btn.textContent = move.name;
    btn.style.fontSize = '0.8rem';
    btn.style.padding = '8px 4px';

    // Type badge — маленький цветной ярлык типа атаки
    if (move.type) {
      const typeSpan = document.createElement('span');
      typeSpan.className = `type-badge type-${move.type}`;
      typeSpan.textContent = move.type;
      typeSpan.style.fontSize = '0.6rem';
      typeSpan.style.marginLeft = '4px';
      btn.appendChild(document.createTextNode(' '));
      btn.appendChild(typeSpan);
    }

    btn.addEventListener('click', () => {
      if (!pvpMyTurn) {
        showToast('Сейчас не ваш ход', true);
        return;
      }
      submitPvpMove(move);
      // Блокируем кнопки до следующего хода
      container.querySelectorAll('button').forEach(b => b.disabled = true);
    });

    container.appendChild(btn);
  });
}
