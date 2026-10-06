/**
 * ВРЕМЕННАЯ проба гонки restore-vs-autohunt (удалить после проверки).
 * Сценарий: бой идёт + hunt_active=1 + F5 с медленным PokeAPI.
 * До фикса: тик охоты (2-5с) вызывал startHunt РАНЬШЕ конца restore
 * (дикий+вид+мувы, секунды) — battle_state перезаписывался новым энкаунтером.
 * После фикса: restore await-ится, охота стартует после, модал flex — тики скип.
 * Критерий: wildPkmName в battle_state после перезагрузки ТОТ ЖЕ + лог
 * «Битва восстановлена!».
 */
import { chromium } from 'playwright';
import { signInitData, webAppShim, makeUser } from './tgsign.mjs';
import { BOT_TOKEN, APP_URL, HOST_ALIAS } from './paths.mjs';
import { api } from './support.mjs';

let failed = 0;
const t = (id, name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`[${id}] ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' - ' + detail : ''}`);
};

const TG_ID = 779000000 + Math.floor(Math.random() * 900000);
const { initData: regInit } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'race_probe', 'race_probe'));
const reg = await api('/api/auth/tg', { method: 'POST', body: { initData: regInit } });
let regOk = reg.status === 200 && !!reg.json?.token;
let regDetail = `HTTP ${reg.status}`;
if (regOk) {
  const reg2 = await api('/api/auth/register', {
    method: 'POST', token: reg.json.token, body: { nickname: 'race_probe' },
  });
  regOk = reg2.status === 200;
  regDetail = `HTTP ${reg2.status}`;
}
t('R0', 'register', regOk, regDetail);
if (failed) process.exit(1);

const browser = await chromium.launch({
  args: [`--host-resolver-rules=MAP ${HOST_ALIAS} 127.0.0.1`, '--no-sandbox'],
});
const ctx = await browser.newContext();
const page = await ctx.newPage();
const consoleMsgs = [];
page.on('console', (m) => { consoleMsgs.push(`[${m.type()}] ${m.text().slice(0, 220)}`); });
page.on('pageerror', (e) => consoleMsgs.push('[pageerror] ' + String(e && e.message || e).slice(0, 220)));

const { initData } = signInitData(BOT_TOKEN, makeUser(TG_ID, 'race_probe', 'Race'));
await page.route('**/telegram-web-app.js*', (route) =>
  route.fulfill({ status: 200, contentType: 'application/javascript', body: webAppShim(initData) }));

// PokeAPI: детерминированный пикачу, но МЕДЛЕННЫЙ (1.2с/ответ) — как реальная сеть.
// restore тянет wild + species (+мувы из сейва берутся, без фетча).
const PIKA = {
  id: 25, name: 'pikachu',
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
await page.route('**/api/pokeapi/**', async (route) => {
  await new Promise((r) => setTimeout(r, 1200));
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
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: 1, name: `move-${id}`, power: 1,
      type: { name: 'electric', url: '' }, damage_class: { name: 'special', url: '' },
      accuracy: 100, pp: 30, priority: 0, target: { name: 'selected-pokemon', url: '' },
      effect_entries: [], effect_chance: null,
      meta: { ailment: { name: 'none' }, healing: 0, crit_rate: 0, min_hits: 1, max_hits: 1 },
      stat_changes: [], learned_by_pokemon: [],
    }) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PIKA) });
});

// Детерминированный рандом: охота находит с первого тика (как в battle-flow).
// Рестор при этом всё равно идёт по сети (мок с задержкой) — окно гонки живо.
await page.addInitScript(() => { Math.random = () => 0; });
await page.goto(`${APP_URL}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(15000);
const starter = page.locator('#starter-modal');
if (await starter.isVisible().catch(() => false)) {
  await page.locator('.starter-option').first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(8000);
}

// Включаем автоохоту и ждём боя.
const huntBtn = page.locator('#btn-hunt-toggle');
const hunting = await page.evaluate(() =>
  !!document.getElementById('btn-hunt-toggle')?.classList.contains('active'));
if (!hunting) await huntBtn.click({ timeout: 8000 }).catch(() => {});

async function battleWild() {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.includes('battle_state'));
    if (!key) return null;
    try { return JSON.parse(localStorage.getItem(key)).wildPkmName || null; }
    catch { return null; }
  });
}
let wildBefore = null;
for (let i = 0; i < 60 && !wildBefore; i++) {
  await page.waitForTimeout(2000);
  wildBefore = await battleWild();
}
t('R1', 'battle started before reload', !!wildBefore, `wild=${wildBefore}`);
if (!wildBefore) { await browser.close(); process.exit(1); }

// Атакуем разок, чтобы battle_state точно был свежим, и читаем имя.
const moves = page.locator('.reborn-move-link');
if (await moves.count() > 0) {
  await moves.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(4000);
  wildBefore = (await battleWild()) || wildBefore;
}

// F5 с включённой охотой и медленным API.
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(12000);

const wildAfter = await battleWild();
const log = (await page.evaluate(() => document.getElementById('battle-log')?.textContent || '')).slice(-200);
const modalFlex = await page.evaluate(() => {
  const m = document.getElementById('encounter-modal');
  return m ? getComputedStyle(m).display : '(no modal)';
});
t('R2', 'same wild after reload (no clobber)', wildAfter === wildBefore, `before=${wildBefore} after=${wildAfter}`);
t('R3', 'restored battle shown', modalFlex !== 'none' && /восстановлена/i.test(log), `modal=${modalFlex} log tail: ${log.slice(-80)}`);
// Дамп облака: что реально лежит на сервере (команда? боксы? starterGiven?)
try {
  const ls = await page.evaluate(() => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.includes('save') || k.includes('battle') || k.includes('refresh') || k.includes('hunt'))) {
        out[k] = (localStorage.getItem(k) || '').slice(0, 120);
      }
    }
    return out;
  });
  console.log('[DBG] localStorage: ' + JSON.stringify(ls));
  try {
    const cloud = await page.evaluate(async () => {
      const rtKey = Object.keys(localStorage).find((k) => k.includes('refresh'));
      if (!rtKey) return 'no-refresh-token';
      const r = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: localStorage.getItem(rtKey) }),
      });
      if (!r.ok) return 'refresh-http-' + r.status;
      const { token } = await r.json();
      const s = await fetch('/api/save', { headers: { Authorization: 'Bearer ' + token } });
      if (!s.ok) return 'save-http-' + s.status;
      const j = await s.json();
      const sd = j.saveData || {};
      const m0 = (sd.myTeam || [])[0] || {};
      return JSON.stringify({
        team: (sd.myTeam || []).length,
        pc: (sd.pcBoxes || []).reduce((n, b) => n + (b || []).length, 0),
        starterGiven: !!sd.starterGiven,
        v: sd._v,
        m0uid: m0.uid,
        m0uidType: typeof m0.uid,
        m0keys: Object.keys(m0),
        m0api: !!m0.apiData,
        m0moves: Array.isArray(m0.apiData?.moves) ? m0.apiData.moves.length : -1,
      });
    });
    console.log('[DBG] cloud: ' + cloud);
  } catch (e) { console.log('[DBG] cloud dump failed: ' + String(e).slice(0, 120)); }
} catch (e) { console.log('[DBG] ls dump failed'); }
console.log('[DBG] console tail:');
for (const l of consoleMsgs.slice(-25)) console.log('[DBG] ' + l);

await browser.close();
process.exit(failed ? 1 : 0);
