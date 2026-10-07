/**
 * Детали атак с сайта лиги (league17reborn.ru):
 *   GET /api/sitemove/:name → объект формы PokeAPI /move/
 *
 * Цифры (power/accuracy/pp/type/damage_class) — с сайта лиги,
 * скелет эффектов (priority/target/stat_changes/meta) — канонная структура
 * (механика у лиги та же), плюс desc_ru — русское описание атаки с сайта.
 * Клиент (бой, ТМ, профиль) ходит сюда вместо PokeAPI: в рантайме боя
 * внешнего PokeAPI больше нет. Нет записи → 404.
 *
 * Источник: tools/data-league17/moves_db.json (build_moves_db.py).
 */
import { Router, Request, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const router = Router();

let table: Record<string, any> | null = null;
let loadFailed = false;

function norm(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function loadTable(): Record<string, any> | null {
  if (table) return table;
  if (loadFailed) return null;
  try {
    // Путь от модуля, не от cwd: сервер стартует и из корня репо (прод),
    // и из server/ (verify/dev). Глубина routes/ одинакова в src и dist.
    const here = dirname(fileURLToPath(import.meta.url));
    const p = join(here, '..', '..', '..', 'tools', 'data-league17', 'moves_db.json');
    if (!existsSync(p)) {
      loadFailed = true;
      return null;
    }
    table = JSON.parse(readFileSync(p, 'utf-8'));
    return table;
  } catch {
    loadFailed = true;
    return null;
  }
}

router.get('/:name', (req: Request, res: Response) => {
  const t = loadTable();
  if (!t) {
    res.status(404).json({ error: 'sitemove table unavailable' });
    return;
  }
  const key = norm(decodeURIComponent(req.params.name || ''));
  const entry = t[key];
  if (!entry || !entry.site) {
    res.status(404).json({ error: `unknown move: ${req.params.name}` });
    return;
  }
  const { site, fx = {}, desc_ru = null } = entry;
  res.json({
    name: key,
    power: site.power ?? null,
    accuracy: site.acc ?? null,
    pp: site.pp ?? 30,
    priority: fx.priority ?? 0,
    type: { name: site.type },
    damage_class: fx.damage_class ?? { name: site.cat },
    target: fx.target ?? { name: 'selected-pokemon' },
    stat_changes: fx.stat_changes ?? [],
    meta: fx.meta ?? {},
    effect_chance: fx.effect_chance ?? null,
    effect_entries: [],
    version_group_details: [],
    desc_ru,
  });
});

export default router;
