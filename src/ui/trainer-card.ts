// ─────────────────────────────────────────────────────────────
// trainer-card.ts — КАРТОЧКА ТРЕНЕРА (блок G: G1 пак аватарок + G2 прогресс)
// ─────────────────────────────────────────────────────────────
// Отображает карточку профиля текущего игрока: имя, бейджи,
// количество пойманных покемонов, PvP статистику, локацию.
// Позволяет сменить никнейм через showTextInputModal и выбрать
// аватарку из SVG-пака (сетка, без загрузки файлов).
//
// G2 — прогресс ТОЛЬКО поверхностно: счётчики (числа), БЕЗ детальных
// списков/историй/разборов (без考古 — без детальных списков/историй).
// G1 — выбор аватара: сетка из src/data/avatars.ts.
//
// Кнопка PvP-вызова на ЧУЖОЙ карточке — НЕ ЗДЕСЬ (её делает параллельный
// агент арены). Здесь только пустой контейнер `trainer-card-actions`
// как место под неё — кнопку не дублируем.
//
// ЗАВИСИМОСТИ:
//   state           — глобальное состояние
//   dom             — showTextInputModal (ввод текста)
//   save            — autoSave
//   core            — pokedexTotal (общее количество видов)
//   trainer-profile — loadLocationTrainers, renderOnlinePlayers
//   data/avatars    — SVG-пак аватарок
//
// ИСПОЛЬЗУЕТСЯ В: nav.ts (вкладка "Чат" → карточка тренера)
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state, lsKey } from '../game/state.js';              // Глобальное состояние
// showTextInputModal — показывает модалку с полем ввода текста
// Отличается от showSelectionModal — пользователь вводит текст, а не выбирает
import { showTextInputModal, showSelectionModal, showToast } from '../utils/dom.js';
import { TITLES, getTitleById, isTitleId } from '../data/titles.js';
import { autoSave } from '../game/save.js';              // Автосохранение
// pokedexTotal — общее количество видов покемонов в покедексе
// Экспортируется из battle/core, вычисляется как длина POKEDEX_ALL
import { pokedexTotal } from '../battle/core.js';
// loadLocationTrainers — загружает список тренеров в той же локации
// renderOnlinePlayers — показывает список онлайн-игроков
import { loadLocationTrainers, renderOnlinePlayers } from '../social/trainer-profile.js';
// G1: SVG-пак аватарок (без файлов, кодогенерация)
import { AVATARS, DEFAULT_AVATAR_ID, getAvatarById, isAvatarId } from '../data/avatars.js';

// ── Локальный esc (чтобы не тянуть DOM-утилиты в node-тестах) ──
function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── G2: поверхностная сводка (ТОЛЬКО счётчики) ─────────────
// Возвращает одни числа. Никаких массивов, историй, списков имён,
// разборов по дням/атакам — это запрещено решением G2.
export interface TrainerSummary {
  badges: number;
  teamSize: number;
  pcCount: number;
  dexCaught: number;
  dexTotal: number;
  battleWins: number;
  pvpWins: number;
  pvpLosses: number;
  /** Текущий победный стрик (0 — после поражения). */
  pvpStreak: number;
  /** Лучший победный стрик. */
  pvpBestStreak: number;
  /** Заработано титулов. */
  titles: number;
}

function num(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return n < 0 ? 0 : Math.floor(n);
}

/** Чистая функция: сводка из state, без DOM. Только числа. */
export function getTrainerSummary(): TrainerSummary {
  const badges = Array.isArray((state as any).badges) ? (state as any).badges.length : 0;
  const teamSize = Array.isArray((state as any).myTeam) ? (state as any).myTeam.length : 0;
  let pcCount = 0;
  const boxes = (state as any).pcBoxes;
  if (Array.isArray(boxes)) {
    for (const b of boxes) if (Array.isArray(b)) pcCount += b.length;
  }
  const caught = (state as any).pokedexCaught;
  const dexCaught = caught instanceof Set ? caught.size : Array.isArray(caught) ? caught.length : 0;
  const total = num((pokedexTotal as unknown as number)) || 151;
  return {
    badges,
    teamSize,
    pcCount,
    dexCaught,
    dexTotal: total,
    battleWins: num((state as any).battleWins),
    pvpWins: num((state as any).pvpWins),
    pvpLosses: num((state as any).pvpLosses),
    pvpStreak: num((state as any).pvpStreak),
    pvpBestStreak: num((state as any).pvpBestStreak),
    titles: Array.isArray((state as any).titles) ? (state as any).titles.length : 0,
  };
}

/**
 * Титулы: выдача и активный. Чистые функции состояния (без DOM).
 * grantTitle — true если титул новый (первый сразу становится активным).
 * setActiveTitle — true если id заработан (null — снять).
 */
export function grantTitle(id: string): boolean {
  if (!isTitleId(id)) return false;
  try {
    const st = state as any;
    if (!Array.isArray(st.titles)) st.titles = [];
    if (st.titles.includes(id)) return false;
    st.titles.push(id);
    if (!st.activeTitle) st.activeTitle = id;
    return true;
  } catch { return false; }
}

export function setActiveTitle(id: string | null): boolean {
  try {
    const st = state as any;
    if (id === null) { st.activeTitle = null; return true; }
    if (!isTitleId(id)) return false;
    if (!Array.isArray(st.titles) || !st.titles.includes(id)) return false;
    st.activeTitle = id;
    return true;
  } catch { return false; }
}

/** Активный титул (деф) или undefined. */
export function getActiveTitle() {
  try {
    const id = (state as any).activeTitle;
    if (!isTitleId(id)) return undefined;
    if (!((state as any).titles || []).includes(id)) return undefined;
    return getTitleById(id);
  } catch { return undefined; }
}

/**
 * Учесть результат PvP-боя в поверхностных стриках.
 * Победа: pvpWins+1, стрик+1, best=max. Поражение: pvpLosses+1, стрик=0.
 * Возвращает свежую сводку. Детальных записей не ведёт (G2).
 */
export function recordPvpResult(won: boolean): TrainerSummary {
  try {
    if (won) {
      (state as any).pvpWins = num((state as any).pvpWins) + 1;
      const s = num((state as any).pvpStreak) + 1;
      (state as any).pvpStreak = s;
      if (s > num((state as any).pvpBestStreak)) (state as any).pvpBestStreak = s;
    } else {
      (state as any).pvpLosses = num((state as any).pvpLosses) + 1;
      (state as any).pvpStreak = 0;
    }
  } catch { /* state недоступен — просто вернём сводку */ }
  return getTrainerSummary();
}

// ── G1: выбор аватарки ─────────────────────────────────────

/** Текущий id аватарки: state → localStorage → дефолт. Только из SVG-пака. */
export function getTrainerAvatarId(): string {
  try {
    const fromState = (state as any).trainerAvatar;
    if (isAvatarId(fromState)) return fromState;
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(lsKey('avatar'));
      if (isAvatarId(raw)) return raw as string;
    }
  } catch { /* ignore */ }
  return DEFAULT_AVATAR_ID;
}

/**
 * Выбрать аватарку из пака — ОДИН РАЗ на игру (решение хозяина).
 * Повторная смена на другой id отклоняется (false); тот же id — ок.
 * Проверка: state → localStorage (оба считаются выбором).
 */
export function setTrainerAvatarId(id: string): boolean {
  if (!isAvatarId(id)) return false;
  try {
    const cur = (state as any).trainerAvatar;
    if (isAvatarId(cur)) return cur === id; // уже выбрана: только та же
  } catch { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(lsKey('avatar'));
      if (isAvatarId(saved)) return saved === id;
    }
  } catch { /* ignore */ }
  try { (state as any).trainerAvatar = id; } catch { /* ignore */ }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(lsKey('avatar'), id);
  } catch { /* ignore */ }
  return true;
}

/** HTML кружка-аватара (inline-SVG из пака). Неизвестный id → дефолт. */
export function trainerAvatarSvg(id: string, size = 48): string {
  const def = getAvatarById(id) || getAvatarById(DEFAULT_AVATAR_ID)!;
  const px = Math.max(24, Math.min(128, Math.floor(size) || 48));
  // SVG уже 64×64 — масштабируем обёрткой, сам svg не правим.
  return `<span class="trainer-card-avatar-svg" style="display:inline-flex;width:${px}px;height:${px}px;border-radius:50%;overflow:hidden;flex:0 0 auto;">`
    + `<span style="width:${px}px;height:${px}px;display:inline-flex;">${def.svg}</span></span>`;
}

/**
 * Отрисовать сетку выбора аватарок в контейнер.
 * По умолчанию — #trainer-avatar-grid (если его нет — тихо выходим,
 * карточка всё равно работает). Сетка, не селект: все 26 видно сразу.
 */
export function renderAvatarPicker(containerId = 'trainer-avatar-grid'): void {
  try {
    if (typeof document === 'undefined') return;
    const doc = document as any;
    const grid = doc.getElementById(containerId);
    if (!grid) return;
    const current = getTrainerAvatarId();
    grid.innerHTML = '';
    try {
      grid.className = (grid.className ? grid.className + ' ' : '') + 'trainer-avatar-grid';
      (grid.style as any).display = 'grid';
      (grid.style as any).gridTemplateColumns = 'repeat(auto-fill,minmax(72px,1fr))';
      (grid.style as any).gap = '8px';
    } catch { /* stub-DOM */ }
    for (const av of AVATARS) {
      let btn: any;
      try {
        btn = doc.createElement('button');
      } catch { continue; }
      if (!btn) continue;
      try {
        btn.type = 'button';
        btn.className = 'trainer-avatar-opt' + (av.id === current ? ' selected' : '');
        if (btn.dataset) btn.dataset.avatarId = av.id;
        btn.title = av.name;
        try {
          (btn.style as any).display = 'flex';
          (btn.style as any).flexDirection = 'column';
          (btn.style as any).alignItems = 'center';
          (btn.style as any).gap = '2px';
          (btn.style as any).padding = '6px 2px';
          (btn.style as any).borderRadius = '10px';
          (btn.style as any).cursor = 'pointer';
          (btn.style as any).border = av.id === current ? '2px solid #34c759' : '2px solid transparent';
          (btn.style as any).background = 'var(--tma-card-bg,#1a1a2e)';
          (btn.style as any).color = 'inherit';
        } catch { /* ignore */ }
        btn.innerHTML = `${av.svg}<span style="font-size:0.62rem;line-height:1.1;text-align:center;">${esc(av.name)}</span>`;
        const pickId = av.id;
        btn.onclick = () => {
          if (!setTrainerAvatarId(pickId)) {
            showToast('Аватар выбирается один раз на игру!', true);
            return;
          }
          try { autoSave(); } catch { /* ignore */ }
          renderAvatarPicker(containerId);
          renderTrainerCard();
        };
        if (typeof grid.appendChild === 'function') grid.appendChild(btn);
        else if (Array.isArray(grid.children)) grid.children.push(btn);
      } catch { /* одна битая клетка не роняет сетку */ }
    }
  } catch { /* никогда не роняем карточку из-за пикера */ }
}

// ── Место под кнопку арены (НЕ сама кнопка) ────────────────
// Параллельный агент арены смонтирует сюда PvP-вызов для ЧУЖОЙ карты.
// Мы только гарантируем контейнер и НЕ кладём внутрь <button>.
export function ensureTrainerCardActions(): any {
  try {
    if (typeof document === 'undefined') return null;
    const doc = document as any;
    const existed = doc.getElementById('trainer-card-actions');
    if (existed) return existed;
    const box = doc.createElement('div');
    if (!box) return null;
    box.id = 'trainer-card-actions';
    box.className = 'trainer-card-actions';
    try {
      if (typeof box.setAttribute === 'function') box.setAttribute('data-owner', 'arena-agent');
      (box.style as any).display = 'flex';
      (box.style as any).gap = '8px';
      (box.style as any).marginTop = '8px';
    } catch { /* ignore */ }
    // Пусто намеренно: кнопку добавит агент арены. Только комментарий-маркер.
    try { box.innerHTML = '<!-- arena-agent mounts PvP action here -->'; } catch { /* ignore */ }
    // Куда положить: панель своей карты, иначе — вью тренеров, иначе — в body.
    // (Раньше якорились к чату; карта переехала в «Тренеры → Моя карта».)
    const parents = ['trainers-card-panel', 'view-trainers'];
    for (const pid of parents) {
      try {
        const p = doc.getElementById(pid);
        if (p && typeof p.appendChild === 'function') { p.appendChild(box); return box; }
        if (p && typeof p.append === 'function') { p.append(box); return box; }
      } catch { /* next */ }
    }
    try {
      if (doc.body && typeof doc.body.appendChild === 'function') doc.body.appendChild(box);
    } catch { /* ignore */ }
    return box;
  } catch {
    return null;
  }
}

// ── Поверхностный прогресс (только числа, без списков) ─────
function renderTrainerProgress(): void {
  try {
    if (typeof document === 'undefined') return;
    const doc = document as any;
    // Контейнер прогресса создаётся кодом (`trainer-card-progress`), поэтому
    // ищем только его. Раньше здесь стоял ещё и `trainer-progress` — элемента
    // с таким id не существует ни в разметке, ни в коде: это был мёртвый
    // getElementById, на который ругался аудит DOM-контракта.
    let box = doc.getElementById('trainer-card-progress');
    if (!box) {
      try {
        box = doc.createElement('div');
        if (!box) return;
        box.id = 'trainer-card-progress';
        box.className = 'trainer-card-progress';
        // Положим в панель своей карты, чтобы было видно в карточке.
        const anchor = doc.getElementById('trainers-card-panel');
        if (anchor && anchor.parentNode && typeof anchor.parentNode.insertBefore === 'function') {
          anchor.parentNode.insertBefore(box, (anchor as any).nextSibling || null);
        } else if (doc.body && typeof doc.body.appendChild === 'function') {
          doc.body.appendChild(box);
        } else {
          return;
        }
      } catch { return; }
    }
    const s = getTrainerSummary();
    // ТОЛЬКО счётчики одной строкой. Никаких <ul>/<li>/<table>, имён,
    // историй боёв, разборов по покемонам — решение G2.
    const html =
      `<span class="tc-stat" title="Значки">🏅${s.badges}</span>`
      + `<span class="tc-sep"> · </span>`
      + `<span class="tc-stat" title="В дексе">🐾${s.dexCaught}/${s.dexTotal}</span>`
      + `<span class="tc-sep"> · </span>`
      + `<span class="tc-stat" title="Команда">👥${s.teamSize}</span>`
      + `<span class="tc-sep"> · </span>`
      + `<span class="tc-stat" title="PvP победы/поражения">⚔️${s.pvpWins}В/${s.pvpLosses}П</span>`
      + `<span class="tc-sep"> · </span>`
      + `<span class="tc-stat" title="Стрик">🔥${s.pvpStreak} (макс ${s.pvpBestStreak})</span>`;
    try {
      box.innerHTML = html;
      (box.style as any).display = 'flex';
      (box.style as any).flexWrap = 'wrap';
      (box.style as any).gap = '4px';
      (box.style as any).fontSize = '0.8rem';
      (box.style as any).opacity = '0.9';
    } catch { /* stub-DOM */ }
  } catch { /* ignore */ }
}

/**
 * Открыть выбор титула из заработанных (модалка).
 */
export function openTitlePicker(): void {
  try {
    const earned: string[] = ((state as any).titles || []).filter((t: unknown) => isTitleId(t));
    if (earned.length === 0) return;
    const choices = [{ label: '— без титула —', value: '' }]
      .concat(earned.map((id) => {
        const t = getTitleById(id)!;
        return { label: `${t.icon} ${t.name}`, value: id };
      }));
    showSelectionModal('Титул тренера', choices, (idx: number) => {
      const v = choices[idx]?.value;
      setActiveTitle(v || null);
      try { autoSave(); } catch { /* ignore */ }
      renderTrainerCard();
    });
  } catch { /* ignore */ }
}

/**
 * Богатая карточка: шапка (аватар + имя + титул + локация), сетка статов.
 * Живёт в панели «Тренеры → Моя карта» (#trainer-card-mount).
 * Титул кликабелен (выбор из заработанных). Старые id
 * (trainer-name/badges/caught) заполняются как раньше.
 */
export function renderTrainerCardBox(): void {
  try {
    if (typeof document === 'undefined') return;
    const doc = document as any;
    let box = doc.getElementById('trainer-card-box');
    if (!box) {
      box = doc.createElement('div');
      if (!box) return;
      box.id = 'trainer-card-box';
      box.className = 'trainer-card-box';
      const mount = doc.getElementById('trainer-card-mount')
        || doc.getElementById('trainers-card-panel');
      if (mount && typeof mount.appendChild === 'function') {
        mount.appendChild(box);
      } else if (doc.body && typeof doc.body.appendChild === 'function') {
        doc.body.appendChild(box);
      } else return;
    }
    const s = getTrainerSummary();
    const avId = getTrainerAvatarId();
    const active = getActiveTitle();
    const earned: string[] = ((state as any).titles || []).filter((t: unknown) => isTitleId(t));
    const name = esc((state as any).trainerNickname
      || (state as any).tgUser?.first_name
      || (state as any).tgUser?.username
      || '---');
    const loc = esc((state as any).currentLocationName || (state as any).currentLocationId || '');
    box.innerHTML =
      `<div class="tcb-head" style="display:flex;gap:10px;align-items:center;">`
      + `<div class="tcb-avatar">${trainerAvatarSvg(avId, 64)}</div>`
      + `<div class="tcb-id"><div class="tcb-name" style="font-weight:700;font-size:1.05rem;">${name}</div>`
      + `<div class="tcb-title" id="tcb-title" style="font-size:0.85rem;opacity:0.95;${earned.length ? 'cursor:pointer;' : ''}" title="${earned.length ? 'Нажмите чтобы сменить титул' : ''}">${active ? `${active.icon} ${esc(active.name)}` : '— без титула —'}</div>`
      + (loc ? `<div class="tcb-loc" style="font-size:0.75rem;opacity:0.7;">📍 ${loc}</div>` : '')
      + `</div></div>`
      + `<div class="tcb-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px;font-size:0.8rem;">`
      + `<div class="tcb-cell">🏅<br><b>${s.badges}</b><br><span>значки</span></div>`
      + `<div class="tcb-cell">🐾<br><b>${s.dexCaught}/${s.dexTotal}</b><br><span>декс</span></div>`
      + `<div class="tcb-cell">👥<br><b>${s.teamSize}</b><br><span>команда</span></div>`
      + `<div class="tcb-cell">⚔️<br><b>${s.pvpWins}В/${s.pvpLosses}П</b><br><span>pvp</span></div>`
      + `<div class="tcb-cell">🔥<br><b>${s.pvpStreak}</b><br><span>стрик (макс ${s.pvpBestStreak})</span></div>`
      + `<div class="tcb-cell">🎖️<br><b>${s.titles}</b><br><span>титулы</span></div>`
      + `</div>`;
    if (earned.length > 0) {
      try {
        const titleEl = box.querySelector ? box.querySelector('#tcb-title') : doc.getElementById('tcb-title');
        if (titleEl) titleEl.onclick = () => openTitlePicker();
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

function renderTrainerAvatar(): void {
  try {
    if (typeof document === 'undefined') return;
    const doc = document as any;
    const id = getTrainerAvatarId();
    for (const slot of ['trainer-card-avatar', 'trainer-avatar']) {
      try {
        const el = doc.getElementById(slot);
        if (el) el.innerHTML = trainerAvatarSvg(id, 48);
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

// ── renderTrainerCard: отрисовка карточки тренера ───────
// Заполняет DOM-элементы: имя, количество значков, пойманные покемоны
// Также запускает загрузку списка тренеров в локации и онлайн-игроков
export function renderTrainerCard() {
  // Находим DOM-элементы карточки
  const nameEl = document.getElementById('trainer-name');    // Имя тренера
  const badgesEl = document.getElementById('trainer-badges'); // Количество значков
  const caughtEl = document.getElementById('trainer-caught'); // Поймано покемонов

  // Если элементов нет — всё равно пробуем дорисовать прогресс/пикер/контейнер,
  // но базовые поля пропускаем (страница не загружена или другая вкладка)
  if (!nameEl || !badgesEl || !caughtEl) {
    try { renderTrainerProgress(); } catch { /* ignore */ }
    try { renderTrainerCardBox(); } catch { /* ignore */ }
    try { renderAvatarPicker(); } catch { /* ignore */ }
    try { ensureTrainerCardActions(); } catch { /* ignore */ }
    try { loadLocationTrainers(); } catch { /* ignore */ }
    try { renderOnlinePlayers(); } catch { /* ignore */ }
    return;
  }

  // ── Установка имени тренера ──
  // Приоритет: trainerNickname (установленный) → Telegram first_name → username → ID → '---'
  if (state.trainerNickname) {
    nameEl.textContent = state.trainerNickname;
  } else if (state.tgUser) {
    nameEl.textContent = state.tgUser.first_name || state.tgUser.username || `ID:${state.tgUser.id}`;
  } else {
    nameEl.textContent = '---';
  }

  // При клике на имя — открываем модалку смены прозвища
  nameEl.style.cursor = 'pointer';  // Курсор-рука
  nameEl.title = 'Нажмите чтобы изменить прозвище';
  nameEl.onclick = () => {
    showTextInputModal(
      'Прозвище тренера',                            // Заголовок
      state.trainerNickname || state.tgUser?.first_name || '',  // Значение по умолчанию
      (newName) => {                                  // Callback при сохранении
        state.trainerNickname = newName;  // Сохраняем в глобальное состояние
        renderTrainerCard();              // Перерисовываем карточку
        autoSave();                       // Сохраняем игру
      }
    );
  };

  // ── Количество значков ──
  badgesEl.textContent = String(state.badges.length);

  // ── Пойманные покемоны ──
  // Формат: "45/151" (поймано / всего видов)
  caughtEl.textContent = `${state.pokedexCaught.size}/${pokedexTotal || 151}`;

  // ── Блок G: поверхностный прогресс + аватар + сетка + место под арену ──
  try { renderTrainerAvatar(); } catch { /* ignore */ }
  try { renderTrainerCardBox(); } catch { /* ignore */ }
  try { renderTrainerProgress(); } catch { /* ignore */ }
  try { renderAvatarPicker(); } catch { /* ignore */ }
  try { ensureTrainerCardActions(); } catch { /* ignore */ }

  // ── Загрузка дополнительных данных ──
  loadLocationTrainers();  // Тренеры в текущей локации
  renderOnlinePlayers();   // Онлайн-игроки (из Socket.IO)
}
