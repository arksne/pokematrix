// ─────────────────────────────────────────────────────────────
// trainers.ts — ВКЛАДКА ТРЕНЕРОВ (Social)
// ─────────────────────────────────────────────────────────────
// Отображает список всех тренеров, онлайн-статус, локацию.
// Позволяет открыть профиль тренера для торговли/PvP.
// Также управляет никнеймом текущего игрока.
//
// ЗАВИСИМОСТИ:
//   getters         — getSocialState, setTrainerNickname
//   trainer-profile — openTrainerProfile (профиль тренера)
//   state           — lsKey (ключ localStorage)
//   trainer-card    — renderTrainerCard (карточка в чате)
//   save            — autoSave
//   dom             — showToast, escHtml
//
// ИСПОЛЬЗУЕТСЯ В: nav.ts (вкладка "Тренеры")
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

// getSocialState — возвращает объект социального состояния:
//   onlinePlayersList — массив {userId} игроков онлайн
//   trainerNickname — никнейм текущего тренера
//   tgUser — данные Telegram пользователя
// setTrainerNickname — устанавливает новый никнейм через store.dispatch
import { getSocialState, setTrainerNickname } from '../game/getters.js';
// openTrainerProfile — открывает модалку профиля другого тренера
//   Показывает его команду, значки, позволяет вызвать на PvP/торговлю
import { openTrainerProfile } from '../social/trainer-profile.js';
// lsKey — генерирует ключ localStorage с префиксом 'league17_'
//   Например: lsKey('avatar') => 'league17_avatar'
import { lsKey } from '../game/state.js';
// renderTrainerCard — отрисовывает карточку текущего тренера (в чате)
//   Показывает никнейм, аватар, онлайн-статус
import { renderTrainerCard } from './trainer-card.js';
// autoSave — сохраняет игру в localStorage и на сервер
import { autoSave } from '../game/save.js';
// showToast — всплывающее уведомление (true=красное/ошибка, false=зелёное/успех)
// escHtml — экранирует HTML-спецсимволы (защита от XSS-атак)
import { showToast, escHtml } from '../utils/dom.js';

// ── ЛОКАЛЬНОЕ СОСТОЯНИЕ ─────────────────────────────────
// Все данные тренеров для текущей вкладки (загружаются с сервера)
// Формат: [{id, nickname, avatar, badges, teamSize, region, lastSeen, registered}, ...]
let trainersAllData = [];

// ── loadAllTrainers: загрузка списка всех тренеров с сервера ──
// GET /api/profile/trainers/all — возвращает массив тренеров
// Для каждого тренера создаёт карточку с: аватаром, именем, онлайн-статусом,
//   количеством значков, размером команды, регионом, последним визитом
// При клике открывает профиль тренера (openTrainerProfile)
export async function loadAllTrainers() {
  // Находим контейнер списка тренеров
  const listEl = document.getElementById('trainers-all-list');
  if (!listEl) return;  // Элемента нет на странице — выходим

  // Показываем "Загрузка..." пока ждём ответ от сервера
  listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">Загрузка...</div>';

  try {
    // Запрашиваем список тренеров с сервера
    const res = await fetch('/api/profile/trainers/all');
    const data = await res.json();
    trainersAllData = data.users || [];  // Сохраняем в локальное состояние

    // Если тренеров нет — показываем сообщение
    if (trainersAllData.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:30px;">Нет тренеров</div>';
      return;
    }

    // Очищаем контейнер перед заполнением
    listEl.innerHTML = '';

    // Проходим по всем тренерам и создаём карточки
    trainersAllData.forEach(u => {
      const card = document.createElement('div');
      card.className = 'trainer-list-card';  // CSS класс для стилизации

      // ── Аватар ──
      // Если аватар лежит на сервере (/avatars/) — показываем как <img>
      // Иначе — показываем эмодзи (👤 или выбранный)
      const avatarHtml = (u.avatar && u.avatar.startsWith('/avatars/'))
        ? `<img src="${u.avatar}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : `<span style="font-size:1.5rem;">${u.avatar || '👤'}</span>`;

      // ── Последний визит ──
      // Парсим ISO дату: "2026-07-05T14:30:00.000Z" → "2026-07-05 14:30"
      const lastSeen = u.lastSeen
        ? u.lastSeen.slice(0, 16).replace('T', ' ')
        : u.created_at?.slice(0, 10) || '';

      // ── Онлайн-статус ──
      // Проверяем: есть ли userId тренера в списке onlinePlayersList
      // Список обновляется через Socket.IO (сервер присылает кто онлайн)
      const isOnline = getSocialState().onlinePlayersList.some(p => p.userId === u.id);
      // Зелёная точка с glow для онлайн, серая — для офлайн
      const onlineDot = isOnline
        ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;margin-right:4px;box-shadow:0 0 4px #34c759;"></span>'
        : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;margin-right:4px;"></span>';

      // Заполняем HTML карточки:
      //   — Аватар (слева)
      //   — Имя с онлайн-точкой, значок регистрации
      //   — Количество значков 🏅 и размер команды 🐾
      //   — Регион 📍 и время последнего визита 🕐
      card.innerHTML = `
        <div class="trainer-list-avatar">${avatarHtml}</div>
        <div class="trainer-list-info">
          <div class="trainer-list-name">
            ${onlineDot}${escHtml(u.nickname || u.first_name || u.username || 'Тренер')}
            ${u.registered ? '✅' : '🆕'}
          </div>
          <div class="trainer-list-id">🏅${u.badges||0} | 🐾${u.teamSize||0}</div>
          <div class="trainer-list-id">📍${u.region || '?'} | 🕐${lastSeen}</div>
        </div>`;

      // При клике на карточку — открываем профиль тренера
      card.addEventListener('click', () => openTrainerProfile(u.id));
      listEl.appendChild(card);
    });
  } catch(e) {
    // Если сервер не ответил — показываем сообщение об ошибке
    listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">Ошибка загрузки</div>';
  }
}

// ── initTrainersTab: инициализация вкладки тренеров ─────
// Вешает обработчики на переключение вкладок (все тренеры / аккаунт)
// И на кнопку сохранения настроек аккаунта
export function initTrainersTab() {
  // ── Переключение вкладок ──
  document.querySelectorAll('.trainers-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Снимаем 'active' со всех табов
      document.querySelectorAll('.trainers-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');  // Активируем текущий

      // Получаем ID панели из data-атрибута
      const panel = tab.getAttribute('data-tab');
      // Показываем соответствующую панель, скрываем другую
      document.getElementById('trainers-all-panel').style.display = panel === 'all' ? 'block' : 'none';
      document.getElementById('trainers-account-panel').style.display = panel === 'account' ? 'block' : 'none';

      // При переключении — подгружаем данные
      if (panel === 'all') loadAllTrainers();       // Список всех тренеров
      if (panel === 'account') showAccountPanel();  // Настройки аккаунта
    });
  });

  // ── Кнопка сохранения настроек аккаунта ──
  const saveBtn = document.getElementById('btn-account-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // Читаем и обрезаем никнейм из поля ввода
      const nickname = (document.getElementById('account-nickname') as HTMLInputElement).value.trim();
      setTrainerNickname(nickname);  // Сохраняем в глобальное состояние (через store)

      // Читаем выбранный аватар из выпадающего списка
      const avatar = (document.getElementById('account-avatar-select') as HTMLSelectElement).value;
      // Сохраняем в localStorage (чтобы не сбрасывалось при перезагрузке)
      localStorage.setItem(lsKey('avatar'), avatar);
      localStorage.setItem(lsKey('nickname_'), getSocialState().trainerNickname);

      // Обновляем UI
      showAccountPanel();     // Показываем обновлённые данные
      renderTrainerCard();    // Обновляем карточку тренера в чате
      autoSave();             // Сохраняем игру
      showToast('Сохранено!', false);  // Зелёное уведомление
    });
  }
}

// ── showAccountPanel: отображение панели настроек аккаунта ──
// Заполняет все поля формы: аватар, имя, Telegram ID, поле ввода ника, выбор аватара
export function showAccountPanel() {
  // Отображаем аватар (из localStorage, с fallback на 👤)
  document.getElementById('account-avatar').textContent =
    localStorage.getItem(lsKey('avatar')) || '👤';

  // Отображаем имя: никнейм → Telegram first_name → 'Тренер'
  document.getElementById('account-name').textContent =
    getSocialState().trainerNickname || getSocialState().tgUser?.first_name || 'Тренер';

  // Отображаем Telegram ID (или '?' если нет)
  document.getElementById('account-id').textContent =
    `Telegram ID: ${getSocialState().tgUser?.id || '?'}`;

  // Заполняем поле ввода никнейма
  (document.getElementById('account-nickname') as HTMLInputElement).value =
    getSocialState().trainerNickname || '';

  // Устанавливаем выбранный аватар в выпадающем списке
  (document.getElementById('account-avatar-select') as HTMLSelectElement).value =
    localStorage.getItem(lsKey('avatar')) || '👤';
}
