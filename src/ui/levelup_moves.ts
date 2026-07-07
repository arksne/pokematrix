// ─────────────────────────────────────────────────────────────
// levelup_moves.ts — ИЗУЧЕНИЕ НОВЫХ АТАК ПРИ ПОВЫШЕНИИ УРОВНЯ
// ─────────────────────────────────────────────────────────────
// При повышении уровня покемона проверяет PokeAPI на наличие новых
// атак, которые покемон мог выучить между предыдущим и текущим
// уровнем. Если все 4 слота заняты, показывает модальное окно
// для замены существующей атаки или откладывания в резерв.
//
// ЗАВИСИМОСТИ:
//   api  — fetchPokeAPI (HTTP-клиент PokeAPI)
//   core — appendToLog (ленивый импорт для разрыва цикла)
//
// ИСПОЛЬЗУЕТСЯ В: battle/core.ts (при повышении уровня)
//
// ЭКСПОРТЫ:
//   checkNewMovesOnLevelUp(pokemon, newLevel) — проверяет новые атаки
//   offerLearnMove(pokemon, move)             — модалка выбора слота
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { fetchPokeAPI } from '../utils/api.js';  // HTTP-клиент для PokeAPI

// ── ЛЕНИВЫЙ ИМПОРТ (циклическая зависимость core.ts ↔ levelup_moves.ts) ──
// core.ts вызывает checkNewMovesOnLevelUp при повышении уровня
// Если levelup_moves.ts импортирует core.ts напрямую — цикл!
let _appendToLog: any = null;
async function appendToLogLazy(...args: any[]) {
  if (!_appendToLog) {
    _appendToLog = (await import('../battle/core.js')).appendToLog;
  }
  return _appendToLog(...args);
}

// ── checkNewMovesOnLevelUp: сканирование и предложение новых атак ──
// Принимает:
//   pokemon — объект покемона
//   newLevel — новый уровень (после повышения)
//
// Алгоритм:
//   1. Загружает все атаки покемона из PokeAPI
//   2. Находит атаки, изучаемые между prevCheckLevel и newLevel
//   3. Для каждой — вызывает offerLearnMove (модалка замены/резерва)
//   4. Обновляет lastMoveCheckLevel до newLevel
export async function checkNewMovesOnLevelUp(pokemon, newLevel) {
  try {
    // ── 1. Загружаем все атаки покемона из PokeAPI ──
    const pokeData = await fetchPokeAPI(`pokemon/${pokemon.apiData.id}`);
    const allMoves = pokeData.moves || [];

    // ── 2. Set уже известных атак ──
    // Смотрим только первые 4 слота (текущий moveset)
    const knownNames = new Set();
    for (let i = 0; i < 4; i++) {
      if (pokemon.apiData.moves[i]?.move?.name) {
        knownNames.add(pokemon.apiData.moves[i].move.name);
      }
    }

    // ── 3. Поиск новых атак между уровнями ──
    // lastMoveCheckLevel — уровень, на котором мы последний раз проверяли
    // (хранится в покемоне, сохраняется при save/load)
    const prevCheckLevel = pokemon.lastMoveCheckLevel || 1;
    const newMoves = [];

    // Проходим по всем атакам в PokeAPI
    for (const entry of allMoves) {
      for (const detail of entry.version_group_details) {
        // Ищем атаки типа 'level-up' между prevCheckLevel и newLevel
        if (detail.move_learn_method.name === 'level-up' &&
            detail.level_learned_at > prevCheckLevel &&
            detail.level_learned_at <= newLevel) {
          // Если атака ещё не изучена — добавляем в список
          if (!knownNames.has(entry.move.name)) {
            newMoves.push(entry.move);
          }
          break;  // Выходим из inner цикла (достаточно одной записи)
        }
      }
    }

    // Обновляем уровень последней проверки
    pokemon.lastMoveCheckLevel = newLevel;

    // ── 4. Предлагаем каждую новую атаку игроку ──
    for (const move of newMoves) {
      const learned = await offerLearnMove(pokemon, move);  // Ждём выбора игрока
      if (learned) {
        knownNames.add(move.name);

        // ── Инициализация PP для выученной атаки ──
        try {
          const moveRes = await fetch(move.url);  // Загружаем данные атаки
          const moveData = await moveRes.json();
          // Находим слот, в который поместили атаку
          const slot = pokemon.apiData.moves.findIndex(m => m && m.move.name === move.name);
          if (slot >= 0 && moveData.pp) {
            if (!pokemon.movesPP) pokemon.movesPP = [];
            if (!pokemon.movesPP[slot]) pokemon.movesPP[slot] = {};
            pokemon.movesPP[slot] = { current: moveData.pp || 30, max: moveData.pp || 30 };
          }
        } catch (e) { console.warn('Failed to init PP for move', move.name, e); }
      }
    }
  } catch (e) {
    console.warn('Failed to check new moves for', pokemon.apiData.name, e);
  }
}

// ── offerLearnMove: модалка замены атаки или сохранения в резерв ──
// Принимает:
//   pokemon — объект покемона
//   move — объект атаки { name, url }
//
// Возвращает Promise<boolean>:
//   true — атака выучена (заменила слот)
//   false — отложена в резерв или пропущена
//
// Логика:
//   - Если есть пустой слот — автоматически изучаем атаку
//   - Если все слоты заняты — показываем модалку:
//     1. Выбор слота для замены
//     2. "В резерв" — сохранить в learnableMoves
//     3. "Пропустить" — не учить
export function offerLearnMove(pokemon, move) {
  return new Promise((resolve) => {
    const moveName = move.name;
    const monName = pokemon.nickname || pokemon.apiData.name;
    const url = move.url || `https://pokeapi.co/api/v2/move/${moveName}/`;

    // ── Авто-изучение если есть пустой слот ──
    const emptySlot = (pokemon.apiData.moves || []).findIndex(m => !m);
    if (emptySlot >= 0) {
      if (!pokemon.apiData.moves[emptySlot]) {
        pokemon.apiData.moves[emptySlot] = { move: { name: moveName, url } };
      }
      appendToLogLazy(`${monName} выучил ${moveName}!`, false, 'system');
      resolve(true);
      return;
    }

    // ── Все слоты заняты — показываем модалку ──
    // Создаём DOM-модалку с выбором
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';

    // HTML для 4 слотов (кнопки замены)
    let slotsHTML = '';
    for (let i = 0; i < 4; i++) {
      const currentName = pokemon.apiData.moves[i]?.move?.name || '-';
      slotsHTML += `<button class="selection-item-btn replace-slot" data-slot="${i}">
        Слот ${i + 1}: ${currentName}
      </button>`;
    }

    // Полная HTML модалки: заголовок + 4 кнопки слотов + резерв + пропустить
    modal.innerHTML = `
      <div class="selection-modal-card">
        <h3>${monName} хочет выучить ${moveName}</h3>
        <p style="font-size:0.85rem;color:var(--tma-hint);margin:4px 0 12px;">Выберите слот для замены:</p>
        <div class="selection-items">
          ${slotsHTML}
          <button class="selection-item-btn reserve-btn" style="border-color:var(--tma-link);">
            📥 В резерв (не учить сейчас)
          </button>
        </div>
        <button class="confirm-btn confirm-btn-no" id="learn-skip" style="width:100%;margin-top:8px;">Пропустить</button>
      </div>
    `;
    document.body.appendChild(modal);

    // ── cleanup: удаление модалки из DOM ──
    const cleanup = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    // ── Обработчик: замена слота ──
    modal.querySelectorAll('.replace-slot').forEach(btn => {
      btn.addEventListener('click', () => {
        const slot = parseInt(btn.getAttribute('data-slot')!);
        const oldName = pokemon.apiData.moves[slot].move.name;
        // Заменяем атаку в слоте
        pokemon.apiData.moves[slot].move = { name: moveName, url };
        appendToLogLazy(
          `${monName}: ${moveName} заменил ${oldName} в слоте ${slot + 1}!`,
          false, 'system'
        );
        cleanup();
        resolve(true);  // Атака выучена
      });
    });

    // ── Обработчик: в резерв ──
    modal.querySelector('.reserve-btn')!.addEventListener('click', () => {
      if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
      // Проверяем, нет ли уже такой атаки в резерве
      if (!pokemon.learnableMoves.some(m => m.name === moveName)) {
        pokemon.learnableMoves.push({
          name: moveName,
          url,
          power: move.power || 0,
          type: move.type?.name || 'normal'
        });
      }
      appendToLogLazy(
        `${monName}: ${moveName} упал в резерв (все слоты заняты).`,
        false, 'system'
      );
      cleanup();
      resolve(false);  // Атака не выучена, но сохранена
    });

    // ── Обработчик: пропустить ──
    modal.querySelector('#learn-skip')!.addEventListener('click', () => {
      appendToLogLazy(`${monName}: пропустил изучение ${moveName}.`, false, 'system');
      cleanup();
      resolve(false);  // Атака проигнорирована
    });

    // ── Обработчик: клик по затемнённому фону = пропустить ──
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        appendToLogLazy(`${monName}: пропустил изучение ${moveName}.`, false, 'system');
        cleanup();
        resolve(false);
      }
    });
  });
}
