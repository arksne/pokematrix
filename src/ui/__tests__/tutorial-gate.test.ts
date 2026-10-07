import { describe, it, expect, beforeEach } from 'vitest';
import { isTutorialGateOpen } from '../location.js';
import { state } from '../../game/state.js';

/**
 * Гейт туториала (G1): карта дальше стартовой зоны закрыта,
 * пока не сдан tutorial_6 (или шаг > 6).
 */

describe('isTutorialGateOpen', () => {
  beforeEach(() => {
    state.tutorialStep = 0;
    state.completedNPCQuests = [];
  });

  it('не начат: закрыт', () => {
    expect(isTutorialGateOpen()).toBe(false);
  });

  it('в процессе (шаг 3, без сдачи 6): закрыт', () => {
    state.tutorialStep = 3;
    expect(isTutorialGateOpen()).toBe(false);
  });

  it('сдан tutorial_6: открыт', () => {
    state.tutorialStep = 7;
    state.completedNPCQuests = ['tutorial_6'];
    expect(isTutorialGateOpen()).toBe(true);
  });

  it('шаг > 6: открыт даже без записи', () => {
    state.tutorialStep = 7;
    state.completedNPCQuests = [];
    expect(isTutorialGateOpen()).toBe(true);
  });
});
