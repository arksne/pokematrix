/**
 * Client error log route:
 *   POST /api/log-client-error — клиент отправляет ошибки
 *
 * Просто логирует. Ответ не нужен (sendBeacon не ждёт).
 */
import { Router, Request, Response } from 'express';

const router = Router();

// Логи анонимные, поэтому их содержимое ограничиваем: без этого один запрос
// на 5 МБ (лимит express.json) превращался в многосоткибайтную строку в логах.
const MAX_FIELD = 500;

function clip(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).slice(0, MAX_FIELD);
}

router.post('/', (req: Request, res: Response) => {
  const { msg, src, line, col, stack, url, time } = req.body || {};
  console.warn('[client-error]', JSON.stringify({
    msg: clip(msg), src: clip(src), line, col, url: clip(url), time,
  }));
  if (stack) console.warn('[client-error stack]', clip(stack));
  res.status(204).end();
});

export default router;
