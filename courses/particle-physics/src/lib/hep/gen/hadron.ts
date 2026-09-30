/**
 * Shared machinery for hadron-collider processes: parton densities for both beams, the incoming-parton part of the truth
 * record, colour tags and the mapping of a resonance-plus-continuum mass spectrum.
 *
 * Coupling and scale conventions for the hard processes (leading order, so the choices matter and are stated):
 *  - parton densities and αs are evaluated at the hard scale of the process (the pair mass for Drell–Yan and W, pT for
 *    2 → 2 scattering, mt for tt̄, mH for gg → H) and αs runs at one loop like the parton evolution, αs(mZ) = 0.118;
 *  - the electroweak part uses α(m) running for the photon and the G_F scheme for W and Z.
 */
import type { TruthEvent } from '../event/index.ts';
import type { P4 } from '../kinematics/index.ts';
import { pdfAll, slotOf } from './pdf.ts';
import { type Beams, addBeams, addParticle } from './process.ts';
import { type Mapping, breitWignerMap, mixMap, powerMap } from './integrate.ts';

/** Number of entries `pdfAll` fills. */
export const NPDF = 8;

/** x·f of parton `pdg` from a `pdfAll` table, for a proton beam or (anti = true) an antiproton beam. */
export function density(table: Float64Array, pdg: number, anti: boolean): number {
  return table[slotOf(anti && pdg !== 21 ? -pdg : pdg)]!;
}
export { pdfAll };

/** Tags for the colour flow (Les Houches style), counted from 101 per event. */
export class ColourTags {
  private n = 100;
  next(): number {
    return ++this.n;
  }
}

/**
 * Add the beams and the two incoming partons (x₁, x₂ of the beam energies) to the record. Returns the indices of the two partons.
 * `colA`, `colB` are the colour tags of the partons ([colour, anticolour]); incoming quarks carry a colour, antiquarks an anticolour.
 */
export function addBeamsAndPartons(
  ev: TruthEvent,
  beams: Beams,
  sqrtS: number,
  pdgA: number,
  pdgB: number,
  x1: number,
  x2: number,
  colA?: [number, number],
  colB?: [number, number],
): [number, number] {
  const [b1, b2] = addBeams(ev, beams, sqrtS);
  const E1 = (x1 * sqrtS) / 2, E2 = (x2 * sqrtS) / 2;
  const pa: P4 = { E: E1, px: 0, py: 0, pz: E1 };
  const pb: P4 = { E: E2, px: 0, py: 0, pz: -E2 };
  const ia = addParticle(ev, pdgA, pa, 'hard', [b1], colA ? { colour: colA } : undefined);
  const ib = addParticle(ev, pdgB, pb, 'hard', [b2], colB ? { colour: colB } : undefined);
  return [ia, ib];
}

/** Colour of an incoming quark, antiquark or gluon given tags. */
export function quarkColour(pdg: number, tag: number): [number, number] {
  return pdg > 0 ? [tag, 0] : [0, tag];
}

/**
 * Mapping for a squared-mass spectrum on [m2Lo, m2Hi] with resonances at (M, Γ) and a continuum: a mixture of one
 * Breit–Wigner per resonance inside the range (weight `weight`, default 1) and two power laws 1/m² and 1/m⁴ (total weight
 * `continuum`), which together follow a Drell–Yan spectrum within a factor of a few and let VEGAS do the rest.
 */
export function massMap(m2Lo: number, m2Hi: number, peaks: { M: number; Gamma: number; weight?: number }[], continuum = 0.5): Mapping {
  const ch: { map: Mapping; weight: number }[] = [];
  for (const p of peaks) if (p.M * p.M > m2Lo && p.M * p.M < m2Hi) ch.push({ map: breitWignerMap(p.M, p.Gamma, m2Lo, m2Hi), weight: p.weight ?? 1 });
  const nPeak = ch.length;
  const wPeak = ch.reduce((s, c) => s + c.weight, 0);
  // the continuum channels carry `continuum` of the total weight
  const wCont = nPeak === 0 ? 1 : (wPeak * continuum) / (1 - continuum);
  ch.push({ map: powerMap(1, m2Lo, m2Hi), weight: wCont * 0.5 });
  ch.push({ map: powerMap(2, m2Lo, m2Hi), weight: wCont * 0.5 });
  return mixMap(ch);
}
