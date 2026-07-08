/**
 * Drizzle ORM — PostgreSQL схема.
 * Все таблицы, которые нужны серверу.
 */
import { pgTable, serial, integer, bigint, text, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  tg_id: bigint('tg_id', { mode: 'number' }).notNull().unique(),
  username: text('username'),
  first_name: text('first_name'),
  nickname: text('nickname').default(''),
  avatar: text('avatar').default('trainer_f'),
  registered: integer('registered').default(0),
  is_admin: integer('is_admin').default(0),
  save_data: text('save_data').default('{}'),
  save_version: integer('save_version').default(0),
  money: integer('money').default(500),
  badges_count: integer('badges_count').default(0),
  pokemon_count: integer('pokemon_count').default(0),
  created_at: text('created_at'),
  last_seen: text('last_seen'),
  location_id: text('location_id').default('goldenrodCity'),
  region: text('region').default('johto'),
  battle_state: text('battle_state').default('{}'),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expires_at: text('expires_at').notNull(),
  consumed_at: text('consumed_at'),
});

export const chatMessages = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  text: text('text').notNull(),
  created_at: text('created_at').notNull(),
});

export const serverFeatures = pgTable('server_features', {
  feature: text('feature').primaryKey(),
  enabled: integer('enabled').default(0),
});

export const dropConfig = pgTable('drop_config', {
  id: serial('id').primaryKey(),
  monster_drops: text('monster_drops').notNull().default('{}'),
  universal_drops: text('universal_drops').notNull().default('[]'),
});

export const pokemonCache = pgTable('pokemon_cache', {
  name: text('name').primaryKey(),
  data: text('data').notNull(),
  fetched_at: text('fetched_at').notNull(),
});

export const battleRatings = pgTable('battle_ratings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  rating: integer('rating').default(1000),
  wins: integer('wins').default(0),
  losses: integer('losses').default(0),
  updated_at: text('updated_at'),
});
