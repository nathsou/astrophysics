/**
 * Helpers for Chapter 6: energy-loss curves, ranges, the critical energy and the shape of showers, built on
 * `hep/detector` (Bethe–Bloch, the material table, the gamma-distribution shower profiles).
 */
import { bethe, materials, criticalEnergy, hadronShape, longitudinalFraction, longitudinalProfile, muonRange, showerShape, gammaP, lnGamma, type Material } from '../../hep/detector/index.ts';

export interface Species {
  id: 'e' | 'mu' | 'pi' | 'K' | 'p';
  label: string;
  /** Mass in GeV. */
  mass: number;
}

/** The charged particles of the chapter; masses from the PDG, rounded. */
export const SPECIES: Species[] = [
  { id: 'e', label: 'electron', mass: 0.00051099895 },
  { id: 'mu', label: 'muon', mass: 0.1056583755 },
  { id: 'pi', label: 'pion', mass: 0.13957039 },
  { id: 'K', label: 'kaon', mass: 0.493677 },
  { id: 'p', label: 'proton', mass: 0.938272088 },
];

export const MATERIAL_KEYS = ['Si', 'Fe', 'Cu', 'Pb', 'H2O'] as const;
export type MaterialKey = (typeof MATERIAL_KEYS)[number];

/** Mean collision stopping power −dE/dx in MeV cm²/g for a singly charged particle with βγ. */
export function stoppingPower(material: Material | string, mass: number, betaGamma: number, densityCorrection = true): number {
  return bethe({ material, betaGamma, mass, densityCorrection });
}

/** The minimum of the stopping-power curve: its value (MeV cm²/g) and the βγ where it is reached. */
export function minimumIonisation(material: Material | string, mass = 0.1056583755): { value: number; betaGamma: number } {
  let best = Infinity, bg = 0;
  for (let l = 0; l < 1.5; l += 0.005) {
    const b = 10 ** l;
    const v = bethe({ material, betaGamma: b, mass });
    if (v < best) {
      best = v;
      bg = b;
    }
  }
  return { value: best, betaGamma: bg };
}

/**
 * The continuous-slowing-down range (g/cm²) of a heavy charged particle (a muon, pion, kaon or proton) of kinetic
 * energy T (GeV) in a material: the integral of dT / S(T), from βγ = 0.03 (below where Bethe's formula applies) up to T,
 * plus the small remainder estimated as T0/(2 S(T0)) (S ∝ 1/T at low velocity). Radiative losses are not included,
 * so it is for energies below the muon's critical energy.
 */
export function csdaRange(material: Material | string, mass: number, T: number): number {
  const T0 = mass * (Math.sqrt(1 + 0.03 * 0.03) - 1);
  if (T <= T0) return 0;
  const S = (t: number) => bethe({ material, betaGamma: Math.sqrt((1 + t / mass) ** 2 - 1), mass }) * 1e-3; // GeV cm²/g
  const n = 600;
  const l0 = Math.log(T0), l1 = Math.log(T);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const t = Math.exp(l0 + ((l1 - l0) * (i + 0.5)) / n);
    sum += (t / S(t)) * ((l1 - l0) / n);
  }
  return sum + T0 / (2 * S(T0));
}

/** The range in cm: the library's muon range (with radiative losses) for muons, the CSDA integral otherwise. */
export function rangeCm(material: Material | string, species: Species, p: number): number {
  const m = typeof material === 'string' ? materials[material]! : material;
  if (species.id === 'mu') return muonRange(m, p);
  const T = Math.sqrt(p * p + species.mass * species.mass) - species.mass;
  return csdaRange(m, species.mass, T) / m.density;
}

/** βγ = p/m. */
export const betaGammaOf = (p: number, mass: number): number => p / mass;

/**
 * Electron energy loss per radiation length by ionisation and by radiation, in MeV, as a function of the electron's
 * total energy E (MeV): ionisation X0·(dE/dx)_coll and bremsstrahlung E. Rossi's critical energy is where they are equal.
 */
export function electronLossPerX0(material: Material | string, EMeV: number): { ionisation: number; radiation: number } {
  const m = typeof material === 'string' ? materials[material]! : material;
  const g = EMeV / 0.51099895;
  const bg = Math.sqrt(Math.max(g * g - 1, 1e-12));
  return { ionisation: bethe({ material: m, betaGamma: bg, mass: 0.00051099895 }) * m.X0, radiation: EMeV };
}

/** The energy (MeV) at which ionisation loss per radiation length equals the electron's energy (Rossi's definition). */
export function rossiCriticalEnergy(material: Material | string): number {
  let lo = 1, hi = 1000;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    const l = electronLossPerX0(material, mid);
    if (l.ionisation > l.radiation) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// ── showers ──

/** The depth (in X0) at which a fraction `frac` of an electromagnetic shower's energy is contained. */
export function emContainmentDepth(E0: number, Ec: number, frac: number, kind: 'electron' | 'photon' = 'electron'): number {
  let lo = 0, hi = 200;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (longitudinalFraction(E0, Ec, 0, mid, kind) < frac) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

/** The depth of the shower maximum in X0 from the gamma-distribution parametrisation: ln(E0/Ec) − 0.5 for an electron, + 0.5 for a photon. */
export function emShowerMax(E0: number, Ec: number, kind: 'electron' | 'photon' = 'electron'): number {
  return showerShape(E0, Ec, kind).tMax;
}

/** dE/dl in GeV per interaction length at depth l (in λI) for a hadronic shower of energy E, the gamma-distribution shape of the detector module. */
export function hadronProfile(E: number, l: number): number {
  if (l <= 0) return 0;
  const { a, s } = hadronShape(E);
  return E * Math.exp((a - 1) * Math.log(l / s) - l / s - lnGamma(a) - Math.log(s));
}

/** The fraction of a hadronic shower's energy deposited between l0 and l1 (in λI). */
export function hadronFraction(E: number, l0: number, l1: number): number {
  const { a, s } = hadronShape(E);
  return gammaP(a, Math.max(0, l1) / s) - gammaP(a, Math.max(0, l0) / s);
}

/** The depth (in λI) containing a fraction `frac` of a hadronic shower that starts at depth 0. */
export function hadronContainmentDepth(E: number, frac: number): number {
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (hadronFraction(E, 0, mid) < frac) lo = mid;
    else hi = mid;
  }
  return 0.5 * (lo + hi);
}

export { criticalEnergy, longitudinalProfile, materials };
