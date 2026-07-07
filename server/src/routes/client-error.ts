/**
 * Client error log route:
 *   POST /api/log-client-error — клиент отправляет ошибки
 *
 * Просто логирует. Ответ не нужен (sendBeacon не ждёт).
 */
import { Router, Request, Response } from 'express';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  const { msg, src, line, col, stack, url, time } = req.body || {};
  console.warn('[client-error]', JSON.stringify({ msg, src, line, col, url, time }));
  if (stack) console.warn('[client-error stack]', stack);
  res.status(204).end();
});

export default router;
