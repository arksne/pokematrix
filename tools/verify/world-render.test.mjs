/**
 * Мир должен рендериться независимо от выбора стартовика и без застревания.
 *
 * Симптом, который закрывает этот тест: панель локации показывала статическую
 * заглушку «Вермилион» из index.html — ни кнопок локации, ни навигации, ни карты —
 * и при этом в консоли не было ни одной ошибки.
 *
 * Найдено несколько независимых причин, каждая молча останавливала
 * инициализацию:
 *
 *   1. `await giveStarter()` в init.ts держал рендер мира до выбора покемона.
 *   2. Гейт тренировочной зоны делал голый `return`, запирая игрока с покемоном
 *      дороже 15 уровня: все переходы ведут в renderLocation, то есть снова в
 *      этот `return`.
 *   3. `await showRegistrationScreen()` в authTelegram() держал init, пока
 *      незарегистрированный игрок не заполнит профиль.
 *
 * Плюс норма, которую легко принять за поломку: карта свёрнута при старте, её
 * список локаций появляется только после открытия.
 *
 * Проверяем то, что видит игрок: заголовок локации отрисован движком, навигация
 * есть, карта открывается и наполнена, из зоны можно выйти.
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

/**
 * Регистрирует пользователя через API.
 *
 * Без этого authTelegram() упирается в await showRegistrationScreen(), и весь
 * init стоит: игрок видит форму профиля, а под ней — статическую заглушку.
 */
async function register(tgId, username) {
  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, username, username));
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) return { ok: false, detail: `HTTP ${r.status}` };
  const reg = await api('/api/auth/register', {
    method: 'POST',
    token: r.json.token,
    body: { nickname: username },
  });
  return { ok: reg.status === 200, detail: `HTTP ${reg.status}` };
}

/** Открывает игрока с валидной подписью Telegram. */
async function openPlayer(browser, tgId, username) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, username, username));
  await page.route('**/telegram-web-app.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
  );
  await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  return { ctx, page, errors };
}

/** Что сейчас нарисовано в панели мира. */
const readWorld = (page) => page.evaluate(() => ({
  name: document.getElementById('loc-name')?.innerText.trim() ?? '(нет)',
  actions: document.getElementById('loc-actions')?.children.length ?? -1,
  actionLabels: [...document.querySelectorAll('#loc-actions button')].map((b) => b.innerText.trim()),
  nav: document.getElementById('nav-buttons')?.children.length ?? -1,
  navLabels: [...document.querySelectorAll('#nav-buttons button')].map((b) => b.innerText.trim()),
  mapItems: document.querySelectorAll('.map-loc-item').length,
  mapVisible: getComputedStyle(document.getElementById('map-container')).display !== 'none',
}));

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});

// ── Игрок в Голденрод-Сити: штатный случай ──────────────────────────────
const reg = await register(779000444, 'world_probe');
t('W1', 'игрок зарегистрирован (иначе init стоит на экране профиля)', reg.ok, reg.detail);

const { page, errors } = await openPlayer(browser, 779000444, 'world_probe');
// Страховку в 90 секунд не ждём: мир обязан появиться сразу.
await page.waitForTimeout(20000);

const world = await readWorld(page);
t('W2', 'локация отрисована движком, а не заглушкой из index.html',
  world.name !== 'Вермилион' && world.name.length > 0, `«${world.name}»`);
t('W3', 'навигация по локациям появилась', world.nav > 0,
  `кнопок: ${world.nav}${world.navLabels.length ? ` (${world.navLabels.slice(0, 3).join(', ')})` : ''}`);
t('W4', 'в навигации есть переход в покемен-центр',
  world.navLabels.some((l) => /Поке-центр/i.test(l)));

// Мир отрисовался под модалкой выбора стартовика — ровно то, чего раньше не
// происходило: init стоял на await, и панель оставалась заглушкой. Выбираем
// стартовика, чтобы дальше проверять интерфейс без перехвата кликов модалкой.
const starterModal = page.locator('#starter-modal');
if (await starterModal.isVisible().catch(() => false)) {
  const cards = page.locator('.starter-option');
  const cardCount = await cards.count();
  t('W5', 'стартовик предлагается к выбору', cardCount > 0, `карточек: ${cardCount}`);
  await cards.first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);
  t('W6', 'модалка стартовика закрывается после выбора',
    !(await starterModal.isVisible().catch(() => false)));
} else {
  t('W5', 'стартовик уже выдан', true, 'модалка не показана');
}

// Карта свёрнута при старте — это норма, а не поломка. Проверяем, что она
// открывается и наполнена, иначе игрок просто не найдёт переходы.
const beforeMap = await readWorld(page);
const mapWasHidden = !beforeMap.mapVisible;
// Обработчик открытия висит на #map-header, а не на вложенном span.
await page.locator('#map-header').click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(2500);
const withMap = await readWorld(page);
t('W7', 'карта свёрнута на старте и открывается по кнопке',
  mapWasHidden && withMap.mapVisible, `была скрыта: ${mapWasHidden}, стала видна: ${withMap.mapVisible}`);
t('W8', 'карта наполнена списком локаций', withMap.mapItems > 0, `элементов: ${withMap.mapItems}`);

// Кнопки действий зависят от типа локации: в Голденрод-Сити их нет, они есть в
// покемен-центре. Проверяем там, где они должны быть.
await page.locator('#nav-buttons button', { hasText: /Поке-центр/i }).first()
  .click({ timeout: 10000 }).catch(() => {});
await page.waitForTimeout(3000);
const atCenter = await readWorld(page);
t('W9', 'в покемен-центре появились кнопки действий', atCenter.actions > 0,
  `кнопок: ${atCenter.actions}${atCenter.actionLabels.length ? ` (${atCenter.actionLabels.join(', ')})` : ''}`);
t('W10', 'в покемен-центре есть кнопка обмена',
  atCenter.actionLabels.some((l) => /Обмен/i.test(l)), atCenter.actionLabels.join(', '));

// ── Застревание в тренировочной зоне ────────────────────────────────────
// Гейт раньше делал голый return. Прод с этим и был заперт: сохранённая
// локация — тренировочная зона, покемон 19 уровня.
const stuckReg = await register(779000555, 'stuck_probe');
t('W11', 'второй игрок зарегистрирован', stuckReg.ok, stuckReg.detail);

const stuck = await openPlayer(browser, 779000555, 'stuck_probe');
await stuck.page.waitForTimeout(9000);
// Ключи сейва строятся как league17_<name>_<trainerId> (utils/state.ts).
await stuck.page.evaluate(() => {
  const trainerId = '779000555';
  localStorage.setItem(`league17_save_${trainerId}`, JSON.stringify({
    _v: Date.now(), _ts: Date.now(), starterGiven: true,
    currentLocationId: 'goldenrodCity_trainingGrounds', currentRegion: 'johto',
    myTeam: [{ uid: 'stuck-mon', apiData: { name: 'combusken' }, baseLevel: 19, candiesEaten: 0, currentHp: 30, maxHp: 30, ivs: {}, evs: {} }],
    pcBoxes: [[]], inventory: { credit: 1000, pokeBall: 5 }, money: 1000, badges: [],
  }));
  localStorage.setItem(`league17_save_ts_${trainerId}`, String(Date.now() + 10000));
});
await stuck.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await stuck.page.waitForTimeout(16000);

const afterStuck = await readWorld(stuck.page);
t('W12', 'игрок с покемоном дороже 15 уровня выходит из тренировочной зоны',
  afterStuck.name !== 'Вермилион' && afterStuck.name !== '' && afterStuck.nav > 0,
  `локация «${afterStuck.name}», навигация: ${afterStuck.nav}`);
t('W13', 'после выхода из зоны мир отрисован', afterStuck.nav > 0,
  `навигация: ${afterStuck.nav}`);

t('W14', 'нет ошибок в клиенте', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? 'МИР РЕНДЕРИТСЯ КОРРЕКТНО' : `ПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);