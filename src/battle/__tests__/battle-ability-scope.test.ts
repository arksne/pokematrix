/**
 * Способности не должны «прыгать» между боями.
 *
 * Жалоба: «способности на следующие битвы прыгают».
 * Причина: Trace / Mummy / Receiver / Skill Swap / Entrainment / Worry Seed /
 * Gastro Acid / Simple Beam писали способность ПРЯМО в монстра
 * (`mon.abilityName = ...`). Монстр сохраняется в облако — способность из
 * боя уезжала в сейв навсегда, и в следующем бою у покемона была чужая.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const coreSrc = readFileSync('src/battle/core.ts', 'utf8');
const typesSrc = readFileSync('src/battle/types.ts', 'utf8');

describe('боевые способности не пишутся в монстра', () => {
  it('в battle state есть слоты боевых подмен', () => {
    expect(typesSrc).toMatch(/tempAbilityP/);
    expect(typesSrc).toMatch(/tempAbilityW/);
  });

  it('resetBattleField обнуляет подмены (конец боя = откат)', () => {
    const reset = coreSrc.slice(coreSrc.indexOf('function resetBattleField()'));
    const body = reset.slice(0, reset.indexOf('\n}'));
    expect(body).toMatch(/tempAbilityP\s*=\s*null/);
    expect(body).toMatch(/tempAbilityW\s*=\s*null/);
  });

  it('Trace больше не пишет в монстра', () => {
    expect(coreSrc).not.toMatch(/mon\.abilityName = oppAbilityId/);
    expect(coreSrc).toMatch(/setBattleAbility\(mon, isWild, oppAbilityId\)/);
  });

  it('Mummy и Receiver больше не пишут в монстра', () => {
    expect(coreSrc).not.toMatch(/S\.activePlayerMon\.abilityName = 'mummy'/);
    expect(coreSrc).not.toMatch(/S\.activePlayerMon\.abilityName = targetAbility/);
    expect(coreSrc).toMatch(/setBattleAbility\(S\.activePlayerMon, false, 'mummy'\)/);
  });

  it('Skill Swap / Entrainment / Worry Seed / Gastro Acid / Simple Beam — через слоты', () => {
    for (const [call, label] of [
      [/setBattleAbility\(foe, foe === S\.activeWild, cur\)/, 'entrainment'],
      [/setBattleAbility\(foe, foe === S\.activeWild, 'insomnia'\)/, 'worry-seed'],
      [/setBattleAbility\(foe, foe === S\.activeWild, null\)/, 'gastro-acid'],
      [/setBattleAbility\(foe, foe === S\.activeWild, 'simple'\)/, 'simple-beam'],
    ] as Array<[RegExp, string]>) {
      expect(coreSrc, label).toMatch(call);
    }
    // Прямых записей в боевых эффектах больше нет
    expect(coreSrc).not.toMatch(/foe\.abilityName = /);
    expect(coreSrc).not.toMatch(/user\.abilityName = /);
  });

  it('чтение способности сначала смотрит боевую, потом родную', () => {
    const fn = coreSrc.slice(coreSrc.indexOf('function getAbilityName(pokemon, isWild)'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    // слот проверяется первым, родная способность — фолбэком
    expect(body.indexOf('battleAbilitySlot')).toBeLessThan(body.indexOf('pokemon.abilityName'));
  });

  it('постоянная смена способности предметом осталась (это другой фичер)', () => {
    // Смена способности из инвентаря — намеренное постоянное изменение,
    // её трогать нельзя (в отличие от боевых эффектов).
    const invSrc = readFileSync('src/ui/inventory.ts', 'utf8');
    expect(invSrc).toMatch(/mon\.abilityName = others\[0\]\.ability\.name/);
    expect(invSrc).toMatch(/mon\.abilityName = hidden\.ability\.name/);
  });
});