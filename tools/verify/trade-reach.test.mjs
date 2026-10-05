/**
 * Достижимость обмена между двумя настоящими клиентами.
 *
 * Серверный протокол обмена проверен отдельно (T1–T8 в economy.test.mjs), но
 * игрока интересует другое: можно ли обмен вообще начать. Список собеседников
 * берётся из onlinePlayersList и пуст, когда в игре один человек, поэтому
 * «обмен не работает» может означать и «не нашлось второго игрока», и поломку.
 * Разницу видно только здесь — с двумя клиентами.
 *
 * Проба нашла настоящую поломку: кнопка «Обменник» в покемон-центре звала
 * main.js.openTradeCenter, а main.ts не экспортирует ничего, поэтому обработчик
 * падал на undefined. Обмен нельзя было начать ниоткуда.
 *
 * Проверяем DOM, а не window.state: внутреннее состояние намеренно не торчит в
 * глобалы, и опираться на него в пробе значило бы зафиксировать утечку как
 * контракт.
 *
 * Запускается внутри общего harness: сервер поднят на APP_PORT, ключи берутся
 * оттуда же, поэтому проба не ходит в production.
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
 * Иначе authTelegram() стоит на await showRegistrationScreen(), стартовая модалка
 * перехватывает все клики, и проба не может дойти до покемон-центра.
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

/**
 * Открывает игрока и доводит его до покемон-центра.
 *
 * Сокет не поднимается, пока не пройдена регистрация, а список игроков онлайн
 * приходит только после join_lobby. Поэтому сначала регистрируем через API,
 * потом убираем стартовую модалку выбора и идём в покемон-центр кнопками
 * «➔ Название» — так же, как это делает игрок.
 */
async function openPlayerAtPokecenter(browser, tgId, username) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message.slice(0, 200)));

  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, username, username));
  await page.route('**/telegram-web-app.js*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) })
  );
  await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(14000);

  // Стартовик: модалка перехватывает клики по интерфейсу.
  const starter = page.locator('#starter-modal');
  if (await starter.isVisible().catch(() => false)) {
    await page.locator('.starter-option').first().click({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }
  // Регистрация, если ещё не пройдена (на случай смены состояния тестовой БД).
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, #login-overlay').forEach((o) => {
      if (o.id !== 'register-overlay') o.style.display = 'none';
    });
  });

  // Идём в покемон-центр: переходы — кнопки «➔ Название» в #nav-buttons.
  for (let step = 0; step < 6; step++) {
    const toCenter = page.locator('#nav-buttons button', { hasText: /Поке-центр/i }).first();
    if (await toCenter.count()) {
      await toCenter.click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
      break;
    }
    const anyLink = page.locator('#nav-buttons button').first();
    if (!(await anyLink.count())) break;
    await anyLink.click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }

  return { page, ctx, errors };
}

/**
 * Поднимает сокет: он создаётся при открытии вкладки «Чат» (initTradeSocket в
 * nav.ts), а список игроков онлайн приходит только после join_lobby. Без этого
 * торговый центр открывается пустым — но это ограничение сокета, а не поломка
 * обмена, поэтому проверяем его явно, отдельной строкой.
 */
async function connectSocket(page) {
  await page.locator('.nav-item[data-target="view-chat"]').click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(6000);
  const connected = await page.evaluate(() => {
    const list = document.getElementById('chat-online-list');
    return list ? list.textContent.trim() : '(нет списка онлайн)';
  });
  // Возвращаемся в мир: покемон-центр нужен для кнопки обмена.
  await page.locator('.nav-item[data-target="view-world"]').click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return connected;
}

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});

const regA = await register(779001111, 'trade_alice');
const regB = await register(779002222, 'trade_bob');
t('TR1', 'оба игрока зарегистрированы', regA.ok && regB.ok, `${regA.detail} / ${regB.detail}`);

const alice = await openPlayerAtPokecenter(browser, 779001111, 'trade_alice');
const bob = await openPlayerAtPokecenter(browser, 779002222, 'trade_bob');

// Ждём, пока сокеты подключатся и каждый увидит второго в лобби.
await alice.page.waitForTimeout(4000);
await bob.page.waitForTimeout(4000);

const aliceOnline = await connectSocket(alice.page);
await bob.page.waitForTimeout(2000);
const bobOnline = await connectSocket(bob.page);
await alice.page.waitForTimeout(6000);

// Проверяем после паузы: список онлайн обновляется по событию online_players,
// и тот, кто подключился вторым, уже видит первого, а первый увидит второго
// только на следующем broadcast. Поэтому сверяем торговый центр, а не счётчик
// в чате: он отражает фактическое состояние к моменту нажатия «Трейд».
t('TR2', 'оба игрока подняли сокет и попали в лобби',
  /[1-9]/.test(bobOnline), `Борис видит: «${bobOnline}»`);

const tradeBtn = alice.page.locator('#loc-actions button', { hasText: 'Обмен' }).first();
t('TR3', 'кнопка обмена есть в покемон-центре', (await tradeBtn.count()) === 1);

await tradeBtn.click({ timeout: 10000 }).catch(() => {});
await alice.page.waitForTimeout(2500);

const centerVisible = await alice.page.locator('#trade-center-modal').isVisible().catch(() => false);
t('TR4', 'торговый центр открывается по кнопке', centerVisible);

const rows = await alice.page.locator('.trade-player-row').count();
const rowText = await alice.page.locator('.trade-player-row').first().innerText().catch(() => '');
t('TR5', 'в торговом центре есть напарник', rows >= 1,
  `строк: ${rows}${rowText ? `, «${rowText.replace(/\s+/g, ' ').trim()}»` : ''}`);
t('TR6', 'в строке нет самого себя', !/alice/i.test(rowText),
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
t('TR7', 'запрос обмена доходит до партнёра и показывает модалку', requestShown,
  requestShown ? `от: «${requestFrom}»` : 'модалка не появилась');

if (requestShown) {
  // Принимаем запрос: сервер шлёт trade_started обоим, и только тогда
  // открывается само окно обмена (#trade-window-modal).
  await bob.page.locator('#btn-trade-accept').click({ timeout: 8000 }).catch(() => {});

  let bobOpened = false;
  try {
    await bob.page.locator('#trade-window-modal').waitFor({ state: 'visible', timeout: 25000 });
    bobOpened = true;
  } catch { /* остаётся false */ }
  t('TR8', 'после принятия открывается окно обмена', bobOpened);

  const aliceOpened = await alice.page.locator('#trade-window-modal').first()
    .isVisible().catch(() => false);
  t('TR9', 'окно обмена открылось и у отправителя', aliceOpened);

  // В окне должен быть список покемонов — иначе предложить нечего.
  // Разметка карточек: .trade-pokemon-card (trade-window.ts:178).
  const tradeItems = await bob.page.evaluate(() =>
    document.querySelectorAll('#trade-window-modal .trade-pokemon-card').length);
  t('TR10', 'в окне обмена есть покемоны для предложения', tradeItems > 0,
    `карточек: ${tradeItems}`);
} else {
  t('TR8', 'после принятия открывается окно обмена', false, 'запрос не дошёл');
  t('TR9', 'окно обмена открылось и у отправителя', false, 'запрос не дошёл');
  t('TR10', 'в окне обмена есть покемоны для предложения', false, 'запрос не дошёл');
}

const errors = [...alice.errors, ...bob.errors];
t('TR11', 'нет ошибок в клиентах', errors.length === 0, errors.slice(0, 3).join(' | '));

console.log(failed === 0 ? 'ОБМЕН ДОСТИЖИМ' : `ПРОВАЛЕНО: ${failed}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
