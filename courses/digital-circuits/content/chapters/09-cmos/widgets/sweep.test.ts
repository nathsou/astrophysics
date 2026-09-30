import { describe, expect, test } from 'vitest';
import { at, bands, K_N, K_P, sweep, switchingPoint } from './sweep';

describe('the inverter’s transfer curve, on the analog engine', () => {
  const equal = sweep(2);
  const weak = sweep(1);

  test('rail to rail, and falling', () => {
    for (const s of [equal, weak]) {
      expect(s.vout[0]).toBeGreaterThan(4.999);
      expect(s.vout[s.vout.length - 1]).toBeLessThan(0.001);
      for (let i = 1; i < s.vout.length; i++) expect(s.vout[i]!).toBeLessThanOrEqual(s.vout[i - 1]! + 1e-6);
    }
  });

  test('with a pMOS twice as wide the switching point is half way; at equal size the weaker pMOS gives way earlier', () => {
    expect(switchingPoint(equal)).toBeGreaterThan(2.45);
    expect(switchingPoint(equal)).toBeLessThan(2.55);
    // Solving kn (Vm − 1)² = kp (4 − Vm)² with kn = 2 kp gives 2.24 V (channel-length modulation moves it a little).
    expect(K_N / K_P).toBe(2);
    expect(switchingPoint(weak)).toBeGreaterThan(2.15);
    expect(switchingPoint(weak)).toBeLessThan(2.35);
  });

  test('in the steady states the supply gives picoamps; in the middle, milliamps', () => {
    const peak = Math.max(...equal.idd);
    expect(equal.idd[0]!).toBeLessThan(1e-9);
    expect(equal.idd[equal.idd.length - 1]!).toBeLessThan(1e-9);
    expect(peak).toBeGreaterThan(5e-3);
    expect(peak / Math.max(equal.idd[0]!, 1e-15)).toBeGreaterThan(1e6);
  });

  test('the peak is at the switching point, where both transistors are in saturation', () => {
    const i = equal.idd.indexOf(Math.max(...equal.idd));
    expect(Math.abs(equal.vin[i]! - 2.5)).toBeLessThan(0.3);
    expect(equal.mp[i]).toBe('saturation');
    expect(equal.mn[i]).toBe('saturation');
  });

  test('regimes: pull-up alone, both, pull-down alone', () => {
    const b = bands(equal);
    expect(b.map((x) => x.regime)).toEqual(['pull-up', 'both', 'pull-down']);
    // Both conduct only between Vt and Vdd − Vt: 1 V to 4 V.
    expect(b[1]!.from).toBeGreaterThan(0.95);
    expect(b[1]!.from).toBeLessThan(1.1);
    expect(b[1]!.to).toBeGreaterThan(3.9);
    expect(b[1]!.to).toBeLessThan(4.05);
  });

  test('interpolation', () => {
    expect(at(equal, equal.vout, 0)).toBeGreaterThan(4.99);
    expect(at(equal, equal.vout, 2.5)).toBeGreaterThan(1);
    expect(at(equal, equal.vout, 2.5)).toBeLessThan(4);
  });
});
