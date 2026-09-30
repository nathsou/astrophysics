import { describe, expect, test } from 'vitest';
import { DEFAULT_ASTABLE, predicted, simulate } from './astable555';

describe('the 555 astable, built from its parts', () => {
  test('the textbook formula', () => {
    const p = predicted(DEFAULT_ASTABLE);
    // 1.44 / ((1 k + 2 × 10 k) × 4.7 µ) = 14.6 Hz, and a duty cycle of 11/21.
    expect(p.frequency).toBeCloseTo(14.6, 0);
    expect(p.duty).toBeCloseTo(11 / 21, 3);
  });

  test('the simulated circuit oscillates within 5 % of the formula', () => {
    const w = simulate(DEFAULT_ASTABLE);
    const p = predicted(DEFAULT_ASTABLE);
    expect(Math.abs(w.frequency / p.frequency - 1)).toBeLessThan(0.05);
    expect(Math.abs(w.duty - p.duty)).toBeLessThan(0.04);
  });

  test('the capacitor swings between one third and two thirds of the supply', () => {
    const w = simulate(DEFAULT_ASTABLE);
    const start = Math.floor(w.t.length / 2);
    const cap = Array.from(w.cap.slice(start));
    expect(Math.min(...cap)).toBeGreaterThan(1.55);
    expect(Math.min(...cap)).toBeLessThan(1.75);
    expect(Math.max(...cap)).toBeGreaterThan(3.25);
    expect(Math.max(...cap)).toBeLessThan(3.45);
  });

  test('other component values, across the widget’s whole range, follow the formula too', () => {
    for (const a of [
      { r1: 4700, r2: 47000, c: 1e-6 },
      { r1: 1000, r2: 2200, c: 10e-6 },
      { r1: 100, r2: 1000, c: 1e-7 },
      { r1: 10000, r2: 100000, c: 1e-6 },
      { r1: 10000, r2: 1000, c: 1e-5 },
      { r1: 1000, r2: 100000, c: 1e-5 },
      // R1 up to 1 MΩ (a duty cycle near 100 %), with the ideal rail as the supply.
      { r1: 100000, r2: 10000, c: 1e-6 },
      { r1: 1e6, r2: 10000, c: 1e-7 },
      { r1: 1e6, r2: 1000, c: 1e-7 },
      { r1: 1e6, r2: 100000, c: 1e-6 },
      { r1: 330000, r2: 4700, c: 4.7e-6 },
    ]) {
      const w = simulate(a);
      const p = predicted(a);
      expect(Math.abs(w.frequency / p.frequency - 1), JSON.stringify(a)).toBeLessThan(0.08);
    }
  });
});
