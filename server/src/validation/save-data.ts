/**
 * Zod-схема для валидации save_data.
 * Сервер теперь проверяет структуру перед записью.
 *
 * Валидирует:
 *   - myTeam: максимум 6 покемонов, uid обязателен, level 1-100
 *   - inventory: только известные itemId, неотрицательные количества
 *   - badges: только известные названия баджей
 *   - pcBoxes: массив массивов покемонов
 */
import { z } from 'zod';

// ── Известные баджи (из src/data/gyms.ts) ──
const VALID_BADGES = [
  'Boulder Badge', 'Cascade Badge', 'Thunder Badge', 'Rainbow Badge',
  'Soul Badge', 'Marsh Badge', 'Volcano Badge', 'Earth Badge',
  'Zephyr Badge', 'Hive Badge', 'Plain Badge', 'Fog Badge',
  'Storm Badge', 'Mineral Badge', 'Glacier Badge', 'Rising Badge',
] as const;

// ── Известные предметы (из src/data/items.ts + economy.ts) ──
export const VALID_ITEM_IDS = [
  'pokeBall', 'greatBall', 'ultraBall', 'masterBall',
  'potion', 'superPotion', 'hyperPotion', 'maxPotion', 'fullRestore',
  'revive', 'maxRevive', 'antidote', 'burnHeal', 'iceHeal', 'awakening', 'paralyzeHeal',
  'fullHeal', 'ether', 'maxEther', 'elixir', 'maxElixir',
  'rareCandy', 'ppUp', 'ppMax',
  'expShare', 'expAll',
  'hpUp', 'protein', 'iron', 'calcium', 'zinc', 'carbos',
  'fireStone', 'waterStone', 'thunderStone', 'leafStone', 'moonStone',
  'sunStone', 'shinyStone', 'duskStone', 'dawnStone', 'iceStone',
  'credit',
  // TM/HM
  'tm01', 'tm02', 'tm03', 'tm04', 'tm05', 'tm06', 'tm07', 'tm08', 'tm09', 'tm10',
  'hm01', 'hm02', 'hm03', 'hm04',
  // Key items
  'bicycle', 'oldRod', 'goodRod', 'superRod', 'townMap', 'pokeFlute',
  // Held items
  'choiceBand', 'choiceSpecs', 'choiceScarf', 'focusSash', 'lifeOrb',
  'leftovers', 'assaultVest', 'eviolite', 'sitrusBerry', 'oranBerry',
  'lumBerry', 'chestoBerry', 'rawstBerry', 'pechaBerry', 'aspearBerry',
  'persimBerry', 'cheriBerry',
  // Battle items
  'xAttack', 'xDefend', 'xSpeed', 'xSpAtk', 'xSpDef', 'xAccuracy',
  'direHit', 'guardSpec',
] as const;

/** Белый список предметов: только эти itemId могут попасть в инвентарь. */
export const VALID_ITEM_ID_SET: ReadonlySet<string> = new Set(VALID_ITEM_IDS);

// ── Схема IV ──
const ivSchema = z.object({
  hp: z.number().int().min(0).max(31).default(0),
  atk: z.number().int().min(0).max(31).default(0),
  def: z.number().int().min(0).max(31).default(0),
  spa: z.number().int().min(0).max(31).default(0),
  spd: z.number().int().min(0).max(31).default(0),
  spe: z.number().int().min(0).max(31).default(0),
});

// Схема EV: 0..252. Должна быть отдельной от IV — ранее здесь стояла ivSchema
// с max(31), из-за чего любой EV >= 32 приводил к 422 на весь POST /api/save.
const evSchema = z.object({
  hp: z.number().int().min(0).max(252).default(0),
  atk: z.number().int().min(0).max(252).default(0),
  def: z.number().int().min(0).max(252).default(0),
  spa: z.number().int().min(0).max(252).default(0),
  spd: z.number().int().min(0).max(252).default(0),
  spe: z.number().int().min(0).max(252).default(0),
});

// ── Схема покемона в команде ──
/**
 * Поле, которое клиент пишет как строку, но может положить числом.
 *
 * Так случилось с originalTrainer: getTrainerId() возвращает tgUser.id, то есть
 * число, а схема требовала строку. Из-за этого КАЖДЫЙ облачный сейв возвращал
 * 422 — «myTeam.0.originalTrainer: Expected string, received number» — и прогресс
 * жил только в localStorage. Потеря кэша или смена устройства означали полную
 * потерю игры, при этом в консоли было лишь «Cloud save failed», а в интерфейсе
 * значок ☁️✗.
 *
 * Такие поля — идентификаторы и названия, к ним нет требований по безопасности,
 * поэтому приводим к строке вместо отклонения всего сейва.
 */
const strish = z.union([z.string(), z.number()])
  .transform((v) => String(v))
  .nullable()
  .optional();

const teamMonSchema = z.object({
  uid: z.string().min(1, 'uid обязателен'),
  baseLevel: z.number().int().min(1).max(100).default(1),
  currentHp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).optional(),
  apiData: z.any().optional(),
  ivs: ivSchema.optional(),
  evs: evSchema.optional(),
  isShiny: z.boolean().optional(),
  nickname: strish,
  gender: strish,
  natureIdx: z.number().int().min(0).max(24).optional(),
  happiness: z.number().int().min(0).max(255).optional(),
  status: strish,
  heldItem: strish,
  abilityName: strish,
  // Число, а не строка: см. strish выше.
  originalTrainer: strish,
  createdAt: z.union([z.number(), z.string()]).optional(),
  caughtLocation: strish,
  candiesEaten: z.number().int().min(0).optional(),
  vitaminsEaten: z.number().int().min(0).optional(),
  evPool: z.number().int().min(0).optional(),
  exp: z.number().int().min(0).optional(),
  expToNext: z.number().int().min(0).optional(),
  trainingStage: z.number().int().min(0).optional(),
  trainingStat: strish,
  movesPP: z.array(z.object({ current: z.number(), max: z.number() })).optional(),
  statStages: z.any().optional(),
  berries: z.record(z.number()).optional(),
  learnableMoves: z.array(z.any()).optional(),
});

// ── Основная схема save_data ──
export const saveDataSchema = z.object({
  // Обязательные поля с минимальной валидацией
  // Ключ инвентаря проверяется по форме, а не по списку.
  //
  // Раньше здесь стоял z.enum(VALID_ITEM_IDS) — 88 записей, тогда как в
  // src/data/items.ts определено 1288 предметов, из которых 1207 в список не
  // попали. Список поддерживался вручную и разошёлся с игрой. Как только в
  // инвентаре оказывался любой «новый» предмет — superDarkBall из награды за
  // зал, suspiciousEgg из питомника, любой дроп — z.enum отклонял весь объект,
  // и каждый последующий POST /save возвращал 422. Облачное сохранение для
  // такого аккаунта переставало работать навсегда, молча: клиент получал ошибку
  // в catch и показывал только ☁️✗.
  //
  // Перечисление id не давало реальной защиты: экономика (/economy/buy, /sell,
  // /craft) проверяет предмет по собственной серверной priceMap из ITEMS и не
  // доверяет содержимому save_data, поэтому «подсунуть» предмет через сейв
  // было и раньше нельзя. Ограничиваем только форму ключа и целочисленность
  // значения.
  //
  // ВАЖНО (K1, 2026-10-08): потолка на ВЕЛИЧИНУ больше нет. Раньше здесь стояло
  // max(999999) — и оно же ограничивало `credit`, потому что кредиты лежат в
  // том же record. То есть любой сейв с балансом больше миллиона (даже просто
  // заработанным) отбивался Zod'ом с 422, клиент получал ошибку и не сохранял
  // вообще — облако показывало «☁️✗», и счёт откатывался после F5.
  // Верхняя граница теперь — только целое число, помещающееся в money(int4).
  inventory: z.record(
    z.string().min(1).max(64).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'itemId: только латиница, цифры и подчёркивание'),
    z.number().int().min(0).max(2_147_483_647)
  ).optional().default({}),

  myTeam: z.array(teamMonSchema)
    .max(6, 'Команда не может содержать больше 6 покемонов')
    .optional()
    .default([]),

  badges: z.array(
    z.enum(VALID_BADGES)
  ).optional().default([]),

  pcBoxes: z.array(
    z.array(teamMonSchema)
  ).optional().default([]),

  // Опциональные поля — без строгой валидации
  currentLocationId: z.string().optional(),
  currentRegion: z.string().optional(),
  lastLocation: z.string().nullable().optional(),
  visitedLocations: z.any().optional(),
  isDaytime: z.boolean().optional(),
  moveTypeCache: z.any().optional(),
  trainerNickname: z.string().max(32).optional(),
  expShareActive: z.boolean().optional(),
  serverDropConfig: z.any().optional(),
  pokedexSeen: z.any().optional(),
  pokedexCaught: z.any().optional(),
  itemsUsedInBattle: z.number().int().min(0).optional(),
  notifications: z.array(z.any()).optional(),
  daycareMons: z.array(z.any()).optional(),
  transport: z.any().optional(),
  breedingPairs: z.array(z.any()).optional(),
  breedBoxes: z.array(z.any()).optional(),
  eggs: z.array(z.any()).optional(),
  hatching: z.boolean().optional(),
  quests: z.array(z.any()).optional(),
  questProgress: z.record(z.number()).optional(),
  completedQuests: z.array(z.string()).optional(),
  npcQuestProgress: z.record(z.number()).optional(),
  completedNPCQuests: z.array(z.string()).optional(),
  achievements: z.array(z.string()).optional(),
  battleWins: z.number().int().min(0).optional(),
  tutorialStep: z.number().int().min(0).optional(),
  itemHistory: z.array(z.any()).optional(),
  lastRewardTime: z.number().optional(),
  _ts: z.number().optional(),
  saveVersion: z.number().optional(),

  // Разрешаем любые дополнительные поля (чтобы не ломать клиент)
}).passthrough();

export type ValidatedSaveData = z.infer<typeof saveDataSchema>;

/**
 * validateSaveData — проверить save_data по схеме.
 * Возвращает { success, data, errors }
 */
export function validateSaveData(raw: any) {
  const result = saveDataSchema.safeParse(raw);
  if (result.success) {
    return { success: true as const, data: result.data, errors: null };
  }
  return {
    success: false as const,
    data: null,
    errors: result.error.issues.map(i =>
      `${i.path.join('.')}: ${i.message}`
    ),
  };
}
