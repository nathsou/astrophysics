/**
 * Linear beam optics in one transverse plane: 2×2 transfer matrices, lattices, Twiss parameters, tunes and tracking.
 *
 * A particle is described by its displacement from the design orbit x (m) and its slope x′ = dx/ds (rad). An element maps
 * (x, x′) to (x, x′)ᵀ ← M (x, x′)ᵀ. A lattice is a list of elements in beam order; its matrix is the product
 * M = Mₙ ⋯ M₂ M₁ (the first element acts first). Lengths are in metres, focusing strengths in m⁻².
 *
 * Sign convention: k > 0 focuses in the horizontal plane (x) and therefore defocuses in the vertical plane (y).
 * Every transverse matrix has determinant 1 (Liouville's theorem: the phase-space area is conserved).
 */
import { hook } from '../hooks.ts';

/** A 2×2 matrix [a, b, c, d] = ((a, b), (c, d)), row-major. */
export type Mat2 = readonly [number, number, number, number];

export const IDENTITY: Mat2 = [1, 0, 0, 1];

/** Matrix product A·B (B acts first). */
export function mul(A: Mat2, B: Mat2): Mat2 {
  return [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
}
/** The matrix of elements applied in the given order: multiplyInOrder(M1, M2, M3) = M3·M2·M1. */
export function multiplyInOrder(ms: readonly Mat2[]): Mat2 {
  let M: Mat2 = IDENTITY;
  for (const m of ms) M = mul(m, M);
  return M;
}
export const det = (M: Mat2): number => M[0] * M[3] - M[1] * M[2];
export const trace = (M: Mat2): number => M[0] + M[3];
/** Apply a matrix to a phase-space point (x, x′). */
export const apply = (M: Mat2, x: number, xp: number): [number, number] => [M[0] * x + M[1] * xp, M[2] * x + M[3] * xp];

// ── Elements ────────────────────────────────────────────────────────────────────────────────

/** A field-free drift of length L. */
export function drift(L: number): Mat2 {
  return [1, L, 0, 1];
}
/** A thin lens of integrated strength kl = 1/f (m⁻¹); kl > 0 focuses. */
export function thinQuad(kl: number): Mat2 {
  return [1, 0, -kl, 1];
}
/** A thin lens of focal length f (m). */
export function thinLens(f: number): Mat2 {
  return thinQuad(1 / f);
}
/** The matrix of a length L with restoring-force constant K (x″ = −K x): a harmonic, free or anti-harmonic motion. */
export function focusingSection(K: number, L: number): Mat2 {
  if (Math.abs(K) < 1e-14) return drift(L);
  if (K > 0) {
    const w = Math.sqrt(K);
    const phi = w * L;
    return [Math.cos(phi), Math.sin(phi) / w, -w * Math.sin(phi), Math.cos(phi)];
  }
  const w = Math.sqrt(-K);
  const phi = w * L;
  return [Math.cosh(phi), Math.sinh(phi) / w, w * Math.sinh(phi), Math.cosh(phi)];
}
/**
 * A thick quadrupole of length L and normalised gradient k = g/(Bρ) in m⁻², where g = ∂B_y/∂x is the field gradient in T/m.
 * k > 0 focuses in x (and defocuses in y). `plane: 'y'` flips the sign.
 */
export function quad(k: number, L: number, plane: Plane = 'x'): Mat2 {
  return focusingSection(plane === 'x' ? k : -k, L);
}
/**
 * A sector dipole of length L and bending radius ρ, with field index n (n = 0 for a uniform field). The bend gives weak
 * focusing in x with K = (1 − n)/ρ² and, in y, K = n/ρ² (a pure drift when n = 0). Edge focusing is ignored.
 */
export function sectorDipole(L: number, rho: number, n = 0, plane: Plane = 'x'): Mat2 {
  const K = (plane === 'x' ? 1 - n : n) / (rho * rho);
  return focusingSection(K, L);
}
/**
 * A thin RF cavity in the longitudinal plane (z, δ): the energy kick per unit of z is `slope` = −(e V ω_RF cos φ_s)/(β² E c)
 * (a thin lens in the z–δ plane). Matrix acts on (z, δ).
 */
export function rfKick(slope: number): Mat2 {
  return [1, 0, slope, 1];
}
/** The longitudinal drift of length L in (z, δ) for slip factor η: z changes by −η L δ. */
export function slipDrift(L: number, eta: number): Mat2 {
  return [1, -eta * L, 0, 1];
}

export type Plane = 'x' | 'y';

/** The elements a lattice is made of. Lengths in m, `k` in m⁻², `kl` in m⁻¹, `angle` in rad. */
export type Element =
  | { kind: 'drift'; length: number; name?: string }
  | { kind: 'quad'; length: number; k: number; name?: string }
  | { kind: 'thinQuad'; kl: number; name?: string }
  | { kind: 'dipole'; length: number; angle: number; n?: number; name?: string }
  /** A thin sextupole: Δx′ = −½ k2l x² in x (nonlinear; ignored by the linear optics, applied by the tracker). */
  | { kind: 'sextupole'; k2l: number; name?: string };

export type Lattice = readonly Element[];

export const elementLength = (e: Element): number => ('length' in e ? e.length : 0);
export const latticeLength = (l: Lattice): number => l.reduce((s, e) => s + elementLength(e), 0);

/** The linear (2×2) matrix of an element in the given plane. A sextupole is the identity at linear order. */
export function matrixOf(e: Element, plane: Plane = 'x'): Mat2 {
  switch (e.kind) {
    case 'drift':
      return drift(e.length);
    case 'quad':
      return quad(e.k, e.length, plane);
    case 'thinQuad':
      return thinQuad(plane === 'x' ? e.kl : -e.kl);
    case 'dipole': {
      if (e.angle === 0) return drift(e.length);
      return sectorDipole(e.length, e.length / e.angle, e.n ?? 0, plane);
    }
    case 'sextupole':
      return IDENTITY;
  }
}

/** The one-turn (or one-period) matrix of a lattice. */
export function oneTurnMatrix(lattice: Lattice, plane: Plane = 'x'): Mat2 {
  return multiplyInOrder(lattice.map((e) => matrixOf(e, plane)));
}

/** Repeat a cell n times. */
export function repeat(cell: Lattice, n: number): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < n; i++) out.push(...cell);
  return out;
}

/** Split thick elements into slices no longer than `maxStep` (for plotting β(s)). Thin elements are kept whole. */
export function sliceLattice(lattice: Lattice, maxStep: number): Element[] {
  const out: Element[] = [];
  for (const e of lattice) {
    const L = elementLength(e);
    const n = L > maxStep ? Math.ceil(L / maxStep) : 1;
    if (n === 1) {
      out.push(e);
      continue;
    }
    for (let i = 0; i < n; i++) {
      if (e.kind === 'dipole') out.push({ ...e, length: L / n, angle: e.angle / n });
      else if ('length' in e) out.push({ ...e, length: L / n });
      else out.push(e);
    }
  }
  return out;
}

// ── Stability and Twiss parameters ──────────────────────────────────────────────────────────────────

/** The motion is stable (bounded) when |Tr M| < 2: the eigenvalues are then e^{±iμ} with real μ. */
export function isStable(M: Mat2): boolean {
  return Math.abs(trace(M)) < 2 - 1e-12;
}

export interface Twiss {
  beta: number;
  alpha: number;
  gamma: number;
}

export interface PeriodicSolution extends Twiss {
  stable: boolean;
  trace: number;
  /** Phase advance per period, in (0, 2π), when stable. */
  mu: number;
  /** μ/2π, the fractional tune per period. */
  tune: number;
}

/**
 * The Twiss parameters that reproduce themselves after one period: M = [[cos μ + α sin μ, β sin μ], [−γ sin μ, cos μ − α sin μ]].
 * Unstable matrices return `stable: false` and NaN parameters.
 */
export function periodicTwiss(M: Mat2): PeriodicSolution {
  const tr = trace(M);
  if (Math.abs(tr) >= 2 - 1e-12) return { stable: false, trace: tr, mu: NaN, tune: NaN, beta: NaN, alpha: NaN, gamma: NaN };
  const cos = tr / 2;
  let sin = Math.sqrt(1 - cos * cos);
  if (M[1] < 0) sin = -sin; // choose the sign of sin μ so that β > 0
  let mu = Math.atan2(sin, cos);
  if (mu < 0) mu += 2 * Math.PI;
  const beta = M[1] / sin;
  const alpha = (M[0] - M[3]) / (2 * sin);
  return { stable: true, trace: tr, mu, tune: mu / (2 * Math.PI), beta, alpha, gamma: (1 + alpha * alpha) / beta };
}

/** Propagate Twiss parameters through a matrix. */
export function propagateTwiss(t: Twiss, M: Mat2): Twiss {
  const [a, b, c, d] = M;
  const beta = a * a * t.beta - 2 * a * b * t.alpha + b * b * t.gamma;
  const alpha = -a * c * t.beta + (a * d + b * c) * t.alpha - b * d * t.gamma;
  const gamma = c * c * t.beta - 2 * c * d * t.alpha + d * d * t.gamma;
  return { beta, alpha, gamma };
}
/** The phase advance (rad) across a matrix for a beam with the given entrance Twiss parameters. */
export function phaseAdvance(t: Twiss, M: Mat2): number {
  return Math.atan2(M[1], M[0] * t.beta - M[1] * t.alpha);
}

export interface OpticsTable {
  /** Position along the lattice (m) at the end of each slice; the first entry is s = 0. */
  s: number[];
  beta: number[];
  alpha: number[];
  /** Accumulated phase advance (rad). */
  mu: number[];
  /** Index of the element each point is the end of (−1 for the start). */
  element: number[];
  /** Total phase advance divided by 2π: the tune including its integer part. */
  tune: number;
}

/**
 * β(s), α(s) and the accumulated phase through a lattice. By default the periodic solution of the lattice is used as the
 * starting point (so the lattice must be stable); pass `start` to follow a beam with other Twiss parameters.
 */
export function opticsAlong(lattice: Lattice, plane: Plane = 'x', opts: { start?: Twiss; maxStep?: number } = {}): OpticsTable {
  const start = opts.start ?? periodicTwiss(oneTurnMatrix(lattice, plane));
  const maxStep = opts.maxStep ?? 0.25;
  let t: Twiss = { beta: start.beta, alpha: start.alpha, gamma: start.gamma };
  const out: OpticsTable = { s: [0], beta: [t.beta], alpha: [t.alpha], mu: [0], element: [-1], tune: 0 };
  let s = 0;
  let mu = 0;
  lattice.forEach((e, index) => {
    for (const slice of sliceLattice([e], maxStep)) {
      const M = matrixOf(slice, plane);
      mu += phaseAdvance(t, M);
      t = propagateTwiss(t, M);
      s += elementLength(slice);
      out.s.push(s);
      out.beta.push(t.beta);
      out.alpha.push(t.alpha);
      out.mu.push(mu);
      out.element.push(index);
    }
  });
  out.tune = mu / (2 * Math.PI);
  return out;
}

/** The tune of a lattice taken as one turn, including its integer part (from the accumulated phase advance). */
export function tuneOf(lattice: Lattice, plane: Plane = 'x'): number {
  const M = oneTurnMatrix(lattice, plane);
  if (!isStable(M)) return NaN;
  return opticsAlong(lattice, plane, { maxStep: 1 }).tune;
}

/**
 * The linear chromaticity ξ = dQ/(dp/p): the change of tune with momentum offset, found by scaling every quadrupole strength
 * by 1/(1 + δ) (a particle with more momentum is focused less) and taking a central difference. Bends are kept as they are.
 * For a FODO ring ξ is negative, about −Q in a typical cell structure.
 */
export function chromaticity(lattice: Lattice, plane: Plane = 'x', delta = 1e-4): number {
  const scaled = (d: number): Element[] =>
    lattice.map((e) => (e.kind === 'quad' ? { ...e, k: e.k / (1 + d) } : e.kind === 'thinQuad' ? { ...e, kl: e.kl / (1 + d) } : e));
  const qa = tuneOf(scaled(delta), plane);
  const qb = tuneOf(scaled(-delta), plane);
  return (qa - qb) / (2 * delta);
}

// ── The thin-lens FODO cell ──────────────────────────────────────────────────────────────────────

/**
 * A thin-lens FODO cell: a focusing lens of focal length f, a drift L, a defocusing lens −f, a drift L. The cell length is 2L.
 * Its trace is 2 − L²/f², so the phase advance per cell satisfies sin(μ/2) = L/(2f) = L_cell/(4f) and the cell is stable
 * for f > L/2.
 */
export function fodoThin(f: number, L: number): Element[] {
  return [
    { kind: 'thinQuad', kl: 1 / f, name: 'QF' },
    { kind: 'drift', length: L },
    { kind: 'thinQuad', kl: -1 / f, name: 'QD' },
    { kind: 'drift', length: L },
  ];
}
/** The textbook phase advance per thin-lens FODO cell, μ = 2 asin(L/2f) (NaN when unstable). */
export function fodoPhaseAdvance(f: number, L: number): number {
  const s = L / (2 * f);
  return s >= 1 ? NaN : 2 * Math.asin(s);
}
/** β at the focusing lens (the maximum) of a thin-lens FODO cell, β⁺ = L_cell (1 + sin(μ/2))/sin μ, with L_cell = 2L the cell length. */
export function fodoBetaMax(f: number, L: number): number {
  const mu = fodoPhaseAdvance(f, L);
  return (2 * L * (1 + Math.sin(mu / 2))) / Math.sin(mu);
}
/** β at the defocusing lens (the minimum) of a thin-lens FODO cell, β⁻ = L_cell (1 − sin(μ/2))/sin μ. */
export function fodoBetaMin(f: number, L: number): number {
  const mu = fodoPhaseAdvance(f, L);
  return (2 * L * (1 - Math.sin(mu / 2))) / Math.sin(mu);
}

export interface FodoSpec {
  /** Quadrupole strengths k in m⁻² (positive numbers: QF focuses, QD defocuses). */
  kF: number;
  kD?: number;
  quadLength: number;
  /** Dipoles per half-cell and their length and bending angle (0 for a bare FODO lattice). */
  nDipoles?: number;
  dipoleLength?: number;
  dipoleAngle?: number;
  /** Free drift in each gap between magnets (m). */
  gap: number;
}
/** A thick-lens FODO cell QF – [gap, dipoles…, gap] – QD – [gap, dipoles…, gap], with `nDipoles` dipoles per half-cell. */
export function fodoCell(s: FodoSpec): Element[] {
  const nd = s.nDipoles ?? 0;
  const half = (): Element[] => {
    const out: Element[] = [];
    out.push({ kind: 'drift', length: s.gap });
    for (let i = 0; i < nd; i++) {
      out.push({ kind: 'dipole', length: s.dipoleLength ?? 0, angle: s.dipoleAngle ?? 0, name: 'MB' });
      out.push({ kind: 'drift', length: s.gap });
    }
    return out;
  };
  return [{ kind: 'quad', length: s.quadLength, k: s.kF, name: 'QF' }, ...half(), { kind: 'quad', length: s.quadLength, k: -(s.kD ?? s.kF), name: 'QD' }, ...half()];
}

/**
 * Finds the strength k (m⁻²) for which a cell built by `makeCell(k)` has the given phase advance per cell, by bisection on
 * [kLo, kHi] (the phase advance must increase with k over that range). Returns NaN if the target is not bracketed.
 */
export function solveStrengthForPhaseAdvance(makeCell: (k: number) => Lattice, muTarget: number, kLo = 1e-6, kHi = 0.5, plane: Plane = 'x'): number {
  const mu = (k: number) => periodicTwiss(oneTurnMatrix(makeCell(k), plane)).mu;
  // scan for the first bracket, since an unstable cell has no phase advance
  let a = kLo;
  let ma = mu(a);
  const steps = 400;
  for (let i = 1; i <= steps; i++) {
    const b = kLo + ((kHi - kLo) * i) / steps;
    const mb = mu(b);
    if (!Number.isFinite(mb)) break;
    if ((ma - muTarget) * (mb - muTarget) <= 0) {
      let lo = a, hi = b;
      for (let j = 0; j < 60; j++) {
        const mid = 0.5 * (lo + hi);
        if ((mu(lo) - muTarget) * (mu(mid) - muTarget) <= 0) hi = mid;
        else lo = mid;
      }
      return 0.5 * (lo + hi);
    }
    a = b;
    ma = mb;
  }
  return NaN;
}

// ── Tracking ───────────────────────────────────────────────────────────────────────────────────

export interface TrackResult {
  /** Coordinates at the start of each turn: x[0] = x0. Length nTurns. */
  x: number[];
  xp: number[];
}

/**
 * The reference tracker: follows (x, x′) through every element, turn after turn. Linear elements use their transfer matrix;
 * thin sextupoles kick Δx′ = −½ k2l x². Returns the coordinates at the start of each of the `nTurns` turns.
 *
 * Reader's hook: `machine.trackThroughLattice` (same signature). The widgets and the control room call it through the hook.
 */
export function referenceTrackThroughLattice(lattice: Lattice, x0: number, xp0: number, nTurns: number, plane: Plane = 'x'): TrackResult {
  // Merge runs of linear elements into single matrices; sextupoles split the runs.
  type Seg = { m: Mat2 } | { k2l: number };
  const segs: Seg[] = [];
  let run: Mat2 = IDENTITY;
  let open = false;
  for (const e of lattice) {
    if (e.kind === 'sextupole') {
      if (open) segs.push({ m: run });
      run = IDENTITY;
      open = false;
      segs.push({ k2l: plane === 'x' ? e.k2l : -e.k2l });
    } else {
      run = mul(matrixOf(e, plane), run);
      open = true;
    }
  }
  if (open) segs.push({ m: run });
  const x: number[] = [];
  const xp: number[] = [];
  let cx = x0;
  let cp = xp0;
  for (let turn = 0; turn < nTurns; turn++) {
    x.push(cx);
    xp.push(cp);
    for (const seg of segs) {
      if ('m' in seg) {
        const nx = seg.m[0] * cx + seg.m[1] * cp;
        cp = seg.m[2] * cx + seg.m[3] * cp;
        cx = nx;
      } else {
        cp -= 0.5 * seg.k2l * cx * cx;
      }
    }
  }
  return { x, xp };
}

/** Track one particle through a lattice for `nTurns` turns. Goes through the reader's hook `machine.trackThroughLattice` if installed. */
export function trackThroughLattice(lattice: Lattice, x0: number, xp0: number, nTurns: number, plane: Plane = 'x'): TrackResult {
  return hook('machine.trackThroughLattice', referenceTrackThroughLattice)(lattice, x0, xp0, nTurns, plane);
}

// ── Tunes from turn-by-turn data ─────────────────────────────────────────────────────────────────

/** In-place iterative radix-2 FFT (length must be a power of two). Forward transform, no normalisation. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n & (n - 1)) throw new Error('fft: length must be a power of two');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b]! * cr - im[b]! * ci;
        const ti = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * The betatron tune from turn-by-turn data: a Hann-windowed, zero-padded DFT whose peak is refined by a parabola through
 * the three bins around the maximum. With positions only, the tune is folded into (0, ½] (a real signal cannot tell Q from
 * 1 − Q). If the slopes `xp` are given too, the complex signal x − i s x′ (s = σx/σx′) is used and the tune is found in (0, 1).
 */
export function tuneFromTurns(x: ArrayLike<number>, xp?: ArrayLike<number>): number {
  const n = x.length;
  if (n < 8) return NaN;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += x[i]!;
  mean /= n;
  let meanP = 0;
  let sx = 0;
  let sp = 0;
  if (xp) {
    for (let i = 0; i < n; i++) meanP += xp[i]!;
    meanP /= n;
    for (let i = 0; i < n; i++) {
      sx += (x[i]! - mean) ** 2;
      sp += (xp[i]! - meanP) ** 2;
    }
  }
  const scale = xp && sp > 0 ? Math.sqrt(sx / sp) : 0;
  let N = 1;
  while (N < 4 * n) N <<= 1;
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < n; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * (i + 0.5)) / n));
    re[i] = (x[i]! - mean) * w;
    if (xp) im[i] = -scale * (xp[i]! - meanP) * w;
  }
  fft(re, im);
  const half = xp ? N : N / 2;
  const mag = (k: number) => Math.hypot(re[(k + N) % N]!, im[(k + N) % N]!);
  let best = 1;
  for (let k = 1; k < half; k++) if (mag(k) > mag(best)) best = k;
  const a = Math.log(mag(best - 1) + 1e-300);
  const b = Math.log(mag(best) + 1e-300);
  const c = Math.log(mag(best + 1) + 1e-300);
  const denom = a - 2 * b + c;
  const shift = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
  return (best + shift) / N;
}

// ── Emittance, beam size, resonances ─────────────────────────────────────────────────────────────────────

/** RMS beam size σ = √(ε β) for geometric emittance ε (m·rad) and β function (m). */
export const beamSigma = (emittance: number, beta: number): number => Math.sqrt(emittance * beta);
/** RMS angular divergence σ′ = √(ε γ_T) = √(ε (1 + α²)/β). */
export const beamDivergence = (emittance: number, t: Twiss): number => Math.sqrt(emittance * t.gamma);
/** Geometric emittance from normalised emittance ε_n = βγ ε: ε = ε_n/(βγ). `betaGamma` is the particle's βγ (= p/mc). */
export const geometricEmittance = (epsNormalised: number, betaGamma: number): number => epsNormalised / betaGamma;
/** Normalised emittance from the geometric one. It is conserved during acceleration (the geometric one shrinks as 1/βγ). */
export const normalisedEmittance = (eps: number, betaGamma: number): number => eps * betaGamma;

/** RMS emittance of a distribution: √(⟨x²⟩⟨x′²⟩ − ⟨x x′⟩²), with the means subtracted. */
export function emittanceFromParticles(x: ArrayLike<number>, xp: ArrayLike<number>): number {
  const n = x.length;
  let mx = 0, mp = 0;
  for (let i = 0; i < n; i++) { mx += x[i]!; mp += xp[i]!; }
  mx /= n; mp /= n;
  let sxx = 0, spp = 0, sxp = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i]! - mx, b = xp[i]! - mp;
    sxx += a * a; spp += b * b; sxp += a * b;
  }
  return Math.sqrt(Math.max(0, (sxx * spp - sxp * sxp)) ) / n;
}

/** Points on the invariant (Courant–Snyder) ellipse of amplitude ε for the given Twiss parameters. */
export function phaseSpaceEllipse(t: Twiss, emittance: number, n = 64): { x: number; xp: number }[] {
  const out: { x: number; xp: number }[] = [];
  const a = Math.sqrt(emittance * t.beta);
  const b = Math.sqrt(emittance / t.beta);
  for (let i = 0; i <= n; i++) {
    const phi = (2 * Math.PI * i) / n;
    out.push({ x: a * Math.cos(phi), xp: -b * (t.alpha * Math.cos(phi) + Math.sin(phi)) });
  }
  return out;
}

export interface ResonanceLine {
  /** The line n Qx + m Qy = p. */
  n: number;
  m: number;
  p: number;
  order: number;
}
/** Resonance lines n Qx + m Qy = p of order |n| + |m| ≤ maxOrder that cross the square [qx0, qx0+1] × [qy0, qy0+1]. */
export function resonanceLines(maxOrder: number, qx0 = 0, qy0 = 0): ResonanceLine[] {
  const out: ResonanceLine[] = [];
  const seen = new Set<string>();
  for (let n = -maxOrder; n <= maxOrder; n++) {
    for (let m = 0; m <= maxOrder; m++) {
      const order = Math.abs(n) + m;
      if (order === 0 || order > maxOrder) continue;
      if (m === 0 && n < 0) continue;
      const corners = [qx0, qx0 + 1].flatMap((qx) => [qy0, qy0 + 1].map((qy) => n * qx + m * qy));
      const lo = Math.ceil(Math.min(...corners) - 1e-9);
      const hi = Math.floor(Math.max(...corners) + 1e-9);
      for (let p = lo; p <= hi; p++) {
        const key = `${n},${m},${p}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ n, m, p, order });
        }
      }
    }
  }
  return out.sort((a, b) => a.order - b.order);
}
/** The smallest distance in the (Qx, Qy) plane from a working point to a resonance line of order ≤ maxOrder. */
export function resonanceDistance(qx: number, qy: number, maxOrder: number): { distance: number; line: ResonanceLine | null } {
  let best = Infinity;
  let bestLine: ResonanceLine | null = null;
  for (const l of resonanceLines(maxOrder, Math.floor(qx), Math.floor(qy))) {
    const d = Math.abs(l.n * qx + l.m * qy - l.p) / Math.hypot(l.n, l.m);
    if (d < best) {
      best = d;
      bestLine = l;
    }
  }
  return { distance: best, line: bestLine };
}
