import { describe, expect, test } from 'vitest';
import { acceptReject, breitWigner, choice, exponential, normal, poisson, rng, tabulated } from './index.ts';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = mean(xs);
  return xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
};

describe('rng', () => {
  test('is deterministic', () => {
    const a = rng(42), b = rng(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  test('different seeds differ; values are in [0, 1)', () => {
    const a = rng(1), b = rng(2);
    let same = 0;
    for (let i = 0; i < 100; i++) {
      const x = a();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      if (x === b()) same++;
    }
    expect(same).toBe(0);
  });
  test('is uniform (mean and variance)', () => {
    const r = rng(5);
    const xs = Array.from({ length: 50000 }, () => r());
    expect(mean(xs)).toBeCloseTo(0.5, 2);
    expect(variance(xs)).toBeCloseTo(1 / 12, 2);
  });
  test('forks are independent of each other', () => {
    const r = rng(9);
    const a = r.fork('a'), b = r.fork('b');
    expect(a()).not.toBe(b());
  });
});

describe('samplers', () => {
  const N = 40000;
  test('normal', () => {
    const r = rng(1);
    const xs = Array.from({ length: N }, () => normal(r, 3, 2));
    expect(mean(xs)).toBeCloseTo(3, 1);
    expect(variance(xs)).toBeCloseTo(4, 0);
  });
  test('exponential has the given mean', () => {
    const r = rng(2);
    expect(mean(Array.from({ length: N }, () => exponential(r, 2.5)))).toBeCloseTo(2.5, 1);
  });
  test('poisson mean equals variance', () => {
    const r = rng(3);
    for (const mu of [0.7, 4, 50]) {
      const xs = Array.from({ length: N }, () => poisson(r, mu));
      expect(mean(xs)).toBeCloseTo(mu, 0);
      expect(variance(xs) / mu).toBeGreaterThan(0.9);
      expect(variance(xs) / mu).toBeLessThan(1.1);
    }
  });
  test('Breit–Wigner median is the mass', () => {
    const r = rng(4);
    const xs = Array.from({ length: N }, () => breitWigner(r, 91.19, 2.5)).sort((a, b) => a - b);
    expect(xs[N >> 1]).toBeCloseTo(91.19, 1);
  });
  test('accept–reject samples a triangle', () => {
    const r = rng(5);
    const xs = Array.from({ length: 20000 }, () => acceptReject(r, (x) => x, 0, 1, 1).x);
    expect(mean(xs)).toBeCloseTo(2 / 3, 1);
  });
  test('choice follows weights', () => {
    const r = rng(6);
    let hits = 0;
    for (let i = 0; i < N; i++) if (choice(r, [1, 3]) === 1) hits++;
    expect(hits / N).toBeCloseTo(0.75, 1);
  });
  test('tabulated density', () => {
    const r = rng(7);
    const s = tabulated([1, 1, 2, 4], 0, 4);
    const xs = Array.from({ length: N }, () => s(r));
    expect(xs.filter((x) => x >= 3).length / N).toBeCloseTo(0.5, 1);
  });
});
