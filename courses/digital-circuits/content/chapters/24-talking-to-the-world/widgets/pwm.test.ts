import { describe, expect, test } from 'vitest';
import { rippleEstimate, runPwm } from './pwm';

describe('PWM through an RC filter', () => {
  test('settled, the output is duty × 5 V, whatever the frequency', () => {
    for (const [duty, f, C] of [[0.25, 1000, 1e-5], [0.5, 10000, 1e-6], [0.75, 1000, 1e-5], [0.1, 10000, 1e-5]] as const) {
      const r = runPwm({ duty, frequency: f, capacitance: C });
      expect(r.mean, `${duty} at ${f} Hz`).toBeCloseTo(5 * duty, 1);
    }
  });

  test('the ripple matches 5 V · D(1 − D) / (f τ) when τ is long against the period, and shrinks as f or C grow', () => {
    const slow = runPwm({ duty: 0.5, frequency: 1000, capacitance: 1e-5 });
    expect(slow.ripple).toBeGreaterThan(0.8 * rippleEstimate(0.5, 1000, 1e-2));
    expect(slow.ripple).toBeLessThan(1.2 * rippleEstimate(0.5, 1000, 1e-2));
    const fast = runPwm({ duty: 0.5, frequency: 10000, capacitance: 1e-5 });
    expect(fast.ripple).toBeLessThan(slow.ripple / 8);
    const big = runPwm({ duty: 0.5, frequency: 1000, capacitance: 1e-4 });
    expect(big.ripple).toBeLessThan(slow.ripple / 8);
  });

  test('a small capacitor at a low frequency follows the pulses: the output swings almost the whole way', () => {
    const r = runPwm({ duty: 0.5, frequency: 100, capacitance: 1e-6 });
    expect(r.ripple).toBeGreaterThan(4);
  });

  test('from power-on the output climbs towards the average like 1 − e^(−t/τ)', () => {
    const r = runPwm({ duty: 0.5, frequency: 10000, capacitance: 1e-5, from: 'start' });
    const tau = r.tau;
    expect(tau).toBeCloseTo(0.01, 6);
    const at = (t: number) => {
      let i = 0;
      while (i + 1 < r.t.length && r.t[i + 1]! <= t) i++;
      return r.out[i]!;
    };
    for (const k of [1, 2, 3]) expect(at(k * tau)).toBeCloseTo(2.5 * (1 - Math.exp(-k)), 1);
    expect(r.window).toBeGreaterThanOrEqual(5 * tau);
  });

  test('the pulse train is at the requested duty', () => {
    const r = runPwm({ duty: 0.25, frequency: 1000, capacitance: 1e-5 });
    let high = 0;
    for (let i = 0; i + 1 < r.t.length; i++) high += r.pwm[i]! * (r.t[i + 1]! - r.t[i]!);
    expect(high / r.t[r.t.length - 1]!).toBeCloseTo(0.25, 1);
  });
});
