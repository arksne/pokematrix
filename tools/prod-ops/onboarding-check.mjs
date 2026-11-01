/**
 * Онбординг новичка: регистрация → стартер → Профессор Оук → первый квест →
 * поимка первого покемона → награда и следующий шаг обучения.
 *
 * Почему отдельный прогон: остальные проверки смотрят «экран открылся» или
 * «одна атака прошла», а здесь проверяется самый хрупкий путь игры — первые
 * 5 минут нового игрока. Именно тут нашлись два реальных бага:
 *   1. диалог Оука показывал «Вот задание: 1 . Справишься?» (шаблон подстановки
 *      не учитывал квесты без предмета);
 *   2. в стартовом Пьютер-Сити дикие были Lv 10-20 против стартера Lv 5
 *      (локация не попадала ни в одну ветку таблицы уровней) — первый бой
 *      ваншотил, а без поимки обучение и гейт из города не закрываются.
 *
 * Запуск:
 *   $env:PROD_BOT_TOKEN='<token>'; node tools/prod-ops/onboarding-check.mjs
 *
 * Коды проверок: O1..O6.
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
const TG_ID = Number(process.env.PROD_TG_ID || 777900430);
const STATE_DIR = path.join(here, '.state');
const HEADFUL = process.argv.includes('--headful');
/** Сколько встреч максимум тратим на поимку (дикий может убежать/упасть). */
const MAX_CATCH_ATTEMPTS = Number(process.env.ONBOARDING_CATCH_ATTEMPTS || 6);
/** Подробный лог боя (ONBOARDING_DEBUG=1) — когда непонятно, почему не поймали. */
const DEBUG = !!process.env.ONBOARDING_DEBUG;
const dbg = (...args) => {
  if (DEBUG) console.log('    [dbg]', ...args);
};
/** Разумный потолок уровня дикого в стартовом городе (стартер новичка — Lv 5). */
const STARTER_CITY_MAX_WILD_LEVEL = 7;

if (!BOT_TOKEN) {
  console.error('Нужен PROD_BOT_TOKEN (токен бота) — им подписывается initData.');
  process.exit(2);
}
mkdirSync(STATE_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
function check(id, title, ok, detail = '') {
  results.push({ id, title, ok, detail });
  console.log(`  [${id}] ${ok ? 'PASS' : 'FAIL'}  ${title}${detail ? `  — ${detail}` : ''}`);
}

function makeInitData(userId) {
  const params = new URLSearchParams({
    query_id: 'AAH' + crypto.randomBytes(4).toString('hex'),
    user: JSON.stringify({ id: userId, first_name: 'onboarding', username: 'onboarding', language_code: 'ru' }),
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
        const balls = (save?.inventory?.items || save?.items || []).find?.(
          (i) => i && (i.id === 'pokeBall' || i.itemId === 'pokeBall')
        );
        return {
          credit: Number.isFinite(Number(save?.inventory?.credit)) ? Number(save.inventory.credit) : null,
          team: Array.isArray(save?.myTeam) ? save.myTeam.length : null,
          locationId: save?.currentLocationId ?? null,
          pokeBalls: balls ? Number(balls.qty ?? balls.quantity ?? 0) : null,
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
  const pageErrors = [];
  const consoleErrors = [];

  const browser = await chromium.launch({ headless: !HEADFUL });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  await page.route('**/telegram-web-app.js', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: telegramShim(initData) })
  );

  const hint = () =>
    page
      .evaluate(() => (document.body.innerText.match(/Шаг \d+\/\d+:[^\n]*/) || [''])[0].trim())
      .catch(() => '');
  const isEncounterOpen = () =>
    page
      .evaluate(() => {
        const m = document.getElementById('encounter-modal');
        return !!m && window.getComputedStyle(m).display !== 'none';
      })
      .catch(() => false);

  let caught = false;
  let catchDetail = '';
  let wildSample = null;
  let oakDialog = '';
  let hintAfterQuest = '';
  let hintAfterCatch = '';
  let saveBefore = {};
  let saveAfterCatch = {};

  try {
    console.log(`\nОнбординг новичка: ${BASE} (tg_id=${TG_ID})\n`);
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120_000 });

    // ── Регистрация ───────────────────────────────────────────────
    let registered = false;
    for (let i = 0; i < 60 && !registered; i++) {
      const visible = await page
        .evaluate(() => {
          const b = document.getElementById('btn-register');
          return !!b && b.offsetHeight > 0;
        })
        .catch(() => false);
      if (visible) {
        await page
          .evaluate((nick) => {
            const input = document.querySelector('#register-overlay input');
            if (input) {
              input.value = nick;
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            document.getElementById('btn-register')?.click();
          }, `onb${String(TG_ID).slice(-4)}`)
          .catch(() => {});
        registered = true;
        break;
      }
      await sleep(500);
    }
    await sleep(3500);

    // ── Стартовая карта ──────────────────────────────────────────
    let starterPicked = false;
    for (let i = 0; i < 25; i++) {
      const openNow = await page
        .evaluate(() => {
          const m = document.getElementById('starter-modal');
          return !!m && window.getComputedStyle(m).display !== 'none';
        })
        .catch(() => false);
      if (!openNow) break;
      await page.evaluate(() => document.querySelector('#starter-grid .starter-option')?.click()).catch(() => {});
      starterPicked = true;
      await sleep(2000);
    }
    await sleep(2500);

    const ready = await page
      .evaluate(() => document.querySelectorAll('#nav-buttons .btn-nav, #loc-actions button').length > 0)
      .catch(() => false);
    const locName = (
      await page.evaluate(() => (document.getElementById('loc-name')?.textContent || '').trim()).catch(() => '')
    ).trim();
    saveBefore = await fetchCloudSave(page);
    check(
      'O1',
      'новичок зарегистрировался, получил стартера и стартует в Пьютер-Сити',
      registered && starterPicked && ready && /Пьютер|Pewter/i.test(locName),
      `регистрация: ${registered ? 'да' : 'нет'}, стартер: ${starterPicked ? 'выбран' : 'нет'}, город: «${locName}», ` +
        `команда: ${saveBefore.team ?? saveBefore.error}`
    );

    // ── Диалог Профессора Оука ────────────────────────────────────
    const oakOpened = await page
      .evaluate(() => {
        const b = Array.from(document.querySelectorAll('#npc-buttons button')).find((x) =>
          /Профессор/i.test(x.textContent || '')
        );
        if (!b) return false;
        b.click();
        return true;
      })
      .catch(() => false);
    await sleep(1500);
    oakDialog = (
      await page.evaluate(() => (document.getElementById('npc-dialog')?.textContent || '').trim()).catch(() => '')
    ).trim();
    const oakOk =
      oakFound(oakDialog) && !/\{target\}|\{item\}/.test(oakDialog) && !/задание:\s*\d+\s*\./.test(oakDialog);
    check(
      'O2',
      'у Профессора Оука читаемый текст задания (нет «задание: 1 .» и плейсхолдеров)',
      oakOpened && oakOk,
      `диалог: «${oakDialog.slice(0, 110)}»`
    );

    // ── Берём квест ──────────────────────────────────────────────
    const took = await page
      .evaluate(() => {
        const take = Array.from(document.querySelectorAll('#npc-quests button')).find((b) => /Взять/i.test(b.textContent || ''));
        if (!take) return false;
        take.click();
        return true;
      })
      .catch(() => false);
    await sleep(1800);
    await page.evaluate(() => {
      const m = document.getElementById('npc-modal');
      if (m) m.style.display = 'none';
    });
    await sleep(800);
    hintAfterQuest = await hint();
    check(
      'O3',
      'первый квест обучения взят и виден в подсказке',
      took && /Поймайте\s+\d+\/\d+/i.test(hintAfterQuest),
      `подсказка: «${hintAfterQuest}»`
    );

    // ── Охота: уровень дикого должен быть по силам стартеру ───────
    const startHunt = async () => {
      await page
        .evaluate(() => {
          const b = document.getElementById('btn-hunt-toggle');
          if (b && !b.classList.contains('active')) b.click();
        })
        .catch(() => {});
    };
    const waitEncounter = async (ms) => {
      const deadline = Date.now() + ms;
      while (Date.now() < deadline) {
        if (await isEncounterOpen()) return true;
        await sleep(800);
      }
      return false;
    };

    await startHunt();
    // Встреча вероятностная (базовый шанс ~20% за тик), 50 с иногда мало — даём 90 с.
    const hadEncounter = await waitEncounter(90_000);
    if (hadEncounter) {
      await sleep(3500);
      wildSample = await page
        .evaluate(() => ({
          name: (document.getElementById('wild-name')?.textContent || '').trim(),
          lvl: (document.getElementById('wild-lvl')?.textContent || '').trim(),
          hp: (document.getElementById('wild-hp-text')?.textContent || '').trim(),
          playerLvl: (document.getElementById('player-lvl')?.textContent || '').trim(),
        }))
        .catch(() => null);
      const wildLvl = Number(String(wildSample?.lvl || '').replace(/[^\d]/g, ''));
      check(
        'O4',
        `дикий покемон в стартовом городе по силам новичку (Lv ≤ ${STARTER_CITY_MAX_WILD_LEVEL})`,
        Number.isFinite(wildLvl) && wildLvl > 0 && wildLvl <= STARTER_CITY_MAX_WILD_LEVEL,
        `дикий: ${wildSample?.name} ${wildSample?.lvl}, ваш: ${wildSample?.playerLvl || '?'}, HP дикого: ${wildSample?.hp}`
      );
    } else {
      check('O4', 'дикий покемон в стартовом городе по силам новичку', false, 'встречи не было за 50 с');
    }

    // ── Ловля: ОДНА атака для ослабления, дальше только шары ──────
    // Формула поимки в игре: чем меньше HP у дикого, тем выше шанс. Но вторая
    // атака Lv5-стартера по дикому Lv3 часто его добивает — и поймать уже
    // некого. Поэтому ровно одна атака на встречу, остальное — шары (5 штук у
    // новичка). Если дикий убежал/упал — ищем следующую встречу.
    const catchLogRe = /пойман|Попался/i;
    const readBattleLog = () =>
      page
        .evaluate(() => (document.getElementById('battle-log')?.textContent || '').trim())
        .catch(() => '');

    for (let attempt = 0; attempt < MAX_CATCH_ATTEMPTS && !caught; attempt++) {
      dbg('попытка', attempt + 1, 'encounterOpen=', await isEncounterOpen());
      if (!(await isEncounterOpen())) {
        await startHunt();
        if (!(await waitEncounter(50_000))) {
          catchDetail = `попытка ${attempt + 1}: встречи не было`;
          continue;
        }
        await sleep(3200);
      }
      let attackedThisEncounter = false;
      for (let act = 0; act < 12; act++) {
        if (!(await isEncounterOpen())) break;
        if (catchLogRe.test(await readBattleLog())) {
          caught = true;
          break;
        }
        const action = await page
          .evaluate((alreadyAttacked) => {
            const sel = document.getElementById('battle-item-select');
            const ball = sel ? Array.from(sel.options).find((o) => /ball/i.test(o.value || '')) : null;
            if (/пойман|Попался/i.test(document.getElementById('battle-log')?.textContent || '')) return 'caught-in-log';
            if (alreadyAttacked && ball) {
              sel.value = ball.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              document.getElementById('btn-use-item')?.click();
              return 'ball';
            }
            const mv = document.querySelector('#move-btn-0');
            if (mv) {
              mv.click();
              return 'attack';
            }
            if (ball) {
              sel.value = ball.value;
              sel.dispatchEvent(new Event('change', { bubbles: true }));
              document.getElementById('btn-use-item')?.click();
              return 'ball';
            }
            return 'nothing';
          }, attackedThisEncounter)
          .catch(() => 'error');
        if (action === 'caught-in-log') {
          caught = true;
          break;
        }
        if (action === 'attack' && !attackedThisEncounter) attackedThisEncounter = true;
        if (action === 'nothing' || action === 'error') {
          catchDetail = `попытка ${attempt + 1}: нет доступных действий`;
          break;
        }
        await sleep(2400);
        dbg('act=', action, 'encOpen=', await isEncounterOpen(), 'log:', (await readBattleLog()).slice(-90));
        if (catchLogRe.test(await readBattleLog())) {
          caught = true;
          break;
        }
      }
      if (caught) {
        const log = await readBattleLog();
        catchDetail = `пойман: «${log.slice(-90)}»`;
      } else if (!catchDetail) {
        catchDetail = `попытка ${attempt + 1}: дикий убежал/упал`;
      }
      // Закрываем остатки боя (после поимки экран боя сам не закрывается —
      // игрок жмёт «Уйти с поля боя»).
      await page
        .evaluate(() => {
          const endMenu = document.getElementById('battle-end-menu');
          if (endMenu && window.getComputedStyle(endMenu).display !== 'none') {
            document.getElementById('btn-leave-battle')?.click();
            return;
          }
          const leave = Array.from(document.querySelectorAll('#encounter-modal button')).find((b) =>
            /Уйти с поля боя/i.test(b.textContent || '')
          );
          if (leave) leave.click();
          else document.getElementById('btn-run')?.click();
        })
        .catch(() => {});
      await sleep(2500);
    }    saveAfterCatch = await fetchCloudSave(page);
    hintAfterCatch = await hint();
    await page.screenshot({ path: path.join(STATE_DIR, 'onboarding-caught.png') }).catch(() => {});

    const teamGrew = (saveAfterCatch.team ?? 0) > (saveBefore.team ?? 0);
    check(
      'O5',
      'первого дикого покемона можно поймать (шар + ослабление)',
      caught || teamGrew,
      caught ? catchDetail : `не поймали за ${MAX_CATCH_ATTEMPTS} встреч; команда: ${saveBefore.team} → ${saveAfterCatch.team}`
    );

    // ── Возвращаемся к Оуку и сдаём квест (награда выдаётся там) ──
    // После поимки подсказка честно пишет «Квест выполнен! Вернитесь к
    // Профессору Оуку за наградой» — проверяем именно этот путь, а не
    // мгновенное начисление.
    let claimed = false;
    let claimDetail = 'Оук не открылся повторно';
    const oakAgain = await page
      .evaluate(() => {
        const b = Array.from(document.querySelectorAll('#npc-buttons button')).find((x) =>
          /Профессор/i.test(x.textContent || '')
        );
        if (!b) return false;
        b.click();
        return true;
      })
      .catch(() => false);
    if (oakAgain) {
      await sleep(1500);
      const beforeClaim = await fetchCloudSave(page);
      const paid = await page
        .evaluate(() => {
          const btn = Array.from(document.querySelectorAll('#npc-quests button')).find((b) => /Сдать/i.test(b.textContent || ''));
          if (!btn) return false;
          btn.click();
          return true;
        })
        .catch(() => false);
      await sleep(2500);
      saveAfterCatch = await fetchCloudSave(page);
      claimed = Boolean(paid) && Boolean(saveAfterCatch.credit != null && beforeClaim.credit != null && saveAfterCatch.credit >= beforeClaim.credit + 500);
      claimDetail = `кнопка «Сдать»: ${paid ? 'нажата' : 'не найдена'}, кредиты: ${beforeClaim.credit} → ${saveAfterCatch.credit}`;
      await page.evaluate(() => {
        const m = document.getElementById('npc-modal');
        if (m) m.style.display = 'none';
      });
      await sleep(1200);
      hintAfterCatch = await hint();
    }
    check(
      'O6',
      'квест сдаётся у Оука: награда начислена и обучение идёт дальше',
      claimed && !/Поймайте\s+0\/1/.test(hintAfterCatch),
      `${claimDetail}, подсказка: «${hintAfterCatch}»`
    );

    // ── Обучение перешло на следующий шаг ────────────────────────
    const stepAdvanced = /Шаг\s+([2-6])\/6/.exec(hintAfterCatch)?.[1];
    const creditDelta =
      saveBefore.credit != null && saveAfterCatch.credit != null ? saveAfterCatch.credit - saveBefore.credit : null;
    check(
      'O7',
      'после награды обучение идёт дальше (следующий шаг, а не «поймайте 0/1»)',
      Boolean(stepAdvanced) && !/Поймайте\s+0\/1/.test(hintAfterCatch),
      `подсказка: «${hintAfterCatch}», кредиты: ${saveBefore.credit} → ${saveAfterCatch.credit} (Δ ${creditDelta}), ` +
        `команда: ${saveBefore.team} → ${saveAfterCatch.team}`
    );

    const meaningfulErrors = consoleErrors.filter(
      (t) => !/Failed to load resource|net::ERR|Cross-Origin-Opener-Policy|ERR_ABORTED/i.test(t)
    );
    check(
      'O8',
      'нет JS-ошибок за первые минуты игры',
      pageErrors.length === 0 && meaningfulErrors.length === 0,
      [...pageErrors, ...meaningfulErrors].slice(0, 3).join(' | ') || 'ок'
    );
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

/** Диалог Оука должен содержать текст, а не только шаблон. */
function oakFound(text) {
  return /Покематрикс|тренер|задан|Профессор|Оук/i.test(text || '');
}

main().catch((e) => {
  console.error('Проверка онбординга упала:', e?.stack || e);
  process.exit(1);
});
