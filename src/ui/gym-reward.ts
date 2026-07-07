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
import { state, getTrainerId } from '../game/state.js';  // Глобальное состояние
import { showSelectionModal, showToast } from '../utils/dom.js';  // UI модалки/тосты
import { addItem } from '../game/actions.js';          // Добавление предметов
import { itemDef } from '../game/state.js';            // Название предмета по ID
import { autoSave } from '../game/save.js';              // Автосохранение
import { renderTeamGrid } from './profile.js';          // Обновление сетки команды

// ── getBestNatureIdx: определить лучший характер для покемона ──
// Анализирует базовые статы и выбирает характер, который усиливает
// самый высокий стат и ослабляет самый низкий
function getBestNatureIdx(pokeData) {
  const stats = pokeData.stats;
  // Извлекаем базовые значения статов
  const atk = stats.find(s => s.stat.name === 'attack')?.base_stat || 50;
  const def = stats.find(s => s.stat.name === 'defense')?.base_stat || 50;
  const spa = stats.find(s => s.stat.name === 'special-attack')?.base_stat || 50;
  const spd = stats.find(s => s.stat.name === 'special-defense')?.base_stat || 50;
  const spe = stats.find(s => s.stat.name === 'speed')?.base_stat || 50;

  // Сортируем статы по убыванию
  const entries = [['atk', atk], ['def', def], ['spa', spa], ['spd', spd], ['spe', spe]];
  entries.sort((a, b) => b[1] - a[1]);
  const best = entries[0][0];  // Самый высокий стат

  // Маппинг названий статов → индексы характеров в массиве natures
  // Индексы выбраны так, чтобы buff был на лучший стат
  const natureMap: Record<string, number> = {
    atk: 3,   // Adamant (+Atk -SpA)
    def: 8,   // Impish (+Def -SpA)
    spe: 13,  // Jolly (+Spe -SpA)
    spa: 15,  // Modest (+SpA -Atk)
    spd: 24,  // Careful (+SpD -SpA)
  };
  return natureMap[best] || 0;  // Default: Hardy (нейтральный)
}

// ── createAndGivePokemon: создать покемона через PokeAPI ────
// Принимает:
//   pokemonName — имя вида (например, 'charizard')
//   level — уровень (по умолчанию 1)
//   opts — { isShiny, natureIdx }
// Загружает данные из PokeAPI, создаёт объект покемона с идеальными IV (31),
// добавляет в команду, возвращает созданный объект или null при ошибке
export async function createAndGivePokemon(pokemonName, level = 1, opts: any = {}) {
  try {
    // Загружаем данные покемона из PokeAPI
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemonName}`);
    if (!res.ok) throw new Error(`PokeAPI returned ${res.status}`);
    const pokeData = await res.json();

    const baseHp = pokeData.stats[0].base_stat;
    const ivs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };  // Идеальные IV
    const maxHp = Math.floor(0.01 * (2 * baseHp + ivs.hp) * level) + level + 10;

    // Определяем индекс характера: из opts или вычисляем лучший
    const natureIdx = opts.natureIdx !== undefined ? opts.natureIdx : getBestNatureIdx(pokeData);

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
      breedLetter: 'S',                        // 'S' = Special (награда лидера)
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
    subtitle: `Тот же покемон, что был в бою — Lv.1, шини, идеальные гены`,
    value: m.name
  }));

  showSelectionModal('🎉 Выберите покемона лидера в награду!', choices, async (idx) => {
    const chosenName = choices[idx]?.value;
    if (!chosenName) return;

    // Создаём шини-покемона Lv.1
    const mon = await createAndGivePokemon(chosenName, 1, { isShiny: true });
    if (mon) {
      // Добавляем награду лидера (предмет + 10 супердаркболов)
      addItem(leader.rewardItem, leader.rewardQty || 1);
      addItem('superDarkBall', 10);
      showToast(
        `Получен Lv.1 ${chosenName} (шини!) + ${itemDef(leader.rewardItem).nameRu} + Супердаркбол×10!`,
        false
      );
    }
    autoSave();
    if (typeof renderTeamGrid === 'function') renderTeamGrid();
  }, true);
}
