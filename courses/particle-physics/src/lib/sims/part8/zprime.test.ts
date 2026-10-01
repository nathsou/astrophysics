import { describe, expect, test } from 'vitest';
import { buildBackgroundSync, signalTemplate, makeModel, pseudoData, limitAt, clsOf, EDGES, N_BINS, massResolution, SELECTION } from './zprime.ts';

const bkg = buildBackgroundSync();

describe('background', () => {
  test('falls steeply; total above 1 TeV is of order a few femtobarns at leading order', () => {
    const s1 = bkg.sigmaAbove(1000) * 1000; // fb
    expect(s1).toBeGreaterThan(1);
    expect(s1).toBeLessThan(10);
    expect(bkg.sigmaAbove(3000)).toBeLessThan(bkg.sigmaAbove(1000) / 100);
  });
  test('binned yields agree with the slice table', () => {
    const counts = bkg.counts(1e5);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total / (bkg.sigmaAbove(500) * 1e5)).toBeGreaterThan(0.9);
    expect(total / (bkg.sigmaAbove(500) * 1e5)).toBeLessThan(1.15);
    expect(counts[0]!).toBeGreaterThan(counts[N_BINS - 1]! * 1e4);
  });
  test('bins are logarithmic from 500 GeV to 7 TeV', () => {
    expect(EDGES[0]).toBeCloseTo(500, 9);
    expect(EDGES[N_BINS]).toBeCloseTo(7000, 6);
  });
});

describe('signal', () => {
  test('a 3 TeV sequential Z′: cross-section of order a femtobarn, acceptance high', () => {
    const t = signalTemplate(3000);
    expect(t.sigmaPb * 1000).toBeGreaterThan(0.5);
    expect(t.sigmaPb * 1000).toBeLessThan(5);
    expect(t.acceptance).toBeGreaterThan(0.6);
    expect(t.acceptance).toBeLessThan(0.9);
    expect(t.width / 3000).toBeGreaterThan(0.02);
    expect(t.width / 3000).toBeLessThan(0.05);
  });
  test('the signal peaks at the mass, with the toy resolution', () => {
    const t = signalTemplate(3000);
    let best = 0;
    for (let j = 1; j < N_BINS; j++) if (t.fractions[j]! > t.fractions[best]!) best = j;
    const centre = Math.sqrt(EDGES[best]! * EDGES[best + 1]!);
    expect(Math.abs(centre / 3000 - 1)).toBeLessThan(0.1);
    expect(massResolution(3000)).toBeCloseTo(Math.hypot(0.02, 0.06), 12);
  });
  test('cross-section falls with mass', () => {
    expect(signalTemplate(2000).sigmaPb).toBeGreaterThan(signalTemplate(4000).sigmaPb * 20);
  });
  test('templates are reproducible', () => {
    expect(signalTemplate(3000).fractions).toEqual(signalTemplate(3000).fractions);
  });
});

describe('limits', () => {
  test('the expected limit on g at 3 TeV, 140 fb⁻¹: below 0.2 of the Z coupling, and it improves with luminosity', () => {
    const asimov = (L: number) => {
      const m = makeModel(signalTemplate(3000), bkg, L, 0.1);
      return pseudoData(m, 0, 1);
    };
    const a = limitAt(3000, bkg, 140, 0.1, asimov(140));
    const b = limitAt(3000, bkg, 1400, 0.1, asimov(1400));
    expect(a.expected).toBeGreaterThan(0.03);
    expect(a.expected).toBeLessThan(0.2);
    expect(b.expected).toBeLessThan(a.expected);
    expect(a.expectedFb).toBeGreaterThan(0.01);
  });
  test('a signal with g above the limit is excluded by the background-only data, one far below it is not', () => {
    const model = makeModel(signalTemplate(3000), bkg, 140, 0.1);
    const data = pseudoData(model, 0, 3);
    const lim = limitAt(3000, bkg, 140, 0.1, data);
    expect(clsOf(3000, 2 * lim.observed, bkg, 140, 0.1, data)).toBeLessThan(0.05);
    expect(clsOf(3000, 0.3 * lim.observed, bkg, 140, 0.1, data)).toBeGreaterThan(0.05);
  });
  test('an injected signal makes the observed limit weaker than the expected one', () => {
    const model = makeModel(signalTemplate(3000), bkg, 140, 0.1);
    const data = pseudoData(model, 0.5 ** 2 * 1, 3);
    const lim = limitAt(3000, bkg, 140, 0.1, data);
    expect(lim.observed).toBeGreaterThan(lim.expected);
  });
  test('the selection is the one documented', () => {
    expect(SELECTION).toEqual({ etaMax: 2.4, ptMin: 30, muonEfficiency: 0.95 });
  });
});
