import { describe, it, expect } from 'vitest';
import {
  counterDamage, weightPowerKg, heavySlamPower, pokeWeightKg,
  gyroBallPower, electroBallPower, beatUpHits, beatUpPower,
  isSemiInvuln, canHitHidden, hideVerb, needsRecharge, healPulseAmount,
  bideRelease, BIDE_TURNS, falseSwipeClamp,
} from '../special-moves.js';

/** L2-остаток: проход по всем «таким» атакам — у каждой своя механика. */
describe('контратаки', () => {
  it('counter возвращает удвоенный физический урон', () => {
    expect(counterDamage('counter', 40, 'physical')).toBe(80);
    expect(counterDamage('Counter', 41, 'physical')).toBe(82);
  });

  it('counter не отвечает на специальный урон', () => {
    expect(counterDamage('counter', 40, 'special')).toBeNull();
  });

  it('mirror-coat наоборот: только специальный', () => {
    expect(counterDamage('mirror-coat', 30, 'special')).toBe(60);
    expect(counterDamage('mirror-coat', 30, 'physical')).toBeNull();
  });

  it('metal-burst: любой урон ×1.5', () => {
    expect(counterDamage('metal-burst', 40, 'physical')).toBe(60);
    expect(counterDamage('metal-burst', 40, 'special')).toBe(60);
    expect(counterDamage('metal-burst', 0, 'physical')).toBeNull();
    expect(counterDamage('metal-burst', -5, 'physical')).toBeNull();
  });

  it('без входящего урона — провал, а не 0', () => {
    expect(counterDamage('counter', 0, 'physical')).toBeNull();
    expect(counterDamage('counter', null, 'physical')).toBeNull();
    expect(counterDamage('tackle', 40, 'physical')).toBeNull();
  });

  it('протухает через раунд', () => {
    expect(counterDamage('counter', 40, 'physical', 5, 5)).toBe(80);
    expect(counterDamage('counter', 40, 'physical', 5, 6)).toBe(80);
    expect(counterDamage('counter', 40, 'physical', 5, 7)).toBeNull();
    expect(counterDamage('counter', 40, 'physical')).toBe(80); // без раундов — как раньше
  });
});

describe('урон от веса', () => {
  it('low-kick/grass-knot по таблице', () => {
    expect(weightPowerKg(5)).toBe(20);
    expect(weightPowerKg(10)).toBe(20);
    expect(weightPowerKg(11)).toBe(40);
    expect(weightPowerKg(30)).toBe(60);
    expect(weightPowerKg(80)).toBe(80);
    expect(weightPowerKg(150)).toBe(100);
    expect(weightPowerKg(300)).toBe(120);
  });

  it('мусорный вес — безопасный дефолт, не NaN', () => {
    expect(weightPowerKg(0)).toBe(40);
    expect(weightPowerKg(-3)).toBe(40);
    expect(weightPowerKg(undefined)).toBe(40);
  });

  it('heavy-slam по отношению весов', () => {
    expect(heavySlamPower(10, 100)).toBe(120);   // 0.1
    expect(heavySlamPower(25, 100)).toBe(100);   // 0.25
    expect(heavySlamPower(30, 100)).toBe(80);    // 0.3
    expect(heavySlamPower(50, 100)).toBe(60);    // 0.5
    expect(heavySlamPower(100, 100)).toBe(40);   // 1.0
    expect(heavySlamPower(0, 100)).toBe(40);
  });

  it('гектограммы PokeAPI → кг', () => {
    expect(pokeWeightKg(60)).toBe(6);
    expect(pokeWeightKg(0)).toBe(0);
    expect(pokeWeightKg(undefined)).toBe(0);
  });
});

describe('урон от скорости', () => {
  it('gyro-ball: чем медленнее сам — тем больнее', () => {
    expect(gyroBallPower(50, 100)).toBe(51);       // 25*100/50+1
    expect(gyroBallPower(100, 100)).toBe(26);
    expect(gyroBallPower(200, 10)).toBe(2);
    expect(gyroBallPower(1, 1000)).toBe(150);      // потолок
    expect(gyroBallPower(0, 100)).toBe(1);
  });

  it('electro-ball по таблице отношений', () => {
    expect(electroBallPower(400, 100)).toBe(150);
    expect(electroBallPower(300, 100)).toBe(120);
    expect(electroBallPower(200, 100)).toBe(80);
    expect(electroBallPower(100, 100)).toBe(60);
    expect(electroBallPower(50, 100)).toBe(40);
    expect(electroBallPower(0, 100)).toBe(40);
  });
});

describe('beat-up', () => {
  const party = [
    { currentHp: 10, status: null },
    { currentHp: 0, status: null },
    { currentHp: 10, status: 'psn' },
    { currentHp: 5, status: null },
  ];
  it('ударов — по числу здоровых без статуса', () => {
    expect(beatUpHits(party)).toBe(2);
    expect(beatUpHits([])).toBe(0);
    expect(beatUpHits(null as any)).toBe(0);
  });

  it('сила удара — floor(базоваяАтака/10)+5', () => {
    expect(beatUpPower(55)).toBe(10);
    expect(beatUpPower(100)).toBe(15);
    expect(beatUpPower(0)).toBe(5);
  });
});

describe('полунеуязвимость', () => {
  it('fly/dig/dive/bounce прячутся, tackle — нет', () => {
    for (const m of ['fly', 'dig', 'dive', 'bounce', 'shadow-force']) {
      expect(isSemiInvuln({ name: m }), m).toBe(true);
    }
    expect(isSemiInvuln({ name: 'tackle' })).toBe(false);
    expect(isSemiInvuln(null)).toBe(false);
  });

  it('у пряток понятные глаголы для лога', () => {
    expect(hideVerb('fly')).toContain('небо');
    expect(hideVerb('dig')).toContain('землю');
    expect(hideVerb('dive')).toContain('ныряет');
    expect(hideVerb('???')).toBe('прячется!');
  });

  it('достают только канонные контр-атаки', () => {
    expect(canHitHidden('thunder', 'fly')).toBe(true);
    expect(canHitHidden('earthquake', 'fly')).toBe(false);
    expect(canHitHidden('earthquake', 'dig')).toBe(true);
    expect(canHitHidden('surf', 'dig')).toBe(false);
    expect(canHitHidden('surf', 'dive')).toBe(true);
    expect(canHitHidden('thunder', 'dive')).toBe(false);
    expect(canHitHidden('tackle', 'shadow-force')).toBe(false);
    expect(canHitHidden('tackle', null)).toBe(true);
  });
});

describe('false-swipe не добивает', () => {
  it('добивающий удар оставляет 1 HP', () => {
    expect(falseSwipeClamp(50, 0)).toBe(1);
    expect(falseSwipeClamp(1, 0)).toBe(1);
  });

  it('слабый удар HP не трогает (не сбрасывает до 1)', () => {
    expect(falseSwipeClamp(50, 30)).toBe(30);
    expect(falseSwipeClamp(50, 1)).toBe(1);
  });

  it('по мёртвому (0 до удара) — не воскрешает', () => {
    expect(falseSwipeClamp(0, 0)).toBe(0);
  });
});

describe('перезарядка и лечение', () => {
  it('hyper-beam и семья требуют перезарядки', () => {
    for (const m of ['hyper-beam', 'giga-impact', 'blast-burn', 'roar-of-time']) {
      expect(needsRecharge({ name: m }), m).toBe(true);
    }
    expect(needsRecharge({ name: 'tackle' })).toBe(false);
    expect(needsRecharge(null)).toBe(false);
  });

  it('heal-pulse — половина максимума цели', () => {
    expect(healPulseAmount(100)).toBe(50);
    expect(healPulseAmount(1)).toBe(0);
    expect(healPulseAmount(0)).toBe(0);
  });

  it('bide: два хода терпит, выпуск — удвоение', () => {
    expect(BIDE_TURNS).toBe(2);
    expect(bideRelease(40)).toBe(80);
    expect(bideRelease(0)).toBeNull();
    expect(bideRelease(null)).toBeNull();
  });
});
