/**
 * Simplified initial-state radiation: backward evolution of the two incoming partons with the Sudakov veto algorithm,
 * emitting gluons and recoiling the whole hard system against them. See README.md for the approximations.
 *
 * Kinematics (light-cone components v± = E ± pz, beam along ±z). The incoming partons are a (moving along +z, momentum
 * A⁺) and b (along −z, momentum B⁻). The hard system (every particle that is not a beam or incoming parton) has
 * total P = A + B − Σk with fixed invariant mass m. An emission from leg a with momentum fraction z (the parton entering
 * the hard process keeps z of the momentum of the one that came from the proton) and transverse momentum kT is
 *   A⁺ → A⁺/z,  k⁺ = A⁺(1 − z)/z,  k⁻ = kT²/k⁺,  P⁺ unchanged,  P_T → P_T − kT,  P⁻ = (m² + P_T²)/P⁺,  B⁻ = P⁻ + ΣK⁻,
 * so b gives up (or rather, receives) whatever longitudinal momentum is needed to keep m fixed; leg b is symmetric. The
 * final incoming momenta and the Lorentz transformation of the hard system (the one that maps its original momentum
 * onto its final one, with the same mass) are applied once at the end, so ΣE and Σp of incoming partons equal those of
 * the outgoing gluons plus the hard system exactly. The proton remnants are not modelled: they supply or absorb the
 * momentum that the incoming partons gain or lose (A⁺ and B⁻ change).
 */
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { boost, type P4 } from '../kinematics/index.ts';
import type { Rng } from '../random/index.ts';
import { isIncoming, isPartonPdg, maxColour } from '../hadronise/colour.ts';
import type { ShowerOptions } from './fsr.ts';
import { alphaSOver, alphaSShower, B0_NF5, CA, CF, LAMBDA2, overestimateFactor } from './splitting.ts';

export interface IsrRecord {
  /** Truth index of the incoming parton that radiated. */
  leg: number;
  /** Truth index of the emitted gluon. */
  gluon: number;
  /** Fraction of the parent's momentum kept by the parton entering the hard process. */
  z: number;
  /** Transverse momentum of the gluon (GeV). */
  pT: number;
}

/**
 * The first ISR emission has pT ≤ Q/6 (Q = the hard scale: the hard system's mass, or `startScale`). With no matrix-element correction a
 * shower started higher over-populates the hard tail (a mean Z pT of 17 GeV at pT ≤ Q/2); Q/6 was chosen so that the mean pT of a Z made by
 * qq̄ at 13 TeV comes out near 9 GeV, as the course text requires (5–10 GeV). It is a tuning of this toy, not a derived number.
 */
export const ISR_PT_MAX_FRACTION = 1 / 6;

/** Squared ISR regularisation scale pT0² in GeV² (pT0 = 2 GeV, from memory of typical generator values, approximate). */
export const ISR_PT0_SQ = 4;

const records = new WeakMap<TruthEvent, IsrRecord[]>();
/** The ISR branchings recorded for this event object by `showerIsr` (empty if the event was copied or serialised). */
export function isrRecords(ev: TruthEvent): IsrRecord[] {
  return records.get(ev) ?? [];
}

/**
 * Toy parton-density ratio f(x/z)/(z f(x)) used in the backward evolution. A real generator evaluates the PDF; with
 * none here (the PDFs belong to `gen`) we use the shape f ∝ x⁻¹ (1 − x)^β, for which the ratio is ((1 − x/z)/(1 − x))^β,
 * with β = 4 for quarks and 5 for gluons. It is ≤ 1, vanishes at z = x and suppresses large x/z, as real PDFs do.
 * Not fitted to anything.
 */
function pdfRatio(z: number, x: number, isGluon: boolean): number {
  const beta = isGluon ? 5 : 4;
  const r = (1 - x / z) / (1 - x);
  return r <= 0 ? 0 : Math.pow(r, beta);
}

interface Leg {
  idx: number;
  isGluon: boolean;
  coloured: boolean;
  colour: [number, number];
}

export function showerIsr(ev: TruthEvent, rng: Rng, opts: ShowerOptions = {}): void {
  const ps = ev.particles;
  let ia = -1, ib = -1;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (!isIncoming(ev, p)) continue;
    const pt = Math.hypot(p.p.px, p.p.py);
    if (pt > 1e-6 * Math.max(1, p.p.E)) continue; // not collinear with the beam: leave the event alone
    if (p.p.pz > 0 && ia < 0) ia = i;
    else if (p.p.pz < 0 && ib < 0) ib = i;
  }
  if (ia < 0 || ib < 0) return;
  const pa = ps[ia]!, pb = ps[ib]!;
  const mkLeg = (i: number): Leg => {
    const p = ps[i]!;
    return { idx: i, isGluon: p.pdg === 21, coloured: isPartonPdg(p.pdg), colour: [p.colour?.[0] ?? 0, p.colour?.[1] ?? 0] };
  };
  const legs: [Leg, Leg] = [mkLeg(ia), mkLeg(ib)];
  if (!legs[0].coloured && !legs[1].coloured) return;
  const sqrtS = ev.sqrtS > 0 ? ev.sqrtS : pa.p.E + pb.p.E;
  // Initial light-cone state.
  let A = pa.p.E + pa.p.pz;
  let B = pb.p.E - pb.p.pz;
  const P0 = { E: pa.p.E + pb.p.E, px: pa.p.px + pb.p.px, py: pa.p.py + pb.p.py, pz: pa.p.pz + pb.p.pz };
  let Pp = P0.E + P0.pz, Pm = P0.E - P0.pz;
  const m2 = Pp * Pm;
  if (!(m2 > 0) || !(A > 0) || !(B > 0)) return;
  const tmin = Math.max(opts.cutoff ?? 1, 0.5) ** 2;
  const Q = opts.startScale ?? Math.sqrt(m2);
  let tcur = Math.min((Q * ISR_PT_MAX_FRACTION) ** 2, m2 / 4);
  if (!(tcur > tmin)) return;
  const fixed = opts.alphaSFixed;
  const K = fixed === undefined ? overestimateFactor() : 1;
  let Kp = 0, Km = 0, PTx = 0, PTy = 0;
  const emitted: { leg: 0 | 1; z: number; t: number; kx: number; ky: number; kp: number; km: number; col: [number, number] }[] = [];
  const colourNow: [number, number][] = [legs[0].colour, legs[1].colour];
  let nextCol = maxColour(ev) + 1;

  for (let guard = 0; guard < 2000; guard++) {
    // A trial scale for each leg; the larger one is processed.
    let bestT = 0, bestLeg = -1, bestZ = 0;
    const shat = A * B;
    for (let l = 0; l < 2; l++) {
      const leg = legs[l]!;
      if (!leg.coloured) continue;
      const plus = l === 0 ? A : B;
      const x = plus / sqrtS;
      const zlo = x;
      const zhi0 = 1 - tmin / shat;
      if (!(zhi0 > zlo) || zlo <= 0) continue;
      let R: number;
      const lw = Math.log(zhi0 / (1 - zhi0)), ll = Math.log(zlo / (1 - zlo));
      if (leg.isGluon) R = 2 * CA * (lw - ll);
      else R = 2 * CF * Math.log((1 - zlo) / (1 - zhi0));
      let t = tcur;
      let found = false;
      let zFound = 0;
      for (let trial = 0; trial < 10000; trial++) {
        const u = rng();
        if (fixed !== undefined) t *= Math.pow(u, (2 * Math.PI) / (R * fixed));
        else t = LAMBDA2 * Math.exp(Math.log(t / LAMBDA2) * Math.pow(u, (2 * Math.PI * B0_NF5) / (R * K)));
        if (!(t > tmin)) break;
        // ISR is regularised at low pT as in real generators: αs(pT² + pT0²) and a damping (pT²/(pT² + pT0²))² (pT0 from memory ~2 GeV).
        const damp = (t / (t + ISR_PT0_SQ)) ** 2;
        if (rng() > damp) continue;
        if (fixed === undefined && rng() * K * alphaSOver(t) > alphaSShower(t + ISR_PT0_SQ)) continue;
        let z: number;
        if (leg.isGluon) {
          const v = ll + (lw - ll) * rng();
          z = 1 / (1 + Math.exp(-v));
          const f = 1 - z * (1 - z);
          if (rng() > f * f) continue;
        } else {
          const w = (tmin / shat) * Math.exp(Math.log((1 - zlo) / (tmin / shat)) * rng());
          z = 1 - w;
          if (rng() * 2 > 1 + z * z) continue;
        }
        if (1 - z < t / shat) continue; // dipole rapidity range
        if (rng() > pdfRatio(z, x, leg.isGluon)) continue;
        zFound = z;
        found = true;
        break;
      }
      if (found && t > bestT) {
        bestT = t;
        bestLeg = l;
        bestZ = zFound;
      }
    }
    if (bestLeg < 0) break;
    // Build the emission and check the kinematics; a veto continues the evolution from this scale.
    const t = bestT, z = bestZ;
    tcur = t;
    const phi = 2 * Math.PI * rng();
    const kx = Math.sqrt(t) * Math.cos(phi), ky = Math.sqrt(t) * Math.sin(phi);
    let kp: number, km: number, nA = A, nB = B, nPp = Pp, nPm = Pm;
    const nPTx = PTx - kx, nPTy = PTy - ky;
    const PT2 = nPTx * nPTx + nPTy * nPTy;
    if (bestLeg === 0) {
      kp = (A * (1 - z)) / z;
      km = t / kp;
      nA = A / z;
      nPm = (m2 + PT2) / Pp;
      nB = nPm + (Km + km);
    } else {
      km = (B * (1 - z)) / z;
      kp = t / km;
      nB = B / z;
      nPp = (m2 + PT2) / Pm;
      nA = nPp + (Kp + kp);
    }
    if (!(nA <= sqrtS) || !(nB <= sqrtS) || !(nA > 0) || !(nB > 0) || !(nPp > 0) || !(nPm > 0)) continue;
    // Accept.
    A = nA; B = nB; Pp = nPp; Pm = nPm;
    Kp += kp; Km += km; PTx = nPTx; PTy = nPTy;
    // colour of the emitted gluon and of the beam-side parent
    const leg = legs[bestLeg]!;
    const cur = colourNow[bestLeg]!;
    const n = nextCol++;
    let gc: [number, number];
    if (!leg.coloured || (cur[0] === 0 && cur[1] === 0)) {
      gc = [n, nextCol++];
    } else if (cur[1] === 0) {
      gc = [n, cur[0]]; // quark: parent [n,0] → hard [c,0] + g[n,c]
      colourNow[bestLeg] = [n, 0];
    } else if (cur[0] === 0) {
      gc = [cur[1], n]; // antiquark
      colourNow[bestLeg] = [0, n];
    } else if (rng() < 0.5) {
      gc = [n, cur[0]]; // gluon: parent [n,a] → hard [c,a] + g[n,c]
      colourNow[bestLeg] = [n, cur[1]];
    } else {
      gc = [cur[1], n]; // parent [c,n] → hard [c,a] + g[a,n]
      colourNow[bestLeg] = [cur[0], n];
    }
    emitted.push({ leg: bestLeg as 0 | 1, z, t, kx, ky, kp, km, col: gc });
    if (!(tcur > tmin)) break;
  }
  if (emitted.length === 0) return;

  // Apply: incoming partons, hard system, gluons.
  const inA: P4 = { E: A / 2, px: 0, py: 0, pz: A / 2 };
  const inB: P4 = { E: B / 2, px: 0, py: 0, pz: -B / 2 };
  const Pf: P4 = { E: (Pp + Pm) / 2, px: PTx, py: PTy, pz: (Pp - Pm) / 2 };
  const b0 = [-P0.px / P0.E, -P0.py / P0.E, -P0.pz / P0.E] as const;
  const b1 = [Pf.px / Pf.E, Pf.py / Pf.E, Pf.pz / Pf.E] as const;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (i === ia || i === ib || p.status === 'beam') continue;
    if (p.collision !== undefined && p.collision !== 0) continue;
    const r = boost(p.p, b0[0], b0[1], b0[2]);
    p.p = boost(r, b1[0], b1[1], b1[2]);
  }
  pa.p = inA;
  pb.p = inB;
  const recs: IsrRecord[] = [];
  for (const e of emitted) {
    const leg = legs[e.leg]!;
    const inc = ps[leg.idx]!;
    const g: TruthParticle = {
      id: ps.length,
      pdg: 21,
      p: { E: (e.kp + e.km) / 2, px: e.kx, py: e.ky, pz: (e.kp - e.km) / 2 },
      vertex: [inc.vertex[0], inc.vertex[1], inc.vertex[2]],
      status: 'final',
      mothers: [leg.idx],
      daughters: [],
      colour: e.col,
    };
    if (inc.collision !== undefined) g.collision = inc.collision;
    ps.push(g);
    inc.daughters.push(g.id);
    recs.push({ leg: leg.idx, gluon: g.id, z: e.z, pT: Math.sqrt(e.t) });
  }
  const prev = records.get(ev) ?? [];
  records.set(ev, prev.concat(recs));
}
