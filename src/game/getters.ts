/**
 * ============================================================
 * getters.ts — GETTERS/SETTERS ДЛЯ state (FAÇADE)
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   Прослойка между state.ts и UI/Battle модулями.
 *   Предоставляет getter'ы для чтения state с дополнительной
 *   логикой (POKEDEX_ALL, SHOP_STOCK, gymLeaders и т.д.).
 *   setGameState(patch) — массовое обновление state из save.
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ./state.js              → state (глобальное состояние)
 *   - ../battle/core.js       → POKEDEX_ALL, pokedexData, pokedexTotal
 *   - ../data/shops.js        → SHOP_STOCK
 *   - ../data/items.js        → ITEMS
 *   - ../data/training.js     → trainingStages
 *   - ../utils/state.js       → eliteFour, champion
 *   - ../data/gyms.js         → gymLeaders
 *   - ../data/quests.js       → QUEST_CONFIGS
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   - UI модули (profile, inventory, map, shop, pokedex)
 *   - battle/core.ts
 * ============================================================
 */

import { state } from './state.js';
import { POKEDEX_ALL, pokedexData, pokedexTotal } from '../battle/core.js';
import { SHOP_STOCK } from '../data/shops.js';
import { ITEMS } from '../data/items.js';
import { trainingStages } from '../data/training.js';
import { eliteFour, champion } from '../utils/state.js';
import { gymLeaders } from '../data/gyms.js';
import { QUEST_CONFIGS } from '../data/quests.js';

// ── Простые getter'ы ───────────────────────────────────────
// Возвращают поля из state (без дополнительной обработки)
export function getTgUser() { return state.tgUser; }
export function getSocket() { return state.socket; }
export function getIsAdmin() { return state.isAdmin; }

// ── Покедекс ───────────────────────────────────────────────
// Возвращает всё состояние покедекса + глобальные данные
export function getPokedexState() {
  return { pokedexSeen: state.pokedexSeen, pokedexCaught: state.pokedexCaught, POKEDEX_ALL: POKEDEX_ALL, pokedexData: pokedexData, pokedexTotal: pokedexTotal };
}

// ── Магазин ────────────────────────────────────────────────
// Деньги + инвентарь + ассортимент магазина в текущей локации
export function getShopState() {
  return { money: state.inventory['credit'] || 0, inventory: state.inventory, locationShopStock: SHOP_STOCK };
}

// ── Деньги ─────────────────────────────────────────────────
// Прямая мутация state (без событий стора)
export function modifyMoney(delta) {
  state.inventory['credit'] = (state.inventory['credit'] || 0) + delta;
}

// ── Команда ────────────────────────────────────────────────
export function getTeamState() {
  return { myTeam: state.myTeam, currentPokemonIndex: state.currentPokemonIndex };
}

// ── Социал ─────────────────────────────────────────────────
export function getSocialState() {
  return { onlinePlayersList: state.onlinePlayersList, trainerNickname: state.trainerNickname, tgUser: state.tgUser };
}

export function setTrainerNickname(name) {
  state.trainerNickname = name;
}

// ── Локация ────────────────────────────────────────────────
export function getMapState() { return { currentLocationId: state.currentLocationId, currentRegion: state.currentRegion, lastLocation: state.lastLocation }; }
export function setCurrentLocationId(id) { state.currentLocationId = id; }
export function setCurrentRegion(reg) { state.currentRegion = reg; }
export function setLastLocation(loc) { state.lastLocation = loc; }

// ── Полное состояние игры (для battle/core.ts) ─────────────
// Использует getter'ы (свойства) для lazy-доступа к state
// Важно: все поля начинаются с get — это не snapshot, а live ссылки
export function getGameState() {
  return {
    get myTeam() { return state.myTeam; },
    get pokedexSeen() { return state.pokedexSeen; },
    get pokedexCaught() { return state.pokedexCaught; },
    get currentLocationId() { return state.currentLocationId; },
    get isDaytime() { return state.isDaytime; },
    get gymLeaders() { return gymLeaders; },
    get eliteFour() { return eliteFour; },
    get champion() { return champion; },
    get gymBadges() { return state.badges; },
    get expShareActive() { return state.expShareActive; },
    get quests() { return state.quests; },
    get questProgress() { return state.questProgress; },
    get completedQuests() { return state.completedQuests; },
    get visitedLocations() { return state.visitedLocations; },
    get inventory() { return state.inventory; },
    get money() { return state.inventory['credit'] || 0; },
    get QUEST_CONFIGS() { return QUEST_CONFIGS; },
    get itemsUsedInBattle() { return state.itemsUsedInBattle; },
    set itemsUsedInBattle(v) { state.itemsUsedInBattle = v; },
    get currentRegion() { return state.currentRegion; }
  };
}

// ── Массовое обновление state из save/cloud ────────────────
// Используется applyCloudSave() в save.ts для восстановления
// ВСЕХ полей state из загруженных данных.
// Важно: Set для pokedexSeen/Caught и pcBoxes.deep copy
export function setGameState(patch: any) {
  if (patch === null || patch === undefined || typeof patch !== 'object') return;
  for (const [k, v] of Object.entries(patch as Record<string, any>)) {
    switch (k) {
      case 'inventory': state.inventory = { ...v }; break;
      case 'money': state.inventory['credit'] = v; break;
      case 'myTeam': state.myTeam = v.map(m => ({ ...m })); break;
      case 'badges': state.badges = [...v]; break;
      case 'pcBoxes': state.pcBoxes = v.map(b => [...b]); break;
      case 'eggs': state.eggs = [...v]; break;
      case 'pokedexSeen': state.pokedexSeen = new Set(v); break;
      case 'pokedexCaught': state.pokedexCaught = new Set(v); break;
      case 'quests': state.quests = [...v]; break;
      case 'questProgress': state.questProgress = { ...v }; break;
      case 'completedQuests': state.completedQuests = [...v]; break;
      case 'npcQuestProgress': state.npcQuestProgress = { ...v }; break;
      case 'completedNPCQuests': state.completedNPCQuests = [...v]; break;
      case 'currentLocationId': state.currentLocationId = v; break;
      case 'currentRegion': state.currentRegion = v; break;
      case 'tutorialStep': state.tutorialStep = v; break;
      case 'trainerNickname': state.trainerNickname = v; break;
      case 'lastLocation': state.lastLocation = v; break;
    }
  }
}

// ── Инвентарь (для UI) ─────────────────────────────────────
export function getInvState() { return { money: state.inventory['credit'] || 0, eggs: state.eggs, ITEMS, trainingStages: trainingStages, expShareActive: state.expShareActive }; }
export function toggleExpShare() { state.expShareActive = !state.expShareActive; }
