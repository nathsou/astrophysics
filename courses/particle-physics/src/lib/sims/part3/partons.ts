/**
 * Parton helpers for Chapter 13, built on the course's pedagogical parton distributions (`hep/gen`: `xf`, `pdf`). The distributions are a
 * teaching parametrisation, not a fit to data (see the header of `hep/gen/pdf.ts`).
 *
 * `samplePartonX` is the reference of the hook `gen.samplePartonX`, the function the reader writes in Chapter 13: draw momentum fractions x
 * from the density f(x) of one kind of parton. (The generator in `hep/gen` has its own sampling of x₁ and x₂ inside the VEGAS integration;
 * this hook is the standalone, teachable version.)
 */
import type { Rng } from '../../hep/random/index.ts';
import { pdf, xf } from '../../hep/gen/pdf.ts';
import { hook } from '../../hep/hooks.ts';

/**
 * n values of x in [xMin, 1] distributed with density proportional to f(x). The density is tabulated in t = ln x (where parton densities vary
 * slowly: x f(x) is the density per unit t), accumulated with the trapezoid rule, and inverted by bisection with linear interpolation.
 */
export function samplePartonX(f: (x: number) => number, n: number, r: Rng, xMin = 1e-3): number[] {
  const N = 600;
  const t0 = Math.log(xMin);
  const h = -t0 / N;
  const cdf = new Float64Array(N + 1);
  let prev = f(xMin) * xMin;
  for (let i = 1; i <= N; i++) {
    const x = Math.exp(t0 + i * h);
    const cur = f(x) * x;
    cdf[i] = cdf[i - 1]! + 0.5 * (prev + cur) * h;
    prev = cur;
  }
  const total = cdf[N]!;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const u = r() * total;
    let lo = 0, hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid]! <= u) lo = mid;
      else hi = mid;
    }
    const w = cdf[hi]! - cdf[lo]!;
    const frac = w > 0 ? (u - cdf[lo]!) / w : 0;
    out.push(Math.exp(t0 + (lo + frac) * h));
  }
  return out;
}

/** The sampler as the generator (or a widget) fetches it, so that the reader's version replaces it. */
export const sampleX = (f: (x: number) => number, n: number, r: Rng, xMin = 1e-3): number[] => hook('gen.samplePartonX', samplePartonX)(f, n, r, xMin);

/** ∫_{xMin}^{1} g(x) dx, by the trapezoid rule in ln x. */
export function integrate(g: (x: number) => number, xMin: number, xMax = 1, n = 1500): number {
  const a = Math.log(xMin), b = Math.log(xMax), h = (b - a) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const x = Math.exp(a + i * h);
    s += (i === 0 || i === n ? 0.5 : 1) * g(x) * x;
  }
  return s * h;
}

/** Valence density u − ū and d − d̄ (number densities), the sea quarks (all antiquarks and s, c, b) and the gluon, at scale Q. */
export const uValence = (x: number, Q: number): number => pdf(2, x, Q) - pdf(-2, x, Q);
export const dValence = (x: number, Q: number): number => pdf(1, x, Q) - pdf(-1, x, Q);
export const seaQuark = (x: number, Q: number): number => 2 * (pdf(-2, x, Q) + pdf(-1, x, Q) + pdf(3, x, Q) + pdf(4, x, Q) + pdf(5, x, Q));
export const gluon = (x: number, Q: number): number => pdf(21, x, Q);

export interface PartonCounts { valence: number; sea: number; gluons: number }
/** Expected numbers of valence quarks, sea quarks and antiquarks, and gluons with momentum fraction above xMin. */
export function partonCounts(Q: number, xMin: number): PartonCounts {
  return {
    valence: integrate((x) => uValence(x, Q) + dValence(x, Q), xMin),
    sea: integrate((x) => seaQuark(x, Q), xMin),
    gluons: integrate((x) => gluon(x, Q), xMin),
  };
}

/** Fractions of the proton's momentum carried by the valence quarks, the sea and the gluons: ∫ x f dx over all x. */
export function momentumShares(Q: number): { valence: number; sea: number; gluons: number } {
  const m = (g: (x: number) => number) => integrate((x) => x * g(x), 1e-6);
  return { valence: m((x) => uValence(x, Q) + dValence(x, Q)), sea: m((x) => seaQuark(x, Q)), gluons: m((x) => gluon(x, Q)) };
}

/** The distance a probe of momentum transfer Q resolves, λ = ħc/Q, in fm. */
export const resolutionFm = (Q: number): number => 0.1973269804 / Q;

/** x f(x) for the six curves the figure draws. */
export function curves(Q: number) {
  return {
    uv: (x: number) => x * uValence(x, Q),
    dv: (x: number) => x * dValence(x, Q),
    sea: (x: number) => (x * seaQuark(x, Q)) / 2,
    g: (x: number) => xf(21, x, Q),
  };
}
