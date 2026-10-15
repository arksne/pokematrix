import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../../game/state.js';
import {
  pickGymMonName, rollGymMonIVs, buildGymPrizeMon, placePrizeMon,
} from '../gym-reward.js';
import { natures } from '../../data/natures.js';

/**
 * Приз гима (спека 2.3): покемон из коллекции лидера — всегда.
 * Вид случаен из команды лидера; 1 уровень; IV 20–30 (повышенные,
 * не идеальные); характер случаен; шайни гарантирован; кладут
 * в команду, при полной — в PC. Чистые функции/состояние, без DOM.
 */
const TEAM = [{ name: 'geodude' }, { name: 'onix' }, { name: 'rhyhorn' }];

const pokeData = {
  name: 'geodude', id: 74,
  stats: [{ base_stat: 40 }],
  abilities: [{ ability: { name: 'rock-head' }, is_hidden: false }],
};

beforeEach(() => {
  state.myTeam = [];
  state.pcBoxes = [[]];
});

describe('pickGymMonName', () => {
  it('пустая команда — null', () => {
    expect(pickGymMonName([])).toBeNull();
    expect(pickGymMonName(null as any)).toBeNull();
  });

  it('детерминированный выбор по rand', () => {
    // 0 → первый, ~1 → последний
    expect(pickGymMonName(TEAM, () => 0)).toBe('geodude');
    expect(pickGymMonName(TEAM, () => 0.999)).toBe('rhyhorn');
  });

  it('вид строго из команды лидера', () => {
    for (let i = 0; i < 100; i++) {
      expect(TEAM.map((m) => m.name)).toContain(pickGymMonName(TEAM)!);
    }
  });
});

describe('rollGymMonIVs (спека 2.3: 20–30)', () => {
  it('границы: rand 0 → все 20, rand ~1 → все 30', () => {
    expect(rollGymMonIVs(() => 0)).toEqual({ hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 });
    expect(rollGymMonIVs(() => 0.999)).toEqual({ hp: 30, atk: 30, def: 30, spa: 30, spd: 30, spe: 30 });
  });

  it('всегда 20–30, никогда не идеальные (50)', () => {
    for (let i = 0; i < 300; i++) {
      const ivs = rollGymMonIVs();
      for (const v of Object.values(ivs)) {
        expect(v).toBeGreaterThanOrEqual(20);
        expect(v).toBeLessThanOrEqual(30);
        expect(v).not.toBe(50);
      }
    }
  });
});

describe('buildGymPrizeMon (спека 2.3)', () => {
  it('1 уровень, EV 0, шайни по флагу, характер случайный/оверрайд', () => {
    const shiny = buildGymPrizeMon(pokeData, 1, { isShiny: true }, () => 0.5, { uid: 'g1', trainerId: 't' });
    expect(shiny.baseLevel).toBe(1);
    expect(shiny.isShiny).toBe(true);
    expect(shiny.evs).toEqual({ hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
    expect(shiny.hasBred).toBe(false);
    expect(shiny.isEgg).toBe(false);
    expect(shiny.abilityName).toBe('rock-head');
    expect(shiny.natureIdx).toBeGreaterThanOrEqual(0);
    expect(shiny.natureIdx).toBeLessThan(natures.length);

    const fixed = buildGymPrizeMon(pokeData, 1, { isShiny: true, natureIdx: 3 }, () => 0.5, { uid: 'g2', trainerId: 't' });
    expect(fixed.natureIdx).toBe(3);

    const notShiny = buildGymPrizeMon(pokeData, 1, {}, () => 0.5, { uid: 'g3', trainerId: 't' });
    expect(notShiny.isShiny).toBe(false);
  });

  it('IV 20–30 и HP по формуле от IV', () => {
    const mon = buildGymPrizeMon(pokeData, 1, { isShiny: true }, () => 0, { uid: 'g', trainerId: 't' });
    expect(mon.ivs).toEqual({ hp: 20, atk: 20, def: 20, spa: 20, spd: 20, spe: 20 });
    // maxHp = floor(0.01*(2*40+20)*1)+1+10 = 12
    expect(mon.maxHp).toBe(12);
    expect(mon.currentHp).toBe(12);
  });

  it('буква симпатии и пол валидны', () => {
    for (let i = 0; i < 50; i++) {
      const mon = buildGymPrizeMon(pokeData, 1, { isShiny: true }, Math.random, { uid: `g${i}`, trainerId: 't' });
      expect(['A', 'T', 'G']).toContain(mon.breedLetter);
      expect(['male', 'female']).toContain(mon.gender);
    }
  });
});

describe('placePrizeMon', () => {
  const mon = () => ({ uid: Math.random().toString(36).slice(2) });

  it('есть место — в команду', () => {
    expect(placePrizeMon(mon())).toBe('team');
    expect(state.myTeam).toHaveLength(1);
  });

  it('команда полна (6) — в PC, команда не растёт', () => {
    state.myTeam = [mon(), mon(), mon(), mon(), mon(), mon()];
    const prize = mon();
    expect(placePrizeMon(prize)).toBe('pc');
    expect(state.myTeam).toHaveLength(6);
    expect(state.pcBoxes[0]).toContain(prize);
  });

  it('команда полна и боксов нет — бокс создаётся', () => {
    state.myTeam = [mon(), mon(), mon(), mon(), mon(), mon()];
    state.pcBoxes = [];
    expect(placePrizeMon(mon())).toBe('pc');
    expect(state.pcBoxes).toHaveLength(1);
  });
});
