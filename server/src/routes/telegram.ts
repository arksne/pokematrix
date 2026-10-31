/**
 * telegram.ts — ответы бота PokeMatrix на сообщения.
 *
 * До этого файла бот был «немым»: Mini App открывался по кнопке меню, но на
 * /start никто не отвечал — игрок видел пустой чат и решал, что бот сломан.
 * В репозитории не было ни одного вызова Bot API (ни webhook, ни getUpdates).
 *
 *   POST /api/telegram/webhook/:secret  — апдейты от Telegram
 *
 * Как включается:
 *   1. TELEGRAM_WEBHOOK_SECRET задан в окружении сервера (иначе маршрут 404);
 *   2. webhook URL вида https://<домен>/api/telegram/webhook/<secret>
 *      регистрируется один раз через setWebhook с secret_token=<secret>;
 *   3. Telegram присылает заголовок X-Telegram-Bot-Api-Secret-Token, и мы
 *      сверяем его с секретом — чужой POST не может писать от имени бота.
 *
 * Отвечаем ВСЕГДА 200 и как можно быстрее: иначе Telegram копит ретраи и в
 * итоге снимает вебхук. Отправка сообщения — fire-and-forget с логом ошибки.
 */
import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { config } from '../config.js';
import { logger } from '../logger.js';

const router = Router();

const TG_API = (method: string) => `https://api.telegram.org/bot${config.botToken}/${method}`;

/** Сравнение секретов без утечки длины по таймингу. */
function sameSecret(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** URL игры, который открывает Mini App. */
function appUrl(): string {
  return `${config.publicUrl}/`;
}

/** Ответ на /start (и на любой текст с незнакомой командой). */
function welcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🎮 Играть в PokeMatrix', web_app: { url: appUrl() } }],
      [{ text: 'ℹ️ Как играть', url: 'https://github.com/arksne/pokematrix' }],
    ],
  };
}

const WELCOME_TEXT =
  'Добро пожаловать в PokeMatrix!\n\n' +
  'Это Pokémon-игра внутри Telegram: ловите покемонов, качайте команду, ' +
  'сражайтесь на арене и обменивайтесь с другими тренерами.\n\n' +
  'Нажмите кнопку ниже, чтобы начать. Прогресс сохраняется автоматически.';

/** Отправка сообщения через Bot API. Ошибки только логируем. */
async function sendMessage(chatId: number, text: string, keyboard?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (keyboard) body.reply_markup = keyboard;
  try {
    const res = await fetch(TG_API('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      logger.warn({ status: res.status, detail: detail.slice(0, 300) }, '[telegram] sendMessage failed');
    }
  } catch (err) {
    logger.warn({ err }, '[telegram] sendMessage error');
  }
}

type TgUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    chat?: { id?: number; type?: string };
    from?: { id?: number; first_name?: string; username?: string };
    text?: string;
  };
};

router.post('/webhook/:secret', (req: Request, res: Response) => {
  // Секрет не задан — маршрут выключен целиком (иначе любой мог бы постить).
  if (!config.telegramWebhookSecret || !config.botToken) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (!sameSecret(String(req.params.secret || ''), config.telegramWebhookSecret)) {
    logger.warn('[telegram] webhook: неверный секрет в пути');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  // Telegram подписывает каждый апдейт заголовком secret_token из setWebhook.
  const headerSecret = String(req.header('x-telegram-bot-api-secret-token') || '');
  if (headerSecret && !sameSecret(headerSecret, config.telegramWebhookSecret)) {
    logger.warn('[telegram] webhook: неверный secret_token заголовок');
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Отвечаем сразу: Telegram ретраит апдейт, если ответа нет.
  res.json({ ok: true });

  const update = req.body as TgUpdate;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  if (!chatId) return;

  const text = (msg?.text || '').trim();
  // Любое сообщение (включая /start и пустой чат) получает кнопку запуска:
  // это единственный экшен, который имеет смысл в боте-обёртке Mini App.
  void sendMessage(chatId, WELCOME_TEXT, welcomeKeyboard());
});

/** Health-проверка маршрута без секрета (для диагностики деплоя). */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    enabled: !!(config.telegramWebhookSecret && config.botToken),
    publicUrl: config.publicUrl,
  });
});

export default router;
