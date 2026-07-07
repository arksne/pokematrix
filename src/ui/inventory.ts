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
// addItem — добавляет предмет в инвентарь (через store.dispatch)
// removeItem — удаляет предмет из инвентаря (через store.dispatch)
import { addItem, removeItem } from '../game/actions.js';
// getItemQty — возвращает количество предмета по ID из глобального state.inventory
// Например, getItemQty('pokeball') → 12
import { getItemQty } from '../game/state.js';
// refreshProfileUI — обновляет интерфейс профиля покемона (статы, иконки и т.д.)
// saveActiveMonData — сохраняет данные текущего покемона (EV, тренировка и т.д.)
import { refreshProfileUI, saveActiveMonData } from './profile.js';
// openCrafting — открывает интерфейс крафта (ремёсла)
import { openCrafting } from './crafting.js';
// openMoveRelearner — открывает модалку повторного изучения атак (TM/развитие)
import { openMoveRelearner } from './tm.js';
// hatchEgg — вылупляет яйцо (проверяет readyTime и добавляет покемона в команду)
import { hatchEgg } from './daycare.js';
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

// ── ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ QA-КНОПОК И HELD ITEM ──────────
// Вызывается один раз при старте игры (init.ts)
export function initInventoryEvents() {
  // Карта соответствия: ID кнопки → ID предмета
  // QA = Quick Access — быстрый доступ к часто используемым предметам
  const qaMap = {
    'qa-potion': 'potion',           // Аптечка (+20 HP)
    'qa-candy': 'candy',             // Конфета (уровень)
    'qa-vitamin': 'vitamin',         // Витамин (+EV)
    'qa-train': 'train',             // Тренировка (усиление стата)
    'qa-weaken': 'weaken',           // Ослабление (сброс тренировки)
    'qa-super-potion': 'superPotion', // Супер Аптечка (+50 HP)
    'qa-full-restore': 'fullRestore', // Полное восстановление
    'qa-evolution-stone': 'evolutionStone', // Камень эволюции
    'qa-tm': 'tm',                   // TM-диск (шарф)
  };

  // Проходим по всем парам кнопка → предмет и вешаем обработчик клика
  for (const [btnId, itemId] of Object.entries(qaMap)) {
    const btn = document.getElementById(btnId);  // Ищем кнопку в DOM
    if (btn) {
      // При клике вызываем useItem() с ID предмета
      btn.addEventListener('click', () => useItem(itemId));
    }
  }

  // ── Кнопка held item (удерживаемый предмет) ──
  const heldBtn = document.getElementById('qa-held-item');
  if (heldBtn) {
    heldBtn.addEventListener('click', () => {
      // Получаем индекс выбранного покемона (из вкладки "Команда")
      const idx = getTeamState().currentPokemonIndex;
      if (idx !== null) {
        // Если покемон выбран — открываем пикер held item
        openHeldItemPicker(idx);
      } else {
        // Если не выбран — ошибка
        showToast('Сначала выберите покемона во вкладке "Команда"!', true);
      }
    });
  }
}

// ── УПРАВЛЕНИЕ EV (Effort Values / Очки усилий) ──────────

// updateDynamicEVs: обновляет отображение доступных и оставшихся EV
// Вызывается при изменении EV-инпутов
export function updateDynamicEVs() {
  // Если покемон не выбран — выходим
  if (getTeamState().currentPokemonIndex === null) return;
  // Берём текущего покемона
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Максимум EV = (конфеты × 4) + (витамины × 10)
  // Каждая конфета даёт 4 очка распределения, каждый витамин — 10
  const maxTotalEV = (mon.candiesEaten * 4) + (mon.vitaminsEaten * 10);
  // Отображаем максимум
  document.getElementById('ev-total').innerText = String(maxTotalEV);

  // Собираем все EV-инпуты (поля ввода распределения)
  const evInputs = document.querySelectorAll('.reborn-input-ev');
  let currentTotal = 0;
  // Суммируем все введённые значения
  evInputs.forEach(input => currentTotal += parseInt((input as HTMLInputElement).value) || 0);

  // Отображаем остаток: максимум - уже распределено
  document.getElementById('ev-remaining').innerText = String(maxTotalEV - currentTotal);
}

// ── applyEVs: применить распределение EV ─────────────────
// Сохраняет значения из EV-инпутов в данные покемона
export function applyEVs() {
  // Проверяем, выбран ли покемон
  if (getTeamState().currentPokemonIndex === null) return;
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];

  // Вычисляем максимальное количество EV как в updateDynamicEVs
  const maxTotalEV = (mon.candiesEaten * 4) + (mon.vitaminsEaten * 10);
  // Собираем все EV-инпуты
  const evInputs = document.querySelectorAll('.reborn-input-ev');
  let currentTotal = 0;
  evInputs.forEach(input => currentTotal += parseInt((input as HTMLInputElement).value) || 0);

  // Если распределено больше, чем доступно — автоматически урезаем
  if (currentTotal > maxTotalEV) {
    let diff = currentTotal - maxTotalEV;  // Сколько лишних очков
    // Проходим по всем инпутам и уменьшаем пока не уложимся в лимит
    document.querySelectorAll('.reborn-input-ev').forEach(input => {
      let val = parseInt((input as HTMLInputElement).value) || 0;
      if (val > 0 && diff > 0) {
        let toSubtract = Math.min(val, diff);  // Сколько снять с этого поля
        (input as HTMLInputElement).value = String(val - toSubtract);
        diff -= toSubtract;
        currentTotal -= toSubtract;
      }
    });
  }

  // Сохраняем данные покемона (EV записываются в mon.evs)
  saveActiveMonData();
  // Обновляем отображение
  updateDynamicEVs();
  showToast('EV распределение сохранено! Теперь эти очки нельзя перенести в другие статы.', false);
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

  // Процент усиления от тренировки (trainingStage 0-6)
  // Берётся из trainingStages[mon.trainingStage].pct / 100
  // Например, stage 3 = 30%, stage 6 = 100%
  const trainPct = getInvState().trainingStages[mon.trainingStage].pct / 100;
  // Текущий уровень = базовый уровень + съеденные конфеты
  const curLvl = mon.baseLevel + mon.candiesEaten;

  // Проходим по всем статам и вычисляем финальные значения
  for (const [statName, info] of Object.entries(statsMapping)) {
    const baseStat = mon.apiData.stats[info.idx].base_stat;  // Базовый стат (из PokeAPI)
    const ev = mon.evs[info.el];                               // EV (0-252)
    const iv = mon.ivs[info.el];                               // IV (0-31)

    let natureMod = 1.0;  // Модификатор характера (1.0 = нейтрально)
    let isTrained = false; // Флаг тренировки

    // Берём DOM-элемент названия стата для подсветки
    const labelEl = document.getElementById(`label-${info.el}`);
    if (labelEl) {
      labelEl.className = 'stat-name';  // Сбрасываем класс
      // Если характер усиливает этот стат (buff) — модификатор 1.1
      if (localNature.buff === info.el) {
        natureMod = 1.1;
        labelEl.classList.add('nature-buff');  // Красная подсветка
      // Если характер ослабляет этот стат (nerf) — модификатор 0.9
      } else if (localNature.nerf === info.el) {
        natureMod = 0.9;
        labelEl.classList.add('nature-nerf');   // Синяя подсветка
      }

      // Если этот стат выбран для тренировки — устанавливаем флаг
      if (mon.trainingStat === info.el) {
        isTrained = true;
      }
    }

    // ── Формула расчёта статов ──
    // Формула из оригинальных игр Pokémon:
    // HP:  floor(0.01 * (2*base + IV + floor(0.25*EV)) * level) + level + 10
    // Other: floor(floor(0.01 * (2*base + IV + floor(0.25*EV)) * level) + 5) * nature
    let finalStat = 0;
    if (statName === 'hp') {
      // HP считается по отдельной формуле (без характера)
      finalStat = Math.floor(0.01 * (2 * baseStat + iv + Math.floor(0.25 * ev)) * curLvl) + curLvl + 10;
    } else {
      // Остальные статы: базовая формула
      finalStat = Math.floor(Math.floor(0.01 * (2 * baseStat + iv + Math.floor(0.25 * ev)) * curLvl) + 5);
      // Применяем модификатор характера (×1.1 или ×0.9)
      finalStat = Math.floor(finalStat * natureMod);

      // Если стат тренирован — применяем бонус тренировки
      // Например: тренировка 6 стадия = +100% к стату
      if (isTrained) {
        finalStat = Math.floor(finalStat * (1 + trainPct));
      }
    }

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

// ── updateQADisplays: обновить числовые метки на QA-кнопках ──
// Показывает количество каждого предмета рядом с кнопкой быстрого доступа
export function updateQADisplays() {
  // Карта: ID элемента метки → ID предмета
  const map = {
    'qa-qty-potion': 'potion',
    'qa-qty-candy': 'candy',
    'qa-qty-vitamin': 'vitamin',
    'qa-qty-train': 'train',
    'qa-qty-weaken': 'weaken',
    'qa-qty-super-potion': 'superPotion',
    'qa-qty-full-restore': 'fullRestore',
    'qa-qty-evolution-stone': 'evolutionStone',
    'qa-qty-tm': 'tm',
  };

  // Проходим по всем меткам и обновляем их текст с количеством
  for (const [elId, itemId] of Object.entries(map)) {
    const el = document.getElementById(elId);
    if (el) el.textContent = String(getItemQty(itemId));
  }

  // ── Отображение held item (удерживаемого предмета) ──
  const heldQty = document.getElementById('qa-qty-held-item');
  if (heldQty) {
    const idx = getTeamState().currentPokemonIndex;
    if (idx !== null) {
      // Если покемон выбран — показываем название его held item
      const mon = getTeamState().myTeam[idx];
      heldQty.textContent = mon?.heldItem ? getHeldItemName(mon.heldItem) : 'Пусто';
    } else {
      // Если не выбран — прочерк
      heldQty.textContent = '-';
    }
  }
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
      <div class="inv-item-qty">x${getInvState().money}</div>
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
  // Словарь: ID категории → русское название для отображения
  const categories = {
    balls: 'Покеболы',
    healing: 'Восстановление HP',
    statusCure: 'Лечение статусов',
    ppRecovery: 'Восстановление PP',
    vitamins: 'Витамины',
    evolutionStones: 'Камни Эволюции',
    berries: 'Ягоды',
    battle: 'Боевые',
    quest: 'Квестовые',
    training: 'Тренировка',
    tickets: 'Билеты',
    crafting: 'Ремесленные',
    artifacts: 'Артефакты',
    awards: 'Награды',
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
  // Некоторые предметы работают без покемона (удочки, крафт)
  const noPokemonItems = ['craftersKit', 'oldRod', 'goodRod', 'superRod'];
  const needsPokemon = !noPokemonItems.includes(itemId);

  // Если нужен покемон, но не выбран — ошибка
  if (needsPokemon && getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  }

  // Берём текущего покемона (если нужен)
  const mon = needsPokemon ? getTeamState().myTeam[getTeamState().currentPokemonIndex] : null;
  if (needsPokemon && !mon) return showToast('Покемон не найден!', true);

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

    // ── Редкая Конфета (Rare Candy): +1 уровень ──
    case 'rareCandy': {
      // Максимальный уровень: 100
      if (mon.baseLevel + mon.candiesEaten >= 100) return showToast('Достигнут максимальный 100 уровень!', true);
      removeItem('rareCandy');
      mon.candiesEaten++;          // Увеличиваем съеденные конфеты
      mon.happiness += 2;          // +2 к счастью
      if (mon.happiness > 255) mon.happiness = 255;

      // ── Пересчёт HP при повышении уровня ──
      // Старый максимум HP
      const baseHp = mon.apiData.stats[0].base_stat;
      const curLvl = mon.baseLevel + mon.candiesEaten;  // Новый уровень
      const oldMax = mon.maxHp;
      // Вычисляем новый maxHp по формуле
      mon.maxHp = Math.floor(0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl) + curLvl + 10;
      // Добавляем разницу к текущему HP (чтобы не было потери HP при левелапе)
      mon.currentHp += (mon.maxHp - oldMax);

      // ── Проверка эволюции ──
      // Асинхронно проверяем, может ли покемон эволюционировать на этом уровне
      const evoPromise = (async () => {
        const evoTarget = await _checkEvolution(mon);
        if (evoTarget) {
          // Если может — запускаем эволюцию
          await _triggerEvolution(mon, evoTarget.name);
          refreshProfileUI();
        }
      })();

      // ── Изучение новых атак по уровню (через единую функцию) ──
      (async () => {
        await evoPromise;  // Ждём эволюцию, чтобы избежать race condition
        await checkNewMovesOnLevelUp(mon, curLvl);
      })();

      refreshProfileUI();
      showToast(`Вы скормили Сладкую Конфету! Уровень повышен до ${curLvl}.`, false);
      break;
    }

    // ── Витамин (Vitamin): +10 EV ──
    case 'vitamin': {
      // Максимум 10 витаминов на покемона
      if (mon.vitaminsEaten >= 10) return showToast('Этот покемон уже съел максимум 10 витаминов!', true);
      removeItem('vitamin');
      mon.vitaminsEaten++;        // Увеличиваем счётчик витаминов
      mon.happiness += 5;         // +5 к счастью
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      showToast(`Вы скормили Витамин! Доступно +10 EV.`, false);
      break;
    }

    // ── Тренировка (Train): усиление случайного стата ──
    case 'train': {
      // Всего 6 стадий тренировки (0-5, максимальная 6 — "Именная")
      if (mon.trainingStage >= 6) return showToast('Тренировка уже на Именной стадии!', true);
      removeItem('train');

      // Шанс успеха зависит от текущей стадии:
      //   stage 0: 100%, stage 1: 80%, stage 2: 50%, stage 3: 30%, stage 4: 15%, stage 5: 5%
      const chances = [1.0, 0.8, 0.5, 0.3, 0.15, 0.05];
      if (Math.random() > chances[mon.trainingStage]) {
        // Неудача — набор потрачен, тренировка не повышается
        return showToast(`Тренировка не удалась! Набор потрачен.`, false);
      }

      // Выбираем случайный стат для тренировки (кроме HP)
      const trainableStats = ['atk', 'def', 'spa', 'spd', 'spe'];
      mon.trainingStat = trainableStats[Math.floor(Math.random() * trainableStats.length)];
      mon.trainingStage++;     // Повышаем стадию тренировки
      mon.happiness += 10;     // +10 к счастью
      if (mon.happiness > 255) mon.happiness = 255;
      refreshProfileUI();
      showToast(`Успешно! Теперь это ${getInvState().trainingStages[mon.trainingStage].name} тренировка!`, false);
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
        await _triggerEvolution(mon, evoTarget.name);
        refreshProfileUI();
        showToast(`${mon.nickname || mon.apiData.name} эволюционировал в ${evoTarget.name}!`, false);
      })();
      break;
    }

    // ── TM-диск (шарф) — открывает репитер атак ──
    case 'tm': {
      openMoveRelearner();
      break;
    }

    // ── Ягоды (Berries) ──
    case 'sitrusBerry':  { await _giveBerryToMon('sitrus'); break; }  // Ситрус (+25% HP)
    case 'oranBerry':    { await _giveBerryToMon('oran'); break; }    // Оран (+10 HP)
    case 'lumBerry':     { await _giveBerryToMon('lum'); break; }     // Лум (лечит любой статус)
    case 'chestoBerry':  { await _giveBerryToMon('chesto'); break; }  // Често (лечит сон)
    case 'rawstBerry':   { await _giveBerryToMon('rawst'); break; }   // Рауст (лечит ожог)

    // ── Конкретные камни эволюции ──
    case 'fireStone': case 'waterStone': case 'leafStone': case 'thunderStone':
    case 'moonStone': case 'sunStone': case 'shinyStone': case 'duskStone':
    case 'iceStone': case 'dawnStone': {
      (async () => {
        // Проверяем, может ли покемон эволюционировать С ЭТИМ КАМНЕМ
        const evoTarget = await _checkEvolution(mon, true, itemId);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        removeItem(itemId);  // Убираем камень из инвентаря
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

    // ── Восстановление PP (Ether, Elixir, Max Elixir) ──
    case 'ether': case 'elixir': case 'maxElixir': {
      // Количество восстанавливаемых PP:
      //   Ether = 10, Elixir = 20, Max Elixir = 40
      const ppRestore = itemId === 'ether' ? 10 : itemId === 'elixir' ? 20 : 40;
      // Проверяем: есть ли атаки с неполными PP
      if (!mon.movesPP || mon.movesPP.every(pp => !pp || pp.current >= pp.max)) {
        return showToast('Все PP уже максимальны!', true);
      }
      // Восстанавливаем PP каждой атаки (не превышая максимум)
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
    case 'expShare': {
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
            addItem(mon.heldItem);   // Возвращаем старый предмет в инвентарь
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
    case 'protein': case 'iron': case 'calcium': case 'zinc': case 'carbos': {
      // Определяем, какой стат усиливает витамин:
      //   Protein → Atk, Iron → Def, Calcium → SpA, Zinc → SpD, Carbos → Spe
      const evKey = itemId === 'protein' ? 'atk'
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
      // Общая логика: если предмет боевой И есть в наличии — надеваем на покемона
      if (
        (item.category === 'battle' || item.id === 'luckyEgg' || item.id === 'expShare') &&
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
              addItem(mon.heldItem);   // Возвращаем старый предмет
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
          autoSave();
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
  // Можно надевать: боевые предметы, ягоды, и "другое"
  // Предмет должен быть в наличии и не помечен как isUsable===false
  const choices = getInvState().ITEMS.filter(item => {
    return (item.category === 'battle' || item.category === 'berries' || item.category === 'other')
      && getItemQty(item.id) > 0
      && item.isUsable !== false;
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
        addItem(itemId);                    // Возвращаем предмет в инвентарь
        mon.heldItem = null;                 // Снимаем
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
        removeItem(chosen.id);  // Убираем предмет из инвентаря

        // Возвращаем старый held item (если был)
        if (mon.heldItem) {
          addItem(mon.heldItem);
          if (mon.berries && mon.berries[mon.heldItem] !== undefined) mon.berries[mon.heldItem] = 0;
        }

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
