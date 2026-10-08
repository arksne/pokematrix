import { describe, it, expect } from 'vitest';
import {
  normMoveName,
  CHARGE_MOVES,
  isChargeMove,
  isOhkoMove,
  FIXED_DAMAGE,
  hasFixedDamage,
  getFixedDamage,
  moveDealsDamage,
  getMultiHitCount,
  calcDrainHeal,
  calcRecoilDamage,
  calcHealAmount,
  calcHpCost,
  effectiveSecondaryChance,
  decideMoveOrder,
} from '../special-moves.js';
import { calculateDamage, checkSuckerPunchFail } from '../logic.js';
import { getMultiHitCount as coreMultiHitCount } from '../core.js';
import { getMultiHitCount as directMultiHitCount } from '../special-moves.js';

// Фикстуры в форме рантайма боя (как отдаёт GET /api/sitemove/:name:
// power/accuracy/pp/type/damage_class сверху, priority/target/meta рядом).
const tackle = {
  name: 'tackle', power: 40, accuracy: 100, pp: 35,
  type: { name: 'normal' }, damage_class: { name: 'physical' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'damage' }, crit_rate: 0 },
};
const growl = {
  name: 'growl', power: null, accuracy: 100, pp: 40,
  type: { name: 'normal' }, damage_class: { name: 'status' },
  priority: 0, target: { name: 'all-opponents' },
  stat_changes: [{ change: -1, stat: { name: 'attack' } }],
  meta: { category: { name: 'net-good-stats' } },
};
const hornDrill = {
  name: 'horn-drill', power: null, accuracy: 30, pp: 5,
  type: { name: 'normal' }, damage_class: { name: 'physical' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'ohko' } },
};
const seismicToss = {
  name: 'seismic-toss', power: null, accuracy: 100, pp: 20,
  type: { name: 'fighting' }, damage_class: { name: 'physical' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'damage' } },
};
const superFang = {
  name: 'super-fang', power: null, accuracy: 90, pp: 10,
  type: { name: 'normal' }, damage_class: { name: 'physical' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'damage' } },
};
const solarBeam = {
  name: 'solar-beam', power: 120, accuracy: 100, pp: 10,
  type: { name: 'grass' }, damage_class: { name: 'special' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'damage' } },
};
const bulletSeed = {
  name: 'bullet-seed', power: 25, accuracy: 100, pp: 30,
  type: { name: 'grass' }, damage_class: { name: 'physical' },
  priority: 0, target: { name: 'selected-pokemon' },
  stat_changes: [], meta: { category: { name: 'damage' }, min_hits: 2, max_hits: 5 },
};

const dummyAttacker: any = { name: 'p1', apiData: { name: 'p1', stats: [], types: [] } };
const dummyDefender: any = { name: 'p2', apiData: { name: 'p2', stats: [], types: [] } };

// ── OHKO ─────────────────────────────────────────────────────
describe('isOhkoMove', () => {
  it('категория ohko из moves_db (horn-drill и др.) — true', () => {
    expect(isOhkoMove(hornDrill)).toBe(true);
    expect(isOhkoMove({ name: 'x', meta: { category: { name: 'ohko' } } })).toBe(true);
  });

  it('старая конвенция meta.ohko === true — тоже true', () => {
    expect(isOhkoMove({ name: 'x', meta: { ohko: true } })).toBe(true);
  });

  it('обычные и статус-атаки — false', () => {
    expect(isOhkoMove(tackle)).toBe(false);
    expect(isOhkoMove(growl)).toBe(false);
    expect(isOhkoMove(null)).toBe(false);
    expect(isOhkoMove({ name: 'x', meta: null })).toBe(false);
  });
});

describe('calculateDamage: OHKO', () => {
  it('horn-drill сносит всё текущее HP цели', () => {
    const r: any = calculateDamage({
      move: hornDrill, attacker: dummyAttacker, defender: dummyDefender,
      defenderCurrentHp: 120,
    });
    expect(r.damage).toBe(120);
    expect(r.isOHKO).toBe(true);
    expect(Array.isArray(r.messages)).toBe(true);
  });

  it('battle-armor/shell-armor блокируют OHKO', () => {
    const r: any = calculateDamage({
      move: hornDrill, attacker: dummyAttacker, defender: dummyDefender,
      defenderCurrentHp: 120, defenderAbilityName: 'battle-armor',
    });
    expect(r.damage).toBe(0);
    expect(r.ohkoBlocked).toBe(true);
  });
});

// ── Фиксированный урон ───────────────────────────────────────
describe('getFixedDamage/hasFixedDamage', () => {
  it('таблица покрывает seismic-toss/night-shade/super-fang/endeavor', () => {
    expect(FIXED_DAMAGE['seismic-toss']).toBe('level');
    expect(FIXED_DAMAGE['night-shade']).toBe('level');
    expect(FIXED_DAMAGE['super-fang']).toBe('half-hp');
    expect(FIXED_DAMAGE['endeavor']).toBe('equalize');
  });

  it('seismic-toss/night-shade бьют на уровень', () => {
    expect(getFixedDamage(seismicToss, { attackerLevel: 35, defenderCurrentHp: 100 })).toBe(35);
    expect(getFixedDamage({ name: 'night-shade' }, { attackerLevel: 50, defenderCurrentHp: 10 })).toBe(50);
  });

  it('super-fang — половина текущего HP (минимум 1)', () => {
    expect(getFixedDamage(superFang, { defenderCurrentHp: 100 })).toBe(50);
    expect(getFixedDamage(superFang, { defenderCurrentHp: 1 })).toBe(1);
  });

  it('endeavor — разница HP, в ничью/минус — null (провал)', () => {
    expect(getFixedDamage({ name: 'endeavor' }, { defenderCurrentHp: 100, attackerCurrentHp: 30 })).toBe(70);
    expect(getFixedDamage({ name: 'endeavor' }, { defenderCurrentHp: 30, attackerCurrentHp: 100 })).toBeNull();
    expect(getFixedDamage({ name: 'endeavor' }, { defenderCurrentHp: 50, attackerCurrentHp: 50 })).toBeNull();
  });

  it('обычные атаки — null', () => {
    expect(getFixedDamage(tackle, { attackerLevel: 50, defenderCurrentHp: 100 })).toBeNull();
    expect(getFixedDamage(growl, {})).toBeNull();
    expect(hasFixedDamage(tackle)).toBe(false);
    expect(hasFixedDamage(seismicToss)).toBe(true);
  });

  it('meta.damage из движка имеет приоритет над таблицей', () => {
    expect(getFixedDamage({ name: 'tackle', meta: { damage: 42 } }, {})).toBe(42);
    expect(hasFixedDamage({ name: 'tackle', meta: { damage: 42 } })).toBe(true);
  });
});

describe('calculateDamage: фиксированный урон', () => {
  it('seismic-toss бьёт на уровень атакующего', () => {
    const r: any = calculateDamage({
      move: seismicToss, attacker: dummyAttacker, defender: dummyDefender,
      attackerLevel: 35, defenderCurrentHp: 100,
    });
    expect(r.damage).toBe(35);
    expect(r.isFixed).toBe(true);
  });

  it('super-fang — половина HP', () => {
    const r: any = calculateDamage({
      move: superFang, attacker: dummyAttacker, defender: dummyDefender,
      attackerLevel: 35, defenderCurrentHp: 81,
    });
    expect(r.damage).toBe(40);
  });

  it('growl без power по-прежнему 0 (регрессия)', () => {
    const r: any = calculateDamage({ move: growl, attacker: dummyAttacker, defender: dummyDefender });
    expect(r.damage).toBe(0);
  });
});

describe('checkSuckerPunchFail с фикс. уроном', () => {
  const sucker = { name: 'sucker-punch', power: 70 };
  it('против seismic-toss НЕ фейлится (атака дамажащая)', () => {
    expect(checkSuckerPunchFail(sucker, seismicToss)).toBe(false);
  });

  it('против OHKO НЕ фейлится', () => {
    expect(checkSuckerPunchFail(sucker, hornDrill)).toBe(false);
  });

  it('против growl фейлится (статус)', () => {
    expect(checkSuckerPunchFail(sucker, growl)).toBe(true);
  });

  it('против tackle не фейлится', () => {
    expect(checkSuckerPunchFail(sucker, tackle)).toBe(false);
  });
});

describe('moveDealsDamage (маршрутизация веток)', () => {
  it('tackle/seismic-toss/horn-drill — дамажат, growl — нет', () => {
    expect(moveDealsDamage(tackle)).toBe(true);
    expect(moveDealsDamage(seismicToss)).toBe(true);
    expect(moveDealsDamage(hornDrill)).toBe(true);
    expect(moveDealsDamage(growl)).toBe(false);
    expect(moveDealsDamage(null)).toBe(false);
  });
});

// ── Мультихиты ───────────────────────────────────────────────
describe('getMultiHitCount', () => {
  it('одиночные и мусор — 1 удар', () => {
    expect(getMultiHitCount(tackle)).toBe(1);
    expect(getMultiHitCount(growl)).toBe(1);
    expect(getMultiHitCount({})).toBe(1);
    expect(getMultiHitCount({ meta: { min_hits: 5, max_hits: 2 } })).toBe(1);
  });

  it('фиксированные серии — точное число', () => {
    expect(getMultiHitCount({ meta: { min_hits: 2, max_hits: 2 } })).toBe(2);
    expect(getMultiHitCount({ meta: { min_hits: 3, max_hits: 3 } })).toBe(3);
  });

  it('2–5: распределение 3/8–3/8–1/8–1/8', () => {
    expect(getMultiHitCount(bulletSeed, () => 0)).toBe(2);
    expect(getMultiHitCount(bulletSeed, () => 0.37)).toBe(2);
    expect(getMultiHitCount(bulletSeed, () => 0.38)).toBe(3);
    expect(getMultiHitCount(bulletSeed, () => 0.74)).toBe(3);
    expect(getMultiHitCount(bulletSeed, () => 0.76)).toBe(4);
    expect(getMultiHitCount(bulletSeed, () => 0.88)).toBe(5);
  });

  it('core.ts использует тот же хелпер (единый источник)', () => {
    expect(coreMultiHitCount).toBe(directMultiHitCount);
  });
});

// ── Чардж ────────────────────────────────────────────────────
describe('isChargeMove', () => {
  it('solar-beam/skull-bash и др. — чардж', () => {
    expect(isChargeMove(solarBeam)).toBe(true);
    for (const name of CHARGE_MOVES) {
      expect(isChargeMove({ name }), name).toBe(true);
    }
  });

  it('обычные атаки и hyper-beam (перезарядка ≠ чардж) — нет', () => {
    expect(isChargeMove(tackle)).toBe(false);
    expect(isChargeMove({ name: 'hyper-beam', meta: { category: { name: 'damage' } } })).toBe(false);
    expect(isChargeMove({ name: 'fly', meta: { category: { name: 'damage' } } })).toBe(false);
    expect(isChargeMove(null)).toBe(false);
  });

  it('категория charge (если появится в данных) — true', () => {
    expect(isChargeMove({ name: 'x', meta: { category: { name: 'charge' } } })).toBe(true);
  });

  it('имена нормализуются (регистр/подчёркивания)', () => {
    expect(normMoveName('Solar_Beam')).toBe('solar-beam');
    expect(isChargeMove({ name: 'Solar_Beam' })).toBe(true);
  });
});

// ── Приоритет ────────────────────────────────────────────────
describe('decideMoveOrder', () => {
  it('приоритет бьёт скорость в обе стороны', () => {
    expect(decideMoveOrder(1, 10, 0, 999)).toBe('player');
    expect(decideMoveOrder(0, 999, 1, 10)).toBe('enemy');
  });

  it('равный приоритет — быстрее первый', () => {
    expect(decideMoveOrder(0, 100, 0, 50)).toBe('player');
    expect(decideMoveOrder(0, 50, 0, 100)).toBe('enemy');
  });

  it('полное равенство — монетка', () => {
    expect(decideMoveOrder(0, 50, 0, 50, () => 0.1)).toBe('player');
    expect(decideMoveOrder(0, 50, 0, 50, () => 0.9)).toBe('enemy');
  });
});

// ── Дрэйн / отдача / лечение ─────────────────────────────────
describe('drain/recoil/heal', () => {
  it('giga-drain 50%: лечит половину урона', () => {
    expect(calcDrainHeal(80, 50)).toBe(40);
  });

  it('Big Root ×1.3', () => {
    expect(calcDrainHeal(80, 50, true)).toBe(52);
  });

  it('отдача take-down 25%, минимум 1', () => {
    expect(calcRecoilDamage(80, -25)).toBe(20);
    expect(calcRecoilDamage(1, -25)).toBe(1);
  });

  it('recover 50% от макс HP', () => {
    expect(calcHealAmount(200, 50)).toBe(100);
    expect(calcHealAmount(199, 50)).toBe(99);
  });

  it('clangorous-soul: цена 33% HP, минимум 1', () => {
    expect(calcHpCost(300, -33)).toBe(99);
    expect(calcHpCost(2, -33)).toBe(1);
  });

  it('effectiveSecondaryChance: serene ×2, потолок 100', () => {
    expect(effectiveSecondaryChance(30, 2)).toBe(60);
    expect(effectiveSecondaryChance(60, 2)).toBe(100);
    expect(effectiveSecondaryChance(30, 1)).toBe(30);
    expect(effectiveSecondaryChance(null, 2)).toBe(0);
    expect(effectiveSecondaryChance(undefined)).toBe(0);
  });
});
