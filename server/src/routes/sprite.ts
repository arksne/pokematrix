/**
 * GET /api/sprite/<path> — спрайты покемонов через наш сервер.
 *
 * Логика и обоснование — в lib/sprite-cache.ts (там же юнит-тесты): GitHub
 * отдаёт картинки с max-age=300, из-за чего вебвью перекачивает их каждые
 * 5 минут, а в части регионов raw.githubusercontent.com недоступен и покемоны
 * выглядят «сломанными». Здесь — кэш в памяти и долгий immutable-кэш.
 */
import { Router, Request, Response } from 'express';
import { logger } from '../logger.js';
import { SpriteCache, isAllowedSpritePath, loadSprite, type SpriteEntry } from '../lib/sprite-cache.js';

const router = Router();
export const spriteCache = new SpriteCache();

const IMMUTABLE = 'public, max-age=31536000, immutable';

function sendSprite(res: Response, entry: SpriteEntry, cacheState: 'HIT' | 'MISS') {
  res.setHeader('Content-Type', entry.contentType || 'image/png');
  res.setHeader('Cache-Control', IMMUTABLE);
  res.setHeader('ETag', entry.etag);
  res.setHeader('X-Sprite-Cache', cacheState);
  res.send(entry.body);
}

router.get('*', async (req: Request, res: Response) => {
  // req.path внутри смонтированного роутера: '/pokemon/other/official-artwork/25.png'
  const spritePath = decodeURIComponent(req.path.replace(/^\//, ''));
  if (!isAllowedSpritePath(spritePath)) {
    res.status(400).json({ error: 'bad sprite path' });
    return;
  }

  const cached = spriteCache.get(spritePath);
  if (cached) {
    // Условный запрос: вебвью с ETag получает 304 вместо 117 КБ PNG.
    if (req.headers['if-none-match'] === cached.etag) {
      res.status(304).end();
      return;
    }
    sendSprite(res, cached, 'HIT');
    return;
  }

  try {
    const loaded = await loadSprite(spritePath);
    if (!loaded) {
      // Не 500: отсутствующий спрайт — это нормальная ситуация (у некоторых
      // форм нет official-artwork), клиент покажет запасной вариант.
      res.status(404).json({ error: 'sprite not found' });
      return;
    }
    spriteCache.set(spritePath, loaded);
    sendSprite(res, loaded, 'MISS');
  } catch (e) {
    logger.warn({ err: e }, '[sprite] proxy failed');
    res.status(502).json({ error: 'sprite upstream error' });
  }
});

export default router;
