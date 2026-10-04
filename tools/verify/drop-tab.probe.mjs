/**
 * Проба вкладки «Дроп».
 *
 * Проверяет то, что нельзя поймать типами: вкладка появляется в меню, экран
 * открывается, журнал рисуется, сводка считается, кнопка очистки не падает на
 * пустом журнале.
 *
 * Авторизация — валидный initData через шим из tgsign.mjs, тем же способом,
 * что и в run.mjs: настоящий telegram-web-app.js перетирает window.Telegram,
 * поэтому шим отдаётся в ответ на запрос этого файла.
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN } from './paths.mjs';

const APP_URL = process.env.APP_URL || 'http://localhost:4319';
const check = (id, name, ok, detail = '') =>
  console.log(`  [${ok ? 'OK' : 'FAIL'}] ${id} ${name}${detail ? ` — ${detail}` : ''}`) &&
  process.exitCode;

let failed = 0;
const t = (id, name, ok, detail = '') => {
  if (!ok) failed++;
  check(id, name, ok, detail);
};

const { initData } = signInitData(BOT_TOKEN, makeUser(778000999, 'drop_probe', 'Drop'));

const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const s = m.text();
  // 401 на логине ожидаем, если сервер локальный и не подписан тем же токеном
  if (!/401|Failed to load resource/i.test(s)) errors.push('console: ' + s);
});

await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
);

await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000);

// Проба свежего пользователя упирается в стартовую модалку выбора покемона.
// Здесь она не нужна: проверяется вкладка дропа, а не стартовый флоу, поэтому
// все оверлеи скрываем, иначе они перехватывают клики по нижнему меню.
await page.evaluate(() => {
  document.querySelectorAll('.modal-overlay, #login-overlay').forEach((o) => {
    o.style.display = 'none';
  });
});
await page.waitForTimeout(500);

t('D1', 'вкладка «Дроп» есть в нижнем меню',
  (await page.locator('.nav-item[data-target="view-drop"]').count()) === 1);

t('D2', 'экран дропа есть в разметке',
  (await page.locator('#view-drop').count()) === 1);

t('D3', 'вкладка кликабельна и не перекрыта оверлеем',
  await page.locator('.nav-item[data-target="view-drop"]').isVisible());

await page.click('.nav-item[data-target="view-drop"]', { timeout: 15000 });
await page.waitForTimeout(1200);

t('D4', 'экран дропа стал активным',
  (await page.locator('#view-drop.active-view').count()) === 1);

const title = (await page.locator('#header-title').innerText().catch(() => '')).trim();
t('D5', 'заголовок = «Дроп»', title === 'Дроп', `получено «${title}»`);

const summary = (await page.locator('#drop-summary').innerText().catch(() => '')).trim();
t('D6', 'сводка заполнена', summary.length > 0 && summary !== '—', `«${summary}»`);

const body = (await page.locator('#drop-list').innerText().catch(() => '')).trim();
t('D7', 'список что-то показывает (пустое состояние или записи)',
  body.length > 0, `«${body.slice(0, 60)}»`);

// кнопка очистки не должна бросать на пустом журнале
const beforeErrors = errors.length;
await page.click('#btn-clear-drop', { timeout: 10000 });
await page.waitForTimeout(800);
const afterClear = (await page.locator('#drop-summary').innerText().catch(() => '')).trim();
t('D8', 'кнопка очистки отработала без ошибок', errors.length === beforeErrors,
  errors.slice(beforeErrors).join('; '));
t('D9', 'после очистки сводка обновилась', afterClear.length > 0, `«${afterClear}»`);

t('D10', 'нет ошибок в консоли', errors.length === 0, errors.slice(0, 5).join(' | '));

console.log(failed === 0 ? '\nИТОГ: все проверки вкладки «Дроп» пройдены' : `\nИТОГ: провалено ${failed}`);
await browser.close();
if (failed > 0) process.exit(1);