// ─────────────────────────────────────────────────────────────
// trade-request.ts — МОДАЛКА ЗАПРОСА НА ОБМЕН
// ─────────────────────────────────────────────────────────────
// Показывает модалку при входящем запросе на обмен от другого
// игрока. Позволяет принять или отклонить предложение.
//
// ЗАВИСИМОСТИ:
//   state — глобальное состояние (state.socket для отправки ответа)
//
// ИСПОЛЬЗУЕТСЯ В: socket.ts (при получении события 'trade_request')
//                  trade.js (аналогичная модалка через Socket.IO)
//
// ЭКСПОРТЫ:
//   showTradeRequestModal(fromUsername, fromId) — показать модалку
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';  // Глобальное состояние (state.socket)

// ── showTradeRequestModal: показать модалку запроса на обмен ──
// Принимает:
//   fromUsername — имя тренера, который хочет обменяться
//   fromId — ID тренера в Telegram
//
// Создаёт модальное окно с:
//   - Текст: "Тренер X хочет обменяться с вами!"
//   - Кнопка "Принять" → socket.emit('trade_accept', fromId)
//   - Кнопка "Отклонить" → socket.emit('trade_reject', fromId)
//   - Закрытие по клику на фон = отклонить
export function showTradeRequestModal(fromUsername, fromId) {
  // Проверяем, существует ли уже модалка в DOM
  let rm = document.getElementById('trade-request-modal');
  if (!rm) {
    // Создаём модалку (один раз)
    rm = document.createElement('div');
    rm.id = 'trade-request-modal';
    rm.className = 'trade-request-overlay';
    rm.innerHTML = `
      <div class="trade-request-box">
        <h3>🤝 Предложение обмена</h3>
        <p>Тренер <strong id="trade-req-username"></strong> хочет обменяться с вами!</p>
        <div class="trade-request-buttons">
          <button class="trade-btn accept" id="btn-trade-accept">Принять</button>
          <button class="trade-btn reject" id="btn-trade-reject">Отклонить</button>
        </div>
      </div>
    `;
    document.body.appendChild(rm);
  }

  // Сначала очищаем старые обработчики (чтобы избежать дубликатов при повторных вызовах)
  if (rm._cleanup) rm._cleanup();

  // Устанавливаем имя отправителя
  document.getElementById('trade-req-username').textContent = fromUsername || 'Тренер';
  rm.style.display = 'flex';  // Показываем модалку

  // ── Функция: принять запрос ──
  const accept = () => {
    state.socket.emit('trade_accept', fromId);  // Отправляем подтверждение
    rm.style.display = 'none';
    cleanup();  // Снимаем обработчики
  };

  // ── Функция: отклонить запрос ──
  const reject = () => {
    state.socket.emit('trade_reject', fromId);  // Отправляем отказ
    rm.style.display = 'none';
    cleanup();
  };

  // ── Очистка обработчиков ──
  const cleanup = () => {
    document.getElementById('btn-trade-accept').removeEventListener('click', accept);
    document.getElementById('btn-trade-reject').removeEventListener('click', reject);
    rm.removeEventListener('click', overlayClick);
    rm._cleanup = null;
  };

  // ── Закрытие по клику на фон = отклонить ──
  const overlayClick = (e: MouseEvent) => {
    if (e.target === rm) reject();
  };

  // Сохраняем cleanup для следующего вызова
  rm._cleanup = cleanup;

  // Регистрируем обработчики
  document.getElementById('btn-trade-accept').addEventListener('click', accept);
  document.getElementById('btn-trade-reject').addEventListener('click', reject);
  rm.addEventListener('click', overlayClick);
}
