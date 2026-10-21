/**
 * tools/prod-check/pvp.mjs — бои против живого прода.
 * Импорт: createRequire-мостик к lib (ESM из CJS не нужен — всё .mjs).
 */
import {
  api, login, connect, onceEvent, sleep, createSuite,
  getSave, postSave,
} from './lib.mjs';

export async function runPvp() {
  const { check, finish } = createSuite('Прод: PvP');
  const A_ID = 777900101, B_ID = 777900102, C_ID = 777900105;

  const tA = await login(A_ID, 'pc_pvp_a');
  const tB = await login(B_ID, 'pc_pvp_b');
  const sA = await connect(tA, 'A');
  const sB = await connect(tB, 'B');
  check('PC1', 'оба юзера в сети (сокеты подключены)', sA.connected && sB.connected,
    `A=${sA.connected} B=${sB.connected}`);

  /** Начать бой A→B, вернуть battleId или null. */
  async function startBattle() {
    const ch = onceEvent(sB, 'pvp_challenge_received', 10000);
    sA.emit('pvp_challenge', B_ID);
    if (!(await ch)) return null;
    const pA = onceEvent(sA, 'pvp_start', 10000);
    const pB = onceEvent(sB, 'pvp_start', 10000);
    sB.emit('pvp_accept', A_ID);
    const [eA, eB] = await Promise.all([pA, pB]);
    if (!eA?.battleId || eA.battleId !== eB?.battleId) return null;
    return eA.battleId;
  }
  async function closeBattle(bid) {
    // Идемпотентное закрытие: чужой/повторный pvp_end — no-op без наград.
    sB.emit('pvp_end', { battleId: bid, action: { type: 'lose' } });
    await sleep(600);
  }

  // PC2: вызов доходит с fromId
  {
    const ch = onceEvent(sB, 'pvp_challenge_received', 10000);
    sA.emit('pvp_challenge', B_ID);
    const got = await ch;
    check('PC2', 'вызов доходит до партнёра', !!got && Number(got.fromId) === A_ID,
      got ? `fromId=${got.fromId}` : 'вызов не пришёл');
    // Принимаем, чтобы не висел протухший вызов, и тут же закрываем.
    const pA = onceEvent(sA, 'pvp_start', 10000);
    const pB = onceEvent(sB, 'pvp_start', 10000);
    sB.emit('pvp_accept', A_ID);
    const [eA, eB] = await Promise.all([pA, pB]);
    if (eA?.battleId) await closeBattle(eA.battleId);
  }

  // PC3: бой с самим собой
  {
    sA.emit('pvp_accept', A_ID);
    const started = await onceEvent(sA, 'pvp_start', 3000);
    check('PC3', 'бой с самим собой не создаётся', started === null,
      started ? 'БОЙ СОЗДАН!' : 'pvp_start не пришёл');
  }

  // PC4: accept → общий battleId
  let bid = await startBattle();
  check('PC4', 'accept даёт общий battleId', !!bid, bid ? `battleId=${String(bid).slice(-12)}` : 'бой не начался');
  if (!bid) {
    console.log('  !! нет боя — дальнейшие PvP-проверки пропускаются');
    sA.close(); sB.close();
    return finish();
  }

  // PC17: второй вызов при открытом бое отклоняется (IN_BATTLE)
  {
    const rejP = onceEvent(sA, 'pvp_challenge_rejected', 10000);
    const noStart = onceEvent(sB, 'pvp_start', 3000);
    sA.emit('pvp_challenge', B_ID);
    const [rej, ns] = await Promise.all([rejP, noStart]);
    check('PC17', 'второй вызов при открытом бое отклоняется',
      !!rej && rej.reason === 'IN_BATTLE' && ns === null,
      rej ? `reason=${rej.reason}, второй старт: ${ns ? 'ЕСТЬ!' : 'нет'}` : 'отклонения не было');
  }

  // PC18: обрыв+переподключение — ходы с нового сокета принимаются
  {
    const sA2 = await connect(tA, 'A2');
    const atkP = onceEvent(sB, 'pvp_opponent_action', 10000);
    sA2.emit('pvp_action', { battleId: bid, action: { type: 'attack', moveName: 'tackle', dmg: 8, crit: false, lvl: 5, atk: 60, power: 40 } });
    const atk = await atkP;
    check('PC18', 'ходы с переподключённого сокета принимаются (reattach)',
      !!atk && atk.type === 'attack' && atk.dmg === 8,
      atk ? `dmg=${atk.dmg}` : 'релея нет — ходы с нового сокета отброшены');
    sA2.close();
    await sleep(500);
  }

  // PC5: mon_data релеится
  {
    const got = onceEvent(sB, 'pvp_opponent_action', 10000);
    sA.emit('pvp_action', { battleId: bid, action: { type: 'mon_data', name: 'Pikachu', lvl: 5, hp: 50, maxHp: 50 } });
    const m = await got;
    check('PC5', 'mon_data оппонента релеится', !!m && m.type === 'mon_data' && m.name === 'Pikachu',
      m ? `name=${m.name}` : 'не доставлено');
  }

  // PC6: валидная атака релеится с точным уроном
  {
    const got = onceEvent(sB, 'pvp_opponent_action', 10000);
    sA.emit('pvp_action', { battleId: bid, action: { type: 'attack', moveName: 'tackle', dmg: 8, crit: false, lvl: 5, atk: 60, power: 40 } });
    const m = await got;
    check('PC6', 'атака релеится с точным уроном', !!m && m.type === 'attack' && m.dmg === 8 && m.moveName === 'tackle',
      m ? `dmg=${m.dmg}` : 'не доставлено');
  }

  // PC7: читерский урон отбивается, до оппонента не доходит
  {
    const rej = onceEvent(sA, 'pvp_action_rejected', 10000);
    const leak = onceEvent(sB, 'pvp_opponent_action', 3000);
    sA.emit('pvp_action', { battleId: bid, action: { type: 'attack', moveName: 'tackle', dmg: 99999, crit: false, lvl: 5, atk: 60, power: 40 } });
    const [r, l] = await Promise.all([rej, leak]);
    check('PC7', 'читерский урон отклоняется и не релеится', !!r && l === null,
      r ? `reason=${r.reason}, утечки нет` : 'отклонения не было');
  }

  // PC8: hp_update + fainted видны атакующему
  {
    const hpP = onceEvent(sA, 'pvp_opponent_action', 10000);
    sB.emit('pvp_action', { battleId: bid, action: { type: 'hp_update', hp: 0, maxHp: 50, fainted: true } });
    const hp = await hpP;
    const fP = onceEvent(sA, 'pvp_opponent_action', 10000);
    sB.emit('pvp_action', { battleId: bid, action: { type: 'fainted' } });
    const f = await fP;
    check('PC8', 'нокаут синхронизируется (hp_update + fainted)',
      !!hp && hp.type === 'hp_update' && hp.fainted === true && !!f && f.type === 'fainted',
      hp && f ? 'оба события дошли' : 'синхронизации нет');
  }

  // PC9: поражение B → награда A (+500, saveVersion)
  const beforeA = await getSave(tA);
  const beforeB = await getSave(tB);
  {
    const rw = onceEvent(sA, 'pvp_reward', 10000);
    sB.emit('pvp_end', { battleId: bid, action: { type: 'lose' } });
    const r = await rw;
    check('PC9', 'победитель получает +500 и свежую saveVersion',
      !!r && r.money === 500 && typeof r.saveVersion === 'number',
      r ? `money=${r.money} sv=${r.saveVersion}` : 'награды нет');
    var rewardSv = r?.saveVersion;
  }

  // PC10: кредит победителя в БД +500, у проигравшего без изменений
  {
    await sleep(800);
    const afterA = await getSave(tA);
    const afterB = await getSave(tB);
    const dA = (afterA.saveData.inventory?.credit || 0) - (beforeA.saveData.inventory?.credit || 0);
    const dB = (afterB.saveData.inventory?.credit || 0) - (beforeB.saveData.inventory?.credit || 0);
    check('PC10', 'кредит в БД: +500 победителю, 0 проигравшему', dA === 500 && dB === 0,
      `ΔA=${dA} ΔB=${dB}`);
  }

  // PC11: повторные pvp_end не платят дважды
  {
    const rewards = [];
    sA.removeAllListeners('pvp_reward');
    sA.on('pvp_reward', (r) => rewards.push(r));
    for (let i = 0; i < 5; i++) {
      sA.emit('pvp_end', { battleId: bid, action: { type: 'win' } });
      sB.emit('pvp_end', { battleId: bid, action: { type: 'lose' } });
    }
    await sleep(2500);
    const afterA = await getSave(tA);
    const dA = (afterA.saveData.inventory?.credit || 0) - (beforeA.saveData.inventory?.credit || 0);
    check('PC11', 'повторные pvp_end не начисляют награду дважды',
      rewards.length === 0 && dA === 500,
      `наград: ${rewards.length}, Δкредита: ${dA} (было 500)`);
  }

  // PC12: saveVersion из награды == версии в БД
  {
    const cur = await getSave(tA);
    check('PC12', 'версия из награды совпадает с серверной',
      cur.saveVersion === rewardSv, `награда sv=${rewardSv}, БД sv=${cur.saveVersion}`);
  }

  // PC13: surrender — награда оппоненту, сдающемуся ничего
  {
    const b2 = await startBattle();
    if (!b2) {
      check('PC13', 'surrender отдаёт победу оппоненту', false, 'бой не начался');
    } else {
      const rwB = onceEvent(sB, 'pvp_reward', 10000);
      const rwA = onceEvent(sA, 'pvp_reward', 3000);
      sA.emit('pvp_end', { battleId: b2, action: { type: 'surrender' } });
      const [rB, rA] = await Promise.all([rwB, rwA]);
      check('PC13', 'surrender отдаёт победу оппоненту',
        !!rB && rB.money === 500 && rA === null,
        rB ? `B получил ${rB.money}, A: ${rA ? 'ТОЖЕ ПОЛУЧИЛ!' : 'ничего'}` : 'награды нет вообще');
    }
  }

  // PC14: протухший POST после сеттла → 409 с serverVersion
  {
    await postSave(tA, (sd) => sd); // догнать версию (бамп)
    const cur = await getSave(tA);
    const stale = await api('/api/save', {
      method: 'POST', token: tA,
      body: { saveData: cur.saveData, saveVersion: cur.saveVersion - 1 },
    });
    check('PC14', 'протухший сейв отклоняется 409 с версией сервера',
      stale.status === 409 && typeof stale.json?.serverVersion === 'number',
      `HTTP ${stale.status} sv=${stale.json?.serverVersion}`);
  }

  // PC15: посторонний сокет не сеттлит чужой бой
  {
    const tC = await login(C_ID, 'pc_intruder');
    const sC = await connect(tC, 'C');
    const b3 = await startBattle();
    if (!b3) {
      check('PC15', 'посторонний не получает награду за чужой бой', false, 'бой не начался');
    } else {
      const rw = onceEvent(sC, 'pvp_reward', 3000);
      sC.emit('pvp_end', { battleId: b3, action: { type: 'win' } });
      const r = await rw;
      const fin = onceEvent(sA, 'pvp_reward', 10000);
      sB.emit('pvp_end', { battleId: b3, action: { type: 'lose' } });
      await fin;
      check('PC15', 'посторонний не получает награду за чужой бой', r === null,
        r ? 'НАГРАДА ВЫДАНА ПОСТОРОННЕМУ!' : 'награды нет');
    }
    sC.close();
  }

  // PC16: decline — вызов отклоняется без боя
  {
    const dec = onceEvent(sA, 'pvp_declined', 10000);
    const ch = onceEvent(sB, 'pvp_challenge_received', 10000);
    sA.emit('pvp_challenge', B_ID);
    if (await ch) sB.emit('pvp_decline', A_ID);
    const d = await dec;
    const started = await onceEvent(sB, 'pvp_start', 2500);
    check('PC16', 'decline отклоняет вызов без создания боя', !!d && started === null,
      d ? 'отклонение дошло, боя нет' : 'отклонения не было');
  }

  sA.close(); sB.close();
  return finish();
}
