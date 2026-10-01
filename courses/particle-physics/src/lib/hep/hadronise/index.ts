/**
 * Hadronisation: a toy Lund string model. Colour-connected partons are turned into strings, every string is broken
 * into hadrons in its rest frame, and the hadron momenta are rescaled so that each string system keeps exactly the
 * four-momentum of its partons. See README.md for the algorithm, the parameter values and the simplifications.
 */
import type { TruthEvent, TruthParticle } from '../event/index.ts';
import { boost, mass, toRestFrame, type P4 } from '../kinematics/index.ts';
import type { Rng } from '../random/index.ts';
import { rescaleToTarget } from '../shower/rescale.ts';
import { buildChains, ensureColour, outgoingPartons, type Chain } from './colour.ts';
import { lightestMass, pickLight } from './flavour.ts';
import { defaultLund, fragmentString, snapshotOf, type LundParams, type StringFragmentation, type StringSnapshot } from './lund.ts';

export {
  stringTension, stringBreaking, simulateString, fragmentString, sampleLundZ, samplePeterson, snapshotOf, defaultLund,
  type StringBreakingResult, type StringBreakingOptions, type StringSnapshot, type StringBreakPoint, type LundParams, type FragHadron, type StringFragmentation,
} from './lund.ts';
export { hadronFor, candidates, lightestMass, defaultFlavour, type FlavourParams } from './flavour.ts';
export { outgoingPartons, buildChains, type Chain } from './colour.ts';

export interface HadroniseOptions extends Partial<LundParams> {
  /**
   * Energy (GeV) given to each beam-remnant stand-in: a colour line that runs to an incoming parton (not to another outgoing
   * parton) is closed on a massless pseudo-parton along the beam with this energy, so the string has a mass. The hadrons then
   * carry this extra energy (see README: not exactly conserved for such open strings). Default 0.25.
   */
  remnantEnergy?: number;
  /** Called at the end with a summary (for tests and diagnostics). */
  onReport?: (r: HadroniseReport) => void;
}

export interface HadroniseReport {
  strings: number;
  hadrons: number;
  /** Strings that were too light to fragment on their own and were merged with another string for the final rescaling. */
  merged: number;
  /** Energy (GeV) added in the rare case where even the merged system was lighter than its hadrons (see README). */
  borrowedEnergy: number;
  /** Number of beam-remnant stand-ins used (open colour lines). */
  remnants: number;
}

interface Item {
  p: P4;
  /** Truth index, or −1 for a pseudo-parton. */
  idx: number;
  /** Quark flavour (1–5) for an end; unused for gluons. */
  flav: number;
}
interface StringInput {
  start: Item;
  glu: Item[];
  end: Item;
  /** Truth indices of the real partons. */
  real: number[];
  /** Total four-momentum including pseudo-partons. */
  P: P4;
}
interface Seg {
  P: P4;
  /** Momentum of the quark-end item, which defines the axis. */
  qEnd: P4;
  left: number;
  right: number;
}
interface SegResult {
  seg: Seg;
  W: number;
  frag: StringFragmentation;
  /** Hadron momenta in the lab frame, before the final rescaling. */
  lab: P4[];
}
interface Str {
  input: StringInput;
  segs: SegResult[];
  hadrons: { pdg: number; mass: number; p: P4 }[];
  M: number;
}

const add = (a: P4, b: P4): P4 => ({ E: a.E + b.E, px: a.px + b.px, py: a.py + b.py, pz: a.pz + b.pz });
const half = (a: P4): P4 => ({ E: a.E / 2, px: a.px / 2, py: a.py / 2, pz: a.pz / 2 });

function remnantP4(eps: number, sign: number): P4 {
  return { E: eps, px: 0, py: 0, pz: sign * eps };
}

function makeInput(ev: TruthEvent, ch: Chain, rng: Rng, par: LundParams, eps: number, counter: { n: number }): StringInput {
  const parts = ch.idx.map((i) => ev.particles[i]!);
  const total = parts.reduce<P4>((s, q) => add(s, q.p), { E: 0, px: 0, py: 0, pz: 0 });
  const real = ch.idx.slice();
  if (ch.ring && parts.length >= 2) {
    // A closed gluon ring: open it by splitting one gluon into a collinear q q̄ pair that shares its momentum equally.
    const k = Math.floor(rng() * parts.length);
    const f = pickLight(rng, par);
    const g = parts[k]!;
    const order = [...parts.slice(k + 1), ...parts.slice(0, k)];
    return {
      start: { p: half(g.p), idx: -1, flav: f },
      glu: order.map((q, i) => ({ p: q.p, idx: ch.idx[(k + 1 + i) % ch.idx.length]!, flav: 0 })),
      end: { p: half(g.p), idx: -1, flav: f },
      real,
      P: total,
    };
  }
  const list = parts.slice();
  const idxs = ch.idx.slice();
  let start: Item | undefined;
  let end: Item | undefined;
  if (list.length > 0 && list[0]!.pdg >= 1 && list[0]!.pdg <= 5) {
    start = { p: list[0]!.p, idx: idxs[0]!, flav: list[0]!.pdg };
    list.shift();
    idxs.shift();
  }
  if (list.length > 0 && list[list.length - 1]!.pdg <= -1 && list[list.length - 1]!.pdg >= -5) {
    const q = list.pop()!;
    end = { p: q.p, idx: idxs.pop()!, flav: -q.pdg };
  }
  let pz = 0;
  for (const q of parts) pz += q.p.pz;
  const glu: Item[] = list.map((q, i) => ({ p: q.p, idx: idxs[i]!, flav: 0 }));
  let extra: P4 = { E: 0, px: 0, py: 0, pz: 0 };
  if (!start && !end) {
    const f = pickLight(rng, par); // a pure gluon chain with both ends open: a q q̄ pair of the same flavour from the two beam remnants
    start = { p: remnantP4(eps, +1), idx: -1, flav: f };
    end = { p: remnantP4(eps, -1), idx: -1, flav: f };
    counter.n += 2;
    extra = add(start.p, end.p);
  } else {
    const sgn = pz >= 0 ? 1 : -1;
    if (!start) {
      start = { p: remnantP4(eps, sgn), idx: -1, flav: pickLight(rng, par) };
      counter.n++;
      extra = add(extra, start.p);
    }
    if (!end) {
      end = { p: remnantP4(eps, sgn), idx: -1, flav: pickLight(rng, par) };
      counter.n++;
      extra = add(extra, end.p);
    }
  }
  return { start, glu, end, real, P: add(total, extra) };
}

const SEG_MARGIN = 0.15;
function segMin(left: number, right: number): number {
  const one = lightestMass([left, -right]);
  if (Number.isFinite(one)) return one;
  const a = lightestMass([left, -2]), b = lightestMass([2, -right]);
  return (Number.isFinite(a) ? a : 0.3) + (Number.isFinite(b) ? b : 0.3);
}

function buildSegments(inp: StringInput, rng: Rng, par: LundParams): Seg[] {
  const k = inp.glu.length;
  const f: number[] = [];
  for (let i = 0; i < k; i++) f.push(pickLight(rng, par));
  let segs: Seg[] = [];
  for (let j = 0; j <= k; j++) {
    const lp = j === 0 ? inp.start.p : half(inp.glu[j - 1]!.p);
    const rp = j === k ? inp.end.p : half(inp.glu[j]!.p);
    segs.push({ P: add(lp, rp), qEnd: lp, left: j === 0 ? inp.start.flav : f[j - 1]!, right: j === k ? inp.end.flav : f[j]! });
  }
  // Merge segments that are too light to make a hadron: the gluon between two segments is then taken whole.
  while (segs.length > 1) {
    let worst = -1, worstGap = 0;
    for (let j = 0; j < segs.length; j++) {
      const s = segs[j]!;
      const gap = segMin(s.left, s.right) + SEG_MARGIN - mass(s.P);
      if (gap > worstGap) {
        worstGap = gap;
        worst = j;
      }
    }
    if (worst < 0) break;
    // merge with the neighbour that gives the heavier union
    let other: number;
    if (worst === 0) other = 1;
    else if (worst === segs.length - 1) other = worst - 1;
    else other = mass(add(segs[worst]!.P, segs[worst - 1]!.P)) >= mass(add(segs[worst]!.P, segs[worst + 1]!.P)) ? worst - 1 : worst + 1;
    const a = Math.min(worst, other), b = Math.max(worst, other);
    const sa = segs[a]!, sb = segs[b]!;
    const merged: Seg = { P: add(sa.P, sb.P), qEnd: sa.qEnd, left: sa.left, right: sb.right };
    segs = [...segs.slice(0, a), merged, ...segs.slice(b + 1)];
  }
  return segs;
}

function fragmentSegment(seg: Seg, rng: Rng, par: LundParams): SegResult {
  const W = Math.max(0, mass(seg.P));
  const frag = fragmentString(rng, W, [seg.left], [-seg.right], par);
  // axis: the direction of the quark end in the segment's rest frame
  const q = toRestFrame(seg.qEnd, seg.P);
  let ux = q.px, uy = q.py, uz = q.pz;
  const un = Math.hypot(ux, uy, uz);
  if (un > 0) {
    ux /= un; uy /= un; uz /= un;
  } else {
    ux = 0; uy = 0; uz = 1;
  }
  let e1x: number, e1y: number, e1z: number;
  if (Math.abs(uz) < 0.9) {
    const s = Math.hypot(ux, uy);
    e1x = -uy / s; e1y = ux / s; e1z = 0;
  } else {
    const s = Math.hypot(ux, uz);
    e1x = uz / s; e1y = 0; e1z = -ux / s;
  }
  const e2x = uy * e1z - uz * e1y, e2y = uz * e1x - ux * e1z, e2z = ux * e1y - uy * e1x;
  const bx = seg.P.px / seg.P.E, by = seg.P.py / seg.P.E, bz = seg.P.pz / seg.P.E;
  const lab = frag.hadrons.map((h) => {
    const E = (h.pp + h.pm) / 2, pl = (h.pp - h.pm) / 2;
    return boost({ E, px: pl * ux + h.px * e1x + h.py * e2x, py: pl * uy + h.px * e1y + h.py * e2y, pz: pl * uz + h.px * e1z + h.py * e2z }, bx, by, bz);
  });
  return { seg, W, frag, lab };
}

function makeString(inp: StringInput, rng: Rng, par: LundParams): Str {
  const segs = buildSegments(inp, rng, par).map((s) => fragmentSegment(s, rng, par));
  const hadrons: Str['hadrons'] = [];
  for (const sr of segs) sr.frag.hadrons.forEach((h, i) => hadrons.push({ pdg: h.pdg, mass: h.mass, p: sr.lab[i]! }));
  return { input: inp, segs, hadrons, M: Math.max(0, mass(inp.P)) };
}

const sumMass = (hs: { mass: number }[]): number => hs.reduce((s, h) => s + h.mass, 0);

function groupFeasible(g: Str[]): boolean {
  let P: P4 = { E: 0, px: 0, py: 0, pz: 0 };
  let n = 0, sm = 0;
  for (const s of g) {
    P = add(P, s.input.P);
    n += s.hadrons.length;
    sm += sumMass(s.hadrons);
  }
  return n >= 2 && sm < mass(P) * (1 - 1e-9) - 1e-9;
}

/**
 * Hadronise the event in place: every outgoing coloured parton (status 'final', or 'hard' without daughters; see
 * `outgoingPartons`) ends up as 'intermediate' with hadrons as daughters, and the hadrons (status 'final', with the string's
 * partons as mothers) are appended. Hadrons that are unstable are left for `decayAll`.
 */
export function hadronise(ev: TruthEvent, rng: Rng, opts: HadroniseOptions = {}): void {
  const par: LundParams = { ...defaultLund };
  for (const [k, v] of Object.entries(opts)) if (v !== undefined && k in defaultLund) (par as unknown as Record<string, number>)[k] = v as number;
  const eps = opts.remnantEnergy ?? 0.25;
  const out = outgoingPartons(ev);
  if (out.length === 0) return;
  ensureColour(ev, out);
  const chains = buildChains(ev, out);
  const counter = { n: 0 };
  const strs: Str[] = chains.map((c) => makeString(makeInput(ev, c, rng, par, eps, counter), rng, par));

  // Groups: strings whose hadrons are rescaled together. A string that cannot stand alone is merged with another.
  let groups: Str[][] = strs.map((s) => [s]);
  let merged = 0;
  let borrowed = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    for (let attempt = 0; attempt < 4 && !groupFeasible(groups[gi]!); attempt++) groups[gi] = groups[gi]!.map((s) => makeString(s.input, rng, par));
  }
  for (;;) {
    const bad = groups.findIndex((g) => !groupFeasible(g));
    if (bad < 0 || groups.length === 1) break;
    let best = -1, bestRoom = -Infinity;
    for (let hj = 0; hj < groups.length; hj++) {
      if (hj === bad) continue;
      let P: P4 = { E: 0, px: 0, py: 0, pz: 0 };
      let sm = 0;
      for (const s of groups[bad]!.concat(groups[hj]!)) {
        P = add(P, s.input.P);
        sm += sumMass(s.hadrons);
      }
      const room = mass(P) - sm;
      if (room > bestRoom) {
        bestRoom = room;
        best = hj;
      }
    }
    groups[bad] = groups[bad]!.concat(groups[best]!);
    groups = groups.filter((_, i) => i !== best);
    merged++;
  }

  // Final rescaling per group.
  let nHadrons = 0;
  const made: Str[] = [];
  for (const g of groups) {
    const hads = g.flatMap((s) => s.hadrons);
    const target = g.reduce<P4>((s, x) => add(s, x.input.P), { E: 0, px: 0, py: 0, pz: 0 });
    const ps = hads.map((h) => h.p);
    const ms = hads.map((h) => h.mass);
    if (!rescaleToTarget(ps, ms, target)) {
      // Infeasible even merged (a system lighter than its lightest hadrons, or a single hadron): give the hadrons the energy they
      // need. In a real event that energy comes from the beam remnants; here it is reported.
      const sm = ms.reduce((a, b) => a + b, 0);
      const tp2 = target.px ** 2 + target.py ** 2 + target.pz ** 2;
      const newM = Math.max(mass(target), sm * (1 + 1e-9) + 1e-9);
      const Enew = Math.sqrt(tp2 + newM * newM);
      if (hads.length > 1 && rescaleToTarget(ps, ms, { E: Enew, px: target.px, py: target.py, pz: target.pz })) {
        borrowed += Enew - target.E;
      } else {
        // a single hadron, or no relative motion: all hadrons co-move with the target's velocity, with total mass Σm
        const E2 = Math.sqrt(tp2 + sm * sm);
        borrowed += E2 - target.E;
        const vx = target.px / E2, vy = target.py / E2, vz = target.pz / E2;
        const gam = E2 / sm;
        for (let i = 0; i < hads.length; i++) {
          const m = ms[i]!;
          ps[i] = { E: m * gam, px: m * gam * vx, py: m * gam * vy, pz: m * gam * vz };
        }
      }
    }
    hads.forEach((h, i) => (h.p = ps[i]!));
    for (const s of g) {
      nHadrons += s.hadrons.length;
      made.push(s);
    }
  }

  // Write into the event.
  for (const s of made) {
    const first = ev.particles[s.input.real[0]!];
    const vertex: [number, number, number] = first ? [first.vertex[0], first.vertex[1], first.vertex[2]] : [0, 0, 0];
    let hi = 0;
    const snaps: StringSnapshot[] = [];
    for (const sr of s.segs) {
      const ids: number[] = [];
      for (let k = 0; k < sr.frag.hadrons.length; k++) {
        const h = s.hadrons[hi++]!;
        const tp: TruthParticle = {
          id: ev.particles.length,
          pdg: h.pdg,
          p: h.p,
          vertex: [vertex[0], vertex[1], vertex[2]],
          status: 'final',
          mothers: s.input.real.slice(),
          daughters: [],
        };
        if (first?.collision !== undefined) tp.collision = first.collision;
        ev.particles.push(tp);
        ids.push(tp.id);
        for (const pi of s.input.real) ev.particles[pi]!.daughters.push(tp.id);
      }
      snaps.push(snapshotOf(sr.W, sr.frag, ids));
    }
    for (const pi of s.input.real) ev.particles[pi]!.status = 'intermediate';
    const list = records.get(ev) ?? [];
    list.push({ partons: s.input.real.slice(), segments: snaps });
    records.set(ev, list);
  }
  opts.onReport?.({ strings: strs.length, hadrons: nHadrons, merged, borrowedEnergy: borrowed, remnants: counter.n });
}

// ── Snapshot of the strings of an event ─────────────────────────────────────────────────────────────────────────────

export interface EventString {
  /** Truth indices of the partons that formed the string (colour order). */
  partons: number[];
  /**
   * One snapshot per string segment: a string with gluons is cut into q q̄ segments (see README); a simple q q̄ string has one.
   * Each has the break points, created pairs and light-cone momenta in the segment's rest frame.
   */
  segments: StringSnapshot[];
}
const records = new WeakMap<TruthEvent, EventString[]>();

/**
 * The strings of an event hadronised by `hadronise`, with the sequence of break points and created pairs of each (for the
 * widget that shows a string breaking). Empty if the event was not hadronised in this session (for example a copy
 * sent between workers): the records are kept per event object, not in the event data.
 */
export function lundStringSnapshot(ev: TruthEvent): EventString[] {
  return records.get(ev) ?? [];
}
