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
//   location.ts — checkDaycare, collectDaycareMons, collectDaycareEgg
//   npcs.ts     — openDaycareDeposit
//   pc.ts       — hatchEgg, checkBreeding, collectEgg
//
// ЭКСПОРТЫ:
//   EGG_TIME, EGG_BONUS_TIME     — константы времени
//   openDaycareDeposit           — депозит в питомник
//   checkDaycare                 — проверка прокачки и яиц
//   collectDaycareEgg            — забрать яйцо
//   collectDaycareMons           — забрать покемонов
//   checkBreeding                — проверка разведения в PC
//   startBreedingCheck           — запуск периодической проверки
//   hatchEgg                     — вылупление яйца
//   collectEgg                   — перемещение яйца из бокса в инвентарь
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { state } from '../game/state.js';            // Глобальное состояние игры
import { store } from '../game/store.js';              // Event-система (emit)
import { addItem } from '../game/actions.js';          // Добавление предмета в инвентарь
import { generateUID, getTrainerId } from '../game/state.js';  // Генерация ID
import { showToast, showSelectionModal } from '../utils/dom.js';
import { addNotification } from './notifications.js';
import { checkAchievement } from './achievements.js';
import { LEGENDARY_SET } from '../utils/state.js';
import { baseStatTotal } from '../battle/stats.js';  // UI компоненты
import { appendToLog, calculateStat } from '../battle/core.js';  // Лог + расчёт HP
import { natures } from '../data/natures.js';          // Массив характеров

// ── КОНСТАНТЫ ────────────────────────────────────────────

export const EGG_TIME = 10 * 60 * 1000;         // 10 минут на производство яйца (питомник)
export const EGG_BONUS_TIME = 5 * 60 * 1000;     // 5 минут если характеры совпадают
const BREEDING_CHECK_INTERVAL = 60 * 1000;       // Проверка разведения каждую минуту

// ── Шкалы времени разведения по редкости (A3/A4) ──────────
// Редкость: common (BST<400), uncommon (400-499), rare (500+, не легенда),
// legendary (LEGENDARY_SET). Пара берётся по ВЫСШЕЙ редкости.
// Цифры — предложение автора, крутить после первых недель экономики:
// яйцо: 10мин / 30мин / 2ч / 8ч; вылупление: 3ч / 8ч / 24ч / 72ч.
const EGG_LAY_MS = { common: 10 * 60 * 1000, uncommon: 30 * 60 * 1000, rare: 2 * 3600 * 1000, legendary: 8 * 3600 * 1000 };
const HATCH_MS = { common: 3 * 3600 * 1000, uncommon: 8 * 3600 * 1000, rare: 24 * 3600 * 1000, legendary: 72 * 3600 * 1000 };

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

// openDaycareDeposit — показать выбор покемонов для отправки в питомник
// Пользователь выбирает 2 покемонов из команды (должны быть живы)
// Они удаляются из команды и помещаются в state.daycareMons
export function openDaycareDeposit() {
  // Фильтруем только живых покемонов (currentHp > 0)
  const available = state.myTeam
    .map((m: any, i: number) => ({ m, i }))
    .filter(({ m }: any) => m.currentHp > 0);

  // Нужно минимум 2 покемона
  if (available.length < 2) {
    showToast('Нужно минимум 2 живых покемона!', true);
    return;
  }

  // Создаём список для выбора первого покемона
  const items = available.map(({ m }: any) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
    subtitle: `${genderIcon(m)} | HP: ${m.currentHp}/${m.maxHp}`
  }));

  // Показываем модалку выбора ПЕРВОГО покемона
  showSelectionModal('Питомник — выберите ПЕРВОГО покемона', items, (i1: number) => {
    // Оставшиеся покемоны (исключая выбранного)
    const remaining = available.filter((_: any, i: number) => i !== i1);
    const items2 = remaining.map(({ m }: any) => ({
      label: `Lv.${m.baseLevel + m.candiesEaten} ${m.nickname || m.apiData?.name}`,
      subtitle: `${genderIcon(m)} | HP: ${m.currentHp}/${m.maxHp}`
    }));

    // Показываем модалку выбора ВТОРОГО покемона
    showSelectionModal('Выберите ВТОРОГО покемона', items2, (i2: number) => {
      const mon1 = available[i1].m;
      const mon2 = remaining[i2].m;

      // Находим индексы в оригинальном массиве myTeam
      const idx1 = state.myTeam.indexOf(mon1);
      const idx2 = state.myTeam.indexOf(mon2);

      // Удаляем из команды (сначала больший индекс, чтобы не сбить порядок)
      const hi = Math.max(idx1, idx2);
      const lo = Math.min(idx1, idx2);
      const depositMon2 = state.myTeam.splice(hi, 1)[0];  // Удаляем второго
      const depositMon1 = state.myTeam.splice(lo, 1)[0];  // Удаляем первого

      // Добавляем в питомник с текущим временем
      state.daycareMons.push({ mon: depositMon2, depositTime: Date.now() });
      state.daycareMons.push({ mon: depositMon1, depositTime: Date.now() });

      // Логируем
      appendToLog(
        `${mon1.nickname || mon1.apiData?.name} и ${mon2.nickname || mon2.apiData?.name} оставлены в Питомнике!`,
        false, 'quest'
      );
      showToast('Покемоны оставлены в Питомнике!', false);
      store.emit('team:render');  // Перерисовываем команду
      store.emit('save');          // Сохраняем
    });
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
  const nat = natures[m.natureIdx]?.name || '';
  return `Lv.${m.baseLevel + (m.candiesEaten || 0)} ${nm} ${gi} ${nat}`;
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
      <div style="font-size:0.7rem;opacity:0.7;">Пара: разный пол (или Дитто) + одинаковый характер. Каждый спаривается один раз.</div>
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

// ── Выбор покемона в бокс: проверка пола+характера ─────────
async function pickBreedMon(bi: number, side: number, overlay: HTMLElement) {
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
  showSelectionModal('Кого положить?', items, async (i: number) => {
    const pick = list[items[i]?.idx ?? i];
    if (!pick) return;
    const box = ensureBreedBoxes()[bi];
    const other = side === 0 ? box.b : box.a;
    if (other) {
      // Пол: разный, либо замешан Дитто
      const sp = (m: any) => m.apiData?.species?.name || m.apiData?.name || '';
      const ditto = sp(pick.m) === 'ditto' || sp(other) === 'ditto';
      const g1 = getMonGender(pick.m), g2 = getMonGender(other);
      if (!ditto && (!g1 || !g2 || g1 === g2)) {
        showToast('Не подходит по полу! Нужны разнополые (или Дитто).', true);
        addNotification('💕 Разведение', 'Положите соответствующего покемона: нужен другой пол.');
        return;
      }
      // Характер: одинаковый
      if ((pick.m.natureIdx ?? -1) !== (other.natureIdx ?? -2)) {
        showToast('Не подходит по характеру! Нужен одинаковый характер.', true);
        addNotification('💕 Разведение', 'Положите соответствующего покемона: нужен такой же характер.');
        return;
      }
      // Яйце-группы (PokeAPI, с кэшем)
      const groups1 = await getMonEggGroups(pick.m);
      const groups2 = await getMonEggGroups(other);
      if (!areBreedingCompatible(pick.m, other, groups1, groups2)) {
        showToast('Несовместимы по яйце-группам!', true);
        addNotification('💕 Разведение', 'Положите соответствующего покемона: нет общей яйце-группы.');
        return;
      }
      box.readyAt = 0; // таймер взведётся в checkBreeding
    }
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

// ── ПИТОМНИК: Забрать яйцо ────────────────────────────

export function collectDaycareEgg() {
  if (!state.daycareEgg) return showToast('Яйца пока нет!', true);
  // Проверяем, готово ли яйцо
  if (Date.now() < state.daycareEgg.readyTime) {
    const minsLeft = Math.ceil((state.daycareEgg.readyTime - Date.now()) / 60000);
    return showToast(`Яйцо ещё не готово! Осталось ~${minsLeft} мин.`, true);
  }
  if (!addItem('suspiciousEgg')) {
    showToast('Рюкзак полон! Освободите место и попробуйте снова.', true);
    return;
  }
  state.daycareEgg = null;  // Сбрасываем (яйцо забрано)
  showToast('Вы получили яйцо! Оно добавлено в инвентарь.', false);
  store.emit('save');
}

// ── ПИТОМНИК: Забрать покемонов ──────────────────────

export function collectDaycareMons() {
  if (state.daycareMons.length === 0) return showToast('В Питомнике нет покемонов!', true);
  if (state.myTeam.length >= 6) return showToast('Команда полна! Освободите место.', true);

  checkDaycare();  // Сначала применяем накопленные уровни

  // Забираем первого покемона
  const entry = state.daycareMons.shift();
  state.myTeam.push(entry.mon);

  // Забираем второго (если есть место)
  if (state.daycareMons.length > 0 && state.myTeam.length < 6) {
    const entry2 = state.daycareMons.shift();
    state.myTeam.push(entry2.mon);
  }

  appendToLog('Покемоны возвращены из Питомника!', false, 'quest');
  store.emit('team:render');
  store.emit('save');
}

// ── РАЗВЕДЕНИЕ (Breeding) ───────────────────────────────

// ── Яйце-группы ──
// Кэш: speciesName → [eggGroupName, ...]
// Загружается из PokeAPI /pokemon-species/{name} → egg_groups
const eggGroupCache = new Map<string, string[]>();

// getMonEggGroups — получить яйце-группы покемона
// Загружает с PokeAPI, кэширует для ускорения
async function getMonEggGroups(mon: any): Promise<string[]> {
  const name = mon.apiData?.species?.name || mon.apiData?.name;
  if (!name) return [];
  if (eggGroupCache.has(name)) return eggGroupCache.get(name)!;  // Из кэша

  try {
    // URL вида: /api/v2/pokemon-species/pikachu
    const speciesUrl = mon.apiData?.species?.url ||
      `https://pokeapi.co/api/v2/pokemon-species/${name}`;
    const res = await fetch(speciesUrl);
    const data = await res.json();
    // Извлекаем имена групп: [{name: 'monster'}, {name: 'ground'}]
    const groups = (data.egg_groups || []).map((g: any) => g.name);
    eggGroupCache.set(name, groups);  // Кэшируем
    return groups;
  } catch(e) { return []; }
}

// getMonGender — получить пол покемона
export function getMonGender(mon: any) {
  return mon.gender || mon.apiData?.wildGender || null;
}

/** Иконка пола для UI: ♂ / ♀ / ⚪ (бесполый или неизвестен) */
export function genderIcon(mon: any): string {
  const g = getMonGender(mon);
  return g === 'male' ? '♂' : g === 'female' ? '♀' : '⚪';
}

// ── Проверка совместимости для разведения ──
// Условия:
//   (1) Разные покемоны (разные UID)
//   (2) Никто из пары ещё не спаривался (hasBred — один раз и всё)
//   (3) Оба имеют пол (кроме пары с Ditto — бесполые идут только через него)
//   (4) Разные полы (кроме Ditto)
//   (5) Общая яйце-группа ИЛИ один из них Ditto
export function areBreedingCompatible(mon1: any, mon2: any, groups1: string[], groups2: string[]) {
  if (mon1.uid === mon2.uid) return false;           // Один и тот же покемон
  if (mon1.hasBred || mon2.hasBred) return false;    // Уже спаривались — хватит
  const dittoInvolved = groups1.includes('ditto') || groups2.includes('ditto');
  const g1 = getMonGender(mon1);
  const g2 = getMonGender(mon2);
  if (!dittoInvolved) {
    if (!g1 || !g2) return false;                     // Нет пола
    if (g1 === g2) return false;                      // Один пол
  }
  const shared = groups1.filter(g => groups2.includes(g));  // Общие группы
  if (shared.length === 0 && !dittoInvolved) return false;
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
      if (!box.readyAt) {
        const key = pairRarityKey(m1, m2);
        box.readyAt = now + (EGG_LAY_MS[key] ?? EGG_LAY_MS.common);
      }
      if (now < box.readyAt) continue;
      // Время вышло — создаём яйцо
      const dittoA = (m1.apiData?.species?.name || m1.apiData?.name) === 'ditto';
      const dittoB = (m2.apiData?.species?.name || m2.apiData?.name) === 'ditto';
      const mother = dittoA ? m2 : dittoB ? m1
        : (getMonGender(m1) === 'female' ? m1 : m2);
      const father = mother === m1 ? m2 : m1;
      const species = mother.apiData?.species?.name || mother.apiData?.name;
      const eggTypes = mother.apiData?.types || [{ type: { name: 'normal' } }];

      // Наследование IV: среднее родителей ± случайность 2 (A5: оставить)
      const inheritIV = (parentVal: number) =>
        Math.min(31, Math.max(0, parentVal + (Math.random() < 0.5 ? 2 : -2)));
      const avgIV = (stat: string) => Math.round((m1.ivs[stat] + m2.ivs[stat]) / 2);
      const eggIvs = {
        hp: inheritIV(avgIV('hp')),
        atk: inheritIV(avgIV('atk')),
        def: inheritIV(avgIV('def')),
        spa: inheritIV(avgIV('spa')),
        spd: inheritIV(avgIV('spd')),
        spe: inheritIV(avgIV('spe'))
      };

      const rkey = pairRarityKey(m1, m2);
      const egg = {
        uid: generateUID(),
        species,
        types: eggTypes,
        ivs: eggIvs,
        readyTime: now + (HATCH_MS[rkey] ?? HATCH_MS.common),
        parent1Uid: m1.uid,
        parent2Uid: m2.uid,
        // A6: двойной перфект (все 31 у обоих) — шайни 1/128 вместо 1/1024
        shinyBoost: isDoublePerfect(m1, m2),
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

    // ── Проверка готовых к вылуплению яиц ──
    for (const egg of state.eggs) {
      if (now >= egg.readyTime) {
        await hatchEgg(egg);
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
// Запускает интервал: каждую минуту проверяет, есть ли
// яйца или пары, и если да — вызывает checkBreeding()
export function startBreedingCheck() {
  setInterval(() => {
    if (state.eggs.length > 0 || state.breedingPairs.length > 0) checkBreeding();
  }, BREEDING_CHECK_INTERVAL);
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
      breedLetter: ['A','B','C','D'][Math.floor(Math.random()*4)],  // Буква разведения
      gender: Math.random() < 0.5 ? 'male' : 'female',  // 50/50
      status: null, sleepTurns: 0,
      movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: pokeData.abilities[0]?.ability?.name || null,
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: [],
      isEgg: false,          // Уже не яйцо
      hasBred: false          // Ещё не разводился
    };

    // ── Наследование IV от родителей ──
    // Если есть оба родителя — берём по одному случайному IV от каждого
    if (eggData.parent1Uid && eggData.parent2Uid) {
      const allMons = [...state.myTeam, ...state.pcBoxes.flat()];
      const p1 = allMons.find((m: any) => m.uid === eggData.parent1Uid);
      const p2 = allMons.find((m: any) => m.uid === eggData.parent2Uid);
      if (p1) {
        const stats = ['hp','atk','def','spa','spd','spe'];
        const s1 = stats[Math.floor(Math.random()*stats.length)];  // Случайный стат от родителя 1
        const s2 = stats[Math.floor(Math.random()*stats.length)];  // Случайный стат от родителя 2
        if (p1.ivs) newMon.ivs[s1] = p1.ivs[s1];
        if (p2?.ivs) newMon.ivs[s2] = p2.ivs[s2];
      }
    }

    // Добавляем в команду или PC
    if (state.myTeam.length < 6) {
      state.myTeam.push(newMon);
      store.emit('notification:add', '🎉 Яйцо вылупилось!', `${pokeData.name} появился на свет!`);
      appendToLog(`🎉 Из яйца вылупился ${pokeData.name}!`, false, 'quest');
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
