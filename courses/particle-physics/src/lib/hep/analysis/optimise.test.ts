import { describe, expect, test } from 'vitest';
import { EventTable } from '../event/index.ts';
import { normal, rng } from '../random/index.ts';
import { BlindedSample, BlindingError, blindTable, evaluateSelection, parSignificance, sampleFromTable, scanCut, selectionOptimiser, type OptSample } from './optimise.ts';
import { significanceReference } from './significance.ts';

describe('selection optimiser', () => {
  // Signal: Gaussians in x (mean 2) and y (mean 1); background: broader, centred at 0.
  function makeSample(r: ReturnType<typeof rng>, n: number, mx: number, my: number, sx: number, sy: number, weight: number): OptSample {
    const t = new EventTable(n);
    t.setColumn('x', Array.from({ length: n }, () => normal(r, mx, sx)));
    t.setColumn('y', Array.from({ length: n }, () => normal(r, my, sy)));
    return sampleFromTable(t, weight);
  }
  const r = rng(21);
  const sig = makeSample(r, 4000, 2, 1, 1, 1, 0.05);
  const bkg = makeSample(r, 20000, 0, 0, 1.5, 1.5, 0.1);

  test('evaluateSelection: efficiencies, weights and the significance formula', () => {
    const all = evaluateSelection(sig, bkg, []);
    expect(all.s).toBeCloseTo(200, 6);
    expect(all.b).toBeCloseTo(2000, 6);
    expect(all.effS).toBe(1);
    const cut = evaluateSelection(sig, bkg, [{ column: 'x', kind: 'min', value: 2 }]);
    expect(cut.effS).toBeGreaterThan(0.45);
    expect(cut.effS).toBeLessThan(0.55);
    expect(cut.z).toBeCloseTo(significanceReference(cut.s, cut.b), 12);
    expect(evaluateSelection(sig, bkg, [{ column: 'x', kind: 'min', value: 2 }], { bkgRelUnc: 0.2 }).z).toBeLessThan(cut.z);
  });
  test('the optimiser finds the optimum of a brute-force grid over two cuts (within 2 %) and beats no cuts', () => {
    const specs = [{ column: 'x', kind: 'min' as const }, { column: 'y', kind: 'min' as const }];
    const best = selectionOptimiser(sig, bkg, specs);
    let grid = 0;
    for (let cx = -1; cx <= 4; cx += 0.1) for (let cy = -1; cy <= 3; cy += 0.1) {
      const e = evaluateSelection(sig, bkg, [{ column: 'x', kind: 'min', value: cx }, { column: 'y', kind: 'min', value: cy }]);
      if (e.nBkg >= 5) grid = Math.max(grid, e.z);
    }
    console.log(`optimiser Z = ${best.z.toFixed(3)} (cuts ${best.cuts.map((c) => c.value.toFixed(2)).join(', ')}), grid ${grid.toFixed(3)}, no cuts ${evaluateSelection(sig, bkg, []).z.toFixed(3)}`);
    expect(best.z).toBeGreaterThan(0.98 * grid);
    expect(best.z).toBeGreaterThan(1.5 * evaluateSelection(sig, bkg, []).z);
    expect(parSignificance(sig, bkg, specs)).toBeCloseTo(0.9 * best.z, 8);
  });
  test('a window cut is optimised as a pair of cuts; the scan of one cut peaks inside the range', () => {
    const best = selectionOptimiser(sig, bkg, [{ column: 'x', kind: 'window' }]);
    expect(best.cuts.length).toBe(2);
    expect(best.cuts[0]!.value).toBeLessThan(best.cuts[1]!.value);
    const scan = scanCut(sig, bkg, [{ column: 'x', kind: 'min', value: -5 }], 0, Array.from({ length: 41 }, (_, i) => -2 + i * 0.15));
    const k = scan.reduce((a, p, i) => (p.z > scan[a]!.z ? i : a), 0);
    expect(k).toBeGreaterThan(3);
    expect(k).toBeLessThan(38);
  });
  test('the fast single-cut scan agrees with evaluating the full selection at every threshold, for min and max cuts', () => {
    const base = [{ column: 'y', kind: 'min' as const, value: 0.2 }, { column: 'x', kind: 'min' as const, value: 0 }, { column: 'x', kind: 'max' as const, value: 3.5 }];
    for (const k of [0, 1, 2]) {
      const thr = [-1, 0.3, 1.1, 2.4];
      const scan = scanCut(sig, bkg, base, k, thr);
      for (const pt of scan) {
        const e = evaluateSelection(sig, bkg, base.map((c, i) => (i === k ? { ...c, value: pt.value } : c)));
        expect(pt.s).toBeCloseTo(e.s, 9);
        expect(pt.b).toBeCloseTo(e.b, 9);
        if (e.nBkg >= 5 && e.nSig > 0) expect(pt.z).toBeCloseTo(e.z, 9);
      }
    }
  });
  test('it refuses to chase an empty corner: at least minBkgEvents simulated background events survive', () => {
    const best = selectionOptimiser(sig, bkg, [{ column: 'x', kind: 'min' }], { minBkgEvents: 200 });
    expect(best.nBkg).toBeGreaterThanOrEqual(200);
  });
});

describe('blinding', () => {
  const values = [100, 105, 119, 121, 125, 126, 129, 131, 140];
  test('while blinded nothing from the signal region is returned', () => {
    const d = new BlindedSample(values, [120, 130]);
    expect(d.blinded).toBe(true);
    expect(d.sidebands()).toEqual([100, 105, 119, 131, 140]);
    expect(() => d.signalRegion()).toThrow(BlindingError);
    expect(() => d.all()).toThrow(BlindingError);
    expect(() => d.count()).toThrow(BlindingError);
    const h = d.histogram(Array.from({ length: 11 }, (_, i) => 100 + 5 * i));
    // 100, 105, 119, 131, 140 are outside [120, 130]; 131 and 140 lie in bins that do not overlap the region.
    expect(h.integral()).toBe(5);
    expect(h.counts[4]).toBe(0); // bins [120,125) and [125,130) are empty
    expect(h.counts[5]).toBe(0);
  });
  test('unblinding needs a reason, is irreversible, is logged, and then returns the events', () => {
    const d = new BlindedSample(values, [120, 130]);
    expect(() => d.unblind('  ')).toThrow();
    d.unblind('analysis frozen');
    expect(d.blinded).toBe(false);
    expect(d.signalRegion()).toEqual([121, 125, 126, 129]);
    expect(d.count()).toBe(9);
    expect(d.log[d.log.length - 1]).toContain('UNBLINDED: analysis frozen');
    expect(new BlindedSample(values, [120, 130], { unblinded: true }).signalRegion().length).toBe(4);
  });
  test('blindTable removes the region unless unblinded', () => {
    const t = new EventTable(5).setColumn('m', [100, 121, 125, 131, 140]);
    expect(Array.from(blindTable(t, 'm', [120, 130]).col('m'))).toEqual([100, 131, 140]);
    expect(blindTable(t, 'm', [120, 130], { unblinded: true }).n).toBe(5);
  });
});
