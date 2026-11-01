/**
 * Способность, помеченная implemented: true, обязана быть в движке.
 *
 * Аудит нашёл две способности с флагом «реализована», которых в коде не было
 * вовсе: oblivious (Беспечность) и tangled-feet (Запутанные ноги). Игрок видел
 * описание эффекта, а в бою ничего не происходило. own-tempo при этом работал
 * только в PvP — типичная рассинхронизация «сделали в одном режиме».
 *
 * Тест сканирует исходники движка: для каждой implemented-способности её id
 * должен встречаться (в кавычках) или нормализованный вид (без дефисов —
 * движок сравнивает способности через normAbil).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { ABILITIES } from '../abilities.js';

const repoRoot = process.cwd();
const srcDir = path.join(repoRoot, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) {
      if (['node_modules', '__tests__', '.state'].includes(name)) continue;
      walk(p, out);
    } else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

/** Файлы движка: бой, логика, PvP. Данные/справочники сюда не входят. */
function engineSources(): string[] {
  return walk(srcDir).filter((f) => {
    const norm = f.split(path.sep).join('/');
    if (norm.endsWith('data/abilities.ts')) return false;
    return true;
  });
}

describe('способности: флаг implemented не врёт', () => {
  const sources = engineSources();
  const joined = sources.map((f) => readFileSync(f, 'utf8')).join('\n');
  const joinedNormalized = joined.toLowerCase().replace(/-/g, '');

  it('сканирование исходников работает', () => {
    expect(sources.length).toBeGreaterThan(50);
    expect(joined.length).toBeGreaterThan(100_000);
  });

  it('у каждой implemented-способности есть код', () => {
    const missing: string[] = [];
    for (const [key, def] of Object.entries(ABILITIES)) {
      if (!def?.implemented) continue;
      const id = def.id || key;
      const quoted = joined.includes(`'${id}'`) || joined.includes(`"${id}"`);
      const normalized = joinedNormalized.includes(String(id).toLowerCase().replace(/-/g, ''));
      if (!quoted && !normalized) missing.push(`${id} (${def.nameRu})`);
    }
    expect(missing, 'способности с implemented:true, но без кода в движке').toEqual([]);
  });

  it('нереализованные помечены честно (не больше половины справочника)', () => {
    const all = Object.values(ABILITIES);
    const implemented = all.filter((a) => a?.implemented);
    expect(all.length).toBeGreaterThan(50);
    expect(implemented.length).toBeGreaterThan(all.length * 0.5);
  });
});
