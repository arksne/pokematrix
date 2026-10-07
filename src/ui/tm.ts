// ─────────────────────────────────────────────────────────────
// tm.ts — TM MOVE RELEARNER (Повторное изучение атак)
// ─────────────────────────────────────────────────────────────
// Позволяет покемону заново изучить атаки, которые он пропустил
// (не выбрал при повышении уровня). Использует TM-диск (шарф).
//
// ЗАВИСИМОСТИ:
//   getters   — getTeamState (текущий покемон)
//   profile   — refreshProfileUI (обновление профиля)
//   save      — autoSave
//   state     — getItemQty (количество TM)
//   actions   — removeItem (тратим TM)
//   inventory — updateInventoryDisplay
//   dom       — showToast (уведомления)
//   api       — fetchPokeAPI (загрузка атак)
//
// ИСПОЛЬЗУЕТСЯ В:
//   profile.ts   — кнопка "TM" в профиле покемона
//   inventory.ts — useItem('tm')
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { getTeamState } from '../game/getters.js';    // getTeamState().currentPokemonIndex, myTeam
import { refreshProfileUI } from './profile.js';        // Обновление профиля покемона
import { autoSave } from '../game/save.js';              // Автосохранение
import { getItemQty } from '../game/state.js';            // Количество предметов в инвентаре
import { removeItem } from '../game/actions.js';          // Удаление предмета (тратим TM)
import { updateInventoryDisplay } from './inventory.js';  // Обновление инвентаря
import { showToast, showSelectionModal } from '../utils/dom.js';              // Всплывающие уведомления + выбор оплаты
import { fetchPokeAPI } from '../utils/api.js';            // HTTP-клиент для PokeAPI
import { fetchSiteMoveDetail } from '../data/sitemove.js';  // детали атак — с сайта лиги
import { fetchSiteLearnset, moveNameToSlug } from '../data/learnset.js';
import { state } from '../game/state.js';                  // Баланс для учителя

// ── Тиры ТМ по силе атаки (B5): слабая <60 — 200к, средняя ≤90 — 2М, топ >90 — 20М.
// Статусным (power null) разрешён любой тир. Legacy 'tm' без ограничений.
const TM_TIERS = [
  { itemId: 'tmWeak', maxPower: 59, label: 'слабая' },
  { itemId: 'tmMid', maxPower: 90, label: 'средняя' },
  { itemId: 'tmTop', maxPower: Infinity, label: 'топ' },
];
export function tmTierAllows(itemId: string, power: number | null): boolean {
  if (itemId === 'tm') return true;
  const tier = TM_TIERS.find((t) => t.itemId === itemId);
  if (!tier) return false;
  if (power == null) return true;
  return power <= tier.maxPower;
}

// ── openMoveRelearner: открыть интерфейс повторного изучения атак ──
// payItemId — каким диском платим ('tm' legacy без ограничений, иначе тир).
// Пул — таблица совместимости ТМ с сайта лиги (species tm [[номер, атака]]),
// статусные ТМ разрешены. Тир диска ограничивает максимальную силу (B5).
// Показывает список доступных атак с кнопками для замены.
export async function openMoveRelearner(payItemId = 'tm') {
  // Проверка: выбран ли покемон?
  if (getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  }
  // Проверка: есть ли диск нужного тира в инвентаре?
  if (getItemQty(payItemId) <= 0) return showToast('У вас нет подходящего TM-диска!', true);

  // Получаем текущего покемона
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];
  // Находим DOM-модалку TM
  const modal = document.getElementById('tm-modal');
  if (!modal) return;

  // ── Отображение имени покемона и его уровня ──
  document.getElementById('tm-pokemon-name').innerText =
    `${mon.nickname || mon.apiData.name} (Lv${mon.baseLevel + mon.candiesEaten})`;

  // ── Отображение текущих атак (4 слота) + порядок (H5: ▲▼ меняют слоты) ──
  const currentList = document.getElementById('tm-current-list');
  const renderCurrent = () => {
    currentList.innerHTML = '';
    for (let i = 0; i < 4; i++) {
      const row = document.createElement('div');
      row.className = 'tm-current-move';
      row.style.display = 'flex';
      row.style.gap = '4px';
      row.style.alignItems = 'center';
      const nameSpan = document.createElement('span');
      nameSpan.style.flex = '1';
      if (mon.apiData.moves[i]) {
        // Атака есть — показываем имя и PP
        const ppDisplay = (mon.movesPP && mon.movesPP[i])
          ? `${mon.movesPP[i].current}/${mon.movesPP[i].max}`
          : '30/30';
        nameSpan.innerText = `${i + 1}. ${mon.apiData.moves[i].move.name} (PP ${ppDisplay})`;
      } else {
        // Слот пуст
        nameSpan.innerText = `${i + 1}. -`;
      }
      row.appendChild(nameSpan);
      // Кнопки порядка: меняют атаки местами вместе с PP
      const upBtn = document.createElement('button');
      upBtn.className = 'tma-btn';
      upBtn.style.padding = '2px 6px';
      upBtn.innerText = '▲';
      upBtn.title = 'Выше';
      upBtn.disabled = i === 0;
      upBtn.onclick = () => swapMoveSlots(mon, i, i - 1, renderCurrent);
      const downBtn = document.createElement('button');
      downBtn.className = 'tma-btn';
      downBtn.style.padding = '2px 6px';
      downBtn.innerText = '▼';
      downBtn.title = 'Ниже';
      downBtn.disabled = i === 3;
      downBtn.onclick = () => swapMoveSlots(mon, i, i + 1, renderCurrent);
      row.appendChild(upBtn);
      row.appendChild(downBtn);
      currentList.appendChild(row);
    }
  };
  renderCurrent();

  // ── Загрузка доступных атак из PokeAPI ──
  const availableList = document.getElementById('tm-available-list');
  availableList.innerHTML = '<div class="tm-loading">Загрузка доступных атак...</div>';
  modal.style.display = 'flex';  // Показываем модалку (загрузка идёт, показываем "Загрузка...")

  try {
    // Set уже известных атак (слаг-нормализованный, чтобы не показывать их)
    const knownNames = new Set(
      (mon.apiData.moves || []).filter(m => m).map(m => moveNameToSlug(m.move.name))
    );

    // ── Пул ТМ — таблица совместимости с сайта лиги ──
    // species tm: [[номер, атака]]; fallback без сайта — первые 50 PokeAPI.
    const species = mon.apiData?.species?.name || mon.apiData?.name || '';
    let tmNos = new Map<string, number>();
    let sitePool: string[] | null = null;
    try {
      const ls = await fetchSiteLearnset(species);
      if (ls?.tm?.length) {
        sitePool = [];
        for (const [no, name] of ls.tm) {
          const slug = moveNameToSlug(name);
          if (slug && !tmNos.has(slug)) {
            tmNos.set(slug, no);
            sitePool.push(slug);
          }
        }
      }
    } catch { /* ниже fallback */ }

    let moveResults: any[];
    if (sitePool) {
      moveResults = (await Promise.all(
        sitePool.map((slug) => fetchSiteMoveDetail(slug).catch(() => null))
      )).filter(Boolean);
    } else {
      // Fallback: все атаки покемона из PokeAPI, первые 50
      const pokeData = await fetchPokeAPI(`pokemon/${mon.apiData.id}`);
      const allMoves = pokeData.moves || [];
      const movePromises = [];
      for (let i = 0; i < allMoves.length && i < 50; i++) {
        movePromises.push(fetchSiteMoveDetail(allMoves[i]).catch(() => null));
      }
      moveResults = (await Promise.all(movePromises)).filter(Boolean);
    }

    // Фильтруем: неизученные, в тире диска. Статусные ТМ (power null)
    // разрешены — тир их пропускает (tmTierAllows: power==null → true).
    const learnable = moveResults.filter(m => m
      && (m.power || m.damage_class?.name === 'status')
      && !knownNames.has(moveNameToSlug(m.name))
      && tmTierAllows(payItemId, m.power));

    // ── Отображение доступных атак ──
    availableList.innerHTML = '';
    if (learnable.length === 0) {
      availableList.innerHTML = '<div class="tm-empty">Нет новых атак для изучения</div>';
    } else {
      learnable.forEach((moveData) => {
        const moveEl = document.createElement('div');
        moveEl.className = 'tm-move-cell';
        // Показываем: ТМ-номер с сайта (если есть) + имя (сила | тип урона)
        const tmNo = tmNos.get(moveNameToSlug(moveData.name));
        const noPrefix = tmNo != null ? `TM${String(tmNo).padStart(2, '0')} ` : '';
        const powStr = moveData.power ?? '—';
        moveEl.innerText = `${noPrefix}${moveData.name} (${powStr} | ${moveData.damage_class.name})`;
        // При клике — открываем выбор слота для замены (с тем же диском)
        moveEl.addEventListener('click', () => {
          showSlotPicker(mon, moveData, payItemId);
        });
        availableList.appendChild(moveEl);
      });
    }
  } catch (e) {
    // Ошибка загрузки PokeAPI
    availableList.innerHTML = '<div class="tm-error">Ошибка загрузки атак</div>';
  }
}

// ── openTutorRelearner: обучение атакам у учителя (ветка лиги) ──
// Пул — tutor-список вида с сайта лиги (как квестовое обучение у лиги,
// у нас — за фикс 1.5М, без дисков). Замена — через тот же пикер слотов.
export async function openTutorRelearner() {
  if (getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  }
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];
  const modal = document.getElementById('tm-modal');
  if (!modal) return;

  document.getElementById('tm-pokemon-name').innerText =
    `${mon.nickname || mon.apiData.name} (Lv${mon.baseLevel + mon.candiesEaten}) — 🧑‍🏫 Учитель`;

  const currentList = document.getElementById('tm-current-list');
  currentList.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const row = document.createElement('div');
    row.className = 'tm-current-move';
    const nm = mon.apiData.moves[i]?.move?.name || '-';
    row.innerText = `${i + 1}. ${nm}`;
    currentList.appendChild(row);
  }

  const availableList = document.getElementById('tm-available-list');
  availableList.innerHTML = '<div class="tm-loading">Учитель смотрит, чему может научить...</div>';
  modal.style.display = 'flex';

  try {
    const knownNames = new Set(
      (mon.apiData.moves || []).filter(m => m).map(m => moveNameToSlug(m.move.name))
    );
    const species = mon.apiData?.species?.name || mon.apiData?.name || '';
    const ls = await fetchSiteLearnset(species).catch(() => null);
    const pool = (ls?.tutor || []).map(moveNameToSlug).filter(Boolean);
    const moveResults = (await Promise.all(
      pool.map((slug) => fetchSiteMoveDetail(slug).catch(() => null))
    )).filter(Boolean);
    const learnable = moveResults.filter(m => m && !knownNames.has(moveNameToSlug(m.name)));

    availableList.innerHTML = '';
    if (learnable.length === 0) {
      availableList.innerHTML = '<div class="tm-empty">Учитель: этому покемону учить нечему</div>';
    } else {
      learnable.forEach((moveData) => {
        const moveEl = document.createElement('div');
        moveEl.className = 'tm-move-cell';
        const powStr = moveData.power ?? '—';
        moveEl.innerText = `🧑‍🏫 ${moveData.name} (${powStr} | ${moveData.damage_class.name}) — ¥${TEACHER_PRICE.toLocaleString()}`;
        moveEl.addEventListener('click', () => {
          showSlotPicker(mon, moveData, 'tm', { teacherOnly: true });
        });
        availableList.appendChild(moveEl);
      });
    }
  } catch (e) {
    availableList.innerHTML = '<div class="tm-error">Ошибка загрузки обучения</div>';
  }
}
// Меняет и слоты apiData.moves, и PP. После — перерендер и сейв.
// ── swapMoveSlots: поменять две атаки местами (H5: порядок в сете) ──
// Меняет и слоты apiData.moves, и PP. После — перерендер и сейв.
export function swapMoveSlots(mon, a, b, rerender?) {
  if (a < 0 || a > 3 || b < 0 || b > 3) return;
  const moves = mon.apiData.moves;
  [moves[a], moves[b]] = [moves[b], moves[a]];
  if (!mon.movesPP) mon.movesPP = [];
  [mon.movesPP[a], mon.movesPP[b]] = [mon.movesPP[b], mon.movesPP[a]];
  if (rerender) rerender();
  autoSave();
}

// ── showSlotPicker: показать выбор слота для замены атаки ──
// Принимает:
//   mon — объект покемона
//   moveData — данные атаки из PokeAPI
//   payItemId — каким диском платим (по умолчанию legacy 'tm')
// Показывает 4 кнопки (по одной на слот) + "Отмена" + порядок (▲▼, H5).
// При выборе слота — выбор оплаты: TM-диск или Учитель за 1.5М (H3/H4).
// При выборе — заменяет атаку в слоте, тратит оплату, сохраняет.
export function showSlotPicker(mon, moveData, payItemId = 'tm', opts?: { teacherOnly?: boolean }) {
  const picker = document.getElementById('tm-slot-picker');
  picker.style.display = 'block';
  picker.innerHTML = '<h4>Выберите слот для замены:</h4>';

  // Создаём кнопки для 4 слотов
  for (let i = 0; i < 4; i++) {
    const btn = document.createElement('button');
    btn.className = 'tma-btn';
    btn.style.margin = '4px';
    // Показываем имя текущей атаки в слоте (или '-' если пусто)
    const currentName = (mon.apiData.moves[i]) ? mon.apiData.moves[i].move.name : '-';
    btn.innerText = `Слот ${i + 1}: ${currentName}`;
    // При клике — выбор оплаты (TM или учитель), затем замена
    btn.addEventListener('click', () => {
      pickPaymentAndTeach(mon, moveData, i, payItemId, opts);
    });
    picker.appendChild(btn);
  }

  // Кнопка "Отмена" — просто скрывает пикер
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'tma-btn';
  cancelBtn.style.margin = '4px';
  cancelBtn.style.backgroundColor = '#ff3b30';  // Красная кнопка
  cancelBtn.innerText = 'Отмена';
  cancelBtn.addEventListener('click', () => {
    picker.style.display = 'none';
  });
  picker.appendChild(cancelBtn);
}

// ── TEACHER_PRICE: фикс цены учителя атак (H4) ──
export const TEACHER_PRICE = 1500000;

// ── pickPaymentAndTeach: выбор оплаты (TM-диск или учитель) и обучение ──
// H3: забытые атаки возвращаются учителем ИЛИ диском. Учитель — 1.5М с баланса.
// teacherOnly (ветка учителя): сразу charge 1.5М без модалки выбора.
export function pickPaymentAndTeach(mon, moveData, i, payItemId = 'tm', opts?: { teacherOnly?: boolean }) {
  if (opts?.teacherOnly) {
    const balance = state.inventory?.credit || 0;
    if (balance < TEACHER_PRICE) {
      showToast(`Нужно ¥${TEACHER_PRICE.toLocaleString()}!`, true);
      return;
    }
    state.inventory.credit = balance - TEACHER_PRICE;
    teachMoveToSlot(mon, moveData, i);
    return;
  }
  const tmQty = getItemQty(payItemId);
  showSelectionModal(
    `Выучить ${moveData.name} в слот ${i + 1}: чем платим?`,
    [
      { label: `💿 TM-диск (${payItemId} ×${tmQty})`, subtitle: 'Тратит 1 диск' },
      { label: `🧑‍🏫 Учитель — ¥${TEACHER_PRICE.toLocaleString()}`, subtitle: 'С баланса, диск цел' },
    ],
    (choice: number) => {
      if (choice === 1) {
        // Учитель: проверяем баланс и списываем (деньги — state.inventory.credit)
        const balance = state.inventory?.credit || 0;
        if (balance < TEACHER_PRICE) {
          showToast(`Нужно ¥${TEACHER_PRICE.toLocaleString()}!`, true);
          return;
        }
        state.inventory.credit = balance - TEACHER_PRICE;
      } else {
        // Диск: проверяем наличие и тратим
        if (getItemQty(payItemId) <= 0) {
          showToast('Нет подходящего TM-диска!', true);
          return;
        }
        removeItem(payItemId);
      }
      teachMoveToSlot(mon, moveData, i);
    },
    true,
  );
}

// ── teachMoveToSlot: записать атаку в слот (после оплаты) ──
function teachMoveToSlot(mon, moveData, i) {
  // URL по слагу имени (у деталей с сайта нет числового id)
  const slug = moveNameToSlug(moveData.name);
  const moveUrl = `https://pokeapi.co/api/v2/move/${slug}/`;

  // Записываем новую атаку в слот
  if (!mon.apiData.moves[i]) {
    // Слот пуст — создаём новый объект
    mon.apiData.moves[i] = { move: { name: moveData.name, url: moveUrl } };
  } else {
    // Слот занят — заменяем имя и URL
    mon.apiData.moves[i].move.name = moveData.name;
    mon.apiData.moves[i].move.url = moveUrl;
  }

  // Устанавливаем PP для новой атаки
  if (!mon.movesPP) mon.movesPP = [];
  mon.movesPP[i] = { current: moveData.pp || 30, max: moveData.pp || 30 };

  // Обновляем UI
  updateInventoryDisplay();
  refreshProfileUI();

  // Закрываем пикер и модалку
  document.getElementById('tm-slot-picker').style.display = 'none';
  document.getElementById('tm-modal').style.display = 'none';

  // Сохраняем и показываем уведомление
  autoSave();
  showToast(`${mon.nickname || mon.apiData.name} выучил ${moveData.name}!`, false);
}
