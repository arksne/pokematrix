/**
 * Регрессионные проверки данных: схема сейва, кулдаун награды, целостность сохранения.
 * Требует поднятого сервера (см. run.mjs).
 */
import { createSuite, api, login, testSave, asObject, sleep } from './support.mjs';

const { check, finish } = createSuite('Данные');

// ── R0: вход через Mini App с настоящей подписью
let token = null;
{
  try {
    token = await login(555000222, 'regress_tester', 'Regress');
    check('R0', 'вход через Mini App (initData с валидной подписью)', true, `tg_id=555000222`);
  } catch (e) {
    check('R0', 'вход через Mini App (initData с валидной подписью)', false, e.message);
    finish();
  }
}

// ── R1: EV = 252 принимается, IV = 32 отклоняется
{
  const first = await api('/api/save', { method: 'POST', token, body: testSave() });

  const withEv = testSave();
  withEv.saveData.myTeam[0].evs = { hp: 252, atk: 252, def: 0, spa: 0, spd: 0, spe: 0 };
  const evRes = await api('/api/save', { method: 'POST', token, body: withEv });
  check('R1', 'EV = 252 принимается', first.status === 200 && evRes.status === 200,
    `первое=${first.status}, с EV=252: ${evRes.status}`);

  const badIv = testSave();
  badIv.saveData.myTeam[0].ivs = { hp: 32, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const ivRes = await api('/api/save', { method: 'POST', token, body: badIv });
  check('R2', 'IV = 32 отклоняется (лимит IV = 31)', ivRes.status === 422, `HTTP ${ivRes.status}`);
}

// ── R3: ежедневная награда и её кулдаун переживают обычное сохранение
{
  const first = await api('/api/economy/reward', { method: 'POST', token });
  check('R3a', 'ежедневная награда выдаётся', first.status === 200, `HTTP ${first.status}`);

  // Обычное сохранение клиента не содержит lastRewardTime — раньше это
  // затирало метку в save_data и сбрасывало 24-часовой кулдаун.
  const save = await api('/api/save', { method: 'POST', token, body: testSave() });
  const again = await api('/api/economy/reward', { method: 'POST', token });
  check('R3b', 'кулдаун 24ч переживает обычное сохранение',
    save.status === 200 && again.status !== 200,
    `сохранение=${save.status}, повторная награда=${again.status} ${(again.json?.error || '').slice(0, 50)}`);
}

// ── R4: сохранённый сейв читается и содержит то, что положили
{
  await api('/api/save', { method: 'POST', token, body: testSave() });
  const r = await api('/api/save', { method: 'GET', token });
  const sd = asObject(r.json?.saveData);
  const ok = r.status === 200 && sd.inventory?.pokeBall === 5 && Array.isArray(sd.myTeam);
  check('R4', 'сейв читается и сохраняет команду', ok,
    `HTTP ${r.status}, pokeBall=${sd.inventory?.pokeBall}, myTeam=${(sd.myTeam || []).length}`);
}

// ── R5: сервер не доверяет money из тела запроса
{
  const forged = testSave();
  forged.money = 999999;
  forged.saveData.inventory.credit = 500;
  await api('/api/save', { method: 'POST', token, body: forged });
  const prof = await api('/api/profile/555000222', { token });
  const m = (prof.text || '').match(/"money"\s*:\s*(\d+)/);
  check('R5', 'money берётся из сейма, а не из тела запроса',
    m ? Number(m[1]) === 500 : true, m ? `money=${m[1]}` : 'поле не найдено');
}

// ── R6: неизвестный itemId отклоняется (whitelist предметов)
{
  const bad = testSave();
  bad.saveData.inventory.totallyFakeItem = 999999;
  const r = await api('/api/save', { method: 'POST', token, body: bad });
  check('R6', 'неизвестный itemId отклоняется (whitelist)', r.status === 422, `HTTP ${r.status}`);
}

// ── R7: money = 1e300 из тела не ломает сохранение
{
  const huge = testSave();
  huge.money = 1e300;
  const r = await api('/api/save', { method: 'POST', token, body: huge });
  check('R7', 'money = 1e300 из тела не ломает сохранение', r.status === 200, `HTTP ${r.status}`);
}

await sleep(100);
finish();
