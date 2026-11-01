import { describe, it, expect } from 'vitest';
import { teamBattleStatus, teamBlockedMessage, teamBlockedToast, hasAliveTeam } from '../team-hint.js';

/**
 * Подсказки про состояние команды. Реальный кейс с прода: новичок проиграл
 * первый бой, вся команда без сознания — игра отвечала «Вам нужен хотя бы один
 * живой покемон!» и не говорила, что лечат в Поке-центре. Игрок застревал.
 */
describe('teamBattleStatus', () => {
  it('пустая/отсутствующая команда → no-team', () => {
    expect(teamBattleStatus([])).toBe('no-team');
    expect(teamBattleStatus(null)).toBe('no-team');
    expect(teamBattleStatus(undefined)).toBe('no-team');
  });

  it('вся команда без сознания → all-fainted', () => {
    expect(teamBattleStatus([{ currentHp: 0 }, { currentHp: 0 }])).toBe('all-fainted');
    expect(teamBattleStatus([{ currentHp: -5 }])).toBe('all-fainted');
    expect(teamBattleStatus([{}])).toBe('all-fainted'); // нет currentHp = 0
  });

  it('есть живой покемон → ok', () => {
    expect(teamBattleStatus([{ currentHp: 0 }, { currentHp: 7 }])).toBe('ok');
    expect(teamBattleStatus([{ currentHp: 1 }])).toBe('ok');
  });

  it('null-элементы в команде не ломают проверку', () => {
    expect(teamBattleStatus([null, { currentHp: 3 }] as any)).toBe('ok');
    expect(teamBattleStatus([null, undefined] as any)).toBe('all-fainted');
  });
});

describe('teamBlockedMessage', () => {
  it('для выбитой команды подсказывает Поке-центр, а не просто «нужен живой»', () => {
    const msg = teamBlockedMessage('all-fainted');
    expect(msg).toMatch(/Поке-центр/i);
    expect(msg).toMatch(/без сознания/i);
  });

  it('пустая команда — про отсутствие покемонов', () => {
    expect(teamBlockedMessage('no-team')).toMatch(/нет покемонов/i);
  });

  it('боеспособная команда — сообщения нет', () => {
    expect(teamBlockedMessage('ok')).toBeNull();
  });
});

describe('teamBlockedToast', () => {
  it('сразу выдаёт готовое сообщение по команде', () => {
    expect(teamBlockedToast([{ currentHp: 0 }])).toMatch(/Поке-центр/i);
    expect(teamBlockedToast([])).toMatch(/нет покемонов/i);
    expect(teamBlockedToast([{ currentHp: 12 }])).toBeNull();
  });
});

describe('hasAliveTeam', () => {
  it('согласована с teamBattleStatus', () => {
    expect(hasAliveTeam([{ currentHp: 1 }])).toBe(true);
    expect(hasAliveTeam([{ currentHp: 0 }])).toBe(false);
    expect(hasAliveTeam([])).toBe(false);
  });
});
