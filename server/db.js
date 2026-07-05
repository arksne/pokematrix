import { createClient } from '@libsql/client';
import { mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db;

export async function initDB(retries = 3) {
  const dataDir = process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || path.join(__dirname, '../data');
  mkdirSync(dataDir, { recursive: true });

  // Warn if no persistent volume path is set in production — DB will be lost on every deploy
  if (process.env.NODE_ENV === 'production' && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR) {
    console.warn('*** WARNING: RAILWAY_VOLUME_MOUNT_PATH is not set. Database will be lost on every deploy! ***');
  }

  // RESET_DB_ON_STARTUP=1 — удаляет существующую БД и создаёт чистую
  if (process.env.RESET_DB_ON_STARTUP === '1') {
    const dbPath = path.join(dataDir, 'game.db');
    try {
      if (fs.existsSync(dbPath)) {
        fs.rmSync(dbPath, { force: true });
        // Also remove WAL and SHM files
        try { fs.rmSync(dbPath + '-wal', { force: true }); } catch(_) {}
        try { fs.rmSync(dbPath + '-shm', { force: true }); } catch(_) {}
        console.log('*** RESET_DB: deleted existing game.db ***');
      }
    } catch(e) {
      console.error('RESET_DB: could not delete DB:', e.message);
    }
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const dbPath = path.join(dataDir, 'game.db');
      const client = createClient({ url: 'file:' + dbPath.replace(/\\/g, '/') });
      // Enable WAL mode for concurrent reads/writes
      await client.execute('PRAGMA journal_mode = WAL');
      await client.execute('PRAGMA foreign_keys = ON');

      // Wrap @libsql/client's async API to match the existing interface
      // so all existing route code (await db.get/all/run/exec) works unchanged.
      db = {
        get: (sql, ...params) =>
          client.execute({ sql, args: params.length ? params : undefined }).then(r => r.rows[0] ?? null),
        all: (sql, ...params) =>
          client.execute({ sql, args: params.length ? params : undefined }).then(r => r.rows),
        run: (sql, ...params) =>
          client.execute({ sql, args: params.length ? params : undefined }).then(r => ({
            changes: Number(r.rowsAffected),
            lastID: r.lastInsertRowid ? Number(r.lastInsertRowid) : 0,
          })),
        exec: (sql) =>
          client.executeMultiple(sql),
        // Transaction control — must use execute() not executeMultiple()
        // because executeMultiple() doesn't maintain transaction state.
        begin: () => client.execute({ sql: 'BEGIN' }),
        commit: () => client.execute({ sql: 'COMMIT' }),
        rollback: () => client.execute({ sql: 'ROLLBACK' }),
        close: () => {
          client.close();
          return Promise.resolve();
        },
      };
      break;
    } catch (e) {
      console.error(`DB connection attempt ${attempt}/${retries} failed:`, e.message);
      if (attempt === retries) throw e;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT UNIQUE NOT NULL,
      username TEXT DEFAULT '',
      first_name TEXT DEFAULT '',
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '\u{1F464}',
      starter_pokemon TEXT DEFAULT '',
      registered INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      registered_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      save_data TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS leaderboard (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      badges_count INTEGER DEFAULT 0,
      team_level_sum INTEGER DEFAULT 0,
      money INTEGER DEFAULT 0,
      pokemon_count INTEGER DEFAULT 0,
      legendary_count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS user_locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      location_id TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT DEFAULT '',
      first_name TEXT DEFAULT '',
      text TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Ensure pokeapi_cache table exists (separate from initial CREATE for DBs created before migration)
  try { await db.exec(`CREATE TABLE IF NOT EXISTS pokeapi_cache (url TEXT PRIMARY KEY, data TEXT NOT NULL, cached_at TEXT DEFAULT (datetime('now')))`); } catch (e) { /* ignore */ }

  // === Week 9 tables ===
  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS pvp_ratings (
      user_id INTEGER PRIMARY KEY,
      rating INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS player_quests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      claimed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, quest_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      family_id TEXT DEFAULT '',
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS save_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      save_data TEXT NOT NULL,
      saved_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS player_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 0,
      UNIQUE(user_id, item_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS player_badges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      badge_id TEXT NOT NULL,
      unlocked_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, badge_id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `); } catch (e) { /* ignore */ }

  try { await db.exec(`
    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      attempts INTEGER DEFAULT 1,
      first_attempt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip);
    CREATE INDEX IF NOT EXISTS idx_login_attempts_first_attempt ON login_attempts(first_attempt);
  `); } catch (e) { /* ignore */ }

  // Migrations — add columns that might be missing from old DB
  const migrations = [
    `ALTER TABLE users ADD COLUMN nickname TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '\u{1F464}'`,
    `ALTER TABLE users ADD COLUMN starter_pokemon TEXT DEFAULT ''`,
    `ALTER TABLE users ADD COLUMN registered INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN registered_at TEXT DEFAULT ''`,
    `ALTER TABLE leaderboard ADD COLUMN pokemon_count INTEGER DEFAULT 0`,
    `ALTER TABLE leaderboard ADD COLUMN legendary_count INTEGER DEFAULT 0`,
    `ALTER TABLE refresh_tokens ADD COLUMN family_id TEXT DEFAULT ''`,
  ];
  for (const sql of migrations) {
    try { await db.run(sql); } catch (e) {
      if (!e.message.includes('duplicate column')) console.log('Migration skip:', e.message.slice(0, 60));
    }
  }

  console.log('Database initialized');
  return db;
}

export function getDB() {
  return db;
}

export async function closeDB() {
  if (db) {
    try {
      await db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (e) { /* ignore */ }
    await db.close();
    db = null;
  }
}
