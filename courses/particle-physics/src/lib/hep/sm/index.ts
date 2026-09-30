/**
 * The Standard Model inputs the generator needs: masses, running couplings, Z couplings, leading-order widths,
 * the CKM matrix, propagators and the ratio R.
 *
 * Everything here is tree level or one loop and is meant to be read. Where a number is a choice rather than a
 * measurement (the effective light-quark masses in the running of α, the scale at which a coupling is
 * evaluated), the comment says so. Natural units, GeV; cross-sections are in GeV⁻² unless the name says otherwise.
 */
import { G_F, ALPHA, ALPHA_S_MZ, HBARC2_GEV2_NB } from '../units/index.ts';
import { particle } from '../particles/index.ts';

// ── Masses and widths (from the particle table, PDG 2024 roundings) ────────────────────────────────────────────
export const M_Z = particle(23).mass;
export const GAMMA_Z = particle(23).width;
export const M_W = particle(24).mass;
export const GAMMA_W = particle(24).width;
export const M_T = particle(6).mass;
export const GAMMA_T = particle(6).width;
export const M_H = particle(25).mass;
export const GAMMA_H = particle(25).width;
/** Higgs vacuum expectation value v = (√2 G_F)^(−1/2) ≈ 246.22 GeV. */
export const V_EW = 1 / Math.sqrt(Math.SQRT2 * G_F);

/** Fine-structure constant at Q = 0 (1/137.036). */
export const ALPHA_0 = ALPHA;
/** The MS-bar value α(mZ) = 1/127.952 used by the PDG (W loops decoupled); `alphaEM(mZ)` gives the QED-only running, 1/128.96. */
export const ALPHA_MZ_MSBAR = 1 / 127.952;
export { ALPHA_S_MZ, G_F };

/** sin²θW, MS-bar at mZ (PDG 2024: 0.23122). */
export const SIN2W_MSBAR = 0.23122;
/** sin²θW, effective leptonic (from the Z-pole asymmetries; PDG 2024: 0.23153). The default in the Z couplings. */
export const SIN2W_EFF = 0.23153;
/** sin²θW, on-shell definition 1 − mW²/mZ² (≈ 0.2232). */
export const SIN2W_ONSHELL = 1 - (M_W / M_Z) ** 2;

// ── Fermion properties ─────────────────────────────────────────────────────────────────────────────────────────
export interface FermionProps {
  /** Electric charge in units of e. */
  Q: number;
  /** Third component of weak isospin of the left-handed fermion. */
  T3: number;
  /** Colours. */
  Nc: number;
  /** Mass in GeV (the particle-table value). */
  mass: number;
}

/** Charge, T3, colour count and mass for a fermion PDG code (sign ignored). */
export function fermion(pdg: number): FermionProps {
  const a = Math.abs(pdg);
  if (a < 1 || a > 16 || (a > 6 && a < 11)) throw new Error(`not a fermion PDG code: ${pdg}`);
  const up = a === 2 || a === 4 || a === 6;
  const down = a === 1 || a === 3 || a === 5;
  const nu = a === 12 || a === 14 || a === 16;
  const Q = up ? 2 / 3 : down ? -1 / 3 : nu ? 0 : -1;
  const T3 = up || nu ? 0.5 : -0.5;
  return { Q, T3, Nc: up || down ? 3 : 1, mass: particle(a).mass };
}

// ── Z couplings ───────────────────────────────────────────────────────────────────────────────────────────────
export interface ZCouplings {
  Q: number;
  T3: number;
  /** Left- and right-handed couplings g_L = T3 − Q sin²θW, g_R = −Q sin²θW (vertex −i e/(sinθW cosθW) γ^μ (g_L P_L + g_R P_R)). */
  gL: number;
  gR: number;
  /** PDG convention: g_V = T3 − 2 Q sin²θW, g_A = T3 (vertex −i e/(2 sinθW cosθW) γ^μ (g_V − g_A γ5)). */
  gV: number;
  gA: number;
}
/** Z couplings of a fermion (the antifermion has the same gV, gA in this convention). */
export function zCouplings(pdg: number, sin2w = SIN2W_EFF): ZCouplings {
  const { Q, T3 } = fermion(pdg);
  return { Q, T3, gL: T3 - Q * sin2w, gR: -Q * sin2w, gV: T3 - 2 * Q * sin2w, gA: T3 };
}
/** Asymmetry parameter A_f = 2 gV gA / (gV² + gA²) (0.147 for charged leptons, 0.935 for b quarks at sin²θW = 0.2315). */
export function asymmetryParameter(pdg: number, sin2w = SIN2W_EFF): number {
  const c = zCouplings(pdg, sin2w);
  return (2 * c.gV * c.gA) / (c.gV * c.gV + c.gA * c.gA);
}

// ── Running of α ─────────────────────────────────────────────────────────────────────────────────────────────
/**
 * Effective mass of the three light quarks in the vacuum polarisation. The hadronic contribution at low Q is
 * not perturbative; a common shortcut is to give the light quarks an effective mass tuned to reproduce the measured
 * hadronic contribution Δα_had(mZ) ≈ 0.0276. With 0.08 GeV the one-loop sum below gives 1/α(mZ) = 128.96.
 * This is a choice, not a measurement.
 */
export const M_LIGHT_EFFECTIVE = 0.08;

const VP_FERMIONS: { Nc: number; Q2: number; m: number }[] = [
  { Nc: 1, Q2: 1, m: particle(11).mass },
  { Nc: 1, Q2: 1, m: particle(13).mass },
  { Nc: 1, Q2: 1, m: particle(15).mass },
  { Nc: 3, Q2: 4 / 9, m: M_LIGHT_EFFECTIVE },
  { Nc: 3, Q2: 1 / 9, m: M_LIGHT_EFFECTIVE },
  { Nc: 3, Q2: 1 / 9, m: M_LIGHT_EFFECTIVE },
  { Nc: 3, Q2: 4 / 9, m: particle(4).mass },
  { Nc: 3, Q2: 1 / 9, m: particle(5).mass },
  { Nc: 3, Q2: 4 / 9, m: particle(6).mass },
];
const N_LEPTONS = 3;

/**
 * The one-loop vacuum-polarisation function of one fermion, F(x) = 6 ∫₀¹ z(1−z) ln(1 + z(1−z) x) dz with x = Q²/m²,
 * in closed form: F = β² − 8/3 + ½ β (3 − β²) ln((β+1)/(β−1)), β = √(1 + 4/x). For Q² ≫ m² it tends to ln x − 5/3
 * and for Q² ≪ m² to x/5 (the fermion decouples).
 */
export function vacuumPolarisationFunction(x: number): number {
  if (x <= 0) return 0;
  if (x < 1e-4) return x / 5 - (x * x) / 28;
  const b2 = 1 + 4 / x;
  const b = Math.sqrt(b2);
  // ln((β+1)/(β−1)) = ln((β+1)² x/4) is exact and keeps full precision when β → 1 (large x); atanh(1/β) does when β is large.
  const L = x > 1 ? Math.log(((b + 1) * (b + 1) * x) / 4) : 2 * Math.atanh(1 / b);
  return b2 - 8 / 3 + (b * (3 - b2) * L) / 2;
}

/** The shift Δα(Q²) = (α₀/3π) Σ_f N_c Q_f² F(Q²/m_f²), summed over all listed fermions (leptons, quarks). */
export function deltaAlpha(Q: number, part: 'all' | 'leptons' | 'hadrons' = 'all'): number {
  const Q2 = Q * Q;
  let s = 0;
  for (let i = 0; i < VP_FERMIONS.length; i++) {
    if (part === 'leptons' && i >= N_LEPTONS) continue;
    if (part === 'hadrons' && i < N_LEPTONS) continue;
    const f = VP_FERMIONS[i]!;
    s += f.Nc * f.Q2 * vacuumPolarisationFunction(Q2 / (f.m * f.m));
  }
  return (ALPHA_0 / (3 * Math.PI)) * s;
}

/**
 * The QED coupling at scale Q (GeV): α(Q) = α₀ / (1 − Δα(Q)), one loop with every charged fermion and its own
 * threshold (electron, muon, tau, three light quarks with an effective mass, c, b, t). Gives exactly 1/137.036 at
 * Q = 0 and 1/128.96 at mZ. The argument is the scale, so use Q = √s for a timelike process (the real part).
 */
export function alphaEM(Q: number): number {
  return ALPHA_0 / (1 - deltaAlpha(Math.abs(Q)));
}

// ── Running of αs ────────────────────────────────────────────────────────────────────────────────────────────
const M_C = particle(4).mass;
const M_B = particle(5).mass;
/** Below this scale αs is frozen (the perturbative coupling runs away at about 0.3 GeV). */
export const ALPHA_S_Q_MIN = 1.0;

/** Number of active flavours at scale Q: 3 below mc, 4 below mb, 5 below mt, else 6 (thresholds at the quark masses). */
export function nfActive(Q: number): number {
  return Q < M_C ? 3 : Q < M_B ? 4 : Q < M_T ? 5 : 6;
}
/** The one-loop β-function coefficient β₀ = 11 − 2nf/3 (in dαs/d ln μ² = −β₀ αs²/4π − …). */
export const beta0 = (nf: number): number => 11 - (2 * nf) / 3;
/** The two-loop coefficient β₁ = 102 − 38nf/3. */
export const beta1 = (nf: number): number => 102 - (38 * nf) / 3;

/** Segment boundaries in ln Q for the flavour thresholds. */
const THRESH = [M_C, M_B, M_T];

/** dαs/d ln Q for nf flavours, `loops` = 1 or 2. */
function dAlpha(a: number, nf: number, loops: 1 | 2): number {
  const b0 = beta0(nf) / (4 * Math.PI);
  const b1 = beta1(nf) / (16 * Math.PI * Math.PI);
  return -2 * (b0 * a * a + (loops === 2 ? b1 * a * a * a : 0));
}
function rk4(a0: number, lnQ0: number, lnQ1: number, nf: number, loops: 1 | 2): number {
  const n = Math.max(1, Math.ceil(Math.abs(lnQ1 - lnQ0) / 0.05));
  const h = (lnQ1 - lnQ0) / n;
  let a = a0;
  for (let i = 0; i < n; i++) {
    const k1 = dAlpha(a, nf, loops);
    const k2 = dAlpha(a + 0.5 * h * k1, nf, loops);
    const k3 = dAlpha(a + 0.5 * h * k2, nf, loops);
    const k4 = dAlpha(a + h * k3, nf, loops);
    a += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  return a;
}

/** αs at the thresholds (continuous matching at μ = m_q), per loop order, starting from αs(mZ) in the nf = 5 region. */
const anchors: Record<1 | 2, number[] | undefined> = { 1: undefined, 2: undefined };
function anchorsFor(loops: 1 | 2): number[] {
  let a = anchors[loops];
  if (a) return a;
  // a[0] = αs(mc), a[1] = αs(mb), a[2] = αs(mt)
  const aZ = ALPHA_S_MZ;
  const ab = rk4(aZ, Math.log(M_Z), Math.log(M_B), 5, loops);
  const ac = rk4(ab, Math.log(M_B), Math.log(M_C), 4, loops);
  const at = rk4(aZ, Math.log(M_Z), Math.log(M_T), 5, loops);
  a = [ac, ab, at];
  anchors[loops] = a;
  return a;
}

/**
 * The strong coupling αs(Q) with αs(mZ) = 0.118, running with nf = 3, 4, 5, 6 active flavours (continuous at the
 * quark masses) at one loop or two loops (default two). Frozen below 1 GeV.
 */
export function alphaS(Q: number, loops: 1 | 2 = 2): number {
  const q = Math.max(Q, ALPHA_S_Q_MIN);
  const [ac, ab, at] = anchorsFor(loops);
  const lq = Math.log(q);
  if (q >= M_T) return rk4(at!, Math.log(M_T), lq, 6, loops);
  if (q >= M_B) return rk4(ALPHA_S_MZ, Math.log(M_Z), lq, 5, loops);
  if (q >= M_C) return rk4(ab!, Math.log(M_B), lq, 4, loops);
  return rk4(ac!, Math.log(M_C), lq, 3, loops);
}
/** One-loop αs(Q): the form used by the parton-distribution evolution. */
export const alphaS1 = (Q: number): number => alphaS(Q, 1);
/** Two-loop αs(Q). */
export const alphaS2 = (Q: number): number => alphaS(Q, 2);

// ── CKM matrix ────────────────────────────────────────────────────────────────────────────────────────────────
export interface Complex {
  re: number;
  im: number;
}
/** Wolfenstein parameters (PDG 2024 global fit): λ, A, ρ̄, η̄. */
export const WOLFENSTEIN = { lambda: 0.22501, A: 0.826, rhobar: 0.159, etabar: 0.348 };

/**
 * The CKM matrix built exactly from the Wolfenstein parameters (so it is unitary to rounding) through the
 * standard parametrisation: s12 = λ, s23 = Aλ², s13 e^(−iδ) = Aλ³(ρ + iη) with (ρ + iη) from (ρ̄ + iη̄).
 * Rows are u, c, t; columns d, s, b.
 */
export function ckmMatrix(w = WOLFENSTEIN): Complex[][] {
  const { lambda: l, A, rhobar, etabar } = w;
  const s12 = l;
  const s23 = A * l * l;
  // ρ + iη = (ρ̄ + iη̄) √(1−A²λ⁴) / (√(1−λ²) [1 − A²λ⁴ (ρ̄ + iη̄)])
  const k = Math.sqrt(1 - A * A * l ** 4) / Math.sqrt(1 - l * l);
  const dRe = 1 - A * A * l ** 4 * rhobar;
  const dIm = -A * A * l ** 4 * etabar;
  const d2 = dRe * dRe + dIm * dIm;
  const numRe = rhobar * k, numIm = etabar * k;
  const rho = (numRe * dRe + numIm * dIm) / d2;
  const eta = (numIm * dRe - numRe * dIm) / d2;
  const X: Complex = { re: A * l ** 3 * rho, im: A * l ** 3 * eta }; // s13 e^(−iδ)
  const Xc: Complex = { re: X.re, im: -X.im }; // s13 e^(+iδ)
  const s13 = Math.hypot(X.re, X.im);
  const c12 = Math.sqrt(1 - s12 * s12), c23 = Math.sqrt(1 - s23 * s23), c13 = Math.sqrt(1 - s13 * s13);
  const mul = (z: Complex, r: number): Complex => ({ re: z.re * r, im: z.im * r });
  const add = (a: Complex, b: Complex): Complex => ({ re: a.re + b.re, im: a.im + b.im });
  const R = (r: number): Complex => ({ re: r, im: 0 });
  return [
    [R(c12 * c13), R(s12 * c13), X],
    [add(R(-s12 * c23), mul(Xc, -c12 * s23)), add(R(c12 * c23), mul(Xc, -s12 * s23)), R(s23 * c13)],
    [add(R(s12 * s23), mul(Xc, -c12 * c23)), add(R(-c12 * s23), mul(Xc, -s12 * c23)), R(c23 * c13)],
  ];
}
let ckmCache: number[][] | undefined;
/** |V_ij|² for up-type i ∈ {2,4,6} (or |pdg|) and down-type j ∈ {1,3,5} PDG codes (signs ignored). */
export function ckmSquared(up: number, down: number): number {
  if (!ckmCache) ckmCache = ckmMatrix().map((row) => row.map((z) => z.re * z.re + z.im * z.im));
  const i = (Math.abs(up) >> 1) - 1;
  const j = (Math.abs(down) - 1) >> 1;
  const v = ckmCache[i]?.[j];
  if (v === undefined || !(i >= 0 && i < 3 && j >= 0 && j < 3)) throw new Error(`ckmSquared(${up}, ${down}): need an up-type and a down-type quark`);
  return v;
}
/** |V_ij| for up-type and down-type PDG codes. */
export const ckmAbs = (up: number, down: number): number => Math.sqrt(ckmSquared(up, down));

// ── Propagators ──────────────────────────────────────────────────────────────────────────────────────────────
/** 1/((s − M²)² + M²Γ²), the squared modulus of the Breit–Wigner propagator (constant width). */
export function breitWignerDensity(s: number, M: number, Gamma: number): number {
  const d = s - M * M;
  return 1 / (d * d + M * M * Gamma * Gamma);
}
/**
 * The Breit–Wigner propagator 1/(s − M² + i M Γ), as a complex number. With `running` the width scales as
 * Γ(s) = Γ s/M² (the form used for the Z line shape at LEP, and the convention in which the PDG Z mass is defined).
 */
export function propagator(s: number, M: number, Gamma: number, running = false): Complex {
  const g = running ? (Gamma * s) / (M * M) : Gamma;
  const re = s - M * M;
  const im = M * g;
  const d = re * re + im * im;
  return { re: re / d, im: -im / d };
}
/** χ(s) = s/(s − M² + i M Γ(s)): the propagator ratio that multiplies the Z coupling relative to the photon. */
export function chi(s: number, M: number, Gamma: number, running = true): Complex {
  const p = propagator(s, M, Gamma, running);
  return { re: s * p.re, im: s * p.im };
}
/** Normalised non-relativistic Breit–Wigner (Cauchy) density in the mass m: (Γ/2π)/((m−M)² + Γ²/4). */
export function breitWignerPdf(m: number, M: number, Gamma: number): number {
  return (Gamma / (2 * Math.PI)) / ((m - M) ** 2 + (Gamma * Gamma) / 4);
}

// ── Widths at leading order ──────────────────────────────────────────────────────────────────────────────────
export interface WidthOptions {
  /** Include the first-order QCD correction 1 + αs/π to hadronic widths (default false: leading order). */
  qcd?: boolean;
  sin2w?: number;
}
const qcdFactor = (Q: number): number => 1 + alphaS(Q) / Math.PI;

/** Γ(Z → f f̄) in GeV at leading order: N_c G_F mZ³/(6√2 π) [gV² β(3−β²)/2 + gA² β³], β = √(1 − 4m²/mZ²) (→ gV² + gA² for massless f). */
export function zPartialWidth(pdg: number, opts: WidthOptions = {}): number {
  const f = fermion(pdg);
  const c = zCouplings(pdg, opts.sin2w ?? SIN2W_EFF);
  const r = (2 * f.mass) / M_Z;
  if (r >= 1) return 0;
  const beta = Math.sqrt(1 - r * r);
  const base = (f.Nc * G_F * M_Z ** 3) / (6 * Math.SQRT2 * Math.PI);
  // massless limit: gV² + gA². With mass: β(3−β²)/2 · gV² + β³ · gA².
  const w = base * ((beta * (3 - beta * beta) / 2) * c.gV * c.gV + beta ** 3 * c.gA * c.gA);
  return f.Nc === 3 && opts.qcd ? w * qcdFactor(M_Z) : w;
}
/** The Z partial widths by final state and their sum (leading order, 5 flavours + 3 neutrinos), GeV. */
export function zWidths(opts: WidthOptions = {}): { byFlavour: Record<string, number>; total: number; hadronic: number; invisible: number; leptonic: number } {
  const names: [string, number][] = [['e', 11], ['mu', 13], ['tau', 15], ['nu_e', 12], ['nu_mu', 14], ['nu_tau', 16], ['d', 1], ['u', 2], ['s', 3], ['c', 4], ['b', 5]];
  const byFlavour: Record<string, number> = {};
  let total = 0, hadronic = 0, invisible = 0, leptonic = 0;
  for (const [n, id] of names) {
    const w = zPartialWidth(id, opts);
    byFlavour[n] = w;
    total += w;
    if (id <= 5) hadronic += w;
    else if (id % 2 === 0) invisible += w;
    else leptonic += w;
  }
  return { byFlavour, total, hadronic, invisible, leptonic };
}
/** Branching fractions of the Z at leading order, by final state. */
export function zBranchingFractions(opts: WidthOptions = {}): Record<string, number> {
  const { byFlavour, total } = zWidths(opts);
  const out: Record<string, number> = {};
  for (const k of Object.keys(byFlavour)) out[k] = byFlavour[k]! / total;
  return out;
}

/** Γ(W → f f̄′) in GeV: N_c |V|² G_F mW³/(6√2 π) (massless fermions). Arguments: two quark PDG codes (either order), or a lepton and its neutrino. */
export function wPartialWidth(pdgA: number, pdgB: number, opts: { qcd?: boolean } = {}): number {
  const a = Math.abs(pdgA), b = Math.abs(pdgB);
  const base = (G_F * M_W ** 3) / (6 * Math.SQRT2 * Math.PI);
  if (a >= 11) return base; // ℓν
  const up = a % 2 === 0 ? a : b;
  const down = a % 2 === 0 ? b : a;
  if (particle(up).mass + particle(down).mass > M_W) return 0;
  const w = 3 * base * ckmSquared(up, down);
  return opts.qcd ? w * qcdFactor(M_W) : w;
}
/** The W width at leading order: three lepton channels plus (u,c) × (d,s,b), GeV. */
export function wTotalWidth(opts: { qcd?: boolean } = {}): number {
  let t = 3 * wPartialWidth(11, 12);
  for (const u of [2, 4]) for (const d of [1, 3, 5]) t += wPartialWidth(u, d, opts);
  return t;
}

/**
 * Γ(t → W b) at leading order in GeV, for a massless b (or with `mb`): G_F mt³/(8π√2) |Vtb|² (1 − r)² (1 + 2r), r = mW²/mt².
 * With `qcd` the O(αs) correction factor 1 − (2αs/3π)(2π²/3 − 5/2) is applied.
 */
export function topWidth(opts: { qcd?: boolean; mb?: number; mt?: number } = {}): number {
  const mt = opts.mt ?? M_T;
  const mb = opts.mb ?? 0;
  const vtb2 = ckmSquared(6, 5);
  const lam = (mt * mt - (M_W + mb) ** 2) * (mt * mt - (M_W - mb) ** 2);
  if (lam <= 0) return 0;
  const k = Math.sqrt(lam) / (2 * mt);
  const X = (mt * mt - mb * mb) ** 2 + M_W ** 2 * (mt * mt + mb * mb) - 2 * M_W ** 4;
  let w = ((G_F * vtb2) / (8 * Math.PI * Math.SQRT2)) * ((2 * k * X) / (mt * mt));
  if (opts.qcd) {
    const as = alphaS(mt);
    w *= 1 - ((2 * as) / (3 * Math.PI)) * ((2 * Math.PI * Math.PI) / 3 - 5 / 2);
  }
  return w;
}

/** Running MS-bar quark mass at scale μ from m(m) at one loop: m(μ) = m(m) [αs(μ)/αs(m)]^(12/(33−2nf)), nf = 5 for the Higgs. */
export function runningMass(pdg: number, mu: number): number {
  const m0 = particle(pdg).mass;
  // The table holds MS-bar masses m(m) for c and b; the exponent uses nf = 5 between mb and mu.
  const nf = mu > M_B ? 5 : 4;
  return m0 * (alphaS1(mu) / alphaS1(m0)) ** (12 / (33 - 2 * nf));
}

/** Loop function f(τ) for τ = mH²/4m²: arcsin²√τ for τ ≤ 1 and the real part of its continuation above. */
function loopF(tau: number): number {
  if (tau <= 1) return Math.asin(Math.sqrt(tau)) ** 2;
  const s = Math.sqrt(1 - 1 / tau);
  const l = Math.log((1 + s) / (1 - s));
  return -0.25 * (l * l - Math.PI * Math.PI); // real part only
}
/** Fermion and W form factors of the H → γγ loop (Djouadi, Phys. Rep. 457, eqs. 2.26–2.27). */
const A12 = (tau: number): number => (2 * (tau + (tau - 1) * loopF(tau))) / (tau * tau);
const A1 = (tau: number): number => -(2 * tau * tau + 3 * tau + 3 * (2 * tau - 1) * loopF(tau)) / (tau * tau);

export interface HiggsWidths {
  mH: number;
  /** Partial widths in GeV. */
  partial: { bb: number; cc: number; tautau: number; mumu: number; WW: number; ZZ: number; gammagamma: number; gg: number };
  total: number;
  /** Branching ratios. */
  br: { bb: number; cc: number; tautau: number; mumu: number; WW: number; ZZ: number; gammagamma: number; gg: number };
}
/**
 * Higgs partial widths at leading order, in the heavy-top limit for gg. Fermion channels use the MS-bar mass run to mH
 * (Γ ∝ m_f²); WW* and ZZ* use the off-shell formula of Keung and Kamal; γγ and gg use the quark and W loops.
 * The result is a leading-order estimate: the measured/recommended values differ by QCD corrections of order 20 % on bb̄ and ~60 % on gg.
 */
export function higgsWidths(mH = M_H): HiggsWidths {
  const fermionW = (pdg: number, m: number, Nc: number) => {
    const beta = Math.sqrt(Math.max(0, 1 - (4 * m * m) / (mH * mH)));
    return (Nc * G_F * mH * m * m * beta ** 3) / (4 * Math.SQRT2 * Math.PI);
  };
  const bb = fermionW(5, runningMass(5, mH), 3);
  const cc = fermionW(4, runningMass(4, mH), 3);
  const tautau = fermionW(15, particle(15).mass, 1);
  const mumu = fermionW(13, particle(13).mass, 1);
  const vv = (MV: number, delta: number) => {
    const x = (MV * MV) / (mH * mH);
    if (4 * x <= 1) return 0; // mH > 2 mV: the on-shell two-body formula is not implemented (not needed near 125 GeV)
    const R =
      (3 * (1 - 8 * x + 20 * x * x)) / Math.sqrt(4 * x - 1) * Math.acos((3 * x - 1) / (2 * x ** 1.5)) -
      ((1 - x) / (2 * x)) * (2 - 13 * x + 47 * x * x) -
      1.5 * (1 - 6 * x + 4 * x * x) * Math.log(x);
    return ((3 * G_F * G_F * MV ** 4 * mH) / (16 * Math.PI ** 3)) * delta * R;
  };
  const sw2 = SIN2W_ONSHELL;
  const deltaZ = 7 / 12 - (10 * sw2) / 9 + (40 * sw2 * sw2) / 27;
  const WW = vv(M_W, 1);
  const ZZ = vv(M_Z, deltaZ);
  // γγ: loop of top, bottom, tau... (fermion Nc Q² A½(τ)) plus W (A₁), with α at Q = 0.
  let sum = A1(mH ** 2 / (4 * M_W ** 2));
  for (const [pdg, Nc, Q] of [[6, 3, 2 / 3], [5, 3, -1 / 3], [4, 3, 2 / 3], [15, 1, -1]] as [number, number, number][]) {
    const m = pdg === 5 || pdg === 4 ? runningMass(pdg, mH) : particle(pdg).mass;
    sum += Nc * Q * Q * A12(mH ** 2 / (4 * m * m));
  }
  const gammagamma = (G_F * ALPHA_0 ** 2 * mH ** 3 * sum * sum) / (128 * Math.SQRT2 * Math.PI ** 3);
  let sg = 0;
  for (const pdg of [6, 5, 4]) {
    const m = pdg === 6 ? M_T : runningMass(pdg, mH);
    sg += A12(mH ** 2 / (4 * m * m));
  }
  const gg = (G_F * alphaS(mH) ** 2 * mH ** 3 * (0.75 * sg) ** 2) / (36 * Math.SQRT2 * Math.PI ** 3);
  const partial = { bb, cc, tautau, mumu, WW, ZZ, gammagamma, gg };
  const total = bb + cc + tautau + mumu + WW + ZZ + gammagamma + gg;
  const br = Object.fromEntries(Object.entries(partial).map(([k, v]) => [k, v / total])) as HiggsWidths['br'];
  return { mH, partial, total, br };
}

// ── e⁺e⁻ → hadrons: the R ratio ───────────────────────────────────────────────────────────────────────────────
const QUARKS = [1, 2, 3, 4, 5, 6];

/**
 * R(s) = σ(e⁺e⁻ → hadrons)/σ(e⁺e⁻ → μ⁺μ⁻) at leading order, photon exchange only:
 * R = N_c Σ_q Q_q² β(3−β²)/2 over quarks with 2m_q < √s, β = √(1 − 4m_q²/s). Thresholds sit at twice the quark mass
 * of the particle table (not at the hadron thresholds); colour factor N_c = 3, so R = 2, 10/3, 11/3 for 3, 4, 5 flavours.
 * `qcd`: multiply by 1 + αs(√s)/π.
 */
export function rRatio(sqrtS: number, opts: { qcd?: boolean } = {}): number {
  const s = sqrtS * sqrtS;
  let r = 0;
  for (const q of QUARKS) {
    const f = fermion(q);
    const b2 = 1 - (4 * f.mass * f.mass) / s;
    if (b2 <= 0) continue;
    const b = Math.sqrt(b2);
    r += f.Nc * f.Q * f.Q * (b * (3 - b2)) / 2;
  }
  return opts.qcd ? r * qcdFactor(sqrtS) : r;
}

/** Point cross-section 4πα²/(3s) for e⁺e⁻ → μ⁺μ⁻ in GeV⁻² with α = 1/137.036 (86.8 nb/s for s in GeV²). */
export function sigmaPointGeV2(s: number, alpha = ALPHA_0): number {
  return (4 * Math.PI * alpha * alpha) / (3 * s);
}
/** σ(e⁺e⁻ → μ⁺μ⁻) in nb from pure photon exchange, for √s in GeV. */
export function sigmaMuMuQedNb(sqrtS: number): number {
  return sigmaPointGeV2(sqrtS * sqrtS) * HBARC2_GEV2_NB;
}
/** Peak height of a resonance formed in e⁺e⁻ and decaying to f: σ = 12π Γee Γff / (M² Γ²) in GeV⁻² (Breit–Wigner at the pole, no radiation). */
export function breitWignerPeak(M: number, Gamma: number, GammaEE: number, GammaFF: number): number {
  return (12 * Math.PI * GammaEE * GammaFF) / (M * M * Gamma * Gamma);
}
