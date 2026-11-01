import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from '../debounce.js';

/**
 * Покедекс перерисовывал 1025 карточек на каждое нажатие клавиши в поиске —
 * ввод «залипал» на телефоне. Дебаунс вызывается один раз после паузы.
 */
describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('не вызывает функцию до истечения паузы', () => {
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d('a');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(199);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('серия вызовов схлопывается в один — с последними аргументами', () => {
    const fn = vi.fn();
    const d = debounce(fn, 200);
    d('a');
    vi.advanceTimersByTime(50);
    d('b');
    vi.advanceTimersByTime(50);
    d('c');
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('после паузы можно вызвать снова', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d(1);
    vi.advanceTimersByTime(100);
    d(2);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
    expect(fn).toHaveBeenNthCalledWith(2, 2);
  });

  it('cancel отменяет отложенный вызов', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });

  it('cancel после срабатывания безопасен', () => {
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    vi.advanceTimersByTime(100);
    expect(() => d.cancel()).not.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('нулевая задержка не ломает вызов', () => {
    const fn = vi.fn();
    const d = debounce(fn, 0);
    d();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('отрицательная задержка трактуется как ноль', () => {
    const fn = vi.fn();
    const d = debounce(fn, -50);
    d();
    vi.advanceTimersByTime(0);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
