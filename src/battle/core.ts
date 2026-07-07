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
import { showToast, showSelectionModal } from '../utils/dom.js';         // showToast — всплывающее уведомление; showSelectionModal — модалка выбора из списка
import { itemDef } from '../utils/items.js';                              // itemDef(id) → { nameRu, price, ... } — данные предмета по ID
import { getSpriteUrl, updateBattleSpriteBgs } from '../utils/sprite.js'; // getSpriteUrl — URL спрайта покемона; updateBattleSpriteBgs — фон битвы
import { fetchPokeAPI } from '../utils/api.js';                          // fetchPokeAPI — GET к PokeAPI с кэшированием
import { checkEvolution, triggerEvolution } from '../ui/evolution.js';   // Эволюция: проверка и запуск анимации
import { natures } from '../data/natures.js';                            // Массив характеров (nature) с buff/nerf модификаторами
import { ITEMS } from '../data/items.js';                                // Массив всех предметов игры (ItemDef[])
import { checkNewMovesOnLevelUp } from '../ui/levelup_moves.js';         // Проверка новых атак при повышении уровня
// Импорт чистых функций из logic.ts — все БЕЗ сайд-эффектов, работают с переданными данными
import { calculateDamage, getTypeMultiplier, checkAccuracy, isStatusImmune, checkSuckerPunchFail, checkSturdy } from './logic.js';
import { selectEnemyMove } from './ai.js';                               // AI: выбирает атаку для противника на основе ситуации
import { store } from '../game/store.js';                                 // store — центральная игровая логика (giveReward, autoSave, updateInventoryDisplay, addItem, removeItem)
import { state } from '../game/state.js';                                 // state — глобальное состояние игры (инвентарь, команда, локация)
import { generateUID, getTrainerId } from '../utils/state.js';           // generateUID — уникальный ID для пойманного покемона; getTrainerId — ID тренера
import { itemCategory } from '../utils/items.js';                        // itemCategory(id) → категория предмета (healing, ball, statusCure...)
import { getHeldItemName } from '../ui/inventory.js';                    // getHeldItemName — русское название предмета для сообщений
import { WEATHER_ICONS, WEATHER_NAMES, getDailyWeather } from '../data/weather.js'; // Погода: конфиги, иконки, имена, дневная погода по локации, множитель урона
import { QUEST_CONFIGS } from '../data/quests.js';                       // Все конфиги квестов (заданий)

// ── ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ (из main.ts) ─────────────────────
// Эти переменные объявлены в main.ts через var/let и доступны во всех модулях.
// TypeScript не знает о них — используем declare чтобы TS не ругался.
declare const pcBoxes: any[];        // PC Boxes — хранилище покемонов (массив массивов), используется когда команда полна (6 покемонов)
declare function addNotification(title: string, text: string): void;  // Добавить уведомление в UI (из main.ts)
declare function updateBadgeDisplay(): void;                          // Обновить отображение значков залов в UI

// ── СОЗДАНИЕ КОНЕЧНОГО АВТОМАТА ────────────────────────────
// BattleStateMachine — класс из state-machine.ts, управляющий фазами боя.
// Это singleton — один инстанс на весь бой.
// Экспортируется для тестов (могут создать свой через BattleStateMachine.create())
import { BattleStateMachine, BattlePhase } from './state-machine.js';

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
  if (!s.battleType || s.battleType === 'none') return;     // Не сохраняем если бой не начат
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
  if ((s.battleType === 'gym' || s.battleType === 'elite' || s.battleType === 'GS.champion') && s.gymTeamData) {
    state.gymLeaderKey = s.gymLeaderKey;           // ID лидера зала (из gyms.ts)
    state.gymTeamIndex = s.gymTeamIndex;           // Какой по счёту гимец
    state.gymTeamIndexInMember = s.gymTeamIndexInMember; // Индекс внутри Элитного члена
    state.gymTeamData = s.gymTeamData;             // Клонированная команда лидера
  }
  try { localStorage.setItem(store.lsKey('battle_state'), JSON.stringify(state)); } catch(e) {} // JSON.stringify может выбросить при циклических ссылках — игнорируем
}

/**
 * clearBattleState — удалить сохранённое состояние боя из localStorage.
 * Вызывается после победы, поражения или выхода из боя.
 * Также очищает барьеры/экраны через clearScreens().
 */
function clearBattleState() {
  try { localStorage.removeItem(store.lsKey('battle_state')); } catch(e) {}
  clearScreens(); // Сбросить все барьеры (Reflect, Light Screen, Protect, Substitute)
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
  if ((S.battleType === 'gym' || S.battleType === 'elite' || S.battleType === 'GS.champion') && state.gymTeamData) {
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
        S.wildMovesDetailed = [];
        const movePromises = [];
        for (let i = 0; i < S.activeWild.moves.length && i < 20; i++) {
          movePromises.push(
            fetchPokeAPI(S.activeWild.moves[i].move.url).catch(() => null)
          );
        }
        const moveResults = await Promise.all(movePromises);
        S.wildMovesDetailed = moveResults.filter(Boolean);
      }

      // ── IVs дикого (если нет — генерируем случайные) ──
      if (!S.activeWild.wildIVs) {
        S.activeWild.wildIVs = {
          hp: Math.floor(Math.random() * 32), atk: Math.floor(Math.random() * 32),
          def: Math.floor(Math.random() * 32), spa: Math.floor(Math.random() * 32),
          spd: Math.floor(Math.random() * 32), spe: Math.floor(Math.random() * 32)
        };
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
  if ((S.battleType === 'gym' || S.battleType === 'elite' || S.battleType === 'GS.champion') && S.gymTeamData && state.wildPkmName) {
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
        S.wildMovesDetailed = [];
        const movePromises = [];
        for (let i = 0; i < S.activeWild.moves.length && i < 20; i++) {
          movePromises.push(
            fetchPokeAPI(S.activeWild.moves[i].move.url).catch(() => null)
          );
        }
        const moveResults = await Promise.all(movePromises);
        S.wildMovesDetailed = moveResults.filter(Boolean);
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
  document.getElementById('wild-name').innerText = S.activeWild.name;                         // Имя дикого
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
 * Максимальное значение IV — 31 в основной игре, здесь 70 для разнообразия.
 * IV (Individual Values) — индивидуальные значения, влияют на статы.
 */
const MAX_IV = 70;

/**
 * calculateStat — вычислить реальное значение характеристики покемона.
 *
 * ЧТО ДЕЛАЕТ:
 *   1. Берёт базовый стат из PokeAPI
 *   2. Применяет IV (0-31 для игрока, 0-31 для дикого)
 *   3. Применяет EV (только для покемонов игрока)
 *   4. Применяет натуру (buff/nerf, только не-HP)
 *   5. Применяет стат-стадии (-6 до +6, множитель 2/2..8/2)
 *   6. Применяет предметы (Choice Band, Eviolite, Assault Vest, Thick Club)
 *
 * ОТКУДА ВХОДНЫЕ ДАННЫЕ:
 *   pokemon.stats (дикий) или pokemon.apiData.stats (игрок) — из PokeAPI
 *   pokemon.wildIVs / pokemon.ivs — сгенерированы или из сохранения
 *   pokemon.evs — только для игрока (изначально 0)
 *   pokemon.natureIdx — только для игрока (индекс в массиве natures)
 *   pokemon.statStages — устанавливаются через statStageModify()
 *   pokemon.heldItem — предмет в руке
 *
 * ГДЕ ИСПОЛЬЗУЕТСЯ:
 *   calculateDamage (через calcStat из logic.ts) — расчёт урона
 *   startHunt — расчёт HP дикого
 *   switchPokemon — расчёт скорости для побега
 *   handleWildFaintRewards — расчёт HP при левелапе
 *   useMove / enemyTurn — везде где нужно сравнить скорость
 *
 * ВОЗВРАЩАЕТ: число — вычисленное значение характеристики.
 */
function calculateStat(pokemon, statName, isWild) {
  // ── Базовый стат ──
  // У дикого pokemon.stats — массив с PokeAPI
  // У игрока pokemon.apiData.stats — то же самое
  const baseStats = isWild ? pokemon.stats : pokemon.apiData.stats;
  const statObj = baseStats.find(s => s.stat.name === statName);
  const base = statObj ? statObj.base_stat : 50; // Fallback 50 если стат не найден

  // ── Уровень ──
  // Для дикого — S.wildLvl, для игрока — baseLevel + candiesEaten
  const level = isWild ? S.wildLvl : (pokemon.baseLevel + pokemon.candiesEaten);

  // Маппинг названий статов PokeAPI (attack → atk)
  const mapName = { 'hp': 'hp', 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' }[statName] || 'hp';

  // ── IV (Individual Values) ──
  // У дикого: wildIVs (0-31), случайные при встрече
  // У игрока: ivs (0-31), изначально случайные
  const iv = isWild ? (pokemon.wildIVs ? pokemon.wildIVs[mapName] : 15) : (pokemon.ivs?.[mapName] ?? 15);

  // ── EV (Effort Values) ──
  // Только для игрока, изначально все 0. Растут при тренировках/боях.
  const ev = isWild ? 0 : pokemon.evs[mapName];

  // ── Натура (Nature) ──
  // Каждая натура buff-ит один стат (×1.1) и nerf-ит другой (×0.9).
  // Только для игрока, только не-HP статы.
  let natureMod = 1.0;
  if (statName !== 'hp' && !isWild && pokemon.natureIdx !== undefined) {
    const nature = natures[pokemon.natureIdx];
    if (nature) {
      if (nature.buff === mapName) natureMod = 1.1;   // Повышенный стат
      else if (nature.nerf === mapName) natureMod = 0.9; // Пониженный стат
    }
  }

  // ── Формула расчёта стата ──
  // Специальная формула для HP (добавляется level + 10)
  // Для остальных — стандартная формула с natureMod
  let result;
  if (statName === 'hp') {
    result = Math.floor(0.01 * (2 * base + iv + Math.floor(0.25 * ev)) * level) + level + 10;
  } else {
    result = Math.floor((Math.floor((2 * base + iv + Math.floor(0.25 * ev)) * level / 100) + 5) * natureMod);
  }

  // ── Стат-стадии (баффы/дебаффы) ──
  // Swords Dance (+2 Atk) → stage = 2 → множитель (2+2)/2 = 2.0 (×2)
  // Growl (-1 Atk) → stage = -1 → множитель 2/(2-(-1)) = 2/3 (×0.66)
  // Диапазон: -6 до +6
  if (pokemon.statStages) {
    const stageMapName = { 'hp': 'hp', 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' }[statName];
    if (stageMapName && pokemon.statStages[stageMapName] !== undefined) {
      const stage = pokemon.statStages[stageMapName];
      if (stage !== 0) {
        const stageMult = stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
        if (statName !== 'hp') { // HP не меняется от стадий
          result = Math.floor(result * stageMult);
        }
      }
    }
  }

  // ── Множители от предметов ──
  // Choice Band: ×1.5 к Attack
  // Choice Scarf: ×1.5 к Speed
  // Choice Specs: ×1.5 к Sp.Atk
  // Thick Club (Cubone/Marowak): ×2 к Attack
  // Eviolite (если может эволюционировать): ×1.5 к Def/SpDef
  // Assault Vest: ×1.5 к SpDef
  if (!isWild && pokemon.heldItem) {
    const choiceMap = { 'choiceBand': 'attack', 'choiceScarf': 'speed', 'choiceSpecs': 'special-attack' };
    if (choiceMap[pokemon.heldItem] === statName) {
      result = Math.floor(result * 1.5);
    }
    // thickClub: x2 Atk для Cubone/Marowak
    if (pokemon.heldItem === 'thickClub' && statName === 'attack') {
      const species = pokemon.apiData?.species?.name || pokemon.apiData?.name || '';
      if (species === 'cubone' || species === 'marowak') result = Math.floor(result * 2);
    }
    // eviolite: x1.5 Def/SpDef если покемон может эволюционировать
    if (pokemon.heldItem === 'eviolite' && (statName === 'defense' || statName === 'special-defense')) {
      if (pokemon.apiData?.species?.url) result = Math.floor(result * 1.5); // Если есть species.url — значит может эволюционировать
    }
    // assaultVest: x1.5 SpDef (статус-атаки блокируются отдельно)
    if (pokemon.heldItem === 'assaultVest' && statName === 'special-defense') {
      result = Math.floor(result * 1.5);
    }
  }

  return result;
}

/**
 * getMultiHitCount — количество ударов для multi-hit атак (Bullet Seed, Rock Blast, etc.)
 */
function getMultiHitCount(move) {
  const minH = move.meta?.min_hits;
  const maxH = move.meta?.max_hits;
  if (!minH || !maxH || minH < 2 || maxH < minH) return 1;
  if (minH === maxH) return minH;
  const r = Math.random();
  if (r < 3/8) return 2;
  if (r < 6/8) return 3;
  if (r < 7/8) return 4;
  return 5;
}

/**
 * applyWeatherChip — урон от погоды (sandstorm, hail) 1/16 max HP в конце хода.
 * sandstorm: non-Rock/Ground/Steel
 * hail: non-Ice
 */
function applyWeatherChip(pokemon, maxHp, isPlayer) {
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

  // 1. Healing moves (Recover, Roost, Moonlight, Synthesis, etc.)
  // move.meta.healing — процент от макс HP (например 50 для Recover)
  const healPct = move.meta?.healing;
  if (healPct) {
    const healAmount = Math.floor(S.activePlayerMon.maxHp * healPct / 100);
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

  // 3. Protect
  if (move.name === 'protect') {
    S.protectActive = true;
    appendToLog(`${S.activePlayerMon.apiData.name} защищается!`);
    return true;
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

  return false; // Ничего не произошло — атака не была статус-атакой из списка
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

  // 1. Healing for enemy
  const healPct = move.meta?.healing;
  if (healPct) {
    const healAmount = Math.floor(S.wildMaxHP * healPct / 100);
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

  // 3. Protect
  if (move.name === 'protect') {
    S.enemyProtectActive = true;
    appendToLog(`${S.activeWild.name} защищается!`);
    return true;
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

  // 5. Enemy stat changes (Swords Dance, Growl, etc.)
  // move.stat_changes — массив изменений статов (из PokeAPI)
  if (move.stat_changes && move.stat_changes.length > 0) {
    const monName = S.activeWild.name;
    const statNameMap = { 'attack': 'atk', 'defense': 'def', 'special-attack': 'spa', 'special-defense': 'spd', 'speed': 'spe' };
    move.stat_changes.forEach(sc => {
      const statKey = statNameMap[sc.stat.name];
      if (statKey) {
        statStageModify(S.activeWild, statKey, sc.change); // Применяем изменение стата
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
      'poison': 'psn', 'badly-poison': 'psn',
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
function getAbilityName(pokemon, isWild) {
  if (isWild) return pokemon.abilities?.[0]?.ability?.name || null; // Первая способность дикого
  return pokemon.abilityName || null;                                 // Сохранённая способность игрока
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
function statStageModify(pokemon, stat, delta) {
  // Если стат-стадии ещё нет — инициализируем нулями
  if (!pokemon.statStages) pokemon.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  // Клиппинг: не даём выйти за пределы [-6, +6]
  pokemon.statStages[stat] = Math.max(-6, Math.min(6, (pokemon.statStages[stat] || 0) + delta));
  updateStatBadges(); // Обновляем плашки в UI
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
function generateDailyQuests() {
  const today = new Date().toISOString().slice(0, 10);           // Сегодняшняя дата YYYY-MM-DD
  const lastGen = localStorage.getItem(store.lsKey('quest_date')); // Дата последней генерации
  if (lastGen === today && GS.quests.length > 0) return;          // Уже сгенерированы сегодня

  // Перемешиваем и берём 3 случайных конфига
  const shuffled = [...QUEST_CONFIGS].sort(() => Math.random() - 0.5);
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
function checkQuestProgress(type, amount?, itemId?) {
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
  GS.completedQuests.push({ id: questId, date: new Date().toISOString() }); // История
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
    return;
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
 * Ожог (brn): 1/16 от макс HP каждый ход
 *
 * ГДЕ ВЫЗЫВАЕТСЯ:
 *   useMove() — перед ходом врага (если игрок пропустил ход из-за статуса)
 *   enemyTurn() — в начале хода врага (урон дикому), в конце (урон игроку)
 */
function applyStatusEndOfTurn(target, isPlayer) {
  if (!target.status) return;

  if (target.status === 'psn') {
    const dmg = Math.max(1, Math.floor((isPlayer ? S.activePlayerMon.maxHp : S.wildMaxHP) / 8));
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
function switchPokemon() {
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

    // Меняем активного покемона (порядок в команде не меняется)
    S.activePlayerMon = newActive;

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

// Encounter weight multiplier (higher = more common). Default 1.0
const ENCOUNTER_WEIGHTS = {
  'pidgey': 2.0, 'rattata': 2.0, 'spearow': 1.8, 'zubat': 2.5,
  'caterpie': 2.2, 'weedle': 2.2, 'geodude': 1.5, 'machop': 1.3,
  'oddish': 1.8, 'bellsprout': 1.8, 'venonat': 1.5, 'paras': 1.4,
  'mankey': 1.2, 'diglett': 1.2, 'meowth': 1.5, 'psyduck': 1.3,
  'growlithe': 1.0, 'vulpix': 1.0, 'poliwag': 1.5, 'tentacool': 1.8,
  'slowpoke': 1.2, 'magnemite': 1.2, 'farfetchd': 0.5, 'doduo': 1.2,
  'seel': 1.0, 'shellder': 1.3, 'gastly': 0.8, 'onix': 0.6,
  'drowzee': 1.3, 'krabby': 1.5, 'voltorb': 1.2, 'exeggcute': 1.0,
  'cubone': 1.0, 'hitmonlee': 0.3, 'hitmonchan': 0.3, 'lickitung': 0.5,
  'koffing': 1.3, 'rhyhorn': 1.0, 'chansey': 0.1, 'tangela': 1.0,
  'kangaskhan': 0.15, 'horsea': 1.3, 'goldeen': 1.5, 'staryu': 1.3,
  'scyther': 0.4, 'jynx': 0.4, 'electabuzz': 0.4, 'magmar': 0.4,
  'pinsir': 0.4, 'tauros': 0.3, 'magikarp': 2.5,
  'lapras': 0.2, 'ditto': 0.3, 'eevee': 0.25,
  'porygon': 0.3, 'omanyte': 0.8, 'kabuto': 0.8,
  'aerodactyl': 0.1, 'snorlax': 0.1,
  'dratini': 0.1, 'dragonair': 0.05,
  'grimer': 1.2, 'muk': 0.4, 'weezing': 0.4,
  'haunter': 0.5, 'gengar': 0.05,
  'sentret': 2.0, 'hoothoot': 2.0, 'murkrow': 1.0,
  'spinarak': 1.5, 'chinchou': 1.3, 'mareep': 1.5,
  'sudowoodo': 0.5, 'aipom': 1.0, 'sunkern': 1.5,
  'yanma': 1.0, 'wooper': 1.5, 'misdreavus': 0.6,
  'wobbuffet': 0.5, 'girafarig': 0.8, 'pineco': 1.3,
  'dunsparce': 0.6, 'gligar': 0.8, 'snubbull': 1.5,
  'qwilfish': 1.0, 'shuckle': 0.3, 'heracross': 0.5,
  'sneasel': 0.6, 'teddiursa': 1.2, 'slugma': 1.3,
  'swinub': 1.3, 'corsola': 1.0, 'remoraid': 1.3,
  'delibird': 0.7, 'mantine': 0.7, 'skarmory': 0.4,
  'houndour': 1.0, 'phanpy': 1.2, 'stantler': 0.8,
  'smeargle': 0.4, 'tyrogue': 0.8, 'miltank': 0.5,
  'larvitar': 0.1, 'pupitar': 0.05,
  'poochyena': 2.0, 'zigzagoon': 2.0, 'wurmple': 2.2,
  'lotad': 1.5, 'seedot': 1.5, 'taillow': 2.0,
  'wingull': 2.0, 'ralts': 0.5, 'surskit': 1.3,
  'shroomish': 1.3, 'slakoth': 1.0, 'nincada': 1.2,
  'whismur': 1.8, 'makuhita': 1.3, 'azurill': 1.0,
  'nosepass': 0.8, 'skitty': 1.5, 'sableye': 0.4,
  'mawile': 0.4, 'aron': 1.2, 'meditite': 1.2,
  'electrike': 1.3, 'plusle': 1.0, 'minun': 1.0,
  'volbeat': 1.0, 'illumise': 1.0, 'roselia': 1.0,
  'gulpin': 1.3, 'carvanha': 1.2, 'wailmer': 1.0,
  'numel': 1.3, 'torkoal': 0.5, 'spoink': 1.3,
  'spinda': 1.0, 'trapinch': 0.8, 'cacnea': 1.3,
  'swablu': 1.3, 'zangoose': 0.8, 'seviper': 0.8,
  'lunatone': 0.5, 'solrock': 0.5, 'barboach': 1.3,
  'corphish': 1.3, 'baltoy': 1.0, 'lileep': 0.5,
  'anorith': 0.5, 'feebas': 0.3, 'castform': 0.6,
  'kecleon': 0.5, 'shuppet': 1.0, 'duskull': 1.0,
  'tropius': 0.8, 'chimecho': 0.4, 'absol': 0.3,
  'wynaut': 0.6, 'snorunt': 1.0, 'spheal': 1.3,
  'clamperl': 1.0, 'relicanth': 0.3, 'luvdisc': 1.3,
  'bagon': 0.15, 'shelgon': 0.05, 'combee': 1.2,
  'shellos': 1.5, 'buneary': 1.5, 'cottonee': 1.3,
  'petilil': 1.3, 'sandile': 1.2, 'trubbish': 1.5,
  'minccino': 1.5, 'swirlix': 1.0, 'pancham': 0.8,
  'pangoro': 0.3, 'tynamo': 0.8, 'golett': 0.5,
  // Legendaries — extremely rare (0.01-0.05)
  'articuno': 0.02, 'zapdos': 0.02, 'moltres': 0.02,
  'mewtwo': 0.01, 'mew': 0.01,
  'raikou': 0.02, 'entei': 0.02, 'suicune': 0.02,
  'lugia': 0.01, 'ho-oh': 0.01, 'celebi': 0.01,
  'latias': 0.02, 'latios': 0.02,
  'kyogre': 0.01, 'groudon': 0.01, 'rayquaza': 0.01,
  'jirachi': 0.01, 'deoxys-normal': 0.01,
  'azelf': 0.02, 'dialga': 0.01, 'palkia': 0.01, 'giratina-altered': 0.01,
  'manaphy': 0.01, 'darkrai': 0.01, 'shaymin-land': 0.01,
  // Fully evolved pseudo-legendaries & starters — very rare (0.03-0.05)
  'charizard': 0.05, 'blastoise': 0.05, 'venusaur': 0.05,
  'dragonite': 0.04, 'tyranitar': 0.03,
  'salamence': 0.03, 'metagross': 0.03,
  'garchomp': 0.03, 'hydreigon': 0.03,
};

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
    const base = ENCOUNTER_WEIGHTS[name] || 1.0;
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
    return Math.floor(Math.random() * range) + loc.wildMinLvl;
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
    // 20% base chance every tick — базовый шанс найти покемона
    if (Math.random() < 0.20) {
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
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.activeWild.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    S.activeWild.isShiny = (Math.random() < 1/4096);

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

    S.activeWild.wildIVs = {
      hp: Math.floor(Math.random() * 32),
      atk: Math.floor(Math.random() * 32),
      def: Math.floor(Math.random() * 32),
      spa: Math.floor(Math.random() * 32),
      spd: Math.floor(Math.random() * 32),
      spe: Math.floor(Math.random() * 32)
    };

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

    S.wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < S.activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetchPokeAPI(S.activeWild.moves[i].move.url).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    S.wildMovesDetailed = moveResults.filter(Boolean);
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
      statStageModify(S.activePlayerMon, 'atk', -1);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }

    S.playerMovesDetailed = [];
    loadMoveButtons(S.activePlayerMon, useMove);

    battle.transition(BattlePhase.WILD_START);
    battle.transition(BattlePhase.PLAYER_TURN);

  } catch (e) {
    battleLog.innerText = 'Ошибка загрузки...';
    setTimeout(() => { modal.style.display = 'none'; }, 1000);
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
      fetchPokeAPI(moveEntry.move.url)                     // Асинхронная загрузка из PokeAPI
        .then(d => {
          S.playerMovesDetailed[i] = d;                    // Сохраняем детальные данные
          if (!activeMon.movesPP) activeMon.movesPP = [];
          if (!activeMon.movesPP[i]) {
            activeMon.movesPP[i] = { current: d.pp || 30, max: d.pp || 30 }; // Инициализируем PP
          }
          mBtn.innerText = d.name || moveEntry.move.name;  // Имя атаки (англ.)
          mBtn.classList.remove('disabled');                // Активируем кнопку
          mBtn.onclick = () => clickHandler(i);             // Назначаем обработчик
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
function updateAbilityDisplay() {
  if (S.activePlayerMon) {
    const abilityName = getAbilityName(S.activePlayerMon, false);
    document.getElementById('player-ability').innerText = abilityName ? `【${abilityName}】` : '';
  }
  if (S.activeWild) {
    const wildAbility = S.activeWild.abilities?.[0]?.ability?.name || '';
    document.getElementById('wild-ability').innerText = wildAbility ? `【${wildAbility}】` : '';
  }
}

/**
 * updateWildHpUI — обновить HP бар дикого покемона в UI.
 * Цвет: зелёный (>50%), жёлтый (20-50%), красный (<20%)
 */
function updateWildHpUI() {
  document.getElementById('wild-hp-text').innerText = `${S.wildCurHP}/${S.wildMaxHP}`;
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
 * EXP считается по формуле: baseLevel^3 — expToNext
 */
function updatePlayerHpUI() {
  if (!S.activePlayerMon) return;
  document.getElementById('player-hp-text').innerText = `${S.activePlayerMon.currentHp}/${S.activePlayerMon.maxHp}`;
  const pct = Math.max(0, (S.activePlayerMon.currentHp / S.activePlayerMon.maxHp) * 100);
  const bar = document.getElementById('player-hp-fill');
  bar.style.width = `${pct}%`;
  bar.className = 'reborn-hp-fill';
  if (pct <= 20) bar.classList.add('hp-low');
  else if (pct <= 50) bar.classList.add('hp-medium');

  // EXP bar — формула опыта (кубическая)
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
    checkQuestProgress('defeat_x');                          // Квест "победить N покемонов"
    const rItems = getWildDropItems();
    store.giveReward(S.wildLvl * 20 + 50, rItems);          // Деньги + предметы
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
      await checkNewMovesOnLevelUp(S.activePlayerMon, S.activePlayerMon.baseLevel); // Новые атаки
    }

    // ═══ Эволюция ═══
    const evoTarget = await checkEvolution(S.activePlayerMon);
    if (evoTarget) {
      await triggerEvolution(S.activePlayerMon, evoTarget.name);
      updatePlayerHpUI();
    }
  }

  // ═══ Финальный UI ═══
  if (isWild) {
    // Победа над диким — показываем меню завершения боя
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    clearBattleState();                               // Удаляем сохранение боя
    store.updateInventoryDisplay();
    store.updateMoneyDisplay();
    store.autoSave();
  } else {
    // Победа над покемоном лидера — переход к следующему
    setTimeout(() => {
      if (S.battleType === 'gym') startGymNextPokemon();
      else if (S.battleType === 'elite') startEliteNextPokemon();
      else if (S.battleType === 'GS.champion') startChampionNextPokemon();
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
async function useMove(moveIndex) {
  const move = S.playerMovesDetailed[moveIndex];
  if (!move) return;

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

  // ═══ 3. ASSAULT VEST ═══
  // Не позволяет использовать статус-атаки (без power)
  const power = move.power;
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

  // ═══ 6. DECREMENT PP ═══
  if (S.activePlayerMon.movesPP && S.activePlayerMon.movesPP[moveIndex]) {
    S.activePlayerMon.movesPP[moveIndex].current--;
  }

  // ═══ 7. CHOICE ITEM LOCK (after successful use) ═══
  // Если первый раз используем атаку с Choice-предметом — блокируем её
  if (choiceItems.includes(S.activePlayerMon.heldItem)) {
    S.activePlayerMon.choiceLockedMove = moveIndex;
  }

  // ═══ 8. ACCURACY CHECK ═══
  // Проверяем попала ли атака (учитывает accuracy атаки и evasion цели)
  let accResult = checkAccuracy(move);
  // Hustle: 20% additional miss chance for physical moves
  const playerAbilityName = getAbilityName(S.activePlayerMon, false);
  if (accResult.hit && playerAbilityName === 'hustle' && power && move.damage_class?.name === 'physical') {
    if (Math.random() * 100 < 20) {
      accResult = { hit: false, message: 'Атака промахнулась из-за Hustle!' };
    }
  }
  if (!accResult.hit) {
    appendToLog(accResult.message); // "Атака промахнулась!"
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ═══ 9. SUCKER PUNCH FAIL ═══
  // Sucker Punch проваливается если противник использует статус-атаку
  if (checkSuckerPunchFail(move, S.enemyChosenMove)) {
    appendToLog(`${S.activePlayerMon.apiData.name} использовал Sucker Punch, но провалился!`);
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ═══ 9b. TWO-TURN MOVE (заряд/выпуск) ═══
  // Проверяем: уже заряжено? Если да — выпускаем атаку.
  // Если нет и атака требует зарядки — заряжаем и завершаем ход.
  const isCharge = move.meta?.category?.name === 'charge';
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
  } else if (isCharge) {
    // ═══ ЗАРЯД ═══ Первый ход — заряжаем атаку
    S.playerChargedMove = move;
    appendToLog(`${S.activePlayerMon.apiData.name} заряжает ${move.name}!`);
    document.getElementById('battle-main-menu').style.display = 'none';
    saveBattleState();
    setTimeout(() => { enemyTurn(); }, 1000);
    return;
  }

  // ═══ 10. ОСНОВНАЯ ЛОГИКА АТАКИ ═══
  appendToLog(`${S.activePlayerMon.apiData.name} использует ${move.name}!`);

  // ─── 10a. STATUS MOVES (без power) ───
  if (!power) {
    // 10a-i: Наложение статуса (Toxic, Thunder Wave, Will-O-Wisp, Spore...)
    const ailment = move.meta?.ailment?.name;
    if (ailment && ailment !== 'none' && ailment !== 'unknown') {
      const statusMap = {
        'poison': 'psn', 'badly-poison': 'psn',
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
          statStageModify(affectedMon, statKey, sc.change);
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
        S.activePlayerMon.abilityName = targetAbility;
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
      document.getElementById('battle-main-menu').style.display = 'none';
      saveBattleState();
      setTimeout(() => { enemyTurn(); }, 1000);
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
    // Stick (Farfetch'd/Sirfetch'd): +2 crit stages (25%)
    if (S.activePlayerMon.heldItem === 'stick' && ['farfetchd', 'sirfetchd'].includes(S.activePlayerMon.apiData?.species?.name || '')) {
      critRateStage += 2;
    }
    const isPhysical = move.damage_class.name === 'physical';
    const numHits = getMultiHitCount(move);

    // Sheer Force: убирает вторичные эффекты атак, даёт 1.3x урон (в calculateDamage)
    const playerSheerForce = playerAbilityName === 'sheer-force' &&
      !!(move.meta?.ailment_chance || move.meta?.flinch_chance || move.meta?.stat_chance || (move.stat_changes?.length > 0));

    // ═══ MULTI-HIT LOOP ═══
    let totalDmg = 0, hitsLanded = 0, lastCrit = false;
    const preWildHP = S.wildCurHP;
    for (let hi = 0; hi < numHits; hi++) {
      if (S.wildCurHP <= 0) break;
      if (hi > 0 && S.enemyProtectActive) break;

      const dmgResult = calculateDamage({
        move, attacker: S.activePlayerMon, defender: S.activeWild,
        attackerLevel: curLvl, defenderLevel: S.wildLvl,
        isWildAttacker: false, isWildDefender: true,
        weather: S.currentWeather,
        attackerStatStages: S.activePlayerMon.statStages,
        defenderStatStages: S.activeWild.statStages,
        attackerHeldItem: S.activePlayerMon.heldItem,
        defenderHeldItem: S.activeWild.heldItem,
        naturesList: natures,
        critRateStage,
        defenderAbilityName: getAbilityName(S.activeWild, true),
        attackerAbilityName: getAbilityName(S.activePlayerMon, false),
      });
      let hitDmg = dmgResult.damage;
      const bMod = applyBarrierMod(1, move, false, dmgResult.isCrit);
      if (bMod !== 1) hitDmg = Math.floor(hitDmg * bMod);
      lastCrit = dmgResult.isCrit;

      if (hi === 0) {
        for (const msg of dmgResult.messages) appendToLog(msg, false, 'dmg');
      } else if (dmgResult.isCrit) {
        appendToLog('Критический удар!', false, 'dmg');
      }

      if (S.enemySubstituteHP > 0) {
        const subDmg = Math.min(S.enemySubstituteHP, hitDmg);
        S.enemySubstituteHP -= subDmg;
        hitDmg -= subDmg;
        if (S.enemySubstituteHP <= 0) { appendToLog('Заменитель разрушен!'); S.enemySubstituteHP = 0; }
      }
      if (hitDmg <= 0) continue;

      // Type-resist berry for wild (Occa, Passho, etc.)
      if (hi === 0) hitDmg = applyTypeResistBerry(S.activeWild, move.type?.name, hitDmg, false);

      S.wildCurHP -= hitDmg;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      totalDmg += hitDmg;
      hitsLanded++;

      // Drain / Recoil per hit
      if (move.meta?.drain) {
        if (move.meta.drain > 0) {
          const drainPct = move.meta.drain / 100;
          let heal = Math.floor(hitDmg * drainPct);
          if (S.activePlayerMon.heldItem === 'bigRoot') heal = Math.floor(heal * 1.3);
          if (heal > 0) {
            S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
            updatePlayerHpUI();
          }
        } else {
          const rPct = Math.abs(move.meta.drain) / 100;
          let rd = Math.max(1, Math.floor(hitDmg * rPct));
          S.activePlayerMon.currentHp -= rd;
          if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
          updatePlayerHpUI();
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
        const chance = move.meta.ailment_chance || 10;
        if (Math.random() * 100 < chance) {
          const sm = { 'poison': 'psn', 'badly-poison': 'psn', 'burn': 'brn', 'paralysis': 'par', 'sleep': 'slp', 'freeze': 'frz' };
          const ts = sm[move.meta.ailment.name];
          if (ts && !S.wildStatus && !isStatusImmune(move.meta.ailment.name, S.activeWild)) {
            if (applyStatusEffect(S.activeWild, ts)) {
              S.wildStatus = S.activeWild.status;
              document.getElementById('wild-status-icon').innerText = getStatusIcon(S.wildStatus);
              appendToLog(`Дикий ${S.activeWild.name} получил ${STATUS_NAMES[ts]}!`);
            }
          }
        }
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

      // Rough Skin / Iron Barbs per physical hit
      if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(wcAbil)) {
        const recoil = Math.max(1, Math.floor(hitDmg / 8));
        S.activePlayerMon.currentHp -= recoil;
        if (S.activePlayerMon.currentHp < 0) S.activePlayerMon.currentHp = 0;
        updatePlayerHpUI();
      }

      // Stat changes per hit (with stat_chance probability, подавляется Sheer Force)
      if (S.wildCurHP > 0 && !playerSheerForce && move.stat_changes && move.stat_changes.length > 0) {
        const scChance = move.meta?.stat_chance ?? 100;
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
                statStageModify(am, sk, sc.change);
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
      if (S.wildCurHP > 0 && !playerSheerForce && move.meta?.flinch_chance && Math.random() * 100 < move.meta.flinch_chance) {
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

    updateWildHpUI();

    // Summary message
    if (numHits > 1) {
      appendToLog(`Атака попала ${hitsLanded} раз(а)! Нанесено ${totalDmg} урона!`, false, 'dmg');
      if (lastCrit) appendToLog('Критический удар!', false, 'dmg');
    } else if (totalDmg > 0) {
      appendToLog(`Нанесено ${totalDmg} урона!`, false, 'dmg');
    }

    // Berry auto-use after all hits
    if (S.wildCurHP > 0) checkBerryAutoUse(S.activeWild, false);
  }

  document.getElementById('battle-main-menu').style.display = 'none';

  if (S.activePlayerMon.currentHp <= 0) {
    appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
    return;
  }

  if (S.wildCurHP === 0) {
    await handleWildFaintRewards(S.battleType === 'wild');
  } else {
    setTimeout(() => { enemyTurn(); }, 1000);
  }
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
    setTimeout(() => { document.getElementById('battle-main-menu').style.display = 'flex'; }, 1000); // Показываем меню
    store.autoSave();
  } else {
    // ── ВСЯ КОМАНДА В НОКАУТЕ — ПОРАЖЕНИЕ ──
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
async function enemyTurn() {
  battle.transition(BattlePhase.ENEMY_TURN);

  // ═══ 1. УРОН ОТ СТАТУСА (начало хода) ═══
  // Применяется раз в раунд в начале хода врага
  applyStatusEndOfTurn(S.activeWild, false);
  // Berry auto-use для врага после урона от статуса (Lum/Sitrus/Oran)
  if (S.wildCurHP > 0) checkBerryAutoUse(S.activeWild, false);
  if (S.wildCurHP <= 0) {
    await handleWildFaintRewards(S.battleType === 'wild'); // Статус добил врага
    return;
  }

  // ═══ 1b. WEATHER CHIP (для дикого) ═══
  if (S.wildCurHP > 0) {
    applyWeatherChip(S.activeWild, S.wildMaxHP, false);
    if (S.wildCurHP <= 0) {
      await handleWildFaintRewards(S.battleType === 'wild');
      return;
    }
  }

  // ═══ 2. ПРОВЕРКА СТАТУСА ═══
  const wildCanAct = checkStatusTurn(S.activeWild, false);
  if (!wildCanAct) {
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex'; // Ход игрока
    }, 1000);
    return;
  }

  // ═══ 2b. FLINCH CHECK ═══
  if (S.activeWild.flinch) {
    S.activeWild.flinch = false;
    appendToLog(`${S.activeWild.name} дрогнул и не может атаковать!`, false, 'system');
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
    return;
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
    });
    chosenMove = aiResult?.move || { power: 30, damage_class: { name: 'physical' }, type: { name: 'normal' }, name: 'Атака' };
    chosenIdx = aiResult?.index ?? -1;
  }
  const isT = S.battleType !== 'wild';
  S.enemyChosenMove = chosenMove; // Сохраняем для Sucker Punch проверки
  const enemyMoveName = chosenMove.name || 'Атака';
  if (!isChargeRelease && chosenIdx >= 0 && S.wildMovesPP && S.wildMovesPP[chosenIdx]) {
    S.wildMovesPP[chosenIdx].current--;
  }

  // ═══ 3b. TWO-TURN MOVE CHARGE ═══
  // Если атака требует зарядки — заряжаем и завершаем ход врага
  if (!isChargeRelease && chosenMove.meta?.category?.name === 'charge') {
    S.enemyChargedMove = chosenMove;
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} заряжает ${enemyMoveName}!`);
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
    return;
  }

  // ═══ 4. ACCURACY CHECK ═══
  let enemyAcc = checkAccuracy(chosenMove);
  // Hustle: 20% additional miss chance for physical moves
  const wildAbilityName = getAbilityName(S.activeWild, true);
  if (enemyAcc.hit && wildAbilityName === 'hustle' && chosenMove.damage_class?.name === 'physical') {
    if (Math.random() * 100 < 20) {
      enemyAcc = { hit: false, message: 'Атака промахнулась из-за Hustle!' };
    }
  }
  if (!enemyAcc.hit) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}, но ${enemyAcc.message?.toLowerCase() || 'промахнулся'}!`);
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
    return;
  }
  const power = chosenMove.power;

  // ═══ 5. СТАТУС-АТАКА ВРАГА (без урона) ═══
  if (!power) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}!`);
    handleEnemyStatusEffects(chosenMove); // Лечение, барьеры, статы, статусы
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
    return;
  }

  // ═══ 6. PROTECT CHECK (игрок защищается) ═══
  if (S.protectActive && power) {
    appendToLog(`${S.activePlayerMon.apiData.name} защитился от атаки!`);
    S.protectActive = false;
    S.battleRound++;
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex';
    }, 1000);
    return;
  }

  // ═══ 7. РАСЧЁТ УРОНА (multi-hit) ═══
  const isPhysical = chosenMove.damage_class.name === 'physical';
  const numHits = getMultiHitCount(chosenMove);

  // Sheer Force: убирает вторичные эффекты атак, даёт 1.3x урон (в calculateDamage)
  const enemySheerForce = wildAbilityName === 'sheer-force' &&
    !!(chosenMove.meta?.ailment_chance || chosenMove.meta?.flinch_chance || chosenMove.meta?.stat_chance || (chosenMove.stat_changes?.length > 0));

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
      critRateStage: chosenMove.meta?.crit_rate || 0,
      defenderAbilityName: getAbilityName(S.activePlayerMon, false),
      attackerAbilityName: getAbilityName(S.activeWild, true),
    });
    let hitDmg = dmgResult.damage;
    const bMod = applyBarrierMod(1, chosenMove, true, dmgResult.isCrit); // Барьеры игрока
    if (bMod !== 1) hitDmg = Math.floor(hitDmg * bMod);
    lastCrit = dmgResult.isCrit;

    if (hi === 0) {
      for (const msg of dmgResult.messages) {
        appendToLog(msg, false, 'dmg');
      }
    } else if (dmgResult.isCrit) {
      appendToLog('Критический удар!', false, 'dmg');
    }

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

    if (hitDmg <= 0) continue;

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

    // Drain / Recoil per hit
    if (chosenMove.meta?.drain) {
      if (chosenMove.meta.drain > 0) {
        const drainPct = chosenMove.meta.drain / 100;
        let heal = Math.floor(hitDmg * drainPct);
        if (S.activeWild.heldItem === 'bigRoot') heal = Math.floor(heal * 1.3);
        if (heal > 0) {
          S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
          updateWildHpUI();
        }
      } else {
        const rPct = Math.abs(chosenMove.meta.drain) / 100;
        let rd = Math.max(1, Math.floor(hitDmg * rPct));
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
    const playerAbility = getAbilityName(S.activePlayerMon, false);
    if (power && isPhysical && ['rough-skin', 'iron-barbs'].includes(playerAbility)) {
      const recoil = Math.max(1, Math.floor(hitDmg / 8));
      S.wildCurHP -= recoil;
      if (S.wildCurHP < 0) S.wildCurHP = 0;
      updateWildHpUI();
    }

    // ── Secondary status от атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.meta && chosenMove.meta.ailment && chosenMove.meta.ailment.name !== 'none' && chosenMove.meta.ailment.name !== 'unknown') {
      const chance = chosenMove.meta.ailment_chance || 10;
      if (Math.random() * 100 < chance) {
        const statusMap = {
          'poison': 'psn', 'badly-poison': 'psn',
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
    }

    // ── Flinch от атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.meta?.flinch_chance && Math.random() * 100 < chosenMove.meta.flinch_chance) {
      S.activePlayerMon.flinch = true;
    }

    // ── Stat changes от дамажащих атак врага (Sheer Force) ──
    if (S.activePlayerMon.currentHp > 0 && !enemySheerForce && chosenMove.stat_changes && chosenMove.stat_changes.length > 0) {
      const scChance = chosenMove.meta?.stat_chance ?? 100;
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
              statStageModify(affectedMon, statKey, sc.change);
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
  // Summary message
  if (numHits > 1) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}! (${hitsLanded} ударов, нанесено ${totalDmg} урона!)`, false, 'dmg');
    if (lastCrit) appendToLog('Критический удар!', false, 'dmg');
  } else if (totalDmg > 0) {
    appendToLog(`${isT ? '' : 'Дикий '}${S.activeWild.name} использует ${enemyMoveName}! (-${totalDmg} HP)`, false, 'dmg');
  }

  // ═══ 9. УМЕНЬШЕНИЕ БАРЬЕРОВ ═══
  if (S.playerReflectTurns > 0) { S.playerReflectTurns--; if (S.playerReflectTurns === 0) appendToLog('Защита рассеялась!', false, 'system'); }
  if (S.playerLightScreenTurns > 0) { S.playerLightScreenTurns--; if (S.playerLightScreenTurns === 0) appendToLog('Световой Экран рассеялся!', false, 'system'); }
  S.protectActive = false; // Protect сбрасывается в конце хода противника

  // ═══ 9b. WEATHER CHIP (для игрока) ═══
  if (S.activePlayerMon.currentHp > 0) {
    applyWeatherChip(S.activePlayerMon, S.activePlayerMon.maxHp, true);
  }

  // ═══ 10. BERRY AUTO-USE ДЛЯ ИГРОКА ═══
  if (S.activePlayerMon.currentHp > 0) checkBerryAutoUse(S.activePlayerMon, true);

  // ═══ 11. ПРОВЕРКА FAINTED ═══
  if (S.activePlayerMon.currentHp === 0) {
    appendToLog(`${S.activePlayerMon.apiData.name} потерял сознание!`, false, 'faint');
    handlePlayerFaint();
    return;
  } else {
    // Урон от статуса в конце хода (яд/ожог игрока)
    applyStatusEndOfTurn(S.activePlayerMon, true);
    if (S.activePlayerMon.currentHp <= 0) {
      handlePlayerFaint();
      return;
    }
    S.battleRound++;
    // Leftovers healing (игрок) — пассивное восстановление 1/16 макс HP
    if (S.activePlayerMon.heldItem === 'leftovers' && S.activePlayerMon.currentHp > 0 && S.activePlayerMon.currentHp < S.activePlayerMon.maxHp) {
      const heal = Math.max(1, Math.floor(S.activePlayerMon.maxHp / 16));
      S.activePlayerMon.currentHp = Math.min(S.activePlayerMon.maxHp, S.activePlayerMon.currentHp + heal);
      updatePlayerHpUI();
      appendToLog(`${S.activePlayerMon.apiData.name} восстанавливает HP от Объедков! (+${heal})`);
    }
    // Leftovers healing (дикий/гим)
    if (S.activeWild.heldItem === 'leftovers' && S.wildCurHP > 0 && S.wildCurHP < S.wildMaxHP) {
      const heal = Math.max(1, Math.floor(S.wildMaxHP / 16));
      S.wildCurHP = Math.min(S.wildMaxHP, S.wildCurHP + heal);
      updateWildHpUI();
      appendToLog(`${S.activeWild.name} восстанавливает HP от Объедков! (+${heal})`);
    }
    saveBattleState();
    setTimeout(() => {
      document.getElementById('battle-main-menu').style.display = 'flex'; // Ход игрока
    }, 1000);
  }
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

function initEncounterEvents() {

  // ═══ 15a: ПОБЕГ ═══
  document.getElementById('btn-run').addEventListener('click', () => {
    if (S.battleType !== 'wild') {
      appendToLog('Нельзя сбежать от лидера!'); // Gym/elite — побег невозможен
      return;
    }
    S.escapeAttempts++; // Каждая неудачная попытка увеличивает шанс
    const playerSpeed = calculateStat(S.activePlayerMon, 'speed', false);
    const wildSpeed = calculateStat(S.activeWild, 'speed', true);

    // Формула побега: (playerSpeed * 128 / wildSpeed) + 30 * attempts
    // Если результат > 255 — гарантированный побег
    // Иначе — шанс F/256
    let F = Math.floor((playerSpeed * 128 / wildSpeed) + 30 * S.escapeAttempts);

    if (F > 255 || Math.floor(Math.random() * 256) < F) {
      appendToLog('Вам удалось сбежать!');
      setTimeout(() => { document.getElementById('encounter-modal').style.display = 'none'; }, 1000);
    } else {
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog('Не удалось сбежать!');
      setTimeout(() => { enemyTurn(); }, 1500); // Противник атакует
    }
  });

  // ═══ 15b: СМЕНА ПОКЕМОНА ═══
  document.getElementById('btn-switch').addEventListener('click', () => {
    if (S.battleType === 'gym' || S.battleType === 'elite' || S.battleType === 'GS.champion') {
      showToast('Нельзя сменить покемона в бою с лидером!', true);
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
  document.getElementById('btn-use-item').addEventListener('click', () => {
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
            breedLetter: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)],
            status: S.wildStatus || null,
            sleepTurns: S.wildSleepTurns || 0,
            movesPP: S.wildMovesPP ? S.wildMovesPP.map(pp => ({ current: pp.max, max: pp.max })) : [],
            statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
            abilityName: S.activeWild.abilities[0]?.ability?.name || null,
            heldItem: null,
            berries: S.activeWild.berries || { sitrusBerry: 0, oranBerry: 0, lumBerry: 0, chestoBerry: 0, rawstBerry: 0 },
            learnableMoves: []
          };

          // Friend Ball: set happiness to 200
          if (item === 'friendBall') {
            newMon.happiness = 200;
          }

          // DarkBall: +5 to all IVs (max 31)
          if (item === 'darkBall') {
            for (const s of ['hp', 'atk', 'def', 'spa', 'spd', 'spe']) {
              newMon.ivs[s] = Math.min(31, newMon.ivs[s] + 5);
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
            if (pcBoxes.length === 0) pcBoxes.push([]);
            pcBoxes[0].push(newMon);
            addNotification('📦 Покемон в PC', `${S.activeWild.name} отправлен в Бокс 1 (команда полна).`);
            appendToLog(`${S.activeWild.name} отправлен в PC (команда полна).`, false, 'catch');
          }
          GS.pokedexCaught.add(S.activeWild.name);
          GS.pokedexSeen.add(S.activeWild.name);

          checkQuestProgress('catch_x');

          document.getElementById('battle-main-menu').style.display = 'none';
          document.getElementById('battle-end-menu').style.display = 'flex';
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
      checkQuestProgress('use_item');
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
      checkQuestProgress('use_item');
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
      checkQuestProgress('use_item');
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
        checkQuestProgress('use_item');
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
      if (store.getItemQty('tm') <= 0) return showToast('Нет TM-совместимости!', true);
      showToast('Используйте TM из профиля покемона.', true);
    } else if (itemCategory(item) === 'statusCure') {
      const statusCureMap = {
        'antidote': 'psn', 'paralyzeHeal': 'par', 'awakening': 'slp',
        'burnHeal': 'brn', 'antiSputin': null,
      };
      const targetStatus = statusCureMap[item];
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (item === 'healingHerb') {
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
      checkQuestProgress('use_item');
      store.updateInventoryDisplay();
      document.getElementById('battle-main-menu').style.display = 'none';
      appendToLog(`Вы использовали ${itemDef(item).nameRu}! Статус ${S.activePlayerMon.apiData.name} исцелён.`);
      setTimeout(() => {
        enemyTurn();
      }, 1500);
    } else if (['ether', 'elixir', 'maxElixir'].includes(item)) {
      const elixirMap = { 'ether': 10, 'elixir': 10, 'maxElixir': 40 };
      const ppRestore = elixirMap[item];
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      if (!S.activePlayerMon.movesPP || S.activePlayerMon.movesPP.every(pp => pp && pp.current >= pp.max)) {
        return showToast('PP уже полностью!', true);
      }
      store.removeItem(item);
      GS.itemsUsedInBattle++;
      checkQuestProgress('use_item');
      store.updateInventoryDisplay();
      for (let i = 0; i < 4; i++) {
        if (S.activePlayerMon.movesPP && S.activePlayerMon.movesPP[i]) {
          S.activePlayerMon.movesPP[i].current = Math.min(
            S.activePlayerMon.movesPP[i].max,
            S.activePlayerMon.movesPP[i].current + ppRestore
          );
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
        checkQuestProgress('use_item');
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
    } else if (itemCategory(item) === 'evolutionStones' && item !== 'evolutionStone') {
      if (store.getItemQty(item) <= 0) return showToast(`Нет ${itemDef(item).nameRu}!`, true);
      (async () => {
        const evoTarget = await checkEvolution(S.activePlayerMon, true, item);
        if (!evoTarget) return showToast('Этот покемон не может эволюционировать с этим камнем!', true);
        GS.itemsUsedInBattle++;
        checkQuestProgress('use_item');
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
  // Полная очистка: состояние боя, все стат-стадии, статусы, прогресс гима
  document.getElementById('btn-leave-battle').addEventListener('click', () => {
    document.getElementById('encounter-modal').style.display = 'none'; // Скрываем модалку
    clearBattleState();                                        // Удаляем localStorage
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
    document.getElementById('player-stat-badges').innerHTML = '';
    document.getElementById('wild-stat-badges').innerHTML = '';
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
//   - Gym/Elite покемоны имеют 31 IV во всех статах
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

document.getElementById('btn-close-gym-modal').addEventListener('click', () => {
  document.getElementById('gym-modal').style.display = 'none';
});

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
 *   - Вызывает store.showGymRewardSelection (выбор предмета-награды)
 *   - Показывает battle-end-menu
 *
 * ЕСЛИ ЕСТЬ СЛЕДУЮЩИЙ ПОКЕМОН:
 *   - Загружает данные из PokeAPI
 *   - Устанавливает Perfect IVs (31) для всех статов
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
    // ── ПОБЕДА НАД ВСЕЙ КОМАНДОЙ ЛИДЕРА ──
    const leader = GS.gymLeaders[S.gymLeaderKey];
    GS.gymBadges.push(leader.badgeName);                                 // Добавляем бейдж
    store.giveReward(leader.moneyReward, []);                             // Денежная награда
    checkQuestProgress('earn_money', leader.moneyReward);                 // Прогресс квеста
    appendToLog(`Победа! Вы получили ${leader.badgeName} и ¥${leader.moneyReward}!`);
    document.getElementById('battle-main-menu').style.display = 'none';
    document.getElementById('battle-end-menu').style.display = 'flex';
    store.updateMoneyDisplay();
    updateBadgeDisplay();
    setTimeout(() => store.showGymRewardSelection(S.gymLeaderKey), 300);  // Выбор предмета-награды
    return;
  }

  const member = S.gymTeamData[S.gymTeamIndex];
  try {
    S.activeWild = await fetchPokeAPI(`pokemon/${member.name.replace('_2', '')}`);
    S.wildLvl = member.level;
    S.wildStatus = null;
    S.wildSleepTurns = 0;
    S.currentWeather = getDailyWeather(GS.currentLocationId);
    S.enemyChargedMove = null; // Сброс заряда при смене покемона гима

    // Perfect IVs for gym leader pokemon
    S.activeWild.wildIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

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
      fetchPokeAPI(m.move.url).catch(() => null)
    ))).filter(Boolean);
    // Categorize moves
    const stabMoves = [], coverageMoves = [], statusMoves = [];
    for (const m of moveResults3) {
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
      statStageModify(S.activePlayerMon, 'atk', -1);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves
    loadMoveButtons(S.activePlayerMon, useMove);

    // Set phase so player can attack
    battle.transition(BattlePhase.PLAYER_TURN);

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
  championDiv.className = 'elite-member-card GS.champion';
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
    S.battleType = 'GS.champion';
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
    S.enemyChargedMove = null; // Сброс заряда при смене покемона элиты

    // Perfect IVs для Elite Four (как у gym лидеров)
    S.activeWild.wildIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;
    S.escapeAttempts = 0;

    S.wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < S.activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetchPokeAPI(S.activeWild.moves[i].move.url).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    S.wildMovesDetailed = moveResults.filter(Boolean);
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
      statStageModify(S.activePlayerMon, 'atk', -1);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves for elite battle
    loadMoveButtons(S.activePlayerMon, useMove);
    battle.transition(BattlePhase.PLAYER_TURN);

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
 * Устанавливает battleType = 'GS.champion', загружает команду чемпиона.
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
  S.battleType = 'GS.champion';
  appendToLog(`--- ${GS.champion.name} вызывает вас! ---`);
  await startChampionNextPokemon();
}

async function startChampionNextPokemon() {
  if (S.gymTeamIndexInMember >= S.gymTeamData.length) {
    store.giveReward(GS.champion.moneyReward, []);
    checkQuestProgress('earn_money', GS.champion.moneyReward);
    store.updateMoneyDisplay();
    appendToLog('ПОБЕДА! Вы стали Чемпионом Лиги!');
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
    S.enemyChargedMove = null; // Сброс заряда при смене покемона чемпиона

    // Perfect IVs для Чемпиона (как у gym лидеров)
    S.activeWild.wildIVs = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

    S.wildMaxHP = calculateStat(S.activeWild, 'hp', true);
    S.wildCurHP = S.wildMaxHP;

    S.wildMovesDetailed = [];
    const movePromises = [];
    for (let i = 0; i < S.activeWild.moves.length && i < 20; i++) {
      movePromises.push(
        fetchPokeAPI(S.activeWild.moves[i].move.url).catch(() => null)
      );
    }
    const moveResults = await Promise.all(movePromises);
    S.wildMovesDetailed = moveResults.filter(Boolean);
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
      statStageModify(S.activePlayerMon, 'atk', -1);
      appendToLog(`${S.activeWild.name} отпугивает ${S.activePlayerMon.apiData.name}! Атака снижена!`);
    }

    // Set up player moves for GS.champion battle
    loadMoveButtons(S.activePlayerMon, useMove);
    battle.transition(BattlePhase.PLAYER_TURN);

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
//   openEliteModal / startEliteBattle — элита
//   championBattle / startChampionNextPokemon — чемпион
//   Множество утилит: calculateStat, getStatusIcon, switchPokemon и т.д.
// ─────────────────────────────────────────────────────────────
export { saveBattleState, clearBattleState, restoreBattleState, renderBattleUI, getTypeMultiplier, calculateStat, appendToLog, getAbilityName, statStageModify, updateStatBadges, clearUsedItem, checkBerryAutoUse, giveBerryToMon, generateDailyQuests, checkQuestProgress, claimQuestReward, openQuests, renderQuests, loadPokedexData, getStatusIcon, applyStatusEffect, cureStatus, checkStatusTurn, applyStatusEndOfTurn, switchPokemon, pickWeightedEncounter, getWildLevel, getLocationEncounters, startAutoHunt, stopAutoHunt, getBestRod, startHunt, loadMoveButtons, updateMoveButtonUI, updateMoveButtonUIs, updateWildHpUI, updatePlayerHpUI, useMove, handlePlayerFaint, enemyTurn, initEncounterEvents, openGymModal, initGymEvents, startGymBattle, startGymNextPokemon, useMoveGym, enemyTurnGym, handleGymPlayerFaint, openEliteModal, startEliteBattle, startEliteNextMember, startEliteNextPokemon, championBattle, startChampionNextPokemon, getBattleVars, setBattleVars };
