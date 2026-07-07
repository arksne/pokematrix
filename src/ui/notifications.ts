// ─────────────────────────────────────────────────────────────
// notifications.ts — СИСТЕМА УВЕДОМЛЕНИЙ
// ─────────────────────────────────────────────────────────────
// Управляет внутриигровыми уведомлениями: создаёт новые,
// обновляет счётчик непрочитанных на бейдже и открывает
// модальное окно со списком всех уведомлений.
// Уведомления хранятся в state.notifications (не более 50 записей).
//
// ЗАВИСИМОСТИ:
//   state — глобальное состояние (state.notifications)
//   store — store.emit('save') для сохранения
//
// ИСПОЛЬЗУЕТСЯ В:
//   socket.ts      → addNotification (PvP-события)
//   init.ts        → openNotifications, updateNotifBadge, addNotification
//   npcs.ts        → addNotification (награды за квесты)
//   daycare.ts     → addNotification (новые яйца)
//
// ЭКСПОРТЫ:
//   addNotification(title, text)  — добавить уведомление
//   updateNotifBadge()            — обновить бейдж непрочитанных
//   openNotifications()           — открыть модалку со списком
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';      // Глобальное состояние (notifications)
import { store } from '../game/store.js';        // Event-система (emit 'save')

// ── addNotification: создание нового уведомления ────────
// Принимает title (заголовок) и text (текст уведомления)
// Вставляет в начало массива, обрезает до 50, обновляет бейдж
export function addNotification(title: string, text: string) {
  // Добавляем в начало массива (unshift — вставка в начало)
  // Каждое уведомление: { id, title, text, time, read }
  state.notifications.unshift({
    id: Date.now(),                     // Уникальный ID (на основе времени)
    title,                               // Заголовок (например, "🎉 Яйцо вылупилось!")
    text,                                // Текст (например, "Pikachu появился на свет!")
    time: new Date().toISOString(),      // Время создания (ISO строка)
    read: false                          // Непрочитано
  });

  // Ограничение: не более 50 уведомлений (обрезаем хвост)
  if (state.notifications.length > 50) state.notifications.length = 50;

  updateNotifBadge();  // Обновляем счётчик на бейдже
  store.emit('save');  // Сохраняем
}

// ── updateNotifBadge: обновление бейджа непрочитанных ───
// Считает количество непрочитанных уведомлений
// Если > 0 — показывает число на бейдже, иначе скрывает
export function updateNotifBadge() {
  // Фильтруем: только те, где read === false
  const unread = state.notifications.filter((n: any) => !n.read).length;
  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.textContent = String(unread || '');  // Число или пусто
    badge.style.display = unread > 0 ? '' : 'none';  // Показываем если > 0
  }
}

// ── openNotifications: открыть модалку уведомлений ──────
// Отрисовывает все уведомления (последние сверху)
// Помечает все как прочитанные при открытии
export function openNotifications() {
  const modal = document.getElementById('notif-modal');
  if (!modal) return;

  const list = document.getElementById('notif-list');

  // Если нет уведомлений — показываем "Нет уведомлений"
  list!.innerHTML = state.notifications.length === 0
    ? '<div class="text-center text-muted" class="p-20">Нет уведомлений</div>'
    : state.notifications.map((n: any) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <b>${n.title}</b>           <!-- Заголовок жирным -->
        <p>${n.text}</p>             <!-- Текст -->
        <small>${new Date(n.time).toLocaleString('ru')}</small>  <!-- Дата по-русски -->
      </div>
    `).join('');

  // Помечаем все уведомления как прочитанные
  state.notifications.forEach((n: any) => n.read = true);
  updateNotifBadge();  // Скрываем бейдж

  // Показываем модалку
  modal.style.display = 'flex';
}
