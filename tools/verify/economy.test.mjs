/**
 * Проверки экономики: PvP, трейд и авторитетность сохранения.
 * Требует поднятого сервера (см. run.mjs).
 */
import {
  createSuite, api, login, connect, onceEvent, sleep, testSave, testMon, asObject, BASE,
} from './support.mjs';

const { check, finish } = createSuite('Экономика');

/** Начинает бой A против B и возвращает battleId либо null. */
async function startPvP(sockA, sockB, idB) {
  const challenge = onceEvent(sockB, 'pvp_challenge_received', 3000);
  sockA.emit('pvp_challenge', idB);
  if (!(await challenge)) return null;
  const starts = Promise.all([onceEvent(sockA, 'pvp_start', 4000), onceEvent(sockB, 'pvp_start', 4000)]);
  sockB.emit('pvp_accept', idB === 111000002 ? 111000001 : idB);
  const [sA, sB] = await starts;
  return sA?.battleId ?? sB?.battleId ?? null;
}

// ══════════════════════ PvP ══════════════════════
const A_ID = 111000001, B_ID = 111000002;
const tokenA = await login(A_ID, 'pvp_a');
const tokenB = await login(B_ID, 'pvp_b');
const sockA = await connect(tokenA, 'A');
const sockB = await connect(tokenB, 'B');

// ── E1: бой с самим собой
{
  sockA.emit('pvp_accept', A_ID);
  const started = await onceEvent(sockA, 'pvp_start', 2500);
  check('E1', 'PvP: бой с самим собой не создаётся', started === null,
    started ? `Бой создан: ${JSON.stringify(started).slice(0, 70)}` : 'pvp_start не пришёл');
}

// ── E2: посторонний сокет не может завершить чужой бой и получить награду
{
  const battleId = await startPvP(sockA, sockB, B_ID);
  if (!battleId) {
    check('E2', 'PvP: посторонний не получает награду за чужой бой', false, 'не удалось начать бой');
  } else {
    const tokenC = await login(111000003, 'pvp_c');
    const sockC = await connect(tokenC, 'C');
    const rewardPromise = onceEvent(sockC, 'pvp_reward', 2500);
    sockC.emit('pvp_end', { battleId, action: { type: 'win' } });
    const reward = await rewardPromise;
    check('E2', 'PvP: посторонний не получает награду за чужой бой', reward === null,
      reward ? `НАГРАДА ВЫДАЧА: ${JSON.stringify(reward)}` : 'награды нет');
    sockC.close();
  }
}

// ── E3: surrender — это поражение, а не победа
{
  const battleId = await startPvP(sockA, sockB, B_ID);
  if (!battleId) {
    check('E3', 'PvP: surrender не даёт награду сдающемуся', false, 'не удалось начать бой');
  } else {
    const rewardPromise = onceEvent(sockB, 'pvp_reward', 2500);
    sockB.emit('pvp_end', { battleId, action: { type: 'surrender' } });
    const got = await rewardPromise;
    check('E3', 'PvP: surrender не даёт награду сдающемуся', got === null,
      got ? `НАГРАДА ЗА СДАЧУ: ${JSON.stringify(got)}` : 'награды нет');
  }
}

// ── E4: повторный pvp_end по тому же battleId не платит дважды
{
  const battleId = await startPvP(sockA, sockB, B_ID);
  if (!battleId) {
    check('E4', 'PvP: повторный pvp_end не начисляет награду дважды', false, 'не удалось начать бой');
  } else {
    const rewards = [];
    sockA.removeAllListeners('pvp_reward');
    sockA.on('pvp_reward', (r) => rewards.push(r));
    for (let i = 0; i < 10; i++) sockA.emit('pvp_end', { battleId: `pvp_fake_${i}`, action: { type: 'win' } });
    await sleep(300);
    for (let i = 0; i < 5; i++) sockA.emit('pvp_end', { battleId, action: { type: 'win' } });
    await sleep(2000);
    check('E4', 'PvP: повторный pvp_end не начисляет награду дважды', rewards.length <= 1,
      `наград: ${rewards.length} (ожидается не больше 1)`);
  }
}

// ── E5: нокаут в PvP виден обеим сторонам, награда доходит (L4) ──
// Протокол: A бьёт → B присылает hp_update{fainted} + fainted → A видит
// победу; B шлёт pvp_end{lose} → сервер сеттлит победу A (+500 + pvp_reward).
{
  const tA = await login(111000011, 'pvp_e5a');
  const tB = await login(111000012, 'pvp_e5b');
  const sA = await connect(tA, 'EA');
  const sB = await connect(tB, 'EB');

  const chRecv = onceEvent(sB, 'pvp_challenge_received', 3000);
  sA.emit('pvp_challenge', 111000012);
  const ch = await chRecv;
  const stA = onceEvent(sA, 'pvp_start', 4000);
  const stB = onceEvent(sB, 'pvp_start', 4000);
  sB.emit('pvp_accept', 111000011);
  const [evA, evB] = await Promise.all([stA, stB]);
  const bidA = evA?.battleId;
  const bidB = evB?.battleId;
  const sameBattle = !!bidA && bidA === bidB;

  let hpSyncOk = false;
  let faintedOk = false;
  let rewardOk = false;
  if (sameBattle) {
    // A бьёт как настоящий клиент (поле lvl, dmg в допуске: lvl5/atk60/power40)
    const atkRecv = onceEvent(sB, 'pvp_opponent_action', 4000);
    sA.emit('pvp_action', { battleId: bidA, action: { type: 'attack', moveName: 'tackle', dmg: 8, crit: false, lvl: 5, atk: 60, power: 40 } });
    const atk = await atkRecv;
    // B отвечает hp_update с нокаутом + fainted
    if (atk && atk.type === 'attack') {
      const hpRecv = onceEvent(sA, 'pvp_opponent_action', 4000);
      sB.emit('pvp_action', { battleId: bidB, action: { type: 'hp_update', hp: 0, maxHp: 50, fainted: true } });
      const hp = await hpRecv;
      hpSyncOk = !!hp && hp.type === 'hp_update' && hp.fainted === true;
      const faintRecv = onceEvent(sA, 'pvp_opponent_action', 4000);
      sB.emit('pvp_action', { battleId: bidB, action: { type: 'fainted' } });
      const faint = await faintRecv;
      faintedOk = !!faint && faint.type === 'fainted';
    }
    // B сдаёт бой поражением → сервер должен наградить A
    const rewardRecv = onceEvent(sA, 'pvp_reward', 5000);
    sB.emit('pvp_end', { battleId: bidB, action: { type: 'lose' } });
    const reward = await rewardRecv;
    rewardOk = !!reward && reward.money === 500;
  }
  check('E5', 'PvP: нокаут синхронизируется (hp_update + fainted)', sameBattle && hpSyncOk && faintedOk,
    !sameBattle ? 'бой не создался' : `hp_update: ${hpSyncOk}, fainted: ${faintedOk}`);
  check('E5b', 'PvP: победитель получает +500 через чужой lose', rewardOk,
    rewardOk ? '+500 дошло' : 'pvp_reward не пришёл');

  sA.close();
  sB.close();
}

// ══════════════════════ M-18: PvP-Арена ══════════════════════
// E6: бой с арены идёт по тому же протоколу (challenge/accept/start/
// attack → hp_update/fainted → pvp_end/lose → pvp_reward), жетон сгорает
// при входе, награда — со стриком (pvp_reward расширен, E5 не ломается).
// E7: без жетона на арену нельзя (arena_join_rejected NO_TOKEN).
{
 try {
  const A2_ID = 111000021, B2_ID = 111000022;
  const tA2 = await login(A2_ID, 'pvp_arena_a');
  const tB2 = await login(B2_ID, 'pvp_arena_b');
  const arenaSave = () => {
    const s = testSave();
    s.saveData.inventory = { credit: 50000, arenaToken: 2, pokeBall: 5 };
    s.saveData.myTeam = [testMon('arena-mon-1')];
    return s;
  };
  await api('/api/save', { method: 'POST', token: tA2, body: arenaSave() });
  await api('/api/save', { method: 'POST', token: tB2, body: arenaSave() });
  const sA2 = await connect(tA2, 'AA');
  const sB2 = await connect(tB2, 'AB');

  // Вход по жетону: A входит, затем B.
  // Лобби НЕ ловим первым попавшимся broadcast: A получает «лобби из одного
  // себя» от своей же регистрации, и событие может прийти до того, как тест
  // успел подписаться (буфер сокета). Поэтому собираем ВСЕ снимки и отдельно
  // просим свежий — так проверка детерминирована и не зависит от тайминга.
  const seen = [];
  const collect = (l) => { if (Array.isArray(l)) seen.push(l); };
  sA2.on('arena_lobby', collect);
  const joinedA = onceEvent(sA2, 'arena_joined', 4000);
  sA2.emit('arena_join');
  const jA = await joinedA;
  const joinedB = onceEvent(sB2, 'arena_joined', 4000);
  sB2.emit('arena_join');
  const jB = await joinedB;
  const snapP = onceEvent(sA2, 'arena_lobby', 4000);
  sA2.emit('arena_lobby_request');
  const lobby = await snapP;
  sA2.off('arena_lobby', collect);
  const snapshots = [...seen, ...(Array.isArray(lobby) ? [lobby] : [])];
  const bothInLobby = (l) => Array.isArray(l)
    && l.some((e) => e.userId === A2_ID) && l.some((e) => e.userId === B2_ID);
  const lobbyOk = !!jA && !!jB && snapshots.some(bothInLobby);
  check('E6a', 'Арена: вход по жетону, лобби видит обоих', lobbyOk,
    !jA ? 'A не вошёл' : !jB ? 'B не вошёл'
      : `снимки: [${snapshots.map((l) => l.length).join(',')}]`);

  // Жетон сгорает при входе (было 2 → стало 1).
  const sdA2 = asObject((await api('/api/save', { method: 'GET', token: tA2 })).json?.saveData);
  check('E6b', 'Арена: жетон сгорает при входе', sdA2.inventory?.arenaToken === 1,
    `arenaToken=${sdA2.inventory?.arenaToken}`);

  // Бой по тому же протоколу, но с флагом арены.
  let protoOk = false;
  let rewardOk = false;
  const chRecv = onceEvent(sB2, 'pvp_challenge_received', 4000);
  sA2.emit('pvp_challenge', { userId: B2_ID, arena: true });
  const chAr = await chRecv;
  if (chAr?.arena === true) {
    const stA = onceEvent(sA2, 'pvp_start', 4000);
    const stB = onceEvent(sB2, 'pvp_start', 4000);
    sB2.emit('pvp_accept', { fromId: A2_ID, arena: true });
    const [evA, evB] = await Promise.all([stA, stB]);
    const bidA = evA?.battleId;
    const bidB = evB?.battleId;
    if (bidA && bidA === bidB) {
      const atkRecv = onceEvent(sB2, 'pvp_opponent_action', 4000);
      sA2.emit('pvp_action', { battleId: bidA, action: { type: 'attack', moveName: 'tackle', dmg: 8, crit: false, lvl: 5, atk: 60, power: 40 } });
      const atk = await atkRecv;
      if (atk?.type === 'attack') {
        const hpRecv = onceEvent(sA2, 'pvp_opponent_action', 4000);
        sB2.emit('pvp_action', { battleId: bidB, action: { type: 'hp_update', hp: 0, maxHp: 50, fainted: true } });
        const hp = await hpRecv;
        const faintRecv = onceEvent(sA2, 'pvp_opponent_action', 4000);
        sB2.emit('pvp_action', { battleId: bidB, action: { type: 'fainted' } });
        const faint = await faintRecv;
        protoOk = hp?.type === 'hp_update' && faint?.type === 'fainted';
      }
      const rewardRecv = onceEvent(sA2, 'pvp_reward', 5000);
      sB2.emit('pvp_end', { battleId: bidB, action: { type: 'lose' } });
      const reward = await rewardRecv;
      rewardOk = !!reward && reward.money >= 500 && reward.arena === true
        && (reward.streak || 0) >= 1 && Array.isArray(reward.items) && reward.items.length > 0;
      check('E6d', 'Арена: победитель получает pvp_reward со стриком и предметами',
        rewardOk, reward ? `money=${reward.money} streak=${reward.streak} items=${reward.items?.length}` : 'pvp_reward не пришёл');
    }
  }
  check('E6c', 'Арена: бой идёт по тому же протоколу (attack/hp_update/fainted)',
    chAr?.arena === true && protoOk,
    !chAr ? 'вызов не дошёл' : `arena=${chAr?.arena}, sync=${protoOk}`);

  // Таблица лидеров арены видит победу.
  const lead = await api('/api/arena/leaders', { token: tA2 });
  const entries = lead.json?.entries || [];
  check('E6e', 'Арена: таблица лидеров отдаёт победу',
    lead.status === 200 && entries.some((e) => e.userId === A2_ID && (e.wins || 0) >= 1),
    lead.status !== 200 ? `HTTP ${lead.status}` : `записей: ${entries.length}`);

  sA2.close();
  sB2.close();
 } catch (err) {
  // Раньше исключение внутри блока глушило все E6-проверки: в отчёте оставалось
  // только «ПРОВАЛЕНО: E6a» без единого сообщения, где именно сломалось.
  check('E6a', 'Арена: вход по жетону, лобби видит обоих', false, `исключение: ${err?.message || err}`);
  check('E6c', 'Арена: бой идёт по тому же протоколу', false, 'блок не дошёл');
  check('E6d', 'Арена: победитель получает pvp_reward со стриком', false, 'блок не дошёл');
  check('E6e', 'Арена: таблица лидеров отдаёт победу', false, 'блок не дошёл');
 }
}

// ── E7: без жетона на арену нельзя ──
{
  const C_ID = 111000023;
  const tC = await login(C_ID, 'pvp_arena_c');
  await api('/api/save', { method: 'POST', token: tC, body: testSave() }); // жетона нет
  const sC = await connect(tC, 'AC');
  const rejP = onceEvent(sC, 'arena_join_rejected', 3000);
  const okP = onceEvent(sC, 'arena_joined', 3000);
  sC.emit('arena_join');
  const [rej, okJoin] = await Promise.all([rejP, okP]);
  check('E7', 'Арена: без жетона вход отклоняется (NO_TOKEN)',
    !!rej && okJoin === null && /NO_TOKEN/.test(rej.reason || ''),
    rej ? `reason=${rej.reason}` : 'отклонения не было');
  sC.close();
}

// ══════════════════════ Трейд ══════════════════════
{
  const t1 = await login(222000001, 'trade_1');
  const t2 = await login(222000002, 'trade_2');

  await api('/api/save', {
    method: 'POST', token: t1,
    body: (() => {
      const s = testSave();
      s.saveData.inventory = { credit: 500, pokeBall: 10 };
      s.saveData.myTeam = [testMon('t1-mon-1')];
      return s;
    })(),
  });

  const s1 = await connect(t1, 't1');
  const s2 = await connect(t2, 't2');

  s2.emit('trade_request', 222000001);
  await onceEvent(s1, 'trade_request_received', 3000);
  s1.emit('trade_accept', 222000002);
  const started = await onceEvent(s2, 'trade_started', 4000);
  const tradeId = started?.tradeId;

  if (!tradeId) {
    check('T1', 'Трейд: сессия создаётся', false, 'trade_started не пришёл');
  } else {
    check('T1', 'Трейд: сессия создаётся', true);

    const expectReject = async (id, name, offers) => {
      const p = onceEvent(s2, 'trade_offer_rejected', 3000);
      s2.emit('trade_offer', { tradeId, offers });
      const rej = await p;
      check(id, name, rej !== null, rej ? (rej.reason || '').slice(0, 70) : 'отклонения не было');
    };

    await expectReject('T2', 'Трейд: предмет, которого нет, отклоняется',
      [{ type: 'item', data: { id: 'masterBall', qty: 1 } }]);
    await expectReject('T3', 'Трейд: неизвестный id предмета отклоняется',
      [{ type: 'item', data: { id: 'hackedItem', qty: 1 } }]);
    await expectReject('T4', 'Трейд: отрицательное qty отклоняется',
      [{ type: 'item', data: { id: 'pokeBall', qty: -5 } }]);
    await expectReject('T5', 'Трейд: покемон, которого нет, отклоняется',
      [{ type: 'pokemon', data: { uid: 't1-mon-1' } }]);

    // ── T6: третий сокет не может вклиниться в сессию
    {
      const t3 = await login(222000003, 'trade_3');
      const s3 = await connect(t3, 't3');
      const injected = onceEvent(s1, 'trade_partner_offers', 2000);
      s3.emit('trade_offer', { tradeId, offers: [{ type: 'item', data: { id: 'pokeBall', qty: 1 } }] });
      const got = await injected;
      check('T6', 'Трейд: посторонний сокет не может записать офферы', got === null,
        got ? 'ОФФЕРЫ ПРИНЯТЫ ОТ ПОСТОРОННЕГО' : 'инъекция не прошла');
      s3.close();
    }

    // ── T7/T8: валидный обмен проходит, покемон переходит с серверными данными
    {
      const relayedPromise = onceEvent(s2, 'trade_partner_offers', 4000);
      s1.emit('trade_offer', { tradeId, offers: [{ type: 'pokemon', data: { uid: 't1-mon-1' } }] });
      const relayed = await relayedPromise;
      check('T7', 'Трейд: валидный оффер доходит до партнёра', relayed !== null,
        relayed ? `элементов: ${relayed.length}` : 'оффер не доставлен');

      if (relayed) {
        s1.emit('trade_confirm', tradeId);
        await sleep(300);
        s2.emit('trade_confirm', tradeId);
        await sleep(1500);

        const sd1 = asObject((await api('/api/save', { method: 'GET', token: t1 })).json?.saveData);
        const sd2 = asObject((await api('/api/save', { method: 'GET', token: t2 })).json?.saveData);
        const stillThere = (sd1.myTeam || []).some((m) => m.uid === 't1-mon-1');
        const received = (sd2.myTeam || []).length > 0;
        check('T8', 'Трейд: покемон реально переходит к партнёру', !stillThere && received,
          `у отправителя: ${stillThere}, у получателя: ${received}`);
      }
    }

    // ── T9/T10: обмен яйцами (Я16). T8 закрыл сессию (activeTrades.delete),
    // поэтому открываем новую.
    {
      const EGG_UID = 't1-egg-1';
      const eggObj = {
        uid: EGG_UID, species: 'pikachu',
        types: [{ type: { name: 'electric' } }],
        ivs: { hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 },
        readyTime: Date.now() + 86400000,
        parent1Uid: null, parent2Uid: null, shinyBoost: false, notified: false,
      };
      // Кладём яйцо в сейв t1 напрямую через API сейва
      const cur = asObject((await api('/api/save', { method: 'GET', token: t1 })).json?.saveData);
      cur.eggs = [...(cur.eggs || []), eggObj];
      await api('/api/save', { method: 'POST', token: t1, body: { saveData: cur } });

      s2.emit('trade_request', 222000001);
      await onceEvent(s1, 'trade_request_received', 3000);
      s1.emit('trade_accept', 222000002);
      const started2 = await onceEvent(s2, 'trade_started', 4000);
      const tradeId2 = started2?.tradeId;
      if (!tradeId2) {
        check('T9', 'Трейд: вторая сессия для яиц создаётся', false, 'trade_started не пришёл');
      } else {
        const expectReject2 = async (id, name, offers) => {
          const p = onceEvent(s2, 'trade_offer_rejected', 3000);
          s2.emit('trade_offer', { tradeId: tradeId2, offers });
          const rej = await p;
          check(id, name, rej !== null, rej ? (rej.reason || '').slice(0, 70) : 'отклонения не было');
        };

        // T9: чужое яйцо отклоняется
        await expectReject2('T9', 'Трейд: яйцо, которого нет, отклоняется',
          [{ type: 'egg', data: { uid: 'no-such-egg' } }]);

        // T10: валидное яйцо переходит к партнёру (предлагает владелец s1)
        const relayedEggP = onceEvent(s2, 'trade_partner_offers', 4000);
        s1.emit('trade_offer', { tradeId: tradeId2, offers: [{ type: 'egg', data: { uid: EGG_UID } }] });
        const relayedEgg = await relayedEggP;
        check('T10a', 'Трейд: оффер яйца доходит до партнёра', relayedEgg !== null,
          relayedEgg ? `элементов: ${relayedEgg.length}` : 'оффер не доставлен');

        if (relayedEgg) {
          s1.emit('trade_confirm', tradeId2);
          await sleep(300);
          s2.emit('trade_confirm', tradeId2);
          await sleep(1500);

          const sd1 = asObject((await api('/api/save', { method: 'GET', token: t1 })).json?.saveData);
          const sd2 = asObject((await api('/api/save', { method: 'GET', token: t2 })).json?.saveData);
          const stillThere = (sd1.eggs || []).some((e) => e.uid === EGG_UID);
          const received = (sd2.eggs || []).some((e) => e.species === 'pikachu');
          check('T10', 'Трейд: яйцо реально переходит к партнёру', !stillThere && received,
            `у отправителя: ${stillThere}, у получателя: ${received}`);
        }
      }
    }

    s1.close();
    s2.close();
  }
}

// ══════════════════════ K1: облако без лимитов (регрессия fab5099) ══════════════════════
// Раньше Zod-потолок max(999999) + refine на ~400 ключей отбивал любой сейв
// с credit > 1 млн статусом 422. Теперь потолок величины — int4 max
// (2 147 483 647), лимита числа ключей нет. T11–T14 фиксируют это фактами.
{
  /** Инвентарь из n разных ключей (форма ключа — по схеме: латиница/цифры/_). */
  const bulkInventory = (n, credit = 500) => {
    const inv = { credit };
    for (let i = 0; i < n; i++) inv[`k1bulk${String(i).padStart(4, '0')}`] = (i % 99) + 1;
    return inv;
  };
  const postSave = (token, inventory) => api('/api/save', {
    method: 'POST', token,
    body: (() => {
      const s = testSave();
      s.saveData.inventory = inventory;
      return s;
    })(),
  });
  const getInventory = async (token) =>
    asObject((await api('/api/save', { method: 'GET', token })).json?.saveData).inventory || {};

  // ── T11: 500+ разных предметов — круговой обход целиком
  {
    const token = await login(333000011, 'k1_t11');
    const sent = bulkInventory(520);
    const r = await postSave(token, sent);
    const got = r.status === 200 ? await getInventory(token) : null;
    const allBack = !!got && Object.keys(sent).every((k) => got[k] === sent[k]);
    check('T11', 'K1: сейв с 500+ разных предметов возвращается целиком',
      r.status === 200 && allBack,
      r.status !== 200 ? `POST HTTP ${r.status}` : `ключей: ${Object.keys(got).length}/521`);
  }

  // ── T12: credit = 1 млрд — принимается, GET возвращает
  {
    const token = await login(333000012, 'k1_t12');
    const r = await postSave(token, { credit: 1_000_000_000, pokeBall: 5 });
    const got = r.status === 200 ? await getInventory(token) : null;
    check('T12', 'K1: credit 1_000_000_000 принимается (не 422), GET возвращает',
      r.status === 200 && got?.credit === 1_000_000_000,
      r.status !== 200 ? `POST HTTP ${r.status}` : `credit: ${got?.credit}`);
  }

  // ── T13: 600 ключей инвентаря — не 422
  {
    const token = await login(333000013, 'k1_t13');
    const r = await postSave(token, bulkInventory(600));
    check('T13', 'K1: сейв с 600 ключами инвентаря — не 422',
      r.status === 200, `POST HTTP ${r.status}`);
  }

  // ── T14: потолок int4. 2_147_483_647 — ок; 3_000_000_000 — 422 без 500.
  // Поведение по коду: Zod max(2_147_483_647) в save-data.ts отклоняет 3e9
  // на валидации (422) — до клиппа money в routes/save.ts дело не доходит.
  {
    const token = await login(333000014, 'k1_t14');
    const okMax = await postSave(token, { credit: 2_147_483_647 });
    const gotMax = okMax.status === 200 ? await getInventory(token) : null;
    check('T14', 'K1: credit 2_147_483_647 (потолок int4) принимается',
      okMax.status === 200 && gotMax?.credit === 2_147_483_647,
      okMax.status !== 200 ? `POST HTTP ${okMax.status}` : `credit: ${gotMax?.credit}`);

    const over = await postSave(token, { credit: 3_000_000_000 });
    check('T14b', 'K1: credit 3_000_000_000 отклоняется 422 (не 500), без потери сейва',
      over.status === 422,
      `POST HTTP ${over.status}${over.status === 500 ? ' — 500!' : ''}`);
    if (over.status === 422) {
      const kept = await getInventory(token);
      check('T14c', 'K1: отклонённый сейв не затирает предыдущий',
        kept?.credit === 2_147_483_647, `credit: ${kept?.credit}`);
    }
  }
}

// ══════════════════════ HTTP-контракт ══════════════════════
{
  const r = await api('/api/definitely-not-a-route-12345');
  const isJson = (r.text || '').trim().startsWith('{');
  check('S13', 'несуществующий /api/* отдаёт JSON 404, а не HTML', r.status === 404 && isJson,
    `HTTP ${r.status}, JSON=${isJson}`);

  const a = await fetch(`${BASE}/assets/definitely-not-a-chunk.js`);
  const aText = await a.text();
  check('S14', 'несуществующий чанк отдаёт 404, а не HTML',
    a.status === 404 && !aText.trimStart().startsWith('<'), `HTTP ${a.status}`);

  const idx = await fetch(`${BASE}/`);
  const idxText = await idx.text();
  check('S15', 'корневой маршрут отдаёт приложение (SPA не сломан)',
    idx.status === 200 && idxText.includes('<html'), `HTTP ${idx.status}`);
}

sockA.close();
sockB.close();
finish();
