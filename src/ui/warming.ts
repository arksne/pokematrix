/**
 * Экран «Сервер просыпается…» для холодного старта Render Free.
 *
 * На free-плане инстанс засыпает после 15 минут простоя. Первый игрок утром
 * попадает в ~30–60 секунд, когда сервер отвечает 503 {status:'warming'} или
 * соединение вообще отклонено. apiClient это уже переживает: он терпеливо
 * повторяет запросы с backoff до 45 секунд и зовёт callback
 * `window.__pokematrixWarming(true/false)`. Но самого экрана не было — игрок
 * 45 секунд смотрел на мёртвый интерфейс и решал, что игра сломалась.
 *
 * Здесь рисуется понятный оверлей со спиннером и подсказкой, который сам
 * исчезает, когда сервер ответил. Логика вынесена из DOM-зависимостей: на вход
 * можно передать минимальный «документ», поэтому она тестируется юнит-тестами.
 */

export const WARMING_OVERLAY_ID = 'pm-warming-overlay';
/** Страховка: если по какой-то причине «готово» не придёт, оверлей не вечный. */
export const WARMING_MAX_VISIBLE_MS = 90_000;
/** Через сколько сменить подсказку на «почти готово». */
export const WARMING_HINT_DELAY_MS = 20_000;

/** Минимум того, что нужно от документа (в тестах — фейк). */
export interface WarmingDocument {
  getElementById(id: string): WarmingElement | null;
  createElement(tag: string): WarmingElement;
  body: { appendChild(child: WarmingElement): void } | null;
  /** Таймеры (в тестах — управляемые). */
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout?(handle: unknown): void;
}

export interface WarmingElement {
  id: string;
  style: Record<string, string>;
  innerHTML: string;
  className: string;
  appendChild(child: WarmingElement): void;
  remove?(): void;
}

const OVERLAY_STYLE = [
  'position:fixed',
  'inset:0',
  'display:none',
  'flex-direction:column',
  'align-items:center',
  'justify-content:center',
  'gap:14px',
  'padding:28px',
  'text-align:center',
  'background:rgba(9,30,50,0.94)',
  'color:#fff',
  'z-index:99998',
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
].join(';');

const CARD_HTML = `
  <div style="width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,255,255,0.25);border-top-color:#34c759;animation:pm-warming-spin 1s linear infinite;"></div>
  <div style="font-size:1.05rem;font-weight:600;">Сервер просыпается…</div>
  <div data-role="hint" style="font-size:0.85rem;line-height:1.4;color:rgba(255,255,255,0.75);max-width:280px;">
    Это занимает до минуты и случается только после долгой паузы. Не закрывайте приложение — игра загрузится сама.
  </div>`;

export interface WarmingUI {
  /** Показать (счётчик: несколько параллельных запросов — один оверлей). */
  show(): void;
  /** Спрятать (когда сервер ответил). */
  hide(): void;
  /** Виден ли сейчас. */
  readonly visible: boolean;
  /** Сколько раз показывали (для диагностики/тестов). */
  readonly shownCount: number;
}

export function createWarmingUI(doc: WarmingDocument): WarmingUI {
  let depth = 0;
  let shownCount = 0;
  let overlay: WarmingElement | null = null;
  let hintTimer: unknown = null;
  let maxTimer: unknown = null;
  const timers = {
    // Оба метода биндим к документу: в тестах это методы класса FakeDoc, и без
    // bind потеря this ломает очистку таймеров («reading 'filter' of undefined»).
    setTimeout: doc.setTimeout.bind(doc),
    clearTimeout: typeof doc.clearTimeout === 'function' ? doc.clearTimeout.bind(doc) : undefined,
  };

  function ensureOverlay(): WarmingElement | null {
    let el = doc.getElementById(WARMING_OVERLAY_ID);
    if (el) return el;
    if (!doc.body) return null;
    el = doc.createElement('div');
    el.id = WARMING_OVERLAY_ID;
    el.className = 'pm-warming';
    el.style.cssText = OVERLAY_STYLE;
    el.innerHTML = CARD_HTML;
    doc.body.appendChild(el);
    return el;
  }

  function clearTimers() {
    if (hintTimer !== null) timers.clearTimeout?.(hintTimer);
    if (maxTimer !== null) timers.clearTimeout?.(maxTimer);
    hintTimer = null;
    maxTimer = null;
  }

  function applyVisibility(visible: boolean) {
    if (!overlay) return;
    overlay.style.display = visible ? 'flex' : 'none';
  }

  return {
    get visible() {
      return depth > 0;
    },
    get shownCount() {
      return shownCount;
    },
    show() {
      depth++;
      if (depth > 1) return;
      overlay = ensureOverlay();
      if (!overlay) return;
      shownCount++;
      applyVisibility(true);
      // Через 20 секунд меняем подсказку: человек понимает, что процесс живой.
      hintTimer = timers.setTimeout(() => {
        if (overlay && typeof overlay.innerHTML === 'string') {
          overlay.innerHTML = CARD_HTML.replace(
            'Это занимает до минуты и случается только после долгой паузы. Не закрывайте приложение — игра загрузится сама.',
            'Почти готово. Ещё несколько секунд…'
          );
        }
      }, WARMING_HINT_DELAY_MS);
      // Страховка от вечного оверлея, если ответ «готово» не придёт.
      maxTimer = timers.setTimeout(() => {
        depth = 0;
        clearTimers();
        applyVisibility(false);
      }, WARMING_MAX_VISIBLE_MS);
    },
    hide() {
      depth = Math.max(0, depth - 1);
      if (depth > 0) return;
      clearTimers();
      applyVisibility(false);
    },
  };
}

/**
 * Подключить оверлей к клиенту apiClient:
 *   window.__pokematrixWarming(true)  — сервер греется
 *   window.__pokematrixWarming(false) — ответ пришёл
 */
export function installWarmingHandler(
  win: { __pokematrixWarming?: (on: boolean) => void },
  ui: WarmingUI
): void {
  win.__pokematrixWarming = (on: boolean) => {
    if (on) ui.show();
    else ui.hide();
  };
}
