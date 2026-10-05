/**
 * ============================================================
 * socket.ts — Socket.IO КЛИЕНТ (ТРЕЙДЫ, PVP, ЧАТ)
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   Подключается к серверу через Socket.IO.
 *   initTradeSocket() — создаёт соединение с JWT-токеном.
 *   Обрабатывает события:
 *     - connect → join_lobby, initChatSocket, PvP
 *     - online_players → обновление списка игроков
 *     - save_updated → облачное сохранение
 *     - trade_* → обмен покемонами/предметами
 *     - pvp_* → PvP-баттлы
 *   JWT-токен передаётся в auth.handshake (фикс H1).
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - socket.io-client     → io() (клиент)
 *   - ../game/state.js     → state, generateUID, getTrainerId
 *   - ../game/config.js    → API_BASE
 *   - ../game/save.js      → cloudLoad, applyCloudSave
 *   - ../game/actions.js   → addItem, removeItem
 *   - UI модули (чат, трейды, PvP, уведомления)
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - init.ts → initTradeSocket() после авторизации
 *   - Все UI модули (chat, trade-center, trade-request, pvp.js)
 *
 * 🔹 ЭКСПОРТИРУЕТ:
 *   - initTradeSocket() — создание socket-соединения
 * ============================================================
 */

import { io } from 'socket.io-client';
import { state, generateUID, getTrainerId, lsKey } from '../game/state.js';
import { refreshAccessToken } from '../game/apiClient.js';
import { store } from '../game/store.js';
import { API_BASE } from '../game/config.js';
import { showToast, showConfirmModal } from '../utils/dom.js';
import { cloudLoad, applyCloudSave } from '../game/save.js';
import { addItem, removeItem } from '../game/actions.js';
import { addNotification } from '../ui/notifications.js';
import { initChatSocket } from '../ui/chat.js';
import { renderTradePlayerList } from '../ui/trade-center.js';
// Lazy imports for cycle-breaking (socket.ts ↔ trainer-profile.ts)
async function renderOnlinePlayers() { (await import('../social/trainer-profile.js')).renderOnlinePlayers(); }
async function updateTrainerLocationList(data: any) { (await import('../social/trainer-profile.js')).updateTrainerLocationList(data); }
import { showTradeRequestModal } from '../ui/trade-request.js';
import { openTradeWindow, renderTradeOffers, updateTradeConfirmUI, closeTradeWindow } from '../ui/trade-window.js';
import { openPvPArena, endPvP, updatePvPUI } from '../battle/pvp-core.js';
import { renderTeamGrid, refreshProfileUI } from '../ui/profile.js';
import { updateMoneyDisplay } from '../ui/location.js';
import { updateInventoryDisplay } from '../ui/inventory.js';
import { autoSave } from '../game/save.js';

export function initTradeSocket() {
  if (state.socket) return;
  const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : API_BASE.replace('/api', '');
  state.socket = io(serverUrl, {
    auth: { token: state.tgToken }
  });

  /**
   * Переподключение со свежим токеном.
   *
   * Токен доступа живёт 15 минут, а socket.io auth — статический объект: он
   * читается один раз при подключении. Раньше сокет несла токен из момента входа
   * и через 15 минут умирала вместе с чатом, списком онлайн-игроков, трейдами и
   * PvP. Механизма восстановления не было: обработчик auth_expired на сервере
   * никто не вызывал, а connect_error просто ждал реконнекта с тем же мёртвым
   * токеном. Теперь при отказе по авторизации обновляем токен и пересоздаём
   * соединение с ним.
   */
  let reconnecting = false;
  state.socket.on('connect_error', async (err: any) => {
    const msg = String(err?.message || '');
    if (!/auth|token|unauthorized|jwt/i.test(msg) || reconnecting) return;
    reconnecting = true;
    try {
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        console.warn('[socket] не удалось обновить токен для переподключения');
        return;
      }
      const socket = state.socket;
      socket.auth = { token: state.tgToken };
      socket.disconnect();
      socket.connect();
      console.log('[socket] переподключение с обновлённым токеном');
    } catch (e) {
      console.warn('[socket] ошибка переподключения:', e);
    } finally {
      reconnecting = false;
    }
  });

  // Сокет мог подключиться до того, как обновился токен: на переподключении
  // сервер отвергнет старый, поэтому проверяем и освежаем proactively.
  state.socket.on('reconnect_attempt', () => {
    if (state.socket && state.socket.auth && state.socket.auth.token !== state.tgToken) {
      state.socket.auth = { token: state.tgToken };
    }
  });

  state.socket.on('connect', () => {
    state.socket.emit('join_lobby', { username: state.tgUser?.first_name || state.tgUser?.username || 'Тренер', userId: state.tgUser?.id });
    initChatSocket();
  });

  state.socket.on('disconnect', () => {
    state.onlinePlayersList = [];
    renderOnlinePlayers();
  });

  state.socket.on('location_update', (data) => {
    if (data.locationId === state.currentLocationId && data.userId !== (state.tgUser?.id || 0)) {
      updateTrainerLocationList(data);
    }
  });

  state.socket.on('online_players', (players) => {
    state.onlinePlayersList = players.filter(p => p.id !== state.socket.id);
    renderTradePlayerList();
    renderOnlinePlayers();
  });

  state.socket.on('save_updated', async () => {
    const data = await cloudLoad();
    if (!data) return;
    // Сравниваем по _ts — метке времени в сейве. Раньше здесь читался
    // data.saveVersion, которого getFullSaveData() никогда не пишет (пишет _v),
    // поэтому проверка устаревания не могла сработать никогда.
    const localTs = parseInt(localStorage.getItem(lsKey('save_ts')) || '0');
    if (data._ts !== undefined && data._ts <= localTs) {
      console.log('[save] save_updated: локальная версия новее, пропускаю (local:', localTs, 'remote:', data._ts, ')');
      return;
    }
    // state.saveVersion = 0 здесь больше нет: это обнуляло счётчик версий и
    // навсегда отключало серверную блокировку от устаревших сохранений.
    await applyCloudSave(data);
    updateMoneyDisplay();
    updateInventoryDisplay();
    if (typeof renderTeamGrid === 'function') renderTeamGrid();
    showToast('Сохранение обновлено администратором', false);
  });

  state.socket.on('save_reset', (data) => {
    const uid = data?.userId;
    if (!uid || uid === (state.tgUser?.id || 0)) {
      showToast('⚠️ Ваш прогресс был сброшен администратором. Перезагрузка...', true);
      setTimeout(() => window.location.reload(), 2000);
    }
  });

  state.socket.on('admin_announcement', (data) => {
    const msg = data?.message || 'announcement';
    showToast('📢 ' + msg, false);
    if (typeof addNotification === 'function') {
      addNotification('📢 Announcement', msg);
    }
  });

  state.socket.on('trade_request_received', (data) => {
    showTradeRequestModal(data.fromUsername, data.fromId);
  });

  state.socket.on('trade_rejected', () => {
    showToast('Тренер отклонил предложение обмена', true);
  });

  state.socket.on('trade_started', (data) => {
    state.activeTradeId = data.tradeId;
    state.iAmP1 = data.tradeId.startsWith(state.socket.id);
    state.myTradeOffers = [];
    state.partnerTradeOffers = [];
    openTradeWindow(data.partnerUsername);
  });

  state.socket.on('trade_partner_offers', (offers) => {
    state.partnerTradeOffers = Array.isArray(offers) ? offers : [];
    renderTradeOffers();
  });

  state.socket.on('trade_confirm_status', (status) => {
    updateTradeConfirmUI(status);
  });

  state.socket.on('trade_execute', (receivedOffers) => {
    if (state.myTradeOffers.length > 0) {
      state.myTradeOffers.forEach(offer => {
        if (offer.type === 'pokemon') {
          const idx = state.myTeam.findIndex(m => m.uid === offer.data.uid || m === offer.data);
          if (idx !== -1) state.myTeam.splice(idx, 1);
        } else if (offer.type === 'item') {
          removeItem(offer.data.id, offer.data.qty || 1);
        }
      });
    }

    if (Array.isArray(receivedOffers)) {
      receivedOffers.forEach(offer => {
        if (offer.type === 'pokemon') {
          offer.data.previousOwner = offer.data.originalTrainer;
          offer.data.uid = generateUID();
          offer.data.originalTrainer = getTrainerId();
          offer.data.createdAt = Date.now();
          if (state.myTeam.length < 6) {
            state.myTeam.push(offer.data);
          } else {
            if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
            state.pcBoxes[0].push(offer.data);
            addNotification('📦 Покемон в PC', `${offer.data.name || 'Покемон'} отправлен в Бокс 1 (команда полна).`);
          }
        } else if (offer.type === 'item') {
          addItem(offer.data.id, offer.data.qty || 1);
          showToast(`Получено: ${offer.data.name} x${offer.data.qty || 1}!`, false);
        }
      });
    }

    showToast('Обмен успешно завершён!', false);
    closeTradeWindow();
    updateMoneyDisplay();
    autoSave();
    refreshProfileUI();
  });

  state.socket.on('trade_cancelled', (msg) => {
    showToast(msg || 'Обмен отменён', true);
    closeTradeWindow();
  });

  // PvP handlers
  state.socket.on('pvp_challenge_received', (data) => {
    showConfirmModal('⚔ Вызов на бой!', `Тренер ${data.fromName} вызывает вас на битву!`, () => {
      if (!state.myTeam.some(m => m.currentHp > 0)) {
        showToast('Нужен хотя бы один живой покемон!', true);
        state.socket.emit('pvp_decline', data.fromId);
        return;
      }
      state.socket.emit('pvp_accept', data.fromId);
    }, () => { state.socket.emit('pvp_decline', data.fromId); });
  });

  state.socket.on('pvp_declined', (data) => {
    showToast(`${data.fromName} отклонил вызов`, true);
  });

  state.socket.on('pvp_start', (data) => {
    openPvPArena(data.battleId, data.opponent, data.first || false);
  });

  state.socket.on('pvp_opponent_action', (action) => {
    if (!state.pvpBattleId) return;
    if (action.type === 'mon_data') {
      const oppNameEl = document.getElementById('pvp-opp-name');
      const oppLvlEl = document.getElementById('pvp-opp-lvl');
      const oppHpEl = document.getElementById('pvp-opp-hp');
      const oppHpFill = document.getElementById('pvp-opp-hp-fill');
      const oppSprite = document.getElementById('pvp-opp-sprite') as HTMLImageElement;
      if (oppNameEl) oppNameEl.textContent = action.name;
      if (oppLvlEl) oppLvlEl.textContent = `Lv${action.lvl}`;
      if (oppHpEl) oppHpEl.textContent = `${action.hp}/${action.maxHp}`;
      if (oppHpFill) oppHpFill.style.width = `${(action.hp / action.maxHp) * 100}%`;
      if (action.sprite && oppSprite) oppSprite.src = action.sprite;
      if (!state.pvpOppMon) state.pvpOppMon = {};
      state.pvpOppMon.currentHp = action.hp;
      state.pvpOppMon.maxHp = action.maxHp;
    }
    if (action.type === 'attack') {
      if (state.pvpMyMon) {
        state.pvpMyMon.currentHp -= action.dmg;
        if (state.pvpMyMon.currentHp < 0) state.pvpMyMon.currentHp = 0;
        updatePvPUI();
      }
      const logEl = document.getElementById('pvp-log');
      if (logEl) {
        const logLine = `${state.pvpOpponentName}: ${action.moveName}! ${action.crit ? '💥Крит! ' : ''}(-${action.dmg})`;
        const logEntry = document.createElement('div');
        logEntry.textContent = logLine;
        logEl.prepend(logEntry);
      }
      state.pvpMyTurn = true;
      updatePvPUI();
      if (state.pvpMyMon && state.pvpMyMon.currentHp <= 0) endPvP(false);
    }
    if (action.type === 'surrender') {
      showToast('🏆 Соперник сдался! Победа!', false);
      // Награда выдаётся сервером через pvp_reward
      const pvpModal = document.getElementById('pvp-modal');
      if (pvpModal) pvpModal.style.display = 'none';
      state.pvpBattleId = null;
      autoSave();
    }
    if (action.type === 'win' || action.type === 'lose') {
      const pvpModal = document.getElementById('pvp-modal');
      if (pvpModal) pvpModal.style.display = 'none';
      state.pvpBattleId = null;
      autoSave();
    }
  });

  // ── pvp_reward: server-authoritative награда за PvP победу ──
  state.socket.on('pvp_reward', (data: { money: number }) => {
    if (data.money) {
      state.inventory['credit'] = (state.inventory['credit'] || 0) + data.money;
      updateMoneyDisplay();
      store.emit('money:changed');
      showToast(`🏆 +${data.money}¥ за победу в PvP!`, false);
    }
  });
}

