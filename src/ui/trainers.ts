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
import { renderTrainerCard, setTrainerAvatarId } from './trainer-card.js';
// autoSave — сохраняет игру в localStorage и на сервер
import { autoSave } from '../game/save.js';
// showToast — всплывающее уведомление (true=красное/ошибка, false=зелёное/успех)
// escHtml — экранирует HTML-спецсимволы (защита от XSS-атак)
import { showToast, escHtml } from '../utils/dom.js';
import { apiFetch } from '../game/apiClient.js';
import { rankLabel } from '../data/ranks.js';

// ── Защита от двойной загрузки (тап по табу дважды / ререндер) ──
let trainersLoading = false;

/** Онлайн-сет как строки: tg_id из БД — число, из сокета — число, сравниваем строго по строкам. */
function onlineIdSet(): Set<string> {
  try {
    const list = getSocialState().onlinePlayersList || [];
    return new Set(list.map((p: any) => String(p?.userId ?? '')));
  } catch {
    return new Set();
  }
}

function onlineDotHtml(isOnline: boolean): string {
  return isOnline
    ? '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#34c759;margin-right:4px;box-shadow:0 0 4px #34c759;flex:0 0 auto;"></span>'
    : '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#555;margin-right:4px;flex:0 0 auto;"></span>';
}

/**
 * Перерисовать только онлайн-точки в уже загруженном списке (без refetch).
 * Вызывается из socket 'online_players' — иначе точки врут до перезахода.
 */
export function refreshTrainersOnline(): void {
  try {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('trainers-all-list');
    if (!listEl || trainersAllData.length === 0) return;
    const online = onlineIdSet();
    const cards = listEl.querySelectorAll
      ? Array.from(listEl.querySelectorAll('[data-trainer-id]'))
      : [];
    for (const card of cards as any[]) {
      const id = card.getAttribute ? card.getAttribute('data-trainer-id') : null;
      if (!id) continue;
      const dot = card.querySelector ? card.querySelector('[data-online-dot]') : null;
      if (dot) dot.innerHTML = onlineDotHtml(online.has(String(id)));
    }
    const head = document.getElementById('trainers-online-count');
    if (head) {
      const n = trainersAllData.filter((u: any) => online.has(String(u.id))).length;
      head.textContent = `${n} в сети · всего ${trainersAllData.length}`;
    }
  } catch { /* никогда не роняем сокет-хендлер */ }
}

// ── ЛОКАЛЬНОЕ СОСТОЯНИЕ ─────────────────────────────────
// Все данные тренеров для текущей вкладки (загружаются с сервера)
// Формат: [{id, nickname, avatar, badges, teamSize, region, lastSeen, registered}, ...]
let trainersAllData = [];

// ── Аватары тренеров ──────────────────────────────────────
// Сервер хранит avatar как ID (trainer_m, gentleman, ...), PNG лежат в
// /avatars/<id>.png. Раньше список проверял значение по форме ПУТИ
// (/avatars/x.png) — ID под неё не подходит никогда, и вместо картинки
// огромным текстом печатался сам ID («gentleman», «trainer_m»).
// Блок G1: новый SVG-пак (src/data/avatars.ts) — inline-SVG без файлов.
// Приоритет: SVG-пак → PNG-белый список → строгая форма пути → эмодзи.
import { AVATARS, getAvatarById, isAvatarId } from '../data/avatars.js';

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

/** Круглый аватар: SVG-пак → PNG → эмодзи-заглушка. Никогда не текст. */
export function trainerAvatarHtml(raw: unknown, size = 40): string {
  const id = typeof raw === 'string' ? raw : '';
  const circle = `width:${size}px;height:${size}px;border-radius:50%;`;
  // G1: SVG-пак — inline, без файлов. id строго из белого списка пака,
  // поэтому XSS через него невозможен (svg — статическая строка из кода).
  if (isAvatarId(id)) {
    const def = getAvatarById(id)!;
    return `<span style="position:relative;display:inline-block;${circle}overflow:hidden;flex:0 0 auto;">${def.svg}</span>`;
  }
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

/** Подпись для селектов: «🤵 Джентльмен» (SVG-пак — «🖼 Имя»). */
export function trainerAvatarLabel(id: string): string {
  const svgDef = getAvatarById(id);
  if (svgDef) return `🖼 ${svgDef.name}`;
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
  if (trainersLoading) return;
  trainersLoading = true;

  // Сокет мог не подняться (холодный старт / таб открыт первым):
  // без join_lobby список онлайн пуст и все точки серые навсегда.
  try {
    const { state } = await import('../game/state.js');
    if (!state.socket) {
      const { initTradeSocket } = await import('../network/socket.js');
      try { initTradeSocket(); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  // Показываем "Загрузка..." пока ждём ответ от сервера
  listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">Загрузка...</div>';

  const showError = (msg: string) => {
    listEl.innerHTML = `<div style="text-align:center;color:var(--tma-text-muted);padding:20px;">${escHtml(msg)}<br><button id="trainers-retry" style="margin-top:8px;padding:6px 14px;border-radius:8px;border:1px solid var(--tma-border);background:var(--tma-card-bg);color:inherit;cursor:pointer;">↻ Повторить</button></div>`;
    const btn = document.getElementById('trainers-retry');
    if (btn) btn.onclick = () => { trainersLoading = false; void loadAllTrainers(); };
  };

  try {
    // Таймаут 10с: без него висящий сервер (холодный Render) = вечная «Загрузка...».
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
    // Запрашиваем список тренеров с сервера
    const res = await Promise.race([apiFetch('/profile/trainers/all'), timeout]);
    if (!res.ok) {
      showError(res.status === 401 ? 'Нет входа — перезайдите' : 'Ошибка загрузки');
      return;
    }
    const data = await res.json();
    trainersAllData = data.users || [];  // Сохраняем в локальное состояние

    // Если тренеров нет — показываем сообщение
    if (trainersAllData.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--tma-text-muted);padding:30px;">Нет тренеров</div>';
      return;
    }

    const online = onlineIdSet();
    // Онлайн — первыми, дальше свежие lastSeen. Без сортировки список
    // выглядел «зависшим»: свой порядок сервера (старые сверху) + все серые.
    const sorted = [...trainersAllData].sort((a: any, b: any) => {
      const ao = online.has(String(a.id)) ? 0 : 1;
      const bo = online.has(String(b.id)) ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return String(b.lastSeen || b.created_at || '').localeCompare(String(a.lastSeen || a.created_at || ''));
    });
    const onlineCount = trainersAllData.filter((u: any) => online.has(String(u.id))).length;

    // Очищаем контейнер перед заполнением
    listEl.innerHTML = '';

    // Счётчик сверху — видно, что онлайн вообще работает
    const head = document.createElement('div');
    head.id = 'trainers-online-count';
    head.style.cssText = 'font-size:0.75rem;opacity:0.7;padding:2px 4px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
    head.textContent = `${onlineCount} в сети · всего ${trainersAllData.length}`;
    listEl.appendChild(head);

    // Проходим по всем тренерам и создаём карточки
    sorted.forEach(u => {
      const card = document.createElement('div');
      card.className = 'trainer-list-card';  // CSS класс для стилизации
      try { card.setAttribute('data-trainer-id', String(u.id)); } catch { /* ignore */ }

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
      // Сравнение по строкам: tg_id из БД и userId из сокета могут
      // разъехаться по типу (число vs строка) — строгое === всегда врало.
      const isOnline = online.has(String(u.id));

      // Ранг по значкам (ranks.ts) — автоматическая лестница, не титул.
      const rank = rankLabel(u.badges || 0);
      const nick = String(u.nickname || u.first_name || u.username || 'Тренер');
      const region = String(u.region || '?');

      // Заполняем HTML карточки. Все текстовые поля — с обрезкой:
      // длинные ники/регионы раньше вылезали за границы карточки.
      card.innerHTML = `
        <div class="trainer-list-avatar" style="flex:0 0 auto;">${avatarHtml}</div>
        <div class="trainer-list-info" style="flex:1;min-width:0;overflow:hidden;">
          <div class="trainer-list-name" style="display:flex;align-items:center;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
            <span data-online-dot style="display:inline-flex;flex:0 0 auto;">${onlineDotHtml(isOnline)}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;">${escHtml(nick)}</span>
            <span style="flex:0 0 auto;">&nbsp;${u.registered ? '✅' : '🆕'}</span>
          </div>
          <div class="trainer-list-id" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(rank)} &nbsp; 🏅${u.badges || 0} &nbsp; 🐾${u.teamSize || 0}</div>
          <div class="trainer-list-id" style="opacity:0.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍${escHtml(region)} &nbsp; 🕐${escHtml(lastSeen)}</div>
        </div>
        <div style="flex:0 0 auto;opacity:0.4;">›</div>`;

      // При клике на карточку — открываем профиль тренера
      card.addEventListener('click', () => openTrainerProfile(u.id));
      listEl.appendChild(card);
    });
  } catch(e) {
    // Холодный Render / обрыв сети — кнопка повтора вместо вечной загрузки
    console.warn('[trainers] список не загрузился:', e);
    showError('Не загрузилось — сервер просыпается, попробуйте ещё');
  } finally {
    trainersLoading = false;
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
      // Показываем соответствующую панель, скрываем остальные
      document.getElementById('trainers-all-panel').style.display = panel === 'all' ? 'block' : 'none';
      const cardPanel = document.getElementById('trainers-card-panel');
      if (cardPanel) cardPanel.style.display = panel === 'card' ? 'block' : 'none';
      document.getElementById('trainers-account-panel').style.display = panel === 'account' ? 'block' : 'none';

      // При переключении — подгружаем данные
      if (panel === 'all') loadAllTrainers();       // Список всех тренеров
      if (panel === 'card') renderTrainerCard();    // Своя карта
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

      // Читаем выбранный аватар из выпадающего списка.
      // Аватар — один раз на игру: повторная смена отклоняется.
      const avatar = (document.getElementById('account-avatar-select') as HTMLSelectElement).value;
      if (!setTrainerAvatarId(avatar)) {
        showToast('Аватар выбирается один раз на игру!', true);
        return;
      }
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
  // G1: сначала SVG-пак (26), затем legacy PNG — один источник для селекта.
  const AVATAR_IDS = [...AVATARS.map((a) => a.id), 'trainer_f', 'trainer_m', 'ninja', 'sailor', 'super_nerd', 'beauty', 'gentleman'];
  const saved = localStorage.getItem(lsKey('avatar')) || '👤';

  // Аватар — картинкой/SVG, а не текстом ID (было: огромная надпись «gentleman»)
  const avatarBox = document.getElementById('account-avatar');
  if (avatarBox) {
    avatarBox.textContent = '';
    avatarBox.innerHTML = trainerAvatarHtml(isAvatarId(saved) || TRAINER_AVATAR_FILES.has(saved) ? saved : '', 64);
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
    if (isAvatarId(saved) || TRAINER_AVATAR_FILES.has(saved)) sel.value = saved;
  }

  // Вход на арену из «Аккаунта» — чтобы не бегать за жетоном в Поке-Центр
  // каждый раз (жетон покупается в маркете, а вход теперь жмётся отсюда).
  const arenaBtn = document.getElementById('btn-account-arena');
  if (arenaBtn) {
    arenaBtn.onclick = () => {
      import('./pvp-arena.js')
        .then((pa) => pa.openPvpArenaLobby())
        .catch((e) => console.error('[arena] арена не открылась', e));
    };
  }
}
