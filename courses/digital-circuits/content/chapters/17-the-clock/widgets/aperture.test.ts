import { describe, expect, test } from 'vitest';
import { APERTURE, expected, tally, trial } from './aperture';

describe('the aperture', () => {
  test('a change well before the edge is captured, well after it is not', () => {
    expect(trial(-5).outcome).toBe('new');
    expect(trial(-5).unknownFor).toBe(0);
    expect(trial(4).outcome).toBe('old');
    expect(trial(4).final).toBe(0);
  });

  test('the engine agrees with the data sheet across the whole range, away from the edges of the window', () => {
    for (let dt = -6; dt <= 4; dt += 0.5) {
      if (Math.abs(dt + APERTURE.setup) < 0.05 || Math.abs(dt - APERTURE.hold) < 0.05) continue;
      const r = trial(dt, 3);
      expect(r.outcome, `dt = ${dt}`).toBe(expected(dt));
    }
  });

  test('inside the window Q is unknown, then settles to either value', () => {
    const t = tally(-0.5, 200);
    expect(t.metastable).toBe(200);
    expect(t.settledNew).toBeGreaterThan(60);
    expect(t.settledNew).toBeLessThan(140);
  });

  test('the time spent unknown is exponentially distributed with mean tau', () => {
    const t = tally(0, 400, { ...APERTURE, tau: 1.5 });
    const mean = t.durations.reduce((a, b) => a + b, 0) / t.durations.length;
    expect(mean).toBeGreaterThan(1.2);
    expect(mean).toBeLessThan(1.8);
    // P(T > tau) = e^-1 = 37 %.
    const over = t.durations.filter((d) => d > 1.5).length / t.durations.length;
    expect(over).toBeGreaterThan(0.29);
    expect(over).toBeLessThan(0.45);
  });

  test('a larger tau means longer waits', () => {
    const a = tally(0, 200, { ...APERTURE, tau: 0.5 });
    const b = tally(0, 200, { ...APERTURE, tau: 3 });
    const mean = (x: number[]) => x.reduce((s, y) => s + y, 0) / x.length;
    expect(mean(b.durations)).toBeGreaterThan(3 * mean(a.durations));
  });

  test('the waveforms are relative to the clock edge', () => {
    const r = trial(-1, 1);
    expect(r.clk.find((s) => s[2] === 1)![0]).toBeCloseTo(0, 6);
    expect(r.d.find((s) => s[2] === 1)![0]).toBeCloseTo(-1, 6);
  });
});
