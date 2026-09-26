// Shared FLRW / Friedmann-equation math for the Chapter 25 ("expansion") sims.
// Units: a = 1 today. H0 is given in km/s/Mpc; helpers convert to Gyr or Mpc as needed.
// This module is a local helper (src/sims/expansion/**), not a shared /lib file.

export const C_KMS = 299792.458; // speed of light, km/s
export const GYR_PER_INV_H0 = 977.792; // Gyr, for H0 in km/s/Mpc: t_H = 977.792 / H0 Gyr

export interface OmegaParams {
  Om: number; // matter
  OL: number; // dark energy / Lambda (constant-w = -1 unless wDE given)
  Or: number; // radiation
}

/** Curvature density, derived so the four densities sum to 1. */
export function Ok(p: OmegaParams): number {
  return 1 - p.Om - p.OL - p.Or;
}

/** E(a)^2 = (H/H0)^2, as a function of scale factor. Can go negative beyond a turning point — that's the point. */
export function E2(a: number, p: OmegaParams): number {
  const ok = Ok(p);
  return p.Or / (a * a * a * a) + p.Om / (a * a * a) + ok / (a * a) + p.OL;
}

/** E(z)^2 = (H/H0)^2 as a function of redshift. */
export function E2z(z: number, p: OmegaParams): number {
  const a = 1 / (1 + z);
  return E2(a, p);
}

/** Present-day deceleration parameter q0 = ΣΩᵢ(1+3wᵢ)/2 = Om/2 + Or − OL. */
export function q0(p: OmegaParams): number {
  return 0.5 * p.Om + p.Or - p.OL;
}

/** Deceleration parameter at scale factor a (sign of ä). */
export function qOfA(a: number, p: OmegaParams): number {
  const e2 = E2(a, p);
  if (e2 <= 0) return NaN;
  const num = p.Om / (a * a * a) + 2 * p.Or / (a * a * a * a) - 2 * p.OL;
  return num / (2 * e2);
}

/** Scale factor at matter–radiation equality (Or/a^4 = Om/a^3). */
export function aEqMR(p: OmegaParams): number {
  return p.Or > 0 ? p.Or / p.Om : 0;
}

/** Scale factor at matter–Lambda equality (Om/a^3 = OL). */
export function aEqML(p: OmegaParams): number {
  return p.OL > 0 ? Math.cbrt(p.Om / p.OL) : Infinity;
}

/** Bisection for a root of f in [lo, hi], assuming a single sign change. */
function bisect(f: (x: number) => number, lo: number, hi: number, iters = 60): number {
  let flo = f(lo);
  for (let i = 0; i < iters; i++) {
    const mid = 0.5 * (lo + hi);
    const fm = f(mid);
    if (flo * fm <= 0) hi = mid;
    else { lo = mid; flo = fm; }
  }
  return 0.5 * (lo + hi);
}

/**
 * Midpoint-rule quadrature of ∫_a0^a1 f(a) da, with an optional quadratic (Clenshaw–Curtis-like)
 * substitution that clusters nodes near an endpoint where the integrand has an inverse-sqrt
 * singularity (a Big Bang start with no radiation, or a turnaround where E(a) → 0). The
 * substitution's Jacobian vanishes exactly at that endpoint, cancelling the 1/sqrt divergence,
 * and the midpoint rule never evaluates the exact endpoint, so no special-casing is needed.
 */
function quad(f: (a: number) => number, a0: number, a1: number, singularStart: boolean, singularEnd: boolean, N: number): number {
  const shape = (u: number) => {
    if (singularStart && singularEnd) return 0.5 * (1 - Math.cos(Math.PI * u));
    if (singularStart) return u * u;
    if (singularEnd) return 2 * u - u * u;
    return u;
  };
  const dshape = (u: number) => {
    if (singularStart && singularEnd) return (Math.PI / 2) * Math.sin(Math.PI * u);
    if (singularStart) return 2 * u;
    if (singularEnd) return 2 - 2 * u;
    return 1;
  };
  let sum = 0;
  const du = 1 / N;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) * du;
    const a = a0 + (a1 - a0) * shape(u);
    sum += f(a) * (a1 - a0) * dshape(u) * du;
  }
  return sum;
}

export type Fate = 'crunch' | 'eternal-accel' | 'eternal-coast' | 'bounce' | 'loitering';

export interface History {
  as: Float64Array;
  ts: Float64Array; // Gyr, t = 0 at the earliest point shown (Big Bang or bounce)
  nowIndex: number;
  ageGyr: number; // time from earliest point to a = 1
  fate: Fate;
  aTurn?: number; // recollapse or bounce scale factor
  tTurnGyr?: number;
  zAccel: number; // redshift where q(a) = 0 (NaN if never / always accelerating)
  aEq: number;
  zEq: number;
}

/**
 * Integrate the Friedmann equation as t(a) = ∫ da/(aH(a)) rather than stepping a(t) through
 * t: near a Big Bang (or a recollapse turnaround) da/dt → 0, which makes forward ODE
 * integration in t stiff, while the da-quadrature is smooth or has only an integrable
 * inverse-sqrt singularity, handled by `quad`'s substitution.
 */
export function computeHistory(p: OmegaParams, H0kms: number, aFutureCap = 6): History {
  const invH0Gyr = GYR_PER_INV_H0 / H0kms; // Gyr per unit of dimensionless time T = H0 t
  const g = (a: number) => {
    const e2 = E2(a, p);
    return e2 > 0 ? 1 / (a * Math.sqrt(e2)) : 0;
  };

  // Find the backward boundary: a = 0 (ordinary Big Bang) or a bounce point a_b > 0 where E2 = 0.
  let aBack = 0;
  let backSingular = false;
  {
    const N = 400;
    let prevA = 1, prevE2 = E2(1, p);
    for (let i = 1; i <= N; i++) {
      const a = Math.exp(Math.log(1e-6) * (i / N)); // 1 -> 1e-6, log-spaced
      const e2 = E2(a, p);
      if (e2 <= 0) { aBack = bisect((x) => E2(x, p), a, prevA); backSingular = true; break; }
      prevA = a; prevE2 = e2;
    }
  }

  // Find the forward boundary: unbounded expansion, or a recollapse point a_f > 1 where E2 = 0.
  let aFwd = aFutureCap;
  let fwdSingular = false;
  {
    const N = 400;
    let prevA = 1;
    for (let i = 1; i <= N; i++) {
      const a = 1 * Math.exp(Math.log(1000) * (i / N)); // 1 -> 1000, log-spaced
      const e2 = E2(a, p);
      if (e2 <= 0) { aFwd = bisect((x) => E2(x, p), prevA, a); fwdSingular = true; break; }
      prevA = a;
      if (a > aFutureCap) { aFwd = aFutureCap; break; }
    }
  }

  // Build the (a, t) table on each branch by cumulative quadrature.
  const NB = 260, NF = 260;
  const backAs: number[] = [], backTs: number[] = [];
  {
    let acc = 0;
    for (let i = 0; i < NB; i++) {
      const uLo = i / NB, uHi = (i + 1) / NB;
      const shape = backSingular ? (u: number) => u * u : (u: number) => u;
      const aLo = aBack + (1 - aBack) * shape(uLo);
      const aHi = aBack + (1 - aBack) * shape(uHi);
      acc += quad(g, aLo, aHi, false, false, 12);
      backAs.push(aHi);
      backTs.push(acc);
    }
  }
  const totalBack = backTs[backTs.length - 1] ?? 0;

  const fwdAs: number[] = [], fwdTs: number[] = [];
  {
    let acc = 0;
    for (let i = 0; i < NF; i++) {
      const uLo = i / NF, uHi = (i + 1) / NF;
      const shape = fwdSingular ? (u: number) => 2 * u - u * u : (u: number) => u;
      const aLo = 1 + (aFwd - 1) * shape(uLo);
      const aHi = 1 + (aFwd - 1) * shape(uHi);
      acc += quad(g, aLo, aHi, false, false, 12);
      fwdAs.push(aHi);
      fwdTs.push(acc);
    }
  }

  // Assemble: [aBack..1] then [1..aFwd], t measured from the earliest point (t=0).
  const as: number[] = [aBack, ...backAs, ...fwdAs.map((_, i) => fwdAs[i])];
  const ts: number[] = [0, ...backTs, ...fwdTs.map((t) => totalBack + t)];
  const nowIndex = 1 + NB - 1; // index of a≈1 in the concatenated array
  const ageGyr = totalBack * invH0Gyr;

  let fate: Fate;
  if (fwdSingular) fate = 'crunch';
  else if (backSingular) fate = 'bounce';
  else {
    // loitering: E2 dips close to zero somewhere in (0,1) without crossing
    let minRatio = 1;
    for (let i = 1; i < 200; i++) {
      const a = (i / 200);
      const r = E2(a, p) / E2(1, p);
      if (r < minRatio) minRatio = r;
    }
    fate = minRatio < 0.02 ? 'loitering' : q0(p) < 0 ? 'eternal-accel' : 'eternal-coast';
  }

  // z of acceleration onset: root of qOfA(a) = 0 for a in (aBack, aFwd), if it exists.
  let zAccel = NaN;
  {
    const qa = (a: number) => qOfA(a, p);
    const samples = 200;
    let prevA = Math.max(aBack, 1e-4), prevQ = qa(prevA);
    for (let i = 1; i <= samples; i++) {
      const a = prevA + (Math.min(aFwd, 4) - prevA) * (i / samples);
      const q = qa(a);
      if (Number.isFinite(prevQ) && Number.isFinite(q) && prevQ * q < 0) {
        const aRoot = bisect((x) => qOfA(x, p), Math.max(aBack, 1e-4) + (a - (Math.max(aBack, 1e-4))) * ((i - 1) / samples), a);
        zAccel = 1 / aRoot - 1;
        break;
      }
      prevA = a; prevQ = q;
    }
  }

  const aEq = aEqMR(p);
  return {
    as: Float64Array.from(as),
    ts: Float64Array.from(ts.map((t) => t * invH0Gyr)),
    nowIndex,
    ageGyr,
    fate,
    aTurn: fwdSingular ? aFwd : backSingular ? aBack : undefined,
    tTurnGyr: fwdSingular ? (totalBack + fwdTs[fwdTs.length - 1]) * invH0Gyr : undefined,
    zAccel,
    aEq,
    zEq: aEq > 0 ? 1 / aEq - 1 : Infinity,
  };
}

/** Interpolate a(t) from a precomputed History (linear in the local segment; ts is monotonic). */
export function aAtT(hist: History, tGyr: number): number {
  const { as, ts } = hist;
  if (tGyr <= ts[0]) return as[0];
  if (tGyr >= ts[ts.length - 1]) return as[as.length - 1];
  let lo = 0, hi = ts.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] < tGyr) lo = mid; else hi = mid;
  }
  const f = (tGyr - ts[lo]) / (ts[hi] - ts[lo]);
  return as[lo] + f * (as[hi] - as[lo]);
}

/** Comoving distance to redshift z, in Mpc (flat-space line-of-sight integral of c/H). */
export function comovingDistanceMpc(z: number, p: OmegaParams, H0kms: number, N = 200): number {
  const Dh = C_KMS / H0kms;
  let sum = 0;
  const dz = z / N;
  for (let i = 0; i < N; i++) {
    const zm = (i + 0.5) * dz;
    sum += dz / Math.sqrt(Math.max(E2z(zm, p), 1e-12));
  }
  return Dh * sum;
}

/** Transverse comoving distance, folding in curvature. */
export function transverseComovingDistanceMpc(z: number, p: OmegaParams, H0kms: number): number {
  const Dc = comovingDistanceMpc(z, p, H0kms);
  const ok = Ok(p);
  const Dh = C_KMS / H0kms;
  if (Math.abs(ok) < 1e-6) return Dc;
  const x = Math.sqrt(Math.abs(ok)) * Dc / Dh;
  return ok > 0 ? (Dh / Math.sqrt(ok)) * Math.sinh(x) : (Dh / Math.sqrt(-ok)) * Math.sin(x);
}

export function luminosityDistanceMpc(z: number, p: OmegaParams, H0kms: number): number {
  return (1 + z) * transverseComovingDistanceMpc(z, p, H0kms);
}

export function angularDiameterDistanceMpc(z: number, p: OmegaParams, H0kms: number): number {
  return transverseComovingDistanceMpc(z, p, H0kms) / (1 + z);
}

/** Lookback time to redshift z, in Gyr. */
export function lookbackTimeGyr(z: number, p: OmegaParams, H0kms: number, N = 200): number {
  const invH0Gyr = GYR_PER_INV_H0 / H0kms;
  let sum = 0;
  const dz = z / N;
  for (let i = 0; i < N; i++) {
    const zm = (i + 0.5) * dz;
    sum += dz / ((1 + zm) * Math.sqrt(Math.max(E2z(zm, p), 1e-12)));
  }
  return invH0Gyr * sum;
}

export const FLAT_LCDM: OmegaParams = { Om: 0.315, OL: 0.685, Or: 9.1e-5 };
export const H0_PLANCK = 67.4;
export const H0_SH0ES = 73.0;
