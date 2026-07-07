// ─────────────────────────────────────────────────────────────
// chat.ts — ЧАТ-СИСТЕМА
// ─────────────────────────────────────────────────────────────
// Загружает сообщения чата с сервера, отрисовывает их в DOM,
// реализует периодический polling (каждые 30 сек) и real-time
// обновления через Socket.IO. Также отправляет новые сообщения
// с авторизацией через Telegram.
//
// ЗАВИСИМОСТИ:
//   config              — API_BASE (URL сервера)
//   getters             — getSocket (Socket.IO клиент)
//   trainer-profile     — openTrainerProfile (открытие профиля по клику)
//   save                — getCloudAuthHeaders (авторизация Telegram)
//
// ИСПОЛЬЗУЕТСЯ В:
//   socket.ts           — initChatSocket (real-time события)
//   init.ts             — sendChatMessage (отправка)
//   nav.ts              — loadChatMessages, startChatPolling, stopChatPolling
//
// ЭКСПОРТЫ:
//   loadChatMessages   — загрузка сообщений с сервера
//   startChatPolling   — запуск интервального polling (30 сек)
//   initChatSocket     — подписка на real-time события chat_message
//   stopChatPolling    — остановка polling-интервала
//   sendChatMessage    — отправка сообщения (POST /chat/send)
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { API_BASE } from '../game/config.js';                  // URL сервера
import { getSocket } from '../game/getters.js';                  // Геттер Socket.IO
import { openTrainerProfile } from '../social/trainer-profile.js';  // Профиль тренера
import { getCloudAuthHeaders } from '../game/save.js';            // Авторизация

// ── СОСТОЯНИЕ МОДУЛЯ ─────────────────────────────────────
let chatPollingInterval: any = null;     // ID интервала polling'а
let chatLastTimestamp: string | null = null;  // Время последнего загруженного сообщения (ISO)

// ── loadChatMessages: загрузка сообщений с сервера ──────
// GET /chat/messages?since=... (без since — все сообщения)
// Добавляет новые сообщения в DOM-контейнер
export async function loadChatMessages() {
  try {
    // Если есть timestamp — грузим только новые сообщения
    const url = chatLastTimestamp
      ? `${API_BASE}/chat/messages?since=${encodeURIComponent(chatLastTimestamp)}`
      : `${API_BASE}/chat/messages`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.messages) return;  // Нет сообщений

    const container = document.getElementById('chat-messages');

    // При первой загрузке (нет timestamp) — очищаем и заполняем полностью
    if (!chatLastTimestamp && data.messages.length > 0) {
      container.innerHTML = '';
    }

    // Проходим по всем новым сообщениям
    data.messages.forEach(msg => {
      renderChatMessage(msg, container);          // Отрисовываем
      chatLastTimestamp = msg.created_at;          // Обновляем timestamp
    });

    // Авто-скролл вниз (к последнему сообщению)
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    console.warn('Chat load failed', e);
  }
}

// ── renderChatMessage: отрисовка одного сообщения чата ──
// Создаёт DOM-элемент с:
//   - Именем (кликабельно → профиль)
//   - Текстом сообщения
//   - Временем (HH:mm)
function renderChatMessage(msg: any, container: HTMLElement) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.setAttribute('data-msg-id', msg.id);  // ID для предотвращения дубликатов

  // Имя: first_name → username → Trainer#ID
  const name = msg.first_name || msg.username || `Trainer#${msg.user_id}`;
  // Время: берём из ISO строки символы 11-16 → "14:30"
  const time = msg.created_at ? msg.created_at.slice(11, 16) : '';

  // HTML: имя (синее, кликабельное) + текст + время (серое, справа)
  div.innerHTML = `
    <span class="chat-msg-username" data-user-id="${msg.user_id}">${escapeHtml(name)}:</span>
    <span class="chat-msg-text">${escapeHtml(msg.text)}</span>
    <span class="chat-msg-time">${time}</span>
  `;
  container.appendChild(div);

  // ── Клик по имени → открытие профиля тренера ──
  const usernameEl = div.querySelector('.chat-msg-username');
  usernameEl!.addEventListener('click', () => openTrainerProfile(msg.user_id));
}

// ── escapeHtml: экранирование HTML-спецсимволов ────────
// Защита от XSS: превращает <script> в &lt;script&gt;
function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;          // Автоматическое экранирование
  return d.innerHTML;            // Извлекаем экранированный HTML
}

// ── startChatPolling: запуск polling'а ─────────────────
// Останавливает предыдущий polling (если был) и запускает новый
// Интервал: 30 секунд (запасной вариант если Socket.IO не работает)
export function startChatPolling() {
  stopChatPolling();  // Останавливаем старый
  chatPollingInterval = setInterval(loadChatMessages, 30000);  // Каждые 30 сек
}

// ── initChatSocket: инициализация real-time чата через Socket.IO ──
// Подписывается на событие 'chat_message' от сервера
// При получении нового сообщения — отрисовывает его (если нет дубликата)
export function initChatSocket() {
  const s = getSocket();
  if (!s) return;

  s.off('chat_message');  // Удаляем старый обработчик (чтобы не было дубликатов)
  s.on('chat_message', (msg: any) => {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    // Проверка на дубликат (если сообщение уже пришло через polling)
    const existing = container.querySelector(`[data-msg-id="${msg.id}"]`);
    if (existing) return;

    renderChatMessage(msg, container);
    container.scrollTop = container.scrollHeight;
    chatLastTimestamp = msg.created_at;
  });
}

// ── stopChatPolling: остановка polling'а ────────────────
// Очищает интервал, чтобы не тратить ресурсы когда чат не активен
export function stopChatPolling() {
  if (chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
  }
}

// ── sendChatMessage: отправка сообщения ─────────────────
// Берёт текст из поля ввода #chat-input, отправляет POST /chat/send
// Если не авторизован — показывает предупреждение
export async function sendChatMessage() {
  const input = document.getElementById('chat-input') as HTMLInputElement;
  const text = input.value.trim();
  if (!text) return;  // Пустое сообщение — игнорируем

  const headers = getCloudAuthHeaders();
  if (!headers.Authorization) {
    // ── Не авторизован ──
    input.value = '';
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-system-msg';
    div.innerText = 'Авторизуйтесь через Telegram для отправки сообщений';
    container.appendChild(div);
    return;
  }

  try {
    // Отправляем сообщение на сервер
    await fetch(`${API_BASE}/chat/send`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    input.value = '';  // Очищаем поле ввода
    await loadChatMessages();  // Загружаем обновлённый чат
  } catch (e) {
    console.warn('Chat send failed', e);
  }
}
