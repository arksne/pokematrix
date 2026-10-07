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
import { Server, type Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { connectDb, getDb, runMigrations, closeDb } from './db/index.js';
import { sql } from 'drizzle-orm';
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
import learnsetRoutes from './routes/learnset.js';
import sitemoveRoutes from './routes/sitemove.js';
import dropsRoutes from './routes/drops.js';
import leaderboardRoutes from './routes/leaderboard.js';
import battleRoutes from './routes/battle.js';
import adminRoutes from './routes/admin.js';
import clientErrorRoutes from './routes/client-error.js';
import featuresRoutes from './routes/features.js';

// ── Pino logger ─────────────────────────────────────────────
import { logger } from './logger.js';
export { logger };

// ── __dirname для ESM ───────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..'); // server/ → корень проекта
// Каталог собранного клиента: по умолчанию <корень>/dist, но в контейнере путь
// задаётся через CLIENT_DIST, потому что там /app/dist занят серверным кодом.
const CLIENT_DIST = config.clientDist || path.join(ROOT_DIR, 'dist');

/**
 * Обёртка socket.on: ловит синхронные исключения и отклонённые промисы внутри
 * обработчика, логирует их и гасит. Исключение из callback'а socket.io иначе
 * превращается в uncaughtException и завершает процесс.
 */
function guardSocketHandlers(socket: Socket) {
  const originalOn = socket.on.bind(socket);
  (socket as any).on = (event: string, handler: (...args: any[]) => any) =>
    originalOn(event, (...args: any[]) => {
      try {
        const result = handler(...args);
        if (result && typeof result.then === 'function') {
          result.catch((err: unknown) => {
            logger.error({ err, event }, '[socket] async handler rejected');
          });
        }
        return result;
      } catch (err) {
        logger.error({ err, event }, '[socket] handler threw synchronously');
        return undefined;
      }
    });
}

/** Читает целое из окружения с запасным значением. */
function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  // ── Подключение к БД ─────────────────────────────────────
  logger.info('[server] Connecting to database...');
  const { db } = connectDb();
  try {
    await runMigrations();
  } catch (e: any) {
    // Раньше ошибка миграций только логировалась, сервер продолжал подниматься,
    // /api/health отвечал ok, и каждый запрос к данным падал с 500. В production
    // это означало тихий полный отказ, поэтому теперь останавливаемся.
    logger.error({ err: e, message: e.message }, '[server] Migration FAILED');
    if (config.isProduction) {
      logger.fatal('[server] Не запускаюсь: миграции не применились, схема может отсутствовать');
      await closeDb().catch(() => {});
      process.exit(1);
    }
    logger.warn('[server] Продолжаю работу без миграций (development)');
  }
  logger.info('[server] Database connected');

  // ── Express ───────────────────────────────────────────────
  const app = express();
  const httpServer = createServer(app);

  // За балансировщиком (Render, Koyeb, nginx) req.ip без доверия к прокси
  // равен IP балансировщика, и все клиенты делят один счётчик rate limit.
  app.set('trust proxy', 1);

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
    app.use(express.static(CLIENT_DIST));
  }

  // ── Pino logger middleware ────────────────────────────────
  app.use((req, res, next) => {
    logger.debug({ method: req.method, url: req.url }, 'request');
    next();
  });

  // ── Routes ────────────────────────────────────────────────
  // Лимиты стоят до маршрутов: раньше единственный rate limit во всём сервере
  // был на /api/admin/api, а /api/save (до 5 МБ на запрос), /api/auth/* и
  // /api/economy/* остались без ограничений.
  //
  // Значения считаются по IP клиента (app.set('trust proxy', 1) выше), но за
  // мобильным NAT или корпоративным прокси адрес общий, поэтому значения
  // достаточно мягкие и настраиваются переменными окружения.
  const authLimiter = rateLimit({
    windowMs: 60_000,
    limit: envInt('RATE_LIMIT_AUTH', 30),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many auth attempts, try again later' },
  });
  const writeLimiter = rateLimit({
    windowMs: 60_000,
    limit: envInt('RATE_LIMIT_WRITE', 60),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, slow down' },
  });
  const errorReportLimiter = rateLimit({
    windowMs: 60_000,
    limit: envInt('RATE_LIMIT_LOG', 20),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many error reports' },
  });
  // Прокси к PokeAPI анонимный и на каждый новый путь делает внешний запрос и
  // запись в pokemon_cache. Без лимита anyone could перебрать pokemon/1..100000,
  // раздуть таблицу и нагрузить PokeAPI. Лимит заметно выше игрового: за сессию
  // клиент спрашивает десятки видов и покемонов.
  const proxyLimiter = rateLimit({
    windowMs: 60_000,
    limit: envInt('RATE_LIMIT_PROXY', 120),
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many proxy requests, slow down' },
  });

  app.use('/api/auth/tg', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/refresh', authLimiter);
  app.use('/api/save', writeLimiter);
  app.use('/api/economy', writeLimiter);
  app.use('/api/chat/send', writeLimiter);
  app.use('/api/pokeapi', proxyLimiter);
  app.use('/api/log-client-error', errorReportLimiter);

  app.use('/api/auth', authRoutes);
  app.use('/api/save', saveRoutes);
  app.use('/api/economy', economyRoutes);
  app.use('/api/chat', chatRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/pokeapi', pokeapiRoutes);
  app.use('/api/learnset', learnsetRoutes);
  app.use('/api/sitemove', sitemoveRoutes);
  app.use('/api/drops', dropsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/battle', battleRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/admin', adminRoutes);  // backward compat for client admin panel
  app.use('/api/features', featuresRoutes);  // публичные фичи (читает каждый клиент)
  app.use('/api/log-client-error', clientErrorRoutes);

  // ── Health check ─────────────────────────────────────────
  // Проверяет и БД: раньше возвращал ok всегда, а ошибка миграций
  // проглатывалась, поэтому Render считал сервис здоровым при полностью
  // сломанной базе, и все API отдавали 500.
  app.get('/api/health', async (_req, res) => {
    try {
      await getDb().execute(sql`SELECT 1`);
      res.json({ status: 'ok', db: true, uptime: process.uptime() });
    } catch {
      res.status(503).json({ status: 'degraded', db: false, uptime: process.uptime() });
    }
  });

  // ── 404 для неизвестных API-маршрутов ─────────────────────
  // Должен идти ДО SPA-fallback: тот перехватывал любой GET /api/* и отдавал
  // index.html (200, text/html), из-за чего клиентский res.json() получал HTML
  // и падал с SyntaxError вместо обработки 404.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // ── 404 для несуществующих статических файлов ─────────────
  // Тоже до SPA-fallback: иначе сбитый чанк тихо отдавался как HTML и в консоли
  // появлялся Uncaught SyntaxError вместо внятной ошибки.
  app.use('/assets', (_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  // ── SPA fallback (продакшн) ──────────────────────────────
  if (config.isProduction) {
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: CLIENT_DIST });
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

    // Обработчики событий защищаем от исключений в одной точке.
    // Раньше socket.on регистрировался напрямую, и обработчик вроде
    // pvp_action считал data.battleId до входа в свой try/catch — то есть
    // socket.emit('pvp_action') без аргументов давал TypeError, а обработчик
    // disconnect это вовсе не ловил. Синхронное исключение из callback'а
    // socket.io доходит до uncaughtException и роняет процесс, а на Render
    // Free это cold start с потерей всего in-memory состояния.
    guardSocketHandlers(socket);

    // Инициализируем обработчики событий
    initLobby(io, socket);
    initTrade(io, socket);
    initPvP(io, socket);

    socket.on('error', (err) => {
      logger.error({ err }, '[socket] error');
    });
  });

  // ── Graceful shutdown ─────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info({ signal }, '[server] shutdown signal received');
    try {
      // Прекращаем принимать новые соединения, но даём текущим завершиться:
      // httpServer.close() не ждёт уже принятые запросы, а process.exit()
      // следующей строкой обрывал бы незавершённые POST /api/save.
      await new Promise<void>((resolve) => {
        let settled = false;
        const done = () => { if (!settled) { settled = true; resolve(); } };
        io.close();
        httpServer.close(() => done());
        httpServer.closeIdleConnections?.();
        setTimeout(done, 8000).unref();
      });
      await closeDb();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, '[server] error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('SIGINT', () => { void shutdown('SIGINT'); });

  // ── Запуск ───────────────────────────────────────────────
  httpServer.listen(config.port, () => {
    logger.info(`[server] PokeMatrix server running on port ${config.port}`);
    logger.info(`[server] Environment: ${config.isProduction ? 'production' : 'development'}`);

    // ── Startup diagnostics ──
    if (!process.env.JWT_SECRET) {
      logger.warn('[security] JWT_SECRET не задан — используется default-значение (только для разработки).');
    }
    if (!config.adminPass) {
      logger.warn('[security] ADMIN_PASS не задан — админ-API недоступен.');
    }
    if (!config.botToken) {
      logger.warn('[security] BOT_TOKEN не задан — вход через Telegram отклоняется.');
    }
  });
}

// ── Глобальные обработчики ошибок ───────────────────────────
// Раньше их не было вовсе. Node 22 по умолчанию завершает процесс на
// необработанном отклонении и на событии 'error' без слушателя, а источники были
// реальные: исключение в socket-обработчике (например emit('pvp_action') без
// аргументов) и ошибка idle-соединения pg Pool. Любой авторизованный сокет мог
// уронить процесс, а на Render Free это означало cold start и потерю всего
// in-memory состояния (лобби, трейды, PvP).
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason instanceof Error ? reason : new Error(String(reason)) },
    '[process] unhandled promise rejection — процесс продолжает работу');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, '[process] uncaught exception');
  // Завершаем процесс явно: после необработанного исключения состояние процесса
  // нельзя считать достоверным. Но это контролируемый рестарт, а не падение.
  process.exit(1);
});

main().catch((err) => {
  logger.error({ err }, '[server] Failed to start');
  process.exit(1);
});
