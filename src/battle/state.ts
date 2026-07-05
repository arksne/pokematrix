// ─────────────────────────────────────────────────────────────
// battle/state.ts — СОСТОЯНИЕ ТЕКУЩЕГО БОЯ
// ─────────────────────────────────────────────────────────────
// Единственный экземпляр (singleton), в котором хранится ВСЁ
// состояние активного боя: дикий покемон, игрок, погода, фаза.
// Импортируется всеми модулями боя (core.ts, logic.ts, ai.ts).
// Мутации видны везде, т.к. ES module экспортирует ссылку.
//
// После боя — очищается или сохраняется в state (restoreBattleState).
//
// Поля сгруппированы по разделам:
//   ─ Дикий покемон     — wild: текущий дикий покемон
//   ─ Игрок             — player: текущий покемон игрока
//   ─ Бой               — round, type, weather, items
//   ─ Зал/Элита         — gymLeaderKey, gymTeam (индекс внутри зала)
//   ─ Охота             — huntActive, huntTimer
//   ─ PvP               — opponentId, pvp-специфичные поля
//   ─ Баффы/Дебаффы     — reflect, lightScreen, protect, substitute
// ─────────────────────────────────────────────────────────────

const battleState = {
  // ── Дикий покемон ──────────────────────────────────────
  // Содержит данные покемона, с которым идёт бой.
  // Для wild battles — загружается из PokeAPI.
  // Для gym/elite — загружается из gyms.ts.
  activeWild: null,        // Объект покемона (из PokeAPI или gyms.ts)
  wildLvl: 5,              // Уровень дикого покемона
  wildMaxHP: 0,            // Максимальное HP дикого покемона
  wildCurHP: 0,            // Текущее HP дикого покемона
  wildStatus: null,        // Статус: 'psn' | 'brn' | 'par' | 'slp' | 'frz' | null
  wildSleepTurns: 0,       // Сколько ходов ещё спать (если статус 'slp')
  escapeAttempts: 0,       // Попытки убежать (каждая неудача снижает шанс)
  wildMovesDetailed: [],   // Полные данные атак дикого покемона (MoveData[])
  wildMovesPP: null,       // PP (очки сил) каждой атаки

  // ── Игрок ──────────────────────────────────────────────
  battleRound: 0,           // Номер хода в бою (сброс при новой атаке)
  activePlayerMon: null,    // Текущий покемон игрока (ссылка на state.myTeam[i])
  playerMovesDetailed: [],  // Полные данные атак покемона игрока (MoveData[])
  battleType: 'wild',       // 'wild' | 'gym' | 'elite' | 'champion' | 'pvp'
  currentWeather: 'clear',  // Погода: 'clear' | 'rain' | 'sun' | 'sandstorm' | 'hail'
  itemsUsedInBattle: 0,     // Сколько предметов использовано (лимит на бой)

  // ── Зал / Элитная четвёрка ─────────────────────────────
  gymLeaderKey: null,       // ID лидера зала (из gyms.ts)
  gymTeamIndex: 0,          // Какой по счёту покемон из команды лидера
  gymTeamData: null,        // Вся команда лидера
  gymTeamIndexInMember: 0,  // Индекс покемона внутри члена Элитной Четвёрки

  // ── Баффы / Дебаффы (стены) ────────────────────────────
  playerReflectTurns: 0,    // Осталось ходов Reflect (физ.защита)
  playerLightScreenTurns: 0,// Осталось ходов Light Screen (спец.защита)
  enemyReflectTurns: 0,     // То же для противника
  enemyLightScreenTurns: 0,
  protectActive: false,     // Защита игрока (Protect)
  substituteHP: 0,          // HP Substitute игрока
  enemyProtectActive: false,// Защита противника
  enemySubstituteHP: 0,     // HP Substitute противника

  // ── Охота (автоматический поиск) ──────────────────────
  huntActive: false,        // Флаг: активен ли авто-поиск
  huntTimer: null,          // Таймер интервала охоты

  // ── Выбор противника (для AI) ──────────────────────────
  enemyChosenMove: null,    // Атака, выбранная AI (вычисляется до хода)
};

export default battleState;
