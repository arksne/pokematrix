import { describe, it, expect } from 'vitest';
import { matchStoneEvo } from '../evolution.js';
import { STONE_ITEM_MAP } from '../../data/stones.js';

/**
 * Трейд-эволюции через предметы (металл, чешуя, зуб...).
 * Раньше работала только use-item ветка — трейд-эвы молча отказывали.
 */
describe('matchStoneEvo', () => {
  it('use-item совпадает по evo.item', () => {
    expect(matchStoneEvo({ trigger: 'use-item', item: 'fire-stone' }, 'fire-stone')).toBe(true);
    expect(matchStoneEvo({ trigger: 'use-item', item: 'water-stone' }, 'fire-stone')).toBe(false);
  });

  it('trade совпадает по evo.held', () => {
    expect(matchStoneEvo({ trigger: 'trade', held: 'metal-coat' }, 'metal-coat')).toBe(true);
    expect(matchStoneEvo({ trigger: 'trade', held: 'deep-sea-scale' }, 'deep-sea-scale')).toBe(true);
    expect(matchStoneEvo({ trigger: 'trade', held: 'deep-sea-tooth' }, 'deep-sea-tooth')).toBe(true);
    expect(matchStoneEvo({ trigger: 'trade', held: 'kings-rock' }, 'metal-coat')).toBe(false);
  });

  it('мусор не проходит', () => {
    expect(matchStoneEvo(null, 'metal-coat')).toBe(false);
    expect(matchStoneEvo({ trigger: 'trade' }, 'metal-coat')).toBe(false);
    expect(matchStoneEvo({ trigger: 'level-up' }, 'metal-coat')).toBe(false);
    expect(matchStoneEvo({ trigger: 'trade', held: 'metal-coat' }, null)).toBe(false);
  });

  it('маппинг содержит чиненые предметы', () => {
    expect(STONE_ITEM_MAP['metalCoat']).toBe('metal-coat');
    expect(STONE_ITEM_MAP['deepSeaScale']).toBe('deep-sea-scale');
    expect(STONE_ITEM_MAP['deepSeaTooth']).toBe('deep-sea-tooth');
  });
});
