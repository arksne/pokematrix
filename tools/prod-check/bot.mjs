#!/usr/bin/env node
/**
 * tools/prod-check/bot.mjs — живой спарринг-бот для ручного теста с игроком.
 *
 *   PROD_BOT_TOKEN=<токен> node tools/prod-check/bot.mjs
 *
 * Бот встаёт онлайн под именем «Бот-Тестер», принимает вызовы и реально
 * дерётся: mon_data → атаки с валидным уроном → hp_update → fainted →
 * pvp_end. Всё пишет в консоль с таймингами. При обрыве — переподключается сам.
 */
import { login, sleep, BASE, api, getSave, testSave, testMon } from './lib.mjs';
import path from 'node:path';
import { createRequire } from 'node:module';
import fs from 'node:fs';

// Зеркалим лог в файл: detached-процесс без консоли иначе немой.
const BOT_LOG = 'C:/Users/ARK/AppData/Local/Temp/opencode/bot.log';
try { fs.writeFileSync(BOT_LOG, ''); } catch {}
const _log = console.log.bind(console);
console.log = (...a) => {
  _log(...a);
  try { fs.appendFileSync(BOT_LOG, a.map(String).join(' ') + '\n'); } catch {}
};

const req = createRequire(path.join(process.cwd(), 'package.json'));
const io = req('socket.io-client').io;

const BOT_ID = 777900201;
const BOT_NAME = 'pc_bot';

const ts = () => new Date().toISOString().slice(11, 23);

let battleId = null;
let myHp = 0;
let sock = null;
const MY_MAX = 120;
const LVL = 50, ATK = 100, POWER = 60;

async function attack() {
  if (!battleId || !sock) return;
  const dmg = 18 + Math.floor(Math.random() * 10); // 18–27, лимит ~235
  console.log(`[${ts()}] [bot] бью на ${dmg}`);
  sock.emit('pvp_action', { battleId, action: { type: 'attack', moveName: 'удар', dmg, crit: false, lvl: LVL, atk: ATK, power: POWER } });
}

function wire(s) {
  s.on('pvp_challenge_received', async (d) => {
    console.log(`[${ts()}] [bot] вызов от ${d?.fromName} (${d?.fromId})${d?.arena ? ' [АРЕНА]' : ''}`);
    if (battleId) {
      console.log(`[${ts()}] [bot] уже в бою — отклоняю`);
      s.emit('pvp_decline', d?.fromId);
      return;
    }
    await sleep(1000);
    console.log(`[${ts()}] [bot] принимаю`);
    s.emit('pvp_accept', d?.arena ? { fromId: d?.fromId, arena: true } : d?.fromId);
  });

  s.on('pvp_start', async (d) => {
    battleId = d?.battleId || null;
    myHp = MY_MAX;
    console.log(`[${ts()}] [bot] БОЙ НАЧАЛСЯ battleId=${String(battleId).slice(-8)} vs ${d?.opponent} first=${d?.first}${d?.arena ? ' [АРЕНА]' : ''}`);
    s.emit('pvp_action', {
      battleId, action: { type: 'mon_data', name: 'Тесто-Пика', lvl: LVL, hp: myHp, maxHp: MY_MAX, sprite: '' },
    });
    await sleep(1500);
    await attack();
  });

  s.on('pvp_opponent_action', async (a) => {
    if (!battleId || !a) return;
    if (a.type === 'mon_data') {
      console.log(`[${ts()}] [bot] у оппонента: ${a.name} Lv${a.lvl} ${a.hp}/${a.maxHp}`);
    } else if (a.type === 'attack') {
      myHp = Math.max(0, myHp - (a.dmg || 0));
      console.log(`[${ts()}] [bot] получил ${a.dmg} (${a.moveName}), моё HP: ${myHp}/${MY_MAX}`);
      const fainted = myHp <= 0;
      s.emit('pvp_action', { battleId, action: { type: 'hp_update', hp: myHp, maxHp: MY_MAX, fainted } });
      if (fainted) {
        console.log(`[${ts()}] [bot] НОКАУТ — сдаю бой`);
        s.emit('pvp_action', { battleId, action: { type: 'fainted' } });
        await sleep(1000);
        s.emit('pvp_end', { battleId, action: { type: 'lose' } });
        battleId = null;
      } else {
        await sleep(1500);
        await attack();
      }
    } else if (a.type === 'hp_update') {
      console.log(`[${ts()}] [bot] HP оппонента: ${a.hp}/${a.maxHp}${a.fainted ? ' НОКАУТ!' : ''}`);
      if (a.fainted) {
        await sleep(1000);
        console.log(`[${ts()}] [bot] оппонент упал — забираю победу`);
        s.emit('pvp_end', { battleId, action: { type: 'win' } });
        battleId = null;
      }
    } else if (a.type === 'fainted') {
      console.log(`[${ts()}] [bot] оппонент подтвердил нокаут — забираю победу`);
      await sleep(1000);
      s.emit('pvp_end', { battleId, action: { type: 'win' } });
      battleId = null;
    } else if (a.type === 'surrender') {
      console.log(`[${ts()}] [bot] оппонент сдался`);
      battleId = null;
    } else if (a.type === 'win' || a.type === 'lose') {
      console.log(`[${ts()}] [bot] конец боя (${a.type})`);
      battleId = null;
    }
  });

  s.on('pvp_action_rejected', (d) => console.log(`[${ts()}] [bot] МОЙ УДАР ОТКЛОНЁН: ${d?.reason}`));
  s.on('pvp_reward', (d) => console.log(`[${ts()}] [bot] НАГРАДА: money=${d?.money} sv=${d?.saveVersion}${d?.arena ? ' АРЕНА' : ''}`));
  s.on('pvp_arena_update', (d) => console.log(`[${ts()}] [bot] арена-апдейт: streak=${d?.streak} cons=${d?.consolation}`));
  s.on('pvp_timeout', (d) => { console.log(`[${ts()}] [bot] таймаут боя won=${d?.won}`); battleId = null; });
  s.on('pvp_opponent_left', (m) => { console.log(`[${ts()}] [bot] оппонент ушёл: ${m}`); battleId = null; });
  s.on('pvp_declined', (d) => console.log(`[${ts()}] [bot] вызов отклонён: ${d?.fromName}`));
  s.on('online_players', (list) => {
    const names = (Array.isArray(list) ? list : [])
      .map((p) => `${p?.username || '?'}(${p?.userId})`)
      .join(', ');
    console.log(`[${ts()}] [bot] онлайн: ${names}`);
  });
}

// Супервизор: вечный цикл с переподключением.
let token = null;
let granted = false;
for (;;) {
  try {
    if (!token) token = await login(BOT_ID, BOT_NAME, 'Бот-Тестер');
    if (!granted) {
      // Настоящая команда, чтобы бой был честным (сейв = то, чем дерёмся).
      const cur = await getSave(token);
      const sd = {
        ...testSave().saveData,
        trainerNickname: 'Бот-Тестер',
        inventory: { credit: 500, pokeBall: 5 },
        myTeam: [
          testMon('bot-mon-1', { currentHp: 120, maxHp: 120 }),
          testMon('bot-mon-2', { currentHp: 90, maxHp: 90 }),
        ],
      };
      const r = await api('/api/save', {
        method: 'POST', token,
        body: { ...testSave(), saveData: sd, saveVersion: cur.saveVersion },
      });
      console.log(`[${ts()}] [bot] команда выдана: HTTP ${r.status}`);
      granted = true;
    }
    const s = await new Promise((resolve) => {
      const cand = io(BASE, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
      });
      cand.on('connect', () => {
        console.log(`[${ts()}] [bot] сокет подключён, онлайн как ${BOT_NAME} (tg ${BOT_ID})`);
        cand.emit('join_lobby', {});
        const pingT = setInterval(() => { try { cand.emit('lobby_ping'); } catch {} }, 30000);
        if (pingT.unref) pingT.unref();
        cand.on('disconnect', () => clearInterval(pingT));
        resolve(cand);
      });
      cand.on('connect_error', (e) => {
        console.log(`[${ts()}] [bot] connect_error: ${e?.message}`);
        resolve(null);
      });
      setTimeout(() => resolve(null), 25000);
    });
    if (!s) throw new Error('connect failed');
    sock = s;
    battleId = null;
    wire(s);
    // Автовызов цели (BOT_TARGET=tg_id): один раз за подключение.
    const target = Number(process.env.BOT_TARGET || 0);
    if (target && !battleId) {
      console.log(`[${ts()}] [bot] вызываю ${target}...`);
      s.emit('pvp_challenge', target);
      const got = await new Promise((res) => {
        const t = setTimeout(() => res(null), 65000);
        s.once('pvp_start', (d) => { clearTimeout(t); res(d); });
        s.once('pvp_declined', () => { clearTimeout(t); res(null); });
        s.once('pvp_challenge_timeout', () => { clearTimeout(t); res(null); });
      });
      console.log(got
        ? `[${ts()}] [bot] вызов принят, бой идёт`
        : `[${ts()}] [bot] вызов не принят — жду входящий (вызови меня из Тренеров)`);
    }
    await new Promise((resolve) => {
      s.on('disconnect', (reason) => {
        console.log(`[${ts()}] [bot] disconnect (${reason}) — переподключаюсь через 5с`);
        sock = null;
        battleId = null;
        try { s.removeAllListeners(); s.close(); } catch {}
        setTimeout(resolve, 5000);
      });
    });
  } catch (e) {
    console.log(`[${ts()}] [bot] ошибка: ${e?.message} — повтор через 10с`);
    token = null;
    await sleep(10000);
  }
}
