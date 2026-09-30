import { describe, expect, test } from 'vitest';
import { evaluateSelection, selectionOptimiser } from '$lib/hep/analysis';
import { rng } from '$lib/hep/random';
import { chunked, FIT_MODES, fitModel, fmtP, fmtZ, sig, toyHistogram } from './common';
import { DEFAULT_CUT_TOY, draw, generateSamples } from './samples';

describe('formatting', () => {
  test('p-values, significances and significant figures', () => {
    expect(fmtP(0.0123)).toBe('0.012');
    expect(fmtP(2.87e-7)).toBe('2.9 × 10⁻⁷');
    expect(fmtP(1.35e-3)).toBe('1.4 × 10⁻³');
    expect(fmtZ(3.14159)).toBe('3.14σ');
    expect(fmtZ(-0.4)).toBe('0.00σ');
    expect(sig(-0.031694, 3)).toBe('−0.0317');
    expect(sig(Infinity)).toBe('∞');
  });
  test('chunked runs every step, reports progress and can be cancelled', async () => {
    let n = 0;
    const prog: number[] = [];
    expect(await chunked(25, 10, () => n++, (d) => prog.push(d))).toBe(true);
    expect(n).toBe(25);
    expect(prog).toEqual([10, 20, 25]);
    let m = 0;
    let stop = false;
    expect(await chunked(100, 10, () => m++, (d) => { if (d >= 30) stop = true; }, () => stop)).toBe(false);
    expect(m).toBe(30);
  });
});

describe('toy histograms', () => {
  test('are reproducible from the seed and have about the expected total', () => {
    const a = toyHistogram(FIT_MODES.diphoton, 3);
    const b = toyHistogram(FIT_MODES.diphoton, 3);
    expect(Array.from(a.counts)).toEqual(Array.from(b.counts));
    expect(Array.from(toyHistogram(FIT_MODES.diphoton, 4).counts)).not.toEqual(Array.from(a.counts));
    const total = fitModel().totalYield(FIT_MODES.diphoton.truth);
    expect(Math.abs(a.integral() - total)).toBeLessThan(5 * Math.sqrt(total));
    expect(a.nbins).toBe(55);
  });
});

describe('sample generator', () => {
  test('distributions: means, truncation and reproducibility', () => {
    const r = rng(1);
    const xs = Array.from({ length: 20000 }, () => draw(r, { dist: 'exponential', mean: 35, offset: 100, max: 160 }));
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(100);
    expect(Math.max(...xs)).toBeLessThanOrEqual(160);
    const ys = Array.from({ length: 20000 }, () => draw(r, { dist: 'normal', mean: 0.5, sigma: 0.3, min: 0, max: 1 }));
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(1);
    const a = generateSamples(DEFAULT_CUT_TOY);
    const b = generateSamples(DEFAULT_CUT_TOY);
    expect(Array.from(a.sig.columns.m!.slice(0, 5) as Float64Array)).toEqual(Array.from(b.sig.columns.m!.slice(0, 5) as Float64Array));
    expect(a.sig.weight).toBeCloseTo(150 / 2500, 12);
  });
  test('correlated normals have the requested correlation', async () => {
    const { generateSample } = await import('./samples');
    const { table } = generateSample({ events: 20000, yield: 1, vars: { a: { dist: 'normal', mean: 0, sigma: 1 }, b: { dist: 'normal', mean: 0, sigma: 1 } }, correlate: [['a', 'b', 0.6]] }, rng(2));
    const a = table.col('a'), b = table.col('b');
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++) { sab += a[i]! * b[i]!; saa += a[i]! ** 2; sbb += b[i]! ** 2; }
    expect(sab / Math.sqrt(saa * sbb)).toBeCloseTo(0.6, 1);
  });
  test('the default toy has a clear optimum: cutting on the window and the discriminant beats no cuts by a factor of about four or more', () => {
    const { sig: s, bkg } = generateSamples(DEFAULT_CUT_TOY);
    const none = evaluateSelection(s, bkg, []);
    const opt = selectionOptimiser(s, bkg, [{ column: 'm', kind: 'window' }, { column: 'd', kind: 'min' }], { nCandidates: 50, nStarts: 2 });
    console.log(`default toy: no cuts Z = ${none.z.toFixed(2)}, optimum Z = ${opt.z.toFixed(2)} with ${opt.cuts.map((c) => `${c.column}${c.kind === 'min' ? '≥' : '≤'}${c.value.toFixed(2)}`).join(', ')}`);
    expect(opt.z).toBeGreaterThan(3.5 * none.z);
    expect(opt.effS).toBeGreaterThan(0.3);
  });
});
