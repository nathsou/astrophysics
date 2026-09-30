import { describe, expect, test } from 'vitest';
import { normal, rng } from '../random/index.ts';
import { bumpHunt, bestWindow, scanStatistic, scanWindows } from './bumphunt.ts';
import { poissonSample, poissonTail, pToZ } from './counting.ts';
import { Hist1D } from './hist.ts';

const edges = Array.from({ length: 81 }, (_, i) => 100 + i);
const bkgExpected = edges.slice(0, -1).map((e) => 400 * Math.exp(-0.02 * (e + 0.5 - 100)));

describe('bump hunt', () => {
  test('scanWindows: prefix sums give the right counts and the p-value is the Poisson tail', () => {
    const w = scanWindows([1, 5, 9, 2, 0], [2, 2, 2, 2, 2], [2]);
    expect(w.length).toBe(4);
    expect(w[1]!.observed).toBe(14);
    expect(w[1]!.expected).toBe(4);
    expect(w[1]!.pLocal).toBeCloseTo(poissonTail(14, 4), 12);
    expect(w[3]!.pLocal).toBe(1); // deficit
    expect(bestWindow(w)!.start).toBe(1);
  });
  test('finds an injected bump at the right place, and its local significance is high', () => {
    const r = rng(10);
    const h = new Hist1D(edges);
    bkgExpected.forEach((e, i) => (h.counts[i] = h.sumw2[i] = poissonSample(r, e)));
    // Inject 300 events of a Gaussian at 140 with width 2.
    for (let i = 0; i < 300; i++) h.fill(normal(r, 140, 2));
    const res = bumpHunt(h, [2, 3, 4, 6, 8], { background: bkgExpected });
    expect(res.best).not.toBeNull();
    const centre = 0.5 * (res.best!.lo + res.best!.hi);
    expect(Math.abs(centre - 140)).toBeLessThan(2);
    expect(res.best!.z).toBeGreaterThan(5);
    expect(res.t).toBeGreaterThan(10);
  });
  test('with no background given it fits an exponential and still finds the bump', () => {
    const r = rng(11);
    const h = new Hist1D(edges);
    bkgExpected.forEach((e, i) => (h.counts[i] = h.sumw2[i] = poissonSample(r, e)));
    for (let i = 0; i < 500; i++) h.fill(normal(r, 120, 2));
    const res = bumpHunt(h, [3, 4, 6]);
    expect(Math.abs(0.5 * (res.best!.lo + res.best!.hi) - 120)).toBeLessThan(3);
    expect(res.best!.z).toBeGreaterThan(5);
    expect(res.background.length).toBe(80);
  });
  test('background only: the best local Z of a scan is usually 2–3σ, not 0: the look-elsewhere effect (400 toys)', () => {
    const r = rng(12);
    const widths = [2, 3, 4, 6, 8];
    const z: number[] = [];
    for (let k = 0; k < 400; k++) {
      const toy = bkgExpected.map((e) => poissonSample(r, e));
      const t = scanStatistic(toy, bkgExpected, widths);
      z.push(pToZ(Math.exp(-t)));
    }
    z.sort((a, b) => a - b);
    const med = z[200]!;
    console.log(`median of the largest local Z in background-only scans: ${med.toFixed(2)}σ; 95th percentile ${z[380]!.toFixed(2)}σ`);
    expect(med).toBeGreaterThan(1.8);
    expect(med).toBeLessThan(3.2);
    expect(z[380]!).toBeGreaterThan(2.5);
  });
});

