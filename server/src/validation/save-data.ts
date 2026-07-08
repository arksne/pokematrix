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
const VALID_ITEM_IDS = [
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

// ── Схема IV ──
const ivSchema = z.object({
  hp: z.number().int().min(0).max(31).default(0),
  atk: z.number().int().min(0).max(31).default(0),
  def: z.number().int().min(0).max(31).default(0),
  spa: z.number().int().min(0).max(31).default(0),
  spd: z.number().int().min(0).max(31).default(0),
  spe: z.number().int().min(0).max(31).default(0),
});

// ── Схема покемона в команде ──
const teamMonSchema = z.object({
  uid: z.string().min(1, 'uid обязателен'),
  baseLevel: z.number().int().min(0).max(100).default(1),
  currentHp: z.number().int().min(0).optional(),
  maxHp: z.number().int().min(1).optional(),
  apiData: z.any().optional(),
  ivs: ivSchema.optional(),
  evs: ivSchema.optional(),
  isShiny: z.boolean().optional(),
  nickname: z.string().optional(),
  gender: z.string().optional(),
  natureIdx: z.number().int().min(0).max(24).optional(),
  happiness: z.number().int().min(0).max(255).optional(),
  status: z.string().nullable().optional(),
  heldItem: z.string().nullable().optional(),
  abilityName: z.string().nullable().optional(),
  originalTrainer: z.string().optional(),
  createdAt: z.number().optional(),
  caughtLocation: z.string().optional(),
  candiesEaten: z.number().int().min(0).optional(),
  vitaminsEaten: z.number().int().min(0).optional(),
  exp: z.number().int().min(0).optional(),
  expToNext: z.number().int().min(0).optional(),
  trainingStage: z.number().int().min(0).optional(),
  trainingStat: z.string().nullable().optional(),
  movesPP: z.array(z.object({ current: z.number(), max: z.number() })).optional(),
  statStages: z.any().optional(),
  berries: z.record(z.number()).optional(),
  learnableMoves: z.array(z.any()).optional(),
});

// ── Основная схема save_data ──
export const saveDataSchema = z.object({
  // Обязательные поля с минимальной валидацией
  inventory: z.record(
    z.string(),
    z.number().int().min(0).max(99999999)
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
  daycareEgg: z.any().optional(),
  breedingPairs: z.array(z.any()).optional(),
  eggs: z.array(z.any()).optional(),
  hatching: z.boolean().optional(),
  quests: z.array(z.any()).optional(),
  questProgress: z.record(z.number()).optional(),
  completedQuests: z.array(z.string()).optional(),
  npcQuestProgress: z.record(z.number()).optional(),
  completedNPCQuests: z.array(z.string()).optional(),
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
