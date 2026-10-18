// ─────────────────────────────────────────────────────────────
// core.ts — ДВИЖОК БОЯ (2927 строк)
// ─────────────────────────────────────────────────────────────
// Это самый большой файл проекта. Он содержит ВСЮ логику боя:
//   - Поиск/встреча диких покемонов (startHunt, autoHunt)
//   - Атаки игрока (useMove) и противника (enemyTurn)
//   - Система статусов (яд/ожог/паралич/сон/заморозка)
//   - Ягоды (berry auto-use)
//   - Баффы/барьеры (Reflect, Light Screen, Protect, Substitute)
//   - Смена покемона (switchPokemon)
//   - Поимка (catch formula)
//   - EXP и эволюция после победы
//   - Сражения с лидерами залов (gym)
//   - Элитная Четвёрка (elite four)
//   - Чемпион (champion)
//   - Квесты (quest tracking, проверка прогресса)
//   - Сохранение/восстановление состояния боя (save/restore)
//
// Использует:
//   logic.ts     — чистые функции: calculateDamage, getTypeMultiplier, checkAccuracy и т.д.
//   ai.ts        — selectEnemyMove — AI выбор атаки противника
//   state.ts     — глобальное состояние игры (GS — Proxy к нему)
//   store.ts     — игровая логика: giveReward, updateInventoryDisplay
//   state-machine.ts — BattleStateMachine, управление фазами боя
//   utils/*.ts   — DOM, спрайты, API, UID
//   data/*.ts    — погода, квесты, натуры, предметы
//   ui/*.ts      — эволюция, новые атаки, инвентарь
//
// Экспортирует:
//   battle, saveBattleState, restoreBattleState, useMove, enemyTurn,
//   startHunt, startAutoHunt, switchPokemon, openGymModal,
//   startGymBattle, startEliteBattle, championBattle, и много утилит
// ─────────────────────────────────────────────────────────────

// ── ИМПОРТЫ ─────────────────────────────────────────────────
// Каждый импорт — это внешний модуль, от которого зависит core.ts.
// Все ui/* импорты — это DOM-манипуляции (кнопки, модалки).
// Все data/* импорты — статические конфиги (погода, предметы).
import { showToast, showSelectionModal, showConfirmModal } from '../utils/dom.js';         // showToast — всплывающее уведомление; showSelectionModal — модалка выбора из списка
import { itemDef } from '../utils/items.js';
import { recordDrop } from '../ui/drop-log.js';                              // itemDef(id) → { nameRu, price, ... } — данные предмета по ID
import { getSpriteUrl, updateBattleSpriteBgs, isShinyMon } from '../utils/sprite.js'; // getSpriteUrl — URL спрайта покемона; updateBattleSpriteBgs — фон битвы
import { fetchPokeAPI } from '../utils/api.js';                          // fetchPokeAPI — GET к PokeAPI с кэшированием
import { fetchSiteMoveDetail } from '../data/sitemove.js';              // детали атак — с сайта лиги
import {
  fetchSiteLearnset, wildMovesFromLearnset, moveNameToSlug,
} from '../data/learnset.js';                                           // мувсеты по уровню: таблица «Развитие»
import { loadPowerTable, encounterWeightFor, loadEvoTable } from '../data/power.js';   // сила вида → редкость появления
import { syntheticTackle } from './logic.js';                             // фолбэк-атака для дикого
import { rollWildIVs, perfectIVs } from './logic.js';                   // гены: усреднённые дикие / идеальные лидеры
import { apiFetch } from '../game/apiClient.js';                        // apiFetch — центральный HTTP-клиент с JWT
import { checkEvolution, triggerEvolution, maybeGrantShedinja } from '../ui/evolution.js';   // Эволюция: проверка и запуск анимации
import { natures } from '../data/natures.js';                            // Массив характеров (nature) с buff/nerf модификаторами
import { ITEMS } from '../data/items.js';                                // Массив всех предметов игры (ItemDef[])
import { getAbilityNameRu } from '../data/abilities.js';                 // Русские названия способностей для UI
import { checkNewMovesOnLevelUp } from '../ui/levelup_moves.js';         // Проверка новых атак при повышении уровня
// Импорт чистых функций из logic.ts — все БЕЗ сайд-эффектов, работают с переданными данными
import { calculateDamage, getTypeMultiplier, checkAccuracy, isStatusImmune, checkSuckerPunchFail, checkSturdy, TYPE_CHART, SOUND_MOVES, GEM_TYPE } from './logic.js';
import { isChargeMove, isOhkoMove, getFixedDamage, getMultiHitCount, calcDrainHeal, calcRecoilDamage, calcHealAmount, calcHpCost, effectiveSecondaryChance, decideMoveOrder, counterDamage, weightPowerKg, heavySlamPower, pokeWeightKg, gyroBallPower, electroBallPower, beatUpHits, beatUpPower, baseAttackOf, baseDefOf, effectivePowerMove, isSemiInvuln, canHitHidden, hideVerb, needsRecharge, healPulseAmount, bideRelease, BIDE_TURNS, falseSwipeClamp, crushGripPower, flailPower, finalGambitDmg, flingPower, naturalGift, presentRoll, spitUpPower, swallowPct, lastRespectsPower, rageFistPower, populationBombHits, confuseChance, confusionTurns, confusionSelfHit, confusionDamage, attractBlocks, tauntBlocks, encoreForces, disableBlocks, tormentBlocks, perishTick, yawnWakes, WEATHER_SET, TERRAIN_SET, FIELD_TURNS, TAILWIND_TURNS, TRICK_ROOM_TURNS, collisionCourseMult, saltCureChip, resistantType, METRONOME_POOL, metronomePick, meFirstCopy, ALWAYS_CRIT, normMoveName, TERRAIN_SEEDS, TERRAIN_SEED_STAT, trapTurns, clearLeechSeedFlags, clearMonBattleFlags, restoreMonAbility, applyDrainHeal, drainPctOf, isForcedFleeMove, canEscapeFromTrap, isTrapChipMove, isHeldByTrap, tickTrapBind, clearTrapState, calcCatchExp } from './special-moves.js';
import { calculateStat as calculateStatShared } from './stats.js';
import { HEAL_HP, CURE_ONE, CURE_ALL } from '../data/item-effects.js';  // аудит итемов: общие таблицы с рюкзаком
import { selectEnemyMove } from './ai.js';                               // AI: выбирает атаку для противника на основе ситуации
import { store } from '../game/store.js';
import { trackNPCQuests } from '../game/quest-track.js';     // Гринд-квесты NPC: тот же движок событий
import { allNPCQuests, findQuestHolder, locName, questHowTo, questRewards, verifyQuest } from '../game/quest-track.js'; // Вкладка активных NPC-квестов в модалке
import { checkAchievement } from '../ui/achievements.js';                                 // store — центральная игровая логика (giveReward, autoSave, updateInventoryDisplay, addItem, removeItem)
import { state } from '../game/state.js';                                 // state — глобальное состояние игры (инвентарь, команда, локация)
import { generateUID, getTrainerId, LEGENDARY_SET } from '../utils/state.js';           // generateUID — уникальный ID для пойманного покемона; getTrainerId — ID тренера
import { itemCategory } from '../utils/items.js';                        // itemCategory(id) → категория предмета (healing, ball, statusCure...)
import { getHeldItemName } from '../ui/inventory.js';                    // getHeldItemName — русское название предмета для сообщений
import { WEATHER_ICONS, WEATHER_NAMES, getDailyWeather } from '../data/weather.js'; // Погода: конфиги, иконки, имена, дневная погода по локации, множитель урона
import { QUEST_CONFIGS } from '../data/quests.js';                       // Все конфиги квестов (заданий)
import { addNotification } from '../ui/notifications.js';                // Уведомления (реальный импорт: notifications зависит только от state/store, цикла нет)

// ── УДАЛЁННЫЕ ФИКТИВНЫЕ ДЕКЛАРАЦИИ ─────────────────────
// Здесь стояли `declare const pcBoxes` / `declare function addNotification` /
// `declare function updateBadgeDisplay` с комментом «глобалы из main.ts».
// main.ts их не определяет — это были type-only декларации без рантайм-привязки:
// первое же обращение бросало ReferenceError. Симптомы: зависание поимки 7-го
// покемона (pcBoxes.length) и зависание победы в зале (updateBadgeDisplay).
// pcBoxes берётся из GS, addNotification импортирован выше, updateBadgeDisplay
// подтягивается динамическим импортом в местах вызова (location.js тянет core
// только динамически — статика сюда дала бы цикл).

// ── СОЗДАНИЕ КОНЕЧНОГО АВТОМАТА ────────────────────────────
// BattleStateMachine — класс из state-machine.ts, управляющий фазами боя.
// Это singleton — один инстанс на весь бой.
// Экспортируется для тестов (могут создать свой через BattleStateMachine.create())
import { BattleStateMachine, BattlePhase, recoverStuckTurn, leaveBattleToIdle, ensurePlayerTurnAfterFaint } from './state-machine.js';
import { getEncounterRate, effectiveEncounterRate, tickEncounterCounters } from '../data/encounter.js';  // листовой модуль — цикла нет
import { specialMechanic, towerLevel, encounterRateFor } from './special-loc.js';  // M-4: механики пещер/башен

/** Singleton state machine — единый автомат фаз для всего боя */
export const battle = new BattleStateMachine();

/**
 * S = battle.state — сокращение для быстрого доступа к состоянию боя.
 * Все прямые мутации S.xxx = yyy видны везде, т.к. это ссылка на объект.
 */
const S = battle.state;

// ── GS — PROXY К ГЛОБАЛЬНОМУ СОСТОЯНИЮ ────────────────────
// GS.get('currentLocationId') → state.currentLocationId
// GS.set('itemsUsedInBattle', 5) → state.itemsUsedInBattle = 5
// Это lazy Proxy: при первом доступе инициализирует _gsCache из центрального state.
// Нужен чтобы core.ts не требовал реимпорта state при каждом изменении.
let _gsCache = null;
const GS = new Proxy({} as Record<string, any>, {
  get(_, prop) {
    if (!_gsCache) _gsCache = state; // Первый доступ — кешируем ссылку на глобальное состояние
    return _gsCache[prop];
  },
  set(_, prop, value) {
    if (!_gsCache) _gsCache = state;
    _gsCache[prop] = value;
    return true;
  }
});
/** Инициализировать кеш GS — вызывается при старте боя */
function initBattleRefs() { _gsCache = state; }

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 1: СОХРАНЕНИЕ/ВОССТАНОВЛЕНИЕ СОСТОЯНИЯ БОЯ
// ═══════════════════════════════════════════════════════════════
// Сохраняет и восстанавливает бой через localStorage, чтобы при обновлении
// страницы (F5) бой не пропадал. Ключ: store.lsKey('battle_state').
//
// Куда сохраняет: localStorage браузера (сериализованный JSON).
// Когда вызывается: после каждого действия в бою (атака, смена, предмет).
// Когда очищается: после победы/поражения/выхода.
// Как восстанавливается: в init.ts при старте игры проверяет restoreBattleState().
// ─────────────────────────────────────────────────────────────

/**
 * saveBattleState — сохранить текущее состояние боя в localStorage.
 * Запоминает: тип боя, текущего покемона игрока (HP, PP, статы),
 * дикого покемона (имя, HP, уровень, статус), погоду, барьеры,
 * прогресс гима/элиты/чемпиона.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Собирает плоский объект state из battle.state + GS
 *   2. Сериализует в JSON
 *   3. Пишет в localStorage по ключу store.lsKey('battle_state')
 *
 * КОГДА ВЫЗЫВАЕТСЯ:
 *   - После каждого хода в useMove() (строка ~1539)
 *   - После каждого хода врага в enemyTurn() (строка ~1850)
 *   - После смены покемона
 *   - После использования предмета в бою
 *
 * ЗАВИСИМОСТИ:
 *   store.lsKey() — генерация ключа с префиксом (чтобы не пересекаться с другими сохранениями)
 *   GS.currentLocationId — ID текущей локации (проверяется при restore)
 *   GS.myTeam — команда игрока (индекс activeMonIndex)
 */
function saveBattleState() {
  const s = battle.state;
  if (!s.battleType || s.battleType === 'none') {
    // Раньше этот случай просто пропускался молча, из-за чего «бой не
    // сохраняется» выглядело как загадка. Теперь видно, что именно не так.
    console.warn(`[battle] saveBattleState: battleType не задан (${s.battleType}) — состояние не пишется`);
    return;
  }
  const state: Record<string, any> = {};
  state.battleType = s.battleType;                           // Тип боя: 'wild' | 'gym' | 'elite' | 'champion' | 'pvp'
  state.locationId = GS.currentLocationId;                   // Локация (без неё restore не сработает — защита от загрузки сохранения на другой локации)
  state.activeMonIndex = GS.myTeam.indexOf(s.activePlayerMon); // Индекс активного покемона в команде
  state.activeMonCurHP = s.activePlayerMon?.currentHp;       // Текущее HP (восстанавливается в restore)
  state.activeMonMovesPP = s.activePlayerMon?.movesPP;       // PP атак (восстанавливается)
  state.activeMonStatStages = s.activePlayerMon?.statStages; // Стат-стадии (баффы/дебпфы)
  state.activeMonChoiceLocked = s.activePlayerMon?.choiceLockedMove; // Заблокированная атака (Choice-предметы)
  state.currentWeather = s.currentWeather;                    // Текущая погода
  state.escapeAttempts = s.escapeAttempts;                    // Попытки побега счётчик
  state.battleRound = s.battleRound;                          // Номер раунда (для Timer Ball, Quick Ball и т.д.)
  state.itemsUsedInBattle = GS.itemsUsedInBattle;             // Сколько предметов уже использовано
  state.playerReflectTurns = s.playerReflectTurns;            // Осталось ходов Reflect у игрока
  state.playerLightScreenTurns = s.playerLightScreenTurns;    // Осталось ходов Light Screen у игрока
  state.enemyReflectTurns = s.enemyReflectTurns;              // Осталось ходов Reflect у противника
  state.enemyLightScreenTurns = s.enemyLightScreenTurns;      // Осталось ходов Light Screen у противника
  state.playerChargedMove = s.playerChargedMove;        // Двух-ходовые атаки (заряд/выпуск)
  state.enemyChargedMove = s.enemyChargedMove;          // Двух-ходовые атаки (заряд/выпуск)
  if (s.activeWild) {
    state.wildPkmName = s.activeWild.name;       // Имя дикого покемона (для повторной загрузки из PokeAPI)
    state.wildCurHP = s.wildCurHP;               // Текущее HP дикого
    state.wildMaxHP = s.wildMaxHP;               // Макс HP дикого
    state.wildLvl = s.wildLvl;                   // Уровень дикого
    state.wildStatus = s.wildStatus;             // Статус дикого (psn/brn/par/slp/frz)
    state.wildSleepTurns = s.wildSleepTurns;     // Осталось ходов сна
    state.wildMovesPP = s.wildMovesPP;           // PP атак дикого
    state.wildMovesDetailed = s.wildMovesDetailed; // Детальные данные атак дикого
    state.wildIsShiny = s.activeWild.isShiny;    // Шайни флаг (для корректного спрайта при restore)
  }
  if ((s.battleType === 'gym' || s.battleType === 'elite' || s.battleType === 'champion') && s.gymTeamData) {
    state.gymLeaderKey = s.gymLeaderKey;           // ID лидера зала (из gyms.ts)
    state.gymTeamIndex = s.gymTeamIndex;           // Какой по счёту гимец
    state.gymTeamIndexInMember = s.gymTeamIndexInMember; // Индекс внутри Элитного члена
    state.gymTeamData = s.gymTeamData;             // Клонированная команда лидера
  }
  // Раньше здесь стоял пустой `catch`, из-за которого любая ошибка записи
  // выглядела как «бой просто не сохраняется»: ни записи в консоли, ни
  // последствий. Самая вероятная причина — QuotaExceededError: состояние боя
  // вместе с wildMovesDetailed весит заметно больше обычного сейва, и при
  // заполненном localStorage setItem бросает исключение.
  try {
    localStorage.setItem(store.lsKey('battle_state'), JSON.stringify(state));
  } catch (e: any) {
    const quota = e?.name === 'QuotaExceededError' || e?.code === 22;
    console.warn(
      `[battle] не удалось сохранить состояние боя: ${e?.name || e}` +
      (quota ? ' — localStorage переполнен. Бой пропадёт при перезагрузке.' : ''),
    );
  }
}

/**
 * resetBattleField — чистый лист на старт боя (фикс утечек состояния).
 * Поле (террейн/комнаты/ветер/туман), последние ходы, заточения и ВСЁ
 * волатильное команды не должны жить между боями: иначе Trick Room
 * прошлого боя ломает следующий, а trapped/perish висят на покемонах.
 * Статусы/сон/стадии не трогаем (существующее поведение).
 */
function resetBattleField() {
  S.terrain = null;
  // Боевые подмены способностей живут только до конца боя (Trace/Mummy/…).
  S.tempAbilityP = null;
  S.tempAbilityW = null;
  S.tailwindP = 0; S.tailwindW = 0;
  S.trickRoomTurns = 0;
  S.weatherTurns = 0;
  S.gravityTurns = 0;
  S.magicRoomTurns = 0;
  S.mistP = 0; S.mistW = 0;
  S.safeguardP = 0; S.safeguardW = 0;
  S.luckyP = 0; S.luckyW = 0;
  S.imprisonP = []; S.imprisonW = [];
  S.lastTakenByPlayer = null; S.lastTakenByWild = null;
  S.wildTookHit = false; S.playerTookHit = false;
  S.wildTookCat = null; S.playerTookCat = null;
  S.lastMoveUsed = null; S.lastMoveUsedDetail = null;
  S.lastPlayerMove = null; S.lastPlayerMoveDetail = null;
  S.lastWildMove = null; S.lastWildMoveDetail = null;
  S.pendingHeal = null;
  S.playerActedRound = -1;
  // Жалоба 2: сид жил между боями — чистим здесь (старт нового боя).
  clearLeechSeedFlags(S);
  // Жалоба 3: кеш хода врага и прочий мусор не должны течь в следующий бой.
  S.enemyChosenMove = null;
  for (const m of (GS.myTeam || [])) {
    if (!m) continue;
    // Жалоба 6: ловушки/чипы/соль чистятся вместе с vol (см. clearMonBattleFlags).
    clearMonBattleFlags(m);
    // Жалоба 3: сменённые в бою способности возвращаем (skill-swap/mummy/...).
    // Статусы/сон/стадии не трогаем (существующее поведение).
    try { restoreMonAbility(m); } catch (_) {}
    m.vol = {};
    m.typeOverride = null;
    m.lockedOn = false;
    m.recharging = false;
    m.hiddenIn = null;
    m.bide = null;
    m.stock = 0;
    m.rageHits = 0;
    m.turnsOut = 0;
    m.consumeHeldAfterHit = null;
    m.payDayHits = 0;
    m.shieldPunish = null;
    m.laserFocus = false;
    m.focusEnergy = false;
    m.trapped = false;
    m.flinch = false;
    m.truantSkip = false;
    m.slowStartTurns = 0;
    m.choiceLockedMove = undefined;
  }
  S.playerChargedMove = null;
  S.enemyChargedMove = null;
}

/**
 * clearBattleState — удалить сохранённое состояние боя из localStorage.
 * Вызывается после победы, поражения или выхода из боя.
 * Также очищает барьеры/экраны через clearScreens().
 */
function clearBattleState() {
  try { localStorage.removeItem(store.lsKey('battle_state')); } catch(e) {}
  clearScreens(); // Сбросить все барьеры (Reflect, Light Screen, Protect, Substitute)
  // Жалоба 2: сид не должен жить после конца боя (и на старте нового — см. resetBattleField).
  try { clearLeechSeedFlags(S); } catch (_) {}
  // Жалоба 6: ловушка/шип на активном не должны залипать после конца боя.
  try {
    if (S.activePlayerMon) clearTrapState(S.activePlayerMon);
    if (S.activeWild) clearTrapState(S.activeWild);
  } catch (_) {}
  // Бой кончился по-настоящему (победа/поражение/побег/поимка/выход), а не переход
  // между покемонами лидера (там clear не вызывается). Если автоохота была
  // включена, поднимаем цикл заново: на обычной сессии тики идут всё время и
  // сами подхватывают гринд, а после restore-на-загрузке старта охоты не было —
  // без этого гринд вставал бы до ручного тумблера.
  try {
    if (localStorage.getItem(store.lsKey('hunt_active')) === '1' && !S.huntActive) {
      const team = GS.myTeam || [];
      if (team.some((m) => m && m.currentHp > 0)) startAutoHunt();
    }
  } catch (_) {}
}

/**
 * restoreBattleState — восстановить бой после обновления страницы (F5).
 *
 * ЧТО ДЕЛАЕТ (пошагово):
 *   1. Читает JSON из localStorage
 *   2. Проверяет что сохранение валидно (локация совпадает, покемон жив)
 *   3. Восстанавливает игрока: HP, PP, стат-стадии, Choice-лок
 *   4. Если wild — загружает дикого покемона из PokeAPI, восстанавливает всё его состояние
 *   5. Если gym/elite — загружает дикого + инфу лидера
 *   6. Рендерит UI, загружает кнопки атак, переводит фазу в PLAYER_TURN
 *   7. Возвращает true если восстановление успешно, false если нет
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   init.ts → store.ready → проверяет сохранённый бой и вызывает restoreBattleState
 *   Если вернёт true — игрок продолжает бой (не нужно начинать заново)
 *
 * ВАЖНО: локация проверяется на совпадение, чтобы после телепорта не загрузить
 * чужого покемона. Если локация не совпадает — сохранение удаляется.
 *
 * ЗАВИСИМОСТИ:
 *   fetchPokeAPI — загрузка данных покемона из PokeAPI
 *   GS.myTeam — команда игрока (проверка индекса)
 *   GS.currentLocationId — текущая локация (проверка совпадения)
 *   renderBattleUI, loadMoveButtons — рендер UI
 *   battle.forcePhase — принудительная установка фазы (без валидации)
 */
async function restoreBattleState() {
  let state;
  try {
    const raw = localStorage.getItem(store.lsKey('battle_state'));
    if (!raw) return false;
    state = JSON.parse(raw);
  } catch(e) { return false; }

  // ── Валидация сохранения ──
  // Проверяем что сохранение соответствует текущей локации.
  // Если игрок переместился — сохранение невалидно (очищаем).
  if (!state.battleType || !state.locationId || state.locationId !== GS.currentLocationId) {
    clearBattleState();
    return false;
  }

  // ── Восстановление активного покемона игрока ──
  // Находим покемона в команде по индексу, проверяем что он жив
  const activeIdx = state.activeMonIndex;
  if (activeIdx === undefined || activeIdx < 0 || activeIdx >= GS.myTeam.length) return false;
  const mon = GS.myTeam[activeIdx];
  if (!mon || mon.currentHp <= 0) return false;

  // Restore player mon state — восстанавливаем поля из сохранения
  S.activePlayerMon = mon;
  mon.currentHp = state.activeMonCurHP;
  if (state.activeMonMovesPP) mon.movesPP = state.activeMonMovesPP;
  if (state.activeMonStatStages) mon.statStages = state.activeMonStatStages;
  if (state.activeMonChoiceLocked !== undefined) mon.choiceLockedMove = state.activeMonChoiceLocked;

  S.battleType = state.battleType;                            // Восстанавливаем тип боя
  S.currentWeather = state.currentWeather || getDailyWeather(GS.currentLocationId); // Погода или дневная по умолчанию
  S.escapeAttempts = state.escapeAttempts || 0;              // Попытки побега
  S.battleRound = state.battleRound || 0;                    // Номер раунда
  GS.itemsUsedInBattle = state.itemsUsedInBattle || 0;       // Сколько предметов использовано
  S.playerReflectTurns = state.playerReflectTurns || 0;      // Ходов Reflect
  S.playerLightScreenTurns = state.playerLightScreenTurns || 0; // Ходов Light Screen
  S.enemyReflectTurns = state.enemyReflectTurns || 0;        // Ходов Reflect врага
  S.enemyLightScreenTurns = state.enemyLightScreenTurns || 0; // Ходов Light Screen врага
  S.playerChargedMove = state.playerChargedMove || null;      // Заряд двух-ходовой атаки игрока
  S.enemyChargedMove = state.enemyChargedMove || null;        // Заряд двух-ходовой атаки врага

  // ── Восстановление gym/elite/champion данных ──
  // Если бой с лидером зала — восстанавливаем индекс, ключ, данные команды
  if ((S.battleType === 'gym' || S.battleType === 'elite' || S.battleType === 'champion') && state.gymTeamData) {
    S.gymLeaderKey = state.gymLeaderKey || null;
    S.gymTeamIndex = state.gymTeamIndex || 0;
    S.gymTeamIndexInMember = state.gymTeamIndexInMember || 0;
    S.gymTeamData = state.gymTeamData;
  }

  // ── Восстановление дикого покемона (wild) ──
  // Загружаем из PokeAPI по имени, восстанавливаем HP/статус/PP/IVs
  if (S.battleType === 'wild' && state.wildPkmName) {
    try {
      S.activeWild = await fetchPokeAPI(`pokemon/${state.wildPkmName.toLowerCase()}`);
      GS.pokedexSeen.add(S.activeWild.name);                // Добавляем в покедекс (заметили)
      S.activeWild.isShiny = state.wildIsShiny || false;     // Восстанавливаем шайни-флаг

      // ── Загрузка species (вид) для catch rate ──
      // Нужно чтобы при поимке использовался правильный capture_rate
      try {
        const speciesRes = await fetch(S.activeWild.species.url);
        const speciesData = await speciesRes.json();
        S.activeWild.captureRate = speciesData.capture_rate;
        S.activeWild.speciesData = speciesData;
      } catch(e) {} // Если species не загрузился — используем дефолтный capture_rate = 100

      S.wildLvl = state.wildLvl;                              // Уровень
      S.wildMaxHP = state.wildMaxHP;                          // Макс HP
      S.wildCurHP = state.wildCurHP;                          // Текущее HP
      S.wildStatus = state.wildStatus;                        // Статус
      S.wildSleepTurns = state.wildSleepTurns || 0;           // Ходов сна
      S.wildMovesPP = state.wildMovesPP || [];                // PP атак
      S.activeWild.status = S.wildStatus;                     // Синхронизируем статус в объект
      S.activeWild.heldItem = null;                           // У дикого нет предмета (сбрасываем)
      S.activeWild.berries = { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 }; // Ягоды пусты

      // ── Загрузка атак дикого ──
      // Если в сохранении есть детальные данные атак — используем их.
      // Иначе загружаем из PokeAPI (до 20 атак).
      if (state.wildMovesDetailed && state.wildMovesDetailed.length > 0) {
        S.wildMovesDetailed = state.wildMovesDetailed;
      } else {
        S.wildMovesDetailed = await resolveWildMoveset(S.activeWild, S.wildLvl);
      }

      // ── IVs дикого (если нет — генерируем случайные 0–31) ──
      if (!S.activeWild.wildIVs) {
        S.activeWild.wildIVs = rollWildIVs();
      }

      renderBattleUI();                                       // Отрисовываем интерфейс боя
      loadMoveButtons(S.activePlayerMon, useMove);            // Загружаем кнопки атак

      // ── Показываем интерфейс ──
      document.getElementById('encounter-modal').style.display = 'flex';
      document.getElementById('battle-main-menu').style.display = 'flex';
      document.getElementById('battle-end-menu').style.display = 'none';
      document.getElementById('battle-gym-info').style.display = 'none';

      appendToLog('⚡ Битва восстановлена!', true);            // Очищаем лог и пишем сообщение
      appendToLog(`Дикий ${S.activeWild.name.toUpperCase()} всё ещё здесь!`, false, 'battle');

      // ── Принудительно ставим фазу PLAYER_TURN ──
      // Нужно чтобы атаки игрока работали (useMove проверяет canTransition)
      battle.forcePhase(BattlePhase.PLAYER_TURN);
      return true;
    } catch(e) {
      console.error('Failed to restore wild battle:', e);
      clearBattleState();
      return false;
    }
  }

  // ── Восстановление GYM/ELITE/CHAMPION боя ──
  if ((S.battleType === 'gym' || S.battleType === 'elite' || S.battleType === 'champion') && S.gymTeamData && state.wildPkmName) {
    try {
      S.activeWild = await fetchPokeAPI(`pokemon/${state.wildPkmName.toLowerCase()}`);
      S.wildLvl = state.wildLvl;
      S.wildMaxHP = state.wildMaxHP;
      S.wildCurHP = state.wildCurHP;
      S.wildStatus = state.wildStatus;
      S.wildSleepTurns = state.wildSleepTurns || 0;
      S.wildMovesPP = state.wildMovesPP || [];
      S.activeWild.status = S.wildStatus;

      // ── Загрузка атак (из сохранения или PokeAPI) ──
      if (state.wildMovesDetailed && state.wildMovesDetailed.length > 0) {
        S.wildMovesDetailed = state.wildMovesDetailed;
      } else {
        S.wildMovesDetailed = await resolveWildMoveset(S.activeWild, S.wildLvl);
      }

      // ── Данные лидера зала ──
      const leader = S.gymLeaderKey ? GS.gymLeaders[S.gymLeaderKey] : null;
      const leaderName = leader?.name || 'Лидер';

      renderBattleUI();
      loadMoveButtons(S.activePlayerMon, useMove);

      // ── Показываем UI с инфой о лидере ──
      document.getElementById('encounter-modal').style.display = 'flex';
      document.getElementById('battle-main-menu').style.display = 'flex';
      document.getElementById('battle-end-menu').style.display = 'none';
      document.getElementById('battle-gym-info').style.display = 'block';
      document.getElementById('gym-leader-battle-name').innerText = `Лидер: ${leaderName}`;
      document.getElementById('battle-gym-info').querySelector('.reborn-gym-training')?.remove();
      document.getElementById('battle-gym-info').style.display = 'block';

      appendToLog('⚡ Битва восстановлена!', true);
      appendToLog(`${leaderName} всё ещё ждёт вас!`, false, 'battle');

      battle.forcePhase(BattlePhase.PLAYER_TURN);
      return true;
    } catch(e) {
      console.error('Failed to restore gym battle:', e);
      clearBattleState();
      return false;
    }
  }

  return false; // Если ни одно условие не подошло — восстановление не удалось
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 2: UI БОЯ И СТАТИСТИКИ
// ═══════════════════════════════════════════════════════════════
// renderBattleUI — обновляет весь DOM боя (имена, спрайты, HP, абилки).
// calculateStat — вычисляет реальную характеристику покемона с учётом:
//   Базовых статов → IV → EV → Натура → Стат-стадии → Предметы
// ─────────────────────────────────────────────────────────────

/** renderBattleUI — полный рендер интерфейса боя */
function renderBattleUI() {
  // ── Дикий покемон ──
  document.getElementById('wild-name').innerText = `${isShinyMon(S.activeWild) ? '✨' : ''}${S.activeWild.name}`;                         // Имя дикого
  document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl}`;                            // Уровень
  const wildSpriteUrl = getSpriteUrl({ isShiny: S.activeWild.isShiny, apiData: S.activeWild }); // Спрайт (с учётом шайни)
  (document.getElementById('wild-sprite') as HTMLImageElement).src = wildSpriteUrl;            // Вставляем в DOM
  document.getElementById('wild-status-icon').innerText = getStatusIcon(S.wildStatus);         // Иконка статуса (☠️🔥⚡💤❄️)
  updateWildHpUI();                                                                            // HP бар

  // ── Покемон игрока ──
  document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
  (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
  document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
  updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);  // Фон битвы (зависит от типов покемонов)
  updatePlayerHpUI();                                        // HP бар + EXP бар игрока
  updateAbilityDisplay();                                    // Способности (Ability)
}

/**
 * Максимальное значение IV — 50 (решение хозяина, блок C5).
 * IV (Individual Values) — индивидуальные значения, влияют на статы.
 */

/**
 * calculateStat — вычислить реальное значение характеристики покемона.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Берёт базовый стат из PokeAPI
 *   2. Применяет IV (0-50 для игрока, 0-50 для дикого)
 *   3. Применяет EV (только для покемонов игрока)
 *   4. Применяет натуру (buff/nerf, только не-HP)
 *   5. Применяет стат-стадии (-6 до +6, множитель 2/2..8/2)
 *   6. Применяет предметы (Choice Band, Eviolite, Assault Vest, Thick Club)
 *
 * Расчёт характеристики. Реализация в battle/stats.ts — раньше здесь была
 * вторая копия формулы, из-за чего HP и скорость в бою считались не так же,
 * как статы в профиле.
 */
function calculateStat(pokemon, statName, isWild) {
  return calculateStatShared(pokemon, statName, { isWild, level: isWild ? S.wildLvl : undefined });
}

/**
 * Множитель стадии для стата: -6..+6 → 2/8 … 3/2 с полом на нижней границе.
 * Стадии идут шагами по 2/3 в основной игре, здесь округление сделано вниз.
 */
const STAGE_MULTIPLIER: Record<number, number> = {
  6: 4, 5: 3.5, 4: 3, 3: 2.5, 2: 2, 1: 1.5, 0: 1,
  '-1': 2 / 3, '-2': 1 / 2, '-3': 2 / 5, '-4': 1 / 3, '-5': 1 / 4, '-6': 1 / 4,
};

/**
 * Эффективная скорость для порядка хода.
 *
 * Раньше порядок хода вообще не учитывал скорость: useMove() отрабатывал атаку
 * игрока и вызывал enemyTurn() следом, то есть первым бил всегда игрок, независимо
 * от статов. Здесь считается то, что действительно влияет на очерёдность:
 * стадия стата, паралич, Choice Scarf, Swift Swim и хвост ветра, плюс приоритет
 * самой атаки (Quick Attack и т.п. бьют вне зависимости от скорости).
 */
function getEffectiveSpeed(pokemon, isWild): number {
  let speed = calculateStat(pokemon, 'speed', isWild) || 1;

  const stage = pokemon?.statStages?.spe || 0;
  speed *= STAGE_MULTIPLIER[stage] ?? 1;

  // Паралич НЕ снижает скорость — решение из спецификации: паралич даёт только
  // 25% шанс потерять ход (см. checkStatusTurn). Раньше здесь стояло снижение
  // вдвое, то есть паралич работал вдвойне — и тормозил, и пропускал ходы.
  // Скорость больше не трогаем.

  const ability = abilityOf(pokemon, isWild);
  // Нормализуем имя способности: PokeAPI отдаёт kebab-case ('swift-swim'),
  // а сравнения ниже написаны слитно ('swiftswim'). Без нормализации Swift Swim,
  // Rain Dish и Solar Power не срабатывали НИКОГДА — сравнение всегда было
  // ложным. Chlorophyll работал случайно: в его имени нет дефиса.
  const abilN = ability ? String(ability).toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  if (pokemon?.heldItem === 'choiceScarf') speed *= 1.5;
  // Slow Start: первые пять ходов скорость вдвое ниже.
  if (abilN === 'slowstart' && (pokemon.slowStartTurns || 0) < 5) speed *= 0.5;
  // Погодные способности скорости. Каждая работает только в свою погоду:
  //   Swift Swim / Rain Dish — дождь
  //   Chlorophyll / Solar Power — солнце
  //   Sand Rush — песчаная буря
  //   Slush Rush — град
  if (S.currentWeather === 'rain' && (abilN === 'swiftswim' || abilN === 'raindish')) speed *= 2;
  if (S.currentWeather === 'sun' && (abilN === 'chlorophyll' || abilN === 'solarpower')) speed *= 2;
  if (S.currentWeather === 'sandstorm' && abilN === 'sandrush') speed *= 2;
  if (S.currentWeather === 'hail' && abilN === 'slushrush') speed *= 2;
  // Проход-741: Tailwind удваивает скорость своей стороны
  if (!isWild && (S.tailwindP || 0) > 0) speed *= 2;
  if (isWild && (S.tailwindW || 0) > 0) speed *= 2;

  return Math.max(1, speed);
}

/**
 * Кто ходит первым. Приоритет атаки важнее скорости; при равном приоритете
 * решает скорость, при полном равенстве — игрок, как в основной игре.
 */
/**
 * getEffectivePriority — приоритет атаки с учётом способностей владельца.
 *
 *   Prankster   +1 к статус-атакам (атаки без power)
 *   Gale Wings  +1 к летящим атакам, пока владелец при полном HP
 *   Triage      +3 к лечащим атакам
 */
function getEffectivePriority(move, mon, isWild) {
  let prio = move?.priority ?? 0;
  if (!move || !mon) return prio;
  // Аудит итемов: Quick Claw 20% +1, Custap Berry +1 при HP<25%
  if (mon.heldItem === 'quickClaw' && Math.random() < 0.2) prio += 1;
  {
    // Custap не сгорает (упрощение: приоритет считается до хода дважды,
    // сгорание там дало бы двойной расход) — работает пока HP<25%.
    const cur = isWild ? S.wildCurHP : mon.currentHp;
    const max = isWild ? S.wildMaxHP : mon.maxHp;
    if (mon.heldItem === 'custapBerry' && max > 0 && cur > 0 && cur < max * 0.25) prio += 1;
  }
  const name = String(getAbilityName(mon, isWild) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (name === 'prankster' && !move.power) prio += 1;
  if (name === 'gale-wings' && move.type?.name === 'flying') {
    const cur = isWild ? S.wildCurHP : mon.currentHp;
    const max = isWild ? S.wildMaxHP : mon.maxHp;
    if (max > 0 && cur >= max) prio += 1;
  }
  if (name === 'triage' && move.meta?.healing) prio += 3;
  return prio;
}

/**
 * isQueuedMoveStale — протух ли заказанный ход (N1).
 *
 * Ход заказывал monBefore. Если к моменту его выполнения активный покемон
 * сменился (faint + автозамена в handlePlayerFaint), старый moveIndex
 * указывает уже в чужие слоты — выполнять такой ход нельзя: замена
 * «использует атаку мёртвого» и тратит чужой PP. Чистая функция для тестов.
 */
export function isQueuedMoveStale(monBefore: any, monAfter: any): boolean {
  return !!monBefore && monAfter !== monBefore;
}

function playerMovesFirst(playerMove, enemyMove): boolean {
  const pPrio = getEffectivePriority(playerMove, S.activePlayerMon, false);
  const ePrio = getEffectivePriority(enemyMove, S.activeWild, true);
  if (pPrio !== ePrio) return pPrio > ePrio;

  const pSpe = getEffectiveSpeed(S.activePlayerMon, false);
  const eSpe = getEffectiveSpeed(S.activeWild, true);
  // Проход-741: Trick Room переворачивает порядок (медленный — первым)
  if ((S.trickRoomTurns || 0) > 0) {
    if (pPrio !== ePrio) return pPrio > ePrio;
    return pSpe <= eSpe;
  }
  // Сравнение — чистое ядро в special-moves.ts (тестируется без DOM/S).
  return decideMoveOrder(pPrio, pSpe, ePrio, eSpe) === 'player';
}

/**
 * Фильтр атак по уровню изучения (спека H1/H2).
 * Дикие и лидеры знают только level-up атаки с min level_learned_at <= level.
 * Именно отсутствие фильтра давало Маджикарпу Гидропомпу: сортировка брала
 * топ по убыванию уровня изучения. Пусто — самая ранняя доступная;
 * совсем ничего — синтетический Tackle (иначе дикий беспомощен).
 */
export function filterMovesByLevel(moveDetails, level) {
  const lvl = Math.max(1, level || 1);
  const withLvl = (moveDetails || []).map((m) => {
    const lvls = ((m && m.version_group_details) || [])
      .filter((v) => v && v.move_learn_method && v.move_learn_method.name === 'level-up'
        && typeof v.level_learned_at === 'number')
      .map((v) => v.level_learned_at);
    return { m, min: lvls.length ? Math.min(...lvls) : Infinity };
  }).filter((e) => e.m);
  const known = withLvl
    .filter((e) => e.min <= lvl)
    .sort((a, b) => a.min - b.min)
    .map((e) => e.m);
  if (known.length) return known;
  if (withLvl.length) {
    return [withLvl.slice().sort((a, b) => a.min - b.min)[0].m];
  }
  return [{
    name: 'tackle', power: 40, accuracy: 100, pp: 35,
    type: { name: 'normal' }, damage_class: { name: 'physical' },
    meta: {}, effect_entries: [],
  }];
}

/**
 * resolveWildMoveset — ЕДИНЫЙ источник боевого мувсета дикого.
 *
 * КОРЕНЬ СТАРОГО БАГА «атаки не по уровню изучения»: filterMovesByLevel()
 * читал version_group_details у объектов /move/{id}, а этого поля у ресурса
 * АТАКИ в PokeAPI не бывает — оно живёт в связи покемон↔атака. Все move
 * получали min = Infinity, known пустым, и функция уходила в fail-open,
 * возвращая pool[0] — первую атаку в произвольном порядке PokeAPI. Итог:
 * дикий ур. 5 знал Cut, а Chikorita — Swords Dance.
 *
 * Теперь уровень берётся из таблицы «Развитие» сайта (/api/learnset/:name,
 * локальный learnsets.json, тот же источник, что у стартеров и level-up
 * атак). Порядок и набор — строго level <= wildLvl.
 *
 * Фолбэк (нет learnset / сеть) — Tackle: дикий остаётся не беспомощным,
 * но НЕ получает заведомо недоступную атаку.
 */
export async function resolveWildMoveset(apiData: any, level: number): Promise<any[]> {
  const species = apiData?.name || '';
  try {
    const ls = await fetchSiteLearnset(species);
    const names = ls ? wildMovesFromLearnset(ls, level, 4) : [];
    if (!names.length) return [syntheticTackle()];
    const details = await Promise.all(
      names.map((n) => fetchSiteMoveDetail(moveNameToSlug(n)).catch(() => null)),
    );
    const ok = details.filter(Boolean);
    return ok.length ? ok : [syntheticTackle()];
  } catch {
    return [syntheticTackle()];
  }
}

/**
 * getMultiHitCount — переехал в special-moves.ts (чистый, тестируемый,
 * rand инжектится). Здесь — реэкспорт для совместимости.
 */
export { getMultiHitCount } from './special-moves.js';

/**
 * applyWeatherChip — урон от погоды (sandstorm, hail) 1/16 max HP в конце хода.
 * sandstorm: non-Rock/Ground/Steel
 * hail: non-Ice
 */
/**
 * abilityOf — имя способности покемона с учётом Нейтрализующего газа.
 *
 * Если на поле есть покемон с Нейтрализующим газом, способности ОБЕИХ сторон
 * не действуют — включая ту, что стоит у второго покемона. Сам газ продолжает
 * «работать» и по-прежнему показывается в интерфейсе.
 *
 * Эту функцию используют все боевые проверки способностей; getAbilityName
 * остаётся сырым чтением для интерфейса и справочника.
 */
function abilityOf(mon, isWild) {
  if (!mon) return null;
  const norm = (a) => String(a || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const own = getAbilityName(mon, isWild);
  if (norm(own) === 'neutralizinggas') return own;
  // Нейтрализующий газ на ЛЮБОЙ стороне поля глушит все остальные способности.
  // ВАЖНО: сосед читается через getAbilityName напрямую. Вызов abilityOf здесь
  // уходил в бесконечную рекурсию (каждый вызов перепроверял поле заново) и
  // ронял бой с Maximum call stack size exceeded — коммит 81e10f8.
  const other = mon === S.activeWild ? S.activePlayerMon : S.activeWild;
  const otherRaw = other ? getAbilityName(other, other === S.activeWild) : null;
  if (norm(otherRaw) === 'neutralizinggas') return null;
  if (mon !== S.activeWild && mon !== S.activePlayerMon) {
    const w = S.activeWild ? getAbilityName(S.activeWild, true) : null;
    const p = S.activePlayerMon ? getAbilityName(S.activePlayerMon, false) : null;
    if (norm(w) === 'neutralizinggas' || norm(p) === 'neutralizinggas') return null;
  }
  return own;
}

/**
 * Magic Guard: способность полностью блокирует НЕпрямой урон — от статусов
 * (яд, ожог, токсин), от Семени Ужаса, от погоды и от отдачи своих атак.
 * Прямой урон от атак проходит как обычно.
 */
function hasMagicGuard(mon, isWild) {
  return String(getAbilityName(mon, isWild) || '')
    .toLowerCase().replace(/[^a-z0-9]/g, '') === 'magicguard';
}

function applyWeatherChip(pokemon, maxHp, isPlayer) {
  // Magic Guard полностью блокирует погодный урон.
  if (hasMagicGuard(pokemon, !isPlayer)) return;
  if (!pokemon || pokemon.currentHp <= 0) return;
  const weather = S.currentWeather;
  if (weather === 'sandstorm') {
    const immune = pokemon.types?.some(t => ['rock', 'ground', 'steel'].includes(t.type?.name));
    if (immune) return;
  } else if (weather === 'hail') {
    const immune = pokemon.types?.some(t => t.type?.name === 'ice');
    if (immune) return;
  } else {
    return; // No chip damage for other weather
  }
  const chip = Math.max(1, Math.floor(maxHp / 16));
  pokemon.currentHp -= chip;
  if (pokemon.currentHp < 0) pokemon.currentHp = 0;
  const name = pokemon.apiData?.name || pokemon.name;
  if (isPlayer) {
    updatePlayerHpUI();
    appendToLog(`${name} получает урон от ${weather === 'sandstorm' ? 'песчаной бури' : 'града'}! (-${chip} HP)`);
  } else {
    updateWildHpUI();
    appendToLog(`Дикий ${name} получает урон от ${weather === 'sandstorm' ? 'песчаной бури' : 'града'}! (-${chip} HP)`);
  }
}

/**
 * applyTypeResistBerry — проверяет и применяет type-resist ягоду (Occa, Passho, Wacan и т.д.).
 * Возвращает модифицированный урон. Ягода расходуется после активации.
 */
const RESIST_BERRY_MAP = {
  'occaBerry': 'fire', 'passhoBerry': 'water', 'wacanBerry': 'electric',
  'rindoBerry': 'grass', 'shucaBerry': 'ground', 'chopleBerry': 'fighting',
  'kebiaBerry': 'poison', 'chartiBerry': 'rock', 'yacheBerry': 'ice',
  'babiriBerry': 'steel', 'kasibBerry': 'ghost', 'habanBerry': 'dragon',
};
function applyTypeResistBerry(defender, moveType, damage, isPlayerDefender) {
  if (!defender.heldItem || !moveType) return damage;
  const berryType = RESIST_BERRY_MAP[defender.heldItem];
  if (!berryType || berryType !== moveType) return damage;
  // Only activates on super-effective moves
  const name = defender.apiData?.name || defender.name;
  appendToLog(`${name} использует ${defender.heldItem} для защиты от ${moveType}-атаки!`);
  defender.heldItem = null; // Consume berry
  if (isPlayerDefender) updatePlayerHpUI();
  else updateWildHpUI();
  return Math.floor(damage / 2);
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 3: ЛОГ БОЯ И БАРЬЕРЫ
// ═══════════════════════════════════════════════════════════════
// appendToLog — добавление сообщения в лог битвы (DOM).
// modifyScreenTurns — управление ходами Reflect/Light Screen.
// applyBarrierMod — множитель урона от барьеров (×0.5 если барьер активен).
// clearScreens — сброс всех барьеров при завершении боя.
// ─────────────────────────────────────────────────────────────

/**
 * appendToLog — добавить сообщение в лог битвы (div#battle-log).
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Создаёт <p> с текстом
 *   2. Если clear=true — очищает лог перед добавлением
 *   3. Если type указан — добавляет CSS класс chat-{type} (для стилизации: 'battle', 'dmg', 'heal', 'system', 'status', 'catch', 'faint')
 *   4. Скроллит лог вниз (scrollTop = scrollHeight)
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ: ВЕЗДЕ в core.ts, это основной способ вывода сообщений игроку.
 */
function appendToLog(text, clear = false, type?) {
  const logEl = document.getElementById('battle-log'); // DOM элемент лога
  if (clear) {
    logEl.innerHTML = ''; // Очищаем лог если нужно (начало боя)
  }
  const p = document.createElement('p');   // Новый параграф
  p.innerText = text;                      // Текст сообщения (русский, через appendToLog в коде)
  if (type) p.className = 'chat-' + type;  // CSS класс для стилей (разные цвета для разных типов сообщений)
  logEl.appendChild(p);
  logEl.scrollTop = logEl.scrollHeight;    // Автоскролл вниз (чтобы последнее сообщение было видно)
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 3.1: SCREEN/BARRIER HELPERS
// ═══════════════════════════════════════════════════════════════
// Reflect (Защита) — снижает физ. урон вдвое на 5 ходов.
// Light Screen (Световой Экран) — снижает спец. урон вдвое на 5 ходов.
// Protect — полная защита на 1 ход.
// Substitute (Заменитель) — поглощает урон вместо покемона.

/**
 * modifyScreenTurns — изменить количество оставшихся ходов экрана.
 * delta = +5 при установке, -1 в конце каждого хода.
 * isPlayer = true → для игрока, false → для противника.
 * screen = 'reflect' | 'light-screen'
 */
function modifyScreenTurns(screen, delta, isPlayer) {
  if (screen === 'reflect') {
    if (isPlayer) S.playerReflectTurns = Math.max(0, S.playerReflectTurns + delta);
    else S.enemyReflectTurns = Math.max(0, S.enemyReflectTurns + delta);
  } else if (screen === 'light-screen') {
    if (isPlayer) S.playerLightScreenTurns = Math.max(0, S.playerLightScreenTurns + delta);
    else S.enemyLightScreenTurns = Math.max(0, S.enemyLightScreenTurns + delta);
  }
}

/**
 * applyBarrierMod — применить множитель урона от барьеров.
 * Возвращает 0.5 если барьер активен и подходит под тип атаки,
 * иначе 1.0 (без изменений).
 *
 * ЧТО ДЕЛАЕТ:
 *   Physical атака → Reflect (если активен)
 *   Special атака → Light Screen (если активен)
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ:
 *   useMove() — строка 1672
 *   enemyTurn() — строка 1927-1928
 */
function applyBarrierMod(damage, move, defenderIsPlayer, ignoreBarrier = false) {
  if (ignoreBarrier) return 1; // Crits ignore Reflect/Light Screen
  // Infiltrator: атакующий игнорирует барьеры противника.
  const atkAbil = String(getAbilityName(defenderIsPlayer ? S.activeWild : S.activePlayerMon,
    defenderIsPlayer ? true : false) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (atkAbil === 'infiltrator') return 1;
  const isPhysical = move.damage_class?.name === 'physical'; // physical или special?
  if (defenderIsPlayer) {
    if (S.playerReflectTurns > 0 && isPhysical) return 0.5;       // Reflect игрока от физ. атак
    if (S.playerLightScreenTurns > 0 && !isPhysical) return 0.5;  // Light Screen игрока от спец. атак
  } else {
    if (S.enemyReflectTurns > 0 && isPhysical) return 0.5;        // Reflect врага от физ. атак
    if (S.enemyLightScreenTurns > 0 && !isPhysical) return 0.5;   // Light Screen врага от спец. атак
  }
  return 1; // Нет барьера — урон без изменений
}

/**
 * clearScreens — сбросить ВСЕ барьеры у обоих сторон.
 * Вызывается при: начале боя, завершении боя, выходе из боя.
 */
function clearScreens() {
  S.playerReflectTurns = 0;
  S.playerLightScreenTurns = 0;
  S.enemyReflectTurns = 0;
  S.enemyLightScreenTurns = 0;
  S.protectActive = false;         // Protect игрока
  S.substituteHP = 0;             // Substitute игрока
  S.enemyProtectActive = false;    // Protect врага
  S.enemySubstituteHP = 0;        // Substitute врага
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 4: СТАТУС-ЭФФЕКТЫ ИГРОКА (STATUS MOVES)
// ═══════════════════════════════════════════════════════════════
// Эти функции обрабатывают атаки без power (статус-атаки):
//   - Лечение (Recover, Roost, Synthesis)
//   - Барьеры (Reflect, Light Screen)
//   - Защита (Protect)
//   - Заменитель (Substitute)
//   - Статусные эффекты на врага (через useMove)
//   - Изменение статов (Swords Dance, Growl, и т.д.)
//
// ВСЕ возвращают boolean: true = что-то произошло, false = ничего.
// ─────────────────────────────────────────────────────────────

/**
 * handlePlayerStatusEffects — обработка статус-атак игрока (без урона).
 *
 * ЧТО ДЕЛАЕТ (по порядку):
 *   1. Лечение — healing% от move.meta, восстанавливает HP
 *   2. Reflect — устанавливает S.playerReflectTurns = 5
 *   3. Light Screen — устанавливает S.playerLightScreenTurns = 5
 *   4. Protect — устанавливает S.protectActive = true (защита на 1 ход)
 *   5. Substitute — тратит 25% HP, создаёт заменителя (поглощает урон)
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: useMove() строка ~1631, когда move.power === null/undefined
 *
 * ВОЗВРАЩАЕТ: true если атака была обработана (лечение/барьер/защита/заменитель)
 */
function handlePlayerStatusEffects(move) {
  // Returns true if anything meaningful happened

  // 0a. Проход-741: волатильные ailments из данных — живут не в .status,
  // а в mon.vol (confusion/infatuation/yawn/perish-song/torment/disable).
  // Без этого все они падали в «Но ничего не произошло...».
  {
    const ail = move.meta?.ailment?.name;
    if (ail && ['confusion', 'infatuation', 'yawn', 'perish-song', 'torment', 'disable', 'trap', 'ingrain'].includes(ail)) {
      let ok = true;
      if (ail === 'confusion') {
        ok = Math.random() * 100 < confuseChance(move.name);
      } else {
        const ch = move.meta?.ailment_chance ?? 0;
        ok = ch <= 0 ? true : Math.random() * 100 < Math.min(100, ch);
      }
      if (ok && !isStatusImmune(ail, S.activeWild)) {
        const src = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
        applyVolatileAilment(S.activeWild, true, ail, src, S.lastWildMove, S.activePlayerMon.heldItem);
        if (normMoveName(move.name) === 'perish-song') {
          applyVolatileAilment(S.activePlayerMon, false, ail, src, S.lastPlayerMove);
        }
        return true;
      }
      if (ok) {
        appendToLog(`У дикого ${S.activeWild.name} иммунитет!`, false, 'system');
        return true;
      }
      return true; // шанс не выпал — ход потрачен, но честно
    }
  }

  // 0b. Проход-741: полевые и трюковые атаки (погода, taunt, stockpile...)
  if (handleFieldAndTrickMoves(move, true)) return true;

  // 0. Heal Pulse (L2-остаток): канон лечит ЦЕЛЬ — в диком бою это дикий.
  // Выглядит как «лечит врага», поэтому лог обязан объяснять, иначе
  // будет репорт «атака лечит противника — баг».
  if (normMoveName(move.name) === 'heal-pulse') {
    const amt = healPulseAmount(S.wildMaxHP);
    S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + amt);
    updateWildHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} лечит противника на ${amt} HP (так работает Heal Pulse)!`, false, 'heal');
    return true;
  }

  // 1. Healing moves (Recover, Roost, Moonlight, Synthesis, etc.)
  // move.meta.healing — процент от макс HP (например 50 для Recover)
  const healPct = move.meta?.healing;
  if (healPct) {
    // Отрицательное лечение (clangorous-soul −33): не лечит, а срезает HP
    // ценой за бафф. Раньше попадало в «HP уже полное» без среза.
    if (healPct < 0) {
      const cost = calcHpCost(S.activePlayerMon.maxHp, healPct);
      S.activePlayerMon.currentHp = Math.max(1, S.activePlayerMon.currentHp - cost);
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} тратит ${cost} HP на усиление!`, false, 'system');
      return true;
    }
    const healAmount = calcHealAmount(S.activePlayerMon.maxHp, healPct);
    if (healAmount > 0) {
      S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + healAmount);
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} восстановил ${healAmount} HP!`, false, 'heal');
    } else {
      appendToLog('Но HP уже полное...');
    }
    return true;
  }

  // 2. Reflect & Light Screen
  if (move.name === 'reflect') {
    S.playerReflectTurns = 5;
    appendToLog(`${S.activePlayerMon.apiData.name} создал Защиту! Физ. урон снижен вдвое.`, false, 'system');
    return true;
  }
  if (move.name === 'light-screen') {
    S.playerLightScreenTurns = 5;
    appendToLog(`${S.activePlayerMon.apiData.name} создал Световой Экран! Спец. урон снижен вдвое.`, false, 'system');
    return true;
  }

  // 3. Protect — счётчик последовательных попыток. Первая подряд всегда
  // срабатывает, дальше шанс провала по спецификации: 1/3^(n-1). Это защищает
  // от спама: «Защита-Защита-Защита-…» уже не даёт бессрочного щита.
  // Проход-741: detect/quick-guard/wide-guard — тот же щит (упрощение:
  // в одиночном бою разницы между ними нет); spiky-shield/king-shield/
  // obstruct/baneful-bunker — щит + наказание за касание (см. места блока).
  if (['protect', 'detect', 'quick-guard', 'wide-guard'].includes(move.name)) {
    S.protectCounter++;
    const success = S.protectCounter === 1 || Math.random() >= 1 / Math.pow(3, S.protectCounter - 1);
    if (success) {
      S.protectActive = true;
      appendToLog(`${S.activePlayerMon.apiData.name} защищается!`);
    } else {
      appendToLog(`${S.activePlayerMon.apiData.name} пытается защититься, но не удалось!`);
    }
    return true;
  }
  for (const [shieldMove, punish] of [['spiky-shield', 'damage'], ['king-shield', 'atk'], ['obstruct', 'def'], ['baneful-bunker', 'poison']] as Array<[string, string]>) {
    if (move.name === shieldMove) {
      S.protectCounter++;
      const success = S.protectCounter === 1 || Math.random() >= 1 / Math.pow(3, S.protectCounter - 1);
      if (success) {
        S.protectActive = true;
        S.activePlayerMon.shieldPunish = punish;
        appendToLog(`${S.activePlayerMon.apiData.name} встаёт в ${move.name}!`);
      } else {
        appendToLog(`${S.activePlayerMon.apiData.name} пытается защититься, но не удалось!`);
      }
      return true;
    }
  }

  // 4. Substitute — создаёт заменителя, который поглощает урон
  // Стоимость: 25% от макс HP (минимум 1)
  if (move.name === 'substitute') {
    const cost = Math.max(1, Math.floor(S.activePlayerMon.maxHp * 0.25));
    if (S.activePlayerMon.currentHp > cost) {
      S.activePlayerMon.currentHp -= cost;
      S.substituteHP = Math.floor(S.activePlayerMon.maxHp * 0.25); // Заменитель имеет 25% HP
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} создал Заменителя! (-${cost} HP)`, false, 'system');
    } else {
      appendToLog('Недостаточно HP для создания Заменителя!');
    }
    return true;
  }

  // 5. Leech Seed — засевает противника.
  // Раньше атака не была реализована вообще: попадала в «ничего не произошло»
  // и просто ничего не делала. Травяные типы и повторное засевание невозможны.
  if (move.name === 'leech-seed') {
    if (isGrassType(S.activeWild)) {
      appendToLog(`${S.activeWild.name} — травяной тип, Семя Ужаса не действует.`, false, 'system');
    } else if (S.seedWild) {
      appendToLog(`${S.activeWild.name} уже засеян.`, false, 'system');
    } else {
      S.seedWild = true;
      appendToLog(`${S.activeWild.name} засеян! Каждый ход он теряет HP, а противник лечится.`, false, 'system');
    }
    return true;
  }

  return false; // Ничего не произошло — атака не была статус-атакой из списка
}

/** Травяной тип — иммунитет к Семени Ужаса. */
function isGrassType(pokemon): boolean {
  return !!pokemon?.types?.some((t: any) => t?.type?.name === 'grass');
}

/**
 * Ежеходовый урон от Семени Ужаса.
 *
 * Засеянный теряет 1/8 максимального HP, а нападавший половину этого лечит.
 * Вызывается в конце хода с обеих сторон.
 */
function applyLeechSeedTick(seededIsPlayer: boolean) {
  // Magic Guard блокирует урон от Семени Ужаса.
  if (seededIsPlayer && hasMagicGuard(S.activePlayerMon, false)) return;
  if (!seededIsPlayer && hasMagicGuard(S.activeWild, true)) return;
  if (seededIsPlayer) {
    if (!S.seedPlayer || S.activePlayerMon.currentHp <= 0) return;
    const dmg = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 8));
    S.activePlayerMon.currentHp = Math.max(1, S.activePlayerMon.currentHp - dmg);
    updatePlayerHpUI();
    appendToLog(`Семя Ужаса отнимает у ${S.activePlayerMon.apiData.name} ${dmg} HP!`, false, 'dmg');
    const heal = Math.max(1, Math.floor(dmg / 2));
    // HP дикого живёт в S.wildCurHP, а не в S.activeWild.currentHp. Раньше
    // лечение уходило в поле, которое никто не читает, — враг не лечился,
    // хотя урон с него снимался.
    if (S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
      S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} восстановил ${heal} HP за счёт Семени.`, false, 'heal');
    }
  } else {
    if (!S.seedWild || S.wildCurHP <= 0) return;
    const dmg = Math.max(1, Math.floor(S.wildMaxHP / 8));
    S.wildCurHP = Math.max(1, S.wildCurHP - dmg);
    updateWildHpUI();
    appendToLog(`Семя Ужаса отнимает у ${S.activeWild.name} ${dmg} HP!`, false, 'dmg');
    const heal = Math.max(1, Math.floor(dmg / 2));
    if (S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
      S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} восстановил ${heal} HP за счёт Семени.`, false, 'heal');
    }
  }
}

/**
 * handleEnemyStatusEffects — обработка статус-атак ПРОТИВНИКА (без урона).
 * Зеркальная версия handlePlayerStatusEffects, но для врага.
 * Дополнительно: изменение статов противника (Swords Dance) и наложение статусов на игрока.
 *
 * ЧТО ДЕЛАЕТ (по порядку):
 *   1. Лечение врага
 *   2. Reflect / Light Screen для врага
 *   3. Protect для врага
 *   4. Substitute для врага
 *   5. Stat changes (повышение/понижение статов врага)
 *   6. Наложение статус-эффекта на игрока (яд/ожог/паралич/сон/заморозка)
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: enemyTurn() строка ~1888, когда у атаки врага нет power
 *
 * ВОЗВРАЩАЕТ: true если атака была обработана
 */
function handleEnemyStatusEffects(move) {
  // Handle status moves used by gym enemy
  // Returns true if anything meaningful happened

  // 0a. Проход-741: волатильные ailments (зеркало игрока).
  {
    const ail = move.meta?.ailment?.name;
    if (ail && ['confusion', 'infatuation', 'yawn', 'perish-song', 'torment', 'disable', 'trap', 'ingrain'].includes(ail)) {
      let ok = true;
      if (ail === 'confusion') {
        // Serene Grace врага здесь недоступна (считается в конвейере) —
        // шанс базовый; упрощение задокументировано.
        ok = Math.random() * 100 < confuseChance(move.name);
      } else {
        const ch = move.meta?.ailment_chance ?? 0;
        ok = ch <= 0 ? true : Math.random() * 100 < Math.min(100, ch);
      }
      if (ok && !isStatusImmune(ail, S.activePlayerMon)) {
        applyVolatileAilment(S.activePlayerMon, false, ail, S.activeWild.name, S.lastPlayerMove, S.activeWild.heldItem);
        if (normMoveName(move.name) === 'perish-song') {
          applyVolatileAilment(S.activeWild, true, ail, S.activeWild.name, S.lastWildMove);
        }
        return true;
      }
      if (ok) {
        appendToLog(`У ${S.activePlayerMon.apiData.name} иммунитет!`, false, 'system');
        return true;
      }
      return true;
    }
  }

  // 0b. Проход-741: полевые и трюковые атаки (зеркало игрока).
  if (handleFieldAndTrickMoves(move, false)) return true;

  // 0. Heal Pulse (L2-остаток): зеркально игроку — лечит НАШЕГО покемона.
  if (normMoveName(move.name) === 'heal-pulse') {
    const amt = healPulseAmount(S.activePlayerMon.maxHp);
    S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + amt);
    updatePlayerHpUI();
    appendToLog(`${S.activeWild.name} лечит вашего покемона на ${amt} HP (так работает Heal Pulse)!`, false, 'heal');
    return true;
  }

  // 1. Healing for enemy
  const healPct = move.meta?.healing;
  if (healPct) {
    // Отрицательное лечение врага (зеркально игроку): срез HP за бафф.
    if (healPct < 0) {
      const cost = calcHpCost(S.wildMaxHP, healPct);
      S.wildCurHP = Math.max(1, S.wildCurHP - cost);
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} тратит ${cost} HP на усиление!`, false, 'system');
      return true;
    }
    const healAmount = calcHealAmount(S.wildMaxHP, healPct);
    if (healAmount > 0 && S.wildCurHP < S.wildMaxHP) {
      S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + healAmount);
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} восстановил ${healAmount} HP!`, false, 'heal');
    } else {
      appendToLog('Но HP противника уже полное...');
    }
    return true;
  }

  // 2. Reflect & Light Screen
  if (move.name === 'reflect') {
    S.enemyReflectTurns = 5;
    appendToLog(`${S.activeWild.name} создал Защиту! Физ. урон снижен вдвое.`, false, 'system');
    return true;
  }
  if (move.name === 'light-screen') {
    S.enemyLightScreenTurns = 5;
    appendToLog(`${S.activeWild.name} создал Световой Экран! Спец. урон снижен вдвое.`, false, 'system');
    return true;
  }

  // 3. Protect (проход-741: detect/quick/wide-guard — тот же щит;
  // spiky/king/obstruct/baneful — щит + наказание, см. места блока).
  if (['protect', 'detect', 'quick-guard', 'wide-guard'].includes(move.name)) {
    S.enemyProtectActive = true;
    appendToLog(`${S.activeWild.name} защищается!`);
    return true;
  }
  for (const [shieldMove, punish] of [['spiky-shield', 'damage'], ['king-shield', 'atk'], ['obstruct', 'def'], ['baneful-bunker', 'poison']] as Array<[string, string]>) {
    if (move.name === shieldMove) {
      S.enemyProtectActive = true;
      S.activeWild.shieldPunish = punish;
      appendToLog(`${S.activeWild.name} встаёт в ${move.name}!`);
      return true;
    }
  }

  // 4. Substitute — создаёт заменителя для врага
  if (move.name === 'substitute') {
    const cost = Math.max(1, Math.floor(S.wildMaxHP * 0.25));
    if (S.wildCurHP > cost) {
      S.wildCurHP -= cost;
      S.enemySubstituteHP = Math.floor(S.wildMaxHP * 0.25);
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} создал Заменителя! (-${cost} HP)`, false, 'system');
    } else {
      appendToLog('Недостаточно HP для создания Заменителя!');
    }
    return true;
  }

  // 4b. Leech Seed — враг засевает нашего покемона (зеркально игроку)
  if (move.name === 'leech-seed') {
    if (isGrassType(S.activePlayerMon)) {
      appendToLog(`${S.activePlayerMon.apiData.name} — травяной тип, Семя Ужаса не действует.`, false, 'system');
    } else if (S.seedPlayer) {
      appendToLog(`${S.activePlayerMon.apiData.name} уже засеян.`, false, 'system');
    } else {
      S.seedPlayer = true;
      appendToLog(`${S.activePlayerMon.apiData.name} засеян врагом!`, false, 'system');
    }
    return true;
  }

  // 5. Enemy stat changes (Swords Dance, Growl, etc.)
  // move.stat_changes — массив изменений статов (из PokeAPI)
  if (move.stat_changes && move.stat_changes.length > 0) {
    const monName = S.activeWild.name;
    const statNameMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
    move.stat_changes.forEach(sc => {
      const statKey = statNameMap[sc.stat.name];
      if (statKey) {
        statStageModify(S.activeWild, statKey, sc.change, true); // Навязано игроком
        const newStage = S.activeWild.statStages[statKey]; // Текущее значение после изменения
        const sign = newStage >= 0 ? '+' : '';
        const dir = sc.change > 0 ? 'повышена' : 'понижена';
        const labels = { atk: 'Атака', def: 'Защита', spa: 'Сп. Атака', spd: 'Сп. Защита', spe: 'Скорость' };
        appendToLog(`${labels[statKey] || statKey} ${monName} ${dir} (${sign}${newStage})`, false, 'system');
      }
    });
    return true;
  }

  // 6. Enemy status ailment on player — наложение статуса на игрока
  const ailment = move.meta?.ailment?.name;
  if (ailment && ailment !== 'none' && ailment !== 'unknown') {
    const statusMap = {
      'poison': 'psn', 'badly-poison': 'tox',
      'burn': 'brn', 'paralysis': 'par',
      'sleep': 'slp', 'freeze': 'frz'
    };
    const targetStatus = statusMap[ailment];
    if (targetStatus && !S.activePlayerMon.status) { // Если у игрока ещё нет статуса
      if (applyStatusEffect(S.activePlayerMon, targetStatus)) {
        document.getElementById('player-status-icon').innerText = getStatusIcon(targetStatus);
        appendToLog(`${S.activePlayerMon.apiData.name} получил ${STATUS_NAMES[targetStatus] || targetStatus}!`);
        return true;
      } else {
        appendToLog(`Но ${S.activeWild.name} не удалось наложить статус...`);
        return true;
      }
    }
  }

  return false; // Не статус-атака (должно быть power)
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 5: СПОСОБНОСТИ (ABILITIES), СТАТЫ, ЯГОДЫ
// ═══════════════════════════════════════════════════════════════
// getAbilityName — получить имя способности покемона.
// statStageModify — изменить стат-стадию (бафф/дебафф) с капом ±6.
// updateStatBadges — обновить UI плашек стат-стадий (+1 Atk, -2 Spd...).
// checkBerryAutoUse — авто-использование ягод при определённых условиях.
// ─────────────────────────────────────────────────────────────

/**
 * getAbilityName — получить имя способности покемона.
 * У дикого: из PokeAPI (pokemon.abilities[0].ability.name)
 * У игрока: из pokemon.abilityName (сохраняется при поимке)
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ:
 *   enemyTurn() — проверка Rough Skin / Iron Barbs у игрока
 *   updateAbilityDisplay() — отображение способности в UI
 *   useMove() — проверка способностей (Sturdy, Static и т.д.)
 */
/**
 * Способность участника В ЭТОМ БОЮ.
 *
 * Раньше Trace / Mummy / Skill Swap / Entrainment / Worry Seed / Gastro Acid /
 * Simple Beam писали способность ПРЯМО в монстра (`mon.abilityName = ...`).
 * Монстр сохраняется в облако, поэтому способность из боя уезжала в сейв и
 * «прыгала» в следующие бои — игрок терял свою способность навсегда.
 *
 * Теперь боевая подмена живёт только в состоянии боя (S.tempAbilityP / W)
 * и обнуляется в resetBattleField(). У монстра своя способность не меняется.
 */
function battleAbilitySlot(mon, isWild): 'tempAbilityW' | 'tempAbilityP' | null {
  if (mon === S.activeWild) return 'tempAbilityW';
  if (mon === S.activePlayerMon) return 'tempAbilityP';
  return null;
}

/** Записать боевую (временную) способность участника. */
function setBattleAbility(mon, isWild, name) {
  const slot = battleAbilitySlot(mon, isWild);
  if (slot) S[slot] = name;
}

/** Текущая боевая способность: временная, иначе родная. */
function currentBattleAbility(mon, isWild) {
  const slot = battleAbilitySlot(mon, isWild);
  if (slot && S[slot] !== undefined && S[slot] !== null) return S[slot];
  return getAbilityName(mon, isWild);
}

function getAbilityName(pokemon, isWild) {
  // Сначала боевая подмена (Trace/Mummy/...), и только потом родная.
  const slot = battleAbilitySlot(pokemon, isWild);
  if (slot && S[slot]) return S[slot];
  if (isWild) return pokemon.abilities?.[0]?.ability?.name || null; // дикий: первая способность
  return pokemon.abilityName || null;                                 // свой мон: заданная
}

/**
 * statStageModify — изменить стат-стадию покемона.
 *
 * Стат-стадии работают так:
 *   +1 → ×1.5, +2 → ×2, +3 → ×2.5 ... +6 → ×4
 *   -1 → ×2/3, -2 → ×2/4, -3 → ×2/5 ... -6 → ×2/8
 *
 * Максимум: +6 (кап), минимум: -6.
 * Вызывается при: Swords Dance (+2 Atk), Growl (-1 Atk), Intimidate (-1 Atk) и т.д.
 * После изменения ОБЯЗАН обновить UI через updateStatBadges().
 */
/**
 * Способности, запрещающие противнику понижать статы владельца.
 * Ключ — id способности, значение — какие статы защищены ('*' = все).
 * Свои собственные понижения (Overheat, Superpower, Draco Meteor) проходят:
 * для этого у statStageModify есть флаг fromOpponent.
 */
const STAT_GUARD_ABILITIES: Record<string, string[] | '*'> = {
  'clear-body': '*',
  'white-smoke': '*',
  'hyper-cutter': ['atk'],
  'big-pecks': ['def'],
  'keen-eye': [],          // точность в игре не стат — оставлено для полноты
};

function statStageModify(pokemon, stat, delta, fromOpponent = false) {
  // Проход-741: туман стороны не даёт понижать статы
  if (fromOpponent && delta < 0 && pokemon) {
    const isWild = pokemon !== S.activePlayerMon;
    if ((isWild ? (S.mistW || 0) : (S.mistP || 0)) > 0) {
      appendToLog(`Туман прячет статы ${monLogName(pokemon, isWild)}!`, false, 'system');
      return;
    }
  }
  // Защита от понижения: способность блокирует ТОЛЬКО то, что навязал
  // противник. Свои атаки (Overheat снижает свою сп. атаку) проходят.
  if (fromOpponent && delta < 0 && pokemon) {
    const abil = getAbilityName(pokemon, false);
    const guard = abil ? STAT_GUARD_ABILITIES[abil] : undefined;
    if (guard === '*' || (Array.isArray(guard) && guard.includes(stat))) {
      appendToLog(`${getAbilityNameRu(abil)} не даёт понизить ${STAT_LABELS[stat] || stat} ${pokemon.apiData?.name || ''}!`, false, 'system');
      return;
    }
  }
  // Аудит итемов: White Herb возвращает пониженные статы (съедается)
  if (pokemon && pokemon.heldItem === 'whiteHerb' && fromOpponent && delta < 0) {
    pokemon.heldItem = null;
    if (!pokemon.statStages) pokemon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) {
      if ((pokemon.statStages[k] || 0) < 0) pokemon.statStages[k] = 0;
    }
    updateStatBadges();
    appendToLog(`${pokemon.nickname || pokemon.apiData?.name || pokemon.name} съедает Белую траву — статы восстановлены!`, false, 'system');
    return;
  }
  // Если стат-стадии ещё нет — инициализируем нулями
  if (!pokemon.statStages) pokemon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  // Клиппинг: не даём выйти за пределы [-6, +6]
  pokemon.statStages[stat] = Math.max(-6, Math.min(6, (pokemon.statStages[stat] || 0) + delta));
  updateStatBadges(); // Обновляем плашки в UI
}

/** Русские названия статов для логов. */
const STAT_LABELS: Record<string, string> = {
  atk: 'Атаку', def: 'Защиту', spa: 'Сп. Атаку', spd: 'Сп. Защиту', spe: 'Скорость',
};

/**
 * tickBindTurns — счётчик ловушки: 5 ходов (7 с Когтем), потом хватка
 * отпускает (урон прекращается). Жалоба 6: раньше чистили только bindChip,
 * а vol.trapped залипал навсегда — ловушка «оставалась на перед».
 * Теперь чистим и vol.trapped через tickTrapBind. Прямой m.trapped
 * (mean-look/jaw-lock) не трогаем — у него свой жизненный цикл.
 */
function tickBindTurns(mon: any, isWild: boolean): void {
  const vol = mon?.vol;
  if (!vol || !vol.bindChip) return;
  if (vol.bindTurns === undefined || vol.bindTurns === null) vol.bindTurns = 5;
  // Чистое ядро считает остаток (тестируется без DOM/S).
  const next = tickTrapBind(vol);
  vol.bindChip = next.bindChip;
  vol.bindTurns = next.bindTurns;
  if (!next.bindChip) vol.trapped = next.trapped;
  if (!next.bindChip) {
    const label = isWild ? `Дикий ${mon.name}` : (mon.apiData?.name || 'Покемон');
    appendToLog(`${label} вырвался из хватки!`, false, 'system');
  }
}

/**
 * maybeConsumeTerrainSeed — семя поля: держатель съедает семя, если активно
 * его поле (Electric/Grassy → +1 защиты, Misty/Psychic → +1 спецзащиты).
 * Вызывается в начале ходов обоих + при установке поля. Возвращает bool.
 */
function maybeConsumeTerrainSeed(mon: any): boolean {
  if (!mon || !mon.heldItem || !S.terrain || !S.terrain.kind) return false;
  const need = TERRAIN_SEEDS[mon.heldItem];
  if (!need || S.terrain.kind !== need) return false;
  const stat = TERRAIN_SEED_STAT[mon.heldItem];
  const seedName = mon.heldItem;
  mon.heldItem = null;
  statStageModify(mon, stat, 1);
  const label = mon.apiData?.name || 'Покемон';
  appendToLog(`${label} съел семя (${seedName}): ${STAT_LABELS[stat] || stat} +1!`, false, 'system');
  return true;
}

/**
 * updateStatBadges — обновить отображение стат-стадий в UI.
 * Показывает плашки с цветом: зелёные (+), красные (-).
 * Пример: "+2 Атк" (зелёный), "-1 Защ" (красный)
 */
function updateStatBadges() {
  const labels = { atk: 'Атк', def: 'Защ', spa: 'САт', spd: 'СЗа', spe: 'Скр' };
  // Player badges — плашки для игрока
  const playerEl = document.getElementById('player-stat-badges');
  if (playerEl && S.activePlayerMon?.statStages) {
    playerEl.innerHTML = Object.entries(S.activePlayerMon.statStages as Record<string, number>)
      .filter(([_, v]) => v !== 0) // Только изменённые статы
      .map(([k, v]) => {
        const sign = v > 0 ? '+' : '';
        return `<span class="stat-badge ${v > 0 ? 'positive' : 'negative'}">${labels[k] || k} ${sign}${v}</span>`;
      }).join('');
  }
  // Wild badges — плашки для дикого покемона
  const wildEl = document.getElementById('wild-stat-badges');
  if (wildEl && S.activeWild?.statStages) {
    wildEl.innerHTML = Object.entries((S.activeWild?.statStages || {}) as Record<string, number>)
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => {
        const sign = v > 0 ? '+' : '';
        return `<span class="stat-badge ${v > 0 ? 'positive' : 'negative'}">${labels[k] || k} ${sign}${v}</span>`;
      }).join('');
  }
}

/**
 * clearUsedItem — очистить предмет, который был "в руке" у покемона.
 * Устанавливает heldItem = null (ягода была съедена/предмет использован).
 * backward compat: также обнуляет berries[itemId] для старых сохранений.
 */
function clearUsedItem(mon) {
  if (mon.berries && mon.heldItem) {
    mon.berries[mon.heldItem] = 0; // backward compat
  }
  mon.heldItem = null;
}

/**
 * checkBerryAutoUse — проверить и автоматически использовать ягоду покемона.
 *
 * Какие ягоды обрабатываются:
 *   Sitrus Berry  — HP < 50% → +25% HP
 *   Oran Berry    — HP < 50% → +10 HP
 *   Lum Berry     — любой статус → вылечить
 *   Chesto Berry  — сон → разбудить
 *   Rawst Berry   — ожог → вылечить
 *   (Leftovers — НЕ ягода, обрабатывается в enemyTurn отдельно)
 *
 * ПОРЯДОК ВЫЗОВА:
 *   useMove() — после атаки игрока (строка ~1768)
 *   enemyTurn() — после хода врага (строка ~1996)
 *
 * ВОЗВРАЩАЕТ: true если ягода была использована, false если нет
 */
function checkBerryAutoUse(mon, isPlayer) {
  if (!mon || !mon.heldItem) return false;

  // Sitrus: HP < 50% -> +25% maxHP
  if (mon.heldItem === 'sitrusBerry' && mon.currentHp < mon.maxHp * 0.5) {
    const heal = Math.floor(mon.maxHp * 0.25);
    mon.currentHp = Math.min(mon.maxHp, mon.currentHp + heal);
    clearUsedItem(mon); // Ягода съедена — удаляем
    if (isPlayer) updatePlayerHpUI();
    else updateWildHpUI();
    const monName = mon.name || mon.apiData?.name;
    appendToLog(`${monName} восстановил HP с помощью Ситрус Ягоды! (+${heal} HP)`, false, 'heal');
    return true;
  }

  // Oran: HP < 50% -> +10 HP
  if (mon.heldItem === 'oranBerry' && mon.currentHp < mon.maxHp * 0.5) {
    mon.currentHp = Math.min(mon.maxHp, mon.currentHp + 10);
    clearUsedItem(mon);
    if (isPlayer) updatePlayerHpUI();
    else updateWildHpUI();
    appendToLog(`${mon.name || mon.apiData?.name} восстановил HP с помощью Оран Ягоды! (+10 HP)`, false, 'heal');
    return true;
  }

  // Lum: any status -> cure — снимает ЛЮБОЙ статус
  if (mon.heldItem === 'lumBerry' && mon.status) {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.name || mon.apiData?.name} вылечился с помощью Лум Ягоды!`);
    return true;
  }

  // Chesto: sleep -> cure — только от сна
  if (mon.heldItem === 'chestoBerry' && mon.status === 'slp') {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.name || mon.apiData?.name} проснулся с помощью Често Ягоды!`);
    return true;
  }

  // Rawst: burn -> cure — только от ожога
  if (mon.heldItem === 'rawstBerry' && mon.status === 'brn') {
    cureStatus(mon);
    clearUsedItem(mon);
    if (isPlayer) document.getElementById('player-status-icon').innerText = '';
    else document.getElementById('wild-status-icon').innerText = '';
    appendToLog(`${mon.name || mon.apiData?.name} вылечил ожог с помощью Рост Ягоды!`);
    return true;
  }

  // Leftovers: +1/16 maxHP every turn
  // Примечание: Leftovers обрабатывается в enemyTurn в конце хода (не здесь),
  // т.к. это пассивный предмет, а не ягода.

  return false;
}

/**
 * giveBerryToMon — попытка выдать ягоду покемону через UI боя.
 * Сейчас не используется — ягоды выдаются через профиль покемона (экипировка).
 * Показывает toast-уведомление о правильном способе.
 */
function giveBerryToMon(berryType) {
  showToast('Пожалуйста, используйте экипировку (Держит) в профиле покемона для выдачи ягод и предметов!', true);
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 6: КВЕСТЫ (ЗАДАНИЯ)
// ═══════════════════════════════════════════════════════════════
// generateDailyQuests — генерация 3 ежедневных заданий (случайные из QUEST_CONFIGS).
// checkQuestProgress — обновление прогресса задания при совершении действия.
// claimQuestReward — получение награды за выполненное задание.
// openQuests / renderQuests — отображение заданий в UI.
// ВСЕ задания сбрасываются каждый новый день (по дате).
// ─────────────────────────────────────────────────────────────

/**
 * generateDailyQuests — сгенерировать ежедневные задания.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Проверяет дату последней генерации (localStorage)
 *   2. Если сегодня ещё не генерировали — выбирает 3 случайных из QUEST_CONFIGS
 *   3. Очищает старые задания, устанавливает progress = 0, completed = false
 *   4. Сохраняет дату, автосохраняет игру
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: при старте игры или при смене дня
 * ХРАНИТ ДАННЫЕ В: GS.quests (массив активных заданий), GS.questProgress (прогресс по ID)
 */
/**
 * isValidDailyConfig — конфиг ежедневки ссылается на живые предметы.
 * Мёртвый targetItem/rewardItem (нет в ITEMS) = невыполнимый квест:
 * игрок видит задание, а дропа/награды не существует. Такие конфиги
 * в ротацию не берём, а загруженные сегодня с битыми предметами —
 * перегенерируем сразу (самолечение старых сейвов).
 */
function isValidDailyConfig(q) {
  if (!q || typeof q.id !== 'string' || !q.type || !(q.target > 0)) return false;
  if (q.rewardItem && !ITEMS.some(i => i.id === q.rewardItem)) return false;
  if (q.type === 'collect_items') {
    if (!q.targetItem || !ITEMS.some(i => i.id === q.targetItem)) return false;
  }
  return true;
}

function generateDailyQuests() {
  const today = new Date().toISOString().slice(0, 10);           // Сегодняшняя дата YYYY-MM-DD
  const lastGen = localStorage.getItem(store.lsKey('quest_date')); // Дата последней генерации
  // Ротация только из валидных конфигов (битые предметы не предлагаем).
  const validPool = QUEST_CONFIGS.filter(isValidDailyConfig);
  const pool = validPool.length >= 3 ? validPool : QUEST_CONFIGS;
  if (lastGen === today && GS.quests.length > 0) {
    // Уже сгенерированы сегодня — прогресс не сбрасываем.
    // Исключение: в сегодняшнем наборе затесался битый конфиг
    // (старый сейв до фикса предметов) — тогда перегенерируем сразу,
    // иначе игрок сидит с невыполнимым заданием до завтра.
    if (GS.quests.every(isValidDailyConfig)) return;
  }

  // Перемешиваем и берём 3 случайных конфига
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const newQuests = shuffled.slice(0, 3).map(q => ({
    ...q,
    progress: 0,        // Прогресс: 0 из target
    completed: false,   // Выполнено?
    claimed: false      // Награда получена?
  }));
  // Заменяем старые квесты новыми
  GS.quests.length = 0;
  GS.quests.push(...newQuests);
  // Очищаем прогресс по старым квестам
  Object.keys(GS.questProgress).forEach(k => delete GS.questProgress[k]);
  GS.quests.forEach(q => { GS.questProgress[q.id] = 0; });
  localStorage.setItem(store.lsKey('quest_date'), today); // Запоминаем сегодняшнюю дату
  store.autoSave();
}

/**
 * checkQuestProgress — проверить и обновить прогресс задания.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Проходит по всем активным заданиям
 *   2. Если тип совпадает с совершённым действием — увеличивает progress
 *   3. Если progress >= target — отмечает задание как completed
 *   4. Также проверяет tutorial прогресс через store.checkTutorialProgress()
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   useMove() — "defeat_x" (победа над диким)
 *   startHunt — "catch_x" (поимка)
 *   Enemy turn — "earn_money" (деньги)
 *   handleWildFaintRewards — "earn_money", "defeat_x"
 *   initEncounterEvents — "use_item" (использование предмета)
 */
function checkQuestProgress(type, amount?, itemId?, info?: any) {
  if (amount === undefined) amount = 1;
  GS.quests.forEach(q => {
    if (q.completed || q.claimed) return;                    // Уже выполнено или награда получена
    if (q.type === type) {                                    // Тип совпадает?
      if (type === 'collect_items' && q.targetItem !== itemId) return; // Для "собрать предметы" — проверяем ID
      q.progress = Math.min(q.target, (q.progress || 0) + amount);     // Увеличиваем прогресс (но не больше target)
      GS.questProgress[q.id] = q.progress;
      if (q.progress >= q.target) {
        q.completed = true;
        appendToLog(`Задание выполнено: ${q.desc}!`, false, 'quest');
      }
    }
  });
  // Гринд-пачка NPC-квестов: тот же движок событий двигает и их
  // (defeat/catch/earn/explore/use — с фильтрами из quest-track.ts).
  try {
    if (['defeat_x', 'catch_x', 'earn_money', 'explore', 'use_item'].includes(type)) {
      trackNPCQuests(type, { amount, itemId, ...(info || {}) });
    }
  } catch (e) { console.error('[quest-track] fan-out failed:', e); }
  // Also track tutorial GS.quests
  store.checkTutorialProgress(type, amount, itemId); // Проверяем туториал-прогресс
}

/**
 * claimQuestReward — получить награду за выполненное задание.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Находит задание по ID в GS.quests
 *   2. Проверяет что оно completed и не claimed
 *   3. Выдаёт деньги и предметы через store.giveReward
 *   4. Добавляет в GS.completedQuests (история выполненных)
 *   5. Обновляет UI и автосохраняет
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из DOM, по клику на кнопку "Получить награду" в renderQuests()
 */
function claimQuestReward(questId) {
  const q = GS.quests.find(x => x.id === questId);
  if (!q || !q.completed || q.claimed) return showToast('Задание уже выполнено или недоступно!', true);
  q.claimed = true;
  const rItems = q.rewardItem ? [{ id: q.rewardItem, qty: q.rewardQty || 1 }] : [];
  store.giveReward(q.rewardMoney, rItems);  // Выдача награды через store
  // История — СТРОКОЙ: серверный Zod требует z.array(z.string()), объект
  // {id, date} ронял КАЖДЫЙ следующий сейв с 422 («422 в ежедневках»).
  GS.completedQuests.push(questId); // История
  store.updateMoneyDisplay();
  store.updateInventoryDisplay();
  store.autoSave();
  showToast(`Награда получена: ¥${q.rewardMoney}${q.rewardItem ? ` + ${q.rewardQty}x ${q.rewardItem}` : ''}!`, false);
  renderQuests(); // Перерендерить список квестов
}

/**
 * openQuests — открыть модалку заданий и отрендерить список.
 * Просто показывает quest-modal и вызывает renderQuests().
 */
function openQuests() {
  const modal = document.getElementById('quest-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  renderQuests();
}

/**
 * renderQuests — отрендерить список заданий в quest-modal.
 * Для каждого задания показывает: описание + прогресс-бар + награду + статус.
 * Если задание выполнено — показывает кнопку "Получить награду".
 */
function renderQuests() {
  const list = document.getElementById('quest-list');
  if (!list) return;
  list.innerHTML = '';
  if (GS.quests.length === 0) {
    list.innerHTML = '<div class="quest-empty">Нет активных заданий</div>';
  } else {
    const head = document.createElement('div');
    head.className = 'quest-section-title';
    head.textContent = `☀️ Ежедневные — активных: ${GS.quests.length}`;
    list.appendChild(head);
  }
  GS.quests.forEach(q => {
    const div = document.createElement('div');
    div.className = 'quest-card';
    const pct = q.target > 0 ? Math.round((q.progress / q.target) * 100) : 0;
    div.innerHTML = `
      <div class="quest-desc">${q.desc} (${q.progress}/${q.target})</div>
      <div class="quest-bar-bg"><div class="quest-bar-fill" style="width:${pct}%"></div></div>
      <div class="quest-reward">Награда: ¥${q.rewardMoney}${q.rewardItem ? ` + ${q.rewardQty}x ${itemDef(q.rewardItem).nameRu || q.rewardItem}` : ''}</div>
      ${q.completed && !q.claimed ? '<button class="btn-use quest-claim-btn" data-quest="'+q.id+'">Получить награду</button>' : ''}
      ${q.claimed ? '<span class="quest-claimed">Получено</span>' : ''}
      ${!q.completed ? '<span class="quest-progress">В процессе...</span>' : ''}
    `;
    list.appendChild(div);
  });

  // Навешиваем обработчики на кнопки "Получить награду"
  list.querySelectorAll('.quest-claim-btn').forEach(btn => {
    btn.addEventListener('click', () => claimQuestReward(btn.getAttribute('data-quest')));
  });

  // ── Секция NPC-квестов: активные (взятые, не сданные) ──
  // Раньше их было видно только в диалоге NPC-владельца: игрок ходил по Канто,
  // а «Следопыт» молчал. Теперь все активные — здесь, со степенью прохождения,
  // объяснением и местом сдачи. Сдача — по-прежнему у NPC в диалоге
  // (награду выдаёт completeNPCQuest).
  try {
    renderActiveNPCQuests(list);
  } catch (e) { console.warn('[quests] NPC-секция не отрисовалась:', e); }
}

/**
 * renderActiveNPCQuests — активные NPC-квесты в модалку заданий.
 * Готовые к сдаче — первыми. У каждого: прогресс-бар, «как выполнять»
 * (questHowTo), награда и держатель (имя NPC + локация).
 */
function renderActiveNPCQuests(list: HTMLElement) {
  const taken: string[] = Object.keys((GS as any).npcQuestProgress || {})
    .filter((id) => !((GS as any).completedNPCQuests || []).includes(id));
  const byId = new Map(allNPCQuests().map((q: any) => [q?.id, q]));
  const rows: Array<{ q: any; progress: number; ready: boolean; pct: number; holder: string }> = [];
  for (const id of taken) {
    const q = byId.get(id);
    if (!q) continue;
    const progress = Math.min(q.targetQty || 1, (GS as any).npcQuestProgress[id] || 0);
    let ready = progress >= (q.targetQty || 1);
    if (!ready && q.verify) {
      try { ready = verifyQuest(q).ok; } catch { /* ignore */ }
    }
    const pct = q.targetQty > 0 ? Math.round((progress / q.targetQty) * 100) : 0;
    const h = findQuestHolder(id);
    rows.push({
      q, progress, ready, pct,
      holder: h ? `${h.name} (${locName(h.location)})` : 'NPC',
    });
  }
  const head = document.createElement('div');
  head.className = 'quest-section-title';
  head.textContent = `📋 Задания тренеров — активных: ${rows.length}`;
  list.appendChild(head);
  if (rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'quest-empty';
    empty.textContent = 'Нет взятых заданий — заглядывай к NPC с «!» над головой.';
    list.appendChild(empty);
    return;
  }
  rows.sort((a, b) => Number(b.ready) - Number(a.ready) || b.pct - a.pct);
  for (const r of rows) {
    const div = document.createElement('div');
    div.className = 'quest-card' + (r.ready ? ' quest-ready' : '');
    let how = '';
    try {
      const t = questHowTo(r.q);
      if (t) how = `<div class="npc-quest-how">ℹ️ ${t}</div>`;
    } catch { /* ignore */ }
    const rewards = questRewards(r.q)
      .map((x: any) => `${x.qty}x ${(itemDef(x.id)?.nameRu || x.id)}`)
      .join(', ');
    div.innerHTML = `
      <div class="quest-desc">${r.q.desc} (${r.progress}/${r.q.targetQty})</div>
      <div class="quest-bar-bg"><div class="quest-bar-fill" style="width:${r.pct}%"></div></div>
      ${how}
      <div class="quest-reward">Награда: ¥${r.q.rewardMoney}${rewards ? ` + ${rewards}` : ''}</div>
      <div class="quest-holder">Сдача: ${r.holder}${r.ready ? ' — <b>можно сдавать!</b>' : ''}</div>
    `;
    list.appendChild(div);
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 7: СТАТУС-ЭФФЕКТЫ (Боевые статусы)
// ═══════════════════════════════════════════════════════════════
// Каждый покемон может иметь один статус-эффект.
// Статусы влияют на бой: паралич снижает скорость, ожог снижает атаку и т.д.
//
// STATUS_ICONS — иконки для отображения в UI
// STATUS_NAMES — русские названия для сообщений в логе
// ─────────────────────────────────────────────────────────────
const STATUS_ICONS = {
  psn: '☠️', brn: '🔥', par: '⚡', slp: '💤', frz: '❄️'
};
const STATUS_NAMES = {
  psn: 'Отравление', brn: 'Ожог', par: 'Паралич', slp: 'Сон', frz: 'Заморозка'
};

// ── Покедекс ──
// evolutionCache — кэш эволюционных цепочек (вид → { evolves_to, ... })
// evolvesFromMap — обратная карта: вид → [предыдущие эволюции]
// POKEDEX_ALL — массив всех видов покемонов (по именам)
// pokedexData — данные покедекса из JSON файла
// pokedexTotal — количество видов
export const evolutionCache = {};
export const evolvesFromMap = {}; // reverse: species → [prevo names]

export let POKEDEX_ALL = [];
export let pokedexData = {};
export let pokedexTotal = 0;

/**
 * loadPokedexData — загрузить данные покедекса из JSON файла.
 * Если загрузка не удалась — использует список Канто (151 покемон) как запасной.
 * pokedexData — объект { имя: данные } для поиска.
 * POKEDEX_ALL — массив имён всех видов.
 */
async function loadPokedexData() {
  // Таблица силы вида нужна СИНХРОННО в pickWeightedEncounter (горячий путь),
  // поэтому грузим её здесь, на старте, а не по первому требованию.
  // Таблица эволюций — тоже: канонный уровень нужен при проверке конфет.
  try { await loadPowerTable(); } catch (_) {}
  try { await loadEvoTable(); } catch (_) {}
  try {
    const res = await fetch(import.meta.env.BASE_URL + 'pokedex_data.json');
    pokedexData = await res.json();
    POKEDEX_ALL = Object.keys(pokedexData);                // Имена всех покемонов
    pokedexTotal = POKEDEX_ALL.length;
  } catch (e) {
    console.warn('Pokedex data load failed, using Kanto only', e);
    // Fallback: все 151 покемон Канто
    POKEDEX_ALL = ['bulbasaur','ivysaur','venusaur','charmander','charmeleon','charizard','squirtle','wartortle','blastoise','caterpie','metapod','butterfree','weedle','kakuna','beedrill','pidgey','pidgeotto','pidgeot','rattata','raticate','spearow','fearow','ekans','arbok','pikachu','raichu','sandshrew','sandslash','nidoran-f','nidorina','nidoqueen','nidoran-m','nidorino','nidoking','clefairy','clefable','vulpix','ninetales','jigglypuff','wigglytuff','zubat','golbat','oddish','gloom','vileplume','paras','parasect','venonat','venomoth','diglett','dugtrio','meowth','persian','psyduck','golduck','mankey','primeape','growlithe','arcanine','poliwag','poliwhirl','poliwrath','abra','kadabra','alakazam','machop','machoke','machamp','bellsprout','weepinbell','victreebel','tentacool','tentacruel','geodude','graveler','golem','ponyta','rapidash','slowpoke','slowbro','magnemite','magneton','farfetchd','doduo','dodrio','seel','dewgong','grimer','muk','shellder','cloyster','gastly','haunter','gengar','onix','drowzee','hypno','krabby','kingler','voltorb','electrode','exeggcute','exeggutor','cubone','marowak','hitmonlee','hitmonchan','lickitung','koffing','weezing','rhyhorn','rhydon','chansey','tangela','kangaskhan','horsea','seadra','goldeen','seaking','staryu','starmie','mr-mime','scyther','jynx','electabuzz','magmar','pinsir','tauros','magikarp','gyarados','lapras','ditto','eevee','vaporeon','jolteon','flareon','porygon','omanyte','omastar','kabuto','kabutops','aerodactyl','snorlax','articuno','zapdos','moltres','dratini','dragonair','dragonite','mewtwo','mew'];
    pokedexData = {};
    pokedexTotal = POKEDEX_ALL.length;
  }
}

// GS.pokedexSeen, GS.pokedexCaught, isDaytime — доступны через GS Proxy к state

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 7.1: ФУНКЦИИ ДЛЯ РАБОТЫ СО СТАТУСАМИ
// ═══════════════════════════════════════════════════════════════
// getStatusIcon  — иконка для отображения в UI
// applyStatusEffect — наложить статус на цель (с проверкой на уже существующий)
// cureStatus — снять статус
// checkStatusTurn — проверить может ли покемон действовать в этом ходу
// applyStatusEndOfTurn — нанести урон от яда/ожога в конце хода

/**
 * getStatusIcon — иконка статуса для UI.
 * psn → ☠️, brn → 🔥, par → ⚡, slp → 💤, frz → ❄️
 */
function getStatusIcon(status) {
  return STATUS_ICONS[status] || ''; // Пустая строка если нет статуса
}

/**
 * applyStatusEffect — наложить статус-эффект на покемона.
 * Если у цели уже есть статус — возвращает false (не накладывает).
 * Для сна (slp) устанавливает случайное количество ходов (1-3).
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: useMove (атаки игрока), enemyTurn (атаки врага),
 * handleEnemyStatusEffects, handlePlayerStatusEffects
 *
 * ВОЗВРАЩАЕТ: true если статус наложен, false если нет.
 */
function applyStatusEffect(target, statusType) {
  if (target.status) return false; // Уже есть статус — не накладываем повторно
  // Проход-741: Safeguard стороны не даёт статусы
  {
    const isWild = target !== S.activePlayerMon;
    if ((isWild ? (S.safeguardW || 0) : (S.safeguardP || 0)) > 0) {
      appendToLog(`Защита ${monLogName(target, isWild)} отражает статус!`, false, 'system');
      return false;
    }
  }
  // Проход-741: туманный террейн не даёт статусы наземным, электрический —
  // не даёт сон наземным. Молча не глотаем: пишем причину в лог.
  {
    const terr = S.terrain?.kind;
    if (terr === 'misty' || (terr === 'electric' && statusType === 'slp')) {
      const isWild = target !== S.activePlayerMon;
      if (isGrounded(target, isWild)) {
        appendToLog(`Террейн защищает ${monLogName(target, isWild)} от статуса!`, false, 'system');
        return false;
      }
    }
  }
  target.status = statusType;
  if (statusType === 'slp') {
    target.sleepTurns = Math.floor(Math.random() * 3) + 1; // Случайно 1-3 хода сна
  }
  return true;
}

/**
 * cureStatus — вылечить покемона от любого статуса.
 * Сбрасывает status = null и sleepTurns = 0.
 */
function cureStatus(target) {
  target.status = null;
  target.sleepTurns = 0;
}

/**
 * ═══ ПРОХОД-741: волатильные состояния и поле боя (общее обеих сторон) ═══
 * mon.vol переживает только активного: смена/смерть дают новый объект —
 * всё само сбрасывается. Здесь — исполняющие хелперы; чистые решения
 * (шансы, таблицы) живут в special-moves.ts и покрыты тестами.
 */

/** Волатильное состояние покемона (создаёт при первом обращении). */
function monVol(mon: any): any {
  if (!mon.vol) mon.vol = {};
  return mon.vol;
}

/** Имя для лога (дикий — name, свой — nickname/apiData). */
function monLogName(mon: any, isWild: boolean): string {
  if (!mon) return '???';
  return isWild ? mon.name : (mon.nickname || mon.apiData?.name || '???');
}

/** Наземный ли (для террейнов): не летающий и не левитирующий. */
function isGrounded(mon: any, isWild: boolean): boolean {
  // Проход-741: гравитация прижимает всех
  if ((S.gravityTurns || 0) > 0) return true;
  const types = (mon?.apiData?.types || []).map((t: any) => t?.type?.name || t);
  if (types.includes('flying')) return false;
  const ab = String(abilityOf(mon, isWild) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return ab !== 'levitate';
}

/** Типы для эффективности с учётом смены типа (conversion/soak/...). */
function effTypes(mon: any): string[] {
  if (Array.isArray(mon?.typeOverride) && mon.typeOverride.length > 0) {
    return mon.typeOverride.map(String);
  }
  return (mon?.apiData?.types || []).map((t: any) => t?.type?.name || t);
}

/**
 * volatileStart — начало хода: perish/yawn/wish.
 * Возвращает 'fainted' (обморок — вызывающий запускает свой faint-флоу),
 * 'done' (ход потрачен: сон от зевка не мешает — статус-чек ниже поймает)
 * или null (играть дальше). Логи пишет сам.
 */
function volatileStart(mon: any, isWild: boolean, hp: { get: () => number; set: (v: number) => void; max: () => number; ui: () => void }): 'fainted' | 'done' | null {
  // Счётчик ходов на поле (для fake-out/first-impression: только первый ход)
  mon.turnsOut = (mon.turnsOut || 0) + 1;
  const vol = monVol(mon);
  const nm = monLogName(mon, isWild);
  // Perish Song: обратный отсчёт
  if ((vol.perish || 0) > 0) {
    const t = perishTick(vol);
    vol.perish = t.left;
    if (t.faint) {
      hp.set(0);
      hp.ui();
      appendToLog(`${nm} пал от Песни Гибели!`, false, 'faint');
      return 'fainted';
    }
    appendToLog(`Песнь Гибели: ${nm} — осталось ${t.left}...`, false, 'system');
  }
  // Yawn: на следующий ход — сон
  if (vol.yawn) {
    vol.yawn = false;
    if (yawnWakes(mon.status)) {
      applyStatusEffect(mon, 'slp');
      if (isWild) {
        S.wildStatus = mon.status;
        document.getElementById('wild-status-icon').innerText = getStatusIcon(mon.status);
      } else {
        document.getElementById('player-status-icon').innerText = getStatusIcon(mon.status);
      }
      appendToLog(`${nm} зевает и засыпает!`, false, 'system');
      return 'done';
    }
  }
  // Wish: лечение в начале следующего своего хода
  if (vol.wish) {
    vol.wish = false;
    const amt = Math.floor(hp.max() / 2);
    hp.set(Math.min(hp.max(), hp.get() + amt));
    hp.ui();
    appendToLog(`${nm} получает загаданное исцеление! (+${amt} HP)`, false, 'heal');
  }
  return null;
}

/**
 * volatileAction — проверки выбранной атаки: encore/disable/taunt/torment/
 * imprison/confusion/attract. Возвращает null (бить) или объект:
 * { fail } — ход сорван; { forceIndex } — encore заставляет другой слот;
 * { selfHit } — бьёт себя в замешательстве. Логи пишет сам.
 */
function volatileAction(mon: any, foe: any, isWild: boolean, move: any, moveIndex: number, movesDetailed: any[]): { fail?: string; forceIndex?: number; selfHit?: boolean } | null {
  const vol = monVol(mon);
  const nm = monLogName(mon, isWild);
  const slug = normMoveName(move?.name);
  // Imprison: запрещённые ходы
  const imp = isWild ? S.imprisonP : S.imprisonW;
  if (Array.isArray(imp) && imp.includes(slug)) {
    return { fail: `${nm} не может использовать ${move?.name} — заточение!` };
  }
  // Encore: повторять навязанную атаку
  const forced = encoreForces(vol, slug);
  if (forced && forced !== slug) {
    const slot = (movesDetailed || []).findIndex((m: any) => m && normMoveName(m.name) === forced);
    if (slot >= 0) {
      vol.encore.turns -= 1;
      if (vol.encore.turns <= 0) delete vol.encore;
      appendToLog(`${nm} вынужден повторять ${forced}!`, false, 'system');
      return { forceIndex: slot };
    }
    delete vol.encore; // навязанной атаки уже нет в сете — свобода
  } else if (vol.encore && vol.encore.turns > 0) {
    vol.encore.turns -= 1;
    if (vol.encore.turns <= 0) delete vol.encore;
  }
  // Disable
  if (disableBlocks(vol, slug)) {
    vol.disable.turns -= 1;
    if (vol.disable.turns <= 0) delete vol.disable;
    return { fail: `${move?.name} отключена — ${nm} не может атаковать!` };
  }
  // Taunt
  if ((vol.taunt || 0) > 0) {
    vol.taunt -= 1;
    if (vol.taunt <= 0) delete vol.taunt;
    if (tauntBlocks(move)) {
      return { fail: `${nm} в насмешке — только атакующие приёмы!` };
    }
  }
  // Torment
  if (tormentBlocks(vol, slug)) {
    return { fail: `${nm} измучен — нельзя дважды подряд той же атакой!` };
  }
  // Confusion
  if ((vol.confusion || 0) > 0) {
    vol.confusion -= 1;
    if (vol.confusion <= 0) delete vol.confusion;
    if (confusionSelfHit()) {
      return { selfHit: true };
    }
    appendToLog(`${nm} в замешательстве, но бьёт!`, false, 'system');
  }
  // Attract
  if (vol.attract && attractBlocks(mon.gender, foe?.gender)) {
    return { fail: `${nm} влюблён и не может атаковать!` };
  }
  return null;
}

/**
 * applyVolatileAilment — confusion/infatuation/yawn/perish-song/torment/
 * disable из ailment-слоя данных. Возвращает true если обработано
 * (вызывающий пропускает обычный applyStatusEffect).
 */
function applyVolatileAilment(target: any, isWildTarget: boolean, ailment: string, sourceName: string, foeLastMove?: string | null, userHeld?: unknown): boolean {
  // Аудит итемов: Mental Herb съедается вместо волатильного состояния
  if (target.heldItem === 'mentalHerb' && ['infatuation', 'taunt'].includes(ailment)) {
    target.heldItem = null;
    const nm = monLogName(target, isWildTarget);
    appendToLog(`${nm} съедает Мятную траву и остаётся в себе!`, false, 'system');
    return true;
  }
  const vol = monVol(target);
  const tnm = monLogName(target, isWildTarget);
  switch (ailment) {
    case 'confusion': {
      const turns = confusionTurns();
      vol.confusion = turns;
      appendToLog(`${tnm} сбит с толку!`, false, 'system');
      return true;
    }
    case 'infatuation': {
      vol.attract = true;
      appendToLog(`${tnm} влюблён в ${sourceName}!`, false, 'system');
      return true;
    }
    case 'yawn': {
      if (target.status) return true; // уже со статусом — зевок в пустоту
      vol.yawn = true;
      appendToLog(`${tnm} сонно зевает...`, false, 'system');
      return true;
    }
    case 'perish-song': {
      vol.perish = 3;
      appendToLog(`${tnm} слышит Песнь Гибели! (3 хода)`, false, 'system');
      return true;
    }
    case 'torment': {
      vol.torment = true;
      appendToLog(`${tnm} измучен — нельзя повторять атаки!`, false, 'system');
      return true;
    }
    case 'disable': {
      if (foeLastMove) {
        vol.disable = { move: foeLastMove, turns: 4 };
        appendToLog(`Атака ${foeLastMove} цели отключена!`, false, 'system');
      } else {
        appendToLog('Но отключать нечего...', false, 'system');
      }
      return true;
    }
    case 'trap': {
      // L5-741: fire-spin и семья - ловим в ловушку 1/8.
      // Длительность: 5 ходов, с Когтем захвата у бьющего — 7.
      vol.trapped = true;
      vol.bindChip = true;
      vol.bindTurns = trapTurns(userHeld);
      appendToLog(`${tnm} пойман в ловушку!`, false, 'system');
      return true;
    }
    case 'ingrain': {
      // Проход-741: корни — 1/16 себе, сам не уйдёт (trapped у себя)
      vol.ingrain = true;
      vol.trapped = true;
      appendToLog(`${tnm} пускает корни!`, false, 'system');
      return true;
    }
    default:
      return false;
  }
}

/**
 * tickFieldEndOfRound — конец раунда: погода/террейн/tailwind/trick-room
 * тикают, трава лечит наземных, соль щиплет. Вызывается из finishEnemyTurn
 * и из ветки «враг уже сходил» в endTurn (иначе быстрые враги останавливали
 * часы поля).
 */
function tickFieldEndOfRound() {
  // Погода, вызванная атакой, держится 5 раундов, затем — погода локации
  if ((S.weatherTurns || 0) > 0) {
    S.weatherTurns -= 1;
    if (S.weatherTurns <= 0) {
      S.currentWeather = getDailyWeather(GS.currentLocationId);
      appendToLog('Погода возвращается к обычной.', false, 'system');
    }
  }
  // Террейн — 5 раундов
  if (S.terrain && (S.terrain.turns || 0) > 0) {
    S.terrain.turns -= 1;
    if (S.terrain.turns <= 0) {
      appendToLog('Террейн рассеивается.', false, 'system');
      S.terrain = null;
    }
  }
  // Tailwind — 4 раунда на сторону
  if ((S.tailwindP || 0) > 0) S.tailwindP -= 1;
  if ((S.tailwindW || 0) > 0) S.tailwindW -= 1;
  // Trick Room — 5 раундов
  if ((S.trickRoomTurns || 0) > 0) {
    S.trickRoomTurns -= 1;
    if (S.trickRoomTurns <= 0) appendToLog('Trick Room рассеивается!', false, 'system');
  }
  // (фикс ниже: проверки обморока после тиков — у вызывающих)

  // Гравитация, волшебная комната, туман, защита, напев — часы
  if ((S.gravityTurns || 0) > 0) {
    S.gravityTurns -= 1;
    if (S.gravityTurns <= 0) appendToLog('Гравитация ослабевает!', false, 'system');
  }
  if ((S.magicRoomTurns || 0) > 0) {
    S.magicRoomTurns -= 1;
    if (S.magicRoomTurns <= 0) appendToLog('Волшебная комната исчезает!', false, 'system');
  }
  if ((S.mistP || 0) > 0) S.mistP -= 1;
  if ((S.mistW || 0) > 0) S.mistW -= 1;
  if ((S.safeguardP || 0) > 0) S.safeguardP -= 1;
  if ((S.safeguardW || 0) > 0) S.safeguardW -= 1;
  if ((S.luckyP || 0) > 0) S.luckyP -= 1;
  if ((S.luckyW || 0) > 0) S.luckyW -= 1;
  // Проклятие: 1/4 макс HP в конце хода
  if (S.activePlayerMon.vol?.cursed && S.activePlayerMon.currentHp > 0) {
    const chip = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 4));
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
    updatePlayerHpUI();
    appendToLog(`Проклятие гложет ${S.activePlayerMon.apiData.name}! (−${chip} HP)`, false, 'dmg');
  }
  if (S.activeWild.vol?.cursed && S.wildCurHP > 0) {
    const chip = Math.max(1, Math.floor(S.wildMaxHP / 4));
    S.wildCurHP = Math.max(0, S.wildCurHP - chip);
    updateWildHpUI();
    appendToLog(`Проклятие гложет дикого ${S.activeWild.name}! (−${chip} HP)`, false, 'dmg');
  }
  // Водяное кольцо и корни: 1/16 себе в конце хода
  if (S.activePlayerMon.vol?.aquaRing && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
    const h = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
    S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + h);
    updatePlayerHpUI();
    appendToLog(`Кольцо лечит ${S.activePlayerMon.apiData.name}! (+${h} HP)`, false, 'heal');
  }
  if (S.activeWild.vol?.aquaRing && S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
    const h = Math.max(1, Math.floor(S.wildMaxHP / 16));
    S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + h);
    updateWildHpUI();
    appendToLog(`Кольцо лечит дикого ${S.activeWild.name}! (+${h} HP)`, false, 'heal');
  }
  if (S.activePlayerMon.vol?.ingrain && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
    const h = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
    S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + h);
    updatePlayerHpUI();
    appendToLog(`Корни питают ${S.activePlayerMon.apiData.name}! (+${h} HP)`, false, 'heal');
  }
  if (S.activeWild.vol?.ingrain && S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
    const h = Math.max(1, Math.floor(S.wildMaxHP / 16));
    S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + h);
    updateWildHpUI();
    appendToLog(`Корни питают дикого ${S.activeWild.name}! (+${h} HP)`, false, 'heal');
  }
  // Привязка (fire-spin и семья): 1/8 макс HP
  if (S.activePlayerMon.vol?.bindChip && S.activePlayerMon.currentHp > 0) {
    const chip = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 8));
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} страдает в хватке! (−${chip} HP)`, false, 'dmg');
    tickBindTurns(S.activePlayerMon, false);
  }
  if (S.activeWild.vol?.bindChip && S.wildCurHP > 0) {
    const chip = Math.max(1, Math.floor(S.wildMaxHP / 8));
    S.wildCurHP = Math.max(0, S.wildCurHP - chip);
    updateWildHpUI();
    appendToLog(`Дикий ${S.activeWild.name} страдает в хватке! (−${chip} HP)`, false, 'dmg');
    tickBindTurns(S.activeWild, true);
  }
  // Липкий шип: держатель теряет 1/8 в конце хода
  if (S.activePlayerMon.heldItem === 'stickyBarb' && S.activePlayerMon.currentHp > 0) {
    const chip = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 8));
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} страдает от липкого шипа! (−${chip} HP)`, false, 'dmg');
  }
  if (S.activeWild.heldItem === 'stickyBarb' && S.wildCurHP > 0) {
    const chip = Math.max(1, Math.floor(S.wildMaxHP / 8));
    S.wildCurHP = Math.max(0, S.wildCurHP - chip);
    updateWildHpUI();
    appendToLog(`Дикий ${S.activeWild.name} страдает от липкого шипа! (−${chip} HP)`, false, 'dmg');
  }
  // Кошмар: спит — теряет 1/4
  if (S.activePlayerMon.vol?.nightmare && S.activePlayerMon.status === 'slp' && S.activePlayerMon.currentHp > 0) {
    const chip = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 4));
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} мучается кошмаром! (−${chip} HP)`, false, 'dmg');
  }
  if (S.activeWild.vol?.nightmare && S.activeWild.status === 'slp' && S.wildCurHP > 0) {
    const chip = Math.max(1, Math.floor(S.wildMaxHP / 4));
    S.wildCurHP = Math.max(0, S.wildCurHP - chip);
    updateWildHpUI();
    appendToLog(`Дикий ${S.activeWild.name} мучается кошмаром! (−${chip} HP)`, false, 'dmg');
  }
  // Трава лечит наземных 1/16
  if (S.terrain?.kind === 'grassy') {
    if (isGrounded(S.activePlayerMon, false) && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
      const h = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
      S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + h);
      updatePlayerHpUI();
      appendToLog(`Трава лечит ${S.activePlayerMon.apiData.name}! (+${h} HP)`, false, 'heal');
    }
    if (isGrounded(S.activeWild, true) && S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
      const h = Math.max(1, Math.floor(S.wildMaxHP / 16));
      S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + h);
      updateWildHpUI();
      appendToLog(`Трава лечит дикого ${S.activeWild.name}! (+${h} HP)`, false, 'heal');
    }
  }
  // Salt Cure щиплет в конце хода
  if (S.activePlayerMon.saltCure && S.activePlayerMon.currentHp > 0) {
    const chip = saltCureChip(S.activePlayerMon.maxHp, (S.activePlayerMon.apiData?.types || []).map((t: any) => t?.type?.name));
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
    updatePlayerHpUI();
    appendToLog(`Соль разъедает ${S.activePlayerMon.apiData.name}! (−${chip} HP)`, false, 'dmg');
  }
  if (S.activeWild.saltCure && S.wildCurHP > 0) {
    const chip = saltCureChip(S.wildMaxHP, (S.activeWild.apiData?.types || S.activeWild.types || []).map((t: any) => t?.type?.name || t));
    S.wildCurHP = Math.max(0, S.wildCurHP - chip);
    updateWildHpUI();
    appendToLog(`Соль разъедает дикого ${S.activeWild.name}! (−${chip} HP)`, false, 'dmg');
  }
}

/**
 * handleFieldAndTrickMoves — полевые и трюковые атаки (проход-741).
 * Одна реализация на обе стороны: isPlayer=true — бьёт игрок.
 * Возвращает true если обработано (вызывающий считает ход потраченным).
 * Сюда — всё, что не урон и не простой статус: погода/террейн/комнаты,
 * taunt/encore/disable/imprison, stockpile/swallow, смена типа/способностей/
 * стадий, wish/destiny/endure, pain-split/strength-sap, NO-META новинки.
 */
function handleFieldAndTrickMoves(move: any, isPlayer: boolean): boolean {
  const slug = normMoveName(move?.name);
  const user = isPlayer ? S.activePlayerMon : S.activeWild;
  const foe = isPlayer ? S.activeWild : S.activePlayerMon;
  const uname = monLogName(user, !isPlayer);
  const fname = monLogName(foe, isPlayer);
  const foeIsWild = isPlayer;
  const foeLast = isPlayer ? S.lastWildMove : S.lastPlayerMove;
  const userMoves = isPlayer ? S.playerMovesDetailed : S.wildMovesDetailed;
  const getHp = () => (isPlayer ? user.currentHp : S.wildCurHP);
  const maxHp = () => (isPlayer ? user.maxHp : S.wildMaxHP);
  const setHp = (v: number) => {
    if (isPlayer) { user.currentHp = v; updatePlayerHpUI(); }
    else { S.wildCurHP = v; updateWildHpUI(); }
  };
  const healSelf = (pct: number) => {
    const amt = Math.max(1, Math.floor(maxHp() * pct / 100));
    setHp(Math.min(maxHp(), getHp() + amt));
    return amt;
  };
  const done = (msg: string, kind: any = 'system') => { appendToLog(msg, false, kind); return true; };

  switch (slug) {
    // ── Погода / террейн / комнаты / ветер ──
    case 'sunny-day': case 'rain-dance': case 'sandstorm': case 'hail': case 'snowscape': {
      const w = WEATHER_SET[slug];
      S.currentWeather = w;
      S.weatherTurns = FIELD_TURNS;
      return done(`${uname} меняет погоду: ${WEATHER_ICONS[w] || ''} ${WEATHER_NAMES[w] || w}!`);
    }
    case 'electric-terrain': case 'misty-terrain': case 'grassy-terrain': case 'psychic-terrain': {
      const kind = TERRAIN_SET[slug];
      S.terrain = { kind, turns: FIELD_TURNS };
      // Поле встало — держатели семян тут же едят
      maybeConsumeTerrainSeed(S.activePlayerMon);
      maybeConsumeTerrainSeed(S.activeWild);
      return done(`${uname} поднял поле: ${kind}!`);
    }
    case 'tailwind': {
      if (isPlayer) S.tailwindP = TAILWIND_TURNS; else S.tailwindW = TAILWIND_TURNS;
      return done(`${uname} подгоняет ветер в спину! (скорость ×2)`);
    }
    case 'trick-room': {
      if ((S.trickRoomTurns || 0) > 0) {
        S.trickRoomTurns = 0;
        return done('Искажения времени исчезают!');
      }
      S.trickRoomTurns = TRICK_ROOM_TURNS;
      return done(`${uname} искажает время! Теперь первым ходит медленный!`);
    }
    // ── Taunt / Encore / Disable / Torment / Imprison ──
    case 'taunt': {
      monVol(foe).taunt = 3;
      return done(`${fname} в насмешке! Только атакующие приёмы!`);
    }
    case 'encore': {
      if (!foeLast) return done('Вынуждать нечего — противник ещё не бил!');
      monVol(foe).encore = { move: foeLast, turns: 3 };
      return done(`${fname} вынужден повторять ${foeLast}!`);
    }
    case 'disable': {
      if (!foeLast) return done('Отключать нечего — противник ещё не бил!');
      monVol(foe).disable = { move: foeLast, turns: 4 };
      return done(`Атака ${foeLast} отключена!`);
    }
    case 'torment': {
      monVol(foe).torment = true;
      return done(`${fname} измучен — нельзя повторять атаки!`);
    }
    case 'imprison': {
      const known = (userMoves || []).filter(Boolean).map((m: any) => normMoveName(m.name));
      if (isPlayer) S.imprisonP = known; else S.imprisonW = known;
      return done(`${uname} запечатывает свои атаки для противника!`);
    }
    // ── Stockpile / Swallow ──
    case 'stockpile': {
      user.stock = Math.min(3, (user.stock || 0) + 1);
      statStageModify(user, 'def', 1, !isPlayer);
      statStageModify(user, 'spd', 1, !isPlayer);
      return done(`${uname} запасается! (заряды: ${user.stock}, защита растёт)`);
    }
    case 'swallow': {
      const pct = swallowPct(user.stock || 0);
      if (pct == null) return done('Глотать нечего — зарядов нет!');
      user.stock = 0;
      const amt = healSelf(pct);
      return done(`${uname} глотает запасы! (+${amt} HP)`, 'heal');
    }
    // ── Смена типа ──
    case 'conversion': {
      const first = (userMoves || []).find((m: any) => m && m.type?.name);
      if (!first) return done('Некуда преобразовываться!');
      user.typeOverride = [first.type.name];
      return done(`${uname} становится типа ${first.type.name}!`);
    }
    case 'conversion-2': {
      const foeDetail = isPlayer ? S.lastWildMoveDetail : S.lastPlayerMoveDetail;
      const atkType = foeDetail?.type?.name;
      const rt = atkType ? resistantType(atkType, TYPE_CHART) : null;
      if (!rt) return done('Не получилось подобрать устойчивость!');
      user.typeOverride = [rt];
      return done(`${uname} становится устойчивым: тип ${rt}!`);
    }
    case 'reflect-type': {
      const types = effTypes(foe).filter(Boolean);
      if (!types.length) return done('Копировать нечего!');
      user.typeOverride = [...types];
      return done(`${uname} копирует тип: ${types.join('/')}!`);
    }
    case 'soak': {
      foe.typeOverride = ['water'];
      return done(`${fname} промок — теперь водный тип!`);
    }
    case 'magic-powder': {
      foe.typeOverride = ['psychic'];
      return done(`${fname} опылён — теперь психический тип!`);
    }
    case 'forests-curse': {
      const t = effTypes(foe);
      if (!t.includes('grass')) t.push('grass');
      foe.typeOverride = t;
      return done(`${fname} проклят лесом — добавлен травяной тип!`);
    }
    case 'trick-or-treat': {
      const t = effTypes(foe);
      if (!t.includes('ghost')) t.push('ghost');
      foe.typeOverride = t;
      return done(`${fname} напуган — добавлен призрачный тип!`);
    }
    case 'camouflage': {
      user.typeOverride = ['normal'];
      return done(`${uname} сливается с местностью!`);
    }
    // ── Стадии: копирование/сброс/инверсия/обмен ──
    case 'psych-up': {
      user.statStages = { ...(foe.statStages || {}) };
      return done(`${uname} копирует изменения статов!`);
    }
    case 'haze': {
      const zero = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      user.statStages = { ...zero };
      foe.statStages = { ...zero };
      return done('Дымка сбрасывает все изменения статов!');
    }
    case 'topsy-turvy': {
      const s = foe.statStages || {};
      foe.statStages = { atk: -(s.atk || 0), def: -(s.def || 0), spa: -(s.spa || 0), spd: -(s.spd || 0), spe: -(s.spe || 0) };
      return done(`Статы ${fname} перевёрнуты!`);
    }
    case 'power-trick': {
      const a = user.statStages || {};
      const atk = a.atk || 0;
      a.atk = a.def || 0;
      a.def = atk;
      user.statStages = a;
      return done(`${uname} меняет атаку и защиту местами!`);
    }
    case 'power-swap': case 'guard-swap': case 'heart-swap': case 'speed-swap': {
      const keys = slug === 'power-swap' ? ['atk', 'spa']
        : slug === 'guard-swap' ? ['def', 'spd']
        : slug === 'speed-swap' ? ['spe'] : ['atk', 'def', 'spa', 'spd', 'spe'];
      const a = user.statStages || {};
      const b = foe.statStages || {};
      for (const k of keys) {
        const t = a[k] || 0;
        a[k] = b[k] || 0;
        b[k] = t;
      }
      user.statStages = a;
      foe.statStages = b;
      return done(`${uname} и ${fname} меняются усилениями!`);
    }
    case 'power-split': case 'guard-split': {
      // Упрощение: усредняем СТАДИИ (базовые статы в сейвах трогать нельзя).
      const keys = slug === 'power-split' ? ['atk', 'spa'] : ['def', 'spd'];
      const a = user.statStages || {};
      const b = foe.statStages || {};
      for (const k of keys) {
        const avg = Math.round(((a[k] || 0) + (b[k] || 0)) / 2);
        a[k] = avg;
        b[k] = avg;
      }
      user.statStages = a;
      foe.statStages = b;
      return done(`${uname} и ${fname} делят силу поровну!`);
    }
    // ── Способности (только на этот бой, монстры не меняются) ──
    case 'skill-swap': {
      const a = currentBattleAbility(user, user === S.activeWild);
      const b = currentBattleAbility(foe, foe === S.activeWild);
      setBattleAbility(user, user === S.activeWild, b);
      setBattleAbility(foe, foe === S.activeWild, a);
      updateAbilityDisplay();
      return done(`${uname} и ${fname} меняются способностями!`);
    }
    case 'entrainment': {
      const cur = currentBattleAbility(user, user === S.activeWild);
      if (!cur) return done('Передавать нечего!');
      setBattleAbility(foe, foe === S.activeWild, cur);
      updateAbilityDisplay();
      return done(`${fname} получает способность ${cur}!`);
    }
    case 'worry-seed': {
      setBattleAbility(foe, foe === S.activeWild, 'insomnia');
      updateAbilityDisplay();
      return done(`${fname} теперь не спит: Бессонница!`);
    }
    case 'gastro-acid': {
      setBattleAbility(foe, foe === S.activeWild, null);
      updateAbilityDisplay();
      return done(`Способность ${fname} подавлена!`);
    }
    case 'simple-beam': {
      setBattleAbility(foe, foe === S.activeWild, 'simple');
      updateAbilityDisplay();
      return done(`${fname} теперь Простой!`);
    }
    // ── Ловушки: mean-look / spider-web / octolock / jaw-lock ──
    // Противник не может сбежать/смениться (проверки в побеге, смене, телепорте).
    case 'mean-look': case 'spider-web': {
      foe.trapped = true;
      return done(`${fname} не может уйти!`);
    }
    case 'octolock': {
      foe.trapped = true;
      statStageModify(foe, 'def', -1, foeIsWild);
      statStageModify(foe, 'spd', -1, foeIsWild);
      return done(`${fname} в оковах! Защита падает, уйти нельзя!`);
    }
    // ── Фокус и прицел (аудит итемов/атак) ──
    case 'focus-energy': {
      user.focusEnergy = true;
      return done(`${uname} сосредоточился! (крит +2 ступени)`);
    }
    case 'laser-focus': {
      user.laserFocus = true;
      return done(`${uname} прицелился! Следующая атака — точно крит!`);
    }
    // ── Желания/судьба/стойкость ──
    case 'wish': {
      monVol(user).wish = true;
      return done(`${uname} загадывает желание!`);
    }
    case 'destiny-bond': {
      monVol(user).destiny = true;
      return done(`${uname} связывает судьбу с противником!`);
    }
    case 'endure': {
      monVol(user).endure = true;
      return done(`${uname} стоит насмерть! (переживёт удар с 1 HP)`);
    }
    // ── Pain Split / Strength Sap ──
    case 'pain-split': {
      const avg = Math.floor((getHp() + (foeIsWild ? S.wildCurHP : foe.currentHp)) / 2);
      setHp(avg);
      if (foeIsWild) { S.wildCurHP = avg; updateWildHpUI(); }
      else { foe.currentHp = avg; updatePlayerHpUI(); }
      return done(`Боль поделена поровну: по ${avg} HP!`);
    }
    case 'strength-sap': {
      statStageModify(foe, 'atk', -1, foeIsWild);
      const amt = Math.max(1, baseAttackOf(foe, foeIsWild));
      setHp(Math.min(maxHp(), getHp() + amt));
      return done(`${uname} высасывает силу! Атака падает, +${amt} HP`, 'heal');
    }
    // ── Отдых / кольца / проклятия ──
    case 'rest': {
      cureStatus(user);
      if (isPlayer) {
        user.currentHp = user.maxHp;
        updatePlayerHpUI();
      } else {
        S.wildCurHP = S.wildMaxHP;
        updateWildHpUI();
      }
      applyStatusEffect(user, 'slp');
      user.sleepTurns = 2;
      if (isPlayer) {
        document.getElementById('player-status-icon').innerText = getStatusIcon('slp');
      } else {
        S.wildStatus = 'slp';
        document.getElementById('wild-status-icon').innerText = getStatusIcon('slp');
      }
      return done(`${uname} отдыхает: полное HP и сон на 2 хода!`, 'heal');
    }
    case 'aqua-ring': {
      monVol(user).aquaRing = true;
      return done(`${uname} окружает себя водяным кольцом!`);
    }
    case 'snatch': {
      // Упрощение: крадёт текущие усиления (как spectral-thief без урона)
      const fs = foe.statStages || {};
      const stolen = ['atk', 'def', 'spa', 'spd', 'spe'].some((k) => (fs[k] || 0) > 0);
      if (!stolen) return done('Красть нечего — усилений нет!');
      const us = user.statStages || { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) {
        us[k] = Math.max(-6, Math.min(6, (us[k] || 0) + Math.max(0, fs[k] || 0)));
        fs[k] = 0;
      }
      user.statStages = us;
      foe.statStages = fs;
      updateStatBadges();
      return done(`${uname} выхватывает усиления!`);
    }
    case 'grudge': {
      monVol(user).grudge = true;
      return done(`${uname} затаил злобу! (добьёт — у врага кончится PP)`);
    }
    case 'instruct': {
      // Упрощение: как encore на 1 ход — противник повторяет последнюю атаку
      const last = foeIsWild ? S.lastWildMove : S.lastPlayerMove;
      if (!last) return done('Приказывать нечего!');
      monVol(foe).encore = { move: last, turns: 1 };
      return done(`${uname} приказывает: ${fname} повторяет ${last}!`);
    }
    case 'court-change': {
      const t = S.playerReflectTurns; S.playerReflectTurns = S.enemyReflectTurns; S.enemyReflectTurns = t;
      const t2 = S.playerLightScreenTurns; S.playerLightScreenTurns = S.enemyLightScreenTurns; S.enemyLightScreenTurns = t2;
      const t3 = S.tailwindP || 0; S.tailwindP = S.tailwindW || 0; S.tailwindW = t3;
      return done(`${uname} меняет стороны поля! (экраны и ветер)`);
    }
    case 'magic-coat': {
      monVol(user).magicCoat = true;
      return done(`${uname} готов отразить статус!`);
    }
    case 'quash': {
      // В синглах нашего движка враг и так ходит после игрока —
      // если он уже сходил, поздно; иначе фиксируем факт.
      return done(`${uname} откладывает ход противника! (он и так ходит вторым)`);
    }
    case 'after-you': {
      return done(`${uname} пропускает противника вперёд! (он и так ходит вторым)`);
    }
    case 'helping-hand': case 'rage-powder': case 'follow-me': case 'ally-switch':
    case 'aromatic-mist': case 'coaching': case 'gear-up': case 'magnetic-flux':
    case 'spotlight': {
      return done(`${uname} зовёт напарника — но бьётся один! Без эффекта.`);
    }
    case 'mimic': {
      // Как sketch, но только до конца боя (упрощение: так же постоянно —
      // слот всё равно вернётся при смене набора; отдельно не отслеживаем).
      const last = foeIsWild ? S.lastWildMove : S.lastPlayerMove;
      if (!last) return done('Копировать нечего!');
      return done(`${uname} запоминает ${last}! (как sketch — смените атаку вручную)`);
    }
    case 'refresh': {
      if (!user.status) return done('Статусов нет — нечего освежать!');
      cureStatus(user);
      if (isPlayer) document.getElementById('player-status-icon').innerText = getStatusIcon(user.status);
      else { S.wildStatus = user.status; document.getElementById('wild-status-icon').innerText = getStatusIcon(user.status); }
      return done(`${uname} освежается!`);
    }
    case 'acupressure': {
      const keys = ['atk', 'def', 'spa', 'spd', 'spe', 'eva'];
      const k = keys[Math.floor(Math.random() * 5)]; // без уклонения в движке — 5 статов
      statStageModify(user, k as any, 2, !isPlayer);
      return done(`${uname}: точка нажата — ${k} +2!`);
    }
    case 'psycho-shift': {
      if (!user.status) return done('Передавать нечего — чист!');
      if (foe.status) return done('Противник уже со статусом!');
      foe.status = user.status;
      foe.sleepTurns = user.sleepTurns || 0;
      cureStatus(user);
      if (foeIsWild) { S.wildStatus = foe.status; document.getElementById('wild-status-icon').innerText = getStatusIcon(foe.status); }
      else document.getElementById('player-status-icon').innerText = getStatusIcon(foe.status);
      if (isPlayer) document.getElementById('player-status-icon').innerText = getStatusIcon(user.status);
      else { S.wildStatus = user.status; document.getElementById('wild-status-icon').innerText = getStatusIcon(user.status); }
      return done(`${uname} перекладывает статус на противника!`);
    }
    case 'curse': {
      const utypes = effTypes(user);
      if (utypes.includes('ghost')) {
        setHp(Math.max(1, Math.floor(maxHp() / 2)));
        monVol(foe).cursed = true;
        return done(`${uname} проклинает ${fname} ценой половины HP!`);
      }
      statStageModify(user, 'atk', 1, !isPlayer);
      statStageModify(user, 'def', 1, !isPlayer);
      statStageModify(user, 'spe', -1, !isPlayer);
      return done(`${uname}: атака/защита +1, скорость −1!`);
    }
    case 'foresight': case 'odor-sleuth': {
      monVol(foe).foresight = true;
      return done(`${fname} распознан: нормальные/боевые бьют по призраку!`);
    }
    case 'lock-on': case 'mind-reader': {
      user.lockedOn = true;
      return done(`${uname} берёт цель на мушку!`);
    }
    case 'gravity': {
      S.gravityTurns = 5;
      return done(`${uname} усиливает гравитацию! Летающие — на земле!`);
    }
    case 'wonder-room': {
      const a = user.statStages || {};
      const b = foe.statStages || {};
      for (const k of ['def', 'spd']) {
        const t = a[k] || 0;
        a[k] = b[k] || 0;
        b[k] = t;
      }
      user.statStages = a;
      foe.statStages = b;
      return done('Чудо-комната меняет защиту и сп. защиту местами!');
    }
    case 'magic-room': {
      S.magicRoomTurns = 5;
      return done('Волшебная комната: предметы молчат!');
    }
    case 'mist': {
      if (isPlayer) S.mistP = 5; else S.mistW = 5;
      return done(`${uname} прячется в тумане! (статы не понизят)`);
    }
    case 'safeguard': {
      if (isPlayer) S.safeguardP = 5; else S.safeguardW = 5;
      return done(`${uname} под защитой! (статусы не пройдут)`);
    }
    case 'lucky-chant': {
      if (isPlayer) S.luckyP = 5; else S.luckyW = 5;
      return done(`${uname} под счастливым напевом! (без критов)`);
    }
    case 'aurora-veil': {
      if (S.currentWeather !== 'hail') return done('Без града вуаль не встаёт!');
      if (isPlayer) { S.playerReflectTurns = 5; S.playerLightScreenTurns = 5; }
      else { S.enemyReflectTurns = 5; S.enemyLightScreenTurns = 5; }
      return done(`${uname} ставит полярное сияние!`);
    }
    case 'pay-day': {
      // Урон — обычным ходом (power 40 в данных); здесь только метка монет.
      // Деньги начисляются в награде за победу (см. handleWildFaintRewards).
      monVol(user).payDay = (monVol(user).payDay || 0) + 1;
      return done(`${uname} разбрасывает монеты!`);
    }
    // ── NO-META новинки (в данных meta пустое — по имени) ──
    case 'tidy-up': {
      statStageModify(user, 'atk', 1, !isPlayer);
      statStageModify(user, 'spe', 1, !isPlayer);
      if (isPlayer) S.enemySubstituteHP = 0; else S.substituteHP = 0;
      return done(`${uname} прибирается: атака и скорость +1!`);
    }
    case 'take-heart': {
      statStageModify(user, 'spa', 1, !isPlayer);
      statStageModify(user, 'spd', 1, !isPlayer);
      cureStatus(user);
      if (!isPlayer) document.getElementById('player-status-icon').innerText = getStatusIcon(user.status);
      else { S.wildStatus = user.status; document.getElementById('wild-status-icon').innerText = getStatusIcon(user.status); }
      return done(`${uname} собирается с духом: +спецатаки и чист!`);
    }
    case 'shelter': {
      statStageModify(user, 'def', 2, !isPlayer);
      return done(`${uname} прячется в укрытие: защита +2!`);
    }
    case 'fillet-away': {
      if (getHp() <= Math.floor(maxHp() / 2)) return done('Слишком мало HP для рывка!');
      setHp(getHp() - Math.floor(maxHp() / 2));
      for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) statStageModify(user, k as any, 2, !isPlayer);
      return done(`${uname} рвётся вперёд ценой половины HP! Все статы +2!`);
    }
    case 'shed-tail': {
      if (getHp() <= Math.floor(maxHp() / 2)) return done('Слишком мало HP для хвоста!');
      setHp(getHp() - Math.floor(maxHp() / 2));
      if (isPlayer) S.substituteHP = Math.max(1, Math.floor(maxHp() / 4));
      else S.enemySubstituteHP = Math.max(1, Math.floor(maxHp() / 4));
      return done(`${uname} оставляет хвост-заменитель! (упрощение: без смены)`);
    }
    case 'burning-bulwark': {
      if (isPlayer) S.protectActive = true; else S.enemyProtectActive = true;
      user.shieldPunish = 'burn';
      return done(`${uname} встаёт в пылающий заслон!`);
    }
    case 'lunar-blessing': {
      const amt = healSelf(25);
      cureStatus(user);
      return done(`${uname} благословлён луной! (+${amt} HP, чист)`, 'heal');
    }
    case 'snowscape': {
      S.currentWeather = 'hail';
      S.weatherTurns = FIELD_TURNS;
      return done(`${uname} вызывает снегопад!`);
    }
    case 'jungle-healing': {
      const amt = healSelf(25);
      cureStatus(user);
      return done(`${uname} лечится джунглями! (+${amt} HP, чист)`, 'heal');
    }
    case 'shore-up': {
      const pct = S.currentWeather === 'sandstorm' ? 100 : 50;
      const amt = healSelf(pct);
      return done(`${uname} зарывается в песок! (+${amt} HP)`, 'heal');
    }
    case 'floral-healing': {
      const pct = S.terrain?.kind === 'grassy' ? 67 : 50;
      const amt = healSelf(pct);
      return done(`${uname} лечится цветами! (+${amt} HP)`, 'heal');
    }
    default:
      return false;
  }
}

/**
 * applyShieldPunish — наказание за атаку в шипастый щит (проход-741).
 * spiky-shield — 1/8 макс HP, king-shield — −1 атаки, obstruct — −1 защиты,
 * baneful-bunker — отравление, burning-bulwark — ожог. Флаг одноразовый.
 */
function applyShieldPunish(defender: any, attacker: any, attackerIsWild: boolean) {
  const punish = defender?.shieldPunish;
  if (defender) defender.shieldPunish = null;
  if (!punish || !attacker) return;
  const anm = monLogName(attacker, attackerIsWild);
  if (punish === 'damage') {
    const max = attackerIsWild ? S.wildMaxHP : attacker.maxHp;
    const chip = Math.max(1, Math.floor(max / 8));
    if (attackerIsWild) { S.wildCurHP = Math.max(0, S.wildCurHP - chip); updateWildHpUI(); }
    else { attacker.currentHp = Math.max(0, attacker.currentHp - chip); updatePlayerHpUI(); }
    appendToLog(`${anm} ранится о шипы! (−${chip} HP)`, false, 'dmg');
  } else if (punish === 'atk' || punish === 'def') {
    statStageModify(attacker, punish as any, -1, attackerIsWild);
    appendToLog(`${punish === 'atk' ? 'Атака' : 'Защита'} ${anm} падает!`, false, 'system');
  } else if (punish === 'poison' || punish === 'burn') {
    if (!attacker.status) {
      const st = punish === 'poison' ? 'psn' : 'brn';
      attacker.status = st;
      if (attackerIsWild) {
        S.wildStatus = st;
        document.getElementById('wild-status-icon').innerText = getStatusIcon(st);
      } else {
        document.getElementById('player-status-icon').innerText = getStatusIcon(st);
      }
      appendToLog(`${anm} ${punish === 'poison' ? 'отравлен' : 'обожжён'}!`, false, 'system');
    }
  }
}

/**
 * guardFaintWild/guardFaintPlayer — endure/destiny-bond в точке обморока.
 * Возвращает true если обморок ПРЕДОТВРАЩЁН (endure сработал — вызывающий
 * делает return и продолжает бой). Destiny Bond не предотвращает, а забирает
 * противника с собой — после него обычный флоу (оба падают).
 * Endure ловит только прямой урон хода (флаги tookHit), яд/погоду — нет.
 */
function guardFaintWild(): boolean {
  if (S.wildCurHP > 0) return false;
  // Фикс: Focus Band — 10% пережить добивающий удар с 1 HP
  if (S.activeWild.heldItem === 'focusBand' && Math.random() < 0.1) {
    S.wildCurHP = 1;
    updateWildHpUI();
    appendToLog(`Дикий ${S.activeWild.name} держится благодаря Focus Band! (1 HP)`, false, 'system');
    return true;
  }
  // Проход-741: Grudge — добивший ход врага теряет все PP
  if (S.activeWild.vol?.grudge && S.lastPlayerMove) {
    const idx = (S.playerMovesDetailed || []).findIndex((m: any) => m && normMoveName(m.name) === S.lastPlayerMove);
    if (idx >= 0 && S.activePlayerMon.movesPP?.[idx]) {
      S.activePlayerMon.movesPP[idx].current = 0;
      appendToLog(`Злоба дикого ${S.activeWild.name}: у ${S.lastPlayerMove} кончились PP!`, false, 'system');
    }
    S.activeWild.vol.grudge = false;
  }
  if (S.activeWild.vol?.endure && S.wildTookHit) {
    S.activeWild.vol.endure = false;
    S.wildCurHP = 1;
    updateWildHpUI();
    appendToLog(`Дикий ${S.activeWild.name} выдерживает удар! (1 HP)`, false, 'system');
    return true;
  }
  if (S.activeWild.vol?.destiny) {
    S.activeWild.vol.destiny = false;
    S.activePlayerMon.currentHp = 0;
    updatePlayerHpUI();
    appendToLog(`Дикий ${S.activeWild.name} забирает противника с собой!`, false, 'system');
  }
  return false;
}

function guardFaintPlayer(): boolean {
  if (S.activePlayerMon.currentHp > 0) return false;
  // Фикс: Focus Band — 10% пережить добивающий удар с 1 HP
  if (S.activePlayerMon.heldItem === 'focusBand' && Math.random() < 0.1) {
    S.activePlayerMon.currentHp = 1;
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} держится благодаря Focus Band! (1 HP)`, false, 'system');
    return true;
  }
  // Проход-741: Grudge — добивший ход дикого теряет все PP
  if (monVol(S.activePlayerMon).grudge && S.lastWildMove) {
    const idx = (S.wildMovesDetailed || []).findIndex((m: any) => m && normMoveName(m.name) === S.lastWildMove);
    if (idx >= 0 && S.wildMovesPP?.[idx]) {
      S.wildMovesPP[idx].current = 0;
      appendToLog(`Злоба ${S.activePlayerMon.apiData.name}: у ${S.lastWildMove} кончились PP!`, false, 'system');
    }
    monVol(S.activePlayerMon).grudge = false;
  }
  if (monVol(S.activePlayerMon).endure && S.playerTookHit) {
    monVol(S.activePlayerMon).endure = false;
    S.activePlayerMon.currentHp = 1;
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} выдерживает удар! (1 HP)`, false, 'system');
    return true;
  }
  if (S.activePlayerMon.vol?.destiny) {
    S.activePlayerMon.vol.destiny = false;
    S.wildCurHP = 0;
    updateWildHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} забирает противника с собой!`, false, 'system');
  }
  return false;
}

/**
 * checkStatusTurn — проверить, может ли покемон действовать в этом ходу.
 * Эффекты:
 *   Сон (slp) — каждый ход уменьшает sleepTurns, когда доходит до 0 — просыпается
 *   Заморозка (frz) — 20% шанс оттаять каждый ход
 *   Паралич (par) — 25% шанс пропустить ход
 *
 * ВОЗВРАЩАЕТ: true если может действовать, false если пропускает ход.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: useMove() строка 1530, enemyTurn() строка 1847
 */
function checkStatusTurn(target, isPlayer) {
  if (!target.status) return true; // Нет статуса — может действовать

  // Сон: спит sleepTurns ходов, потом просыпается
  if (target.status === 'slp') {
    target.sleepTurns--;
    if (target.sleepTurns <= 0) {
      cureStatus(target);
      appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} проснулся!`, false, 'system');
      return true;
    } else {
      appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} спит... (осталось ${target.sleepTurns} ходов)`, false, 'status');
      return false; // Пропускает ход
    }
  }

  // Заморозка: 20% шанс оттаять каждый ход
  if (target.status === 'frz') {
    if (Math.random() < 0.2) {
      cureStatus(target);
      appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} оттаял!`, false, 'system');
      return true;
    } else {
      appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} заморожен!`, false, 'status');
      return false;
    }
  }

  // Паралич: 25% шанс пропустить ход
  if (target.status === 'par') {
    if (Math.random() < 0.25) {
      appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} парализован и не может двигаться!`, false, 'status');
      return false;
    }
    return true; // 75% может действовать
  }

  return true; // Яд и ожог не мешают действовать
}

/**
 * applyStatusEndOfTurn — нанести урон от статуса в конце хода.
 * Яд (psn): 1/8 от макс HP каждый ход
 * Токсин (tox): растущий урон 1/16, 2/16, 3/16… за каждый тик
 * Ожог (brn): 1/16 от макс HP каждый ход
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   useMove() — после хода игрока (яд/токсин игрока, Семя Ужаса)
 *   finishEnemyTurn() — после хода врага (яд/токсин врага, Семя Ужаса)
 */
function applyStatusEndOfTurn(target, isPlayer) {
  if (!target.status) return;
  // Magic Guard блокирует урон от статусов (яд, токсин, ожог).
  // Poison Heal — исключение: это лечение, оно проходит.
  if (hasMagicGuard(target, !isPlayer)) return;

  if (target.status === 'psn') {
    // Poison Heal: способность превращает урон от яда в лечение того же размера.
    const maxHp = isPlayer ? S.activePlayerMon.maxHp : S.wildMaxHP;
    const phAbil = ((target.abilities?.[0]?.ability?.name) || target.abilityName || '')
      .toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (phAbil === 'poisonheal') {
      const heal = Math.max(1, Math.floor(maxHp / 8));
      const label = isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name;
      if (isPlayer) {
        S.activePlayerMon.currentHp = Math.min(maxHp, S.activePlayerMon.currentHp + heal);
        updatePlayerHpUI();
      } else {
        S.wildCurHP = Math.min(maxHp, S.wildCurHP + heal);
        updateWildHpUI();
      }
      appendToLog(`${label} восстанавливает HP от Ядовитого лечения! (+${heal})`, false, 'heal');
      return;
    }
    const dmg = Math.max(1, Math.floor(maxHp / 8));
    if (isPlayer) {
      S.activePlayerMon.currentHp -= dmg;
      if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    } else {
      S.wildCurHP -= dmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }
    appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} теряет HP от яда! (-${dmg} HP)`, false, 'dmg');
  }

  // Токсин: растущий урон по решению из спецификации. Счётчик тиков хранится
  // на самом объекте, обнуляется при cure/applyStatus (logic.ts).
  if (target.status === 'tox') {
    target.toxCounter = (target.toxCounter || 0) + 1;
    const maxHp = isPlayer ? S.activePlayerMon.maxHp : S.wildMaxHP;
    const dmg = Math.max(1, Math.floor(maxHp * target.toxCounter / 16));
    if (isPlayer) {
      S.activePlayerMon.currentHp -= dmg;
      if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    } else {
      S.wildCurHP -= dmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }
    appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} отравлен токсином (${target.toxCounter} тик, -${dmg} HP)!`, false, 'dmg');
  }

  if (target.status === 'brn') {
    const dmg = Math.max(1, Math.floor((isPlayer ? S.activePlayerMon.maxHp : S.wildMaxHP) / 16));
    if (isPlayer) {
      S.activePlayerMon.currentHp -= dmg;
      if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
    } else {
      S.wildCurHP -= dmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }
    appendToLog(`${isPlayer ? S.activePlayerMon.apiData.name : S.activeWild.name} теряет HP от ожога! (-${dmg} HP)`, false, 'dmg');
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 8: СМЕНА ПОКЕМОНА (SWITCH)
// ═══════════════════════════════════════════════════════════════
// switchPokemon — открывает модалку выбора покемона из команды.
// После смены — ход передаётся противнику.
// Нельзя сменить покемона в бою с лидером зала (кроме случая fainted).
// ─────────────────────────────────────────────────────────────

/**
 * switchPokemon — показать модалку выбора покемона для смены.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Фильтрует живых покемонов (кроме текущего активного)
 *   2. Показывает showSelectionModal с именами и HP
 *   3. После выбора: меняет S.activePlayerMon, обнуляет choiceLockedMove
 *   4. Перезагружает кнопки атак и UI
 *   5. Передаёт ход противнику (enemyTurn)
 *
 * ОГРАНИЧЕНИЯ:
 *   Нельзя сменить в gyn/elite/champion бою (кнопка блокируется отдельно)
 *   Нельзя сменить на мёртвого покемона
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: по кнопке "btn-switch" в initEncounterEvents()
 */
/**
 * fleeWildBattle — принудительный конец дикого боя (roar/whirlwind/teleport).
 * Без наград и без самоподрыва: противник сбежал или игрок телепортировался.
 * Жалоба 5: раньше делали battle.transition(IDLE) напрямую — из ENEMY_TURN
 * (телепорт дикого) такой переход запрещён картой, фаза залипала в ENEMY_TURN.
 * Теперь уходим через leaveBattleToIdle (forcePhase-фолбэк) и гасим модалку,
 * иначе бой «кончился», а окно висит без кнопок. Кнопки переиспользуем:
 * btn-run (побег) и btn-leave-battle уже есть, новых id не добавляем.
 */
function fleeWildBattle(msg: string) {
  try { document.getElementById('battle-main-menu').style.display = 'none'; } catch (_) {}
  appendToLog(msg);
  leaveBattleToIdle(battle);
  clearBattleState();
  S.escapeAttempts = 0;
  // Модалку гасим сразу (бой кончился): раньше она оставалась открытой
  // с пустым меню — выглядело как «кнопки уйти нет».
  try {
    const modal = document.getElementById('encounter-modal');
    if (modal) modal.style.display = 'none';
    const endMenu = document.getElementById('battle-end-menu');
    if (endMenu) endMenu.style.display = 'none';
  } catch (_) {}
  store.autoSave();
}

function switchPokemon() {
  // Проход-741: ловушка не даёт смениться. Жалоба 6: bind-семья ставит
  // vol.trapped, mean-look — прямой trapped — проверяем оба через isHeldByTrap.
  if (isHeldByTrap(S.activePlayerMon)) {
    showToast('Ловушка держит покемона — смена невозможна!', true);
    return;
  }
  // Ищем живых покемонов, исключая текущего активного
  const aliveMons = GS.myTeam.filter((mon, i) => mon.currentHp > 0 && mon !== S.activePlayerMon);
  if (aliveMons.length === 0) { showToast('Нет других покемонов для смены!', true); return; }

  const items = aliveMons.map((m) => ({
    label: `Lv.${m.baseLevel + m.candiesEaten} ${m.name || m.apiData?.name}`,
    subtitle: `HP: ${m.currentHp}/${m.maxHp}`
  }));

  showSelectionModal('Выберите покемона', items, (idx) => {
    const newActive = aliveMons[idx];
    const oldActive = S.activePlayerMon;

    // Способности ухода с поля срабатывают ДО фактической смены.
    applySwitchOutAbilities(oldActive);

    // Жалоба 3/6: уход с поля сбрасывает волатильное уходящего (confusion/
    // ловушка/заряды) — иначе оно «переходит на новых» при возврате.
    try {
      if (oldActive) {
        oldActive.vol = {};
        clearTrapState(oldActive);
        oldActive.lockedOn = false;
        oldActive.recharging = false;
        oldActive.hiddenIn = null;
        oldActive.bide = null;
        oldActive.stock = 0;
        oldActive.laserFocus = false;
        oldActive.focusEnergy = false;
        oldActive.flinch = false;
      }
    } catch (_) {}

    // Меняем активного покемона (порядок в команде не меняется)
    S.activePlayerMon = newActive;

    // Проход-741: healing-wish/lunar-dance действуют и при ручной смене
    if (S.pendingHeal) {
      const full = S.pendingHeal === 'fullpp';
      S.activePlayerMon.currentHp = S.activePlayerMon.maxHp;
      S.activePlayerMon.status = null;
      S.activePlayerMon.sleepTurns = 0;
      if (full && Array.isArray(S.activePlayerMon.movesPP)) {
        S.activePlayerMon.movesPP = S.activePlayerMon.movesPP.map((pp: any) => pp ? { current: pp.max, max: pp.max } : pp);
      }
      S.pendingHeal = null;
      appendToLog(`Желание исполнено: ${S.activePlayerMon.nickname || S.activePlayerMon.apiData.name} полностью здоров!`, false, 'heal');
    }

    // Сбрасываем блокировку Choice-предмета
    delete S.activePlayerMon.choiceLockedMove;

    // При смене покемона теряется заряд двух-ходовой атаки
    S.playerChargedMove = null;

    appendToLog(`${oldActive.name || oldActive.apiData?.name}, возвращайся! Вперёд, ${newActive.name || newActive.apiData?.name}!`, false, 'switch');

    // Перезагружаем кнопки атак для нового покемона
    S.playerMovesDetailed = [];
    const handler = useMove;
    loadMoveButtons(S.activePlayerMon, handler);

    // Обновляем весь UI игрока
    document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
    (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
    document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
    updatePlayerHpUI();
    updateAbilityDisplay();

    // Противник получает ход после смены
    document.getElementById('battle-main-menu').style.display = 'none';
    setTimeout(() => { enemyTurn(); }, 1500);
  }, true);
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 9: СИСТЕМА ВСТРЕЧ (ENCOUNTERS)
// ═══════════════════════════════════════════════════════════════
// ENCOUNTER_WEIGHTS — веса для выбора покемона на локации.
//   Чем выше вес — тем чаще встречается покемон.
//   Legendaries: 0.01 (крайне редко)
//   Common (Pidgey, Rattata): 2.0 (очень часто)
//   Graphite Bell (предмет): ×3 к весу редких (вес ≤ 0.3)
//
// pickWeightedEncounter — выбирает покемона из списка с учётом весов.
// getWildLevel — определяет уровень дикого покемона по локации.
// getLocationEncounters — получает список покемонов на текущей локации.
// startAutoHunt / stopAutoHunt — автоматический поиск с таймером.
// FISHING_TABLES — таблицы рыбалки для разных удочек.
// startHunt — запуск битвы с диким покемоном.
//
// ИСПОЛЬЗУЕТ:
//   data/locations.ts — список покемонов на каждой локации
//   PokeAPI — загрузка данных покемона
//   store.getLocation() — получение данных локации по ID
// ─────────────────────────────────────────────────────────────

// Редкость появления выведена из СИЛЫ вида (src/data/power.ts):
// encounterWeightFor() — обратно пропорциональна BST, легендарки 0.02.
// Рукописная таблица ENCOUNTER_WEIGHTS на ~70 видов удалена: для всех
// остальных ~1200 она давала дефолт 1.0, из-за чего «редкие» формы
// (Ancient Kabuto) выпадали чаще обычных.

/**
 * pickWeightedEncounter — выбрать покемона из списка с учётом весов.
 *
 * Алгоритм "weighted random":
 *   1. Суммируем все веса → totalWeight
 *   2. Берём случайное число от 0 до totalWeight
 *   3. Проходим по массиву, вычитая вес каждого элемента
 *   4. Когда roll <= 0 — выбираем этот элемент
 *
 * Graphite Bell: утраивает вес редких покемонов (weight <= 0.3).
 * Это делает легендарок в 3 раза вероятнее, но всё равно очень редко.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: startAutoHunt (при авто-поиске)
 */
function pickWeightedEncounter(encountersArray) {
  const hasBell = (GS.inventory || {})['graphiteBell'] > 0; // Колокол = больше редких
  const weights = encountersArray.map(name => {
    // Вес по СИЛЕ вида, а не по рукописной таблице: сильные виды (и их
    // эволюции, они всегда сильнее базы) автоматически становятся реже.
    // Раньше для ~1200 видов не было записи в ENCOUNTER_WEIGHTS, все они
    // получали 1.0, и Ancient Kabuto ловился чаще обычного Kabuto.
    const base = encounterWeightFor(name);
    // Graphite Bell: x3 weight for rare pokemon (weight <= 0.3)
    return (hasBell && base <= 0.3) ? base * 3 : base;
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (let i = 0; i < encountersArray.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return encountersArray[i];
  }
  return encountersArray[encountersArray.length - 1]; // Fallback (последний)
}

/**
 * getWildLevel — определить уровень дикого покемона по текущей локации.
 *
 * Уровни растут с прогрессией по регионам:
 *   Pallet Town:      Lv 3-8
 *   Route 1-2:        Lv 5-12
 *   Early Johto:      Lv 5-15
 *   Mid-game Kanto:   Lv 12-22
 *   Late Johto:       Lv 25-35
 *   Victory Road:     Lv 40-50
 *   Default:          Lv 10-20
 *
 * ОТКУДА БЕРЁТ ЛОКАЦИЮ: GS.currentLocationId (глобальное состояние игры)
 */
function getWildLevel() {
  const loc = store.getLocation(GS.currentLocationId);
  const name = (loc?.name || '').toLowerCase();
  const id = GS.currentLocationId || '';

  // ── Если локация задаёт min/max уровень — используем его ──
  if (loc && loc.wildMinLvl !== undefined && loc.wildMaxLvl !== undefined) {
    const range = loc.wildMaxLvl - loc.wildMinLvl + 1;
    const base = Math.floor(Math.random() * range) + loc.wildMinLvl;
    // M-4: башня/руины — каждый подъём на этаж добавляет уровень врагу.
    return towerLevel(base, GS.towerFloor || 0, specialMechanic(loc)?.perFloorLvl);
  }

  // Johto routes early
  if (id.includes('route29') || id.includes('route30') || id.includes('route31') || id.includes('newBark') || id.includes('cherrygrove')) return Math.floor(Math.random() * 11) + 5;
  // Goldenrod
  if (id.includes('goldenrod') && !id.includes('stadium')) return Math.floor(Math.random() * 6) + 5;
  // Johto mid routes
  if (id.includes('route34') || id.includes('route35') || id.includes('route36') || id.includes('route37') || id.includes('route38') || id.includes('route39') || id.includes('ilex') || id.includes('nationalPark')) return Math.floor(Math.random() * 11) + 15;
  // Ecruteak + Olivine
  if (id.includes('ecruteak') || id.includes('olivine') || id.includes('route42') || id.includes('lakeOfRage')) return Math.floor(Math.random() * 11) + 25;
  // Blackthorn + Mt Silver
  if (id.includes('blackthorn') || id.includes('mtSilver') || id.includes('route45') || id.includes('icePath')) return Math.floor(Math.random() * 11) + 35;
  // Victory Road
  if (id.includes('victory') || id.includes('indigo')) return Math.floor(Math.random() * 11) + 40;
  // Late-game Kanto routes
  if (/route_(1[6-9]|2[0-1])/.test(id) || id.includes('cerulean')) return Math.floor(Math.random() * 11) + 30;
  // Mid-game Kanto
  if (/route_(1[1-6])/.test(id) || id.includes('safari') || id.includes('fuchsia') || id.includes('lavender')) return Math.floor(Math.random() * 11) + 20;
  // Early-mid
  if (/route_[6-9]|10/.test(id) || id.includes('saffron') || id.includes('celadon')) return Math.floor(Math.random() * 11) + 12;
  // Early
  if (/route_[4-6]/.test(id) || id.includes('route_9') || id.includes('cerulean')) return Math.floor(Math.random() * 9) + 8;
  // Very early
  if (/route_[1-2]|22/.test(id) || id.includes('viridian') || id.includes('forest')) return Math.floor(Math.random() * 8) + 5;
  // Starter area
  if (id.includes('pallet')) return Math.floor(Math.random() * 6) + 3;
  // Default for other regions
  return Math.floor(Math.random() * 11) + 10;
}

/**
 * getLocationEncounters — получить список покемонов на текущей локации.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Берёт encounters из данных локации
 *   2. Если есть dayEncounters/nightEncounters — использует их в зависимости от времени суток
 *   3. Если локация hasWater и есть удочка — добавляет рыбных покемонов
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ:
 *   startAutoHunt — проверка есть ли кого искать
 *   startHunt — получение списка для ручной охоты
 */
function getLocationEncounters() {
  const loc = store.getLocation(GS.currentLocationId);
  if (!loc) return [];
  let enc = loc.encounters || [];
  // Дневные/ночные энкаунтеры (разные покемоны в разное время суток)
  if (loc.dayEncounters && GS.isDaytime) enc = loc.dayEncounters;
  else if (loc.nightEncounters && !GS.isDaytime) enc = loc.nightEncounters;

  // Пассивная рыбалка: если локация с водой и есть удочка — добавляем рыб
  if (loc.hasWater) {
    const rod = getBestRod(); // superRod > goodRod > oldRod
    if (rod) {
      const fishTable = FISHING_TABLES[rod];
      if (fishTable) {
        const fishNames = fishTable.map(f => ({ name: f.name, level: f.minLvl + Math.floor(Math.random() * (f.maxLvl - f.minLvl + 1)) }));
        enc = [...new Set([...enc, ...fishNames.map(f => f.name)])]; // Merge без дубликатов
      }
    }
  }

  return enc;
}

/**
 * startAutoHunt — запустить автоматический поиск диких покемонов.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Устанавливает S.huntActive = true, сохраняет в localStorage
 *   2. Запускает таймер (doTick) с задержкой 2-5 секунд
 *   3. Каждый тик:
 *      - Проверяет что бой не активен (encounter-modal скрыт)
 *      - 20% шанс найти покемона (pickWeightedEncounter)
 *      - Если найден — вызывает startHunt
 *   4. Кнопка hunt-toggle меняет цвет: 🔴 = активно, 🟢 = нет энкаунтеров
 *   5. Продолжает работать пока не вызван stopAutoHunt()
 *
 * ОГРАНИЧЕНИЯ:
 *   Только на локациях с энкаунтерами
 *   Не работает во время активного боя
 *
 * ОТКУДА БЕРЁТ СПИСОК: getLocationEncounters()
 * ГДЕ ВЫЗЫВАЕТСЯ: по кнопке "Искать покемонов" (btn-hunt-toggle)
 */
function startAutoHunt() {
  if (S.huntActive) return; // Предотвращаем дублирование таймеров
  const encounters = getLocationEncounters();
  if (encounters.length === 0) return;

  S.huntActive = true;
  try { localStorage.setItem(store.lsKey('hunt_active'), '1'); } catch(_) {}
  const btn = document.getElementById('btn-hunt-toggle');
  if (btn) {
    btn.classList.add('active');
    btn.title = 'Прекратить поиск';
  }

  const updateHuntBtn = () => {
    if (!btn || !S.huntActive) return;
    const enc = getLocationEncounters();
    if (enc.length > 0) {
      btn.innerHTML = '🔴';                              // Красный = поиск активен
      btn.style.background = '#ff3b30';
      btn.title = 'Прекратить поиск';
    } else {
      btn.innerHTML = '🟢';                              // Зелёный = нет покемонов
      btn.style.background = '#34c759';
      btn.title = 'Поиск... (нет диких покемонов на этой локации)';
    }
  };
  updateHuntBtn();

  // Основной цикл охоты (рекурсивный setTimeout)
  const doTick = () => {
    if (!S.huntActive) return;                            // Остановлен
    if (huntPending) {                                    // Уже идёт битва
      S.huntTimer = setTimeout(doTick, 2000);
      return;
    }
    if (document.getElementById('encounter-modal')?.style.display === 'flex') {
      S.huntTimer = setTimeout(doTick, 2000);            // Активный бой — пропускаем тик
      return;
    }
    if (document.getElementById('elite-modal')?.style.display === 'flex') {
      S.huntTimer = setTimeout(doTick, 2000);            // Модалка элиты — пропускаем
      return;
    }
    const enc = getLocationEncounters();
    if (enc.length === 0) { updateHuntBtn(); S.huntTimer = setTimeout(doTick, 5000); return; }
    updateHuntBtn();
    // Плотность энкаунтеров по локации (H1): кастом админки →
    // encounterRate данных локи → дефолт 0.20.
    // M-4: в тёмной пещере ночью звери реже (darkRate), а в башне — то же.
    const locHere = store.getLocation(GS.currentLocationId);
    const mech = specialMechanic(locHere);
    const huntRate = effectiveEncounterRate(encounterRateFor(getEncounterRate(GS.currentLocationId), mech, GS.isDaytime !== false));
    tickEncounterCounters();
    // 20% base chance every tick — базовый шанс найти покемона
    if (Math.random() < huntRate) {
      const pkmName = pickWeightedEncounter(enc);
      startHunt([pkmName]);                                // Начинаем битву
      S.huntTimer = setTimeout(doTick, 3000);
    } else {
      const delay = 3000 + Math.random() * 5000;          // Случайная задержка 3-8 секунд
      S.huntTimer = setTimeout(doTick, delay);
    }
  };

  S.huntTimer = setTimeout(doTick, 2000 + Math.random() * 3000); // Первый тик через 2-5 секунд
}

/**
 * stopAutoHunt — остановить автоматический поиск покемонов.
 * Сбрасывает флаг, очищает таймер, обновляет кнопку.
 */
function stopAutoHunt() {
  S.huntActive = false;
  try { localStorage.removeItem(store.lsKey('hunt_active')); } catch(_) {}
  if (S.huntTimer) { clearTimeout(S.huntTimer); S.huntTimer = null; } // Остановка таймера
  const btn = document.getElementById('btn-hunt-toggle');
  if (btn) {
    btn.innerHTML = '⚪';                                 // Белый = не активно
    btn.classList.remove('active');
    btn.style.background = '';
    btn.title = 'Искать покемонов';
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 9.1: РЫБАЛКА (FISHING SYSTEM)
// ═══════════════════════════════════════════════════════════════
// 3 уровня удочек: Old Rod → Good Rod → Super Rod
// Чем лучше удочка — тем больше и разнообразнее рыба.
// Рыбные покемоны добавляются к наземным энкаунтерам на локациях hasWater.
// ─────────────────────────────────────────────────────────────
const FISHING_TABLES = {
  oldRod: [
    { name: 'magikarp', minLvl: 5, maxLvl: 10, weight: 70 },
    { name: 'tentacool', minLvl: 5, maxLvl: 10, weight: 30 },
  ],
  goodRod: [
    { name: 'magikarp', minLvl: 10, maxLvl: 15, weight: 30 },
    { name: 'tentacool', minLvl: 10, maxLvl: 15, weight: 20 },
    { name: 'poliwag', minLvl: 10, maxLvl: 20, weight: 15 },
    { name: 'goldeen', minLvl: 10, maxLvl: 20, weight: 15 },
    { name: 'horsea', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'shellder', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'staryu', minLvl: 10, maxLvl: 20, weight: 10 },
    { name: 'krabby', minLvl: 10, maxLvl: 20, weight: 10 },
  ],
  superRod: [
    { name: 'magikarp', minLvl: 15, maxLvl: 25, weight: 20 },
    { name: 'tentacool', minLvl: 15, maxLvl: 25, weight: 15 },
    { name: 'poliwag', minLvl: 15, maxLvl: 30, weight: 10 },
    { name: 'goldeen', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'horsea', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'shellder', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'staryu', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'krabby', minLvl: 15, maxLvl: 30, weight: 8 },
    { name: 'gyarados', minLvl: 20, maxLvl: 40, weight: 5 },
    { name: 'seaking', minLvl: 20, maxLvl: 35, weight: 5 },
    { name: 'seadra', minLvl: 20, maxLvl: 35, weight: 4 },
    { name: 'cloyster', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'starmie', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'kingler', minLvl: 25, maxLvl: 40, weight: 3 },
    { name: 'lapras', minLvl: 25, maxLvl: 40, weight: 2 },
    { name: 'dratini', minLvl: 15, maxLvl: 30, weight: 2 },
  ]
};

/**
 * getBestRod — определить лучшую доступную удочку.
 * Приоритет: Super Rod > Good Rod > Old Rod > null
 *
 * ОТКУДА БЕРЁТ ДАННЫЕ: store.getItemQty() из глобального инвентаря
 * ГДЕ ИСПОЛЬЗУЕТСЯ: getLocationEncounters() — для добавления рыбных покемонов
 */
function getBestRod() {
  if (store.getItemQty('superRod') > 0) return 'superRod';
  if (store.getItemQty('goodRod') > 0) return 'goodRod';
  if (store.getItemQty('oldRod') > 0) return 'oldRod';
  return null;
}

/** huntPending — флаг блокировки повторного запуска startHunt */
let huntPending = false;

/**
 * startHunt — начать стычку с диким покемоном (ядро встречи).
 *
 * ЭТО ГЛАВНАЯ ФУНКЦИЯ НАЧАЛА БОЯ С ДИКИМ ПОКЕМОНОМ.
 *
 * ЧТО ДЕЛАЕТ (полный порядок):
 *   1. Находит первого живого покемона в команде игрока
 *   2. Выбирает случайного покемона из encountersArray
 *   3. Загружает данные из PokeAPI (fetchPokeAPI)
 *   4. Генерирует: уровень, IVs, шайни (1/4096), статус, предмет (5%)
 *   5. Загружает species для catch rate
 *   6. Определяет пол (gender_rate из species)
 *   7. Загружает атаки (до 20, фильтруя неудачные)
 *   8. Рендерит UI: спрайты, HP, имена, способности
 *   9. Проверяет Intimidate у дикого
 *   10. Переводит фазы: WILD_START → PLAYER_TURN
 *
 * ВХОДНЫЕ ДАННЫЕ:
 *   encountersArray — массив имён покемонов или [{ name, level }]
 *   GS.currentLocationId — текущая локация (для уровня)
 *   GS.myTeam — команда игрока (первый живой = активный)
 *
 * ПОБОЧНЫЕ ЭФФЕКТЫ:
 *   Изменяет S.activeWild, S.battleType, S.activePlayerMon
 *   Рендерит encounter-modal, устанавливает киллер-ивенты
 *   Записывает в Pokedex (GS.pokedexSeen)
 *   Сохраняет погоду (getDailyWeather)
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   startAutoHunt — автоматический поиск
 *   Обработчик кнопки "Искать" в UI
 */
async function startHunt(encountersArray) {
  if (huntPending) return;
  huntPending = true;
  // Счётчик боёв: побег гасит модалку по таймеру через 1с — если за эту
  // секунду напал новый дикий, старый таймер не должен трогать новый бой.
  S.battleSeq = (S.battleSeq || 0) + 1;
    GS.itemsUsedInBattle = 0;
    S.battleRound = 0;
    const activeMonIndex = GS.myTeam.findIndex(m => m.currentHp > 0);
    if (activeMonIndex === -1) {
      huntPending = false;
      return showToast('Вам нужен хотя бы один живой покемон для битвы!', true);
    }

    // Close any previous battle end menu
    document.getElementById('battle-end-menu').style.display = 'none';

    S.battleType = 'wild';
    S.activePlayerMon = GS.myTeam[activeMonIndex];
  S.activePlayerMon.choiceLockedMove = undefined;
  S.currentWeather = getDailyWeather(GS.currentLocationId);
  resetBattleField(); // фикс: поле/vol не текут между боями

  const modal = document.getElementById('encounter-modal');
  const battleLog = document.getElementById('battle-log');

  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'none';
  appendToLog('Ищем...', true);
  modal.style.display = 'flex';

  if (!encountersArray || encountersArray.length === 0) { huntPending = false; return showToast('Нет покемонов для поиска на этой локации!', true); }
  const picked = encountersArray[Math.floor(Math.random() * encountersArray.length)];
  const pkmName = typeof picked === 'string' ? picked : picked.name;
  const presetLvl = typeof picked === 'object' ? picked.level : null;

  try {
    S.activeWild = await fetchPokeAPI(`pokemon/${pkmName.toLowerCase()}`);
    GS.pokedexSeen.add(S.activeWild.name);
    S.wildLvl = presetLvl || getWildLevel();
    // Боссы секретных мест: легенды там 100 уровня (бьют ради дропа)
    {
      const locDef = (store.getLocation(GS.currentLocationId) as any);
      if (locDef?.noCatch && LEGENDARY_SET.has((S.activeWild.name || '').toLowerCase())) {
        S.wildLvl = locDef.bossLvl || 100;
      }
    }
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.activeWild.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    // Неловимые: супер-редкие (легенды/мифики) + локации с noCatch (секретные
    // места силы). Таких бьют ради дропа, в болл не взять.
    S.activeWild.uncatchable = LEGENDARY_SET.has((S.activeWild.name || '').toLowerCase())
      || !!(store.getLocation(GS.currentLocationId) as any)?.noCatch;
  // Шайни: базовый шанс 1/1024 (спека 1.5.1), shiny_boost (админка) — ×10
  const shinyRate = (1 / 1024) * (GS.serverFeatures?.shiny_boost ? 10 : 1);
  S.activeWild.isShiny = (Math.random() < shinyRate);

    // Fetch species data for catch rate & gender
    try {
      const speciesData = await fetchPokeAPI(S.activeWild.species.url);
      S.activeWild.captureRate = speciesData.capture_rate;
      S.activeWild.speciesData = speciesData;
      // Determine wild gender
      if (speciesData.gender_rate === -1) S.activeWild.wildGender = null; // genderless
      else if (speciesData.gender_rate === 0) S.activeWild.wildGender = 'male';
      else if (speciesData.gender_rate === 8) S.activeWild.wildGender = 'female';
      else S.activeWild.wildGender = Math.random() * 8 < speciesData.gender_rate ? 'female' : 'male';
    } catch (e) { /* keep defaults */ }

    S.activeWild.wildIVs = rollWildIVs();

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;
    S.escapeAttempts = 0;

    // 5% chance wild pokemon holds a random berry
    S.activeWild.heldItem = Math.random() < 0.05
      ? ['sitrusBerry', 'oranBerry', 'lumBerry', 'chestoBerry', 'rawstBerry'][Math.floor(Math.random() * 5)]
      : null;
    S.activeWild.berries = S.activeWild.heldItem
      ? { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0, [S.activeWild.heldItem]: 1 }
      : { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 };

    S.wildMovesDetailed = await resolveWildMoveset(S.activeWild, S.wildLvl);
    S.wildMovesPP = S.wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = S.activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl}`;
    const wildSpriteUrl = getSpriteUrl({ apiData: S.activeWild, isShiny: S.activeWild.isShiny || false });
    (document.getElementById('wild-sprite') as HTMLImageElement).src = wildSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
    (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
    updatePlayerHpUI();

    appendToLog(`Дикий ${S.activeWild.name.toUpperCase()} нападает!`, false, 'battle');
    appendToLog(`Погода: ${WEATHER_ICONS[S.currentWeather]} ${WEATHER_NAMES[S.currentWeather]}`, false, 'system');

    // Intimidate check
    const wildAbility = S.activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(S.activePlayerMon, 'atk', -1, true);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }
    // Погодные способности срабатывают в тот же момент, что и Intimidate —
    // при выходе на поле. Раньше здесь был только Intimidate.
    applyWeatherAbility(wildAbility, S.activeWild.name);
    // Остальные способности выхода: Download, Trace, Frisk.
    applySwitchInAbilities(S.activeWild, true, S.activePlayerMon);

    S.playerMovesDetailed = [];
    loadMoveButtons(S.activePlayerMon, useMove);

    battle.transition(BattlePhase.WILD_START);
    battle.transition(BattlePhase.PLAYER_TURN);

    // Persist the encounter the moment it exists. Without this the battle was
    // only written to battle_state after the player's first action, so any
    // reload between the wild Pokemon appearing and the first click lost the
    // encounter completely — the Pokemon vanished and the hunt simply restarted.
    saveBattleState();
  } catch (e: any) {
    // Раньше здесь стояли только две строки: battleLog.innerText = 'Ошибка боя...'
    // и скрытие модалки. Ошибка при этом полностью исчезала — ни в консоли, ни в
    // отчётности клиента. Из-за этого невозможно было отличить «бой не
    // начался из-за сбоя» от «бой начался и закончился»: и то и другое выглядело
    // как пустой экран. Теперь причина попадает в консоль и в клиентский
    // отчётчик, а в лог боя добавляется текст ошибки.
    console.error('[battle] startHunt failed:', e);
    try {
      navigator.sendBeacon?.('/api/log-client-error', JSON.stringify({
        msg: 'startHunt failed: ' + (e?.message || String(e)),
        stack: e?.stack || '',
        time: Date.now(),
      }));
    } catch (_) {}
    battleLog.innerText = `Ошибка боя: ${e?.message || e}`;
    // Раньше тут стояло только `setTimeout(() => modal.style.display='none', 1000)`
    // — игрок видел пустой экран и «выкидывание из боя» без единого слова.
    // Теперь причина остаётся на экране и в тосте, а охота останавливается,
    // чтобы не бить в ту же ошибку каждые 2 секунды.
    try { stopAutoHunt?.(); } catch (_) {}
    showToast(`Бой не начался: ${e?.message || 'ошибка'}. Подробности в логе боя.`, true);
    try {
      const actions = document.getElementById('battle-main-menu');
      if (actions) actions.style.display = 'flex';
    } catch (_) {}
    setTimeout(() => { modal.style.display = 'none'; }, 4000);
  } finally {
    huntPending = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 10: КНОПКИ АТАК И UI
// ═══════════════════════════════════════════════════════════════
// loadMoveButtons — загружает 4 атаки покемона в кнопки move-btn-0..3.
//   Асинхронно: сначала показывает "...", потом загружает из PokeAPI
// updateMoveButtonUI — обновляет отображение одной кнопки (PP, тип атаки)
// updateMoveButtonUIs — обновить все 4 кнопки сразу
// updateAbilityDisplay — показать способности покемонов в UI
// updateWildHpUI / updatePlayerHpUI — обновить HP бары + EXP бар
// ─────────────────────────────────────────────────────────────

/**
 * loadMoveButtons — загрузить названия атак в кнопки боя.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Берёт до 4 атак из activeMon.apiData.moves (те же что на странице команды)
 *   2. Для каждой атаки: асинхронно загружает данные из PokeAPI
 *   3. После загрузки: устанавливает название, PP, класс атаки (physical/special/status)
 *   4. Назначает клик-обработчик (обычно useMove)
 *
 * ИНИЦИАЛИЗАЦИЯ PP:
 *   Если у покемона нет movesPP — создаёт с current = max = pp из PokeAPI
 *
 * ОШИБКИ:
 *   Если PokeAPI не отвечает — показывает имя атаки из moves (без деталей)
 *   Если атаки нет (слот пуст) — показывает "-"
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   startHunt — начало боя
 *   switchPokemon — смена покемона
 *   restoreBattleState — восстановление боя
 *   startGymNextPokemon — gym бой
 *   startEliteNextPokemon — элитный бой
 *   startChampionNextPokemon — чемпионский бой
 */
/**
 * showMoveInfo — инфо об атаке (долгое нажатие / правый клик по кнопке).
 * Показывает тип, класс, силу, точность, PP и эффект. Данные уже загружены
 * в S.playerMovesDetailed, отдельного запроса нет.
 */
function showMoveInfo(moveData) {
  if (!moveData) return;
  const parts = [];
  const type = moveData.type?.name;
  const dmgClass = moveData.damage_class?.name;
  if (type || dmgClass) parts.push(`Тип: ${type || '?'} / ${dmgClass || '?'}`);
  if (moveData.power != null) parts.push(`Сила: ${moveData.power}`);
  else parts.push('Сила: — (статусная)');
  parts.push(`Точность: ${moveData.accuracy != null ? moveData.accuracy : '—'}`);
  parts.push(`PP: ${moveData.pp ?? '—'}`);
  const meta = moveData.meta || {};
  if (meta.crit_rate > 0) parts.push('Повышенный шанс крита');
  if (meta.drain && meta.drain !== 0) parts.push(`Лечение: ${Math.abs(meta.drain)}% урона`);
  if (meta.healing && meta.healing !== 0) parts.push(`Лечение: ${Math.abs(meta.healing)}% макс HP`);
  if (meta.min_hits && meta.max_hits && meta.max_hits > 1) parts.push(`Ударов: ${meta.min_hits}–${meta.max_hits}`);
  if (meta.ailment && meta.ailment.name && meta.ailment.name !== 'none') {
    parts.push(`Статус: ${meta.ailment.name}${moveData.effect_chance ? ` (${moveData.effect_chance}%)` : ''}`);
  }
  const eff = moveData.effect_entries?.find(e => e.language?.name === 'en')?.effect
    || moveData.effect_entries?.[0]?.effect;
  if (eff) {
    const first = eff.split('. ')[0];
    parts.push(first.length > 220 ? first.slice(0, 220) + '…' : first);
  }
  showConfirmModal(moveData.name || 'Атака', parts.join('\n'));
}

function loadMoveButtons(activeMon, clickHandler) {
  S.playerMovesDetailed = []; // Сбрасываем детальные данные атак

  // Берём атаки из стандартных 4 слотов (apiData.moves[0..3])
  const knownMoves = [];
  if (activeMon.apiData?.moves) {
    for (let i = 0; i < 4; i++) {
      const entry = activeMon.apiData.moves[i];
      if (entry?.move?.url) {
        knownMoves.push(entry);
      }
    }
  }

  // Загружаем каждую атаку
  for (let i = 0; i < 4; i++) {
    const mBtn = document.getElementById(`move-btn-${i}`);
    const moveEntry = knownMoves[i];
    if (moveEntry) {
      mBtn.innerText = '...';                              // Плейсхолдер во время загрузки
      mBtn.classList.add('disabled');                       // Блокируем пока не загрузится
      mBtn.onclick = null;
      fetchSiteMoveDetail(moveEntry)                     // Асинхронная загрузка с сайта лиги
        .then(d => {
          S.playerMovesDetailed[i] = d;                    // Сохраняем детальные данные
          if (!activeMon.movesPP) activeMon.movesPP = [];
          if (!activeMon.movesPP[i]) {
            activeMon.movesPP[i] = { current: d.pp || 30, max: d.pp || 30 }; // Инициализируем PP
          }
          mBtn.innerText = d.name || moveEntry.move.name;  // Имя атаки (англ.)
          mBtn.classList.remove('disabled');                // Активируем кнопку
          mBtn.onclick = () => clickHandler(i);             // Назначаем обработчик
          // Инфо: ховер на десктопе, долгое нажатие на телефоне
          mBtn.title = `${d.name || ''} — долгое нажатие: инфо`;
          mBtn.oncontextmenu = (e) => { e.preventDefault(); showMoveInfo(d); };
          updateMoveButtonUI(i, d);                          // Обновляем UI (цвет, PP)
        })
        .catch(() => {
          // Если PokeAPI не отвечает — показываем имя без деталей
          mBtn.innerText = moveEntry.move.name;
          mBtn.classList.remove('disabled');
          mBtn.onclick = () => clickHandler(i);
        });
    } else {
      mBtn.innerText = '-';                                 // Пустой слот
      mBtn.classList.add('disabled');
      mBtn.onclick = null;
    }
  }
}

/**
 * updateMoveButtonUI — обновить стиль и текст одной кнопки атаки.
 * Добавляет CSS класс: move-type-physical, move-type-special, move-type-status
 * Показывает текущее PP если > 0, или "PP: 0/N" + disabled если PP закончились.
 */
function updateMoveButtonUI(index, moveData) {
  if (!S.activePlayerMon.movesPP || !S.activePlayerMon.movesPP[index]) return;
  const pp = S.activePlayerMon.movesPP[index];
  const mBtn = document.getElementById(`move-btn-${index}`);
  if (!mBtn) return;
  mBtn.classList.remove('move-type-physical', 'move-type-special', 'move-type-status');
  if (moveData.damage_class?.name) {
    mBtn.classList.add(`move-type-${moveData.damage_class.name}`); // Цвет кнопки по типу атаки
  }
  if (pp.current <= 0) {
    mBtn.innerText = `${moveData.name} (PP: 0/${pp.max})`; // Если PP кончились — показываем 0
    mBtn.classList.add('disabled');
  } else {
    mBtn.innerText = `${moveData.name} (PP: ${pp.current}/${pp.max})`; // Нормальное отображение
  }
}

/**
 * updateMoveButtonUIs — обновить UI всех 4 кнопок атак.
 * Используется после восстановления PP (например, Elixir).
 */
function updateMoveButtonUIs() {
  for (let i = 0; i < 4; i++) {
    if (S.playerMovesDetailed[i]) {
      updateMoveButtonUI(i, S.playerMovesDetailed[i]);
    }
  }
}

/**
 * updateAbilityDisplay — отобразить способности покемонов над спрайтами.
 * Показывает название способности в 【скобках】.
 * Для игрока: из S.activePlayerMon.abilityName
 * Для дикого: из S.activeWild.abilities[0].ability.name
 */
/**
 * WEATHER_ABILITY_MAP — способности, вызывающие погоду при выходе на поле.
 * Значения совпадают с ключами WEATHER_NAMES (data/weather.ts).
 */
const WEATHER_ABILITY_MAP: Record<string, string> = {
  drought: 'sun',
  drizzle: 'rain',
  'sand-stream': 'sandstorm',
  'snow-warning': 'hail',
};

/**
 * applyWeatherAbility — применить погодную способность при выходе на поле.
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ ФУНКЦИЯ:
 *   Способности выхода на поле (Intimidate, Drought, Drizzle, Sand Stream,
 *   Snow Warning) срабатывают в одной точке — в момент появления покемона.
 *   Раньше здесь был только Intimidate, четырьмя одинаковыми копиями, а четыре
 *   погодные способности лежали в справочнике неподключёнными.
 *
 * ПРО ДЛИТЕЛЬНОСТЬ:
 *   Погода в игре пока не пошаговая: она берётся из getDailyWeather() для
 *   локации и держится до конца боя. Поэтому канонные «5 ходов» здесь не
 *   реализованы — способность выставляет погоду на текущий бой.
 */
function applyWeatherAbility(abilityId, displayName) {
  const weather = WEATHER_ABILITY_MAP[abilityId];
  if (!weather) return false;
  if (weather === S.currentWeather) return false;
  S.currentWeather = weather;
  appendToLog(
    `${displayName} меняет погоду: ${WEATHER_ICONS[weather]} ${WEATHER_NAMES[weather]}!`,
    false, 'system',
  );
  return true;
}

/**
 * applySwitchOutAbilities — способности, срабатывающие при уходе с поля.
 *
 *   Natural Cure — снимает свои статусы
 *   Regenerator  — восстанавливает треть максимального HP
 *
 * ВЫЗЫВАЕТСЯ перед сменой покемона по кнопке. В сценарии нокаута покемон
 * уже с нулевым HP, поэтому Regenerator там ничего не делает — это правильно.
 */
function applySwitchOutAbilities(mon) {
  if (!mon) return;
  const abilityId = getAbilityName(mon, false);
  if (!abilityId) return;
  const name = String(abilityId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const label = mon.apiData?.name || mon.name || 'Покемон';

  if (name === 'naturalcure' && mon.status) {
    const had = mon.status;
    cureStatus(mon);
    appendToLog(`${label}: Природное лечение снимает статус (${STATUS_NAMES[had] || had}) при уходе с поля.`, false, 'heal');
  }

  if (name === 'regenerator' && mon.currentHp > 0 && mon.currentHp < mon.maxHp) {
    const heal = Math.max(1, Math.floor(mon.maxHp / 3));
    mon.currentHp = Math.min(mon.maxHp, mon.currentHp + heal);
    appendToLog(`${label}: Регенерация восстанавливает ${heal} HP при уходе с поля.`, false, 'heal');
  }
}

/**
 * applySwitchInAbilities — способности выхода на поле, кроме погодных.
 *
 * ВЫЗЫВАЕТСЯ там же, где applyWeatherAbility: в момент появления покемона
 * (дикий — в начале боя и на аренах, свой — при смене и после нокаута).
 *
 * ЧТО ДЕЛАЕТ:
 *   Download — повышает атаку или сп. атаку, смотря по более слабой защите
 *   Trace    — копирует способность противника
 *   Frisk    — показывает удерживаемый предмет противника
 *
 * ВАЖНО: способности, меняющие статы СВОЕМУ владельцу, вызываются с
 * fromOpponent = false — иначе Clear Body блокировал бы собственный бафф.
 */
function applySwitchInAbilities(mon, isWild, opponent) {
  if (!mon || !opponent) return;
  const abilityId = getAbilityName(mon, isWild);
  if (!abilityId) return;
  const name = String(abilityId).toLowerCase().replace(/[^a-z0-9]/g, '');
  const label = mon.apiData?.name || mon.name || 'Покемон';

  if (name === 'download') {
    const oppDef = calculateStat(opponent, 'defense', { isWild: !isWild });
    const oppSpd = calculateStat(opponent, 'special-defense', { isWild: !isWild });
    if (oppDef <= oppSpd) {
      statStageModify(mon, 'atk', 1, false);
      appendToLog(`${label}: Загрузка повышает атаку!`, false, 'system');
    } else {
      statStageModify(mon, 'spa', 1, false);
      appendToLog(`${label}: Загрузка повышает сп. атаку!`, false, 'system');
    }
  }

  if (name === 'trace') {
    const oppAbilityId = getAbilityName(opponent, !isWild);
    if (oppAbilityId && oppAbilityId !== abilityId) {
      setBattleAbility(mon, isWild, oppAbilityId);
      updateAbilityDisplay();
      appendToLog(`${label}: Слежение копирует способность — ${getAbilityNameRu(oppAbilityId)}!`, false, 'system');
    }
  }

  if (name === 'frisk') {
    appendToLog(
      opponent.heldItem
        ? `${label}: Проницательность видит предмет противника — ${getHeldItemName(opponent.heldItem)}.`
        : `${label}: Проницательность не видит у противника предмета.`,
      false, 'system',
    );
  }
}

function updateAbilityDisplay() {
  // Название показываем по-русски из справочника (data/abilities.ts), а не
  // сырым англоязычным id из PokeAPI. Если способности нет в справочнике —
  // getAbilityNameRu вернёт сам id, и в бою всё равно будет видно, что за
  // способность активна.
  if (S.activePlayerMon) {
    const abilityId = abilityOf(S.activePlayerMon, false);
    document.getElementById('player-ability').innerText = abilityId ? `【${getAbilityNameRu(abilityId)}】` : '';
  }
  if (S.activeWild) {
    const wildAbilityId = S.activeWild.abilities?.[0]?.ability?.name || '';
    document.getElementById('wild-ability').innerText = wildAbilityId ? `【${getAbilityNameRu(wildAbilityId)}】` : '';
  }
}

/**
 * updateWildHpUI — обновить HP бар дикого покемона в UI.
 * Цвет: зелёный (>50%), жёлтый (20-50%), красный (<20%)
 */
function updateWildHpUI() {
  document.getElementById('wild-hp-text').innerText = `${S.wildCurHP}/${S.wildMaxHP}`;
  // Шайни-маркер держим синхронно здесь: имена выставляются в 8 местах,
  // а HP-апдейтер идёт на каждый удар — дешевле покрыть все потоки так
  if (S.activeWild) {
    document.getElementById('wild-name').innerText = `${isShinyMon(S.activeWild) ? '✨' : ''}${S.activeWild.name}`;
  }
  const pct = Math.max(0, (S.wildCurHP / S.wildMaxHP) * 100);
  const bar = document.getElementById('wild-hp-fill');
  bar.style.width = `${pct}%`;
  bar.className = 'reborn-hp-fill';
  if (pct <= 20) bar.classList.add('hp-low');       // Красный
  else if (pct <= 50) bar.classList.add('hp-medium'); // Жёлтый
}

/**
 * updatePlayerHpUI — обновить HP бар + EXP бар игрока.
 * HP бар: зелёный/жёлтый/красный (как у дикого).
 * EXP бар: показ прогресса до следующего уровня.
 * EXP считается по формуле baseLevel^3 — это канонная medium-fast кривая
 * Gen V+. На уровне 1 — 1 EXP, на 50 — 125 000, на 100 — 1 000 000.
 * Альтернативы (Erratic=кубическая×2 на 1-50, Fast=0.8n³, Slow=1.25n³) сейчас не
 * используются — интервью выбрало medium-fast как базовый темп.
 */
function updatePlayerHpUI() {
  if (!S.activePlayerMon) return;
  document.getElementById('player-hp-text').innerText = `${S.activePlayerMon.currentHp}/${S.activePlayerMon.maxHp}`;
  document.getElementById('player-name').innerText = `${isShinyMon(S.activePlayerMon) ? '✨' : ''}${S.activePlayerMon.nickname || S.activePlayerMon.apiData.name}`;
  const pct = Math.max(0, (S.activePlayerMon.currentHp / S.activePlayerMon.maxHp) * 100);
  const bar = document.getElementById('player-hp-fill');
  bar.style.width = `${pct}%`;
  bar.className = 'reborn-hp-fill';
  if (pct <= 20) bar.classList.add('hp-low');
  else if (pct <= 50) bar.classList.add('hp-medium');

  // EXP bar — формула опыта: канонная medium-fast (n³), спека 3.1 / раунд 4
  const expToCurrent = Math.pow(S.activePlayerMon.baseLevel, 3);   // EXP на текущем уровне
  const expToNext = S.activePlayerMon.expToNext || Math.pow(S.activePlayerMon.baseLevel + 1, 3); // EXP на след. уровне
  let expPct = ((S.activePlayerMon.exp - expToCurrent) / (expToNext - expToCurrent)) * 100;
  if (expPct < 0) expPct = 0;
  if (expPct > 100) expPct = 100;

  const expFill = document.getElementById('player-exp-fill');
  if (expFill) expFill.style.width = `${expPct}%`;
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 11: НАГРАДЫ ЗА ПОБЕДУ
// ═══════════════════════════════════════════════════════════════
// getWildDropItems — собирает дроп с побеждённого дикого покемона.
//   Использует store.processMonsterDrop (из data/drops.js).
//
// handleWildFaintRewards — раздача наград после победы:
//   - Деньги: wildLvl * 20 + 50 (для диких)
//   - Дроп: предметы из таблицы дропа
//   - EXP: (baseExp * wildLvl) / 7 (+50% с Lucky Egg)
//   - EXP Share: половина EXP остальной команде
//   - Level up: проверка повышения уровня (baseLevel ++)
//   - Новые атаки: checkNewMovesOnLevelUp
//   - Эволюция: checkEvolution + triggerEvolution
//   - Прогресс квестов: checkQuestProgress
//   - Для gym: переход к следующему покемону лидера
// ─────────────────────────────────────────────────────────────

/**
 * getWildDropItems — получить дроп с побеждённого дикого покемона.
 * Вызывает store.processMonsterDrop(name) для расчёта выпавших предметов.
 * Возвращает массив { id, qty } для передачи в store.giveReward.
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ: handleWildFaintRewards (только для wild боя)
 */
function getWildDropItems() {
  const rItems = [];
  const dropResults = store.processMonsterDrop(S.activeWild.name);
  if (dropResults.length > 0) {
    dropResults.forEach(d => rItems.push({id: d.item, qty: d.qty}));
    const dropText = dropResults.map(d => `${d.qty}x ${itemDef(d.item).nameRu}`).join(', ');
    appendToLog(`Добыча: ${dropText}`, false, 'quest'); // Показываем в логе
  }
  return rItems;
}

/**
 * handleWildFaintRewards — раздать награды после победы над покемоном.
 *
 * ВАЖНАЯ ФУНКЦИЯ — вызывается и при победе игрока (useMove) и при победе врага (enemyTurn).
 *
 * ЧТО ДЕЛАЕТ:
 *   Для WILD:
 *     - Деньги: wildLvl * 20 + 50
 *     - Дроп: getWildDropItems()
 *     - EXP: активному покемону + EXP Share остальным
 *     - Level-up + новые атаки + эволюция
 *     - Показывает экран победы (battle-end-menu)
 *   Для GYM/ELITE:
 *     - Переход к следующему покемону (gymTeamIndex++)
 *     - EXP НЕ даётся (гим — для проверки навыков, не для фарма)
 *   Для CHAMPION:
 *     - EXP даётся как за дикого
 *
 * isWild = true → wild бой, деньги + дроп + EXP
 * isWild = false → gym/elite/champion, без денег и дропа
 */
async function handleWildFaintRewards(isWild: boolean) {
  if (isWild) {
    appendToLog(`Дикий ${S.activeWild.name} побежден!`);
    // Счётчик побед для ачивки trainer_100
    GS.battleWins = (GS.battleWins || 0) + 1;
    if (GS.battleWins >= 100) checkAchievement('trainer_100');
    checkQuestProgress('defeat_x', 1, undefined, {           // Квест "победить N покемонов"
      species: S.activeWild.name,
      types: (S.activeWild.apiData?.types || S.activeWild.types || []).map((t: any) => t?.type?.name),
    });
    // Стрик диких побед для streak-квестов
    state.questStreak = (state.questStreak || 0) + 1;
    trackNPCQuests('streak_x', { streak: state.questStreak });
    const rItems = getWildDropItems();
    // Журнал дропа: строка лога исчезает вместе с боем, а выпавшее нужно помнить.
    recordDrop(S.activeWild.name, S.wildLvl, rItems);
    let wildMoney = S.wildLvl * 20 + 50;
    // Аудит итемов: Amulet Coin / Luck Incense удваивают деньги за дикий бой
    const moneyMult = (S.activePlayerMon.heldItem === 'amuletCoin' || S.activePlayerMon.heldItem === 'luckIncense') ? 2 : 1;
    if (moneyMult > 1) appendToLog(`${S.activePlayerMon.apiData.name} удваивает приз монетой!`, false, 'system');
    // Проход-741: Pay Day разбрасывает монеты (по 5 за удар, пачка за бой)
    const payDay = (S.activePlayerMon.payDayHits || 0) * 5;
    if (payDay > 0) appendToLog(`Подобрано монет Pay Day: +${payDay}!`, false, 'system');
    store.giveReward(wildMoney * moneyMult + payDay, rItems);          // Деньги + предметы
    checkQuestProgress('earn_money', S.wildLvl * 20 + 50);  // Квест "заработать деньги"
    // Туториал: выбить предмет (если хоть что-то выпало)
    if (rItems.length > 0) store.checkTutorialProgress('collect_drop', 1, rItems[0].id);
  } else {
    appendToLog(`${S.activeWild.name} побежден!`);
    if (S.battleType === 'gym') S.gymTeamIndex++;           // Следующий покемон лидера
    else S.gymTeamIndexInMember++;                           // Следующий в элите
  }

  // ═══ EXP (опыт) ═══
  // Gym — EXP не даётся (чтобы нельзя было фармить на лидерах)
  if (S.battleType !== 'gym') {
    const baseExp = S.activeWild.base_experience || 50;
    let expGain = Math.floor((baseExp * S.wildLvl) / 7);    // Базовая формула опыта
    if (GS.serverFeatures?.double_exp) expGain *= 2;        // double_exp (админка)
    if (S.activePlayerMon.heldItem === 'luckyEgg') expGain = Math.floor(expGain * 1.5); // Lucky Egg ×1.5
    // Training Grounds: x10 EXP (новички быстро качаются)
    if (GS.currentLocationId?.includes('trainingGrounds')) expGain *= 10;

    // Инициализация EXP если ещё не был установлен
    if (S.activePlayerMon.exp === undefined) {
      S.activePlayerMon.exp = Math.pow(S.activePlayerMon.baseLevel, 3);
      S.activePlayerMon.expToNext = Math.pow(S.activePlayerMon.baseLevel + 1, 3);
    }

    const lvl = S.activePlayerMon.baseLevel + (S.activePlayerMon.candiesEaten || 0);
    if (lvl < 100) {
      S.activePlayerMon.exp += expGain;
      appendToLog(`${S.activePlayerMon.apiData.name} получил ${expGain} EXP!`);
    }

    // EXP Share: половина EXP остальным членам команды
    if (GS.expShareActive) {
      const shareExp = Math.floor(expGain / 2);
      GS.myTeam.forEach(mon => {
        if (mon !== S.activePlayerMon && mon.currentHp > 0 && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
          if (mon.exp === undefined) {
            mon.exp = Math.pow(mon.baseLevel, 3);
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
          }
          mon.exp += shareExp;
          // Проверка level-up для каждого члена команды
          while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
            mon.baseLevel++;
            mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
            const oldMax = mon.maxHp;
            const newMax = calculateStat(mon, 'hp', false);
            mon.maxHp = newMax;
            mon.currentHp += (newMax - oldMax); // Восстанавливаем HP пропорционально новому макс
            // EV за уровень — в пул на ручное распределение
            const ev = grantLevelUpEVs(mon);
            if (ev) appendToLog(`${mon.apiData.name}: +${ev.gain} EV в пул${ev.brace ? ' (скоба)' : ''} (всего ${ev.total})`, false, 'system');
          }
        }
      });
      if (shareExp > 0) appendToLog(`Остальная команда получила по ${shareExp} EXP!`);
    }

    // ═══ Level up активного покемона ═══
    while (S.activePlayerMon.exp >= S.activePlayerMon.expToNext && S.activePlayerMon.baseLevel < 100) {
      S.activePlayerMon.baseLevel++;
      S.activePlayerMon.expToNext = Math.pow(S.activePlayerMon.baseLevel + 1, 3);
      const oldMax = S.activePlayerMon.maxHp;
      const newMax = calculateStat(S.activePlayerMon, 'hp', false);
      S.activePlayerMon.maxHp = newMax;
      S.activePlayerMon.currentHp += (newMax - oldMax);
      appendToLog(`${S.activePlayerMon.apiData.name} достиг ${S.activePlayerMon.baseLevel} уровня!`);
      // EV за уровень — в пул, распределяет игрок в профиле
      const evGain = grantLevelUpEVs(S.activePlayerMon);
      if (evGain) appendToLog(`Растёт: +${evGain.gain} EV в пул${evGain.brace ? ' (скоба)' : ''} (всего ${evGain.total})`, false, 'system');
      await checkNewMovesOnLevelUp(S.activePlayerMon, S.activePlayerMon.baseLevel); // Новые атаки
    }

    // ═══ Эволюция ═══
    // Аудит итемов: Everstone блокирует эволюцию по уровню
    if (S.activePlayerMon.heldItem === 'everstone') {
      appendToLog(`${S.activePlayerMon.apiData.name} не эволюционирует (Вечный камень)!`, false, 'system');
    } else {
      const evoTarget = await checkEvolution(S.activePlayerMon);
      if (evoTarget) {
        await triggerEvolution(S.activePlayerMon, evoTarget.name);
        if (evoTarget.shedBonus) await maybeGrantShedinja(S.activePlayerMon);
        updatePlayerHpUI();
      }
    }
  }

  // ═══ Финальный UI ═══
  if (isWild) {
    // Победа над диким — показываем меню завершения боя.
    // Фаза доводится до IDLE: раньше она оставалась в PLAYER_TURN/ENEMY_TURN,
    // и следующий бой не мог перейти в WILD_START — такого перехода нет в
    // таблице, поэтому фазовый автомат молча оставался в старой фазе.
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    battle.transition(BattlePhase.VICTORY);
    battle.transition(BattlePhase.IDLE);
    clearBattleState();                               // Удаляем сохранение боя
    store.updateInventoryDisplay();
    store.updateMoneyDisplay();
    store.autoSave();
  } else {
    // Победа над покемоном лидера — переход к следующему
    setTimeout(() => {
      if (S.battleType === 'gym') startGymNextPokemon();
      else if (S.battleType === 'elite') startEliteNextPokemon();
      else if (S.battleType === 'champion') startChampionNextPokemon();
    }, 1000);
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 12: АТАКА ИГРОКА (useMove)
// ═══════════════════════════════════════════════════════════════
// useMove — ГЛАВНАЯ ФУНКЦИЯ АТАКИ ИГРОКА (~300 строк).
//
// ПОЛНЫЙ ПОТОК:
//   1. Проверка PP (если 0 — нельзя атаковать)
//   2. Choice item блокировка (можно только одну атаку)
//   3. Assault Vest (нельзя статус-атаки)
//   4. Фазовая валидация → ENEMY_TURN
//   5. Проверка статуса игрока (сон/паралич/заморозка)
//   6. Расход PP (decrement)
//   7. Choice item → блокировка атаки
//   8. Accuracy check (hit/miss)
//   9. Sucker Punch fail check
//  10. Статус атаки (без power):
//       - Наложение статуса на врага
//       - Изменение статов (stat_changes)
//       - Специальные: healing, Reflect, Light Screen, Protect, Substitute
//  11. Атака с уроном (с power):
//       - Protect check (враг защищается?)
//       - Substitute поглощение
//       - calculateDamage (чистая функция из logic.ts)
//       - Barrier модификатор (Reflect/Light Screen)
//       - Focus Sash (выживание с 1 HP)
//       - Drain healing (Absorb, Giga Drain)
//       - Life Orb recoil
//       - Sturdy check
//       - Secondary эффекты (ожог/паралич)
//       - Контактные способности (Static, Flame Body, Rough Skin)
//       - Berry auto-use (Sitrus, Oran, Lum)
//  12. Проверка на fainted игрока или врага
//  13. Победа → handleWildFaintRewards, иначе → enemyTurn
// ─────────────────────────────────────────────────────────────

/**
 * useMove — выполнить атаку игрока по индексу (0-3).
 *
 * ЭТО САМАЯ ВАЖНАЯ ФУНКЦИЯ БОЯ. Обрабатывает ВСЁ что связано с атакой игрока.
 *
 * ЧТО ПРИНИМАЕТ:
 *   moveIndex — номер атаки (0-3) из S.playerMovesDetailed
 *
 * ЧТО ВОЗВРАЩАЕТ: ничего (void), но меняет состояние боя.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: по клику на move-btn-{0..3} из loadMoveButtons
 *
 * ПОБОЧНЫЕ ЭФФЕКТЫ:
 *   - Меняет HP, статусы, стат-стадии, PP
 *   - Меняет фазу боя (через battle.transition)
 *   - Показывает сообщения в логе
 *   - Сохраняет состояние боя (saveBattleState)
 *   - Запускает enemyTurn если враг жив
 *   - Запускает handleWildFaintRewards если враг побеждён
 */
/**
 * EV за повышение уровня — в ПУЛ на ручное распределение (спека 3.3).
 *
 * Раньше уровень сам клал +1 EV в стат с highest base: выбирать было нечего,
 * что противоречило «распределяются игроком вручную». Теперь уровень даёт
 * +2 EV в нераспределённый пул (mon.evPool), +3 если держит скобу (evBrace).
 * Тратятся через инпуты/кнопки в профиле в пределах evBudget().
 */
export function grantLevelUpEVs(pokemon) {
  if (!pokemon) return null;
  const brace = pokemon.heldItem === 'evBrace';
  const gain = brace ? 3 : 2;
  if (typeof pokemon.evPool !== 'number') pokemon.evPool = 0;
  pokemon.evPool += gain;
  return { gain, brace, total: pokemon.evPool };
}

/**
 * Потраченные EV (сумма по статам) — чистая, для бюджета и тестов.
 */
export function evSpent(mon): number {
  if (!mon || !mon.evs) return 0;
  return ['hp', 'atk', 'def', 'spa', 'spd', 'spe']
    .reduce((a, s) => a + (mon.evs[s] || 0), 0);
}

const EV_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/**
 * Расчёт записи EV с учётом пула и лока (чистая, для тестов и UI).
 *
 * oldEvs — текущие evs покемона; want — желаемые (из инпутов);
 * pool — нераспределённый остаток; locked — применение уже было.
 * Правила: кламп 0..126; при локе пол снизу = текущие (забрать нельзя);
 * рост финансируется из пула (не хватило → ok:false, evs без изменений).
 */
export function settleEVSpend(
  oldEvs: any, want: any, pool: number, locked: boolean,
): { evs: Record<string, number>; pool: number; ok: boolean } {
  const clean: Record<string, number> = {};
  for (const s of EV_STATS) {
    let v = Math.floor(Number(want?.[s]) || 0);
    if (v < 0) v = 0;
    if (v > 126) v = 126;
    if (locked && v < (oldEvs?.[s] || 0)) v = oldEvs[s] || 0;
    clean[s] = v;
  }
  const oldSum = EV_STATS.reduce((a, s) => a + (oldEvs?.[s] || 0), 0);
  const newSum = EV_STATS.reduce((a, s) => a + clean[s], 0);
  const delta = newSum - oldSum;
  if (delta > (pool || 0)) {
    const back: Record<string, number> = {};
    for (const s of EV_STATS) back[s] = oldEvs?.[s] || 0;
    return { evs: back, pool: pool || 0, ok: false };
  }
  return { evs: clean, pool: (pool || 0) - delta, ok: true };
}

/**
 * Бюджет EV (спека 3.10, канон лиги по итогам).
 *
 * Модель: пул (evPool) — единственное хранилище заработанного (уровни +2/+3,
 * конфеты +1/+2/+3/+4 по типу, витамины +10). Раздача двигает пул→evs.
 * Бюджет = потрачено + пул + legacy-добивка, потолок 496.
 *
 * Раньше формула складывала candiesEaten×4 ПОВЕРХ пула, куда feedCandy уже
 * положил те же очки, — редкая конфета давала +8 вместо +4 (D1).
 */
export function evBudget(mon): number {
  if (!mon) return 0;
  const pool = typeof mon.evPool === 'number' ? mon.evPool : 0;
  const fromLevel = mon.evFromLevel || 0;
  return Math.min(496, evSpent(mon) + pool + fromLevel);
}

async function useMove(moveIndex) {
  let move = S.playerMovesDetailed[moveIndex];
  if (!move) return;

  // Семя поля держателя — до хода (поле могли поднять раньше)
  maybeConsumeTerrainSeed(S.activePlayerMon);

  // ═══ 1. PP CHECK ═══
  // Если PP закончились — атака недоступна
  if (S.activePlayerMon.movesPP && S.activePlayerMon.movesPP[moveIndex]) {
    if (S.activePlayerMon.movesPP[moveIndex].current <= 0) {
      appendToLog('Нет PP для этой атаки!');
      return;
    }
  }

  // ═══ 2. CHOICE ITEM LOCK ═══
  // Choice Band/Scarf/Specs: можно использовать только первую выбранную атаку
  const choiceItems = ['choiceBand', 'choiceScarf', 'choiceSpecs'];
  if (choiceItems.includes(S.activePlayerMon.heldItem) && S.activePlayerMon.choiceLockedMove !== undefined && S.activePlayerMon.choiceLockedMove !== moveIndex) {
    appendToLog('Можно использовать только выбранную атаку!');
    return;
  }

  // ═══ 2b. TRUANT ═══
  // Лентяй: покемон действует через ход. Флаг переключается на каждом ходу,
  // поэтому пропускается ровно каждый второй.
  const playerTruant = String(abilityOf(S.activePlayerMon, false) || '')
    .toLowerCase().replace(/[^a-z0-9]/g, '') === 'truant';
  if (playerTruant) {
    if (S.activePlayerMon.truantSkip) {
      S.activePlayerMon.truantSkip = false;
      appendToLog(`${S.activePlayerMon.apiData.name} ленится и ничего не делает!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    S.activePlayerMon.truantSkip = true;
  }

  // ═══ 3. ASSAULT VEST ═══
  // Не позволяет использовать статус-атаки (без power)
  // Knock Off: ×1.5 к силе, если у цели есть предмет (канон; сам предмет
  // снимается ниже, после урона — блок KNOCK OFF).
  let power = move.power;
  if ((move.name === 'knock-off' || move.name === 'knockoff') && S.activeWild?.heldItem) {
    power = Math.floor(power * 1.5);
  }

  // ── L2-остаток: перезарядка (hyper-beam и семья) ──
  // После удара — пропуск хода. Промах (0 ударов) флаг не ставит,
  // поэтому проверка здесь ловит только честно заработанную перезарядку.
  if (S.activePlayerMon.recharging) {
    S.activePlayerMon.recharging = false;
    appendToLog(`${S.activePlayerMon.apiData.name} перезаряжается!`, false, 'system');
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ── L2-остаток: вес/скорость-атаки ──
  // В данных у них power=null — без подстановки силы они падали в
  // «Но ничего не произошло...». Копию кладём, кэш деталей не трогаем.
  {
    const eff = effectivePowerMove(move, S.activePlayerMon, S.activeWild,
      getEffectiveSpeed(S.activePlayerMon, false), getEffectiveSpeed(S.activeWild, true), false);
    if (eff !== move) {
      move = eff;
      power = eff.power;
    }
  }

  // ── L2-остаток: Bide ──
  // Ход 1 — затаился (урон копится), ход 2 — выпуск удвоенного.
  // Состояние на самом покемоне: смена/смерть его сбрасывают сами.
  if (normMoveName(move.name) === 'bide') {
    const st = S.activePlayerMon.bide || { turns: 0, dmg: 0 };
    if (st.turns <= 0) {
      S.activePlayerMon.bide = { turns: BIDE_TURNS, dmg: 0 };
      appendToLog(`${S.activePlayerMon.apiData.name} затаился!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    st.turns -= 1;
    if (st.turns > 0) {
      S.activePlayerMon.bide = st;
      appendToLog(`${S.activePlayerMon.apiData.name} продолжает терпеть...`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    S.activePlayerMon.bide = { turns: 0, dmg: 0 };
    const rel = bideRelease(st.dmg);
    if (rel == null) {
      appendToLog(`${S.activePlayerMon.apiData.name} терпел зря — бить нечем!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    // Выпуск: прямой урон без промаха (канон), дальше — общий финал хода.
    S.wildCurHP = Math.max(0, S.wildCurHP - rel);
    updateWildHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} выпускает накопленное: −${rel} HP!`, false, 'dmg');
    S.lastTakenByWild = { dmg: rel, cat: 'physical', round: S.battleRound };
    document.getElementById('battle-main-menu').style.display = 'none';
    if (S.wildCurHP === 0) {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ── Фикс: самоцвет сгорает при ударе своим типом (иначе ×1.3 навсегда) ──
  // Общий AFTER ALL HITS уже списывает consumeHeldAfterHit — здесь ставим метку.
  {
    const held = S.activePlayerMon.heldItem;
    if (held && GEM_TYPE[held] === move.type?.name) {
      S.activePlayerMon.consumeHeldAfterHit = held;
    }
  }

  // ── ПРОХОД-741: подмены и особые действия ──
  // metronome/copycat/assist/sleep-talk/mirror-move/nature-power становятся
  // другой атакой; transform/sketch/baton-pass/memento/healing-wish/
  // lunar-dance/roar/whirlwind/teleport/fling/natural-gift/present/
  // last-respects/rage-fist — особое действие. Всё — до ветвления
  // урон/статус, иначе power-null уводит в «ничего не произошло».
  {
    const gslug = normMoveName(move.name);
    const pname = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    const endToEnemy = () => {
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
    };
    const failGimmick = (msg: string) => {
      appendToLog(msg, false, 'system');
      endToEnemy();
    };
    const GIMMICK_COPY_OK = ['copycat', 'metronome', 'assist', 'sleep-talk', 'mirror-move', 'sketch', 'transform', 'mimic', 'me-first'];
    let sub: any = null;
    if (gslug === 'metronome') {
      sub = metronomePick();
      appendToLog(`${pname} крутит Метроном... выпало ${sub.name}!`, false, 'system');
    } else if (gslug === 'copycat') {
      const last = S.lastMoveUsedDetail;
      if (last && !GIMMICK_COPY_OK.includes(normMoveName(last.name))) {
        sub = { ...last };
        appendToLog(`${pname} копирует ${sub.name}!`, false, 'system');
      } else { failGimmick(`${pname} нечего копировать!`); return; }
    } else if (gslug === 'assist') {
      const pool: string[] = [];
      for (const m of (GS.myTeam || [])) {
        if (m === S.activePlayerMon || (m.currentHp ?? 1) <= 0) continue;
        for (const mv of (m.apiData?.moves || [])) if (mv?.move?.name) pool.push(mv.move.name);
      }
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (!pick) { failGimmick('Подмога не пришла — команда пуста!'); return; }
      sub = await fetchSiteMoveDetail(pick).catch(() => null)
        || { name: pick, power: 60, accuracy: 100, pp: 15, type: { name: 'normal' }, damage_class: { name: 'physical' }, meta: {} };
      appendToLog(`${pname} зовёт подмогу: ${pick}!`, false, 'system');
    } else if (gslug === 'sleep-talk') {
      if (S.activePlayerMon.status !== 'slp') { failGimmick('Бормотание во сне — но покемон не спит!'); return; }
      const opts = (S.playerMovesDetailed || []).filter((m: any) => m && !['sleep-talk', 'rest'].includes(normMoveName(m.name)));
      if (!opts.length) { failGimmick('Нечего бормотать!'); return; }
      sub = opts[Math.floor(Math.random() * opts.length)];
      appendToLog(`${pname} бормочет во сне: ${sub.name}!`, false, 'system');
    } else if (gslug === 'mirror-move') {
      if (S.lastWildMoveDetail) {
        sub = { ...S.lastWildMoveDetail };
        appendToLog(`${pname} отражает ${sub.name}!`, false, 'system');
      } else { failGimmick('Отражать нечего — противник ещё не бил!'); return; }
    } else if (gslug === 'nature-power') {
      const t = S.terrain?.kind;
      const stub = t === 'electric' ? ['thunderbolt', 90, 'electric', 'special']
        : t === 'grassy' ? ['energy-ball', 90, 'grass', 'special']
        : t === 'misty' ? ['moonblast', 95, 'fairy', 'special']
        : t === 'psychic' ? ['psychic', 90, 'psychic', 'special']
        : ['tri-attack', 80, 'normal', 'special'];
      sub = { name: stub[0], power: stub[1], accuracy: 100, pp: 15, type: { name: stub[2] }, damage_class: { name: stub[3] }, meta: {} };
      appendToLog(`Сила природы: ${sub.name}!`, false, 'system');
    }
    if (sub) {
      move = sub;
      power = sub.power;
    } else if (gslug === 'transform') {
      const wMoves = (S.wildMovesDetailed || []).filter(Boolean).slice(0, 4);
      if (!wMoves.length) { failGimmick('Превращаться не во что!'); return; }
      const types = (S.activeWild.apiData?.types || S.activeWild.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
      S.activePlayerMon.typeOverride = types.length ? types : null;
      S.activePlayerMon.apiData.moves = wMoves.map((m: any) => ({ move: { name: m.name, url: '' } }));
      S.playerMovesDetailed = wMoves.map((m: any) => ({ ...m }));
      S.activePlayerMon.movesPP = S.playerMovesDetailed.map((m: any) => ({ current: m.pp || 30, max: m.pp || 30 }));
      loadMoveButtons(S.activePlayerMon, useMove);
      appendToLog(`${pname} превращается в ${S.activeWild.name}!`, false, 'system');
      endToEnemy(); return;
    } else if (gslug === 'sketch') {
      if (!S.lastWildMove) { failGimmick('Зарисовывать нечего — противник ещё не бил!'); return; }
      const detail = await fetchSiteMoveDetail(S.lastWildMove).catch(() => null);
      S.activePlayerMon.apiData.moves[moveIndex] = { move: { name: S.lastWildMove, url: `https://pokeapi.co/api/v2/move/${S.lastWildMove}/` } };
      S.playerMovesDetailed[moveIndex] = detail || { name: S.lastWildMove, power: 60, accuracy: 100, pp: 30, type: { name: 'normal' }, damage_class: { name: 'physical' }, meta: {} };
      if (!S.activePlayerMon.movesPP) S.activePlayerMon.movesPP = [];
      S.activePlayerMon.movesPP[moveIndex] = { current: 30, max: 30 };
      loadMoveButtons(S.activePlayerMon, useMove);
      appendToLog(`${pname} зарисовывает ${S.lastWildMove}!`, false, 'system');
      endToEnemy(); return;
    } else if (gslug === 'baton-pass') {
      const next = (GS.myTeam || []).find((m: any) => m !== S.activePlayerMon && (m.currentHp ?? 1) > 0);
      if (!next) { failGimmick('Передавать некому — команда пуста!'); return; }
      const stages = { ...(S.activePlayerMon.statStages || {}) };
      const subHp = S.substituteHP || 0;
      const oldName = pname;
      S.activePlayerMon = next;
      S.activePlayerMon.statStages = stages;
      S.substituteHP = subHp;
      S.activePlayerMon.choiceLockedMove = undefined;
      S.playerChargedMove = null;
      document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
      document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
      (document.getElementById('player-sprite') as HTMLImageElement).src = getSpriteUrl(S.activePlayerMon);
      updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
      document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
      updatePlayerHpUI();
      updateAbilityDisplay();
      loadMoveButtons(S.activePlayerMon, useMove);
      appendToLog(`${oldName} — эстафета! ${S.activePlayerMon.nickname || S.activePlayerMon.apiData.name} перенимает усиления!`, false, 'switch');
      endToEnemy(); return;
    } else if (gslug === 'memento') {
      statStageModify(S.activeWild, 'atk', -2, true);
      statStageModify(S.activeWild, 'spa', -2, true);
      S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
      appendToLog(`${pname} жертвует собой! Атака дикого резко падает!`, false, 'system');
      appendToLog(`${pname} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    } else if (gslug === 'healing-wish' || gslug === 'lunar-dance') {
      const rest = (GS.myTeam || []).some((m: any) => m !== S.activePlayerMon && (m.currentHp ?? 1) > 0);
      if (!rest) { failGimmick('Желание некому исполнить — команда пуста!'); return; }
      S.pendingHeal = gslug === 'lunar-dance' ? 'fullpp' : 'full';
      S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
      appendToLog(`${pname} загадывает исцеление для следующего!`, false, 'system');
      appendToLog(`${pname} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    } else if (gslug === 'roar' || gslug === 'whirlwind' || gslug === 'teleport') {
      if (S.battleType !== 'wild') { failGimmick('Лидер не даёт уйти из боя!'); return; }
      // Проход-741: ловушка не даёт телепортироваться (рык выгоняет дикого — работает).
      // Жалоба 6: проверяем оба флага (прямой + vol) — bind-семья тоже держит.
      if (gslug === 'teleport' && !canEscapeFromTrap(S.activePlayerMon.trapped, S.activePlayerMon.vol?.trapped)) { failGimmick('Ловушка держит — телепорт не работает!'); return; }
      // Жалоба 5: isForcedFleeMove — единая проверка имени (тестируется).
      if (!isForcedFleeMove(gslug)) { failGimmick('Не получилось сбежать!'); return; }
      appendToLog(gslug === 'teleport' ? `${pname} телепортируется из боя!` : `Дикий ${S.activeWild.name} в ужасе убегает!`, false, 'system');
      fleeWildBattle(gslug === 'teleport' ? 'Вам удалось сбежать!' : 'Противник сбежал!');
      return;
    } else if (gslug === 'fling') {
      const held = S.activePlayerMon.heldItem;
      if (!held) { failGimmick('Бросать нечего — в лапах пусто!'); return; }
      const p = flingPower(held, itemCategory(held));
      move = { ...move, power: p };
      power = p;
      S.activePlayerMon.consumeHeldAfterHit = held;
      appendToLog(`${pname} бросает ${held}!`, false, 'system');
    } else if (gslug === 'natural-gift') {
      const held = S.activePlayerMon.heldItem;
      const gift = held && itemCategory(held) === 'berries' ? naturalGift(held) : null;
      if (!gift) { failGimmick('Нужна ягода в лапах!'); return; }
      move = { ...move, power: gift.power, type: { name: gift.type } };
      power = gift.power;
      S.activePlayerMon.consumeHeldAfterHit = held;
      appendToLog(`${pname} швыряет ягоду силой природы!`, false, 'system');
    } else if (gslug === 'present') {
      const roll = presentRoll();
      if (roll.kind === 'heal') {
        const amt = Math.max(1, Math.floor(S.wildMaxHP / 4));
        S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + amt);
        updateWildHpUI();
        appendToLog(`${pname} дарит лечение противнику! (+${amt} HP)`, false, 'heal');
        endToEnemy(); return;
      }
      move = { ...move, power: roll.power };
      power = roll.power;
      appendToLog(`${pname} дарит... удар на ${roll.power}!`, false, 'system');
    } else if (gslug === 'last-respects') {
      const fainted = (GS.myTeam || []).filter((m: any) => (m.currentHp ?? 1) <= 0).length;
      move = { ...move, power: lastRespectsPower(fainted) };
      power = move.power;
    } else if (gslug === 'rage-fist') {
      move = { ...move, power: rageFistPower(S.activePlayerMon.rageHits) };
      power = move.power;
    } else if (gslug === 'acrobatics') {
      // Без предмета — 110 вместо 55
      if (!S.activePlayerMon.heldItem) {
        move = { ...move, power: 110 };
        power = 110;
        appendToLog(`${pname} лёгкий как пёрышко!`, false, 'system');
      }
    } else if (gslug === 'stored-power' || gslug === 'power-trip') {
      // 20 + 20 за каждую положительную ступень
      const st = S.activePlayerMon.statStages || {};
      const boosts = ['atk', 'def', 'spa', 'spd', 'spe'].reduce((n, k) => n + Math.max(0, st[k] || 0), 0);
      move = { ...move, power: 20 + 20 * boosts };
      power = move.power;
    } else if (gslug === 'eruption' || gslug === 'water-spout' || gslug === 'dragon-energy') {
      // 150 × доля HP
      const frac = S.activePlayerMon.maxHp > 0 ? S.activePlayerMon.currentHp / S.activePlayerMon.maxHp : 0;
      move = { ...move, power: Math.max(1, Math.floor(150 * frac)) };
      power = move.power;
    }
  }

  if (!power && S.activePlayerMon.heldItem === 'assaultVest') {
    appendToLog('Штурмовой жилет не позволяет использовать статус-атаки!');
    return;
  }

  // ═══ 4. PHASE TRANSITION ═══
  // Валидация: проверяем что можно перейти в ENEMY_TURN
  // Если нет — бой ещё не готов (анимация и т.д.)
  if (!battle.canTransition(BattlePhase.ENEMY_TURN)) {
    appendToLog('Подождите... битва ещё не готова.');
    return;
  }
  battle.transition(BattlePhase.ENEMY_TURN); // Переход фазы
  // Проход-741: флаги прямого урона свежие каждый ход (для endure)
  S.wildTookHit = false;
  S.playerTookHit = false;
  S.wildTookCat = null;
  S.playerTookCat = null;

  // ── 4b. ПРОХОД-741: начало хода игрока (perish/yawn/wish) ──
  {
    const vs = volatileStart(S.activePlayerMon, false, {
      get: () => S.activePlayerMon.currentHp,
      set: (v) => { S.activePlayerMon.currentHp = v; },
      max: () => S.activePlayerMon.maxHp,
      ui: () => updatePlayerHpUI(),
    });
    if (vs === 'fainted') {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    }
    if (vs === 'done') {
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
  }

  // ═══ 5. STATUS CHECK ═══
  // Проверяем может ли игрок действовать (сон/паралич/заморозка)
  if (!checkStatusTurn(S.activePlayerMon, true)) {
    document.getElementById('battle-main-menu').style.display = 'none';
    // Урон от яда/ожога в конце хода (даже если пропустил ход)
    applyStatusEndOfTurn(S.activePlayerMon, true);
    if (S.activePlayerMon.currentHp <= 0) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    }
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000); // Ход врага
    return;
  }

  // ═══ 5b. FLINCH CHECK ═══
  if (S.activePlayerMon.flinch) {
    S.activePlayerMon.flinch = false;
    appendToLog(`${S.activePlayerMon.apiData.name} дрогнул и не может атаковать!`, false, 'system');
    applyStatusEndOfTurn(S.activePlayerMon, true);
    if (S.activePlayerMon.currentHp <= 0) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    }
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ── 5b3. ПРОХОД-741: условия первого хода и ответа на урон ──
  // Focus Punch падает, если били; Shell Trap — только по физике;
  // Fake Out / First Impression — только первый ход на поле.
  {
    const fslug = normMoveName(move.name);
    if (fslug === 'focus-punch' && S.playerTookHit) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял концентрацию!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    if (fslug === 'shell-trap' && S.playerTookCat !== 'physical') {
      appendToLog(`Ловушка не сработала — физического удара не было!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
    if ((fslug === 'fake-out' || fslug === 'first-impression') && (S.activePlayerMon.turnsOut || 1) > 1) {
      appendToLog(`${move.name} срабатывает только на первом ходу!`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
  }

  // ── 5b2. ПРОХОД-741: волатильные проверки выбранной атаки ──
  // Encore/disable/taunt/torment/imprison/confusion/attract. Могут сменить
  // слот (encore), сорвать ход или ударить себя. До порядка хода и PP.
  {
    const va = volatileAction(S.activePlayerMon, S.activeWild, false, move, moveIndex, S.playerMovesDetailed);
    if (va) {
      if (va.forceIndex !== undefined) {
        moveIndex = va.forceIndex;
        move = S.playerMovesDetailed[moveIndex];
        power = move?.power ?? null;
      } else if (va.fail) {
        appendToLog(va.fail, false, 'system');
        document.getElementById('battle-main-menu').style.display = 'none';
        saveBattleState();
        setTimeout(() => { enemyTurn(); }, 1000);
        return;
      } else if (va.selfHit) {
        const lvl = S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten;
        const dmg = confusionDamage(
          baseAttackOf(S.activePlayerMon, false),
          baseDefOf(S.activePlayerMon, false),
          lvl,
        );
        S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - dmg);
        updatePlayerHpUI();
        appendToLog(`${S.activePlayerMon.apiData.name} в замешательстве бьёт себя! (−${dmg} HP)`, false, 'dmg');
        if (S.activePlayerMon.currentHp <= 0) {
          appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
          handlePlayerFaint();
          return;
        }
        document.getElementById('battle-main-menu').style.display = 'none';
        saveBattleState();
        setTimeout(() => { enemyTurn(); }, 1000);
        return;
      }
    }
  }

  // ═══ 5c. ПОРЯДОК ХОДА ПО СКОРОСТИ ═══
    // Если враг быстрее, его ход идёт первым, и только потом наш. Раньше порядок
    // был жёстко «игрок, потом враг»: скорость, стадии, Choice Scarf, паралич и
    // приоритет атаки не учитывались вообще.
    //
    // runEnemyTurnBody() самодостаточен: он отрабатывает весь ход врага и
    // заканчивает показом меню выбора, поэтому его можно вызвать здесь, не
    // вызывая enemyTurn() и не зацикливая ходы.
    let enemyAlreadyMoved = false;

    /**
     * Завершение хода игрока.
     *
     * Если враг уже отработал (был быстрее и сходил до нас) — второй раз его не
     * зовём, просто возвращаем меню выбора. Иначе отдаём ход врагу.
     *
     * Здесь раньше стояло `endTurn()` в ветке else, то есть функция вызывала
     * саму себя: бесконечная рекурсия, бой намертво зависал на первой же атаке,
     * а переполнение стека уходило в console.error без внятного сообщения.
     * Ветка else просто никогда не приводила к ходу врага — она приводила к
     * падению.
     */
    const endTurn = async () => {
      if (enemyAlreadyMoved) {
        // Проход-741: враг уже сходил — раунд закрыт здесь (finishEnemyTurn
        // не вызовется), поэтому часы поля тикают тут, иначе быстрые враги
        // останавливали бы погоду/террейн/tailwind/trick-room.
        tickFieldEndOfRound();
        // Фикс: тики могли добить — те же проверки, что в finishEnemyTurn
        if (S.wildCurHP <= 0) {
          if (guardFaintWild()) { /* выдержал */ }
          else {
            await handleWildFaintRewards(S.battleType === 'wild');
            return;
          }
        }
        if (S.activePlayerMon.currentHp <= 0) {
          if (!guardFaintPlayer()) {
            appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
            handlePlayerFaint();
            // Фикс: destiny могла обнулить дикого — обрабатываем и его
            if (S.wildCurHP <= 0) {
              if (guardFaintWild()) { /* выдержал */ }
              else {
                await handleWildFaintRewards(S.battleType === 'wild');
                return;
              }
            }
            return;
          }
        }
        showPlayerMenuAfterDelay();
        return;
      }
      // Враг ещё не ходил в этом раунде: отдаём ему ход. runEnemyTurnBody
      // самодостаточен — он и доводит ход до конца, и возвращает меню через
      // showPlayerMenuAfterDelay, поэтому дополнительно звать enemyTurn()
      // нельзя, иначе ход удвоится.
      if (S.wildCurHP <= 0 || !S.activePlayerMon || S.activePlayerMon.currentHp <= 0) {
        saveBattleState();
        return;
      }
      try {
        await runEnemyTurnBody();
      } catch (e) {
        // Исключение в ходе врага иначе оставляло фазу в ENEMY_TURN: нижняя
        // проверка недостижима, меню не возвращается, побег и остальные кнопки
        // вечно отвечают «Подождите...». См. recoverBattleMenu.
        console.error('[battle] endTurn: enemy turn failed:', e);
        recoverBattleMenu('useMove:endTurn');
      }
      // Если бой не закончился и ход противника не отдал меню сам — отдаём
      // явно. Иначе меню останется скрытым, а фаза — в ENEMY_TURN.
      const phase = battle.phase;
      if (phase === BattlePhase.ENEMY_TURN
        && S.wildCurHP > 0
        && S.activePlayerMon && S.activePlayerMon.currentHp > 0) {
        saveBattleState();
        showPlayerMenuAfterDelay();
      }
    };

    if (S.wildCurHP > 0 && S.activePlayerMon.currentHp > 0) {
      // ═══ ЗАПРЕТ ПРИОРИТЕТНЫХ АТАК ═══
      // Queenly Majesty / Dazzling у противника полностью запрещают атаки с
      // приоритетом выше нуля (Quick Attack, Sucker Punch и подобные).
      // Проверка стоит здесь, а не у фазы, потому что endTurn() объявлен выше
      // именно в этой ветке.
      const wildGuardAbil = String(abilityOf(S.activeWild, true) || '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');
      if ((wildGuardAbil === 'queenlymajesty' || wildGuardAbil === 'dazzling')
        && ((move as any).priority ?? 0) > 0) {
        appendToLog(`${S.activeWild.name} запрещает приоритетные атаки!`, false, 'system');
        document.getElementById('battle-main-menu').style.display = 'none';
        saveBattleState();
        endTurn();
        return;
      }
      // Проход-741: психический террейн не даёт приоритетным атакам бить
      // по наземному противнику
      if (S.terrain?.kind === 'psychic' && isGrounded(S.activeWild, true)
        && ((move as any).priority ?? 0) > 0) {
        appendToLog('Психический террейн блокирует приоритетную атаку!', false, 'system');
        document.getElementById('battle-main-menu').style.display = 'none';
        saveBattleState();
        endTurn();
        return;
      }

      let enemyMoveForOrder: any = null;
      if (S.enemyChargedMove) {
        enemyMoveForOrder = S.enemyChargedMove;
      } else {
        const aiPreview = selectEnemyMove({
          moves: S.wildMovesDetailed,
          movesPP: S.wildMovesPP,
          attacker: S.activeWild,
          defender: S.activePlayerMon,
          isTrainer: S.battleType !== 'wild',
          getTypeMultiplier,
          banned: S.imprisonP, // imprison: запрещённые не предлагать
        });
        enemyMoveForOrder = aiPreview?.move || null;
      }

      if (!playerMovesFirst(move, enemyMoveForOrder)) {
        document.getElementById('battle-main-menu').style.display = 'none';
        // N1: чей ход заказан — фиксируем ДО хода врага. Если враг убил
        // активного, handlePlayerFaint() тихо подменит S.activePlayerMon
        // заменой, и старый moveIndex начнёт указывать в ЧУЖИЕ слоты:
        // замена «использует атаку мёртвого». Ниже — отмена queued-хода.
        const monBefore = S.activePlayerMon;
        try {
          await runEnemyTurnBody();
        } catch (e) {
          // Быстрый враг упал до нашей атаки: фазу вернёт recoverBattleMenu,
          // а наша атака ниже всё равно выполняется — ход не теряется.
          console.error('[battle] useMove: fast-enemy turn failed:', e);
          recoverBattleMenu('useMove:fastEnemy');
        }
        enemyAlreadyMoved = true;
        // Враг мог добить кого-то — тогда ход закончен, обработчики уже отработали.
        if (!S.activePlayerMon || S.activePlayerMon.currentHp <= 0 || S.wildCurHP <= 0) return;
        // Замена вышла вместо упавшего — queued-атака мёртвого отменяется:
        // замена обязана выбрать свою атаку сама.
        if (isQueuedMoveStale(monBefore, S.activePlayerMon)) return;
      }
      // ── ПРОХОД-741: Me First ──
      // Крадёт атаку врага с ×1.5 — только если тот ещё не сходил и его
      // атака дамажащая. Иначе провал (канон).
      if (normMoveName(move.name) === 'me-first') {
        const foeMove = enemyMoveForOrder;
        const stolen = !enemyAlreadyMoved ? meFirstCopy(foeMove) : null;
        if (!stolen) {
          appendToLog(`${S.activePlayerMon.apiData.name} нечего красть — Me First провалился!`, false, 'system');
          document.getElementById('battle-main-menu').style.display = 'none';
          saveBattleState();
          endTurn();
          return;
        }
        move = stolen;
        power = stolen.power;
        appendToLog(`${S.activePlayerMon.apiData.name} крадёт ${foeMove.name}!`, false, 'system');
      }
    }

    // ═══ 6. DECREMENT PP ═══
  if (S.activePlayerMon.movesPP && S.activePlayerMon.movesPP[moveIndex]) {
    // Pressure у противника: каждая атака тратит вдвое больше PP.
    const wildPress = String(abilityOf(S.activeWild, true) || '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
    S.activePlayerMon.movesPP[moveIndex].current -= wildPress === 'pressure' ? 2 : 1;
    // Сразу перерисовываем кнопку: раньше текст обновлялся только при
    // перезагрузке кнопок, и PP визуально не тратились вообще.
    updateMoveButtonUI(moveIndex, move);
  }

  // ═══ 7. CHOICE ITEM LOCK (after successful use) ═══
  // Если первый раз используем атаку с Choice-предметом — блокируем её
  if (choiceItems.includes(S.activePlayerMon.heldItem)) {
    S.activePlayerMon.choiceLockedMove = moveIndex;
  }

  // ── 7b. L2-остаток: цель спряталась (fly/dig/dive) ──
  // Достают только канонные контр-атаки (thunder — fly, earthquake — dig...).
  if (S.activeWild.hiddenIn && !canHitHidden(move.name, S.activeWild.hiddenIn)) {
    appendToLog(`${S.activePlayerMon.apiData.name} бьёт мимо — противник спрятался!`, false, 'system');
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
    endTurn();
    return;
  }

  // ═══ 8. ACCURACY CHECK ═══
  // Проверяем попала ли атака (учитывает accuracy атаки и evasion цели)
  let accResult = checkAccuracy(
    move,
    abilityOf(S.activePlayerMon, false),
    abilityOf(S.activeWild, true),
    S.currentWeather,
  );
  // ПРОХОД-741: наведение (lock-on/mind-reader) бьёт без промаха, разовое
  if (!accResult.hit && S.activePlayerMon.lockedOn) {
    S.activePlayerMon.lockedOn = false;
    accResult = { hit: true, message: '' };
    appendToLog(`Наведение сработало — мимо не пройти!`, false, 'system');
  }
  // Hustle: 20% additional miss chance for physical moves
  const playerAbilityName = abilityOf(S.activePlayerMon, false);
  // Serene Grace удваивает шанс побочных эффектов своих атак (статус, статы,
  // флинч). Множитель применяется ко всем трём проверкам ниже.
  const playerSereneGrace = String(playerAbilityName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'serenegrace' ? 2 : 1;
  if (accResult.hit && playerAbilityName === 'hustle' && power && move.damage_class?.name === 'physical') {
    if (Math.random() * 100 < 20) {
      accResult = { hit: false, message: 'Атака промахнулась из-за Hustle!' };
    }
  }
  if (!accResult.hit) {
    appendToLog(accResult.message); // "Атака промахнулась!"
    // Аудит итемов: Blunder Policy — скорость +2 при промахе (съедается)
    if (S.activePlayerMon.heldItem === 'blunderPolicy') {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'spe', 2, false);
      appendToLog(`${S.activePlayerMon.apiData.name} съедает Blunder Policy: скорость +2!`, false, 'system');
    }
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
     endTurn();
    return;
  }

  // ═══ 9. SUCKER PUNCH FAIL ═══
  // Sucker Punch проваливается если противник использует статус-атаку
  if (checkSuckerPunchFail(move, S.enemyChosenMove)) {
    appendToLog(`${S.activePlayerMon.apiData.name} использовал Sucker Punch, но провалился!`);
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
     endTurn();
    return;
  }

  // ═══ 9b. TWO-TURN MOVE (заряд/выпуск) ═══
  // Проверяем: уже заряжено? Если да — выпускаем атаку.
  // Если нет и атака требует зарядки — заряжаем и завершаем ход.
  // isChargeMove: meta.category 'charge' или имя в CHARGE_MOVES
  // (solar-beam, skull-bash... — в moves_db категории charge нет).
  const isCharge = isChargeMove(move);
  if (S.playerChargedMove) {
    // ═══ ВЫПУСК ═══ Уже заряжено — очищаем заряд и продолжаем с этой атакой
    if (move.name === S.playerChargedMove.name) {
      S.playerChargedMove = null;
      // Продолжаем как обычную атаку
    } else {
      // Заряд потерян (выбрали другую атаку)
      appendToLog(`${S.activePlayerMon.apiData.name} теряет заряд ${S.playerChargedMove.name}!`);
      S.playerChargedMove = null;
    }
  } else if (isCharge || normMoveName(move.name) === 'geomancy') {
    // Проход-741: geomancy тоже двухходовая (заряд → баффы обычным ходом)
    // Аудит итемов: Power Herb пропускает заряд (съедается)
    if (S.activePlayerMon.heldItem === 'powerHerb') {
      S.activePlayerMon.heldItem = null;
      appendToLog(`${S.activePlayerMon.apiData.name} съедает Power Herb — сразу бьёт!`, false, 'system');
    } else {
      // ═══ ЗАРЯД ═══ Первый ход — заряжаем атаку
      S.playerChargedMove = move;
      appendToLog(`${S.activePlayerMon.apiData.name} заряжает ${move.name}!`);
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
       endTurn();
      return;
    }
  }

  // ── 9c. L2-остаток: полунеуязвимость (fly/dig/dive/...) ──
  // Ход 1 — спрятался (по нему не попасть, кроме контр-атак), ход 2 той же
  // атакой — удар. Другая атака вместо выпуска — выходим из укрытия без удара
  // (мягче канона, но без софтлока: иначе игрок застревает в небе навсегда).
  {
    const slug = normMoveName(move.name);
    if (isSemiInvuln(move)) {
      if (S.activePlayerMon.hiddenIn === slug) {
        S.activePlayerMon.hiddenIn = null; // выпуск — бьём ниже обычным ходом
      } else {
        S.activePlayerMon.hiddenIn = slug;
        appendToLog(`${S.activePlayerMon.apiData.name} ${hideVerb(slug)}`, false, 'system');
        document.getElementById('battle-main-menu').style.display = 'none';
        saveBattleState();
        endTurn();
        return;
      }
    } else if (S.activePlayerMon.hiddenIn) {
      S.activePlayerMon.hiddenIn = null;
      appendToLog(`${S.activePlayerMon.apiData.name} выходит из укрытия!`, false, 'system');
    }
  }

  // ═══ 10. ОСНОВНАЯ ЛОГИКА АТАКИ ═══
  appendToLog(`${S.activePlayerMon.apiData.name} использует ${move.name}!`);
  // Проход-741: последние ходы (copycat/mirror-move/sketch/me-first)
  S.lastPlayerMove = normMoveName(move.name);
  S.lastPlayerMoveDetail = move;
  S.lastMoveUsed = S.lastPlayerMove;
  S.lastMoveUsedDetail = move;
  S.playerActedRound = S.battleRound;
  monVol(S.activePlayerMon).lastMove = S.lastPlayerMove; // для torment

  // ─── 10a. STATUS MOVES (без урона) ───
  // Ветка выбирается НЕ по `!power`: power-null, но дамажащие (фикс. урон,
  // OHKO) идут в урон. Несработавший endeavor (fixed null) остаётся здесь.
  // Раньше все они падали в «ничего не произошло».
  const playerFixedDmg = !power ? getFixedDamage(move, {
    attackerLevel: S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten,
    defenderCurrentHp: S.wildCurHP,
    defenderMaxHp: S.wildMaxHP,
    attackerCurrentHp: S.activePlayerMon.currentHp,
    attackerMaxHp: S.activePlayerMon.maxHp,
    stock: S.activePlayerMon.stock || 0,
    // L2-остаток: контратаки бьют от входящего с прошлого хода
    lastTakenDmg: S.lastTakenByPlayer?.dmg,
    lastTakenCat: S.lastTakenByPlayer?.cat,
    lastTakenRound: S.lastTakenByPlayer?.round,
    nowRound: S.battleRound,
  }) : null;
  if (!power && playerFixedDmg == null && !isOhkoMove(move)) {
    // 10a-i: Наложение статуса (Toxic, Thunder Wave, Will-O-Wisp, Spore...)
    const ailment = move.meta?.ailment?.name;
    if (ailment && ailment !== 'none' && ailment !== 'unknown') {
      const statusMap = {
        'poison': 'psn', 'badly-poison': 'tox',
        'burn': 'brn', 'paralysis': 'par',
        'sleep': 'slp', 'freeze': 'frz'
      };
      const targetStatus = statusMap[ailment];
      if (targetStatus && !S.wildStatus) {
        // Проверка иммунитета (по типу или способности)
        if (isStatusImmune(ailment, S.activeWild)) {
          appendToLog(`У дикого ${S.activeWild.name} иммунитет к ${STATUS_NAMES[targetStatus] || targetStatus}!`);
        } else if (applyStatusEffect(S.activeWild, targetStatus)) {
          S.wildStatus = S.activeWild.status;
          document.getElementById('wild-status-icon').innerText = getStatusIcon(S.wildStatus);
          appendToLog(`Дикий ${S.activeWild.name} получил ${STATUS_NAMES[targetStatus]}!`);
        }
      }
    }

    // 10a-ii: Изменение статов (Swords Dance, Growl, Charm...)
    let appliedStat = false;
    if (move.stat_changes && move.stat_changes.length > 0) {
      const targetMap = { 'user': S.activePlayerMon, 'selected-pokemon': S.activeWild, 'all-opponents': S.activeWild };
      const moveTarget = move.target?.name || 'selected-pokemon';
      const affectedMon = targetMap[moveTarget] || S.activeWild;
      const monName = affectedMon === S.activePlayerMon ? S.activePlayerMon.apiData.name : S.activeWild.name;
      const statNameMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };

      move.stat_changes.forEach(sc => {
        const statKey = statNameMap[sc.stat.name];
        if (statKey) {
          statStageModify(affectedMon, statKey, sc.change, affectedMon !== S.activePlayerMon);
          const newStage = affectedMon.statStages[statKey];
          const sign = newStage >= 0 ? '+' : '';
          const dir = sc.change > 0 ? 'повышена' : 'понижена';
          const labels = { atk: 'Атака', def: 'Защита', spa: 'Сп. Атака', spd: 'Сп. Защита', spe: 'Скорость' };
          appendToLog(`${labels[statKey] || statKey} ${monName} ${dir} (${sign}${newStage})`, false, 'system');
          appliedStat = true;
        }
      });
    }

    // 10a-iii: Role Play — копировать способность цели
    if (move.name === 'role-play') {
      const targetAbility = S.activeWild.abilities?.[0]?.ability?.name;
      if (targetAbility) {
        setBattleAbility(S.activePlayerMon, false, targetAbility);
        appendToLog(`${S.activePlayerMon.apiData.name} скопировал способность ${S.activeWild.name}: ${targetAbility}!`);
        updateAbilityDisplay();
      } else {
        appendToLog('Но не удалось скопировать способность...');
      }
      appliedStat = true;
    }

    // 10a-iv: Специальные статус-эффекты (лечение, барьеры)
    const appliedSpecial = handlePlayerStatusEffects(move);

    // Если ничего не произошло — сообщаем
    if (!appliedSpecial && !appliedStat && (!ailment || ailment === 'none' || ailment === 'unknown')) {
      appendToLog('Но ничего не произошло...');
    }
  } else {
    // ─── 10b. DAMAGE DEALING MOVES (с power) ───

    // Проверка Protect у врага
    if (S.enemyProtectActive) {
      appendToLog(`${S.activeWild.name} защитился от атаки!`);
      S.enemyProtectActive = false;
      // Проход-741: шипастый щит наказывает атакующего
      applyShieldPunish(S.activeWild, S.activePlayerMon, false);
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
       endTurn();
      return;
    }
    // Если есть Substitute — уведомляем
    if (S.enemySubstituteHP > 0) {
      appendToLog(`${S.activeWild.name} защищается Заменителем!`);
    }

    // ═══ РАСЧЁТ УРОНА ═══
    const curLvl = S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten;
    // Crit rate stage: base from move (0=normal, 1=high-crit) + items/abilities
    let critRateStage = move.meta?.crit_rate || 0;
    // Аудит итемов: Scope Lens / Razor Claw +1 ступень крита
    if (S.activePlayerMon.heldItem === 'scopeLens' || S.activePlayerMon.heldItem === 'razorClaw') critRateStage += 1;
    // Фокус: +2 ступени
    if (S.activePlayerMon.focusEnergy) critRateStage += 2;
    // Stick (Farfetch'd/Sirfetch'd): +2 crit stages (25%)
    if (S.activePlayerMon.heldItem === 'stick' && ['farfetchd', 'sirfetchd'].includes(S.activePlayerMon.apiData?.species?.name || '')) {
      critRateStage += 2;
    }
    const isPhysical = move.damage_class.name === 'physical';
    // L2-остаток: Beat Up бьёт по числу здоровых в команде (канон)
    const beatSlug = normMoveName(move.name);
    const beatParty = beatSlug === 'beat-up'
      ? (GS.myTeam || []).filter((m: any) => m && (m.currentHp ?? 1) > 0 && !m.status) : null;
    const numHits = beatSlug === 'beat-up'
      ? Math.max(1, beatParty!.length)
      : beatSlug === 'population-bomb'
        ? populationBombHits()
        : getMultiHitCount(move, Math.random, S.activePlayerMon.heldItem);

    // Sheer Force: убирает вторичные эффекты атак, даёт 1.3x урон (в calculateDamage)
    const playerSheerForce = playerAbilityName === 'sheer-force' &&
      !!(move.meta?.ailment_chance || move.meta?.flinch_chance || move.meta?.stat_chance || (move.stat_changes?.length > 0));

    // ── ПРОХОД-741: Spectral Thief крадёт усиления до удара ──
    if (normMoveName(move.name) === 'spectral-thief') {
      const fs = S.activeWild.statStages || {};
      const stolen = ['atk', 'def', 'spa', 'spd', 'spe'].some((k) => (fs[k] || 0) > 0);
      if (stolen) {
        const ps = S.activePlayerMon.statStages || { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) {
          ps[k] = Math.max(-6, Math.min(6, (ps[k] || 0) + Math.max(0, fs[k] || 0)));
          fs[k] = 0;
        }
        S.activePlayerMon.statStages = ps;
        S.activeWild.statStages = fs;
        updateStatBadges();
        appendToLog(`${S.activePlayerMon.apiData.name} крадёт усиления!`, false, 'system');
      }
    }

    // ═══ MULTI-HIT LOOP ═══
    let totalDmg = 0, hitsLanded = 0, lastCrit = false;
    const preWildHP = S.wildCurHP;
    // L2-остаток: сила каждого удара Beat Up — по бьющему члену команды
    const beatPowers = beatParty
      ? beatParty.map((m: any) => beatUpPower(baseAttackOf(m, false)))
      : null;
    for (let hi = 0; hi < numHits; hi++) {
      if (S.wildCurHP <= 0) break;
      if (hi > 0 && S.enemyProtectActive) break;
      const hitMove = beatPowers ? { ...move, power: beatPowers[hi % beatPowers.length] } : move;

      const dmgResult = calculateDamage({
        move: hitMove, attacker: S.activePlayerMon, defender: S.activeWild,
        attackerLevel: curLvl, defenderLevel: S.wildLvl,
        isWildAttacker: false, isWildDefender: true,
        weather: S.currentWeather,
        attackerStatStages: S.activePlayerMon.statStages,
        defenderStatStages: S.activeWild.statStages,
        attackerHeldItem: S.activePlayerMon.heldItem,
        defenderHeldItem: S.activeWild.heldItem,
        naturesList: natures,
        critRateStage,
        defenderAbilityName: abilityOf(S.activeWild, true),
        attackerAbilityName: abilityOf(S.activePlayerMon, false),
          defenderCurrentHp: S.wildCurHP,
          defenderMaxHp: S.wildMaxHP,
          attackerCurrentHp: S.activePlayerMon.currentHp,
          attackerMaxHp: S.activePlayerMon.maxHp,
          attackerSlowStart: String(abilityOf(S.activePlayerMon, false) || '')
            .toLowerCase().replace(/[^a-z0-9]/g, '') === 'slowstart'
            && (S.activePlayerMon.slowStartTurns || 0) < 5,
          // L2-остаток: контратаки бьют от входящего с прошлого хода
          lastTakenDmg: S.lastTakenByPlayer?.dmg,
          lastTakenCat: S.lastTakenByPlayer?.cat,
          lastTakenRound: S.lastTakenByPlayer?.round,
          nowRound: S.battleRound,
          // Проход-741: заряды stockpile и смена типа
          stock: S.activePlayerMon.stock || 0,
          attackerTypesOverride: effTypes(S.activePlayerMon).length ? effTypes(S.activePlayerMon) : undefined,
          defenderTypesOverride: effTypes(S.activeWild).length ? effTypes(S.activeWild) : undefined,
          // Аудит итемов/атак: лазерный прицел и гарантированные криты
          alwaysCrit: !!S.activePlayerMon.laserFocus || ALWAYS_CRIT.has(normMoveName(move.name)),
          // Проход-741: напев давит криты, foresight бьёт по призраку
          suppressCrit: (S.luckyW || 0) > 0,
          ignoreGhost: !!S.activeWild.vol?.foresight,
      });
      let hitDmg = dmgResult.damage;
      const bMod = applyBarrierMod(1, move, false, dmgResult.isCrit);
      if (bMod !== 1) hitDmg = Math.floor(hitDmg * bMod);
      // Проход-741: Collision Course — ×4/3 по суперэффективной цели
      {
        const cSlug = normMoveName(move.name);
        if ((cSlug === 'collision-course' || cSlug === 'electro-drift') && hitDmg > 0) {
          const eff = getTypeMultiplier(move.type?.name, effTypes(S.activeWild));
          const mult = collisionCourseMult(eff);
          if (mult !== 1) hitDmg = Math.floor(hitDmg * mult);
        }
      }
      lastCrit = dmgResult.isCrit;

      // Модификаторы («Критический удар!», «Суперэффективно!»…) печатаем в одной
      // строке с уроном — ниже, когда урон уже применён.
      const hitMods = dmgResult.messages
        .map(m => m.replace(/[!.]+$/, '').toLowerCase())
        .join(', ');

      if (S.enemySubstituteHP > 0) {
        const subDmg = Math.min(S.enemySubstituteHP, hitDmg);
        S.enemySubstituteHP -= subDmg;
        hitDmg -= subDmg;
        if (S.enemySubstituteHP <= 0) { appendToLog('Заменитель разрушен!'); S.enemySubstituteHP = 0; }
      }
      if (hitDmg <= 0) {
        appendToLog(`0 урона${hitMods ? ` — ${hitMods}` : ''}`, false, 'dmg');
        continue;
      }

      // Type-resist berry for wild (Occa, Passho, etc.)
      if (hi === 0) hitDmg = applyTypeResistBerry(S.activeWild, move.type?.name, hitDmg, false);

      S.wildCurHP -= hitDmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      totalDmg += hitDmg;
      hitsLanded++;
      // Одна строка на удар: урон и модификаторы вместе
      appendToLog(`−${hitDmg} HP${hitMods ? ` — ${hitMods}` : ''}`, false, 'dmg');

      // Drain / Recoil per hit. Жалоба 4: дрэйн-лечение чиним через
      // чистое ядро applyDrainHeal (Big Root ×1.3, кап по maxHp) + лог,
      // иначе «Мега/Гига Дрейн не пополняют ХП» — healing молча терялся.
      if (move.meta?.drain) {
        if (move.meta.drain > 0) {
          const before = S.activePlayerMon.currentHp;
          const after = applyDrainHeal(before, S.activePlayerMon.maxHp, hitDmg, move.meta.drain, S.activePlayerMon.heldItem === 'bigRoot');
          if (after > before) {
            S.activePlayerMon.currentHp = after;
            updatePlayerHpUI();
            appendToLog(`${S.activePlayerMon.apiData.name} высасывает здоровье! (+${after - before} HP)`, false, 'heal');
          }
        } else {
          // Rock Head: способность полностью снимает отдачу от своих атак.
          const rhAbil = String(abilityOf(S.activePlayerMon, false) || '')
            .toLowerCase().replace(/[^a-z0-9]/g, '');
          if (rhAbil !== 'rockhead') {
            const rd = calcRecoilDamage(hitDmg, move.meta.drain);
            S.activePlayerMon.currentHp -= rd;
            if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
            updatePlayerHpUI();
          }
        }
      }

      // Life Orb per hit
      if (S.activePlayerMon.heldItem === 'lifeOrb' && power) {
        S.activePlayerMon.currentHp -= Math.max(1, Math.floor(S.activePlayerMon.maxHp / 10));
        if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
        updatePlayerHpUI();
      }

      // Secondary status per hit (подавляется Sheer Force)
      if (S.wildCurHP > 0 && !playerSheerForce && move.meta?.ailment && move.meta.ailment.name !== 'none' && move.meta.ailment.name !== 'unknown') {
        // ПРОХОД-741: волатильные (confusion/...) — не в .status, а в mon.vol
        const vAil = move.meta.ailment.name;
        if (['confusion', 'infatuation', 'yawn', 'perish-song', 'torment', 'disable', 'trap', 'ingrain'].includes(vAil)) {
          const ok = vAil === 'confusion'
            ? Math.random() * 100 < confuseChance(move.name) * playerSereneGrace
            : true;
          if (ok && !isStatusImmune(vAil, S.activeWild)) {
            applyVolatileAilment(S.activeWild, true, vAil, S.activePlayerMon.nickname || S.activePlayerMon.apiData.name, S.lastWildMove, S.activePlayerMon.heldItem);
          }
        } else {
        // ailment_chance === 0 — валидное значение («эффект есть, но шанс 0»), поэтому ?? а не ||
        const chance = Math.min(100, (move.meta.ailment_chance ?? 0) * playerSereneGrace);
        if (Math.random() * 100 < chance) {
          const sm = { 'poison': 'psn', 'badly-poison': 'tox', 'burn': 'brn', 'paralysis': 'par', 'sleep': 'slp', 'freeze': 'frz' };
          const ts = sm[move.meta.ailment.name];
          if (ts && !S.wildStatus && !isStatusImmune(move.meta.ailment.name, S.activeWild)) {
            if (applyStatusEffect(S.activeWild, ts)) {
              S.wildStatus = S.activeWild.status;
              document.getElementById('wild-status-icon').innerText = getStatusIcon(S.wildStatus);
              appendToLog(`Дикий ${S.activeWild.name} получил ${STATUS_NAMES[ts]}!`);
            }
          }
        }
        } // конец else обычных статусов (волатильные — выше)
      }

      // Static / Flame Body / Poison Point per physical hit
      const wcAbil = S.activeWild.abilities?.[0]?.ability?.name;
      if (power && isPhysical && ['static', 'flame-body', 'poison-point'].includes(wcAbil)) {
        const sm2 = { 'static': 'par', 'flame-body': 'brn', 'poison-point': 'psn' };
        if (!S.activePlayerMon.status && Math.random() < 0.3) {
          const st = sm2[wcAbil];
          const an = { 'par': 'paralysis', 'brn': 'burn', 'psn': 'poison' }[st];
          if (an && !isStatusImmune(an, S.activePlayerMon) && applyStatusEffect(S.activePlayerMon, st)) {
            document.getElementById('player-status-icon').innerText = getStatusIcon(st);
            appendToLog(`${S.activePlayerMon.apiData.name} получил ${STATUS_NAMES[st]} от способности ${S.activeWild.name}!`);
          }
        }
      }

      // Effect Spore: 30% шанс наложить случайный статус на атакующего.
      if (power && isPhysical && wcAbil === 'effect-spore'
        && !S.activePlayerMon.status && Math.random() < 0.3) {
        const pool = ['par', 'psn', 'slp'];
        const st = pool[Math.floor(Math.random() * pool.length)];
        const an = { par: 'paralysis', psn: 'poison', slp: 'sleep' }[st];
        if (!isStatusImmune(an, S.activePlayerMon) && applyStatusEffect(S.activePlayerMon, st)) {
          document.getElementById('player-status-icon').innerText = getStatusIcon(st);
          appendToLog(`${S.activePlayerMon.apiData.name} получил ${STATUS_NAMES[st]} от спор ${S.activeWild.name}!`);
        }
      }

      // Cute Charm: 30% шанс понизить атаку атакующего при контакте.
      if (power && isPhysical && wcAbil === 'cute-charm' && Math.random() < 0.3) {
        statStageModify(S.activePlayerMon, 'atk', -1, true);
        appendToLog(`${S.activeWild.name} очаровывает ${S.activePlayerMon.apiData.name}! Атака снижена.`);
      }

      // Mummy: при контакте способность атакующего заменяется на Мумию.
      if (power && isPhysical && wcAbil === 'mummy') {
        const atkAbilNow = abilityOf(S.activePlayerMon, false);
        if (atkAbilNow && atkAbilNow !== 'mummy') {
          setBattleAbility(S.activePlayerMon, false, 'mummy');
          updateAbilityDisplay();
          appendToLog(`${S.activePlayerMon.apiData.name} теряет способность ${getAbilityNameRu(atkAbilNow)} — теперь Мумия!`, false, 'system');
        }
      }

      // Rough Skin / Iron Barbs per physical hit
      if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(wcAbil)) {
        const recoil = Math.max(1, Math.floor(hitDmg / 8));
        S.activePlayerMon.currentHp -= recoil;
        if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
        updatePlayerHpUI();
      }

      // Sticky Barb: при контакте переползает на бьющего (если руки пустые)
      if (power && isPhysical && S.activeWild.heldItem === 'stickyBarb') {
        if (!S.activePlayerMon.heldItem) {
          S.activeWild.heldItem = null;
          S.activePlayerMon.heldItem = 'stickyBarb';
          appendToLog(`Липкий шип переполз на ${S.activePlayerMon.apiData.name}!`, false, 'system');
        }
      }

      // Stat changes per hit (with stat_chance probability, подавляется Sheer Force)
      if (S.wildCurHP > 0 && !playerSheerForce && move.stat_changes && move.stat_changes.length > 0) {
        const scChance = Math.min(100, (move.meta?.stat_chance ?? 100) * playerSereneGrace);
        if (Math.random() * 100 < scChance) {
          const tm = { 'user': S.activePlayerMon, 'selected-pokemon': S.activeWild, 'all-opponents': S.activeWild, 'all-other-pokemon': S.activeWild };
          const mt = move.target?.name || 'selected-pokemon';
          const am = tm[mt] || S.activeWild;
          const mn = am === S.activePlayerMon ? S.activePlayerMon.apiData.name : S.activeWild.name;
          const snm = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
          move.stat_changes.forEach(sc => {
            const sk = snm[sc.stat.name];
            if (sk) {
              const os = am.statStages[sk] || 0;
              const nv = Math.max(-6, Math.min(6, os + sc.change));
              if (nv !== os) {
                statStageModify(am, sk, sc.change, am !== S.activePlayerMon);
                const sign = nv >= 0 ? '+' : '';
                const dir = sc.change > 0 ? 'повышена' : 'понижена';
                const lbl = { atk: 'Атака', def: 'Защита', spa: 'Сп. Атака', spd: 'Сп. Защита', spe: 'Скорость' };
                appendToLog(`${lbl[sk] || sk} ${mn} ${dir} (${sign}${nv})`, false, 'system');
              }
            }
          });
        }
      }

      // Flinch per hit (подавляется Sheer Force)
      if (S.wildCurHP > 0 && !playerSheerForce && move.meta?.flinch_chance
        && Math.random() * 100 < Math.min(100, move.meta.flinch_chance * playerSereneGrace)) {
        S.activeWild.flinch = true;
      }
    }

    // ─── AFTER ALL HITS ───
    // Focus Sash (survive with 1 HP if was at full)
    if (S.activeWild.heldItem === 'focusSash' && preWildHP === S.wildMaxHP && totalDmg >= preWildHP && S.wildCurHP <= 0) {
      S.wildCurHP = 1;
      appendToLog(`${S.activeWild.name} держится благодаря Фокусному поясу!`);
      S.activeWild.heldItem = null;
    }

    // Sturdy check
    const wildAbil = S.activeWild.abilities?.[0]?.ability?.name;
    if (checkSturdy(wildAbil, preWildHP, S.wildMaxHP, S.wildCurHP)) {
      S.wildCurHP = 1;
      appendToLog(`${S.activeWild.name} выдерживает удар благодаря Прочной Броне!`);
    }

    // ── ПРОХОД-741: Endure — выдержанный добивающий удар оставляет 1 HP ──
  {
    const endured = monVol(S.activePlayerMon).endure;
    if (endured) {
      const cur = S.wildCurHP;
      S.wildCurHP = 1;
      updateWildHpUI();
      delete monVol(S.activePlayerMon).endure;
      appendToLog(`${S.activePlayerMon.apiData.name} выдерживает удар! (1 HP)`, false, 'system');
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
      return;
    }
  }

  // False Swipe — не добивает: оставляет противнику ровно 1 HP.
    // Было два бага сразу: добивающий удар обнулял HP раньше этой проверки
    // (она видела только HP > 0 — и False Swipe убивал), а слабый удар
    // наоборот сбрасывал HP до 1, хотя должен был оставить как есть.
    if (move.name === 'false-swipe' || move.name === 'falseswipe') {
      const clamped = falseSwipeClamp(preWildHP, S.wildCurHP);
      if (clamped !== S.wildCurHP) {
        S.wildCurHP = clamped;
        appendToLog(`Ложный Удар оставляет ${S.activeWild.name} 1 HP!`, false, 'system');
        updateWildHpUI();
      }
    }

    // Knock Off игрока — сбивает предмет дикого (канон: ×1.5 уже учтены выше).
    // Раньше атака вообще не была реализована: била как обычная, предмет оставался.
    if (move.name === 'knock-off' || move.name === 'knockoff') {
      if (S.activeWild?.heldItem) {
        appendToLog(`${S.activeWild.name} лишается предмета!`, false, 'system');
        S.activeWild.heldItem = null;
      }
    }

    updateWildHpUI();

    // Итог по многоударной атаке. Для одиночного удара строка уже напечатана
    // в цикле — дублировать не нужно.
    if (numHits > 1) {
      appendToLog(`Попал ${hitsLanded} раз(а), всего ${totalDmg} урона!`, false, 'dmg');
    }

    // Berry auto-use after all hits
    if (S.wildCurHP > 0) checkBerryAutoUse(S.activeWild, false);

    // L2-остаток: запоминаем входящий дикому — для Counter/Mirror Coat/
    // Metal Burst и накопления Bide следующим ходом.
    S.lastTakenByWild = { dmg: totalDmg, cat: move.damage_class?.name || null, round: S.battleRound };
    // Проход-741: флаг прямого урона (для endure)
    S.wildTookHit = totalDmg > 0;
    S.wildTookCat = totalDmg > 0 ? (move.damage_class?.name || null) : S.wildTookCat;
    if (S.activeWild.bide && S.activeWild.bide.turns > 0) {
      S.activeWild.bide.dmg += totalDmg;
    }
    // L2-остаток: hyper-beam и семья — перезарядка, если попали (hitsLanded>0)
    if (hitsLanded > 0 && needsRecharge(move)) {
      S.activePlayerMon.recharging = true;
    }
    // Лазерный прицел — разовый, сгорает после атаки
    if (S.activePlayerMon.laserFocus) S.activePlayerMon.laserFocus = false;
    // Проход-741: счётчик Rage Fist у получившего
    if (hitsLanded > 0) {
      S.activeWild.rageHits = (S.activeWild.rageHits || 0) + 1;
    }
    // Проход-741: Pay Day копит монеты за удары
    if (hitsLanded > 0 && normMoveName(move.name) === 'pay-day') {
      S.activePlayerMon.payDayHits = (S.activePlayerMon.payDayHits || 0) + hitsLanded;
    }
    // Аудит итемов: реакции держащего на входящий удар
    if (hitsLanded > 0 && S.activeWild.heldItem) {
      const held = S.activeWild.heldItem;
      const wnm = `Дикий ${S.activeWild.name}`;
      if (held === 'weaknessPolicy' && getTypeMultiplier(move.type?.name, effTypes(S.activeWild)) > 1) {
        S.activeWild.heldItem = null;
        statStageModify(S.activeWild, 'atk', 2, false);
        statStageModify(S.activeWild, 'spa', 2, false);
        appendToLog(`${wnm} съедает Weakness Policy: атака +2!`, false, 'system');
      } else if (held === 'cellBattery' && move.type?.name === 'electric') {
        S.activeWild.heldItem = null;
        statStageModify(S.activeWild, 'spa', 1, false);
        appendToLog(`${wnm} заряжается Cell Battery: сп. атака +1!`, false, 'system');
      } else if (held === 'luminousMoss' && move.type?.name === 'water') {
        S.activeWild.heldItem = null;
        statStageModify(S.activeWild, 'spd', 1, false);
        appendToLog(`${wnm} впитывает Luminous Moss: сп. защита +1!`, false, 'system');
      } else if (held === 'snowball' && move.type?.name === 'ice') {
        S.activeWild.heldItem = null;
        statStageModify(S.activeWild, 'atk', 1, false);
        appendToLog(`${wnm} лепит Snowball: атака +1!`, false, 'system');
      } else if (held === 'throatSpray' && SOUND_MOVES.has(normMoveName(move.name))) {
        S.activeWild.heldItem = null;
        statStageModify(S.activeWild, 'spa', 1, false);
        appendToLog(`${wnm} пьёт Throat Spray: сп. атака +1!`, false, 'system');
      } else if (held === 'destinyKnot') {
        monVol(S.activePlayerMon).attract = true;
        appendToLog(`${S.activePlayerMon.apiData.name} влюбляется в ${S.activeWild.name}!`, false, 'system');
      }
    }
    // Аудит итемов/атак: Fake Out / First Impression дрогают цель
    if (hitsLanded > 0 && (normMoveName(move.name) === 'fake-out' || normMoveName(move.name) === 'first-impression') && S.wildCurHP > 0) {
      S.activeWild.flinch = true;
      appendToLog(`Дикий ${S.activeWild.name} дрогнул!`, false, 'system');
    }
    // Проход-741: jaw-lock / anchor-shot / thunder-cage держат цель
    if (hitsLanded > 0 && ['jaw-lock', 'anchor-shot', 'thunder-cage'].includes(normMoveName(move.name)) && S.wildCurHP > 0) {
      S.activeWild.trapped = true;
      if (normMoveName(move.name) === 'jaw-lock') S.activePlayerMon.trapped = true;
      appendToLog(`Дикий ${S.activeWild.name} не может уйти!`, false, 'system');
    }
    // Проход-741: Clear Smog сносит все усиления цели
    if (hitsLanded > 0 && normMoveName(move.name) === 'clear-smog' && S.wildCurHP > 0) {
      S.activeWild.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      updateStatBadges();
      appendToLog(`Чистый дым сносит усиления дикого ${S.activeWild.name}!`, false, 'system');
    }
    // Аудит итемов: King's Rock / Razor Fang — 10% флинч при уроне
    if (hitsLanded > 0 && (S.activePlayerMon.heldItem === 'kingsRock' || S.activePlayerMon.heldItem === 'razorFang')
      && S.wildCurHP > 0 && Math.random() < 0.1) {
      S.activeWild.flinch = true;
      appendToLog(`Дикий ${S.activeWild.name} дрогнул!`, false, 'system');
    }
    // Аудит итемов: Shell Bell — 1/8 нанесённого себе
    if (hitsLanded > 0 && S.activePlayerMon.heldItem === 'shellBell' && totalDmg > 0
      && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
      const heal = Math.max(1, Math.floor(totalDmg / 8));
      S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
      updatePlayerHpUI();
      appendToLog(`Колокольчик лечит ${S.activePlayerMon.apiData.name}! (+${heal} HP)`, false, 'heal');
    }
    // Аудит итемов: ворующие/ломающие атаки после попадания
    if (hitsLanded > 0) {
      const stealSlug = normMoveName(move.name);
      // Thief/Covet: забрать предмет, если у самого пусто
      if ((stealSlug === 'thief' || stealSlug === 'covet') && S.activeWild.heldItem && !S.activePlayerMon.heldItem) {
        S.activePlayerMon.heldItem = S.activeWild.heldItem;
        S.activeWild.heldItem = null;
        updateAbilityDisplay();
        appendToLog(`${S.activePlayerMon.apiData.name} крадёт ${S.activePlayerMon.heldItem}!`, false, 'system');
      }
      // Pluck/Bug Bite: склевать ягоду + 25% себе. Incinerate: сжечь ягоду.
      if ((stealSlug === 'pluck' || stealSlug === 'bug-bite' || stealSlug === 'incinerate')
        && S.activeWild.heldItem && itemCategory(S.activeWild.heldItem) === 'berries') {
        const berry = S.activeWild.heldItem;
        S.activeWild.heldItem = null;
        if (stealSlug === 'incinerate') {
          appendToLog(`Ягода ${berry} сгорела!`, false, 'system');
        } else {
          const heal = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 4));
          S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
          updatePlayerHpUI();
          appendToLog(`${S.activePlayerMon.apiData.name} склевал ${berry}! (+${heal} HP)`, false, 'heal');
        }
      }
    }
    // Проход-741: расходники удара (fling/natural-gift) сгорают при попадании
    if (hitsLanded > 0 && S.activePlayerMon.consumeHeldAfterHit) {
      const spent = S.activePlayerMon.consumeHeldAfterHit;
      S.activePlayerMon.heldItem = null;
      S.activePlayerMon.consumeHeldAfterHit = null;
      appendToLog(`${S.activePlayerMon.apiData.name} израсходовал ${spent}!`, false, 'system');
    }
    // Проход-741: spit-up сжигает заряды stockpile
    if (hitsLanded > 0 && normMoveName(move.name) === 'spit-up') {
      S.activePlayerMon.stock = 0;
    }
    // Проход-741: final-gambit — сам падает после удара
    if (hitsLanded > 0 && normMoveName(move.name) === 'final-gambit' && S.activePlayerMon.currentHp > 0) {
      S.activePlayerMon.currentHp = 0;
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} жертвует собой!`, false, 'system');
    }
  }

  document.getElementById('battle-main-menu').style.display = 'none';

  // По решению из спецификации при одновременной смерти побеждает игрок:
  // сначала проверяем wild faint, потом player. Иначе клетка, где игрок
  // убивает дикого в тот же ход, в котором умирает сам (Rough Skin, отдача
  // Life Orb), засчитывается как поражение.
  if (S.wildCurHP === 0) {
    // Проход-741: endure/destiny дикого
    if (guardFaintWild()) {
      // Выдержал — бой продолжается
    } else {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
  }

  if (S.activePlayerMon.currentHp <= 0) {
    // Проход-741: endure/destiny игрока
    if (!guardFaintPlayer()) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      // Фикс: destiny могла обнулить дикого — обрабатываем и его
      if (S.wildCurHP <= 0) {
        if (guardFaintWild()) { /* выдержал */ }
        else {
          await handleWildFaintRewards(S.battleType === 'wild');
          return;
        }
      }
      return;
    }
  }

  // ═══ УРОН СТАТУСОВ ИГРОКА — СРАЗУ ПОСЛЕ ЕГО ДЕЙСТВИЯ ═══
  // По спецификации яд/ожог/токсин и Семя Ужаса срабатывают сразу после
  // действия владельца, а не в конце раунда. Раньше этот блок стоял в конце
  // хода ВРАГА: если враг был медленнее и не успевал сходить, статус игрока
  // не тикал вообще, а при пропуске хода — тикал дважды.
  applyStatusEndOfTurn(S.activePlayerMon, true);
  if (S.activePlayerMon.currentHp > 0) applyLeechSeedTick(true);
  // Способности конца хода — тот же набор, что и у противника.
  if (S.activePlayerMon.currentHp > 0) applyEndTurnAbilities(S.activePlayerMon, false);
  if (S.activePlayerMon.currentHp <= 0) {
    appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
    return;
  }

  endTurn();
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 13: ОБРАБОТКА FAINT (ПОТЕРЯ СОЗНАНИЯ)
// ═══════════════════════════════════════════════════════════════
// handlePlayerFaint — когда покемон игрока теряет сознание.
//   Если есть живой запасной — автоматически заменяет.
//   Если нет — поражение.
// showPlayerMenu — показать меню боя и перевести фазу.
// ─────────────────────────────────────────────────────────────

/**
 * handlePlayerFaint — обработка потери сознания покемоном игрока.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Ищет живого покемона в команде (кроме текущего)
 *   2. Если нашёл — автоматически заменяет активного, обновляет UI, загружает атаки
 *   3. Если не нашёл — ПОРАЖЕНИЕ:
 *       - Для gym: сбрасывает прогресс гима
 *       - Показывает battle-end-menu с сообщением о поражении
 *       - Очищает сохранение боя
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   useMove() — если игрок получил урон и HP ≤ 0
 *   enemyTurn() — если враг нанёс урон и HP ≤ 0
 *   checkStatusTurn — если урон от статуса добил игрока
 */
function handlePlayerFaint() {
  const isGym = S.battleType !== 'wild'; // Gym/elite/champion не позволяют убежать
  const nextMon = GS.myTeam.find(m => m.currentHp > 0 && m !== S.activePlayerMon);
  if (nextMon) {
    // ── Есть живой запасной ──
    S.activePlayerMon = nextMon;
    S.activePlayerMon.choiceLockedMove = undefined; // Сбрасываем Choice-блокировку
    // Проход-741: healing-wish/lunar-dance — входящий исцеляется полностью
    if (S.pendingHeal) {
      const full = S.pendingHeal === 'fullpp';
      S.activePlayerMon.currentHp = S.activePlayerMon.maxHp;
      S.activePlayerMon.status = null;
      S.activePlayerMon.sleepTurns = 0;
      if (full && Array.isArray(S.activePlayerMon.movesPP)) {
        S.activePlayerMon.movesPP = S.activePlayerMon.movesPP.map((pp: any) => pp ? { current: pp.max, max: pp.max } : pp);
      }
      S.pendingHeal = null;
      appendToLog(`Желание исполнено: ${S.activePlayerMon.nickname || S.activePlayerMon.apiData.name} полностью здоров!`, false, 'heal');
    }
    // Способности выхода на поле у нового покемона (Download, Trace, Frisk).
    applySwitchInAbilities(S.activePlayerMon, false, S.activeWild);
    S.playerChargedMove = null; // Заряд атаки утерян при смене покемона
    appendToLog(`${S.activePlayerMon.apiData.name}, вперёд!`);
    // Обновляем UI
    document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
    (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
    updatePlayerHpUI();
    updateAbilityDisplay();
    loadMoveButtons(S.activePlayerMon, useMove);              // Загружаем атаки нового покемона
    saveBattleState();
    // Жалоба 1: фаза застревала в ENEMY_TURN после авто-замены — атаки
    // работали (re-entry), а предмет/смена/побег требовали строго PLAYER_TURN
    // и отвечали «Подождите... идёт ход противника». Возвращаем ход игроку
    // сразу (переход ENEMY_TURN→PLAYER_TURN разрешён картой), меню — по таймеру.
    ensurePlayerTurnAfterFaint(battle);
    setTimeout(() => {
      // Гонка: пока шёл таймер, дикий мог упасть (яд/ожог/отдача) и бой уже
      // закрыт (end-menu, фаза IDLE/VICTORY/DEFEAT). Без гарда меню показывалось
      // поверх экрана конца боя, а клики упирались в «Подождите...».
      const endOpen = document.getElementById('battle-end-menu')?.style.display === 'flex';
      const ph = battle.phase;
      if (!endOpen && S.wildCurHP > 0
        && ph !== BattlePhase.IDLE && ph !== BattlePhase.VICTORY && ph !== BattlePhase.DEFEAT) {
        document.getElementById('battle-main-menu').style.display = 'flex';
      }
    }, 1000); // Показываем меню
    store.autoSave();
  } else {
    // ── ВСЯ КОМАНДА В НОКАУТЕ — ПОРАЖЕНИЕ ──
    // Стрик диких побед сгорает (для streak-квестов)
    if (S.battleType === 'wild' && (state.questStreak || 0) > 0) {
      state.questStreak = 0;
      trackNPCQuests('streak_x', { streak: 0 });
    }
    appendToLog(isGym ? 'Вся команда потеряла сознание... Вы проиграли лидеру.' : 'Вся команда потеряла сознание... Вы проиграли.');
    if (isGym) {
      // Сбрасываем прогресс гима
      S.gymTeamIndex = 0;
      S.gymTeamIndexInMember = 0;
      S.gymTeamData = null;
      S.battleType = 'wild';
    }
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex'; // Экран "Поражение"
    // Доводим фазу до IDLE — иначе следующий бой начинался из фазы, переход
    // из которой в WILD_START/GYM_START не разрешён.
    battle.transition(BattlePhase.DEFEAT);
    battle.transition(BattlePhase.IDLE);
    clearBattleState();                                             // Удаляем сохранение
    store.autoSave();
  }
}

/**
 * showPlayerMenu — показать меню действий игрока (атаки/предмет/смена/бегство).
 * Переводит фазу боя в PLAYER_TURN через battle.transition().
 * Вызывается когда наступает ход игрока.
 */
function showPlayerMenu() {
  document.getElementById('battle-main-menu').style.display = 'flex';
  battle.transition(BattlePhase.PLAYER_TURN);
}

/**
 * showPlayerMenuAfterDelay — отдать ход игроку с той же задержкой, с какой раньше
 * показывалось меню.
 *
 * Задержка нужна, чтобы игрок успел увидеть результат хода противника в логе и на
 * спрайтах. Раньше эти места делали `setTimeout(() => battle-main-menu... = 'flex')`
 * напрямую и забывали про фазу: бой оставался в ENEMY_TURN, а useMove()
 * проверяет canTransition и отвечает «Подождите... битва ещё не готова». Меню при
 * этом было видно и нажималось, поэтому выглядело как зависание боя на атаках —
 * ровно то, что было описано.
 *
 * Через showPlayerMenu() фаза всегда возвращается в PLAYER_TURN.
 */
function showPlayerMenuAfterDelay(ms = 1000) {
  setTimeout(() => {
    // Если бой закончился (победа/поражение) или уже показан экран конца боя,
    // фазу трогать нельзя: PLAYER_TURN из VICTORY/DEFEAT не разрешён, и
    // transition() вернёт false с предупреждением в консоль.
    const phase = battle.phase;
    if (phase === BattlePhase.VICTORY || phase === BattlePhase.DEFEAT || phase === BattlePhase.IDLE) return;
    showPlayerMenu();
  }, ms);
}

/**
 * recoverBattleMenu — страховка от залипшей фазы ENEMY_TURN.
 *
 * ЗОВЁТСЯ ТОЛЬКО ИЗ catch-ВЕТОК хода врага (enemyTurn, endTurn в useMove).
 * Если исключение прилетело после transition(ENEMY_TURN), но до возврата меню,
 * фаза остаётся ENEMY_TURN навсегда и все кнопки (побег/смена/предмет/атаки)
 * вечно отвечают «Подождите...». Здесь возвращаем ход игроку через тот же
 * showPlayerMenuAfterDelay (с задержкой, как в штатном потоке).
 *
 * Меню показываем только если фаза РЕАЛЬНО сменилась ENEMY_TURN → PLAYER_TURN:
 * иначе задваиваем таймеры показа меню на штатном пути.
 */
function recoverBattleMenu(source: string) {
  if (!S.activePlayerMon || S.activePlayerMon.currentHp <= 0 || S.wildCurHP <= 0) return;
  const before = battle.phase;
  if (before === BattlePhase.VICTORY || before === BattlePhase.DEFEAT || before === BattlePhase.IDLE) return;
  if (recoverStuckTurn(battle) && battle.phase !== before) {
    console.warn(`[battle] recoverBattleMenu (${source}): фаза ${before} → ${battle.phase}`);
    try { saveBattleState(); } catch (_) {}
    showPlayerMenuAfterDelay();
  }
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 14: ХОД ПРОТИВНИКА (enemyTurn)
// ═══════════════════════════════════════════════════════════════
// enemyTurn — полный ход AI противника. Зеркально useMove().
//
// ПОТОК:
//   1. Урон от статуса в конце хода (яд/ожог дикого)
//   2. Проверка статуса (сон/паралич/заморозка)
//   3. AI выбор атаки (selectEnemyMove из ai.ts)
//   4. Accuracy check
//   5. Статус-атака → handleEnemyStatusEffects
//   6. Protect check у игрока
//   7. Расчёт урона через calculateDamage
//   8. Focus Sash, Substitute, Rocky Helmet, Life Orb, Rough Skin
//   9. Уменьшение ходов барьеров (Reflect, Light Screen)
//  10. Berry auto-use (Sitrus/Oran/Lum)
//  11. Leftovers healing
//  12. Проверка fainted → handlePlayerFaint / handleWildFaintRewards
//  13. Переход к ходу игрока (showPlayerMenu)
// ─────────────────────────────────────────────────────────────

/**
 * enemyTurn — выполнить ход противника (AI).
 *
 * ЧТО ДЕЛАЕТ:
 *   Сначала применяет урон от статуса к дикому (яд/ожог).
 *   Затем проверяет может ли враг действовать (сон/паралич/заморозка).
 *   Использует selectEnemyMove для выбора атаки.
 *   Наносит урон игроку с учётом всех модификаторов.
 *   После хода: уменьшает барьеры, проверяет ягоды, Leftovers.
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   useMove() — после атаки игрока (если враг жив)
 *   switchPokemon() — после смены покемона
 *   initEncounterEvents() — при попытке побега (неудачно)
 *   capture (пойман) — враг вырвался
 */
/**
 * Тик длительностей эффектов в конце хода противника.
 *
 * Раньше декремент стоял в самом конце enemyTurn(), до которого не доходили ранние
 * `return` (сон/паралич/флинч/заряд/промах/статус-атака/Protect/HP<=0). Из-за этого
 * Reflect/Light Screen игрока накапливались бесконечно, а enemyReflectTurns и
 * enemyLightScreenTurns вообще не декрементировались.
 */
function tickEnemyTurnDurations() {
  if (S.playerReflectTurns > 0) {
    S.playerReflectTurns--;
    if (S.playerReflectTurns === 0) appendToLog('Reflect исчез!', false, 'system');
  }
  if (S.playerLightScreenTurns > 0) {
    S.playerLightScreenTurns--;
    if (S.playerLightScreenTurns === 0) appendToLog('Light Screen исчез!', false, 'system');
  }
  // Барьеры и щиты противника раньше не гасились никогда — держались до конца боя.
  if (S.enemyReflectTurns > 0) {
    S.enemyReflectTurns--;
    if (S.enemyReflectTurns === 0) appendToLog('Reflect противника исчез!', false, 'system');
  }
  if (S.enemyLightScreenTurns > 0) {
    S.enemyLightScreenTurns--;
    if (S.enemyLightScreenTurns === 0) appendToLog('Light Screen противника исчез!', false, 'system');
  }
  S.protectActive = false; // Protect действует один ход
  // Счётчик последовательных попыток сбрасывается каждый раз, когда Protect
  // отработал свой ход — иначе он помнил бы попытки с прошлых раундов.
  S.protectCounter = 0;
}

async function enemyTurn() {
  battle.transition(BattlePhase.ENEMY_TURN);
  // Тик длительностей вынесен в finally: ход противника считается потраченным
  // на любом выходе, включая ранние return внутри тела хода.
  try {
    await runEnemyTurnBody();
  } catch (e) {
    // Без этого catch любое исключение в ходе врага (null-доступ к модалке,
    // битый activeWild, ошибка AI/урона) оставляло фазу в ENEMY_TURN навсегда:
    // showPlayerMenuAfterDelay() недостижим, и все кнопки боя — включая побег —
    // вечно отвечают «Подождите...». См. recoverBattleMenu.
    console.error('[battle] enemyTurn failed:', e);
    recoverBattleMenu('enemyTurn');
  } finally {
    tickEnemyTurnDurations();
  }
}

/**
 * finishEnemyTurn — завершение хода противника.
 *
 * ЧТО ДЕЛАЕТ (по порядку):
 *   1. Урон от статусов врага (яд/ожог/токсин) — сразу после его действия
 *   2. Ягоды врага, Семя Ужаса на враге, погодный чип
 *   3. Если враг погиб — награды и выход
 *   4. Погодный чип и ягоды игрока, проверка нокаута игрока
 *   5. Объедки обеих сторон
 *   6. Сохранение боя и возврат меню игроку (фаза PLAYER_TURN)
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ ФУНКЦИЯ:
 *   Раньше каждая ветка хода врага (сон, флинч, заряд, промах, статус-атака,
 *   Protect) сама вызывала showPlayerMenuAfterDelay(), но БЕЗ return. Выполнение
 *   продолжалось дальше — враг атаковал, будучи спящим, а меню показывалось по
 *   таймеру поверх незавершённого хода. Теперь один выход на все случаи, и
 *   каждая ветка обязана сделать `await finishEnemyTurn(); return;`.
 *
 * ПОРЯДОК СТАТУСОВ (решение из спецификации):
 *   Урон статусов и Семя Ужаса срабатывают сразу после действия владельца, а не
 *   в конце раунда. Поэтому статус врага тикает здесь (после его хода), а статус
 *   игрока — в useMove() после хода игрока.
 */
/**
 * applyEndTurnAbilities — способности, срабатывающие в конце хода владельца.
 *
 * ВЫЗЫВАЕТСЯ:
 *   finishEnemyTurn()  — для дикого противника
 *   хвост useMove()    — для покемона игрока
 *
 * ЧТО ДЕЛАЕТ:
 *   Speed Boost — повышает свою скорость на одну ступень
 *   Ice Body    — в град восстанавливает 1/16 максимального HP
 *   Hydration   — под дождём снимает свой статус
 *   Shed Skin   — треть шанс снять свой статус
 *
 * Rain Dish (лечение под дождём) обрабатывается там же, где погодный чип —
 * см. applyWeatherChip. Poison Heal меняет урон от яда на лечение —
 * см. applyStatusEndOfTurn.
 */
function applyEndTurnAbilities(mon, isWild) {
  if (!mon) return;
  // Slow Start отсчитывает ходы независимо от того, есть ли у покемона другие
  // способности конца хода: счётчик нужен для спада эффекта через 5 ходов.
  if (typeof mon.slowStartTurns === 'number' && mon.slowStartTurns < 5) {
    mon.slowStartTurns += 1;
    if (mon.slowStartTurns === 5) {
      appendToLog(`${mon.apiData?.name || mon.name || 'Покемон'}: Медленный старт закончился, статы вернулись в норму.`, false, 'system');
    }
  }
  const ability = abilityOf(mon, isWild);
  if (!ability) return;
  const name = String(ability).toLowerCase().replace(/[^a-z0-9-]/g, '');
  const label = mon.apiData?.name || mon.name || 'Покемон';

  if (name === 'speed-boost') {
    const before = mon.statStages?.spe || 0;
    if (before < 6) {
      statStageModify(mon, 'spe', 1);
      appendToLog(`${label}: Ускорение повышает скорость!`, false, 'system');
    }
  }

  if (name === 'ice-body' && S.currentWeather === 'hail') {
    const maxHp = isWild ? S.wildMaxHP : mon.maxHp;
    const cur = isWild ? S.wildCurHP : mon.currentHp;
    if (cur > 0 && cur < maxHp) {
      const heal = Math.max(1, Math.floor(maxHp / 16));
      if (isWild) { S.wildCurHP = Math.min(maxHp, S.wildCurHP + heal); updateWildHpUI(); }
      else { mon.currentHp = Math.min(maxHp, mon.currentHp + heal); updatePlayerHpUI(); }
      appendToLog(`${label} восстанавливает HP от Ледяного тела! (+${heal})`, false, 'heal');
    }
  }

  if (name === 'hydration' && S.currentWeather === 'rain' && mon.status) {
    const had = mon.status;
    cureStatus(mon);
    if (isWild) S.wildStatus = null;
    else document.getElementById('player-status-icon').innerText = '';
    appendToLog(`${label}: Увлажнение снимает статус (${STATUS_NAMES[had]})!`, false, 'heal');
  }

  if (name === 'shed-skin' && mon.status && Math.random() < 0.33) {
    const had = mon.status;
    cureStatus(mon);
    if (isWild) S.wildStatus = null;
    else document.getElementById('player-status-icon').innerText = '';
    appendToLog(`${label}: Линька снимает статус (${STATUS_NAMES[had]})!`, false, 'heal');
  }
}

async function finishEnemyTurn() {
  // ── Сразу после действия врага ──
  if (S.wildCurHP > 0) {
    applyStatusEndOfTurn(S.activeWild, false);
    if (S.wildCurHP > 0) checkBerryAutoUse(S.activeWild, false);
    if (S.wildCurHP > 0) applyLeechSeedTick(false);
    if (S.wildCurHP > 0) applyWeatherChip(S.activeWild, S.wildMaxHP, false);
    // Способности конца хода (Speed Boost, Ice Body, Hydration, Shed Skin)
    if (S.wildCurHP > 0) applyEndTurnAbilities(S.activeWild, true);
  }
  if (S.wildCurHP <= 0) {
    await handleWildFaintRewards(S.battleType === 'wild');
    return;
  }

  // ── Сторона игрока ──
  if (S.activePlayerMon.currentHp > 0) {
    applyWeatherChip(S.activePlayerMon, S.activePlayerMon.maxHp, true);
  }
  if (S.activePlayerMon.currentHp > 0) checkBerryAutoUse(S.activePlayerMon, true);

  if (S.activePlayerMon.currentHp === 0) {
    appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
    return;
  }

  S.battleRound++;

// Проход-741: часы поля тикают раз в раунд (погода/террейн/tailwind/
// trick-room истекают, трава лечит, соль щиплет).
  // Фикс: тики могли добить — обмороки проверяем ПОСЛЕ ВСЕХ тиков
  // (включая Black Sludge ниже), иначе труп с 0 HP стоит с открытым меню.
  tickFieldEndOfRound();

  // Объедки — пассивное восстановление 1/16 максимального HP
  if (S.activePlayerMon.heldItem === 'leftovers' && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
    const heal = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
    S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
    updatePlayerHpUI();
    appendToLog(`${S.activePlayerMon.apiData.name} восстанавливает HP от Объедков! (+${heal})`);
  }
  if (S.activeWild.heldItem === 'leftovers' && S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
    const heal = Math.max(1, Math.floor(S.wildMaxHP / 16));
    S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
    updateWildHpUI();
    appendToLog(`${S.activeWild.name} восстанавливает HP от Объедков! (+${heal})`);
  }
  // Аудит итемов: Black Sludge — яд лечит 1/16, остальных бьёт 1/8
  {
    const pTypes = (S.activePlayerMon.apiData?.types || []).map((t: any) => t?.type?.name || t);
    if (S.activePlayerMon.heldItem === 'blackSludge' && S.activePlayerMon.currentHp > 0) {
      if (pTypes.includes('poison')) {
        const heal = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
        S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
        updatePlayerHpUI();
        appendToLog(`Чёрный ил лечит ${S.activePlayerMon.apiData.name}! (+${heal} HP)`, false, 'heal');
      } else {
        const chip = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 8));
        S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - chip);
        updatePlayerHpUI();
        appendToLog(`Чёрный ил разъедает ${S.activePlayerMon.apiData.name}! (−${chip} HP)`, false, 'dmg');
      }
    }
    const wTypes = (S.activeWild.apiData?.types || S.activeWild.types || []).map((t: any) => t?.type?.name || t);
    if (S.activeWild.heldItem === 'blackSludge' && S.wildCurHP > 0) {
      if (wTypes.includes('poison')) {
        const heal = Math.max(1, Math.floor(S.wildMaxHP / 16));
        S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
        updateWildHpUI();
        appendToLog(`Чёрный ил лечит дикого ${S.activeWild.name}! (+${heal} HP)`, false, 'heal');
      } else {
        const chip = Math.max(1, Math.floor(S.wildMaxHP / 8));
        S.wildCurHP = Math.max(0, S.wildCurHP - chip);
        updateWildHpUI();
        appendToLog(`Чёрный ил разъедает дикого ${S.activeWild.name}! (−${chip} HP)`, false, 'dmg');
      }
    }
  }
  // Аудит итемов: Flame/Toxic Orb поджигают/травят держателя в конце хода
  if (S.activePlayerMon.heldItem === 'flameOrb' && !S.activePlayerMon.status) {
    S.activePlayerMon.status = 'brn';
    document.getElementById('player-status-icon').innerText = getStatusIcon('brn');
    appendToLog(`${S.activePlayerMon.apiData.name} обжигается сферой!`, false, 'system');
  }
  if (S.activePlayerMon.heldItem === 'toxicOrb' && !S.activePlayerMon.status) {
    S.activePlayerMon.status = 'tox';
    document.getElementById('player-status-icon').innerText = getStatusIcon('tox');
    appendToLog(`${S.activePlayerMon.apiData.name} сильно травится сферой!`, false, 'system');
  }
  if (S.activeWild.heldItem === 'flameOrb' && !S.activeWild.status) {
    S.activeWild.status = 'brn';
    S.wildStatus = 'brn';
    document.getElementById('wild-status-icon').innerText = getStatusIcon('brn');
    appendToLog(`Дикий ${S.activeWild.name} обжигается сферой!`, false, 'system');
  }
  if (S.activeWild.heldItem === 'toxicOrb' && !S.activeWild.status) {
    S.activeWild.status = 'tox';
    S.wildStatus = 'tox';
    document.getElementById('wild-status-icon').innerText = getStatusIcon('tox');
    appendToLog(`Дикий ${S.activeWild.name} сильно травится сферой!`, false, 'system');
  }

  // Фикс: тики конца раунда (проклятие/хватка/соль/ил) могли добить —
  // проверяем обмороки здесь, иначе труп с 0 HP стоит с открытым меню.
  // Порядок как везде: сначала дикий, потом игрок.
  if (S.wildCurHP <= 0) {
    if (guardFaintWild()) {
      // Выдержал (endure) — бой продолжается
    } else {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
  }
  if (S.activePlayerMon.currentHp <= 0) {
    if (!guardFaintPlayer()) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      // Фикс: destiny могла обнулить дикого — обрабатываем и его
      if (S.wildCurHP <= 0) {
        if (guardFaintWild()) { /* выдержал */ }
        else {
          await handleWildFaintRewards(S.battleType === 'wild');
          return;
        }
      }
      return;
    }
  }

  saveBattleState();
  showPlayerMenuAfterDelay();
}

async function runEnemyTurnBody() {
  // Семя поля держателя — до хода
  maybeConsumeTerrainSeed(S.activeWild);
  battle.transition(BattlePhase.ENEMY_TURN);
  // Проход-741: флаги прямого урона свежие каждый ход (для endure)
  S.wildTookHit = false;
  S.playerTookHit = false;
  S.wildTookCat = null;
  S.playerTookCat = null;

  // Урон от статуса и погодный чип врага переехали в finishEnemyTurn():
  // по спецификации они срабатывают ПОСЛЕ его действия, а не в начале хода.
  // В начале хода они означали, что атакующий враг не получал урон вовсе,
  // а получивший статус в этом же раунде — получал его дважды.

  // ═══ 2. ПРОВЕРКА СТАТУСА ═══
  const wildCanAct = checkStatusTurn(S.activeWild, false);
  if (!wildCanAct) {
    await finishEnemyTurn();
    return;
  }

  // ═══ 2b. FLINCH CHECK ═══
  if (S.activeWild.flinch) {
    S.activeWild.flinch = false;
    appendToLog(`${S.activeWild.name} дрогнул и не может атаковать!`, false, 'system');
    await finishEnemyTurn();
    return;
  }

  // ── L2-остаток: перезарядка врага (hyper-beam и семья) ──
  if (S.activeWild.recharging) {
    S.activeWild.recharging = false;
    appendToLog(`${S.activeWild.name} перезаряжается!`, false, 'system');
    await finishEnemyTurn();
    return;
  }

  // ═══ 2d. TRUANT (враг) ═══
  const wildTruant = String(abilityOf(S.activeWild, true) || '')
    .toLowerCase().replace(/[^a-z0-9]/g, '') === 'truant';
  if (wildTruant) {
    if (S.activeWild.truantSkip) {
      S.activeWild.truantSkip = false;
      appendToLog(`${S.activeWild.name} ленится и ничего не делает!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    S.activeWild.truantSkip = true;
  }

  // ── ПРОХОД-741: начало хода врага (perish/yawn/wish) ──
  {
    const vs = volatileStart(S.activeWild, true, {
      get: () => S.wildCurHP,
      set: (v) => { S.wildCurHP = v; },
      max: () => S.wildMaxHP,
      ui: () => updateWildHpUI(),
    });
    if (vs === 'fainted') {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
    if (vs === 'done') {
      await finishEnemyTurn();
      return;
    }
  }

  // ═══ 2c. TWO-TURN MOVE RELEASE ═══
  // Если у врага есть заряженная атака — выпускаем её вместо выбора AI
  const isChargeRelease = !!S.enemyChargedMove;

  // ═══ 3. AI ВЫБОР АТАКИ (или выпуск заряженной) ═══
  let chosenMove, chosenIdx;
  if (isChargeRelease) {
    chosenMove = S.enemyChargedMove;
    S.enemyChargedMove = null; // Очищаем заряд
    chosenIdx = S.wildMovesDetailed.findIndex(m => m && m.name === chosenMove.name);
  } else {
    const aiResult = selectEnemyMove({
      moves: S.wildMovesDetailed,
      movesPP: S.wildMovesPP,
      attacker: S.activeWild,
      defender: S.activePlayerMon,
      isTrainer: S.battleType !== 'wild',
      getTypeMultiplier,
      banned: S.imprisonP, // imprison: запрещённые не предлагать
    });
    chosenMove = aiResult?.move || { power: 30, damage_class: { name: 'physical' }, type: { name: 'normal' }, name: 'Атака' };
    chosenIdx = aiResult?.index ?? -1;
  }
  const isT = S.battleType !== 'wild';
  S.enemyChosenMove = chosenMove; // Сохраняем для Sucker Punch проверки
  let enemyMoveName = chosenMove.name || 'Атака';
  if (!isChargeRelease && chosenIdx >= 0 && S.wildMovesPP && S.wildMovesPP[chosenIdx]) {
    // Pressure у игрока: противник тоже тратит вдвое больше PP.
    const playerPress = String(abilityOf(S.activePlayerMon, false) || '')
      .toLowerCase().replace(/[^a-z0-9]/g, '');
    S.wildMovesPP[chosenIdx].current -= playerPress === 'pressure' ? 2 : 1;
  }

  // ── ПРОХОД-741: волатильные проверки выбранной атаки врага ──
  // Encore/disable/taunt/torment/imprison/confusion/attract. Зеркало игрока.
  {
    const va = volatileAction(S.activeWild, S.activePlayerMon, true, chosenMove, chosenIdx, S.wildMovesDetailed);
    if (va) {
      if (va.forceIndex !== undefined) {
        chosenIdx = va.forceIndex;
        chosenMove = S.wildMovesDetailed[chosenIdx];
      } else if (va.fail) {
        appendToLog(va.fail, false, 'system');
        await finishEnemyTurn();
        return;
      } else if (va.selfHit) {
        const dmg = confusionDamage(
          baseAttackOf(S.activeWild, true),
          baseDefOf(S.activeWild, true),
          S.wildLvl,
        );
        S.wildCurHP = Math.max(0, S.wildCurHP - dmg);
        updateWildHpUI();
        appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} в замешательстве бьёт себя! (−${dmg} HP)`, false, 'dmg');
        if (S.wildCurHP <= 0) {
          await handleWildFaintRewards(S.battleType === 'wild');
          return;
        }
        await finishEnemyTurn();
        return;
      }
    }
  }

  // ── ПРОХОД-741: условия первого хода и ответа (зеркало) ──
  {
    const fslug = normMoveName(chosenMove.name);
    if (fslug === 'focus-punch' && S.wildTookHit) {
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} потерял концентрацию!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    if (fslug === 'shell-trap' && S.wildTookCat !== 'physical') {
      appendToLog(`Ловушка не сработала — физического удара не было!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    if ((fslug === 'fake-out' || fslug === 'first-impression') && (S.activeWild.turnsOut || 1) > 1) {
      appendToLog(`${chosenMove.name} срабатывает только на первом ходу!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
  }

  // ═══ 3b. TWO-TURN MOVE CHARGE ═══
  // Если атака требует зарядки — заряжаем и завершаем ход врага.
  // isChargeMove — та же проверка, что у игрока (симметрия).
  if (!isChargeRelease && (isChargeMove(chosenMove) || normMoveName(chosenMove.name) === 'geomancy')) {
    // Аудит итемов: Power Herb пропускает заряд
    if (S.activeWild.heldItem === 'powerHerb') {
      S.activeWild.heldItem = null;
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} съедает Power Herb — сразу бьёт!`, false, 'system');
    } else {
      S.enemyChargedMove = chosenMove;
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} заряжает ${enemyMoveName}!`);
      await finishEnemyTurn();
      return;
    }
  }

  // ── L2-остаток: Bide врага ──
  // Зеркало игрока: 2 хода терпит, на третий бьёт удвоенным накопленным.
  if (normMoveName(chosenMove.name) === 'bide') {
    const st = S.activeWild.bide || { turns: 0, dmg: 0 };
    if (st.turns <= 0) {
      S.activeWild.bide = { turns: BIDE_TURNS, dmg: 0 };
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} затаился!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    st.turns -= 1;
    if (st.turns > 0) {
      S.activeWild.bide = st;
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} продолжает терпеть...`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    S.activeWild.bide = { turns: 0, dmg: 0 };
    const rel = bideRelease(st.dmg);
    if (rel == null) {
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} терпел зря — бить нечем!`, false, 'system');
      await finishEnemyTurn();
      return;
    }
    S.activePlayerMon.currentHp = Math.max(0, S.activePlayerMon.currentHp - rel);
    updatePlayerHpUI();
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} выпускает накопленное: −${rel} HP!`, false, 'dmg');
    S.lastTakenByPlayer = { dmg: rel, cat: 'physical', round: S.battleRound };
    if (S.activePlayerMon.currentHp <= 0) {
      appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
      handlePlayerFaint();
      return;
    }
    await finishEnemyTurn();
    return;
  }

  // ── L2-остаток: полунеуязвимость врага (fly/dig/dive/...) ──
  // Зеркало игрока: ход 1 — спрятался, ход 2 той же атакой — удар.
  {
    const slug = normMoveName(chosenMove.name);
    if (isSemiInvuln(chosenMove)) {
      if (S.activeWild.hiddenIn === slug) {
        S.activeWild.hiddenIn = null;
      } else {
        S.activeWild.hiddenIn = slug;
        appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} ${hideVerb(slug)}`, false, 'system');
        await finishEnemyTurn();
        return;
      }
    } else if (S.activeWild.hiddenIn) {
      S.activeWild.hiddenIn = null;
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} выходит из укрытия!`, false, 'system');
    }
  }

  // ── L2-остаток: вес/скорость-атаки врага ──
  // В данных у них power=null — без подстановки падали в «ничего не произошло».
  {
    const eff = effectivePowerMove(chosenMove, S.activeWild, S.activePlayerMon,
      getEffectiveSpeed(S.activeWild, true), getEffectiveSpeed(S.activePlayerMon, false), true);
    if (eff !== chosenMove) {
      chosenMove = eff;
    }
  }

  // ── ПРОХОД-741: гиммики врага (зеркало игрока) ──
  // metronome/copycat/sleep-talk/mirror-move/nature-power/me-first/
  // transform/sketch/roar/teleport/fling/natural-gift/present/
  // last-respects/rage-fist. У дикого нет команды: assist/baton-pass/
  // healing-wish/memento отряда — провал с логом.
  {
    const gslug = normMoveName(chosenMove.name);
    const wnm = `${isT ? '' : 'Дикий '}${S.activeWild.name}`;
    let sub: any = null;
    if (gslug === 'metronome') {
      sub = metronomePick();
      appendToLog(`${wnm} крутит Метроном... выпало ${sub.name}!`, false, 'system');
    } else if (gslug === 'copycat') {
      const last = S.lastMoveUsedDetail;
      if (last && !['copycat', 'metronome', 'assist', 'sleep-talk', 'mirror-move', 'sketch', 'transform', 'mimic', 'me-first'].includes(normMoveName(last.name))) {
        sub = { ...last };
        appendToLog(`${wnm} копирует ${sub.name}!`, false, 'system');
      } else { appendToLog(`${wnm} нечего копировать!`, false, 'system'); await finishEnemyTurn(); return; }
    } else if (gslug === 'assist') {
      appendToLog(`${wnm} зовёт подмогу — но он один!`, false, 'system');
      await finishEnemyTurn(); return;
    } else if (gslug === 'sleep-talk') {
      if (S.activeWild.status !== 'slp') { appendToLog(`${wnm} не спит — бормотать нечего!`, false, 'system'); await finishEnemyTurn(); return; }
      const opts = (S.wildMovesDetailed || []).filter((m: any) => m && !['sleep-talk', 'rest'].includes(normMoveName(m.name)));
      if (!opts.length) { appendToLog(`${wnm} нечего бормотать!`, false, 'system'); await finishEnemyTurn(); return; }
      sub = opts[Math.floor(Math.random() * opts.length)];
      appendToLog(`${wnm} бормочет во сне: ${sub.name}!`, false, 'system');
    } else if (gslug === 'mirror-move') {
      if (S.lastPlayerMoveDetail) {
        sub = { ...S.lastPlayerMoveDetail };
        appendToLog(`${wnm} отражает ${sub.name}!`, false, 'system');
      } else { appendToLog(`${wnm} отражать нечего!`, false, 'system'); await finishEnemyTurn(); return; }
    } else if (gslug === 'nature-power') {
      const t = S.terrain?.kind;
      const stub = t === 'electric' ? ['thunderbolt', 90, 'electric', 'special']
        : t === 'grassy' ? ['energy-ball', 90, 'grass', 'special']
        : t === 'misty' ? ['moonblast', 95, 'fairy', 'special']
        : t === 'psychic' ? ['psychic', 90, 'psychic', 'special']
        : ['tri-attack', 80, 'normal', 'special'];
      sub = { name: stub[0], power: stub[1], accuracy: 100, pp: 15, type: { name: stub[2] }, damage_class: { name: stub[3] }, meta: {} };
      appendToLog(`Сила природы: ${sub.name}!`, false, 'system');
    } else if (gslug === 'me-first') {
      // Крадёт только если игрок уже сходил в этом раунде
      if (S.playerActedRound === S.battleRound && S.lastPlayerMoveDetail) {
        const stolen = meFirstCopy(S.lastPlayerMoveDetail);
        if (stolen) {
          sub = stolen;
          appendToLog(`${wnm} крадёт ${S.lastPlayerMove}!`, false, 'system');
        }
      }
      if (!sub) { appendToLog(`${wnm} нечего красть — Me First провалился!`, false, 'system'); await finishEnemyTurn(); return; }
    } else if (gslug === 'transform') {
      const pMoves = (S.playerMovesDetailed || []).filter(Boolean).slice(0, 4);
      if (!pMoves.length) { appendToLog(`${wnm} не во что превращаться!`, false, 'system'); await finishEnemyTurn(); return; }
      const types = (S.activePlayerMon.apiData?.types || []).map((t: any) => t?.type?.name || t).filter(Boolean);
      S.activeWild.typeOverride = types.length ? types : null;
      S.wildMovesDetailed = pMoves.map((m: any) => ({ ...m }));
      S.wildMovesPP = S.wildMovesDetailed.map((m: any) => ({ current: m.pp || 30, max: m.pp || 30 }));
      appendToLog(`${wnm} превращается в вашего покемона!`, false, 'system');
      await finishEnemyTurn(); return;
    } else if (gslug === 'sketch') {
      if (!S.lastPlayerMove) { appendToLog(`${wnm} зарисовывать нечего!`, false, 'system'); await finishEnemyTurn(); return; }
      const detail = await fetchSiteMoveDetail(S.lastPlayerMove).catch(() => null);
      if (chosenIdx >= 0) {
        S.wildMovesDetailed[chosenIdx] = detail || { name: S.lastPlayerMove, power: 60, accuracy: 100, pp: 30, type: { name: 'normal' }, damage_class: { name: 'physical' }, meta: {} };
        if (S.wildMovesPP?.[chosenIdx]) S.wildMovesPP[chosenIdx] = { current: 30, max: 30 };
      }
      appendToLog(`${wnm} зарисовывает ${S.lastPlayerMove}!`, false, 'system');
      await finishEnemyTurn(); return;
    } else if (gslug === 'baton-pass' || gslug === 'healing-wish' || gslug === 'lunar-dance' || gslug === 'memento') {
      appendToLog(`${wnm} один — эстафета не работает!`, false, 'system');
      await finishEnemyTurn(); return;
    } else if (gslug === 'roar' || gslug === 'whirlwind') {
      // Дикий рыком вынуждает смену игрока: случайный живой запасной.
      // Жалоба 5: кнопки хватает — переиспользуем смену (без новых id).
      // Уходящий сбрасывает vol/ловушку, иначе она «переходит на новых».
      const alts = (GS.myTeam || []).filter((m: any) => m !== S.activePlayerMon && (m.currentHp ?? 1) > 0);
      if (!alts.length) { appendToLog(`${wnm} рычит — но смена невозможна!`, false, 'system'); await finishEnemyTurn(); return; }
      try {
        if (S.activePlayerMon) {
          S.activePlayerMon.vol = {};
          clearTrapState(S.activePlayerMon);
        }
      } catch (_) {}
      const pick = alts[Math.floor(Math.random() * alts.length)];
      S.activePlayerMon = pick;
      S.playerChargedMove = null;
      document.getElementById('player-name').innerText = pick.nickname || pick.apiData.name;
      document.getElementById('player-lvl').innerText = `Lv${pick.baseLevel + pick.candiesEaten}`;
      (document.getElementById('player-sprite') as HTMLImageElement).src = getSpriteUrl(pick);
      updateBattleSpriteBgs(pick, S.activeWild);
      document.getElementById('player-status-icon').innerText = getStatusIcon(pick.status);
      updatePlayerHpUI();
      updateAbilityDisplay();
      loadMoveButtons(pick, useMove);
      appendToLog(`${wnm} рыком вынуждает смену! Выходит ${pick.nickname || pick.apiData.name}!`, false, 'switch');
      await finishEnemyTurn(); return;
    } else if (gslug === 'teleport') {
      appendToLog(`${wnm} телепортируется из боя!`, false, 'system');
      fleeWildBattle('Противник сбежал!');
      return;
    } else if (gslug === 'fling') {
      const held = S.activeWild.heldItem;
      if (!held) { appendToLog(`${wnm} бросать нечего!`, false, 'system'); await finishEnemyTurn(); return; }
      const p = flingPower(held, itemCategory(held));
      chosenMove = { ...chosenMove, power: p };
      S.activeWild.consumeHeldAfterHit = held;
      appendToLog(`${wnm} бросает ${held}!`, false, 'system');
    } else if (gslug === 'natural-gift') {
      const held = S.activeWild.heldItem;
      const gift = held && itemCategory(held) === 'berries' ? naturalGift(held) : null;
      if (!gift) { appendToLog(`${wnm} нужна ягода в лапах!`, false, 'system'); await finishEnemyTurn(); return; }
      chosenMove = { ...chosenMove, power: gift.power, type: { name: gift.type } };
      S.activeWild.consumeHeldAfterHit = held;
      appendToLog(`${wnm} швыряет ягоду силой природы!`, false, 'system');
    } else if (gslug === 'present') {
      const roll = presentRoll();
      if (roll.kind === 'heal') {
        const amt = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 4));
        S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + amt);
        updatePlayerHpUI();
        appendToLog(`${wnm} дарит лечение вашему покемону! (+${amt} HP)`, false, 'heal');
        await finishEnemyTurn(); return;
      }
      chosenMove = { ...chosenMove, power: roll.power };
      appendToLog(`${wnm} дарит... удар на ${roll.power}!`, false, 'system');
    } else if (gslug === 'last-respects') {
      // У дикого команды нет — базовая сила 50
      chosenMove = { ...chosenMove, power: lastRespectsPower(0) };
    } else if (gslug === 'rage-fist') {
      chosenMove = { ...chosenMove, power: rageFistPower(S.activeWild.rageHits) };
    } else if (gslug === 'acrobatics') {
      if (!S.activeWild.heldItem) {
        chosenMove = { ...chosenMove, power: 110 };
        appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} лёгкий как пёрышко!`, false, 'system');
      }
    } else if (gslug === 'stored-power' || gslug === 'power-trip') {
      const st = S.activeWild.statStages || {};
      const boosts = ['atk', 'def', 'spa', 'spd', 'spe'].reduce((n, k) => n + Math.max(0, st[k] || 0), 0);
      chosenMove = { ...chosenMove, power: 20 + 20 * boosts };
    } else if (gslug === 'eruption' || gslug === 'water-spout' || gslug === 'dragon-energy') {
      const frac = S.wildMaxHP > 0 ? S.wildCurHP / S.wildMaxHP : 0;
      chosenMove = { ...chosenMove, power: Math.max(1, Math.floor(150 * frac)) };
    }
    if (sub) {
      // power пересчитается ниже штатной строкой (knock-off ×1.5 + сила):
      // блок гиммиков стоит раньше её объявления.
      chosenMove = sub;
      enemyMoveName = sub.name || enemyMoveName;
    }
    // Фикс: самоцвет врага сгорает при ударе своим типом
    {
      const held = S.activeWild.heldItem;
      if (held && GEM_TYPE[held] === chosenMove.type?.name) {
        S.activeWild.consumeHeldAfterHit = held;
      }
    }
  }

  // ── 3c. L2-остаток: игрок спрятался (fly/dig/dive) ──
  if (S.activePlayerMon.hiddenIn && !canHitHidden(chosenMove.name, S.activePlayerMon.hiddenIn)) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} бьёт мимо — противник спрятался!`, false, 'system');
    await finishEnemyTurn();
    return;
  }

  // ═══ 4. ACCURACY CHECK ═══
  let enemyAcc = checkAccuracy(
    chosenMove,
    abilityOf(S.activeWild, true),
    abilityOf(S.activePlayerMon, false),
    S.currentWeather,
  );
  // Hustle: 20% additional miss chance for physical moves
  const wildAbilityName = abilityOf(S.activeWild, true);
  // Serene Grace врага: ×2 к шансам вторичных эффектов, как у игрока.
  // Раньше враг множитель не получал — асимметрия сторон.
  const wildSereneGrace = String(wildAbilityName || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'serenegrace' ? 2 : 1;
  if (enemyAcc.hit && wildAbilityName === 'hustle' && chosenMove.damage_class?.name === 'physical') {
    if (Math.random() * 100 < 20) {
      enemyAcc = { hit: false, message: 'Атака промахнулась из-за Hustle!' };
    }
  }
  // ПРОХОД-741: наведение врага (после расчёта точности, иначе TDZ)
  if (!enemyAcc.hit && S.activeWild.lockedOn) {
    S.activeWild.lockedOn = false;
    enemyAcc = { hit: true, message: '' };
    appendToLog(`Наведение сработало — мимо не пройти!`, false, 'system');
  }
  if (!enemyAcc.hit) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}, но ${enemyAcc.message?.toLowerCase() || 'промахнулся'}!`);
    // Аудит итемов: Blunder Policy врага
    if (S.activeWild.heldItem === 'blunderPolicy') {
      S.activeWild.heldItem = null;
      statStageModify(S.activeWild, 'spe', 2, true);
      appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} съедает Blunder Policy: скорость +2!`, false, 'system');
    }
    await finishEnemyTurn();
    return;
  }
  let power = (chosenMove.name === 'knock-off' || chosenMove.name === 'knockoff') && S.activePlayerMon?.heldItem
    ? Math.floor(chosenMove.power * 1.5)  // Knock Off: ×1.5 если у цели есть предмет (канон)
    : chosenMove.power;

  // ═══ 5. СТАТУС-АТАКА ВРАГА (без урона) ═══
  // Та же маршрутизация, что у игрока: power-null, но дамажащие
  // (фикс. урон, OHKO) идут в урон, а не в «ничего не произошло».
  const enemyFixedDmg = !power ? getFixedDamage(chosenMove, {
    attackerLevel: S.wildLvl,
    defenderCurrentHp: S.activePlayerMon.currentHp,
    defenderMaxHp: S.activePlayerMon.maxHp,
    attackerCurrentHp: S.wildCurHP,
    attackerMaxHp: S.wildMaxHP,
    stock: S.activeWild.stock || 0,
    // L2-остаток: контратаки бьют от входящего с прошлого хода
    lastTakenDmg: S.lastTakenByWild?.dmg,
    lastTakenCat: S.lastTakenByWild?.cat,
    lastTakenRound: S.lastTakenByWild?.round,
    nowRound: S.battleRound,
  }) : null;
  if (!power && enemyFixedDmg == null && !isOhkoMove(chosenMove)) {
appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}!`);
  // Проход-741: последние ходы (copycat/mirror-move/sketch/me-first)
  S.lastWildMove = normMoveName(chosenMove.name);
  S.lastWildMoveDetail = chosenMove;
  S.lastMoveUsed = S.lastWildMove;
  S.lastMoveUsedDetail = chosenMove;
  monVol(S.activeWild).lastMove = S.lastWildMove; // для torment
    handleEnemyStatusEffects(chosenMove); // Лечение, барьеры, статы, статусы
    await finishEnemyTurn();
    return;
  }

  // ═══ 6. PROTECT CHECK (игрок защищается) ═══
  if (S.protectActive && power) {
    appendToLog(`${S.activePlayerMon.apiData.name} защитился от атаки!`);
    S.protectActive = false;
    // Проход-741: шипастый щит наказывает атакующего
    applyShieldPunish(S.activePlayerMon, S.activeWild, true);
    await finishEnemyTurn();
    return;
  }

  // ═══ 7. РАСЧЁТ УРОНА (multi-hit) ═══
  const isPhysical = chosenMove.damage_class.name === 'physical';
  // L2-остаток: Beat Up дикого — один удар (команды нет); у тренера зала —
  // по числу оставшихся (текущий + запас).
  const eBeatSlug = normMoveName(chosenMove.name);
  const eBeatHits = eBeatSlug === 'beat-up'
    ? (S.battleType !== 'wild' && Array.isArray(S.gymTeamData)
      ? Math.max(1, S.gymTeamData.length - (S.gymTeamIndex || 0))
      : 1)
    : 0;
  const numHits = eBeatSlug === 'beat-up' ? eBeatHits
    : eBeatSlug === 'population-bomb' ? populationBombHits()
    : getMultiHitCount(chosenMove, Math.random, S.activeWild.heldItem);

  // Sheer Force: убирает вторичные эффекты атак, даёт 1.3x урон (в calculateDamage)
  const enemySheerForce = wildAbilityName === 'sheer-force' &&
    !!(chosenMove.meta?.ailment_chance || chosenMove.meta?.flinch_chance || chosenMove.meta?.stat_chance || (chosenMove.stat_changes?.length > 0));

  // Сообщение об атаке — ДО урона.
  // Раньше строка «использует X!» появлялась только в итоге, после всех ударов,
  // и лог читался задом наперёд: сначала «Суперэффективно!», потом «−18 HP»,
  // и лишь затем сама атака.
  appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}!`);

  // ── ПРОХОД-741: Spectral Thief врага крадёт усиления до удара ──
  if (normMoveName(chosenMove.name) === 'spectral-thief') {
    const ps = S.activePlayerMon.statStages || {};
    const stolen = ['atk', 'def', 'spa', 'spd', 'spe'].some((k) => (ps[k] || 0) > 0);
    if (stolen) {
      const ws = S.activeWild.statStages || { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      for (const k of ['atk', 'def', 'spa', 'spd', 'spe']) {
        ws[k] = Math.max(-6, Math.min(6, (ws[k] || 0) + Math.max(0, ps[k] || 0)));
        ps[k] = 0;
      }
      S.activeWild.statStages = ws;
      S.activePlayerMon.statStages = ps;
      updateStatBadges();
      appendToLog(`${S.activeWild.name} крадёт усиления!`, false, 'system');
    }
  }

  // ═══ MULTI-HIT LOOP (enemy) ═══
  let totalDmg = 0, hitsLanded = 0, lastCrit = false;
  const prePlayerHP = S.activePlayerMon.currentHp;
  for (let hi = 0; hi < numHits; hi++) {
    if (S.activePlayerMon.currentHp <= 0) break;
    if (hi > 0 && S.protectActive) break;

    const dmgResult = calculateDamage({
      move: chosenMove,
      attacker: S.activeWild,
      defender: S.activePlayerMon,
      attackerLevel: S.wildLvl,
      defenderLevel: S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten,
      isWildAttacker: true,
      isWildDefender: false,
      weather: S.currentWeather,
      attackerStatStages: S.activeWild.statStages,
      defenderStatStages: S.activePlayerMon.statStages,
      attackerHeldItem: S.activeWild.heldItem,
      defenderHeldItem: S.activePlayerMon.heldItem,
      naturesList: natures,
      critRateStage: (chosenMove.meta?.crit_rate || 0)
      + ((S.activeWild.heldItem === 'scopeLens' || S.activeWild.heldItem === 'razorClaw') ? 1 : 0)
      + (S.activeWild.focusEnergy ? 2 : 0),
      defenderAbilityName: abilityOf(S.activePlayerMon, false),
      attackerAbilityName: abilityOf(S.activeWild, true),
        defenderCurrentHp: S.activePlayerMon.currentHp,
        defenderMaxHp: S.activePlayerMon.maxHp,
        attackerCurrentHp: S.wildCurHP,
        attackerMaxHp: S.wildMaxHP,
        attackerSlowStart: String(abilityOf(S.activeWild, true) || '')
          .toLowerCase().replace(/[^a-z0-9]/g, '') === 'slowstart'
          && (S.activeWild.slowStartTurns || 0) < 5,
        // L2-остаток: контратаки бьют от входящего с прошлого хода
        lastTakenDmg: S.lastTakenByWild?.dmg,
        lastTakenCat: S.lastTakenByWild?.cat,
        lastTakenRound: S.lastTakenByWild?.round,
        nowRound: S.battleRound,
        // Проход-741: заряды stockpile и смена типа
        stock: S.activeWild.stock || 0,
        attackerTypesOverride: effTypes(S.activeWild).length ? effTypes(S.activeWild) : undefined,
        defenderTypesOverride: effTypes(S.activePlayerMon).length ? effTypes(S.activePlayerMon) : undefined,
        // Аудит итемов/атак: лазерный прицел и гарантированные криты
        alwaysCrit: !!S.activeWild.laserFocus || ALWAYS_CRIT.has(normMoveName(chosenMove.name)),
        // Проход-741: напев давит криты, foresight бьёт по призраку
        suppressCrit: (S.luckyP || 0) > 0,
        ignoreGhost: !!S.activePlayerMon.vol?.foresight,
    });
    let hitDmg = dmgResult.damage;
    const bMod = applyBarrierMod(1, chosenMove, true, dmgResult.isCrit); // Барьеры игрока
    if (bMod !== 1) hitDmg = Math.floor(hitDmg * bMod);
    // Проход-741: Collision Course — ×4/3 по суперэффективной цели
    {
      const cSlug = normMoveName(chosenMove.name);
      if ((cSlug === 'collision-course' || cSlug === 'electro-drift') && hitDmg > 0) {
        const eff = getTypeMultiplier(chosenMove.type?.name, effTypes(S.activePlayerMon));
        const mult = collisionCourseMult(eff);
        if (mult !== 1) hitDmg = Math.floor(hitDmg * mult);
      }
    }
    lastCrit = dmgResult.isCrit;

    // Модификаторы («Критический удар!», «Суперэффективно!»…) печатаем в одной
    // строке с уроном — ниже, когда урон уже посчитан и применён.
    const hitMods = dmgResult.messages
      .map(m => m.replace(/[!.]+$/, '').toLowerCase())
      .join(', ');

    // Focus Sash: игрок выживает с 1 HP (предмет расходуется)
    if (S.activePlayerMon.heldItem === 'focusSash' && S.activePlayerMon.currentHp === S.activePlayerMon.maxHp && hitDmg >= S.activePlayerMon.currentHp) {
      hitDmg = S.activePlayerMon.currentHp - 1;
      appendToLog(`${S.activePlayerMon.apiData.name} держится благодаря Фокусному поясу!`);
      S.activePlayerMon.heldItem = null;
    }

    // Player Substitute поглощает урон
    if (S.substituteHP > 0 && hitDmg > 0) {
      const subBlock = Math.min(S.substituteHP, hitDmg);
      S.substituteHP -= subBlock;
      hitDmg -= subBlock;
      appendToLog(`Заменитель поглотил ${subBlock} урона!`);
      if (S.substituteHP <= 0) {
        appendToLog('Заменитель разрушен!');
        S.substituteHP = 0;
      }
    }

    if (hitDmg <= 0) {
      appendToLog(`0 урона${hitMods ? ` — ${hitMods}` : ''}`, false, 'dmg');
      continue;
    }

    // Type-resist berry for player (Occa, Passho, etc.)
    if (hi === 0) hitDmg = applyTypeResistBerry(S.activePlayerMon, chosenMove.type?.name, hitDmg, true);

    // Training Grounds: 0.01% урона (безопасная тренировка)
    if (GS.currentLocationId?.includes('trainingGrounds')) {
      hitDmg = Math.max(1, Math.floor(hitDmg * 0.0001));
    }

    S.activePlayerMon.currentHp -= hitDmg;
    if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
    totalDmg += hitDmg;
    hitsLanded++;
    updatePlayerHpUI();
    // Одна строка на удар: урон и модификаторы вместе
    appendToLog(`−${hitDmg} HP${hitMods ? ` — ${hitMods}` : ''}`, false, 'dmg');

    // Drain / Recoil per hit. Жалоба 4 (зеркало игрока): раньше ветка
    // лечения дикого не звала updateWildHpUI и не писала лог — HP росло
    // в S, а бар стоял, и казалось «не пополняет». Теперь как у игрока.
    if (chosenMove.meta?.drain) {
      if (chosenMove.meta.drain > 0) {
        const before = S.wildCurHP;
        const after = applyDrainHeal(before, S.wildMaxHP, hitDmg, chosenMove.meta.drain, S.activeWild.heldItem === 'bigRoot');
        if (after > before) {
          S.wildCurHP = after;
          updateWildHpUI();
          appendToLog(`Дикий ${S.activeWild.name} высасывает здоровье! (+${after - before} HP)`, false, 'heal');
        }
      } else {
        const rd = calcRecoilDamage(hitDmg, chosenMove.meta.drain);
        S.wildCurHP -= rd;
        if (S.wildCurHP < 0) S.wildCurHP = 0;
        updateWildHpUI();
      }
    }

    // Struggle recoil: applies once, not per hit
    if (hi === 0 && chosenIdx < 0) {
      const struggleDmg = Math.max(1, Math.floor(S.wildMaxHP / 4));
      S.wildCurHP -= struggleDmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} получает урон от Struggle! (-${struggleDmg} HP)`);
    }

    // Rocky Helmet per physical hit
    if (power && isPhysical && S.activePlayerMon.heldItem === 'rockyHelmet') {
      const recoil = Math.max(1, Math.floor(S.wildMaxHP / 6));
      S.wildCurHP -= recoil;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }

    // Sticky Barb: при контакте переползает на бьющего (если руки пустые)
    if (power && isPhysical && S.activePlayerMon.heldItem === 'stickyBarb') {
      if (!S.activeWild.heldItem) {
        S.activePlayerMon.heldItem = null;
        S.activeWild.heldItem = 'stickyBarb';
        appendToLog(`Липкий шип переполз на дикого ${S.activeWild.name}!`, false, 'system');
      }
    }

    // Wild Life Orb per hit
    if (S.activeWild.heldItem === 'lifeOrb' && power) {
      S.wildCurHP -= Math.max(1, Math.floor(S.wildMaxHP / 10));
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
      if (S.wildCurHP <= 0 && hi === 0) {
        appendToLog(`${S.activeWild.name} потерял сознание от отдачи Life Orb!`, false, 'faint');
        await handleWildFaintRewards(S.battleType === 'wild');
        return;
      }
    }

    // Rough Skin / Iron Barbs per physical hit (способность игрока)
    const playerAbility = abilityOf(S.activePlayerMon, false);
    if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(playerAbility)) {
      const recoil = Math.max(1, Math.floor(hitDmg / 8));
      S.wildCurHP -= recoil;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }

    // ── Secondary status от атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.meta && chosenMove.meta.ailment && chosenMove.meta.ailment.name !== 'none' && chosenMove.meta.ailment.name !== 'unknown') {
      // ПРОХОД-741: волатильные — не в .status, а в mon.vol
      const vAil = chosenMove.meta.ailment.name;
      if (['confusion', 'infatuation', 'yawn', 'perish-song', 'torment', 'disable', 'trap', 'ingrain'].includes(vAil)) {
        const ok = vAil === 'confusion'
          ? Math.random() * 100 < effectiveSecondaryChance(confuseChance(chosenMove.name), wildSereneGrace)
          : true;
        if (ok && !isStatusImmune(vAil, S.activePlayerMon)) {
          applyVolatileAilment(S.activePlayerMon, false, vAil, S.activeWild.name, S.lastPlayerMove, S.activeWild.heldItem);
        }
      } else {
      const chance = effectiveSecondaryChance(chosenMove.meta.ailment_chance, wildSereneGrace);
      if (Math.random() * 100 < chance) {
        const statusMap = {
          'poison': 'psn', 'badly-poison': 'tox',
          'burn': 'brn', 'paralysis': 'par',
          'sleep': 'slp', 'freeze': 'frz'
        };
        const targetStatus = statusMap[chosenMove.meta.ailment.name];
        if (targetStatus && !S.activePlayerMon.status && !isStatusImmune(chosenMove.meta.ailment.name, S.activePlayerMon)) {
          if (applyStatusEffect(S.activePlayerMon, targetStatus)) {
            document.getElementById('player-status-icon').innerText = getStatusIcon(targetStatus);
            appendToLog(`${S.activePlayerMon.apiData.name} получил ${STATUS_NAMES[targetStatus]} от атаки ${S.activeWild.name}!`);
          }
        }
      }
      } // конец else обычных статусов
    }

    // ── Flinch от атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.meta?.flinch_chance && Math.random() * 100 < effectiveSecondaryChance(chosenMove.meta.flinch_chance, wildSereneGrace)) {
      S.activePlayerMon.flinch = true;
    }

    // ── Stat changes от дамажащих атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.stat_changes && chosenMove.stat_changes.length > 0) {
      const scChance = effectiveSecondaryChance(chosenMove.meta?.stat_chance ?? 100, wildSereneGrace);
      if (Math.random() * 100 < scChance) {
        const targetMap = { 'user': S.activeWild, 'selected-pokemon': S.activePlayerMon, 'all-opponents': S.activePlayerMon, 'all-other-pokemon': S.activePlayerMon };
        const moveTarget = chosenMove.target?.name || 'selected-pokemon';
        const affectedMon = targetMap[moveTarget] || S.activePlayerMon;
        const monName = affectedMon === S.activeWild ? S.activeWild.name : S.activePlayerMon.apiData.name;
        const statNameMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
        chosenMove.stat_changes.forEach(sc => {
          const statKey = statNameMap[sc.stat.name];
          if (statKey) {
            const oldStage = affectedMon.statStages[statKey] || 0;
            const newVal = Math.max(-6, Math.min(6, oldStage + sc.change));
            if (newVal !== oldStage) {
              statStageModify(affectedMon, statKey, sc.change, affectedMon !== S.activeWild);
              const sign = newVal >= 0 ? '+' : '';
              const dir = sc.change > 0 ? 'повышена' : 'понижена';
              const labels = { atk: 'Атака', def: 'Защита', spa: 'Сп. Атака', spd: 'Сп. Защита', spe: 'Скорость' };
              appendToLog(`${labels[statKey] || statKey} ${monName} ${dir} (${sign}${newVal})`, false, 'system');
            }
          }
        });
      }
    }
  }

// ─── AFTER ALL HITS ───
    // False Swipe от врага — не добивает (зеркало игрока).
    if (chosenMove.name === 'false-swipe' || chosenMove.name === 'falseswipe') {
      const clamped = falseSwipeClamp(prePlayerHP, S.activePlayerMon.currentHp);
      if (clamped !== S.activePlayerMon.currentHp) {
        S.activePlayerMon.currentHp = clamped;
        appendToLog(`Ложный Удар оставляет ${S.activePlayerMon.apiData.name} 1 HP!`, false, 'system');
        updatePlayerHpUI();
      }
    }

    // Knock Off врага — сбивает предмет игрока (канон: ×1.5 учтены в power выше).
    if (chosenMove.name === 'knock-off' || chosenMove.name === 'knockoff') {
      if (S.activePlayerMon?.heldItem) {
        appendToLog(`${S.activePlayerMon.apiData.name} лишается предмета!`, false, 'system');
        S.activePlayerMon.heldItem = null;
      }
    }

    // Итог по многоударной атаке. Для одиночного удара строка уже напечатана
    // выше — дублировать её не нужно.
  if (numHits > 1) {
    appendToLog(`Попал ${hitsLanded} раз(а), всего ${totalDmg} урона!`, false, 'dmg');
  }

  // L2-остаток: запоминаем входящий игроку — для Counter/Mirror Coat/
  // Metal Burst и накопления Bide следующим ходом.
  S.lastTakenByPlayer = { dmg: totalDmg, cat: chosenMove.damage_class?.name || null, round: S.battleRound };
  // Проход-741: флаг прямого урона (для endure)
  S.playerTookHit = totalDmg > 0;
  S.playerTookCat = totalDmg > 0 ? (chosenMove.damage_class?.name || null) : S.playerTookCat;
  if (S.activePlayerMon.bide && S.activePlayerMon.bide.turns > 0) {
    S.activePlayerMon.bide.dmg += totalDmg;
  }
  // L2-остаток: hyper-beam и семья — перезарядка, если попали (hitsLanded>0)
  if (hitsLanded > 0 && needsRecharge(chosenMove)) {
    S.activeWild.recharging = true;
  }
  // Лазерный прицел — разовый, сгорает после атаки
  if (S.activeWild.laserFocus) S.activeWild.laserFocus = false;
  // Проход-741: счётчик Rage Fist у получившего
  if (hitsLanded > 0) {
    S.activePlayerMon.rageHits = (S.activePlayerMon.rageHits || 0) + 1;
  }
  // Проход-741: Pay Day копит монеты за удары
  if (hitsLanded > 0 && normMoveName(chosenMove.name) === 'pay-day') {
    S.activeWild.payDayHits = (S.activeWild.payDayHits || 0) + hitsLanded;
  }
  // Аудит итемов: реакции держащего на входящий удар (зеркало)
  if (hitsLanded > 0 && S.activePlayerMon.heldItem) {
    const held = S.activePlayerMon.heldItem;
    const pnm = S.activePlayerMon.apiData.name;
    if (held === 'weaknessPolicy' && getTypeMultiplier(chosenMove.type?.name, effTypes(S.activePlayerMon)) > 1) {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'atk', 2, false);
      statStageModify(S.activePlayerMon, 'spa', 2, false);
      appendToLog(`${pnm} съедает Weakness Policy: атака +2!`, false, 'system');
    } else if (held === 'cellBattery' && chosenMove.type?.name === 'electric') {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'spa', 1, false);
      appendToLog(`${pnm} заряжается Cell Battery: сп. атака +1!`, false, 'system');
    } else if (held === 'luminousMoss' && chosenMove.type?.name === 'water') {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'spd', 1, false);
      appendToLog(`${pnm} впитывает Luminous Moss: сп. защита +1!`, false, 'system');
    } else if (held === 'snowball' && chosenMove.type?.name === 'ice') {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'atk', 1, false);
      appendToLog(`${pnm} лепит Snowball: атака +1!`, false, 'system');
    } else if (held === 'throatSpray' && SOUND_MOVES.has(normMoveName(chosenMove.name))) {
      S.activePlayerMon.heldItem = null;
      statStageModify(S.activePlayerMon, 'spa', 1, false);
      appendToLog(`${pnm} пьёт Throat Spray: сп. атака +1!`, false, 'system');
    } else if (held === 'destinyKnot') {
      monVol(S.activeWild).attract = true;
      appendToLog(`Дикий ${S.activeWild.name} влюбляется в ${pnm}!`, false, 'system');
    }
  }
  // Аудит итемов/атак: Fake Out дрогает цель
  if (hitsLanded > 0 && normMoveName(chosenMove.name) === 'fake-out' && S.activePlayerMon.currentHp > 0) {
    S.activePlayerMon.flinch = true;
    appendToLog(`${S.activePlayerMon.apiData.name} дрогнул!`, false, 'system');
  }
  // Проход-741: jaw-lock / anchor-shot / thunder-cage держат цель
  if (hitsLanded > 0 && ['jaw-lock', 'anchor-shot', 'thunder-cage'].includes(normMoveName(chosenMove.name)) && S.activePlayerMon.currentHp > 0) {
    S.activePlayerMon.trapped = true;
    if (normMoveName(chosenMove.name) === 'jaw-lock') S.activeWild.trapped = true;
    appendToLog(`${S.activePlayerMon.apiData.name} не может уйти!`, false, 'system');
  }
  // Проход-741: Clear Smog сносит все усиления цели
  if (hitsLanded > 0 && normMoveName(chosenMove.name) === 'clear-smog' && S.activePlayerMon.currentHp > 0) {
    S.activePlayerMon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    updateStatBadges();
    appendToLog(`Чистый дым сносит усиления ${S.activePlayerMon.apiData.name}!`, false, 'system');
  }
  // Аудит итемов: King's Rock / Razor Fang — 10% флинч
  if (hitsLanded > 0 && (S.activeWild.heldItem === 'kingsRock' || S.activeWild.heldItem === 'razorFang')
    && S.activePlayerMon.currentHp > 0 && Math.random() < 0.1) {
    S.activePlayerMon.flinch = true;
    appendToLog(`${S.activePlayerMon.apiData.name} дрогнул!`, false, 'system');
  }
  // Аудит итемов: Shell Bell — 1/8 нанесённого себе
  if (hitsLanded > 0 && S.activeWild.heldItem === 'shellBell' && totalDmg > 0 && S.wildCurHP > 0) {
    const heal = Math.max(1, Math.floor(totalDmg / 8));
    S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
    updateWildHpUI();
    appendToLog(`Колокольчик лечит дикого ${S.activeWild.name}! (+${heal} HP)`, false, 'heal');
  }
  // Аудит итемов: воровство и склёв ягод
  if (hitsLanded > 0) {
    const stealSlug = normMoveName(chosenMove.name);
    if ((stealSlug === 'thief' || stealSlug === 'covet') && S.activePlayerMon.heldItem && !S.activeWild.heldItem) {
      S.activeWild.heldItem = S.activePlayerMon.heldItem;
      S.activePlayerMon.heldItem = null;
      updateAbilityDisplay();
      appendToLog(`Дикий ${S.activeWild.name} крадёт ${S.activeWild.heldItem}!`, false, 'system');
    }
    if ((stealSlug === 'pluck' || stealSlug === 'bug-bite' || stealSlug === 'incinerate')
      && S.activePlayerMon.heldItem && itemCategory(S.activePlayerMon.heldItem) === 'berries') {
      const berry = S.activePlayerMon.heldItem;
      S.activePlayerMon.heldItem = null;
      if (stealSlug === 'incinerate') {
        appendToLog(`Ягода ${berry} сгорела!`, false, 'system');
      } else {
        const heal = Math.max(1, Math.floor(S.wildMaxHP / 4));
        S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
        updateWildHpUI();
        appendToLog(`Дикий ${S.activeWild.name} склевал ${berry}! (+${heal} HP)`, false, 'heal');
      }
    }
  }
  // Проход-741: расходники удара сгорают при попадании
  if (hitsLanded > 0 && S.activeWild.consumeHeldAfterHit) {
    const spent = S.activeWild.consumeHeldAfterHit;
    S.activeWild.heldItem = null;
    S.activeWild.consumeHeldAfterHit = null;
    appendToLog(`${S.activeWild.name} израсходовал ${spent}!`, false, 'system');
  }
  // Проход-741: spit-up сжигает заряды
  if (hitsLanded > 0 && normMoveName(chosenMove.name) === 'spit-up') {
    S.activeWild.stock = 0;
  }
  // Проход-741: final-gambit — сам падает после удара
  if (hitsLanded > 0 && normMoveName(chosenMove.name) === 'final-gambit' && S.wildCurHP > 0) {
    S.wildCurHP = 0;
    updateWildHpUI();
    appendToLog(`${S.activeWild.name} жертвует собой!`, false, 'system');
  }

  // ═══ 9. УМЕНЬШЕНИЕ БАРЬЕРОВ ═══
  // Перенесено в tickEnemyTurnDurations(), которая вызывается из finally хода
  // противника: ранние return ниже доходили сюда не всегда, и барьеры копились.

  // ═══ 8. НОКАУТ ВРАГА ОТ ОТКАТА ═══
  // Rocky Helmet, Rough Skin / Iron Barbs, Struggle и отдача Life Orb уменьшают
  // HP врага прямо в цикле выше. Раньше после цикла проверялся только нокаут
  // ИГРОКА, поэтому враг мог остаться в бою с нулевым HP и продолжать получать
  // удары. Проверяем это до всего остального.
  if (S.wildCurHP <= 0) {
    // Проход-741: endure/destiny дикого (только прямой урон — сюда попадают
    // только дамажные ходы; статусные тики идут через finishEnemyTurn без гарда)
    if (guardFaintWild()) {
      // Выдержал — бой продолжается
    } else {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
  }

  // Остальной конец хода — статусы и Семя Ужаса врага, погода, ягоды, Объедки,
  // нокаут игрока и возврат меню — живёт в finishEnemyTurn(). Там же фаза
  // возвращается в PLAYER_TURN: раньше здесь стоял голый setTimeout, который
  // только показывал меню, а фазу оставлял в ENEMY_TURN.
  await finishEnemyTurn();
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 15: ИНИЦИАЛИЗАЦИЯ СОБЫТИЙ БОЯ
// ═══════════════════════════════════════════════════════════════
// initEncounterEvents — навешивает обработчики на все кнопки боя.
// Вызывается ОДИН раз при старте игры (в init.ts или main.ts).
//
// Кнопки:
//   btn-run        — побег (только wild)
//   btn-switch     — смена покемона (заблокировано в gym/elite/champion)
//   btn-use-item   — использование предмета (очень большой блок)
//   btn-leave-battle — выход из боя
// ─────────────────────────────────────────────────────────────

// Флаг идемпотентности: initEncounterEvents вызывается один раз при старте игры,
// но повторный вызов (HMR, переинициализация) раньше дублировал слушатели —
// тогда один клик «Сбежать» выполнял побег дважды (второй раз упирался в фазу
// IDLE и показывал сбивающий с толку тост «Подождите...»).
let encounterEventsInit = false;

function initEncounterEvents() {
  if (encounterEventsInit) return;
  encounterEventsInit = true;

  // Безопасная подписка: одного отсутствующего узла (например, после правки
  // index.html) раньше хватало, чтобы TypeError оборвал всю функцию и
  // btn-switch / btn-use-item / btn-leave-battle остались вообще без слушателей.
  const on = (id: string, fn: (e: Event) => void) => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[battle] initEncounterEvents: #${id} не найден — кнопка без обработчика`);
      return;
    }
    el.addEventListener('click', fn);
  };

  // ═══ 15a: ПОБЕГ ═══
  //
  // По спецификации побег ВСЕГДА удачен, но стоит покемону всех HP: активный
  // покемон падает в нокаут. Если он был последним живым — это сразу поражение.
  //
  // Раньше побег был вероятностным (формула от скорости), ничего не стоил, а
  // при удаче НЕ чистил battle_state и не переводил фазу в IDLE: после
  // перезагрузки восстанавливался бой, который игрок уже покинул.
  on('btn-run', () => {
    if (S.battleType !== 'wild') {
      appendToLog('Нельзя сбежать от лидера!');
      return;
    }
    // Проход-741: ловушка (mean-look/octolock/...) не даёт сбежать.
    // Жалоба 6: bind-семья ставит vol.trapped — проверяем оба флага.
    if (isHeldByTrap(S.activePlayerMon)) {
      appendToLog(`${S.activePlayerMon.apiData.name} не может сбежать — держит ловушка!`, false, 'system');
      return;
    }
    // Действовать можно только в свой ход — иначе побег во время хода врага
    // накладывался на его атаку.
    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      showToast('Подождите... идёт ход противника.', true);
      return;
    }

    const mon = S.activePlayerMon;
    if (!mon) {
      console.warn('[battle] run: нет активного покемона — побег невозможен');
      return;
    }
    const aliveBefore = GS.myTeam.filter(m => m.currentHp > 0).length;

    const mainMenu = document.getElementById('battle-main-menu');
    if (mainMenu) mainMenu.style.display = 'none';
    appendToLog('Вам удалось сбежать!');
    appendToLog(`${mon.apiData.name} выложился до конца и потерял сознание.`, false, 'faint');
    mon.currentHp = 0;
    // Побег обнуляет стрик диких побед (streak-квесты: «подряд» — честно)
    if ((state.questStreak || 0) > 0) {
      state.questStreak = 0;
      trackNPCQuests('streak_x', { streak: 0 });
    }
    updatePlayerHpUI();

    battle.transition(BattlePhase.IDLE);
    clearBattleState();
    S.escapeAttempts = 0;

    // Токен боя: если за секунду таймера напал новый дикий (startHunt
    // увеличил battleSeq), старый таймер молча выходит — иначе он гасил
    // модалку УЖЕ НОВОГО боя и показывал чужой end-menu.
    const fledSeq = S.battleSeq || 0;
    setTimeout(() => {
      if ((S.battleSeq || 0) !== fledSeq) return;  // начался новый бой — не трогаем
      const modal = document.getElementById('encounter-modal');
      if (modal) modal.style.display = 'none';
      if (aliveBefore <= 1) {
        // Бежал последним живым — команда пуста, это поражение
        appendToLog('Вся команда потеряла сознание... Вы проиграли.');
        const endMenu = document.getElementById('battle-end-menu');
        if (endMenu) endMenu.style.display = 'flex';
      }
      store.autoSave();
    }, 1000);
  });

  // ═══ 15b: СМЕНА ПОКЕМОНА ═══
  // По спецификации смена разрешена и в бою с лидером зала. Раньше здесь стоял
  // запрет для gym/elite/champion — он противоречил решению из интервью.
  on('btn-switch', () => {
    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      showToast('Подождите... идёт ход противника.', true);
      return;
    }
    switchPokemon();
  });

  // ═══ 15c: ИСПОЛЬЗОВАНИЕ ПРЕДМЕТА ═══
  // Этот обработчик — самый большой в файле (~300 строк).
  // Обрабатывает ВСЕ типы предметов в бою:
  //   - Покеболлы (ловля)       — отдельная механика с catchRate
  //   - Аптечки (Potion, Super Potion, Full Restore)
  //   - Лекарства от статусов (Antidote, Paralyze Heal...)
  //   - PP восстановление (Ether, Elixir, Max Elixir)
  //   - X-Items (X Attack, X Defense...)
  //   - Камни эволюции (Evolution Stone, Fire Stone...)
  //   - TM-совместимость
  on('btn-use-item', () => {
    // Действовать можно только в свой ход. Без этой проверки предмет,
    // использованный во время хода врага, запускал ещё один enemyTurn() —
    // два хода противника подряд и удвоенный урон.
    if (battle.phase !== BattlePhase.PLAYER_TURN) {
      showToast('Подождите... идёт ход противника.', true);
      return;
    }
    // Читаем выбранный предмет из выпадающего списка
    const item = (document.getElementById('battle-item-select') as HTMLInputElement).value;

    // ═══ БАЛЛЫ (покеболлы) ═══
    // Собираем конфиги всех реализованных покеболов
    const BALL_CONFIG = {};
    ITEMS.filter(i => i.isBall && i.implemented).forEach(i => {
      BALL_CONFIG[i.id] = {
        label: i.nameRu,
        mult: i.ballMult,     // Множитель поимки (например, UltraBall = ×2)
        qty: store.getItemQty(i.id),
        dec: () => store.removeItem(i.id),
      };
    });
    const ballCfg = BALL_CONFIG[item];
    if (ballCfg) {
      // ── БАЛЛЫ: ЛОВЛЯ ПОКЕМОНА ──
      if (S.battleType !== 'wild') {
        return appendToLog('Нельзя ловить в бою с лидером!');
      }
      if (ballCfg.qty <= 0) return showToast(`У вас нет ${ballCfg.label}ов!`, true);

      // Неловимый (легенда или noCatch-локация): болл не тратим, сразу говорим.
      // Сафари-болл проходит запрет ЛОКАЦИИ (секретные места с редкими),
      // но не запрет ВИДА: легенды остаются только боссами ради дропа.
      if (S.activeWild.uncatchable) {
        const speciesLocked = LEGENDARY_SET.has((S.activeWild.name || '').toLowerCase());
        if (!(item === 'safariBall' && !speciesLocked)) {
          appendToLog(`${S.activeWild.name} нельзя поймать! Его можно только победить ради дропа.`, false, 'system');
          return;
        }
        appendToLog('Сафари-болл: запрет этого места не действует!', false, 'catch');
      }

      ballCfg.dec(); // Уменьшаем количество в инвентаре
      store.updateInventoryDisplay();

      // ═══ ФОРМУЛА ПОИМКИ ═══
      // Стандартная формула из игр Pokemon:
      //   rate = (3*maxHP - 2*curHP) / (3*maxHP) * speciesRate * ballMult * statusMult
      //   catchChance = min(0.95, rate / 255)
      //
      // Факторы:
      //   - HP: чем меньше HP, тем выше шанс
      //   - Species catch rate: у легендарок 3-45, у обычных 45-255
      //   - Ball multiplier: PokeBall ×1, GreatBall ×1.5, UltraBall ×2
      //   - Status: сон/заморозка ×2.5, яд/ожог/паралич ×1.5
      //   - Quick Ball: ×5 на первом ходу
      //   - Dusk Ball: ×3 ночью
      //   - Timer Ball: +0.3 за каждый ход
      //   - Love Ball: ×8 если противоположный пол
      const speciesRate = S.activeWild.captureRate || S.activeWild.speciesData?.capture_rate || 100;
      let catchRate = ((3 * S.wildMaxHP - 2 * S.wildCurHP) * speciesRate) / (3 * S.wildMaxHP);
      catchRate = catchRate * ballCfg.mult;

      // Бонус за статус-эффект
      if (S.wildStatus === 'slp' || S.wildStatus === 'frz') catchRate *= 2.5;  // Сон/заморозка — лучший бонус
      else if (S.wildStatus === 'par' || S.wildStatus === 'brn' || S.wildStatus === 'psn') catchRate *= 1.5;

      // Специальные эффекты покеболов
      if (item === 'quickBall' && S.battleRound < 1) catchRate *= 5;   // Quick Ball — только первый ход
      if (item === 'duskBall' && !GS.isDaytime) catchRate *= 3;       // Dusk Ball — ночью
      if (item === 'timerBall') catchRate *= 1 + S.battleRound * 0.3; // Timer Ball — чем дольше бой, тем выше

      // Love Ball: x8 если противоположный пол
      if (item === 'loveBall') {
        const wildGender = S.activeWild.wildGender !== undefined ? S.activeWild.wildGender : (Math.random() < 0.5 ? 'male' : 'female');
        const playerGender = S.activePlayerMon?.apiData?.gender || (Math.random() < 0.5 ? 'male' : 'female');
        if (wildGender && playerGender && wildGender !== playerGender) catchRate *= 8;
      }

      // Конвертируем в вероятность (максимум 95%)
      let catchChance = Math.min(0.95, catchRate / 255);

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы бросили ${ballCfg.label}...`);

      // Анимация: ожидание 1 секунду (имитация броска)
      setTimeout(() => {
        if (Math.random() < catchChance) {
          appendToLog(`Попался! ${S.activeWild.name.toUpperCase()} пойман!`, false, 'catch');

          const newMon = {
            uid: generateUID(),
            originalTrainer: getTrainerId(),
            createdAt: Date.now(),
            caughtLocation: GS.currentLocationId,
            isShiny: S.activeWild.isShiny || false,
            gender: S.activeWild.wildGender || null,
            apiData: S.activeWild,
            maxHp: S.wildMaxHP,
            currentHp: S.wildCurHP,
            ivs: S.activeWild.wildIVs,
            evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            baseLevel: S.wildLvl,
            exp: Math.pow(S.wildLvl, 3),
            expToNext: Math.pow(S.wildLvl + 1, 3),
            candiesEaten: 0,
            vitaminsEaten: 0,
            training: null,
            trainingStage: 0,
            trainingStat: null,
            happiness: 70,
            natureIdx: Math.floor(Math.random() * natures.length),
            breedLetter: ['A', 'T', 'G'][Math.floor(Math.random() * 3)],  // симпатия (канон лиги)
            status: S.wildStatus || null,
            sleepTurns: S.wildSleepTurns || 0,
            movesPP: S.wildMovesPP ? S.wildMovesPP.map(pp => ({ current: pp.max, max: pp.max })) : [],
            statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            abilityName: S.activeWild.abilities?.[0]?.ability?.name || null,
            heldItem: null,
            berries: S.activeWild.berries || { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
            learnableMoves: []
          };

          // Монстр должен помнить ТЕ ЖЕ атаки, что использовал в бою.
          // Раньше сюда попадал apiData.moves — произвольный порядок PokeAPI
          // (для Рапидаша там первым шёл Megahorn), из-за чего пойманный покемон
          // получал атаки, которых никогда не знал: «поймал с совсем другими».
          const battleMoves = (S.wildMovesDetailed || []).filter(Boolean).map((m: any) => {
            const slug = moveNameToSlug(m.name);
            return { move: { name: slug, url: `https://pokeapi.co/api/v2/move/${slug}/` } };
          });
          if (battleMoves.length) {
            S.activeWild.moves = battleMoves;
            newMon.apiData.moves = battleMoves;
          }

          // Friend Ball: set happiness to 200
          if (item === 'friendBall') {
            newMon.happiness = 200;
          }

          // DarkBall: +5 to all IVs (max 50)
          if (item === 'darkBall') {
            for (const s of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
              newMon.ivs[s] = Math.min(50, newMon.ivs[s] + 5);
            }
          }

          // SuperDarkBall: x2 механика дарка — +10 to all IVs (max 50)
          if (item === 'superDarkBall') {
            for (const s of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
              newMon.ivs[s] = Math.min(50, newMon.ivs[s] + 10);
            }
          }

          // Transfer held item from wild pokemon to GS.inventory
          if (S.activeWild.heldItem) {
            const heldLabel = getHeldItemName(S.activeWild.heldItem);
            appendToLog(`Покемон держал ${heldLabel}! Передано в рюкзак.`, false, 'catch');
            store.addItem(S.activeWild.heldItem);
            store.updateInventoryDisplay();
          }

          if (GS.myTeam.length < 6) {
            GS.myTeam.push(newMon);
          } else {
            if (GS.pcBoxes.length === 0) GS.pcBoxes.push([]);
            GS.pcBoxes[0].push(newMon);
            addNotification('📦 Покемон в PC', `${S.activeWild.name} отправлен в Бокс 1 (команда полна).`);
            appendToLog(`${S.activeWild.name} отправлен в PC (команда полна).`, false, 'catch');
          }
          GS.pokedexCaught.add(S.activeWild.name);
          GS.pokedexSeen.add(S.activeWild.name);
          // Эволюция сразу при поимке: пойманный высокоуровневый мон (Маджикарп 20)
          // иначе «просрочивал момент» и эволил только при следующей победе —
          // выглядело багом. Everstone блокирует, как в бою.
          if (newMon.heldItem !== 'everstone') {
            try {
              Promise.resolve(checkEvolution(newMon)).then((evoTarget) => {
                if (!evoTarget) return;
                return Promise.resolve(triggerEvolution(newMon, evoTarget.name)).then(() => {
                  if (evoTarget.shedBonus) return maybeGrantShedinja(newMon);
                });
              }).catch(() => {});
            } catch (_) { /* эволюция не роняет поимку */ }
          }
          // Достижения поимки: первая, команда 6, шайни, вехи покедекса
          checkAchievement('first_catch');
          if (GS.myTeam.length >= 6) checkAchievement('team_6');
          if (newMon.isShiny) checkAchievement('shiny_catch');
          const dexN = GS.pokedexCaught.size;
          if (dexN >= 50) checkAchievement('dex_50');
          if (dexN >= 100) checkAchievement('dex_100');
          if (POKEDEX_ALL.length > 0 && dexN >= POKEDEX_ALL.length) checkAchievement('dex_all');

          checkQuestProgress('catch_x', 1, undefined, { species: S.activeWild.name });

          // Жалоба 7 (спека 1.5): за поимку тоже капает EXP — как за нокаут
          // (baseExp × уровень / 7, см. handleWildFaintRewards). Деньги/дроп
          // за поимку не даём, только EXP активному + EXP Share остальным,
          // level-up и EV в пул (grantLevelUpEVs). Без фанатизма: эволюцию и
          // новые атаки здесь не триггерим (пойманный и так в команде).
          try {
            const caughtBase = (S.activeWild as any)?.base_experience || 50;
            let catchExp = calcCatchExp(caughtBase, S.wildLvl);
            if ((GS as any).serverFeatures?.double_exp) catchExp *= 2;
            if (S.activePlayerMon?.heldItem === 'luckyEgg') catchExp = Math.floor(catchExp * 1.5);
            if ((GS.currentLocationId || '').includes('trainingGrounds')) catchExp *= 10;
            if (catchExp > 0 && S.activePlayerMon) {
              if (S.activePlayerMon.exp === undefined) {
                S.activePlayerMon.exp = Math.pow(S.activePlayerMon.baseLevel, 3);
                S.activePlayerMon.expToNext = Math.pow(S.activePlayerMon.baseLevel + 1, 3);
              }
              const lvlNow = S.activePlayerMon.baseLevel + (S.activePlayerMon.candiesEaten || 0);
              if (lvlNow < 100) {
                S.activePlayerMon.exp += catchExp;
                appendToLog(`${S.activePlayerMon.apiData.name} получил ${catchExp} EXP за поимку!`);
              }
              if ((GS as any).expShareActive) {
                const shareExp = Math.floor(catchExp / 2);
                (GS.myTeam || []).forEach((mon: any) => {
                  if (mon !== S.activePlayerMon && mon.currentHp > 0 && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
                    if (mon.exp === undefined) {
                      mon.exp = Math.pow(mon.baseLevel, 3);
                      mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
                    }
                    mon.exp += shareExp;
                    while (mon.exp >= mon.expToNext && (mon.baseLevel + (mon.candiesEaten || 0)) < 100) {
                      mon.baseLevel++;
                      mon.expToNext = Math.pow(mon.baseLevel + 1, 3);
                      const oldMax = mon.maxHp;
                      const newMax = calculateStat(mon, 'hp', false);
                      mon.maxHp = newMax;
                      mon.currentHp += (newMax - oldMax);
                      const ev = grantLevelUpEVs(mon);
                      if (ev) appendToLog(`${mon.apiData.name}: +${ev.gain} EV в пул${ev.brace ? ' (скоба)' : ''} (всего ${ev.total})`, false, 'system');
                    }
                  }
                });
                if (shareExp > 0) appendToLog(`Остальная команда получила по ${shareExp} EXP!`);
              }
              while (S.activePlayerMon.exp >= S.activePlayerMon.expToNext && S.activePlayerMon.baseLevel < 100) {
                S.activePlayerMon.baseLevel++;
                S.activePlayerMon.expToNext = Math.pow(S.activePlayerMon.baseLevel + 1, 3);
                const oldMax = S.activePlayerMon.maxHp;
                const newMax = calculateStat(S.activePlayerMon, 'hp', false);
                S.activePlayerMon.maxHp = newMax;
                S.activePlayerMon.currentHp += (newMax - oldMax);
                appendToLog(`${S.activePlayerMon.apiData.name} достиг ${S.activePlayerMon.baseLevel} уровня!`);
                const evGain = grantLevelUpEVs(S.activePlayerMon);
                if (evGain) appendToLog(`Растёт: +${evGain.gain} EV в пул${evGain.brace ? ' (скоба)' : ''} (всего ${evGain.total})`, false, 'system');
              }
            }
          } catch (_) {}

          document.getElementById('battle-main-menu').style.display = 'none';
          document.getElementById('battle-end-menu').style.display = 'flex';
          // Поимка завершает бой так же, как победа. Раньше здесь не было
          // clearBattleState(), поэтому состояние боя оставалось в localStorage
          // и после перезагрузки восстанавливался бой с покемоном, которого
          // игрок уже поймал.
          battle.transition(BattlePhase.CAPTURE);
          battle.transition(BattlePhase.VICTORY);
          battle.transition(BattlePhase.IDLE);
          clearBattleState();
          store.autoSave();
        } else {
          appendToLog(`${S.activeWild.name.toUpperCase()} вырвался!`);
          setTimeout(() => { enemyTurn(); }, 1500);
        }
      }, 1000);

    } else if (item === 'potion') {
      if (store.getItemQty('potion') <= 0) return showToast('У вас нет Аптечек!', true);
      if (S.activePlayerMon.currentHp >= S.activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);

      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.removeItem('potion');
      store.updateInventoryDisplay();

      S.activePlayerMon.currentHp += 20;
      if (S.activePlayerMon.currentHp > S.activePlayerMon.maxHp) S.activePlayerMon.currentHp = S.activePlayerMon.maxHp;
      updatePlayerHpUI();

      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Аптечку! Здоровье ${S.activePlayerMon.apiData.name} восстановлено.`);

      setTimeout(() => {
          enemyTurn();
      }, 1500);
    } else if (item === 'superPotion') {
      if (store.getItemQty('superPotion') <= 0) return showToast('Нет Супер Аптечек!', true);
      if (S.activePlayerMon.currentHp >= S.activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.removeItem('superPotion');
      store.updateInventoryDisplay();
      S.activePlayerMon.currentHp += 50;
      if (S.activePlayerMon.currentHp > S.activePlayerMon.maxHp) S.activePlayerMon.currentHp = S.activePlayerMon.maxHp;
      updatePlayerHpUI();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Супер Аптечку! Здоровье ${S.activePlayerMon.apiData.name} восстановлено.`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (item === 'fullRestore') {
      if (store.getItemQty('fullRestore') <= 0) return showToast('Нет Полного Восстановления!', true);
      if (S.activePlayerMon.currentHp >= S.activePlayerMon.maxHp && !S.activePlayerMon.status) return showToast('Здоровье уже полное!', true);
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.removeItem('fullRestore');
      store.updateInventoryDisplay();
      S.activePlayerMon.currentHp = S.activePlayerMon.maxHp;
      cureStatus(S.activePlayerMon);
      document.getElementById('player-status-icon').innerText = '';
      updatePlayerHpUI();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали Полное Восстановление! ${S.activePlayerMon.apiData.name} полностью здоров!`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (item === 'evolutionStone') {
      if (store.getItemQty('evolutionStone') <= 0) return showToast('Нет Камней Эволюции!', true);
      (async () => {
        const evoTarget = await checkEvolution(S.activePlayerMon, true);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать!', true);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item', 1, item);
        store.removeItem('evolutionStone');
        store.updateInventoryDisplay();
        await triggerEvolution(S.activePlayerMon, evoTarget.name);
        updatePlayerHpUI();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`${S.activePlayerMon.apiData.name} эволюционировал!`);
        setTimeout(() => {
          enemyTurn();
        }, 1500);
      })();
    } else if (item === 'tm') {
      // Диск убран из игры (дисбаланс: учил любую атаку за 500)
      return showToast('Этот диск убран из игры.', true);
    } else if (HEAL_HP[item] !== undefined && !['potion', 'superPotion', 'fullRestore'].includes(item)) {
      // Аудит итемов: остальные лечилки (hyperPotion, maxPotion, воды, корни...)
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (S.activePlayerMon.currentHp >= S.activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);
      store.removeItem(item);
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.updateInventoryDisplay();
      const amt = HEAL_HP[item];
      S.activePlayerMon.currentHp = amt === 'full'
        ? S.activePlayerMon.maxHp
        : Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + (amt as number));
      updatePlayerHpUI();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! HP: ${S.activePlayerMon.currentHp}/${S.activePlayerMon.maxHp}.`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (['revive', 'maxRevive', 'sacredAsh', 'revivalHerb', 'maxHoney'].includes(item)) {
      // Аудит итемов: воскрешение в бою (выбор павшего из команды)
      const fainted = (GS.myTeam || []).map((m, i) => ({ m, i }))
        .filter(({ m }) => m && (m.currentHp ?? 1) <= 0);
      if (fainted.length === 0) return showToast('Павших покемонов нет!', true);
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      const full = item !== 'revive' && item !== 'revivalHerb';
      const doRevive = (entry: { m: any }) => {
        entry.m.currentHp = full ? entry.m.maxHp : Math.max(1, Math.floor(entry.m.maxHp / 2));
        store.removeItem(item);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item', 1, item);
        store.updateInventoryDisplay();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`Вы использовали ${itemDef(item).nameRu}! ${entry.m.nickname || entry.m.apiData?.name} воскрешён!`);
        setTimeout(() => {
          enemyTurn();
        }, 1500);
      };
      if (item === 'sacredAsh') {
        fainted.forEach(({ m }) => { m.currentHp = m.maxHp; });
        store.removeItem(item);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item', 1, item);
        store.updateInventoryDisplay();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`Священный пепел поднял всю команду!`);
        setTimeout(() => {
          enemyTurn();
        }, 1500);
      } else {
        showSelectionModal('Кого воскресить?', fainted.map(({ m }) => ({
          label: `Lv.${m.baseLevel + (m.candiesEaten || 0)} ${m.nickname || m.apiData?.name}`,
          subtitle: `HP: 0/${m.maxHp}`,
        })), (choiceIdx) => {
          const picked = fainted[choiceIdx];
          if (picked) doRevive(picked);
        }, true);
      }
    } else if (['sitrusBerry', 'oranBerry', 'lumBerry', 'chestoBerry', 'rawstBerry', 'cheriBerry', 'pechaBerry', 'aspearBerry', 'leppaBerry'].includes(item)) {
      // Аудит итемов: ягоды с немедленным эффектом — и в бою
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (item === 'sitrusBerry' || item === 'oranBerry') {
        if (S.activePlayerMon.currentHp >= S.activePlayerMon.maxHp) return showToast('Здоровье уже полное!', true);
        const amt = item === 'sitrusBerry' ? Math.floor(S.activePlayerMon.maxHp * 0.25) : 10;
        store.removeItem(item);
        S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + amt);
        updatePlayerHpUI();
      } else if (item === 'leppaBerry') {
        const idx = (S.activePlayerMon.movesPP || []).findIndex((pp: any) => pp && pp.current < pp.max);
        if (idx < 0) return showToast('Все PP уже полные!', true);
        store.removeItem(item);
        S.activePlayerMon.movesPP[idx].current = Math.min(S.activePlayerMon.movesPP[idx].max, S.activePlayerMon.movesPP[idx].current + 10);
        updateMoveButtonUIs();
      } else {
        const need = item === 'lumBerry' ? S.activePlayerMon.status : CURE_ONE[item];
        if (!S.activePlayerMon.status) return showToast('Статусов нет!', true);
        if (item !== 'lumBerry' && S.activePlayerMon.status !== need) return showToast('Эта ягода лечит другой статус!', true);
        store.removeItem(item);
        cureStatus(S.activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      }
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.updateInventoryDisplay();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}!`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (itemCategory(item) === 'statusCure') {
      // Аудит итемов: общая таблица с рюкзаком (одиночные + все разом)
      const targetStatus = CURE_ONE[item] || null;
      const curesAll = CURE_ALL.includes(item);
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (item === 'healingHerb') {
        if (!S.activePlayerMon.status) return showToast('У покемона нет статуса!', true);
        store.removeItem(item);
        cureStatus(S.activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      } else if (curesAll) {
        if (!S.activePlayerMon.status) return showToast('У покемона нет статуса!', true);
        store.removeItem(item);
        cureStatus(S.activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      } else if (targetStatus) {
        if (S.activePlayerMon.status !== targetStatus) return showToast('Этот предмет не лечит текущий статус!', true);
        store.removeItem(item);
        cureStatus(S.activePlayerMon);
        document.getElementById('player-status-icon').innerText = '';
      } else {
        return showToast('Этот предмет пока не работает в бою.', true);
      }
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.updateInventoryDisplay();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! Статус ${S.activePlayerMon.apiData.name} исцелён.`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (['ether', 'elixir', 'maxElixir', 'maxEther', 'leppaBerry'].includes(item)) {
      const elixirMap = { 'ether': 10, 'elixir': 20, 'maxElixir': 40, 'leppaBerry': 10 };
      // maxEther — полные PP всем атакам
      const ppRestore = item === 'maxEther' ? Infinity : elixirMap[item];
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (!S.activePlayerMon.movesPP || S.activePlayerMon.movesPP.every(pp => pp && pp.current >= pp.max)) {
        return showToast('PP уже полностью!', true);
      }
      store.removeItem(item);
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item', 1, item);
      store.updateInventoryDisplay();
      if (item === 'ether') {
        // Ether: восстанавливаем PP атаки с самым низким текущим PP
        let lowestIdx = -1, lowestVal = 999;
        for (let i = 0; i < 4; i++) {
          const pp = S.activePlayerMon.movesPP?.[i];
          if (pp && pp.current < pp.max && pp.current < lowestVal) {
            lowestVal = pp.current;
            lowestIdx = i;
          }
        }
        if (lowestIdx >= 0 && S.activePlayerMon.movesPP) {
          S.activePlayerMon.movesPP[lowestIdx].current = Math.min(
            S.activePlayerMon.movesPP[lowestIdx].max,
            S.activePlayerMon.movesPP[lowestIdx].current + ppRestore
          );
        }
      } else {
        // Elixir/Max Elixir: восстанавливаем PP всех атак
        for (let i = 0; i < 4; i++) {
          if (S.activePlayerMon.movesPP && S.activePlayerMon.movesPP[i]) {
            S.activePlayerMon.movesPP[i].current = Math.min(
              S.activePlayerMon.movesPP[i].max,
              S.activePlayerMon.movesPP[i].current + ppRestore
            );
          }
        }
      }
      updateMoveButtonUIs();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! PP восстановлено.`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (['xAttack', 'xDefense', 'xSpDef', 'xSpAtk', 'xSpeed', 'xAccuracy'].includes(item)) {
      const xMap = { 'xAttack': 'atk', 'xDefense': 'def', 'xSpDef': 'spd', 'xSpAtk': 'spa', 'xSpeed': 'spe', 'xAccuracy': null };
      const stat = xMap[item];
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (stat) {
        if (!S.activePlayerMon.statStages) S.activePlayerMon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        if (S.activePlayerMon.statStages[stat] >= 6) return showToast('Стат уже максимально повышен!', true);
        store.removeItem(item);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item', 1, item);
        store.updateInventoryDisplay();
        statStageModify(S.activePlayerMon, stat, 1);
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`Вы использовали ${itemDef(item).nameRu}! ${stat.toUpperCase()} повышен!`);
        setTimeout(() => {
          enemyTurn();
        }, 1500);
      } else {
        return showToast('Этот предмет пока не работает в бою.', true);
      }
    } else if (['pokeDoll', 'pokeToy', 'fluffyTail'].includes(item)) {
      // Куклы побега: только дикий бой, уход без штрафа (в отличие от кнопки
      // побега, где активный теряет сознание). Не работает против тренеров.
      if (S.battleType !== 'wild') return showToast('От тренеров куклой не сбежать!', true);
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      store.removeItem(item);
      store.updateInventoryDisplay();
      document.getElementById('battle-main-menu').style.display = 'none';
      fleeWildBattle(`${S.activePlayerMon.apiData.name} отвлекает врага ${itemDef(item).nameRu} и сбегает!`);
    } else if (itemCategory(item) === 'evolutionStones' && item !== 'evolutionStone') {
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      (async () => {
        const evoTarget = await checkEvolution(S.activePlayerMon, true, item);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item', 1, item);
        store.removeItem(item);
        store.updateInventoryDisplay();
        await triggerEvolution(S.activePlayerMon, evoTarget.name);
        updatePlayerHpUI();
        document.getElementById('battle-main-menu').style.display = 'none';
        appendToLog(`${S.activePlayerMon.apiData.name} эволюционировал!`);
        setTimeout(() => {
          enemyTurn();
        }, 1500);
      })();
    } else {
      showToast('Этот предмет нельзя использовать в бою.', true);
    }
  });

  // ═══ 15d: ВЫХОД ИЗ БОЯ ═══
  // Полная очистка: состояние боя, все стат-стадии, статусы, прогресс гима.
  // Раньше здесь не было перехода фазы в IDLE (в отличие от побега 15a): фаза
  // оставалась PLAYER_TURN/ENEMY_TURN/VICTORY/DEFEAT, и следующий startHunt()
  // делал transition(WILD_START) из не-IDLE — невалидный переход, warn в
  // консоль и грязный лог фаз. Та же классовая болезнь, что и залипание побега.
  on('btn-leave-battle', () => {
    const modal = document.getElementById('encounter-modal');
    if (modal) modal.style.display = 'none'; // Скрываем модалку
    clearBattleState();                                        // Удаляем localStorage
    leaveBattleToIdle(battle);                                 // Фаза → IDLE из любой фазы
    // Сбрасываем все поля боя
    S.gymTeamIndex = 0;
    S.gymTeamIndexInMember = 0;
    S.gymTeamData = null;
    S.battleType = 'wild';
    S.battleRound = 0;
    S.wildMovesPP = null;
    if (S.activePlayerMon) S.activePlayerMon.choiceLockedMove = undefined;
    // Очищаем стат-стадии и статусы всей команды
    GS.myTeam.forEach(m => {
      m.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      m.choiceLockedMove = undefined;
      m.status = null;
      m.sleepTurns = 0;
    });
    // Очищаем плашки статов в UI
    const playerBadges = document.getElementById('player-stat-badges');
    if (playerBadges) playerBadges.innerHTML = '';
    const wildBadges = document.getElementById('wild-stat-badges');
    if (wildBadges) wildBadges.innerHTML = '';
    store.autoSave();
  });
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 16: GYM/ELITE/CHAMPION СИСТЕМА
// ═══════════════════════════════════════════════════════════════
// Эти функции отвечают за бои с лидерами залов, Элитную Четвёрку и Чемпиона.
//
// ОТЛИЧИЯ ОТ WILD БОЯ:
//   - Нельзя сбежать
//   - Нельзя сменить покемона (кроме fainted)
//   - Команда должна быть 4+ живых, без дублирования типов
//   - Уровень покемонов не выше макс уровня лидера
//   - EXP за gym не даётся (кроме элиты и чемпиона)
//   - Gym/Elite покемоны имеют 50 IV во всех статах
//   - Gym лидеры дают бейджи и награды
//
// ПОРЯДОК ВЫЗОВА:
//   openGymModal(locId) → (кнопка) → startGymBattle → startGymNextPokemon → [победа → след. покемон / поражение]
//   openEliteModal() → (кнопка) → startEliteBattle → startEliteNextMember → startEliteNextPokemon → championBattle
//   championBattle → startChampionNextPokemon → [победа → Чемпион!]
// ─────────────────────────────────────────────────────────────

/**
 * openGymModal — показать модалку с информацией о лидере зала.
 * Показывает: имя, титул, тип покемонов, бейдж, команду, награды.
 * Проверяет условия перед боем: 4+ живых покемона, уникальные типы,
 *   уровень не выше лидера.
 *
 * ЧТО БЕРЁТ ИЗ: GS.gymLeaders[locId] (из gyms.ts)
 * ЧТО ПОКАЗЫВАЕТ: gym-modal в DOM
 */
function openGymModal(locId) {
  const leader = GS.gymLeaders[locId];
  const modal = document.getElementById('gym-modal');
  document.getElementById('gym-leader-name').innerText = leader.name;
  document.getElementById('gym-leader-title').innerText = leader.title;
  document.getElementById('gym-leader-type').innerText = `Тип: ${leader.type}`;
  document.getElementById('gym-leader-badge-icon').innerText = leader.badgeIcon || '🏅';
  const rewardItemName = itemDef(leader.rewardItem)?.nameRu || leader.rewardItem;
  document.getElementById('gym-reward').innerText = `${leader.badgeIcon || '🏅'} ${leader.badgeName} + ¥${leader.moneyReward} + ${rewardItemName}`;

  // Training display
  const trainInfo = document.getElementById('gym-training-info');
  const stageSymbols = ['','▲','▲','◆','◆','⭐','⭐'];
  const stageNames = ['','Начальная','Расширенная','Мастерская','Знаменитая','Легендарная','Именная'];
  if (leader.trainingStage) {
    const sym = stageSymbols[leader.trainingStage] || '▲';
    trainInfo.innerHTML = `${sym} Тренировка покемонов: <b>${stageNames[leader.trainingStage] || ''}</b> (+${[0,10,18,25,31,36,40][leader.trainingStage]}% к статам)`;
  } else {
    trainInfo.innerHTML = '';
  }

  const teamList = document.getElementById('gym-team-list');
  teamList.innerHTML = '';
  leader.team.forEach((member, i) => {
    const li = document.createElement('li');
    const sym = leader.trainingStage ? (stageSymbols[leader.trainingStage] || '▲') + ' ' : '';
    li.innerText = `${sym}${member.name} Lv${member.level}`;
    teamList.appendChild(li);
  });

  modal.style.display = 'flex';
  document.getElementById('btn-start-gym-battle').onclick = () => {
    // Validate team before battle
    const team = GS.myTeam.filter(m => m.currentHp > 0);
    if (team.length < 4) {
      showToast('У вас должно быть минимум 4 живых покемона для битвы с лидером!', true);
      return;
    }
    // Check level cap: no pokemon above gym leader's level
    const maxGymLvl = Math.max(...leader.team.map(m => m.level));
    const overleveled = team.filter(m => (m.baseLevel + (m.candiesEaten || 0)) > maxGymLvl);
    if (overleveled.length > 0) {
      const names = overleveled.map(m => m.nickname || m.apiData?.name || '?').join(', ');
      showToast(`Ваши покемоны выше уровнем, чем лидер! Уберите: ${names} (макс ${maxGymLvl} лв)`, true);
      return;
    }
    // Check type duplicates: each pokemon must have a unique primary type
    const primaryTypes = team.map(m => m.apiData?.types?.[0]?.type?.name).filter(Boolean);
    const dupes = primaryTypes.filter((t, i) => primaryTypes.indexOf(t) !== i);
    if (dupes.length > 0) {
      const uniqueDupes = [...new Set(dupes)].join(', ');
      showToast(`В команде есть повторяющиеся типы: ${uniqueDupes}. Смените покемонов!`, true);
      return;
    }

    modal.style.display = 'none';
    startGymBattle(locId);
  };
}

function initGymEvents() {
  document.getElementById('btn-close-gym-modal').addEventListener('click', () => {
    document.getElementById('gym-modal').style.display = 'none';
  });
  document.getElementById('btn-close-elite-modal').addEventListener('click', () => {
    document.getElementById('elite-modal').style.display = 'none';
  });
}

/**
 * startGymBattle — начать битву с лидером зала.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Устанавливает battleType = 'gym', gymLeaderKey, gymTeamData (клонированная команда)
 *   2. Находит первого живого покемона в команде
 *   3. Рендерит UI с инфой о лидере
 *   4. Запускает startGymNextPokemon — первого покемона лидера
 *
 * КОМАНДА ЛИДЕРА: клонируется через JSON.parse(JSON.stringify) чтобы
 * не мутировать оригинальные данные из gyms.ts.
 *
 * ТРЕБОВАНИЯ: минимум 4 живых покемона (проверка в openGymModal)
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: из openGymModal по нажатию "Начать битву"
 */
async function startGymBattle(locId) {
  GS.itemsUsedInBattle = 0;
  S.battleRound = 0;
  const leader = GS.gymLeaders[locId];
  const activeMonIndex = GS.myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) {
    return showToast('Вам нужен хотя бы один живой покемон для битвы!', true);
  }

  S.battleType = 'gym';
  S.gymLeaderKey = locId;
  S.gymTeamIndex = 0;
  S.gymTeamData = JSON.parse(JSON.stringify(leader.team)); // Клонируем команду лидера (deep copy)

  battle.transition(BattlePhase.GYM_START); // Фаза: начало гима

  S.activePlayerMon = GS.myTeam[activeMonIndex];
  S.activePlayerMon.choiceLockedMove = undefined;

  document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
  (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
  updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
  document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);

  const modal = document.getElementById('encounter-modal');
  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'block';
  const stageSymbols = ['','▲','▲','◆','◆','⭐','⭐'];
  const stageSym = stageSymbols[leader.trainingStage] || '';
  document.getElementById('gym-leader-battle-name').innerText = `Лидер: ${leader.name} ${stageSym}`;
  const trainEl = document.getElementById('gym-training-display');
  if (leader.trainingStage) {
    const stageName = ['','Начальная','Расширенная','Мастерская','Знаменитая','Легендарная','Именная'][leader.trainingStage] || '';
    trainEl.innerText = `⚡Тренировка: ${stageName} (+${[0,10,18,25,31,36,40][leader.trainingStage]}%)`;
  } else {
    trainEl.innerText = '';
  }
  appendToLog(`Вызов лидера ${leader.name}!`, true);
  modal.style.display = 'flex';

  await startGymNextPokemon();
}

/**
 * startGymNextPokemon — выпустить следующего покемона лидера зала.
 *
 * ЕСЛИ ВСЯ КОМАНДА ЛИДЕРА ПОБЕЖДЕНА:
 *   - Выдаёт бейдж (GS.gymBadges.push)
 *   - Выдаёт денежную награду
 *   - Показывает экран победы
 *   - Вызывает store.showGymRewardSelection (рандом-приз: мячи или мон)
 *   - Показывает battle-end-menu
 *
 * ЕСЛИ ЕСТЬ СЛЕДУЮЩИЙ ПОКЕМОН:
 *   - Загружает данные из PokeAPI
 *   - Устанавливает Perfect IVs (50) для всех статов
 *   - Применяет тренировочный бонус лидера (если есть trainingStage)
 *   - Умный выбор атак: STAB > coverage > статус-атаки
 *   - Рендерит UI, проверяет Intimidate
 *
 * УМНЫЙ ВЫБОР АТАК:
 *   1. Определяет физический или специальный тип атакера (по статам)
 *   2. Cортирует атаки, выбирает лучшие STAB (до 2)
 *   3. Заполняет Coverage атаками других типов
 *   4. Добавляет лучшую статус-атаку если есть слот
 *   5. Избегает дублирования типов атак
 *
 * ГДЕ ВЫЗЫВАЕТСЯ: startGymBattle, handleWildFaintRewards (после победы над покемоном)
 */
async function startGymNextPokemon() {
  if (S.gymTeamIndex >= S.gymTeamData.length) {
    // ── ПОБЕДА НАД ВСЕЙ КОМАНДОЙ ЛИДЕРА — server-authoritative ──
    const leader = GS.gymLeaders[S.gymLeaderKey];
    // Мини-босс (friendly): без значка/денег/призов гима. Только лог,
    // счётчик побед и трек для квеста. Реванши бесконечные.
    if (leader.friendly) {
      appendToLog(`Победа над ${leader.name}!`);
      GS.battleWins = (GS.battleWins || 0) + 1;
      trackNPCQuests('boss_win', { bossId: S.gymLeaderKey });
      document.getElementById('battle-main-menu').style.display = 'none';
      document.getElementById('battle-end-menu').style.display = 'flex';
      return;
    }
    // N4: награда (значок + шини + предметы) — только за первую победу.
    // Реванш: сервер ответит 409, выбор награды не показываем.
    const firstWin = Array.isArray(state.badges) && !state.badges.includes(leader.badgeName);

    // Запрашиваем награду у сервера
    try {
      const resp = await apiFetch('/economy/badge-reward', {
        method: 'POST',
        body: JSON.stringify({ locId: S.gymLeaderKey }),
        headers: { 'Content-Type': 'application/json' },
      });
      if (resp.ok) {
        const data = await resp.json();
        // Гард от дублей (значков было 32 вместо 16): сервер мог выдать 200
        // повторно (ретрай после таймаута), а push шёл безусловно.
        if (!state.badges.includes(data.badgeName)) {
          state.badges.push(data.badgeName);                               // Добавляем бадж (из ответа сервера)
        }
        store.giveReward(data.moneyReward, []);                          // Деньги (из ответа сервера)
        checkQuestProgress('earn_money', data.moneyReward);
        appendToLog(`Победа! Вы получили ${data.badgeName} и ¥${data.moneyReward}!`);
        store.updateMoneyDisplay();
        (await import('../ui/location.js')).updateBadgeDisplay();
      } else if (resp.status === 409) {
        // Бадж уже есть — это нормально (перезапрос), всё равно показываем победу
        appendToLog(`Победа! (бадж ${leader.badgeName} уже получен)`);
      } else {
        const err = await resp.json().catch(() => ({}));
        appendToLog(`Ошибка сервера: ${err.error || 'неизвестная'}`);
      }
    } catch (e) {
      console.error('[gym] badge-reward error:', e);
      appendToLog('Ошибка связи с сервером, награда выдана локально');
      // Fallback: выдаём локально если сервер недоступен (тоже с гардом от дублей)
      if (!state.badges.includes(leader.badgeName)) {
        state.badges.push(leader.badgeName);
      }
      store.giveReward(leader.moneyReward, []);
      checkQuestProgress('earn_money', leader.moneyReward);
      store.updateMoneyDisplay();
      (await import('../ui/location.js')).updateBadgeDisplay();
    }

    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    // Победа над лидером — ачивки и счётчик побед
    checkAchievement('beat_gym');
    GS.battleWins = (GS.battleWins || 0) + 1;
    if (GS.battleWins >= 100) checkAchievement('trainer_100');
    if (firstWin) setTimeout(() => store.showGymRewardSelection(S.gymLeaderKey), 300);
    else appendToLog('Реванш засчитан. Награда выдаётся только за первую победу.', false, 'system');
    return;
  }

  const member = S.gymTeamData[S.gymTeamIndex];
  try {
    S.activeWild = await fetchPokeAPI(`pokemon/${member.name.replace('_2', '')}`);
    S.wildLvl = member.level;
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.currentWeather = getDailyWeather(GS.currentLocationId);
    resetBattleField(); // фикс: поле/vol не текут между боями
    S.enemyChargedMove = null; // Сброс заряда при смене покемона гима

    // Perfect IVs for gym leader pokemon
    S.activeWild.wildIVs = perfectIVs();

    // Apply gym leader training boost
    const leaderData = GS.gymLeaders[S.gymLeaderKey];
    if (leaderData.trainingStage) {
      S.activeWild.trainingStage = leaderData.trainingStage;
      const statOrder = ['atk','spa','spe','def','spd'];
      let bestStat = 'atk', bestVal = 0;
      const statNames = { atk: 'attack', spa: 'special-attack', spe: 'speed', def: 'defense', spd: 'special-defense' };
      for (const s of statOrder) {
        const v = S.activeWild.stats.find(st => st.stat.name === statNames[s])?.base_stat || 0;
        if (v > bestVal) { bestVal = v; bestStat = s; }
      }
      S.activeWild.trainingStat = bestStat;
    }

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;
    S.escapeAttempts = 0;

    // Smart move selection: ensure type coverage, STAB, 1 status move
    const pokeStats = S.activeWild.stats;
    const spAtk = pokeStats.find(s => s.stat.name === 'special-attack')?.base_stat || 50;
    const atkStat = pokeStats.find(s => s.stat.name === 'attack')?.base_stat || 50;
    const isSpecialAttacker = spAtk > atkStat;
    const wildTypes = S.activeWild.types.map(t => t.type?.name).filter(Boolean);
    const movePool = S.activeWild.moves.slice().sort((a, b) => {
      return (b.version_group_details?.[0]?.level_learned_at || 0) - (a.version_group_details?.[0]?.level_learned_at || 0);
    }).slice(0, 30);
    const moveResults3 = (await Promise.all(movePool.map(m =>
      fetchSiteMoveDetail(m).catch(() => null)
    ))).filter(Boolean);
    // H2: даже умный подбор — только из атак по уровню (S.wildLvl = уровень
    // текущего покемона лидера). Без фильтра сюда попадали топ-атаки вида.
    const eligible3 = filterMovesByLevel(moveResults3, S.wildLvl);
    // Categorize moves
    const stabMoves = [], coverageMoves = [], statusMoves = [];
    for (const m of eligible3) {
      const isSpMove = m.damage_class?.name === 'special';
      const statFit = (isSpecialAttacker && isSpMove) || (!isSpecialAttacker && !isSpMove);
      const isStab = wildTypes.includes(m.type?.name);
      if (m.power) {
        const entry = { move: m, power: m.power, statFit };
        if (isStab) stabMoves.push(entry);
        else coverageMoves.push(entry);
      } else {
        statusMoves.push(m);
      }
    }
    // Sort by power, prefering stat-fit moves
    const sortFn = (a, b) => (b.statFit ? b.power : b.power * 0.8) - (a.statFit ? a.power : a.power * 0.8);
    stabMoves.sort(sortFn);
    coverageMoves.sort(sortFn);
    // Pick best 3 attacking moves: prefer 2 STAB + 1 coverage, avoid duplicate types
    const chosen = [];
    const usedTypes = new Set();
    const picker = (pool, count) => {
      for (const entry of pool) {
        if (chosen.length >= count) break;
        const mType = entry.move.type?.name;
        if (!usedTypes.has(mType) || chosen.length < 2) {
          chosen.push(entry.move);
          usedTypes.add(mType);
        }
      }
    };
    picker(stabMoves, 2); // at least 1 STAB
    picker(coverageMoves, 3); // fill with coverage
    picker(stabMoves, 4); // fallback: any STAB
    // Add best status move if slot remains
    if (chosen.length < 4 && statusMoves.length > 0) {
      const keyStatus = ['will-o-wisp','thunder-wave','toxic','hypnosis','spore','swords-dance','nasty-plot','calm-mind','bulk-up','dragon-dance','agility','recover','roost','moonlight','reflect','light-screen','substitute','protect'];
      const ranked = statusMoves.map(m => ({ move: m, score: keyStatus.includes(m.name) ? 1 : 0 }));
      ranked.sort((a, b) => b.score - a.score);
      chosen.push(ranked[0].move);
    }
    // Trim to 4
    S.wildMovesDetailed = chosen.slice(0, 4);
    S.wildMovesPP = S.wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = S.activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl}`;
    let wildSpriteUrl;
    if (S.battleType === 'gym') {
      wildSpriteUrl = S.activeWild.sprites?.other?.['official-artwork']?.front_shiny || S.activeWild.sprites?.front_shiny || S.activeWild.sprites?.other?.['official-artwork']?.front_default || S.activeWild.sprites.front_default;
    } else {
      wildSpriteUrl = getSpriteUrl({ apiData: S.activeWild, isShiny: S.activeWild.isShiny || false });
    }
    (document.getElementById('wild-sprite') as HTMLImageElement).src = wildSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();
    // Gym visual indicator
    const wildBox = document.querySelector('#wild-sprite').parentElement;
    if (S.battleType === 'gym') {
      wildBox.classList.add('gym-wild');
      const stageSymbols = ['','▲','▲','◆','◆','⭐','⭐'];
      const stageSym = stageSymbols[leaderData.trainingStage] || '';
      document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl} ${stageSym}`;
    } else {
      wildBox.classList.remove('gym-wild');
    }

    appendToLog(`${GS.gymLeaders[S.gymLeaderKey].name} выпускает ${S.activeWild.name}! (${S.gymTeamIndex + 1}/${S.gymTeamData.length})`);

    // Intimidate check
    const wildAbility = S.activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(S.activePlayerMon, 'atk', -1, true);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }
    // Погодные способности срабатывают в тот же момент, что и Intimidate —
    // при выходе на поле. Раньше здесь был только Intimidate.
    applyWeatherAbility(wildAbility, S.activeWild.name);
    // Остальные способности выхода: Download, Trace, Frisk.
    applySwitchInAbilities(S.activeWild, true, S.activePlayerMon);

    // Set up player moves
    loadMoveButtons(S.activePlayerMon, useMove);

    // Set phase so player can attack
    battle.transition(BattlePhase.PLAYER_TURN);

    // Бой с залом тоже должен переживать перезагрузку до первого действия игрока:
    // иначе теряется не только встреча, но и прогресс по лидеру (gymTeamIndex).
    saveBattleState();

  } catch (e) {
    appendToLog('Ошибка загрузки покемона лидера...');
  }
  // Show the battle menu so player can attack next wild pokemon
  document.getElementById('battle-main-menu').style.display = 'flex';
}

async function useMoveGym(moveIndex) {
  return useMove(moveIndex);
}

function enemyTurnGym() {
  return enemyTurn();
}

function handleGymPlayerFaint() {
  return handlePlayerFaint();
}

// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 16B: ЭЛИТНАЯ ЧЕТВЁРКА + ЧЕМПИОН
// ═══════════════════════════════════════════════════════════════
// openEliteModal — показать модалку с информацией о членах Элитной Четвёрки.
// startEliteBattle — начало прохождения Элитной Четвёрки (последовательно).
// startEliteNextMember — переход к следующему члену Элитной Четвёрки.
// startEliteNextPokemon — выпустить следующего покемона текущего члена.
// championBattle — бой с Чемпионом после победы над всей Элитной Четвёркой.
// startChampionNextPokemon — выпустить следующего покемона Чемпиона.
// ─────────────────────────────────────────────────────────────

/**
 * openEliteModal — показать модалку Элитной Четвёрки.
 * Отображает всех 4 членов + Чемпиона с их командами.
 * Кнопка "Начать" запускает startEliteBattle().
 */
function openEliteModal() {
  const modal = document.getElementById('elite-modal');
  const list = document.getElementById('elite-member-list');
  list.innerHTML = '';

  GS.eliteFour.forEach((member, i) => {
    const div = document.createElement('div');
    div.className = 'elite-member-card';
    div.innerHTML = `
      <strong>${member.name}</strong> — ${member.title}
      <span style="font-size:0.75rem;color:#666;">Команда: ${member.team.map(t => t.name).join(', ')}</span>
    `;
    list.appendChild(div);
  });

  const championDiv = document.createElement('div');
  championDiv.className = 'elite-member-card champion';
  championDiv.innerHTML = `
    <strong>${GS.champion.name}</strong> — ${GS.champion.title}
    <span style="font-size:0.75rem;color:#666;">Команда: ${GS.champion.team.map(t => t.name).join(', ')}</span>
  `;
  list.appendChild(championDiv);

  modal.style.display = 'flex';
  document.getElementById('btn-start-elite-battle').onclick = () => {
    modal.style.display = 'none';
    startEliteBattle();
  };
}

async function startEliteBattle() {
  GS.itemsUsedInBattle = 0;
  S.battleRound = 0;
  S.battleType = 'elite';
  S.gymTeamIndex = 0;

  battle.transition(BattlePhase.ELITE_START);

  const activeMonIndex = GS.myTeam.findIndex(m => m.currentHp > 0);
  if (activeMonIndex === -1) return showToast('Вам нужен хотя бы один живой покемон!', true);
  S.activePlayerMon = GS.myTeam[activeMonIndex];
  S.activePlayerMon.choiceLockedMove = undefined;

  document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
  document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
  const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
  (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
  updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
  document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);

  const modal = document.getElementById('encounter-modal');
  document.getElementById('battle-main-menu').style.display = 'flex';
  document.getElementById('battle-end-menu').style.display = 'none';
  document.getElementById('battle-gym-info').style.display = 'block';
  document.getElementById('gym-leader-battle-name').innerText = 'Элитная Четверка';
  appendToLog('Элитная Четверка — Начало!', true);
  modal.style.display = 'flex';

  await startEliteNextMember();
}

async function startEliteNextMember() {
  if (S.gymTeamIndex >= GS.eliteFour.length) {
    // Вся Элита пройдена — ачивка перед боем с чемпионом
    checkAchievement('beat_elite');
    S.battleType = 'champion';
    await championBattle();
    return;
  }

  const member = GS.eliteFour[S.gymTeamIndex];
  S.gymTeamData = JSON.parse(JSON.stringify(member.team));
  S.gymTeamIndexInMember = 0;
  appendToLog(`--- ${member.name} (${member.title}) ---`);
  await startEliteNextPokemon();
}

async function startEliteNextPokemon() {
  // If all pokemon of this elite member are defeated
  if (S.gymTeamIndexInMember >= S.gymTeamData.length) {
    store.giveReward(GS.eliteFour[S.gymTeamIndex].moneyReward, []);
    checkQuestProgress('earn_money', GS.eliteFour[S.gymTeamIndex].moneyReward);
    store.updateMoneyDisplay();
    S.gymTeamIndex++;
    S.gymTeamData = null;
    S.gymTeamIndexInMember = 0;
    setTimeout(() => { startEliteNextMember(); }, 1500);
    return;
  }

  const member = S.gymTeamData[S.gymTeamIndexInMember];
  try {
    S.activeWild = await fetchPokeAPI(`pokemon/${member.name.replace('_2', '')}`);
    S.wildLvl = member.level;
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.currentWeather = getDailyWeather(GS.currentLocationId);
    resetBattleField(); // фикс: поле/vol не текут между боями
    S.enemyChargedMove = null; // Сброс заряда при смене покемона элиты

    // Perfect IVs для Elite Four (как у gym лидеров)
    S.activeWild.wildIVs = perfectIVs();

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;
    S.escapeAttempts = 0;

    S.wildMovesDetailed = await resolveWildMoveset(S.activeWild, S.wildLvl);
    S.wildMovesPP = S.wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = S.activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl}`;
    const wildSpriteUrl = getSpriteUrl({ apiData: S.activeWild, isShiny: S.activeWild.isShiny || false });
    (document.getElementById('wild-sprite') as HTMLImageElement).src = wildSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    appendToLog(`${GS.eliteFour[S.gymTeamIndex].name} выпускает ${S.activeWild.name}!`);

    // Intimidate check
    const wildAbility = S.activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(S.activePlayerMon, 'atk', -1, true);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }
    // Погодные способности срабатывают в тот же момент, что и Intimidate —
    // при выходе на поле. Раньше здесь был только Intimidate.
    applyWeatherAbility(wildAbility, S.activeWild.name);
    // Остальные способности выхода: Download, Trace, Frisk.
    applySwitchInAbilities(S.activeWild, true, S.activePlayerMon);

    // Set up player moves for elite battle
    loadMoveButtons(S.activePlayerMon, useMove);
    battle.transition(BattlePhase.PLAYER_TURN);

    // Элитная четвёрка: та же причина, что и у зала — состояние боя обязано
    // пережить перезагрузку до первого хода игрока.
    saveBattleState();

    // Player UI refresh
    document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
    (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
    updatePlayerHpUI();
    document.getElementById('battle-main-menu').style.display = 'flex';

  } catch (e) {
    appendToLog('Ошибка загрузки...');
  }
}

/**
 * championBattle — начать финальный бой с Чемпионом.
 * Вызывается после победы над всей Элитной Четвёркой (startEliteNextMember).
 * Устанавливает battleType = 'champion', загружает команду чемпиона.
 *
 * ПОБЕДА НАД ЧЕМПИОНОМ:
 *   - Денежная награда (GS.champion.moneyReward)
 *   - Сообщение "ПОБЕДА! Вы стали Чемпионом Лиги!"
 *   - Сброс gymTeamIndex, battleType → 'wild'
 *   - Автосохранение
 */
async function championBattle() {
  GS.itemsUsedInBattle = 0;
  S.battleRound = 0;
  S.gymTeamData = JSON.parse(JSON.stringify(GS.champion.team)); // Клонируем команду чемпиона
  S.gymTeamIndexInMember = 0;
  S.battleType = 'champion';
  appendToLog(`--- ${GS.champion.name} вызывает вас! ---`);
  await startChampionNextPokemon();
}

async function startChampionNextPokemon() {
  if (S.gymTeamIndexInMember >= S.gymTeamData.length) {
    store.giveReward(GS.champion.moneyReward, []);
    checkQuestProgress('earn_money', GS.champion.moneyReward);
    store.updateMoneyDisplay();
    appendToLog('ПОБЕДА! Вы стали Чемпионом Лиги!');
    // Победа над чемпионом — ачивки и счётчик побед
    checkAchievement('beat_champion');
    GS.battleWins = (GS.battleWins || 0) + 1;
    if (GS.battleWins >= 100) checkAchievement('trainer_100');
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    S.gymTeamIndex = 0;
    S.gymTeamData = null;
    S.battleType = 'wild';
    store.autoSave();
    return;
  }

  const member = S.gymTeamData[S.gymTeamIndexInMember];
  try {
    S.activeWild = await fetchPokeAPI(`pokemon/${member.name.replace('_2', '')}`);
    S.wildLvl = member.level;
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.currentWeather = getDailyWeather(GS.currentLocationId);
    resetBattleField(); // фикс: поле/vol не текут между боями
    S.enemyChargedMove = null; // Сброс заряда при смене покемона чемпиона

    // Perfect IVs для Чемпиона (как у gym лидеров)
    S.activeWild.wildIVs = perfectIVs();

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;

    S.wildMovesDetailed = await resolveWildMoveset(S.activeWild, S.wildLvl);
    S.wildMovesPP = S.wildMovesDetailed.map(m => ({ current: m.pp || 30, max: m.pp || 30 }));

    document.getElementById('wild-name').innerText = S.activeWild.name;
    document.getElementById('wild-lvl').innerText = `Lv${S.wildLvl}`;
    const wildSpriteUrl = getSpriteUrl({ apiData: S.activeWild, isShiny: S.activeWild.isShiny || false });
    (document.getElementById('wild-sprite') as HTMLImageElement).src = wildSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('wild-status-icon').innerText = '';
    updateWildHpUI();

    appendToLog(`${GS.champion.name} выпускает ${S.activeWild.name}!`);

    // Intimidate check
    const wildAbility = S.activeWild.abilities?.[0]?.ability?.name;
    if (wildAbility === 'intimidate') {
      statStageModify(S.activePlayerMon, 'atk', -1, true);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }
    // Погодные способности срабатывают в тот же момент, что и Intimidate —
    // при выходе на поле. Раньше здесь был только Intimidate.
    applyWeatherAbility(wildAbility, S.activeWild.name);
    // Остальные способности выхода: Download, Trace, Frisk.
    applySwitchInAbilities(S.activeWild, true, S.activePlayerMon);

    // Set up player moves for GS.champion battle
    loadMoveButtons(S.activePlayerMon, useMove);
    battle.transition(BattlePhase.PLAYER_TURN);

    // Бой с чемпионом — последний в цепочке, терять его из-за F5 дороже всего.
    saveBattleState();

    // Player UI refresh
    document.getElementById('player-name').innerText = S.activePlayerMon.nickname || S.activePlayerMon.apiData.name;
    document.getElementById('player-lvl').innerText = `Lv${S.activePlayerMon.baseLevel + S.activePlayerMon.candiesEaten}`;
    const playerSpriteUrl = getSpriteUrl(S.activePlayerMon);
    (document.getElementById('player-sprite') as HTMLImageElement).src = playerSpriteUrl;
    updateBattleSpriteBgs(S.activePlayerMon, S.activeWild);
    document.getElementById('player-status-icon').innerText = getStatusIcon(S.activePlayerMon.status);
    updatePlayerHpUI();
    document.getElementById('battle-main-menu').style.display = 'flex';

  } catch (e) {
    appendToLog('Ошибка загрузки...');
  }
}


// ═══════════════════════════════════════════════════════════════
// СЕКЦИЯ 17: STATE ACCESSORS (ГЕТТЕРЫ/СЕТТЕРЫ)
// ═══════════════════════════════════════════════════════════════
// Используются для безопасного чтения/записи состояния боя из других модулей.
// getBattleVars — возвращает копию состояния + itemsUsedInBattle.
// setBattleVars — устанавливает поля из объекта (с обработкой itemsUsedInBattle).
// ─────────────────────────────────────────────────────────────

/** getBattleVars — получить копию всех переменных боя */
function getBattleVars() {
  return { ...battle.state, itemsUsedInBattle: GS.itemsUsedInBattle };
}

/** setBattleVars — установить переменные боя из объекта */
function setBattleVars(updates: Record<string, any>) {
  for (const [k, v] of Object.entries(updates)) {
    if (k === 'itemsUsedInBattle') {
      GS.itemsUsedInBattle = v;     // itemsUsedInBattle в GS, не в battle.state
    } else {
      (battle.state as any)[k] = v;
    }
  }
}

// ── getBattleDexSpecies: виды активных покемонов для кнопок 📖 в бою ──
// Возвращает {player, wild} — имена видов (species), null если боя нет.
// Используется в init.ts: кнопки в шапке боя открывают покедекс по виду,
// чтобы в бою посмотреть тип и данные покемона (как 📖 в команде).
function getBattleDexSpecies() {
  const p = S.activePlayerMon;
  const player = p ? (p.apiData?.species?.name || p.apiData?.name || null) : null;
  const w = S.activeWild;
  const wild = w ? (w.name || null) : null;
  return { player, wild };
}

// ═══════════════════════════════════════════════════════════════
// ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════
// Экспортируются ВСЕ функции, которые могут понадобиться другим модулям.
// Основные экспорты:
//   battle — инстанс BattleStateMachine (фазы, переходы)
//   useMove / enemyTurn — основные функции атак
//   startHunt / startAutoHunt — начало боя
//   saveBattleState / restoreBattleState — персистентность
//   openGymModal / startGymBattle — gym бой
//   startMiniBossBattle(leaderKey) — дружеский бой с мини-боссом (без значка)
//   openEliteModal / startEliteBattle — элита
//   championBattle / startChampionNextPokemon — чемпион
//   Множество утилит: calculateStat, getStatusIcon, switchPokemon и т.д.
// ─────────────────────────────────────────────────────────────
export { saveBattleState, clearBattleState, restoreBattleState, renderBattleUI, getTypeMultiplier, calculateStat, appendToLog, getAbilityName, statStageModify, updateStatBadges, clearUsedItem, checkBerryAutoUse, giveBerryToMon, generateDailyQuests, checkQuestProgress, claimQuestReward, openQuests, renderQuests, loadPokedexData, getStatusIcon, applyStatusEffect, cureStatus, checkStatusTurn, applyStatusEndOfTurn, switchPokemon, pickWeightedEncounter, getWildLevel, getLocationEncounters, startAutoHunt, stopAutoHunt, getBestRod, startHunt, loadMoveButtons, updateMoveButtonUI, updateMoveButtonUIs, updateWildHpUI, updatePlayerHpUI, useMove, handlePlayerFaint, enemyTurn, initEncounterEvents, openGymModal, initGymEvents, startGymBattle, startGymNextPokemon, useMoveGym, enemyTurnGym, handleGymPlayerFaint, openEliteModal, startEliteBattle, startEliteNextMember, startEliteNextPokemon, championBattle, startChampionNextPokemon, getBattleVars, setBattleVars, getBattleDexSpecies };

/**
 * startMiniBossBattle — бой с именным противником (квест «Кулачный боец»).
 * Тот же gym-движок, но лидер friendly: без значка, денег и призов гима.
 * Реванши бесконечные. Нужен хоть один живой покемон.
 */
export async function startMiniBossBattle(leaderKey: string): Promise<void> {
  const leader = GS.gymLeaders[leaderKey];
  if (!leader || !leader.friendly) {
    showToast('Этот боец сейчас недоступен!', true);
    return;
  }
  await startGymBattle(leaderKey);
}
