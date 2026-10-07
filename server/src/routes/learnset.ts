/**
 * Статичные мувсеты с сайта лиги (league17reborn.ru):
 *   GET /api/learnset/:name → { levelup: [[lvl, name]], egg: [names] }
 *
 * Источник: tools/data-league17/learnsets.json (скрап покедекса лиги,
 * порядок атак в таблицах сайта = порядок изучения).
 * Клиент берёт отсюда стартовые атаки (первые N в порядке сайта) и
 * яйцевые атаки (ролл 30% при вылуплении). Нет записи → 404, клиент
 * падает back на фильтр PokeAPI.
 */
import { Router, Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

type Learnset = {
  levelup: Array<[number, string]>;
  egg: string[];
  tm?: Array<[number, string]>;
  tutor?: string[];
};
let table: Record<string, Learnset> | null = null;
let loadFailed = false;

function norm(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function loadTable(): Record<string, Learnset> | null {
  if (table) return table;
  if (loadFailed) return null;
  try {
    // Путь от модуля, не от cwd: сервер стартует и из корня репо (прод),
    // и из server/ (verify/dev). Глубина routes/ одинакова в src и dist.
    const here = dirname(fileURLToPath(import.meta.url));
    const p = join(here, '..', '..', '..', 'tools', 'data-league17', 'learnsets.json');
    if (!existsSync(p)) {
      loadFailed = true;
      return null;
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, Learnset>;
    table = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v && Array.isArray(v.levelup)) table[norm(k)] = v;
    }
    return table;
  } catch {
    loadFailed = true;
    return null;
  }
}

router.get('/:name', (req: Request, res: Response) => {
  const t = loadTable();
  if (!t) {
    res.status(404).json({ error: 'learnset table unavailable' });
    return;
  }
  const key = norm(decodeURIComponent(req.params.name || ''));
  // Формы вида «pikachu»: точное совпадение; иначе префикс (pikachu-... )
  let entry = t[key];
  if (!entry) {
    const hit = Object.keys(t).find((k) => k === key || k.startsWith(key));
    if (hit) entry = t[hit];
  }
  if (!entry) {
    res.status(404).json({ error: `unknown species: ${req.params.name}` });
    return;
  }
  res.json({ levelup: entry.levelup, egg: entry.egg || [], tm: entry.tm || [], tutor: entry.tutor || [] });
});

export default router;
