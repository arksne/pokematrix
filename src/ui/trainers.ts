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
import { apiFetch } from '../game/apiClient.js';

// ── ЛОКАЛЬНОЕ СОСТОЯНИЕ ─────────────────────────────────
// Все данные тренеров для текущей вкладки (загружаются с сервера)
// Формат: [{id, nickname, avatar, badges, teamSize, region, lastSeen, registered}, ...]
let trainersAllData = [];

// ── Аватары тренеров ──────────────────────────────────────
// Сервер хранит avatar как ID (trainer_m, gentleman, ...), PNG лежат в
// /avatars/<id>.png. Раньше список проверял значение по форме ПУТИ
// (/avatars/x.png) — ID под неё не подходит никогда, и вместо картинки
// огромным текстом печатался сам ID («gentleman», «trainer_m»).
const TRAINER_AVATAR_FILES = new Set([
  'trainer_f', 'trainer_m', 'ninja', 'sailor', 'super_nerd', 'beauty', 'gentleman',
]);
const TRAINER_AVATAR_EMOJI: Record<string, string> = {
  trainer_f: '👩', trainer_m: '👨', ninja: '🥷', sailor: '🧑‍✈️',
  super_nerd: '🤓', beauty: '💃', gentleman: '🤵',
};
const TRAINER_AVATAR_RU: Record<string, string> = {
  trainer_f: 'Тренер', trainer_m: 'Тренер', ninja: 'Ниндзя', sailor: 'Моряк',
  super_nerd: 'Заучка', beauty: 'Красотка', gentleman: 'Джентльмен',
};

/** Круглый аватар: PNG если есть, под ним эмодзи-заглушка. Никогда не текст. */
export function trainerAvatarHtml(raw: unknown, size = 40): string {
  const id = typeof raw === 'string' ? raw : '';
  const circle = `width:${size}px;height:${size}px;border-radius:50%;`;
  const bg = 'background:linear-gradient(135deg,#2a5298,#1e3c72);';
  const fs = `font-size:${Math.round(size * 0.55)}px;`;
  const emoji = TRAINER_AVATAR_EMOJI[id] || '👤';
  const fallback = `<span style="${circle}display:inline-flex;align-items:center;justify-content:center;${bg}${fs}">${emoji}</span>`;
  const src = TRAINER_AVATAR_FILES.has(id)
    ? `/avatars/${id}.png`
    : /^\/avatars\/[a-z0-9_-]+\.png$/.test(id) ? id : null;
  // src здесь либо из белого списка ID, либо прошёл строгую форму пути —
  // экранировать нечего, подставить XSS через него нельзя
  if (!src) return fallback;
  // Картинка поверх эмодзи: не загрузилась — удаляется, остаётся эмодзи
  return `<span style="position:relative;display:inline-block;${circle}">${fallback}` +
    `<img src="${src}" alt="" onerror="this.remove()" style="position:absolute;inset:0;${circle}object-fit:cover;"></span>`;
}

/** Подпись для селектов: «🤵 Джентльмен». */
export function trainerAvatarLabel(id: string): string {
  return `${TRAINER_AVATAR_EMOJI[id] || '👤'} ${TRAINER_AVATAR_RU[id] || id}`;
}

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
    const res = await apiFetch('/profile/trainers/all');
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
      // Сервер хранит ID (trainer_m, gentleman...), PNG — в /avatars/<id>.png.
      // trainerAvatarHtml рисует круг с картинкой (эмодзи под ней как фолбэк).
      const avatarHtml = trainerAvatarHtml(u.avatar, 44);

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
      //   — Аватар-круг 44px (слева)
      //   — Имя с онлайн-точкой, значок регистрации
      //   — Количество значков 🏅 и размер команды 🐾
      //   — Регион 📍 и время последнего визита 🕐
      card.innerHTML = `
        <div class="trainer-list-avatar" style="flex:0 0 auto;">${avatarHtml}</div>
        <div class="trainer-list-info" style="flex:1;min-width:0;">
          <div class="trainer-list-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            ${onlineDot}${escHtml(u.nickname || u.first_name || u.username || 'Тренер')}
            ${u.registered ? '✅' : '🆕'}
          </div>
          <div class="trainer-list-id">🏅${u.badges || 0} &nbsp; 🐾${u.teamSize || 0}</div>
          <div class="trainer-list-id" style="opacity:0.7;">📍${escHtml(u.region || '?')} &nbsp; 🕐${escHtml(lastSeen)}</div>
        </div>
        <div style="flex:0 0 auto;opacity:0.4;">›</div>`;

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
  const AVATAR_IDS = ['trainer_f', 'trainer_m', 'ninja', 'sailor', 'super_nerd', 'beauty', 'gentleman'];
  const saved = localStorage.getItem(lsKey('avatar')) || '👤';

  // Аватар — картинкой, а не текстом ID (было: огромная надпись «gentleman»)
  const avatarBox = document.getElementById('account-avatar');
  if (avatarBox) {
    avatarBox.textContent = '';
    avatarBox.innerHTML = trainerAvatarHtml(TRAINER_AVATAR_FILES.has(saved) ? saved : '', 64);
  }

  // Отображаем имя: никнейм → Telegram first_name → 'Тренер'
  document.getElementById('account-name').textContent =
    getSocialState().trainerNickname || getSocialState().tgUser?.first_name || 'Тренер';

  // Отображаем Telegram ID (или '?' если нет)
  document.getElementById('account-id').textContent =
    `Telegram ID: ${getSocialState().tgUser?.id || '?'}`;

  // Заполняем поле ввода никнейма
  (document.getElementById('account-nickname') as HTMLInputElement).value =
    getSocialState().trainerNickname || '';

  // Селект аватаров строим из одного источника (эмодзи + русское имя),
  // чтобы не рассинхронизировался со статикой в index.html
  const sel = document.getElementById('account-avatar-select') as HTMLSelectElement;
  if (sel) {
    sel.innerHTML = '';
    AVATAR_IDS.forEach((id) => {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = trainerAvatarLabel(id);
      sel.appendChild(opt);
    });
    if (TRAINER_AVATAR_FILES.has(saved)) sel.value = saved;
  }
}
