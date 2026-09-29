import { describe, expect, test } from 'vitest';
import { autosetIndex, charge, checkTau, pullupRise, tau, timeTo, wireMetrics } from './rc';

describe('RC formulas', () => {
  test('63 % after one τ, more than 99 % after five', () => {
    const t = tau(1000, 1e-6);
    expect(t).toBeCloseTo(1e-3, 12);
    expect(charge(0, 5, t, t) / 5).toBeCloseTo(0.632, 3);
    expect(charge(0, 5, t, 5 * t) / 5).toBeGreaterThan(0.99);
  });

  test('time to reach half the supply is τ·ln 2', () => {
    expect(timeTo(0, 2.5, 5, 1)).toBeCloseTo(Math.LN2, 12);
    expect(timeTo(0, 3.5, 5, 1)).toBeCloseTo(Math.log(1 / 0.3), 12);
  });

  test('wire: 50 Ω into 10 pF is 0.5 ns, a 100 MHz wire dissipates 25 mW at 5 V', () => {
    const m = wireMetrics(50, 10e-12, 5);
    expect(m.tau).toBeCloseTo(0.5e-9, 15);
    expect(m.rise).toBeCloseTo(1.1e-9, 12);
    expect(m.fmax).toBeCloseTo(200e6, -3);
    expect(m.energy).toBeCloseTo(250e-12, 15);
    expect(m.power(100e6)).toBeCloseTo(25e-3, 6);
  });

  test('pull-up rise time: 0.847 RC; 1.5 kΩ × 400 pF is 0.51 µs', () => {
    expect(pullupRise(1500, 400e-12)).toBeCloseTo(0.508e-6, 8);
  });

  test('autoset chooses the timebase nearest to τ', () => {
    const list = [1e-4, 2e-4, 5e-4, 1e-3, 2e-3];
    expect(list[autosetIndex(list, 0.9e-3)]).toBe(1e-3);
    expect(list[autosetIndex(list, 0.25e-3)]).toBe(2e-4);
  });
});

describe('checkTau', () => {
  const base = { vs: 5, t1Div: 1, edgeDiv: 1, R: 1000, C: 1e-6 };
  test('accepts a good measurement', () => {
    const r = checkTau({ ...base, dt: 1.02e-3, v1: 0.03, v2: 3.2 });
    expect(r.ok).toBe(true);
    expect(r.text).toMatch(/agree/);
  });
  test('asks for T1 on the edge, T2 at 63 %, and flags a wrong Δt', () => {
    expect(checkTau({ ...base, t1Div: 3, dt: 1e-3, v1: 0, v2: 3.16 }).text).toMatch(/T1/);
    expect(checkTau({ ...base, dt: 0.5e-3, v1: 0, v2: 2 }).text).toMatch(/63/);
    const off = checkTau({ ...base, dt: 2e-3, v1: 0, v2: 3.16 });
    expect(off.ok).toBe(false);
    expect(off.text).toMatch(/more/);
  });
});
