/**
 * Shared helpers of the statistics widgets: formatting, the toy spectra of the fit explorer, and a cooperative loop that keeps the page responsive
 * while pseudo-experiments run. No DOM access apart from `setTimeout`.
 */
import { extendedModel, exponential, gaussian, type Model } from '$lib/hep/analysis';
import { rng as makeRng, type Rng } from '$lib/hep/random';
import { Hist1D, poissonSample } from '$lib/hep/analysis';

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** A number with a fixed count of significant figures. */
export function sig(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'n/a';
  const r = Number(x.toPrecision(digits));
  return String(r).replace('-', '−');
}
/** A p-value: plain above 0.01, else "2.9 × 10⁻⁷". */
export function fmtP(p: number): string {
  if (!Number.isFinite(p)) return 'n/a';
  if (p >= 0.01) return sig(p, 2);
  if (p === 0) return '0';
  const e = Math.floor(Math.log10(p));
  const m = p / 10 ** e;
  const exp = String(e).split('').map((c) => SUP[c] ?? c).join('');
  return `${m.toFixed(1)} × 10${exp}`;
}
/** A significance: "3.1σ" (negative and tiny values collapse to 0). */
export function fmtZ(z: number, digits = 2): string {
  if (!Number.isFinite(z)) return z > 0 ? '∞σ' : 'n/a';
  return `${Math.max(0, z).toFixed(digits)}σ`;
}

/**
 * Run `total` units of work in slices of `chunk`, yielding to the browser between slices (so a long loop never blocks a frame for long).
 * `step(i)` does unit i; `progress(done)` is called after each slice; `cancelled()` aborts. Resolves to true if it ran to the end.
 */
export async function chunked(total: number, chunk: number, step: (i: number) => void, progress?: (done: number) => void, cancelled?: () => boolean): Promise<boolean> {
  for (let i = 0; i < total; i += chunk) {
    if (cancelled?.()) return false;
    const end = Math.min(total, i + chunk);
    for (let j = i; j < end; j++) step(j);
    progress?.(end);
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return !cancelled?.();
}

// ── toy spectra for the fit explorer ──────────────────────────────────────────────────────────────

export type FitModeKey = 'diphoton' | 'fourlepton' | 'generic';

export interface FitMode {
  key: FitModeKey;
  /** A seed whose toy data fit close to the truth, for the first view. */
  seed: number;
  title: string;
  xLabel: string;
  unit: string;
  lo: number;
  hi: number;
  bins: number;
  /** True parameters: [sig.yield, sig.mean, sig.sigma, bkg.yield, bkg.slope]. */
  truth: number[];
  /** Ranges of the sliders for the signal's mass, width and yield. */
  massRange: [number, number];
  sigmaRange: [number, number];
  yieldMax: number;
  note: string;
}

export const FIT_MODES: Record<FitModeKey, FitMode> = {
  diphoton: {
    key: 'diphoton',
    seed: 13,
    title: 'Diphoton mass spectrum (toy)',
    xLabel: 'm_γγ [GeV]',
    unit: 'GeV',
    lo: 105,
    hi: 160,
    bins: 55,
    truth: [420, 125, 1.7, 14000, -0.032],
    massRange: [110, 155],
    sigmaRange: [0.5, 6],
    yieldMax: 900,
    note: 'Many events, a steeply falling background and a narrow peak (photon energy resolution of order 1–2 GeV).',
  },
  fourlepton: {
    key: 'fourlepton',
    seed: 14,
    title: 'Four-lepton mass spectrum (toy)',
    xLabel: 'm_4ℓ [GeV]',
    unit: 'GeV',
    lo: 100,
    hi: 160,
    bins: 24,
    truth: [14, 125, 1.8, 22, -0.012],
    massRange: [105, 155],
    sigmaRange: [0.5, 6],
    yieldMax: 50,
    note: 'Very few events: most bins hold zero, one or two, where a χ² fit with √n errors is unreliable and the Poisson likelihood is not.',
  },
  generic: {
    key: 'generic',
    seed: 17,
    title: 'Peak on a background (toy)',
    xLabel: 'x',
    unit: '',
    lo: 0,
    hi: 10,
    bins: 50,
    truth: [220, 5.3, 0.4, 2400, -0.25],
    massRange: [0.5, 9.5],
    sigmaRange: [0.1, 1.5],
    yieldMax: 600,
    note: 'A Gaussian peak of unknown position, width and size on an exponential background.',
  },
};

export const fitModel = (): Model => extendedModel([{ label: 'sig', shape: gaussian() }, { label: 'bkg', shape: exponential() }]);

/** A seeded Poisson toy histogram of the mode's true model. */
export function toyHistogram(mode: FitMode, seed: number): Hist1D {
  const r: Rng = makeRng(seed);
  const edges = Array.from({ length: mode.bins + 1 }, (_, i) => mode.lo + ((mode.hi - mode.lo) * i) / mode.bins);
  const h = new Hist1D(edges);
  const nu = fitModel().binned(mode.truth, edges);
  nu.forEach((v, i) => {
    const n = poissonSample(r, v);
    h.counts[i] = n;
    h.sumw2[i] = n;
    h.entries += n;
  });
  return h;
}
