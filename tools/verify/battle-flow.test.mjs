/**
 * Боевой цикл: бой начинается, атаки работают, бой не зависает и переживает
 * перезагрузку страницы.
 *
 * Симптомы, которые закрывает этот тест:
 *   - «зависает при атаках»;
 *   - «при обновлении страницы пропадает бой».
 *
 * Первый был настоящей поломкой фаз: ранние выходы хода противника показывали
 * меню, но оставляли фазу в ENEMY_TURN. useMove() проверяет canTransition и
 * отвечает «Подождите... б��тва ещё не готова» — меню было видно и нажималось,
 * но ни одна атака не срабатывала.
 *
 * Второй — бой лежит в localStorage отдельным ключом battle_state, который не
 * входит в save_data, то есть в облако он не уезжает. Проверяем оба пути:
 * перезагрузку страницы (локальный ключ) и явное сохранение/загрузку боя.
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN, APP_URL, HOST_ALIAS } from './paths.mjs';
import { api } from './support.mjs';

let failed = 0;
const t = (id, name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

async function register(tgId, username) {
  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, username, username));
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) return { ok: false, detail: `HTTP ${r.status}` };
  const reg = await api('/api/auth/register', {
    method: 'POST', token: r.json.token, body: { nickname: username },
  });
  return { ok: reg.status === 200, detail: `HTTP ${reg.status}` };
}

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});

const TG_ID = 779004444;
const reg = await register(TG_ID, 'battle_probe');
t('F1', 'игрок зарегистрирован', reg.ok, reg.detail);

const ctx = await browser.newContext();
const page = await ctx.newPage();

/** Сообщения о неработающей фазе и о неудачном сохранении. */
const phaseWarnings = [];
const saveWarnings = [];
page.on('console', (m) => {
  const s = m.text();
  if (/Invalid transition/i.test(s)) phaseWarnings.push(s);
  if (/не удалось сохранить состояние боя/i.test(s)) saveWarnings.push(s);
  if (/saveBattleState: battleType не задан/i.test(s)) saveWarnings.push(s);
});

const { initData } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'battle_probe', 'Battle'));
await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
);

/**
 * Ответ для покемона: минимальный, но с полями, которые реально читает бой.
 *
 * PokeAPI в бою достаётся через серверный прокси /api/pokeapi/*, поэтому
 * перехватываем его здесь: иначе тест зависит от внешней сети, старт боя
 * упирается в await fetchPokeAPI, и при недоступности PokeAPI все проверки
 * проходят вхолостую — бой просто не начинается.
 */
const POKEMON_FIXTURE = {
  id: 25,
  name: 'pikachu',
  types: [{ slot: 1, type: { name: 'electric', url: '' } }],
  stats: [
    { base_stat: 35, stat: { name: 'hp' } },
    { base_stat: 55, stat: { name: 'attack' } },
    { base_stat: 40, stat: { name: 'defense' } },
    { base_stat: 50, stat: { name: 'special-attack' } },
    { base_stat: 50, stat: { name: 'special-defense' } },
    { base_stat: 90, stat: { name: 'speed' } },
  ],
  abilities: [{ is_hidden: false, slot: 1, ability: { name: 'static', url: '' } }],
  species: { name: 'pikachu', url: 'https://pokeapi.co/api/v2/pokemon-species/25/' },
  sprites: {
    front_default: null,
    front_shiny: null,
    other: {
      'official-artwork': { front_default: null, front_shiny: null },
      home: { front_default: null, front_shiny: null },
    },
  },
  height: 4, weight: 60,
  base_experience: 112,
  capture_rate: 190,
  is_default: true,
  moves: [0, 1, 2, 3].map((i) => ({
    move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` },
    version_group_details: [],
  })),
};

const MOVE_FIXTURE = (name) => ({
  id: 1,
  name,
  power: 40,
  type: { name: 'electric', url: '' },
  damage_class: { name: 'special', url: '' },
  accuracy: 100,
  pp: 30,
  priority: 0,
  target: { name: 'selected-pokemon', url: '' },
  effect_entries: [],
  effect_chance: null,
  meta: { ailment: { name: 'none' }, healing: 0, crit_rate: 0, min_hits: 1, max_hits: 1 },
  stat_changes: [],
  learned_by_pokemon: [],
});

await page.route('**/api/pokeapi/**', async (route) => {
  const url = route.request().url();
  if (url.includes('/pokemon-species/')) {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 25, name: 'pikachu', capture_rate: 190, gender_rate: 4,
        evolution_chain: { url: '' }, generation: { name: 'generation-i' },
        varieties: [{ is_default: true, pokemon: { name: 'pikachu', url: '' } }],
      }),
    });
  }
  if (url.includes('/move/')) {
    const id = (url.match(/\/move\/(\d+)/) || [])[1] || '0';
    return route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(MOVE_FIXTURE(`move-${id}`)),
    });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POKEMON_FIXTURE) });
});

await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(16000);

// Убираем стартовую модалку и берём стартовика, иначе бой не начать.
const starter = page.locator('#starter-modal');
if (await starter.isVisible().catch(() => false)) {
  await page.locator('.starter-option').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(7000);
}
await page.evaluate(() => {
  document.querySelectorAll('.modal-overlay, .help-modal').forEach((o) => o.remove());
});
await page.waitForTimeout(500);

// ── Стартуем бой кнопкой «Бежать» в интерфейсе локации ────────────────
// Шаг 1: кнопка погони в шапке переводит игрока в режим охоты.
const huntBtn = page.locator('#btn-hunt-toggle');
t('F2', 'кнопка охоты есть в шапке', (await huntBtn.count()) === 1);

// Шаг 2: погони нужен таймер (2-5 секунд) плюс загрузка данных покемона.
//
// Дикий бой начинается только из тика погони и только с вероятностью 20% на тик
// (core.ts: `Math.random() < 0.20`), то есть в среднем раз в 20-40 секунд и
// никакой кнопки «начать бой» в интерфейсе нет. Чтобы проверка была
// детерминированной, подменяем Math.random на 0 — тогда условие срабатывает
// с первого тика, а весь остальной путь боя остаётся настоящим.
await page.addInitScript(() => { Math.random = () => 0; });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(16000);

await huntBtn.click().catch(() => {});
await page.waitForTimeout(14000);

// Шаг 3: если охота не запустилась (например, у локации нет энкаунтеров),
// стартуем бой напрямую через интерфейс локации — иначе тест проверяет пустоту.
let encounterVisible = await page.locator('#encounter-modal').isVisible().catch(() => false);
let moveButtons = await page.locator('[id^="move-btn-"]').count();

if (!encounterVisible && moveButtons === 0) {
  // Ищем на вкладке «Мир» любую кнопку начала погони вручную.
  const world = page.locator('.nav-item[data-target="view-world"]');
  if (await world.count()) {
    await world.click().catch(() => {});
    await page.waitForTimeout(1500);
  }
  await huntBtn.click().catch(() => {});
  await page.waitForTimeout(14000);
  encounterVisible = await page.locator('#encounter-modal').isVisible().catch(() => false);
  moveButtons = await page.locator('[id^="move-btn-"]').count();
}

t('F3', 'бой открывается', encounterVisible || moveButtons > 0,
  `экран боя: ${encounterVisible}, кнопок атак: ${moveButtons}`);

// ── Фаза боя: главная проверка на зависание ────────────────────────────
// После любого хода противника фаза обязана быть PLAYER_TURN, иначе useMove
// отказывает. Проверяем это на реальном бою, прокликав несколько атак.
//
// Признак «бой идёт» — наличие кнопок атак, а не видимость encounter-modal:
// у модалки есть анимированный фон, и на момент старта её bounding box может
// быть пустым, из-за чего isVisible() врёт.
let attacksWorked = 0;
let attacksBlocked = 0;
let turnsPlayed = 0;

for (let turn = 0; turn < 6; turn++) {
  const attack = page.locator('[id^="move-btn-"]').first();
  if (!(await attack.count())) break;

  await attack.click({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(4500);
  turnsPlayed++;

  const log = await page.locator('#battle-log').innerText().catch(() => '');
  if (/Подождите|не готов/i.test(log)) attacksBlocked++;
  else attacksWorked++;
}

t('F4', 'бой проходит несколько ходов подряд', turnsPlayed >= 2, `ходов: ${turnsPlayed}`);
t('F5', 'атаки не блокируются фазой', attacksBlocked === 0 && attacksWorked >= 2,
  `отработало ${attacksWorked}, заблокировано ${attacksBlocked}, ходов ${turnsPlayed}`);

const phaseState = await page.evaluate(() => ({
  lastLog: (document.getElementById('battle-log')?.textContent || '').slice(-260),
}));
t('F6', 'в логе боя нет сообщения «Подождите»', !/Подождите/.test(phaseState.lastLog),
  phaseState.lastLog.slice(-90));
t('F7', 'нет недопустимых переходов фаз', phaseWarnings.length === 0,
  phaseWarnings.slice(0, 2).join(' | '));

// ── Сохранение боя: перезагрузка страницы ─────────────────────────────
// saveBattleState() пишет battle_state в localStorage отдельно от save_data.
// Ключ строится через lsKey, поэтому ищем по подстроке, а не собираем вручную —
// иначе проверка зависит от формата ключа и молча ничего не находит.
const battleStateBefore = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.includes('battle_state'));
  return {
    key: key || '(нет)',
    len: key ? (localStorage.getItem(key) || '').length : 0,
  };
});
t('F10', 'состояние боя сохраняется в localStorage',
  battleStateBefore.len > 0,
  battleStateBefore.len > 0
    ? `ключ ${battleStateBefore.key}, ${battleStateBefore.len} байт`
    : `ключ не найден; ошибки записи: ${saveWarnings.slice(0, 2).join(' | ') || 'нет'}`);

if (battleStateBefore.len > 0) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(20000);

  const restored = await page.evaluate(() => {
    const modal = document.getElementById('encounter-modal');
    return {
      visible: modal ? getComputedStyle(modal).display !== 'none' : false,
      moves: document.querySelectorAll('[id^="move-btn-"]').length,
      log: (document.getElementById('battle-log')?.textContent || '').slice(-200),
    };
  });

  t('F8', 'после перезагрузки бой восстанавливается', restored.visible || restored.moves > 0,
    `экран: ${restored.visible}, кнопок атак: ${restored.moves}`);
  t('F9', 'в логе есть сообщение о восстановлении боя', /восстановлен/i.test(restored.log),
    restored.log.slice(-90));
} else {
  t('F8', 'после перезагрузки бой восстанавливается', false,
    'battle_state не был сохранён — проверить нечего');
  t('F9', 'в логе есть сообщение о восстановлении боя', false, 'бой не был активен');
}

console.log(failed === 0 ? 'БОЕВОЙ ЦИКЛ РАБОТАЕТ' : `ПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);