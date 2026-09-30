import { describe, expect, test } from 'vitest';
import { DECAY_FACTS, HALF_LIFE, LIMIT_TABLE, charge, decay, doublingTime, gapAfterOneTau, growthAfterOneTau, halfLifeOf, steps, tauOf, timeToCharge, timeToDecay } from './expo';
import { DB_PER_BIT, LANDMARKS, dbOfBits, fromDb, toDb } from './decibels';

describe('the 63 % rule', () => {
  test('one τ closes 63.2 % of the gap', () => {
    expect(charge(1)).toBeCloseTo(0.6321, 4);
    expect(decay(1)).toBeCloseTo(0.3679, 4);
    expect(charge(0)).toBe(0);
    expect(charge(5)).toBeCloseTo(0.9933, 4);
  });
  test('each τ multiplies the gap by the same factor', () => {
    for (const t of [0, 0.3, 1, 2.5]) expect(decay(t + 1) / decay(t)).toBeCloseTo(Math.exp(-1), 12);
  });
  test('half-life is ln 2 τ = 0.693 τ', () => {
    expect(HALF_LIFE).toBeCloseTo(0.6931, 4);
    expect(decay(HALF_LIFE)).toBeCloseTo(0.5, 12);
    expect(timeToCharge(0.5)).toBeCloseTo(0.6931, 4);
    expect(halfLifeOf(1e-3)).toBeCloseTo(0.6931e-3, 6);
    expect(tauOf(halfLifeOf(2))).toBeCloseTo(2, 12);
  });
  test('times to reach a level match chapter 4’s table', () => {
    expect(timeToCharge(0.3)).toBeCloseTo(0.357, 3);
    expect(timeToCharge(0.7)).toBeCloseTo(1.204, 3);
    expect(timeToCharge(0.9)).toBeCloseTo(2.303, 3);
    expect(timeToCharge(0.99)).toBeCloseTo(4.605, 3);
    expect(timeToDecay(0.01)).toBeCloseTo(4.605, 3);
    expect(timeToCharge(1)).toBeNaN();
    expect(timeToDecay(0)).toBeNaN();
  });
  test('decay facts', () => {
    expect(DECAY_FACTS.find((f) => f.label === 'half')!.t).toBeCloseTo(0.6931, 4);
    expect(DECAY_FACTS.find((f) => f.label.startsWith('1/e'))!.t).toBeCloseTo(1, 12);
  });
});

describe('the step-by-step argument', () => {
  test('(1 − 1/N)^N tends to 1/e', () => {
    expect(gapAfterOneTau(1)).toBe(0);
    expect(gapAfterOneTau(2)).toBeCloseTo(0.25, 12);
    expect(gapAfterOneTau(10)).toBeCloseTo(0.3487, 4);
    expect(gapAfterOneTau(1000)).toBeCloseTo(0.3677, 4);
    expect(gapAfterOneTau(1_000_000)).toBeCloseTo(Math.exp(-1), 6);
    expect(LIMIT_TABLE.map((r) => r.gap)).toEqual([...LIMIT_TABLE.map((r) => r.gap)].sort((a, b) => a - b));
  });
  test('(1 + 1/N)^N tends to e', () => {
    expect(growthAfterOneTau(1)).toBe(2);
    expect(growthAfterOneTau(1_000_000)).toBeCloseTo(Math.E, 5);
  });
  test('charging by steps: after one τ the gap is (1 − 1/N)^N', () => {
    for (const n of [1, 2, 4, 10]) {
      const pts = steps('charge', n, 1);
      expect(pts.length).toBe(n + 1);
      expect(1 - pts.at(-1)!.v).toBeCloseTo(gapAfterOneTau(n), 12);
    }
  });
  test('decaying by steps is the mirror image', () => {
    const c = steps('charge', 10, 3);
    const d = steps('decay', 10, 3);
    c.forEach((p, i) => expect(p.v + d[i]!.v).toBeCloseTo(1, 12));
  });
  test('steps converge on the exact curve as N grows, from below when charging', () => {
    const err = (n: number) => Math.abs(steps('charge', n, 2).at(-1)!.v - charge(2));
    expect(err(4)).toBeGreaterThan(err(20));
    expect(err(20)).toBeGreaterThan(err(100));
    expect(err(100)).toBeLessThan(0.002);
    // Charging by steps never overshoots the final value.
    for (const p of steps('charge', 3, 6)) expect(p.v).toBeLessThanOrEqual(1);
  });
  test('rule of 72', () => {
    expect(doublingTime(0.07)).toBeCloseTo(10.24, 2);
  });
});

describe('decibels', () => {
  test('landmarks', () => {
    expect(toDb(2, 'power')).toBeCloseTo(3.01, 2);
    expect(toDb(2, 'voltage')).toBeCloseTo(6.02, 2);
    expect(toDb(10, 'power')).toBeCloseTo(10, 12);
    expect(toDb(10, 'voltage')).toBeCloseTo(20, 12);
    expect(toDb(1, 'power')).toBe(0);
    expect(toDb(0.5, 'power')).toBeCloseTo(-3.01, 2);
    expect(toDb(0, 'power')).toBeNaN();
    expect(toDb(Math.SQRT1_2, 'voltage')).toBeCloseTo(-3.01, 2);
  });
  test('round trip', () => {
    for (const k of ['power', 'voltage'] as const) for (const r of [0.001, 0.5, 1, 3, 1000]) expect(fromDb(toDb(r, k), k)).toBeCloseTo(r, 9);
  });
  test('bits', () => {
    expect(DB_PER_BIT).toBeCloseTo(6.02, 2);
    expect(dbOfBits(8)).toBeCloseTo(48.16, 2);
    expect(dbOfBits(16)).toBeCloseTo(96.33, 2);
  });
  test('landmark table is right', () => {
    for (const l of LANDMARKS) {
      const p = fromDb(l.db, 'power');
      const v = fromDb(l.db, 'voltage');
      const parse = (s: string) => Number(s.replace('×', '').replace(/,/g, '').replace('10⁶', '1e6'));
      expect(Math.abs(Math.log(parse(l.power) / p)), `${l.db} dB power`).toBeLessThan(0.03);
      expect(Math.abs(Math.log(parse(l.voltage) / v)), `${l.db} dB voltage`).toBeLessThan(0.03);
    }
  });
});
