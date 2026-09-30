/**
 * Colour bookkeeping shared by the shower and the hadronisation: which partons are outgoing, and how the colour
 * labels connect them into chains (the strings of the Lund model).
 *
 * A quark has labels [c, 0], an antiquark [0, a], a gluon [c, a]. The colour line of parton i continues in the
 * parton whose *anti*colour carries the same label, so a colour-singlet system reads
 * q[1,0] → g[2,1] → g[3,2] → q̄[0,3].
 */
import type { TruthEvent, TruthParticle } from '../event/index.ts';
/** Quarks u … b (either sign) and gluons. */
export const isPartonPdg = (pdg: number): boolean => (Math.abs(pdg) >= 1 && Math.abs(pdg) <= 5) || pdg === 21;

/** An incoming parton of the hard process: status 'hard' with only beam particles as mothers. */
export function isIncoming(ev: TruthEvent, p: TruthParticle): boolean {
  if (p.status !== 'hard' || p.mothers.length === 0) return false;
  for (const m of p.mothers) if (ev.particles[m]?.status !== 'beam') return false;
  return true;
}

/**
 * Indices of the outgoing coloured partons the shower and the hadronisation act on: quarks (u … b) and gluons with
 * status 'final', or status 'hard' with no daughters that are not incoming. The top quark is never included: it decays
 * first (`decayHeavy`).
 */
export function outgoingPartons(ev: TruthEvent): number[] {
  const out: number[] = [];
  const ps = ev.particles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]!;
    if (!isPartonPdg(p.pdg)) continue;
    if (p.status === 'final' || (p.status === 'hard' && p.daughters.length === 0 && !isIncoming(ev, p))) out.push(i);
  }
  return out;
}

/** The largest colour label in use in the event (0 if none). */
export function maxColour(ev: TruthEvent): number {
  let mx = 0;
  for (const p of ev.particles) if (p.colour) mx = Math.max(mx, p.colour[0], p.colour[1]);
  return mx;
}

/**
 * If any of the given partons lacks colour labels, assign a plausible colour flow to all of them: the k-th quark is
 * tied to the k-th antiquark, all gluons sit in the first such chain ordered by rapidity; with no quarks the gluons
 * form one ring. Returns true if labels were (re)assigned. The labels are written into the event.
 */
export function ensureColour(ev: TruthEvent, idx: readonly number[]): boolean {
  let missing = false;
  for (const i of idx) {
    const c = ev.particles[i]!.colour;
    if (!c || (c[0] === 0 && c[1] === 0)) {
      missing = true;
      break;
    }
  }
  if (!missing) return false;
  let next = maxColour(ev) + 1;
  const q: number[] = [];
  const qb: number[] = [];
  const g: number[] = [];
  for (const i of idx) {
    const p = ev.particles[i]!;
    if (p.pdg === 21) g.push(i);
    else if (p.pdg > 0) q.push(i);
    else qb.push(i);
  }
  const rap = (i: number) => {
    const p = ev.particles[i]!.p;
    return Math.atan2(p.pz, Math.hypot(p.px, p.py));
  };
  g.sort((a, b) => rap(b) - rap(a));
  const chain = (qi: number, gl: number[], qbi: number) => {
    let prev = next++;
    ev.particles[qi]!.colour = [prev, 0];
    for (const i of gl) {
      const nc = next++;
      ev.particles[i]!.colour = [nc, prev];
      prev = nc;
    }
    ev.particles[qbi]!.colour = [0, prev];
  };
  const pairs = Math.min(q.length, qb.length);
  if (pairs === 0) {
    // gluons only (or unmatched quarks): a ring of gluons, quarks left open
    if (g.length > 0) {
      const c0 = next;
      next += g.length;
      g.forEach((i, k) => {
        ev.particles[i]!.colour = [c0 + k, c0 + ((k + g.length - 1) % g.length)];
      });
    }
    for (const i of q) ev.particles[i]!.colour = [next++, 0];
    for (const i of qb) ev.particles[i]!.colour = [0, next++];
    return true;
  }
  for (let k = 0; k < pairs; k++) chain(q[k]!, k === 0 ? g : [], qb[k]!);
  for (const i of q.slice(pairs)) ev.particles[i]!.colour = [next++, 0];
  for (const i of qb.slice(pairs)) ev.particles[i]!.colour = [0, next++];
  return true;
}

export interface Chain {
  /** Truth indices in colour order. */
  idx: number[];
  /** A closed ring of gluons (no quark ends). */
  ring: boolean;
  /** The first parton's anticolour line is not matched by any parton in the list (it runs to an incoming parton or a remnant). */
  startOpen: boolean;
  /** The last parton's colour line is unmatched. */
  endOpen: boolean;
}

/** Follow the colour labels of the listed partons into chains. Every listed parton appears in exactly one chain. */
export function buildChains(ev: TruthEvent, idx: readonly number[]): Chain[] {
  const colourOwner = new Map<number, number>(); // label → parton that has it as colour
  const antiOwner = new Map<number, number>(); // label → parton that has it as anticolour
  for (const i of idx) {
    const c = ev.particles[i]!.colour;
    if (!c) continue;
    if (c[0] !== 0) colourOwner.set(c[0], i);
    if (c[1] !== 0) antiOwner.set(c[1], i);
  }
  const visited = new Set<number>();
  const chains: Chain[] = [];
  const next = (i: number): number | undefined => {
    const c = ev.particles[i]!.colour;
    return c && c[0] !== 0 ? antiOwner.get(c[0]) : undefined;
  };
  const hasPrev = (i: number): boolean => {
    const c = ev.particles[i]!.colour;
    return !!c && c[1] !== 0 && colourOwner.has(c[1]);
  };
  const follow = (start: number): number[] => {
    const seq: number[] = [];
    let cur: number | undefined = start;
    while (cur !== undefined && !visited.has(cur)) {
      visited.add(cur);
      seq.push(cur);
      cur = next(cur);
    }
    return seq;
  };
  for (const i of idx) {
    if (visited.has(i) || hasPrev(i)) continue;
    const seq = follow(i);
    const first = ev.particles[seq[0]!]!.colour;
    const last = ev.particles[seq[seq.length - 1]!]!.colour;
    chains.push({ idx: seq, ring: false, startOpen: !!first && first[1] !== 0, endOpen: !!last && last[0] !== 0 });
  }
  for (const i of idx) {
    if (visited.has(i)) continue;
    const seq = follow(i); // what remains are rings
    chains.push({ idx: seq, ring: true, startOpen: false, endOpen: false });
  }
  return chains;
}
