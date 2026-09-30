/**
 * The bump hunt: scan a histogram with windows of several widths, ask of each "how improbable is this many events if only background is
 * there?", and report the most significant excess (in the manner of BumpHunter, Choudalakis and Casadei 2012).
 *
 * The *local* p-value of the best window is the chance that *that* window fluctuates so high. The chance that *some* window does is the
 * *global* p-value, which is larger; the ratio is the look-elsewhere (trials) factor. `lookElsewhereScan` measures it by brute force:
 * generate background-only pseudo-experiments, run the same scan on each and record the most significant window.
 */
import type { Rng } from '../random/index.ts';
import { fitBinned } from './fit.ts';
import { Hist1D } from './hist.ts';
import { exponential, extendedModel } from './models.ts';
import { poissonSample, poissonTail, pToZ, zToP } from './counting.ts';

export interface BumpWindow {
  /** Index of the first bin of the window. */
  start: number;
  /** Width in bins. */
  width: number;
  /** Lower and upper edge (in the histogram's variable) if known. */
  lo: number;
  hi: number;
  observed: number;
  expected: number;
  /** Local p-value P(N ≥ observed | expected); 1 for a deficit. */
  pLocal: number;
  /** The one-sided Gaussian significance of pLocal (0 for a deficit). */
  z: number;
}

export interface BumpHuntResult {
  /** The most significant window, or null if there are no windows. */
  best: BumpWindow | null;
  /** The test statistic t = −ln p_local of the best window (BumpHunter's statistic). */
  t: number;
  /** The expected counts used (the background). */
  background: number[];
  /** Every window scanned. */
  windows: BumpWindow[];
}

/** Scan arrays of observed and expected counts with windows of the given widths (in bins). `edges` (n + 1) labels the windows. */
export function scanWindows(counts: ArrayLike<number>, expected: ArrayLike<number>, widths: number[], edges?: ArrayLike<number>): BumpWindow[] {
  const n = counts.length;
  const cn = new Float64Array(n + 1), ce = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    cn[i + 1] = cn[i]! + counts[i]!;
    ce[i + 1] = ce[i]! + expected[i]!;
  }
  const out: BumpWindow[] = [];
  for (const w of widths) {
    for (let a = 0; a + w <= n; a++) {
      const obs = cn[a + w]! - cn[a]!;
      const exp = ce[a + w]! - ce[a]!;
      const p = obs > exp && exp > 0 ? poissonTail(Math.round(obs), exp) : 1;
      out.push({ start: a, width: w, lo: edges ? edges[a]! : a, hi: edges ? edges[a + w]! : a + w, observed: obs, expected: exp, pLocal: p, z: p < 1 ? Math.max(0, pToZ(p)) : 0 });
    }
  }
  return out;
}

/**
 * The smallest local p-value over all windows, without building window objects (the fast path for thousands of pseudo-experiments).
 * Returns `{ p, z }`; p = 1 and z = 0 when no window shows an excess.
 */
export function maxLocalZ(counts: ArrayLike<number>, expected: ArrayLike<number>, widths: number[]): { p: number; z: number } {
  const n = counts.length;
  const cn = new Float64Array(n + 1), ce = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    cn[i + 1] = cn[i]! + counts[i]!;
    ce[i + 1] = ce[i]! + expected[i]!;
  }
  let pmin = 1;
  for (const w of widths) {
    for (let a = 0; a + w <= n; a++) {
      const obs = cn[a + w]! - cn[a]!;
      const exp = ce[a + w]! - ce[a]!;
      if (obs > exp && exp > 0) {
        const p = poissonTail(Math.round(obs), exp);
        if (p < pmin) pmin = p;
      }
    }
  }
  return { p: pmin, z: pmin < 1 ? Math.max(0, pToZ(pmin)) : 0 };
}

/** The window with the smallest local p-value (ties: the first, which is the narrowest). */
export function bestWindow(windows: BumpWindow[]): BumpWindow | null {
  let best: BumpWindow | null = null;
  for (const w of windows) if (!best || w.pLocal < best.pLocal) best = w;
  return best;
}

/**
 * Hunt for a bump in a histogram. `windowWidths` are in bins (for example `[2, 3, 4, 6, 8]`). The background expectation is `opts.background` if
 * given (one value per bin), else a Poisson maximum-likelihood exponential fitted to the whole histogram (which a large signal will pull up,
 * making the hunt conservative).
 */
export function bumpHunt(hist: Hist1D, windowWidths: number[], opts: { background?: ArrayLike<number> } = {}): BumpHuntResult {
  let bkg: number[];
  if (opts.background) bkg = Array.from(opts.background);
  else {
    const m = extendedModel([{ label: 'bkg', shape: exponential() }]);
    const total = hist.integral();
    const fit = fitBinned(hist, m, [Math.max(total, 1), -1 / Math.max(1e-9, hist.upper - hist.lower)]);
    bkg = m.binned(fit.params, Array.from(hist.edges));
  }
  const windows = scanWindows(hist.counts, bkg, windowWidths, hist.edges);
  const best = bestWindow(windows);
  return { best, t: best ? -Math.log(best.pLocal) : 0, background: bkg, windows };
}

/** The BumpHunter statistic t = −ln(min p) of one scan. */
export function scanStatistic(counts: ArrayLike<number>, expected: ArrayLike<number>, widths: number[]): number {
  return -Math.log(maxLocalZ(counts, expected, widths).p);
}

export interface LookElsewhereScan {
  /** Number of pseudo-experiments. */
  nToys: number;
  /** The largest local significance found in each background-only pseudo-experiment. */
  maxZ: number[];
  /** Local significance and p-value of the reference (observed) excess. */
  zLocal: number;
  pLocal: number;
  /** Fraction of background-only experiments with a window at least as significant somewhere: the global p-value (with the +1 convention). */
  pGlobal: number;
  zGlobal: number;
  trialsFactor: number;
}

/**
 * Brute-force look-elsewhere: run `nToys` background-only pseudo-experiments (Poisson fluctuations of `expected`), scan each with the same windows, and
 * count how often the most significant window is at least as significant as `zLocal`. The global p-value is (1 + #{max Z ≥ Z_local})/(1 + N).
 */
export function lookElsewhereScan(expected: ArrayLike<number>, widths: number[], zLocal: number, nToys: number, rng: Rng): LookElsewhereScan {
  const maxZ: number[] = new Array(nToys);
  const toy = new Array<number>(expected.length);
  let hits = 0;
  const pRef = zToP(zLocal);
  for (let k = 0; k < nToys; k++) {
    for (let i = 0; i < expected.length; i++) toy[i] = poissonSample(rng, expected[i]!);
    const m = maxLocalZ(toy, expected, widths);
    maxZ[k] = m.z;
    if (m.p <= pRef * (1 + 1e-9)) hits++;
  }
  const pGlobal = (1 + hits) / (1 + nToys);
  return { nToys, maxZ, zLocal, pLocal: pRef, pGlobal, zGlobal: pToZ(pGlobal), trialsFactor: pGlobal / pRef };
}

/** Local significance of the excess in every window position of one width, as a curve (0 for deficits): the field whose upcrossings Gross and Vitells count. */
export function localScan(counts: ArrayLike<number>, expected: ArrayLike<number>, width: number): number[] {
  return scanWindows(counts, expected, [width]).map((w) => w.z);
}

/** The number of times a sequence rises through `level` (from below to at-or-above). */
export function upcrossings(values: ArrayLike<number>, level: number): number {
  let k = 0;
  for (let i = 1; i < values.length; i++) if (values[i - 1]! < level && values[i]! >= level) k++;
  return k;
}
