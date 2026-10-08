// ─────────────────────────────────────────────────────────────
// pvp-arena.ts — PvP-АРЕНА: ВКЛАДКА (M-18, блок M п.18)
// ─────────────────────────────────────────────────────────────
// Отдельная вкладка «PvP-Арена» (кнопка ⚡ в шапке):
//   - список ожидающих (лобби): кто на арене ждёт / дерётся
//   - вход на арену — ЖЕТОН arenaToken (сгорает при входе, списывает сервер)
//   - вызов на бой — кнопка «Вызвать» в строке лобби (тот же протокол,
//     что и вызов из тренеркарты: challenge/accept/start/action/end)
//   - призы за стрик и таблица лидеров (сервер считает, клиент показывает)
//
// Трейд здесь НЕ живёт: он остался только в ПЦ (trade-center.ts).
// Вызов из тренеркарты — в social/trainer-profile.ts (кнопка «Вызвать»).
//
// ЗАВИСИМОСТИ:
//   state   — inArena, arenaLobby, arenaLeaders, inventory, myTeam, socket
//   arena   — ARENA_TOKEN_ID, hasArenaToken (чистая логика)
//   apiClient — apiFetch (таблица лидеров)
//   socket  — initTradeSocket (лениво, чтобы не закольцевать импорты)
//
// ЭКСПОРТЫ:
//   openPvpArenaLobby() — открыть вкладку арены
//   renderArenaLobby()  — перерисовать лобби (зовёт socket.ts по событию)
//   renderArenaLeaders()— перерисовать таблицу лидеров
// ─────────────────────────────────────────────────────────────

import { state } from '../game/state.js';
import { SOCKET_COOLDOWN } from '../game/config.js';
import { showToast, escHtml } from '../utils/dom.js';
import { apiFetch } from '../game/apiClient.js';
import { autoSave } from '../game/save.js';
import { ARENA_TOKEN_ID, hasArenaToken } from '../battle/arena.js';

// Лениво: network/socket.ts тоже (лениво) тянет этот модуль для
// перерисовки лобби — статический импорт закольцевал бы граф.
async function ensureArenaSocket(): Promise<boolean> {
  const { initTradeSocket } = await import('../network/socket.js');
  initTradeSocket();
  if (!state.socket || !state.socket.connected) {
    showToast('Подключение к серверу...', true);
    return false;
  }
  return true;
}

// ── openPvpArenaLobby: открыть вкладку арены ────────────────
export function openPvpArenaLobby() {
  void ensureArenaSocket().then((ok) => {
    if (!ok) return;
    buildArenaModal();
    const modal = document.getElementById('pvp-arena-modal');
    if (modal) modal.style.display = 'flex';
    refreshArenaLobby();
    void refreshArenaLeaders();
  });
}

// ── buildArenaModal: модалка вкладки (один раз) ─────────────
function buildArenaModal() {
  if (document.getElementById('pvp-arena-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'pvp-arena-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';
  modal.innerHTML = `
    <div class="trade-container">
      <h2 class="m-0-0-4">⚔️ PvP-Арена</h2>
      <p class="text-muted fs-085 m-0-0-12">Вход — по жетону арены (сгорает при входе). Победы серией дают нарастающие призы.</p>
      <div id="arena-my-status" class="text-center fs-09 m-0-0-12"></div>
      <div style="display:flex;gap:6px;margin-bottom:10px;">
        <button class="trade-btn" id="btn-arena-enter" style="flex:1;background:#34c759;">🎟️ Войти (1 жетон)</button>
        <button class="trade-btn" id="btn-arena-leave" style="flex:1;background:var(--tma-text-muted);">Покинуть</button>
      </div>
      <h3 class="m-0-0-4 fs-09">На арене (<span id="arena-lobby-count">0</span>)</h3>
      <div id="arena-lobby-list" class="trade-players-list"></div>
      <h3 class="m-0-0-4 fs-09" style="margin-top:10px;">🏆 Лидеры арены</h3>
      <div id="arena-leaders-list" class="trade-players-list"></div>
      <button class="trade-btn" id="btn-arena-close" style="width:100%;background:var(--tma-text-muted);margin-top:8px;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('btn-arena-close').addEventListener('click', () => {
    modal.style.display = 'none';
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('btn-arena-enter').addEventListener('click', () => {
    if (!hasArenaToken(state.inventory)) {
      showToast('Нужен жетон арены! Купите в маркете.', true);
      return;
    }
    state.socket.emit('arena_join');
  });
  document.getElementById('btn-arena-leave').addEventListener('click', () => {
    state.socket.emit('arena_leave');
    state.inArena = false;
    renderArenaStatus();
  });
}

// ── refreshArenaLobby: запросить снимок лобби + перерисовать ─
function refreshArenaLobby() {
  state.socket.emit('arena_lobby_request');
  renderArenaLobby();
  renderArenaStatus();
}

// ── renderArenaStatus: строка «жетонов: N, вы на арене/вне» ──
export function renderArenaStatus() {
  const el = document.getElementById('arena-my-status');
  if (!el) return;
  const tokens = state.inventory?.[ARENA_TOKEN_ID] || 0;
  const where = state.inArena ? '✅ вы на арене' : 'вне арены';
  const streak = typeof state.pvpStreak === 'number' ? state.pvpStreak : 0;
  el.textContent = `🎟️ Жетонов: ${tokens} · ${where} · стрик: ${streak}`;
}

// ── renderArenaLobby: строки участников + кнопки «Вызвать» ──
export function renderArenaLobby() {
  const list = document.getElementById('arena-lobby-list');
  const count = document.getElementById('arena-lobby-count');
  if (!list) return;
  const lobby = Array.isArray(state.arenaLobby) ? state.arenaLobby : [];
  if (count) count.textContent = String(lobby.length);
  list.innerHTML = '';

  if (lobby.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-30-0">На арене пока пусто<br><span class="fs-08">Войдите по жетону и ждите соперника</span></div>';
    return;
  }

  const myId = state.tgUser?.id;
  lobby.forEach((p) => {
    const row = document.createElement('div');
    row.className = 'trade-player-row';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'trade-player-name';
    const isMe = p.userId === myId;
    nameSpan.textContent = `${p.inBattle ? '⚔️' : '⏳'} ${p.username || 'Тренер'}${isMe ? ' (вы)' : ''}`;

    row.appendChild(nameSpan);

    // Вызвать можно только чужого и только пока он не дерётся.
    // Вызов из тренеркарты — тот же pvp_challenge (см. trainer-profile.ts).
    if (!isMe && !p.inBattle && state.inArena) {
      const btn = document.createElement('button');
      btn.className = 'trade-btn';
      btn.style.background = '#ff3b30';
      btn.textContent = 'Вызвать';
      btn.onclick = () => challengeArenaPlayer(p.userId, btn);
      row.appendChild(btn);
    }
    list.appendChild(row);
  });
}

// ── challengeArenaPlayer: вызов на бой с арены ───────────────
function challengeArenaPlayer(userId: number, btn: HTMLButtonElement) {
  const now = Date.now();
  if (now - state.lastSocketAction < SOCKET_COOLDOWN) {
    showToast('Слишком часто!', true);
    return;
  }
  state.lastSocketAction = now;
  if (!Array.isArray(state.myTeam) || !state.myTeam.some((m) => m.currentHp > 0)) {
    showToast('Нужен хотя бы один живой покемон!', true);
    return;
  }
  // Тот же протокол, что E1–E5, с флагом арены (сервер проверит обоих в лобби).
  state.socket.emit('pvp_challenge', { userId, arena: true });
  showToast('Вызов на бой отправлен!', false);
  btn.textContent = '✓';
  btn.disabled = true;
  setTimeout(() => { btn.textContent = 'Вызвать'; btn.disabled = false; }, 5000);
}

// ── refreshArenaLeaders: таблица лидеров с сервера ──────────
export async function refreshArenaLeaders() {
  try {
    const res = await apiFetch('/arena/leaders');
    if (!res.ok) return;
    const data = await res.json();
    state.arenaLeaders = Array.isArray(data.entries) ? data.entries : [];
  } catch {
    state.arenaLeaders = [];
  }
  renderArenaLeaders();
}

// ── renderArenaLeaders: строки таблицы ──────────────────────
export function renderArenaLeaders() {
  const list = document.getElementById('arena-leaders-list');
  if (!list) return;
  const rows = Array.isArray(state.arenaLeaders) ? state.arenaLeaders : [];
  list.innerHTML = '';
  if (rows.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-30-0">Побед на арене пока нет — станьте первым!</div>';
    return;
  }
  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'trade-player-row';
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const nameSpan = document.createElement('span');
    nameSpan.className = 'trade-player-name';
    nameSpan.textContent = `${medal} ${r.name || 'Тренер'}`;
    const statSpan = document.createElement('span');
    statSpan.className = 'text-muted fs-085';
    statSpan.textContent = `побед: ${r.wins || 0} · стрик: ${r.streak || 0} (best ${r.best || 0})`;
    row.appendChild(nameSpan);
    row.appendChild(statSpan);
    list.appendChild(row);
  });
}

// ── onArenaJoined: сервер подтвердил вход (жетон уже списан там) ──
// Клиент зеркалит списание, иначе следующий автосейв воскресит жетон.
export function onArenaJoined() {
  state.inArena = true;
  const qty = state.inventory?.[ARENA_TOKEN_ID] || 0;
  if (qty > 1) {
    state.inventory[ARENA_TOKEN_ID] = qty - 1;
  } else {
    delete state.inventory[ARENA_TOKEN_ID];
  }
  renderArenaStatus();
  autoSave();
}
