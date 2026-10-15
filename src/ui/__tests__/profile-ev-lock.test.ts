import { describe, it, expect } from 'vitest';
import { applyQuickEV } from '../profile.js';
import { settleEVSpend } from '../../battle/core.js';

/**
 * Лок EV (D4): розданное кнопками «+10»/«MAX» — применённые EV,
 * снять их назад в 0 и перекинуть в другой стат нельзя.
 * Корень обхода: быстрые кнопки писали в evs напрямую и не ставили
 * evsLocked, поэтому settleEVSpend шёл веткой locked=false и возвращал
 * пул при занулении инпутов. Теперь кнопки идут через settleEVSpend
 * и ставят лок. Чистые функции/состояние, без DOM.
 */
const zeros = () => ({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const mon = (over: any = {}) => ({ evPool: 100, evs: zeros(), evsLocked: false, ...over });

describe('applyQuickEV: раздача', () => {
  it('+10 списывает пул и ставит лок', () => {
    const m = mon();
    const r = applyQuickEV(m, 'atk', '10');
    expect(r).toEqual({ ok: true, added: 10 });
    expect(m.evs.atk).toBe(10);
    expect(m.evPool).toBe(90);
    expect(m.evsLocked).toBe(true);
  });

  it('max добивает до 126', () => {
    const m = mon({ evPool: 1000 });
    const r = applyQuickEV(m, 'spa', 'max');
    expect(r).toEqual({ ok: true, added: 126 });
    expect(m.evs.spa).toBe(126);
    expect(m.evPool).toBe(874);
    expect(m.evsLocked).toBe(true);
  });

  it('max при малом пуле даёт частицу (как раньше), пул в 0', () => {
    const m = mon({ evPool: 5 });
    const r = applyQuickEV(m, 'def', 'max');
    expect(r).toEqual({ ok: true, added: 5 });
    expect(m.evs.def).toBe(5);
    expect(m.evPool).toBe(0);
    expect(m.evsLocked).toBe(true);
  });

  it('+10 при пуле 3 даёт частицу 3', () => {
    const m = mon({ evPool: 3 });
    expect(applyQuickEV(m, 'atk', '10')).toEqual({ ok: true, added: 3 });
    expect(m.evs.atk).toBe(3);
    expect(m.evPool).toBe(0);
  });

  it('пустой пул — отказ без мутаций и без лока', () => {
    const m = mon({ evPool: 0 });
    expect(applyQuickEV(m, 'atk', '10')).toEqual({ ok: false, added: 0 });
    expect(m.evs.atk).toBe(0);
    expect(m.evsLocked).toBe(false);
  });

  it('битый стат / мусорное значение — отказ', () => {
    const m = mon();
    expect(applyQuickEV(m, 'nope', '10')).toEqual({ ok: false, added: 0 });
    expect(applyQuickEV(m, 'atk', 'мусор')).toEqual({ ok: false, added: 0 });
    expect(applyQuickEV(m, 'atk', '0')).toEqual({ ok: false, added: 0 });
    expect(m.evsLocked).toBe(false);
    expect(m.evPool).toBe(100);
  });

  it('нет ключа стата в evs — NaN не бывает, лок ставится', () => {
    const m = { evPool: 50, evs: {} as any, evsLocked: false };
    const r = applyQuickEV(m, 'atk', '10');
    expect(r.ok).toBe(true);
    expect(m.evs.atk).toBe(10);
    expect(Number.isNaN(m.evs.atk)).toBe(false);
    expect(m.evsLocked).toBe(true);
  });

  it('повторная раздача после лока — только рост из пула', () => {
    const m = mon({ evPool: 60 });
    applyQuickEV(m, 'atk', '10');
    const r = applyQuickEV(m, 'def', '10');
    expect(r.ok).toBe(true);
    expect(m.evs.atk).toBe(10);
    expect(m.evs.def).toBe(10);
    expect(m.evPool).toBe(40);
  });
});

describe('обход лока через зануление (регрессия жалобы)', () => {
  it('после кнопок инпуты-в-0 + Apply не снимают EV и не возвращают пул', () => {
    // 1) игрок раздал кнопками: 30 в атаку
    const m = mon({ evPool: 100 });
    applyQuickEV(m, 'atk', '10');
    applyQuickEV(m, 'atk', '10');
    applyQuickEV(m, 'atk', '10');
    expect(m.evs.atk).toBe(30);
    expect(m.evPool).toBe(70);
    expect(m.evsLocked).toBe(true); // лок engaged — раньше здесь был false

    // 2) игрок ставит инпут atk=0 и жмёт «Применить» (путь saveActiveMonData):
    //    settleEVSpend с locked=true обязан удержать 30 и не вернуть пул
    const r = settleEVSpend(m.evs, { ...zeros(), atk: 0 }, m.evPool, !!m.evsLocked);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(30); // не сняли
    expect(r.pool).toBe(70);    // пул не вырос
  });

  it('после лока добавить можно (только вперёд)', () => {
    const m = mon({ evPool: 70, evs: { ...zeros(), atk: 30 }, evsLocked: true });
    const r = settleEVSpend(m.evs, { ...zeros(), atk: 30, def: 10 }, m.evPool, true);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(30);
    expect(r.evs.def).toBe(10);
    expect(r.pool).toBe(60);
  });

  it('до лока снять можно (намеренно: лок включается первой записью)', () => {
    // legacy-мон: EV уже лежат, но лока ещё не было — перераспределение
    // до первой записи разрешено, пул возвращается
    const m = mon({ evPool: 10, evs: { ...zeros(), atk: 30 }, evsLocked: false });
    const r = settleEVSpend(m.evs, { ...zeros(), atk: 0 }, m.evPool, false);
    expect(r.ok).toBe(true);
    expect(r.evs.atk).toBe(0);
    expect(r.pool).toBe(40);
  });
});
