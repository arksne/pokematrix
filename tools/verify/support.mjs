/**
 * Общие утилиты проверки: HTTP-клиент, логин через Telegram Mini App,
 * подключение к socket.io и сборка результатов.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import { BASE, REPO, BOT_TOKEN, HOST_ALIAS, APP_PORT } from './paths.mjs';
import { signInitData, makeUser } from './tgsign.mjs';

/** require, привязанный к node_modules корня репозитория. */
const req = createRequire(path.join(REPO, 'package.json'));

export function socketIoClient() {
  return req('socket.io-client').io;
}

export function playwright() {
  return req('playwright');
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Создаёт набор проверок с печатью и подсчётом провалов. */
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
        : `${title}: ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ (${results.length})`
    );
    process.exitCode = failed.length ? 1 : 0;
    return failed.length === 0;
  };
  return { check, finish, results };
}

/** HTTP-запрос с разбором JSON и текста. Тело читается ровно один раз. */
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

/** Вход через Telegram Mini App с настоящей HMAC-подписью + регистрация. */
export async function login(tgId, username, firstName) {
  const { initData } = signInitData(BOT_TOKEN, makeUser(tgId, username, firstName || username));
  const r = await api('/api/auth/tg', { method: 'POST', body: { initData } });
  if (r.status !== 200 || !r.json?.token) {
    throw new Error(`login failed for ${username}: HTTP ${r.status} ${(r.json?.error || '').slice(0, 60)}`);
  }
  const token = r.json.token;
  await api('/api/auth/register', { method: 'POST', token, body: { nickname: username } });
  return token;
}

/** Подключение к socket.io с автоматическим входом в лобби. */
export async function connect(token, label = '') {
  const io = socketIoClient();
  const s = io(BASE, { auth: { token }, transports: ['websocket'], reconnection: false });
  await new Promise((res, rej) => {
    s.on('connect', res);
    s.on('connect_error', rej);
    setTimeout(() => rej(new Error('socket connect timeout')), 8000);
  }).catch((e) => {
    if (label) console.log(`  !! ${label}: ${e.message}`);
  });
  // Клиент после подключения вступает в лобби; без этого игрока нет в
  // onlinePlayers и вызовы pvp_challenge / trade_request не находят партнёра.
  s.emit('join_lobby', {});
  await sleep(250);
  return s;
}

/** Ожидание одного события с таймаутом; при таймауте возвращает null. */
export function onceEvent(sock, ev, ms = 4000) {
  return new Promise((res) => {
    const t = setTimeout(() => res(null), ms);
    sock.once(ev, (d) => {
      clearTimeout(t);
      res(d);
    });
  });
}

/** Покемон для тестовых сейвов. */
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

/** Базовый валидный сейв. Версия — Date.now(), как делает настоящий клиент. */
export function testSave(over = {}) {
  return {
    saveData: {
      _v: Date.now(),
      starterGiven: true,
      currentLocationId: 'goldenrodCity',
      currentRegion: 'johto',
      inventory: { credit: 500, pokeBall: 5 },
      money: 500,
      badges: [],
      trainerNickname: 'Verify',
      myTeam: [testMon('verify-mon-1')],
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

/** save_data может прийти как объект, а не как строка. */
export function asObject(v) {
  return typeof v === 'string' ? JSON.parse(v || '{}') : v || {};
}

export { BASE, HOST_ALIAS, APP_PORT };
