import { describe, expect, test } from 'vitest';
import { setOverride } from '../hooks.ts';
import { rng } from '../random/index.ts';
import { cls, clsCounting, clsModel, expectedLimitsCounting, expectedUpperLimit, upperLimit, upperLimitCounting } from './limits.ts';
import { asimovData, type CountingModel } from './likelihood.ts';
import { pseudoExperiments } from './significance.ts';

/** An independent Poisson cdf by direct summation of the pmf (no library function). */
function cdf(k: number, mu: number): number {
  let term = Math.exp(-mu), sum = term;
  for (let j = 1; j <= k; j++) {
    term *= mu / j;
    sum += term;
  }
  return sum;
}

describe('CLs for a counting experiment', () => {
  test('b = 3, n_obs = 3: CLs+b, CLb and CLs from direct sums, and the 95 % limit', () => {
    const b = 3, n = 3;
    // CLs(s) = P(N ≤ 3 | s + 3) / P(N ≤ 3 | 3), decreasing in s.
    const clsOf = (s: number) => cdf(n, s + b) / cdf(n, b);
    const r = clsCounting(n, 4, b);
    expect(r.clsb).toBeCloseTo(cdf(n, 7), 12);
    expect(r.clb).toBeCloseTo(cdf(n, 3), 12);
    expect(r.cls).toBeCloseTo(clsOf(4), 12);
    let lo = 0, hi = 50;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (clsOf(mid) > 0.05) lo = mid;
      else hi = mid;
    }
    const sUp = (lo + hi) / 2;
    console.log(`b = 3, n_obs = 3: s_up(95 % CLs) = ${sUp.toFixed(4)}`);
    expect(upperLimitCounting(3, 3)).toBeCloseTo(sUp, 6);
    expect(clsCounting(3, sUp, 3).cls).toBeCloseTo(0.05, 8);
    // CLs ≥ CLs+b: the prescription is conservative.
    expect(r.cls).toBeGreaterThan(r.clsb);
    // Its limit is weaker than the plain CLs+b one.
    expect(sUp).toBeGreaterThan(1.0);
  });
  test('n = 0 gives CLs = e^(−s) for any b, hence s_up = −ln 0.05 = 2.9957', () => {
    for (const b of [0.1, 3, 20]) {
      expect(clsCounting(0, 2.5, b).cls).toBeCloseTo(Math.exp(-2.5), 12);
      expect(upperLimitCounting(0, b)).toBeCloseTo(-Math.log(0.05), 6);
    }
    expect(upperLimitCounting(0, 3, 0.9)).toBeCloseTo(-Math.log(0.1), 6);
  });
  test('the observed limit grows with the observed count; for a fixed count it is weaker when the background is smaller (the same count is more of an excess)', () => {
    const lim = [0, 1, 2, 3, 5, 8].map((n) => upperLimitCounting(n, 3));
    for (let i = 1; i < lim.length; i++) expect(lim[i]).toBeGreaterThan(lim[i - 1]!);
    expect(upperLimitCounting(3, 1)).toBeGreaterThan(upperLimitCounting(3, 3));
  });
  test('expected limit bands are ordered and the median equals the limit at the median count', () => {
    const e = expectedLimitsCounting(3);
    expect(e.m2).toBeLessThanOrEqual(e.m1);
    expect(e.m1).toBeLessThanOrEqual(e.median);
    expect(e.median).toBeLessThanOrEqual(e.p1);
    expect(e.p1).toBeLessThanOrEqual(e.p2);
    expect(e.median).toBeCloseTo(upperLimitCounting(3, 3), 6); // median of Poisson(3) is 3
    expect(e.p2).toBeGreaterThan(e.m2 + 1);
  });
  test('the hook replaces cls', () => {
    expect(cls(3, 4, 3)).toBeCloseTo(clsCounting(3, 4, 3).cls, 12);
    setOverride('analysis.cls', () => 0.123);
    try {
      expect(cls(3, 4, 3)).toBe(0.123);
    } finally {
      setOverride('analysis.cls', undefined);
    }
  });
});

describe('CLs for a binned shape', () => {
  const model: CountingModel = {
    signal: [0, 2, 6, 10, 6, 2, 0],
    background: [40, 36, 33, 30, 28, 26, 24],
  };
  const data = [38, 40, 30, 33, 25, 27, 26];

  test('a single bin reduces to the exact counting result, by all three methods: asymptotic within 12 %, toys within 10 %', () => {
    const one: CountingModel = { signal: [10], background: [100] };
    const d = [104];
    const exact = clsModel(one, d, 1.5, { method: 'exact' });
    expect(exact.cls).toBeCloseTo(clsCounting(104, 15, 100).cls, 12);
    const asym = clsModel(one, d, 1.5, { method: 'asymptotic' });
    const toys = clsModel(one, d, 1.5, { method: 'toys', nToys: 4000, rng: rng(3) });
    console.log(`single bin CLs at μ = 1.5: exact ${exact.cls.toFixed(4)}, asymptotic ${asym.cls.toFixed(4)}, toys ${toys.cls.toFixed(4)}`);
    expect(Math.abs(asym.cls / exact.cls - 1)).toBeLessThan(0.12);
    expect(Math.abs(toys.cls / exact.cls - 1)).toBeLessThan(0.1);
  });
  test('asymptotic CLs agrees with pseudo-experiments for a five-bin shape (2500 toys)', () => {
    const asym = clsModel(model, data, 1.2, { method: 'asymptotic' });
    const toys = clsModel(model, data, 1.2, { method: 'toys', nToys: 2500, rng: rng(99) });
    console.log(`shape CLs at μ = 1.2: asymptotic ${asym.cls.toFixed(4)} (CLs+b ${asym.clsb.toFixed(4)}, CLb ${asym.clb.toFixed(3)}), toys ${toys.cls.toFixed(4)} (CLs+b ${toys.clsb.toFixed(4)}, CLb ${toys.clb.toFixed(3)})`);
    expect(Math.abs(asym.cls - toys.cls)).toBeLessThan(0.04);
  });
  test('the upper limit on μ: CLs(μ_up) = 0.05, and it weakens with a background uncertainty', () => {
    const u = upperLimit(model, data, { method: 'asymptotic' });
    expect(clsModel(model, data, u.observed, { method: 'asymptotic' }).cls).toBeCloseTo(0.05, 4);
    const withSyst = upperLimit({ ...model, nuisance: { name: 'bkg', relUnc: 0.2 } }, data, { method: 'asymptotic' });
    console.log(`μ_up: ${u.observed.toFixed(3)} without and ${withSyst.observed.toFixed(3)} with a 20 % background uncertainty; expected ${u.expected.median.toFixed(3)} → ${withSyst.expected.median.toFixed(3)}`);
    expect(withSyst.observed).toBeGreaterThan(u.observed);
    expect(withSyst.expected.median).toBeGreaterThan(u.expected.median);
  });
  test('expected limit bands are ordered, and 95 % of background-only toys set limits between the ±2σ bands (roughly)', () => {
    const u = upperLimit(model, asimovData(model, 0), { method: 'asymptotic' });
    const e = u.expected;
    expect(e.m2).toBeLessThan(e.m1);
    expect(e.m1).toBeLessThan(e.median);
    expect(e.median).toBeLessThan(e.p1);
    expect(e.p1).toBeLessThan(e.p2);
    // The observed limit on the Asimov data set is the median expected one.
    expect(u.observed).toBeCloseTo(e.median, 3);
    expect(expectedUpperLimit(model)).toBeCloseTo(e.median, 6);
    const toys = pseudoExperiments(model.background, 300, rng(17)).map((t) => upperLimit(model, t, { method: 'asymptotic' }).observed);
    toys.sort((a, b) => a - b);
    const q = (f: number) => toys[Math.floor(f * toys.length)]!;
    console.log(`toy limits (2.5, 16, 50, 84, 97.5 %): ${[0.025, 0.16, 0.5, 0.84, 0.975].map((f) => q(f).toFixed(3)).join(', ')}; bands ${[e.m2, e.m1, e.median, e.p1, e.p2].map((v) => v.toFixed(3)).join(', ')}`);
    expect(Math.abs(q(0.5) / e.median - 1)).toBeLessThan(0.08);
    expect(Math.abs(q(0.16) / e.m1 - 1)).toBeLessThan(0.12);
    expect(Math.abs(q(0.84) / e.p1 - 1)).toBeLessThan(0.12);
  });
  test('the exact method is refused when it does not apply; the default picks it for one bin', () => {
    expect(() => clsModel(model, data, 1, { method: 'exact' })).toThrow();
    const one: CountingModel = { signal: [10], background: [100] };
    expect(clsModel(one, [104], 1).method).toBe('exact');
    expect(clsModel(model, data, 1).method).toBe('asymptotic');
    expect(upperLimit(one, [100]).method).toBe('exact');
  });
});
