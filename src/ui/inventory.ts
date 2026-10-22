// ─────────────────────────────────────────────────────────────
// inventory.ts — ИНВЕНТАРЬ И ПРЕДМЕТЫ
// ─────────────────────────────────────────────────────────────
// Управляет отображением инвентаря, использованием предметов из рюкзака,
// распределением EV, тренировкой покемонов, эволюцией через камни/предметы,
// а также выбором удерживаемых предметов (held items).
//
// ЗАВИСИМОСТИ:
//   game/getters.ts   — getTeamState, getInvState, toggleExpShare
//   game/actions.ts   — addItem, removeItem
//   game/state.ts     — getItemQty
//   game/store.ts     — store.getMaxStack
//   game/save.ts      — autoSave
//   ui/profile.ts     — refreshProfileUI, saveActiveMonData
//   ui/crafting.ts    — openCrafting
//   ui/tm.ts          — openMoveRelearner
//   ui/daycare.ts     — hatchEgg
//   ui/item-info.ts   — showItemInfoModal
//   ui/evolution.ts   — checkEvolution, triggerEvolution (lazy import)
//   battle/core.ts    — cureStatus, giveBerryToMon (lazy import)
//   utils/dom.ts      — showToast, showConfirmModal, showSelectionModal
//   utils/api.ts      — fetchPokeAPI
//   utils/sprite.ts   — getTypeColor
//   utils/items.ts    — itemDef
//   data/natures.ts   — natures
//
// ИСПОЛЬЗУЕТСЯ В:
//   src/game/init.ts         — updateInventoryDisplay, initInventoryEvents
//   src/battle/core.ts       — getHeldItemName (сообщения в бою)
//   src/ui/nav.ts            — renderInventory
//   src/ui/profile.ts        — getHeldItemName, openHeldItemPicker, updateDynamicEVs, applyEVs
//   src/ui/shop.ts           — updateInventoryDisplay
//   src/ui/admin.ts          — updateInventoryDisplay
//   src/ui/tm.ts             — updateInventoryDisplay
//   src/network/socket.ts    — updateInventoryDisplay
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   initInventoryEvents()     — привязывает обработчики QA-кнопок и кнопки held item
//   updateInventoryDisplay()  — обновляет весь интерфейс инвентаря (перерисовка + QA-метки)
//   renderInventory()         — полная отрисовка сетки предметов по категориям
//   renderBattleItemSelect()  — заполняет выпадающий список боевых предметов
//   updateQADisplays()        — обновляет числовые метки на QA-кнопках
//   useItem(itemId)           — основной обработчик использования предмета (большой switch)
//   getHeldItemName()         — возвращает русское название удерживаемого предмета
//   openHeldItemPicker()      — открывает модалку выбора held item для покемона
//   updateDynamicEVs()        — обновляет отображение доступных и оставшихся EV
//   applyEVs()                — применяет распределение EV
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

// getTeamState — возвращает состояние команды: myTeam, currentPokemonIndex, pokedexSeen и т.д.
// getInvState  — возвращает состояние инвентаря: ITEMS, inventory, money, eggs, trainingStages
// toggleExpShare — переключает Exp. Share (вкл/выкл)
import { getTeamState, getInvState, toggleExpShare } from '../game/getters.js';
import { evBudget } from '../battle/core.js';
// addItem — добавляет предмет в инвентарь (через store.dispatch)
// removeItem — удаляет предмет из инвентаря (через store.dispatch)
import { addItem, removeItem } from '../game/actions.js';
// getItemQty — возвращает количество предмета по ID из глобального state.inventory
// Например, getItemQty('pokeball') → 12
import { getItemQty, state } from '../game/state.js';
// refreshProfileUI — обновляет интерфейс профиля покемона (статы, иконки и т.д.)
// saveActiveMonData — сохраняет данные текущего покемона (EV, тренировка и т.д.)
import { refreshProfileUI, saveActiveMonData } from './profile.js';
// openCrafting — открывает интерфейс крафта (ремёсла)
import { openCrafting } from './crafting.js';
// openMoveRelearner — открывает модалку повторного изучения атак (TM/развитие)
// openNumberedTM — номерной диск tm01…tm100: учит КОНКРЕТНУЮ атаку (M-23)
import { openMoveRelearner, openNumberedTM } from './tm.js';
// hatchEgg — вылупляет яйцо (проверяет readyTime и добавляет покемона в команду)
import { hatchEgg } from './daycare.js';
import { breedRarity } from './daycare.js';
import { rollTraining, trainingPityMult } from '../data/training.js';
// autoSave — сохраняет игру (localStorage + сервер)
import { autoSave } from '../game/save.js';
// showItemInfoModal — показывает модалку с подробной информацией о предмете
import { showItemInfoModal } from './item-info.js';

// ── Lazy imports для разрыва циклических зависимостей ─────
// Проблема: inventory.ts → core.ts → evolution.ts → inventory.ts (цикл)
// Решение: динамический import() — файл грузится ТОЛЬКО при вызове функции
// Это работает потому что import() возвращает Promise, который резолвится позже

// _cureStatus — снимает статусное состояние с покемона (яд, паралич, сон и т.д.)
// Загружается из battle/core.js при первом вызове
async function _cureStatus(mon: any) {
  const m = await import('../battle/core.js');
  return m.cureStatus(mon);
}

// _giveBerryToMon — даёт ягоду покемону (лечит статус/восстанавливает HP)
// Загружается из battle/core.js при первом вызове
async function _giveBerryToMon(berryId: string) {
  const m = await import('../battle/core.js');
  return m.giveBerryToMon(berryId);
}

// _checkEvolution — проверяет, может ли покемон эволюционировать
// force — принудительная проверка (игнорирует уровень)
// itemId — конкретный камень эволюции для проверки
async function _checkEvolution(mon: any, force?: boolean, itemId?: string) {
  const m = await import('./evolution.js');
  return m.checkEvolution(mon, force, itemId);
}

// _triggerEvolution — запускает анимацию эволюции покемона в targetName
async function _triggerEvolution(mon: any, targetName: string) {
  const m = await import('./evolution.js');
  return m.triggerEvolution(mon, targetName);
}

// _maybeGrantShedinja — бонусная Шединья (нинкада), через тот же модуль
async function _maybeGrantShedinja(mon: any) {
  const m = await import('./evolution.js');
  return m.maybeGrantShedinja(mon);
}

// showToast — всплывающее уведомление (true=красное, false=зелёное)
// showConfirmModal — модалка подтверждения с callback
// showSelectionModal — модалка выбора из списка опций
import { showToast, showConfirmModal, showSelectionModal } from '../utils/dom.js';
// fetchPokeAPI — HTTP-клиент для PokeAPI с кэшированием
import { fetchPokeAPI } from '../utils/api.js';
// getTypeColor — возвращает HEX-цвет для типа покемона
import { getTypeColor } from '../utils/sprite.js';
// itemDef — возвращает ItemDef по ID предмета (из data/items.ts)
import { itemDef } from '../utils/items.js';
// natures — массив всех характеров (natures) с buff/nerf статами
import { natures } from '../data/natures.js';
// store — глобальная event-система с методами getMaxStack и т.д.
import { store } from '../game/store.js';
// checkNewMovesOnLevelUp — проверка новых атак при повышении уровня
import { checkNewMovesOnLevelUp } from './levelup_moves.js';

import { calculateStat as calculateStatShared } from '../battle/stats.js';

// ── ИНИЦИАЛИЗАЦИЯ КНОПКИ ПРЕДМЕТОВ И HELD ITEM ──────────
// Вызывается один раз при старте игры (init.ts).
// Раньше здесь было 10 отдельных кнопок (Аптечка, Конфета, ...) — захламляли
// панель. Теперь одна кнопка «Предметы» открывает модалку со списком того,
// что реально есть в рюкзаке.
export function initInventoryEvents() {
  // Карта соответствия: ID предмета → подпись. Тот же набор, что был кнопками.
  const qaMap = {
    'potion': 'Аптечка (+20 HP)',
    'superPotion': 'Супер Аптечка (+50 HP)',
    'fullRestore': 'Полное восстановление',
    'rareCandy': 'Конфета (уровень)',
    'vanillaCandy': 'Ванильная конфета (+2 EV)',
    'commonCandy': 'Обычная конфета (+3 EV)',
    'fireCandy': 'Огненная конфета (+3 EV)',
    'waterCandy': 'Водная конфета (+3 EV)',
    'electricCandy': 'Электрическая конфета (+3 EV)',
    'grassCandy': 'Травяная конфета (+3 EV)',
    'iceCandy': 'Ледяная конфета (+3 EV)',
    'fightingCandy': 'Боевая конфета (+3 EV)',
    'poisonCandy': 'Ядовитая конфета (+3 EV)',
    'groundCandy': 'Земляная конфета (+3 EV)',
    'flyingCandy': 'Летающая конфета (+3 EV)',
    'psychicCandy': 'Психическая конфета (+3 EV)',
    'bugCandy': 'Жучиная конфета (+3 EV)',
    'rockCandy': 'Каменная конфета (+3 EV)',
    'ghostCandy': 'Призрачная конфета (+3 EV)',
    'dragonCandy': 'Драконья конфета (+3 EV)',
    'darkCandy': 'Тёмная конфета (+3 EV)',
    'steelCandy': 'Стальная конфета (+3 EV)',
    'fairyCandy': 'Волшебная конфета (+3 EV)',
    'normalCandy': 'Нормальная конфета (+3 EV)',
    'typeCandyBox': 'Коробка конфет (10 случайных)',
    'hpUp': 'Витамин (+EV)',
    'train': 'Тренировка (усиление стата)',
    'weaken': 'Ослабление (сброс тренировки)',
    'evolutionStone': 'Камень эволюции',
    'tm': 'TM-диск (без ограничений)',
    'tmWeak': 'ТМ слабая (<60)',
    'tmMid': 'ТМ средняя (≤90)',
    'tmTop': 'ТМ топовая (любая)',
  };

  // ── Кнопка «Предметы»: модалка со списком ──
  const itemsBtn = document.getElementById('qa-items');
  if (itemsBtn) {
    itemsBtn.addEventListener('click', () => openItemsMenu(qaMap));
  }
}

// ── openItemsMenu: модалка использования предметов ──────
// Показывает только то, что есть в наличии (qty > 0), + пункт held-предмета.
// Выборки по несуществующим кнопкам больше нет — нечему рассинхронизироваться.
export function openItemsMenu(qaMap?: Record<string, string>) {
  const map = qaMap || {
    'potion': 'Аптечка (+20 HP)',
    'superPotion': 'Супер Аптечка (+50 HP)',
    'fullRestore': 'Полное восстановление',
    'rareCandy': 'Конфета (уровень)',
    'vanillaCandy': 'Ванильная конфета (+2 EV)',
    'commonCandy': 'Обычная конфета (+3 EV)',
    'fireCandy': 'Огненная конфета (+3 EV)',
    'waterCandy': 'Водная конфета (+3 EV)',
    'electricCandy': 'Электрическая конфета (+3 EV)',
    'grassCandy': 'Травяная конфета (+3 EV)',
    'iceCandy': 'Ледяная конфета (+3 EV)',
    'fightingCandy': 'Боевая конфета (+3 EV)',
    'poisonCandy': 'Ядовитая конфета (+3 EV)',
    'groundCandy': 'Земляная конфета (+3 EV)',
    'flyingCandy': 'Летающая конфета (+3 EV)',
    'psychicCandy': 'Психическая конфета (+3 EV)',
    'bugCandy': 'Жучиная конфета (+3 EV)',
    'rockCandy': 'Каменная конфета (+3 EV)',
    'ghostCandy': 'Призрачная конфета (+3 EV)',
    'dragonCandy': 'Драконья конфета (+3 EV)',
    'darkCandy': 'Тёмная конфета (+3 EV)',
    'steelCandy': 'Стальная конфета (+3 EV)',
    'fairyCandy': 'Волшебная конфета (+3 EV)',
    'normalCandy': 'Нормальная конфета (+3 EV)',
    'typeCandyBox': 'Коробка конфет (10 случайных)',
    'hpUp': 'Витамин (+EV)',
    'train': 'Тренировка (усиление стата)',
    'weaken': 'Ослабление (сброс тренировки)',
    'evolutionStone': 'Камень эволюции',
    'tm': 'TM-диск (без ограничений)',
    'tmWeak': 'ТМ слабая (<60)',
    'tmMid': 'ТМ средняя (≤90)',
    'tmTop': 'ТМ топовая (любая)',
  };
  const entries: Array<{ label: string; subtitle: string; run: () => void }> = [];
  for (const [itemId, hint] of Object.entries(map)) {
    const qty = getItemQty(itemId);
    if (qty <= 0) continue;
    const def = getInvState().ITEMS.find(i => i.id === itemId);
    entries.push({
      label: `${def?.nameRu || itemId} ×${qty}`,
      subtitle: hint,
      run: () => useItem(itemId),
    });
  }
  entries.push({
    label: '🎽 Удерживаемый предмет…',
    subtitle: 'Выбрать предмет покемону',
    run: () => {
      const idx = getTeamState().currentPokemonIndex;
      if (idx !== null) openHeldItemPicker(idx);
      else showToast('Сначала выберите покемона во вкладке "Команда"!', true);
    },
  });
  showSelectionModal('🎒 Предметы', entries, (i: number) => entries[i]?.run(), true);
}

// ── УПРАВЛЕНИЕ EV (Effort Values / Очки усилий) ──────────

// updateDynamicEVs: обновляет отображение доступных и оставшихся EV
// Вызывается при изменении EV-инпутов
export function updateDynamicEVs() {
  // Если покемон не выбран — выходим
  if (getTeamState().currentPokemonIndex === null) return;
  // Берём текущего покемона
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Максимум EV = потрачено + пул + legacy (evBudget); остаток — пул
  // минус набранное в инпутах сверх текущих evs.
  const maxTotalEV = evBudget(mon);
  // Отображаем максимум
  document.getElementById('ev-total').innerText = String(maxTotalEV);

  // Собираем все EV-инпуты (поля ввода распределения)
  const evInputs = document.querySelectorAll('.reborn-input-ev');
  let inputsTotal = 0;
  // Суммируем все введённые значения
  evInputs.forEach(input => inputsTotal += parseInt((input as HTMLInputElement).value) || 0);

  const spentNow = ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    .reduce((a, s) => a + (mon.evs?.[s] || 0), 0);
  const growth = Math.max(0, inputsTotal - spentNow);
  const remaining = Math.max(0, (mon.evPool || 0) - growth);
  // Отображаем остаток пула
  document.getElementById('ev-remaining').innerText = String(remaining);
}

// ── applyEVs: применить распределение EV ─────────────────
// Пишет инпуты в mon.evs через saveActiveMonData (учёт пула + лок внутри).
// Успешное применение ЛОЧИТ evs (D4): дальше только добавление, забрать назад
// нельзя. Возврат false — не хватило пула, инпуты откачены.
export function applyEVs() {
  // Проверяем, выбран ли покемон
  if (getTeamState().currentPokemonIndex === null) return;
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Сохраняем данные покемона (EV записываются в mon.evs, пул списывается)
  if (!saveActiveMonData()) return;  // тост уже показан внутри
  mon.evsLocked = true;  // ЛОК: дальше статы только растут
  // Обновляем отображение
  updateDynamicEVs();
  autoSave();
  showToast('EV применены и заблокированы! Дальше — только добавлять из пула.', false);
}

// ── updateStats: обновить отображение статов покемона ─────
// Вычисляет финальные значения статов с учётом:
//   - Базовых статов (base_stat)
//   - Индивидуальных значений (IV)
//   - Очков усилий (EV)
//   - Характера (Nature) — buff/nerf
//   - Тренировки (trainingStat)
//   - Уровня (baseLevel + candiesEaten)
function updateStats() {
  // Если покемон не выбран — выходим
  if (getTeamState().currentPokemonIndex === null) return;
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Получаем характер покемона из массива natures по индексу
  // nature.name выглядит как "Adamant (+Atk / -SpA)"
  const localNature = natures[mon.natureIdx];
  // Извлекаем название характера: берём второе слово, убираем скобки
  // Например: "Adamant (+Atk -SpA)" → "Adamant"
  document.getElementById('info-nature').innerText = String(
    localNature.name.split(' ')[1].replace(/[()]/g, '')
  );

  // Словарь маппинга: имя стата → {индекс в apiData.stats, ключ в evs/ivs}
  const statsMapping = {
    'hp': { idx: 0, el: 'hp' },              // HP
    'attack': { idx: 1, el: 'atk' },          // Атака
    'defense': { idx: 2, el: 'def' },         // Защита
    'special-attack': { idx: 3, el: 'spa' },  // Спец. атака
    'special-defense': { idx: 4, el: 'spd' },  // Спец. защита
    'speed': { idx: 5, el: 'spe' }            // Скорость
  };

  // Текущий уровень = базовый уровень + съеденные конфеты
  const curLvl = mon.baseLevel + mon.candiesEaten;

  // Проходим по всем статам и вычисляем финальные значения
  for (const [statName, info] of Object.entries(statsMapping)) {
    let isTrained = false; // Флаг тренировки (для подсветки в UI)

    // Берём DOM-элемент названия стата для подсветки
    const labelEl = document.getElementById(`label-${info.el}`);
    if (labelEl) {
      labelEl.className = 'stat-name';  // Сбрасываем класс
      // Подсветка характера: сам множитель считает calculateStat
      if (localNature.buff === info.el) {
        labelEl.classList.add('nature-buff');  // Красная подсветка
      } else if (localNature.nerf === info.el) {
        labelEl.classList.add('nature-nerf');   // Синяя подсветка
      }

      // Если этот стат выбран для тренировки — устанавливаем флаг
      if (mon.trainingStat === info.el) {
        isTrained = true;
      }
    }

    // Считаем тем же кодом, что и бой (battle/stats.ts).
    // Раньше здесь была третья копия формулы: она не учитывала стадии и
    // предметы и давала другие числа, чем бой — расхождение доходило до 39.6 %
    // на тренированном покемоне.
    const finalStat = calculateStatShared(mon, statName, { isWild: false, level: curLvl });

    // Отображаем финальное значение стата
    document.getElementById(`val-${info.el}`).innerText = String(finalStat);

    // Подсвечиваем тренированные статы зелёным
    const valEl = document.getElementById(`val-${info.el}`);
    if (valEl) {
      if (isTrained) {
        valEl.style.color = '#34c759';  // Зелёный (тренировано)
        valEl.title = 'Натренировано';   // Туман подсказка
      } else {
        valEl.style.color = '';          // Стандартный цвет
        valEl.title = '';
      }
    }
  }
}

// ── updateInventoryDisplay: точка обновления инвентаря ────
// Вызывается из многих мест после изменения инвентаря
export function updateInventoryDisplay() {
  renderInventory();           // Полная перерисовка сетки предметов
  renderBattleItemSelect();    // Обновление выпадающего списка боевых предметов
  updateQADisplays();          // Обновление числовых меток на QA-кнопках
}

// ── renderBattleItemSelect: заполнить выпадающий список боевых предметов ──
// Используется в битве для выбора предмета из рюкзака
export function renderBattleItemSelect() {
  // Находим select-элемент для боевых предметов
  const select = document.getElementById('battle-item-select');
  if (!select) return;  // Если нет на странице — выходим
  select.innerHTML = ''; // Очищаем

  // Фильтруем предметы: реализованные И есть в наличии И (
  //   покебол, или используемый, или лечение статусов, или восстановление PP, или камни эволюции
  // )
  const battleItems = getInvState().ITEMS.filter(i =>
    i.implemented && getItemQty(i.id) > 0 && (
      i.isBall || i.isUsable || i.category === 'statusCure' ||
      i.category === 'ppRecovery' || i.category === 'evolutionStones'
    )
  );

  // Для каждого подходящего предмета создаём option
  battleItems.forEach(item => {
    const qty = getItemQty(item.id);   // Количество в инвентаре
    const opt = document.createElement('option');
    opt.value = item.id;                // Значение = ID предмета
    opt.textContent = `${item.nameRu} (${qty})`;  // Текст: "Название (5)"
    select.appendChild(opt);
  });
}

// ── updateQADisplays: счётчик на кнопке «Предметы» ──
// Показывает, сколько видов usable-предметов сейчас в наличии.
// Старые per-кнопочные метки (qa-qty-potion и т.д.) удалены вместе с кнопками.
export function updateQADisplays() {
  const el = document.getElementById('qa-qty-items');
  if (!el) return;
  const ids = ['potion', 'superPotion', 'fullRestore', 'rareCandy', 'hpUp', 'train', 'weaken', 'evolutionStone', 'tm'];
  el.textContent = String(ids.filter((id) => getItemQty(id) > 0).length);
}

// ── renderInventory: полная отрисовка сетки предметов ─────
// Создаёт DOM для всех предметов в инвентаре, сгруппированных по категориям
export function renderInventory() {
  // Находим контейнер для предметов
  const container = document.getElementById('inventory-items');
  if (!container) return;  // Если нет на странице — выходим

  // Очищаем контейнер (полная перерисовка)
  container.innerHTML = '';

  // ── 1. Отображение валюты (кредиты) ──
  // Создаём заголовок категории
  const moneyTitle = document.createElement('div');
  moneyTitle.className = 'inv-category-title';
  moneyTitle.textContent = 'Валюта';
  container.appendChild(moneyTitle);

  // Создаём сетку для валюты (пока только кредиты)
  const moneyGrid = document.createElement('div');
  moneyGrid.className = 'inv-grid';
  // HTML ячейки: иконка кредит-монеты, название "Кредиты", количество
  moneyGrid.innerHTML = `
    <div class="inv-item" style="cursor: default;">
      <div class="inv-item-icon"><img src="assets/items/credit_coin.png" style="width:32px;height:32px;image-rendering:auto;" alt="¥"></div>
      <div class="inv-item-name">Кредиты</div>
      <div class="inv-item-qty">x${escapeHtml(String(getInvState().money))}</div>
    </div>
  `;
  container.appendChild(moneyGrid);

  // ── 2. Отображение яиц (если есть) ──
  if (getInvState().eggs.length > 0) {
    const eggTitle = document.createElement('div');
    eggTitle.className = 'inv-category-title';
    eggTitle.textContent = '🥚 Яйца';
    container.appendChild(eggTitle);

    const eggGrid = document.createElement('div');
    eggGrid.className = 'inv-grid';
    const now = Date.now();  // Текущее время для расчёта оставшегося времени

    // Проходим по всем яйцам
    getInvState().eggs.forEach((egg, idx) => {
      const cell = document.createElement('div');
      cell.className = 'inv-grid-item';
      // Берём первый тип покемона для цвета рамки
      const eggTypes = egg.types || [{ type: { name: 'normal' } }];
      const eggColor = getTypeColor(eggTypes[0]?.type?.name || 'normal');
      cell.style.cssText = `cursor:pointer;border-color:${eggColor};`;
      cell.style.background = `${eggColor}22`;  // Цвет фона с прозрачностью

      // Иконка яйца (пиксельная графика)
      const eggImg = document.createElement('img');
      eggImg.src = 'assets/egg.png';
      eggImg.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;';
      cell.appendChild(eggImg);

      // Название (вид покемона, который вылупится)
      const name = document.createElement('div');
      name.className = 'inv-grid-name';
      name.textContent = egg.species || 'Яйцо';
      cell.appendChild(name);

      // Гены (IV) в сокращённом формате: h12a31d5s20sa10sd25
      const iv = egg.ivs || {};
      const geneStr = `h${iv.hp || 0}a${iv.atk || 0}d${iv.def || 0}s${iv.spe || 0}sa${iv.spa || 0}sd${iv.spd || 0}`;
      const geneDiv = document.createElement('div');
      geneDiv.style.cssText = 'font-size:0.5rem;color:#4682B4;font-family:monospace;';
      geneDiv.textContent = geneStr;
      cell.appendChild(geneDiv);

      // Бейдж с таймером или значком готовности
      const timeLeft = Math.max(0, egg.readyTime - now);
      const badge = document.createElement('div');
      badge.className = 'inv-grid-badge';
      badge.style.cssText = `background:${eggColor};font-size:0.5rem;min-width:28px;`;
      if (timeLeft <= 0) {
        // Яйцо готово к вылуплению — показываем галочку
        badge.textContent = '✓';
        // При клике вызываем hatchEgg()
        cell.addEventListener('click', () => hatchEgg(egg));
      } else {
        // Яйцо ещё не готово — показываем оставшееся время
        const mins = Math.ceil(timeLeft / 60000);
        badge.textContent = mins > 60 ? `${Math.floor(mins/60)}ч` : `${mins}м`;
      }
      cell.appendChild(badge);

      eggGrid.appendChild(cell);
    });
    container.appendChild(eggGrid);
  }

  // ── 3. Группировка предметов по категориям ──
  // Словарь: ID категории → русское название для отображения.
  // Покрывает ВСЕ категории из data/items.ts: без записи здесь предметы
  // категории (revive/maxRevive, TM, ценности, мульча, валюта) были невидимы,
  // хотя лежали в инвентаре и тратились в бою.
  const categories = {
    balls: 'Покеболы',
    healing: 'Восстановление HP',
    revival: 'Реанимация',
    statusCure: 'Лечение статусов',
    ppRecovery: 'Восстановление PP',
    vitamins: 'Витамины',
    evolutionStones: 'Камни Эволюции',
    berries: 'Ягоды',
    battle: 'Боевые',
    tm: 'TM',
    quest: 'Квестовые',
    training: 'Тренировка',
    tickets: 'Билеты',
    crafting: 'Ремесленные',
    artifacts: 'Артефакты',
    awards: 'Награды',
    valuable: 'Ценности',
    mulch: 'Мульча',
    currency: 'Валюта',
    other: 'Прочее',
  };

  let hasAnyItems = false;  // Флаг: есть ли хоть один предмет

  // Проходим по всем категориям
  for (const [catId, catName] of Object.entries(categories)) {
    // Фильтруем предметы: только этой категории И есть в наличии
    const catItems = getInvState().ITEMS.filter(
      item => item.category === catId && getItemQty(item.id) > 0
    );
    if (catItems.length === 0) continue;  // Пропускаем пустые категории
    hasAnyItems = true;

    // Заголовок категории
    const title = document.createElement('div');
    title.className = 'inv-category-title';
    title.textContent = catName;
    container.appendChild(title);

    // Сетка для предметов этой категории
    const grid = document.createElement('div');
    grid.className = 'inv-grid';

    // Проходим по предметам категории
    catItems.forEach(item => {
      const qty = getItemQty(item.id);  // Количество в инвентаре
      const cell = document.createElement('div');
      cell.className = 'inv-grid-item';
      cell.dataset.itemId = item.id;    // Сохраняем ID для обработчика клика

      // ── Спрайт предмета ──
      const img = document.createElement('img');
      img.className = 'inv-grid-sprite';
      // Определяем источник спрайта:
      if (item.spriteType === 'pokeapi') {
        // Если тип PokeAPI — берём из репозитория PokeAPI спрайтов
        img.src = item.sprite.startsWith('http')
          ? item.sprite  // Полный URL (если задан)
          : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${item.sprite}`;
      } else {
        // Локальный спрайт из assets/items/
        img.src = item.sprite.startsWith('http')
          ? item.sprite
          : `${import.meta.env.BASE_URL}assets/items/${item.sprite}`;
      }
      img.alt = item.nameRu;
      img.loading = 'lazy';  // Ленивая загрузка (только когда виден)

      // Если спрайт не загрузился — показываем заглушку 1.gif
      img.onerror = () => {
        img.src = `${import.meta.env.BASE_URL}assets/items/1.gif`;
        img.onerror = null;  // Предотвращаем бесконечный цикл ошибок
      };
      cell.appendChild(img);

      // ── Название предмета ──
      const name = document.createElement('div');
      name.className = 'inv-grid-name';
      name.textContent = item.nameRu;
      cell.appendChild(name);

      // ── Кнопка "Юз" (использовать) если предмет используемый ──
      if (item.isUsable && item.implemented) {
        const useBtn = document.createElement('button');
        useBtn.className = 'inv-grid-use';
        // Если это "Ослабление" — добавляем класс danger (красная кнопка)
        if (item.id === 'weaken') useBtn.classList.add('danger');
        useBtn.textContent = 'Юз';
        useBtn.dataset.itemId = item.id;  // ID для обработчика
        cell.appendChild(useBtn);
      }

      // ── Бейдж с количеством ──
      // Показывает количество и максимум стека (если меньше 999)
      const maxStack = store.getMaxStack(item.id);
      const badge = document.createElement('div');
      badge.className = 'inv-grid-badge';
      // Формат: "5" или "5/10" если есть лимит стека
      badge.textContent = qty + (maxStack < 999 ? '/' + maxStack : '');
      // Если количество достигло максимума — красный текст
      if (qty >= maxStack) badge.style.color = '#ff3b30';
      cell.appendChild(badge);

      grid.appendChild(cell);
    });

    container.appendChild(grid);
  }

  // ── Если нет ни предметов, ни яиц — показываем "Рюкзак пуст" ──
  if (!hasAnyItems && getInvState().eggs.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--tma-text-muted);font-size:0.9rem;">Рюкзак пуст</div>';
  }

  // ── Обработчик клика на ячейку предмета → showItemInfoModal ──
  container.querySelectorAll('.inv-grid-item').forEach(cell => {
    cell.addEventListener('click', (e) => {
      // Если кликнули по кнопке "Юз" — не открываем инфо (кнопка обрабатывается отдельно)
      if ((e.target as HTMLElement).closest('.inv-grid-use')) return;
      const itemId = (cell as HTMLElement).dataset.itemId;  // ID из data-атрибута
      const item = getInvState().ITEMS.find(i => i.id === itemId);
      if (!item) return;
      const qty = getItemQty(itemId);
      // Дополнительная информация о цене
      const priceInfo = item.price > 0 ? `\n💰 Цена: ${item.price.toLocaleString()} кр.` : '';
      const sellInfo = item.sellPrice > 0 ? `\n🏷️ Продажа: ${item.sellPrice.toLocaleString()} кр.` : '';
      // Показываем модалку с информацией о предмете
      showItemInfoModal(item, qty);
    });
  });

  // ── Обработчик клика на кнопку "Юз" → useItem ──
  container.querySelectorAll('.inv-grid-use').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();  // Останавливаем всплытие (чтобы не сработал клик на ячейку)
      const itemId = (btn as HTMLElement).dataset.itemId;
      useItem(itemId);  // Вызываем использование предмета
    });
  });
}

/** Типовая конфета → тип. Решение: 18 конфет, каждая только своему типу. */
export const TYPE_CANDY_TYPE: Record<string, string> = {
  normalCandy: 'normal', fireCandy: 'fire', waterCandy: 'water',
  electricCandy: 'electric', grassCandy: 'grass', iceCandy: 'ice',
  fightingCandy: 'fighting', poisonCandy: 'poison', groundCandy: 'ground',
  flyingCandy: 'flying', psychicCandy: 'psychic', bugCandy: 'bug',
  rockCandy: 'rock', ghostCandy: 'ghost', dragonCandy: 'dragon',
  darkCandy: 'dark', steelCandy: 'steel', fairyCandy: 'fairy',
};

/** Подходит ли типовая конфета покемону (есть ли нужный тип). Чисто, для тестов. */
export function canEatTypeCandy(mon: any, itemId: string): boolean {
  const need = TYPE_CANDY_TYPE[itemId];
  if (!need) return false;
  return (mon?.apiData?.types || []).some((t: any) => t?.type?.name === need);
}

/**
 * pickRandomCandies — 10 случайных типовых конфет из коробки.
 * Чисто, rand инжектится для тестов. Повторы возможны (честный рандом).
 */
export function pickRandomCandies(n: number, rand: () => number = Math.random): string[] {
  const pool = Object.keys(TYPE_CANDY_TYPE);
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(rand() * pool.length)]);
  return out;
}

// ── feedCandy: скормить конфету (общий путь всех видов) ──
// +1 уровень всегда, +EV в пул по типу конфеты, пересчёт HP, эволюция,
// новые атаки. Возвращает false если уровень уже 100.
async function feedCandy(mon, itemId, label, evGain = 4) {
  // Максимальный уровень: 100
  if (mon.baseLevel + mon.candiesEaten >= 100) {
    showToast('Достигнут максимальный 100 уровень!', true);
    return false;
  }
  removeItem(itemId);
  mon.candiesEaten++;          // Увеличиваем съеденные конфеты
  if (typeof mon.evPool !== 'number') mon.evPool = 0;
  mon.evPool += evGain;        // EV в пул на ручное распределение
  // Счастье могло отсутствовать у старых сейвов — NaN вместо числа ломал
  // всю дальнейшую арифметику молча. Дефолт 70 (канон).
  if (typeof mon.happiness !== 'number' || Number.isNaN(mon.happiness)) mon.happiness = 70;
  mon.happiness += 2;          // +2 к счастью
  if (mon.happiness > 255) mon.happiness = 255;

  // ── Пересчёт HP при повышении уровня (с защитой от кривых данных) ──
  // mon без apiData/ivs/evs (старые сейвы, трейд-заглушки) раньше роняли
  // feedCandy исключением ПОСЛЕ списания конфеты: предмет съеден, эффекта нет
  // («нерабочие конфеты»). Теперь — фолбэки по канону средних значений.
  const stats = mon.apiData?.stats;
  const baseHp = (stats && typeof stats[0]?.base_stat === 'number') ? stats[0].base_stat : 45;
  const ivHp = (mon.ivs && typeof mon.ivs.hp === 'number') ? mon.ivs.hp : 15;
  const evHp = (mon.evs && typeof mon.evs.hp === 'number') ? mon.evs.hp : 0;
  const curLvl = mon.baseLevel + mon.candiesEaten;  // Новый уровень
  const oldMax = mon.maxHp;
  mon.maxHp = Math.floor(0.01 * (2 * baseHp + ivHp + Math.floor(0.25 * evHp)) * curLvl) + curLvl + 10;
  // Добавляем разницу к текущему HP (чтобы не было потери HP при левелапе)
  mon.currentHp += (mon.maxHp - oldMax);

  // ── Проверка эволюции ──
  const evoPromise = (async () => {
    const evoTarget = await _checkEvolution(mon);
    if (evoTarget) {
      await _triggerEvolution(mon, evoTarget.name);
      if (evoTarget.shedBonus) await _maybeGrantShedinja(mon);
      refreshProfileUI();
    }
  })();

  // ── Изучение новых атак по уровню (через единую функцию) ──
  (async () => {
    await evoPromise;  // Ждём эволюцию, чтобы избежать race condition
    await checkNewMovesOnLevelUp(mon, curLvl);
  })();

  refreshProfileUI();
  autoSave();
  showToast(`Вы скормили ${label}! Уровень повышен до ${curLvl}, +${evGain} EV в пул.`, false);
  return true;
}

// ── Таблицы эффектов — в src/data/item-effects.ts (leaf-модуль) ──
// Реэкспорт для совместимости (тесты и старый код тянут отсюда).
export { HEAL_HP, CURE_ONE, CURE_ALL, EXP_CANDY_XP, WING_EV, BERRY_MANUAL, REVIVE_MODE } from '../data/item-effects.js';
import { HEAL_HP, CURE_ONE, EXP_CANDY_XP, WING_EV } from '../data/item-effects.js';
import { trackNPCQuests } from '../game/quest-track.js';

/**
 * trackUse — засчитать использование предмета в квесты use_item.
 * Вызывать ТОЛЬКО после успешного применения (не при отказах!).
 * Трекер сам отфильтрует по filter.itemId; try/catch — использование
 * предмета никогда не должно ронять UI из-за квестов.
 */
function trackUse(itemId: string): void {
  try {
    trackNPCQuests('use_item', { amount: 1, itemId });
  } catch { /* ignore */ }
}

// ── grantBattleExp: опыт без предмета (PvP-награды, квесты) ──
// Тот же level-up цикл, что в feedExp, но без списания и тостов: вызывающий
// сам решает, как сообщить (пачкой), иначе 6 покемонов = 6 тостов.
// Возвращает число level-up.
export async function grantBattleExp(mon: any, amount: number): Promise<number> {
  if (!mon || (mon.baseLevel + (mon.candiesEaten || 0)) >= 100 || !(amount > 0)) return 0;
  if (typeof mon.exp !== 'number') {
    mon.exp = Math.pow(mon.baseLevel, 3);
    mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
  }
  mon.exp += amount;
  let ups = 0;
  const st = mon.apiData?.stats;
  const bHp = (st && typeof st[0]?.base_stat === 'number') ? st[0].base_stat : 45;
  const iHp = (mon.ivs && typeof mon.ivs.hp === 'number') ? mon.ivs.hp : 0;
  const eHp = (mon.evs && typeof mon.evs.hp === 'number') ? mon.evs.hp : 0;
  while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
    mon.baseLevel++;
    ups++;
    mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
    const lvl = mon.baseLevel + (mon.candiesEaten || 0);
    const oldMax = mon.maxHp;
    mon.maxHp = Math.floor(0.01 * (2 * bHp + iHp + Math.floor(0.25 * eHp)) * lvl) + lvl + 10;
    mon.currentHp += (mon.maxHp - oldMax);
    const m = await import('../battle/core.js');
    if (typeof m.grantLevelUpEVs === 'function') {
      m.grantLevelUpEVs(mon);
    }
  }
  const evoTarget = await _checkEvolution(mon);
  if (evoTarget) {
    await _triggerEvolution(mon, evoTarget.name);
    if (evoTarget.shedBonus) await _maybeGrantShedinja(mon);
  }
  await checkNewMovesOnLevelUp(mon, mon.baseLevel + (mon.candiesEaten || 0));
  return ups;
}

// ── feedExp: скормить EXP-конфету ──
// Даёт опыт (не уровень напрямую): инициализация exp, добавление,
// цикл level-up с пересчётом HP/EV/эволюцией/атаками — как в бою.
async function feedExp(mon, itemId, label, amount) {
  const curLvl = mon.baseLevel + (mon.candiesEaten || 0);
  if (curLvl >= 100) {
    showToast('Достигнут максимальный 100 уровень!', true);
    return false;
  }
  if (typeof mon.exp !== 'number') {
    mon.exp = Math.pow(mon.baseLevel, 3);
    mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
  }
  removeItem(itemId);
  mon.exp += amount;
  let ups = 0;
  // Тот же фолбэк, что в feedCandy: кривые данные не должны съедать конфету.
  const st = mon.apiData?.stats;
  const bHp = (st && typeof st[0]?.base_stat === 'number') ? st[0].base_stat : 45;
  const iHp = (mon.ivs && typeof mon.ivs.hp === 'number') ? mon.ivs.hp : 15;
  const eHp = (mon.evs && typeof mon.evs.hp === 'number') ? mon.evs.hp : 0;
  while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
    mon.baseLevel++;
    ups++;
    mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
    const lvl = mon.baseLevel + (mon.candiesEaten || 0);
    const oldMax = mon.maxHp;
    mon.maxHp = Math.floor(0.01 * (2 * bHp + iHp + Math.floor(0.25 * eHp)) * lvl) + lvl + 10;
    mon.currentHp += (mon.maxHp - oldMax);
    const m = await import('../battle/core.js');
    if (typeof m.grantLevelUpEVs === 'function') {
      m.grantLevelUpEVs(mon);
    }
  }
  const evoTarget = await _checkEvolution(mon);
  if (evoTarget) {
    await _triggerEvolution(mon, evoTarget.name);
    if (evoTarget.shedBonus) await _maybeGrantShedinja(mon);
  }
  await checkNewMovesOnLevelUp(mon, mon.baseLevel + (mon.candiesEaten || 0));
  refreshProfileUI();
  autoSave();
  // Видимый прогресс: маленькая конфета на высоком уровне иначе выглядит
  // «нерабочей» (+3000 EXP в никуда). Показываем, сколько осталось до уровня.
  const lvlNow = mon.baseLevel + (mon.candiesEaten || 0);
  const need = Math.max(0, (mon.expToNext || 0) - (mon.exp || 0));
  showToast(`${label}: +${amount.toLocaleString()} EXP${ups ? `, уровень повышен (${ups})` : ` (до Ур.${lvlNow + 1} осталось ${need.toLocaleString()})`}!`, false);
  return true;
}

// ── useItem: основной обработчик использования предмета ──
// Принимает itemId — ID предмета (строка)
// Это огромный switch-case с логикой для каждого типа предмета
// Вызывается из QA-кнопок, из сетки инвентаря, из боя
export async function useItem(itemId) {
  // Ищем предмет в глобальном списке всех предметов
  const item = getInvState().ITEMS.find(i => i.id === itemId);
  if (!item) return showToast('Предмет не найден!', true);  // Предмет не существует
  if (getItemQty(itemId) <= 0) return showToast(`Нет ${item.nameRu}!`, true);  // Нет в наличии
  if (!item.isUsable) return showToast(`${item.nameRu} нельзя использовать из рюкзака.`, true);  // Нельзя юзать

  // ── Определяем, нужен ли выбранный покемон ──
  // Некоторые предметы работают без покемона (удочки, крафт, коробки,
  // репелленты, приманки, флейты, верёвка; куклы — только в бою)
  const noPokemonItems = ['craftersKit', 'oldRod', 'goodRod', 'superRod', 'typeCandyBox',
    'repel', 'superRepel', 'maxRepel', 'lure', 'superLure', 'maxLure',
    'blackFlute', 'whiteFlute', 'escapeRope'];
  const needsPokemon = !noPokemonItems.includes(itemId);

  // Если нужен покемон, но не выбран — ошибка
  if (needsPokemon && getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  }

  // Берём текущего покемона (если нужен)
  const mon = needsPokemon ? getTeamState().myTeam[getTeamState().currentPokemonIndex] : null;
  if (needsPokemon && !mon) return showToast('Покемон не найден!', true);

  // ── Номерные ТМ (M-23): tm01…tm100 учат КОНКРЕТНУЮ атаку из site learnset ──
  // Одноразовые (сгорают). Проверки qty/isUsable/выбора покемона — выше.
  // Дженерик-диски (tm/tmWeak/tmMid/tmTop) идут в switch ниже (репитер).
  if (/^tm\d+$/.test(itemId)) {
    await openNumberedTM(itemId);
    return;
  }

  // ── Огромный switch-case по ID предмета ──
  switch (itemId) {
    // ── Аптечка (Potion): +20 HP ──
    case 'potion': {
      // Проверка: здоровье не должно быть полным
      if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
      removeItem('potion');                     // Убираем предмет из инвентаря
      mon.currentHp += 20;                       // Восстанавливаем 20 HP
      if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;  // Не больше максимума
      refreshProfileUI();                        // Обновляем UI профиля
      showToast(`Вы использовали Аптечку. Здоровье ${mon.apiData.name} восстановлено!`, false);
      break;
    }

    // ── Супер Аптечка (Super Potion): +50 HP ──
    case 'superPotion': {
      if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
      removeItem('superPotion');
      mon.currentHp += 50;
      if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;
      refreshProfileUI();
      showToast(`Супер Аптечка использована! Здоровье ${mon.nickname || mon.apiData.name} восстановлено.`, false);
      break;
    }

    // ── Полное восстановление (Full Restore): HP + статус ──
    case 'fullRestore': {
      if (mon.currentHp >= mon.maxHp && !mon.status) return showToast('Здоровье уже полное!', true);
      removeItem('fullRestore');
      mon.currentHp = mon.maxHp;     // Полное HP
      await _cureStatus(mon);         // Снимаем все статусные эффекты
      refreshProfileUI();
      showToast(`Полное Восстановление использовано! ${mon.nickname || mon.apiData.name} полностью здоров!`, false);
      break;
    }

    // ── Лечилки HP по таблице (аудит итемов): hyperPotion 200, maxPotion фулл и т.д. ──
    case 'hyperPotion': case 'maxPotion': case 'freshWater': case 'sodaPop':
    case 'lemonade': case 'moomooMilk': case 'energyPowder': case 'energyRoot':
    case 'berryJuice': case 'sweetHeart': {
      if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
      const amount = HEAL_HP[itemId];
      removeItem(itemId);
      mon.currentHp = amount === 'full' ? mon.maxHp : Math.min(mon.maxHp, mon.currentHp + (amount as number));
      refreshProfileUI();
      showToast(`${item.nameRu} использована! HP: ${mon.currentHp}/${mon.maxHp}.`, false);
      break;
    }

    // ── Редкая Конфета (Rare Candy): +1 уровень + 4 EV в пул ──
    case 'rareCandy': {
      await feedCandy(mon, 'rareCandy', 'Сладкую Конфету');
      break;
    }

    // ── Репелленты: N попыток охоты без встреч ──
    case 'repel': case 'superRepel': case 'maxRepel': {
      const charges = { repel: 100, superRepel: 200, maxRepel: 250 }[itemId] || 100;
      removeItem(itemId);
      trackUse(itemId);
      state.repelHunts = (state.repelHunts || 0) + charges;
      state.lureHunts = 0; state.lureMult = 1; // репеллент перебивает приманку
      store.emit('save');
      showToast(`Репеллент: ${charges} попыток охоты без встреч!`, false);
      break;
    }

    // ── Приманки и флейты: множитель шанса на N попыток ──
    case 'lure': case 'superLure': case 'maxLure': case 'blackFlute': case 'whiteFlute': {
      const cfg: Record<string, { mult: number; hunts: number; label: string }> = {
        lure: { mult: 2, hunts: 50, label: 'Приманка' },
        superLure: { mult: 3, hunts: 100, label: 'Супер-приманка' },
        maxLure: { mult: 3, hunts: 150, label: 'Макс-приманка' },
        blackFlute: { mult: 0.5, hunts: 100, label: 'Чёрная флейта' },
        whiteFlute: { mult: 2, hunts: 100, label: 'Белая флейта' },
      };
      const c = cfg[itemId];
      removeItem(itemId);
      state.lureHunts = (state.lureHunts || 0) + c.hunts;
      state.lureMult = c.mult; // свежая перекрывает старую
      state.repelHunts = 0; // приманка перебивает репеллент
      store.emit('save');
      showToast(`${c.label}: шанс встречи ×${c.mult} на ${c.hunts} попыток!`, false);
      break;
    }

    // ── Верёвка: возврат в хаб региона ──
    case 'escapeRope': {
      removeItem(itemId);
      trackUse(itemId);
      const region = state.currentRegion;
      const hub = region === 'kanto' ? 'saffronCity' : 'goldenrodCity';
      const hubRegion = region === 'kanto' ? 'kanto' : 'johto';
      showToast('Верёвка выводит вас к городу!', false);
      const m = await import('./location.js');
      m.travelToRegion(hubRegion, hub);
      break;
    }

    // ── Куклы побега: только в бою (вне боя — честный отказ) ──
    case 'pokeDoll': case 'pokeToy': case 'fluffyTail': {
      return showToast('Это средство побега — используйте в бою!', true);
    }

    // ── Коробка типовых конфет: 10 случайных внутри ──
    case 'typeCandyBox': {
      removeItem('typeCandyBox');
      const got = pickRandomCandies(10);
      for (const id of got) addItem(id);
      const names = got.map((id) => itemDef(id).nameRu).join(', ');
      store.emit('save');
      showToast(`Коробка открыта! Внутри: ${names}.`, false);
      break;
    }

    // ── Конфеты (B1): +1 уровень всегда + EV в пул по типу ──
    // ванильная 2, обычная/типовые 3, редкая 4.
    case 'vanillaCandy': {
      await feedCandy(mon, 'vanillaCandy', 'Ванильную конфету', 2);
      break;
    }
    case 'commonCandy': {
      await feedCandy(mon, 'commonCandy', 'Обычную конфету', 3);
      break;
    }
    case 'fireCandy': case 'waterCandy': case 'electricCandy': case 'grassCandy':
    case 'iceCandy': case 'fightingCandy': case 'poisonCandy': case 'groundCandy':
    case 'flyingCandy': case 'psychicCandy': case 'bugCandy': case 'rockCandy':
    case 'ghostCandy': case 'dragonCandy': case 'darkCandy': case 'steelCandy':
    case 'fairyCandy': case 'normalCandy': {
      // Типовая конфета — только своему типу (решение: одна на тип)
      const need = TYPE_CANDY_TYPE[itemId];
      const has = (mon.apiData?.types || []).some((t: any) => t?.type?.name === need);
      if (!has) return showToast(`Эта конфета только для ${need}-типа!`, true);
      await feedCandy(mon, itemId, itemDef(itemId).nameRu, 3);
      break;
    }

    // ── Витамин (Vitamin): +10 EV в пул ──
    case 'vitamin': {
      // Максимум 10 витаминов на покемона (= 100 EV, канон лиги)
      if (mon.vitaminsEaten >= 10) return showToast('Этот покемон уже съел максимум 10 витаминов!', true);
      removeItem('vitamin');
      mon.vitaminsEaten++;        // Увеличиваем счётчик витаминов
      if (typeof mon.evPool !== 'number') mon.evPool = 0;
      mon.evPool += 10;           // +10 EV в пул на ручное распределение
      mon.happiness += 5;         // +5 к счастью
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      updateDynamicEVs();
      showToast(`Вы скормили Витамин! +10 EV в пул.`, false);
      break;
    }

    // ── Тренировка (Train): усиление случайного стата (канон лиги) ──
    // Стадии строго по порядку, стат случайный (кроме HP), набор сгорает
    // всегда. Шанс/гарант из trainingStages; гарант умножается на категорию
    // силы (common/uncommon ×1, rare ×2, legendary ×3).
    case 'train': {
      // Всего 6 стадий тренировки (0-5, максимальная 6 — "Именная")
      if (mon.trainingStage >= 6) return showToast('Тренировка уже на Именной стадии!', true);
      removeItem('train');

      const next = getInvState().trainingStages[mon.trainingStage + 1];
      const pityAt = (next.pity || Infinity) * trainingPityMult(breedRarity(mon));
      if (typeof mon.trainingFails !== 'number') mon.trainingFails = 0;

      // Шанс успеха зависит от следующей стадии; после pityAt неудач — гарант
      const success = rollTraining(mon.trainingFails, next.chance ?? 0, pityAt);
      if (!success) {
        mon.trainingFails++;
        autoSave();
        return showToast(`Тренировка не удалась! Набор потрачен (${mon.trainingFails}/${pityAt}).`, false);
      }
      mon.trainingFails = 0;

      // Выбираем случайный стат для тренировки (кроме HP)
      const trainableStats = ['atk', 'def', 'spa', 'spd', 'spe'];
      mon.trainingStat = trainableStats[Math.floor(Math.random() * trainableStats.length)];
      mon.trainingStage++;     // Повышаем стадию тренировки
      mon.happiness += 10;     // +10 к счастью
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      autoSave();
      showToast(`Успешно! Теперь это ${getInvState().trainingStages[mon.trainingStage].name} тренировка (+${getInvState().trainingStages[mon.trainingStage].pct}%)!`, false);
      break;
    }

    // ── Ослабление (Weaken): сброс тренировки на 1 стадию ──
    case 'weaken': {
      if (mon.trainingStage === 0) return showToast('Покемон ещё не тренирован!', true);
      removeItem('weaken');
      mon.trainingStage--;  // Понижаем стадию
      if (mon.trainingStage === 0) mon.trainingStat = null;  // Сбрасываем стат на 0
      refreshProfileUI();
      break;
    }

    // ── Камень эволюции (Evolution Stone) ──
    case 'evolutionStone': {
      // Асинхронно проверяем возможность эволюции
      (async () => {
        const evoTarget = await _checkEvolution(mon, true);  // force=true — игнорируем уровень
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать!', true);
        removeItem('evolutionStone');
        trackUse('evolutionStone');
        await _triggerEvolution(mon, evoTarget.name);
        refreshProfileUI();
        showToast(`${mon.nickname || mon.apiData.name} эволюционировал в ${evoTarget.name}!`, false);
      })();
      break;
    }

    // ── TM-диск (шарф) — УБРАН (дисбаланс: учил любую атаку за 500) ──
    case 'tm': {
      return showToast('Этот диск убран из игры. Остатки не работают.', true);
    }

    // ── Тировые TM (B5): слабые <60, средние ≤90, топ — всё ──
    case 'tmWeak': {
      openMoveRelearner('tmWeak');
      break;
    }
    case 'tmMid': {
      openMoveRelearner('tmMid');
      break;
    }
    case 'tmTop': {
      openMoveRelearner('tmTop');
      break;
    }

    // ── Ягоды (Berries): ручная выдача с немедленным эффектом ──
    // Раньше 5 кейсов звали _giveBerryToMon → заглушка в core (только тост),
    // остальные 43 вообще падали в «скоро будет». Теперь: лечилки/хілки
    // действуют сразу, остальные — честный тост «эффект только при держании».
    case 'sitrusBerry': case 'oranBerry': case 'lumBerry': case 'chestoBerry':
    case 'rawstBerry': case 'cheriBerry': case 'pechaBerry': case 'aspearBerry':
    case 'leppaBerry': {
      if (itemId === 'sitrusBerry' || itemId === 'oranBerry') {
        if (mon.currentHp >= mon.maxHp) return showToast('Здоровье уже полное!', true);
        const amt = itemId === 'sitrusBerry' ? Math.floor(mon.maxHp * 0.25) : 10;
        removeItem(itemId);
        mon.currentHp = Math.min(mon.maxHp, mon.currentHp + amt);
        refreshProfileUI();
        showToast(`Ягода съедена! HP +${amt}.`, false);
        break;
      }
      if (itemId === 'leppaBerry') {
        const idx = (mon.movesPP || []).findIndex((pp: any) => pp && pp.current < pp.max);
        if (idx < 0) return showToast('Все PP уже полные!', true);
        removeItem(itemId);
        mon.movesPP[idx].current = Math.min(mon.movesPP[idx].max, mon.movesPP[idx].current + 10);
        refreshProfileUI();
        showToast('Ягода Леппа: +10 PP!', false);
        break;
      }
      // Лечебные ягоды: люм — всё, остальные — свой статус
      const need = itemId === 'lumBerry' ? mon.status : CURE_ONE[itemId];
      if (!mon.status) return showToast('Статусов нет!', true);
      if (itemId !== 'lumBerry' && mon.status !== need) {
        return showToast('Эта ягода лечит другой статус!', true);
      }
      removeItem(itemId);
      mon.status = null;
      mon.sleepTurns = 0;
      refreshProfileUI();
      showToast('Ягода съедена, статус снят!', false);
      break;
    }

    // ── Остальные ягоды: эффект только при держании в бою ──
    // Чтобы не падали в «скоро будет»: честно говорим, что съесть вручную
    // можно только лечилки (выше), остальные работают как held-предмет.
    case 'babiriBerry': case 'chartiBerry':
    case 'chilanBerry': case 'chopleBerry': case 'cobaBerry': case 'colburBerry':
    case 'custapBerry': case 'grepaBerry':
    case 'habanBerry': case 'hondewBerry': case 'kasibBerry':
    case 'kebiaBerry': case 'kelpsyBerry':
    case 'occaBerry': case 'passhoBerry':
    case 'payapaBerry': case 'persimBerry': case 'pomegBerry':
    case 'qualotBerry': case 'rindoBerry': case 'roseliBerry':
    case 'shucaBerry': case 'tamatoBerry': case 'tangaBerry':
    case 'wacanBerry': case 'yacheBerry': {
      // persimBerry лечит спутанность, но она не живёт вне боя — честно говорим
      if (itemId === 'persimBerry') {
        return showToast('Спутанность проходит сама после боя!', true);
      }
      return showToast('Эта ягода работает только как held-предмет в бою!', true);
    }

    // ── Камни эволюции: любой камень из категории (аудит итемов) ──
    // Раньше только 10 штук; остальные 30 падали в «скоро будет».
    // checkEvolution сам решает по данным (use-item + маппинг STONE_ITEM_MAP);
    // неподходящий камень — честный отказ, а не молчание.
    case 'fireStone': case 'waterStone': case 'leafStone': case 'thunderStone':
    case 'moonStone': case 'sunStone': case 'shinyStone': case 'duskStone':
    case 'iceStone': case 'dawnStone': case 'berrySweet': case 'chippedPot':
    case 'cloverSweet': case 'crackedPot': case 'dragonScale': case 'dubiousDisc':
    case 'electirizer': case 'flowerSweet': case 'linkingCord': case 'loveSweet':
    case 'magmarizer': case 'maliciousArmor': case 'masterpieceTeacup': case 'metalAlloy':
    case 'ovalStone': case 'peatBlock': case 'prismScale': case 'protector':
    case 'reaperCloth': case 'ribbonSweet': case 'sachet': case 'starSweet':
    case 'strawberrySweet': case 'sweetApple': case 'syrupyApple': case 'tartApple':
    case 'unremarkableTeacup': case 'upGrade': case 'whippedDream': {
      (async () => {
        // Проверяем, может ли покемон эволюционировать С ЭТИМ КАМНЕМ
        const evoTarget = await _checkEvolution(mon, true, itemId);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        removeItem(itemId);  // Убираем камень из инвентаря
        trackUse(itemId);
        await _triggerEvolution(mon, evoTarget.name);
        refreshProfileUI();
        showToast(`${mon.nickname || mon.apiData.name} эволюционировал в ${evoTarget.name}!`, false);
      })();
      break;
    }

    // ── Антидот (Antidote): лечит отравление ──
    case 'antidote': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      // Антидот лечит только отравление (psn)
      if (mon.status !== 'psn') return showToast('Антидот лечит только отравление!', true);
      mon.status = null;       // Снимаем статус
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от отравления!`, false);
      break;
    }

    // ── Средство от паралича (Paralyze Heal) ──
    case 'paralyzeHeal': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'par') return showToast('Средство от паралича лечит только паралич!', true);
      mon.status = null;
      removeItem(itemId);
      trackUse(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от паралича!`, false);
      break;
    }

    // ── Пробуждение (Awakening): лечит сон ──
    case 'awakening': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'slp') return showToast('Пробуждение лечит только сон!', true);
      mon.status = null;        // Снимаем сон
      mon.sleepTurns = 0;       // Сбрасываем счётчик ходов сна
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} проснулся!`, false);
      break;
    }

    // ── Средство от ожогов (Burn Heal) ──
    case 'burnHeal': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (mon.status !== 'brn') return showToast('Средство от ожогов лечит только ожог!', true);
      mon.status = null;
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} вылечен от ожога!`, false);
      break;
    }

    // ── Универсальное лечение (Зелье от сглаза / Лечебная трава) ──
    // Лечат любой статус
    case 'antiSputin': case 'healingHerb': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      const statusNames = {
        psn: 'отравления',
        par: 'паралича',
        slp: 'сна',
        brn: 'ожога',
        frz: 'заморозки'
      };
      showToast(
        `${mon.nickname || mon.apiData.name} вылечен от ${statusNames[mon.status] || mon.status}!`,
        false
      );
      mon.status = null;
      mon.sleepTurns = 0;
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      break;
    }

    // ── Лечилки всех статусов разом (аудит итемов) ──
    case 'fullHeal': case 'healPowder': case 'lavaCookie': case 'bigMalasada':
    case 'casteliacone': case 'lumioseGalette': case 'oldGateau':
    case 'pewterCrunchies': case 'shalourSable': case 'iceHeal': {
      if (!mon.status) return showToast('У покемона нет статуса!', true);
      if (itemId === 'iceHeal' && mon.status !== 'frz') {
        return showToast('Ледяное зелье лечит только заморозку!', true);
      }
      removeItem(itemId);
      mon.status = null;
      mon.sleepTurns = 0;
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} полностью очищен!`, false);
      break;
    }

    // ── Max Ether: полные PP всех атак (аудит итемов) ──
    case 'maxEther': {
      if (!mon.movesPP || mon.movesPP.every(pp => !pp || pp.current >= pp.max)) {
        return showToast('Все PP уже максимальны!', true);
      }
      removeItem(itemId);
      mon.movesPP.forEach(pp => { if (pp) pp.current = pp.max; });
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast('PP всех атак восстановлены полностью!', false);
      break;
    }

    // ── Воскрешение (аудит итемов): выбор павшего из команды ──
    case 'revive': case 'maxRevive': case 'sacredAsh': case 'revivalHerb': case 'maxHoney': {
      const fainted = (getTeamState().myTeam || []).map((m, i) => ({ m, i }))
        .filter(({ m }) => m && (m.currentHp ?? 1) <= 0);
      if (fainted.length === 0) return showToast('Павших покемонов нет!', true);
      const full = itemId === 'maxRevive' || itemId === 'sacredAsh' || itemId === 'maxHoney';
      const targets = itemId === 'sacredAsh' ? fainted : null; // пепел — всех сразу
      const reviveOne = (entry: { m: any }) => {
        entry.m.currentHp = full ? entry.m.maxHp : Math.max(1, Math.floor(entry.m.maxHp / 2));
      };
      if (targets) {
        removeItem(itemId);
        trackUse(itemId);
        targets.forEach(reviveOne);
        refreshProfileUI();
        autoSave();
        showToast(`Священный пепел: вся команда поднята с полным HP!`, false);
        break;
      }
      showSelectionModal('Кого воскресить?', fainted.map(({ m }) => ({
        label: `Lv.${m.baseLevel + (m.candiesEaten || 0)} ${m.nickname || m.apiData?.name}`,
        subtitle: `HP: 0/${m.maxHp}`,
      })), (choiceIdx) => {
        const picked = fainted[choiceIdx];
        if (!picked) return;
        removeItem(itemId);
        trackUse(itemId);
        reviveOne(picked);
        refreshProfileUI();
        autoSave();
        showToast(`${picked.m.nickname || picked.m.apiData?.name} воскрешён!`, false);
      }, true);
      break;
    }

    // ── EXP-конфеты (аудит итемов): опыт + level-up цикл ──
    {
      const amount = EXP_CANDY_XP[itemId] || 0;
      if (!amount) return showToast('Странная конфета...', true);
      await feedExp(mon, itemId, item.nameRu, amount);
      break;
    }

    // ── Крылья: +1 EV в свой стат (аудит итемов, канон) ──
    case 'healthWing': case 'muscleWing': case 'resistWing':
    case 'geniusWing': case 'cleverWing': case 'swiftWing': {
      const evKey = WING_EV[itemId];
      const totalEV = Object.values(mon.evs as Record<string, number>).reduce((s, v) => s + v, 0);
      if (mon.evs[evKey] >= 252) return showToast(`EV ${evKey.toUpperCase()} уже на максимуме (252)!`, true);
      if (totalEV >= 510) return showToast('Суммарные EV уже на максимуме (510)!', true);
      removeItem(itemId);
      mon.evs[evKey] = Math.min(252, mon.evs[evKey] + 1);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      autoSave();
      showToast(`Крыло скормлено! EV ${evKey.toUpperCase()} +1.`, false);
      break;
    }

    // ── Ability Capsule / Patch (аудит итемов) ──
    case 'abilityCapsule': case 'abilityPatch': {
      const abs = (mon.apiData?.abilities || []).filter((a: any) => a?.ability?.name);
      if (abs.length === 0) return showToast('У покемона нет способностей для смены!', true);
      const cur = mon.abilityName || abs[0].ability.name;
      if (itemId === 'abilityCapsule') {
        const others = abs.filter((a: any) => !a.is_hidden && a.ability.name !== cur);
        if (others.length === 0) return showToast('Другой обычной способности нет!', true);
        removeItem(itemId);
        mon.abilityName = others[0].ability.name;
      } else {
        const hidden = abs.find((a: any) => a.is_hidden);
        if (!hidden) return showToast('Скрытой способности нет!', true);
        if (cur === hidden.ability.name) return showToast('Уже скрытая способность!', true);
        removeItem(itemId);
        mon.abilityName = hidden.ability.name;
      }
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      autoSave();
      showToast(`Способность сменена: ${mon.abilityName}!`, false);
      break;
    }

    // ── PP Max: +60% к макс PP одной атаки (аудит итемов, канон) ──
    case 'ppMax': {
      if (!mon.movesPP || mon.movesPP.length === 0) return showToast('У покемона нет атак!', true);
      const movesWithPP = mon.movesPP.map((pp, i) => {
        const moveName = mon.apiData?.moves?.[i]?.move?.name || `Атака ${i + 1}`;
        return { ...pp, moveName, index: i };
      }).filter(m => m && m.max > 0);
      if (movesWithPP.length === 0) return showToast('Нет атак для усиления!', true);
      showSelectionModal('PP Max: выберите атаку', movesWithPP.map(m => ({
        label: `${m.moveName}`,
        subtitle: `PP: ${m.current}/${m.max}`
      })), (choiceIdx) => {
        const picked = movesWithPP[choiceIdx];
        if (!picked) return;
        const newMax = Math.floor(picked.max * 1.6);
        if (newMax <= picked.max) { showToast('PP уже на максимуме!', true); return; }
        removeItem('ppMax');
        mon.movesPP[picked.index].max = newMax;
        mon.movesPP[picked.index].current = Math.min(newMax, mon.movesPP[picked.index].current + (newMax - picked.max));
        refreshProfileUI();
        showToast(`PP атаки ${picked.moveName} увеличено до ${newMax}!`, false);
      }, true);
      return;
    }

    // ── Восстановление PP (Ether, Elixir, Max Elixir) ──
    case 'ether': {
      // Ether: восстанавливает 10 PP ОДНОЙ атаки по выбору
      if (!mon.movesPP || mon.movesPP.every(pp => !pp || pp.current >= pp.max)) {
        return showToast('Все PP уже максимальны!', true);
      }
      const movesWithPP = mon.movesPP.map((pp, i) => {
        const moveName = mon.apiData?.moves?.[i]?.move?.name || `Атака ${i+1}`;
        return { ...pp, moveName, index: i };
      }).filter(m => m && m.max > 0);
      if (movesWithPP.length === 0) return showToast('Нет атак для восстановления!', true);
      showSelectionModal('Восстановить PP: Ether (10)', movesWithPP.map(m => ({
        label: m.moveName,
        subtitle: `PP: ${m.current}/${m.max}`
      })), (choiceIdx) => {
        const picked = movesWithPP[choiceIdx];
        if (!picked) return;
        const oldMax = picked.max;
        const restored = Math.min(10, oldMax - picked.current);
        if (restored <= 0) { showToast('PP этой атаки уже полные!', true); return; }
        removeItem('ether');
        mon.movesPP[picked.index].current = Math.min(oldMax, mon.movesPP[picked.index].current + 10);
        if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
        showToast(`PP атаки ${picked.moveName} +${restored} (${mon.movesPP[picked.index].current}/${oldMax})`, false);
      }, true);
      break;
    }
    case 'elixir': case 'maxElixir': {
      // Elixir/Max Elixir: восстанавливают PP всех атак
      const ppRestore = itemId === 'elixir' ? 20 : 40;
      if (!mon.movesPP || mon.movesPP.every(pp => !pp || pp.current >= pp.max)) {
        return showToast('Все PP уже максимальны!', true);
      }
      mon.movesPP.forEach(pp => {
        if (pp) pp.current = Math.min(pp.max, pp.current + ppRestore);
      });
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`PP всех атак восстановлены на ${ppRestore}!`, false);
      break;
    }

    // ── Exp. Share (распределитель опыта) ──
    // Переключает режим: вся команда получает 50% опыта
    {
      toggleExpShare();  // Переключаем флаг expShareActive
      showToast(
        getInvState().expShareActive
          ? 'Распределитель опыта активирован! Команда будет получать 50% опыта.'
          : 'Распределитель опыта деактивирован.',
        false
      );
      break;
    }

    // ── Счастливое яйцо (Lucky Egg) ×1.5 опыта ──
    case 'luckyEgg': {
      // Даём покемону как held item
      if (mon.heldItem === 'luckyEgg') return showToast('Покемон уже держит Счастливое яйцо!', true);
      if (mon.heldItem) {
        // Если покемон уже держит предмет — предлагаем заменить
        const heldName = itemDef(mon.heldItem).nameRu;
        showConfirmModal(
          'Заменить предмет?',
          `Покемон уже держит ${heldName}. Заменить на Счастливое яйцо?`,
          () => {
            // Возвращаем старый предмет в инвентарь; если рюкзак полон — отмена
            if (!addItem(mon.heldItem)) {
              showToast('Рюкзак полон! Старый предмет потерян.', true);
              return;
            }
            removeItem('luckyEgg');
            mon.heldItem = 'luckyEgg';
            refreshProfileUI();
            showToast(`${mon.nickname || mon.apiData.name} теперь держит Счастливое яйцо!`, false);
          }
        );
        return;
      }
      // Если слот пуст — просто надеваем
      removeItem('luckyEgg');
      mon.heldItem = 'luckyEgg';
      refreshProfileUI();
      showToast(`${mon.nickname || mon.apiData.name} теперь держит Счастливое яйцо!`, false);
      break;
    }

    // ── Инструменты для крафта (Crafting Kit) ──
    case 'craftersKit': {
      openCrafting();  // Открываем интерфейс крафта
      break;
    }

    // ── Удочки (пассивные) ──
    case 'oldRod': case 'goodRod': case 'superRod': {
      // Удочки работают автоматически: если игрок на водоёме,
      //   в автопоиске будут встречаться водные покемоны
      showToast(
        'Удочка работает пассивно: если вы на водоёме, водные покемоны будут встречаться в автопоиске!',
        false
      );
      break;
    }

    // ── PP Up: увеличивает максимум PP одной атаки на 20% ──
    case 'ppUp': {
      if (!mon.movesPP || mon.movesPP.length === 0) return showToast('У покемона нет атак!', true);
      // Собираем атаки с PP > 0
      const movesWithPP = mon.movesPP.map((pp, i) => {
        const moveName = mon.apiData?.moves?.[i]?.move?.name || `Атака ${i + 1}`;
        return { ...pp, moveName, index: i };
      }).filter(m => m && m.max > 0);

      if (movesWithPP.length === 0) return showToast('Нет атак для усиления!', true);

      // Показываем выбор: какую атаку усилить
      const ppItems = movesWithPP.map(m => ({
        label: `${m.moveName}`,
        subtitle: `PP: ${m.current}/${m.max}`
      }));
      showSelectionModal('Выберите атаку для PP Up', ppItems, (choiceIdx) => {
        const picked = movesWithPP[choiceIdx];
        if (!picked) { showToast('Неверный выбор!', true); return; }

        const basePP = picked.max;
        const newMax = Math.floor(basePP * 1.2);  // Увеличиваем макс PP на 20%
        if (newMax === basePP) { showToast('PP уже на максимуме!', true); return; }

        // Применяем новое значение
        mon.movesPP[picked.index].max = newMax;
        mon.movesPP[picked.index].current = Math.min(
          mon.movesPP[picked.index].current + (newMax - basePP),
          newMax
        );
        removeItem('ppUp');
        refreshProfileUI();
        showToast(`PP атаки ${picked.moveName} увеличено до ${newMax}!`, false);
      }, true);
      return;  // return вместо break — showSelectionModal не блокирует выполнение
    }

    // ── EV-витамины: +10 к конкретному стату ──
    case 'protein': case 'iron': case 'calcium': case 'zinc': case 'carbos': case 'hpUp': {
      // Определяем, какой стат усиливает витамин:
      //   hpUp → HP, Protein → Atk, Iron → Def, Calcium → SpA, Zinc → SpD, Carbos → Spe
      const evKey = itemId === 'hpUp' ? 'hp'
        : itemId === 'protein' ? 'atk'
        : itemId === 'iron' ? 'def'
        : itemId === 'calcium' ? 'spa'
        : itemId === 'zinc' ? 'spd'
        : 'spe';

      // Считаем суммарные EV покемона (максимум 510)
      const totalEV = Object.values(mon.evs as Record<string, number>).reduce((s, v) => s + v, 0);
      // Максимум на один стат: 252
      if (mon.evs[evKey] >= 252) return showToast(`EV ${evKey.toUpperCase()} уже на максимуме (252)!`, true);
      if (totalEV >= 510) return showToast('Суммарные EV уже на максимуме (510)!', true);

      mon.evs[evKey] = Math.min(252, mon.evs[evKey] + 10);  // +10, не превышая 252
      removeItem(itemId);
      if (getTeamState().currentPokemonIndex !== null) refreshProfileUI();
      showToast(`EV ${evKey.toUpperCase()} +10 (теперь ${mon.evs[evKey]})`, false);
      break;
    }

    // ── DEFAULT: обработка боевых предметов и held items ──
    default: {
      // Общая логика: если предмет боевой/тренировочный И есть в наличии —
      // надеваем на покемона. Эффект — только у реализованных (amuletCoin,
      // everstone, luckIncense); остальные held без хука честно бесполезны,
      // пока хозяин не решит их судьбу (см. items-coverage.test.ts).
      if (
        (item.category === 'battle' || item.category === 'training' || item.id === 'luckyEgg' || item.id === 'expShare') &&
        getItemQty(item.id) > 0
      ) {
        if (!mon) { showToast('Сначала выберите покемона во вкладке Команда!', true); break; }
        if (mon.heldItem === itemId) { showToast('Этот предмет уже надет!', true); break; }

        if (mon.heldItem) {
          // Если есть старый held item — предлагаем замену
          const heldName = itemDef(mon.heldItem).nameRu;
          showConfirmModal(
            'Заменить предмет?',
            `Покемон держит ${heldName}. Заменить на ${item.nameRu}?`,
            () => {
              // Возвращаем старый предмет в инвентарь; если рюкзак полон — отмена
              if (!addItem(mon.heldItem)) {
                showToast('Рюкзак полон! Старый предмет потерян.', true);
                return;
              }
              removeItem(itemId);
              mon.heldItem = itemId;
              refreshProfileUI();
              showToast(`${mon.nickname || mon.apiData.name} теперь держит ${item.nameRu}!`, false);
              autoSave();
            }
          );
        } else {
          // Свободный слот — просто надеваем
          removeItem(itemId);
          mon.heldItem = itemId;
          refreshProfileUI();
          showToast(`${mon.nickname || mon.apiData.name} теперь держит ${item.nameRu}!`, false);
        }
        break;
      }
      // Если предмет не подходит ни под одно условие
      showToast(`${item.nameRu} скоро будет доступно!`, true);
      break;
    }
  }

  // После использования — обновляем инвентарь и сохраняем
  updateInventoryDisplay();
  autoSave();
}

// ── getHeldItemName: получить название удерживаемого предмета ──
// Принимает heldItem — ID предмета (или null)
// Возвращает русское название или "Пусто"
// Используется в бою для сообщений ("Пикачу держит Счастливое яйцо!")
export function getHeldItemName(heldItem) {
  if (!heldItem) return 'Пусто';  // Предмета нет — возвращаем "Пусто"
  // Ищем предмет в глобальном списке
  const item = getInvState().ITEMS.find(i => i.id === heldItem);
  return item ? item.nameRu : heldItem;  // Если не нашли — возвращаем ID (на всякий случай)
}

// ── openHeldItemPicker: открыть модалку выбора held item ──
// Принимает monIndex — индекс покемона в команде (0-5)
// Показывает список предметов, которые можно надеть на покемона
export function openHeldItemPicker(monIndex) {
  // Получаем данные покемона по индексу
  const mon = getTeamState().myTeam[monIndex];
  if (!mon) return;  // Защита от несуществующего индекса

  // ── Фильтрация предметов ──
  // Надеваются: боевые, ягоды, "другое" и тренировочные (там живут скоба,
  // амулет, счастливое яйцо и т.д.). Расходники-наборы — в denylist.
  // Скоба (evBrace, isUsable:false) надевается — флаг isUsable здесь не смотрим.
  const NOT_HOLDABLE = new Set(['train', 'weaken', 'craftersKit']);
  const choices = getInvState().ITEMS.filter(item => {
    return (item.category === 'battle' || item.category === 'berries'
        || item.category === 'other' || item.category === 'training')
      && getItemQty(item.id) > 0
      && !NOT_HOLDABLE.has(item.id);
  });

  // ── Подготовка списка для showSelectionModal ──
  const selectionItems = choices.map((item) => ({
    label: item.nameRu,
    subtitle: item.desc  // Описание предмета
  }));

  // Если у покемона уже есть held item — добавляем опцию "Снять предмет"
  if (mon.heldItem) {
    selectionItems.unshift({
      label: 'Снять предмет',
      subtitle: `Сейчас: ${getHeldItemName(mon.heldItem)}`
    });
  }

  // ── Показываем модалку выбора ──
  showSelectionModal(
    `Предмет для ${mon.nickname || mon.apiData.name}`,
    selectionItems,
    (selIdx) => {
      // ── Если выбран "Снять предмет" ──
      if (mon.heldItem && selIdx === 0) {
        const itemId = mon.heldItem;
        if (!addItem(itemId)) {
          showToast('Рюкзак полон! Нельзя снять предмет.', true);
          return;
        }
        mon.heldItem = null;
        // Сбрасываем счётчик ягод (если это была ягода)
        if (mon.berries && mon.berries[itemId] !== undefined) mon.berries[itemId] = 0;
        refreshProfileUI();                  // Обновляем профиль
        updateInventoryDisplay();            // Обновляем инвентарь
        autoSave();
        return;
      }

      // ── Если выбран предмет для надевания ──
      // Если был held item — selIdx сдвинут на 1 (из-за unshift)
      const chosen = mon.heldItem ? choices[selIdx - 1] : choices[selIdx];
      if (chosen) {
        // Сначала возвращаем старый held item (если был)
        if (mon.heldItem) {
          if (!addItem(mon.heldItem)) {
            showToast('Рюкзак полон! Нельзя заменить предмет.', true);
            return;
          }
          if (mon.berries && mon.berries[mon.heldItem] !== undefined) mon.berries[mon.heldItem] = 0;
        }

        removeItem(chosen.id);  // Убираем предмет из инвентаря
        mon.heldItem = chosen.id;  // Надеваем новый предмет

        // Если это ягода — инициализируем счётчик
        if (chosen.category === 'berries') {
          if (!mon.berries) mon.berries = {
            sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0
          };
          mon.berries[chosen.id] = 1;  // 1 ягода
        }

        refreshProfileUI();
        updateInventoryDisplay();
        autoSave();
      }
    },
    true  // showCancel=true — кнопка "Отмена"
  );
}

function escapeHtml(str: string): string {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
