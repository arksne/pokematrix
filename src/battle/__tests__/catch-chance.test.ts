import { describe, it, expect } from 'vitest';
import { catchChance, CATCH_CHANCE_CAP } from '../catch-chance.js';

/**
 * Шанс поимки. Ключевая находка при выносе формулы: Мастер-Болл («ловит
 * всегда») на деле давал 95% из-за общего потолка. Теперь гарантия.
 */
describe('catchChance — Мастер-Болл', () => {
  it('ловит всегда: шанс ровно 1 даже по легенде с полным HP', () => {
    expect(
      catchChance({ wildMaxHp: 200, wildCurHp: 200, speciesRate: 3, ballMult: 255, item: 'masterBall' })
    ).toBe(1);
  });

  it('ловит всегда при любом статусе и HP', () => {
    for (const [cur, status] of [
      [200, null],
      [1, 'par'],
      [100, 'slp'],
    ] as const) {
      expect(
        catchChance({ wildMaxHp: 200, wildCurHp: cur, speciesRate: 45, ballMult: 255, item: 'masterBall', wildStatus: status })
      ).toBe(1);
    }
  });
});

describe('catchChance — обычные шары', () => {
  it('на полном HP обычный покемон ловится примерно в 1/3 случаев', () => {
    // (3H-2H)/3H = 1/3, speciesRate 255, ball ×1 → 255/3 = 85 → 85/255 = 1/3
    const chance = catchChance({ wildMaxHp: 100, wildCurHp: 100, speciesRate: 255, ballMult: 1, item: 'pokeBall' });
    expect(chance).toBeCloseTo(1 / 3, 5);
  });

  it('на 1 HP шанс упирается в потолок 95%', () => {
    const chance = catchChance({ wildMaxHp: 100, wildCurHp: 1, speciesRate: 255, ballMult: 1, item: 'pokeBall' });
    expect(chance).toBe(CATCH_CHANCE_CAP);
  });

  it('легенда (capture_rate 3) на полном HP почти не ловится', () => {
    const chance = catchChance({ wildMaxHp: 200, wildCurHp: 200, speciesRate: 3, ballMult: 1, item: 'pokeBall' });
    expect(chance).toBeLessThan(0.01);
    expect(chance).toBeGreaterThan(0);
  });

  it('Ультра-Болл вдвое лучше Поке-Болла при тех же условиях', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 90 };
    const poke = catchChance({ ...base, ballMult: 1, item: 'pokeBall' });
    const ultra = catchChance({ ...base, ballMult: 2, item: 'ultraBall' });
    expect(ultra).toBeCloseTo(poke * 2, 6);
  });

  it('сон/заморозка дают ×2.5, паралич/яд/ожог — ×1.5', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 90, ballMult: 1, item: 'pokeBall' };
    const plain = catchChance(base);
    expect(catchChance({ ...base, wildStatus: 'slp' })).toBeCloseTo(plain * 2.5, 6);
    expect(catchChance({ ...base, wildStatus: 'frz' })).toBeCloseTo(plain * 2.5, 6);
    expect(catchChance({ ...base, wildStatus: 'par' })).toBeCloseTo(plain * 1.5, 6);
    // Неизвестный статус эффекта не даёт.
    expect(catchChance({ ...base, wildStatus: 'confusion' })).toBeCloseTo(plain, 6);
  });

  it('Quick Ball ×5 только на первом ходу', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 20, ballMult: 1, item: 'quickBall' };
    expect(catchChance({ ...base, battleRound: 0 })).toBeCloseTo(catchChance({ ...base, item: 'pokeBall' }) * 5, 6);
    expect(catchChance({ ...base, battleRound: 3 })).toBeCloseTo(catchChance({ ...base, item: 'pokeBall' }), 6);
  });

  it('Dusk Ball ×3 только ночью', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 90, ballMult: 1, item: 'duskBall' };
    const plain = catchChance({ ...base, item: 'pokeBall', isDaytime: false });
    expect(catchChance({ ...base, isDaytime: false })).toBeCloseTo(plain * 3, 6);
    expect(catchChance({ ...base, isDaytime: true })).toBeCloseTo(plain, 6);
  });

  it('Timer Ball растёт с ходом боя', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 90, ballMult: 1, item: 'timerBall' };
    const plain = catchChance({ ...base, item: 'pokeBall' });
    expect(catchChance({ ...base, battleRound: 0 })).toBeCloseTo(plain, 6);
    expect(catchChance({ ...base, battleRound: 5 })).toBeCloseTo(plain * (1 + 5 * 0.3), 6);
  });

  it('Love Ball ×8 только при противоположном поле', () => {
    const base = { wildMaxHp: 100, wildCurHp: 50, speciesRate: 20, ballMult: 1, item: 'loveBall' };
    const plain = catchChance({ ...base, item: 'pokeBall' });
    expect(catchChance({ ...base, wildGender: 'male', playerGender: 'female' })).toBeCloseTo(plain * 8, 6);
    expect(catchChance({ ...base, wildGender: 'male', playerGender: 'male' })).toBeCloseTo(plain, 6);
    expect(catchChance({ ...base, wildGender: null, playerGender: 'male' })).toBeCloseTo(plain, 6);
  });

  it('никогда не превышает потолок 95%', () => {
    const chance = catchChance({
      wildMaxHp: 10,
      wildCurHp: 1,
      speciesRate: 255,
      ballMult: 255,
      item: 'ultraBall',
      wildStatus: 'slp',
      battleRound: 10,
    });
    expect(chance).toBe(CATCH_CHANCE_CAP);
  });
});

describe('catchChance — особые шары (Net/Nest/Repeat)', () => {
  // Эти шары продавались в магазинах с описанием эффекта, но эффекта не было:
  // ловили как обычный Поке-Болл за те же ¥100.
  const base = { wildMaxHp: 100, wildCurHp: 100, speciesRate: 20, ballMult: 1 };
  const plain = catchChance({ ...base, item: 'pokeBall' });

  it('Net Ball ×3 по водным и жукам, ×1 по остальным', () => {
    expect(catchChance({ ...base, item: 'netBall', wildTypes: ['water'] })).toBeCloseTo(plain * 3, 6);
    expect(catchChance({ ...base, item: 'netBall', wildTypes: ['bug', 'flying'] })).toBeCloseTo(plain * 3, 6);
    expect(catchChance({ ...base, item: 'netBall', wildTypes: ['fire'] })).toBeCloseTo(plain, 6);
    expect(catchChance({ ...base, item: 'netBall' })).toBeCloseTo(plain, 6);
  });

  it('Nest Ball: ×3.9 на Lv1, ×1 на Lv30+, слабее на сильных', () => {
    const nest = (level) => catchChance({ ...base, item: 'nestBall', wildLevel: level });
    expect(nest(1)).toBeCloseTo(plain * 3.9, 6);
    expect(nest(10)).toBeCloseTo(plain * 3, 6);
    expect(nest(30)).toBeCloseTo(plain, 6);
    expect(nest(50)).toBeCloseTo(plain, 6); // ниже ×1 не опускаем
  });

  it('Repeat Ball ×3 только на уже пойманный вид', () => {
    expect(catchChance({ ...base, item: 'repeatBall', alreadyCaught: true })).toBeCloseTo(plain * 3, 6);
    expect(catchChance({ ...base, item: 'repeatBall', alreadyCaught: false })).toBeCloseTo(plain, 6);
    expect(catchChance({ ...base, item: 'repeatBall' })).toBeCloseTo(plain, 6);
  });

  it('эффекты комбинируются со статусом и не пробивают потолок', () => {
    const chance = catchChance({
      ...base,
      wildCurHp: 1,
      speciesRate: 255,
      item: 'netBall',
      wildTypes: ['water'],
      wildStatus: 'slp',
    });
    expect(chance).toBe(CATCH_CHANCE_CAP);
  });
});

describe('catchChance — защита от мусорных значений', () => {
  it('нулевое/отрицательное/NaN HP — 0, без NaN', () => {
    expect(catchChance({ wildMaxHp: 0, wildCurHp: 0 })).toBe(0);
    expect(catchChance({ wildMaxHp: -5, wildCurHp: 3 })).toBe(0);
    expect(catchChance({ wildMaxHp: Number.NaN, wildCurHp: 5 })).toBe(0);
    expect(catchChance({ wildMaxHp: 100, wildCurHp: Number.NaN })).toBe(0);
  });

  it('нет данных о виде/большом HP — дефолты, а не NaN', () => {
    const chance = catchChance({ wildMaxHp: 100, wildCurHp: 100 });
    expect(Number.isFinite(chance)).toBe(true);
    expect(chance).toBeGreaterThan(0);
  });

  it('отрицательное HP дикого трактуется как 0 (шанс не уходит выше)', () => {
    const a = catchChance({ wildMaxHp: 100, wildCurHp: -10, speciesRate: 255, ballMult: 1 });
    const b = catchChance({ wildMaxHp: 100, wildCurHp: 0, speciesRate: 255, ballMult: 1 });
    expect(a).toBe(b);
  });
});
