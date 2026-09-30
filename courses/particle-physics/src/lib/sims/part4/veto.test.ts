import { describe, expect, test } from 'vitest';
import { rng } from '../../hep/random/index.ts';
import { emissionRate } from '../../hep/shower/index.ts';
import { firstEmission, noEmission, overRate, traceVeto } from './veto.ts';

describe('the Sudakov veto algorithm', () => {
  const E = 45.6, tmax = (E / 2) ** 2, tmin = 1, alpha = 0.2;
  test('the overestimate is never below the true rate', () => {
    const over = overRate(E, tmin, alpha);
    for (let k = 0; k <= 60; k++) {
      const t = tmin * Math.pow(tmax / tmin, k / 60);
      expect(emissionRate(t, { parton: 'q', E, alphaS: alpha })).toBeLessThanOrEqual(over * (1 + 1e-12));
    }
  });
  test('the fraction of evolutions with no emission equals the Sudakov factor', () => {
    const r = rng(11);
    const N = 40000;
    let none = 0;
    for (let i = 0; i < N; i++) if (firstEmission(E, tmax, tmin, alpha, r) === null) none++;
    const p = none / N;
    const exact = noEmission(E, tmax, tmin, alpha);
    expect(Math.abs(p - exact)).toBeLessThan(4 * Math.sqrt((exact * (1 - exact)) / N));
  });
  test('the cumulative distribution of the first emission follows 1 − Δ(tmax, t)', () => {
    const r = rng(5);
    const N = 30000;
    const ts: number[] = [];
    for (let i = 0; i < N; i++) {
      const t = firstEmission(E, tmax, tmin, alpha, r);
      if (t !== null) ts.push(t);
    }
    for (const cut of [4, 25, 100]) {
      // fraction of all evolutions whose first emission is above `cut`
      const frac = ts.filter((t) => t > cut).length / N;
      const exact = 1 - noEmission(E, tmax, cut, alpha);
      expect(Math.abs(frac - exact)).toBeLessThan(4 * Math.sqrt((exact * (1 - exact)) / N) + 1e-3);
    }
  });
  test('a trace lists vetoed trials and ends with an accepted one', () => {
    const r = rng(2);
    let seen = 0;
    for (let i = 0; i < 200; i++) {
      const tr = traceVeto(E, tmax, tmin, alpha, r);
      if (tr.length && tr[tr.length - 1]!.accepted) {
        seen++;
        expect(tr.slice(0, -1).every((x) => !x.accepted)).toBe(true);
        for (let k = 1; k < tr.length; k++) expect(tr[k]!.t).toBeLessThan(tr[k - 1]!.t);
      }
    }
    expect(seen).toBeGreaterThan(50);
  });
});
