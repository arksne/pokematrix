/**
 * tools/prod-check/trade.mjs — обмен против живого прода.
 */
import {
  api, login, connect, onceEvent, sleep, createSuite, testSave, testMon,
  getSave,
} from './lib.mjs';

export async function runTrade() {
  const { check, finish } = createSuite('Прод: трейд');
  const A_ID = 777900103, B_ID = 777900104, C_ID = 777900105;

  const tA = await login(A_ID, 'pc_trade_a');
  const tB = await login(B_ID, 'pc_trade_b');

  /** Полная перезапись сейва (крафт предметов/монов для сценария). */
  async function setupSave(token, build) {
    const cur = await getSave(token);
    const base = testSave().saveData;
    const sd = { ...base, ...build(base) };
    const r = await api('/api/save', {
      method: 'POST', token,
      body: { ...testSave(), saveData: sd, saveVersion: cur.saveVersion },
    });
    if (r.status !== 200) {
      // Свежий юзер с версией 0: шлём как первый клиентский сейв.
      const r2 = await api('/api/save', { method: 'POST', token, body: testSave({ ...build(testSave().saveData) }) });
      return r2.status;
    }
    return r.status;
  }

  await setupSave(tA, () => ({
    inventory: { credit: 500, pokeBall: 10 },
    myTeam: [testMon('ta-mon-1')],
  }));
  await setupSave(tB, () => ({
    inventory: { credit: 500, pokeBall: 4 },
    myTeam: [testMon('tb-mon-1')],
  }));

  const s1 = await connect(tA, 'T1');
  const s2 = await connect(tB, 'T2');
  check('TC1', 'оба трейдера в сети', s1.connected && s2.connected,
    `s1=${s1.connected} s2=${s2.connected}`);

  // TC2: запрос доходит
  {
    const got = onceEvent(s2, 'trade_request_received', 10000);
    s1.emit('trade_request', B_ID);
    const r = await got;
    check('TC2', 'запрос обмена доходит до партнёра', !!r,
      r ? `от ${r.fromUsername || r.fromId}` : 'запрос не пришёл');
  }

  // TC3: accept → trade_started у обоих
  let tradeId = null;
  {
    const p1 = onceEvent(s1, 'trade_started', 10000);
    const p2 = onceEvent(s2, 'trade_started', 10000);
    s2.emit('trade_accept', A_ID);
    const [e1, e2] = await Promise.all([p1, p2]);
    tradeId = e1?.tradeId || e2?.tradeId || null;
    check('TC3', 'сессия создаётся (trade_started у обоих)', !!tradeId,
      tradeId ? `tradeId=${String(tradeId).slice(-12)}` : 'trade_started не пришёл');
    if (!tradeId) { s1.close(); s2.close(); return finish(); }
  }

  const expectReject = async (id, name, offers) => {
    const p = onceEvent(s1, 'trade_offer_rejected', 8000);
    s1.emit('trade_offer', { tradeId, offers });
    const rej = await p;
    check(id, name, rej !== null, rej ? String(rej.reason || rej).slice(0, 80) : 'отклонения не было');
  };

  // TC4-TC7: отклонения
  await expectReject('TC4', 'предмет, которого нет, отклоняется',
    [{ type: 'item', data: { id: 'masterBall', qty: 1 } }]);
  await expectReject('TC5', 'неизвестный id предмета отклоняется',
    [{ type: 'item', data: { id: 'hackedItem', qty: 1 } }]);
  await expectReject('TC6', 'отрицательное qty отклоняется',
    [{ type: 'item', data: { id: 'pokeBall', qty: -5 } }]);
  await expectReject('TC7', 'чужой покемон (uid партнёра) отклоняется',
    [{ type: 'pokemon', data: { uid: 'tb-mon-1' } }]);

  // TC8: посторонний сокет не пишет офферы
  {
    const tC = await login(C_ID, 'pc_intruder');
    const s3 = await connect(tC, 'T3');
    const injected = onceEvent(s2, 'trade_partner_offers', 3000);
    s3.emit('trade_offer', { tradeId, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 1 } }] });
    const got = await injected;
    check('TC8', 'посторонний сокет не может записать офферы', got === null,
      got ? 'ОФФЕРЫ ПРИНЯТЫ ОТ ПОСТОРОННЕГО!' : 'инъекция не прошла');
    s3.close();
  }

  // TC9: валидный обмен предметами + форма {type,data} у обоих
  const preA = await getSave(tA);
  const preB = await getSave(tB);
  {
    const relP = onceEvent(s2, 'trade_partner_offers', 10000);
    s1.emit('trade_offer', { tradeId, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 2 } }] });
    const rel = await relP;
    check('TC9', 'валидный оффер доходит до партнёра', rel !== null,
      rel ? `элементов: ${rel.length}` : 'оффер не доставлен');

    const rel2P = onceEvent(s1, 'trade_partner_offers', 10000);
    s2.emit('trade_offer', { tradeId, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 1 } }] });
    await rel2P;

    const execA = onceEvent(s1, 'trade_execute', 10000);
    const execB = onceEvent(s2, 'trade_execute', 10000);
    s1.emit('trade_confirm', tradeId);
    await sleep(400);
    s2.emit('trade_confirm', tradeId);
    const [gotA, gotB] = await Promise.all([execA, execB]);
    const shapeOk = [gotA, gotB].every((arr) => Array.isArray(arr)
      && arr.every((o) => o && typeof o.type === 'string' && o.data && typeof o.data === 'object'));
    check('TC10', 'trade_execute несёт полные данные {type, data} обоим', shapeOk,
      !gotA || !gotB ? 'trade_execute не пришёл' : `офферов: ${(gotA.length + gotB.length)}`);
  }

  // TC11: балансы реально поменялись (A: 10-2+1=9, B: 4-1+2=5)
  {
    await sleep(800);
    const sdA = (await getSave(tA)).saveData;
    const sdB = (await getSave(tB)).saveData;
    const aBalls = sdA.inventory?.pokeBall || 0;
    const bBalls = sdB.inventory?.pokeBall || 0;
    check('TC11', 'предметы реально переходят (9 у A, 5 у B)', aBalls === 9 && bBalls === 5,
      `A pokeBall=${aBalls}, B pokeBall=${bBalls}`);
  }

  // TC12: версии обоих выросли после execute
  {
    const curA = await getSave(tA);
    const curB = await getSave(tB);
    check('TC12', 'saveVersion обоих вырос после обмена',
      curA.saveVersion > preA.saveVersion && curB.saveVersion > preB.saveVersion,
      `A ${preA.saveVersion}→${curA.saveVersion}, B ${preB.saveVersion}→${curB.saveVersion}`);
  }

  // TC13: обмен покемоном — uid перевыпускается, originalTrainer = прошлый владелец
  {
    const req = onceEvent(s2, 'trade_request_received', 10000);
    s1.emit('trade_request', B_ID);
    await req;
    const p1 = onceEvent(s1, 'trade_started', 10000);
    const p2 = onceEvent(s2, 'trade_started', 10000);
    s2.emit('trade_accept', A_ID);
    const [e1, e2] = await Promise.all([p1, p2]);
    const tid = e1?.tradeId || e2?.tradeId;
    if (!tid) {
      check('TC13', 'обмен покемоном: uid перевыпускается', false, 'сессия не открылась');
    } else {
      const r1 = onceEvent(s2, 'trade_partner_offers', 10000);
      s1.emit('trade_offer', { tradeId: tid, offers: [{ type: 'pokemon', data: { uid: 'ta-mon-1' } }] });
      await r1;
      const r2 = onceEvent(s1, 'trade_partner_offers', 10000);
      s2.emit('trade_offer', { tradeId: tid, offers: [{ type: 'pokemon', data: { uid: 'tb-mon-1' } }] });
      await r2;
      const exA = onceEvent(s1, 'trade_execute', 10000);
      const exB = onceEvent(s2, 'trade_execute', 10000);
      s1.emit('trade_confirm', tid);
      await sleep(400);
      s2.emit('trade_confirm', tid);
      await Promise.all([exA, exB]);
      await sleep(800);
      const sdA = (await getSave(tA)).saveData;
      const sdB = (await getSave(tB)).saveData;
      const aUids = (sdA.myTeam || []).map((m) => m.uid);
      const bUids = (sdB.myTeam || []).map((m) => m.uid);
      const aGot = (sdA.myTeam || []).find((m) => m.originalTrainer === B_ID);
      const bGot = (sdB.myTeam || []).find((m) => m.originalTrainer === A_ID);
      check('TC13', 'обмен покемоном: uid перевыпускается, тренер проставлен',
        !aUids.includes('ta-mon-1') && !bUids.includes('tb-mon-1') && !!aGot && !!bGot
        && !String(aGot.uid).includes('tb-mon-1') && !String(bGot.uid).includes('ta-mon-1'),
        `A: [${aUids.join(',')}], B: [${bUids.join(',')}]`);
    }
  }

  // TC14: TOCTOU — мона убрали до подтверждения → отмена, балансы целы
  {
    await setupSave(tA, () => ({ myTeam: [testMon('ta-mon-toctou')] }));
    const req = onceEvent(s2, 'trade_request_received', 10000);
    s1.emit('trade_request', B_ID);
    await req;
    const p1 = onceEvent(s1, 'trade_started', 10000);
    const p2 = onceEvent(s2, 'trade_started', 10000);
    s2.emit('trade_accept', A_ID);
    const [e1, e2] = await Promise.all([p1, p2]);
    const tid = e1?.tradeId || e2?.tradeId;
    if (!tid) {
      check('TC14', 'TOCTOU: обмен пропавшим моном отменяется', false, 'сессия не открылась');
    } else {
      const before = (await getSave(tB)).saveData.inventory?.pokeBall || 0;
      s1.emit('trade_offer', { tradeId: tid, offers: [{ type: 'pokemon', data: { uid: 'ta-mon-toctou' } }] });
      await onceEvent(s2, 'trade_partner_offers', 10000);
      s2.emit('trade_offer', { tradeId: tid, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 1 } }] });
      await onceEvent(s1, 'trade_partner_offers', 10000);
      // Мон испаряется до подтверждения (второй клиент / другой девайс).
      await setupSave(tA, () => ({ myTeam: [testMon('ta-mon-fresh')] }));
      const cA = onceEvent(s1, 'trade_cancelled', 10000);
      const cB = onceEvent(s2, 'trade_cancelled', 10000);
      s1.emit('trade_confirm', tid);
      await sleep(400);
      s2.emit('trade_confirm', tid);
      const [ccA, ccB] = await Promise.all([cA, cB]);
      await sleep(800);
      const after = (await getSave(tB)).saveData.inventory?.pokeBall || 0;
      check('TC14', 'TOCTOU: обмен пропавшим моном отменяется, балансы целы',
        !!ccA && !!ccB && after === before,
        ccA || ccB ? `отмена: ${(ccA || ccB)} balls ${before}→${after}` : 'отмены не было');
    }
  }

  // TC15: отмена обмена — вещи на месте
  {
    const req = onceEvent(s2, 'trade_request_received', 10000);
    s1.emit('trade_request', B_ID);
    await req;
    const p1 = onceEvent(s1, 'trade_started', 10000);
    const p2 = onceEvent(s2, 'trade_started', 10000);
    s2.emit('trade_accept', A_ID);
    const [e1, e2] = await Promise.all([p1, p2]);
    const tid = e1?.tradeId || e2?.tradeId;
    if (!tid) {
      check('TC15', 'отмена обмена оставляет вещи на месте', false, 'сессия не открылась');
    } else {
      const before = (await getSave(tA)).saveData.inventory?.pokeBall || 0;
      s1.emit('trade_offer', { tradeId: tid, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 1 } }] });
      await onceEvent(s2, 'trade_partner_offers', 10000);
      const cA = onceEvent(s1, 'trade_cancelled', 10000);
      const cB = onceEvent(s2, 'trade_cancelled', 10000);
      s1.emit('trade_cancel', tid);
      const [ccA, ccB] = await Promise.all([cA, cB]);
      await sleep(500);
      const after = (await getSave(tA)).saveData.inventory?.pokeBall || 0;
      check('TC15', 'отмена обмена оставляет вещи на месте', !!ccA && !!ccB && after === before,
        `balls ${before}→${after}`);
    }
  }

  s1.close(); s2.close();
  return finish();
}
