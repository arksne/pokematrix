// ─────────────────────────────────────────────────────────────
// gym-reward.ts — НАГРАДА ЗА ПОБЕДУ НАД ЛИДЕРОМ СТАДИОНА
// ─────────────────────────────────────────────────────────────
// Решение хозяина: приз — ОДИН из двух, рандом 50/50:
//   1) супердаркболы ×1–10;
//   2) случайный покемон из команды лидера (шини Lv.1, повышенные IV).
// Выбора нет — что выпало, то выпало. Значок/деньги/предмет лидера выдаёт
// сервер через POST /economy/badge-reward (единый источник, без дублей).
//
// ЗАВИСИМОСТИ:
//   gyms     — gymLeaders (данные лидеров)
//   state    — state, getTrainerId
//   dom      — showToast
//   actions  — addItem
//   save     — autoSave
//   profile  — renderTeamGrid
//
// ИСПОЛЬЗУЕТСЯ В:
//   init.ts    — showGymRewardSelection
//   core.ts    — вызов после победы над лидером (только первая победа)
//
// ЭКСПОРТЫ:
//   createAndGivePokemon(name, level, opts) — создание покемона через PokeAPI
//   rollGymPrize(team, rand) — чистый розыгрыш приза (тесты)
//   showGymRewardSelection(locId) — розыгрыш и выдача приза
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { gymLeaders } from '../data/gyms.js';      // Данные лидеров залов
import { natures } from '../data/natures.js';          // Характеры (для случайного)
import { state, getTrainerId } from '../game/state.js';  // Глобальное состояние
import { showToast } from '../utils/dom.js';  // UI тосты
import { addItem } from '../game/actions.js';          // Добавление предметов
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
// Загружает данные из PokeAPI, создаёт объект покемона с ПОВЫШЕННЫМИ IV
// (43-50, но никогда не все 50 — спека 2.3) и СЛУЧАЙНЫМ характером,
// добавляет в команду (или в PC при полной команде), возвращает созданный
// объект или null при ошибке
export async function createAndGivePokemon(pokemonName, level = 1, opts: any = {}) {
  try {
    // Загружаем данные покемона из PokeAPI
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);
    const pokeData = await res.json();

    const baseHp = pokeData.stats[0].base_stat;
    // Повышенные IV (спека 2.3): 43-50 каждый, но никогда не все 50 —
    // идеальные гены гриндятся в природе, а не выдаются за зал.
    const rollBoosted = () => 43 + Math.floor(Math.random() * 8);
    const ivs = { hp: rollBoosted(), atk: rollBoosted(), def: rollBoosted(), spa: rollBoosted(), spd: rollBoosted(), spe: rollBoosted() };
    if (Object.values(ivs).every(v => v === 50)) {
      const keys = Object.keys(ivs);
      ivs[keys[Math.floor(Math.random() * keys.length)]] = 49;
    }
    const maxHp = Math.floor(0.01 * (2 * baseHp + ivs.hp) * level) + level + 10;

    // Характер: случайный (спека 2.3), из opts — только явный оверрайд
    const natureIdx = opts.natureIdx !== undefined ? opts.natureIdx : Math.floor(Math.random() * natures.length);

    const pokemon = {
      uid: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),  // Уникальный ID
      originalTrainer: getTrainerId(),        // ID тренера
      createdAt: Date.now(),
      caughtLocation: state.currentLocationId || 'stadium',
      apiData: pokeData,                       // Данные из PokeAPI
      maxHp, currentHp: maxHp, ivs,            // HP и IV
      evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },  // EV = 0
      baseLevel: level, exp: 0, expToNext: 8,
      candiesEaten: 0, vitaminsEaten: 0,
      training: null, trainingStage: 0, trainingStat: null,
      happiness: 120,                          // Высокое счастье
      natureIdx,                                // Лучший характер
      breedLetter: ['A', 'T', 'G'][Math.floor(Math.random() * 3)],  // симпатия (канон лиги)
      gender: Math.random() < 0.5 ? 'male' : 'female',
      status: null, sleepTurns: 0, movesPP: [],
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
      abilityName: pokeData.abilities[0]?.ability?.name || null,
      heldItem: null,
      berries: { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
      learnableMoves: [], isEgg: false, hasBred: false,
      isShiny: !!opts.isShiny  // Шини-флаг (true для награды лидера)
    };

    state.myTeam.push(pokemon);  // Добавляем в команду
    if (state.myTeam.length > 6) {
      // Команда была полна: лишний уходит в PC, иначе сервер отклонит сейв
      // (myTeam max 6) и награда потеряется при следующей синхронизации
      const extra = state.myTeam.splice(6);
      if (state.pcBoxes.length === 0) state.pcBoxes.push([]);
      state.pcBoxes[0].push(...extra);
    }
    renderTeamGrid();             // Обновляем отображение
    return pokemon;
  } catch (e) {
    console.error('createAndGivePokemon error:', e);
    showToast('Ошибка создания покемона!', true);
    return null;
  }
}

export type GymPrize =
  | { type: 'balls'; qty: number }
  | { type: 'mon'; name: string };

/**
 * rollGymPrize — чистый розыгрыш приза гима (тестируемо, без DOM).
 * 50/50: супердаркболы ×1–10 или случайный покемон из команды лидера.
 * Пустая команда — null (приза нет, только значок с сервера).
 */
export function rollGymPrize(
  team: Array<{ name: string }>,
  rand: () => number = Math.random,
): GymPrize | null {
  if (!team || team.length === 0) return null;
  if (rand() < 0.5) {
    return { type: 'balls', qty: 1 + Math.floor(rand() * 10) };
  }
  return { type: 'mon', name: team[Math.floor(rand() * team.length)].name };
}

// ── showGymRewardSelection: розыгрыш и выдача приза ──────
// Выбора больше нет: что выпало в rollGymPrize, то и выдаём.
// Предмет лидера НЕ выдаём здесь — его уже выдал сервер через
// POST /economy/badge-reward (иначе задвоение).
export function showGymRewardSelection(locId: string, rand?: () => number) {
  const leader = gymLeaders[locId];
  if (!leader || !leader.team) return;

  const prize = rollGymPrize(leader.team, rand);
  if (!prize) return;

  if (prize.type === 'balls') {
    const got = addItem('superDarkBall', prize.qty);
    showToast(
      got ? `🎰 Приз гима: Супердаркбол×${prize.qty}!` : 'Рюкзак полон! Награда потеряна.',
      !got,
    );
    autoSave();
    return;
  }

  createAndGivePokemon(prize.name, 1, { isShiny: true }).then((mon) => {
    if (mon) {
      showToast(`🎰 Приз гима: Lv.1 ${prize.name} (шини, случайно из команды лидера)!`, false);
    }
    autoSave();
    if (typeof renderTeamGrid === 'function') renderTeamGrid();
  });
}
