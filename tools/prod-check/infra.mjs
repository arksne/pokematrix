/**
 * tools/prod-check/infra.mjs — базовый слой прода: служба жива, сессия
 * обновляется, чат/лидерборд доступны, развёрнут тот коммит, что мы думаем.
 *
 * Эти проверки идут ПЕРВЫМИ в run.mjs: если тут красное, остальным (PvP/трейд/
 * арена) доверять нельзя, и падение объясняется инфраструктурой, а не игрой.
 *
 * Все проверки самодостаточны: ошибка логина не бросает исключение наружу, а
 * валит только зависящие от неё SJ1/CH1 с внятной причиной.
 */
import { api, createSuite, loginWithTokens } from './lib.mjs';

/**
 * Справочный коммит main на момент прогона (main двигается — это НЕ критерий).
 * Переопределяется PROD_EXPECTED_COMMIT, чтобы отчёт не врал после нового пуша.
 */
const EXPECTED_COMMIT = (process.env.PROD_EXPECTED_COMMIT || 'f31214c').toLowerCase();
/** Стабильный тестовый юзер, переиспользуется между прогонами. */
const CHAT_ID = 777900105;

export async function runInfra() {
  const { check, info, finish } = createSuite('Прод: инфраструктура');

  // ── HF1: служба и БД живы ──────────────────────────────────
  {
    const r = await api('/api/health');
    check('HF1', 'GET /api/health → 200 {status:"ok", db:true}',
      r.status === 200 && r.json?.status === 'ok' && r.json?.db === true,
      r.status !== 200
        ? `HTTP ${r.status} ${(r.text || '').slice(0, 100)}`
        : `db=${r.json?.db} uptime=${Math.round(Number(r.json?.uptime) || 0)}с`);
  }

  // ── HF2 (ИНФОРМАЦИОННАЯ): шлюз Telegram ────────────────────
  // Контракт: server/src/routes/telegram.ts:127 → {enabled, publicUrl}.
  // Намеренно НЕ валит прогон: enabled зависит от env на Render
  // (TELEGRAM_WEBHOOK_SECRET + BOT_TOKEN), а не от кода, и на свежем деплое
  // может быть false или 404. Фиксируем факт для отчёта.
  {
    const r = await api('/api/telegram/status');
    info('HF2', 'GET /api/telegram/status (шлюз Telegram)',
      r.status === 200
        ? `enabled=${r.json?.enabled} publicUrl=${r.json?.publicUrl ?? '—'}`
        : `HTTP ${r.status} ${(r.text || '').slice(0, 90)}`);
  }

  // ── V1: развёрнут ли тот коммит, который мы проверяем ───────
  // Критерий — валидный 12-символьный хеш (как отдаёт Render), а НЕ совпадение
  // с EXPECTED_COMMIT: прод может быть легитимно впереди (задеплоен фикс).
  // Фактический коммит печатаем, чтобы отчёт фиксировал реальность.
  {
    const r = await api('/api/version');
    const commit = typeof r.json?.commit === 'string' ? r.json.commit : '';
    const isHex12 = /^[0-9a-f]{12}$/i.test(commit);
    const same = commit.toLowerCase() === EXPECTED_COMMIT;
    check('V1', 'GET /api/version отдаёт 12-символьный hex-коммит',
      r.status === 200 && isHex12,
      r.status !== 200
        ? `HTTP ${r.status} ${(r.text || '').slice(0, 100)}`
        : `commit=${commit} branch=${r.json?.branch ?? '?'} (== ожидаемый ${EXPECTED_COMMIT}: ${same ? 'да' : 'НЕТ'})`);
  }

  // Логин нужен SJ1 (refresh-пара) и CH1 (отправка в чат). Один логин на две
  // проверки — экономим auth-лимит (30/мин, а каждый логин = 2 запроса).
  let session = null;
  try {
    session = await loginWithTokens(CHAT_ID, 'pc_infra');
  } catch (e) {
    console.log(`  !! логин pc_infra не удался: ${e?.message || e}`);
  }

  // ── SJ1: сессия обновляется, а не только выдаётся ──────────
  {
    const loginOk = !!session?.token && !!session?.refreshToken;
    let refresh = null;
    let saveStatus = null;
    let detail;
    if (!loginOk) {
      detail = session
        ? `login ok, но нет refreshToken (поля ответа: ${Object.keys(session.body || {}).join(',') || '—'})`
        : 'логин не удался — SJ1 неприменим';
    } else {
      refresh = await api('/api/auth/refresh', { method: 'POST', body: { refreshToken: session.refreshToken } });
      const fresh = refresh.json?.token;
      if (refresh.status === 200 && fresh) {
        saveStatus = (await api('/api/save', { token: fresh })).status;
      }
      detail = `login ok (token+refreshToken); refresh HTTP ${refresh.status}`
        + `${fresh ? '' : ' без token'}; GET /api/save новым токеном: ${saveStatus ?? '—'}`;
    }
    check('SJ1', 'сессия: login даёт пару токенов, refresh — рабочий accessToken',
      loginOk && refresh?.status === 200 && !!refresh.json?.token && saveStatus === 200,
      detail);
  }

  // ── CH1: чат пишется и читается обратно ────────────────────
  // ВАЖНО: GET /chat/messages сортирует по id ВОЗРАСТАНИЮ и режет limit 50, то
  // есть отдаёт ПЕРВЫЕ 50 сообщений. На живом проде свежее сообщение в такой
  // ответ не попадёт, поэтому читаем через ?since= (окно 5 мин), а если там
  // пусто — дочитываем полный список и ищем по объединению.
  {
    const token = session?.token;
    const marker = `pc-check-${Date.now().toString(36)}`;
    if (!token) {
      check('CH1', 'чат: сообщение отправляется и читается обратно', false,
        'нет токена — логин не удался');
    } else {
      const since = new Date(Date.now() - 5 * 60_000).toISOString();
      const send = await api('/api/chat/send', { method: 'POST', token, body: { text: marker } });
      const win = await api(`/api/chat/messages?since=${encodeURIComponent(since)}`, { token });
      const winMsgs = Array.isArray(win.json?.messages) ? win.json.messages : [];
      let found = winMsgs.some((m) => String(m?.text ?? '') === marker);
      let scanned = winMsgs.length;
      if (!found) {
        const all = await api('/api/chat/messages', { token });
        const allMsgs = Array.isArray(all.json?.messages) ? all.json.messages : [];
        scanned += allMsgs.length;
        found = allMsgs.some((m) => String(m?.text ?? '') === marker);
      }
      check('CH1', 'чат: сообщение отправляется и читается обратно',
        send.status === 200 && send.json?.ok === true && win.status === 200 && found,
        `send HTTP ${send.status}; messages HTTP ${win.status}; найдено: ${found ? 'да' : 'нет'} (просмотрено ${scanned}); маркер ${marker}`);
    }
  }

  // ── LB1: публичная таблица лидеров ─────────────────────────
  {
    const r = await api('/api/leaderboard');
    const entries = Array.isArray(r.json?.entries) ? r.json.entries : null;
    check('LB1', 'публичный GET /api/leaderboard отдаёт entries',
      r.status === 200 && !!entries,
      r.status !== 200
        ? `HTTP ${r.status} ${(r.text || '').slice(0, 100)}`
        : `записей: ${entries.length}`);
  }

  return finish();
}
