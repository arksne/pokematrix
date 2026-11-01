import { describe, it, expect, vi, afterEach } from 'vitest';
import { fatalErrorView, installGlobalErrorHandlers, renderFatalError } from '../fatal-error.js';

/**
 * Раньше при сбое инициализации игрок видел «INIT ERROR: <стек>» прямо в игре.
 * Теперь — понятный экран с кнопкой «Обновить», а глобальные ошибки дают
 * короткий тост вместо тихого молчания в консоли.
 */
describe('fatalErrorView — текст для игрока', () => {
  it('Error: заголовок/подсказка человеческие, детали отдельно', () => {
    const view = fatalErrorView(new Error('boom'));
    expect(view.title).toBe('Не удалось загрузить игру');
    expect(view.hint).toMatch(/Обновить/);
    expect(view.details).toContain('boom');
  });

  it('строки и неизвестные значения не ломают экран', () => {
    expect(fatalErrorView('network down').details).toContain('network down');
    expect(fatalErrorView(null).details).toMatch(/Подробностей нет/);
    expect(fatalErrorView(undefined).title).toBe('Не удалось загрузить игру');
    expect(fatalErrorView({ reason: 'rejected' }).details).toContain('rejected');
  });
});

describe('installGlobalErrorHandlers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fakeWin() {
    const handlers: Record<string, ((e: any) => void)[]> = {};
    return {
      __pmErrorHandlersInstalled: false,
      addEventListener(type: string, fn: (e: any) => void) {
        (handlers[type] = handlers[type] || []).push(fn);
      },
      emit(type: string, event: any) {
        for (const fn of handlers[type] || []) fn(event);
      },
    };
  }

  it('один раз ставит обработчики и не дублирует их', () => {
    const win: any = fakeWin();
    const showToast = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installGlobalErrorHandlers({ win, showToast });
    installGlobalErrorHandlers({ win, showToast });
    win.emit('error', { message: 'x' });
    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('не спамит тостами чаще, чем раз в 8 секунд', () => {
    const win: any = fakeWin();
    const showToast = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let t = 0;
    installGlobalErrorHandlers({ win, showToast, now: () => t });
    win.emit('error', { message: 'a' });
    t = 1000;
    win.emit('error', { message: 'b' });
    t = 2000;
    win.emit('unhandledrejection', { reason: 'c' });
    expect(showToast).toHaveBeenCalledTimes(1);
    t = 9000;
    win.emit('unhandledrejection', { reason: 'd' });
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  it('тост-ошибка помечена как ошибка и рассказывает про консоль', () => {
    const win: any = fakeWin();
    const showToast = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    installGlobalErrorHandlers({ win, showToast });
    win.emit('error', { message: 'x' });
    const [msg, isError] = showToast.mock.calls[0];
    expect(isError).toBe(true);
    expect(msg).toMatch(/консоли/);
  });
});

describe('renderFatalError — DOM-панель', () => {
  function fakeDoc() {
    const created: any[] = [];
    const body = { children: [] as any[], appendChild(el: any) { this.children.push(el); } };
    const make = (tag: string) => {
      const el: any = {
        tagName: tag,
        children: [] as any[],
        attrs: {} as Record<string, string>,
        textContent: '',
        id: '',
        setAttribute(k: string, v: string) { this.attrs[k] = v; },
        appendChild(child: any) { this.children.push(child); },
        addEventListener() {},
        getAttribute(k: string) { return this.attrs[k]; },
      };
      created.push(el);
      return el;
    };
    const doc: any = {
      body,
      defaultView: { location: { reload: vi.fn() } },
      getElementById: (id: string) => body.children.find((c) => c.id === id) || null,
      createElement: make,
    };
    return { doc, body, created };
  }

  it('строит панель с заголовком, подсказкой и кнопкой «Обновить»', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { doc, body } = fakeDoc();
    const panel = renderFatalError(new Error('boom'), doc);
    expect(panel).toBeTruthy();
    expect(panel!.id).toBe('fatal-error-panel');
    expect(body.children.length).toBe(1);
    const texts = JSON.stringify(panel);
    expect(texts).toContain('Не удалось загрузить игру');
    expect(texts).toContain('Обновить');
  });

  it('не дублирует панель при повторном вызове', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { doc, body } = fakeDoc();
    renderFatalError(new Error('one'), doc);
    renderFatalError(new Error('two'), doc);
    expect(body.children.length).toBe(1);
  });

  it('без document возвращает null', () => {
    expect(renderFatalError(new Error('x'), null)).toBeNull();
  });
});
