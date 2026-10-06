import { describe, it, expect } from 'vitest';
import { areBreedingCompatible } from '../daycare.js';

/**
 * Совместимость пар: один раз и всё (hasBred), половой контроль,
 * бесполые только через Ditto.
 */

const mon = (over: any = {}) => ({
  uid: 'x',
  gender: 'male',
  apiData: {},
  hasBred: false,
  ...over,
});

describe('areBreedingCompatible', () => {
  it('разные полы + общая группа: ок', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(true);
  });

  it('тот же покемон: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a' }), mon({ uid: 'a', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('уже спаривался (любой из пары): нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male', hasBred: true }), mon({ uid: 'b', gender: 'female' }), ['monster'], ['monster']),
    ).toBe(false);
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female', hasBred: true }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('один пол: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'male' }), ['monster'], ['monster']),
    ).toBe(false);
  });

  it('бесполый без Ditto: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: null }), mon({ uid: 'b', gender: 'female' }), ['mineral'], ['monster']),
    ).toBe(false);
  });

  it('бесполый + Ditto: ок', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: null }), mon({ uid: 'b', gender: 'male' }), ['mineral'], ['ditto']),
    ).toBe(true);
  });

  it('нет общей группы и нет Ditto: нет', () => {
    expect(
      areBreedingCompatible(mon({ uid: 'a', gender: 'male' }), mon({ uid: 'b', gender: 'female' }), ['mineral'], ['monster']),
    ).toBe(false);
  });
});
