/**
 * Шары: описание не должно обещать эффект, которого нет.
 *
 * История: netBall/nestBall/repeatBall продавались и выдавались квестами с
 * описанием «успех ×3 по водным/жукам», «×3.9 на Lv1», «×3 по уже пойманному»,
 * но в коде ловили как обычный Поке-Болл — эффектов не было вовсе (нашли при
 * выносе формулы поимки). Аналогично Мастер-Болл давал 95% вместо гарантии.
 *
 * Тест сканирует описания шаров в ITEMS: если описание обещает условный
 * множитель, этот шар обязан быть в списке реализованных спец-эффектов —
 * иначе кто-то добавил новый шар «на будущее», а игрок заплатит за пустышку.
 */
import { describe, it, expect } from 'vitest';
import { ITEMS } from '../items.js';
import { catchChance, CATCH_CHANCE_CAP } from '../../battle/catch-chance.js';

/** Шары, чьи условные эффекты реализованы в src/battle/catch-chance.ts. */
const IMPLEMENTED_IN_CATCH_CHANCE = new Set([
  'masterBall', // гарантированная поимка
  'quickBall', // ×5 на первом ходу
  'duskBall', // ×3 ночью
  'timerBall', // ×(1 + 0.3·ход)
  'loveBall', // ×8 противоположный пол
  'netBall', // ×3 water/bug
  'nestBall', // (40−уровень)/10, мин ×1
  'repeatBall', // ×3 уже пойманный вид
]);

/** Шары, чей эффект реализован в другом месте (не в формуле шанса). */
const IMPLEMENTED_ELSEWHERE = new Set([
  'darkBall', // +5 ко всем IV пойманному
  'superDarkBall', // +10 ко всем IV пойманному
  'friendBall', // happiness 200 пойманному
  'safariBall', // ловля в местах с noCatch (кроме легенд)
  'premierBall', // косметический вариант Поке-Болла
  'sportBall', // косметический (парковый) вариант
]);

type Ball = { id: string; nameRu?: string; desc?: string; isBall?: boolean; ballMult?: number };

const balls = (ITEMS as Ball[]).filter((i) => i?.isBall);

describe('шары: описание ↔ реализация', () => {
  it('в игре есть шары и у каждого положительный множитель', () => {
    expect(balls.length).toBeGreaterThan(10);
    const bad = balls.filter((b) => !(Number(b.ballMult) > 0));
    expect(bad.map((b) => b.id)).toEqual([]);
  });

  it('шар, обещающий условный множитель, реально реализован', () => {
    const unimplemented: string[] = [];
    for (const ball of balls) {
      const desc = String(ball.desc || '');
      // «Success rate is 3×…», «8× effectiveness…» — условные эффекты.
      const promised = /(\d+(?:\.\d+)?)\s*×/.exec(desc);
      if (!promised) continue;
      const value = Number(promised[1]);
      // Базовый множитель (Great ×1.5, Ultra ×2) уже работает через ballMult.
      if (Math.abs(value - Number(ball.ballMult || 0)) < 1e-9) continue;
      const implemented =
        IMPLEMENTED_IN_CATCH_CHANCE.has(ball.id) || IMPLEMENTED_ELSEWHERE.has(ball.id) || value <= 1;
      if (!implemented) unimplemented.push(`${ball.id}: обещано ×${value} (ballMult ${ball.ballMult})`);
    }
    expect(unimplemented, 'шары с нереализованным эффектом').toEqual([]);
  });

  it('Мастер-Болл ловит гарантированно, обычные шары не пробивают потолок 95%', () => {
    expect(catchChance({ wildMaxHp: 100, wildCurHp: 100, speciesRate: 3, ballMult: 255, item: 'masterBall' })).toBe(1);
    const capped = catchChance({
      wildMaxHp: 100,
      wildCurHp: 1,
      speciesRate: 255,
      ballMult: 255,
      item: 'ultraBall',
      wildStatus: 'slp',
    });
    expect(capped).toBe(CATCH_CHANCE_CAP);
  });

  it('каждый спец-шар действительно меняет шанс в своих условиях', () => {
    const base = { wildMaxHp: 100, wildCurHp: 100, speciesRate: 20, ballMult: 1 };
    const plain = catchChance({ ...base, item: 'pokeBall' });
    const cases: Array<[string, Record<string, unknown>]> = [
      ['quickBall', { battleRound: 0 }],
      ['duskBall', { isDaytime: false }],
      ['timerBall', { battleRound: 3 }],
      ['loveBall', { wildGender: 'male', playerGender: 'female' }],
      ['netBall', { wildTypes: ['water'] }],
      ['nestBall', { wildLevel: 1 }],
      ['repeatBall', { alreadyCaught: true }],
    ];
    for (const [item, extra] of cases) {
      const chance = catchChance({ ...base, item, ...extra } as any);
      expect(chance, `${item} должен усиливать поимку`).toBeGreaterThan(plain);
    }
  });
});
