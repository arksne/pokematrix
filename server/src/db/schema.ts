/**
 * Drizzle ORM — PostgreSQL схема.
 * Все таблицы, которые нужны серверу для работы с клиентом.
 */
import { pgTable, serial, integer, text, timestamp, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';

// ── Пользователи ─────────────────────────────────────────────
// Основная таблица: регистрация, save_data, профиль
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  /** Telegram user ID (уникальный) */
  tg_id: integer('tg_id').notNull().unique(),
  /** Telegram username */
  username: text('username'),
  /** Telegram first_name */
  first_name: text('first_name'),
  /** Игровой никнейм */
  nickname: text('nickname').default(''),
  /** ID спрайта аватара */
  avatar: text('avatar').default('trainer_f'),
  /** Прошёл регистрацию (0/1) */
  registered: integer('registered').default(0),
  /** Является админом */
  is_admin: integer('is_admin').default(0),
  /** Полный save-data игры (JSON) */
  save_data: text('save_data').default('{}'),
  /** Версия сохранения */
  save_version: integer('save_version').default(0),
  /** Количество кредитов */
  money: integer('money').default(500),
  /** Количество значков */
  badges_count: integer('badges_count').default(0),
  /** Количество покемонов в команде */
  pokemon_count: integer('pokemon_count').default(0),
  /** Дата регистрации */
  created_at: text('created_at').default('now()'),
  /** Последний визит */
  last_seen: text('last_seen').default('now()'),
  /** Текущая локация */
  location_id: text('location_id').default('goldenrod'),
  /** Текущий регион */
  region: text('region').default('johto'),
});

// ── JWT Refresh Tokens ───────────────────────────────────────
// Каждый refresh token — отдельная запись.
// При refresh: старый удаляется, новый создаётся.
export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  /** ID пользователя */
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** Уникальный токен */
  token: text('token').notNull().unique(),
  /** Дата истечения (ISO) */
  expires_at: text('expires_at').notNull(),
});

// ── История чата ─────────────────────────────────────────────
export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  /** ID отправителя */
  user_id: integer('user_id').notNull(),
  /** Текст сообщения */
  text: text('text').notNull(),
  /** Дата создания (ISO) */
  created_at: text('created_at').notNull().default('now()'),
});

// ── Серверные фичи (тогглы) ─────────────────────────────────
// double_exp, beta_mode, shiny_boost, free_shop
export const serverFeatures = pgTable('server_features', {
  feature: text('feature').primaryKey(),
  enabled: integer('enabled').default(0),
});

// ── Конфигурация дропов ─────────────────────────────────────
// Переопределяет статические дефолты на клиенте
export const dropConfig = pgTable('drop_config', {
  id: serial('id').primaryKey(),
  monster_drops: text('monster_drops').notNull().default('{}'),
  universal_drops: text('universal_drops').notNull().default('[]'),
});

// ── Кэш PokeAPI ─────────────────────────────────────────────
// Клиент делает много запросов к PokeAPI — кэшируем,
// чтобы не ддосить внешнее API и ускорить ответы.
export const pokemonCache = pgTable('pokemon_cache', {
  name: text('name').primaryKey(),
  data: text('data').notNull(),
  fetched_at: text('fetched_at').notNull().default('now()'),
});
