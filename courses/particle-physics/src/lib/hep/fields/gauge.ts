/**
 * Global and local phase symmetry on a square grid: the arithmetic behind the Phase dial.
 *
 * A complex field ψᵢ = ρᵢ e^{iθᵢ} lives on the sites of an L × L grid (open boundaries). The "energy" of the matter field is
 * the sum over neighbouring pairs of |ψᵢ − ψⱼ|²: the cost of letting the phase change from site to site.
 *
 *   global U(1):  ψᵢ → e^{iα} ψᵢ                       leaves every |ψᵢ − ψⱼ| unchanged
 *   local  U(1):  ψᵢ → e^{iαᵢ} ψᵢ                      changes them: |ψᵢ − ψⱼ|² → |ψᵢ − e^{i(αⱼ−αᵢ)} ψⱼ|²
 *
 * A link field Aᵢⱼ (one real number on each edge, the phase of the parallel transporter from j to i) repairs this. With
 *
 *   covariant difference   Dᵢⱼψ = ψᵢ − e^{iAᵢⱼ} ψⱼ,
 *   combined local transformation   ψᵢ → e^{iαᵢ} ψᵢ,   Aᵢⱼ → Aᵢⱼ + αᵢ − αⱼ,
 *
 * Dᵢⱼψ → e^{iαᵢ} Dᵢⱼψ, so |Dᵢⱼψ|² is unchanged. The sum of A around a closed loop (the plaquette) telescopes and is
 * unchanged too: it is the lattice version of the magnetic flux ∮A·dl = ∫B·dS, the gauge-invariant electromagnetic field.
 *
 * Storage: sites are indexed i = y·L + x. `ax[i]` is A on the edge from (x, y) to (x+1, y), `ay[i]` on the edge from (x, y)
 * to (x, y+1); entries on the far boundary are unused. A_ji = −A_ij.
 */
import { normal, uniform, type Rng } from '../random/index.ts';

export interface PhaseField {
  L: number;
  /** Real and imaginary parts of ψ. */
  re: Float64Array;
  im: Float64Array;
}
export interface LinkField {
  L: number;
  ax: Float64Array;
  ay: Float64Array;
}

const TWO_PI = 2 * Math.PI;
/** Wrap an angle to (−π, π]. */
export function wrapAngle(x: number): number {
  let y = x % TWO_PI;
  if (y > Math.PI) y -= TWO_PI;
  else if (y <= -Math.PI) y += TWO_PI;
  return y;
}

/** A smooth field with a little noise (so that neighbouring arrows almost agree): θ(x,y) = amp·sin(2πx/L + …) + noise. */
export function makePhaseField(L: number, r: Rng, smooth = 0.6, noise = 0.08): PhaseField {
  const re = new Float64Array(L * L);
  const im = new Float64Array(L * L);
  const p1 = uniform(r, 0, TWO_PI);
  const p2 = uniform(r, 0, TWO_PI);
  const base = uniform(r, -Math.PI, Math.PI);
  for (let y = 0; y < L; y++)
    for (let x = 0; x < L; x++) {
      const th = base + smooth * (Math.sin((TWO_PI * x) / L + p1) + Math.cos((TWO_PI * y) / L + p2)) * 0.5 + normal(r, 0, noise);
      re[y * L + x] = Math.cos(th);
      im[y * L + x] = Math.sin(th);
    }
  return { L, re, im };
}
export function zeroLinks(L: number): LinkField {
  return { L, ax: new Float64Array(L * L), ay: new Float64Array(L * L) };
}
export function cloneField(f: PhaseField): PhaseField {
  return { L: f.L, re: Float64Array.from(f.re), im: Float64Array.from(f.im) };
}
export function cloneLinks(a: LinkField): LinkField {
  return { L: a.L, ax: Float64Array.from(a.ax), ay: Float64Array.from(a.ay) };
}
/** Phase of site i. */
export function phaseAt(f: PhaseField, i: number): number {
  return Math.atan2(f.im[i]!, f.re[i]!);
}

/** Multiply every ψᵢ by e^{iαᵢ}. */
export function rotate(f: PhaseField, alpha: ArrayLike<number>): void {
  for (let i = 0; i < f.re.length; i++) {
    const c = Math.cos(alpha[i]!);
    const s = Math.sin(alpha[i]!);
    const a = f.re[i]!;
    const b = f.im[i]!;
    f.re[i] = a * c - b * s;
    f.im[i] = a * s + b * c;
  }
}
/** The global transformation: the same angle everywhere. */
export function rotateGlobal(f: PhaseField, alpha: number): void {
  rotate(f, new Float64Array(f.re.length).fill(alpha));
}
/** Independent random angles, uniform on (−π, π]; returns them. */
export function randomAngles(L: number, r: Rng, spread = Math.PI): Float64Array {
  const a = new Float64Array(L * L);
  for (let i = 0; i < a.length; i++) a[i] = uniform(r, -spread, spread);
  return a;
}
/** The gauge transformation of the link field that goes with `rotate(f, α)`: Aᵢⱼ → Aᵢⱼ + αᵢ − αⱼ. */
export function transformLinks(A: LinkField, alpha: ArrayLike<number>): void {
  const L = A.L;
  for (let y = 0; y < L; y++)
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      if (x < L - 1) A.ax[i] = A.ax[i]! + alpha[i]! - alpha[i + 1]!;
      if (y < L - 1) A.ay[i] = A.ay[i]! + alpha[i]! - alpha[i + L]!;
    }
}

/** |ψᵢ − e^{iA}ψⱼ|² */
function covDiff2(f: PhaseField, i: number, j: number, A: number): number {
  const c = Math.cos(A);
  const s = Math.sin(A);
  const jr = f.re[j]! * c - f.im[j]! * s;
  const ji = f.re[j]! * s + f.im[j]! * c;
  return (f.re[i]! - jr) ** 2 + (f.im[i]! - ji) ** 2;
}

/** The matter energy ignoring the link field: Σ over neighbouring pairs of |ψᵢ − ψⱼ|². */
export function energyNaive(f: PhaseField): number {
  const L = f.L;
  let e = 0;
  for (let y = 0; y < L; y++)
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      if (x < L - 1) e += covDiff2(f, i, i + 1, 0);
      if (y < L - 1) e += covDiff2(f, i, i + L, 0);
    }
  return e;
}
/** The covariant matter energy: Σ over edges of |ψᵢ − e^{iAᵢⱼ}ψⱼ|². */
export function energyCovariant(f: PhaseField, A: LinkField): number {
  const L = f.L;
  let e = 0;
  for (let y = 0; y < L; y++)
    for (let x = 0; x < L; x++) {
      const i = y * L + x;
      if (x < L - 1) e += covDiff2(f, i, i + 1, A.ax[i]!);
      if (y < L - 1) e += covDiff2(f, i, i + L, A.ay[i]!);
    }
  return e;
}

/**
 * The plaquette angle Φ at the square whose lower-left corner is site (x, y): the sum of A counter-clockwise around it,
 * wrapped to (−π, π]. It is the flux of the magnetic field through the square and is gauge invariant.
 */
export function plaquette(A: LinkField, x: number, y: number): number {
  const L = A.L;
  const i = y * L + x;
  return wrapAngle(A.ax[i]! + A.ay[i + 1]! - A.ax[i + L]! - A.ay[i]!);
}
/** All (L−1)² plaquette fluxes, row-major. */
export function plaquettes(A: LinkField): Float64Array {
  const n = A.L - 1;
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) out[y * n + x] = plaquette(A, x, y);
  return out;
}
/** The energy of the link field itself (the Maxwell term): Σ over plaquettes of (1 − cos Φ) ≈ ½ΣΦ² for small Φ. */
export function fieldEnergy(A: LinkField): number {
  let e = 0;
  for (const p of plaquettes(A)) e += 1 - Math.cos(p);
  return e;
}
/** Set the links to a uniform magnetic field: every plaquette carries flux `b` (Landau gauge: A_y = b·x, A_x = 0). */
export function setUniformFlux(A: LinkField, b: number): void {
  const L = A.L;
  A.ax.fill(0);
  for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) A.ay[y * L + x] = b * x;
}
/**
 * Add a flux tube: extra flux `phi` through the one plaquette whose lower-left corner is (x, y). The links above the
 * plaquette, up to the boundary, are shifted (a "Dirac string"): every plaquette they touch gets +c from its lower edge
 * and −c from its upper edge, so only the first one keeps a net flux.
 */
export function addFluxTube(A: LinkField, x: number, y: number, phi: number): void {
  const L = A.L;
  for (let yy = y + 1; yy < L; yy++) A.ax[yy * L + x] = A.ax[yy * L + x]! - phi;
}
/** The largest change in wrapped plaquette flux between two link fields (should be ~1e-15 after a gauge transformation). */
export function maxFluxDifference(A: LinkField, B: LinkField): number {
  const a = plaquettes(A);
  const b = plaquettes(B);
  let m = 0;
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(wrapAngle(a[i]! - b[i]!)));
  return m;
}
