// ─────────────────────────────────────────────────────────────
// trade-window.ts — ОКНО ОБМЕНА (P2P Trade Window)
// ─────────────────────────────────────────────────────────────
// Отображает окно активного обмена между игроками.
// Показывает покемонов и предметы обеих сторон, обрабатывает
// подтверждение/отмену обмена. Работает через Socket.IO.
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (myTeam, myTradeOffers, partnerTradeOffers)
//   items       — ITEMS (все предметы)
//   dom         — showToast, escHtml
//   sprite      — getItemSpriteImg, getSpriteUrl
//   actions     — addItem
//   notifications — addNotification
//   save        — autoSave
//   profile     — refreshProfileUI
//   location    — updateMoneyDisplay
//
// ИСПОЛЬЗУЕТСЯ В: socket.ts (при начале обмена)
//
// ЭКСПОРТЫ:
//   openTradeWindow(partnerName)       — открыть окно обмена
//   renderTradeOffers()                — отрисовать офферы
//   updateTradeConfirmUI(status)       — обновить статус подтверждения
//   closeTradeWindow()                 — закрыть окно обмена
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state, getTrainerId } from '../game/state.js';  // Глобальное состояние
import { ITEMS } from '../data/items.js';                  // Все предметы
import { showToast } from '../utils/dom.js';               // Всплывающие уведомления
import { escHtml } from '../utils/dom.js';                  // Экранирование HTML (XSS)
import { getItemSpriteImg, getSpriteUrl } from '../utils/sprite.js';  // Спрайты
import { addItem } from '../game/actions.js';               // Добавление предмета
import { addNotification } from './notifications.js';        // Системные уведомления
import { autoSave } from '../game/save.js';                  // Автосохранение
import { refreshProfileUI } from './profile.js';             // Обновление профиля
import { updateMoneyDisplay } from './location.js';          // Обновление денег

// ── openTradeWindow: открыть окно обмена ─────────────────
// Принимает partnerName — имя партнёра по обмену
// Создаёт модальное окно с:
//   - Моими предлагаемыми предметами/покемонами
//   - Предложениями партнёра
//   - Сеткой для выбора покемонов и предметов
//   - Кнопками "Подтвердить" и "Отменить"
export function openTradeWindow(partnerName) {
  // Проверяем, существует ли уже модалка
  let tw = document.getElementById('trade-window-modal');
  if (!tw) {
    // ── Создание модалки ──
    tw = document.createElement('div');
    tw.id = 'trade-window-modal';
    tw.className = 'modal-overlay';
    tw.style.display = 'none';
    tw.innerHTML = `
      <div class="trade-window">
        <h2 class="m-0-0-4">Обмен с <span id="trade-partner-name"></span></h2>
        <p class="text-muted" style="font-size:0.8rem;margin:0 0 12px 0;">Выберите покемона или предмет — можно дарить без возврата</p>

        <!-- Две колонки: мои предложения / предложения партнёра -->
        <div class="trade-columns">
          <div class="trade-col">
            <h3>Вы предлагаете</h3>
            <div class="trade-offer-slot" id="trade-my-offer"><span class="text-muted">Не выбрано</span></div>
            <button class="trade-btn cancel w-full p-4 fs-07 mb-4" id="btn-trade-clear-my">Очистить</button>
            <div id="trade-my-status" class="trade-status waiting">⏳ Ожидание</div>
          </div>
          <div class="trade-col">
            <h3>Партнёр предлагает</h3>
            <div class="trade-offer-slot" id="trade-partner-offer"><span class="text-muted">Ожидание...</span></div>
            <div id="trade-partner-status" class="trade-status waiting">⏳ Ожидание</div>
          </div>
        </div>

        <!-- Зона выбора: покемоны и предметы -->
        <div id="trade-pick-area">
          <div class="trade-section-title">🐾 Покемоны:</div>
          <div class="trade-pokemon-grid" id="trade-pick-grid"></div>
          <div class="trade-section-title" style="margin-top:10px;">🎒 Предметы:</div>
          <div class="trade-pokemon-grid" id="trade-item-grid" style="grid-template-columns: repeat(4, 1fr);"></div>
        </div>

        <!-- Кнопки действий -->
        <div class="trade-actions mt-12">
          <button class="trade-btn confirm" id="btn-trade-confirm">✅ Подтвердить обмен</button>
          <button class="trade-btn cancel" id="btn-trade-cancel">✕ Отменить</button>
        </div>
      </div>
    `;
    document.body.appendChild(tw);

    // ── Обработчик: отменить обмен ──
    document.getElementById('btn-trade-cancel').addEventListener('click', () => {
      if (state.activeTradeId) state.socket.emit('trade_cancel', state.activeTradeId);
      closeTradeWindow();
    });

    // ── Обработчик: подтвердить обмен ──
    document.getElementById('btn-trade-confirm').addEventListener('click', () => {
      if (state.myTradeOffers.length === 0 && state.partnerTradeOffers.length === 0) {
        showToast('Добавьте хотя бы один предмет или покемона для обмена!', true);
        return;
      }
      state.socket.emit('trade_confirm', state.activeTradeId);  // Отправляем подтверждение
      // Блокируем кнопку
      document.getElementById('btn-trade-confirm').textContent = '✓ Ожидание партнёра...';
      document.getElementById('btn-trade-confirm').disabled = true;
      document.getElementById('btn-trade-confirm').style.opacity = '0.5';
    });

    // ── Обработчик: очистить мои предложения ──
    document.getElementById('btn-trade-clear-my').addEventListener('click', () => {
      state.myTradeOffers = [];
      state.socket.emit('trade_offer', { tradeId: state.activeTradeId, offers: [] });
      renderTradeOffers();
      renderTradePickGrid();
      renderTradeItemGrid();
      const conf = document.getElementById('btn-trade-confirm');
      conf.textContent = '✅ Подтвердить обмен';
      conf.disabled = false;
      conf.style.opacity = '1';
    });

    // ── Закрытие по клику на фон ──
    tw.addEventListener('click', (e) => {
      if (e.target === tw) {
        if (state.activeTradeId) state.socket.emit('trade_cancel', state.activeTradeId);
        closeTradeWindow();
      }
    });
  }

  // ── Сброс состояния при открытии ──
  state.myTradeOffers = [];
  state.partnerTradeOffers = [];
  document.getElementById('trade-partner-name').textContent = partnerName;
  // Сбрасываем UI в исходное состояние
  document.getElementById('trade-my-status').textContent = '⏳ Ожидание';
  document.getElementById('trade-my-status').className = 'trade-status waiting';
  document.getElementById('trade-partner-status').textContent = '⏳ Ожидание';
  document.getElementById('trade-partner-status').className = 'trade-status waiting';
  document.getElementById('btn-trade-confirm').textContent = '✅ Подтвердить обмен';
  document.getElementById('btn-trade-confirm').disabled = false;
  document.getElementById('btn-trade-confirm').style.opacity = '1';

  // Отрисовываем всё
  renderTradeOffers();
  renderTradePickGrid();
  renderTradeItemGrid();

  // Прячем торговый центр, показываем окно обмена
  const tcm = document.getElementById('trade-center-modal');
  if (tcm) tcm.style.display = 'none';
  tw.style.display = 'flex';
}

// ── renderTradePickGrid: отрисовка сетки покемонов для выбора ──
// Показывает всех покемонов в команде.
// Кликнутые — добавляются в myTradeOffers (с типом 'pokemon')
// Нельзя отдать единственного покемона (untradeable)
function renderTradePickGrid() {
  const grid = document.getElementById('trade-pick-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (state.myTeam.length === 0) {
    grid.innerHTML = '<div class="text-center text-muted p-20 gc-all">У вас нет покемонов для обмена</div>';
    return;
  }

  // Set UID уже предложенных покемонов (для подсветки)
  const offeredUids = new Set(state.myTradeOffers.filter(o => o.type === 'pokemon').map(o => o.data.uid));

  state.myTeam.forEach((m, i) => {
    const card = document.createElement('div');
    card.className = 'trade-pokemon-card';
    if (offeredUids.has(m.uid)) card.classList.add('selected');  // Подсвечиваем выбранных

    // Нельзя отдать единственного покемона (если не выбран другой)
    const untradeable = state.myTeam.length <= 1 && !offeredUids.has(m.uid);
    if (untradeable) {
      card.classList.add('untradeable');
      card.title = 'Нельзя отдать единственного покемона';
    }

    card.innerHTML = `
      <img src="${m.sprite || getSpriteUrl(m)}" alt="${m.apiData?.name || '?'}" loading="lazy">
      <div class="name">${escHtml(m.nickname || m.apiData?.name || '???')}</div>
      <div class="lvl">Lv${m.baseLevel + (m.candiesEaten || 0)}</div>
    `;

    if (!untradeable) {
      card.addEventListener('click', () => {
        if (offeredUids.has(m.uid)) {
          // Убираем из предложений
          state.myTradeOffers = state.myTradeOffers.filter(o => !(o.type === 'pokemon' && o.data.uid === m.uid));
        } else {
          // Добавляем в предложения
          state.myTradeOffers.push({ type: 'pokemon', data: m });
        }
        // Отправляем обновление партнёру
        state.socket.emit('trade_offer', { tradeId: state.activeTradeId, offers: state.myTradeOffers });
        renderTradeOffers();
        renderTradePickGrid();  // Перерисовываем (обновляем подсветку)
      });
    }

    grid.appendChild(card);
  });
}

// ── renderTradeItemGrid: отрисовка сетки предметов для выбора ──
// Показывает все предметы в инвентаре (кроме наград)
// Кликнутые — добавляются в myTradeOffers (с типом 'item')
// Для кредитов — показывает prompt с вводом суммы
function renderTradeItemGrid() {
  const grid = document.getElementById('trade-item-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Фильтруем предметы: есть в наличии И реализованы И не награды
  const tradeItems = ITEMS.filter(item =>
    (state.inventory[item.id] || 0) > 0 && item.implemented !== false && item.category !== 'awards'
  );

  if (tradeItems.length === 0) {
    grid.innerHTML = '<div class="text-center text-muted p-10 gc-all fs-08">Нет предметов</div>';
    return;
  }

  const offeredItemIds = new Set(state.myTradeOffers.filter(o => o.type === 'item').map(o => o.data.id));

  tradeItems.forEach(item => {
    const qty = state.inventory[item.id] || 0;
    const card = document.createElement('div');
    card.className = 'trade-pokemon-card';
    if (offeredItemIds.has(item.id)) card.classList.add('selected');  // Подсвечиваем выбранные

    card.innerHTML = `
      <div>${getItemSpriteImg(item.id, 32)}</div>
      <div class="name">${item.nameRu}</div>
      <div class="lvl">x${Math.min(qty, 99)}</div>
    `;

    card.addEventListener('click', () => {
      if (item.id === 'credit') {
        // ── Особый случай: кредиты ──
        // Показываем prompt с вводом количества
        const amount = prompt('Сколько кредитов (¥) отправить? Макс: ' + (state.inventory['credit'] || 0), '1000');
        if (!amount || isNaN(Number(amount)) || parseInt(amount) <= 0) return;
        const qty = Math.min(parseInt(amount), state.inventory['credit'] || 0);
        if (qty <= 0) { showToast('Недостаточно кредитов!', true); return; }
        // Удаляем старый оффер кредитов (если есть)
        state.myTradeOffers = state.myTradeOffers.filter(o => !(o.type === 'item' && o.data.id === 'credit'));
        state.myTradeOffers.push({ type: 'item', data: { id: 'credit', name: '¥ Кредиты', qty } });
      } else {
        // ── Обычный предмет ──
        if (offeredItemIds.has(item.id)) {
          state.myTradeOffers = state.myTradeOffers.filter(o => !(o.type === 'item' && o.data.id === item.id));
        } else {
          state.myTradeOffers.push({ type: 'item', data: { id: item.id, name: item.nameRu, qty: 1 } });
        }
      }
      // Отправляем обновление партнёру и перерисовываем
      state.socket.emit('trade_offer', { tradeId: state.activeTradeId, offers: state.myTradeOffers });
      renderTradeOffers();
      renderTradeItemGrid();
      renderTradePickGrid();
    });

    grid.appendChild(card);
  });
}

// ── renderTradeOffers: отрисовка предложений обеих сторон ──
// Показывает, что выбрано у меня и у партнёра
export function renderTradeOffers() {
  const myDiv = document.getElementById('trade-my-offer');
  const pDiv = document.getElementById('trade-partner-offer');
  if (!myDiv || !pDiv) return;

  // Внутренняя функция: массив офферов → HTML
  const renderOffers = (offers) => {
    if (!Array.isArray(offers) || offers.length === 0) return '<span class="text-muted">Не выбрано</span>';
    return offers.map(o => {
      if (o.type === 'pokemon') {
        const m = o.data;
        return `<div class="trade-offer-entry"><img class="trade-offer-sprite" src="${m.sprite || getSpriteUrl(m)}" alt="${escHtml(m.apiData?.name || '?')}"><div class="trade-offer-name">${escHtml(m.nickname || m.apiData?.name || '???')}</div><div class="trade-offer-level">Lv${m.baseLevel + (m.candiesEaten || 0)}</div></div>`;
      }
      if (o.type === 'item') {
        const it = o.data;
        return `<div class="trade-offer-entry"><div>${getItemSpriteImg(it.id, 32)}</div><div class="trade-offer-name">${it.name}</div><div class="trade-offer-level">x${it.qty || 1}</div></div>`;
      }
      return '';
    }).join('');
  };

  myDiv.innerHTML = renderOffers(state.myTradeOffers);
  myDiv.className = state.myTradeOffers.length > 0 ? 'trade-offer-slot filled' : 'trade-offer-slot';

  pDiv.innerHTML = renderOffers(state.partnerTradeOffers);
  pDiv.className = state.partnerTradeOffers.length > 0 ? 'trade-offer-slot filled' : 'trade-offer-slot';
}

// ── updateTradeConfirmUI: обновление UI подтверждения ────
// Принимает status: { p1: boolean, p2: boolean }
// Обновляет статусы: "✅ Готов" или "⏳ Ожидание"
export function updateTradeConfirmUI(status) {
  if (!status || typeof status.p1 === 'undefined' || typeof status.p2 === 'undefined') return;

  const myEl = document.getElementById('trade-my-status');
  const partnerEl = document.getElementById('trade-partner-status');
  if (!myEl || !partnerEl) return;

  // Определяем, кто P1 (первый), кто P2 (второй)
  let myConfirmed, partnerConfirmed;
  if (state.iAmP1) {
    myConfirmed = status.p1;
    partnerConfirmed = status.p2;
  } else {
    myConfirmed = status.p2;
    partnerConfirmed = status.p1;
  }

  // Обновляем статусы
  myEl.textContent = myConfirmed ? '✅ Готов' : '⏳ Ожидание';
  myEl.className = myConfirmed ? 'trade-status ready' : 'trade-status waiting';

  partnerEl.textContent = partnerConfirmed ? '✅ Готов' : '⏳ Ожидание';
  partnerEl.className = partnerConfirmed ? 'trade-status ready' : 'trade-status waiting';

  // Если я подтвердил — блокируем кнопку
  if (myConfirmed) {
    const btn = document.getElementById('btn-trade-confirm');
    btn.textContent = '✓ Ожидание партнёра...';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
}

// ── closeTradeWindow: закрыть окно обмена ────────────────
// Скрывает модалку, сбрасывает состояние торговли
export function closeTradeWindow() {
  const tw = document.getElementById('trade-window-modal');
  if (tw) tw.style.display = 'none';
  // Сбрасываем состояние
  state.activeTradeId = null;
  state.myTradeOffers = [];
  state.partnerTradeOffers = [];
}
