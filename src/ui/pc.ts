// ─────────────────────────────────────────────────────────────
// pc.ts — PC BOXES (Хранилище покемонов)
// ─────────────────────────────────────────────────────────────
// Отображает и управляет PC Boxes — дополнительным хранилищем покемонов.
// Когда команда полна (6 покемонов), пойманные покемоны попадают в PC.
// Позволяет просматривать, перемещать и удалять покемонов из боксов.
//
// ЗАВИСИМОСТИ:
//   state      — глобальное состояние (myTeam, pcBoxes, eggs, breedingPairs)
//   store      — event-система (emit для обновления UI)
//   dom        — showToast (всплывающие уведомления), showConfirmModal (подтверждение)
//   core       — getStatusIcon (иконка статуса), battle.state (активный покемон в бою)
//   sprite     — getTypeColor (цвет типа), getSpriteUrl (URL спрайта)
//   training   — trainingStages (этапы тренировки)
//   daycare    — hatchEgg, checkBreeding, collectEgg (яйца и разведение)
//
// ИСПОЛЬЗУЕТСЯ В:
//   location.ts       — кнопка "PC" на панели локации
//   battle/core.ts    — при поимке покемона, если команда полна
//   main.ts           — глобальная переменная pcBoxes[]
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ──
// state — глобальное состояние игры (команда, PC боксы, яйца, пары для разведения)
import { state } from '../game/state.js';
// store — центральная event-система (emit('team:render') и emit('save') при закрытии PC)
import { store } from '../game/store.js';
// showToast — всплывающее уведомление; showConfirmModal — модалка подтверждения (Да/Нет)
import { showToast, showConfirmModal } from '../utils/dom.js';
// getStatusIcon — иконка статуса (☠️🔥⚡💤❄️) из battle/core.ts
import { getStatusIcon } from '../battle/core.js';
// getTypeColor — hex-цвет типа покемона; getSpriteUrl — URL спрайта покемона
import { getTypeColor, getSpriteUrl } from '../utils/sprite.js';
// trainingStages — массив этапов тренировки (имена, цвета, проценты)
import { trainingStages } from '../data/training.js';
// hatchEgg — вылупить яйцо; checkBreeding — проверка пар; collectEgg — забрать готовое яйцо
import { hatchEgg, checkBreeding, collectEgg } from './daycare.js';
// battle — инстанс BattleStateMachine (нужен для проверки battle.state.activePlayerMon при перемещении)
import { battle } from '../battle/core.js';

/**
 * showPCInfoModal — показать модалку с подробной информацией о покемоне в PC.
 *
 * ЧТО ДЕЛАЕТ:
 *   Создаёт DOM-элемент модального окна с данными покемона:
 *     - Спрайт (96x96)
 *     - Имя + уровень
 *     - Типы + способность
 *     - HP + статус
 *     - IVs (все 6 статов)
 *     - Атаки
 *     - Этап тренировки (если есть)
 *   Закрывается по кнопке "Закрыть" или клику вне модалки.
 *
 * ЧТО ПРИНИМАЕТ:
 *   mon — объект покемона (из pcBoxes[] или myTeam[])
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   renderPCSlots() — по клику на кнопку ℹ (инфо) у покемона в боксе
 */
function showPCInfoModal(mon: any) {
  // ═══ Сбор данных покемона ═══
  // baseLevel + candiesEaten = итоговый уровень (candies — конфеты, повышающие уровень)
  const curLvl = mon.baseLevel + (mon.candiesEaten || 0);
  // Типы покемона (может быть 1 или 2): 'fire/flying', 'water' и т.д.
  const types = mon.apiData?.types?.map((t: any) => t.type.name).join(', ') || '?';
  // Способность (ability) — либо сохранённая в mon.abilityName, либо из PokeAPI
  const ability = mon.abilityName || mon.apiData?.abilities?.[0]?.ability?.name || '-';
  // URL спрайта покемона (с учётом shiny)
  const sprite = getSpriteUrl(mon);
  // Список атак покемона (имена через запятую)
  const moves = (mon.apiData?.moves || []).filter((m: any) => m).map((m: any) => m.move.name).join(', ') || 'Нет атак';
  // IVs (Individual Values) — если нет, пустой объект
  const ivs = mon.ivs || {};

  // ═══ Создание DOM-модалки ═══
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';          // Затемнённый фон
  modal.style.display = 'flex';                // Показываем модалку
  modal.innerHTML = `
    <div class="selection-modal-card text-center">
      <img src="${sprite}" class="sprite-pixel" style="width:96px;height:96px;" onerror="this.style.display='none'">
      <h3 class="m-8-0">${mon.nickname || mon.apiData?.name || '???'} <span class="text-muted">Lv.${curLvl}</span></h3>
      <p class="text-muted" class="m-4-0">Тип: ${types} | Способность: ${ability}</p>
      <p class="m-4-0">HP: ${mon.currentHp}/${mon.maxHp} | Статус: ${getStatusIcon(mon.status) || 'нет'}</p>
      <div class="text-muted fs-08 m-8-0">
        <b>IV:</b> HP:${ivs.hp||0} АТК:${ivs.atk||0} ЗАЩ:${ivs.def||0} СП.АТК:${ivs.spa||0} СП.ЗАЩ:${ivs.spd||0} СКОР:${ivs.spe||0}
      </div>
      <p class="text-muted" class="fs-08">Атаки: ${moves}</p>
      ${mon.trainingStage > 0 ? `<p style="font-size:0.8rem;color:${trainingStages[mon.trainingStage].color};">Тренировка: ${trainingStages[mon.trainingStage].name} (+${trainingStages[mon.trainingStage].pct}%)</p>` : ''}
      <button class="tma-btn w-full mt-12" id="btn-pc-info-close">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);           // Вставляем модалку в DOM

  // ═══ Обработчики закрытия ═══
  // cleanup — удаляет все обработчики и убирает модалку из DOM
  const cleanup = () => {
    document.getElementById('btn-pc-info-close')?.removeEventListener('click', cleanup);
    modal.removeEventListener('click', onOverlay);
    if (modal.parentNode) modal.parentNode.removeChild(modal);
  };
  // onOverlay — закрытие по клику вне карточки (на затемнённый фон)
  const onOverlay = (e: any) => { if (e.target === modal) cleanup(); };

  // Привязываем обработчики
  document.getElementById('btn-pc-info-close')!.addEventListener('click', cleanup);
  modal.addEventListener('click', onOverlay);
}

/**
 * openPC — открыть модалку PC Boxes.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Очищает и перестраивает вкладки (tabs): "Команда", "Бокс 1", "Бокс 2"... "+ Новый бокс"
 *   2. Для каждого бокса показывает иконки: ❤️ если есть пара для разведения, 🥚 если есть яйцо
 *   3. Рендерит содержимое выбранной вкладки через renderPCSlots()
 *   4. Запускает checkBreeding() для проверки пар
 *   5. При закрытии — эмитит события 'team:render' и 'save'
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   Из location.ts (кнопка "PC") и из самой себя (при переключении вкладок)
 */
export function openPC() {
  // DOM-элементы модалки PC
  const modal = document.getElementById('pc-modal');          // Основная модалка
  const tabsContainer = document.getElementById('pc-tabs')!;  // Контейнер вкладок
  const slotsContainer = document.getElementById('pc-slots')!; // Контейнер слотов
  const teamCount = document.getElementById('pc-team-count')!;
  teamCount.innerText = `(В команде: ${state.myTeam.length}/6)`; // "В команде: 3/6"

  // ═══ Сбор данных о парах и яйцах ═══
  // breedingBoxes — Set индексов боксов, где есть пары для разведения
  const breedingBoxes = new Set(state.breedingPairs.map((p: any) => p.boxIdx));
  // eggBoxes — Set индексов боксов, где есть яйца
  const eggBoxes = new Set(state.eggs.filter((e: any) => e.boxIdx !== undefined).map((e: any) => e.boxIdx));

  // ═══ Построение вкладок ═══
  tabsContainer.innerHTML = '<span class="pc-tab active" data-box="team">Команда</span>';
  state.pcBoxes.forEach((box: any, i: number) => {
    // Иконки: ❤️ = есть пара, 🥚 = есть яйцо в этом боксе
    const breedIcon = breedingBoxes.has(i) ? ' ❤️' : '';
    const eggIcon = eggBoxes.has(i) ? ' 🥚' : '';
    tabsContainer.innerHTML += `<span class="pc-tab" data-box="${i}">Бокс ${i + 1}${breedIcon}${eggIcon}</span>`;
  });
  tabsContainer.innerHTML += '<span class="pc-tab" id="btn-pc-new-box">+ Новый бокс</span>';

  // ═══ Обработчики вкладок ═══
  // Клик по вкладке → снимает active со всех → ставит на выбранную → рендерит слоты
  tabsContainer.querySelectorAll('.pc-tab').forEach(tab => {
    (tab as HTMLElement).onclick = () => {
      tabsContainer.querySelectorAll('.pc-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPCSlots((tab as HTMLElement).dataset.box); // 'team' или индекс бокса
    };
  });

  // Кнопка "+ Новый бокс" — добавляет пустой массив в pcBoxes и перерисовывает
  (document.getElementById('btn-pc-new-box') as HTMLElement).onclick = () => {
    state.pcBoxes.push([]);
    openPC(); // Перерисовка (рекурсия, но только 1 уровень)
  };

  // ═══ Первичный рендер ═══
  renderPCSlots('team');  // Показываем команду по умолчанию
  modal!.style.display = 'flex';
  checkBreeding();        // Проверка пар для разведения

  // ═══ Кнопка закрытия ═══
  const closeBtn = document.getElementById('btn-pc-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal!.style.display = 'none';
      store.emit('team:render');  // Обновить UI команды
      store.emit('save');          // Автосохранение
    };
  }
}

/**
 * renderPCSlots — отрендерить слоты покемонов для выбранной вкладки.
 *
 * ЧТО ДЕЛАЕТ:
 *   Если view === 'team' — показывает покемонов из команды с кнопкой "В PC".
 *   Если view === индекс бокса — показывает покемонов в боксе с кнопками:
 *     ℹ — информация, "В команду", "Отп." (отпустить).
 *   Также отображает яйца (с таймером) и информацию о паре для разведения.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из openPC() при переключении вкладок
 */
function renderPCSlots(view: string) {
  const container = document.getElementById('pc-slots')!;
  container.innerHTML = ''; // Очищаем перед рендером

  // ═══════════════════════════════════════════════════════════
  // РЕЖИМ "КОМАНДА" (view === 'team')
  // ═══════════════════════════════════════════════════════════
  if (view === 'team') {
    state.myTeam.forEach((mon: any, i: number) => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      const spriteUrl = getSpriteUrl(mon);
      div.innerHTML = `
        <img src="${spriteUrl}" width="40" height="40" onerror="this.style.display='none'">
        <div class="pc-slot-info">
          <b>Lv.${mon.baseLevel + mon.candiesEaten} ${mon.name || mon.apiData?.name}</b>
          <span>HP: ${mon.currentHp}/${mon.maxHp}</span>
        </div>
        <button class="btn-use" class="btn-use-pc">В PC</button>
      `;
      // Кнопка "В PC" — переместить из команды в первый бокс
      div.querySelector('button')!.onclick = () => {
        if (state.myTeam.length <= 1) { showToast('Нельзя оставить команду пустой!', true); return; }
        // Если боксов нет — создаём первый
        const targetBox = state.pcBoxes.length > 0 ? 0 : (state.pcBoxes.push([]), 0);
        const movedMon = state.myTeam.splice(i, 1)[0]; // Удаляем из команды
        state.pcBoxes[targetBox].push(movedMon);        // Добавляем в бокс
        // Если покемон был активным в бою — переназначаем на первого живого
        if (typeof (battle as any).state.activePlayerMon !== 'undefined' && (battle as any).state.activePlayerMon && (battle as any).state.activePlayerMon === mon && state.myTeam.length > 0) {
          (battle as any).state.activePlayerMon = state.myTeam[0];
        }
        openPC(); // Перерисовываем PC
      };
      container.appendChild(div);
    });
  } else {
    // ═══════════════════════════════════════════════════════════
    // РЕЖИМ "БОКС" (view === индекс бокса)
    // ═══════════════════════════════════════════════════════════
    const boxIdx = parseInt(view);
    const box = state.pcBoxes[boxIdx];
    if (!box) return;

    // ── Информация о разведении (если в боксе есть пара) ──
    const pair = state.breedingPairs.find((p: any) => p.boxIdx === boxIdx);
    if (pair) {
      // Пара найдена — показываем таймер до появления яйца (в минутах)
      const remaining = Math.max(0, Math.ceil((pair.readyTime - Date.now()) / 60000));
      const progressDiv = document.createElement('div');
      progressDiv.style.cssText = 'text-align:center;padding:8px;margin-bottom:8px;background:#ff950022;border:1px solid #ff9500;border-radius:8px;font-size:0.9rem;';
      progressDiv.innerText = `❤️ Пара найдена! Яйцо через ~${remaining} мин.`;
      container.appendChild(progressDiv);
    } else {
      // Нет пары — проверяем, есть ли 2+ покемона, подходящих для разведения
      const breedable = box.filter((m: any) => m.apiData);
      if (breedable.length >= 2) {
        const hintDiv = document.createElement('div');
        hintDiv.className = 'text-muted';
        hintDiv.style.cssText = 'text-align:center;padding:6px;margin-bottom:8px;font-size:0.8rem;border:1px dashed #555;border-radius:8px;';
        hintDiv.innerText = '💕 В этом боксе есть покемоны, но пара ещё не образовалась. Попробуйте переместить их или закройте/откройте PC.';
        container.appendChild(hintDiv);
      }
    }

    // ── Отображение яиц в этом боксе ──
    const boxEggs = state.eggs.filter((e: any) => e.boxIdx === boxIdx);
    boxEggs.forEach((egg: any) => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      // Цвет фона яйца — по первому типу покемона
      const eggTypes = egg.types || [{ type: { name: 'normal' } }];
      const eggColor = getTypeColor(eggTypes[0]?.type?.name || 'normal');
      div.style.background = `${eggColor}22`;
      div.style.borderColor = eggColor;
      // Расчёт времени до готовности (в днях)
      const remaining = Math.max(0, Math.ceil((egg.readyTime - Date.now()) / (24*60*60*1000)));
      const ready = Date.now() >= egg.readyTime;
      // Генетический код (IVs): h0a0d0s0sa0sd0
      const iv = egg.ivs || {};
      const geneStr = `h${iv.hp || 0}a${iv.atk || 0}d${iv.def || 0}s${iv.spe || 0}sa${iv.spa || 0}sd${iv.spd || 0}`;
      div.innerHTML = `
        <img src="assets/egg.png" width="32" height="32" class="sprite-pixel">
        <div class="pc-slot-info">
          <b>Яйцо ${egg.species ? `(${egg.species})` : ''}</b>
          <span style="color:${eggColor};font-size:0.75rem;">${geneStr}</span>
          <span style="color:#ffd700;font-size:0.7rem;">${ready ? 'Готово!' : `~${remaining} дн`}</span>
        </div>
        <div class="pc-slot-actions">
          <button class="btn-use" data-egg-id="${egg.uid}">Забрать</button>
          ${ready ? '<button class="btn-use">Вылупить</button>' : ''}
        </div>
      `;
      // Кнопка "Забрать" — убрать яйцо из бокса
      (div.querySelector('[data-egg-id]') as HTMLButtonElement).onclick = () => {
        collectEgg(egg.uid);
        openPC();
      };
      // Кнопка "Вылупить" (только если готово)
      if (ready) {
        (div.querySelectorAll('button')[1]!).onclick = async () => {
          await hatchEgg(egg);
          openPC();
        };
      }
    });

    // ── Отображение покемонов в боксе ──
    box.forEach((mon: any, i: number) => {
      const div = document.createElement('div');
      div.className = 'pc-slot';
      const spriteUrl = getSpriteUrl(mon);
      div.innerHTML = `
        <img src="${spriteUrl}" width="40" height="40" onerror="this.style.display='none'">
        <div class="pc-slot-info">
          <b>Lv.${mon.baseLevel + mon.candiesEaten} ${mon.name || mon.apiData?.name}</b>
          <span>HP: ${mon.currentHp}/${mon.maxHp}</span>
          <span class="text-muted" class="fs-07">${mon.apiData?.types?.map((t: any) => t.type.name).join('/') || ''}</span>
        </div>
        <div class="pc-slot-actions">
          <button class="btn-use" class="btn-use-info" title="Инфо">ℹ</button>
          <button class="btn-use" class="btn-use-team">В команду</button>
          <button class="btn-use" class="btn-use-release">Отп.</button>
        </div>
      `;
      // ℹ — информация о покемоне
      const [btnInfo, btnTeam, btnRelease] = div.querySelectorAll('button');
      btnInfo.onclick = () => { showPCInfoModal(mon); };
      // "В команду" — переместить из бокса в команду
      btnTeam.onclick = () => {
        if (state.myTeam.length >= 6) { showToast('Команда полна (6/6)! Освободите место.', true); return; }
        const movedMon = box.splice(i, 1)[0];
        state.myTeam.push(movedMon);
        if (box.length === 0) { state.pcBoxes.splice(boxIdx, 1); } // Удаляем пустой бокс
        openPC();
      };
      // "Отп." — отпустить покемона (удалить навсегда)
      btnRelease.onclick = () => {
        showConfirmModal('Отпустить покемона?', `${mon.name || mon.apiData?.name} будет отпущен навсегда. Это нельзя отменить.`, () => {
          box.splice(i, 1);
          if (box.length === 0) { state.pcBoxes.splice(boxIdx, 1); }
          openPC();
        });
      };
      container.appendChild(div);
    });
  }
}
