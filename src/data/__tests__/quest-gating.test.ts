/**
 * ГЕЙТ КВЕСТОВ ПО ПРОГРЕССИИ.
 *
 * Просьба игрока: квесты не должны быть доступны все сразу — они открываются
 * по мере прохождения залов, «по городам», в порядке уровня гимов.
 * Решения: гейт по ПРЕДЫДУЩЕМУ значку; закрытые видны серым с подсказкой;
 * посылочные квесты не гейтятся; правило единое для всех квестов.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BADGE_ORDER, CITY_PREFIXES, earnedBadgeCount,
  questRequiredBadges, isQuestUnlocked, questLockHint, isCourierQuest,
} from '../../data/badges.js';
import { allNPCQuests } from '../../game/quest-track.js';

describe('порядок значков', () => {
  it('16 значков в каноническом порядке (уровни гимов 40 → 100)', () => {
    expect(BADGE_ORDER).toHaveLength(16);
    expect(BADGE_ORDER[0]).toBe('Boulder Badge');
    expect(BADGE_ORDER[15]).toBe('Rising Badge');
    expect(new Set(BADGE_ORDER).size).toBe(16);
  });

  it('считаются только канонические значки, порядок в массиве игрока не важен', () => {
    // state.badges хранится в порядке ПОЛУЧЕНИЯ — индекс нельзя брать из массива
    expect(earnedBadgeCount([])).toBe(0);
    expect(earnedBadgeCount(['Cascade Badge'])).toBe(1);
    expect(earnedBadgeCount(['Cascade Badge', 'Boulder Badge'])).toBe(2);
    expect(earnedBadgeCount(['Rising Badge', 'Boulder Badge', 'Cascade Badge'])).toBe(3);
    // мусор в сейде не считается
    expect(earnedBadgeCount(['boulder', 'нет-такого'])).toBe(0);
    expect(earnedBadgeCount(undefined)).toBe(0);
  });
});

describe('гейт по городам', () => {
  it('город N открывается после N-1 значка', () => {
    expect(questRequiredBadges('pw_trail')).toBe(0);     // Пьютер — сразу
    expect(questRequiredBadges('cer_trail')).toBe(1);    // Церулин — после 1-го
    expect(questRequiredBadges('ver_trail')).toBe(2);
    expect(questRequiredBadges('bla_trail')).toBe(15);   // Блэкторн — после 15-го
    for (let i = 0; i < CITY_PREFIXES.length; i++) {
      expect(questRequiredBadges(`${CITY_PREFIXES[i]}_x`)).toBe(i);
    }
  });

  it('значки открывают города строго по порядку', () => {
    const badges = (n: number) => BADGE_ORDER.slice(0, n);
    // с 0 значков открыт только Пьютер
    expect(isQuestUnlocked('pw_trail', badges(0))).toBe(true);
    expect(isQuestUnlocked('cer_trail', badges(0))).toBe(false);
    // с 1 значком — Церулин
    expect(isQuestUnlocked('cer_trail', badges(1))).toBe(true);
    expect(isQuestUnlocked('ver_trail', badges(1))).toBe(false);
    // с 8 значками — первая джотовая (Вайолет)
    expect(isQuestUnlocked('vio_trail', badges(8))).toBe(true);
    expect(isQuestUnlocked('aza_trail', badges(8))).toBe(false);
  });

  it('обучение открыто ВСЕГДА — иначе не выйти из стартовой области', () => {
    // tutorial_6 — единственный ключ к гейту карты (location.ts isTutorialGateOpen)
    for (const id of ['tutorial_1', 'tutorial_4', 'tutorial_6']) {
      expect(questRequiredBadges(id), id).toBeNull();
      expect(isQuestUnlocked(id, []), id).toBe(true);
    }
  });

  it('посылки не гейтятся — иначе игрок застревает с посылкой', () => {
    for (const id of ['pw_courier', 'aza_courier', 'gol_courier', 'ecr_courier',
      'mah_caravan', 'bla_caravan', 'oli_potion']) {
      expect(isCourierQuest(id), id).toBe(true);
      expect(questRequiredBadges(id), id).toBeNull();
      expect(isQuestUnlocked(id, []), id).toBe(true);
    }
  });

  it('неизвестный префикс НЕ ломает игру — считаем открытым', () => {
    expect(questRequiredBadges('mystery_quest')).toBeNull();
    expect(isQuestUnlocked('', [])).toBe(true);
  });

  it('подсказка говорит, сколько значков не хватает', () => {
    const h = questLockHint('oli_trail', BADGE_ORDER.slice(0, 10));
    expect(h).toMatch(/Нужно 13/);
    expect(h).toMatch(/осталось 3/);
    // открытый квест подсказки не даёт
    expect(questLockHint('pw_trail', [])).toBe('');
    // склонение: 1 значок / 2 значка / 5 значков
    expect(questLockHint('cer_trail', [])).toMatch(/Нужно 1 значок/);
    expect(questLockHint('ver_trail', [])).toMatch(/Нужно 2 значка/);
    expect(questLockHint('bla_trail', [])).toMatch(/Нужно 15 значков/);
  });
});

describe('гейт применён ко всем квестам и без тупиков', () => {
  const quests = allNPCQuests();

  it('каждый из 160 квестов попадает под правило (не обучение и не посылка)', () => {
    const quests = allNPCQuests();
    expect(quests.length).toBe(160);
    for (const q of quests) {
      const need = questRequiredBadges(q.id);
      const exempt = String(q.id).startsWith('tutorial_') || isCourierQuest(q.id);
      if (exempt) {
        expect(need, `${q.id} должен быть exempt`).toBeNull();
      } else {
        expect(need, `${q.id} должен быть под гейтом`).not.toBeNull();
      }
    }
  });

  it('все значки высшего зала можно получить гейтом (16 городов → 15 значков)', () => {
    const quests = allNPCQuests();
    const needs = quests.map((q) => questRequiredBadges(q.id)).filter((n) => n != null) as number[];
    expect(Math.max(...needs)).toBe(CITY_PREFIXES.length - 1);
  });

  it('нет квеста, требующего город под бóльшим гейтом, чем его собственный', () => {
    // Ловушка, ломавшая игру: квест открывается на 5 значков, но просит
    // посетить локацию, которая сама за гейтом на 8 (ceruleanCave/darkCave/
    // mtSilver) — сдача становилась невозможной навсегда.
    const GATED_8 = ['ceruleanCave', 'darkCave', 'mtSilver'];
    for (const q of quests) {
      const gate = questRequiredBadges(q.id);
      if (gate == null) continue;
      const locs: string[] = (q as any).verify?.locs || [];
      for (const loc of GATED_8) {
        if (!locs.includes(loc)) continue;
        expect(gate,
          `${q.id} открывается на ${gate} значках, но требует ${loc} (8 значков)`)
          .toBeGreaterThanOrEqual(8);
      }
    }
  });
});

describe('интеграция в UI', () => {
  const npcsSrc = readFileSync('src/ui/npcs.ts', 'utf8');
  const css = readFileSync('style.css', 'utf8');

  it('NPC-диалог проверяет гейт и рисует подсказку', () => {
    expect(npcsSrc).toMatch(/isQuestUnlocked/);
    expect(npcsSrc).toMatch(/questLockHint/);
    expect(npcsSrc).toMatch(/npc-quest-lock/);
  });

  it('закрытый квест не получает кнопку «Взять»', () => {
    // Гейт стоит ДО расчёта кнопок: locked → return
    const seg = npcsSrc.slice(npcsSrc.indexOf('ГЕЙТ ПО ПРОГРЕССИИ'));
    expect(seg.indexOf('if (!unlocked)')).toBeLessThan(seg.indexOf("btn.innerText = 'Взять'"));
  });

  it('есть стиль закрытого квеста', () => {
    expect(css).toMatch(/\.npc-quest-item\.locked\s*\{/);
    expect(css).toMatch(/\.npc-quest-lock\s*\{/);
  });
});