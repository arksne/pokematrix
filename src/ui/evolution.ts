// ─────────────────────────────────────────────────────────────
// evolution.ts — ЭВОЛЮЦИЯ ПОКЕМОНОВ
// ─────────────────────────────────────────────────────────────
// Управляет эволюцией покемонов: загружает цепочки эволюций из PokeAPI,
// проверяет условия (уровень, камень эволюции) и запускает анимацию
// трансформации с визуальными эффектами и обновлением характеристик.
//
// ЗАВИСИМОСТИ:
//   state.js     — getPowerStars (расчёт звёзд силы покемона)
//   sprite.js    — getTypeGradient, getSpriteUrl (спрайты, градиенты фона)
//   api.js       — fetchPokeAPI (HTTP-клиент к PokeAPI с кэшированием)
//   stones.js    — STONE_ITEM_MAP (маппинг ID предмета камня → имя в PokeAPI)
//   core.js      — evolutionCache, evolvesFromMap (ленивый импорт)
//
// ИСПОЛЬЗУЕТСЯ В:
//   core.ts     — при повышении уровня в бою
//   profile.ts  — кнопка эволюции через камень
//   pokedex.ts  — отображение цепочек эволюции
//   inventory.ts — при использовании камня
//
// КЛЮЧЕВЫЕ ЭКСПОРТЫ:
//   fetchEvolutionChain(name)   — загружает цепочку эволюций
//   getEvolutions(name)          — возвращает массив эволюций с условиями
//   checkEvolution(pokemon, ...) — проверяет, может ли покемон эволюционировать
//   triggerEvolution(pokemon, targetName) — запускает анимацию эволюции
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { getPowerStars } from '../utils/state.js';     // Звёзды мощи (на основе BST)
import { getTypeGradient, getSpriteUrl } from '../utils/sprite.js';  // Градиент типов и URL спрайта
import { fetchPokeAPI } from '../utils/api.js';          // HTTP-клиент для PokeAPI с кэшированием
// STONE_ITEM_MAP — маппинг: ID предмета камня (из items.ts) → имя в PokeAPI
// Например: 'fireStone' → 'fire-stone'
import { showToast } from '../utils/dom.js';
import { STONE_ITEM_MAP } from '../data/stones.js';
import { evolutionLevelFor } from '../data/power.js';   // канонные уровни эволюции лиги
import { state } from '../game/state.js';
import { calculateStat } from '../battle/stats.js';

// ── ЛЕНИВЫЙ ИМПОРТ (циклическая зависимость core.ts ↔ evolution.ts) ──
// core.ts импортирует evolution.ts (checkEvolution, triggerEvolution)
// Если evolution.ts импортирует core.ts напрямую — цикл!
// Решение: динамический import() для получения эволюционного кэша
let _evolutionCache: Record<string, any> | null = null;
let _evolvesFromMap: Record<string, any> | null = null;

// getEvolutionData — лениво загружает core.ts и извлекает evolutionCache и evolvesFromMap
async function getEvolutionData() {
  if (!_evolutionCache) {
    const m = await import('../battle/core.js');
    _evolutionCache = m.evolutionCache;        // Кэш: { speciesName: [{species, evolution_details}] }
    _evolvesFromMap = m.evolvesFromMap;        // Обратная карта: { childName: [parentName, ...] }
  }
  return { evolutionCache: _evolutionCache, evolvesFromMap: _evolvesFromMap };
}

// ── SPECIES_NAME_MAP: маппинг форм → базовый вид ─────────
// Некоторые покемоны имеют множество форм (Mimikyu, Toxtricity, Morpeko и т.д.)
// Эти формы не существуют в PokeAPI как pokemon-species (только как pokemon)
// Этот словарь нормализует их к базовому виду, чтобы запрос pokemon-species/{name} не вернул 404
const SPECIES_NAME_MAP: Record<string, string> = {
  'wishiwashi-solo': 'wishiwashi',
  'minior-red-meteor': 'minior',
  'minior-orange': 'minior',
  'minior-yellow': 'minior',
  'minior-green': 'minior',
  'minior-blue': 'minior',
  'minior-indigo': 'minior',
  'minior-violet': 'minior',
  'mimikyu-disguised': 'mimikyu',
  'mimikyu-busted': 'mimikyu',
  'toxtricity-amped': 'toxtricity',
  'toxtricity-low-key': 'toxtricity',
  'morpeko-full-belly': 'morpeko',
  'morpeko-hangry': 'morpeko',
  'urshifu-single-strike': 'urshifu',
  'urshifu-rapid-strike': 'urshifu',
  'maushold-family-of-four': 'maushold',
  'maushold-family-of-three': 'maushold',
  'squawkabilly-green-plumage': 'squawkabilly',
  'squawkabilly-blue-plumage': 'squawkabilly',
  'squawkabilly-yellow-plumage': 'squawkabilly',
  'squawkabilly-white-plumage': 'squawkabilly',
  'palafin-zero': 'palafin',
  'palafin-hero': 'palafin',
  'tatsugiri-curly': 'tatsugiri',
  'tatsugiri-droopy': 'tatsugiri',
  'tatsugiri-stretchy': 'tatsugiri',
  'dudunsparce-two-segment': 'dudunsparce',
  'dudunsparce-three-segment': 'dudunsparce',
};  // 28 записей — формы которые маппятся на базовый вид

// ── fetchEvolutionChain: загрузка цепочки эволюций из PokeAPI ──
// Принимает pokemonName — имя вида (например, 'charmander')
// Асинхронно:
//   1. Запрашивает pokemon-species/{name} → получает URL evolution_chain
//   2. Запрашивает эволюционную цепочку
//   3. Обходит дерево эволюций (BFS)
//   4. Заполняет evolutionCache (вперёд) и evolvesFromMap (назад)
//   5. Использует SPECIES_NAME_MAP для форм
//   6. Fallback: обрезает всё после первого дефиса (например, 'pikachu-gmax' → 'pikachu')
// Возвращает массив evolves_to для запрошенного покемона
export async function fetchEvolutionChain(pokemonName) {
  const { evolutionCache, evolvesFromMap } = await getEvolutionData();

  // Внутренняя функция: загрузка и обход цепочки
  async function trySpecies(name) {
    // Шаг 1: получаем данные вида (содержит URL цепочки эволюций)
    const speciesData = await fetchPokeAPI(`pokemon-species/${name}`);
    // Шаг 2: загружаем цепочку эволюций
    const chainData = await fetchPokeAPI(speciesData.evolution_chain.url);
    let chain = chainData.chain;  // Корневой узел цепочки (базовая форма)

    // Шаг 3: BFS-обход дерева эволюций
    // chain = { species: {name}, evolves_to: [{ species: {...}, evolves_to: [...] }] }
    const queue = [chain];
    while (queue.length > 0) {
      const node = queue.shift();       // Берём узел из очереди
      const curName = node.species.name; // Имя покемона в этом узле
      // Кэшируем: для curName → его evolves_to (следующие эволюции)
      if (!evolutionCache[curName]) evolutionCache[curName] = node.evolves_to;

      // Для каждого ребёнка: добавляем обратную связь (кто в кого эволюционирует)
      for (const child of node.evolves_to) {
        const childName = child.species.name;
        // evolvesFromMap — обратная карта: ребёнок → [родители]
        if (!evolvesFromMap[childName]) evolvesFromMap[childName] = [];
        if (!evolvesFromMap[childName].includes(curName)) {
          evolvesFromMap[childName].push(curName);  // Например: 'charizard' ← ['charmeleon']
        }
        queue.push(child);  // Добавляем ребёнка в очередь для дальнейшего обхода
      }
    }

    // Возвращаем evolves_to для исходного покемона
    return evolutionCache[pokemonName] || [];
  }

  // ── Использование SPECIES_NAME_MAP для избежания 404 ──
  const speciesName = SPECIES_NAME_MAP[pokemonName] || pokemonName;

  try {
    const result = await trySpecies(speciesName);
    // Если использовали маппинг — копируем кэш для оригинального имени
    if (speciesName !== pokemonName) {
      evolutionCache[pokemonName] = evolutionCache[speciesName] || [];
    }
    return result;
  } catch (e) {
    // ── Fallback: обрезаем всё после первого дефиса ──
    // Например: 'pikachu-gmax' → 'pikachu'
    if (pokemonName.includes('-') && speciesName === pokemonName) {
      const baseName = pokemonName.split('-')[0];
      if (baseName !== pokemonName) {
        try {
          const result = await trySpecies(baseName);
          evolutionCache[pokemonName] = evolutionCache[baseName] || [];
          return result;
        } catch (_) {}
      }
    }
    console.warn('Evolution fetch failed for', pokemonName, e);
    evolutionCache[pokemonName] = [];  // Пустой массив = нет эволюций
    return [];
  }
}

// ── getEvolutions: получение списка возможных эволюций ──
// Принимает pokemonName — имя вида
// Возвращает массив: [{ name, minLevel, trigger, item }, ...]
// Сначала проверяет кэш, если нет — загружает цепочку
// Каждая эволюция содержит:
//   name — имя следующей формы
//   minLevel — минимальный уровень (null если не по уровню)
//   trigger — триггер ('level-up', 'use-item', 'trade', 'shed' и т.д.)
//   item — предмет для 'use-item' (например, 'fire-stone')
export async function getEvolutions(pokemonName) {
  const { evolutionCache, evolvesFromMap } = await getEvolutionData();

  // Если данные уже в кэше — используем их
  if (evolutionCache[pokemonName] !== undefined) {
    // Проверяем, заполнена ли обратная карта (если нет — догружаем)
    if (evolvesFromMap[pokemonName] === undefined) {
      await fetchEvolutionChain(pokemonName);
    }
    // Преобразуем из формата PokeAPI в упрощённый
    return evolutionCache[pokemonName].map(mapEvoEntry);
  }

  // Если нет в кэше — загружаем цепочку
  const chain = await fetchEvolutionChain(pokemonName);
  // Преобразуем так же как выше
  return chain.map(mapEvoEntry);
}

/**
 * mapEvoEntry — PokeAPI-запись цепочки → наша структура.
 * ВАЖНО: берём ВСЕ evolution_details (по версиям игр), а не только [0]:
 * иначе каменные пути новых поколений (leaf-stone у лифеона и т.п.)
 * невидимы. Плоские поля оставлены для совместимости (покедекс).
 */
function mapEvoEntry(evo: any) {
  const all = Array.isArray(evo.evolution_details) && evo.evolution_details.length > 0
    ? evo.evolution_details
    : [{}];
  const d0 = all[0];
  return {
    name: evo.species.name,
    minLevel: d0.min_level ?? null,
    trigger: d0.trigger ? d0.trigger.name : null,
    item: d0.item ? d0.item.name : null,
    held: d0.held_item ? d0.held_item.name : null,
    details: all.map((d: any) => ({
      trigger: d.trigger ? d.trigger.name : null,
      minLevel: d.min_level ?? null,
      item: d.item ? d.item.name : null,
      held: d.held_item ? d.held_item.name : null,
      gender: d.gender ?? null,                       // 1 = самка, 2 = самец
      time: d.time_of_day || null,                    // day / night / dusk
      location: d.location ? d.location.name : null,  // moss-rock / icy-rock / ...
      knownMove: d.known_move ? d.known_move.name : null,
      knownMoveType: d.known_move_type ? d.known_move_type.name : null,
      minHappiness: d.min_happiness ?? null,
      minAffection: d.min_affection ?? null,
      minBeauty: d.min_beauty ?? null,
      rain: !!d.needs_overworld_rain,
      partySpecies: d.party_species ? d.party_species.name : null,
      partyType: d.party_type ? d.party_type.name : null,
      tradeSpecies: d.trade_species ? d.trade_species.name : null,
      relStats: d.relative_physical_stats ?? null,    // 1 / 0 / -1 (тайрог)
      upsideDown: !!d.turn_upside_down,
    })),
  };
}

// ── Локации нашей карты для эволюций по месту ──
const EVO_LOCATION_SETS: Array<{ keys: string[]; locs: string[] }> = [
  // Мшистый камень (лифеон): наши леса
  { keys: ['moss', 'forest', 'woods', 'jungle'], locs: ['viridianForest', 'berryForest', 'ilexForest'] },
  // Ледяной камень (гласеон, крабоминбл): наши льды
  { keys: ['ice', 'frost', 'snow', 'glacier', 'glaseado', 'lanakila', 'route-217', 'route-17'], locs: ['seafoamIslands', 'icefallCave', 'icePath'] },
  // Магнитное поле (магнетон, про StreamPass, викавольт): электростанция
  { keys: ['magnet', 'coronet', 'power', 'poni-canyon', 'route-13'], locs: ['powerPlant'] },
];

/** evoLocationMet — место PokeAPI покрывается нашей текущей локацией. */
export function evoLocationMet(locName: string | null, curLoc: string): boolean {
  if (!locName) return true;
  const low = String(locName).toLowerCase();
  const set = EVO_LOCATION_SETS.find((s) => s.keys.some((k) => low.includes(k)));
  if (!set) return false; // неизвестное место — честно не пускаем
  return set.locs.includes(curLoc);
}

export interface EvoCheckCtx {
  isDaytime: boolean;
  locationId: string;
  knownMoves: string[];
  teamSpecies: string[];
  teamTypes: string[];
}

/** buildEvoCtx — контекст проверки из покемона и глобального стейта. */
export function buildEvoCtx(mon: any): EvoCheckCtx {
  const known: string[] = [];
  const mv = mon?.apiData?.moves || [];
  for (let i = 0; i < Math.min(4, mv.length); i++) {
    const n = mv[i]?.move?.name;
    if (n) known.push(String(n).toLowerCase());
  }
  const team = state.myTeam || [];
  return {
    isDaytime: state.isDaytime !== false,
    locationId: state.currentLocationId || '',
    knownMoves: known,
    teamSpecies: team.map((m: any) => String(m?.apiData?.name || '').toLowerCase()),
    teamTypes: team.flatMap((m: any) => (m?.apiData?.types || []).map((t: any) => String(t?.type?.name || '').toLowerCase())),
  };
}

/**
 * levelDetailMet — чистая проверка одной детали level-up эволюции.
 * Упрощения (задокументированы, не баги):
 *   rain → считаем выполненным (погода боя к моменту эвы сброшена);
 *   affection → счастье ≥ 220 (трекер привязанности отсутствует);
 *   known_move_type → пропускаем (типы 4 атак тянуть из сети дорого);
 *   dusk/full-moon → ночь.
 * Жёсткие нет: красота, сопартийцы вне команды, переворот.
 */
export function levelDetailMet(
  d: any, mon: any, ctx: EvoCheckCtx, effLevel: number, canonLevel?: number | null,
): boolean {
  if (!d || d.trigger !== 'level-up') return false;
  // Канонный уровень лиги — приоритетнее min_level из PokeAPI (в т.ч. null).
  const required = canonLevel != null ? canonLevel : d.minLevel;
  if (required != null && effLevel < required) return false;
  // Пол (галлейд — только самец, фросласс — только самка)
  if (d.gender === 1 && mon?.gender !== 'female') return false;
  if (d.gender === 2 && mon?.gender !== 'male') return false;
  // Время суток
  if (d.time === 'day' && !ctx.isDaytime) return false;
  if ((d.time === 'night' || d.time === 'dusk' || d.time === 'full-moon') && ctx.isDaytime) return false;
  // Счастье / привязанность
  const happy = mon?.happiness ?? 70;
  if (d.minHappiness != null && happy < d.minHappiness) return false;
  if (d.minAffection != null && happy < 220) return false;
  // Красота (фиби) — системы нет; у фиби есть трейд-путь через чешую
  if (d.minBeauty != null) return false;
  // Место
  if (!evoLocationMet(d.location, ctx.locationId)) return false;
  // Выученная атака (майм-младший — мимик, пилосвайн — древняя сила...)
  if (d.knownMove && !ctx.knownMoves.includes(String(d.knownMove).toLowerCase())) return false;
  // Сопартийцы (ментайк, панчам)
  if (d.partySpecies && !ctx.teamSpecies.includes(String(d.partySpecies).toLowerCase())) return false;
  if (d.partyType && !ctx.teamTypes.includes(String(d.partyType).toLowerCase())) return false;
  // Тайрог: сравнение атаки и защиты на текущем уровне
  // (calculateStat ждёт ПОЛНЫЕ имена: 'attack'/'defense', короткие дают мусор)
  if (d.relStats === 1 || d.relStats === -1 || d.relStats === 0) {
    const atk = calculateStat(mon, 'attack', { ignoreBattleOnly: true });
    const def = calculateStat(mon, 'defense', { ignoreBattleOnly: true });
    const cmp = atk > def ? 1 : atk < def ? -1 : 0;
    if (cmp !== d.relStats) return false;
  }
  // Переворот консоли (инкей) — не реализуемо
  if (d.upsideDown) return false;
  return true;
}

/**
 * matchStoneEvo — чистая проверка: подходит ли предмет эволюции.
 * mappedName — имя из STONE_ITEM_MAP (например, 'metal-coat').
 * Совпадение: use-item по evo.item ИЛИ trade по evo.held.
 * (Раньше была только use-item ветка — все трейд-эвы молча не работали.)
 */
export function matchStoneEvo(evo: any, mappedName: string | null): boolean {
  if (!evo || !mappedName) return false;
  if (evo.trigger === 'use-item' && evo.item && evo.item === mappedName) return true;
  if (evo.trigger === 'trade' && evo.held && evo.held === mappedName) return true;
  return false;
}

// ── checkEvolution: проверка, может ли покемон эволюционировать ──
// Принимает:
//   pokemon — объект покемона
//   useStone — true если используется камень (force-эволюция)
//   stoneItem — ID предмета камня (например, 'fireStone')
// Возвращает:
//   объект эволюции {name, ...} (+ shedBonus для нинкады) или null
// Логика:
//   — Everstone блокирует ВСЁ (и уровень, и камни — канон).
//   — useStone=true: use-item И trade по matchStoneEvo (по всем деталям).
//   — useStone=false: level-up детали через levelDetailMet (пол, время,
//     счастье, место, атаки, сопартийцы, статы тайрога); при нескольких
//     совпадениях — рандом (вурмпл); shed-деталь ставит флаг shedBonus.
export async function checkEvolution(pokemon, useStone = false, stoneItem = null) {
  // Получаем список эволюций для этого покемона
  const evos = await getEvolutions(pokemon.apiData.name);
  // Эффективный уровень = базовый + конфеты
  const effectiveLevel = pokemon.baseLevel + (pokemon.candiesEaten || 0);

  // Вечный камень блокирует любую эволюцию (канон)
  if (pokemon.heldItem === 'everstone') return null;

  // ── Эволюция через камень ──
  // use-item (камни) + trade (держимый предмет: metal-coat, deep-sea-...).
  // Трейд в игре идёт использованием предмета из сумки (обмена с NPC нет),
  // поэтому trade-ветка считается тем же путём.
  if (useStone) {
    const mapped = stoneItem ? STONE_ITEM_MAP[stoneItem] : null;
    for (const evo of evos) {
      const details = evo.details || [{ trigger: evo.trigger, item: evo.item, held: evo.held }];
      for (const d of details) {
        if ((d.trigger === 'use-item' || d.trigger === 'trade')
          && matchStoneEvo({ trigger: d.trigger, item: d.item, held: d.held }, mapped)) {
          return evo;  // Камень подходит
        }
      }
      // Универсальный камень без ID (evolutionStone): первая каменная эва
      if (!stoneItem && (evo.trigger === 'use-item' || evo.trigger === 'trade')) return evo;
    }
    return null;
  }

  // ── Эволюция по уровню (все условия) ──
  const ctx = buildEvoCtx(pokemon);
  const matches: any[] = [];
  let shedBonus = false;
  for (const evo of evos) {
    // КАНОН ЛИГИ важнее PokeAPI: у эволюции может прийти min_level = null
    // (зависит от версии игры в evolution_details), а null в levelDetailMet
    // трактуется как «эволюция на любом уровне». Именно из-за этого дикие
    // эволюционировали при поимке на чужом уровне. Канонный уровень — из
    // public/pokemon_evo.json (319 переходов, 7..64).
    const canonLevel = evolutionLevelFor(pokemon.apiData?.species?.name || pokemon.apiData?.name, evo.name);
    if (canonLevel != null && effectiveLevel < canonLevel) continue;

    for (const d of evo.details || []) {
      if (d.trigger === 'shed') {
        if (d.minLevel == null || effectiveLevel >= d.minLevel) shedBonus = true;
        continue;
      }
      if (levelDetailMet(d, pokemon, ctx, effectiveLevel, canonLevel)) {
        matches.push(evo);
        break;
      }
    }
  }
  if (matches.length === 0) return null;
  // Несколько совпадений (вурмпл → силкун/каскун) — рандом по канону
  const pick = matches[Math.floor(Math.random() * matches.length)];
  if (shedBonus) (pick as any).shedBonus = true;
  return pick;
}

/**
 * maybeGrantShedinja — бонусная Шединья при эволюции нинкады.
 * Условия канона: в команде есть слот (<6) + в сумке есть покебол (сгорает).
 * Создаём тем же конструктором, что награды гимов (уровень нинкады).
 * Возвращает true если выдана.
 */
export async function maybeGrantShedinja(mon: any): Promise<boolean> {
  if (!mon || mon.apiData?.name !== 'nincada') return false;
  const team = state.myTeam || [];
  if (team.length >= 6) {
    showToast('В команде нет места для Шединьи!', true);
    return false;
  }
  if ((state.inventory?.pokeBall || 0) < 1) {
    showToast('Нужен свободный покебол для Шединьи!', true);
    return false;
  }
  state.inventory.pokeBall -= 1;
  const lvl = (mon.baseLevel || 1) + (mon.candiesEaten || 0);
  try {
    const m = await import('./gym-reward.js');
    const shed = await m.createAndGivePokemon('shedinja', lvl, {});
    if (shed) {
      showToast(`Бонус: из сброшенной оболочки появилась Шединья Lv${lvl}! (−1 покебол)`, false);
      return true;
    }
  } catch (e) {
    console.error('[evo] shedinja bonus failed:', e);
  }
  return false;
}

// ── triggerEvolution: анимация и применение эволюции ────
// Принимает:
//   pokemon — объект покемона (будет изменён)
//   targetName — имя целевой эволюции (например, 'charizard')
//
// Анимация состоит из 5 этапов:
//   1. "Что?!" — старый спрайт + тряска (2.2 сек)
//   2. Вспышки яркости (1.6 сек)
//   3. Загрузка новой формы + обновление данных (асинхронно)
//   4. Показ нового спрайта (1.8 сек)
//   5. Финальная статистика (3 сек)
//
// После завершения — скрытие оверлея и очистка эффектов
export async function triggerEvolution(pokemon, targetName) {
  // DOM-элементы анимации
  const overlay = document.getElementById('evolution-overlay');  // Затемнённый фон
  const evoSprite = document.getElementById('evo-sprite') as HTMLImageElement;  // Спрайт
  const evoText = document.getElementById('evo-text');            // Текст

  if (!overlay) return;  // Если нет оверлея — выходим (нет поддержки анимации)

  // Вспомогательная функция: ожидание N миллисекунд
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Сохраняем старые данные для анимации
  const oldName = pokemon.apiData.name;
  const oldSprite = getSpriteUrl(pokemon);
  const evoBox = evoSprite.closest('.evo-sprite-box') as HTMLElement | null;

  // Показываем оверлей
  overlay.style.display = 'flex';

  // ── ЭТАП 1: "Что?!" + тряска ──
  evoText.innerHTML = `<span class="evo-shake">Что?!</span><br><small>${oldName} эволюционирует!</small>`;
  evoSprite.src = oldSprite;  // Старый спрайт
  if (evoBox) {
    evoBox.style.background = getTypeGradient(pokemon.apiData.types);  // Фон по типу
    evoBox.classList.add('evo-flash');  // CSS-анимация вспышки
  }
  await wait(2200);

  // ── ЭТАП 2: Вспышки яркости ──
  evoText.innerHTML = '✨ <span class="evo-glowing">Эволюция!</span> ✨';
  evoSprite.style.filter = 'brightness(3)';  // Ярко
  await wait(700);
  evoSprite.style.filter = 'brightness(0.3)';  // Темно
  await wait(400);
  evoSprite.style.filter = 'brightness(2.5)';  // Снова ярко
  await wait(500);
  evoSprite.style.filter = 'brightness(1)';    // Нормально

  // ── ЭТАП 3: Загрузка новой формы + обновление данных ──
  try {
    // Загружаем данные новой формы из PokeAPI
    const newData = await fetchPokeAPI(`pokemon/${targetName}`);

    // fetchPokeAPI возвращает null при недоступности PokeAPI, лимите прокси или
    // сетевой ошибке. Раньше следующая строка обращалась к null.moves и падала,
    // а игрок видел только «Ошибка эволюции...» без причины.
    if (!newData || typeof newData !== 'object') {
      throw new Error('PokeAPI не вернул данные новой формы (лимит прокси или сеть)');
    }

    const oldMoves = pokemon.apiData.moves ? [...pokemon.apiData.moves] : [];
    const oldPP = pokemon.movesPP ? [...pokemon.movesPP] : [];
    const oldLearnable = pokemon.learnableMoves ? [...pokemon.learnableMoves] : [];
    const oldLastCheckLevel = pokemon.lastMoveCheckLevel;

    // Обновляем apiData на новую форму
    pokemon.apiData = newData;

    // Восстанавливаем старые атаки (4 слота)
    if (oldMoves.length > 0) pokemon.apiData.moves = oldMoves;
    if (oldPP.length > 0) pokemon.movesPP = oldPP;
    if (oldLearnable.length > 0) pokemon.learnableMoves = oldLearnable;
    pokemon.lastMoveCheckLevel = oldLastCheckLevel || 1;

    // ── Автоматическое добавление новых атак в резерв ──
    // Проверяем атаки, которые новая форма изучает по уровню
    const curLvl = pokemon.baseLevel + (pokemon.candiesEaten || 0);
    const knownMoveNames = new Set();
    for (let i = 0; i < 4; i++) {
      if (pokemon.apiData.moves[i]?.move?.name) knownMoveNames.add(pokemon.apiData.moves[i].move.name);
    }
    if (!pokemon.learnableMoves) pokemon.learnableMoves = [];
    const reserveNames = new Set(pokemon.learnableMoves.map(m => m.name));

    // Проходим по всем атакам новой формы.
    // version_group_details опционален: PokeAPI отдаёт его не для всех записей,
    // и обычный for..of по undefined ронял всю эволюцию.
    for (const entry of (newData.moves || [])) {
      const details = entry?.version_group_details;
      if (!Array.isArray(details)) continue;
      for (const detail of details) {
        // Если атака изучается по уровню ≤ текущего
        if (detail.move_learn_method?.name === 'level-up' && detail.level_learned_at <= curLvl) {
          // И она ещё не изучена и не в резерве — добавляем
          if (!knownMoveNames.has(entry.move.name) && !reserveNames.has(entry.move.name)) {
            pokemon.learnableMoves.push({
              name: entry.move.name, url: entry.move.url, power: 0, type: 'normal'
            });
          }
          break;
        }
      }
    }

    // ── Пересчёт HP ──
    // Ищем HP по имени, а не по позиции: PokeAPI не гарантирует порядок stats,
    // и oldMaxHp/newMaxHp считались бы от чужого стата.
    const hpStat = newData.stats?.find((s: any) => s?.stat?.name === 'hp') || newData.stats?.[0];
    if (!hpStat) throw new Error('у новой формы нет характеристики HP');
    const baseHp = hpStat.base_stat;
    const newMaxHp = Math.floor(
      0.01 * (2 * baseHp + pokemon.ivs.hp + Math.floor(0.25 * pokemon.evs.hp)) * curLvl
    ) + curLvl + 10;
    const oldMaxHp = pokemon.maxHp;
    pokemon.maxHp = newMaxHp;
    pokemon.currentHp = Math.min(pokemon.currentHp + (newMaxHp - oldMaxHp), newMaxHp);

    // ── ЭТАП 4: Показ нового спрайта ──
    evoSprite.src = getSpriteUrl(pokemon);  // apiData уже обновлён, isShiny сохранён
    if (evoBox) evoBox.style.background = getTypeGradient(newData.types);
    evoText.innerHTML = `<b>${targetName.toUpperCase()}!</b>`;
    evoSprite.style.filter = 'brightness(1.3) drop-shadow(0 0 20px gold)';  // Золотое свечение
    evoBox?.classList.remove('evo-flash');
    evoBox?.classList.add('evo-reveal');  // CSS-анимация появления
    await wait(1800);

    // ── ЭТАП 5: Финальная статистика ──
    const newStars = getPowerStars(pokemon);  // Звёзды мощи (0-10)
    const bst = newData.stats.reduce((s, st) => s + st.base_stat, 0);  // BST (сумма базовых статов)
    const types = newData.types.map(t => t.type.name).join(', ');  // Типы
    evoText.innerHTML = `
      <b>${targetName.toUpperCase()}</b><br>
      <small style="color:#aaa">${types} | BST: ${bst}</small><br>
      <span style="color:#ff9500;font-size:1rem;">${'★'.repeat(newStars)}${'☆'.repeat(10 - newStars)}</span><br>
      <small style="color:#5af">HP: ${oldMaxHp} → ${newMaxHp}</small>
    `;
    evoBox?.classList.remove('evo-reveal');
    await wait(3000);

  } catch (e) {
    // Показываем настоящую причину. Раньше здесь была одна строка «Ошибка
    // эволюции...», из-за чего игрок и разработчик не знали, что именно сломалось.
    console.warn('Evolution failed for', targetName, e);
    const reason = (e as any)?.message ? String((e as any).message) : 'неизвестная ошибка';
    evoText.innerHTML = `<b style="color:#f66">Ошибка эволюции</b><br><small style="color:#999">${reason}</small>`;
    showToast(`Эволюция не удалась: ${reason}`, true);
    await wait(2000);
  }

  // ── Очистка ──
  evoSprite.style.filter = '';  // Сбрасываем фильтры
  evoBox?.classList.remove('evo-flash', 'evo-reveal');  // Убираем CSS-классы
  overlay.style.display = 'none';  // Прячем оверлей
}
