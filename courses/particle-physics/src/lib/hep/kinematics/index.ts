/**
 * Four-vectors and kinematics.
 *
 * Conventions: metric (+, −, −, −), natural units (GeV), z along the beam, azimuth φ in (−π, π],
 * pseudorapidity η = −ln tan(θ/2), transverse momentum pT = √(px² + py²).
 *
 * A four-vector is a plain object `{ E, px, py, pz }`, so exercises can write functions over it without a class.
 */
import type { Rng } from '../random/index.ts';

export interface P4 {
  E: number;
  px: number;
  py: number;
  pz: number;
}

export const p4 = (E: number, px: number, py: number, pz: number): P4 => ({ E, px, py, pz });

/** A four-vector from a mass and a three-momentum. */
export function fromMass(m: number, px: number, py: number, pz: number): P4 {
  return { E: Math.sqrt(m * m + px * px + py * py + pz * pz), px, py, pz };
}

/** A four-vector from (pT, η, φ, m), the variables the LHC experiments store. */
export function fromPtEtaPhiM(pt: number, eta: number, phi: number, m: number): P4 {
  const px = pt * Math.cos(phi);
  const py = pt * Math.sin(phi);
  const pz = pt * Math.sinh(eta);
  return { E: Math.sqrt(m * m + pt * pt * Math.cosh(eta) ** 2), px, py, pz };
}

export const add = (a: P4, b: P4): P4 => ({ E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz });
export const sub = (a: P4, b: P4): P4 => ({ E: a.E - b.E, px: a.px - b.px, py: a.py - b.py, pz: a.pz - b.pz });
export const scale = (a: P4, k: number): P4 => ({ E: a.E * k, px: a.px * k, py: a.py * k, pz: a.pz * k });
export function sum(list: readonly P4[]): P4 {
  let E = 0, px = 0, py = 0, pz = 0;
  for (const p of list) {
    E += p.E;
    px += p.px;
    py += p.py;
    pz += p.pz;
  }
  return { E, px, py, pz };
}

/** Minkowski product a·b = E₁E₂ − p₁·p₂. */
export const dot = (a: P4, b: P4): number => a.E * b.E - a.px * b.px - a.py * b.py - a.pz * b.pz;
/** Squared magnitude of the three-momentum. */
export const p2 = (a: P4): number => a.px * a.px + a.py * a.py + a.pz * a.pz;
/** Magnitude of the three-momentum. */
export const pmag = (a: P4): number => Math.sqrt(p2(a));
/** Invariant mass squared, computed as (E − |p|)(E + |p|) when that is the better-conditioned form. */
export function mass2(a: P4): number {
  const p = pmag(a);
  return (a.E - p) * (a.E + p);
}
/** Invariant mass (negative if m² < 0, by convention, so that rounding cannot produce NaN). */
export function mass(a: P4): number {
  const m2 = mass2(a);
  return m2 >= 0 ? Math.sqrt(m2) : -Math.sqrt(-m2);
}
/**
 * Invariant mass of two particles: m² = (E₁ + E₂)² − |p₁ + p₂|². This is the reference for the hook
 * `kinematics.pairMass`, which Chapter 2's exercise asks the reader to write.
 */
export function pairMass(a: P4, b: P4): number {
  return mass(add(a, b));
}
/** Invariant mass of a list of four-vectors. */
export const invariantMass = (list: readonly P4[]): number => mass(sum(list));

export const pt = (a: P4): number => Math.hypot(a.px, a.py);
export const phi = (a: P4): number => Math.atan2(a.py, a.px);
export const theta = (a: P4): number => Math.atan2(pt(a), a.pz);
/** Pseudorapidity η = asinh(pz / pT). */
export function eta(a: P4): number {
  const t = pt(a);
  if (t === 0) return a.pz >= 0 ? Infinity : -Infinity;
  return Math.asinh(a.pz / t);
}
/** Rapidity y = ½ ln((E + pz)/(E − pz)). */
export function rapidity(a: P4): number {
  return 0.5 * Math.log((a.E + a.pz) / (a.E - a.pz));
}
/** Transverse mass mT = √(m² + pT²). */
export const mT = (a: P4): number => Math.sqrt(Math.max(0, mass2(a)) + pt(a) ** 2);
/**
 * Transverse mass of a charged lepton and the missing transverse momentum (a neutrino), as used for W → ℓν:
 * mT² = 2 pT(ℓ) ET(miss) (1 − cos Δφ). Reference for the hook `kinematics.transverseMass`.
 */
export function transverseMass(lepton: P4, met: { x: number; y: number }): number {
  const ptl = pt(lepton);
  const etm = Math.hypot(met.x, met.y);
  const dphi = deltaPhi(phi(lepton), Math.atan2(met.y, met.x));
  return Math.sqrt(Math.max(0, 2 * ptl * etm * (1 - Math.cos(dphi))));
}
/** Velocity β = |p|/E. */
export const beta = (a: P4): number => pmag(a) / a.E;
/** Lorentz factor γ = E/m. */
export const gamma = (a: P4): number => a.E / mass(a);

/** Difference of azimuths, wrapped into (−π, π]. */
export function deltaPhi(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}
/** Angular distance ΔR = √(Δη² + Δφ²) between two four-vectors. */
export function deltaR(a: P4, b: P4): number {
  return Math.hypot(eta(a) - eta(b), deltaPhi(phi(a), phi(b)));
}
/** Opening angle between the three-momenta. */
export function openingAngle(a: P4, b: P4): number {
  const c = (a.px * b.px + a.py * b.py + a.pz * b.pz) / (pmag(a) * pmag(b));
  return Math.acos(Math.max(-1, Math.min(1, c)));
}

/** Velocity vector of the system, p/E, for use with `boost`. */
export const boostVector = (a: P4): [number, number, number] => [a.px / a.E, a.py / a.E, a.pz / a.E];

/**
 * Boost `a` by velocity β = (bx, by, bz). To go to the rest frame of a system with four-momentum P,
 * boost by (−P.px/P.E, −P.py/P.E, −P.pz/P.E); to go from the rest frame back to the lab, boost by +P/E.
 */
export function boost(a: P4, bx: number, by: number, bz: number): P4 {
  const b2 = bx * bx + by * by + bz * bz;
  if (b2 === 0) return { ...a };
  const g = 1 / Math.sqrt(1 - b2);
  const bp = bx * a.px + by * a.py + bz * a.pz;
  const g2 = (g - 1) / b2;
  return {
    E: g * (a.E + bp),
    px: a.px + g2 * bp * bx + g * bx * a.E,
    py: a.py + g2 * bp * by + g * by * a.E,
    pz: a.pz + g2 * bp * bz + g * bz * a.E,
  };
}
/** The four-vector `a` seen in the rest frame of `frame`. */
export function toRestFrame(a: P4, frame: P4): P4 {
  return boost(a, -frame.px / frame.E, -frame.py / frame.E, -frame.pz / frame.E);
}

/** Centre-of-mass energy squared of two colliding four-vectors: s = (p₁ + p₂)². */
export const mandelstamS = (a: P4, b: P4): number => mass2(add(a, b));

/** Two-body momentum in the rest frame of a system of mass M decaying to masses m1 and m2 (Källén function). */
export function twoBodyMomentum(M: number, m1: number, m2: number): number {
  const l = (M * M - (m1 + m2) ** 2) * (M * M - (m1 - m2) ** 2);
  return l > 0 ? Math.sqrt(l) / (2 * M) : 0;
}

/** Isotropic unit vector. */
export function isotropic(r: Rng): [number, number, number] {
  const cosT = 2 * r() - 1;
  const sinT = Math.sqrt(1 - cosT * cosT);
  const ph = 2 * Math.PI * r();
  return [sinT * Math.cos(ph), sinT * Math.sin(ph), cosT];
}

/**
 * Isotropic two-body decay of a particle with four-momentum `parent` to masses m1 and m2.
 * Returns the two daughters in the lab frame.
 */
export function twoBodyDecay(r: Rng, parent: P4, m1: number, m2: number): [P4, P4] {
  const M = mass(parent);
  const k = twoBodyMomentum(M, m1, m2);
  const [ux, uy, uz] = isotropic(r);
  const d1 = fromMass(m1, k * ux, k * uy, k * uz);
  const d2 = fromMass(m2, -k * ux, -k * uy, -k * uz);
  const b = boostVector(parent);
  return [boost(d1, b[0], b[1], b[2]), boost(d2, b[0], b[1], b[2])];
}

/**
 * Uniform phase space for n massive bodies with total four-momentum `total` (the RAMBO algorithm of Kleiss,
 * Stirling and Ellis, with the mass-correction step). Returns the momenta and the event weight.
 * For massless bodies the weight is constant; with masses it varies and events must be weighted.
 */
export function phaseSpace(r: Rng, total: P4, masses: readonly number[]): { p: P4[]; weight: number } {
  const n = masses.length;
  const M = mass(total);
  if (n === 1) return { p: [{ ...total }], weight: 1 };
  if (n === 2) {
    const [a, b] = twoBodyDecay(r, total, masses[0]!, masses[1]!);
    return { p: [a, b], weight: 1 };
  }
  // 1. massless momenta, isotropic, energies from q e^{-q}
  const q: P4[] = [];
  for (let i = 0; i < n; i++) {
    const c = 2 * r() - 1;
    const s = Math.sqrt(1 - c * c);
    const f = 2 * Math.PI * r();
    const e = -Math.log(r() * r());
    q.push({ E: e, px: e * s * Math.cos(f), py: e * s * Math.sin(f), pz: e * c });
  }
  // 2. boost to the total rest frame and scale to total mass M
  const Q = sum(q);
  const Qm = mass(Q);
  const x = M / Qm;
  const bx = -Q.px / Qm, by = -Q.py / Qm, bz = -Q.pz / Qm;
  const gam = Q.E / Qm;
  const a = 1 / (1 + gam);
  const pm: P4[] = q.map((qi) => {
    const bq = bx * qi.px + by * qi.py + bz * qi.pz;
    return {
      E: x * (gam * qi.E + bq),
      px: x * (qi.px + bx * (qi.E + a * bq)),
      py: x * (qi.py + by * (qi.E + a * bq)),
      pz: x * (qi.pz + bz * (qi.E + a * bq)),
    };
  });
  const massless = masses.every((m) => m === 0);
  let result = pm;
  let weight = 1;
  if (!massless) {
    // 3. solve for ξ with Σ √(m² + ξ² E²) = M (Newton)
    let xi = 1;
    for (let it = 0; it < 50; it++) {
      let f = -M;
      let df = 0;
      for (let i = 0; i < n; i++) {
        const e = Math.sqrt(masses[i]! ** 2 + xi * xi * pm[i]!.E ** 2);
        f += e;
        df += (xi * pm[i]!.E ** 2) / e;
      }
      const dxi = f / df;
      xi -= dxi;
      if (Math.abs(dxi) < 1e-14) break;
    }
    result = pm.map((pi, i) => fromMass(masses[i]!, xi * pi.px, xi * pi.py, xi * pi.pz));
    // weight from the Jacobian (RAMBO paper, eq. 4.11): relative weights are right; the overall constant is dropped
    let sumP = 0, prod = 1, sumP2OverE = 0;
    for (const pi of result) {
      const k = pmag(pi);
      sumP += k;
      prod *= k / pi.E;
      sumP2OverE += (k * k) / pi.E;
    }
    weight = Math.pow(sumP / M, 2 * n - 3) * prod * (M / sumP2OverE);
  }
  // 4. boost to the lab frame
  const bl = boostVector(total);
  return { p: result.map((p) => boost(p, bl[0], bl[1], bl[2])), weight };
}
