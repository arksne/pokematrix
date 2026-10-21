/**
 * tools/prod-check/lib.mjs — общий слой прод-чеков.
 *
 * Запуск: PROD_BOT_TOKEN=<токен прод-бота> node tools/prod-check/run.mjs
 * Опционально: PROD_BASE=https://pokematrix.onrender.com (по умолчанию).
 *
 * Токен в репо НЕ хранить — только через окружение.
 * Тестовые юзеры стабильны (777900101..105), переиспользуются между
 * прогонами, чтобы не растить таблицу users.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const req = createRequire(path.join(REPO, 'package.json'));

export const BASE = process.env.PROD_BASE || 'https://pokematrix.onrender.com';
export const BOT_TOKEN = process.env.PROD_BOT_TOKEN || '';

export function socketIoClient() {
  return req('socket.io-client').io;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createSuite(title) {
  const results = [];
  const check = (id, name, pass, detail = '') => {
    results.push({ id, name, pass: !!pass, detail });
    console.log(`  [${id}] ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };
  const finish = () => {
    const failed = results.filter((r) => !r.pass);
    console.log('');
    console.log(
      failed.length
        ? `ПРОВАЛЕНО: ${failed.map((f) => f.id).join(', ')}`
        : `${title}: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (${results.length})`,
    );
    return failed.length === 0;
  };
  return { check, finish, results };
}

export async function api(path_, { method = 'GET', token, body } = {}) {
  const res = await fetch(BASE + path_, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let json = null;
  let text = '';
  try {
    text = await res.text();
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, json, text };
}

function signInitData(botToken, user) {
  const params = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  return decodeURIComponent(new URLSearchParams({ ...params, hash }).toString());
}

/** Вход тестового юзера: подпись HMAC настоящим токеном + регистрация. */
export async function login(tgId, username, firstName) {
  if (!BOT_TOKEN) throw new Error('PROD_BOT_TOKEN не задан');
  const initData = signInitData(
    BOT_TOKEN,
    { id: tgId, first_name: firstName || username, last_name: 'ProdCheck', username, language_code: 'ru', is_premium: false },
  );
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) {
    throw new Error(`login failed for ${username}: HTTP ${r.status} ${(r.json?.error || r.text || '').slice(0, 80)}`);
  }
  const token = r.json.token;
  await api('/api/auth/register', { method: 'POST', token, body: { nickname: username } });
  return token;
}

export async function connect(token, label = '') {
  const io = socketIoClient();
  const s = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
  await new Promise((res, rej) => {
    s.on('connect', res);
    s.on('connect_error', rej);
    setTimeout(() => rej(new Error('socket connect timeout')), 15000);
  }).catch((e) => {
    if (label) console.log(`  !! ${label}: ${e.message}`);
  });
  s.emit('join_lobby', {});
  await sleep(400);
  return s;
}

export function onceEvent(sock, ev, ms = 8000) {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    sock.once(ev, (d) => {
      clearTimeout(t);
      res(d);
    });
  });
}

export function testMon(uid, over = {}) {
  return {
    uid,
    baseLevel: 50,
    apiData: { id: 25, name: 'pika', types: [], stats: [], abilities: [], species: { name: 'pikachu' } },
    ivs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    ...over,
  };
}

export function testSave(over = {}) {
  return {
    saveData: {
      _v: Date.now(),
      starterGiven: true,
      currentLocationId: 'pewterCity',
      currentRegion: 'kanto',
      inventory: { credit: 500, pokeBall: 5 },
      money: 500,
      badges: [],
      trainerNickname: 'ProdCheck',
      myTeam: [testMon('pc-mon-1')],
      currentPokemonIndex: 0,
      pokedexSeen: [],
      pokedexCaught: [],
      pcBoxes: [[]],
      daycareMons: [],
      daycareEgg: null,
      breedingPairs: [],
      eggs: [],
      ...over,
    },
    badgesCount: 0,
    pokemonCount: 1,
    money: 500,
    saveVersion: Date.now(),
  };
}

export function asObject(v) {
  return typeof v === 'string' ? JSON.parse(v || '{}') : v || {};
}

/** GET сейва юзера (saveData объектом + saveVersion). */
export async function getSave(token) {
  const r = await api('/api/save', { method: 'GET', token });
  return { saveData: asObject(r.json?.saveData), saveVersion: r.json?.saveVersion ?? 0, status: r.status };
}

/** POST сейва с корректной версией (читает текущую из GET). */
export async function postSave(token, mut) {
  const cur = await getSave(token);
  const sd = mut(structuredClone(cur.saveData));
  return api('/api/save', {
    method: 'POST',
    token,
    body: { saveData: sd, saveVersion: cur.saveVersion },
  });
}
