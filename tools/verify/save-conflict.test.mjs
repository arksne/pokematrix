/**
 * Конфликт версий облачного сейва и целостность данных.
 *
 * Проверяет то, что раньше не проверялось и из-за чего два открытых устройства
 * могли тихо затирать друг друга:
 *
 *   1. Сервер назначает версию, клиент её подхватывает. Раньше клиент тикал
 *      свой счётчик в saveGame() на каждом локальном сохранении — в несколько
 *      раз быстрее серверного, — и блокировка версий сравнивала разные шкалы.
 *   2. 409 больше не уходит в общий ретрай: повтор той же устаревшей версии
 *      ничего не меняет, он лишь оттягивает разрешение на 5/15/30 секунд.
 *   3. Прогресс не теряется ни на одной стороне конфликта: сервер отказывает,
 *      но сохраняет своё; клиент предлагает слияние, а не затирание.
 *   4. Пустой сейв не затирает непустой ни при какой версии (последняя линия).
 */
import { createSuite, api, login, sleep } from './support.mjs';

const suite = createSuite('Сохранения: конфликт версий');

const TG_ID = 779003333;

async function postSave(token, saveData, saveVersion, extra = {}) {
  const badgesCount = Array.isArray(saveData.badges) ? saveData.badges.length : 0;
  const pokemonCount = (saveData.myTeam?.length || 0)
    + (saveData.pcBoxes || []).reduce((n, b) => n + (b?.length || 0), 0);
  return await api('/api/save', {
    method: 'POST',
    token,
    body: {
      saveData,
      saveVersion,
      badgesCount,
      money: saveData.inventory?.credit ?? 0,
      pokemonCount,
      ...extra,
    },
  });
}

/** Минимальный валидный сейв с заданным числом покемонов. */
function makeSave(monCount, marker) {
  const myTeam = Array.from({ length: monCount }, (_, i) => ({
    uid: `c-${marker}-${i}`,
    name: `Mon${i}`,
    apiData: { name: 'combusken', types: [{ type: { name: 'fighting' } }], stats: [] },
    baseLevel: 5,
    currentHp: 20,
    maxHp: 20,
    ivs: { hp: 10, attack: 10, defense: 10, spAtk: 10, spDef: 10, speed: 10 },
    evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    moves: [],
  }));
  return {
    _v: 1,
    _ts: Date.now(),
    starterGiven: true,
    myTeam,
    pcBoxes: [[]],
    daycareMons: [],
    eggs: [],
    inventory: { credit: 5000, pokeBall: 10 },
    money: 5000,
    badges: [],
  };
}

const token = await login(TG_ID, 'conflict_probe', 'Conflict');

// ── Версия назначается сервером и растёт монотонно ──────────────────────
const first = await postSave(token, makeSave(2, 'a'), 0);
suite.check('C1', 'первый сейв принят', first.status === 200, `HTTP ${first.status}`);

const v1 = first.json?.saveVersion;
suite.check('C2', 'сервер вернул новую версию в ответе', Number.isInteger(v1) && v1 > 0, `saveVersion=${v1}`);

// Клиент обязан подхватить именно её, иначе следующий запрос уйдёт со старой.
const second = await postSave(token, makeSave(3, 'b'), v1);
suite.check('C3', 'сейв с актуальной версией принят', second.status === 200, `HTTP ${second.status}`);
const v2 = second.json?.saveVersion;
suite.check('C4', 'версия выросла на единицу', v2 === v1 + 1, `${v1} -> ${v2}`);

// ── Устаревшая версия отклоняется, но данные сервера целы ──────────────
const stale = await postSave(token, makeSave(5, 'stale'), v1);
suite.check('C5', 'сейв с устаревшей версией отклонён (409)', stale.status === 409, `HTTP ${stale.status}`);
suite.check('C6', 'ответ содержит серверную версию для слияния',
  Number.isInteger(stale.json?.serverVersion) && stale.json.serverVersion >= v2,
  `serverVersion=${stale.json?.serverVersion}`);

const afterStale = await api('/api/save', { token });
const storedCount = afterStale.json?.saveData?.myTeam?.length ?? 0;
suite.check('C7', 'после отказа данные сервера не пострадали', storedCount === 3,
  `покемонов в облаке: ${storedCount}`);

// ── Пустой сейв не затирает непустой даже со свежей версией ─────────────
const empty = await postSave(token, makeSave(0, 'empty'), v2);
suite.check('C8', 'пустой сейв отклонён при актуальной версии (409)', empty.status === 409, `HTTP ${empty.status}`);

const afterEmpty = await api('/api/save', { token });
suite.check('C9', 'покемоны после отказа пустого сейва на месте',
  (afterEmpty.json?.saveData?.myTeam?.length ?? 0) === 3,
  `покемонов: ${afterEmpty.json?.saveData?.myTeam?.length}`);

// ── Намеренный сброс проходит и архивируется ───────────────────────────
const reset = await postSave(token, makeSave(0, 'reset'), v2, { reset: true });
suite.check('C10', 'намеренный сброс принят при reset: true', reset.status === 200, `HTTP ${reset.status}`);

const afterReset = await api('/api/save', { token });
suite.check('C11', 'после сброса в облаке пусто',
  (afterReset.json?.saveData?.myTeam?.length ?? 0) === 0,
  `покемонов: ${afterReset.json?.saveData?.myTeam?.length}`);

suite.finish();

const failed = suite.results.filter((r) => !r.pass).length;
if (failed > 0) process.exit(1);