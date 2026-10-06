/**
 * Боевой цикл: бой начинается, атаки работают, бой не зависает и переживает
 * перезагрузку страницы.
 *
 * Закрывает два класса дефектов:
 *   - «зависает при атаках» — фаза остаётся ENEMY_TURN, useMove отказывает;
 *   - «при обновлении страницы пропадает бой» — battle_state не пишется.
 *
 * Тест идёт ровно по пути игрока: пого��а -> встреча -> атаки. Никаких
 * reload() посреди сценария и никаких фиксированных пауз там, где результат
 * можно дождаться: состояние боя проверяется, пока бой ещё живой, потому что
 * после победы clearBattleState() удаляет battle_state — и «ключ не найден»
 * означал бы победу, а не поломку сохранения.
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

async function register(tgId, nickname) {
  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, nickname, nickname));
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) return { ok: false, detail: `HTTP ${r.status}` };
  const reg = await api('/api/auth/register', {
    method: 'POST', token: r.json.token, body: { nickname },
  });
  return { ok: reg.status === 200, detail: `HTTP ${reg.status}` };
}

// Уникальный id на каждый прогон. Раньше был жёстко зашит 779004444, и тест
// наследовал облачный сейв предыдущих запусков: прогон, прерванный на середине,
// оставлял запись без команды, следующий прогон подтягивал её через
// applyCloudSave и уже не мог нормально начать бой. Из-за этого результат
// зависел от порядка запусков, а не от состояния кода.
const TG_ID = 779000000 + Math.floor(Math.random() * 900000);
const reg = await register(TG_ID, 'battle_probe');
t('F1', 'игрок зарегистрирован', reg.ok, reg.detail);

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const phaseWarnings = [];
const saveWarnings = [];
const console_ = [];
page.on('console', (m) => {
  const s = m.text();
  console_.push(`[${m.type()}] ${s}`);
  if (/Invalid transition/i.test(s)) phaseWarnings.push(s);
  if (/не удалось сохранить состояние боя/i.test(s)) saveWarnings.push(s);
  if (/saveBattleState: battleType не задан/i.test(s)) saveWarnings.push(s);
  if (/startHunt failed/i.test(s)) saveWarnings.push(s);
});
page.on('pageerror', (e) => saveWarnings.push('pageerror: ' + e.message));

const { initData } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'battle_probe', 'Battle'));
await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) }));

// Ставится ДО загрузки страницы и переживает reload: без этого подмена не
// применяется к первому тику погони.
await page.addInitScript(() => { Math.random = () => 0; });

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
  sprites: { front_default: null, front_shiny: null, other: { 'official-artwork': { front_default: null, front_shiny: null } } },
  height: 4, weight: 60, base_experience: 112, capture_rate: 190, is_default: true,
  moves: [0, 1, 2, 3].map((i) => ({ move: { name: `move-${i}`, url: `https://pokeapi.co/api/v2/move/${i}/` }, version_group_details: [] })),
};
const MOVE_FIXTURE = (name, power) => ({
  id: 1, name, power,
  type: { name: 'electric', url: '' },
  damage_class: { name: 'special', url: '' },
  accuracy: 100, pp: 30, priority: 0,
  target: { name: 'selected-pokemon', url: '' },
  effect_entries: [], effect_chance: null,
  meta: { ailment: { name: 'none' }, healing: 0, crit_rate: 0, min_hits: 1, max_hits: 1 },
  stat_changes: [], learned_by_pokemon: [],
});

// Покемон с огромным HP и атакой в 1 ед.: бой не закончится за 6 ходов, поэтому
// battle_state останется в localStorage и проверка сохранения будет честной.
await page.route('**/api/pokeapi/**', async (route) => {
  const url = route.request().url();
  if (url.includes('/pokemon-species/')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 25, name: 'pikachu', capture_rate: 190, gender_rate: 4,
      evolution_chain: { url: '' }, generation: { name: 'generation-i' },
      varieties: [{ is_default: true, pokemon: { name: 'pikachu', url: '' } }],
    }) });
  }
  if (url.includes('/move/')) {
    const id = (url.match(/\/move\/(\d+)/) || [])[1] || '0';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOVE_FIXTURE(`move-${id}`, 1)) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(POKEMON_FIXTURE) });
});

await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(16000);

const starter = page.locator('#starter-modal');
if (await starter.isVisible().catch(() => false)) {
  await page.locator('.starter-option').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);
}

const huntBtn = page.locator('#btn-hunt-toggle');
t('F2', 'кнопка охоты есть в шапке', (await huntBtn.count()) === 1);

// Кнопка — переключатель: если охота уже идёт, клик её ВЫКЛЮЧИТ. Состояние
// читаем по классу active, который ставит updateHuntBtn и снимает stopAutoHunt.
// Проверять textContent нельзя: там всегда есть эмодзи, независимо от охоты.
const hunting = await page.evaluate(() =>
  !!document.getElementById('btn-hunt-toggle')?.classList.contains('active'));
if (!hunting) {
  // Ошибку клика не глотаем: молчаливый .catch() превращал «кнопку перекрыл
  // оверлей» в «бой не начался», и диагностировать было нечем.
  const ok = await huntBtn.click({ timeout: 8000 })
    .then(() => true)
    .catch((e) => { console.log(`[DBG] клик по охоте не прошёл: ${e.message.split('\n').slice(0, 4).join(' | ')}`); return false; });
  console.log(`[DBG] клик по охоте: ${ok ? 'ok' : 'провален'}`);
}

// Диагностика: состояние охоты сразу после клика. Если бой не начался, здесь
// видно и состояние кнопки, и наличие hunt_active в localStorage, и что вообще
// писала консоль — иначе причина остаётся неизвестной.
const huntSnap = await page.evaluate(() => {
  const b = document.getElementById('btn-hunt-toggle');
  return {
    cls: b ? b.className : '(нет кнопки)',
    title: b ? b.getAttribute('title') : '',
    huntActiveKey: Object.keys(localStorage).filter((k) => k.includes('hunt')),
    modalDisplay: (() => {
      const m = document.getElementById('encounter-modal');
      return m ? getComputedStyle(m).display : '(нет модалки)';
    })(),
    log: (document.getElementById('battle-log')?.textContent || '').slice(-120),
    teamAlive: (() => {
      try { return window.__teamAlive ?? 'n/a'; } catch { return 'n/a'; }
    })(),
  };
});
console.log(`[DBG] охота: class="${huntSnap.cls}" hunt_keys=${JSON.stringify(huntSnap.huntActiveKey)} modal=${huntSnap.modalDisplay}`);
console.log(`[DBG] лог: ${JSON.stringify(huntSnap.log)}`);
console.log(`[DBG] консоль: ${console_.slice(-6).join(' || ') || '(пусто)'}`);

// Ждём бой по факту, а не фиксированной паузой: встреча стартует из тика
// погони (Math.random < 0.20), скорость зависит от загрузки PokeAPI.
//
// Признак живого боя — ТОЛЬКО видимость модалки. Считать элементы move-btn
// бессмысленно: в index.html лежат четыре статических span с id move-btn-0..3
// (`reborn-move-link`), поэтому их количество всегда равно 4, даже когда боя
// нет вообще. Прежняя проверка `moveButtons > 0` поэтому проходила всегда.
async function battleStateNow() {
  return await page.evaluate(() => {
    const modal = document.getElementById('encounter-modal');
    const log = document.getElementById('battle-log')?.textContent || '';
    return {
      visible: !!modal && getComputedStyle(modal).display !== 'none',
      // Встреча состоялась, когда в лог записано «Дикий X нападает!»
      // (core.ts, appendToLog в startHunt) — это последняя строка перед
      // loadMoveButtons и saveBattleState(). Проверять персистентность раньше —
      // гонка: модалка показывается в самом начале startHunt, а сохранение
      // происходит в конце, уже после загрузки данных покемона.
      ready: /нападает/i.test(log),
      error: /Ошибка боя/i.test(log),
      log: log.slice(-160),
    };
  });
}

async function waitForBattle(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last = { visible: false, ready: false, error: false, log: '' };
  while (Date.now() < deadline) {
    last = await battleStateNow();
    if (last.error) return last;
    if (last.ready) return last;
    await page.waitForTimeout(1000);
  }
  return last;
}

const started = await waitForBattle(45000);
t('F3', 'бой открывается', started.ready && started.visible && !started.error,
  started.error ? `ошибка в бою: ${started.log}`
    : `экран боя: ${started.visible}, встреча состоялась: ${started.ready}; лог: ${started.log.slice(-80)}`);

// ── Проверка сохранения — пока бой ещё идёт ────────────────────────────
const battleStateLive = await page.evaluate(() => {
  const key = Object.keys(localStorage).find((k) => k.includes('battle_state'));
  return { key: key || '(нет)', len: key ? (localStorage.getItem(key) || '').length : 0 };
});
t('F10', 'состояние боя сохраняется в localStorage', battleStateLive.len > 0,
  battleStateLive.len > 0
    ? `ключ ${battleStateLive.key}, ${battleStateLive.len} байт`
    : `ключ не найден; ошибки записи: ${saveWarnings.slice(0, 2).join(' | ') || 'нет'}`);

// ── Атаки: ходы должны реально проходить, а не просто кликаться ──────────
let attacksBlocked = 0;
let logAdvanced = 0;
let turnsPlayed = 0;
let lastLog = '';

for (let turn = 0; turn < 6; turn++) {
  const attack = page.locator('[id^="move-btn-"]').first();
  if (!(await attack.count())) break;

  const before = await page.locator('#battle-log').innerText().catch(() => '');
  const clicked = await attack.click({ timeout: 6000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(4500);
  if (!clicked) break;

  turnsPlayed++;
  const log = await page.locator('#battle-log').innerText().catch(() => '');
  if (/Подождите|не готов/i.test(log)) attacksBlocked++;
  // Ход засчитан только если лог реально изменился — иначе это клик мимо.
  if (log !== before) logAdvanced++;
  lastLog = log;
}

t('F4', 'бой проходит несколько ходов подряд', turnsPlayed >= 2, `ходов: ${turnsPlayed}`);
t('F5', 'атаки не блокируются фазой', attacksBlocked === 0 && logAdvanced >= 2,
  `ходов ${turnsPlayed}, лог продвинулся ${logAdvanced}, заблокировано ${attacksBlocked}`);

t('F6', 'в логе боя нет сообщения «Подождите»', !/Подождите/.test(lastLog),
  lastLog.slice(-90));
t('F7', 'нет недопустимых переходов фаз', phaseWarnings.length === 0,
  phaseWarnings.slice(0, 2).join(' | '));

// ── Перезагрузка: бой должен восстановиться ─────────────────────────────
if (battleStateLive.len > 0) {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  const restored = await waitForBattle(45000);
  const log = await page.locator('#battle-log').innerText().catch(() => '');
  t('F8', 'после перезагрузки бой восстанавливается', restored.visible && !restored.error,
    restored.error ? `ошибка при восстановлении: ${restored.log}`
      : `экран боя: ${restored.visible}; лог: ${restored.log.slice(-80)}`);
  t('F9', 'в логе есть сообщение о восстановлении боя', /восстанов/i.test(log),
    log.slice(-90));
}
else {
  t('F8', 'после перезагрузки бой восстанавливается', false, 'battle_state не был сохранён — проверить нечего');
  t('F9', 'в логе есть сообщение о восстановлении боя', false, 'бой не был активен');
}

console.log(failed === 0 ? '\nБОЕВОЙ ЦИКЛ РАБОТАЕТ' : `\nПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
