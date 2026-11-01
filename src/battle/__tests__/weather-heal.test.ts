import { describe, it, expect } from 'vitest';
import { weatherHealPercent, WEATHER_HEAL_MOVES } from '../logic.js';

/**
 * Morning Sun / Synthesis / Moonlight: раньше лечили всегда 50% (значение из
 * meta.healing PokeAPI) — погода на них не влияла. В PvP механика была, в
 * обычном бою нет.
 */
describe('weatherHealPercent — погодное лечение', () => {
  it('в засуху лечат 2/3 HP', () => {
    expect(weatherHealPercent('morning-sun', 'sun', 50)).toBe(66);
    expect(weatherHealPercent('synthesis', 'sun', 50)).toBe(66);
    expect(weatherHealPercent('moonlight', 'sun', 50)).toBe(66);
  });

  it('в дождь/бурю/град — только 1/4', () => {
    for (const w of ['rain', 'sandstorm', 'hail', 'snow']) {
      expect(weatherHealPercent('morning-sun', w, 50), w).toBe(25);
    }
  });

  it('в обычную погоду — 1/2', () => {
    expect(weatherHealPercent('synthesis', 'clear', 50)).toBe(50);
    expect(weatherHealPercent('synthesis', null, 50)).toBe(50);
  });

  it('обычные лечилки погодой не меняются', () => {
    expect(weatherHealPercent('recover', 'sun', 50)).toBe(50);
    expect(weatherHealPercent('roost', 'rain', 50)).toBe(50);
    expect(weatherHealPercent('soft-boiled', 'sandstorm', 50)).toBe(50);
  });

  it('имя с дефисами/в другом регистре распознаётся', () => {
    expect(weatherHealPercent('Morning-Sun', 'sun', 50)).toBe(66);
  });

  it('множество погодных лечилок зафиксировано', () => {
    expect([...WEATHER_HEAL_MOVES].sort()).toEqual(['moonlight', 'morning-sun', 'synthesis']);
  });
});
