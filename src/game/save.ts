import { state, generateUID, getTrainerId, lsKey } from './state.js';
import { ITEMS } from '../data/items.js';
import { REGIONS } from '../data/regions.js';
// Lazy import for cycle-breaking (save.ts ↔ location.ts)
let _getLocation: ((id: string) => any) | null = null;
async function getLocationLazy(locId: string) {
  if (!_getLocation) _getLocation = (await import('../ui/location.js')).getLocation;
  return _getLocation(locId);
}
import { initInventory } from './actions.js';
import { showConfirmModal, showToast } from '../utils/dom.js';
import { LEGENDARY_SET } from '../utils/state.js';
import { API_BASE } from './config.js';
import { apiFetch, getCloudAuthHeaders as getApiClientHeaders } from './apiClient.js';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [5000, 15000, 30000];

// ── Re-export apiClient utilities for backward compatibility ─────────────

/**
 * Get auth headers for legacy code that constructs its own fetch calls.
 * Forwarded to the centralized apiClient implementation.
 */
export function getCloudAuthHeaders() {
  return getApiClientHeaders();
}

/**
 * Enhanced fetch wrapper with automatic 401 → refresh → retry interceptor.
 * Delegates to centralized apiFetch with queue-based refresh (race-condition safe).
 *
 * @param {string} url — API URL
 * @param {object} [options] — fetch options
 * @param {number} [retries] — ignored (apiFetch handles retry internally)
 * @returns {Promise<Response>}
 */

export function getLeaderboardData() {
  const badgesCount = state.badges ? state.badges.length : 0;
  const teamLevelSum = state.myTeam.reduce((sum, mon) => sum + (mon.baseLevel || 1), 0);
  const pokemonCount = state.pokedexCaught.size;
  const legendaryCount = state.myTeam.reduce((c, m) => c + (m.apiData?.name && LEGENDARY_SET.has(m.apiData.name) ? 1 : 0), 0);
  return { badgesCount, teamLevelSum, money: state.inventory['credit'] || 0, pokemonCount, legendaryCount };
}

/**
 * Сжимает PokeAPI-объект покемона до полей, которые реально читаются из сейва.
 *
 * Зачем: полный ответ PokeAPI — это 200–435 КБ на покемона, из которых
 * 85–90 % приходится на moves[].version_group_details. Сейв писался трижды
 * (save + бэкап + battle_state), и квота localStorage в 5 МБ исчерпывалась
 * примерно на 6 покемонах, после чего сохранение падало с QuotaExceeded
 * и игрок терял прогресс.
 *
 * Что обязательно остаётся (иначе ломается игра):
 *   id          — ключ перезагрузки с PokeAPI (levelup_moves, tm)
 *   name        — 110 мест чтения, эволюции, лидерборд
 *   stats[]     — порядок PokeAPI (hp, attack, defense, sp-a, sp-d, speed) и
 *                 stat.name обязательны: logic.ts ищет по имени, inventory — по индексу
 *   types[]     — порядок важен (types[0] — основной тип), нужен type.name
 *   abilities   — [0].ability.name
 *   species     — name (сравнения) и url (реальный fetch в daycare)
 *   sprites     — 4 URL, которые читает utils/sprite.ts
 *   moves[0..3] — боевые слоты; move.url обязателен, иначе слот молча
 *                 выпадает из боя (core.ts проверяет именно url)
 *   isShiny, captureRate, wildGender — собственные поля, которые клиент пишет
 *                 внутрь apiData; isShiny в белом списке монстра отсутствует,
 *                 поэтому здесь это единственное место, где шайни сохраняются
 */
export function slimApiData(api: any): any {
  if (!api || typeof api !== 'object') return api;
  const out: any = {};

  if (api.id !== undefined) out.id = api.id;
  if (api.name !== undefined) out.name = api.name;
  if (api.isShiny !== undefined) out.isShiny = api.isShiny;
  if (api.captureRate !== undefined) out.captureRate = api.captureRate;
  if (api.wildGender !== undefined) out.wildGender = api.wildGender;

  // stats: сохраняем порядок и stat.name — по нему идёт поиск в calculateStat
  if (Array.isArray(api.stats)) {
    out.stats = api.stats.map((s: any) => ({
      base_stat: s?.base_stat,
      stat: s?.stat ? { name: s.stat.name } : undefined,
    }));
  }

  if (Array.isArray(api.types)) {
    out.types = api.types.map((t: any) => ({ type: t?.type ? { name: t.type.name } : undefined }));
  }

  if (Array.isArray(api.abilities)) {
    out.abilities = api.abilities.map((a: any) => ({
      ability: a?.ability ? { name: a.ability.name } : undefined,
      is_hidden: a?.is_hidden,
    }));
  }

  if (api.species && typeof api.species === 'object') {
    out.species = { name: api.species.name, url: api.species.url };
  }

  // Ровно те URL, которые читает getSpriteUrl
  const sp = api.sprites;
  if (sp) {
    const art = sp.other?.['official-artwork'];
    out.sprites = {
      front_default: sp.front_default ?? null,
      front_shiny: sp.front_shiny ?? null,
      other: art ? {
        'official-artwork': {
          front_default: art.front_default ?? null,
          front_shiny: art.front_shiny ?? null,
        },
      } : {},
    };
  }

  // Четыре боевых слота. Пустой слот пишем как null, а не {}: проверки вида
  // `if (mon.apiData.moves[i])` истинны для {}, и следующее чтение
  // `.move.name` падает с TypeError.
  if (Array.isArray(api.moves)) {
    out.moves = api.moves.slice(0, 4).map((m: any) =>
      m && m.move && m.move.url ? { move: { name: m.move.name, url: m.move.url } } : null
    );
  }

  return out;
}

export function getFullSaveData() {
  return {
    _v: state.saveVersion,
    _ts: Date.now(),
    // Флаг «стартовик выдан» — явный, сохраняемый и самовосстанавливающийся.
    // Раньше здесь стояла константа true, потом я заменил её на
    // totalPokemonCount() > 0 — и обе версии были неверны: первая делала
    // полупустой сейв неотличимым от настоящего, вторая делала непредставимым
    // состояние «стартовик выдан, команда пуста». Из-за второго игрок, выпустивший
    // последнего покемона в ПК, при следующей загрузке получал нового случайного
    // стартовика, и так бесконечно, с перебросом IV, натуры и блеска.
    //
    // Теперь это «явный ИЛИ есть покемоны»: покемон в коллекции — доказательство,
    // что старт был, а явный флаг сохраняет состояние «выдан, но команда пуста».
    // Такое и самовосстанавливается: в проде лежал сейв с torchic 15 уровня и
    // starterGiven: false, что грозило новым стартовиком при потере последнего
    // покемона.
    starterGiven: state.starterGiven === true || totalPokemonCount() > 0,
    currentLocationId: state.currentLocationId, currentRegion: state.currentRegion,
    inventory: { ...state.inventory },
    money: state.inventory['credit'] || 0, badges: state.badges, trainerNickname: state.trainerNickname,
    myTeam: state.myTeam.map(m => ({
      uid: m.uid, originalTrainer: m.originalTrainer, createdAt: m.createdAt,
      caughtLocation: m.caughtLocation, previousOwner: m.previousOwner,
      apiData: slimApiData(m.apiData), maxHp: m.maxHp, currentHp: m.currentHp,
      ivs: m.ivs, evs: m.evs, evFromLevel: m.evFromLevel, baseLevel: m.baseLevel,
      exp: m.exp, expToNext: m.expToNext, candiesEaten: m.candiesEaten,
      vitaminsEaten: m.vitaminsEaten, training: m.training, trainingStage: m.trainingStage,
      trainingStat: m.trainingStat, happiness: m.happiness, natureIdx: m.natureIdx,
      breedLetter: m.breedLetter, gender: m.gender, status: m.status, sleepTurns: m.sleepTurns,
      movesPP: m.movesPP, statStages: m.statStages, abilityName: m.abilityName,
      heldItem: m.heldItem, berries: m.berries, learnableMoves: m.learnableMoves,
      lastMoveCheckLevel: m.lastMoveCheckLevel,
    })),
    currentPokemonIndex: state.currentPokemonIndex,
    pokedexSeen: Array.from(state.pokedexSeen),
    pokedexCaught: Array.from(state.pokedexCaught),
    quests: state.quests, questProgress: state.questProgress, completedQuests: state.completedQuests, npcQuestProgress: state.npcQuestProgress, completedNPCQuests: state.completedNPCQuests, tutorialStep: state.tutorialStep,
    visitedLocations: Array.from(state.visitedLocations), itemsUsedInBattle: state.itemsUsedInBattle, itemHistory: state.itemHistory,
    pcBoxes: state.pcBoxes.map(box => box.map(m => ({
      uid: m.uid, originalTrainer: m.originalTrainer, createdAt: m.createdAt,
      caughtLocation: m.caughtLocation, apiData: slimApiData(m.apiData), maxHp: m.maxHp,
      currentHp: m.currentHp, ivs: m.ivs, evs: m.evs, evFromLevel: m.evFromLevel, baseLevel: m.baseLevel,
      exp: m.exp, expToNext: m.expToNext, candiesEaten: m.candiesEaten,
      vitaminsEaten: m.vitaminsEaten, trainingStage: m.trainingStage, trainingStat: m.trainingStat,
      happiness: m.happiness, natureIdx: m.natureIdx, breedLetter: m.breedLetter, gender: m.gender,
      status: m.status, sleepTurns: m.sleepTurns, movesPP: m.movesPP,
      statStages: m.statStages, abilityName: m.abilityName, heldItem: m.heldItem,
      berries: m.berries, learnableMoves: m.learnableMoves,
      lastMoveCheckLevel: m.lastMoveCheckLevel,
    }))),
    daycareMons: state.daycareMons.map((d: any) => ({
      depositTime: d.depositTime,
      // Питомник раньше писался в сейв как есть, целиком, без белого списка —
      // это третий путь, через который полный apiData попадал в сохранение.
      mon: d.mon ? { ...d.mon, apiData: slimApiData(d.mon.apiData) } : d.mon,
    })), daycareEgg: state.daycareEgg, lastLocation: state.lastLocation, expShareActive: state.expShareActive,
    breedingPairs: state.breedingPairs.map(p => ({ boxIdx: p.boxIdx, mon1Uid: p.mon1Uid, mon2Uid: p.mon2Uid, startTime: p.startTime, readyTime: p.readyTime })),
    eggs: state.eggs.map(e => ({ uid: e.uid, species: e.species, types: e.types, ivs: e.ivs, readyTime: e.readyTime, boxIdx: e.boxIdx, parent1Uid: e.parent1Uid, parent2Uid: e.parent2Uid })),
    notifications: state.notifications.slice(0, 30),
  };
}

export function validateGameState() {
  // Ensure critical structures exist
  if (!state.myTeam) state.myTeam = [];
  if (!state.pcBoxes) state.pcBoxes = [[]];
  if (!state.badges) state.badges = [];
  if (!state.inventory) state.inventory = {};
  // НЕ добавляем все 1300+ предметов с нулём — getItemQty() и так возвращает 0 для отсутствующих
  // Ensure credit exists (it IS money)
  if (!('credit' in state.inventory)) state.inventory['credit'] = 500;
  // Validate team pokemon have required fields
  for (let i = state.myTeam.length - 1; i >= 0; i--) {
    const m = state.myTeam[i];
    if (!m.apiData) { console.warn('Pokemon without apiData at index', i, '— removing'); state.myTeam.splice(i, 1); continue; }
    if (!m.uid) m.uid = generateUID();
    if (!m.originalTrainer) m.originalTrainer = getTrainerId();
    if (!m.createdAt) m.createdAt = Date.now();
    if (!m.maxHp || m.maxHp <= 0) m.maxHp = 50;
    if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp;
    if (!m.ivs) m.ivs = { hp: 15, atk: 15, def: 15, spa: 15, spd: 15, spe: 15 };
    if (!m.evs) m.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.learnableMoves) m.learnableMoves = [];
    if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
    // Clamp impossible levels (defense against data corruption)
    if (m.baseLevel > 100) m.baseLevel = 100;
    if (m.baseLevel < 1) m.baseLevel = 1;
    if (m.candiesEaten > 0 && m.baseLevel + m.candiesEaten > 100) m.candiesEaten = 100 - m.baseLevel;
  }
}

export function saveGame() {
  validateGameState();
  state.saveVersion++;
  const saveData = getFullSaveData();

  const saveJson = JSON.stringify(saveData);
  try {
    // Ротация бэкапов: держим только один предыдущий сейв.
    // Раньше их было два, то есть в localStorage лежало три полные копии save_data;
    // при apiData каждого покемона квота в 5 МБ исчерпывалась, и сохранение
    // начинало падать с QuotaExceeded. loadGame() по-прежнему проверяет bak1 и
    // bak2, так что старые бэкапы используются как последний резерв.
    const prev = localStorage.getItem(lsKey('save'));
    if (prev) {
      try { localStorage.setItem(lsKey('save_bak1'), prev); } catch(_) {}
      try { localStorage.removeItem(lsKey('save_bak2')); } catch(_) {}
    }
    localStorage.setItem(lsKey('save'), saveJson);
    localStorage.setItem(lsKey('save_ts'), String(Date.now()));
    localStorage.setItem(lsKey('save_v'), String(state.saveVersion));
  } catch (e) {
    console.warn('localStorage save failed — freeing space', e);
    try {
      // Чистим только производные данные. Бэкапы сейвов и живое состояние боя
      // раньше удалялись здесь же: игрок терял незавершённый бой и откатывался на
      // предыдущий сейв, хотя освобождения это не давало (они и так пустые к моменту
      // переполнения) — а battle_state весит около мегабайта и удалялся всегда.
      ['quest_date', 'pokedex_seen', 'pokedex_caught', 'save_bak2', 'save_bak1'].forEach(k => {
        try { localStorage.removeItem(lsKey(k)); } catch(_) {}
      });
      localStorage.setItem(lsKey('save'), saveJson);
      console.warn('localStorage: сейв записан после освобождения места (бэкапы боя сохранены)');
    } catch (e2) {
      console.error('CRITICAL: Cannot save to localStorage', e2);
    }
  }
}

export async function loadGame() {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(lsKey('save'));
    if (!raw) return false;
    const data = JSON.parse(raw);

    // Version tracking
    state.saveVersion = parseInt(localStorage.getItem(lsKey('save_v')) || '0');
    // Именно save_sync — время последнего УСПЕШНОГО облачного сохранения.
    // Раньше здесь читался save_ts, то есть время последней локальной записи.
    // Из-за этого сравнение «локальный новее облака» в init.ts срабатывало на
    // каждом холодном старте, и пустое состояние выкладывалось поверх реального.
    state.lastCloudSync = parseInt(localStorage.getItem(lsKey('save_sync')) || '0');

    state.currentLocationId = data.currentLocationId || 'goldenrodCity';
    state.currentRegion = data.currentRegion || 'johto';
    // Migrate old region keys
    if (state.currentRegion === 'tevas_islands') state.currentRegion = 'johto' // was southern_archipelago;
    if (!REGIONS[state.currentRegion]) state.currentRegion = 'johto';
    // Validate location exists
    if (!(await getLocationLazy(state.currentLocationId))) {
      state.currentLocationId = 'goldenrodCity';
      state.currentRegion = 'johto';
    }

    if (data.inventory) {
      state.inventory = { ...data.inventory };
    } else {
      const OLD_MAP = {
        invPokeballs: 'pokeBall', invGreatBall: 'greatBall', invUltraBall: 'ultraBall',
        invPotion: 'potion', invCandy: 'rareCandy', invVitamin: 'hpUp',
        invTrain: 'train', invWeaken: 'weaken',
        invSuperPotion: 'superPotion', invFullRestore: 'fullRestore',
        invEvolutionStone: 'evolutionStone', invTM: 'tm',
        invSitrusBerry: 'sitrusBerry', invOranBerry: 'oranBerry',
        invLumBerry: 'lumBerry', invChestoBerry: 'chestoBerry', invRawstBerry: 'rawstBerry',
      };
      initInventory();
      for (const [oldKey, newKey] of Object.entries(OLD_MAP)) {
        if (data[oldKey] !== undefined) state.inventory[newKey] = data[oldKey];
      }
    }
    // Money: credit IS money now, read from save (backward compat: try data.money too)
    state.inventory['credit'] = data.inventory?.credit ?? data.money ?? 500;
    state.badges = data.badges || [];
    state.trainerNickname = data.trainerNickname || '';
    state.myTeam = data.myTeam || [];
    // Rehydrate team
    state.myTeam.forEach(m => {
      if (!m.uid) m.uid = generateUID();
      if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      if (!m.learnableMoves) m.learnableMoves = [];
      if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
      if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp || 50;
      if (!m.lastMoveCheckLevel) m.lastMoveCheckLevel = m.baseLevel || 1;
      // Clamp impossible levels (defense against data corruption)
      if (m.baseLevel > 100) m.baseLevel = 100;
      if (m.baseLevel < 1) m.baseLevel = 1;
      if (m.candiesEaten > 0 && m.baseLevel + m.candiesEaten > 100) m.candiesEaten = 100 - m.baseLevel;
    });
    state.currentPokemonIndex = data.currentPokemonIndex ?? null;
    state.pokedexSeen = new Set(data.pokedexSeen || []);
    state.pokedexCaught = new Set(data.pokedexCaught || []);
    state.quests = data.quests || [];
    state.questProgress = data.questProgress || {};
    state.completedQuests = data.completedQuests || [];
    state.npcQuestProgress = data.npcQuestProgress || {};
    state.completedNPCQuests = data.completedNPCQuests || [];
    state.tutorialStep = data.tutorialStep || 0;
    state.visitedLocations = new Set(data.visitedLocations || []);
    state.itemsUsedInBattle = data.itemsUsedInBattle || 0;
    state.itemHistory = data.itemHistory || [];
    state.pcBoxes = data.pcBoxes || [[]];
    // Rehydrate PC pokemon
    state.pcBoxes.forEach(box => box.forEach(m => {
      if (!m.uid) m.uid = generateUID();
      if (m.currentHp === undefined || m.currentHp < 0) m.currentHp = m.maxHp || 50;
      if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      // Migrate old _bredWith to hasBred
      if (m._bredWith !== undefined) { m.hasBred = m._bredWith.length > 0; delete m._bredWith; }
      if (m.hasBred === undefined) m.hasBred = false;
    }));
    // Migrate team pokemon too
    state.myTeam.forEach(m => {
      if (m._bredWith !== undefined) { m.hasBred = m._bredWith.length > 0; delete m._bredWith; }
      if (m.hasBred === undefined) m.hasBred = false;
    });
    state.daycareMons = data.daycareMons || [];
    state.daycareMons.forEach(e => { if (!e.mon.currentHp || e.mon.currentHp < 0) e.mon.currentHp = e.mon.maxHp || 50; });
    state.daycareEgg = data.daycareEgg || null;
    state.lastLocation = data.lastLocation || null;
    state.expShareActive = data.expShareActive || false;
    state.breedingPairs = data.breedingPairs || [];
    state.eggs = data.eggs || [];
    state.notifications = data.notifications || [];

    validateGameState();
    return true;
  } catch (e) {
    console.warn('Load failed - data corrupted', e);
    try { localStorage.setItem(lsKey('save_corrupted'), raw || ''); } catch (_) {}
    // Восстановление из резервной копии.
    // Использованный бэкап удаляется: иначе битый save_bak1 снова записывался бы
    // в save, loadGame() падал бы на нём же и уходил в бесконечную рекурсию
    // (в стеке это выглядит как переполнение и падение вкладки).
    for (const bak of ['save_bak1', 'save_bak2']) {
      try {
        const bakRaw = localStorage.getItem(lsKey(bak));
        if (!bakRaw) continue;
        const bakData = JSON.parse(bakRaw);
        if (!bakData.myTeam) continue;
        console.warn(`Recovered from ${bak}!`);
        showToast('Сохранение восстановлено из резервной копии!', false);
        localStorage.setItem(lsKey('save'), bakRaw);
        localStorage.setItem(lsKey('save_v'), String(bakData._v || 0));
        localStorage.removeItem(lsKey(bak));
        return loadGame(); // Retry with recovered data
      } catch (_) {}
    }
    return false;
  }
}

export function autoSave() {
  validateGameState();
  saveGame();
  cloudSave();
}

export function resetGame() {
  showConfirmModal('Сброс прогресса', 'Это действие необратимо! Вы уверены?', async () => {
    localStorage.removeItem(lsKey('save'));
    // Also clear cloud save so reload gives starter
    if (state.tgToken) {
      try {
        await apiFetch('/save', {
          method: 'POST',
          // saveVersion обязателен: без него сервер получает clientVersion = 0
          // и отвечает 409 для любого аккаунта, который хоть раз сохранился.
          body: JSON.stringify({
            saveData: { _v: Date.now(), starterGiven: false, myTeam: [], pcBoxes: [[]], inventory: { credit: 500 }, money: 500, badges: [] },
            money: 500,
            // reset: true — намеренный сброс. Без этого флага сервер отклонит
            // пустой сейв поверх непустого, и сброс просто не сработает.
            reset: true,
            saveVersion: Date.now(),
          })
        });
      } catch(e) { console.warn('Cloud reset failed', e); }
    }
    location.reload();
  });
}

export function cloudSave() {
  if (!state.tgToken) return;
  // Не сохраняем, пока игра не загрузилась. До этого момента state.myTeam пуст,
  // и такой сейв затирал бы реальный облачный прогресс. Исключение — сброс игры:
  // там пустое состояние задумано.
  if (!state.gameLoaded && !state.resetInProgress) return;
  // Абсолютный запрет: выкладывать состояние без покемонов, когда облако
  // уже содержит команду. Это последняя линия обороны после гонки при старте.
  if (isDegenerateState() && state.lastCloudHadTeam) {
    console.warn('[save] облачное сохранение пропущено: состояние без команды, а в облаке команда была. Не выкладываю, чтобы не затереть прогресс.');
    return;
  }
  // If a save is in flight, mark pending — it'll fire right after the current one
  if (state.saveInProgress) {
    state.saveTriggerPending = true;
    return;
  }
  doCloudSave();
}

/** Все покемоны игрока: команда, ПК, питомник, яйца. */
export function totalPokemonCount(): number {
  const pc = (state.pcBoxes || []).reduce((n, box) => n + (box?.length || 0), 0);
  return (state.myTeam?.length || 0) + pc + (state.daycareMons?.length || 0) + (state.eggs?.length || 0);
}

/** То же самое, но для сырых данных сейва — до того, как они применены. */
export function totalPokemonCountOf(data: any): number {
  if (!data) return 0;
  const pc = Array.isArray(data.pcBoxes) ? data.pcBoxes.reduce((n, b) => n + (b?.length || 0), 0) : 0;
  return (data.myTeam?.length || 0) + pc + (data.daycareMons?.length || 0) + (data.eggs?.length || 0);
}

/** Состояние без единого покемона — почти всегда потеря данных, а не новая игра. */
function isDegenerateState(): boolean {
  return totalPokemonCount() === 0;
}

export async function doCloudSave(attempt = 0) {
  if (state.saveInProgress) return; // already saving, coalesced call will pick it up
  state.saveInProgress = true;
  state.saveTriggerPending = false;

  let result: any = null;
  try {
    validateGameState();
    const saveData = getFullSaveData();
    const lb = getLeaderboardData();

    const res = await apiFetch('/save', {
      method: 'POST',
      body: JSON.stringify({ saveData, ...lb, saveVersion: state.saveVersion })
    });
    // 429 = rate limited — don't retry, just stop hammering the server
    if (res.status === 429) {
      console.warn('Cloud save rate-limited (429), backing off');
      const btnSync = document.getElementById('btn-cloud-sync');
      if (btnSync) { btnSync.textContent = '☁️✗'; setTimeout(() => { btnSync.textContent = '☁️ Авто'; }, 5000); }
      return null;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    result = await res.json();
    state.lastCloudSync = Date.now();
    state.saveRetryCount = 0;
    localStorage.setItem(lsKey('save_sync'), String(state.lastCloudSync));
    const btnSync = document.getElementById('btn-cloud-sync');
    if (btnSync) { btnSync.textContent = '☁️✓'; setTimeout(() => { btnSync.textContent = '☁️ Авто'; }, 1500); }
  } catch (e) {
    console.warn(`Cloud save failed (attempt ${attempt + 1}/${MAX_RETRIES})`, e.message);
    if (attempt < MAX_RETRIES - 1) {
      state.saveRetryCount = attempt + 1;
      const delay = RETRY_DELAYS[attempt];
      state.cloudSaveTimer = setTimeout(() => doCloudSave(attempt + 1), delay);
    } else {
      state.saveRetryCount = MAX_RETRIES;
      const btnSync = document.getElementById('btn-cloud-sync');
      if (btnSync) { btnSync.textContent = '☁️✗'; setTimeout(() => { btnSync.textContent = '☁️ Авто'; }, 3000); }
    }
  } finally {
    // Флаг обязан сбрасываться на ЛЮБОМ выходе, включая успешный.
    // Раньше успешная ветка делала return выше этой строки, и saveInProgress
    // залипал навсегда — облачный сейв переставал работать после первого успеха.
    state.saveInProgress = false;
  }

  // If another save was triggered while we were saving, fire it now
  if (state.saveTriggerPending) {
    state.saveTriggerPending = false;
    doCloudSave();
  }

  return result;
}

export async function cloudLoad() {
  if (!state.tgToken) return null;
  try {
    const res = await apiFetch('/save');
    if (!res.ok) return null;
    const data = await res.json();
    return data.saveData;
  } catch (e) {
    console.warn('Cloud load failed', e);
    return null;
  }
}

export async function applyCloudSave(data) {
  if (!data) return;
  if (!data.myTeam && !data.starterGiven) return;
  // Сравниваем с временем последнего УСПЕШНОГО облачного сохранения, а не с
  // временем последней локальной записи. Иначе saveGame(), вызванный сразу
  // после applyCloudSave, делал настоящий облачный сейв «старым» навсегда.
  if (data._ts) {
    const lastSync = parseInt(localStorage.getItem(lsKey('save_sync')) || '0');
    if (data._ts <= lastSync) return;
    console.log(`[sync] Server ts ${data._ts} > last sync ${lastSync} — applying server data`);
  } else {
    console.log(`[sync] No timestamp on server data — applying as authoritative`);
  }
  state.currentLocationId = data.currentLocationId || state.currentLocationId;
  state.currentRegion = data.currentRegion || state.currentRegion;
  if (state.currentRegion === 'tevas_islands') state.currentRegion = 'johto' // was southern_archipelago;
  if (!REGIONS[state.currentRegion]) state.currentRegion = 'johto';
  if (!(await getLocationLazy(state.currentLocationId))) {
    state.currentLocationId = 'goldenrodCity';
    state.currentRegion = 'johto';
  }
  if (data.inventory) {
    // inventory: полностью заменяем локальное облачным, т.к. data._ts > localTs (проверено выше)
    // Math.max merge приводил к дублированию предметов при облачной синхронизации
    state.inventory = { ...data.inventory };
  }
  // credit IS money — используем облачное значение (сервер — источник истины)
  const cloudCredit = data.inventory?.credit ?? data.money ?? 0;
  if (cloudCredit) state.inventory['credit'] = cloudCredit;
  state.badges = data.badges || state.badges;
  state.trainerNickname = data.trainerNickname || state.trainerNickname;
  // Флаг восстанавливается из сейва, иначе после перезагрузки он забывался бы
  // и игрок с пустой командой получил бы нового стартовика.
  if (typeof data.starterGiven === 'boolean') state.starterGiven = data.starterGiven;
  state.myTeam = data.myTeam || state.myTeam;
  state.myTeam.forEach(m => {
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.learnableMoves) m.learnableMoves = [];
    if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
    // Clamp impossible levels
    if (m.baseLevel > 100) m.baseLevel = 100;
    if (m.baseLevel < 1) m.baseLevel = 1;
    if (m.candiesEaten > 0 && m.baseLevel + m.candiesEaten > 100) m.candiesEaten = 100 - m.baseLevel;
    if (!m.lastMoveCheckLevel) m.lastMoveCheckLevel = m.baseLevel || 1;
  });
  state.currentPokemonIndex = data.currentPokemonIndex ?? state.currentPokemonIndex;
  state.pokedexSeen = new Set(data.pokedexSeen || []);
  state.pokedexCaught = new Set(data.pokedexCaught || []);
  state.pcBoxes = data.pcBoxes || state.pcBoxes;
  state.pcBoxes.forEach(box => box.forEach(m => {
    if (!m.statStages) m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    if (!m.learnableMoves) m.learnableMoves = [];
    if (!m.movesPP) m.movesPP = [];
    if (!m.berries) m.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };
    if (!m.lastMoveCheckLevel) m.lastMoveCheckLevel = m.baseLevel || 1;
  }));
  state.daycareMons = data.daycareMons || state.daycareMons;
  state.daycareEgg = data.daycareEgg || state.daycareEgg;
  state.lastLocation = data.lastLocation || state.lastLocation;
  state.expShareActive = data.expShareActive || state.expShareActive;
  state.breedingPairs = data.breedingPairs || state.breedingPairs;
  state.eggs = data.eggs && data.eggs.length > 0 ? data.eggs : state.eggs;
  state.quests = data.quests || state.quests;
  state.questProgress = data.questProgress || state.questProgress;
  state.completedQuests = data.completedQuests || state.completedQuests;
  state.npcQuestProgress = data.npcQuestProgress || state.npcQuestProgress;
  state.completedNPCQuests = data.completedNPCQuests || state.completedNPCQuests;
  state.tutorialStep = data.tutorialStep || state.tutorialStep;
  state.visitedLocations = new Set(data.visitedLocations || []);
  state.itemsUsedInBattle = data.itemsUsedInBattle || state.itemsUsedInBattle;
  state.itemHistory = data.itemHistory || state.itemHistory;
  const cloudV = data._v;
  state.saveVersion = cloudV !== undefined ? cloudV : Date.now();
  validateGameState();

  // Save reconciled state locally
  saveGame();
  console.log('[sync] Applied server save v' + cloudV);
}

export async function openLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  const list = document.getElementById('leaderboard-list');
  if (!modal) return;

  modal.style.display = 'flex';
  list.innerHTML = '<div class="leaderboard-loading">Загрузка...</div>';

  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const data = await res.json();

    if (!data.entries || data.entries.length === 0) {
      list.innerHTML = '<div class="leaderboard-empty">Таблица лидеров пуста</div>';
      return;
    }

    let html = '';
    const escHtml = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    data.entries.forEach((entry, i) => {
      let medal = String(i + 1);
      if (i === 0) medal = '🥇';
      else if (i === 1) medal = '🥈';
      else if (i === 2) medal = '🥉';
      const name = entry.trainerNickname || entry.first_name || entry.username || `Trainer#${entry.userId}`;
      const pkmn = entry.pokemon_count || 0;
      const leg = entry.legendary_count || 0;

      html += `
        <div class="leaderboard-entry">
          <span class="leaderboard-rank">${medal}</span>
          <span class="leaderboard-name">${escHtml(name)}</span>
          <span class="leaderboard-badges">🏅${entry.badges_count}</span>
          <span class="leaderboard-stat">🐾${pkmn}</span>
          <span class="leaderboard-stat">✨${leg}</span>
          <!-- money removed from leaderboard -->
        </div>`;
    });
    list.innerHTML = html;
  } catch (e) {
    list.innerHTML = '<div class="leaderboard-error">Не удалось загрузить таблицу лидеров</div>';
  }
}

export function initCloudEvents() {
  const btnLeaderboard = document.getElementById('btn-leaderboard');
  if (btnLeaderboard) {
    btnLeaderboard.addEventListener('click', openLeaderboard);
  }
  const btnSync = document.getElementById('btn-cloud-sync');
  if (btnSync) {
    btnSync.textContent = state.tgToken ? '☁️ Авто' : '☁️ —';
    btnSync.title = state.tgToken ? 'Авто-синхронизация активна' : 'Оффлайн';
    btnSync.onclick = null; // auto-sync, no manual click needed
  }
  const closeLeaderboard = document.getElementById('btn-close-leaderboard');
  if (closeLeaderboard) {
    closeLeaderboard.addEventListener('click', () => {
      document.getElementById('leaderboard-modal').style.display = 'none';
    });
  }
}
