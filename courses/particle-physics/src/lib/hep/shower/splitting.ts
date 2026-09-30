/**
 * QCD splitting functions, the running coupling as the shower uses it, and the analytic Sudakov form factor.
 *
 * Conventions: t = pT² is the evolution variable (pT of the emission relative to the parent direction), z the energy
 * fraction of the first daughter (the quark in q → qg and g → qq̄), and the emission probability in a small step is
 *   dP = (αs(t)/2π) · P(z) dz · dt/t.
 * The splitting functions are normalised as in the course text:
 *   P_qq(z) = C_F (1 + z²)/(1 − z),  P_gg(z) = C_A [z/(1 − z) + (1 − z)/z + z(1 − z)],  P_gq(z) = T_R [z² + (1 − z)²]
 * with no extra symmetry factor in P_gg (for g → gg the probability is ∫₀¹ P_gg dz over the full z range, which
 * counts each unordered final state twice and so gives the standard soft limit (αs/π) C_A dω/ω).
 */
import { alphaS1 } from '../sm/index.ts';

export const CF = 4 / 3;
export const CA = 3;
export const TR = 0.5;

/** Splitting functions P(z). `qq`: q → q(z) g(1−z). `gg`: g → g(z) g(1−z). `gq`: g → q(z) q̄(1−z), per flavour. */
export const splitting = {
  qq: (z: number): number => (CF * (1 + z * z)) / (1 - z),
  gg: (z: number): number => CA * (z / (1 - z) + (1 - z) / z + z * (1 - z)),
  gq: (z: number): number => TR * (z * z + (1 - z) * (1 - z)),
  /** ∫ₐᵇ P_qq dz, in closed form. */
  integralQq: (a: number, b: number): number => {
    const F = (z: number) => -z - (z * z) / 2 - 2 * Math.log(1 - z);
    return CF * (F(b) - F(a));
  },
  /** ∫ₐᵇ P_gg dz (no symmetry factor), in closed form. */
  integralGg: (a: number, b: number): number => {
    const F = (z: number) => Math.log(z / (1 - z)) - 2 * z + (z * z) / 2 - (z * z * z) / 3;
    return CA * (F(b) - F(a));
  },
  /** ∫ₐᵇ P_gq dz for one flavour. */
  integralGq: (a: number, b: number): number => {
    const F = (z: number) => (z * z * z) / 3 - Math.pow(1 - z, 3) / 3;
    return TR * (F(b) - F(a));
  },
};

// ── Running coupling ──────────────────────────────────────────────────────────────────────────────────────────
// The veto algorithm needs an overestimate of αs whose integral can be inverted. We use the analytic one-loop
// form with nf = 5 and Λ fixed by αs(mZ) = 0.118,
//   αs_o(t) = 1 / (b0 ln(t/Λ²)),  b0 = (33 − 2·5)/(12π),
// multiplied by K = max(αs_true/αs_o) over the scales the shower uses, and the actual coupling is the one of
// `hep/sm` (one loop, nf thresholds at mc and mb, frozen below 1 GeV), tabulated on a log grid for speed.

export const B0_NF5 = (33 - 2 * 5) / (12 * Math.PI);
const ALPHA_S_MZ = 0.118;
const MZ = 91.1876;
/** Λ² of the nf = 5 one-loop coupling, GeV². */
export const LAMBDA2 = (MZ * MZ) * Math.exp(-1 / (B0_NF5 * ALPHA_S_MZ));
/** The analytic overestimate form αs_o(t) for t = pT² in GeV². */
export const alphaSOver = (t: number): number => 1 / (B0_NF5 * Math.log(t / LAMBDA2));

const GRID_N = 400;
const LNQ_MIN = Math.log(0.5);
const LNQ_MAX = Math.log(2e4);
const GRID_STEP = (LNQ_MAX - LNQ_MIN) / (GRID_N - 1);
let gridVals: Float64Array | undefined;
let kOver = 1;
function ensureGrid(): Float64Array {
  if (gridVals) return gridVals;
  const v = new Float64Array(GRID_N);
  let k = 1;
  for (let i = 0; i < GRID_N; i++) {
    const Q = Math.exp(LNQ_MIN + i * GRID_STEP);
    v[i] = alphaS1(Q);
    // The ratio is needed only where the shower runs (Q ≥ 0.5 GeV, where αs_o is finite and positive).
    const r = v[i]! / alphaSOver(Q * Q);
    if (r > k) k = r;
  }
  gridVals = v;
  kOver = k * 1.0005;
  return v;
}
/** The factor K ≥ 1 by which the overestimate αs_o is multiplied in the veto algorithm. */
export function overestimateFactor(): number {
  ensureGrid();
  return kOver;
}
/** The shower's coupling αs(pT) for t = pT² in GeV² (one loop, from `hep/sm`, tabulated). Frozen below 0.5 GeV. */
export function alphaSShower(t: number): number {
  const g = ensureGrid();
  const x = (0.5 * Math.log(Math.max(t, 0.25)) - LNQ_MIN) / GRID_STEP;
  if (x >= GRID_N - 1) return g[GRID_N - 1]!;
  const i = Math.floor(x);
  const f = x - i;
  return g[i]! * (1 - f) + g[i + 1]! * f;
}

// ── Emission rate and Sudakov form factor ─────────────────────────────────────────────────────────────────────

export type ShowerParton = 'q' | 'g';

const QUARK_MASSES = [0, 0, 0, 1.27, 4.18]; // d, u, s, c, b (only used as thresholds for g → qq̄)

/** Number of flavours g → qq̄ can produce at transverse momentum pT: those with mass < pT (u, d, s are massless). */
export function activeFlavours(pT: number): number {
  let n = 0;
  for (const m of QUARK_MASSES) if (m < pT) n++;
  return n;
}

export interface SudakovOptions {
  /** Which parton radiates: 'q' (q → qg) or 'g' (g → gg and g → qq̄). Default 'q'. */
  parton?: ShowerParton;
  /** Energy of the radiating parton, GeV: the z range at scale t is [pT/E, 1 − pT/E]. Default 100. */
  E?: number;
  /** A fixed coupling instead of the running one. */
  alphaS?: number;
  /** A fixed number of flavours in g → qq̄ instead of the thresholds. */
  nf?: number;
}

/** The z-integrated emission density per unit ln t at scale t (GeV²): (αs/2π) ∫ P dz over z ∈ [pT/E, 1 − pT/E]. */
export function emissionRate(t: number, opts: SudakovOptions = {}): number {
  const E = opts.E ?? 100;
  const a = Math.sqrt(t) / E;
  if (!(a < 0.5)) return 0;
  const b = 1 - a;
  const as = opts.alphaS ?? alphaSShower(t);
  let I: number;
  if ((opts.parton ?? 'q') === 'q') I = splitting.integralQq(a, b);
  else {
    const nf = opts.nf ?? activeFlavours(Math.sqrt(t));
    I = splitting.integralGg(a, b) + nf * splitting.integralGq(a, b);
  }
  return (as / (2 * Math.PI)) * I;
}

/**
 * The Sudakov form factor Δ(t0, t1): the probability that a parton of energy E emits nothing with pT² between t0 and t1,
 *   Δ = exp(−∫_{t1}^{t0} (dt/t) (αs(t)/2π) ∫ P(z) dz),
 * with the z range [pT/E, 1 − pT/E] (t0 > t1 is the usual order; the arguments may be given either way round).
 * Computed by Simpson's rule in ln t. `sudakov(t0, t1)` for a 100 GeV quark with the running coupling is the default.
 */
export function sudakov(t0: number, t1: number, opts: SudakovOptions = {}): number {
  const hi = Math.max(t0, t1), lo = Math.min(t0, t1);
  if (hi === lo) return 1;
  const n = 400; // even
  const l0 = Math.log(lo), l1 = Math.log(hi);
  const h = (l1 - l0) / n;
  let s = emissionRate(lo, opts) + emissionRate(hi, opts);
  for (let i = 1; i < n; i++) s += (i % 2 === 1 ? 4 : 2) * emissionRate(Math.exp(l0 + i * h), opts);
  return Math.exp(-(s * h) / 3);
}
