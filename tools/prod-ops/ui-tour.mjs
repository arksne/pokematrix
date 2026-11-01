/**
 * UI-тур по живому проду: открывает игру как реальный игрок из Telegram,
 * проходит по всем экранам, делает скриншоты и проверяет, что на каждом есть
 * содержимое и не сыпятся JS-ошибки/5xx.
 *
 * Зачем отдельно от browser-check: тот проверяет «вход и мир», а этот — что
 * КАЖДЫЙ экран живой (рюкзак, команда, покедекс, магазин, чат, тренеры, дроп,
 * PvP-арена, профиль), не пустой и без битых запросов. Скриншоты складываются
 * в tools/prod-ops/.state/tour-*.png, чтобы глазами посмотреть вёрстку.
 *
 * Запуск:
 *   $env:PROD_BOT_TOKEN='<токен бота>'
 *   node tools/prod-ops/ui-tour.mjs                 # прод
 *   $env:LOCAL='1'; $env:PROD_BASE='http://pokematrix.test:8099'; \
 *     $env:PROD_BOT_TOKEN='...'; node tools/prod-ops/ui-tour.mjs   # локальный verify-стенд
 *
 * Переменные: PROD_TG_ID (по умолчанию 777900311), HEADED=1 (показать окно),
 * TOUR_VIEWPORT (например '390x844').
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const STATE_DIR = path.join(here, '.state');
const require_ = createRequire(path.join(REPO, 'package.json'));

const BASE = (process.env.PROD_BASE || 'https://pokematrix.onrender.com').replace(/\/$/, '');
const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';
const LOCAL = process.env.LOCAL === '1';
const HEADED = process.env.HEADED === '1';
const TG_ID = Number(process.env.PROD_TG_ID || 777900311);
const TG_NAME = process.env.PROD_TG_NAME || 'ui_tour';
const [VW, VH] = (process.env.TOUR_VIEWPORT || '390x844').split('x').map(Number);

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN (токен бота @League17bot)');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function signInitData(botToken, user) {
  const authDate = Math.floor(Date.now() / 1000);
  const params = new URLSearchParams({
    query_id: `AAH${TG_ID}`,
    user: JSON.stringify(user),
    auth_date: String(authDate),
  });
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

const TG_USER = { id: TG_ID, first_name: TG_NAME, username: TG_NAME, language_code: 'ru' };
const INIT_DATA = signInitData(BOT_TOKEN, TG_USER);

const WEBAPP_SHIM = `
(function(){
  window.Telegram = window.Telegram || {};
  const initData = ${JSON.stringify(INIT_DATA)};
  const user = ${JSON.stringify(TG_USER)};
  const q = new URLSearchParams(initData);
  const userParsed = JSON.parse(q.get('user') || '{}');
  const tg = {
    initData,
    initDataUnsafe: {
      query_id: q.get('query_id'),
      user: userParsed,
      auth_date: Number(q.get('auth_date')),
      hash: q.get('hash'),
    },
    version: '8.0',
    platform: 'android',
    colorScheme: 'dark',
    themeParams: {},
    isExpanded: true,
    viewportHeight: window.innerHeight,
    viewportStableHeight: window.innerHeight,
    ready(){}, expand(){}, close(){}, onEvent(){}, offEvent(){}, sendData(){},
    enableClosingConfirmation(){}, disableClosingConfirmation(){},
    showPopup(){}, showAlert(){}, showConfirm(){}, requestContact(){},
    openTelegramLink(){}, openLink(){}, setHeaderColor(){}, setBackgroundColor(){},
    BackButton: { isVisible:false, show(){}, hide(){}, onClick(){}, offClick(){} },
    MainButton: { isVisible:false, show(){}, hide(){}, onClick(){}, offClick(){}, setText(){}, enable(){}, disable(){} },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
  };
  window.Telegram.WebApp = tg;
})();
`;

const results = [];
function check(id, name, pass, detail = '') {
  results.push({ id, name, pass, detail });
  console.log(`  [${id}] ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Все проверки по шагам: экран -> селектор, который должен показать содержимое. */
const TOUR = [
  { id: 'T1', label: 'мир', kind: 'world' },
  { id: 'T2', label: 'рюкзак', nav: 'view-backpack', content: 'inventory-items' },
  { id: 'T3', label: 'команда', nav: 'view-team', content: 'team-roster' },
  { id: 'T4', label: 'чат', nav: 'view-chat', content: 'chat-messages', waitMs: 6000 },
  { id: 'T5', label: 'тренеры', nav: 'view-trainers', content: 'trainers-all-panel', waitMs: 8000 },
  { id: 'T6', label: 'дроп', nav: 'view-drop', content: 'drop-list' },
  { id: 'T7', label: 'покедекс', click: 'btn-open-pokedex', modal: 'pokedex-modal', content: 'pokedex-grid' },
  { id: 'T8', label: 'задания', click: 'btn-quests', modal: 'quest-modal' },
  { id: 'T9', label: 'достижения', click: 'btn-achievements', css: '.achievement-modal' },
  { id: 'T10', label: 'лидерборд', click: 'btn-leaderboard', modal: 'leaderboard-modal' },
];

/** Экран регистрации — не отдельный id, а динамический оверлей с #btn-register. */
async function detectState(page) {
  return page
    .evaluate(() => {
      const visible = (el) => !!el && window.getComputedStyle(el).display !== 'none';
      const regBtn = document.getElementById('btn-register');
      if (visible(regBtn)) return 'register';
      const world = document.getElementById('view-world');
      if (visible(world)) return 'world';
      return 'loading';
    })
    .catch(() => 'loading');
}

async function main() {
  mkdirSync(STATE_DIR, { recursive: true });
  const { chromium } = require_('playwright');

  console.log(`Тур по UI: ${BASE}`);
  const browser = await chromium.launch({
    headless: !HEADED,
    args: LOCAL ? ['--host-resolver-rules=MAP pokematrix.test 127.0.0.1'] : [],
  });
  const context = await browser.newContext({
    viewport: { width: VW, height: VH },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36',
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const apiCalls = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/')) apiCalls.push({ url: u.replace(BASE, ''), status: r.status() });
  });

  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: WEBAPP_SHIM })
  );

  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // Ждём готовности так же, как это делает живой клиент: сначала /api/auth/tg,
  // потом либо мир, либо оверлей регистрации (#register-overlay с #btn-register).
  //
  // ВАЖНО: оверлей регистрации создаётся ДИНАМИЧЕСКИ и появляется уже после
  // того, как отрисовался мир под ним, поэтому одного «мир виден» недостаточно —
  // на этом и попались в первом прогоне (кликали по экранам под оверлеем).
  // Поэтому флаг «видели регистрацию» накапливаем, а не перезаписываем.
  const isRegScreen = () =>
    page.evaluate(() => !!document.getElementById('btn-register')).catch(() => false);
  const isWorld = () =>
    page
      .evaluate(() => {
        const el = document.getElementById('view-world');
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetHeight > 0;
      })
      .catch(() => false);
  const authSeen = () =>
    apiCalls.some((c) => c.url.includes('/auth/tg') && c.status >= 200 && c.status < 300);

  let worldVisible = false;
  let registrationShown = false;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    worldVisible = await isWorld();
    registrationShown = registrationShown || (await isRegScreen());
    if ((worldVisible && authSeen()) || registrationShown) break;
    await sleep(1000);
  }
  check('T0a', 'игра загрузилась до игрового состояния', worldVisible || registrationShown,
    `мир: ${worldVisible ? 'виден' : 'нет'}, экран регистрации: ${registrationShown ? 'показан' : 'нет'}`);

  if (registrationShown) {
    // Регистрация нового тренера: ник + кнопка «Начать приключение».
    await page.fill('#reg-nickname', `tour_${TG_ID % 100000}`).catch(() => {});
    await page.click('#btn-register').catch(() => {});
    let regOk = false;
    const regDeadline = Date.now() + 60_000;
    while (Date.now() < regDeadline) {
      regOk = apiCalls.some((c) => c.url.includes('/auth/register') && c.status >= 200 && c.status < 300);
      if (regOk && !(await isRegScreen())) break;
      await sleep(500);
    }
    check('T0b', 'регистрация нового тренера проходит', regOk,
      regOk ? 'POST /api/auth/register -> 200' : 'нет успешного /api/auth/register');
    for (let i = 0; i < 40 && (await isRegScreen()); i++) await sleep(500);
    check('T0b2', 'оверлей регистрации закрылся', !(await isRegScreen()));
  }

  // Ждём мир после входа/регистрации.
  const worldDeadline = Date.now() + 90_000;
  while (Date.now() < worldDeadline && !(await isWorld())) await sleep(1000);
  worldVisible = await isWorld();
  check('T0b3', 'игровой мир отрисовался', worldVisible);

  // Стартовая модалка: выбираем карту, иначе остальные экраны перекрыты.
  // Она тоже появляется с задержкой после отрисовки мира (как и оверлей
  // регистрации), поэтому ждём её до 15 секунд, а не проверяем один раз.
  let starterOpen = false;
  for (let i = 0; i < 30; i++) {
    starterOpen = await page
      .evaluate(() => {
        const m = document.getElementById('starter-modal');
        return !!m && window.getComputedStyle(m).display !== 'none';
      })
      .catch(() => false);
    if (starterOpen) break;
    await sleep(500);
  }
  if (starterOpen) {
    await page.screenshot({ path: path.join(STATE_DIR, 'tour-00-starter.png') }).catch(() => {});
    const picked = await page
      .evaluate(() => {
        const opt = document.querySelector('#starter-grid .starter-option');
        if (!opt) return false;
        opt.click();
        return true;
      })
      .catch(() => false);
    await sleep(3000);
    const stillOpen = await page
      .evaluate(() => {
        const m = document.getElementById('starter-modal');
        return !!m && window.getComputedStyle(m).display !== 'none';
      })
      .catch(() => false);
    check('T0c', 'стартовая карта выбирается и модалка закрывается', picked && !stillOpen,
      picked ? 'кликнули по карте' : 'карт не нашли');
  } else {
    // Новый игрок без модалки стартера — это баг: онбординг не сработал.
    const teamCount = await page
      .evaluate(() => (document.getElementById('team-count')?.textContent || '').trim())
      .catch(() => '');
    check('T0c', 'стартовая карта выбирается и модалка закрывается', false,
      `модалка стартера не появилась за 15 с; счётчик команды: ${teamCount || '—'}`);
  }

  for (const step of TOUR) {
    // Возвращаемся на мир, если предыдущий шаг оставил модалку.
    await page.keyboard.press('Escape').catch(() => {});

    let clicked = true;
    if (step.nav) {
      clicked = await page
        .evaluate((t) => {
          const el = document.querySelector(`.nav-item[data-target="${t}"]`);
          if (!el) return false;
          el.click();
          return true;
        }, step.nav)
        .catch(() => false);
    } else if (step.click) {
      clicked = await page
        .evaluate((id) => {
          const el = document.getElementById(id);
          if (!el) return false;
          el.click();
          return true;
        }, step.click)
        .catch(() => false);
    }
    await sleep(step.modal ? 1500 : 900);

    // Некоторые экраны грузят данные запросом (тренеры — список игроков),
    // поэтому даём им время: ждём содержимое до waitMs, а не ровно 900 мс.
    if (step.waitMs) {
      const until = Date.now() + step.waitMs;
      while (Date.now() < until) {
        const len = await page
          .evaluate((s) => {
            const el = s.content ? document.getElementById(s.content) : null;
            return el ? (el.textContent || '').trim().length : 0;
          }, step)
          .catch(() => 0);
        if (len > 50) break;
        await sleep(500);
      }
    }

    const view = await page
      .evaluate((s) => {
        const visible = (el) => {
          if (!el) return false;
          const st = window.getComputedStyle(el);
          return st.display !== 'none' && st.visibility !== 'hidden';
        };
        if (s.css) {
          const m = document.querySelector(s.css);
          if (visible(m)) return { kind: 'css', len: (m.textContent || '').trim().length, html: m.innerHTML.length };
        }
        if (s.modal) {
          const m = document.getElementById(s.modal);
          if (visible(m)) return { kind: 'modal', len: (m.textContent || '').trim().length, html: m.innerHTML.length };
        }
        if (s.nav) {
          const v = document.getElementById(s.nav);
          if (visible(v)) {
            const box = s.content ? document.getElementById(s.content) : v;
            const text = ((box || v).textContent || '').trim();
            return { kind: 'view', len: text.length, html: (box || v).innerHTML.length };
          }
        }
        // Мир
        const world = document.getElementById('view-world');
        if (visible(world)) {
          return { kind: 'world', len: (world.textContent || '').trim().length, html: world.innerHTML.length };
        }
        return { kind: 'none', len: 0, html: 0 };
      }, step)
      .catch((e) => ({ kind: 'error', len: 0, html: 0, error: String(e).slice(0, 80) }));

    // Критерий: экран открылся и на нём есть жизнь. Порог по html низкий —
    // у пустого рюкзака/команды нового игрока разметка маленькая, это нормально.
    const ok = clicked && view.kind !== 'none' && view.len > 20;
    check(step.id, `экран «${step.label}» открывается и не пустой`,
      ok,
      `элемент: ${step.nav || step.click || 'мир'}, текст: ${view.len} симв., разметка: ${view.html} Б, kind: ${view.kind}`);

    await page
      .screenshot({ path: path.join(STATE_DIR, `tour-${step.id.toLowerCase()}-${step.label.replace(/[^\wа-я]+/gi, '_')}.png`), fullPage: false })
      .catch(() => {});

    // Рюкзак: блок «Валюта» должен быть ровно один. Раньше кредиты выводились
    // дважды — отдельным блоком и как предмет категории currency.
    if (step.id === 'T2') {
      const dupes = await page
        .evaluate(() => {
          const el = document.getElementById('inventory-items');
          if (!el) return { count: 0, titles: [] };
          const titles = Array.from(el.querySelectorAll('.inv-category-title')).map((t) => (t.textContent || '').trim());
          return { count: titles.filter((t) => /^Валюта$/i.test(t)).length, titles };
        })
        .catch(() => ({ count: 0, titles: [] }));
      check('T2a', 'в рюкзаке «Валюта» показана один раз (нет дубля кредитов)',
        dupes.count <= 1,
        `заголовков «Валюта»: ${dupes.count}, все заголовки: ${dupes.titles.slice(0, 8).join(' | ') || '—'}`);
    }
  }

  // ── Аккаунт и PvP-арена (вкладка «Тренеры» → «Аккаунт») ──
  await page.keyboard.press('Escape').catch(() => {});
  await page
    .evaluate(() => {
      const tab = document.querySelector('.trainers-tab[data-tab="account"]');
      if (tab) tab.click();
    })
    .catch(() => {});
  await sleep(1000);
  const accountShown = await page
    .evaluate(() => {
      const p = document.getElementById('trainers-account-panel');
      return !!p && window.getComputedStyle(p).display !== 'none' && (p.textContent || '').trim().length > 20;
    })
    .catch(() => false);
  check('T11', 'вкладка «Аккаунт» в разделе тренеров открывается', accountShown, accountShown ? 'панель видна' : 'панель не показалась');
  await page.screenshot({ path: path.join(STATE_DIR, 'tour-t11-account.png') }).catch(() => {});

  const arenaClicked = await page
    .evaluate(() => {
      const el = document.getElementById('btn-account-arena');
      if (!el) return false;
      el.click();
      return true;
    })
    .catch(() => false);
  await sleep(2500);
  const arenaShown = await page
    .evaluate(() => {
      const el = document.getElementById('pvp-arena-modal');
      return !!el && window.getComputedStyle(el).display !== 'none';
    })
    .catch(() => false);
  check('T12', 'PvP-арена открывается по кнопке', arenaClicked && arenaShown,
    `кнопка: ${arenaClicked ? 'есть' : 'нет'}, модалка: ${arenaShown ? 'видна' : 'не найдена'}`);
  await page.screenshot({ path: path.join(STATE_DIR, 'tour-t12-arena.png') }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  // ── Переход между локациями (кнопки .btn-nav) ──
  await page
    .evaluate(() => {
      const nav = document.querySelector('.nav-item[data-target="view-world"]');
      if (nav) nav.click();
    })
    .catch(() => {});
  await sleep(800);
  const beforeName = await page.evaluate(() => (document.getElementById('loc-name')?.textContent || '').trim()).catch(() => '');
  const moved = await page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.btn-nav'));
      if (!btns.length) return null;
      // Берём кнопку перехода в соседнюю локацию, а не под-локацию города.
      const target = btns.find((b) => (b.textContent || '').includes('➔')) || btns[0];
      target.click();
      return (target.textContent || '').trim();
    })
    .catch(() => null);
  await sleep(2000);
  const afterName = await page.evaluate(() => (document.getElementById('loc-name')?.textContent || '').trim()).catch(() => '');
  const worldAfterMove = await page
    .evaluate(() => {
      const w = document.getElementById('view-world');
      return !!w && window.getComputedStyle(w).display !== 'none' && (w.textContent || '').trim().length > 200;
    })
    .catch(() => false);
  // Тост-подсказка: у нового игрока переход в соседнюю локацию закрыт обучением
  // («Сначала пройдите обучение у Профессора Оука!»). Это штатное поведение, а не
  // поломка навигации, поэтому засчитываем либо реальный переход, либо тост-гейт.
  const toastText = await page
    .evaluate(() => {
      const t = document.getElementById('trade-toast');
      if (!t) return '';
      const st = window.getComputedStyle(t);
      return st.opacity === '0' ? '' : (t.textContent || '').trim();
    })
    .catch(() => '');
  const gated = /обучени|Профессора Оука|туториал/i.test(toastText);
  const navigated = afterName.length > 0 && afterName !== beforeName;
  check('T13', 'навигация по локациям работает (переход или честный гейт обучения)',
    !!moved && worldAfterMove && (navigated || gated),
    `было «${beforeName}», кликнули «${moved || '—'}», стало «${afterName}»${gated ? `, гейт: «${toastText}»` : ''}`);
  await page.screenshot({ path: path.join(STATE_DIR, 'tour-t13-location.png') }).catch(() => {});

  // ── Магазин: под-локация города → кнопка «Магазин» → модалка с товарами ──
  const shopNav = await page
    .evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.btn-nav'));
      const shop = btns.find((b) => /маркет|магазин|shop/i.test(b.textContent || ''));
      if (!shop) return null;
      shop.click();
      return (shop.textContent || '').trim();
    })
    .catch(() => null);
  await sleep(2000);
  const shopOpened = await page
    .evaluate(() => {
      const btn = Array.from(document.querySelectorAll('#loc-actions button')).find((b) =>
        /Магазин/.test(b.textContent || '')
      );
      if (!btn) return { clicked: false, items: 0 };
      btn.click();
      return { clicked: true, items: 0 };
    })
    .catch(() => ({ clicked: false, items: 0 }));
  await sleep(1500);
  const shopState = await page
    .evaluate(() => {
      const modal = document.getElementById('shop-modal');
      const items = document.getElementById('shop-items');
      const visible = !!modal && window.getComputedStyle(modal).display !== 'none';
      return { visible, items: items ? items.children.length : 0, money: (document.getElementById('shop-money-display')?.textContent || '').trim() };
    })
    .catch(() => ({ visible: false, items: 0, money: '' }));
  check('T14', 'магазин открывается и показывает товары',
    !!shopNav && shopState.visible && shopState.items > 0,
    `под-локация: ${shopNav || 'не найдена'}, модалка: ${shopState.visible ? 'видна' : 'нет'}, товаров: ${shopState.items}, денег: ${shopState.money || '—'}`);
  await page.screenshot({ path: path.join(STATE_DIR, 'tour-t14-shop.png') }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  // Скриншот полной страницы на текущем экране — удобно смотреть вёрстку.
  await page.screenshot({ path: path.join(STATE_DIR, 'tour-99-final.png'), fullPage: true }).catch(() => {});

  const fiveXX = apiCalls.filter((c) => c.status >= 500);
  check('A1', 'ни один /api-запрос не вернул 5xx', fiveXX.length === 0,
    fiveXX.length ? fiveXX.slice(0, 3).map((c) => `${c.url} -> ${c.status}`).join('; ') : `запросов: ${apiCalls.length}`);

  const notFound = apiCalls.filter((c) => c.status === 404);
  check('A2', 'клиент не стучится в несуществующие /api-маршруты (нет 404)', notFound.length === 0,
    notFound.length ? notFound.slice(0, 3).map((c) => c.url).join('; ') : 'ок');

  const meaningful = consoleErrors.filter(
    (t) => !/ERR_FAILED|ERR_ABORTED|net::ERR|Failed to load resource|raw\.githubusercontent/i.test(t) && !/Cross-Origin-Opener-Policy/i.test(t)
  );
  check('A3', 'нет ошибок JS в консоли', meaningful.length === 0, meaningful.slice(0, 3).join(' | '));
  check('A4', 'нет необработанных исключений страницы', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close().catch(() => {});

  const passed = results.filter((r) => r.pass).length;
  console.log(`\nИТОГ: ${passed}/${results.length} проверок пройдено`);
  console.log(`Скриншоты: ${STATE_DIR}`);
  const bad = results.filter((r) => !r.pass);
  if (bad.length) {
    console.log('\nПРОВАЛЕНО: ' + bad.map((r) => r.id).join(', '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Тур упал:', e);
  process.exit(2);
});

