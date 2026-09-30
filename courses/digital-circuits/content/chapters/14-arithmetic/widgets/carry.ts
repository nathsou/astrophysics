/**
 * The carry race: a ripple-carry adder and a carry-lookahead adder, built gate by gate for the digital engine (every gate
 * takes 1 ns) and timed. The ripple adder is a chain of full adders, each made of two XORs, two ANDs and an OR. The lookahead
 * adder computes, for every bit, whether that bit *generates* a carry (g = a·b) or *propagates* one (p = a ⊕ b), and then
 * combines the (g, p) pairs of neighbouring groups in a tree (a Kogge–Stone prefix network), so that every carry is ready
 * after about log₂ n levels instead of n. There is no carry input: the adders add two n-bit numbers.
 *
 * `measure` sets the operands on an adder that has settled at 0 + 0 and records every change of every output, so a widget
 * can show the sum at any moment and how long it stayed wrong.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';
import type { FlatNetlist } from '$lib/sim/netlist/types';

export type AdderKind = 'ripple' | 'lookahead';

/** The delay of every gate, in nanoseconds (the catalog default). */
export const GATE_NS = 1;

export interface Adder {
  kind: AdderKind;
  n: number;
  netlist: FlatNetlist;
  /** Number of gates. */
  gates: number;
  /** Nets of S0 … S(n−1) and COUT, in that order. */
  outputs: number[];
  /** Names of the outputs: S0 … S(n−1), COUT. */
  names: string[];
  /** Levels of gates on the longest path from an input to the last output (a static count). */
  depth: number;
}

export const levelsFor = (n: number): number => Math.ceil(Math.log2(Math.max(2, n)));

export function buildAdder(kind: AdderKind, n: number): Adder {
  const b = new NetlistBuilder();
  const A = b.nets(n, 'A');
  const B = b.nets(n, 'B');
  A.forEach((net, i) => b.add('toggle', `A${i}`, { Y: net }));
  B.forEach((net, i) => b.add('toggle', `B${i}`, { Y: net }));
  let gates = 0;
  const gate = (type: 'xor' | 'and' | 'or', id: string, x: number, y: number): number => {
    const out = b.net(id);
    b.add(type, id, { A: x, B: y, Y: out });
    gates++;
    return out;
  };
  const sums: number[] = [];
  let cout: number;
  if (kind === 'ripple') {
    let carry = -1;
    for (let i = 0; i < n; i++) {
      if (carry < 0) {
        sums.push(gate('xor', `s${i}`, A[i]!, B[i]!));
        carry = gate('and', `c${i}`, A[i]!, B[i]!);
      } else {
        const p = gate('xor', `p${i}`, A[i]!, B[i]!);
        const g = gate('and', `g${i}`, A[i]!, B[i]!);
        sums.push(gate('xor', `s${i}`, p, carry));
        const t = gate('and', `t${i}`, p, carry);
        carry = gate('or', `c${i}`, g, t);
      }
    }
    cout = carry;
  } else {
    const p0 = A.map((a, i) => gate('xor', `p${i}`, a, B[i]!));
    const g0 = A.map((a, i) => gate('and', `g${i}`, a, B[i]!));
    let G = g0;
    let P = p0;
    for (let k = 1, d = 1; d < n; k++, d *= 2) {
      const G2 = G.slice();
      const P2 = P.slice();
      for (let i = d; i < n; i++) {
        const t = gate('and', `t${k}_${i}`, P[i]!, G[i - d]!);
        G2[i] = gate('or', `G${k}_${i}`, G[i]!, t);
        // The group propagate is needed by the next level only where it will be combined again.
        if (i >= 2 * d) P2[i] = gate('and', `P${k}_${i}`, P[i]!, P[i - d]!);
      }
      G = G2;
      P = P2;
    }
    for (let i = 0; i < n; i++) sums.push(i === 0 ? p0[0]! : gate('xor', `s${i}`, p0[i]!, G[i - 1]!));
    cout = G[n - 1]!;
  }
  const netlist = b.build();
  const adder: Adder = { kind, n, netlist, gates, outputs: [...sums, cout], names: [...Array.from({ length: n }, (_, i) => `S${i}`), 'COUT'], depth: 0 };
  adder.depth = criticalPath(adder);
  return adder;
}

/**
 * The longest path from an input to an output, in gate delays (static timing analysis: no operands, every gate
 * counted). For the ripple adder it is 2n − 1; for the lookahead adder 2⌈log₂ n⌉ + 2.
 */
export function criticalPath(adder: Pick<Adder, 'netlist' | 'outputs'>): number {
  const arrival = new Int32Array(adder.netlist.netCount);
  const gates = adder.netlist.elements.filter((e) => e.type !== 'toggle' && e.type !== 'const');
  for (let pass = 0; pass <= gates.length; pass++) {
    let changed = false;
    for (const g of gates) {
      const yi = g.pinNames.indexOf('Y');
      const worst = Math.max(...g.pins.filter((_, i) => i !== yi).map((net) => arrival[net]!));
      if (arrival[g.pins[yi]!]! !== worst + 1) {
        arrival[g.pins[yi]!] = worst + 1;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return Math.max(...adder.outputs.map((net) => arrival[net]!));
}

export interface Measurement {
  kind: AdderKind;
  n: number;
  a: number;
  b: number;
  /** Times of the changes, in nanoseconds after the operands were applied (the first is 0). */
  t: number[];
  /** For each output (S0 … S(n−1), COUT), its value after each change, aligned with `t`. */
  rows: number[][];
  names: string[];
  /** The answer, a + b, and what the outputs settle to. */
  expected: number;
  final: number;
  /** When the last output changed, in nanoseconds. */
  settleNs: number;
  /** Events the engine processed for this addition. */
  events: number;
  gates: number;
}

/** Apply a + b to an adder that has settled at 0 + 0, and record the outputs. */
export function measure(kind: AdderKind, n: number, a: number, b: number, adder: Adder = buildAdder(kind, n)): Measurement {
  const e = createDigitalEngine(adder.netlist);
  e.advance(1e-6);
  const t0 = e.time;
  const events0 = e.eventCount;
  const rec = e.watch(adder.outputs);
  for (let i = 0; i < n; i++) {
    e.setParam(`A${i}`, 'on', !!((a >> i) & 1));
    e.setParam(`B${i}`, 'on', !!((b >> i) & 1));
  }
  e.advance(1e-6);
  const times = Array.from(rec.times(), (s) => Math.round((s - t0) * 1e9 * 1000) / 1000);
  const values = rec.values().map((v) => Array.from(v));
  rec.close();
  const final = values.reduce((sum, v, j) => sum + (v[v.length - 1] === 1 ? 2 ** j : 0), 0);
  let settle = 0;
  for (let i = 1; i < times.length; i++) settle = Math.max(settle, times[i]!);
  return { kind, n, a, b, t: times, rows: values, names: adder.names, expected: a + b, final, settleNs: settle, events: e.eventCount - events0, gates: adder.gates };
}

/** The value of the outputs at time `ns` (bits that are unknown count as 0), and whether it is the final answer. */
export function valueAt(m: Measurement, ns: number): number {
  let sum = 0;
  m.rows.forEach((row, j) => {
    let v = 0;
    for (let i = 0; i < m.t.length && m.t[i]! <= ns + 1e-9; i++) v = row[i]!;
    if (v === 1) sum += 2 ** j;
  });
  return sum;
}

/** The worst case for a ripple adder: the carry born in bit 0 must pass through every other bit. */
export const worstCase = (n: number): [number, number] => [2 ** n - 1, 1];

export interface SweepPoint {
  n: number;
  /** Longest path through the gates, in nanoseconds (static). */
  ripple: number;
  lookahead: number;
  /** What the engine measures for the worst-case operands (all ones plus one). */
  rippleMeasured: number;
  lookaheadMeasured: number;
  rippleGates: number;
  lookaheadGates: number;
}

/** Critical path and measured settling time of both adders at every width from `lo` to `hi`. */
export function sweep(lo = 4, hi = 16): SweepPoint[] {
  const out: SweepPoint[] = [];
  for (let n = lo; n <= hi; n++) {
    const [a, b] = worstCase(n);
    const ra = buildAdder('ripple', n);
    const la = buildAdder('lookahead', n);
    const r = measure('ripple', n, a, b, ra);
    const l = measure('lookahead', n, a, b, la);
    out.push({ n, ripple: ra.depth * GATE_NS, lookahead: la.depth * GATE_NS, rippleMeasured: r.settleNs, lookaheadMeasured: l.settleNs, rippleGates: r.gates, lookaheadGates: l.gates });
  }
  return out;
}
