/**
 * PokeMatrix League17 — Сервер
 *
 * Express + Socket.IO + PostgreSQL (Drizzle ORM).
 * Точка входа: настраивает middleware, маршруты, Socket.IO.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { connectDb, runMigrations, closeDb } from './db/index.js';
import { socketAuthMiddleware } from './middleware/auth.js';
import { initLobby } from './socket/lobby.js';
import { initTrade } from './socket/trade.js';
import { initPvP } from './socket/pvp.js';

// ── Маршруты ─────────────────────────────────────────────────
import authRoutes from './routes/auth.js';
import saveRoutes from './routes/save.js';
import economyRoutes from './routes/economy.js';
import chatRoutes from './routes/chat.js';
import profileRoutes from './routes/profile.js';
import pokeapiRoutes from './routes/pokeapi.js';
import dropsRoutes from './routes/drops.js';
import leaderboardRoutes from './routes/leaderboard.js';
import battleRoutes from './routes/battle.js';
import adminRoutes from './routes/admin.js';
import clientErrorRoutes from './routes/client-error.js';

// ── Pino logger ──────────────────────────────────────────────
import pino from 'pino';
export const logger = pino({
  level: config.logLevel,
  transport: config.isProduction ? undefined : { target: 'pino-pretty' },
});

// ── __dirname для ESM ───────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..'); // server/ → корень проекта

async function main() {
  // ── Подключение к БД ─────────────────────────────────────
  logger.info('[server] Connecting to database...');
  const { db } = connectDb();
  try { await runMigrations(); } catch(e: any) {
    logger.error({ err: e, message: e.message }, '[server] Migration FAILED — tables may not exist');
    // Не падаем — даём шанс, если таблицы уже созданы вручную
  }
  logger.info('[server] Database connected');

  // ── Express ───────────────────────────────────────────────
  const app = express();
  const httpServer = createServer(app);

  // ── CORS ──────────────────────────────────────────────────
  app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
  }));

  // ── Security headers ─────────────────────────────────────
  if (config.isProduction) {
    app.use(helmet({ contentSecurityPolicy: false }));
  }

  // ── Body parsers ─────────────────────────────────────────
  app.use(express.json({ limit: '5mb' }));  // save_data может быть большим
  app.use(express.urlencoded({ extended: true }));

  // ── Static files (в продакшне — собранный клиент) ────────
  if (config.isProduction) {
    app.use(express.static(path.join(ROOT_DIR, 'dist')));
  }

  // ── Pino logger middleware ────────────────────────────────
  app.use((req, res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'request');
    next();
  });

  // ── Routes ────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/save', saveRoutes);
  app.use('/api/economy', economyRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/pokeapi', pokeapiRoutes);
  app.use('/api/drops', dropsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/battle', battleRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/admin', adminRoutes);  // backward compat for client admin panel
  app.use('/api/log-client-error', clientErrorRoutes);

  // ── Health check ─────────────────────────────────────────
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  // ── SPA fallback (продакшн) ──────────────────────────────
  if (config.isProduction) {
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: path.join(ROOT_DIR, 'dist') });
    });
  }

  // ── Socket.IO ─────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  // Сохраняем io в app для доступа из routes
  app.set('io', io);

  // Socket.IO auth middleware
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    logger.info(`[socket] connected: ${socket.id} (user: ${socket.data.user?.tgId})`);

    // Инициализируем обработчики событий
    initLobby(io, socket);
    initTrade(io, socket);
    initPvP(io, socket);

    socket.on('error', (err) => {
      logger.error({ err }, '[socket] error');
    });
  });

  // ── Graceful shutdown ─────────────────────────────────────
  process.on('SIGTERM', async () => {
    logger.info('[server] SIGTERM received, shutting down...');
    io.close();
    httpServer.close();
    await closeDb();
    process.exit(0);
  });

  // ── Запуск ───────────────────────────────────────────────
  httpServer.listen(config.port, () => {
    logger.info(`[server] PokeMatrix server running on port ${config.port}`);
    logger.info(`[server] Environment: ${config.isProduction ? 'production' : 'development'}`);

    // ── Предупреждения о безопасности ──
    if (!process.env.JWT_SECRET) {
      logger.warn('[security] JWT_SECRET не задан — используется default-значение! Установите JWT_SECRET в переменных окружения.');
    }
    if (!process.env.ADMIN_PASS) {
      logger.warn('[security] ADMIN_PASS не задан — используется default-значение! Установите ADMIN_PASS в переменных окружения.');
    }
    if (!config.botToken) {
      logger.warn('[security] BOT_TOKEN не задан — HMAC-верификация initData отключена!');
    }
  });
}

main().catch((err) => {
  logger.error({ err }, '[server] Failed to start');
  process.exit(1);
});
