// ─────────────────────────────────────────────────────────────
// gym-reward.ts — НАГРАДА ЗА ПОБЕДУ НАД ЛИДЕРОМ СТАДИОНА
// ─────────────────────────────────────────────────────────────
// Спека 2.3: награда за зал = бейдж + деньги + TM + ПОКЕМОН из коллекции
// лидера (1 уровень, повышенные IV 20–30 — не идеальные, случайный
// характер, гарантированный шайни). Значок/деньги/предмет лидера выдаёт
// сервер через POST /economy/badge-reward (единый источник, без дублей),
// клиент добавляет только покемона: вид случайно из команды лидера.
//
// ЗАВИСИМОСТИ:
//   gyms     — gymLeaders (данные лидеров)
//   state    — state, getTrainerId
//   dom      — showToast
//   save     — autoSave
//   profile  — renderTeamGrid
//
// ИСПОЛЬЗУЕТСЯ В:
//   init.ts    — showGymRewardSelection
//   core.ts    — вызов после победы над лидером (только первая победа)
//
// ЭКСПОРТЫ:
//   createAndGivePokemon(name, level, opts) — создание покемона через PokeAPI
//   pickGymMonName(team, rand) — чистый выбор вида из команды лидера (тесты)
//   rollGymMonIVs(rand) — чистые IV приза 20–30 (тесты)
//   buildGymPrizeMon(pokeData, level, opts, rand, ids) — чистый мон (тесты)
//   placePrizeMon(mon) — в команду или в PC при полной (тесты)
//   showGymRewardSelection(locId) — выдача приза
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { gymLeaders } from '../data/gyms.js';      // Данные лидеров залов
import { natures } from '../data/natures.js';          // Характеры (для случайного)
import { state, getTrainerId, generateUID } from '../game/state.js';  // Глобальное состояние
import { showToast } from '../utils/dom.js';  // UI тосты
import { autoSave } from '../game/save.js';              // Автосохранение
import { renderTeamGrid } from './profile.js';          // Обновление сетки команды

// ── isFirstGymWin: первая ли это победа (N4) ────
// Значок и богатая награда (шини + предметы) — только за первую победу.
// Реванш разрешён всегда (опыт и фан), но без значка и без награды:
// иначе залы превращаются в ферму шини. Чистая функция для тестов.
export function isFirstGymWin(badges: unknown, badgeName: string): boolean {
  return Array.isArray(badges) && !badges.includes(badgeName);
}

// ── createAndGivePokemon: создать покемона через PokeAPI ────
// Принимает:
//   pokemonName — имя вида (например, 'charizard')
//   level — уровень (по умолчанию 1)
//   opts — { isShiny, natureIdx }
// Загружает данные из PokeAPI, строит мон чистым buildGymPrizeMon
// (спека 2.3: IV 20–30, случайный характер, шайни) и кладёт через
// placePrizeMon (команда или PC при полной). Возвращает созданный
// объект или null при ошибке
export async function createAndGivePokemon(pokemonName, level = 1, opts: any = {}) {
  try {
    // Загружаем данные покемона из PokeAPI
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);
    const pokeData = await res.json();

    const pokemon = buildGymPrizeMon(pokeData, level, opts);
    placePrizeMon(pokemon);
    renderTeamGrid();             // Обновляем отображение
    return pokemon;
  } catch (e) {
    console.error('createAndGivePokemon error:', e);
    showToast('Ошибка создания покемона!', true);
    return null;
  }
}

/**
 * pickGymMonName — чистый выбор вида-приза из команды лидера.
 * Равномерно случайный член команды; пустая команда — null
 * (приза нет, остаются значок/деньги/TM с сервера).
 */
export function pickGymMonName(
  team: Array<{ name: string }>,
  rand: () => number = Math.random,
): string | null {
  if (!team || team.length === 0) return null;
  return team[Math.floor(rand() * team.length)].name;
}

/**
 * rollGymMonIVs — чистые IV приза гима (спека 2.3: повышенные 20–30,
 * никогда не идеальные — на шкале 0..50 идеал 50 недостижим здесь).
 */
export function rollGymMonIVs(
  rand: () => number = Math.random,
): Record<string, number> {
  const roll = () => 20 + Math.floor(rand() * 11); // 20..30
  return { hp: roll(), atk: roll(), def: roll(), spa: roll(), spd: roll(), spe: roll() };
}

/**
 * buildGymPrizeMon — чистый мон-приз за зал (спека 2.3).
 * Уровень level (обычно 1), IV 20–30, характер случайный (opts.natureIdx —
 * только явный оверрайд), шайни флагом opts.isShiny (приз лидера — true).
 */
export function buildGymPrizeMon(
  pokeData: any,
  level = 1,
  opts: any = {},
  rand: () => number = Math.random,
  ids: { uid?: string; trainerId?: string } = {},
): any {
  const baseHp = pokeData.stats[0].base_stat;
  const ivs = rollGymMonIVs(rand);
  const maxHp = Math.floor(0.01 * (2 * baseHp + ivs.hp) * level) + level + 10;

  // Характер: случайный (спека 2.3), из opts — только явный оверрайд
  const natureIdx = opts.natureIdx !== undefined ? opts.natureIdx : Math.floor(rand() * natures.length);

  return {
    uid: ids.uid || (generateUID ? generateUID() : Date.now().toString(36) + rand().toString(36).substr(2, 6)),
    originalTrainer: ids.trainerId || getTrainerId(),        // ID тренера
    createdAt: Date.now(),
    caughtLocation: state.currentLocationId || 'stadium',
    apiData: pokeData,                       // Данные из PokeAPI
    maxHp, currentHp: maxHp, ivs,            // HP и IV
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },  // EV = 0
    baseLevel: level, exp: 0, expToNext: 8,
    candiesEaten: 0, vitaminsEaten: 0,
    training: null, trainingStage: 0, trainingStat: null,
    happiness: 120,                          // Высокое счастье
    natureIdx,                                // Случайный характер
    breedLetter: ['A', 'T', 'G'][Math.floor(rand() * 3)],  // симпатия (канон лиги)
    gender: rand() < 0.5 ? 'male' : 'female',
    status: null, sleepTurns: 0, movesPP: [],
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    abilityName: pokeData.abilities[0]?.ability?.name || null,
    heldItem: null,
    berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
    learnableMoves: [], isEgg: false, hasBred: false,
    isShiny: !!opts.isShiny  // Шини-флаг (true для награды лидера)
  };
}

/**
 * placePrizeMon — положить призового мона: в команду, при полной (6) —
 * в первый бокс PC (иначе сервер отклонит сейв myTeam max 6 и награда
 * потеряется при синхронизации). Чистое состояние, без DOM.
 * Возвращает 'team' | 'pc'.
 */
export function placePrizeMon(mon: any): 'team' | 'pc' {
  if (state.myTeam.length < 6) {
    state.myTeam.push(mon);
    return 'team';
  }
  if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
  state.pcBoxes[0].push(mon);
  return 'pc';
}

// ── showGymRewardSelection: выдача приза ──────
// Спека 2.3: покемон из коллекции лидера — всегда (вид случаен).
// Предмет лидера НЕ выдаём здесь — его уже выдал сервер через
// POST /economy/badge-reward (иначе задвоение).
export function showGymRewardSelection(locId: string, rand: () => number = Math.random) {
  const leader = gymLeaders[locId];
  if (!leader || !leader.team) return;

  const name = pickGymMonName(leader.team, rand);
  if (!name) return;

  createAndGivePokemon(name, 1, { isShiny: true }).then((mon) => {
    if (mon) {
      showToast(`🏆 Приз гима: Lv.1 ${name} (шайни, из коллекции лидера)!`, false);
    }
    autoSave();
    if (typeof renderTeamGrid === 'function') renderTeamGrid();
  });
}
