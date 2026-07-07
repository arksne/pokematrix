// ─────────────────────────────────────────────────────────────
// profile.ts — ПРОФИЛЬ ПОКЕМОНА (самый большой UI файл)
// ─────────────────────────────────────────────────────────────
// Отображает полный профиль выбранного покемона: статы, IV, EV,
// характер, способность, атаки, тренировку, экипировку (held item).
// Позволяет: кормить конфетами, тренировать, эволюционировать,
// переименовывать, распределять EV, менять held item, использовать TM.
//
// Ленивый импорт (lazy load): battle/core.js — чтобы избежать
// циклических зависимостей (core импортирует profile).
//
// ЗАВИСИМОСТИ:
//   state        — глобальное состояние (myTeam, currentPokemonIndex)
//   training     — trainingStages (этапы тренировки)
//   natures      — buff/nerf характеристик
//   logic        — STATUS_NAMES (русские названия статусов)
//   state (util) — getPowerStars, getRarityStars
//   sprite       — getTypeGradient, getSpriteUrl, getTypeColor
//   dom          — escHtml, renderStars, showSelectionModal, showToast
//   inventory    — getHeldItemName, openHeldItemPicker, updateDynamicEVs, applyEVs
//   save         — autoSave
//
// ИСПОЛЬЗУЕТСЯ В: nav.ts, tm.ts, inventory.ts, trade-window.ts, и др.
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

// state — глобальное состояние игры:
//   state.myTeam — массив покемонов в команде (макс 6)
//   state.currentPokemonIndex — индекс выбранного покемона (0-5 или null)
//   state.eggs — массив яиц в инкубаторе
import { state } from '../game/state.js';
// trainingStages — массив этапов тренировки: [{name, pct, color}, ...]
//   pct — процент усиления стата на этом этапе
//   color — цвет для отображения
import { trainingStages } from '../data/training.js';
// natures — массив характеров покемонов: {name, buff, nerf}
//   buff — стат, который усиливается (×1.1)
//   nerf — стат, который ослабляется (×0.9)
import { natures } from '../data/natures.js';
// STATUS_NAMES — словарь кодов статусов → русские названия:
//   { psn: 'Отравление', par: 'Паралич', slp: 'Сон', brn: 'Ожог', frz: 'Заморозка' }
import { STATUS_NAMES } from '../battle/logic.js';
// getPowerStars — количество звёзд мощи (0-5) на основе базовых статов
// getRarityStars — количество звёзд редкости (0-5) на основе редкости вида
import { getPowerStars, getRarityStars } from '../utils/state.js';
// getTypeGradient — CSS-градиент для фона на основе типов покемона
// getSpriteUrl — URL спрайта покемона (анимированный или обычный)
// getTypeColor — HEX-цвет для типа покемона
import { getTypeGradient, getSpriteUrl, getTypeColor } from '../utils/sprite.js';
// escHtml — экранирует HTML-спецсимволы (чтобы избежать XSS)
// renderStars — генерирует HTML строку со звёздами (★/☆)
// showSelectionModal — показывает модалку с выбором из списка
// showToast — показывает всплывающее уведомление
import { escHtml, renderStars, showSelectionModal, showToast } from '../utils/dom.js';
// getHeldItemName — возвращает русское название held item по ID
// openHeldItemPicker — открывает модалку выбора held item
// updateDynamicEVs — обновляет отображение доступных EV
// applyEVs — применяет распределение EV
import { getHeldItemName, openHeldItemPicker, updateDynamicEVs, applyEVs } from './inventory.js';
// autoSave — сохраняет игру (localStorage + сервер)
import { autoSave } from '../game/save.js';

// ── Ленивый импорт battle/core.js (избегает циклических зависимостей) ──
// Проблема: core.ts → evolution.ts → profile.ts → battle/core.ts = цикл!
// Решение: import() внутри функции — модуль грузится ТОЛЬКО при первом вызове.
// battleCoreModule — кэш загруженного модуля (Singleton-паттерн)
let battleCoreModule: any = null;

// getBattleCore — возвращает Promise с модулем core.ts
// При первом вызове делает import(), при повторных — возвращает кэш
async function getBattleCore() {
  if (!battleCoreModule) battleCoreModule = await import('../battle/core.js');
  return battleCoreModule;
}

// ── renderTeamGrid: отрисовка сетки команды покемонов ────
// Показывает до 6 слотов: заполненные (с покемонами) и пустые
// Вызывается при открытии вкладки "Команда"
export function renderTeamGrid() {
  // Обновляем счётчик команды: "(3/6)"
  const teamCountEl = document.getElementById('team-count');
  if (teamCountEl) teamCountEl.innerText = `(${state.myTeam.length}/6)`;

  // Находим контейнер сетки команды
  const grid = document.getElementById('team-grid');
  if (!grid) return;  // Если нет на странице — выходим
  grid.innerHTML = ''; // Очищаем сетку

  // Загружаем battle/core (асинхронно) — нужен для getStatusIcon
  getBattleCore().then(bc => {
    // Проходим по 6 слотам команды
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');  // Создаём слот

      if (i < state.myTeam.length) {
        // ── Слот с покемоном ──
        const mon = state.myTeam[i];
        const curLvl = mon.baseLevel + mon.candiesEaten;  // Текущий уровень
        const statusIcon = bc.getStatusIcon(mon.status);    // Иконка статуса (если есть)

        slot.className = 'team-slot';

        // ── Кнопки перестановки (▲/▼) ──
        // Показываем, только если в команде больше 1 покемона
        const reorderHtml = (state.myTeam.length > 1)
          ? `<div class="team-reorder">
              ${i > 0
                ? `<button class="team-move-btn" data-index="${i}" data-dir="-1" title="Вверх">▲</button>`
                : '<span></span>'}
              ${i < state.myTeam.length - 1
                ? `<button class="team-move-btn" data-index="${i}" data-dir="1" title="Вниз">▼</button>`
                : '<span></span>'}
            </div>`
          : '';

        // ── Типы покемона (для градиента фона) ──
        const types = mon.apiData.types;
        const typeBg = getTypeGradient(types);

        // ── Метка тренировки ──
        // Если покемон тренирован — показываем название стадии и % усиления
        const trainStage = mon.trainingStage || 0;
        const trainLabel = trainStage > 0
          ? `<div class="train-label" style="background:${trainingStages[trainStage].color};" title="${trainingStages[trainStage].name} (+${trainingStages[trainStage].pct}%)">${trainingStages[trainStage].name}</div>`
          : '';

        if (mon.isEgg) {
          // ── Слот с яйцом ──
          // Ищем данные яйца в state.eggs по uid
          const eggData = state.eggs.find(e => e.uid === mon.uid);
          if (!eggData) {
            // Если яйцо не найдено — показываем пустой слот
            slot.className = 'team-slot empty';
            slot.innerText = 'Пусто';
            grid.appendChild(slot);
            continue;
          }
          // Яйцо готово к вылуплению?
          const ready = Date.now() >= eggData.readyTime;
          const remaining = Math.max(0, Math.ceil((eggData.readyTime - Date.now()) / 60000));
          // Генетический код яйца (IV)
          const eggIvs = eggData.ivs || {};
          const geneDisplay = `h${eggIvs.hp || 0}a${eggIvs.atk || 0}d${eggIvs.def || 0}s${eggIvs.spe || 0}sa${eggIvs.spa || 0}sd${eggIvs.spd || 0}`;
          slot.innerHTML = `
            <div class="team-sprite-wrap">
              <img src="assets/egg.png" width="48" height="48" class="sprite-pixel">
            </div>
            <div class="slot-name">Яйцо</div>
            <div class="slot-lvl fs-065">${ready ? 'Вылупляется...' : `Вылупится через ~${remaining} мин`}</div>
            <div class="slot-lvl" style="font-size:0.6rem;color:#4682B4">${geneDisplay}</div>
          `;
        } else {
          // ── Обычный покемон ──
          const pwStars2 = getPowerStars(mon);    // Звёзды мощи
          const rStars2 = getRarityStars(mon);     // Звёзды редкости
          slot.innerHTML = `
            ${reorderHtml}
            <div class="team-sprite-wrap">
              <img src="${getSpriteUrl(mon)}" alt="sprite" style="background:${typeBg};">
              ${trainLabel}
            </div>
            <div class="slot-name">${escHtml(mon.nickname || mon.apiData.name)} ${statusIcon}</div>
            <div class="slot-lvl">${renderStars(pwStars2, rStars2)} Lvl ${curLvl} | ${mon.currentHp}/${mon.maxHp} HP</div>
          `;
        }
        // Сохраняем индекс покемона в data-атрибуте
        slot.setAttribute('data-poke-index', String(i));
        // При клике на слот (не на кнопку перестановки) — открываем профиль
        slot.addEventListener('click', (e) => {
          if ((e.target as HTMLElement).closest('.team-move-btn')) return;  // Игнорируем клики по ▲/▼
          openPokemonProfile(i);
        });
      } else {
        // ── Пустой слот ──
        slot.className = 'team-slot empty';
        slot.innerText = 'Пустой слот';
      }
      grid.appendChild(slot);
    }
  });

  // ── Делегирование событий для кнопок перестановки (▲/▼) ──
  // Вешаем обработчик один раз (флаг _reorderSetup)
  if (!(grid as any)._reorderSetup) {
    (grid as any)._reorderSetup = true;
    grid.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.team-move-btn');
      if (!btn) return;
      const idx = parseInt(btn.getAttribute('data-index') || '0');  // Индекс текущего слота
      const dir = parseInt(btn.getAttribute('data-dir') || '0');     // Направление: -1 (вверх) или 1 (вниз)
      const swapIdx = idx + dir;
      // Проверка границ
      if (swapIdx < 0 || swapIdx >= state.myTeam.length) return;
      // Меняем местами двух покемонов в массиве
      [state.myTeam[idx], state.myTeam[swapIdx]] = [state.myTeam[swapIdx], state.myTeam[idx]];
      renderTeamGrid();  // Перерисовываем сетку
      autoSave();         // Сохраняем
    });
  }
}

// ── openPokemonProfile: открыть профиль покемона ─────────
// Принимает index — индекс покемона в команде (0-5)
// Переключает отображение с ростера команды на карточку профиля
export function openPokemonProfile(index: number) {
  state.currentPokemonIndex = index;  // Запоминаем выбранного покемона
  refreshProfileUI();                   // Обновляем UI профиля

  // Прячем список команды (ростер)
  const roster = document.getElementById('team-roster');
  if (roster) roster.style.display = 'none';
  // Показываем карточку профиля
  const display = document.getElementById('pokedex-display');
  if (display) display.style.display = 'flex';
}

// ── refreshProfileUI: обновление всего UI профиля ────────
// Заполняет все элементы профиля данными текущего покемона:
//   имя, спрайт, типы, способность, характер, held item,
//   HP, атаки, резерв атак, уровень, IV, EV, тренировка, счастье
export function refreshProfileUI() {
  // Если покемон не выбран — выходим
  if (state.currentPokemonIndex === null) return;
  const mon = state.myTeam[state.currentPokemonIndex];

  const curLvl = mon.baseLevel + mon.candiesEaten;  // Текущий уровень

  // ── Имя и ID покемона ──
  const pokeName = document.getElementById('poke-name');
  if (pokeName) pokeName.innerText = `${mon.nickname || mon.apiData.name} #${mon.apiData.id}`;

  // ── Спрайт покемона ──
  const animSprite = getSpriteUrl(mon);
  const pokeSprite = document.getElementById('poke-sprite') as HTMLImageElement;
  if (pokeSprite) {
    pokeSprite.src = animSprite;
    pokeSprite.style.background = getTypeGradient(mon.apiData.types);  // Фон по типу
  }

  // ── Типы покемона (значки с цветом) ──
  const typesHtml = mon.apiData.types.map(t =>
    `<span class="type-badge" style="background-color: ${getTypeColor(t.type.name)}">${t.type.name}</span>`
  ).join('');
  const pokeTypes = document.getElementById('poke-types');
  if (pokeTypes) pokeTypes.innerHTML = typesHtml;

  // ── Способность (Ability) ──
  // Берём первую способность из PokeAPI данных
  const ability = mon.apiData.abilities.length > 0
    ? mon.apiData.abilities[0].ability.name
    : 'Unknown';
  const abilityEl = document.getElementById('info-ability');
  if (abilityEl) abilityEl.innerText = ability.charAt(0).toUpperCase() + ability.slice(1);  // "overgrow" → "Overgrow"

  // ── Тера-тип ──
  const tera = mon.apiData.types[0].type.name;  // По умолчанию = первый тип
  const teraEl = document.getElementById('info-tera');
  if (teraEl) teraEl.innerText = tera.charAt(0).toUpperCase() + tera.slice(1);

  // ── Характер (Nature) с отображением buff/nerf ──
  const natureIdx = mon.natureIdx || 0;
  const nature = natures[natureIdx];
  const natureEl = document.getElementById('info-nature');
  if (nature && natureEl) {
    const statNames = {
      'atk': 'Атака',
      'def': 'Защита',
      'spa': 'Сп.Атака',
      'spd': 'Сп.Защита',
      'spe': 'Скорость'
    };
    let natureHtml = nature.name;
    // Если характер усиливает стат — показываем зелёную стрелку вверх
    if (nature.buff) natureHtml += ` <span style="color:#4ade80">↑${statNames[nature.buff]}</span>`;
    // Если характер ослабляет стат — показываем красную стрелку вниз
    if (nature.nerf) natureHtml += ` <span style="color:#ff6b4a">↓${statNames[nature.nerf]}</span>`;
    natureEl.innerHTML = natureHtml;
  }

  // ── Held Item (удерживаемый предмет) ──
  const heldEl = document.getElementById('info-held-item');
  if (heldEl) {
    const heldItemName = getHeldItemName(mon.heldItem);
    heldEl.innerText = heldItemName;
    heldEl.title = 'Нажмите чтобы сменить';  // Подсказка
    heldEl.style.cursor = 'pointer';           // Курсор-рука
    // При клике — открываем пикер held item
    heldEl.onclick = () => openHeldItemPicker(state.currentPokemonIndex!);
  }

  // ── Текущее и максимальное HP ──
  const curHpEl = document.getElementById('info-cur-hp');
  if (curHpEl) curHpEl.innerText = String(mon.currentHp);
  const maxHpEl = document.getElementById('info-max-hp');
  if (maxHpEl) maxHpEl.innerText = String(mon.maxHp);

  // ── Атаки (4 слота) ──
  for (let i = 0; i < 4; i++) {
    const moveNameEl = document.getElementById(`move-${i}-name`);
    const movePPEl = document.getElementById(`move-${i}-pp`);
    if (mon.apiData.moves[i]) {
      // Отображаем PP: текущее / максимум (fallback 30/30 если нет данных)
      const ppDisplay = (mon.movesPP && mon.movesPP[i])
        ? `${mon.movesPP[i].current}/${mon.movesPP[i].max}`
        : '30/30';
      if (moveNameEl) moveNameEl.innerText = mon.apiData.moves[i].move.name;
      if (movePPEl) movePPEl.innerText = `PP ${ppDisplay}`;
      // Цвет атаки по типу (физическая/специальная/статусная)
      const moveUrl = mon.apiData.moves[i].move.url;
      if (moveUrl) colorMoveElement(i, moveUrl);
    } else {
      // Пустой слот атаки
      if (moveNameEl) moveNameEl.innerText = '-';
      if (movePPEl) movePPEl.innerText = `PP 0/0`;
    }
  }

  // ── Резерв атак (learnable moves) ──
  const movesContent = document.getElementById('content-moves');
  if (movesContent) {
    let learnableHTML = '';
    if (mon.learnableMoves && mon.learnableMoves.length > 0) {
      // Создаём HTML для каждой атаки в резерве
      learnableHTML = '<div class="learnable-section mt-12"><h4 class="m-0-0-8 fs-09">📥 Резерв атак:</h4>';
      mon.learnableMoves.forEach((lm, i) => {
        learnableHTML += `<div class="learnable-move flex-between m-4-0 br-6 fs-085" style="padding:6px 8px;background:var(--tma-bg);">
          <span>${lm.name} (⚡${lm.power || '?'} | ${lm.type || '?'})</span>
          <button class="btn-use learn-btn" data-lm="${i}" class="btn-use-learn">Выучить</button>
        </div>`;
      });
      learnableHTML += '</div>';
    }

    // Удаляем старую секцию резерва (если есть) — чтобы не дублировать
    const oldSec = movesContent.querySelector('.learnable-section');
    if (oldSec) oldSec.remove();

    // Добавляем новую секцию
    if (learnableHTML) {
      movesContent.insertAdjacentHTML('beforeend', learnableHTML);

      // Вешаем обработчики на кнопки "Выучить"
      movesContent.querySelectorAll('.learn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-lm') || '0');
          const move = mon.learnableMoves[idx];

          // Показываем выбор: в какой слот поместить атаку
          const slotItems = (mon.apiData.moves || []).map((m, i) => ({
            label: m ? m.move.name : '(пусто)',
            subtitle: `Слот ${i + 1}`
          }));

          showSelectionModal(
            `Выучить ${move.name} (⚡${move.power}) в какой слот?`,
            slotItems,
            (slotPick) => {
              // Если слот пуст — инициализируем
              if (!mon.apiData.moves[slotPick]) mon.apiData.moves[slotPick] = {};
              // Записываем атаку в слот
              mon.apiData.moves[slotPick].move = { name: move.name, url: move.url };
              mon.learnableMoves.splice(idx, 1);  // Убираем из резерва
              refreshProfileUI();                    // Обновляем UI
              showToast(`${move.name} выучено в слот ${slotPick + 1}!`, false);
              autoSave();
            },
            true  // showCancel — кнопка "Отмена"
          );
        });
      });
    }
  }

  // ── Уровень ──
  const lvlEl = document.getElementById('info-lvl');
  if (lvlEl) lvlEl.innerText = String(curLvl);
  const statLvlEl = document.getElementById('stat-lvl-display');
  if (statLvlEl) statLvlEl.innerText = String(curLvl);

  // ── Витамины (счётчик) ──
  const statVitEl = document.getElementById('stat-vit-display');
  if (statVitEl) statVitEl.innerText = `${mon.vitaminsEaten}/10`;

  // ── IV (индивидуальные значения) ──
  const ivs = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  ivs.forEach(stat => {
    const el = document.getElementById(`iv-${stat}`) as HTMLInputElement;
    if (el) el.value = String((mon.ivs as any)[stat]);
  });

  // ── EV (очки усилий) ──
  ivs.forEach(stat => {
    const el = document.getElementById(`ev-${stat}`) as HTMLInputElement;
    if (el) el.value = String((mon.evs as any)[stat]);
  });

  // ── Обновление дополнительных UI-компонентов ──
  updateTrainingUI_Profile(mon);     // Тренировка (стадия, процент, стат)
  updateHappinessUI_Profile(mon);    // Счастье
  updateGenecodeDisplay_Profile(mon); // Генетический код (IV) + UID
  updateStatusDisplay_Profile(mon);   // Статус (отравление, паралич и т.д.)

  updateDynamicEVs();  // Обновляем отображение доступных EV
  updateStats();       // Обновляем вычисленные статы
}

// ── colorMoveElement: назначить CSS-класс атаке по её типу ──
// Принимает index — номер слота атаки (0-3)
//            moveUrl — URL атаки в PokeAPI
// Асинхронно загружает тип атаки (physical/special/status) и красит текст
export async function colorMoveElement(index: number, moveUrl: string) {
  try {
    // Проверяем кэш типов атак (state.moveTypeCache — Map)
    if (!state.moveTypeCache.has(moveUrl)) {
      // Загружаем данные атаки из PokeAPI
      const res = await fetch(moveUrl);
      const data = await res.json();
      // Кэшируем: damage_class = 'physical' | 'special' | 'status'
      state.moveTypeCache.set(moveUrl, data.damage_class?.name || 'status');
    }
    // Получаем класс урона из кэша
    const dc = state.moveTypeCache.get(moveUrl);
    // Находим DOM-элемент атаки и добавляем CSS-класс
    const el = document.getElementById(`move-${index}-name`);
    if (el) el.classList.add(`move-type-${dc}`);
  } catch (e) {
    // Если загрузка не удалась — ничего не делаем (атака остаётся без цвета)
  }
}

// ── updateStatusDisplay_Profile: отображение статуса покемона ──
// Показывает иконку и название статусного эффекта (яд, паралич, сон, ожог, заморозка)
// Если статуса нет — элемент скрыт
export function updateStatusDisplay_Profile(mon: any) {
  const el = document.getElementById('profile-status-display');
  if (!el) return;
  // Загружаем battle/core для getStatusIcon (лениво)
  getBattleCore().then(bc => {
    if (mon.status) {
      // Есть статус — показываем иконку + название
      el.innerText = `Статус: ${bc.getStatusIcon(mon.status)} ${STATUS_NAMES[mon.status]}`;
      el.style.display = 'block';
    } else {
      // Нет статуса — скрываем
      el.style.display = 'none';
    }
  });
}

// ── updateTrainingUI_Profile: отображение информации о тренировке ──
// Показывает: стадию тренировки, процент усиления, какой стат тренируется
export function updateTrainingUI_Profile(mon: any) {
  const stageName = trainingStages[mon.trainingStage].name;  // Название стадии
  const pct = trainingStages[mon.trainingStage].pct;          // Процент усиления

  const stageEl = document.getElementById('train-stage');
  if (stageEl) stageEl.innerText = stageName;

  const pctEl = document.getElementById('train-pct');
  if (pctEl) pctEl.innerText = pct > 0 ? `(+${pct}%)` : '';  // Пусто если 0%

  // Название тренируемого стата (если есть)
  const statNames = {
    'atk': 'Атака',
    'def': 'Защита',
    'spa': 'Сп.Атака',
    'spd': 'Сп.Защита',
    'spe': 'Скорость'
  };
  const statEl = document.getElementById('train-stat');
  if (statEl) statEl.innerText = mon.trainingStat
    ? `(${statNames[mon.trainingStat as keyof typeof statNames]})`
    : '';
}

// ── updateHappinessUI_Profile: отображение счастья покемона ──
// Счастье (0-255) влияет на некоторые эволюции и критический удар
// Критический удар: от 7% (счастье=0) до 11% (счастье=255)
export function updateHappinessUI_Profile(mon: any) {
  const hapEl = document.getElementById('status-happiness');
  if (hapEl) hapEl.innerText = String(mon.happiness);

  // Вычисляем процент критического удара на основе счастья
  const baseCrit = 7.0;                                           // Базовый шанс: 7%
  const maxCrit = 11.0;                                           // Максимум: 11%
  const currentCrit = baseCrit + ((mon.happiness / 255) * (maxCrit - baseCrit)); // Линейная интерполяция
  const critEl = document.getElementById('info-crit');
  if (critEl) critEl.innerText = `${currentCrit.toFixed(1)}%`;    // "8.5%"
}

// ── updateGenecodeDisplay_Profile: отображение генетического кода ──
// Показывает IV в компактном формате: "h31a31d31s20sa10sd25"
// А также UID покемона и ID оригинального тренера
export function updateGenecodeDisplay_Profile(mon: any) {
  const iv = mon.ivs;
  // Формируем строку генокода: h(HP)a(ATK)d(DEF)s(SPE)sa(SPA)sd(SPD)
  const genecodeStr = `h${iv.hp}a${iv.atk}d${iv.def}s${iv.spe}sa${iv.spa}sd${iv.spd}`;
  const geneEl = document.getElementById('info-genecode');
  if (geneEl) geneEl.innerText = genecodeStr;

  // ── UID и оригинальный тренер ──
  const uidEl = document.getElementById('info-uid');
  if (uidEl) {
    uidEl.innerText = mon.uid || '?';                               // Уникальный ID покемона
    uidEl.title = mon.originalTrainer
      ? `Тренер ID: ${mon.originalTrainer}`                         // Кто его поймал/вывел
      : '';
  }
}

// ── saveActiveMonData: сохранить данные активного покемона ──
// Читает значения EV из полей ввода и записывает их в mon.evs
// Пересчитывает maxHp по формуле с новыми EV
export function saveActiveMonData() {
  if (state.currentPokemonIndex === null) return;
  const mon = state.myTeam[state.currentPokemonIndex];

  // ── Чтение EV из DOM-инпутов ──
  // Находим все 6 полей ввода EV
  const evHp = document.getElementById('ev-hp') as HTMLInputElement;
  const evAtk = document.getElementById('ev-atk') as HTMLInputElement;
  const evDef = document.getElementById('ev-def') as HTMLInputElement;
  const evSpa = document.getElementById('ev-spa') as HTMLInputElement;
  const evSpd = document.getElementById('ev-spd') as HTMLInputElement;
  const evSpe = document.getElementById('ev-spe') as HTMLInputElement;

  // Записываем значения в mon.evs (parseInt с fallback на 0)
  mon.evs.hp = parseInt(evHp?.value || '0') || 0;
  mon.evs.atk = parseInt(evAtk?.value || '0') || 0;
  mon.evs.def = parseInt(evDef?.value || '0') || 0;
  mon.evs.spa = parseInt(evSpa?.value || '0') || 0;
  mon.evs.spd = parseInt(evSpd?.value || '0') || 0;
  mon.evs.spe = parseInt(evSpe?.value || '0') || 0;

  // ── Пересчёт maxHp ──
  // Формула HP: floor(0.01 * (2*base + IV + floor(0.25*EV)) * level) + level + 10
  const baseHp = mon.apiData.stats[0].base_stat;  // Базовый HP из PokeAPI
  const curLvl = mon.baseLevel + mon.candiesEaten;
  mon.maxHp = Math.floor(
    0.01 * (2 * baseHp + mon.ivs.hp + Math.floor(0.25 * mon.evs.hp)) * curLvl
  ) + curLvl + 10;

  // Если текущее HP больше нового максимума — урезаем
  if (mon.currentHp > mon.maxHp) mon.currentHp = mon.maxHp;

  // Обновляем отображение HP
  const infoMaxHp = document.getElementById('info-max-hp');
  if (infoMaxHp) infoMaxHp.innerText = String(mon.maxHp);
  const infoCurHp = document.getElementById('info-cur-hp');
  if (infoCurHp) infoCurHp.innerText = String(mon.currentHp);
}

// ── initProfileEvents: инициализация событий профиля ─────
// Вешает обработчики на EV-инпуты (валидация 0-252) и кнопку "Применить EV"
export function initProfileEvents() {
  // ── Валидация EV-инпутов ──
  // Ограничиваем ввод: 0-252, и обновляем динамический расчёт остатка
  const evInputs = document.querySelectorAll('.reborn-input-ev');
  evInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      const inputEl = e.target as HTMLInputElement;
      let val = parseInt(inputEl.value) || 0;
      if (val < 0) val = 0;          // Не меньше 0
      if (val > 252) val = 252;      // Не больше 252 (максимум на стат)
      inputEl.value = String(val);
      updateDynamicEVs();              // Обновляем счётчик остатка EV
    });
  });

  // ── Кнопка "Применить EV" ──
  const applyBtn = document.getElementById('btn-ev-apply');
  if (applyBtn) applyBtn.onclick = () => { applyEVs(); updateStats(); };
}

// ── updateStats: обновить отображение статов покемона ────
// Использует calculateStat из battle/core.js для вычисления финальных статов
// с учётом IV, EV, характера, тренировки
export function updateStats() {
  if (state.currentPokemonIndex === null) return;
  const mon = state.myTeam[state.currentPokemonIndex];

  // Маппинг: имя стата → ID DOM-элемента
  const stats = [
    { name: 'hp', el: 'val-hp' },
    { name: 'attack', el: 'val-atk' },
    { name: 'defense', el: 'val-def' },
    { name: 'special-attack', el: 'val-spa' },
    { name: 'special-defense', el: 'val-spd' },
    { name: 'speed', el: 'val-spe' }
  ];

  // Загружаем battle/core (лениво) для calculateStat
  getBattleCore().then(bc => {
    stats.forEach(s => {
      // Вычисляем финальный стат через чистую формулу из core.ts
      const val = bc.calculateStat(mon, s.name, false);
      const el = document.getElementById(s.el);
      if (el) el.innerText = String(val);
    });
  });
}

// ── initProfileUXEvents: навигация и быстрый ввод EV ────
// Кнопки "Предыдущий/Следующий" покемон + кнопки быстрого EV
export function initProfileUXEvents() {
  // ── Кнопка "Предыдущий покемон" (◀) ──
  const prevBtn = document.getElementById('btn-prev-mon');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (state.currentPokemonIndex !== null && state.myTeam.length > 0) {
        // Циклический переход: (текущий - 1 + длина) % длина
        state.currentPokemonIndex = (state.currentPokemonIndex - 1 + state.myTeam.length) % state.myTeam.length;
        openPokemonProfile(state.currentPokemonIndex);
      }
    });
  }

  // ── Кнопка "Следующий покемон" (▶) ──
  const nextBtn = document.getElementById('btn-next-mon');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (state.currentPokemonIndex !== null && state.myTeam.length > 0) {
        // Циклический переход: (текущий + 1) % длина
        state.currentPokemonIndex = (state.currentPokemonIndex + 1) % state.myTeam.length;
        openPokemonProfile(state.currentPokemonIndex);
      }
    });
  }

  // ── Кнопки быстрого добавления EV (+1, +4, +8, +12, max) ──
  document.querySelectorAll('.reborn-ev-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (state.currentPokemonIndex === null) return;
      const mon = state.myTeam[state.currentPokemonIndex];
      const target = e.target as HTMLElement;
      const stat = target.getAttribute('data-stat') || 'hp';     // Какой стат (atk, def, ...)
      const valStr = target.getAttribute('data-val') || '0';     // Сколько добавить ('1', '4', 'max')

      const evs = mon.evs as Record<string, number>;
      let totalEVs = Object.values(evs).reduce((a, b) => a + b, 0);  // Сумма всех EV
      let maxTotal = (mon.candiesEaten * 4) + (mon.vitaminsEaten * 10); // Максимум доступных EV

      let currentEV = evs[stat] || 0;
      let toAdd = 0;

      if (valStr === 'max') {
        // "Заполнить до 126" (максимум в Reborn-системе)
        toAdd = Math.min(126 - currentEV, maxTotal - totalEVs);
      } else {
        toAdd = parseInt(valStr);
        // Не превышаем 126 на стат
        if (currentEV + toAdd > 126) toAdd = 126 - currentEV;
        // Не превышаем общий лимит
        if (totalEVs + toAdd > maxTotal) toAdd = maxTotal - totalEVs;
      }

      if (toAdd > 0) {
        mon.evs[stat] += toAdd;  // Добавляем EV
        refreshProfileUI();       // Обновляем UI
      } else {
        showToast(
          'Нет свободных EV! Дайте покемону Конфеты (+4 EV) или Витамины (+10 EV).',
          true
        );
      }
    });
  });
}
