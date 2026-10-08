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

import { fetchPokeAPI } from '../utils/api.js';  // HTTP-клиент для PokeAPI (fallback)
import { fetchSiteLearnset, moveNameToSlug } from '../data/learnset.js';
import type { SiteLearnset } from '../data/learnset.js';
import { fetchSiteMoveDetail } from '../data/sitemove.js';  // детали атак — с сайта лиги

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
// ── siteLevelMoves: атаки сайта лиги, открывающиеся между уровнями ──
// Чистая функция (для тестов): levelup в порядке таблицы сайта.
export function siteLevelMoves(ls: any, prevLevel: number, newLevel: number, knownSlugs: Set<string>): Array<{ name: string; url: string }> {
  const out: Array<{ name: string; url: string }> = [];
  for (const [lvl, name] of (ls?.levelup || [])) {
    if (lvl > prevLevel && lvl <= newLevel) {
      const slug = moveNameToSlug(name);
      if (slug && !knownSlugs.has(slug)) {
        knownSlugs.add(slug);
        out.push({ name: slug, url: `https://pokeapi.co/api/v2/move/${slug}/` });
      }
    }
  }
  return out;
}

//
// Алгоритм:
//   1. Загружает атаки вида с сайта лиги (/api/learnset)
//   2. Находит атаки, изучаемые между prevCheckLevel и newLevel
//   3. Для каждой — вызывает offerLearnMove (модалка замены/резерва)
//   4. Обновляет lastMoveCheckLevel до newLevel
//   Fallback без сайта — старый фильтр PokeAPI version_group_details.
export async function checkNewMovesOnLevelUp(pokemon, newLevel) {
  try {
    // ── Set уже известных атак (слаг-нормализованный, первые 4 слота) ──
    const knownNames = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const nm = pokemon.apiData.moves[i]?.move?.name;
      if (nm) knownNames.add(moveNameToSlug(nm));
    }

    const prevCheckLevel = pokemon.lastMoveCheckLevel || 1;
    let newMoves: Array<{ name: string; url: string }> = [];

    // ── 1. Источник — сайт лиги ──
    const species = pokemon.apiData?.species?.name || pokemon.apiData?.name || '';
    let siteOk = false;
    try {
      const ls = await fetchSiteLearnset(species);
      if (ls) {
        newMoves = siteLevelMoves(ls, prevCheckLevel, newLevel, knownNames);
        siteOk = true;
      }
    } catch { /* ниже fallback */ }

    if (!siteOk) {
      // ── 1b. Fallback: все атаки покемона из PokeAPI ──
      const pokeData = await fetchPokeAPI(`pokemon/${pokemon.apiData.id}`);
      for (const entry of (pokeData.moves || [])) {
        for (const detail of (entry.version_group_details || [])) {
          if (detail.move_learn_method.name === 'level-up' &&
              detail.level_learned_at > prevCheckLevel &&
              detail.level_learned_at <= newLevel) {
            const slug = moveNameToSlug(entry.move.name);
            if (!knownNames.has(slug)) {
              knownNames.add(slug);
              newMoves.push({ name: slug, url: entry.move.url });
            }
            break;
          }
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

        // ── Инициализация PP для выученной атаки (данные с сайта лиги) ──
        try {
          const moveData = await fetchSiteMoveDetail(move);
          // Находим слот, в который поместили атаку (сравнение по слагу —
          // в старых сейвах имена могут быть в Title Case)
          const slot = pokemon.apiData.moves.findIndex(m => m && moveNameToSlug(m.move.name) === move.name);
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
    const moveSlug = moveNameToSlug(move.name);
    const pretty = moveSlug.replace(/-/g, ' ');
    const monName = pokemon.nickname || pokemon.apiData.name;
    const url = move.url || `https://pokeapi.co/api/v2/move/${moveSlug}/`;
    // Детали с сайта (PP/сила/тип для замены и резерва), лениво, с кэшем.
    const detailOf = async () => {
      try { return await fetchSiteMoveDetail(moveSlug); } catch { return null; }
    };

    // ── Авто-изучение если есть пустой слот ──
    // Ищем пустой слот только среди первых четырёх — бой читает лишь moves[0..3]
    const emptySlot = (pokemon.apiData.moves || []).slice(0, 4).findIndex(m => !m?.move);
    if (emptySlot >= 0) {
      if (!pokemon.apiData.moves[emptySlot]) {
        pokemon.apiData.moves[emptySlot] = { move: { name: moveSlug, url } };
      }
      appendToLogLazy(`${monName} выучил ${pretty}!`, false, 'system');
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
        <h3>${monName} хочет выучить ${pretty}</h3>
        <p style="font-size:0.85rem;color:var(--tma-hint);margin:4px 0 12px;">Выберите слот для замены:</p>
        <div class="selection-items">
          ${slotsHTML}
          <button class="selection-item-btn reserve-btn" style="border-color:var(--tma-link);">
            📥 В резерв (не учить сейчас)
          </button>
        </div>
        <button class="confirm-btn confirm-btn-no" id="learn-skip" style="width:100%;margin-top:8px;">В резерв (потом)</button>
      </div>
    `;
    document.body.appendChild(modal);

    // ── cleanup: удаление модалки из DOM ──
    const cleanup = () => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    };

    // ── Обработчик: замена слота ──
modal.querySelectorAll('.replace-slot').forEach(btn => {
        btn.addEventListener('click', async () => {
          const slot = parseInt(btn.getAttribute('data-slot')!);
          // Имя старой атаки читаем безопасно. Раньше здесь стояло
          // `pokemon.apiData.moves[slot].move.name`, что падало с TypeError на
          // пустом слоте — то есть на слот 4, если атак было три. Клик ничего
          // не делал, и выглядело это как «слот 4 не работает».
          const oldName = pokemon.apiData.moves[slot]?.move?.name || '(пусто)';
          if (!pokemon.apiData.moves[slot]) pokemon.apiData.moves[slot] = {};
          // Заменяем атаку — PP под новую берём с сайта лиги (раньше всегда 30,
          // т.к. у {name,url} нет pp).
          const d = await detailOf();
          const pp = d?.pp || 30;
          pokemon.apiData.moves[slot].move = { name: moveSlug, url };
          if (!pokemon.movesPP) pokemon.movesPP = [];
          pokemon.movesPP[slot] = { current: pp, max: pp };
          appendToLogLazy(
            `${monName}: ${pretty} заменил${oldName === '(пусто)' ? '' : `ла ${oldName}`} в слоте ${slot + 1}!`,
            false, 'system'
          );
          cleanup();
        resolve(true);  // Атака выучена
      });
    });

    // ── Обработчик: в резерв ──
    modal.querySelector('.reserve-btn')!.addEventListener('click', async () => {
      if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
      // Проверяем, нет ли уже такой атаки в резерве (по слагу)
      if (!pokemon.learnableMoves.some(m => moveNameToSlug(m.name) === moveSlug)) {
        const d = await detailOf();
        pokemon.learnableMoves.push({
          name: moveSlug,
          url,
          power: d?.power || 0,
          type: d?.type?.name || 'normal',
        });
      }
      appendToLogLazy(
        `${monName}: ${pretty} упал в резерв (все слоты заняты).`,
        false, 'system'
      );
      cleanup();
      resolve(false);  // Атака не выучена, но сохранена
    });

    // ── Обработчик: пропустить (L1: пропущенная падает в резерв, не теряется) ──
    const sendToReserve = async () => {
      if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
      if (!pokemon.learnableMoves.some(m => moveNameToSlug(m.name) === moveSlug)) {
        const d = await detailOf();
        pokemon.learnableMoves.push({
          name: moveSlug,
          url,
          power: d?.power || 0,
          type: d?.type?.name || 'normal',
        });
      }
    };
    modal.querySelector('#learn-skip')!.addEventListener('click', async () => {
      await sendToReserve();
      appendToLogLazy(`${monName}: пропустил изучение ${pretty} — упало в резерв.`, false, 'system');
      cleanup();
      resolve(false);  // Атака не выучена, но сохранена
    });

    // ── Обработчик: клик по затемнённому фону = пропустить (тоже в резерв) ──
    modal.addEventListener('click', async (e) => {
      if (e.target === modal) {
        await sendToReserve();
        appendToLogLazy(`${monName}: пропустил изучение ${pretty} — упало в резерв.`, false, 'system');
        cleanup();
        resolve(false);
      }
    });
  });
}
