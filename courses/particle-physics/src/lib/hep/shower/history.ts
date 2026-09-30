/**
 * The shower tree of a showered event: the list of branchings, for drawing it.
 */
import type { TruthEvent } from '../event/index.ts';
import { isPartonPdg } from '../hadronise/colour.ts';
import { isrRecords } from './isr.ts';

export type BranchingKind = 'q->qg' | 'g->gg' | 'g->qq' | 'isr';

export interface Branching {
  /** Truth index of the parent. */
  parent: number;
  /** Truth indices of the daughters; `daughters[0]` is the one whose energy fraction is `z` (the quark in q → qg and g → qq̄). For ISR, the emitted gluon only. */
  daughters: number[];
  /** Energy fraction of the first daughter (final state); for ISR, the fraction of the parent's momentum kept by the parton entering the hard process. */
  z: number;
  /** Transverse momentum of the branching in GeV: of the daughters relative to the parent's direction (final state), or of the gluon relative to the beam (ISR). */
  pT: number;
  kind: BranchingKind;
  isr: boolean;
}

/**
 * The branchings of the final-state shower, reconstructed from the event record (every coloured parton with status
 * 'intermediate' and exactly two coloured daughters whose mother it is), followed by the initial-state emissions recorded
 * for this event object. z and pT are computed from the stored momenta, so they include the small effect of the final
 * rescaling; in a serialised copy the ISR entries are absent.
 */
export function showerHistory(ev: TruthEvent): Branching[] {
  const out: Branching[] = [];
  const ps = ev.particles;
  for (const p of ps) {
    if (p.status !== 'intermediate' || p.daughters.length !== 2 || !isPartonPdg(p.pdg)) continue;
    const a = ps[p.daughters[0]!]!, b = ps[p.daughters[1]!]!;
    if (!isPartonPdg(a.pdg) || !isPartonPdg(b.pdg) || !a.mothers.includes(p.id) || !b.mothers.includes(p.id)) continue;
    let first = a, second = b;
    let kind: BranchingKind;
    if (a.pdg === 21 && b.pdg === 21) kind = 'g->gg';
    else if (p.pdg !== 21 && (a.pdg === p.pdg) !== (b.pdg === p.pdg)) {
      kind = 'q->qg';
      if (a.pdg !== p.pdg) [first, second] = [b, a];
    } else if (p.pdg === 21 && a.pdg === -b.pdg && a.pdg !== 21) {
      kind = 'g->qq';
      if (a.pdg < 0) [first, second] = [b, a];
    } else continue;
    const tot = { px: first.p.px + second.p.px, py: first.p.py + second.p.py, pz: first.p.pz + second.p.pz };
    const pm = Math.hypot(tot.px, tot.py, tot.pz);
    const cx = first.p.py * tot.pz - first.p.pz * tot.py;
    const cy = first.p.pz * tot.px - first.p.px * tot.pz;
    const cz = first.p.px * tot.py - first.p.py * tot.px;
    out.push({
      parent: p.id,
      daughters: [first.id, second.id],
      z: first.p.E / (first.p.E + second.p.E),
      pT: pm > 0 ? Math.hypot(cx, cy, cz) / pm : 0,
      kind,
      isr: false,
    });
  }
  for (const r of isrRecords(ev)) out.push({ parent: r.leg, daughters: [r.gluon], z: r.z, pT: r.pT, kind: 'isr', isr: true });
  return out;
}
