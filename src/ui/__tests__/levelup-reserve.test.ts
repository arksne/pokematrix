import { describe, it, expect, vi } from 'vitest';
import { reserveMove, offerLearnMove } from '../levelup_moves.js';

function makeMon(moves: Array<string | null>): any {
  return {
    nickname: 'Testmon',
    apiData: {
      name: 'testmon',
      moves: moves.map((m) => (m ? { move: { name: m, url: '' } } : null)),
    },
    movesPP: moves.map(() => ({ current: 10, max: 10 })),
    learnableMoves: [],
  };
}

describe('L1: атаки падают в резерв без модалки', () => {
  it('reserveMove кладёт новую атаку и отдаёт true', () => {
    const mon = makeMon(['tackle', 'growl', 'tail-whip', 'quick-attack']);
    expect(reserveMove(mon, 'thunderbolt', 'url', { power: 90, type: { name: 'electric' } })).toBe(true);
    expect(mon.learnableMoves).toEqual([
      { name: 'thunderbolt', url: 'url', power: 90, type: 'electric' },
    ]);
  });

  it('reserveMove не дублирует атаку в резерве', () => {
    const mon = makeMon(['tackle', null, null, null]);
    mon.learnableMoves = [{ name: 'thunderbolt', url: 'u', power: 90, type: 'electric' }];
    expect(reserveMove(mon, 'Thunderbolt', 'u2')).toBe(false);
    expect(mon.learnableMoves).toHaveLength(1);
  });

  it('reserveMove без деталей всё равно кладёт (power 0, тип normal)', () => {
    const mon = makeMon(['tackle', 'growl', 'tail-whip', 'quick-attack']);
    expect(reserveMove(mon, 'splash', 'url')).toBe(true);
    expect(mon.learnableMoves[0]).toMatchObject({ name: 'splash', power: 0, type: 'normal' });
  });

  it('reserveMove создаёт learnableMoves, если его нет', () => {
    const mon: any = { apiData: { name: 'x', moves: [] } };
    expect(reserveMove(mon, 'splash', 'url')).toBe(true);
    expect(mon.learnableMoves).toHaveLength(1);
  });

  it('offerLearnMove: пустой слот — учит сразу, true', async () => {
    const mon = makeMon(['tackle', 'growl', null, null]);
    const r = await offerLearnMove(mon, { name: 'thunderbolt', url: 'url' });
    expect(r).toBe(true);
    expect(mon.apiData.moves[2].move.name).toBe('thunderbolt');
    expect(mon.learnableMoves).toHaveLength(0);
  });

  it('offerLearnMove: слоты заняты — в резерв БЕЗ document (модалки нет)', async () => {
    const mon = makeMon(['tackle', 'growl', 'tail-whip', 'quick-attack']);
    // В node document undefined: старая модалка здесь падала бы.
    // Глушим сеть: детали не загрузятся — резерв всё равно пополнится.
    const r = await offerLearnMove(mon, { name: 'thunderbolt', url: 'url' });
    expect(r).toBe(false);
    expect(mon.learnableMoves.map((m: any) => m.name)).toContain('thunderbolt');
    // Слоты не тронуты
    expect(mon.apiData.moves.map((m: any) => m.move.name)).toEqual(
      ['tackle', 'growl', 'tail-whip', 'quick-attack'],
    );
  });

  it('offerLearnMove: повтор той же атаки — дубля в резерве нет', async () => {
    const mon = makeMon(['tackle', 'growl', 'tail-whip', 'quick-attack']);
    mon.learnableMoves = [{ name: 'thunderbolt', url: 'u', power: 90, type: 'electric' }];
    await offerLearnMove(mon, { name: 'thunderbolt', url: 'u' });
    expect(mon.learnableMoves).toHaveLength(1);
  });
});
