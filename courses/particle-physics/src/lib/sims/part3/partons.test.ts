import { describe, expect, test } from 'vitest';
import { samplePartonX, integrate, partonCounts, momentumShares, uValence, dValence, resolutionFm } from './partons.ts';
import { rng } from '../../hep/random/index.ts';
import { pdf } from '../../hep/gen/pdf.ts';

describe('sampling x', () => {
  test('flat in ln x: the mean of ln x is −ln(1000)/2', () => {
    const xs = samplePartonX((x) => 1 / x, 40000, rng(1), 1e-3);
    const m = xs.reduce((a, x) => a + Math.log(x), 0) / xs.length;
    expect(m).toBeCloseTo(-Math.log(1000) / 2, 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(1e-3);
    expect(Math.max(...xs)).toBeLessThanOrEqual(1);
  });
  test('x^(−1/2) (1 − x)^3 has the mean of a Beta(1/2, 4) distribution, 1/9', () => {
    const xs = samplePartonX((x) => x ** -0.5 * (1 - x) ** 3, 60000, rng(2), 1e-9);
    const m = xs.reduce((a, x) => a + x, 0) / xs.length;
    expect(m).toBeCloseTo(1 / 9, 2);
  });
  test('the up-valence distribution of the course: the sample mean matches the integral', () => {
    const f = (x: number) => uValence(x, 10);
    const xMin = 1e-3;
    const exact = integrate((x) => x * f(x), xMin) / integrate(f, xMin);
    const xs = samplePartonX(f, 30000, rng(5), xMin);
    expect(xs.reduce((a, x) => a + x, 0) / xs.length).toBeCloseTo(exact, 2);
  });
  test('deterministic', () => {
    expect(samplePartonX((x) => pdf(2, x, 10), 5, rng(9))).toEqual(samplePartonX((x) => pdf(2, x, 10), 5, rng(9)));
  });
});

describe('the proton at increasing resolution (course PDFs)', () => {
  test('valence sum rules', () => {
    expect(integrate((x) => uValence(x, 10), 1e-6)).toBeCloseTo(2, 1);
    expect(integrate((x) => dValence(x, 10), 1e-6)).toBeCloseTo(1, 1);
  });
  test('the valence momentum share falls with Q while the sea and gluons rise', () => {
    const lo = momentumShares(2), hi = momentumShares(100);
    expect(hi.valence).toBeLessThan(lo.valence);
    expect(hi.gluons).toBeGreaterThan(lo.gluons - 0.01);
    expect(lo.valence + lo.sea + lo.gluons).toBeCloseTo(1, 1);
    expect(lo.valence).toBeCloseTo(0.378, 2);
    expect(hi.valence).toBeCloseTo(0.259, 2);
  });
  test('the number of partons above a fixed x grows as x_min falls, and with Q', () => {
    const a = partonCounts(2, 0.01), b = partonCounts(2, 0.001), c = partonCounts(100, 0.001);
    expect(b.gluons).toBeGreaterThan(a.gluons);
    expect(c.sea).toBeGreaterThan(b.sea);
    expect(a.valence).toBeGreaterThan(2.4);
  });
  test('resolution', () => {
    expect(resolutionFm(1)).toBeCloseTo(0.1973, 3);
  });
});
