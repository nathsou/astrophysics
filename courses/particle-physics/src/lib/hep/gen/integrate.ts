/**
 * Monte Carlo integration and unweighting.
 *
 *  - `Vegas`: the adaptive importance-sampling grid of Lepage (J. Comput. Phys. 27 (1978) 192): a separable grid in each
 *    dimension is refined, iteration by iteration, so that the bins hold equal amounts of f², which concentrates the
 *    sample where the integrand is large.
 *  - `unweight`/`Unweighter`: turn weighted points into unit-weight events by accept–reject against a running maximum.
 *  - Mappings for resonances and steeply falling spectra (`breitWignerMap`, `powerMap`, `mixMap`).
 *  - `crossSection`: the Monte Carlo cross-section of any `Process` with its statistical error, next to the analytic
 *    value where one exists.
 */
import { hook } from '../hooks.ts';
import type { Rng } from '../random/index.ts';
import { rng as makeRng } from '../random/index.ts';
import type { Process } from './process.ts';

// ── VEGAS ─────────────────────────────────────────────────────────────────────────────────────────────────────
export interface VegasResult {
  /** Combined estimate of the integral (weighted by the inverse variance of the iterations). */
  value: number;
  /** Its standard error. */
  error: number;
  /** χ² per degree of freedom of the iterations (≈ 1 when they agree). */
  chi2: number;
  iterations: number;
  /** Largest value of f·jacobian seen, for unweighting. */
  maxWeight: number;
}

export class Vegas {
  readonly dim: number;
  readonly nb: number;
  /** Bin edges per dimension, nb + 1 values from 0 to 1. */
  readonly edges: Float64Array[];
  private acc: Float64Array[];
  private hits: Float64Array[];
  /** Bin hit by the last `sample` in each dimension. */
  readonly ix: Int32Array;

  constructor(dim: number, nb = 50) {
    this.dim = dim;
    this.nb = nb;
    this.edges = Array.from({ length: dim }, () => Float64Array.from({ length: nb + 1 }, (_, i) => i / nb));
    this.acc = Array.from({ length: dim }, () => new Float64Array(nb));
    this.hits = Array.from({ length: dim }, () => new Float64Array(nb));
    this.ix = new Int32Array(dim);
  }

  /** Fill `u` with a point of the unit hypercube distributed according to the grid; returns the jacobian du/dx (1/density). */
  sample(r: Rng, u: Float64Array): number {
    const nb = this.nb;
    let jac = 1;
    for (let d = 0; d < this.dim; d++) {
      const e = this.edges[d]!;
      const v = r() * nb;
      let i = Math.floor(v);
      if (i >= nb) i = nb - 1;
      const f = v - i;
      const lo = e[i]!, hi = e[i + 1]!;
      u[d] = lo + (hi - lo) * f;
      jac *= (hi - lo) * nb;
      this.ix[d] = i;
    }
    return jac;
  }

  /** Record f·jac at the bins of the last sample (used during adaptation). */
  private record(fj: number): void {
    const v = fj * fj;
    for (let d = 0; d < this.dim; d++) {
      const i = this.ix[d]!;
      this.acc[d]![i] = this.acc[d]![i]! + v;
      this.hits[d]![i] = this.hits[d]![i]! + 1;
    }
  }

  /** Refine the grid from the accumulated f² (smoothing and compression with exponent `alpha`), then reset the accumulators. */
  adapt(alpha = 1.5): void {
    const nb = this.nb;
    for (let d = 0; d < this.dim; d++) {
      const acc = this.acc[d]!, hits = this.hits[d]!;
      const m = new Float64Array(nb);
      for (let i = 0; i < nb; i++) m[i] = hits[i]! > 0 ? acc[i]! / hits[i]! : 0;
      // smoothing with neighbours
      const sm = new Float64Array(nb);
      for (let i = 0; i < nb; i++) {
        const a = m[Math.max(0, i - 1)]!, b = m[i]!, c = m[Math.min(nb - 1, i + 1)]!;
        sm[i] = i === 0 ? (7 * m[0]! + m[1]!) / 8 : i === nb - 1 ? (7 * m[nb - 1]! + m[nb - 2]!) / 8 : (a + 6 * b + c) / 8;
      }
      let tot = 0;
      for (let i = 0; i < nb; i++) tot += sm[i]!;
      if (!(tot > 0)) continue;
      const r = new Float64Array(nb);
      let rsum = 0;
      for (let i = 0; i < nb; i++) {
        const p = sm[i]! / tot;
        r[i] = p > 1e-30 && p < 1 ? Math.pow((p - 1) / Math.log(p), alpha) : p >= 1 ? 1 : 0;
        // tiny floor so that empty bins keep a little width
        r[i] = Math.max(r[i]!, 1e-12);
        rsum += r[i]!;
      }
      const old = this.edges[d]!;
      const fresh = new Float64Array(nb + 1);
      fresh[nb] = 1;
      const per = rsum / nb;
      let j = 0;
      let cum = 0; // sum of r over old bins < j
      for (let k = 1; k < nb; k++) {
        const target = k * per;
        while (j < nb - 1 && cum + r[j]! < target) {
          cum += r[j]!;
          j++;
        }
        const frac = (target - cum) / r[j]!;
        fresh[k] = old[j]! + (old[j + 1]! - old[j]!) * Math.min(1, Math.max(0, frac));
      }
      old.set(fresh);
      acc.fill(0);
      hits.fill(0);
    }
  }

  /**
   * Integrate f over the unit hypercube. Every iteration draws `points` samples; all but the last `frozen` iterations adapt
   * the grid. Returns the variance-weighted combination of the iterations that did not adapt... (all iterations after the
   * first are combined, as the adapting ones are already good estimates).
   */
  integrate(f: (u: Float64Array) => number, r: Rng, opts: { iterations?: number; points?: number; alpha?: number; adapt?: boolean } = {}): VegasResult {
    const iterations = opts.iterations ?? 5;
    const points = opts.points ?? 4000;
    const adaptive = opts.adapt ?? true;
    const u = new Float64Array(this.dim);
    const vals: number[] = [];
    const errs: number[] = [];
    let maxW = 0;
    for (let it = 0; it < iterations; it++) {
      let s = 0, s2 = 0;
      for (let n = 0; n < points; n++) {
        const jac = this.sample(r, u);
        const fj = f(u) * jac;
        if (adaptive) this.record(fj);
        s += fj;
        s2 += fj * fj;
        if (Math.abs(fj) > maxW) maxW = Math.abs(fj);
      }
      const mean = s / points;
      const variance = Math.max((s2 / points - mean * mean) / (points - 1), 0);
      vals.push(mean);
      errs.push(Math.sqrt(variance));
      if (adaptive && it < iterations - 1) this.adapt(opts.alpha ?? 1.5);
    }
    // combine: skip the first iteration when there are several (the flat grid is a poor estimate)
    const start = iterations > 2 ? 1 : 0;
    let sw = 0, swx = 0;
    for (let i = start; i < iterations; i++) {
      const w = 1 / Math.max(errs[i]! * errs[i]!, 1e-300);
      sw += w;
      swx += w * vals[i]!;
    }
    const value = swx / sw;
    let chi2 = 0;
    for (let i = start; i < iterations; i++) chi2 += ((vals[i]! - value) / Math.max(errs[i]!, 1e-300)) ** 2;
    const dof = Math.max(1, iterations - start - 1);
    return { value, error: Math.sqrt(1 / sw), chi2: chi2 / dof, iterations, maxWeight: maxW };
  }
}

// ── Gauss–Legendre ───────────────────────────────────────────────────────────────────────────────────────────
const glCache = new Map<number, { x: Float64Array; w: Float64Array }>();
/** Nodes and weights of n-point Gauss–Legendre quadrature on [0, 1]. */
export function gaussLegendre(n: number): { x: Float64Array; w: Float64Array } {
  let g = glCache.get(n);
  if (g) return g;
  const x = new Float64Array(n), w = new Float64Array(n);
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5));
    let dp = 1;
    for (let it = 0; it < 100; it++) {
      let p1 = 1, p2 = 0;
      for (let j = 1; j <= n; j++) {
        const p3 = p2;
        p2 = p1;
        p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j;
      }
      dp = (n * (z * p1 - p2)) / (z * z - 1);
      const dz = p1 / dp;
      z -= dz;
      if (Math.abs(dz) < 1e-15) break;
    }
    x[i] = 0.5 * (1 - z);
    x[n - 1 - i] = 0.5 * (1 + z);
    w[i] = w[n - 1 - i] = 1 / ((1 - z * z) * dp * dp);
  }
  g = { x, w };
  glCache.set(n, g);
  return g;
}

// ── Mappings ──────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * A one-dimensional mapping from u ∈ [0, 1] to x with density p(x): calling it returns x and the jacobian dx/du = 1/p(x);
 * `density(x)` is p(x) itself (zero outside the range), needed to combine mappings.
 */
export interface Mapping {
  (u: number): { x: number; jac: number };
  density(x: number): number;
  readonly lo: number;
  readonly hi: number;
  /** Values of u where the mapping is not smooth (segment edges of a mixture); [0, 1] for a single channel. */
  readonly breaks: number[];
}
export function makeMapping(lo: number, hi: number, f: (u: number) => { x: number; jac: number }, density: (x: number) => number): Mapping {
  const m = f as Mapping;
  (m as { density: Mapping['density'] }).density = (x) => (x >= lo && x <= hi ? density(x) : 0);
  (m as { lo: number }).lo = lo;
  (m as { hi: number }).hi = hi;
  (m as { breaks: number[] }).breaks = [0, 1];
  return m;
}

/**
 * Breit–Wigner mapping for the variable m² = x on [lo, hi]: x = M² + MΓ tan(θ), θ uniform between the limits. The jacobian
 * is dx/du = (θ_hi − θ_lo)((x − M²)² + M²Γ²)/(MΓ), which cancels the resonance peak in the integrand.
 */
export function breitWignerMap(M: number, Gamma: number, lo: number, hi: number): Mapping {
  const a = Math.atan((lo - M * M) / (M * Gamma));
  const b = Math.atan((hi - M * M) / (M * Gamma));
  const dens = (x: number) => (M * Gamma) / ((b - a) * ((x - M * M) ** 2 + M * M * Gamma * Gamma));
  return makeMapping(
    lo,
    hi,
    (u) => {
      const th = a + (b - a) * u;
      const x = M * M + M * Gamma * Math.tan(th);
      return { x, jac: 1 / dens(x) };
    },
    dens,
  );
}
/** Power-law mapping with density ∝ x^(−k) on [lo, hi] (k = 1 gives a logarithmic mapping). */
export function powerMap(k: number, lo: number, hi: number): Mapping {
  if (Math.abs(k - 1) < 1e-12) {
    const L = Math.log(hi / lo);
    return makeMapping(lo, hi, (u) => {
      const x = lo * Math.exp(L * u);
      return { x, jac: L * x };
    }, (x) => 1 / (L * x));
  }
  const e = 1 - k;
  const a = Math.pow(lo, e), b = Math.pow(hi, e);
  return makeMapping(lo, hi, (u) => {
    const x = Math.pow(a + (b - a) * u, 1 / e);
    return { x, jac: ((b - a) / e) * Math.pow(x, k) };
  }, (x) => (e / (b - a)) * Math.pow(x, -k));
}
/** Uniform mapping on [lo, hi]. */
export function linearMap(lo: number, hi: number): Mapping {
  return makeMapping(lo, hi, (u) => ({ x: lo + (hi - lo) * u, jac: hi - lo }), () => 1 / (hi - lo));
}

/**
 * A mixture of mappings over the same variable, with weights w_k (normalised here): u selects the channel k in proportion
 * to w_k (the rest of u is rescaled inside the channel) and the jacobian is that of the mixture density Σ w_k p_k(x).
 * This is multi-channel importance sampling for a spectrum with several resonances and a continuum.
 */
export function mixMap(channels: { map: Mapping; weight: number }[]): Mapping {
  const tot = channels.reduce((s, c) => s + c.weight, 0);
  const cum: number[] = [];
  let acc = 0;
  for (const c of channels) {
    acc += c.weight / tot;
    cum.push(acc);
  }
  const lo = Math.min(...channels.map((c) => c.map.lo));
  const hi = Math.max(...channels.map((c) => c.map.hi));
  const dens = (x: number) => {
    let d = 0;
    for (const c of channels) d += (c.weight / tot) * c.map.density(x);
    return d;
  };
  const mixed = makeMapping(
    lo,
    hi,
    (u) => {
      let k = 0;
      while (k < channels.length - 1 && u >= cum[k]!) k++;
      const l0 = k === 0 ? 0 : cum[k - 1]!;
      const uu = (u - l0) / (cum[k]! - l0);
      const { x } = channels[k]!.map(Math.min(Math.max(uu, 0), 1 - 1e-15));
      return { x, jac: 1 / dens(x) };
    },
    dens,
  );
  (mixed as { breaks: number[] }).breaks = [0, ...cum.slice(0, -1), 1];
  return mixed;
}

/** ∫₀¹ g(u) du by Gauss–Legendre with n nodes in each smooth segment of a mapping (use with the mapping's own jacobian inside g). */
export function integrateMapped(map: Mapping, n: number, g: (u: number) => number): number {
  const gl = gaussLegendre(n);
  let total = 0;
  for (let k = 0; k + 1 < map.breaks.length; k++) {
    const a = map.breaks[k]!, b = map.breaks[k + 1]!;
    for (let i = 0; i < n; i++) total += gl.w[i]! * (b - a) * g(a + (b - a) * gl.x[i]!);
  }
  return total;
}

// ── Unweighting ───────────────────────────────────────────────────────────────────────────────────────────────
/**
 * The accept–reject decision: accept an event of weight w with probability w / wMax. This is the reference for the hook
 * `gen.unweight`; an exercise asks the reader to write it.
 */
export function unweight(w: number, wMax: number, r: Rng): boolean {
  return r() * wMax < w;
}

export interface UnweightState {
  /** The running maximum weight. */
  max: number;
  trials: number;
  accepted: number;
  /** How many times a weight exceeded the maximum (the maximum was raised; the event was accepted). */
  overweight: number;
}

/** Keeps the running maximum and calls the `gen.unweight` decision (the reader's version if installed). */
export class Unweighter {
  readonly state: UnweightState;
  constructor(initialMax = 0) {
    this.state = { max: initialMax, trials: 0, accepted: 0, overweight: 0 };
  }
  /** True if the event with weight w is kept. A weight above the running maximum raises it and is always kept. */
  accept(w: number, r: Rng): boolean {
    const s = this.state;
    s.trials++;
    if (!(w > 0)) return false;
    let ok: boolean;
    if (w > s.max) {
      s.max = w;
      s.overweight++;
      ok = true;
    } else {
      ok = hook('gen.unweight', unweight)(w, s.max, r);
    }
    if (ok) s.accepted++;
    return ok;
  }
  /** Efficiency so far: accepted / trials. */
  get efficiency(): number {
    return this.state.trials ? this.state.accepted / this.state.trials : 0;
  }
}

// ── Cross-section by Monte Carlo ──────────────────────────────────────────────────────────────────────────────
export interface CrossSectionResult {
  /** Monte Carlo cross-section in pb. */
  sigma: number;
  /** Statistical error in pb. */
  error: number;
  /** The analytic (deterministic) value in pb where the process has one. */
  analytic?: number;
  /** (sigma − analytic)/error when both exist. */
  pull?: number;
  nEvents: number;
}

/**
 * The cross-section of a process at √s in pb, by Monte Carlo: the mean of `nEvents` weighted points with its standard error
 * (points are drawn from the process's own importance-sampling grid, which is trained once with a fixed seed and cached).
 * Where the process has an analytic or deterministic value it is returned as well, with the pull.
 */
export function crossSection(process: Process, sqrtS: number, nEvents = 20000, r: Rng = makeRng(1)): CrossSectionResult {
  const cfg = { sqrtS };
  let s = 0, s2 = 0;
  for (let i = 0; i < nEvents; i++) {
    const w = process.weightedPoint(r, cfg);
    s += w;
    s2 += w * w;
  }
  const mean = s / nEvents;
  const error = Math.sqrt(Math.max(s2 / nEvents - mean * mean, 0) / (nEvents - 1));
  const analytic = process.sigmaAnalytic?.(sqrtS);
  const out: CrossSectionResult = { sigma: mean, error, nEvents };
  if (analytic !== undefined) {
    out.analytic = analytic;
    out.pull = error > 0 ? (mean - analytic) / error : 0;
  }
  return out;
}
