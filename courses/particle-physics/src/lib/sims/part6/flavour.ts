/**
 * The numbers behind Chapter 24 (flavour): the CKM matrix and its unitarity triangle, the Jarlskog invariant, and the decay lengths of heavy-flavour hadrons.
 * The CKM matrix itself is `ckmMatrix` of `hep/sm`, built from the four Wolfenstein parameters of the PDG fit (λ = 0.22501, A = 0.826, ρ̄ = 0.159, η̄ = 0.348).
 */
import { ckmMatrix, WOLFENSTEIN, type Complex } from '$lib/hep/sm';
import { particle } from '$lib/hep/particles';
import { C_M_S } from '$lib/hep/units';

const cmul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const conj = (a: Complex): Complex => ({ re: a.re, im: -a.im });
const cabs = (a: Complex): number => Math.hypot(a.re, a.im);
const cdiv = (a: Complex, b: Complex): Complex => {
  const d = b.re * b.re + b.im * b.im;
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
};

export type Wolfenstein = typeof WOLFENSTEIN;

/**
 * The CKM matrix in the PDG's phase convention, V_ub = A λ³ (ρ − iη), so that J > 0 and the apex of the triangle lies above the axis.
 * (`hep/sm` used the opposite sign of the phase until this was fixed; this wrapper is kept for the exercises' sake.)
 */
export function pdgCkm(w: Wolfenstein = WOLFENSTEIN): Complex[][] {
  return ckmMatrix(w);
}
export const NAMES_UP = ['u', 'c', 't'] as const;
export const NAMES_DOWN = ['d', 's', 'b'] as const;

/** |V_ij| for the Wolfenstein parameters (rows u, c, t; columns d, s, b). */
export function ckmMagnitudes(w: Wolfenstein = WOLFENSTEIN): number[][] {
  return ckmMatrix(w).map((row) => row.map(cabs));
}

/** The Jarlskog invariant J = Im(V_us V_cb V_ub^* V_cs^*), the same for every choice of rows and columns; its absolute value is the measure of CP violation. */
export function jarlskog(w: Wolfenstein = WOLFENSTEIN): number {
  const V = pdgCkm(w);
  return cmul(cmul(V[0]![1]!, V[1]![2]!), cmul(conj(V[0]![2]!), conj(V[1]![1]!))).im;
}

export interface Triangle {
  /** Apex of the rescaled triangle, with vertices (0, 0), (1, 0), (ρ̄, η̄). */
  rhobar: number;
  etabar: number;
  /** Sides: R_u = |V_ud V_ub^* / (V_cd V_cb^*)| (from (0, 0) to the apex) and R_t = |V_td V_tb^* / (V_cd V_cb^*)| (from (1, 0)). */
  Ru: number;
  Rt: number;
  /** Angles in degrees. */
  alpha: number;
  beta: number;
  gamma: number;
}

const deg = (r: number) => (r * 180) / Math.PI;

/** The triangle from the apex (ρ̄, η̄). */
export function triangleFromApex(rhobar: number, etabar: number): Triangle {
  const Ru = Math.hypot(rhobar, etabar);
  const Rt = Math.hypot(1 - rhobar, etabar);
  const beta = deg(Math.atan2(etabar, 1 - rhobar));
  const gamma = deg(Math.atan2(etabar, rhobar));
  return { rhobar, etabar, Ru, Rt, alpha: 180 - beta - gamma, beta, gamma };
}

/** The apex from the two sides, as the intersection of the circle of radius R_u about (0, 0) and the circle of radius R_t about (1, 0); null if the circles do not meet (the sides cannot close a triangle). */
export function apexFromSides(Ru: number, Rt: number): { rhobar: number; etabar: number } | null {
  const rho = (1 + Ru * Ru - Rt * Rt) / 2;
  const e2 = Ru * Ru - rho * rho;
  if (e2 < 0) return null;
  return { rhobar: rho, etabar: Math.sqrt(e2) };
}

/** The triangle built from the matrix elements themselves: (ρ̄, η̄) = −(V_ud V_ub^*) / (V_cd V_cb^*). */
export function triangleFromMatrix(w: Wolfenstein = WOLFENSTEIN): Triangle {
  const V = pdgCkm(w);
  const a = cdiv(cmul(V[0]![0]!, conj(V[0]![2]!)), cmul(V[1]![0]!, conj(V[1]![2]!)));
  return triangleFromApex(-a.re, -a.im);
}

/** J = |V_cd V_cb|² η̄: twice the area of the unrescaled triangle. */
export function jarlskogFromTriangle(w: Wolfenstein = WOLFENSTEIN): number {
  const V = pdgCkm(w);
  const base = cabs(V[1]![0]!) * cabs(V[1]![2]!);
  return base * base * triangleFromMatrix(w).etabar;
}

// ── decay lengths ────────────────────────────────────────────────────────────────────────────────

export interface Flyer {
  pdg: number;
  label: string;
}
/** The hadrons whose flight matters for tagging (heavy flavour) and the long-lived light ones, by PDG code. */
export const FLYERS: Flyer[] = [
  { pdg: 511, label: 'B⁰' }, { pdg: 521, label: 'B⁺' }, { pdg: 531, label: 'B_s⁰' }, { pdg: 5122, label: 'Λ_b⁰' },
  { pdg: 421, label: 'D⁰' }, { pdg: 411, label: 'D⁺' }, { pdg: 431, label: 'D_s⁺' }, { pdg: 4122, label: 'Λ_c⁺' }, { pdg: 15, label: 'τ' },
  { pdg: 310, label: 'K_S⁰' }, { pdg: 3122, label: 'Λ' }, { pdg: 130, label: 'K_L⁰' }, { pdg: 321, label: 'K⁺' }, { pdg: 211, label: 'π⁺' }, { pdg: 13, label: 'μ' },
];

/** cτ in millimetres for a particle of the table. */
export function ctauMm(pdg: number): number {
  return particle(pdg).lifetime * C_M_S * 1000;
}

/** Mean decay length βγcτ in millimetres for momentum p (GeV). */
export function meanDecayLengthMm(pdg: number, p: number): number {
  const m = particle(pdg).mass;
  return (p / m) * ctauMm(pdg);
}

/** Probability that the particle is still undecayed after a flight of L mm. */
export function survival(pdg: number, p: number, Lmm: number): number {
  return Math.exp(-Lmm / meanDecayLengthMm(pdg, p));
}

/** Natural logarithm of the survival probability: usable when the probability underflows (a K_S after 17 m). */
export function logSurvival(pdg: number, p: number, Lmm: number): number {
  return -Lmm / meanDecayLengthMm(pdg, p);
}
