/**
 * tools/prod-check/arena.mjs — PvP-Арена против живого прода.
 */
import {
  api, login, connect, onceEvent, sleep, createSuite, testSave, testMon,
  getSave,
} from './lib.mjs';

export async function runArena() {
  const { check, finish } = createSuite('Прод: арена');
  const A_ID = 777900106, B_ID = 777900107, C_ID = 777900105;

  const tA = await login(A_ID, 'pc_arena_a');
  const tB = await login(B_ID, 'pc_arena_b');

  async function grant(token) {
    const cur = await getSave(token);
    const sd = {
      ...testSave().saveData,
      inventory: { credit: 50000, arenaToken: 2, pokeBall: 5 },
      myTeam: [testMon('pc-arena-mon')],
    };
    const r = await api('/api/save', {
      method: 'POST', token,
      body: { ...testSave(), saveData: sd, saveVersion: cur.saveVersion },
    });
    if (r.status !== 200) {
      await api('/api/save', { method: 'POST', token, body: { ...testSave(), saveData: sd } });
    }
  }
  await grant(tA);
  await grant(tB);

  const sA = await connect(tA, 'AA');
  const sB = await connect(tB, 'AB');

  // TA1: вход обоих + лобби видит обоих
  const seen = [];
  sA.on('arena_lobby', (l) => { if (Array.isArray(l)) seen.push(l); });
  const jA = await (async () => { const p = onceEvent(sA, 'arena_joined', 10000); sA.emit('arena_join'); return p; })();
  const jB = await (async () => { const p = onceEvent(sB, 'arena_joined', 10000); sB.emit('arena_join'); return p; })();
  const snapP = onceEvent(sA, 'arena_lobby', 10000);
  sA.emit('arena_lobby_request');
  const lobby = await snapP;
  const snaps = [...seen, ...(Array.isArray(lobby) ? [lobby] : [])];
  const both = (l) => Array.isArray(l) && l.some((e) => e.userId === A_ID) && l.some((e) => e.userId === B_ID);
  check('TA1', 'вход по жетону, лобби видит обоих', !!jA && !!jB && snaps.some(both),
    !jA ? 'A не вошёл' : !jB ? 'B не вошёл' : `снимки: [${snaps.map((l) => l.length).join(',')}]`);

  // TA2: жетон сгорел (было 2 → стало 1)
  {
    const sd = (await getSave(tA)).saveData;
    check('TA2', 'жетон сгорает при входе', sd.inventory?.arenaToken === 1,
      `arenaToken=${sd.inventory?.arenaToken}`);
  }

  // TA3: вход отдаёт saveVersion сервера
  {
    const ver = (await getSave(tA)).saveVersion;
    check('TA3', 'вход отдаёт saveVersion сервера',
      typeof jA?.saveVersion === 'number' && jA.saveVersion === ver,
      `joined.sv=${jA?.saveVersion} vs GET=${ver}`);
  }

  // TA4-TA6: арена-бой до конца
  const beforeA = (await getSave(tA)).saveData.inventory?.credit || 0;
  const beforeB = (await getSave(tB)).saveData.inventory?.credit || 0;
  {
    const ch = onceEvent(sB, 'pvp_challenge_received', 10000);
    sA.emit('pvp_challenge', { userId: B_ID, arena: true });
    const chAr = await ch;
    let protoOk = false;
    let reward = null;
    let upd = null;
    if (chAr?.arena === true) {
      const pA = onceEvent(sA, 'pvp_start', 10000);
      const pB = onceEvent(sB, 'pvp_start', 10000);
      sB.emit('pvp_accept', { fromId: A_ID, arena: true });
      const [eA, eB] = await Promise.all([pA, pB]);
      if (eA?.battleId && eA.battleId === eB?.battleId) {
        const bid = eA.battleId;
        const atkP = onceEvent(sB, 'pvp_opponent_action', 10000);
        sA.emit('pvp_action', { battleId: bid, action: { type: 'attack', moveName: 'tackle', dmg: 8, crit: false, lvl: 5, atk: 60, power: 40 } });
        const atk = await atkP;
        if (atk?.type === 'attack') {
          const hpP = onceEvent(sA, 'pvp_opponent_action', 10000);
          sB.emit('pvp_action', { battleId: bid, action: { type: 'hp_update', hp: 0, maxHp: 50, fainted: true } });
          const hp = await hpP;
          const fP = onceEvent(sA, 'pvp_opponent_action', 10000);
          sB.emit('pvp_action', { battleId: bid, action: { type: 'fainted' } });
          const f = await fP;
          protoOk = hp?.type === 'hp_update' && f?.type === 'fainted';
        }
        const rwP = onceEvent(sA, 'pvp_reward', 10000);
        const upP = onceEvent(sB, 'pvp_arena_update', 10000);
        sB.emit('pvp_end', { battleId: bid, action: { type: 'lose' } });
        [reward, upd] = await Promise.all([rwP, upP]);
      }
    }
    check('TA4', 'арена-бой идёт по тому же протоколу', chAr?.arena === true && protoOk,
      !chAr ? 'вызов не дошёл' : `arena=${chAr?.arena} sync=${protoOk}`);
    // Стрик растёт между прогонами — точную сумму проверяем только на streak 1
    // (115000), иначе структурно: деньги > 0, стрик ≥ 1, предметы есть.
    const exact = reward?.streak === 1 ? reward.money === 115000 : true;
    const structOk = !!reward && reward.arena === true && reward.money > 0
      && (reward.streak || 0) >= 1 && Array.isArray(reward.items) && reward.items.length > 0;
    check('TA5', 'победитель: pvp_reward арены (деньги+стрик+предметы)',
      structOk && exact,
      reward ? `money=${reward.money} streak=${reward.streak} items=${reward.items?.length}` : 'награды нет');
    check('TA6', 'проигравший: pvp_arena_update (стрик 0, утешительные, версия)',
      !!upd && upd.arena === true && upd.streak === 0 && upd.consolation === 10000
      && typeof upd.saveVersion === 'number',
      upd ? `streak=${upd.streak} cons=${upd.consolation} sv=${upd.saveVersion}` : 'апдейта нет');
    var rewardMoney = reward?.money || 0;
  }

  // TA7: кредиты в БД сошлись с событиями
  {
    await sleep(800);
    const dA = ((await getSave(tA)).saveData.inventory?.credit || 0) - beforeA;
    const dB = ((await getSave(tB)).saveData.inventory?.credit || 0) - beforeB;
    check('TA7', 'кредиты в БД: победителю приз, проигравшему +10000',
      dA === rewardMoney && dB === 10000, `ΔA=${dA} (приз ${rewardMoney}), ΔB=${dB}`);
  }

  // TA8: лидеры видят победу
  {
    const lead = await api('/api/arena/leaders', { token: tA });
    const entries = lead.json?.entries || [];
    check('TA8', 'таблица лидеров отдаёт победу',
      lead.status === 200 && entries.some((e) => e.userId === A_ID && (e.wins || 0) >= 1),
      lead.status !== 200 ? `HTTP ${lead.status}` : `записей: ${entries.length}`);
  }

  // TA9: без жетона вход отклоняется
  {
    const tC = await login(C_ID, 'pc_intruder');
    const sC = await connect(tC, 'AC');
    const rejP = onceEvent(sC, 'arena_join_rejected', 10000);
    const okP = onceEvent(sC, 'arena_joined', 3000);
    sC.emit('arena_join');
    const [rej, ok] = await Promise.all([rejP, okP]);
    check('TA9', 'без жетона вход отклоняется (NO_TOKEN)',
      !!rej && ok === null && /NO_TOKEN/.test(rej.reason || ''),
      rej ? `reason=${rej.reason}` : 'отклонения не было');
    sC.close();
  }

  sA.close(); sB.close();
  return finish();
}
