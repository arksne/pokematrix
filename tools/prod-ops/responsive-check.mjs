/**
 * Проверка вёрстки на разных экранах (в игре только мобильная вёрстка, но
 * телефоны очень разные: от 320px SE до планшета 768px).
 *
 * Что ловим:
 *   - горизонтальный скролл/вылезание контента за край (частая беда гридов
 *     предметов и широких таблиц в Telegram WebView);
 *   - неотрисованную навигацию (мир не готов, а мы уже «проверили»);
 *   - слишком маленькие тап-зоны у главных кнопок.
 *
 * Запуск:
 *   $env:PROD_BOT_TOKEN='<token>'; node tools/prod-ops/responsive-check.mjs
 *
 * Коды проверок: R1..R2 на каждый размер экрана.
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const require_ = createRequire(path.join(REPO, 'package.json'));
const { chromium } = require_('playwright');

const BASE = (process.env.PROD_BASE || 'https://pokematrix.onrender.com').replace(/\/$/, '');
const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';
const TG_ID_BASE = Number(process.env.PROD_TG_ID || 777900500);
const HEADFUL = process.argv.includes('--headful');

const SIZES = [
  { name: 'iPhone SE', w: 320, h: 568 },
  { name: 'iPhone 8', w: 375, h: 667 },
  { name: 'Telegram (базовый)', w: 390, h: 844 },
  { name: 'Планшет', w: 768, h: 1024 },
];
/** Главные кнопки (переходы/NPC) — не мельче 40px (Apple HIG советует 44). */
const MIN_TAP_PX = 40;
/** Иконки в шапке (значки/уведомления/синк) — компактные, но не мельче 34px. */
const MIN_HEADER_TAP_PX = 34;

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN (токен бота) — им подписывается initData.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, title, ok, detail = '') {
  results.push({ id, title, ok, detail });
  console.log(`  [${id}] ${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? `  — ${detail}` : ''}`);
}

function makeInitData(userId) {
  const params = new URLSearchParams({
    query_id: 'AAH' + crypto.randomBytes(4).toString('hex'),
    user: JSON.stringify({ id: userId, first_name: 'resp', username: 'respcheck', language_code: 'ru' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

function telegramShim(initData) {
  return `(function(){
  const q = new URLSearchParams(${JSON.stringify(initData)});
  window.Telegram = { WebApp: {
    initData: ${JSON.stringify(initData)},
    initDataUnsafe: { user: JSON.parse(q.get('user')), auth_date: Number(q.get('auth_date')), hash: q.get('hash') },
    version: '8.0', platform: 'android', colorScheme: 'dark', themeParams: {}, isExpanded: true,
    viewportHeight: window.innerHeight, viewportStableHeight: window.innerHeight,
    ready(){}, expand(){}, close(){}, onEvent(){}, offEvent(){}, sendData(){}, isVersionAtLeast(){ return true; },
    BackButton: { isVisible: false, show(){}, hide(){}, onClick(){}, offClick(){} },
    MainButton: { isVisible: false, show(){}, hide(){}, onClick(){}, offClick(){}, setText(){}, enable(){}, disable(){} },
    HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} }
  }};
})();`;
}

async function prepareGame(page, initData, nickname) {
  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: telegramShim(initData) })
  );
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  for (let i = 0; i < 80; i++) {
    const reg = await page
      .evaluate(() => {
        const b = document.getElementById('btn-register');
        return !!b && b.offsetHeight > 0;
      })
      .catch(() => false);
    if (reg) {
      await page
        .evaluate((nick) => {
          const input = document.querySelector('#register-overlay input');
          if (input) {
            input.value = nick;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          document.getElementById('btn-register')?.click();
        }, nickname)
        .catch(() => {});
      break;
    }
    await sleep(500);
  }
  await sleep(3000);
  for (let i = 0; i < 30; i++) {
    const open = await page
      .evaluate(() => {
        const m = document.getElementById('starter-modal');
        return !!m && window.getComputedStyle(m).display !== 'none';
      })
      .catch(() => false);
    if (!open) break;
    await page.evaluate(() => document.querySelector('#starter-grid .starter-option')?.click()).catch(() => {});
    await sleep(2000);
  }
  await sleep(3000);
  // Готовность: клиент отрисовал навигацию.
  for (let i = 0; i < 60; i++) {
    const ready = await page
      .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #nav-buttons .nav-item, #loc-actions button').length > 0)
      .catch(() => false);
    if (ready) return true;
    await sleep(500);
  }
  return false;
}

async function measure(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const overflowX = doc.scrollWidth - doc.clientWidth;
    const offenders = [];
    document.querySelectorAll('#view-world *, #main-content *, body > *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r || r.width === 0 || r.height === 0) return;
      if (r.right > vw + 2 || r.left < -2) {
        const text = (el.textContent || '').trim().slice(0, 40);
        if (text) {
          offenders.push({ tag: el.tagName.toLowerCase(), id: el.id || '', right: Math.round(r.right), text });
        }
      }
    });
    const navButtons = Array.from(document.querySelectorAll('#nav-buttons .btn-nav, #nav-buttons .nav-item'));
    const tapSizes = Array.from(document.querySelectorAll('#loc-actions button, #nav-buttons .btn-nav'))
      .map((b) => {
        const r = b.getBoundingClientRect();
        return Math.round(Math.min(r.width, r.height));
      })
      .filter((n) => n > 0);
    const headerTapSizes = Array.from(document.querySelectorAll('.header-lb, .header-sync'))
      .map((b) => {
        const r = b.getBoundingClientRect();
        return Math.round(Math.min(r.width, r.height));
      })
      .filter((n) => n > 0);
    return {
      overflowX,
      offenderCount: offenders.length,
      offenders: offenders.slice(0, 5),
      navCount: navButtons.length,
      minTap: tapSizes.length ? Math.min(...tapSizes) : null,
      minHeaderTap: headerTapSizes.length ? Math.min(...headerTapSizes) : null,
    };
  });
}

async function main() {
  console.log(`\nВёрстка на разных экранах: ${BASE}\n`);
  const browser = await chromium.launch({ headless: !HEADFUL });
  try {
    for (let idx = 0; idx < SIZES.length; idx++) {
      const size = SIZES[idx];
      const tgId = TG_ID_BASE + idx;
      const initData = makeInitData(tgId);
      const ctx = await browser.newContext({
        viewport: { width: size.w, height: size.h },
        isMobile: true,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
      });
      const page = await ctx.newPage();
      const ready = await prepareGame(page, initData, `r${String(tgId).slice(-4)}`);
      const world = ready ? await measure(page) : null;
      check(
        `R1-${size.w}x${size.h}`,
        `${size.name}: мир отрисован без горизонтального скролла`,
        Boolean(ready) && world != null && world.overflowX <= 1 && world.navCount > 0,
        world
          ? `overflow=${world.overflowX}px, навигация: ${world.navCount}, за краем: ${world.offenderCount}`
          : 'мир не отрисовался'
      );

      // Рюкзак и команда — типовые «широкие» экраны (гриды предметов/карточек).
      const openTab = async (target) => {
        await page
          .evaluate((t) => {
            const b = document.querySelector(`.nav-item[data-target="${t}"], [data-target="${t}"]`);
            b?.click();
          }, target)
          .catch(() => {});
        await sleep(1800);
      };
      await openTab('view-backpack');
      const backpack = await measure(page);
      await openTab('view-team');
      const team = await measure(page);
      await openTab('view-world');
      await page.keyboard.press('Escape').catch(() => {});
      await sleep(600);

      const worstOverflow = Math.max(backpack.overflowX, team.overflowX);
      const minTap = world?.minTap ?? null;
      const minHeaderTap = world?.minHeaderTap ?? null;
      check(
        `R2-${size.w}x${size.h}`,
        `${size.name}: рюкзак и команда без переполнения, тап-зоны ≥ ${MIN_TAP_PX}px`,
        worstOverflow <= 1 &&
          (minTap == null || minTap >= MIN_TAP_PX) &&
          (minHeaderTap == null || minHeaderTap >= MIN_HEADER_TAP_PX),
        `рюкзак overflow=${backpack.overflowX}px, команда overflow=${team.overflowX}px, ` +
          `тап-зона кнопок: ${minTap ?? '—'}px, иконки шапки: ${minHeaderTap ?? '—'}px`
      );

      await page.screenshot({ path: path.join(here, '.state', `responsive-${size.w}x${size.h}.png`) }).catch(() => {});
      await ctx.close();
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nИТОГ: ${passed}/${results.length} проверок пройдено`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nПРОВАЛЕНО: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Проверка вёрстки упала:', e?.stack || e);
  process.exit(1);
});
