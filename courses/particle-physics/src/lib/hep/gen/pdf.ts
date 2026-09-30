/**
 * Proton parton distributions x·f(x, Q) for d, u, s, c, b, g and their antiquarks.
 *
 * ┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
 * │ THIS IS A PEDAGOGICAL PARAMETRISATION, NOT A FIT TO DATA.                                                 │
 * │ Use it to see what parton distributions do, not to predict a cross-section you will compare to a paper. │
 * └──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * How it is built (nothing is downloaded and no table of any published PDF set is used):
 *
 *  1. At the starting scale Q0 = mc = 1.27 GeV the distributions are simple analytic shapes of the classic form
 *     x q(x) = A x^a (1 − x)^b (1 + γ x), for the valence quarks u_v, d_v and for the sea (ū, d̄, s), and for the gluon
 *     x g = A_g x^(−δ) (1 − x)^η. The exponents were chosen by hand to look like published leading-order inputs
 *     (valence peak near x ≈ 0.2, d̄ > ū, strangeness suppressed, a gluon rising at small x). The normalisations are
 *     fixed by the sum rules: ∫u_v dx = 2, ∫d_v dx = 1, and the momentum sum rule ∫x Σ dx = 1 (A_g closes it).
 *     Charm and bottom start at zero at their thresholds mc and mb.
 *  2. The evolution in Q is the real leading-order DGLAP equation, d(x f)/d ln Q² = (αs/2π) P ⊗ f, with the four
 *     splitting functions P_qq, P_qg, P_gq, P_gg (plus-prescriptions included), one-loop αs with αs(mZ) = 0.118,
 *     nf = 4 from mc to mb and nf = 5 above. It is integrated once, the first time a distribution is asked for,
 *     on a grid of 160 points in ln(1/x) from x = 1 to x = 10⁻⁶ with 4-point Lagrange interpolation, and stored on a
 *     grid of Q values (spacing 0.15 in ln Q²). The result is interpolated: cubic in ln(1/x), linear in ln Q².
 *     This is the "documented smooth interpolation in ln Q²" of the brief, and DGLAP itself keeps the sum rules.
 *  3. Below Q0 the distributions are frozen at their Q0 values; above Qmax = 10 TeV they are frozen at Qmax.
 *     The top quark is not a parton (nf stays 5 up to Qmax).
 *
 * What it reproduces (asserted in pdf.test.ts): momentum sum rule to better than 3 %, ∫(u−ū) = 2, ∫(d−d̄) = 1,
 * gluon momentum fraction 45–50 % at Q = 10 GeV. What it does not: fine details of any measurement. Expect errors of
 * 10–30 % in individual quark distributions at fixed x, and factors in the small-x gluon. The W and Z cross-sections
 * that come out are "about right" at leading order, nothing more.
 */
import { alphaS1 } from '../sm/index.ts';

/** Starting scale of the evolution, GeV (= the charm mass). */
export const PDF_Q0 = 1.27;
/** Upper end of the tabulated range, GeV. */
export const PDF_Q_MAX = 1e4;
/** Smallest x on the grid. Below it x·f is taken constant. */
export const PDF_X_MIN = 1e-6;

const MB = 4.18;
const N = 160;
const Y_MAX = Math.log(1 / PDF_X_MIN);
const H = Y_MAX / (N - 1);
const CF = 4 / 3, CA = 3, TR = 0.5;

// Index of each distribution in the state vector.
const D = 0, DB = 1, U = 2, UB = 3, S = 4, C = 5, B = 6, G = 7, NF = 8;

// ── Input distributions ───────────────────────────────────────────────────────────────────────────────────────
/** Input shapes at Q0 (before normalisation). */
const INPUT = {
  uv: { a: 0.55, b: 3.3, g: 2.0 },
  dv: { a: 0.6, b: 4.3, g: 2.0 },
  /** sea: ū = S, d̄ = S + Δ; shapes of x S and x Δ. */
  sea: { a: -0.12, b: 7.5, g: 0 },
  delta: { a: 0.45, b: 8.5, g: 0 },
  strangeness: 0.45, // x s = κ · ½(x ū + x d̄) · (1 − x)
  seaMomentum: 0.17, // fraction of the momentum in the sea quarks and antiquarks, 2(ū + d̄ + s), at Q0
  deltaNumber: 0.10, // ∫(d̄ − ū) dx at Q0
  gluon: { a: -0.22, b: 5.6 },
};

const xGrid = new Float64Array(N);
const yGrid = new Float64Array(N);
for (let j = 0; j < N; j++) {
  yGrid[j] = j * H;
  xGrid[j] = Math.exp(-j * H);
}
/** ∫ F dy and ∫ F e^(−y) dy (trapezoid on the y grid, plus the analytic tail below x_min for power-like shapes ignored). */
function numberIntegral(F: ArrayLike<number>): number {
  let s = 0;
  for (let j = 0; j < N; j++) s += F[j]! * (j === 0 || j === N - 1 ? 0.5 : 1);
  return s * H;
}
function momentumIntegral(F: ArrayLike<number>): number {
  let s = 0;
  for (let j = 0; j < N; j++) s += F[j]! * xGrid[j]! * (j === 0 || j === N - 1 ? 0.5 : 1);
  return s * H;
}
const shape = (p: { a: number; b: number; g: number }, x: number): number => Math.pow(x, p.a) * Math.pow(1 - x, p.b) * (1 + p.g * x);

function inputState(): Float64Array[] {
  const st: Float64Array[] = Array.from({ length: NF }, () => new Float64Array(N));
  const uv = new Float64Array(N), dv = new Float64Array(N), sea = new Float64Array(N), del = new Float64Array(N), gl = new Float64Array(N);
  for (let j = 1; j < N; j++) {
    const x = xGrid[j]!;
    uv[j] = shape(INPUT.uv, x);
    dv[j] = shape(INPUT.dv, x);
    sea[j] = shape(INPUT.sea, x);
    del[j] = shape(INPUT.delta, x);
    gl[j] = Math.pow(x, INPUT.gluon.a) * Math.pow(1 - x, INPUT.gluon.b);
  }
  // number sum rules: ∫ q_v dx = ∫ F dy
  const kUv = 2 / numberIntegral(uv);
  const kDv = 1 / numberIntegral(dv);
  const kDel = INPUT.deltaNumber / numberIntegral(del);
  for (let j = 1; j < N; j++) {
    const x = xGrid[j]!;
    uv[j] = kUv * shape(INPUT.uv, x);
    dv[j] = kDv * shape(INPUT.dv, x);
    del[j] = kDel * shape(INPUT.delta, x);
  }
  // sea normalisation: momentum in 2(ū + d̄ + s) = seaMomentum. With ū = S, d̄ = S + Δ, s = κ (S + Δ/2)(1 − x).
  const unit = (k: number) => {
    const mom = new Float64Array(N);
    for (let j = 1; j < N; j++) {
      const x = xGrid[j]!;
      const S0 = k * sea[j]!;
      const ub = S0, db = S0 + del[j]!;
      const sv = INPUT.strangeness * 0.5 * (ub + db) * (1 - x);
      mom[j] = 2 * (ub + db + sv);
    }
    return momentumIntegral(mom);
  };
  const k1 = unit(1);
  const k0 = unit(0);
  const kSea = (INPUT.seaMomentum - k0) / (k1 - k0);
  for (let j = 1; j < N; j++) {
    const x = xGrid[j]!;
    const ub = kSea * sea[j]!;
    const db = ub + del[j]!;
    st[U]![j] = uv[j]! + ub;
    st[UB]![j] = ub;
    st[D]![j] = dv[j]! + db;
    st[DB]![j] = db;
    st[S]![j] = INPUT.strangeness * 0.5 * (ub + db) * (1 - x);
  }
  // gluon closes the momentum sum rule
  let mq = 0;
  for (const k of [D, DB, U, UB]) mq += momentumIntegral(st[k]!);
  mq += 2 * momentumIntegral(st[S]!);
  const mg0 = momentumIntegral(gl);
  const kg = (1 - mq) / mg0;
  for (let j = 1; j < N; j++) st[G]![j] = kg * gl[j]!;
  return st;
}

// ── DGLAP kernels on the grid ─────────────────────────────────────────────────────────────────────────────────
/** 8-point Gauss–Legendre on [0, 1]. */
const GL_X = [0.0198550717512319, 0.1016667612931866, 0.2372337950418355, 0.4082826787521751, 0.5917173212478249, 0.7627662049581645, 0.8983332387068134, 0.9801449282487681];
const GL_W = [0.0506142681451881, 0.1111905172266872, 0.1568533229389436, 0.1813418916891810, 0.1813418916891810, 0.1568533229389436, 0.1111905172266872, 0.0506142681451881];

interface Kernels {
  qq: Float64Array;
  qg: Float64Array;
  gq: Float64Array;
  gg: Float64Array;
}

/** 4-point Lagrange weights at position p (in grid-index units) on the node set starting at `base`. */
function lagrange(p: number, out: Float64Array): number {
  let base = Math.floor(p) - 1;
  if (base < 0) base = 0;
  if (base > N - 4) base = N - 4;
  for (let a = 0; a < 4; a++) {
    let w = 1;
    for (let b = 0; b < 4; b++) if (b !== a) w *= (p - (base + b)) / (a - b);
    out[a] = w;
  }
  return base;
}

function buildKernels(): Kernels {
  const qq = new Float64Array(N * N), qg = new Float64Array(N * N), gq = new Float64Array(N * N), gg = new Float64Array(N * N);
  const lw = new Float64Array(4);
  for (let i = 1; i < N; i++) {
    const yi = yGrid[i]!;
    const xi = xGrid[i]!;
    const panels = Math.max(1, Math.ceil(yi / 0.2));
    const dt = yi / panels;
    let plusQQ = 0, plusGG = 0;
    for (let pn = 0; pn < panels; pn++) {
      for (let q = 0; q < GL_X.length; q++) {
        const t = (pn + GL_X[q]!) * dt;
        const w = GL_W[q]! * dt;
        const z = Math.exp(-t);
        const omz = -Math.expm1(-t); // 1 − z, accurate for small t
        const base = lagrange((yi - t) / H, lw);
        const zOverOmz = z / omz;
        // plus-distribution pieces: z g(z)/(1−z) × F(y−t), with the subtraction z g(1)/(1−z) × F(y) on the diagonal
        const gqqz = CF * (1 + z * z);
        const gggz = 2 * CA * z;
        const regQG = TR * (z * z + (1 - z) * (1 - z));
        const regGQ = CF * (1 + (1 - z) * (1 - z)) / z;
        const regGG = 2 * CA * ((1 - z) / z + z * (1 - z));
        for (let a = 0; a < 4; a++) {
          const col = i * N + base + a;
          const L = lw[a]!;
          qq[col] = qq[col]! + w * zOverOmz * gqqz * L;
          gg[col] = gg[col]! + w * (zOverOmz * gggz + z * regGG) * L;
          qg[col] = qg[col]! + w * z * regQG * L;
          gq[col] = gq[col]! + w * z * regGQ * L;
        }
        plusQQ += w * zOverOmz * 2 * CF;
        plusGG += w * zOverOmz * 2 * CA;
      }
    }
    // diagonal: −∫ z g(1)/(1−z) dt + g(1) ln(1−x) and the δ(1−z) terms
    qq[i * N + i] = qq[i * N + i]! - plusQQ + 2 * CF * Math.log1p(-xi) + 1.5 * CF;
    gg[i * N + i] = gg[i * N + i]! - plusGG + 2 * CA * Math.log1p(-xi) + 11 / 2;
  }
  return { qq, qg, gq, gg };
}

function apply(K: Float64Array, F: Float64Array, out: Float64Array): void {
  for (let i = 0; i < N; i++) {
    const hi = Math.min(N - 1, i + 3);
    let s = 0;
    const row = i * N;
    for (let j = 0; j <= hi; j++) s += K[row + j]! * F[j]!;
    out[i] = s;
  }
}

// ── Evolution and tabulation ──────────────────────────────────────────────────────────────────────────────────
interface Table {
  /** ln Q² of each stored node. */
  t: Float64Array;
  /** data[k] is a Float64Array of NF × N values for node k. */
  data: Float64Array[];
  /** node spacings: nodes [0, nLow] have step dtLow, the rest dtHigh. */
  nLow: number;
  dtLow: number;
  dtHigh: number;
  t0: number;
  tB: number;
}
let table: Table | undefined;
let kernels: Kernels | undefined;

function evolveTable(): Table {
  kernels ??= buildKernels();
  const K = kernels;
  const t0 = Math.log(PDF_Q0 * PDF_Q0);
  const tB = Math.log(MB * MB);
  const tMax = Math.log(PDF_Q_MAX * PDF_Q_MAX);
  const nLow = Math.round((tB - t0) / 0.15);
  const dtLow = (tB - t0) / nLow;
  const nHigh = Math.round((tMax - tB) / 0.15);
  const dtHigh = (tMax - tB) / nHigh;

  let F = inputState();
  const tmp = Array.from({ length: 5 }, () => new Float64Array(N));
  const sigma = new Float64Array(N);

  const rhs = (t: number, Fin: Float64Array[], nf: number): Float64Array[] => {
    const a = alphaS1(Math.exp(0.5 * t)) / (2 * Math.PI);
    const out = Array.from({ length: NF }, () => new Float64Array(N));
    const g = Fin[G]!;
    apply(K.qg, g, tmp[0]!); // P_qg ⊗ g
    sigma.fill(0);
    const active = nf === 4 ? [D, DB, U, UB, S, C] : [D, DB, U, UB, S, C, B];
    for (const k of active) {
      const w = k >= S ? 2 : 1;
      const f = Fin[k]!;
      for (let j = 0; j < N; j++) sigma[j] = sigma[j]! + w * f[j]!;
    }
    apply(K.gq, sigma, tmp[1]!); // P_gq ⊗ Σ
    apply(K.gg, g, tmp[2]!); // P_gg ⊗ g (nf-independent part)
    for (const k of active) {
      apply(K.qq, Fin[k]!, tmp[3]!);
      const o = out[k]!;
      for (let j = 0; j < N; j++) o[j] = a * (tmp[3]![j]! + tmp[0]![j]!);
    }
    const og = out[G]!;
    for (let j = 0; j < N; j++) og[j] = a * (tmp[1]![j]! + tmp[2]![j]! - (nf / 3) * g[j]!);
    return out;
  };
  const axpy = (Fa: Float64Array[], k: Float64Array[], h: number): Float64Array[] =>
    Fa.map((arr, idx) => {
      const r = new Float64Array(N);
      const kk = k[idx]!;
      for (let j = 0; j < N; j++) r[j] = arr[j]! + h * kk[j]!;
      return r;
    });
  const step = (t: number, Fin: Float64Array[], h: number, nf: number): Float64Array[] => {
    const k1 = rhs(t, Fin, nf);
    const k2 = rhs(t + h / 2, axpy(Fin, k1, h / 2), nf);
    const k3 = rhs(t + h / 2, axpy(Fin, k2, h / 2), nf);
    const k4 = rhs(t + h, axpy(Fin, k3, h), nf);
    return Fin.map((arr, idx) => {
      const r = new Float64Array(N);
      const a1 = k1[idx]!, a2 = k2[idx]!, a3 = k3[idx]!, a4 = k4[idx]!;
      for (let j = 0; j < N; j++) r[j] = arr[j]! + (h / 6) * (a1[j]! + 2 * a2[j]! + 2 * a3[j]! + a4[j]!);
      return r;
    });
  };
  const flatten = (Fin: Float64Array[]): Float64Array => {
    const flat = new Float64Array(NF * N);
    for (let k = 0; k < NF; k++) flat.set(Fin[k]!, k * N);
    return flat;
  };

  const ts: number[] = [t0];
  const data: Float64Array[] = [flatten(F)];
  let t = t0;
  for (let n = 0; n < nLow; n++) {
    F = step(t, F, dtLow, 4);
    t += dtLow;
    ts.push(t);
    data.push(flatten(F));
  }
  for (let n = 0; n < nHigh; n++) {
    F = step(t, F, dtHigh, 5);
    t += dtHigh;
    ts.push(t);
    data.push(flatten(F));
  }
  return { t: Float64Array.from(ts), data, nLow, dtLow, dtHigh, t0, tB };
}

function getTable(): Table {
  table ??= evolveTable();
  return table;
}

// ── Lookup ─────────────────────────────────────────────────────────────────────────────────────────────────────
const lw4 = new Float64Array(4);
const cacheOut = new Float64Array(NF);
let cacheX = -1, cacheQ = -1;

/**
 * Fill `out` (length ≥ 8) with x·f for [d, d̄, u, ū, s, c, b, g] at (x, Q). x in (0, 1); Q in GeV.
 * s̄ = s, c̄ = c and b̄ = b.
 */
export function pdfAll(x: number, Q: number, out: Float64Array): Float64Array {
  if (!(x > 0) || x >= 1) {
    out.fill(0, 0, NF);
    return out;
  }
  const T = getTable();
  let t = 2 * Math.log(Q);
  if (t < T.t0) t = T.t0;
  const tEnd = T.t[T.t.length - 1]!;
  if (t > tEnd) t = tEnd;
  let k: number;
  if (t < T.tB) k = Math.min(T.nLow - 1, Math.floor((t - T.t0) / T.dtLow));
  else k = Math.min(T.t.length - 2, T.nLow + Math.floor((t - T.tB) / T.dtHigh));
  if (k < 0) k = 0;
  const f = (t - T.t[k]!) / (T.t[k + 1]! - T.t[k]!);
  const d0 = T.data[k]!, d1 = T.data[k + 1]!;
  // below the b threshold, the b distribution at the node above is zero by construction: no special case needed
  let y = -Math.log(x);
  if (y > Y_MAX) y = Y_MAX;
  const base = lagrange(y / H, lw4);
  const w0 = lw4[0]!, w1 = lw4[1]!, w2 = lw4[2]!, w3 = lw4[3]!;
  for (let s = 0; s < NF; s++) {
    const o = s * N + base;
    const a = w0 * d0[o]! + w1 * d0[o + 1]! + w2 * d0[o + 2]! + w3 * d0[o + 3]!;
    const b = w0 * d1[o]! + w1 * d1[o + 1]! + w2 * d1[o + 2]! + w3 * d1[o + 3]!;
    const v = a + f * (b - a);
    out[s] = v > 0 ? v : 0;
  }
  return out;
}

/**
 * x·f(x, Q) for a parton of the proton: PDG code 1 d, 2 u, 3 s, 4 c, 5 b, 21 g, negative codes for antiquarks
 * (−1 d̄, −2 ū, …). With `antiproton` the beam is a p̄ (u ↔ ū, d ↔ d̄, …).
 */
export function xf(pdg: number, x: number, Q: number, antiproton = false): number {
  if (x !== cacheX || Q !== cacheQ) {
    pdfAll(x, Q, cacheOut);
    cacheX = x;
    cacheQ = Q;
  }
  const p = antiproton && pdg !== 21 ? -pdg : pdg;
  return cacheOut[slotOf(p)]!;
}
/** The slot in the output of `pdfAll` for a PDG code. */
export function slotOf(pdg: number): number {
  switch (pdg) {
    case 1: return D;
    case -1: return DB;
    case 2: return U;
    case -2: return UB;
    case 3: case -3: return S;
    case 4: case -4: return C;
    case 5: case -5: return B;
    case 21: return G;
    default: throw new Error(`xf: no parton with PDG code ${pdg}`);
  }
}
/** The parton density f(x, Q) = (x f)/x. */
export function f(pdg: number, x: number, Q: number, antiproton = false): number {
  return xf(pdg, x, Q, antiproton) / x;
}

/** ∫₀¹ x f dx of one parton, or the sum over those listed; computed on the grid (for the sum rules). */
export function momentumFraction(pdgs: readonly number[], Q: number): number {
  let s = 0;
  const out = new Float64Array(NF);
  const F = new Float64Array(N);
  for (let j = 1; j < N; j++) {
    pdfAll(xGrid[j]!, Q, out);
    let v = 0;
    for (const p of pdgs) v += out[slotOf(p)]!;
    F[j] = v;
  }
  s = momentumIntegral(F);
  // tail below x_min: x f ≈ constant → ∫₀^xmin (x f) dx/x·x... negligible (≤ x_min × xf), added for completeness
  return s + (F[N - 1]! * PDF_X_MIN);
}
/** ∫₀¹ f dx = ∫ (x f) d ln(1/x) of one parton (or a signed combination: pass `sign` per entry). The x → 0 tail is cut at x_min. */
export function numberFraction(pdgs: readonly number[], Q: number, signs?: readonly number[]): number {
  const out = new Float64Array(NF);
  const F = new Float64Array(N);
  for (let j = 1; j < N; j++) {
    pdfAll(xGrid[j]!, Q, out);
    let v = 0;
    pdgs.forEach((p, idx) => (v += (signs?.[idx] ?? 1) * out[slotOf(p)]!));
    F[j] = v;
  }
  return numberIntegral(F);
}

// ── Luminosity ─────────────────────────────────────────────────────────────────────────────────────────────────
const GL16_X = [-0.9894009349916499, -0.9445750230732326, -0.8656312023878318, -0.7554044083550030, -0.6178762444026438, -0.4580167776572274, -0.2816035507792589, -0.0950125098376374, 0.0950125098376374, 0.2816035507792589, 0.4580167776572274, 0.6178762444026438, 0.7554044083550030, 0.8656312023878318, 0.9445750230732326, 0.9894009349916499];
const GL16_W = [0.0271524594117541, 0.0622535239386479, 0.0951585116824928, 0.1246289712555339, 0.1495959888165767, 0.1691565193950025, 0.1826034150449236, 0.1894506104550685, 0.1894506104550685, 0.1826034150449236, 0.1691565193950025, 0.1495959888165767, 0.1246289712555339, 0.0951585116824928, 0.0622535239386479, 0.0271524594117541];

export type ParticlePair = readonly [number, number];
/** Named sets of parton pairs: quark–antiquark (5 flavours, both assignments), gluon–gluon, quark–gluon. */
export function partonPairs(set: 'qqbar' | 'gg' | 'qg' | 'uubar' | 'ddbar'): ParticlePair[] {
  const flav = set === 'uubar' ? [2] : set === 'ddbar' ? [1] : [1, 2, 3, 4, 5];
  if (set === 'gg') return [[21, 21]];
  if (set === 'qg') return flav.flatMap((q) => [[q, 21], [-q, 21], [21, q], [21, -q]] as ParticlePair[]);
  return flav.flatMap((q) => [[q, -q], [-q, q]] as ParticlePair[]);
}

/**
 * Parton–parton luminosity dL/dτ = Σ_pairs ∫_τ^1 (dx/x) f_a(x) f_b(τ/x), at factorisation scale Q, so that
 * σ = ∫ dτ (dL/dτ) σ̂(ŝ = τ s). `flavours` lists (a, b) with a from beam 1 and b from beam 2 (PDG codes of the partons),
 * or one of the names 'qqbar', 'gg', 'qg'. With `antiproton`, beam 2 is an antiproton (Tevatron, SppS).
 * Computed with 16-point Gauss–Legendre in rapidity, y ∈ [−½ ln(1/τ), ½ ln(1/τ)].
 */
export function luminosity(tau: number, Q: number, flavours: readonly ParticlePair[] | 'qqbar' | 'gg' | 'qg', antiproton = false): number {
  if (!(tau > 0) || tau >= 1) return 0;
  const pairs = typeof flavours === 'string' ? partonPairs(flavours) : flavours;
  const L = Math.log(1 / tau);
  const half = 0.5 * L;
  const sq = Math.sqrt(tau);
  const o1 = new Float64Array(NF), o2 = new Float64Array(NF);
  let total = 0;
  for (let i = 0; i < GL16_X.length; i++) {
    const y = half * GL16_X[i]!;
    const x1 = sq * Math.exp(y), x2 = sq * Math.exp(-y);
    if (x1 >= 1 || x2 >= 1) continue;
    pdfAll(x1, Q, o1);
    pdfAll(x2, Q, o2);
    let s = 0;
    for (const [a, b] of pairs) {
      const bb = antiproton && b !== 21 ? -b : b;
      s += o1[slotOf(a)]! * o2[slotOf(bb)]!;
    }
    total += GL16_W[i]! * half * s;
  }
  return total / tau;
}
