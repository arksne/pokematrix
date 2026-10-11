import { describe, it, expect } from 'vitest';
import { moveMonBetweenBoxes } from '../pc.js';

const mon = (uid: string) => ({ uid, apiData: { name: 'm' }, currentHp: 10 });

/** N3: вручную по боксам раскидывать — без потерь и дублей. */
describe('N3: ручное перемещение между боксами', () => {
  it('покемон переезжает из бокса в бокс', () => {
    const boxes = [[mon('a'), mon('b')], [mon('c')]];
    expect(moveMonBetweenBoxes(boxes, 0, 0, 1)).toEqual({ ok: true });
    expect(boxes[0].map((m: any) => m.uid)).toEqual(['b']);
    expect(boxes[1].map((m: any) => m.uid)).toEqual(['c', 'a']);
  });

  it('пустой исходный бокс удаляется, цель поправляется', () => {
    const boxes = [[mon('a')], [mon('b')]];
    expect(moveMonBetweenBoxes(boxes, 0, 0, 1)).toEqual({ ok: true });
    // Бокс 0 удалён, бывший бокс 1 стал боксом 0
    expect(boxes).toHaveLength(1);
    expect(boxes[0].map((m: any) => m.uid)).toEqual(['b', 'a']);
  });

  it('тот же бокс — отказ, всё на месте', () => {
    const boxes = [[mon('a')]];
    expect(moveMonBetweenBoxes(boxes, 0, 0, 0)).toEqual({ ok: false, reason: 'same-box' });
    expect(boxes[0]).toHaveLength(1);
  });

  it('нет такого покемона/бокса — отказ без потерь', () => {
    const boxes = [[mon('a')]];
    expect(moveMonBetweenBoxes(boxes, 0, 5, 0)).toEqual({ ok: false, reason: 'no-mon' });
    expect(moveMonBetweenBoxes(boxes, 0, 0, 9)).toEqual({ ok: false, reason: 'no-box' });
    expect(moveMonBetweenBoxes(boxes, 9, 0, 0)).toEqual({ ok: false, reason: 'no-mon' });
    expect(moveMonBetweenBoxes(null as any, 0, 0, 0)).toEqual({ ok: false, reason: 'no-mon' });
    expect(boxes[0].map((m: any) => m.uid)).toEqual(['a']);
  });

  it('uid не дублируется: покемон в ровно одном месте', () => {
    const boxes = [[mon('a'), mon('b')], [mon('c')], []];
    moveMonBetweenBoxes(boxes, 0, 1, 2);
    const all = boxes.flat().map((m: any) => m.uid).sort();
    expect(all).toEqual(['a', 'b', 'c']);
  });

  it('перемещение влево (цель левее источника) индексы не ломает', () => {
    const boxes = [[mon('a')], [mon('b')], [mon('c')]];
    expect(moveMonBetweenBoxes(boxes, 2, 0, 0)).toEqual({ ok: true });
    expect(boxes[0].map((m: any) => m.uid)).toEqual(['a', 'c']);
    expect(boxes[1].map((m: any) => m.uid)).toEqual(['b']);
    expect(boxes).toHaveLength(2);
  });
});
