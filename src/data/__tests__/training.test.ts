import { describe, it, expect } from 'vitest';
import { trainingStages, trainingPityMult, rollTraining } from '../training.js';

describe('trainingStages (канон лиги)', () => {
  it('6 стадий: +3/6/10/14/18/20%', () => {
    expect(trainingStages.map((s) => s.pct)).toEqual([0, 3, 6, 10, 14, 18, 20]);
  });

  it('шансы: 90/55/10/6/3/1', () => {
    expect(trainingStages.slice(1).map((s) => s.chance)).toEqual([0.9, 0.55, 0.1, 0.06, 0.03, 0.01]);
  });

  it('гаранты: 2/4/10/20/40/80', () => {
    expect(trainingStages.slice(1).map((s) => s.pity)).toEqual([2, 4, 10, 20, 40, 80]);
  });
});

describe('trainingPityMult', () => {
  it('common/uncommon ×1, rare ×2, legendary ×3', () => {
    expect(trainingPityMult('common')).toBe(1);
    expect(trainingPityMult('uncommon')).toBe(1);
    expect(trainingPityMult('rare')).toBe(2);
    expect(trainingPityMult('legendary')).toBe(3);
  });
});

describe('rollTraining', () => {
  it('гарант при набранных попытках', () => {
    expect(rollTraining(1, 0.01, 2, () => 0.999)).toBe(true); // fails+1=2 >= 2
    expect(rollTraining(0, 0.01, 2, () => 0.999)).toBe(false);
  });

  it('везение ниже шанса', () => {
    expect(rollTraining(0, 0.9, 100, () => 0.5)).toBe(true);
    expect(rollTraining(0, 0.9, 100, () => 0.95)).toBe(false);
  });
});
