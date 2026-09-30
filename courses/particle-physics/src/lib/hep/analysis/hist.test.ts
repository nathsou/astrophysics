import { describe, expect, test } from 'vitest';
import { rng, normal } from '../random/index.ts';
import { Hist1D, Hist2D, cumulative } from './hist.ts';

describe('Hist1D', () => {
  test('filling, flows, edges belong to the upper bin', () => {
    const h = new Hist1D(10, 0, 10);
    h.fill(0).fill(0.999).fill(1).fill(9.999).fill(10).fill(-1).fill(NaN);
    expect(h.counts[0]).toBe(2);
    expect(h.counts[1]).toBe(1);
    expect(h.counts[9]).toBe(1);
    expect(h.overflow).toBe(2);
    expect(h.underflow).toBe(1);
    expect(h.entries).toBe(7);
    expect(h.integral()).toBe(4);
    expect(h.integral({ flow: true })).toBe(7);
  });
  test('variable binning uses binary search; log bins', () => {
    const h = new Hist1D([0, 1, 3, 10, 100]);
    h.fill(0.5).fill(1).fill(2.9).fill(3).fill(50).fill(100);
    expect(Array.from(h.counts)).toEqual([1, 2, 1, 1]);
    expect(h.overflow).toBe(1);
    expect(h.binWidth(2)).toBe(7);
    const l = Hist1D.logBins(3, 1, 1000);
    expect(l.edges[1]).toBeCloseTo(10, 9);
    l.fill(5).fill(50).fill(500);
    expect(Array.from(l.counts)).toEqual([1, 1, 1]);
  });
  test('weights: sumw2, errors, scale, add', () => {
    const h = new Hist1D(2, 0, 2);
    h.fill(0.5, 2).fill(0.5, 3).fill(1.5, 0.5);
    expect(h.counts[0]).toBe(5);
    expect(h.sumw2[0]).toBe(13);
    expect(h.error(0)).toBeCloseTo(Math.sqrt(13), 12);
    const g = h.clone().scale(2);
    expect(g.counts[0]).toBe(10);
    expect(g.sumw2[0]).toBe(52);
    h.add(g, -0.5);
    expect(h.counts[0]).toBe(0);
    expect(h.sumw2[0]).toBe(13 + 0.25 * 52);
    expect(() => h.add(new Hist1D(3, 0, 2))).toThrow();
  });
  test('mean and std are exact, not from bin centres; survive add and scale', () => {
    const r = rng(3);
    const h = new Hist1D(80, -20, 20);
    const xs = Array.from({ length: 50000 }, () => normal(r, 1, 2));
    h.fillArray(xs);
    expect(h.mean()).toBeCloseTo(1, 1);
    expect(h.std()).toBeCloseTo(2, 1);
    const g = h.clone().scale(3);
    expect(g.mean()).toBeCloseTo(h.mean(), 12);
    expect(h.clone().add(h).std()).toBeCloseTo(h.std(), 12);
  });
  test('fillArray equals a loop of fill, for even, variable and weighted bins', () => {
    const r = rng(5);
    const xs = Array.from({ length: 5000 }, () => r() * 12 - 1);
    const ws = xs.map(() => r());
    const a = new Hist1D(17, 0, 10).fillArray(xs);
    const b = new Hist1D(17, 0, 10);
    xs.forEach((x) => b.fill(x));
    expect(Array.from(a.counts)).toEqual(Array.from(b.counts));
    expect(a.overflow).toBe(b.overflow);
    expect(a.underflow).toBe(b.underflow);
    const c = new Hist1D([0, 1, 2, 4, 8, 10]).fillArray(xs, ws);
    const d = new Hist1D([0, 1, 2, 4, 8, 10]);
    xs.forEach((x, i) => d.fill(x, ws[i]));
    expect(Array.from(c.counts)).toEqual(Array.from(d.counts));
  });
  test('rebin keeps the total, merges the variances and accepts edge lists', () => {
    const h = new Hist1D(6, 0, 6);
    [0.5, 1.5, 1.5, 2.5, 3.5, 3.5, 3.5, 5.5].forEach((x) => h.fill(x));
    const r = h.rebin(2);
    expect(Array.from(r.counts)).toEqual([3, 4, 1]);
    expect(Array.from(r.sumw2)).toEqual([3, 4, 1]);
    expect(r.integral()).toBe(h.integral());
    expect(() => h.rebin(4)).toThrow();
    const s = h.rebin([0, 2, 6]);
    expect(Array.from(s.counts)).toEqual([3, 5]);
    expect(Array.from(h.slice(1, 4).counts)).toEqual([2, 1, 3]);
    expect(h.slice(1, 4).underflow).toBe(1);
  });
  test('normalise, density, cumulative, series', () => {
    const h = new Hist1D([0, 1, 3]);
    h.fill(0.5).fill(1.5).fill(2.5).fill(2.5);
    const d = h.clone().normalise(1, true);
    expect(d.integral({ width: true })).toBeCloseTo(1, 12);
    expect(h.clone().normalise().integral()).toBeCloseTo(1, 12);
    expect(h.clone().toDensity().counts[1]).toBe(1.5);
    expect(h.cumulative('forward')).toEqual([1, 4]);
    expect(h.cumulative('backward')).toEqual([4, 3]);
    expect(cumulative([1, 2, 3])).toEqual([1, 3, 6]);
    const s = h.toSeries();
    expect(s.edges).toEqual([0, 1, 3]);
    expect(s.counts).toEqual([1, 3]);
  });
});

describe('Hist2D', () => {
  test('fill, projections, outside', () => {
    const h = new Hist2D(2, 0, 2, 3, 0, 3);
    h.fill(0.5, 0.5).fill(0.5, 2.5).fill(1.5, 1.5, 2).fill(5, 5);
    expect(h.get(0, 0)).toBe(1);
    expect(h.get(1, 1)).toBe(2);
    expect(h.outside).toBe(1);
    expect(Array.from(h.projectionX().counts)).toEqual([2, 2]);
    expect(Array.from(h.projectionY().counts)).toEqual([1, 2, 1]);
    expect(h.integral()).toBe(4);
    expect(h.toMatrix()[0]).toEqual([1, 0, 1]);
    expect(h.clone().scale(2).integral()).toBe(8);
  });
});

describe('performance', () => {
  test('10⁶ events histogrammed quickly', () => {
    const r = rng(1);
    const xs = new Float64Array(1_000_000);
    for (let i = 0; i < xs.length; i++) xs[i] = 60 + 60 * r();
    const h = new Hist1D(120, 60, 120);
    const t0 = performance.now();
    h.fillArray(xs);
    const dt = performance.now() - t0;
    console.log(`histogram of 1e6 events: ${dt.toFixed(1)} ms`);
    expect(h.integral()).toBe(1_000_000 - h.overflow - h.underflow);
    expect(dt).toBeLessThan(400);
  });
});
