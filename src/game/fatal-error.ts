/**
 * Дружелюбный экран фатальной ошибки + глобальные обработчики.
 *
 * Раньше при сбое инициализации игрок видел прямо в игре:
 *   «INIT ERROR: <сообщение> <стек>»
 * — внутренний текст с путями к файлам вместо понятной реакции. На телефоне в
 * Telegram Mini App это выглядит как «игра сломалась навсегда», хотя обычно
 * достаточно перезагрузить. Здесь: понятный заголовок, подсказка, кнопка
 * «Обновить», а технические детали — в <details> и в консоль.
 *
 * Глобальные обработчики (window.onerror / unhandledrejection) раньше только
 * писали в консоль: игрок не понимал, почему действие не сработало. Теперь
 * показываем короткий тост (не чаще раза в 8 секунд), а подробности уходят в
 * консоль и в отчёт об ошибке.
 */

export interface FatalErrorView {
  /** Что показать крупно. */
  title: string;
  /** Что делать игроку. */
  hint: string;
  /** Технические детали (сообщение + стек) — в <details>/консоль. */
  details: string;
}

/** Текст экрана для любой ошибки — строки, Error, неизвестного значения. */
export function fatalErrorView(err: unknown): FatalErrorView {
  let message = '';
  let stack = '';
  if (err instanceof Error) {
    message = err.message || err.name || 'Error';
    stack = err.stack || '';
  } else if (typeof err === 'string') {
    message = err;
  } else if (err && typeof err === 'object') {
    const anyErr = err as any;
    message = String(anyErr.message || anyErr.reason || '');
    stack = String(anyErr.stack || '');
  }
  const details = [message, stack].filter(Boolean).join('\n\n').trim();
  return {
    title: 'Не удалось загрузить игру',
    hint: 'Проверьте соединение и нажмите «Обновить». Если не поможет — закройте и откройте игру заново из Telegram.',
    details: details || 'Подробностей нет — смотрите консоль.',
  };
}

/** Поставить глобальные обработчики ошибок (идемпотентно). */
export function installGlobalErrorHandlers(
  opts: {
    win?: Window & typeof globalThis;
    showToast?: (msg: string, isError?: boolean) => void;
    now?: () => number;
  } = {}
): void {
  const win = opts.win || (typeof window !== 'undefined' ? (window as any) : null);
  if (!win || (win as any).__pmErrorHandlersInstalled) return;
  (win as any).__pmErrorHandlersInstalled = true;
  const toast = opts.showToast || (() => {});
  const now = opts.now || (() => Date.now());
  // -Infinity: ПЕРВАЯ ошибка показывается всегда (с 0 при now()=0 она бы
  // считалась «слишком частой» и тост не появлялся вовсе).
  let lastShown = -Infinity;
  const notify = (what: string) => {
    const t = now();
    if (t - lastShown < 8000) return; // не спамим тостами
    lastShown = t;
    try {
      toast(`Что-то пошло не так (${what}). Подробности — в консоли.`, true);
    } catch {
      /* тост не критичен */
    }
  };
  win.addEventListener?.('error', (event: any) => {
    console.error('[fatal-error] window.onerror:', event?.error || event?.message || event);
    notify('ошибка в скрипте');
  });
  win.addEventListener?.('unhandledrejection', (event: any) => {
    console.error('[fatal-error] unhandledrejection:', event?.reason || event);
    notify('сбой запроса');
  });
}

/**
 * Показать экран фатальной ошибки вместо внутреннего текста «INIT ERROR».
 * Возвращает созданный элемент (или null, если DOM недоступен/уже показан).
 */
export function renderFatalError(err: unknown, doc: Document | null = typeof document !== 'undefined' ? document : null): HTMLElement | null {
  if (!doc || !doc.body) return null;
  const existing = doc.getElementById('fatal-error-panel');
  if (existing) return existing as HTMLElement;
  const view = fatalErrorView(err);
  console.error('[fatal-error]', err);

  const panel = doc.createElement('div');
  panel.id = 'fatal-error-panel';
  panel.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;' +
      'background:rgba(10,10,20,0.92);color:#fff;font-family:system-ui,sans-serif;text-align:center;'
  );

  const card = doc.createElement('div');
  card.setAttribute('style', 'max-width:420px;width:100%;background:#1c1c2b;border-radius:16px;padding:24px;');

  const title = doc.createElement('h2');
  title.textContent = view.title;
  title.setAttribute('style', 'margin:0 0 10px;font-size:1.15rem;');

  const hint = doc.createElement('p');
  hint.textContent = view.hint;
  hint.setAttribute('style', 'margin:0 0 16px;font-size:0.9rem;line-height:1.45;opacity:0.85;');

  const reload = doc.createElement('button');
  reload.id = 'fatal-error-reload';
  reload.textContent = 'Обновить';
  reload.setAttribute(
    'style',
    'width:100%;padding:12px;border:0;border-radius:10px;background:#4c7dff;color:#fff;font-weight:700;font-size:1rem;cursor:pointer;'
  );
  reload.addEventListener('click', () => {
    try {
      (doc.defaultView || (typeof window !== 'undefined' ? window : null))?.location?.reload();
    } catch {
      /* ignore */
    }
  });

  const details = doc.createElement('details');
  details.setAttribute('style', 'margin-top:14px;text-align:left;font-size:0.75rem;opacity:0.7;');
  const summary = doc.createElement('summary');
  summary.textContent = 'Технические детали';
  const pre = doc.createElement('pre');
  pre.setAttribute('style', 'white-space:pre-wrap;word-break:break-word;margin:8px 0 0;');
  pre.textContent = view.details;
  details.appendChild(summary);
  details.appendChild(pre);

  card.appendChild(title);
  card.appendChild(hint);
  card.appendChild(reload);
  card.appendChild(details);
  panel.appendChild(card);
  doc.body.appendChild(panel);
  return panel;
}
