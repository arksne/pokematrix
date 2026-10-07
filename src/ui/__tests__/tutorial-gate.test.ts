import { describe, it, expect, beforeEach } from 'vitest';
import { isTutorialGateOpen, isVeteranForTutorial } from '../location.js';
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

describe('isVeteranForTutorial', () => {
  const mon = (lvl: number) => ({ baseLevel: lvl, candiesEaten: 0 });

  it('новичок (стартер 5, ни бейджей, ни локаций): не ветеран', () => {
    expect(isVeteranForTutorial([mon(5)], [], 1)).toBe(false);
  });

  it('бейдж: ветеран', () => {
    expect(isVeteranForTutorial([mon(5)], ['Boulder Badge'], 1)).toBe(true);
  });

  it('6+ локаций: ветеран', () => {
    expect(isVeteranForTutorial([mon(5)], [], 6)).toBe(true);
  });

  it('ровно 5 локаций: ещё нет', () => {
    expect(isVeteranForTutorial([mon(5)], [], 5)).toBe(false);
  });

  it('мон 11+ уровня: ветеран', () => {
    expect(isVeteranForTutorial([mon(11)], [], 1)).toBe(true);
  });

  it('мон 10 уровня: ещё нет', () => {
    expect(isVeteranForTutorial([mon(10)], [], 1)).toBe(false);
  });

  it('пустая команда без прогресса: не ветеран', () => {
    expect(isVeteranForTutorial([], [], 0)).toBe(false);
  });
});
