// ─────────────────────────────────────────────────────────────
// trade-center.ts — ТОРГОВЫЙ ЦЕНТР (Trade Center)
// ─────────────────────────────────────────────────────────────
// Открывает панель торгового центра — список доступных для обмена
// и PvP-тренеров в сети. Инициализирует Socket.IO для обмена.
//
// ЗАВИСИМОСТИ:
//   state   — глобальное состояние (onlinePlayersList, myTeam, lastSocketAction)
//   config  — SOCKET_COOLDOWN (задержка между запросами)
//   dom     — showToast
//   socket  — initTradeSocket (инициализация сокета)
//
// ИСПОЛЬЗУЕТСЯ В: location.ts (кнопка "Торговый центр" в покецентре)
//
// ЭКСПОРТЫ:
//   openTradeCenter()      — открыть панель торгового центра
//   renderTradePlayerList()— отрисовать список игроков онлайн
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';              // Глобальное состояние
import { SOCKET_COOLDOWN } from '../game/config.js';    // Задержка между действиями (мс)
import { showToast } from '../utils/dom.js';              // Всплывающие уведомления
import { initTradeSocket } from '../network/socket.js';   // Инициализация сокета

// ── openTradeCenter: открыть панель торгового центра ────
// Создаёт модальное окно со списком онлайн-игроков
// Каждый игрок имеет кнопки "Трейд" и "⚔" (PvP)
export function openTradeCenter() {
  initTradeSocket();  // Инициализируем сокет (если ещё нет)

  // Проверяем, существует ли уже модалка
  let tc = document.getElementById('trade-center-modal');
  if (!tc) {
    // Создаём модалку (один раз)
    tc = document.createElement('div');
    tc.id = 'trade-center-modal';
    tc.className = 'modal-overlay';
    tc.style.display = 'none';
    tc.innerHTML = `
      <div class="trade-container">
        <h2 class="m-0-0-4">🤝 Глобальный Обменник</h2>
        <p class="text-muted fs-085 m-0-0-12">Выберите тренера в сети, чтобы предложить обмен</p>
        <div id="trade-players-list" class="trade-players-list"></div>  <!-- Список игроков -->
        <button class="trade-btn" id="btn-trade-center-close" style="width:100%;background:var(--tma-text-muted);">Закрыть</button>
      </div>
    `;
    document.body.appendChild(tc);

    // Кнопка закрытия
    document.getElementById('btn-trade-center-close').addEventListener('click', () => {
      tc.style.display = 'none';
    });

    // Закрытие по клику на фон
    tc.addEventListener('click', (e) => { if (e.target === tc) tc.style.display = 'none'; });
  }

  renderTradePlayerList();  // Отрисовываем список игроков
  tc.style.display = 'flex';  // Показываем модалку
}

// ── renderTradePlayerList: отрисовка списка онлайн-игроков ──
// Для каждого игрока в onlinePlayersList создаёт строку с:
//   - Именем тренера
//   - Кнопкой "Трейд" (отправить запрос на обмен)
//   - Кнопкой "⚔" (отправить PvP-вызов)
// Использует SOCKET_COOLDOWN для предотвращения спама
export function renderTradePlayerList() {
  const list = document.getElementById('trade-players-list');
  if (!list) return;
  list.innerHTML = '';  // Очищаем список

  // Если нет игроков онлайн — сообщение
  if (state.onlinePlayersList.length === 0) {
    list.innerHTML = '<div class="text-center text-muted p-30-0">Нет тренеров в сети<br><span class="fs-08">Подождите или зайдите позже</span></div>';
    return;
  }

  // Проходим по всем онлайн-игрокам
  state.onlinePlayersList.forEach(p => {
    const row = document.createElement('div');
    row.className = 'trade-player-row';  // Строка: имя + кнопки

    // Имя тренера
    const nameSpan = document.createElement('span');
    nameSpan.className = 'trade-player-name';
    nameSpan.textContent = p.username || 'Тренер';

    // Контейнер для кнопок
    const btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:4px;';

    // ── Кнопка "Трейд" (предложение обмена) ──
    const tradeBtn = document.createElement('button');
    tradeBtn.className = 'trade-btn';
    tradeBtn.textContent = 'Трейд';
    tradeBtn.onclick = () => {
      const now = Date.now();
      // Проверяем cooldown (защита от спама)
      if (now - state.lastSocketAction < SOCKET_COOLDOWN) {
        showToast('Слишком часто!', true); return;
      }
      state.lastSocketAction = now;
      // Отправляем запрос на обмен через Socket.IO
      state.socket.emit('trade_request', p.id);
      // Визуальная обратная связь: галочка на 5 секунд
      tradeBtn.textContent = '✓';
      tradeBtn.disabled = true;
      tradeBtn.style.opacity = '0.5';
      setTimeout(() => {
        tradeBtn.textContent = 'Трейд';
        tradeBtn.disabled = false;
        tradeBtn.style.opacity = '1';
      }, 5000);
    };

    // ── Кнопка "⚔" (PvP-вызов) ──
    const battleBtn = document.createElement('button');
    battleBtn.className = 'trade-btn';
    battleBtn.style.background = '#ff3b30';  // Красная
    battleBtn.textContent = '⚔';
    battleBtn.onclick = () => {
      const now = Date.now();
      if (now - state.lastSocketAction < SOCKET_COOLDOWN) {
        showToast('Слишком часто!', true); return;
      }
      state.lastSocketAction = now;
      // Проверяем, есть ли живые покемоны
      if (state.myTeam.length === 0 || !state.myTeam.some(m => m.currentHp > 0)) {
        showToast('Нужен хотя бы один живой покемон!', true);
        return;
      }
      state.socket.emit('pvp_challenge', p.id);  // Отправляем PvP-вызов
      battleBtn.textContent = '✓';
      battleBtn.disabled = true;
      battleBtn.style.opacity = '0.5';
      setTimeout(() => {
        battleBtn.textContent = '⚔';
        battleBtn.disabled = false;
        battleBtn.style.opacity = '1';
      }, 5000);
    };

    btnWrap.appendChild(tradeBtn);
    btnWrap.appendChild(battleBtn);
    row.appendChild(nameSpan);
    row.appendChild(btnWrap);
    list.appendChild(row);
  });
}
