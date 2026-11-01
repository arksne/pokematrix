/**
 * Самолечение после деплоя: устаревшие чанки.
 *
 * Клиент грузит код динамическими импортами (`import('./src/game/init.js')`,
 * ленивые панели), а Vite даёт файлам хэшированные имена. Если игрок держал
 * мини-приложение открытым в момент деплоя, его index.html ссылается на файлы,
 * которых на сервере уже нет, и приложение падает с
 *   TypeError: Failed to fetch dynamically imported module: /assets/init-XXXX.js
 * (такое поймал UI-тур на живом проде сразу после пуша).
 *
 * Лечение: перезагрузить страницу — index.html отдаётся с no-cache и придёт с
 * актуальными ссылками. Защита от цикла: не чаще одного раза за окно.
 */

export const RELOAD_GUARD_KEY = 'pm_chunk_reload_at';
export const RELOAD_GUARD_MS = 30_000;

/** Похоже ли сообщение на «чанк устарел после деплоя»? */
export function looksLikeStaleChunk(text: string): boolean {
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    text || ''
  );
}

export interface HealEnv {
  /** sessionStorage (может отсутствовать/бросать в приватном режиме). */
  storage?: Storage | null;
  /** Перезагрузка страницы. */
  reload: () => void;
  /** Текущее время (для тестов). */
  now?: () => number;
  /** Лог (для тестов). */
  warn?: (msg: string, detail?: unknown) => void;
}

/**
 * Перезагрузить страницу, если ошибка похожа на устаревший чанк и мы ещё не
 * перезагружались в этом окне. Возвращает true, если перезагрузку инициировали.
 */
export function healStaleChunk(reason: string, env: HealEnv): boolean {
  if (!looksLikeStaleChunk(reason)) return false;
  const now = env.now ? env.now() : Date.now();

  // Метка прошлой перезагрузки. Хранилища может не быть (приватный режим,
  // запрет в вебвью) — тогда защита от цикла просто не работает, но лечение
  // обязано сработать: отсутствие storage не повод оставить игрока с мёртвым
  // экраном.
  let lastReloadAt = 0;
  let hasMark = false;
  try {
    const raw = env.storage?.getItem(RELOAD_GUARD_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed > 0) {
        lastReloadAt = parsed;
        hasMark = true;
      }
    }
  } catch {
    // Битое/запрещённое хранилище — считаем, что метки нет.
  }

  // Второй раз за окно не перезагружаемся: значит дело не в деплое,
  // и цикл перезагрузок только испортит впечатление.
  if (hasMark && now - lastReloadAt < RELOAD_GUARD_MS) return false;

  try {
    env.storage?.setItem(RELOAD_GUARD_KEY, String(now));
  } catch {
    // Не смогли запомнить — перезагружаемся без защиты от цикла.
  }
  env.warn?.('[app] устаревший чанк после деплоя, перезагружаюсь:', reason);
  env.reload();
  return true;
}
