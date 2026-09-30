/**
 * `hep/oscillations`: neutrino oscillations in vacuum and in matter (Chapter 31).
 *
 * Units used by every function here, and nothing else:
 *   baseline L in kilometres, energy E in GeV, squared-mass differences Δm² in eV², angles in radians, density in g/cm³.
 * The constants are derived from `hep/units`, not typed in: `OSC_PHASE_CONSTANT` is 1.26693… (the famous "1.267"), which a test
 * checks against Δm² L / (4 E ħc) evaluated in SI-like steps.
 *
 * Hook: `oscillations.probability` (two-flavour probability), `(theta, dm2, L, E) => P`, reference `probabilityTwoFlavourReference`.
 */
import { hook } from '../hooks.ts';
import { G_F, HBARC_GEV_FM, N_A } from '../units/index.ts';

/** ħc in eV·m. */
export const HBARC_EV_M = HBARC_GEV_FM * 1e9 * 1e-15;

/**
 * The phase of an oscillation, Δm² L / (4E) in natural units, is this constant times Δm² [eV²] L [km] / E [GeV]:
 * (1 km / ħc) / (4 · 1 GeV) · 1 eV² = 1e3 / (HBARC_EV_M · 4 · 1e9) = 1.26693.
 */
export const OSC_PHASE_CONSTANT = 1e3 / (4 * HBARC_EV_M * 1e9);

/** The oscillation phase Δm² L / (4 E ħc), dimensionless. */
export function phase(dm2: number, L: number, E: number): number {
  return (OSC_PHASE_CONSTANT * dm2 * L) / E;
}

/** The length over which the oscillation probability repeats, L_osc = π E / (1.267 Δm²) ≈ 2.48 E/Δm² km. */
export function oscillationLength(dm2: number, E: number): number {
  return (Math.PI * E) / (OSC_PHASE_CONSTANT * Math.abs(dm2));
}

// ── two flavours ────────────────────────────────────────────────────────────────────────────────

/** Reference of the hook `oscillations.probability`: P(ν_α → ν_β) = sin²2θ sin²(1.267 Δm² L/E) for two flavours, α ≠ β. */
export function probabilityTwoFlavourReference(theta: number, dm2: number, L: number, E: number): number {
  const s2 = Math.sin(2 * theta);
  const s = Math.sin(phase(dm2, L, E));
  return s2 * s2 * s * s;
}
/** `probabilityTwoFlavourReference`, or the reader's version if installed as the hook `oscillations.probability`. */
export function probability(theta: number, dm2: number, L: number, E: number): number {
  return hook('oscillations.probability', probabilityTwoFlavourReference)(theta, dm2, L, E);
}

// ── three flavours ──────────────────────────────────────────────────────────────────────────────

export interface OscParams {
  theta12: number;
  theta13: number;
  theta23: number;
  /** The CP phase δ in radians. */
  deltaCP: number;
  /** Δm²₂₁ = m₂² − m₁² in eV² (positive). */
  dm21: number;
  /** Δm²₃₁ = m₃² − m₁² in eV² (positive for the normal ordering, negative for the inverted one). */
  dm31: number;
}

/** A 3×3 complex matrix as two 3×3 real arrays. */
export interface CMat3 {
  re: number[][];
  im: number[][];
}

const zero3 = (): number[][] => [0, 1, 2].map(() => [0, 0, 0]);
const cmat = (): CMat3 => ({ re: zero3(), im: zero3() });
export const identity3 = (): CMat3 => {
  const m = cmat();
  for (let i = 0; i < 3; i++) m.re[i]![i] = 1;
  return m;
};
export function mul3(a: CMat3, b: CMat3): CMat3 {
  const c = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      let re = 0, im = 0;
      for (let k = 0; k < 3; k++) {
        re += a.re[i]![k]! * b.re[k]![j]! - a.im[i]![k]! * b.im[k]![j]!;
        im += a.re[i]![k]! * b.im[k]![j]! + a.im[i]![k]! * b.re[k]![j]!;
      }
      c.re[i]![j] = re;
      c.im[i]![j] = im;
    }
  return c;
}
/** The conjugate transpose. */
export function dagger3(a: CMat3): CMat3 {
  const c = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      c.re[i]![j] = a.re[j]![i]!;
      c.im[i]![j] = -a.im[j]![i]!;
    }
  return c;
}
export function conj3(a: CMat3): CMat3 {
  const c = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      c.re[i]![j] = a.re[i]![j]!;
      c.im[i]![j] = -a.im[i]![j]!;
    }
  return c;
}
const scale3 = (a: CMat3, k: number): CMat3 => {
  const c = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      c.re[i]![j] = a.re[i]![j]! * k;
      c.im[i]![j] = a.im[i]![j]! * k;
    }
  return c;
};
const add3 = (a: CMat3, b: CMat3): CMat3 => {
  const c = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      c.re[i]![j] = a.re[i]![j]! + b.re[i]![j]!;
      c.im[i]![j] = a.im[i]![j]! + b.im[i]![j]!;
    }
  return c;
};

/**
 * The PMNS matrix U in the standard parametrisation (the PDG's), rows e, μ, τ and columns ν₁, ν₂, ν₃:
 *   U = R₂₃(θ₂₃) · U_δ R₁₃(θ₁₃) U_δ† · R₁₂(θ₁₂).
 * Majorana phases are left out: they do not affect oscillations.
 */
export function pmns(theta12: number, theta13: number, theta23: number, deltaCP: number): CMat3 {
  const s12 = Math.sin(theta12), c12 = Math.cos(theta12);
  const s13 = Math.sin(theta13), c13 = Math.cos(theta13);
  const s23 = Math.sin(theta23), c23 = Math.cos(theta23);
  const cd = Math.cos(deltaCP), sd = Math.sin(deltaCP);
  const U = cmat();
  // Row e
  U.re[0]![0] = c12 * c13;
  U.re[0]![1] = s12 * c13;
  U.re[0]![2] = s13 * cd;
  U.im[0]![2] = -s13 * sd;
  // Row μ
  U.re[1]![0] = -s12 * c23 - c12 * s23 * s13 * cd;
  U.im[1]![0] = -c12 * s23 * s13 * sd;
  U.re[1]![1] = c12 * c23 - s12 * s23 * s13 * cd;
  U.im[1]![1] = -s12 * s23 * s13 * sd;
  U.re[1]![2] = s23 * c13;
  // Row τ
  U.re[2]![0] = s12 * s23 - c12 * c23 * s13 * cd;
  U.im[2]![0] = -c12 * c23 * s13 * sd;
  U.re[2]![1] = -c12 * s23 - s12 * c23 * s13 * cd;
  U.im[2]![1] = -s12 * c23 * s13 * sd;
  U.re[2]![2] = c23 * c13;
  return U;
}

/** |U_αi|² as a 3×3 array (the flavour content of each mass state). */
export function mixingSquared(U: CMat3): number[][] {
  return U.re.map((row, a) => row.map((r, i) => r * r + U.im[a]![i]! * U.im[a]![i]!));
}

/** The Jarlskog invariant J = c₁₂ s₁₂ c₂₃ s₂₃ c₁₃² s₁₃ sin δ: the size of CP violation in oscillations. */
export function jarlskog(p: Pick<OscParams, 'theta12' | 'theta13' | 'theta23' | 'deltaCP'>): number {
  return (
    Math.cos(p.theta12) * Math.sin(p.theta12) * Math.cos(p.theta23) * Math.sin(p.theta23) * Math.cos(p.theta13) ** 2 * Math.sin(p.theta13) * Math.sin(p.deltaCP)
  );
}

/** sin²θ → θ (radians). */
export const thetaFromSin2 = (s2: number): number => Math.asin(Math.sqrt(s2));

/**
 * Approximate global-fit values (NuFIT 6.0, Esteban et al., JHEP 12 (2024) 216, normal ordering, rounded), as defaults for the lab.
 * sin²θ₂₃ and δ are poorly known: 0.47 is one of two nearly equivalent best-fit regions (the other is above 0.5) and 212° is a hint only.
 * These are illustrative defaults, not a citation of the paper's table.
 */
export const GLOBAL_FIT_APPROX = {
  sin2theta12: 0.307,
  sin2theta13: 0.0220,
  sin2theta23: 0.47,
  deltaCPDeg: 212,
  dm21: 7.49e-5,
  dm3l: 2.513e-3,
} as const;

/** Oscillation parameters from sin²θ values, δ in degrees and |Δm²₃ℓ| (ℓ = 1 for the normal ordering, 2 for the inverted one). */
export function paramsFromSin2(
  s12: number,
  s13: number,
  s23: number,
  deltaDeg: number,
  dm21: number,
  dm3l: number,
  ordering: 'normal' | 'inverted' = 'normal',
): OscParams {
  return {
    theta12: thetaFromSin2(s12),
    theta13: thetaFromSin2(s13),
    theta23: thetaFromSin2(s23),
    deltaCP: (deltaDeg * Math.PI) / 180,
    dm21,
    dm31: ordering === 'normal' ? dm3l : -dm3l + dm21,
  };
}

/** The default parameter set, `GLOBAL_FIT_APPROX`. */
export function defaultParams(ordering: 'normal' | 'inverted' = 'normal'): OscParams {
  const g = GLOBAL_FIT_APPROX;
  return paramsFromSin2(g.sin2theta12, g.sin2theta13, g.sin2theta23, g.deltaCPDeg, g.dm21, g.dm3l, ordering);
}

// ── matter ──────────────────────────────────────────────────────────────────────────────────────

/**
 * The matter potential V = √2 G_F N_e in eV for electron neutrinos (charged-current coherent forward scattering on electrons),
 * for a density in g/cm³ and an electron fraction Y_e (electrons per nucleon, about 0.5 in the Earth, about 0.67 at the centre of the Sun).
 * V ≈ 7.63 × 10⁻¹⁴ eV · Y_e · ρ[g/cm³]. The sign flips for antineutrinos.
 */
export function matterPotential(density: number, Ye = 0.5): number {
  const ne = Ye * density * N_A; // electrons per cm³
  const hbarcEvCm = HBARC_EV_M * 100;
  const neEv3 = ne * hbarcEvCm ** 3; // eV³
  const gfEv = G_F * 1e-18; // GeV⁻² → eV⁻²
  return Math.SQRT2 * gfEv * neEv3;
}

export interface Layer {
  /** Density in g/cm³. */
  density: number;
  /** Length in km. */
  length: number;
}

export interface OscOptions {
  /** Include matter effects with this constant density (g/cm³) or a list of layers. Default: vacuum. */
  matter?: number | Layer[];
  /** Electron fraction Y_e. Default 0.5. */
  Ye?: number;
  /** Antineutrinos: δ → −δ and V → −V. */
  anti?: boolean;
}

/** The Hamiltonian H = (1/2E) U diag(0, Δm²₂₁, Δm²₃₁) U† + diag(V, 0, 0), in eV (E in GeV). */
export function hamiltonian(p: OscParams, E: number, V = 0, anti = false): CMat3 {
  let U = pmns(p.theta12, p.theta13, p.theta23, p.deltaCP);
  if (anti) U = conj3(U);
  const D = cmat();
  D.re[1]![1] = p.dm21;
  D.re[2]![2] = p.dm31;
  const H = scale3(mul3(mul3(U, D), dagger3(U)), 1 / (2 * E * 1e9));
  H.re[0]![0] = H.re[0]![0]! + (anti ? -V : V);
  return H;
}

/** exp(−i H L) for a Hermitian H (eV) and L in eV⁻¹, by scaling and squaring of a Taylor series. */
export function evolve(H: CMat3, LeV: number): CMat3 {
  const A = scale3(H, LeV); // H·L: dimensionless, Hermitian; we want exp(−i A)
  // norm bound
  let nrm = 0;
  for (let i = 0; i < 3; i++) {
    let row = 0;
    for (let j = 0; j < 3; j++) row += Math.hypot(A.re[i]![j]!, A.im[i]![j]!);
    nrm = Math.max(nrm, row);
  }
  let squarings = 0;
  while (nrm > 0.25) {
    nrm /= 2;
    squarings++;
  }
  const B = scale3(A, 1 / 2 ** squarings);
  // −iB = (B.im, −B.re) as (re, im)
  const M = cmat();
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      M.re[i]![j] = B.im[i]![j]!;
      M.im[i]![j] = -B.re[i]![j]!;
    }
  let term = identity3();
  let sum = identity3();
  for (let k = 1; k <= 14; k++) {
    term = scale3(mul3(term, M), 1 / k);
    sum = add3(sum, term);
  }
  for (let s = 0; s < squarings; s++) sum = mul3(sum, sum);
  return sum;
}

const KM_TO_INV_EV = 1e3 / HBARC_EV_M;

/** The evolution operator S (flavour basis): S[β][α] is the amplitude for ν_α → ν_β. */
export function evolutionOperator(p: OscParams, L: number, E: number, opt: OscOptions = {}): CMat3 {
  const anti = !!opt.anti;
  if (opt.matter === undefined || opt.matter === 0) return evolve(hamiltonian(p, E, 0, anti), L * KM_TO_INV_EV);
  const layers: Layer[] = typeof opt.matter === 'number' ? [{ density: opt.matter, length: L }] : opt.matter;
  let S = identity3();
  for (const layer of layers) {
    const H = hamiltonian(p, E, matterPotential(layer.density, opt.Ye ?? 0.5), anti);
    S = mul3(evolve(H, layer.length * KM_TO_INV_EV), S);
  }
  return S;
}

/**
 * The 3×3 matrix of probabilities P[α][β] = P(ν_α → ν_β) (α, β = e, μ, τ) after L km at energy E GeV.
 * Vacuum by default; with `matter` the evolution goes through constant-density layers, exactly (no expansion in small parameters).
 */
export function probabilities3(p: OscParams, L: number, E: number, opt: OscOptions = {}): number[][] {
  const S = evolutionOperator(p, L, E, opt);
  const P = zero3();
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) P[a]![b] = S.re[b]![a]! ** 2 + S.im[b]![a]! ** 2;
  return P;
}

/** One channel: P(ν_α → ν_β), with α, β in 0 (e), 1 (μ), 2 (τ). */
export function probability3(p: OscParams, alpha: number, beta: number, L: number, E: number, opt: OscOptions = {}): number {
  return probabilities3(p, L, E, opt)[alpha]![beta]!;
}

/**
 * Two-flavour probability in matter of constant density (the MSW effect), as a closed form to compare with the numerical propagation:
 * sin²2θ_m = sin²2θ / ((cos2θ − x)² + sin²2θ), Δm²_m = Δm² √((cos2θ − x)² + sin²2θ), x = 2 E V / Δm², P = sin²2θ_m sin²(1.267 Δm²_m L/E).
 * x > 0 for neutrinos with Δm² > 0, and there is a resonance at x = cos 2θ.
 */
export function probabilityTwoFlavourMatter(theta: number, dm2: number, L: number, E: number, V: number): number {
  const x = (2 * E * 1e9 * V) / dm2;
  const c2 = Math.cos(2 * theta), s2 = Math.sin(2 * theta);
  const r = Math.sqrt((c2 - x) ** 2 + s2 * s2);
  const s2m2 = (s2 * s2) / (r * r);
  const ph = phase(dm2 * r, L, E);
  return s2m2 * Math.sin(ph) ** 2;
}

/** The energy (GeV) of the MSW resonance for two flavours: 2 E V = Δm² cos 2θ. */
export function resonanceEnergy(theta: number, dm2: number, V: number): number {
  return (dm2 * Math.cos(2 * theta)) / (2 * V) / 1e9;
}

// ── solar neutrinos, adiabatic ──────────────────────────────────────────────────────────────────

/**
 * The survival probability of an electron neutrino that leaves the Sun adiabatically (two flavours, θ₁₃ neglected), averaged over the
 * oscillation phase on the way to the Earth: P_ee = ½ (1 + cos 2θ_m cos 2θ₁₂), with θ_m the mixing angle in the matter at the point of
 * production. x = 2 E V cos²θ₁₃ / Δm²₂₁ (here without the cos²θ₁₃ factor, which is 0.98).
 * A toy of the real solar model: one production density, no spread of the production region, no non-adiabatic corrections.
 */
export function solarSurvival(theta12: number, dm21: number, E: number, densityAtProduction: number, Ye = 0.67): number {
  const V = matterPotential(densityAtProduction, Ye);
  const x = (2 * E * 1e9 * V) / dm21;
  const c2 = Math.cos(2 * theta12), s2 = Math.sin(2 * theta12);
  const cm = (c2 - x) / Math.sqrt((c2 - x) ** 2 + s2 * s2);
  return 0.5 * (1 + cm * c2);
}

// ── masses ──────────────────────────────────────────────────────────────────────────────────────

/** The three masses in eV for a given lightest mass and ordering. Normal: m₁ lightest. Inverted: m₃ lightest, m₁ and m₂ above it. */
export function neutrinoMasses(mLightest: number, dm21: number, dm3l: number, ordering: 'normal' | 'inverted'): [number, number, number] {
  if (ordering === 'normal') {
    const m1 = mLightest;
    return [m1, Math.sqrt(m1 * m1 + dm21), Math.sqrt(m1 * m1 + dm3l)];
  }
  const m3 = mLightest;
  const m2 = Math.sqrt(m3 * m3 + dm3l); // |Δm²₃₂| = dm3l
  return [Math.sqrt(m2 * m2 - dm21), m2, m3];
}

/** Σ m_i in eV. */
export const sumOfMasses = (m: readonly number[]): number => m[0]! + m[1]! + m[2]!;

/** The effective electron-neutrino mass of beta decay, m_β = √(Σ |U_ei|² m_i²): what KATRIN measures. */
export function betaDecayMass(m: readonly number[], p: OscParams): number {
  const U = mixingSquared(pmns(p.theta12, p.theta13, p.theta23, p.deltaCP))[0]!;
  return Math.sqrt(U[0]! * m[0]! ** 2 + U[1]! * m[1]! ** 2 + U[2]! * m[2]! ** 2);
}

/** The effective Majorana mass of neutrinoless double-beta decay, |Σ U_ei² m_i| with Majorana phases α₂₁, α₃₁ (zero if the neutrino is a Dirac particle). */
export function majoranaMass(m: readonly number[], p: OscParams, alpha21: number, alpha31: number): number {
  const c13 = Math.cos(p.theta13), s13 = Math.sin(p.theta13);
  const c12 = Math.cos(p.theta12), s12 = Math.sin(p.theta12);
  // U_e1 = c12 c13; U_e2 = s12 c13 e^{iα21/2}; U_e3 = s13 e^{-iδ} e^{iα31/2}. Only |U|² and relative phases matter: Σ |U_ei|² m_i e^{i φ_i}.
  const t1 = { r: c12 * c12 * c13 * c13 * m[0]!, a: 0 };
  const t2 = { r: s12 * s12 * c13 * c13 * m[1]!, a: alpha21 };
  const t3 = { r: s13 * s13 * m[2]!, a: alpha31 - 2 * p.deltaCP };
  const re = t1.r + t2.r * Math.cos(t2.a) + t3.r * Math.cos(t3.a);
  const im = t2.r * Math.sin(t2.a) + t3.r * Math.sin(t3.a);
  return Math.hypot(re, im);
}

/** The smallest and largest |m_ββ| over all Majorana phases, for given masses. (Found by scanning the two phases on a grid.) */
export function majoranaRange(m: readonly number[], p: OscParams, steps = 72): { min: number; max: number } {
  let lo = Infinity, hi = 0;
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < steps; j++) {
      const v = majoranaMass(m, p, (2 * Math.PI * i) / steps, (2 * Math.PI * j) / steps);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  return { min: lo, max: hi };
}

/** The hook names registered by this module. */
export const HOOKS = ['oscillations.probability'] as const;
