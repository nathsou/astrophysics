/**
 * Production thresholds (Chapter 9), computed with `hep/kinematics`.
 *
 * A reaction a + b → (final masses) can happen when the centre-of-mass energy √s is at least the sum of the final masses. With a
 * beam of total energy E on a stationary target, s = m_a² + m_b² + 2 E m_b; two equal beams colliding head-on give s = 4E².
 */
import { fromMass, mandelstamS } from '../../hep/kinematics/index.ts';
import { particle } from '../../hep/particles/index.ts';

/** √s of a beam of kinetic energy T (GeV) on a stationary target. */
export function sqrtSFixedTarget(mBeam: number, mTarget: number, T: number): number {
  const E = mBeam + T;
  const pz = Math.sqrt(Math.max(0, E * E - mBeam * mBeam));
  const a = { E, px: 0, py: 0, pz };
  const b = fromMass(mTarget, 0, 0, 0);
  return Math.sqrt(mandelstamS(a, b));
}

/** Smallest kinetic energy (GeV) of the beam particle on a stationary target for √s to reach the sum of the final masses. */
export function thresholdKineticFixedTarget(mBeam: number, mTarget: number, finalMass: number): number {
  const s = finalMass * finalMass;
  const E = (s - mBeam * mBeam - mTarget * mTarget) / (2 * mTarget);
  return Math.max(0, E - mBeam);
}

/** Two equal, opposite beams: the kinetic energy of each beam (GeV) at threshold. */
export function thresholdKineticCollider(mBeam: number, finalMass: number): number {
  return Math.max(0, finalMass / 2 - mBeam);
}

/** p p → p p p p̄ on a stationary proton: T = 6 m_p. */
export function antiprotonThreshold() {
  const mp = particle(2212).mass;
  const final = 4 * mp;
  return {
    mp,
    fixedTargetKinetic: thresholdKineticFixedTarget(mp, mp, final),
    colliderKineticEach: thresholdKineticCollider(mp, final),
    /** Total beam kinetic energy that a collider needs (both beams). */
    colliderKineticTotal: 2 * thresholdKineticCollider(mp, final),
  };
}

/** The photon energy needed to make e⁺e⁻ in the field of a nucleus of mass M (GeV): 2 m_e (1 + m_e/M). */
export function pairThresholdNucleus(M: number): number {
  const me = particle(11).mass;
  return 2 * me * (1 + me / M);
}
/** The same on a free electron (triplet production, γ e⁻ → e⁻ e⁺ e⁻): 4 m_e. */
export const pairThresholdElectron = (): number => 4 * particle(11).mass;

export interface Reaction {
  id: string;
  label: string;
  /** Beam and target masses (GeV), the final masses (GeV); the beam may be massless (a photon). */
  beam: number;
  target: number;
  finals: number[];
  note: string;
}

const me = particle(11).mass, mp = particle(2212).mass, mmu = particle(13).mass;
export const REACTIONS: Reaction[] = [
  { id: 'pair-nucleus', label: 'γ + nucleus → e⁺ e⁻ + nucleus (lead, A = 208)', beam: 0, target: 207.2 * 0.9314941, finals: [me, me, 207.2 * 0.9314941], note: 'A photon of 1.022 MeV or more can make an electron and a positron in the field of a heavy nucleus, which takes the recoil.' },
  { id: 'pair-electron', label: 'γ + e⁻ → e⁻ e⁺ e⁻', beam: 0, target: me, finals: [me, me, me], note: 'On a free electron the recoil costs more: the threshold is 4 m_e, not 2.' },
  { id: 'antiproton', label: 'p + p → p p p p̄', beam: mp, target: mp, finals: [mp, mp, mp, mp], note: 'Baryon number forces a proton–antiproton pair: four proton masses in the final state.' },
  { id: 'muons', label: 'e⁺ e⁻ → μ⁺ μ⁻', beam: me, target: me, finals: [mmu, mmu], note: 'A collider makes muon pairs at √s = 2 m_μ, with each beam at 106 MeV.' },
];
