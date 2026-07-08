/**
 * Диагностика админки и инвентаря на задеплоенном сервере.
 * Запуск: node test-admin-inventory.mjs
 */
const API = process.env.API || 'https://pokematrix.onrender.com';
const ADMIN_PASS = 'league17admin2026';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    const result = await fn();
    if (result.ok) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}: ${result.error}`);
      failed++;
      if (result.details) console.log(`     Details: ${result.details}`);
    }
  } catch (e) {
    console.log(`  ❌ ${name}: CRASH — ${e.message}`);
    failed++;
  }
}

function log(res) {
  console.log(`     → HTTP ${res.status}`);
}

// ── 1. Список тренеров ──
console.log('\n📋 АДМИНКА — trainers/all');
await test('GET /profile/trainers/all', async () => {
  const res = await fetch(`${API}/api/profile/trainers/all`, {
    headers: { Authorization: `Bearer ${ADMIN_PASS}` }
  });
  log(res);
  const d = await res.json();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(d)}` };
  if (!d.users) return { ok: false, error: 'No users field' };
  console.log(`     → ${d.users.length} users, first: ${d.users[0]?.first_name || '?'}`);
  return { ok: true };
});

// ── 2. Профиль по ID ──
console.log('\n📋 АДМИНКА — profile/:id');
await test('GET /profile/1', async () => {
  const res = await fetch(`${API}/api/profile/1`, {
    headers: { Authorization: `Bearer ${ADMIN_PASS}` }
  });
  log(res);
  const d = await res.json();
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(d)}` };
  console.log(`     → ${d.profile?.first_name}, badges:${d.profile?.badges}, money:${d.profile?.money}`);
  return { ok: true };
});

// ── 3. get_save ──
console.log('\n📋 АДМИНКА — get_save');
await test('POST /admin/api get_save for user 1', async () => {
  const res = await fetch(`${API}/api/admin/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify({ cmd: 'get_save', user: '1' })
  });
  log(res);
  const d = await res.json();
  if (d.status !== 'ok') return { ok: false, error: `${d.status}: ${d.error}` };
  const inv = d.saveData?.inventory || {};
  const keys = Object.keys(inv);
  console.log(`     → inventory keys: ${keys.length}, credit: ${inv.credit || 0}`);
  console.log(`     → team: ${(d.saveData?.myTeam || []).length}`);
  console.log(`     → badges: ${(d.saveData?.badges || []).length}`);
  return { ok: true, saveData: d.saveData };
});

// ── 4. Сохранение (проверка Zod) ──
console.log('\n📋 ИНВЕНТАРЬ — POST /save (Zod check)');
await test('Normal save should pass', async () => {
  const body = {
    saveData: {
      _v: Date.now(),
      inventory: { credit: 500, pokeBall: 10, potion: 5 },
      myTeam: [], badges: [],
      currentLocationId: 'goldenrodCity', currentRegion: 'johto',
    },
    money: 500, badgesCount: 0, saveVersion: 0
  };
  const res = await fetch(`${API}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify(body)
  });
  log(res);
  const d = await res.json();
  if (!res.ok) {
    if (res.status === 422) return { ok: false, error: `422 Zod error: ${JSON.stringify(d)}`, details: d.details?.join(', ') };
    return { ok: false, error: `HTTP ${res.status}` };
  }
  return { ok: true };
});

// ── 5. Большое количество ──
console.log('\n📋 ИНВЕНТАРЬ — большие числа');
await test('Save with credit=5000000 (exceeds old 999999 limit)', async () => {
  const body = {
    saveData: {
      _v: Date.now(),
      inventory: { credit: 5000000, pokeBall: 9999 },
      myTeam: [], badges: [],
      currentLocationId: 'goldenrodCity', currentRegion: 'johto',
    },
    money: 5000000, badgesCount: 0, saveVersion: 0
  };
  const res = await fetch(`${API}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify(body)
  });
  log(res);
  const d = await res.json();
  if (!res.ok) {
    if (res.status === 422) return { ok: false, error: `422 — Zod лимит всё ещё слишком строгий! ${JSON.stringify(d)}` };
    return { ok: false, error: `HTTP ${res.status}: ${JSON.stringify(d)}` };
  }
  return { ok: true };
});

// ── 6. give_items ──
console.log('\n📋 АДМИНКА — give_items');
await test('Give 999 ultraBall to user 1', async () => {
  const res = await fetch(`${API}/api/admin/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify({ cmd: 'give_items', user: '1', val: JSON.stringify({ itemId: 'ultraBall', qty: 999 }) })
  });
  log(res);
  const d = await res.json();
  if (d.status !== 'ok') return { ok: false, error: d.error };
  return { ok: true };
});

// ── 7. give_money ──
console.log('\n📋 АДМИНКА — give_money');
await test('POST /admin/api give_money +100k', async () => {
  const res = await fetch(`${API}/api/admin/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify({ cmd: 'give_money', user: '1', val: '100000' })
  });
  log(res);
  const d = await res.json();
  if (d.status !== 'ok') return { ok: false, error: d.error };
  return { ok: true };
});

// ── 8. heal_team ──
console.log('\n📋 АДМИНКА — heal_team');
await test('POST /admin/api heal_team', async () => {
  const res = await fetch(`${API}/api/admin/api`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADMIN_PASS}` },
    body: JSON.stringify({ cmd: 'heal_team', user: '1' })
  });
  log(res);
  const d = await res.json();
  if (d.status !== 'ok') return { ok: false, error: d.error };
  return { ok: true };
});

// ── ИТОГИ ──
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 ИТОГ: ${passed} ✅ | ${failed} ❌`);
console.log(`${'='.repeat(50)}`);
if (failed > 0) {
  console.log('\n⚠️ FAILED тесты указывают на проблему в задеплоенной версии');
  console.log('   Render мог не передеплоить свежий коммит или билд упал');
}