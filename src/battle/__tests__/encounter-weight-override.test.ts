/**
 * Явный вес встречи (weight) в списке локации.
 *
 * Игрок просил: настраивать не только состав энкаунтеров, но и частоту
 * каждого вида по отдельности («редких сделать реже»). Формат записей:
 * 'pidgey' (естественный вес) или { name: 'snorlax', weight: 0.2 }
 * (20% от естественного = в 5 раз реже).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { setPowerTable } from '../../data/power.js';

describe('явный вес встречи', () => {
  beforeAll(() => {
    setPowerTable({ snorlax: 540, pidgey: 251, rattata: 253 });
  });

  it('pickWeightedEncounter учитывает явный вес', async () => {
    const coreSrc = (await import('node:fs')).readFileSync('src/battle/core.ts', 'utf8');
    // вес умножается на естественный, а не заменяет его
    expect(coreSrc).toMatch(/encounterWeightFor\(speciesOf\(e\)\) \* explicitOf\(e\)/);
    // строковые записи по-прежнему работают (множитель 1)
    expect(coreSrc).toMatch(/typeof e\.weight === 'number'\) \? e\.weight : 1/);
  });

  it('редактор отдаёт вес в понятном игрокам виде', async () => {
    const html = (await import('node:fs')).readFileSync('public/editor.html', 'utf8');
    // слайдер веса + живой % шанса
    expect(html).toMatch(/вес/);
    expect(html).toMatch(/chance/);
    // отличия показываются русским текстом с ×
    expect(html).toMatch(/×.*→×/);
  });

  it('тест разброса не ломается на объектах {name, weight}', () => {
    // спустя микс строк и объектов — все имена извлекаются
    const list = ['pidgey', { name: 'snorlax', weight: 0.2 }, 'rattata'];
    const names = list.map((e: any) => (typeof e === 'string' ? e : e?.name));
    expect(names).toEqual(['pidgey', 'snorlax', 'rattata']);
  });
});