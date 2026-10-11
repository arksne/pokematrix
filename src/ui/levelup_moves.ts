// ─────────────────────────────────────────────────────────────
// levelup_moves.ts — ИЗУЧЕНИЕ НОВЫХ АТАК ПРИ ПОВЫШЕНИИ УРОВНЯ
// ─────────────────────────────────────────────────────────────
// При повышении уровня покемона проверяет PokeAPI на наличие новых
// атак, которые покемон мог выучить между предыдущим и текущим
// уровнем. Пустой слот — учим сразу; все слоты заняты — атака падает
// в резерв БЕЗ модалки (L1: модалка блокировала бой и теряла атаки).
// Выучить из резерва можно в профиле покемона («Выучить»).
//
// ЗАВИСИМОСТИ:
//   api  — fetchPokeAPI (HTTP-клиент PokeAPI)
//   core — appendToLog (ленивый импорт для разрыва цикла)
//
// ИСПОЛЬЗУЕТСЯ В: battle/core.ts (при повышении уровня)
//
// ЭКСПОРТЫ:
//   checkNewMovesOnLevelUp(pokemon, newLevel) — проверяет новые атаки
//   offerLearnMove(pokemon, move)             — выучить или в резерв
//   reserveMove(pokemon, slug, url, detail?)  — чистая логика резерва
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
//   3. Для каждой — вызывает offerLearnMove (в слот или в резерв, без модалки)
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

    // ── 4. Каждую новую атаку — в слот или в резерв (без ожидания игрока) ──
    for (const move of newMoves) {
      const learned = await offerLearnMove(pokemon, move);
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

// ── reserveMove: положить атаку в резерв (чистая логика, для тестов) ──
// Возвращает true, если атака добавлена; false — уже была (дубль не кладём).
// detail опционален: в бою его подтягивает offerLearnMove с сайта лиги,
// в тестах передают напрямую (без сети).
export function reserveMove(pokemon: any, moveName: string, url: string, detail?: any): boolean {
  if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
  // Имя нормализуем сами: зовут и слагом, и сырым именем («Thunderbolt»).
  // Раньше сравнение шло слаг-к-сырому, и дубли в резерв пролезали.
  const slug = moveNameToSlug(moveName) || String(moveName || '');
  if (pokemon.learnableMoves.some((m: any) => moveNameToSlug(m.name) === slug)) {
    return false;
  }
  pokemon.learnableMoves.push({
    name: slug,
    url,
    power: detail?.power || 0,
    type: detail?.type?.name || 'normal',
  });
  return true;
}

// ── offerLearnMove: изучение новой атаки БЕЗ модалки (L1) ──
// Принимает:
//   pokemon — объект покемона
//   move — объект атаки { name, url }
//
// Возвращает Promise<boolean>:
//   true — атака выучена (был пустой слот)
//   false — упала в резерв
//
// Логика (решение хозяина 09.10: «чтоб уведомление не приходило, а сразу
// падало в резерв атак»):
//   - Есть пустой слот среди первых четырёх — учим туда сразу, без вопросов.
//   - Все слоты заняты — атака МОЛЧА падает в резерв (learnableMoves).
//     Никакой модалки: раньше она блокировала бой до клика, и пропущенные
//     атаки терялись. Выучить из резерва можно в профиле («Выучить»).
export async function offerLearnMove(pokemon, move) {
  const moveSlug = moveNameToSlug(move.name);
  const pretty = moveSlug.replace(/-/g, ' ');
  const monName = pokemon.nickname || pokemon.apiData.name;
  const url = move.url || `https://pokeapi.co/api/v2/move/${moveSlug}/`;

  // ── Авто-изучение если есть пустой слот ──
  // Ищем пустой слот только среди первых четырёх — бой читает лишь moves[0..3]
  const emptySlot = (pokemon.apiData.moves || []).slice(0, 4).findIndex(m => !m?.move);
  if (emptySlot >= 0) {
    if (!pokemon.apiData.moves[emptySlot]) {
      pokemon.apiData.moves[emptySlot] = { move: { name: moveSlug, url } };
    }
    appendToLogLazy(`${monName} выучил ${pretty}!`, false, 'system');
    return true;
  }

  // ── Все слоты заняты — сразу в резерв, без модалки ──
  let detail: any = null;
  try { detail = await fetchSiteMoveDetail(moveSlug); } catch { /* без деталей — тоже в резерв */ }
  reserveMove(pokemon, moveSlug, url, detail);
  appendToLogLazy(`${monName}: ${pretty} упал в резерв.`, false, 'system');
  return false;
}
