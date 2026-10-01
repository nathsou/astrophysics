/**
 * Helical trajectories of charged particles in a uniform solenoid field along z.
 *
 * A particle of transverse momentum pT (GeV) and charge q (units of e) in a field B (T) moves on a circle of radius
 *
 *     R[m] = pT[GeV] / (0.29979 |q| B[T])      (the "0.3 B R" rule: pT = 0.3 B R)
 *
 * in the transverse plane, and drifts uniformly along z. The arc-length parameter `s` used everywhere here is the
 * length along the 3-D path in mm (so z advances by s cosθ and the transverse arc is s sinθ).
 *
 * Sense of rotation: a positive particle in B along +z circulates clockwise seen from +z (φ decreases with s).
 */
import type { P4 } from '../kinematics/index.ts';

/** Speed of light × 10⁻⁹ in m/ns… i.e. the constant of the 0.3 B R rule: pT[GeV] = 0.29979 · B[T] · R[m]. */
export const CURVATURE_CONSTANT = 0.299792458;

export interface Helix {
  /** Charge in units of e (0 for a straight line). */
  charge: number;
  /** Field in tesla along +z. */
  bField: number;
  /** Radius of curvature in mm (Infinity for a neutral particle or B = 0). */
  radius: number;
  /** Transverse and longitudinal momentum, total momentum (GeV). */
  pT: number;
  pz: number;
  p: number;
  /** Energy of the particle (constant along the helix: a magnetic field does no work). */
  E: number;
  /** Start point (mm) and azimuth of the momentum there. */
  vertex: [number, number, number];
  phi0: number;
  /** Signed curvature dφ/ds_T in 1/mm (negative for positive charge in B > 0). Zero for a straight line. */
  omega: number;
  /** Centre of the circle in the transverse plane (mm); undefined for a straight line. */
  centre: [number, number] | null;
  /** Position (x, y, z) in mm after the path length s (mm). */
  pointAt(s: number): [number, number, number];
  /** Unit direction of motion after the path length s. */
  directionAt(s: number): [number, number, number];
  /** Four-momentum after the path length s (same magnitude, rotated). */
  momentumAt(s: number): P4;
  /**
   * Path length at which the trajectory first crosses the cylinder of radius r (mm), or null if it never reaches
   * it (a curler) or leaves through the end of the cylinder first (|z| > halfLength there).
   */
  intersectCylinder(r: number, halfLength: number): number | null;
  /** Path length of the first crossing of the infinite cylinder of radius r, or null if the radius is never reached. */
  crossRadius(r: number): number | null;
  /**
   * Path length at which the particle first leaves the barrel-plus-endcaps volume |z| < halfLength, ρ < r,
   * and whether it left through an end (true) or the barrel wall (false). Null if it does neither (a curler
   * confined in the volume with pz = 0).
   */
  exitVolume(r: number, halfLength: number): { s: number; endcap: boolean } | null;
  /** Path length of the first crossing of the plane z = zPlane in the direction of motion, or null. */
  crossZ(zPlane: number): number | null;
  /** Path length of one full turn in the transverse plane (Infinity for a straight line). */
  turnLength(): number;
  /** The arc length from the start to a point assumed to lie on the helix (chord → arc). */
  arcTo(point: readonly [number, number, number]): number;
}

function sinc(u: number): number {
  return Math.abs(u) < 1e-4 ? 1 - (u * u) / 6 : Math.sin(u) / u;
}

/**
 * The concrete helix. It is mutable (`reset`) and has allocation-free evaluation (`evalAt`), which the simulation uses
 * to follow millions of tracks without garbage; everyone else should use `helix()` and the `Helix` interface.
 */
export class HelixTrack implements Helix {
  charge = 0;
  bField = 0;
  radius = Infinity;
  pT = 0;
  pz = 0;
  p = 0;
  E = 0;
  vertex: [number, number, number] = [0, 0, 0];
  phi0 = 0;
  omega = 0;
  centre: [number, number] | null = null;
  /** Results of `evalAt`: position and unit direction. */
  ox = 0;
  oy = 0;
  oz = 0;
  ux = 0;
  uy = 0;
  uz = 0;
  private sinT = 0;
  private cosT = 1;
  private cotT = 0;
  private cx = 0;
  private cy = 0;
  private cosPhi0 = 1;
  private sinPhi0 = 0;

  constructor(pv?: P4, charge = 0, vertex: readonly [number, number, number] = [0, 0, 0], bField = 0) {
    if (pv) this.reset(pv.E, pv.px, pv.py, pv.pz, charge, vertex[0], vertex[1], vertex[2], bField);
  }

  /** Re-initialise in place for a new momentum, charge, start point and field. */
  reset(E: number, px: number, py: number, pz: number, charge: number, x: number, y: number, z: number, bField: number): this {
    const pT = Math.sqrt((px) * (px) + (py) * (py));
    const p = Math.sqrt((pT) * (pT) + (pz) * (pz));
    this.charge = charge;
    this.bField = bField;
    this.vertex[0] = x;
    this.vertex[1] = y;
    this.vertex[2] = z;
    this.pT = pT;
    this.pz = pz;
    this.p = p;
    this.E = E;
    this.phi0 = Math.atan2(py, px);
    this.cosPhi0 = pT > 0 ? px / pT : 1;
    this.sinPhi0 = pT > 0 ? py / pT : 0;
    this.sinT = p > 0 ? pT / p : 0;
    this.cosT = p > 0 ? pz / p : 1;
    this.cotT = pT > 0 ? pz / pT : 0;
    const k = Math.abs(charge) * Math.abs(bField) * CURVATURE_CONSTANT;
    if (k === 0 || pT < 1e-9) {
      this.radius = Infinity;
      this.omega = 0;
      this.centre = null;
      this.cx = 0;
      this.cy = 0;
    } else {
      this.radius = (1000 * pT) / k;
      this.omega = -Math.sign(charge * bField) / this.radius;
      this.cx = x - this.sinPhi0 / this.omega;
      this.cy = y + this.cosPhi0 / this.omega;
      this.centre = [this.cx, this.cy];
    }
    return this;
  }

  /** Position (ox, oy, oz) and direction (ux, uy, uz) after the path length s, stored in the fields. */
  evalAt(s: number): void {
    const sT = s * this.sinT;
    const half = 0.5 * this.omega * sT;
    // x = x0 + (sin φ − sin φ0)/ω = x0 + sT cos(φ0 + ωsT/2) sinc(ωsT/2): stable as ω → 0
    const ph = this.phi0 + half;
    const k = sT * sinc(half);
    this.ox = this.vertex[0] + k * Math.cos(ph);
    this.oy = this.vertex[1] + k * Math.sin(ph);
    this.oz = this.vertex[2] + s * this.cosT;
    const pe = this.phi0 + 2 * half;
    this.ux = this.sinT * Math.cos(pe);
    this.uy = this.sinT * Math.sin(pe);
    this.uz = this.cosT;
  }

  pointAt(s: number): [number, number, number] {
    this.evalAt(s);
    return [this.ox, this.oy, this.oz];
  }

  directionAt(s: number): [number, number, number] {
    const ph = this.phi0 + this.omega * s * this.sinT;
    return [this.sinT * Math.cos(ph), this.sinT * Math.sin(ph), this.cosT];
  }

  momentumAt(s: number): P4 {
    const ph = this.phi0 + this.omega * s * this.sinT;
    return { E: this.E, px: this.pT * Math.cos(ph), py: this.pT * Math.sin(ph), pz: this.pz };
  }

  crossRadius(r: number): number | null {
    if (this.pT < 1e-9) return null;
    const x0 = this.vertex[0];
    const y0 = this.vertex[1];
    if (this.omega === 0) {
      const b = x0 * this.cosPhi0 + y0 * this.sinPhi0;
      const c = x0 * x0 + y0 * y0 - r * r;
      const disc = b * b - c;
      if (disc < 0) return null;
      const sq = Math.sqrt(disc);
      const t1 = -b - sq;
      const t2 = -b + sq;
      const t = t1 > 1e-9 ? t1 : t2 > 1e-9 ? t2 : -1;
      return t < 0 ? null : t / this.sinT;
    }
    const R = this.radius;
    const d2 = this.cx * this.cx + this.cy * this.cy;
    const d = Math.sqrt(d2);
    if (d < 1e-9) return null;
    const c = (r * r - d2 - R * R) / (2 * d * R);
    if (c > 1 || c < -1) return null;
    const a = Math.acos(c);
    const sg = this.omega > 0 ? 1 : -1;
    // the start point sits at angle φ0 − sg π/2 round the centre
    const psi0 = this.phi0 - sg * 0.5 * Math.PI;
    const psiC = Math.atan2(this.cy, this.cx);
    const TWO_PI = 2 * Math.PI;
    // Δψ = sg·θ with θ > 0 the angle travelled; ψ0 + Δψ − ψC = ±a
    const d0 = psiC - psi0;
    let best = Infinity;
    let th = sg * (a + d0);
    th -= TWO_PI * Math.floor(th / TWO_PI);
    if (th > 1e-10) best = th;
    th = sg * (d0 - a);
    th -= TWO_PI * Math.floor(th / TWO_PI);
    if (th > 1e-10 && th < best) best = th;
    if (best === Infinity) return null;
    return (best * R) / this.sinT;
  }

  intersectCylinder(r: number, halfLength: number): number | null {
    const s = this.crossRadius(r);
    if (s === null) return null;
    const z = this.vertex[2] + s * this.cosT;
    return Math.abs(z) <= halfLength ? s : null;
  }

  crossZ(zPlane: number): number | null {
    if (Math.abs(this.cosT) < 1e-12) return null;
    const s = (zPlane - this.vertex[2]) / this.cosT;
    return s >= 0 ? s : null;
  }

  exitVolume(r: number, halfLength: number): { s: number; endcap: boolean } | null {
    const sr = this.crossRadius(r);
    const sz = this.crossZ(this.cosT >= 0 ? halfLength : -halfLength);
    if (sr === null && sz === null) return null;
    if (sr === null) return { s: sz!, endcap: true };
    if (sz === null) return { s: sr, endcap: false };
    return sz < sr ? { s: sz, endcap: true } : { s: sr, endcap: false };
  }

  turnLength(): number {
    return this.omega === 0 || this.sinT === 0 ? Infinity : (2 * Math.PI * this.radius) / this.sinT;
  }

  arcTo(point: readonly [number, number, number]): number {
    const dx = point[0] - this.vertex[0];
    const dy = point[1] - this.vertex[1];
    const dz = point[2] - this.vertex[2];
    const cT = Math.sqrt((dx) * (dx) + (dy) * (dy));
    if (this.omega === 0 || this.sinT === 0) return Math.sqrt((cT) * (cT) + (dz) * (dz));
    const arcT = 2 * this.radius * Math.asin(Math.min(1, cT / (2 * this.radius)));
    return Math.sqrt((arcT) * (arcT) + (dz) * (dz));
  }
}

/**
 * The helix of a particle with four-momentum `p` (GeV), charge `charge` (units of e), produced at `vertex` (mm)
 * in a solenoid field `bField` (T) along +z.
 */
export function helix(p: P4, charge: number, vertex: readonly [number, number, number], bField: number): Helix {
  return new HelixTrack(p, charge, vertex, bField);
}

/** Radius of curvature in metres for a transverse momentum pT (GeV) in a field B (T): R = pT / (0.29979 B). */
export function radiusOfCurvature(pT: number, bField: number, charge = 1): number {
  return pT / (CURVATURE_CONSTANT * Math.abs(charge) * Math.abs(bField));
}

/** Transverse momentum (GeV) of a particle moving on a circle of radius R (m) in a field B (T): pT = 0.29979 B R. */
export function pTFromRadius(radiusM: number, bField: number, charge = 1): number {
  return CURVATURE_CONSTANT * Math.abs(charge) * Math.abs(bField) * radiusM;
}

/** The sagitta (mm) of a track of transverse momentum pT across a chord of length L (mm): s ≈ 0.3 B L² / (8 pT). */
export function sagitta(pT: number, bField: number, chordMm: number): number {
  const R = (1000 * pT) / (CURVATURE_CONSTANT * Math.abs(bField));
  return R - Math.sqrt(Math.max(0, R * R - (chordMm * chordMm) / 4));
}
