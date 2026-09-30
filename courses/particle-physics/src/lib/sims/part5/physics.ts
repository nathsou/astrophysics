/**
 * Small pieces of physics shared by the Part V widgets and their tests (Chapters 19–21). Everything here is either a textbook
 * formula or a thin wrapper round `hep/machine`; the tests check the numbers quoted in the chapters against it.
 */
import { GEV_PER_TESLA_METRE, betaOf } from '../../hep/machine/index.ts';

export const M_P = 0.9382720813; // GeV
export const M_E = 0.000510998950; // GeV
export const C = 299792458; // m/s

/** Lorentz factor of a particle of kinetic energy T (GeV) and mass m (GeV). */
export const gammaFromT = (T: number, m = M_P): number => 1 + T / m;
/** Speed β from the Lorentz factor. */
export const betaFromGamma = (g: number): number => Math.sqrt(1 - 1 / (g * g));
/** Speed β of a proton of kinetic energy T (GeV). */
export const betaFromT = (T: number, m = M_P): number => betaFromGamma(gammaFromT(T, m));

/** The cyclotron frequency (Hz) of a particle of charge q (units of e), mass m (GeV) and Lorentz factor γ in a field B (T): f = qB c²/(2π γ m). */
export function cyclotronFrequency(B_T: number, m = M_P, gamma = 1, q = 1): number {
  // qB/(γ m) with m in kg: m_kg = m[GeV] · 1e9 · e / c²  ⇒  f = q B c² / (2π γ m[GeV] 1e9 · e/e...) simplifies to q B c² /(2π γ m[eV])
  return (q * B_T * C * C) / (2 * Math.PI * gamma * m * 1e9);
}

/** Length (m) of the n-th drift tube of a Widerøe/Alvarez linac for speed β and RF frequency f: the particle must cross it in half an RF period, L = βc/(2f) = βλ/2. */
export const driftTubeLength = (beta: number, fHz: number): number => (beta * C) / (2 * fHz);

export interface LinacStep {
  /** Number of the gap just crossed (1-based). */
  n: number;
  /** Kinetic energy after the gap (GeV). */
  T: number;
  beta: number;
  /** Length of the drift tube that follows (m). */
  tubeLength: number;
  /** Distance from the first gap to the centre of this tube's far end (m): the running length of the machine. */
  position: number;
}
/** Steps through a Widerøe-type linac: every gap adds `gain` (GeV) to the kinetic energy; the tube after gap n is βₙλ/2 long (gaps themselves take no space). */
export function linacLadder(T0: number, gain: number, fHz: number, nGaps: number, m = M_P): LinacStep[] {
  const out: LinacStep[] = [];
  let T = T0;
  let pos = 0;
  for (let n = 1; n <= nGaps; n++) {
    T += gain;
    const beta = betaFromT(T, m);
    const L = driftTubeLength(beta, fHz);
    pos += L;
    out.push({ n, T, beta, tubeLength: L, position: pos });
  }
  return out;
}
/** The length (m) and number of gaps needed to reach a target kinetic energy, for a constant gain per gap. */
export function linacToEnergy(T0: number, T1: number, gain: number, fHz: number, m = M_P): { gaps: number; length: number } {
  const gaps = Math.max(0, Math.ceil((T1 - T0) / gain));
  let length = 0;
  let T = T0;
  for (let i = 0; i < gaps; i++) {
    T += gain;
    length += driftTubeLength(betaFromT(T, m), fHz);
  }
  return { gaps, length };
}

export type CyclotronMode = 'fixed' | 'isochronous' | 'modulated';
export interface CyclotronRun {
  /** Kinetic energy (GeV) after turn i. */
  T: number[];
  /** RF phase of the particle at its gap crossing, in degrees from the crest, wrapped to (−180, 180]. */
  phase: number[];
  maxT: number;
  /** The turn at which the maximum was first reached. */
  turnOfMax: number;
  /** Whether the particle kept gaining energy to the end (true) or was left behind by the RF (false). */
  captured: boolean;
}

const wrapDeg = (d: number): number => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};

/**
 * A toy cyclotron, one step per turn. The particle crosses the accelerating gap twice per turn, so it gains 2 e V cos φ per turn, where φ
 * is its RF phase measured from the crest. The RF period is fixed to the cyclotron period of a slow particle; a heavier (faster) one arrives
 * late by 2π(γ − 1) of RF phase per turn, unless the magnet is shaped to keep the revolution time constant ('isochronous') or the RF frequency
 * is lowered in step with the synchronous particle's γ ('modulated', a synchrocyclotron; synchronous phase 30° after the crest).
 * The real machines differ in detail (vertical focusing, many gap crossings at several phases); this keeps the one effect that matters.
 */
export function runCyclotron(mode: CyclotronMode, voltageV: number, phi0Deg: number, nTurns: number, maxT = 0.6, m = M_P): CyclotronRun {
  const gainPerTurn = (phiDeg: number): number => (2 * voltageV * 1e-9 * Math.cos((phiDeg * Math.PI) / 180));
  const T: number[] = [];
  const phase: number[] = [];
  let g = 1;
  let phi = phi0Deg;
  const phiS = 30;
  let gs = 1; // the synchronous particle of the modulated mode
  let best = 0;
  let bestTurn = 0;
  for (let i = 0; i < nTurns; i++) {
    const dT = gainPerTurn(phi);
    g += dT / m;
    let slip: number;
    if (mode === 'fixed') slip = 360 * (g - 1);
    else if (mode === 'isochronous') slip = 0;
    else {
      gs += gainPerTurn(phiS) / m;
      slip = 360 * (g / gs - 1);
    }
    phi = wrapDeg(phi + slip);
    const t = (g - 1) * m;
    T.push(t);
    phase.push(phi);
    if (t > best) {
      best = t;
      bestTurn = i;
    }
    if (t >= maxT) break;
  }
  const last = T[T.length - 1] ?? 0;
  return { T, phase, maxT: best, turnOfMax: bestTurn, captured: last >= best * 0.999 && (mode !== 'fixed' || last >= maxT) };
}

/** The rigidity Bρ (T·m) of a proton of kinetic energy T (GeV). */
export function rigidityOfT(T: number, m = M_P): number {
  const p = Math.sqrt(T * (T + 2 * m));
  return p / GEV_PER_TESLA_METRE;
}
export { betaOf };

/** Total energy (GeV) and Lorentz factor from a momentum p (GeV/c) or a kinetic energy T (GeV). */
export const fromMomentum = (p: number, m = M_P): { E: number; gamma: number; T: number } => {
  const E = Math.hypot(p, m);
  return { E, gamma: E / m, T: E - m };
};
export const fromKinetic = (T: number, m = M_P): { E: number; gamma: number; p: number } => {
  const E = T + m;
  return { E, gamma: E / m, p: Math.sqrt(E * E - m * m) };
};
