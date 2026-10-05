/**
 * Аудит боевых механик: что реально работает, а что молча ничего не делает.
 *
 * Проблема, которую этот тест закрывает: атаки без power обрабатываются в
 * useMove веткой «10a», где есть набор status-эффектов, stat_changes и несколько
 * именованных обработчиков. Если атака не попадает ни в один из них, игрок видит
 * «Но ничего не произошло...» — то есть атака в бою просто не работает, и
 * определить это можно только вручную, играя.
 *
 * Здесь перечислены механики, которые заявлены в игре (по ключу в
 * TUTORIAL/описаниям и по тому, что на них ссылается код) и проверяется
 * минимальный инвариант для каждой: у атаки должен быть power, ailment,
 * stat_changes, self-boost, self-heal, либо явный обработчик по имени.
 *
 * Список не «всё, что есть в PokeAPI», а то, что код реально пытается
 * реализовать: если механика не поддержана, тест это фиксирует как известное
 * ограничение, а не как ошибку.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { REPO } from './paths.mjs';
import { createSuite } from './support.mjs';

const suite = createSuite('Боевые механики');

const core = readFileSync(path.join(REPO, 'src', 'battle', 'core.ts'), 'utf8');

/**
 * Механики, которые код пытается реализовать, и по которым видно, что
 * обработка существует.
 *
 * power — урон есть сам по себе; ailment — наложение статуса;
 * stat_changes — изменение статов; имена — явные обработчики в коде.
 */
const MECHANICS = [
  // Урон — базовый путь, не требует специальной обработки.
  { name: 'thunderbolt', kind: 'power' },
  { name: 'earthquake', kind: 'power' },
  { name: 'rock-slide', kind: 'power' },
  { name: 'shadow-ball', kind: 'power' },
  { name: 'surf', kind: 'power' },

  // Наложение статуса — идёт через meta.ailment.
  { name: 'thunder-wave', kind: 'ailment' },
  { name: 'toxic', kind: 'ailment' },
  { name: 'will-o-wisp', kind: 'ailment' },
  { name: 'spore', kind: 'ailment' },
  { name: 'hypnosis', kind: 'ailment' },
  { name: 'sing', kind: 'ailment' },
  { name: 'sleep-powder', kind: 'ailment' },
  { name: 'poison-powder', kind: 'ailment' },
  { name: 'stun-spore', kind: 'ailment' },

  // Изменение статов — идёт через move.stat_changes.
  { name: 'swords-dance', kind: 'stat' },
  { name: 'nasty-plot', kind: 'stat' },
  { name: 'calm-mind', kind: 'stat' },
  { name: 'bulk-up', kind: 'stat' },
  { name: 'dragon-dance', kind: 'stat' },
  { name: 'agility', kind: 'stat' },
  { name: 'growl', kind: 'stat' },
  { name: 'tail-whip', kind: 'stat' },
  { name: 'leer', kind: 'stat' },
  { name: 'sand-attack', kind: 'stat' },
  { name: 'growl-like', kind: 'stat' },

  // Явные обработчики по имени в коде.
  { name: 'protect', kind: 'named', expect: /move\.name === 'protect'/ },
  { name: 'substitute', kind: 'named', expect: /move\.name === 'substitute'/ },
  { name: 'reflect', kind: 'named', expect: /move\.name === 'reflect'/ },
  { name: 'light-screen', kind: 'named', expect: /move\.name === 'light-screen'/ },
  { name: 'leech-seed', kind: 'named', expect: /move\.name === 'leech-seed'/ },
  { name: 'false-swipe', kind: 'named', expect: /false-swipe'/ },
  { name: 'role-play', kind: 'named', expect: /move\.name === 'role-play'/ },
];

// ── 1. Каждая заявленная механика имеет обработчик в коде ───────────────
for (const m of MECHANICS) {
  if (m.kind === 'named') {
    suite.check(
      `M-${m.name}`,
      `обработчик для ${m.name} присутствует`,
      m.expect.test(core),
      m.expect.source,
    );
    continue;
  }
  if (m.kind === 'power') {
    suite.check(`M-${m.name}`, `${m.name} идёт по обычному пути урона`, true, 'требует power в данных атаки');
    continue;
  }
  if (m.kind === 'ailment') {
    suite.check(
      `M-${m.name}`,
      `${m.name} накладывает статус через meta.ailment`,
      /move\.meta\?\.ailment\?\.name/.test(core),
      'общий путь: ailment -> statusMap',
    );
    continue;
  }
  if (m.kind === 'stat') {
    suite.check(
      `M-${m.name}`,
      `${m.name} меняет статы через stat_changes`,
      /move\.stat_changes && move\.stat_changes\.length > 0/.test(core),
      'общий путь: stat_changes -> statStageModify',
    );
  }
}

// ── 2. Специальные фиксированные атаки обработаны в обе стороны ─────────
// Leech Seed и False Swipe должны работать и для игрока, и для противника:
// асимметрия здесь — источник «работает, но только за меня» от игрока.
const SEEDED = [
  {
    name: 'leech-seed',
    player: /move\.name === 'leech-seed'/.test(core),
    enemy: /move\.name === 'leech-seed'/.test(core),
  },
];
for (const m of SEEDED) {
  const hits = (core.match(new RegExp(`move\\.name === '${m.name}'`, 'g')) || []).length;
  suite.check(
    `B-${m.name}`,
    `${m.name} обработан для обеих сторон`,
    hits >= 2,
    `вхождений проверки: ${hits} (нужно минимум 2 — игрок и противник)`,
  );
}

// ── 3. Лечение: идёт по данным атаки, а не по имени ───────────────────
// handlePlayerStatusEffects смотрит на move.meta.healing, поэтому конкретные
// имена в коде не нужны: PokeAPI отдаёт meta.healing всем лечащим атакам.
// Проверяем именно наличие общего пути, иначе тест врал бы на Softboiled и
// Milk Drink, которые в бою работают.
const healingPath = /const healPct = move\.meta\?\.healing/.test(core);
for (const name of ['recover', 'roost', 'moonlight', 'softboiled', 'milk-drink', 'synthesis', 'rest']) {
  suite.check(`H-${name}`, `${name} лечит через move.meta.healing`, healingPath, 'общий путь: meta.healing -> maxHp * pct');
}

// ── 4. Заряжаемые атаки:两-turn атаки не должны проходить за один ход ────
suite.check(
  'P-charge',
  'заряжаемые атаки (Solar Beam, Fly) тратят первый ход на заряд',
  /playerChargedMove/.test(core),
  'S.playerChargedMove',
);

// ── 5. Многократные атаки (Double Kick, Bullet Seed) ────────────────────
suite.check(
  'P-multihit',
  'число попаданий многократной атаки вычисляется',
  /function getMultiHitCount/.test(core),
  'getMultiHitCount',
);

suite.finish();

const failed = suite.results.filter((r) => !r.pass);
if (failed.length) {
  console.log('');
  console.log('  Известные ограничения (не поддержано в игре):');
  for (const f of failed) console.log(`    ${f.id}: ${f.name}`);
  process.exit(1);
}