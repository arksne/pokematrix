/**
 * Достижимость обмена двумя настоящими клиентами.
 *
 * Серверный протокол обмена проверен отдельно, но игрока интересует другое: можно
 * ли обмен вообще начать. Список собеседников берётся из onlinePlayersList, а он
 * пуст, когда в игре один человек, поэтому «обмен не работает» может означать
 * и «не нашлось второго игрока», и настоящую поломку. Разницу видно только
 * здесь — с двумя клиентами.
 *
 * Проба нашла настоящую поломку: кнопка «Обмен» в Pokecenter звала
 * main.js.openTradeCenter, но main.ts не экспортирует ничего, поэтому обработчик
 * падал на undefined и молча ничего не делал. Обмен нельзя было начать ни из
 * одного места. Теперь TR2/TR3 проверяют именно этот путь.
 *
 * Проверяем DOM, а не window.state: внутреннее состояние намеренно не торчит в
 * глобалы, и опираться на него в пробе значило бы зафиксировать утечку как
 * контракт.
 *
 * Запускается внутри общего harness: сервер поднят на APP_PORT, токен и ключи
 * берутся оттуда же, поэтому проба не ходит в production.
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN, APP_URL, HOST_ALIAS } from './paths.mjs';

let failed = 0;
const t = (id, name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

/**
 * Открывает игрока с валидной подписью Telegram.
 *
 * Шим отдаётся в ответ на telegram-web-app.js, а не через addInitScript: реальный
 * скрипт Telegram перетирает window.Telegram. Оверлеи стартового флоу скрываются
 * только на время чтения — сама кнопка обмена должна остаться кликабельной.
 */
async function openPlayer(browser, user) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  const { initData } = signInitData(BOT_TOKEN, user);
  await page.route('**/telegram-web-app.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
  );
  await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, #login-overlay').forEach((o) => {
      o.style.display = 'none';
    });
  });
  return { page, ctx, errors };
}

/**
 * Доводит игрока до Pokecenter, где и живёт кнопка обмена.
 *
 * Переходы между локациями — это кнопки «➔ Название» (btn-nav), поэтому идём по
 * ним, а не вызываем внутренние функции: так же, как это делает игрок.
 */
async function travelToPokecenter(page, maxSteps = 6) {
  for (let step = 0; step < maxSteps; step++) {
    const btn = page.locator('button.btn-nav', { hasText: 'Поке-центр' }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      return true;
    }
    // Иначе идём в первую доступную соседнюю локацию.
    const any = page.locator('button.btn-nav').first();
    if (!(await any.count())) return false;
    await any.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2200);
  }
  return false;
}

// Хост-алиас pokematrix.test должен резолвиться в 127.0.0.1, иначе Chromium не
// найдёт локальный сервер harness. Так же запускается основной набор проверок.
const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});

const alice = await openPlayer(browser, makeUser(778000111, 'trade_alice', 'Alice'));
const bob = await openPlayer(browser, makeUser(778000222, 'trade_bob', 'Bob'));

// Ждём, пока оба сокета подключатся и каждый увидит второго в лобби.
await alice.page.waitForTimeout(8000);
await bob.page.waitForTimeout(8000);

const reached = await travelToPokecenter(alice.page);
t('TR1', 'до Pokecenter можно дойти кнопками перехода', reached);
t('TR2', 'кнопка обмена появилась в Pokecenter',
  (await alice.page.locator('button.btn-use', { hasText: 'глобальн' }).count()) === 1);

// Кликаем обмен — именно этот клик раньше ничего не делал.
await alice.page.locator('button.btn-use', { hasText: 'глобальн' }).first()
  .click({ timeout: 10000 }).catch(() => {});
await alice.page.waitForTimeout(2500);

const centerVisible = await alice.page.locator('#trade-center-modal').isVisible().catch(() => false);
t('TR3', 'торговый центр открывается', centerVisible);

const rows = await alice.page.locator('.trade-player-row').count();
const rowText = await alice.page.locator('.trade-player-row').first().innerText().catch(() => '');
t('TR4', 'в торговом центре есть напарник', rows >= 1,
  `строк: ${rows}${rowText ? `, «${rowText.replace(/\s+/g, ' ').trim()}»` : ''}`);
t('TR5', 'в строке нет самого себя', !/alice/i.test(rowText),
  `«${rowText.replace(/\s+/g, ' ').trim()}»`);

// Алиса предлагает обмен: у Бориса должна появиться модалка запроса.
await alice.page.locator('.trade-player-row button', { hasText: 'Трейд' }).first()
  .click({ timeout: 10000 }).catch(() => {});

let requestShown = false;
try {
  await bob.page.locator('#trade-request-modal').waitFor({ state: 'visible', timeout: 25000 });
  requestShown = true;
} catch { /* остаётся false */ }
const requestFrom = await bob.page.locator('#trade-req-username').innerText().catch(() => '');
t('TR6', 'запрос обмена доходит до партнёра и показывает модалку', requestShown,
  requestShown ? `от: «${requestFrom}»` : 'модалка не появилась');

if (requestShown) {
  await bob.page.locator('#btn-trade-accept').click({ timeout: 8000 }).catch(() => {});

  let bobOpened = false;
  try {
    await bob.page.locator('#trade-window, #trade-modal, .trade-container').first()
      .waitFor({ state: 'visible', timeout: 25000 });
    bobOpened = true;
  } catch { /* остаётся false */ }
  t('TR7', 'после принятия открывается окно обмена', bobOpened);

  const aliceOpened = await alice.page.locator('#trade-window, #trade-modal').first()
    .isVisible().catch(() => false);
  t('TR8', 'окно обмена открылось и у отправителя', aliceOpened);
} else {
  t('TR7', 'после принятия открывается окно обмена', false, 'запрос не дошёл');
  t('TR8', 'окно обмена открылось и у отправителя', false, 'запрос не дошёл');
}

const errors = [...alice.errors, ...bob.errors];
t('TR9', 'нет ошибок в клиентах', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? 'ВСЕ ПРОВЕРКИ ОБМЕНА ПРОЙДЕНЫ' : `ПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);