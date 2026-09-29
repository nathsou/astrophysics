import { describe, expect, test } from 'vitest';
import { amplification, methodCurves } from './methods';

describe('backward Euler and the trapezoidal rule on a stiff step', () => {
  test('with a step ten times τ, backward Euler climbs smoothly and never overshoots', () => {
    const m = methodCurves(10);
    for (let i = 1; i < m.euler.length; i++) {
      expect(m.euler[i]!).toBeGreaterThanOrEqual(m.euler[i - 1]! - 1e-9);
      expect(m.euler[i]!).toBeLessThanOrEqual(5 + 1e-6);
    }
  });

  test('the trapezoidal rule overshoots and rings around 5 V, its error changing sign at every step', () => {
    const m = methodCurves(10);
    expect(Math.max(...m.trapezoidal)).toBeGreaterThan(5.5);
    let flips = 0;
    for (let i = 2; i < m.trapezoidal.length; i++) if (Math.sign(m.trapezoidal[i]! - 5) !== Math.sign(m.trapezoidal[i - 1]! - 5)) flips++;
    expect(flips).toBeGreaterThanOrEqual(6);
  });

  test('the ringing shrinks by the amplification factor (1 − h/2τ)/(1 + h/2τ) each step', () => {
    const m = methodCurves(10);
    const a = amplification(10);
    expect(a.trapezoidal).toBeCloseTo(-2 / 3, 12);
    const e = m.trapezoidal.map((v) => v - 5);
    // Ratio of successive errors after the first steps, once the start-up has passed.
    expect(e[5]! / e[4]!).toBeCloseTo(a.trapezoidal, 2);
  });

  test('with a small step both methods follow the exponential; after the start-up the trapezoidal rule is the more accurate', () => {
    // A fixed-step run starts the trapezoidal rule with the wrong initial current (zero, not 5 mA): a start-up
    // error of about h/2τ that dies away as e^(−t/τ). That is why the adaptive engine starts every step
    // after a jump with backward Euler.
    const m = methodCurves(0.1, 60);
    const err = (v: number[], from: number) => Math.max(...v.map((x, i) => (m.t[i]! >= from ? Math.abs(x - m.exact[i]!) : 0)));
    expect(err(m.euler, 0)).toBeLessThan(0.3);
    expect(err(m.trapezoidal, 0)).toBeLessThan(0.3);
    expect(err(m.trapezoidal, 3)).toBeLessThan(err(m.euler, 3));
  });
});
