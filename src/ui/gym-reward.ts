// ─────────────────────────────────────────────────────────────
// gym-reward.ts — НАГРАДА ЗА ПОБЕДУ НАД ЛИДЕРОМ СТАДИОНА
// ─────────────────────────────────────────────────────────────
// Отвечает за выдачу награды игроку после победы над лидером гима:
// создаёт шини-версию покемона лидера (Lv.1, идеальные IV, лучшая природа)
// и добавляет предметы (rewardItem лидера + 10 Супердаркболов).
//
// ЗАВИСИМОСТИ:
//   gyms     — gymLeaders (данные лидеров)
//   state    — state, getTrainerId, itemDef
//   dom      — showSelectionModal, showToast
//   actions  — addItem
//   save     — autoSave
//   profile  — renderTeamGrid
//
// ИСПОЛЬЗУЕТСЯ В:
//   init.ts    — showGymRewardSelection
//   core.ts    — вызов после победы над лидером
//
// ЭКСПОРТЫ:
//   createAndGivePokemon(name, level, opts) — создание покемона через PokeAPI
//   showGymRewardSelection(locId)           — модалка выбора награды
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ───────────────────────────────────────────────

import { gymLeaders } from '../data/gyms.js';      // Данные лидеров залов
import { natures } from '../data/natures.js';          // Характеры (для случайного)
import { state, getTrainerId } from '../game/state.js';  // Глобальное состояние
import { showSelectionModal, showToast } from '../utils/dom.js';  // UI модалки/тосты
import { addItem } from '../game/actions.js';          // Добавление предметов
import { itemDef } from '../game/state.js';            // Название предмета по ID
import { autoSave } from '../game/save.js';              // Автосохранение
import { renderTeamGrid } from './profile.js';          // Обновление сетки команды

// ── createAndGivePokemon: создать покемона через PokeAPI ────
// Принимает:
//   pokemonName — имя вида (например, 'charizard')
//   level — уровень (по умолчанию 1)
//   opts — { isShiny, natureIdx }
// Загружает данные из PokeAPI, создаёт объект покемона с ПОВЫШЕННЫМИ IV
// (24-31, но никогда не все 31 — спека 2.3) и СЛУЧАЙНЫМ характером,
// добавляет в команду (или в PC при полной команде), возвращает созданный
// объект или null при ошибке
export async function createAndGivePokemon(pokemonName, level = 1, opts: any = {}) {
  try {
    // Загружаем данные покемона из PokeAPI
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);
    const pokeData = await res.json();

    const baseHp = pokeData.stats[0].base_stat;
    // Повышенные IV (спека 2.3): 24-31 каждый, но никогда не все 31 —
    // идеальные гены гриндятся в природе, а не выдаются за зал.
    const rollBoosted = () => 24 + Math.floor(Math.random() * 8);
    const ivs = { hp: rollBoosted(), atk: rollBoosted(), def: rollBoosted(), spa: rollBoosted(), spd: rollBoosted(), spe: rollBoosted() };
    if (Object.values(ivs).every(v => v === 31)) {
      const keys = Object.keys(ivs);
      ivs[keys[Math.floor(Math.random() * keys.length)]] = 30;
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

// ── showGymRewardSelection: модалка выбора награды ──────
// После победы над лидером показывает список его покемонов
// Игрок выбирает одного — получает шини-версию Lv.1
// + награду лидера + 10 Супердаркболов
export function showGymRewardSelection(locId) {
  const leader = gymLeaders[locId];
  if (!leader || !leader.team) return;

  // Формируем список выбора: все покемоны лидера
  const choices = leader.team.map(m => ({
    label: `🔑 Lv.1 ${m.name}`,
    subtitle: `Тот же покемон, что был в бою — Lv.1, шини, повышенные гены`,
    value: m.name
  }));

  showSelectionModal('🎉 Выберите покемона лидера в награду!', choices, async (idx) => {
    const chosenName = choices[idx]?.value;
    if (!chosenName) return;

    // Создаём шини-покемона Lv.1
    const mon = await createAndGivePokemon(chosenName, 1, { isShiny: true });
    if (mon) {
      // Добавляем награду лидера (предмет + 10 супердаркболов)
      const gotReward = addItem(leader.rewardItem, leader.rewardQty || 1);
      const gotBalls = addItem('superDarkBall', 10);
      if (!gotReward && !gotBalls) {
        showToast('Рюкзак полон! Награда потеряна.', true);
      } else {
        showToast(
          `Получен Lv.1 ${chosenName} (шини!)${gotReward ? ' + ' + itemDef(leader.rewardItem).nameRu : ''}${gotBalls ? ' + Супердаркбол×10' : ''}!`,
          !gotReward || !gotBalls
        );
      }
    }
    autoSave();
    if (typeof renderTeamGrid === 'function') renderTeamGrid();
  }, true);
}
