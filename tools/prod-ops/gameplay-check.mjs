/**
 * Игровой прогон по БОЕВОМУ проду: не «экран открылся», а «в игру можно играть».
 *
 * UI-тур (ui-tour.mjs) проверяет, что все экраны открываются и не пустые. Этого
 * мало: настоящий игрок ловит покемона, дерётся, покупает в магазине, пишет в
 * чат и возвращается в игру после перезапуска. Этот скрипт проходит именно такой
 * сценарий в живом Telegram-вебвью (подписанный initData) и проверяет последствия
 * действий: бой идёт, деньги меняются, сейв уходит на сервер, чат-сообщение
 * доезжает, после перезагрузки прогресс на месте.
 *
 * Запуск:
 *   $env:PROD_BOT_TOKEN='<token>'; $env:PROD_TG_ID='777900350'
 *   node tools/prod-ops/gameplay-check.mjs
 *
 * Коды проверок: G1..G8 (геймплей), A1..A3 (общие).
 * Скриншоты: tools/prod-ops/.state/game-*.png
 */
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '..', '..');
const require_ = createRequire(path.join(REPO, 'package.json'));
const { chromium } = require_('playwright');

const BASE = (process.env.PROD_BASE || 'https://pokematrix.onrender.com').replace(/\/$/, '');
const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';
const TG_ID = Number(process.env.PROD_TG_ID || 777900350);
const STATE_DIR = path.join(here, '.state');
const HEADFUL = process.argv.includes('--headful');

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN (токен бота) — им подписывается initData.');
  process.exit(2);
}
mkdirSync(STATE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, title, ok, detail = '') {
  results.push({ id, title, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${id}] ${mark}  ${title}${detail ? `  — ${detail}` : ''}`);
}

/** Подписанный initData, как его присылает Telegram (алгоритм из Bot API). */
function makeInitData(userId) {
  const params = new URLSearchParams({
    query_id: 'AAH' + crypto.randomBytes(4).toString('hex'),
    user: JSON.stringify({ id: userId, first_name: 'gamecheck', username: 'gamecheck', language_code: 'ru' }),
    auth_date: String(Math.floor(Date.now() / 1000)),
  });
  const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dcs).digest('hex'));
  return params.toString();
}

/** Мини-заглушка telegram-web-app.js: только то, что нужно клиенту для входа. */
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

/**
 * Прочитать облачный сейв напрямую через API — так же, как это делает клиент.
 *
 * Клиент НЕ держит save_data в localStorage (там только refresh-токен, номер
 * тренера и отметка синка), поэтому «прочитать сейв» можно только запросом:
 * POST /api/auth/refresh { refreshToken } -> { token }, затем GET /api/save.
 * Внимание: refresh-токен одноразовый (сервер его ротирует), поэтому новый
 * токен возвращаем в localStorage — иначе сломаем сессию самому клиенту.
 */
async function fetchCloudSave(page) {
  return page
    .evaluate(async () => {
      try {
        const rt = localStorage.getItem('league17_refresh_token');
        if (!rt) return { error: 'no refresh token' };
        const r1 = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: rt }),
        });
        if (!r1.ok) return { error: `refresh ${r1.status}` };
        const j1 = await r1.json();
        const accessToken = j1.token || j1.accessToken;
        if (!accessToken) return { error: 'no access token' };
        if (j1.refreshToken) {
          try {
            localStorage.setItem('league17_refresh_token', j1.refreshToken);
          } catch {
            /* приватный режим — не критично */
          }
        }
        const r2 = await fetch('/api/save', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!r2.ok) return { error: `save ${r2.status}` };
        const j2 = await r2.json();
        const save = j2.saveData || {};
        return {
          credit: Number.isFinite(Number(save?.inventory?.credit)) ? Number(save.inventory.credit) : null,
          team: Array.isArray(save?.myTeam) ? save.myTeam.length : null,
          badges: Array.isArray(save?.badges) ? save.badges.length : null,
          locationId: save?.currentLocationId ?? null,
          saveVersion: j2.saveVersion ?? null,
        };
      } catch (e) {
        return { error: String(e).slice(0, 120) };
      }
    })
    .catch((e) => ({ error: String(e).slice(0, 120) }));
}

async function main() {
  const initData = makeInitData(TG_ID);
  const shim = telegramShim(initData);
  const apiCalls = [];
  const consoleErrors = [];
  const pageErrors = [];

  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  const externalCalls = [];
  page.on('response', (r) => {
    const u = r.url();
    if (!u.includes('/api/')) {
      // Внешние домены: ДАННЫЕ покемонов не должны ходить напрямую на
      // pokeapi.co — они идут через наш прокси с кэшами. Ожидаемые исключения:
      // шрифты, заглушка telegram-web-app.js и CDN спрайтов PokeAPI
      // (raw.githubusercontent.com) — картинки пока берутся оттуда.
      if (/^https?:\/\//.test(u) && !u.startsWith(BASE) && !/fonts\.googleapis\.com|fonts\.gstatic\.com|telegram\.org|raw\.githubusercontent\.com/.test(u)) {
        externalCalls.push({ url: u.slice(0, 120), status: r.status() });
      }
      return;
    }
    apiCalls.push({ url: u.replace(BASE, ''), method: r.request().method(), status: r.status(), at: Date.now() });
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: shim })
  );

  try {
    console.log(`\nИгровой прогон: ${BASE} (tg_id=${TG_ID})\n`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // ── G1. Вход и готовность клиента ────────────────────────────────
    const readyDeadline = Date.now() + 120_000;
    let ready = false;
    while (Date.now() < readyDeadline && !ready) {
      ready = await page
        .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
        .catch(() => false);
      if (!ready) await sleep(1000);
    }
    // Новый тренер: регистрация + выбор стартовой карты.
    const regVisible = await page
      .evaluate(() => {
        const o = document.getElementById('register-overlay');
        const b = document.getElementById('btn-register');
        return (!!o && window.getComputedStyle(o).display !== 'none') || (!!b && b.offsetHeight > 0);
      })
      .catch(() => false);
    let registered = false;
    if (regVisible) {
      const nick = `game${String(TG_ID).slice(-4)}`;
      const started = await page
        .evaluate((n) => {
          const input = document.getElementById('reg-nickname') || document.querySelector('#register-overlay input');
          if (!input) return false;
          input.value = n;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const btn = document.getElementById('btn-register');
          if (!btn) return false;
          btn.click();
          return true;
        }, nick)
        .catch(() => false);
      if (started) {
        const regDeadline = Date.now() + 30_000;
        while (Date.now() < regDeadline && !apiCalls.some((c) => c.url.includes('/api/auth/register') && c.status < 300)) {
          await sleep(500);
        }
        registered = apiCalls.some((c) => c.url.includes('/api/auth/register') && c.status < 300);
      }
      await sleep(2500);
    }
    // Стартовая карта (появляется с задержкой после отрисовки мира).
    let starterPicked = false;
    for (let i = 0; i < 30; i++) {
      const open = await page
        .evaluate(() => {
          const m = document.getElementById('starter-modal');
          return !!m && window.getComputedStyle(m).display !== 'none';
        })
        .catch(() => false);
      if (!open) break;
      starterPicked = await page
        .evaluate(() => {
          const opt = document.querySelector('#starter-grid .starter-option');
          if (!opt) return false;
          opt.click();
          return true;
        })
        .catch(() => false);
      await sleep(3000);
    }
    await sleep(2500);
    // Готовность перепроверяем ПОСЛЕ регистрации: до неё клиент не рисует
    // кнопки локаций, и первая проверка честно видит «ещё не готов».
    if (!ready) {
      const readyAfter = Date.now() + 60_000;
      while (Date.now() < readyAfter && !ready) {
        ready = await page
          .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
          .catch(() => false);
        if (!ready) await sleep(1000);
      }
    }
    const saveAfterStart = await fetchCloudSave(page);
    check(
      'G1',
      'клиент вошёл в игру и у тренера есть покемон',
      ready && (saveAfterStart.team || 0) > 0,
      `готовность: ${ready ? 'да' : 'нет'}, регистрация: ${registered ? 'новая' : 'не требовалась'}, ` +
        `стартер: ${starterPicked ? 'выбран' : 'уже был'}, команда: ${saveAfterStart.team ?? saveAfterStart.error}`
    );
    await page.screenshot({ path: path.join(STATE_DIR, 'game-01-start.png') }).catch(() => {});

    const moneyBefore = saveAfterStart.credit;
    const teamBefore = saveAfterStart.team;
    const versionBefore = saveAfterStart.saveVersion;

    // ── G2. Охота: включаем поиск и ждём встречу ────────────────────
    // Хелпер: включить поиск и дождаться встречи (до attempts попыток).
    // Нужен дважды: до проверки спрайтов/броска шара и повторно для боя, если
    // первый бой закончился сам (покемон убежал после броска) — иначе проверка
    // боя зависела бы от случайной длительности первой встречи.
    const huntForEncounter = async (attempts = 4, waitMs = 40_000) => {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const toggled = await page
          .evaluate(() => {
            const b = document.getElementById('btn-hunt-toggle');
            if (!b) return false;
            b.click();
            return true;
          })
          .catch(() => false);
        if (!toggled) return false;
        const huntDeadline = Date.now() + waitMs;
        while (Date.now() < huntDeadline) {
          const open = await page
            .evaluate(() => {
              const m = document.getElementById('encounter-modal');
              return !!m && window.getComputedStyle(m).display !== 'none';
            })
            .catch(() => false);
          if (open) return true;
          await sleep(1000);
        }
        // Кнопка — переключатель: выключаем поиск перед следующей попыткой.
        await page.evaluate(() => document.getElementById('btn-hunt-toggle')?.click()).catch(() => {});
        await sleep(700);
      }
      return false;
    };
    const isEncounterOpen = () =>
      page
        .evaluate(() => {
          const m = document.getElementById('encounter-modal');
          return !!m && window.getComputedStyle(m).display !== 'none';
        })
        .catch(() => false);

    let encounterOpen = await huntForEncounter();
    check('G2', 'поиск покемонов приводит к встрече', encounterOpen, encounterOpen ? 'модалка боя открылась' : 'встречи не было за 4 попытки');
    await page.screenshot({ path: path.join(STATE_DIR, 'game-02-encounter.png') }).catch(() => {});

    // Спрайты боя должны приехать с НАШЕГО домена (/api/sprite/...) и реально
    // отрисоваться: раньше они шли напрямую с raw.githubusercontent.com, который
    // в части регионов недоступен — вместо покемонов были «сломанные картинки».
    let spritesOk = false;
    let spritesDetail = 'бой не открылся';
    if (encounterOpen) {
      const spritesDeadline = Date.now() + 15_000;
      while (Date.now() < spritesDeadline) {
        const info = await page
          .evaluate(() => {
            const read = (id) => {
              const el = document.getElementById(id);
              return { src: el?.getAttribute('src') || '', w: el?.naturalWidth || 0 };
            };
            return { player: read('player-sprite'), wild: read('wild-sprite') };
          })
          .catch(() => null);
        if (info && info.player.src && info.wild.src && info.player.w > 0 && info.wild.w > 0) {
          spritesOk = info.player.src.includes('/api/sprite/') && info.wild.src.includes('/api/sprite/');
          spritesDetail = `player: ${info.player.src.slice(0, 60)} (${info.player.w}px), wild: ${info.wild.src.slice(0, 60)} (${info.wild.w}px)`;
          break;
        }
        spritesDetail = info
          ? `sprites: player=${info.player.src || '—'}(${info.player.w}), wild=${info.wild.src || '—'}(${info.wild.w})`
          : 'не удалось прочитать спрайты';
        await sleep(700);
      }
    }
    check('G2a', 'спрайты боя приходят через наш /api/sprite и отрисованы', spritesOk, spritesDetail);

    // ── G2b. Бросок покебола: расход шара и понятный лог ───────────
    // Ловля — основная механика игры. Дикий покемон может вырваться (это норма),
    // поэтому проверяем не «пойман», а «шар улетел, из инвентаря списался,
    // в логе есть бросок».
    let ballOk = false;
    let ballDetail = 'бой не открылся';
    if (encounterOpen) {
      const before = await page
        .evaluate(() => {
          const sel = document.getElementById('battle-item-select');
          if (!sel) return null;
          const opt = Array.from(sel.options).find((o) => /ball/i.test(o.value || '') || /бол/i.test(o.textContent || ''));
          return opt ? { value: opt.value, label: (opt.textContent || '').trim() } : null;
        })
        .catch(() => null);
      if (!before) {
        ballDetail = 'в бою нет покеболов в списке предметов';
      } else {
        await page
          .evaluate((value) => {
            const sel = document.getElementById('battle-item-select');
            if (!sel) return;
            sel.value = value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            document.getElementById('btn-use-item')?.click();
          }, before.value)
          .catch(() => {});
        await sleep(3500);
        const after = await page
          .evaluate((value) => {
            const sel = document.getElementById('battle-item-select');
            const opt = sel ? Array.from(sel.options).find((o) => o.value === value) : null;
            return {
              log: (document.getElementById('battle-log')?.textContent || '').trim(),
              countText: opt ? (opt.textContent || '').trim() : '',
            };
          }, before.value)
          .catch(() => ({ log: '', countText: '' }));
        const threw = /бросил|броса|брошен|ball/i.test(after.log);
        const countNow = Number(String(after.countText).replace(/[^\d]/g, ''));
        const countBefore = Number(String(before.label).replace(/[^\d]/g, ''));
        // Ловля могла сразу закончить бой — тогда шар просто «ушёл».
        ballOk = threw && (countBefore > 0 ? countNow < countBefore : true);
        ballDetail = `шар: «${before.label}» -> «${after.countText}», бросок в логе: ${threw ? 'да' : 'нет'}`;
      }
    }
    check('G2b', 'покебол бросается и списывается из инвентаря', ballOk, ballDetail);

    // ── G3. Бой: бьём по кнопкам атак, лог должен расти ────────────
    // Бросок шара мог закончить бой (поймали/убежал). Тогда ищем новую встречу,
    // чтобы проверить именно ход боем, а не зависеть от случайного исхода.
    let attacks = 0;
    let battleEnded = false;
    let lastLog = '';
    let g3Encounter = encounterOpen;
    if (!(await isEncounterOpen())) {
      g3Encounter = await huntForEncounter(3, 40_000);
    }
    if (g3Encounter) {
      for (let turn = 0; turn < 30 && !battleEnded; turn++) {
        const state = await page
          .evaluate(() => {
            const modal = document.getElementById('encounter-modal');
            const open = !!modal && window.getComputedStyle(modal).display !== 'none';
            const endMenu = document.getElementById('battle-end-menu');
            const ended = !!endMenu && window.getComputedStyle(endMenu).display !== 'none';
            const log = (document.getElementById('battle-log')?.textContent || '').trim();
            const moves = [0, 1, 2, 3].map((i) => {
              const el = document.getElementById(`move-btn-${i}`);
              return el ? { i, text: (el.textContent || '').trim(), usable: (el.textContent || '').trim().length > 2 && !/^[-—]$/.test((el.textContent || '').trim()) } : null;
            }).filter(Boolean);
            return { open, ended, log, moves };
          })
          .catch(() => ({ open: false, ended: false, log: '', moves: [] }));
        if (!state.open) {
          battleEnded = true;
          break;
        }
        if (state.ended) {
          battleEnded = true;
          break;
        }
        const usable = state.moves.filter((m) => m.usable);
        if (!usable.length) {
          // Нет доступных атак — пробуем сбежать.
          await page.evaluate(() => document.getElementById('btn-run')?.click()).catch(() => {});
          await sleep(1200);
          continue;
        }
        const pick = usable[turn % usable.length];
        await page.evaluate((i) => document.getElementById(`move-btn-${i}`)?.click(), pick.i).catch(() => {});
        attacks++;
        await sleep(1400);
        // Лог читаем ПОСЛЕ удара: до него там прошлый ход и «урона не было».
        lastLog = await page
          .evaluate(() => (document.getElementById('battle-log')?.textContent || '').trim())
          .catch(() => lastLog);
      }
      // Добиваем зависший бой «уйти с поля боя»/«сбежать».
      const endedNow = await page
        .evaluate(() => {
          const endMenu = document.getElementById('battle-end-menu');
          if (endMenu && window.getComputedStyle(endMenu).display !== 'none') return 'end-menu';
          const modal = document.getElementById('encounter-modal');
          if (modal && window.getComputedStyle(modal).display !== 'none') return 'still-open';
          return 'closed';
        })
        .catch(() => 'unknown');
      if (endedNow === 'end-menu') {
        await page.evaluate(() => document.getElementById('btn-leave-battle')?.click()).catch(() => {});
      } else if (endedNow === 'still-open') {
        await page.evaluate(() => document.getElementById('btn-run')?.click()).catch(() => {});
      }
      await sleep(2500);
    }
    const encounterAfter = await page
      .evaluate(() => {
        const m = document.getElementById('encounter-modal');
        return !!m && window.getComputedStyle(m).display !== 'none';
      })
      .catch(() => false);
    // Дикий покемон может убежать после первого же хода («испугался и убежал» —
    // штатная механика), поэтому успех = бой открылся, ход сработал, бой
    // закрылся, в логе есть осмысленный текст. Требовать «минимум 3 атаки»
    // нельзя: это зависело бы от случайной длительности боя.
    check(
      'G3',
      'бой идёт: атака срабатывает, бой корректно завершается',
      g3Encounter && attacks >= 1 && !encounterAfter && String(lastLog).length > 20,
      `атак: ${attacks}, бой ${encounterAfter ? 'не закрылся' : 'закрыт'}, лог: «${String(lastLog).slice(0, 70)}»`
    );
    await page.screenshot({ path: path.join(STATE_DIR, 'game-03-battle.png') }).catch(() => {});

    // ── G4. Прогресс сохранился: сейв ушёл, награда/урон отражены ──
    const savePostDeadline = Date.now() + 45_000;
    while (Date.now() < savePostDeadline && !apiCalls.some((c) => c.url.includes('/api/save') && c.method === 'POST')) {
      await sleep(1000);
    }
    const saveAfterBattle = await fetchCloudSave(page);
    const moneyAfterBattle = saveAfterBattle.credit;
    const teamAfterBattle = saveAfterBattle.team;
    const savePosted = apiCalls.some((c) => c.url.includes('/api/save') && c.method === 'POST' && c.status < 300);
    // Признаки реального прогресса после боя: капнули кредиты, изменилась
    // команда (поймали) или сервер принял новую версию сейва.
    const progressed =
      (moneyAfterBattle !== null && moneyBefore !== null && moneyAfterBattle !== moneyBefore) ||
      (teamAfterBattle !== null && teamBefore !== null && teamAfterBattle !== teamBefore) ||
      (saveAfterBattle.saveVersion !== null && versionBefore !== null && saveAfterBattle.saveVersion > versionBefore);
    check('G4', 'результат боя сохраняется (сейв ушёл + есть прогресс)', savePosted && progressed,
      `POST /api/save: ${savePosted ? 'да' : 'нет'}, деньги: ${moneyBefore} -> ${moneyAfterBattle}, ` +
        `команда: ${teamBefore} -> ${teamAfterBattle}, версия сейва: ${versionBefore} -> ${saveAfterBattle.saveVersion}`);
    await page.screenshot({ path: path.join(STATE_DIR, 'game-04-saved.png') }).catch(() => {});

    // ── G5. Магазин: покупка уменьшает баланс ───────────────────────
    await page.keyboard.press('Escape').catch(() => {});
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
    const shopUi = await page
      .evaluate(() => {
        const btn = Array.from(document.querySelectorAll('#loc-actions button')).find((b) => /Магазин/.test(b.textContent || ''));
        if (!btn) return { opened: false, money: null };
        btn.click();
        return { opened: true, money: null };
      })
      .catch(() => ({ opened: false, money: null }));
    await sleep(1500);
    const shopBefore = await page
      .evaluate(() => {
        const moneyEl = document.getElementById('shop-money-display');
        const rows = Array.from(document.querySelectorAll('#shop-items .shop-item, #shop-items > div'));
        const parseMoney = (t) => {
          const m = String(t || '').replace(/[^\d]/g, '');
          return m ? Number(m) : null;
        };
        return {
          money: parseMoney(moneyEl?.textContent),
          rows: rows.length,
          buyButtons: document.querySelectorAll('.shop-buy-btn').length,
        };
      })
      .catch(() => ({ money: null, rows: 0, buyButtons: 0 }));
    let bought = false;
    if (shopBefore.buyButtons > 0) {
      bought = await page
        .evaluate(() => {
          // Покупаем самый дешёвый товар: читаем цены строк рядом с кнопками.
          const btns = Array.from(document.querySelectorAll('.shop-buy-btn'));
          const priceOf = (btn) => {
            let node = btn;
            for (let depth = 0; depth < 5 && node; depth++) {
              const text = node.textContent || '';
              const m = text.match(/¥\s*([\d ]+)/);
              if (m) return Number(m[1].replace(/[^\d]/g, ''));
              node = node.parentElement;
            }
            return null;
          };
          const priced = btns
            .map((b) => ({ btn: b, price: priceOf(b) }))
            .filter((x) => x.price !== null)
            .sort((a, b) => a.price - b.price);
          const target = priced[0] || { btn: btns[0] };
          target.btn.click();
          return true;
        })
        .catch(() => false);
      await sleep(2500);
    }
    const shopAfter = await page
      .evaluate(() => {
        const moneyEl = document.getElementById('shop-money-display');
        const m = String(moneyEl?.textContent || '').replace(/[^\d]/g, '');
        return { money: m ? Number(m) : null, modalVisible: (() => { const el = document.getElementById('shop-modal'); return !!el && window.getComputedStyle(el).display !== 'none'; })() };
      })
      .catch(() => ({ money: null, modalVisible: false }));
    const moneyDropped =
      shopBefore.money !== null && shopAfter.money !== null ? shopAfter.money < shopBefore.money : false;
    check('G5', 'покупка в магазине проходит и списывает кредиты', bought && moneyDropped,
      `под-локация: ${shopNav || 'нет'}, товаров: ${shopBefore.buyButtons}, деньги: ${shopBefore.money} -> ${shopAfter.money}`);
    await page.screenshot({ path: path.join(STATE_DIR, 'game-05-shop.png') }).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});

    // ── G6. Чат: сообщение отправляется и появляется в ленте ────────
    const marker = `gc-${Date.now().toString(36)}`;
    await page
      .evaluate(() => {
        const nav = document.querySelector('.nav-item[data-target="view-chat"]');
        if (nav) nav.click();
      })
      .catch(() => {});
    await sleep(1500);
    let chatSent = false;
    const chatTyped = await page
      .evaluate((text) => {
        const input = document.getElementById('chat-input');
        const btn = document.getElementById('chat-send-btn');
        if (!input || !btn) return false;
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        btn.click();
        return true;
      }, marker)
      .catch(() => false);
    if (chatTyped) {
      const chatDeadline = Date.now() + 20_000;
      while (Date.now() < chatDeadline && !chatSent) {
        chatSent = await page
          .evaluate((text) => (document.getElementById('chat-messages')?.textContent || '').includes(text), marker)
          .catch(() => false);
        if (!chatSent) await sleep(800);
      }
    }
    check('G6', 'сообщение в общий чат отправляется и появляется в ленте', chatTyped && chatSent, chatTyped ? `маркер ${marker}: ${chatSent ? 'виден' : 'не найден'}` : 'поля чата нет');
    await page.screenshot({ path: path.join(STATE_DIR, 'game-06-chat.png') }).catch(() => {});

    // ── G7. Перезагрузка: прогресс поднимается из облака ───────────
    const moneyBeforeReload = await fetchCloudSave(page).then((s) => s.credit);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120_000 });
    const reloadDeadline = Date.now() + 120_000;
    let reloadedReady = false;
    while (Date.now() < reloadDeadline && !reloadedReady) {
      reloadedReady = await page
        .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
        .catch(() => false);
      if (!reloadedReady) await sleep(1000);
    }
    const regAfterReload = await page
      .evaluate(() => {
        const o = document.getElementById('register-overlay');
        const b = document.getElementById('btn-register');
        return (!!o && window.getComputedStyle(o).display !== 'none') || (!!b && b.offsetHeight > 0);
      })
      .catch(() => false);
    const moneyAfterReload = await fetchCloudSave(page).then((s) => s.credit);
    const saveGetOk = apiCalls.some((c) => c.url.includes('/api/save') && c.method === 'GET' && c.status < 300);
    check(
      'G7',
      'после перезапуска прогресс на месте (облачный сейв)',
      reloadedReady && !regAfterReload && saveGetOk,
      `готовность: ${reloadedReady ? 'да' : 'нет'}, регистрация: ${regAfterReload ? 'появилась (плохо)' : 'нет'}, ` +
        `GET /api/save: ${saveGetOk ? 'ок' : 'нет'}, деньги до/после: ${moneyBeforeReload} -> ${moneyAfterReload}`
    );
    await page.screenshot({ path: path.join(STATE_DIR, 'game-07-reload.png') }).catch(() => {});

    // ── A1..A3. Общие проверки за всю сессию ───────────────────────
    const fiveXX = apiCalls.filter((c) => c.status >= 500);
    check('A1', 'ни один /api-запрос не вернул 5xx', fiveXX.length === 0,
      fiveXX.length ? fiveXX.slice(0, 3).map((c) => `${c.url} -> ${c.status}`).join('; ') : `запросов: ${apiCalls.length}`);
    const notFound = apiCalls.filter((c) => c.status === 404);
    check('A2', 'клиент не стучится в несуществующие /api-маршруты', notFound.length === 0,
      notFound.length ? notFound.slice(0, 3).map((c) => c.url).join('; ') : 'ок');
    const meaningfulErrors = consoleErrors.filter(
      (t) => !/ERR_FAILED|ERR_ABORTED|net::ERR|Failed to load resource|raw\.githubusercontent|Cross-Origin-Opener-Policy/i.test(t)
    );
    check('A3', 'нет JS-ошибок и необработанных исключений', meaningfulErrors.length === 0 && pageErrors.length === 0,
      [...meaningfulErrors, ...pageErrors].slice(0, 3).join(' | ') || 'ок');
    check('A4', 'данные покемонов идут через свой сервер, а не напрямую с pokeapi.co', externalCalls.length === 0,
      externalCalls.length
        ? externalCalls.slice(0, 3).map((c) => `${c.url} -> ${c.status}`).join('; ')
        : 'внешних запросов, кроме шрифтов и CDN спрайтов, нет');
  } finally {
    await browser.close().catch(() => {});
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nИТОГ: ${passed}/${results.length} проверок пройдено`);
  console.log(`Скриншоты: ${STATE_DIR}`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`\nПРОВАЛЕНО: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Игровой прогон упал:', e?.stack || e);
  process.exit(1);
});


