/**
 * The physics of matter: energy loss by ionisation (Bethe–Bloch, the Landau distribution), multiple Coulomb
 * scattering (Highland), muon stopping power and range, and two special functions the shower models need.
 *
 * Units: momenta and energies in GeV, thicknesses in g/cm² unless a name says otherwise, stopping powers in
 * MeV cm²/g. Formulae follow the PDG Review of Particle Physics, chapter "Passage of particles through matter".
 */
import { normal, type Rng } from '../random/index.ts';
import { material, type Material } from './materials.ts';

/** Electron mass in MeV. */
export const ME_MEV = 0.51099895;
/** Muon mass in GeV. */
export const M_MU = 0.1056583755;
/** K = 4π N_A r_e² m_e c² in MeV cm²/mol. */
export const K_BETHE = 0.307075;

// ── Bethe–Bloch ───────────────────────────────────────────────────────────────────────────────

const deltaTables = new Map<string, Float64Array>();
const DELTA_X0 = -3;
const DELTA_DX = 0.01;
const DELTA_N = 1201; // x = log10(βγ) from −3 to 9

function densityEffectExact(d: Material['densityEffect'], x: number): number {
  if (x >= d.x1) return 2 * Math.LN10 * x - d.C;
  if (x >= d.x0) return 2 * Math.LN10 * x - d.C + d.a * Math.pow(d.x1 - x, d.m);
  return d.delta0 * Math.pow(10, 2 * (x - d.x0));
}

/**
 * Sternheimer's density-effect correction δ(βγ) for a material (dimensionless, ≥ 0): at high energy the medium's
 * polarisation screens distant collisions and the relativistic rise of the stopping power is cut off.
 * (Tabulated on a fine grid of log10 βγ and interpolated: the exact formula is only evaluated once per material.)
 */
export function densityEffect(mat: Material | string, betaGamma: number): number {
  const m = material(mat);
  let t = deltaTables.get(m.name);
  if (!t) {
    t = new Float64Array(DELTA_N);
    for (let i = 0; i < DELTA_N; i++) t[i] = densityEffectExact(m.densityEffect, DELTA_X0 + i * DELTA_DX);
    deltaTables.set(m.name, t);
  }
  const x = Math.log10(Math.max(betaGamma, 1e-6));
  if (x <= DELTA_X0) return t[0]!;
  const u = (x - DELTA_X0) / DELTA_DX;
  if (u >= DELTA_N - 1) return densityEffectExact(m.densityEffect, x);
  const i = Math.floor(u);
  const f = u - i;
  return t[i]! * (1 - f) + t[i + 1]! * f;
}

export interface BetheParams {
  /** The absorber. */
  material: Material | string;
  /** βγ = p/m of the projectile. */
  betaGamma: number;
  /** Projectile mass in GeV (default: the muon). */
  mass?: number;
  /** Projectile charge in units of e (default 1; the result scales as z²). */
  z?: number;
  /** Include the density-effect correction (default true). Switch it off to see the relativistic rise continue forever. */
  densityCorrection?: boolean;
}

/**
 * Bethe–Bloch mean collision energy loss −⟨dE/dx⟩ in MeV cm²/g:
 *
 *     K z² (Z/A) (1/β²) [ ½ ln(2 m_e c² β²γ² W_max / I²) − β² − δ/2 ],
 *
 * with W_max = 2 m_e c² β²γ² / (1 + 2γ m_e/M + (m_e/M)²). Valid for 0.1 ≲ βγ ≲ 1000 (no shell or radiative
 * corrections). For electrons (M = m_e) the Berger–Seltzer form for collision loss is used instead, since the
 * maximum transfer is then half the kinetic energy.
 */
export function bethe(p: BetheParams): number {
  return betheCore(material(p.material), p.betaGamma, p.mass ?? M_MU, p.z ?? 1, p.densityCorrection !== false);
}

function betheCore(mat: Material, betaGamma: number, M: number, z: number, densityCorrection: boolean): number {
  const bg = Math.max(betaGamma, 1e-3);
  const g2 = 1 + bg * bg;
  const beta2 = (bg * bg) / g2;
  const delta = densityCorrection ? densityEffect(mat, bg) : 0;
  const IMeV = mat.I * 1e-6;
  const gamma = Math.sqrt(g2);
  if (M * 1e3 < 2 * ME_MEV) {
    // electrons and positrons (Berger & Seltzer; positrons differ by a few per cent, ignored)
    const tau = gamma - 1;
    const F = 1 - beta2 + (tau * tau / 8 - (2 * tau + 1) * Math.LN2) / ((tau + 1) * (tau + 1));
    const arg = (tau * tau * (tau + 2)) / (2 * (IMeV / ME_MEV) ** 2);
    const v = (0.5 * K_BETHE * mat.ZoverA * (Math.log(arg) + F - delta)) / beta2;
    return Math.max(v, 0);
  }
  const r = ME_MEV / (M * 1e3);
  const wmax = (2 * ME_MEV * bg * bg) / (1 + 2 * gamma * r + r * r);
  const arg = (2 * ME_MEV * bg * bg * wmax) / (IMeV * IMeV);
  const v = (K_BETHE * z * z * mat.ZoverA * (0.5 * Math.log(arg) - beta2 - delta / 2)) / beta2;
  return Math.max(v, 0);
}

/** Mean energy lost (GeV) crossing x g/cm² of a material at momentum p (GeV) for a particle of mass m (GeV), ignoring the change of p along the way. */
export function meanEnergyLoss(mat: Material, xGcm2: number, p: number, mass: number, z = 1): number {
  return betheCore(mat, p / mass, mass, z, true) * xGcm2 * 1e-3;
}

/** Mean collision stopping power in MeV cm²/g for a particle of momentum p (GeV) and mass m (GeV). */
export function stoppingPower(mat: Material | string, p: number, mass: number, z = 1): number {
  return bethe({ material: mat, betaGamma: p / mass, mass, z });
}

/** Mean collision stopping power in GeV per mm for a material of the given density (a convenience for widgets). */
export function dEdxGeVPerMm(mat: Material | string, p: number, mass: number): number {
  const m = material(mat);
  return (stoppingPower(m, p, mass) * m.density * 1e-3) / 10;
}

// ── The Landau distribution ───────────────────────────────────────────────────────────────────

/** The λ at which the Landau density is maximal. */
export const LANDAU_MODE = -0.2227829;

let landauTable: { lam: Float64Array; cdf: Float64Array; total: number } | null = null;

/** The standard Landau density φ(λ) = (1/π) ∫₀^∞ exp(−u ln u − λu) sin(πu) du, by Simpson's rule. */
export function landauPdf(lambda: number): number {
  let U: number;
  let n: number;
  if (lambda > 2) {
    U = 40 / lambda;
    n = 2000;
  } else {
    U = lambda < -3 ? 100 : lambda < -1.5 ? 60 : 40;
    n = Math.round(U / 0.02);
  }
  if (n % 2) n++;
  const h = U / n;
  let s = 0;
  for (let i = 1; i < n; i++) {
    const u = i * h;
    s += (i % 2 ? 4 : 2) * Math.exp(-u * Math.log(u) - lambda * u) * Math.sin(Math.PI * u);
  }
  // the end point u = U contributes negligibly
  return (s * h) / 3 / Math.PI;
}

function buildLandauTable() {
  const lam: number[] = [];
  for (let l = -4; l < 2; l += 0.05) lam.push(l);
  for (let l = 2; l < 20; l += 0.25) lam.push(l);
  for (let l = 20; l < 200; l += 2.5) lam.push(l);
  for (let l = 200; l <= 2000; l += 50) lam.push(l);
  const L = Float64Array.from(lam);
  const cdf = new Float64Array(L.length);
  let prev = landauPdf(L[0]!);
  for (let i = 1; i < L.length; i++) {
    const cur = landauPdf(L[i]!);
    cdf[i] = cdf[i - 1]! + 0.5 * (prev + cur) * (L[i]! - L[i - 1]!);
    prev = cur;
  }
  landauTable = { lam: L, cdf, total: cdf[L.length - 1]! };
}

/** The cumulative Landau distribution Φ(λ) (tabulated on first use). */
export function landauCdf(lambda: number): number {
  if (!landauTable) buildLandauTable();
  const { lam, cdf, total } = landauTable!;
  const n = lam.length;
  if (lambda <= lam[0]!) return 0;
  if (lambda >= lam[n - 1]!) return 1 - ((1 - total) * lam[n - 1]!) / lambda;
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (lam[m]! <= lambda) a = m;
    else b = m;
  }
  const f = (lambda - lam[a]!) / (lam[b]! - lam[a]!);
  return cdf[a]! + f * (cdf[b]! - cdf[a]!);
}

let landauQuantiles: Float64Array | null = null;
const LQ_N = 8192;
const LQ_MAX = 0.995;

function invertLandau(u: number): number {
  const { lam, cdf, total } = landauTable!;
  const n = lam.length;
  if (u >= total) return (lam[n - 1]! * (1 - total)) / (1 - u);
  let a = 0;
  let b = n - 1;
  while (b - a > 1) {
    const m = (a + b) >> 1;
    if (cdf[m]! <= u) a = m;
    else b = m;
  }
  const w = cdf[b]! - cdf[a]!;
  return lam[a]! + (w > 0 ? (u - cdf[a]!) / w : 0.5) * (lam[b]! - lam[a]!);
}

/**
 * A sample of the standard Landau variable λ (mode at −0.2228, long 1/λ² tail), by inversion of the tabulated CDF
 * (a quantile table with linear interpolation for the bulk, exact inversion in the far tail).
 */
export function landauLambda(rng: Rng): number {
  if (!landauTable) buildLandauTable();
  if (!landauQuantiles) {
    landauQuantiles = new Float64Array(LQ_N + 1);
    for (let i = 0; i <= LQ_N; i++) landauQuantiles[i] = invertLandau(Math.min((i / LQ_N) * LQ_MAX, LQ_MAX));
  }
  const u = rng();
  if (u >= LQ_MAX) return invertLandau(u);
  const t = (u / LQ_MAX) * LQ_N;
  const i = Math.floor(t);
  const f = t - i;
  return landauQuantiles[i]! * (1 - f) + landauQuantiles[i + 1]! * f;
}

/**
 * Sample an energy loss from a Landau distribution with most probable value `mpv` and width parameter `xi`
 * (both in the same unit): Δ = mpv + ξ (λ − λ_mode). The Landau distribution is the thin-absorber limit of
 * ionisation loss: many soft collisions give a peak, rare hard collisions (δ-rays) give the long tail.
 */
export function landau(rng: Rng, mpv = 0, xi = 1): number {
  return mpv + xi * (landauLambda(rng) - LANDAU_MODE);
}

/** ξ = (K/2)(Z/A) x/β² in MeV for an absorber of x g/cm² (the width scale of the Landau distribution). */
export function landauXi(mat: Material | string, xGcm2: number, beta2: number): number {
  return 0.5 * K_BETHE * material(mat).ZoverA * (xGcm2 / beta2);
}

/**
 * Most probable energy loss in MeV in an absorber of x g/cm² (Bichsel's form of the Landau–Vavilov peak):
 * Δp = ξ [ ln(2 m_e c² β²γ² / I) + ln(ξ/I) + 0.200 − β² − δ(βγ) ].
 * It is thickness-dependent and lower than the mean loss, which the tail of rare hard collisions raises.
 */
export function mostProbableLoss(mat: Material | string, xGcm2: number, betaGamma: number, z = 1): number {
  const m = material(mat);
  const bg2 = betaGamma * betaGamma;
  const beta2 = bg2 / (1 + bg2);
  const xi = landauXi(m, xGcm2, beta2) * z * z;
  const IMeV = m.I * 1e-6;
  const delta = densityEffect(m, betaGamma);
  const v = xi * (Math.log((2 * ME_MEV * bg2) / IMeV) + Math.log(xi / IMeV) + 0.2 - beta2 - delta);
  return Math.max(v, 0.1 * xi);
}

/**
 * Sample the energy lost (GeV) by a particle of momentum p (GeV) and mass m (GeV) crossing x g/cm² of a material:
 * a Landau distribution with Bichsel's peak, cut off at the kinematic maximum of a single transfer and at the
 * particle's kinetic energy.
 */
export function sampleEnergyLoss(rng: Rng, mat: Material, xGcm2: number, p: number, mass: number, z = 1): number {
  const bg = p / mass;
  const bg2 = bg * bg;
  const beta2 = bg2 / (1 + bg2);
  const xi = landauXi(mat, xGcm2, beta2) * z * z;
  const mpv = mostProbableLoss(mat, xGcm2, bg, z);
  let d = landau(rng, mpv, xi);
  const gamma = Math.sqrt(1 + bg2);
  const r = ME_MEV / (mass * 1e3);
  const wmax = mass * 1e3 < 2 * ME_MEV ? (gamma - 1) * ME_MEV * 0.5 : (2 * ME_MEV * bg2) / (1 + 2 * gamma * r + r * r);
  // The mean loss over a thick absorber must not exceed what the stopping power says by much: cap the tail.
  const cap = Math.max(wmax, 5 * mpv) + mpv;
  if (d > cap) d = cap;
  if (d < 0) d = 0;
  return d * 1e-3;
}

// ── Multiple scattering ───────────────────────────────────────────────────────────────────────

/**
 * Highland's formula for the width of the projected (single-plane) multiple-scattering angle of a singly charged
 * particle crossing x/X0 radiation lengths:
 *
 *     θ0 = (13.6 MeV / βcp) z √(x/X0) [1 + 0.038 ln(x z² / (X0 β²))].
 *
 * `p` in GeV, returns radians. The space angle has width √2 θ0. Accurate to about 11 % for 10⁻³ < x/X0 < 100.
 */
export function multipleScatteringAngle(p: number, beta: number, xOverX0: number, z = 1): number {
  if (xOverX0 <= 0 || p <= 0) return 0;
  const corr = 1 + 0.038 * Math.log((xOverX0 * z * z) / (beta * beta));
  return ((0.0136 / (beta * p)) * Math.abs(z) * Math.sqrt(xOverX0)) * Math.max(0.25, corr);
}

// ── Muons: stopping power and range ───────────────────────────────────────────────────────────

/**
 * Total muon stopping power −dE/dx = a(E) + b(E) E in MeV cm²/g: ionisation from Bethe–Bloch plus the radiative
 * processes (bremsstrahlung, pair production, photonuclear) through an approximate b ≈ 0.55×10⁻⁶ Z²/A cm²/g,
 * which gives 6.6×10⁻⁶ in iron and reproduces the critical energy (≈ 350 GeV in iron) to about 20 %.
 */
export function muonStoppingPower(mat: Material | string, energy: number): number {
  const m = material(mat);
  const p = Math.sqrt(Math.max(energy * energy - M_MU * M_MU, 1e-12));
  const a = bethe({ material: m, betaGamma: p / M_MU, mass: M_MU });
  const b = 0.55e-6 * ((m.Z * m.Z) / m.A);
  return a + b * energy * 1e3;
}

/** Muon critical energy (GeV) where ionisation and radiative losses are equal (approximate). */
export function muonCriticalEnergy(mat: Material | string): number {
  const m = material(mat);
  const b = 0.55e-6 * ((m.Z * m.Z) / m.A);
  let lo = 1;
  let hi = 1e4;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    const p = Math.sqrt(mid * mid - M_MU * M_MU);
    const a = bethe({ material: m, betaGamma: p / M_MU, mass: M_MU });
    if (b * mid * 1e3 < a) lo = mid;
    else hi = mid;
  }
  return Math.sqrt(lo * hi);
}

/** The muon's total energy (GeV) after crossing x g/cm² of a material, by stepping the mean stopping power. 0 if it stops. */
export function muonEnergyAfter(mat: Material | string, xGcm2: number, energy: number): number {
  const m = material(mat);
  let E = energy;
  const steps = Math.max(1, Math.ceil(xGcm2 / 60));
  const dx = xGcm2 / steps;
  for (let i = 0; i < steps; i++) {
    // midpoint rule
    const e1 = E - 0.5 * dx * muonStoppingPower(m, E) * 1e-3;
    if (e1 <= M_MU) return 0;
    E -= dx * muonStoppingPower(m, e1) * 1e-3;
    if (E <= M_MU) return 0;
  }
  return E;
}

/**
 * Mean range of a muon of momentum p (GeV) in a material, in cm: the thickness at which its mean energy has
 * fallen to its rest energy (continuous-slowing-down approximation, no straggling).
 */
export function muonRange(mat: Material | string, p: number): number {
  const m = material(mat);
  const E0 = Math.sqrt(p * p + M_MU * M_MU);
  const T0 = E0 - M_MU;
  // integrate dx = dT / S(T) over T from 5 MeV up to T0, in log T; below 5 MeV the range is a few mg/cm².
  const Tmin = Math.min(0.005, T0 * 0.5);
  const n = 400;
  const lr = Math.log(T0 / Tmin);
  let g = 0;
  let prev = 0;
  for (let i = 0; i <= n; i++) {
    const T = Tmin * Math.exp((lr * i) / n);
    const S = muonStoppingPower(m, T + M_MU) * 1e-3; // GeV cm²/g
    const f = T / S;
    if (i > 0) g += 0.5 * (f + prev) * (lr / n);
    prev = f;
  }
  return g / m.density;
}

// ── Special functions ─────────────────────────────────────────────────────────────────────────

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
  12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];
/** ln Γ(x) for x > 0 (Lanczos approximation, about 1e-14 relative). */
export function lnGamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = LANCZOS[0]!;
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i]! / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Regularised lower incomplete gamma function P(a, x) = γ(a, x)/Γ(a): the CDF of a gamma distribution. */
export function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (!Number.isFinite(x)) return 1;
  const gln = lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return Math.min(1, sum * Math.exp(-x + a * Math.log(x) - gln));
  }
  // continued fraction (modified Lentz)
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return Math.max(0, 1 - Math.exp(-x + a * Math.log(x) - gln) * h);
}

/** A gamma(shape, 1) variate (Marsaglia–Tsang; shapes below 1 by the boosting trick). */
export function gammaVariate(rng: Rng, shape: number): number {
  if (shape < 1) {
    const u = rng();
    return gammaVariate(rng, shape + 1) * Math.exp(Math.log(u > 0 ? u : 1e-300) / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7). */
export function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
