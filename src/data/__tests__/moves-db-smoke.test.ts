import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Дымовой тест базы лиги (L5): tools/data-league17/moves_db.json.
// Каждая атака: { site: { type, cat, power, acc, pp },
// fx: { priority, target, stat_changes, meta } }.
// Сервер (GET /api/sitemove/:name) маппит это в форму PokeAPI /move/.

// Атаки с power null при боевой категории: переменная сила (weight-,
// level-, HP-зависимые), фикс. урон, OHKO и контрудары — полный список
// на момент аудита (33). power null вне status И вне списка — провал.
const KNOWN_VARIABLE_POWER = new Set([
  'beat-up', 'bide', 'comeuppance', 'counter', 'crush-grip', 'electro-ball',
  'endeavor', 'final-gambit', 'fissure', 'flail', 'fling', 'grass-knot',
  'guillotine', 'gyro-ball', 'heat-crash', 'heavy-slam', 'horn-drill',
  'low-kick', 'metal-burst', 'mirror-coat', 'natural-gift', 'natures-madness',
  'night-shade', 'pika-papow', 'present', 'reversal', 'ruination',
  'seismic-toss', 'sheer-cold', 'spit-up', 'super-fang', 'veevee-volley',
  'wring-out',
]);

// Атаки без fx.meta (новые поколения, эффект не размечен) — сервер отдаёт
// meta: {} (sitemove.ts: fx.meta ?? {}). Список на момент аудита (58).
const KNOWN_NULL_META = new Set([
  'alluring-voice', 'aqua-cutter', 'armor-cannon', 'axe-kick', 'barb-barrage',
  'bitter-blade', 'bitter-malice', 'bleakwind-storm', 'blood-moon',
  'burning-bulwark', 'chilling-water', 'collision-course', 'comeuppance',
  'double-shock', 'electro-drift', 'fillet-away', 'headlong-rush',
  'hydro-steam', 'hyper-drill', 'ice-spinner', 'ivy-cudgel', 'jet-punch',
  'last-respects', 'lunar-blessing', 'make-it-rain', 'malignant-chain',
  'mighty-cleave', 'mountain-gale', 'mystical-power', 'order-up',
  'population-bomb', 'pounce', 'psyblade', 'psychic-noise', 'psyshield-bash',
  'rage-fist', 'raging-bull', 'raging-fury', 'ruination', 'salt-cure',
  'sandsear-storm', 'shed-tail', 'shelter', 'snowscape', 'spin-out',
  'springtide-storm', 'supercell-slam', 'tachyon-cutter', 'take-heart',
  'temper-flare', 'tera-blast', 'tera-starstorm', 'thunderclap', 'tidy-up',
  'trailblaze', 'twin-beam', 'wave-crash', 'wildbolt-storm',
]);

const TYPES_18 = new Set([
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting',
  'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost',
  'dragon', 'dark', 'steel', 'fairy',
]);

const db: Record<string, any> = JSON.parse(
  readFileSync(join(process.cwd(), 'tools', 'data-league17', 'moves_db.json'), 'utf8'),
);
const slugs = Object.keys(db);

describe('moves_db.json: каркас', () => {
  it('всего 741 атака', () => {
    expect(slugs.length).toBe(741);
  });

  it('слаги валидны ([a-z0-9-])', () => {
    for (const s of slugs) {
      expect(s, `слаг ${s}`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('moves_db.json: site-слой (type/cat/power/pp)', () => {
  it('type/cat/pp присутствуют, значения из справочников', () => {
    for (const s of slugs) {
      const site = db[s].site;
      expect(site, `${s}: site`).toBeTruthy();
      expect(TYPES_18.has(site.type), `${s}: type=${site.type}`).toBe(true);
      expect(['physical', 'special', 'status'].includes(site.cat), `${s}: cat=${site.cat}`).toBe(true);
      expect(Number.isInteger(site.pp) && site.pp >= 1, `${s}: pp=${site.pp}`).toBe(true);
    }
  });

  it('power null — только status или переменная сила из списка', () => {
    for (const s of slugs) {
      const site = db[s].site;
      if (site.power === null || site.power === undefined) {
        const ok = site.cat === 'status' || KNOWN_VARIABLE_POWER.has(s);
        expect(ok, `${s}: power null при cat=${site.cat}`).toBe(true);
      } else {
        expect(typeof site.power === 'number' && site.power > 0, `${s}: power=${site.power}`).toBe(true);
      }
    }
  });

  it('acc — число или null (null = не мажет)', () => {
    for (const s of slugs) {
      const acc = db[s].site.acc;
      expect(acc === null || (typeof acc === 'number' && acc > 0), `${s}: acc=${acc}`).toBe(true);
    }
  });
});

describe('moves_db.json: fx-слой (priority/target/meta)', () => {
  it('priority — число, target.name — непустая строка', () => {
    for (const s of slugs) {
      const fx = db[s].fx;
      expect(fx, `${s}: fx`).toBeTruthy();
      expect(typeof fx.priority === 'number', `${s}: priority`).toBe(true);
      expect(typeof fx.target?.name === 'string' && fx.target.name.length > 0, `${s}: target`).toBe(true);
    }
  });

  it('meta — объект; null только у атак из списка', () => {
    for (const s of slugs) {
      const meta = db[s].fx.meta;
      if (meta === null || meta === undefined) {
        expect(KNOWN_NULL_META.has(s), `${s}: meta отсутствует`).toBe(true);
      } else {
        expect(typeof meta, `${s}: meta`).toBe('object');
      }
    }
  });
});

describe('moves_db.json: особые механики (аудит L2)', () => {
  const metaOf = (s: string) => db[s].fx.meta || {};
  const catOf = (s: string) => metaOf(s).category?.name;

  it('OHKO — 4 атаки (категория ohko)', () => {
    const ohko = slugs.filter((s) => catOf(s) === 'ohko');
    expect(ohko.sort()).toEqual(['fissure', 'guillotine', 'horn-drill', 'sheer-cold']);
  });

  it('мультихиты (min_hits > 1) — 24 атаки', () => {
    const multi = slugs.filter((s) => (metaOf(s).min_hits || 0) > 1);
    expect(multi.length).toBe(24);
    expect(multi).toContain('bullet-seed');
  });

  it('приоритет (priority != 0) — 48 атак', () => {
    const prio = slugs.filter((s) => (db[s].fx.priority || 0) !== 0);
    expect(prio.length).toBe(48);
    expect(prio).toContain('quick-attack');
  });

  it('дрэйн/отдача (drain != 0) — 22 атаки', () => {
    const drain = slugs.filter((s) => (metaOf(s).drain || 0) !== 0);
    expect(drain.length).toBe(22);
    expect(drain).toContain('giga-drain');
  });

  it('лечение (healing != 0) — 15 атак', () => {
    const heal = slugs.filter((s) => (metaOf(s).healing || 0) !== 0);
    expect(heal.length).toBe(15);
    expect(heal).toContain('recover');
  });

  it('повышенный крит (crit_rate != 0) — 21 атака', () => {
    expect(slugs.filter((s) => (metaOf(s).crit_rate || 0) !== 0).length).toBe(21);
  });

  it('флинч (flinch_chance != 0) — 25 атак', () => {
    expect(slugs.filter((s) => (metaOf(s).flinch_chance || 0) !== 0).length).toBe(25);
  });

  it('категории charge в данных НЕТ — чардж задаётся именем (CHARGE_MOVES)', () => {
    expect(slugs.filter((s) => catOf(s) === 'charge').length).toBe(0);
  });

  it('полей meta.damage/meta.ohko в данных НЕТ — движок опознаёт по имени', () => {
    for (const s of slugs) {
      const meta = metaOf(s);
      expect(meta.damage ?? null, `${s}: meta.damage`).toBeNull();
      expect(meta.ohko ?? null, `${s}: meta.ohko`).toBeNull();
    }
  });

  it('связность: OHKO без power; лечение бьёт по себе; дрэйн — дамажащий', () => {
    for (const s of slugs) {
      const m = metaOf(s);
      if (catOf(s) === 'ohko') {
        expect(db[s].site.power, `${s}: ohko без power`).toBeNull();
      }
      if ((m.healing || 0) !== 0) {
        // Лечение — в себя/своих. Исключения: heal-pulse и floral-healing
        // целят 'selected-pokemon' (в сингле по канону лечили бы врага) —
        // движок упрощает до самолечения с обеих сторон (см. отчёт L2).
        const t = db[s].fx.target?.name;
        const ok = t === 'user' || t === 'user-and-allies'
          || ((s === 'heal-pulse' || s === 'floral-healing') && t === 'selected-pokemon');
        expect(ok, `${s}: лечение в себя (target=${t})`).toBe(true);
      }
      if ((m.drain || 0) > 0) {
        expect(['physical', 'special'].includes(db[s].fx.damage_class?.name), `${s}: дрэйн дамажащий`).toBe(true);
      }
    }
  });
});
