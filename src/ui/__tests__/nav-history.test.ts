import { describe, it, expect } from 'vitest';
import { navStep } from '../location.js';

describe('navStep: ← назад слева, → вперёд справа', () => {
  it('обычный переход: назад = откуда пришли, вперёд сброшен', () => {
    expect(navStep('a', null, null, 'b')).toEqual({ current: 'b', last: 'a', fwd: null });
  });

  it('обычный переход затирает старый вперёд', () => {
    expect(navStep('b', 'a', 'c', 'd')).toEqual({ current: 'd', last: 'b', fwd: null });
  });

  it('назад: вперёд = где были, назад не тронут', () => {
    expect(navStep('b', 'a', null, 'a', 'back')).toEqual({ current: 'a', last: 'a', fwd: 'b' });
  });

  it('вперёд: ничего не трогаем', () => {
    expect(navStep('a', 'a', 'b', 'b', 'forward')).toEqual({ current: 'b', last: 'a', fwd: 'b' });
  });

  it('переход на месте: история цела', () => {
    expect(navStep('a', 'x', 'y', 'a')).toEqual({ current: 'a', last: 'x', fwd: 'y' });
  });

  it('туда-обратно туда-обратно не теряется', () => {
    let s: any = { current: 'a', last: null, fwd: null };
    const step = (target: string, via?: 'back' | 'forward') => {
      const r = navStep(s.current, s.last, s.fwd, target, via);
      s = r;
    };
    step('b');              // a → b
    expect(s).toEqual({ current: 'b', last: 'a', fwd: null });
    step('a', 'back');      // назад
    expect(s).toEqual({ current: 'a', last: 'a', fwd: 'b' });
    step('b', 'forward');   // вперёд
    expect(s).toEqual({ current: 'b', last: 'a', fwd: 'b' });
    step('c');              // новый путь — вперёд сброшен
    expect(s).toEqual({ current: 'c', last: 'b', fwd: null });
  });
});
