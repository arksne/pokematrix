// ─────────────────────────────────────────────────────────────
// trainer-profile.ts — ПРОФИЛЬ ТРЕНЕРА (социальный модуль)
// ─────────────────────────────────────────────────────────────
// Показывает профиль других игроков: имя, бейджи, команду, онлайн-статус.
// Позволяет отправить запрос на обмен (trade) или PvP-бой.
//
// ЗАВИСИМОСТИ:
//   state.ts     — глобальное состояние (onlinePlayersList, tgUser, socket)
//   config.ts    — API_BASE (URL сервера), SOCKET_COOLDOWN
//   save.ts      — getCloudAuthHeaders (для авторизованных запросов)
//   dom.ts       — escHtml, showToast
//   socket.ts    — initTradeSocket (для инициализации сокета)
//
// ИСПОЛЬЗУЕТСЯ В:
//   chat.ts      — renderOnlinePlayers (список онлайн-игроков)
//   socket.ts    — updateTrainerLocationList (при обновлении локации)
//   location.ts  — loadLocationTrainers (список тренеров на локации)
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   renderOnlinePlayers     — рендер списка онлайн-игроков
//   loadLocationTrainers    — загрузка тренеров на текущей локации
//   updateTrainerLocationList — обновление списка при получении данных
//   openTrainerProfile      — открытие модалки профиля тренера
// ─────────────────────────────────────────────────────────────

import { state } from '../game/state.js';
import { apiFetch } from '../game/apiClient.js';
import { API_BASE, SOCKET_COOLDOWN } from '../game/config.js';
import { getCloudAuthHeaders } from '../game/save.js';
import { escHtml, showToast } from '../utils/dom.js';
import { initTradeSocket } from '../network/socket.js';

// --- Online players display ---

export function renderOnlinePlayers() {
  const listEl = document.getElementById('chat-online-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (state.onlinePlayersList.length === 0) {
    listEl.textContent = '0';
    return;
  }
  listEl.textContent = state.onlinePlayersList.length + ' ';
  state.onlinePlayersList.forEach((p, i) => {
    const span = document.createElement('span');
    span.className = 'chat-trainer-chip';
    span.textContent = p.username || 'Тренер';
    span.addEventListener('click', () => openTrainerProfile(p.userId));
    listEl.appendChild(span);
  });
}

// --- Location-based trainer list ---

// Раньше здесь была своя копия updatePlayerLocation() с POST /profile/location.
// Вызовов у неё не было ни одного: реальная версия живёт в ui/location.ts и
// вызывается при смене локации. Дубль удалён, чтобы править пришлось в одном
// месте, а не в двух расходящихся.

export async function loadLocationTrainers() {
  const listEl = document.getElementById('trainer-location-list');
  if (!listEl) return;
  try {
    // apiFetch, а не голый fetch: он сам добавляет Bearer и обновляет токен
    // при 401. С ручными заголовками запрос переставал работать через 15 минут
    // после входа, когда access token истекал.
    const res = await apiFetch(`/profile/trainers?locationId=${encodeURIComponent(state.currentLocationId)}`);
    if (!res.ok) {
      listEl.textContent = '—';
      return;
    }
    const data = await res.json();
    listEl.innerHTML = '';
    if (!data.trainers || data.trainers.length === 0) {
      listEl.textContent = '0';
      return;
    }
    listEl.textContent = data.trainers.length + ' ';
    data.trainers.forEach((t, i) => {
      const span = document.createElement('span');
      span.className = 'chat-trainer-chip';
      span.setAttribute('data-trainer-id', t.id);
      span.textContent = t.first_name || t.username || `T${t.id}`;
      span.addEventListener('click', () => openTrainerProfile(t.id));
      listEl.appendChild(span);
    });
  } catch (e) {
    // Раньше здесь был пустой catch, из-за которого ошибка оставалась невидимой:
    // ни в консоли, ни в проверках. Молчаливый catch и скрыл исходный баг.
    console.warn('[trainers] список по локации не загрузился:', e);
    listEl.textContent = '—';
  }
}

export function updateTrainerLocationList(data) {
  const listEl = document.getElementById('trainer-location-list');
  if (!listEl || !data) return;
  if (data.userId === (state.tgUser?.id || 0)) return;
  const existing = listEl.querySelector(`[data-trainer-id="${data.userId}"]`);
  if (existing) return;
  if (listEl.textContent === 'никого' || listEl.textContent === '---') listEl.textContent = '';
  const span = document.createElement('span');
  span.className = 'chat-trainer-chip';
  span.setAttribute('data-trainer-id', data.userId);
  span.textContent = data.firstName || data.username || `T${data.userId}`;
  span.addEventListener('click', () => openTrainerProfile(data.userId));
  listEl.appendChild(span);
}

// --- Trainer profile modal ---

export async function openTrainerProfile(userId) {
  const now = Date.now();
  if (now - state.lastProfileOpen < 500) return;
  state.lastProfileOpen = now;

  const modal = document.getElementById('trainer-profile-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  document.getElementById('modal-trainer-name').innerText = 'Загрузка...';
  document.getElementById('modal-trainer-badges').innerText = '0';
  document.getElementById('modal-trainer-team').innerHTML = '<div class="trainer-team-empty">Загрузка...</div>';
  // Сброс аватара на заглушку: профиль мог открыться повторно, и без сброса
  // предыдущий тренер остался бы на месте, пока грузится новый.
  const avatarEl = document.getElementById('modal-trainer-avatar');
  if (avatarEl) avatarEl.innerHTML = '<span style="font-size:1.5rem;">👤</span>';

  try {
      // apiFetch добавляет Bearer и обновляет токен при 401.
      const res = await apiFetch(`/profile/${userId}`);
      if (!res.ok) {
        document.getElementById('modal-trainer-name').innerText = 'Не удалось загрузить профиль';
        return;
      }
      const data = await res.json();

    if (!data.profile) {
      document.getElementById('modal-trainer-name').innerText = 'Тренер не найден';
      return;
    }

    const p = data.profile;
    const isOnline = state.onlinePlayersList.some(op => op.userId === userId);
    const onlineDot = isOnline
      ? '<span class="online-dot yes"></span>'
      : '<span class="online-dot no"></span>';
    const statusText = isOnline ? ' (В сети)' : ' (Не в сети)';
    document.getElementById('modal-trainer-name').innerHTML = onlineDot + escHtml(p.first_name || p.username || `Trainer#${p.id}`) + `<span style="font-size:0.7rem;color:${isOnline ? '#34c759' : '#888'};">${statusText}</span>`;
    document.getElementById('modal-trainer-badges').innerText = p.badges;

    // Аватар тренера. Раньше #modal-trainer-avatar не заполнялся вообще — ни
    // здесь, ни в разметке, — поэтому в модалке профиля всегда висел статичный
    // 👤, хотя аватар выбирается при регистрации, хранится в users.avatar и уже
    // корректно рисуется в списке тренеров. Здесь та же логика, что в ui/trainers.ts:
    // путь принимается только строго по форме /avatars/<имя>.png, иначе в
    // innerHTML попадает эмодзи. Без этой проверки строка вида
    // '/avatars/x" onerror="...' из БД стала бы stored XSS.
    if (avatarEl) {
      const rawAvatar = typeof p.avatar === 'string' ? p.avatar : '';
      const isAvatarPath = /^\/avatars\/[a-z0-9_-]+\.png$/.test(rawAvatar);
      avatarEl.innerHTML = isAvatarPath
        ? `<img src="${escHtml(rawAvatar)}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : `<span style="font-size:1.5rem;">${escHtml(rawAvatar || '👤')}</span>`;
    }

    const actionsDiv = document.getElementById('modal-trainer-actions');
    const onlinePlayer = state.onlinePlayersList.find(op => op.userId === userId);
    if (actionsDiv && onlinePlayer && onlinePlayer.id !== state.socket?.id) {
      actionsDiv.style.display = 'flex';
      const tradeBtn = document.getElementById('btn-trainer-trade');
      const battleBtn = document.getElementById('btn-trainer-battle');
      tradeBtn.onclick = () => {
        const now = Date.now();
        if (now - state.lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто! Подождите...', true); return; }
        state.lastSocketAction = now;
        modal.style.display = 'none';
        initTradeSocket();
        if (!state.socket || !state.socket.connected) {
          showToast('Подключение к серверу...', true);
          return;
        }
        state.socket.emit('trade_request', onlinePlayer.userId);
        showToast('Запрос на обмен отправлен!', false);
      };
      battleBtn.onclick = () => {
        const now = Date.now();
        if (now - state.lastSocketAction < SOCKET_COOLDOWN) { showToast('Слишком часто! Подождите...', true); return; }
        state.lastSocketAction = now;
        if (!state.myTeam.some(m => m.currentHp > 0)) { showToast('Нужен живой покемон!', true); return; }
        modal.style.display = 'none';
        initTradeSocket();
        state.socket.emit('pvp_challenge', onlinePlayer.userId);
        showToast('Вызов на бой отправлен!', false);
      };
    } else if (actionsDiv) {
      actionsDiv.style.display = 'none';
    }

    const teamEl = document.getElementById('modal-trainer-team');
    teamEl.innerHTML = '';
    if (!p.team || p.team.length === 0) {
      teamEl.innerHTML = '<div class="trainer-team-empty">Нет покемонов</div>';
      return;
    }
    p.team.forEach(mon => {
      const div = document.createElement('div');
      div.className = 'trainer-team-mon';
      div.innerHTML = `
        <div class="trainer-team-mon-img-box">
          <img class="trainer-team-mon-img" src="${mon.sprite || ''}" alt="">
        </div>
        <div class="trainer-team-mon-info">
          <div class="trainer-team-mon-name">${escHtml(mon.nickname || mon.name)}</div>
          <div class="trainer-team-mon-lvl">Lv${mon.level}</div>
        </div>`;
      teamEl.appendChild(div);
    });
  } catch (e) {
    console.error('Trainer profile error:', e);
    document.getElementById('modal-trainer-name').innerText = 'Ошибка загрузки';
  }
}
