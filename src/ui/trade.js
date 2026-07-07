// ─────────────────────────────────────────────────────────────
// trade.js — СИСТЕМА ОБМЕНА ПО СЕТИ (P2P Trade)
// ─────────────────────────────────────────────────────────────
// Управляет полным циклом PvP-обмена покемонами через Socket.IO:
//   - Инициализация сокета для торговли
//   - Получение списка доступных предложений
//   - Отправка/принятие запроса на обмен
//   - Передача данных покемонов и предметов
//   - Подтверждение/отмена обмена
//
// ЗАВИСИМОСТИ:
//   config — API_BASE (базовый URL сервера)
//   state  — глобальное состояние (state.socket — Socket.IO подключение)
//   save   — getCloudAuthHeaders (заголовки авторизации)
//   dom    — showToast (всплывающие уведомления)
//
// ИСПОЛЬЗУЕТСЯ В:
//   trade-center.ts — инициализация кнопок торговли
//   socket.ts       — регистрация socket-событий торговли
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { API_BASE } from '../game/config.js';          // Базовый URL сервера
import { state } from '../game/state.js';                // Глобальное состояние (state.socket)
import { getCloudAuthHeaders } from '../game/save.js';  // Bearer token для HTTP запросов
import { showToast } from '../utils/dom.js';              // Всплывающие уведомления

// getSocket — геттер для Socket.IO подключения из глобального состояния
// Используется вместо прямого обращения к state.socket
function getSocket() { return state.socket; }

// ── ЛОКАЛЬНОЕ СОСТОЯНИЕ ТОРГОВЛИ ────────────────────────
let tradeSocket = null;          // Socket.IO клиент для торговли (передаётся из socket.ts)
let activeTradeId = null;        // ID текущей активной сессии обмена
let tradePartner = null;         // Имя партнёра по обмену
let myTradeOffers = [];          // Мои предложения: [{type, id, data}, ...]
let partnerTradeOffers = [];     // Предложения партнёра: [{type, id, data}, ...]
let iAmP1 = true;                // Флаг: я игрок P1 (первый) или P2 (второй)
let myTradeConfirmed = false;     // Флаг: я подтвердил обмен
let partnerTradeConfirmed = false; // Флаг: партнёр подтвердил обмен

// ── initTradeSocket: инициализация сокета для торговли ──
// Принимает sock — Socket.IO клиент
// Регистрирует обработчики всех событий торговли:
//   trade:request_received — входящий запрос на обмен
//   trade:started — обмен начался (оба приняли)
//   trade:declined — запрос отклонён
//   trade:partner_offers — партнёр обновил предложения
//   trade:confirm_status — статус подтверждения изменился
//   trade:complete — обмен завершён сервером
//   trade:cancelled — обмен отменён
//   trade:error — ошибка обмена
export function initTradeSocket(sock) {
  tradeSocket = sock;
  if (!tradeSocket) return;  // Если сокет не передан — выходим

  // ── Очистка старых обработчиков ──
  // Убираем все ранее зарегистрированные обработчики, чтобы не было дубликатов
  // Это нужно потому что initTradeSocket может вызываться несколько раз
  tradeSocket.off('trade:request_received');
  tradeSocket.off('trade:started');
  tradeSocket.off('trade:declined');
  tradeSocket.off('trade:partner_offers');
  tradeSocket.off('trade:confirm_status');
  tradeSocket.off('trade:complete');
  tradeSocket.off('trade:cancelled');
  tradeSocket.off('trade:error');

  // ── Получение запроса на обмен от другого игрока ──
  tradeSocket.on('trade:request_received', (data) => {
    // data: { fromId, fromUsername, fromSocketId }
    if (!data || !data.fromId) return;  // Без ID — игнорируем
    showTradeRequestModal(data);          // Показываем модалку "Предложение обмена"
  });

  // ── Обмен начат (оба приняли) ──
  tradeSocket.on('trade:started', (data) => {
    // data: { tradeId, partnerUsername, youAreP1 }
    if (!data || !data.tradeId) return;
    activeTradeId = data.tradeId;                       // Сохраняем ID сессии
    tradePartner = data.partnerUsername || 'Партнёр';    // Имя партнёра
    iAmP1 = data.youAreP1 !== undefined ? data.youAreP1 : true;  // Кто P1/P2
    // Сбрасываем все предложения и флаги
    myTradeOffers = [];
    partnerTradeOffers = [];
    myTradeConfirmed = false;
    partnerTradeConfirmed = false;
    openTradePanel();  // Открываем панель обмена
  });

  // ── Запрос на обмен отклонён ──
  tradeSocket.on('trade:declined', (data) => {
    showToast(data?.message || 'Тренер отклонил предложение обмена', true);
  });

  // ── Партнёр обновил свои предложения ──
  tradeSocket.on('trade:partner_offers', (offers) => {
    // offers — массив предложений партнёра
    partnerTradeOffers = Array.isArray(offers) ? offers : [];
    renderTradeOffers();  // Перерисовываем отображение
  });

  // ── Статус подтверждения изменился ──
  tradeSocket.on('trade:confirm_status', (status) => {
    // status: { p1: boolean, p2: boolean }
    if (status) {
      // Если я P1 — status.p1 относится ко мне
      myTradeConfirmed = status.p1 === (iAmP1 ? true : false) ? true : myTradeConfirmed;
      partnerTradeConfirmed = status.p1 === (iAmP1 ? false : true) ? true : partnerTradeConfirmed;
    }
    updateTradeConfirmUI();  // Обновляем UI подтверждения
  });

  // ── Обмен успешно завершён (сервер выполнил обмен) ──
  tradeSocket.on('trade:complete', (data) => {
    const receivedOffers = data?.offers || [];

    // Клиентская обработка полученных предметов/покемонов
    if (Array.isArray(receivedOffers) && receivedOffers.length > 0) {
      receivedOffers.forEach(offer => {
        if (offer.type === 'pokemon') {
          // Получен покемон (сервер уже добавил его в команду/PC)
          const monData = offer.data;
          if (monData) {
            showToast(`Получен покемон: ${monData.name || 'Покемон'}`, false);
          }
        } else if (offer.type === 'item') {
          // Получен предмет
          showToast(
            `Получен предмет: ${offer.data?.name || 'Предмет'} x${offer.data?.qty || 1}`,
            false
          );
        }
      });
    }

    showToast('Обмен успешно завершён!', false);
    closeTradePanel();  // Закрываем панель

    // Сбрасываем всё состояние
    activeTradeId = null;
    tradePartner = null;
    myTradeOffers = [];
    partnerTradeOffers = [];
  });

  // ── Обмен отменён ──
  tradeSocket.on('trade:cancelled', (data) => {
    showToast(data?.message || 'Обмен отменён', true);
    closeTradePanel();
    activeTradeId = null;
  });

  // ── Ошибка обмена ──
  tradeSocket.on('trade:error', (data) => {
    showToast(data?.message || 'Ошибка обмена', true);
  });
}

// ── requestTrade: отправка запроса на обмен ─────────────
// Принимает userId — ID целевого тренера
// Эмитит событие 'trade:request' на сервер
export function requestTrade(userId) {
  // Проверяем подключение к сокету
  if (!tradeSocket || !tradeSocket.connected) {
    showToast('Нет подключения к серверу', true);
    return;
  }

  // Отправляем запрос с ID отправителя, ID цели, именем отправителя
  tradeSocket.emit('trade:request', {
    targetUserId: userId,          // Кому адресован запрос
    fromUserId: getMyUserId(),      // Мой Telegram ID
    fromUsername: getMyUsername(),  // Моё имя
  });
}

// ── openTradePanel: показать панель обмена ───────────────
// Создаёт DOM-модалку с интерфейсом обмена:
//   - Информация о партнёре
//   - Мои предложения (с кнопками + для добавления)
//   - Предложения партнёра
//   - Кнопки "Подтвердить" и "Отмена"
export function openTradePanel() {
  // Проверяем, существует ли уже панель
  let panel = document.getElementById('trade-panel');
  if (panel) {
    // Если существует — просто показываем
    panel.style.display = 'flex';
    return;
  }

  // Создаём новую панель
  panel = document.createElement('div');
  panel.id = 'trade-panel';
  panel.className = 'modal-overlay';
  panel.innerHTML = `
    <div class="selection-modal-card" style="max-width:420px;width:95%;padding:16px;max-height:90vh;overflow-y:auto;">
      <!-- Заголовок с кнопкой закрытия -->
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--tma-border);padding-bottom:8px;margin-bottom:12px;">
        <h3 style="margin:0;">🤝 Обмен</h3>
        <button class="tma-btn" id="btn-trade-close" style="padding:4px 10px;font-size:0.75rem;background:#ff3b30;margin:0;">✕</button>
      </div>

      <!-- Информация о партнёре -->
      <div id="trade-partner-info" style="text-align:center;font-size:0.9rem;margin-bottom:8px;">
        Обмен с: <strong>${tradePartner || 'Партнёр'}</strong>
      </div>

      <!-- Мои предложения -->
      <div style="margin-bottom:8px;">
        <div style="font-size:0.8rem;font-weight:bold;margin-bottom:4px;">Ваши предложения:</div>
        <div id="trade-my-offers" style="min-height:40px;border:1px dashed var(--tma-border);border-radius:6px;padding:6px;font-size:0.75rem;color:var(--tma-text-muted);">
          Нет предметов
        </div>
        <div style="display:flex;gap:4px;margin-top:4px;">
          <button class="tma-btn" id="btn-trade-add-pokemon" style="font-size:0.72rem;padding:4px 8px;flex:1;margin:0;">+ Покемон</button>
          <button class="tma-btn" id="btn-trade-add-item" style="font-size:0.72rem;padding:4px 8px;flex:1;margin:0;">+ Предмет</button>
        </div>
      </div>

      <!-- Предложения партнёра -->
      <div style="margin-bottom:12px;">
        <div style="font-size:0.8rem;font-weight:bold;margin-bottom:4px;">Предложения партнёра:</div>
        <div id="trade-partner-offers" style="min-height:40px;border:1px dashed var(--tma-border);border-radius:6px;padding:6px;font-size:0.75rem;color:var(--tma-text-muted);">
          Ожидание...
        </div>
      </div>

      <!-- Кнопки подтверждения -->
      <div style="display:flex;gap:8px;justify-content:center;border-top:1px solid var(--tma-border);padding-top:12px;">
        <button class="tma-btn" id="btn-trade-confirm" style="padding:8px 16px;font-size:0.85rem;background:#34c759;flex:1;">Подтвердить</button>
        <button class="tma-btn" id="btn-trade-cancel" style="padding:8px 16px;font-size:0.85rem;background:#ff3b30;flex:1;">Отмена</button>
      </div>
      <div id="trade-confirm-status" style="text-align:center;font-size:0.75rem;margin-top:6px;color:var(--tma-text-muted);"></div>
    </div>
  `;

  document.body.appendChild(panel);

  // ── Кнопка закрытия ✕ ──
  panel.querySelector('#btn-trade-close').addEventListener('click', closeTradePanel);

  // ── Кнопка отмены ──
  panel.querySelector('#btn-trade-cancel').addEventListener('click', () => {
    if (activeTradeId && tradeSocket) {
      tradeSocket.emit('trade:cancel', { tradeId: activeTradeId });  // Уведомляем сервер
    }
    closeTradePanel();  // Закрываем панель
  });

  // ── Кнопка подтверждения ──
  panel.querySelector('#btn-trade-confirm').addEventListener('click', confirmTrade);

  // ── Кнопка "+ Покемон" ──
  // Плейсхолдер — открывает выбор покемона (должен быть зарегистрирован main.ts)
  panel.querySelector('#btn-trade-add-pokemon').addEventListener('click', () => {
    showToast('Выберите покемона из команды', false);
    // window.__openTradePokemonSelect регистрируется в main.js
    if (typeof window.__openTradePokemonSelect === 'function') {
      window.__openTradePokemonSelect();
    }
  });

  // ── Кнопка "+ Предмет" ──
  panel.querySelector('#btn-trade-add-item').addEventListener('click', () => {
    showToast('Выберите предмет из инвентаря', false);
    if (typeof window.__openTradeItemSelect === 'function') {
      window.__openTradeItemSelect();
    }
  });

  panel.style.display = 'flex';  // Показываем панель
  renderTradeOffers();            // Отрисовываем предложения
}

// ── closeTradePanel: закрыть панель обмена ──────────────
function closeTradePanel() {
  const panel = document.getElementById('trade-panel');
  if (panel) panel.style.display = 'none';  // Скрываем, не удаляем (может понадобиться снова)
}

// ── addTradeOffer: добавить предложение в обмен ─────────
// Принимает: type ('pokemon'|'item'), id (уникальный ID), data (объект с данными)
// Добавляет предложение в локальный массив и синхронизирует с партнёром
export function addTradeOffer(type, id, data) {
  if (!activeTradeId) return;  // Нет активной сессии — выходим

  // Проверка на дубликаты: если такое же предложение уже есть — не добавляем
  if (myTradeOffers.some(o => o.type === type && o.id === id)) {
    showToast('Это уже добавлено', true);
    return;
  }

  myTradeOffers.push({ type, id, data });  // Добавляем в массив
  syncTradeOffers();                        // Отправляем партнёру
  renderTradeOffers();                      // Перерисовываем UI
}

// ── removeTradeOffer: удалить предложение по индексу ────
export function removeTradeOffer(index) {
  if (index < 0 || index >= myTradeOffers.length) return;
  myTradeOffers.splice(index, 1);  // Удаляем из массива
  syncTradeOffers();                // Отправляем обновление партнёру
  renderTradeOffers();              // Перерисовываем UI
}

// ── syncTradeOffers: синхронизация предложений с партнёром ──
// Отправляет текущий массив моих предложений через socket
function syncTradeOffers() {
  if (!tradeSocket || !activeTradeId) return;
  tradeSocket.emit('trade:update', {
    tradeId: activeTradeId,
    offers: myTradeOffers,
  });
}

// ── confirmTrade: подтвердить обмен ─────────────────────
// Отправляет подтверждение на сервер
// Обмен выполняется ТОЛЬКО когда оба игрока подтвердили
export function confirmTrade() {
  if (!tradeSocket || !activeTradeId) {
    showToast('Нет активного обмена', true);
    return;
  }

  if (myTradeOffers.length === 0) {
    showToast('Добавьте хотя бы один предмет для обмена', true);
    return;
  }

  myTradeConfirmed = true;  // Ставим флаг
  tradeSocket.emit('trade:confirm', { tradeId: activeTradeId });  // Уведомляем сервер
  updateTradeConfirmUI();  // Обновляем UI
}

// ── declineTrade: отклонить запрос на обмен ────────────
// Плейсхолдер — фактически отклонение происходит в showTradeRequestModal
export function declineTrade() {
  // Обработка отклонения запроса на обмен
}

// ── renderTradeOffers: отрисовка предложений в панели ──
// Показывает мои предложения (с кнопками удаления ✕)
// И предложения партнёра (только для просмотра)
function renderTradeOffers() {
  const myContainer = document.getElementById('trade-my-offers');
  const partnerContainer = document.getElementById('trade-partner-offers');

  // ── Мои предложения ──
  if (myContainer) {
    if (myTradeOffers.length === 0) {
      myContainer.innerHTML = '<span style="color:var(--tma-text-muted);">Нет предметов</span>';
    } else {
      // Рендерим каждое предложение с кнопкой удаления
      myContainer.innerHTML = myTradeOffers.map((offer, idx) => {
        const name = offer.data?.name || offer.id || 'Предмет';
        const qty = offer.data?.qty ? ` x${offer.data.qty}` : '';
        const icon = offer.type === 'pokemon' ? '🔴' : '📦';  // 🔴 покемон, 📦 предмет
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:2px 0;">
          <span>${icon} ${name}${qty}</span>
          <button class="tma-btn trade-remove-btn" data-idx="${idx}" style="padding:2px 6px;font-size:0.65rem;background:#ff3b30;margin:0;">✕</button>
        </div>`;
      }).join('');

      // Привязываем обработчики к кнопкам удаления
      myContainer.querySelectorAll('.trade-remove-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          removeTradeOffer(parseInt(btn.dataset.idx));  // Удаляем по индексу
        });
      });
    }
  }

  // ── Предложения партнёра ──
  if (partnerContainer) {
    if (partnerTradeOffers.length === 0) {
      partnerContainer.innerHTML = '<span style="color:var(--tma-text-muted);">Ожидание...</span>';
    } else {
      // Только отображаем (без кнопки удаления — чужие предложения)
      partnerContainer.innerHTML = partnerTradeOffers.map(offer => {
        const name = offer.data?.name || offer.id || 'Предмет';
        const qty = offer.data?.qty ? ` x${offer.data.qty}` : '';
        const icon = offer.type === 'pokemon' ? '🔴' : '📦';
        return `<div style="padding:2px 0;">${icon} ${name}${qty}</div>`;
      }).join('');
    }
  }
}

// ── updateTradeConfirmUI: обновление UI подтверждения ───
// Показывает статусы: кто подтвердил, кто ещё ждёт
// Обновляет текст и состояние кнопки "Подтвердить"
function updateTradeConfirmUI() {
  const statusEl = document.getElementById('trade-confirm-status');
  if (!statusEl) return;

  // Статусы: ✅ или ⏳
  const myStatus = myTradeConfirmed
    ? '✅ Вы подтвердили'
    : '⏳ Ожидание вашего подтверждения';
  const partnerStatus = partnerTradeConfirmed
    ? '✅ Партнёр подтвердил'
    : '⏳ Ожидание подтверждения партнёра';

  statusEl.innerHTML = `${myStatus}<br>${partnerStatus}`;

  // Обновляем кнопку
  const confirmBtn = document.getElementById('btn-trade-confirm');
  if (confirmBtn) {
    confirmBtn.textContent = myTradeConfirmed ? 'Ожидание партнёра...' : 'Подтвердить';
    confirmBtn.disabled = myTradeConfirmed;  // Блокируем после подтверждения
  }
}

// ── showTradeRequestModal: показать модалку запроса на обмен ──
// При получении trade:request_received показывает окно:
//   "Тренер X хочет обменяться с вами!" + кнопки "Принять"/"Отклонить"
function showTradeRequestModal(data) {
  // Проверяем, существует ли уже модалка
  let modal = document.getElementById('trade-request-modal-v2');
  if (!modal) {
    // Создаём новую
    modal = document.createElement('div');
    modal.id = 'trade-request-modal-v2';
    modal.className = 'trade-request-overlay';
    modal.innerHTML = `
      <div class="trade-request-box" style="padding:20px;text-align:center;">
        <h3 style="margin-top:0;">🤝 Предложение обмена</h3>
        <p>Тренер <strong id="trade-req-username-v2"></strong> хочет обменяться с вами!</p>
        <div class="trade-request-buttons" style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
          <button class="trade-btn accept" id="btn-trade-accept-v2" style="padding:8px 20px;">Принять</button>
          <button class="trade-btn reject" id="btn-trade-reject-v2" style="padding:8px 20px;">Отклонить</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  // Устанавливаем имя отправителя
  document.getElementById('trade-req-username-v2').textContent = data.fromUsername || 'Тренер';

  // ── Кнопка "Принять" ──
  // Используем cloneNode для удаления старых обработчиков (чтобы избежать дубликатов)
  const acceptBtn = document.getElementById('btn-trade-accept-v2');
  const rejectBtn = document.getElementById('btn-trade-reject-v2');

  // Клонируем кнопку принятия (убираем старые event listener'ы)
  const newAccept = acceptBtn.cloneNode(true);
  acceptBtn.parentNode.replaceChild(newAccept, acceptBtn);
  newAccept.addEventListener('click', () => {
    modal.style.display = 'none';  // Закрываем модалку
    if (tradeSocket) {
      // Отправляем подтверждение на сервер
      tradeSocket.emit('trade:accept', {
        fromSocketId: data.fromSocketId,  // Socket-ID отправителя
        fromUserId: data.fromId,           // Telegram ID отправителя
        fromUsername: data.fromUsername,   // Имя отправителя
      });
    }
  });

  // Клонируем кнопку отклонения
  const newReject = rejectBtn.cloneNode(true);
  rejectBtn.parentNode.replaceChild(newReject, rejectBtn);
  newReject.addEventListener('click', () => {
    modal.style.display = 'none';
    if (tradeSocket) {
      tradeSocket.emit('trade:decline', { fromSocketId: data.fromSocketId });
    }
    showToast('Вы отклонили обмен', false);
  });

  modal.style.display = 'flex';  // Показываем модалку
}

// ── getMyUserId: получить мой Telegram ID ────────────────
// Через Telegram.WebApp.initDataUnsafe.user.id
// Если не в Telegram — возвращает null
function getMyUserId() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
    return window.Telegram.WebApp.initDataUnsafe.user.id;
  }
  return null;
}

// ── getMyUsername: получить моё имя ─────────────────────
// Telegram first_name → username → 'Тренер'
function getMyUsername() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    return window.Telegram.WebApp.initDataUnsafe.user.first_name ||
      window.Telegram.WebApp.initDataUnsafe.user.username || 'Тренер';
  }
  return 'Тренер';
}
