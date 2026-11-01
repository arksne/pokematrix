import { describe, it, expect, vi } from 'vitest';
import {
  createWarmingUI,
  installWarmingHandler,
  WARMING_OVERLAY_ID,
  WARMING_HINT_DELAY_MS,
  WARMING_MAX_VISIBLE_MS,
  type WarmingDocument,
  type WarmingElement,
} from '../warming.js';

/**
 * Холодный старт Render Free: пока инстанс поднимается, сервер отвечает
 * 503 {status:'warming'} и apiClient терпит до 45 секунд. Раньше игрок всё это
 * время смотрел на мёртвый интерфейс — теперь есть оверлей «Сервер
 * просыпается…». Тесты фиксируют: один оверлей на несколько запросов, он
 * исчезает после ответа, сам гаснет по таймауту-страховке и меняет подсказку.
 */

function fakeElement(id = ''): WarmingElement & { children: WarmingElement[] } {
  const el: any = {
    id,
    style: {} as Record<string, string>,
    innerHTML: '',
    className: '',
    children: [],
    appendChild(child: any) {
      el.children.push(child);
      return child;
    },
  };
  // cssText в реальном DOM — просто строка стилей.
  Object.defineProperty(el.style, 'cssText', {
    set(v: string) {
      el._cssText = v;
    },
    get() {
      return el._cssText || '';
    },
    configurable: true,
  });
  return el;
}

class FakeDoc implements WarmingDocument {
  body = { children: [] as any[], appendChild(child: any) { this.children.push(child); return child; } };
  created: WarmingElement[] = [];
  timers: Array<{ fn: () => void; ms: number; id: number }> = [];
  private nextId = 1;

  getElementById(id: string): WarmingElement | null {
    const children = this.body?.children ?? [];
    return (children.find((c: any) => c.id === id) as WarmingElement) || null;
  }
  createElement(_tag: string): WarmingElement {
    const el = fakeElement();
    this.created.push(el);
    return el;
  }
  setTimeout(fn: () => void, ms: number): unknown {
    const id = this.nextId++;
    this.timers.push({ fn, ms, id });
    return id;
  }
  clearTimeout(handle: unknown): void {
    this.timers = this.timers.filter((t) => t.id !== handle);
  }
  /** Прогнать все запланированные таймеры (для проверки подсказки/страховки). */
  runTimers(ms?: number): void {
    const due = ms === undefined ? this.timers : this.timers.filter((t) => t.ms <= ms);
    this.timers = this.timers.filter((t) => !due.includes(t));
    due.forEach((t) => t.fn());
  }
}

describe('оверлей «Сервер просыпается…»', () => {
  it('показывает оверлей с понятным текстом и спиннером', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    ui.show();
    const overlay = doc.getElementById(WARMING_OVERLAY_ID);
    expect(overlay).toBeTruthy();
    expect(overlay!.style.display).toBe('flex');
    expect(overlay!.innerHTML).toContain('Сервер просыпается');
    expect(overlay!.innerHTML).toContain('pm-warming-spin');
    expect(ui.visible).toBe(true);
  });

  it('несколько параллельных запросов — один оверлей, скрывается после последнего', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    ui.show();
    ui.show();
    expect(doc.body.children.filter((c: any) => c.id === WARMING_OVERLAY_ID)).toHaveLength(1);
    expect(ui.shownCount).toBe(1);
    ui.hide();
    expect(ui.visible).toBe(true); // ещё один запрос ждёт
    ui.hide();
    expect(ui.visible).toBe(false);
    expect(doc.getElementById(WARMING_OVERLAY_ID)!.style.display).toBe('none');
  });

  it('через 20 секунд подсказка меняется на «Почти готово»', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    ui.show();
    doc.runTimers(WARMING_HINT_DELAY_MS);
    const overlay = doc.getElementById(WARMING_OVERLAY_ID)!;
    expect(overlay.innerHTML).toContain('Почти готово');
  });

  it('сам гаснет по страховочному таймауту (если «готово» не пришло)', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    ui.show();
    expect(ui.visible).toBe(true);
    doc.runTimers(WARMING_MAX_VISIBLE_MS);
    ui.show(); // уже поработали после таймаута
    ui.hide();
    expect(doc.getElementById(WARMING_OVERLAY_ID)!.style.display).toBe('none');
  });

  it('hide без show не падает и не показывает оверлей', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    expect(() => ui.hide()).not.toThrow();
    expect(doc.body.children).toHaveLength(0);
    expect(ui.visible).toBe(false);
  });

  it('переиспользует уже существующий оверлей (повторный show)', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    ui.show();
    ui.hide();
    ui.show();
    expect(doc.body.children.filter((c: any) => c.id === WARMING_OVERLAY_ID)).toHaveLength(1);
    expect(ui.shownCount).toBe(2);
  });
});

describe('installWarmingHandler', () => {
  it('подписывает window.__pokematrixWarming на show/hide', () => {
    const doc = new FakeDoc();
    const ui = createWarmingUI(doc);
    const win: { __pokematrixWarming?: (on: boolean) => void } = {};
    installWarmingHandler(win, ui);
    expect(typeof win.__pokematrixWarming).toBe('function');
    win.__pokematrixWarming!(true);
    expect(ui.visible).toBe(true);
    win.__pokematrixWarming!(false);
    expect(ui.visible).toBe(false);
  });

  it('не падает, если UI ещё не может рисовать (нет body)', () => {
    const doc = new FakeDoc();
    doc.body = null as any;
    const ui = createWarmingUI(doc);
    const win: { __pokematrixWarming?: (on: boolean) => void } = {};
    installWarmingHandler(win, ui);
    expect(() => win.__pokematrixWarming!(true)).not.toThrow();
    expect(ui.visible).toBe(true); // состояние есть, рисовать некуда — не критично
  });
});
