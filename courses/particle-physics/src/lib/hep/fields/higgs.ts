/**
 * The Mexican-hat potential V(φ) = −μ²|φ|² + λ|φ|⁴ of a complex scalar field, and the numbers that go with it.
 *
 * For μ² > 0 the minimum is on the circle |φ|² = μ²/(2λ) = v²/2, so v² = μ²/λ. Writing φ = (v + h) e^{iθ}/√2:
 *   radial excitations h (up the side of the hat)   m_h² = V″ = 2λv² = 2μ²   (massive: the Higgs boson)
 *   angular excitations θ (round the brim)           m² = 0                    (massless: the Goldstone boson)
 * The measured Higgs mass m_H and v = (√2 G_F)^{−1/2} fix λ = m_H²/(2v²) ≈ 0.129 and μ = m_H/√2 ≈ 88.5 GeV.
 *
 * `HatBall` is a damped ball on the hat in dimensionless variables: z = φ/(v₀/√2) (so the brim of the standard hat is |z| = 1),
 * time in units of 1/m_H, and s = μ²/μ₀² the strength of the hat (s < 0 is a bowl); equation of motion z̈ = ½(s − |z|²) z − γ ż.
 */
import { G_F } from './constants.ts';

/** The electroweak vacuum expectation value v = (√2 G_F)^{−1/2}, in GeV (246.22). */
export const V_EW_GEV = 1 / Math.sqrt(Math.SQRT2 * G_F);
/** The Higgs boson mass in GeV (PDG 2024: 125.20 ± 0.11). Also in `hep/particles`. */
export const M_HIGGS_GEV = 125.2;

/** λ = m_H²/(2v²). */
export const lambdaFromMass = (mH: number, v: number = V_EW_GEV): number => (mH * mH) / (2 * v * v);
/** m_H = √(2λ) v. */
export const higgsMass = (lambda: number, v: number = V_EW_GEV): number => Math.sqrt(2 * lambda) * v;
/** μ² = λ v² (= m_H²/2). */
export const muSquared = (lambda: number, v: number = V_EW_GEV): number => lambda * v * v;
/** v = √(μ²/λ), for μ² > 0. */
export const vevFromMu = (mu2: number, lambda: number): number => (mu2 > 0 ? Math.sqrt(mu2 / lambda) : 0);
/** The depth of the hat: V(0) − V(min) = μ⁴/(4λ) = m_H² v²/8, in GeV⁴. */
export const hatDepth = (mH: number, v: number = V_EW_GEV): number => (mH * mH * v * v) / 8;
/** The Yukawa coupling that gives a fermion its mass, y = √2 m/v. */
export const yukawaCoupling = (mass: number, v: number = V_EW_GEV): number => (Math.SQRT2 * mass) / v;
/** The mass of a fermion from its Yukawa coupling, m = y v/√2. */
export const massFromYukawa = (y: number, v: number = V_EW_GEV): number => (y * v) / Math.SQRT2;

/** V(φ) for φ = re + i·im. */
export function potential(re: number, im: number, mu2: number, lambda: number): number {
  const r2 = re * re + im * im;
  return -mu2 * r2 + lambda * r2 * r2;
}

/**
 * The mass² of the radial excitation h, where φ = (v + h)/√2 (so h is a real field with V(h) = −μ²h²/2 + λh⁴/4):
 * 2λv² = 2μ² at the minimum of the hat (μ² > 0), and the curvature −μ² = |μ²| at the origin of a bowl (μ² < 0, symmetric phase).
 */
export function radialMass2(mu2: number, lambda: number): number {
  return mu2 > 0 ? 2 * lambda * (mu2 / lambda) : -mu2;
}
/** The mass² of the angular excitation round the brim: zero, whatever the parameters (the Goldstone boson). */
export function goldstoneMass2(): number {
  return 0;
}

/** The dimensionless hat: U(z) = |z|⁴/4 − s|z|²/2 (minimum −s²/4 at |z|² = s). */
export function hatU(re: number, im: number, s: number): number {
  const r2 = re * re + im * im;
  return (r2 * r2) / 4 - (s * r2) / 2;
}

export class HatBall {
  re: number;
  im: number;
  vre = 0;
  vim = 0;
  t = 0;
  s: number;
  gamma: number;
  constructor(re: number, im: number, s = 1, gamma = 0.15) {
    this.re = re;
    this.im = im;
    this.s = s;
    this.gamma = gamma;
  }
  private acc(x: number, y: number): [number, number] {
    const r2 = x * x + y * y;
    const f = 0.5 * (this.s - r2);
    return [f * x, f * y];
  }
  /** One step of size dt (velocity Verlet with the damping applied as a half-step factor on each side). */
  step(dt: number): void {
    const d = Math.exp((-this.gamma * dt) / 2);
    this.vre *= d;
    this.vim *= d;
    let [ax, ay] = this.acc(this.re, this.im);
    this.vre += 0.5 * dt * ax;
    this.vim += 0.5 * dt * ay;
    this.re += dt * this.vre;
    this.im += dt * this.vim;
    [ax, ay] = this.acc(this.re, this.im);
    this.vre += 0.5 * dt * ax;
    this.vim += 0.5 * dt * ay;
    this.vre *= d;
    this.vim *= d;
    this.t += dt;
  }
  /** Radius |z|. */
  get radius(): number {
    return Math.hypot(this.re, this.im);
  }
  /** Angle arg z. */
  get angle(): number {
    return Math.atan2(this.im, this.re);
  }
  /** Energy |ż|² + U(z) (the kinetic term is |ż|² in these units). */
  energy(): number {
    return this.vre * this.vre + this.vim * this.vim + hatU(this.re, this.im, this.s);
  }
  /** Give the ball a kick of the given size along the radius (radial = true) or round the brim. */
  kick(radial: boolean, size: number): void {
    const r = this.radius || 1e-9;
    const er: [number, number] = [this.re / r, this.im / r];
    const et: [number, number] = [-er[1], er[0]];
    const e = radial ? er : et;
    this.vre += size * e[0];
    this.vim += size * e[1];
  }
}
