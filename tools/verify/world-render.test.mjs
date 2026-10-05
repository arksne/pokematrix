/**
 * Мир должен рендериться независимо от выбора стартовика.
 *
 * Симптом, который закрывает этот тест: у нового игрока панель локации
 * показывала статическую заглушку «Вермилион» из index.html — ни кнопок
 * локации, ни навигации, ни карты, — и при этом в консоли не было ни одной
 * ошибки. Причина: в init.ts стоял `await giveStarter()`, а весь код после него
 * (store.setState, renderLocation, renderTeamGrid, облачные события) ждал либо
 * клика по модалке, либо 90-секундной страховки. Код висел на await, а падать
 * было нечему — поэтому ошибки и не было.
 *
 * Проверяем ровно то, что видел игрок: контейнеры действий и навигации
 * наполнены, карта отрисована.
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN, APP_URL, HOST_ALIAS } from './paths.mjs';

let failed = 0;
const t = (id, name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

const { initData } = signInitData(BOT_TOKEN, makeUser(779000444, 'world_probe', 'World'));
await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
);
await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
// Страховку в 90 секунд не ждём: мир обязан появиться сразу.
await page.waitForTimeout(20000);

const world = await page.evaluate(() => {
  const name = document.getElementById('loc-name');
  return {
    name: name ? name.innerText.trim() : '(нет)',
    actions: document.getElementById('loc-actions')?.children.length ?? -1,
    nav: document.getElementById('nav-buttons')?.children.length ?? -1,
    navLabels: [...document.querySelectorAll('#nav-buttons button')].map((b) => b.innerText.trim()),
    mapItems: document.querySelectorAll('.map-loc-item').length,
  };
});

// «Вермилион» захардкожен в index.html как заглушка, поэтому совпадение с ним
// означает, что renderLocation не отработал и игрок видит статическую разметку.
t('W1', 'локация отрисована движком, а не заглушкой из index.html',
  world.name !== 'Вермилион' && world.name.length > 0, `«${world.name}»`);

t('W2', 'кнопки действий локации появились', world.actions > 0, `кнопок: ${world.actions}`);
t('W3', 'навигация по локациям появилась', world.nav > 0,
  `кнопок: ${world.nav}${world.navLabels.length ? ` (${world.navLabels.slice(0, 3).join(', ')})` : ''}`);
t('W4', 'карта отрисована', world.mapItems > 0, `элементов: ${world.mapItems}`);
t('W5', 'в навигации есть переход в покемен-центр',
  world.navLabels.some((l) => /Поке-центр/i.test(l)));

// Отдельно проверяем выход из тренировочной зоны. Раньше гейт делал просто
// return, из-за чего игрок с покемоном дороже 15 уровня оказывался заперт: все
// переходы ведут в renderLocation, то есть снова в тот же return, и карта с
// навигацией не рисовались вообще. Подсаживаем в сейв именно эту локацию.
const stuck = await ctx.newPage();
const stuckErrors = [];
stuck.on('pageerror', (e) => stuckErrors.push(e.message.slice(0, 200)));
const { initData: stuckAuth } = signInitData(BOT_TOKEN, makeUser(779000555, 'stuck_probe', 'Stuck'));
await stuck.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(stuckAuth) })
);
await stuck.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await stuck.waitForTimeout(9000);
// Кладём игрока в тренировочную зону с покемоном 19 уровня — как в проде.
// Ключи сейва строятся по шаблону league17_<name>_<trainerId> (utils/state.ts),
// поэтому подставляем тот же id, что и в подписи, иначе saveGame() не найдёт
// свой же ключ и затрёт подложенный сейв.
await stuck.evaluate(() => {
  const trainerId = '779000555';
  const save = {
    _v: Date.now(),
    _ts: Date.now(),
    starterGiven: true,
    currentLocationId: 'goldenrodCity_trainingGrounds',
    currentRegion: 'johto',
    myTeam: [{ uid: 'stuck-mon', apiData: { name: 'combusken' }, baseLevel: 19, candiesEaten: 0, currentHp: 30, maxHp: 30, ivs: {}, evs: {} }],
    pcBoxes: [[]],
    inventory: { credit: 1000, pokeBall: 5 },
    money: 1000,
    badges: [],
  };
  localStorage.setItem(`league17_save_${trainerId}`, JSON.stringify(save));
  localStorage.setItem(`league17_save_ts_${trainerId}`, String(Date.now() + 10000));
});
await stuck.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
await stuck.waitForTimeout(16000);

const afterStuck = await stuck.evaluate(() => ({
  name: document.getElementById('loc-name')?.innerText.trim() ?? '(нет)',
  nav: document.getElementById('nav-buttons')?.children.length ?? -1,
  mapItems: document.querySelectorAll('.map-loc-item').length,
  actions: document.getElementById('loc-actions')?.children.length ?? -1,
}));

t('W6', 'игрок с покемоном дороже 15 уровня выходит из тренировочной зоны',
  afterStuck.name !== 'Тренировочная зона' && afterStuck.nav > 0,
  `локация «${afterStuck.name}», навигация: ${afterStuck.nav}`);
t('W7', 'мир отрисован после выхода из зоны',
  afterStuck.mapItems > 0 && afterStuck.actions > 0,
  `карта: ${afterStuck.mapItems}, кнопок: ${afterStuck.actions}`);
t('W8', 'без застревания ошибок нет', stuckErrors.length === 0, stuckErrors.slice(0, 2).join(' | '));

// Стартовик выдаётся параллельно, поэтому модалка может быть ещё открыта — это
// нормально. Но выдать его игрок должен суметь без перезагрузки.
const starterVisible = await page.locator('#starter-modal').isVisible().catch(() => false);
if (starterVisible) {
  const cards = await page.locator('.starter-option').count();
  t('W9', 'стартовик предлагается к выбору', cards > 0, `карточек: ${cards}`);
} else {
  t('W9', 'стартовик предложен либо уже выдан', true, 'модалка не показана');
}

t('W10', 'нет ошибок в клиенте', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? 'МИР РЕНДЕРИТСЯ КОРРЕКТНО' : `ПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);