/**
 * ============================================================
 * state.ts — ГЛОБАЛЬНОЕ СОСТОЯНИЕ ИГРЫ (SINGLETON)
 * ============================================================
 *
 * 🔹 ЧТО ДЕЛАЕТ:
 *   Хранит ВСЁ состояние игры в одном объекте `state`.
 *   Любой модуль импортирует `state` и читает/пишет его поля.
 *   Это единственный источник истины (single source of truth).
 *   Содержит Поля + Утилиты (generateUID, getItemQty, toggleBagItem).
 *
 * 🔹 ЗАВИСИМОСТИ (импорты):
 *   - ../utils/state.js  → generateUID, getTrainerId, lsKey
 *   - ../utils/items.js  → itemDef, itemCategory
 *   - ../data/items.js   → ITEMS (для getItemQty)
 *
 * 🔹 ИСПОЛЬЗУЕТСЯ В:
 *   Почти ВСЕ файлы проекта (init, save, auth, actions, battle, UI)
 *   Через `import { state } from './state.js'`
 * ============================================================
 */

// ── Центральный объект состояния игры ───────────────────────
// Все свойства доступны через state.xxx.
// Тип any используется для гибкости (legacy code).
export const state: Record<string, any> = {

  // ── Локация / Навигация ──────────────────────────────────
  currentLocationId: 'goldenrodCity',  // ID текущей локации (где игрок сейчас)
  currentRegion: 'johto',          // Регион (kanto, johto)
  lastLocation: null,              // Последняя посещённая локация (для возврата)
  visitedLocations: new Set<string>(), // Set посещённых локаций (для карты/путешествий)
  isDaytime: true,                 // bool: день или ночь (влияет на покемонов)
  moveTypeCache: new Map<string, string>(), // Кеш: название атаки → её тип

  // ── Игрок ────────────────────────────────────────────────
  inventory: { credit: 500 } as Record<string, number>, // Инвентарь: { itemId: quantity }
  itemHistory: [] as Array<any>,  // История использования предметов
  badges: [] as Array<string>,    // Массив ID полученных значков
  trainerNickname: '',            // Прозвище тренера (не Telegram username)
  expShareGlobal: false,          // Глобальный Exp. Share (если включён)
  serverDropConfig: null,         // Дроп-конфиг с сервера (кэшируется)

  // ── Покемоны ─────────────────────────────────────────────
  myTeam: [] as Array<any>,       // Команда покемонов (макс 6)
  currentPokemonIndex: null as number | null, // Индекс активного покемона в myTeam
  pcBoxes: [[]] as Array<Array<any>>, // PC Boxes: массив массивов покемонов
  pokedexSeen: new Set<string>(), // Set: ID покемонов, которых видел
  pokedexCaught: new Set<string>(), // Set: ID покемонов, которых поймал

  // ── Бой ──────────────────────────────────────────────────
  itemsUsedInBattle: 0,           // Счётчик использованных предметов в бою

  // ── Уведомления ──────────────────────────────────────────
  notifications: [] as Array<any>, // Массив уведомлений (показываются в UI)

  // ── Daycare / Breeding ───────────────────────────────────
  daycareMons: [] as Array<any>,  // Покемоны в питомнике
  daycareEgg: null,               // Яйцо в питомнике (если есть)
  breedingPairs: [] as Array<any>, // Пары для разведения
  eggs: [] as Array<any>,         // Яйца у игрока
  hatching: false,                // Флаг: идёт вылупление

  // ── Квесты и туториал ────────────────────────────────────
  quests: [] as Array<any>,            // Активные квесты
  questProgress: {} as Record<string, any>, // Прогресс по квестам
  completedQuests: [] as Array<string>, // Выполненные квесты
  npcQuestProgress: {} as Record<string, number>, // Прогресс NPC-квестов
  completedNPCQuests: [] as Array<string>, // Выполненные NPC-квесты
  tutorialStep: 0,                 // Шаг туториала (0 = не начат)

  // ── Авторизация / Синхронизация ──────────────────────────
  tgUser: null,                    // Объект пользователя из Telegram { id, username, ... }
  tgToken: null as string | null,  // JWT access token (15 мин)
  refreshToken: null as string | null, // Refresh token (30 дней, localStorage)
  isAdmin: false,                  // Флаг админа (проверяется на сервере)
  saveVersion: 0,                  // Версия сохранения (для deadlock detection)
  lastCloudSync: 0,                // Timestamp последней облачной синхронизации
  saveRetryCount: 0,               // Счётчик повторных попыток сохранения
  saveInProgress: false,           // Флаг: идёт сохранение
  saveTriggerPending: false,       // Флаг: ещё одно сохранение в очереди
  cloudSaveTimer: null as any,     // Таймер debounced cloudSave

  // ── Socket / PvP / Trade ─────────────────────────────────
  socket: null as any,             // Socket.IO соединение
  onlinePlayersList: [] as Array<any>, // Список онлайн игроков
  activeTradeId: null as string | null, // ID активного трейда
  myTradeOffers: [] as Array<any>,      // Мои предложения в трейде
  partnerTradeOffers: [] as Array<any>, // Предложения партнёра
  iAmP1: false,                    // Флаг: я инициатор трейда
  pvpBattleId: null as string | null,  // ID PvP битвы
  pvpOpponentName: '',             // Имя оппонента в PvP
  pvpMyMon: null as any,           // Мой покемон в PvP
  pvpOppMon: null as any,          // Покемон оппонента
  pvpMyTurn: false,                // Флаг: мой ход
  pvpMovesDetailed: [] as Array<any>, // Детали атак в PvP
  lastProfileOpen: 0,              // Timestamp последнего открытия профиля
  lastSocketAction: 0,             // Timestamp последнего socket-действия
  activeCraftCategory: null as string | null, // Активная категория крафта

  // ── Lazy-loaded модули (чтобы избежать циклических импортов)
  _mapModule: null as any,         // Ленивый импорт map.ts
  _pvpModule: null as any,         // Ленивый импорт pvp модуля
};

// ── Re-export утилит для удобства ──────────────────────────
// Эти функции дублируются здесь, чтобы их можно было импортировать
// из state.js вместо нескольких разных файлов.
export { generateUID } from '../utils/state.js';     // Генерация уникального ID

// ── Импорт данных для GS proxy в core.ts ──────────────────
// GS проксирует в state.*, но gymLeaders/eliteFour/champion
// не входят в объект state. Явно цепляем их на state,
// чтобы GS.gymLeaders работал.
import { gymLeaders } from '../data/gyms.js';
import { eliteFour, champion } from '../utils/state.js';

state.gymLeaders = gymLeaders;
state.eliteFour = eliteFour;
state.champion = champion;
export { itemDef, itemCategory } from '../utils/items.js'; // Типы предметов

// ── Wrappers, использующие state.tgUser ────────────────────
// Эти функции берут tgUser из state, не требуя параметра.
import { getTrainerId as _getTrainerId, lsKey as _lsKey } from '../utils/state.js';

// Получить ID тренера из state.tgUser (без параметра)
export function getTrainerId(): string { return _getTrainerId(state.tgUser); }

// Сгенерировать localStorage key с учётом ID тренера (чтобы разные тренеры
// не пересекались в localStorage)
export function lsKey(name: string): string { return _lsKey(name, state.tgUser); }

// ── Инвентарь: утилиты ─────────────────────────────────────
import { ITEMS } from '../data/items.js';
import { store } from './store.js';

// Получить количество предмета в инвентаре
export function getItemQty(itemId: string): number {
  return state.inventory[itemId] ?? 0;
}

// Проверить, есть ли предмет (хотя бы 1)
export function hasItem(itemId: string): boolean {
  return getItemQty(itemId) > 0;
}

// Изменить количество предмета (положить/убрать)
// delta: +1 = добавить, -1 = убрать
// credit (деньги) нельзя менять через эту функцию
// Использует per-category лимиты из store.ts
export function toggleBagItem(itemId: string, delta: number): void {
  if (itemId === 'credit') return; // credit управляется отдельно
  const qty = getItemQty(itemId) + delta;
  if (qty <= 0) { delete state.inventory[itemId]; return; }
  const maxStack = store.getMaxStack(itemId);
  if (qty > maxStack) { state.inventory[itemId] = maxStack; return; }
  state.inventory[itemId] = qty;
}
