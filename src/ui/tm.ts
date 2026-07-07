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
import { showToast } from '../utils/dom.js';              // Всплывающие уведомления
import { fetchPokeAPI } from '../utils/api.js';            // HTTP-клиент для PokeAPI

// ── openMoveRelearner: открыть интерфейс повторного изучения атак ──
// Загружает все возможные атаки покемона из PokeAPI, фильтрует
// только атаки с силой (power > 0), исключает уже известные.
// Показывает список доступных атак с кнопками для замены.
export async function openMoveRelearner() {
  // Проверка: выбран ли покемон?
  if (getTeamState().currentPokemonIndex === null) {
    return showToast('Сначала выберите покемона во вкладке "Команда"!', true);
  }
  // Проверка: есть ли TM-диск в инвентаре?
  if (getItemQty('tm') <= 0) return showToast('У вас нет TM-совместимости!', true);

  // Получаем текущего покемона
  const mon = getTeamState().myTeam[getTeamState().currentPokemonIndex];
  // Находим DOM-модалку TM
  const modal = document.getElementById('tm-modal');
  if (!modal) return;

  // ── Отображение имени покемона и его уровня ──
  document.getElementById('tm-pokemon-name').innerText =
    `${mon.nickname || mon.apiData.name} (Lv${mon.baseLevel + mon.candiesEaten})`;

  // ── Отображение текущих атак (4 слота) ──
  const currentList = document.getElementById('tm-current-list');
  currentList.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const moveEl = document.createElement('div');
    moveEl.className = 'tm-current-move';
    if (mon.apiData.moves[i]) {
      // Атака есть — показываем имя и PP
      const ppDisplay = (mon.movesPP && mon.movesPP[i])
        ? `${mon.movesPP[i].current}/${mon.movesPP[i].max}`
        : '30/30';
      moveEl.innerText = `${i + 1}. ${mon.apiData.moves[i].move.name} (PP ${ppDisplay})`;
    } else {
      // Слот пуст
      moveEl.innerText = `${i + 1}. -`;
    }
    currentList.appendChild(moveEl);
  }

  // ── Загрузка доступных атак из PokeAPI ──
  const availableList = document.getElementById('tm-available-list');
  availableList.innerHTML = '<div class="tm-loading">Загрузка доступных атак...</div>';
  modal.style.display = 'flex';  // Показываем модалку (загрузка идёт, показываем "Загрузка...")

  try {
    // Загружаем все атаки покемона из PokeAPI
    const pokeData = await fetchPokeAPI(`pokemon/${mon.apiData.id}`);
    const allMoves = pokeData.moves || [];

    // Set уже известных атак (чтобы не показывать их)
    const knownNames = new Set(
      (mon.apiData.moves || []).filter(m => m).map(m => m.move.name)
    );

    // ── Загрузка деталей каждой атаки ──
    // Ограничиваем 50 атаками (чтобы не грузить слишком много)
    const movePromises = [];
    for (let i = 0; i < allMoves.length && i < 50; i++) {
      // Загружаем данные каждой атаки (урон, PP, тип, класс урона)
      movePromises.push(
        fetch(allMoves[i].move.url).then(r => r.json()).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);

    // Фильтруем: только атаки с силой И которые ещё не изучены
    // Фильтр m.power > 0 убирает статусные атаки и пустые результаты
    const learnable = moveResults.filter(m => m && m.power && !knownNames.has(m.name));

    // ── Отображение доступных атак ──
    availableList.innerHTML = '';
    if (learnable.length === 0) {
      availableList.innerHTML = '<div class="tm-empty">Нет новых атак для изучения</div>';
    } else {
      learnable.forEach((moveData) => {
        const moveEl = document.createElement('div');
        moveEl.className = 'tm-move-cell';
        // Показываем: имя (сила | тип урона)
        moveEl.innerText = `${moveData.name} (${moveData.power} | ${moveData.damage_class.name})`;
        // При клике — открываем выбор слота для замены
        moveEl.addEventListener('click', () => {
          showSlotPicker(mon, moveData);
        });
        availableList.appendChild(moveEl);
      });
    }
  } catch (e) {
    // Ошибка загрузки PokeAPI
    availableList.innerHTML = '<div class="tm-error">Ошибка загрузки атак</div>';
  }
}

// ── showSlotPicker: показать выбор слота для замены атаки ──
// Принимает:
//   mon — объект покемона
//   moveData — данные атаки из PokeAPI
// Показывает 4 кнопки (по одной на слот) + "Отмена"
// При выборе — заменяет атаку в слоте, тратит TM, сохраняет
export function showSlotPicker(mon, moveData) {
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

    // При клике — заменяем атаку
    btn.addEventListener('click', () => {
      // Формируем URL атаки в PokeAPI (по ID)
      const moveUrl = `https://pokeapi.co/api/v2/move/${moveData.id}/`;

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

      // Тратим TM-диск
      removeItem('tm');

      // Обновляем UI
      updateInventoryDisplay();  // Обновляем инвентарь (количество TM уменьшилось)
      refreshProfileUI();         // Обновляем профиль покемона

      // Закрываем пикер и модалку
      document.getElementById('tm-slot-picker').style.display = 'none';
      document.getElementById('tm-modal').style.display = 'none';

      // Сохраняем и показываем уведомление
      autoSave();
      showToast(`${mon.nickname || mon.apiData.name} выучил ${moveData.name}!`, false);
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
