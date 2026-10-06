import { describe, it, expect } from 'vitest';
import {
  ABILITIES,
  ABILITY_COUNT,
  getAbility,
  getAbilityNameRu,
  abilityHasTrigger,
  isAbilityImplemented,
} from '../abilities.js';

describe('abilities.ts — справочник способностей', () => {
  it('содержит способности', () => {
    expect(ABILITY_COUNT).toBeGreaterThan(50);
  });

  // Этот тест появился после того, как в отчёте разошлись числа: я написал
  // «71 из 118», хотя записей 95, а реализованных было 77. Цифры в отчётах
  // должны проверяться, а не браться по памяти.
  it('итоги сходятся: всего = реализованные + нереализованные', () => {
    const all = Object.values(ABILITIES);
    expect(all.length).toBe(ABILITY_COUNT);
    const implemented = all.filter((a) => a.implemented).length;
    const notImplemented = all.length - implemented;
    expect(implemented + notImplemented).toBe(ABILITY_COUNT);
  });

  it('у каждой способности есть id, nameRu, short и triggers', () => {
    for (const [key, def] of Object.entries(ABILITIES)) {
      expect(def.id, `${key}.id`).toBe(key);
      expect(def.nameRu, `${key}.nameRu`).toBeTruthy();
      expect(def.short, `${key}.short`).toBeTruthy();
      expect(def.triggers.length, `${key}.triggers`).toBeGreaterThan(0);
      expect(typeof def.implemented, `${key}.implemented`).toBe('boolean');
    }
  });

  it('id в kebab-case, без пробелов и заглавных букв', () => {
    for (const key of Object.keys(ABILITIES)) {
      expect(key, key).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('getAbility возвращает описание по id', () => {
    const lev = getAbility('levitate');
    expect(lev?.nameRu).toBe('Левитация');
    expect(lev?.triggers).toContain('onDamageCalc');
  });

  it('getAbility возвращает undefined для неизвестной способности', () => {
    expect(getAbility('nonexistent-ability')).toBeUndefined();
    expect(getAbility(null)).toBeUndefined();
    expect(getAbility(undefined)).toBeUndefined();
  });

  it('getAbilityNameRu отдаёт русское имя или сам id', () => {
    expect(getAbilityNameRu('sturdy')).toBe('Прочная броня');
    expect(getAbilityNameRu('unknown-thing')).toBe('unknown-thing');
    expect(getAbilityNameRu('')).toBe('');
  });

  it('abilityHasTrigger проверяет триггеры', () => {
    expect(abilityHasTrigger('static', 'onAfterHit')).toBe(true);
    expect(abilityHasTrigger('static', 'onSwitchIn')).toBe(false);
    expect(abilityHasTrigger('intimidate', 'onSwitchIn')).toBe(true);
  });

  it('isAbilityImplemented отражает флаг implemented', () => {
    expect(isAbilityImplemented('levitate')).toBe(true);
    expect(isAbilityImplemented('wonder-guard')).toBe(true);
    // Неизвестная способность — не реализована по определению.
    expect(isAbilityImplemented('nonexistent')).toBe(false);
  });

  // После круга 8 механики реализованы у ВСЕХ способностей справочника.
  // Если у какой-то флаг снова станет false — это осознанное отступление,
  // и тест должен упасть, чтобы оно не прошло незамеченным.
  it('в справочнике не осталось нереализованных механик', () => {
    const notImplemented = Object.values(ABILITIES)
      .filter((a) => !a.implemented)
      .map((a) => a.id);
    expect(notImplemented).toEqual([]);
  });

  it('все способности, которые уже работают в бою, помечены implemented: true', () => {
    // Это список тех, что реально обрабатываются в logic.ts / core.ts.
    // Если тут появится false — значит движок перестал их обрабатывать.
    const working = [
      'levitate', 'flash-fire', 'water-absorb', 'volt-absorb', 'dry-skin',
      'motor-drive', 'sap-sipper', 'storm-drain', 'lightning-rod',
      'immunity', 'limber', 'insomnia', 'vital-spirit', 'water-veil',
      'magma-armor', 'comatose',
      'thick-fat', 'filter', 'solid-rock', 'wonder-guard', 'sturdy',
      'hustle', 'sheer-force', 'sniper',
      'static', 'flame-body', 'poison-point', 'rough-skin', 'iron-barbs',
      'swift-swim', 'chlorophyll', 'rain-dish', 'solar-power',
      'intimidate',
      'drought', 'drizzle', 'sand-stream', 'snow-warning',
      // Модификаторы урона (round 8, вторая партия)
      'huge-power', 'pure-power', 'technician', 'adaptability', 'reckless',
      'tinted-lens', 'scrappy', 'super-luck', 'battle-armor', 'shell-armor',
      'multiscale', 'shadow-shield', 'fluffy', 'punk-rock',
      // Защита статов и скорость по погоде
      'clear-body', 'white-smoke', 'hyper-cutter', 'keen-eye',
      'sand-rush', 'slush-rush',
      // Конец хода и яд
      'speed-boost', 'hydration', 'ice-body', 'shed-skin', 'poison-heal',
    ];
    for (const id of working) {
      expect(isAbilityImplemented(id), `${id} должна быть implemented`).toBe(true);
    }
  });

  it('ни одна способность не имеет триггер без описания', () => {
    for (const [key, def] of Object.entries(ABILITIES)) {
      // Описание не должно быть короче 20 символов — иначе это заглушка.
      expect(def.short.length, `${key}.short`).toBeGreaterThan(20);
    }
  });
});
