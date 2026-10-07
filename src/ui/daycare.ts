// ─────────────────────────────────────────────────────────────
// daycare.ts — ПИТОМНИК И РАЗВЕДЕНИЕ ПОКЕМОНОВ
// ─────────────────────────────────────────────────────────────
// Реализует два режима:
//   1) Питомник (Daycare) — временное хранение 2 покемонов из команды
//      с прокачкой уровней со временем и шансом получить яйцо.
//   2) Разведение (Breeding) — автоматическое спаривание покемонов
//      в PC-боксах по яйце-группам и полу с наследованием IV.
//
// ЗАВИСИМОСТИ:
//   state       — глобальное состояние (myTeam, pcBoxes, daycareMons, eggs)
//   store       — EventEmitter для сохранения и рендера UI
//   actions     — addItem (добавление яйца в инвентарь)
//   state (util) — generateUID, getTrainerId
//   dom         — showToast, showSelectionModal
//   core        — appendToLog, calculateStat
//   natures     — массив характеров
//
// ИСПОЛЬЗУЕТСЯ В:
//   init.ts     — startBreedingCheck
//   inventory.ts — hatchEgg
//   location.ts — checkDaycare, collectDaycareMons
//   npcs.ts     — openDaycareDeposit
//   pc.ts       — hatchEgg, checkBreeding, collectEgg
//
// ЭКСПОРТЫ:
//   EGG_TIME, EGG_BONUS_TIME     — константы времени
//   openDaycareDeposit           — депозит в питомник
//   checkDaycare                 — проверка прокачки
//   collectDaycareMons           — забрать покемонов
//   checkBreeding                — проверка разведения в PC
//   startBreedingCheck           — запуск периодической проверки
//   hatchEgg                     — вылупление яйца
//   collectEgg                   — перемещение яйца из бокса в инвентарь
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';            // Глобальное состояние игры
import { store } from '../game/store.js';              // Event-система (emit)
import { generateUID, getTrainerId } from '../game/state.js';  // Генерация ID
import { showToast, showSelectionModal } from '../utils/dom.js';
import { addNotification } from './notifications.js';
import { checkAchievement } from './achievements.js';
import { LEGENDARY_SET } from '../utils/state.js';
import { GEN_STARTERS } from '../data/starters.js';
import { baseStatTotal } from '../battle/stats.js';  // UI компоненты
import { appendToLog, calculateStat } from '../battle/core.js';  // Лог + расчёт HP
import { natures } from '../data/natures.js';          // Массив характеров
import { fetchSiteLearnset, siteStarterMoves, rollEggMove } from '../data/learnset.js';

// ── КОНСТАНТЫ ────────────────────────────────────────────

export const EGG_TIME = 10 * 60 * 1000;         // 10 минут на производство яйца (питомник)
export const EGG_BONUS_TIME = 5 * 60 * 1000;     // 5 минут если характеры совпадают
const BREEDING_CHECK_INTERVAL = 60 * 1000;       // Проверка разведения каждую минуту

// ── Время кладки по редкости пары (кладка — наше, сайт не нормирует) ──
// Редкость: common (BST<400), uncommon (400-499), rare (500+, не легенда),
// legendary (LEGENDARY_SET, но легенды не спариваются — ветка мёртвая).
// Пара берётся по ВЫСШЕЙ редкости: 10мин / 30мин / 2ч / 8ч.
// Вылупление — канон лиги: случайно 5-9 дней (см. checkBreeding).
const EGG_LAY_MS = { common: 10 * 60 * 1000, uncommon: 30 * 60 * 1000, rare: 2 * 3600 * 1000, legendary: 8 * 3600 * 1000 };

export function breedRarity(mon: any): string {
  const species = mon?.apiData?.species?.name || mon?.apiData?.name || '';
  if (species && LEGENDARY_SET.has(species)) return 'legendary';
  const bst = baseStatTotal(mon);
  if (bst >= 500) return 'rare';
  if (bst >= 400) return 'uncommon';
  return 'common';
}

export function pairRarityKey(m1: any, m2: any): string {
  const rank = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
  const r1 = breedRarity(m1), r2 = breedRarity(m2);
  return rank[r1] >= rank[r2] ? r1 : r2;
}

// ── Буквы симпатии (канон лиги): A / T / G ──
// Спарка успешна только при ОДИНАКОВОЙ букве у обоих. Буква назначается
// при получении покемона (поимка/стартер/награда/вылупление), навсегда.
export const SYMPATHY_LETTERS = ['A', 'T', 'G'] as const;
export function randomSympathy(): string {
  return SYMPATHY_LETTERS[Math.floor(Math.random() * SYMPATHY_LETTERS.length)];
}

/** Все стартеры всех поколений — им спаривание запрещено (канон лиги). */
const STARTER_SET = new Set((GEN_STARTERS || []).flat().map((s: string) => (s || '').toLowerCase()));

export function monSpecies(m: any): string {
  return (m?.apiData?.species?.name || m?.apiData?.name || '').toLowerCase();
}

export function isLegendaryMon(m: any): boolean {
  return LEGENDARY_SET.has(monSpecies(m));
}

export function isStarterMon(m: any): boolean {
  return STARTER_SET.has(monSpecies(m));
}
/** Перфект: все IV 31. Двойной перфект пары → шайни 1/128 (A6). */
export function isDoublePerfect(m1: any, m2: any): boolean {
  const perfect = (m: any) => !!m?.ivs && ['hp', 'atk', 'def', 'spa', 'spd', 'spe'].every((s) => m.ivs[s] === 31);
  return perfect(m1) && perfect(m2);
}

// ── Боксы разведения (A1): 3 штуки, в каждом максимум пара ──
// Форма: [{ a: mon|null, b: mon|null, readyAt: ms }]. Мон лежит в боксе
// целиком (как в daycareMons), а не ссылкой — uid-ссылки рвутся при
// перемещениях между командой и PC, и пара «теряла» бы покемонов.
export function ensureBreedBoxes() {
  if (!Array.isArray(state.breedBoxes)) state.breedBoxes = [];
  while (state.breedBoxes.length < 3) state.breedBoxes.push({ a: null, b: null, readyAt: 0 });
  return state.breedBoxes;
}

/** Вернуть покемона из бокса: в команду если есть место, иначе в PC 0. */
function returnMonFromBox(mon: any) {
  if (!mon) return;
  if (state.myTeam.length < 6) state.myTeam.push(mon);
  else {
    if (!state.pcBoxes.length) state.pcBoxes.push([]);
    state.pcBoxes[0].push(mon);
  }
}

/** Убрать покемона из команды/PC по uid. Возвращает объект или null. */
function takeMonByUid(uid: string): any | null {
  let idx = state.myTeam.findIndex((m: any) => m?.uid === uid);
  if (idx !== -1) return state.myTeam.splice(idx, 1)[0];
  for (const box of (state.pcBoxes || [])) {
    idx = (box || []).findIndex((m: any) => m?.uid === uid);
    if (idx !== -1) return box.splice(idx, 1)[0];
  }
  return null;
}

// randomHatchTime — случайное время вылупления: 3-8 дней (в миллисекундах)
function randomHatchTime() {
  return (3 + Math.floor(Math.random() * 6)) * 24 * 60 * 60 * 1000;
}

// ── ПИТОМНИК: Депозит ─────────────────────────────────────

// openDaycareDeposit — отправить ОДНОГО покемона в питомник (прокачка
// +1/час). Парной механики тут нет: разведение — только в боксах
// (openBreedBoxes). Повторный вызов кладёт ещё одного.
export function openDaycareDeposit() {
  // Нельзя оставлять последнего покемона (команда не бывает пустой)
  if (state.myTeam.length < 2) {
    showToast('Нельзя оставить последнего покемона!', true);
    return;
  }
  // Фильтруем только живых покемонов (currentHp > 0)
  const available = state.myTeam
    .map((m: any, i: number) => ({ m, i }))
    .filter(({ m }: any) => m.currentHp > 0);

  if (available.length < 1) {
    showToast('Нет живых покемонов для питомника!', true);
    return;
  }

  const items = available.map(({ m }: any) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
    subtitle: `${genderIcon(m)} | HP: ${m.currentHp}/${m.maxHp}`
  }));

  showSelectionModal('Питомник — кого оставить? (+1 ур./час)', items, (i1: number) => {
    const mon = available[i1].m;
    const idx = state.myTeam.indexOf(mon);
    if (idx === -1) {
      showToast('Покемон уже не в команде', true);
      return;
    }
    const [deposited] = state.myTeam.splice(idx, 1);

    // Добавляем в питомник с текущим временем
    state.daycareMons.push({ mon: deposited, depositTime: Date.now() });

    // Логируем
    appendToLog(
      `${mon.nickname || mon.apiData?.name} оставлен в Питомнике!`,
      false, 'quest'
    );
    showToast('Покемон оставлен в Питомнике!', false);
    store.emit('team:render');  // Перерисовываем команду
    store.emit('save');          // Сохраняем
  });
}

// ── Боксы разведения: UI (A1) ────────────────────────────
// 3 бокса, в каждом максимум пара. Второго принимает только при разном поле
// (или Ditto) И одинаковом характере — иначе уведомление и отказ.
// Открывается из диалога питомника (npcs.ts) и Test Lab.
export function openBreedBoxes() {
  ensureBreedBoxes();
  const modal = document.getElementById('breed-modal');
  if (modal) modal.remove();
  const overlay = document.createElement('div');
  overlay.id = 'breed-modal';
  overlay.className = 'modal-overlay';
  overlay.style.display = 'flex';
  document.body.appendChild(overlay);
  renderBreedBoxes(overlay);
}

function breedCandidateList() {
  const team = (state.myTeam || []).map((m: any) => ({ m, from: 'team' }));
  const pc: any[] = [];
  (state.pcBoxes || []).forEach((box: any, bi: number) =>
    (box || []).forEach((m: any) => pc.push({ m, from: `pc${bi}` })));
  return [...team, ...pc].filter(({ m }: any) => m && m.apiData && !m.hasBred);
}

function breedMonLabel(m: any): string {
  const nm = m.nickname || m.apiData?.name || '?';
  const g = getMonGender(m);
  const gi = g === 'male' ? '♂' : g === 'female' ? '♀' : '⚪';
  const sym = m.breedLetter ? `[${m.breedLetter}]` : '[?]';
  return `Lv.${m.baseLevel + (m.candiesEaten || 0)} ${nm} ${gi} ${sym}`;
}

function renderBreedBoxes(overlay: HTMLElement) {
  const boxes = ensureBreedBoxes();
  const cards = boxes.map((box: any, bi: number) => {
    const slot = (m: any | null, side: number) => {
      if (!m) {
        return `<button class="tma-btn breed-slot-btn" data-box="${bi}" data-side="${side}" style="width:100%;padding:10px;">+ Положить</button>`;
      }
      return `<div class="breed-mon" data-box="${bi}" data-side="${side}" title="Нажми чтобы забрать" style="cursor:pointer;padding:6px;border:1px solid var(--tma-border);border-radius:8px;">${breedMonLabel(m)}</div>`;
    };
    const full = box && box.a && box.b;
    const timer = full && box.readyAt
      ? `<div style="font-size:0.7rem;opacity:0.75;">🥚 ${box.readyAt > Date.now() ? 'через ~' + Math.max(1, Math.ceil((box.readyAt - Date.now()) / 60000)) + ' мин' : 'готово!'}</div>`
      : '';
    return `<div style="border:1px solid var(--tma-border);border-radius:10px;padding:8px;">
      <div style="font-weight:bold;margin-bottom:6px;">Бокс ${bi + 1}</div>
      ${slot(box?.a, 0)}
      <div style="text-align:center;opacity:0.6;">💕</div>
      ${slot(box?.b, 1)}
      ${timer}
    </div>`;
  }).join('');
  overlay.innerHTML = `
    <div class="selection-modal-card" style="max-width:420px;width:95%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <h3 style="margin:0;">💕 Боксы разведения</h3>
        <button class="tma-btn" id="btn-breed-close" style="padding:4px 8px;background:#ff3b30;">✕</button>
      </div>
      <div style="font-size:0.7rem;opacity:0.7;">Пара: один вид + разный пол (кросс — через Дитто) + одинаковая буква симпатии [A/T/G]. Каждый спаривается один раз. Легенды и стартеры не спариваются.</div>
      ${cards}
    </div>`;
  (overlay.querySelector('#btn-breed-close') as HTMLElement).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.querySelectorAll('.breed-slot-btn').forEach((btn) =>
    (btn as HTMLElement).onclick = () => pickBreedMon(
      parseInt((btn as HTMLElement).dataset.box || '0'),
      parseInt((btn as HTMLElement).dataset.side || '0'),
      overlay,
    ));
  overlay.querySelectorAll('.breed-mon').forEach((el) =>
    (el as HTMLElement).onclick = () => {
      const bi = parseInt((el as HTMLElement).dataset.box || '0');
      const side = parseInt((el as HTMLElement).dataset.side || '0');
      const box = ensureBreedBoxes()[bi];
      const m = side === 0 ? box.a : box.b;
      if (!m) return;
      if (side === 0) box.a = null; else box.b = null;
      box.readyAt = 0;
      returnMonFromBox(m);
      store.emit('save');
      renderBreedBoxes(overlay);
    });
}

// ── Выбор покемона в бокс: проверки по канону лиги ─────────
function pickBreedMon(bi: number, side: number, overlay: HTMLElement) {
  const list = breedCandidateList();
  if (!list.length) {
    showToast('Некого класть: все либо уже спаривались, либо без данных', true);
    return;
  }
  const items = list.map(({ m, from }: any, i: number) => ({
    label: breedMonLabel(m),
    subtitle: from === 'team' ? 'команда' : 'PC',
    idx: i,
  }));
  showSelectionModal('Кого положить?', items, (i: number) => {
    const pick = list[items[i]?.idx ?? i];
    if (!pick) return;
    const box = ensureBreedBoxes()[bi];
    const other = side === 0 ? box.b : box.a;
    if (other && !areBreedingCompatible(pick.m, other)) {
      // Точная причина для уведомления
      const ditto = monSpecies(pick.m) === 'ditto' || monSpecies(other) === 'ditto';
      let reason = 'Пара несовместима.';
      if (!ditto && monSpecies(pick.m) !== monSpecies(other)) reason = 'Нужен тот же вид (кросс — только через Дитто).';
      else if ((pick.m.breedLetter || '') !== (other.breedLetter || '')) reason = `Нужна одинаковая буква симпатии (у пары: ${other.breedLetter || '—'}, у этого: ${pick.m.breedLetter || '—'}).`;
      else if (isLegendaryMon(pick.m) || isLegendaryMon(other)) reason = 'Легенды не спариваются.';
      else if (isStarterMon(pick.m) || isStarterMon(other)) reason = 'Стартеры не спариваются.';
      else {
        const g1 = getMonGender(pick.m), g2 = getMonGender(other);
        if (!g1 || !g2 || g1 === g2) reason = 'Нужны разнополые (или Дитто).';
      }
      showToast(reason, true);
      addNotification('💕 Разведение', 'Положите соответствующего покемона: ' + reason);
      return;
    }
    if (other) box.readyAt = 0; // таймер взведётся в checkBreeding
    const taken = takeMonByUid(pick.m.uid);
    if (!taken) {
      showToast('Покемон уже не на месте', true);
      return;
    }
    if (side === 0) box.a = taken; else box.b = taken;
    store.emit('save');
    renderBreedBoxes(overlay);
  }, true);
}

// ── ПИТОМНИК: Проверка прокачки ─────────────────────────

// checkDaycare — вызывается при входе в покецентр
// Даёт покемонам в питомнике +1 уровень за каждый час
// Также проверяет шанс на яйцо (30% после 2 часов)
export function checkDaycare() {
  const now = Date.now();

  // ── Прокачка уровней ──
  state.daycareMons.forEach((entry: any) => {
    const hoursPassed = (now - entry.depositTime) / (1000 * 60 * 60);  // Часов прошло
    // Если прошёл хотя бы 1 час И покемон не достиг 100 уровня
    if (hoursPassed >= 1 && entry.mon.baseLevel + (entry.mon.candiesEaten || 0) < 100) {
      const levelsGained = Math.floor(hoursPassed);  // Сколько уровней заработал
      // Если есть новые уровни (с последней проверки) — применяем
      if (levelsGained > 0 && levelsGained > (entry._lastLevelsGained || 0)) {
        const newLevels = levelsGained - (entry._lastLevelsGained || 0);
        for (let i = 0; i < newLevels; i++) {
          entry.mon.baseLevel++;                          // Повышаем базовый уровень
          entry.mon.maxHp = calculateStat(entry.mon, 'hp', false);  // Пересчитываем HP
          entry.mon.currentHp = entry.mon.maxHp;          // Полное HP
        }
        entry._lastLevelsGained = levelsGained;  // Запоминаем последний уровень
      }
    }
  });

  // ── Проверка яйца ──
  // Удалена вместе с автоспариванием (A1): яйца теперь только из боксов
  // разведения через openBreedBoxes(). Старый путь (любые 2 в daycare,
  // 30% после 2 часов, без проверок пола/характера) плодил случайные пары.
  // Питомник оставил только прокачку уровней (ниже — без изменений).
}

// ── ПИТОМНИК: Забрать покемонов ──────────────────────

export function collectDaycareMons() {
  if (state.daycareMons.length === 0) return showToast('В Питомнике нет покемонов!', true);
  if (state.myTeam.length >= 6) return showToast('Команда полна! Освободите место.', true);

  checkDaycare();  // Сначала применяем накопленные уровни

  // Забираем всех, кому хватает места (депозит теперь по одному,
  // в питомнике может лежать сколько угодно)
  let took = 0;
  while (state.daycareMons.length > 0 && state.myTeam.length < 6) {
    const entry = state.daycareMons.shift();
    state.myTeam.push(entry.mon);
    took++;
  }

  appendToLog(took === 1 ? 'Покемон возвращён из Питомника!' : `Из Питомника возвращено: ${took}!`, false, 'quest');
  store.emit('team:render');
  store.emit('save');
}

// ── РАЗВЕДЕНИЕ (Breeding) ───────────────────────────────
// Канон лиги: спариваются только ОДИН ВИД + разный пол, при ОДИНАКОВОЙ
// букве симпатии (A/T/G). Яйце-групп PokeAPI нет — удалены. Запрещены:
// легенды/мифические, стартеры, уже спаривавшиеся (hasBred навсегда).

// getMonGender — получить пол покемона
export function getMonGender(mon: any) {
  return mon.gender || mon.apiData?.wildGender || null;
}

/** Иконка пола для UI: ♂ / ♀ / ⚪ (бесполый или неизвестен) */
export function genderIcon(mon: any): string {
  const g = getMonGender(mon);
  return g === 'male' ? '♂' : g === 'female' ? '♀' : '⚪';
}

// ── Проверка совместимости для разведения (канон лиги) ──
// Условия:
//   (1) Разные покемоны (разные UID)
//   (2) Никто из пары ещё не спаривался (hasBred — один раз и всё)
//   (3) Один вид (кроме пары с Ditto — кросс-видовые только через него)
//   (4) Разные полы (кроме Ditto; бесполые без Ditto не спариваются)
//   (5) Одинаковая буква симпатии A/T/G (характер НЕ проверяется)
//   (6) Не легенда/мифик и не стартер
export function areBreedingCompatible(mon1: any, mon2: any): boolean {
  if (!mon1 || !mon2 || mon1.uid === mon2.uid) return false;
  if (mon1.hasBred || mon2.hasBred) return false;    // Уже спаривались — хватит
  if (isLegendaryMon(mon1) || isLegendaryMon(mon2)) return false;
  if (isStarterMon(mon1) || isStarterMon(mon2)) return false;
  const dittoInvolved = monSpecies(mon1) === 'ditto' || monSpecies(mon2) === 'ditto';
  if (!dittoInvolved && monSpecies(mon1) !== monSpecies(mon2)) return false;
  const g1 = getMonGender(mon1);
  const g2 = getMonGender(mon2);
  if (!dittoInvolved) {
    if (!g1 || !g2) return false;                     // Нет пола
    if (g1 === g2) return false;                      // Один пол
  }
  if ((mon1.breedLetter || '') !== (mon2.breedLetter || '')) return false;
  return true;
}

// ── Основной цикл разведения (PC Boxes) ──
// Проходит по всем боксам, проверяет совместимость пар,
// создаёт яйца при совместимости, проверяет готовность яиц
export async function checkBreeding() {
  if (state.hatching) return;  // Предотвращаем параллельные вызовы
  state.hatching = true;
  const now = Date.now();

  try {
    // Боксы разведения (A1): максимум 3, в каждом максимум пара.
    // Старое автоспаривание по PC-боксам удалено: пары собирались сами из
    // случайных соседей и плодились бесконечно. Теперь пару кладёт игрок вручную
    // через openBreedBoxes(), второй принимается только при разном поле
    // (или Ditto) И одинаковом характере — иначе уведомление и отказ.
    ensureBreedBoxes();
    for (let bi = 0; bi < state.breedBoxes.length; bi++) {
      const box = state.breedBoxes[bi];
      if (!box || !box.a || !box.b) continue;
      const m1 = box.a, m2 = box.b;
      // Перепроверка совместимости (правила могли измениться, мон мог
      // стать недоступен): несовместимых возвращаем и чистим бокс.
      if (!areBreedingCompatible(m1, m2)) {
        returnMonFromBox(m1);
        returnMonFromBox(m2);
        state.breedBoxes[bi] = { a: null, b: null, readyAt: 0 };
        store.emit('notification:add', '💕 Разведение',
          `Пара в боксе ${bi + 1} несовместима и возвращена.`);
        continue;
      }
      if (!box.readyAt) {
        const key = pairRarityKey(m1, m2);
        box.readyAt = now + (EGG_LAY_MS[key] ?? EGG_LAY_MS.common);
      }
      if (now < box.readyAt) continue;
      // Время вышло — создаём яйцо
      const dittoA = (m1.apiData?.species?.name || m1.apiData?.name) === 'ditto';
      const dittoB = (m2.apiData?.species?.name || m2.apiData?.name) === 'ditto';
      // Я9: вид потомства — СЛУЧАЙНЫЙ из родителей. С Дитто — всегда второй
      // родитель (Дитто потомства не даёт), иначе 50/50.
      const donor = dittoA ? m2 : dittoB ? m1 : (Math.random() < 0.5 ? m1 : m2);
      const species = donor.apiData?.species?.name || donor.apiData?.name;
      const eggTypes = donor.apiData?.types || [{ type: { name: 'normal' } }];

      // Наследование IV (канон лиги): ЛУЧШИЙ ген родителей ±1-2.
      const bestIV = (stat: string) => {
        const best = Math.max(m1.ivs?.[stat] ?? 0, m2.ivs?.[stat] ?? 0);
        const delta = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.5 ? 1 : 2);
        return Math.min(31, Math.max(0, best + delta));
      };
      const eggIvs = {
        hp: bestIV('hp'),
        atk: bestIV('atk'),
        def: bestIV('def'),
        spa: bestIV('spa'),
        spd: bestIV('spd'),
        spe: bestIV('spe')
      };

      // Вылупление 5-9 дней (канон лиги), случайно.
      const hatchMs = (5 + Math.random() * 4) * 24 * 3600 * 1000;
      const egg = {
        uid: generateUID(),
        species,
        types: eggTypes,
        ivs: eggIvs,
        readyTime: now + hatchMs,
        parent1Uid: m1.uid,
        parent2Uid: m2.uid,
        // A6: двойной перфект (все 31 у обоих) — шайни 1/128 вместо 1/1024
        shinyBoost: isDoublePerfect(m1, m2),
        notified: false, // Я3: уведомление о готовности — один раз, автовылупа нет
      };
      state.eggs.push(egg);
      // Один раз и всё: родители помечены, бокс освобождается, оба возвращаются
      m1.hasBred = true;
      m2.hasBred = true;
      returnMonFromBox(m1);
      returnMonFromBox(m2);
      state.breedBoxes[bi] = { a: null, b: null, readyAt: 0 };

      store.emit('notification:add', 'Яйцо!',
        `Пара в боксе ${bi + 1} дала яйцо ${species}! Родители вернулись.`);
      appendToLog(`В боксе ${bi + 1} появилось яйцо! (${species})`, false, 'quest');
    }

    // ── Готовые яйца (Я3: автовылупления НЕТ — только кнопка в рюкзаке) ──
    // Здесь только одноразовое уведомление о готовности.
    for (const egg of state.eggs) {
      if (now >= egg.readyTime && !egg.notified) {
        egg.notified = true;
        store.emit('notification:add', '🥚 Яйцо готово!',
          `${egg.species} готов вылупиться — нажми на яйцо в рюкзаке.`);
        appendToLog(`🥚 Яйцо ${egg.species} готово к вылуплению!`, false, 'quest');
      }
    }

    // ── Очистка яиц из удалённых боксов ──
    state.eggs = state.eggs.filter(
      (e: any) => e.boxIdx !== undefined ? state.pcBoxes[e.boxIdx] !== undefined : true
    );

    store.emit('save');
  } finally {
    state.hatching = false;  // Всегда сбрасываем флаг, даже при ошибке
  }
}

// ── Периодическая проверка разведения ──
// Каждую минуту: если есть пары в боксах или яйца — checkBreeding().
// (Боксы раньше не проверялись — интервал смотрел только eggs/breedingPairs,
// и яйца из боксов не появлялись никогда.)
export function startBreedingCheck() {
  setInterval(() => {
    const boxesBusy = (state.breedBoxes || []).some((b: any) => b && (b.a || b.b));
    if (state.eggs.length > 0 || boxesBusy) checkBreeding();
  }, BREEDING_CHECK_INTERVAL);
}

// ── Я12: только стартовые атаки вида (level-up, level_learned_at <= maxLevel) ──
// Зеркалит логику стартера (starter.ts): максимум 4, пусто → tackle.
export function pickStarterMoves(pokeData: any, maxLevel = 1): any[] {
  const learned = (pokeData?.moves || [])
    .filter((m: any) => (m.version_group_details || []).some(
      (v: any) => v.move_learn_method?.name === 'level-up' && v.level_learned_at <= maxLevel
    ))
    .slice(0, 4);
  if (learned.length === 0) {
    learned.push({ move: { name: 'tackle', url: 'https://pokeapi.co/api/v2/move/33/' } });
  }
  return learned;
}

// ── Я7: случайная способность из возможных вида (скрытая исключена) ──
export function pickRandomAbility(pokeData: any): string | null {
  const all = pokeData?.abilities || [];
  const visible = all.filter((a: any) => !a.is_hidden);
  const pool = visible.length ? visible : all;
  if (!pool.length) return null;
  return pool[Math.floor(Math.random() * pool.length)]?.ability?.name || null;
}

// ── Вылупление яйца ──
// Загружает данные покемона из PokeAPI, создаёт объект покемона
// с наследованными IV от родителей, добавляет в команду или PC
export async function hatchEgg(egg: any) {
  // Проверяем, существует ли яйцо ещё
  if (!state.eggs.some((e: any) => e.uid === egg.uid)) return;

  const eggData = { ...egg };  // Копируем данные яйца (на случай если оригинал изменится)

  try {
    // Загружаем данные покемона из PokeAPI по имени вида
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${egg.species}`);
    if (!res.ok) {
      // Ошибка загрузки — яйцо утеряно
      state.eggs = state.eggs.filter((e: any) => e.uid !== egg.uid);
      store.emit('save');
      showToast(`Яйцо ${egg.species || 'неизвестного вида'} повреждено и утеряно`, true);
      return;
    }
    const pokeData = await res.json();

    // Я12: режем лёрнсет до стартовых атак вида.
    // Порядок — как на сайте лиги (таблица «Развитие»: статусы первыми),
    // первые 4 с level <= 1. Нет сайта → fallback на фильтр PokeAPI.
    // Плюс канон лиги: 30% случайная яйцевая атака при вылуплении.
    let eggMoveName: string | null = null;
    try {
      const site = await fetchSiteLearnset(egg.species);
      if (site) {
        pokeData.moves = siteStarterMoves(site, 1, 4);
        const eggMove = rollEggMove(site.egg, pokeData.moves.map((m: any) => m.move?.name));
        if (eggMove) {
          if (pokeData.moves.length < 4) pokeData.moves.push(eggMove);
          else pokeData.moves[3] = eggMove; // яйцевая вытесняет последнюю
          eggMoveName = eggMove.move.name;
        }
      } else {
        pokeData.moves = pickStarterMoves(pokeData, 1);
      }
    } catch {
      pokeData.moves = pickStarterMoves(pokeData, 1);
    }

    // Удаляем яйцо из списка яиц и из команды (если было в команде)
    const eggIdx = state.myTeam.findIndex((m: any) => m.uid === egg.uid);
    if (eggIdx !== -1) state.myTeam.splice(eggIdx, 1);
    state.eggs = state.eggs.filter((e: any) => e.uid !== egg.uid);

    // Создаём нового покемона (уровень 1)
    const newMon = {
      uid: generateUID(),                    // Уникальный ID
      originalTrainer: getTrainerId(),        // ID тренера
      createdAt: Date.now(),
      caughtLocation: 'breeding',              // Получен разведением
      apiData: pokeData,                       // Данные из PokeAPI
      maxHp: 50, currentHp: 50,                // Начальное HP
      // Шайни: 1/128 при двойном перфекте родителей (A6), иначе 1/1024 как в природе
      isShiny: egg.shinyBoost ? Math.random() < 1 / 128 : Math.random() < 1 / 1024,
      // IV: наследованные от родителей (или случайные)
      ivs: eggData.ivs || {
        hp: Math.floor(Math.random()*32), atk: Math.floor(Math.random()*32),
        def: Math.floor(Math.random()*32), spa: Math.floor(Math.random()*32),
        spd: Math.floor(Math.random()*32), spe: Math.floor(Math.random()*32)
      },
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },  // EV = 0
      baseLevel: 1, exp: 0, expToNext: 8,                        // Уровень 1
      candiesEaten: 0, vitaminsEaten: 0,
      training: null, trainingStage: 0, trainingStat: null,
      happiness: 120,                            // Высокое счастье (только вылупился)
      natureIdx: Math.floor(Math.random() * natures.length),  // Случайный характер
      breedLetter: randomSympathy(),  // буква симпатии A/T/G (канон лиги)
      gender: Math.random() < 0.5 ? 'male' : 'female',  // 50/50
      status: null, sleepTurns: 0,
      movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: pickRandomAbility(pokeData),
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: [],
      isEgg: false,          // Уже не яйцо
      hasBred: false          // Ещё не разводился
    };

    // IV уже финализированы при кладке (лучший ген родителей ±1-2,
    // канон лиги) — здесь не трогаем, превью на карточке яйца честное.

    // Добавляем в команду или PC
    if (state.myTeam.length < 6) {
      state.myTeam.push(newMon);
      store.emit('notification:add', '🎉 Яйцо вылупилось!', `${pokeData.name} появился на свет!` + (eggMoveName ? ` Сразу знает яйцевую атаку ${eggMoveName}!` : ''));
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}!` + (eggMoveName ? ` (яйцевая атака: ${eggMoveName})` : ''), false, 'quest');
    } else {
      // Если команда полна — в первый бокс PC
      if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
      state.pcBoxes[0].push(newMon);
      store.emit('notification:add', '🎉 Яйцо вылупилось!',
        `${pokeData.name} вылупился и отправлен в PC (команда полна).`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}! (отправлен в PC)`, false, 'quest');
    }

    store.emit('team:render');
    store.emit('save');
    checkAchievement('breeder');
  } catch(e) {
    console.error('Hatch failed:', e);
    state.eggs = state.eggs.filter((e: any) => e.uid !== eggData.uid);
    store.emit('save');
    showToast('Ошибка вылупления, яйцо утеряно', true);
  }
}

// ── collectEgg: переместить яйцо из бокса в рюкзак ───────
// Убирает boxIdx — яйцо перестаёт быть привязано к боксу
export function collectEgg(eggUid: string) {
  const egg = state.eggs.find((e: any) => e.uid === eggUid);
  if (!egg) return;
  delete egg.boxIdx;  // Убираем привязку к боксу (теперь в рюкзаке)
  store.emit('save');
  showToast('🥚 Яйцо перемещено в рюкзак!', false);
}
