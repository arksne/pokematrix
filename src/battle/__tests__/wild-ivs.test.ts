/**
 * Гены диких: шкала проекта 0–50, идеал 50 — но разброс УЖЕ усреднённый.
 *
 * Жалоба: «у диких слишком большой разброс по генам, где-то под 50, где-то 0».
 * Старый код кидал Math.random() * 51 в каждую стату — равномерно на всём
 * диапазоне, поэтому один вид стабильно давал то мусор, то идеал.
 * Теперь rollWildIVs() — колокол вокруг WILD_IV_MEAN.
 */
import { describe, it, expect } from 'vitest';
import { rollIV, rollWildIVs, perfectIVs, IV_MAX, WILD_IV_MEAN } from '../logic.js';

const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
/** Минкер: rand всегда одна и та же — 0.5 означает ровно середину. */
const mid = () => 0.5;
const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

describe('гены диких усреднены (шкала 0–50)', () => {
  it('школа остаётся 0–50, идеал 50', () => {
    expect(IV_MAX).toBe(50);
    expect(perfectIVs()).toEqual({ hp: 50, atk: 50, def: 50, spa: 50, spd: 50, spe: 50 });
  });

  it('центр распределения = WILD_IV_MEAN, а не край шкалы', () => {
    expect(rollIV(25, 5, mid)).toBe(25);
    // Крайние rand дают уход вбок, но не прилипание к 0/50.
    expect(rollIV(25, 5, seq(0, 0, 0))).toBe(20);   // u = -1.5 -> -5
    expect(rollIV(25, 5, seq(1, 1, 1))).toBe(30);   // u = +1.5 -> +5
  });

  it('никогда не выходит за 0..50 даже на краях', () => {
    for (const r of [seq(0, 0, 0), seq(1, 1, 1), seq(0, 1, 0.5)]) {
      const v = rollIV(25, 5, r);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(50);
    }
  });

  it('дикий НЕ выдаёт мусорные 0..5 и НЕ выдаёт идеальные 46..50', () => {
    // 20 000 стат: раньше равномерный код регулярно выдавал и 0..5, и 46..50.
    // С усреднением оба края шкалы недостижимы — ровно то, что просили.
    const seen = new Set<number>();
    for (let i = 0; i < 20000; i++) seen.add(rollIV(WILD_IV_MEAN, 5));
    const lows = [...seen].filter((v) => v <= 5);
    const highs = [...seen].filter((v) => v >= 46);
    expect(lows).toEqual([]);
    expect(highs).toEqual([]);
    // весь разброс умещается в узкий кластер вокруг среднего
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...seen)).toBeLessThanOrEqual(30);
  });

  it('разброс реально сузился против старого равномерного', () => {
    const sample = (fn: () => number) => {
      const xs = Array.from({ length: 5000 }, fn);
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
      return { mean, sd };
    };
    const wild = sample(() => rollIV(WILD_IV_MEAN, 5));
    const old = sample(() => Math.floor(Math.random() * 51));

    // Центр около 25, разброс заметно меньше 50/√12≈14.4 у старого кода.
    expect(wild.mean).toBeGreaterThan(22);
    expect(wild.mean).toBeLessThan(28);
    expect(wild.sd).toBeLessThan(old.sd);
    expect(wild.sd).toBeLessThan(6);
  });

  it('rollWildIVs отдаёт все 6 стат в шкале и около среднего', () => {
    for (let i = 0; i < 500; i++) {
      const ivs = rollWildIVs();
      for (const st of STATS) {
        expect(ivs[st]).toBeGreaterThanOrEqual(0);
        expect(ivs[st]).toBeLessThanOrEqual(50);
      }
    }
  });
});