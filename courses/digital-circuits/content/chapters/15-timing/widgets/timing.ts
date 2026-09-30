/**
 * Static timing analysis of a combinational network: the longest path through a directed acyclic graph.
 *
 * A network is a list of nodes. An *input* has no fan-in and arrives at t = 0; a *gate* has fan-in and a delay
 * (ns). The **latest arrival** at a node is its delay plus the latest arrival among its inputs, and the
 * **earliest arrival** is its delay plus the earliest among its inputs. The largest latest arrival over the outputs
 * is the network's propagation delay t_pd (the critical path), and the smallest earliest arrival is its
 * contamination delay t_cd. One pass in topological order does it: time linear in the number of wires.
 *
 * `measure()` checks the analysis against the digital engine: it flips every input from every state, records
 * when the last output change happens, and returns the largest such time. It can be lower than t_pd (a path
 * that no input pattern can sensitise is a "false path"), never higher.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine } from '$lib/sim/digital';

export type GateType = 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'not';

export interface TNode {
  id: string;
  /** 'in' for a primary input. */
  type: 'in' | GateType;
  /** Delay of the gate in ns (0 for an input). */
  delay: number;
  inputs: string[];
}

export interface Network {
  name: string;
  nodes: TNode[];
  /** Ids of the nodes that are outputs. */
  outputs: string[];
}

/** Typical delays in ns for a 5 V CMOS family: a NOR is slower than a NAND, an AND is a NAND plus an inverter. */
export const DEFAULT_DELAY: Record<GateType, number> = { not: 1, nand: 1.5, nor: 2, and: 2, or: 2, xor: 3 };

export interface Analysis {
  /** Latest arrival time at each node. */
  late: Record<string, number>;
  /** Earliest arrival time at each node. */
  early: Record<string, number>;
  /** Longest path, from an input to an output. */
  critical: string[];
  /** Shortest path, from an input to an output. */
  shortest: string[];
  /** t_pd: length of the critical path. */
  tpd: number;
  /** t_cd: length of the shortest path. */
  tcd: number;
  /** Number of distinct input-to-output paths. */
  paths: number;
  /** Slack of each node: how much its delay could grow before it lengthens the critical path. */
  slack: Record<string, number>;
  /** Nodes in topological order. */
  order: string[];
}

/** Nodes in an order where every node comes after its inputs. Throws on a loop. */
export function topological(net: Network): string[] {
  const by = new Map(net.nodes.map((n) => [n.id, n]));
  const out: string[] = [];
  const state = new Map<string, 1 | 2>();
  const visit = (id: string): void => {
    const s = state.get(id);
    if (s === 2) return;
    if (s === 1) throw new Error(`the network has a loop through ${id}`);
    const n = by.get(id);
    if (!n) throw new Error(`unknown node ${id}`);
    state.set(id, 1);
    n.inputs.forEach(visit);
    state.set(id, 2);
    out.push(id);
  };
  net.nodes.forEach((n) => visit(n.id));
  return out;
}

export function analyse(net: Network): Analysis {
  const by = new Map(net.nodes.map((n) => [n.id, n]));
  const order = topological(net);
  const late: Record<string, number> = {};
  const early: Record<string, number> = {};
  const lateFrom: Record<string, string | undefined> = {};
  const earlyFrom: Record<string, string | undefined> = {};
  const paths: Record<string, number> = {};
  for (const id of order) {
    const n = by.get(id)!;
    if (n.inputs.length === 0) {
      late[id] = early[id] = 0;
      paths[id] = 1;
      continue;
    }
    let l = -Infinity;
    let e = Infinity;
    let p = 0;
    for (const i of n.inputs) {
      if (late[i]! > l) {
        l = late[i]!;
        lateFrom[id] = i;
      }
      if (early[i]! < e) {
        e = early[i]!;
        earlyFrom[id] = i;
      }
      p += paths[i]!;
    }
    late[id] = l + n.delay;
    early[id] = e + n.delay;
    paths[id] = p;
  }
  const outs = net.outputs;
  const worst = outs.reduce((a, b) => (late[b]! > late[a]! ? b : a));
  const best = outs.reduce((a, b) => (early[b]! < early[a]! ? b : a));
  const trace = (from: string, back: Record<string, string | undefined>): string[] => {
    const path = [from];
    for (let cur = back[from]; cur !== undefined; cur = back[cur]) path.unshift(cur);
    return path;
  };
  const tpd = late[worst]!;
  // Required times, walking backwards: an output must be ready by t_pd; a node by the earliest of its readers' requirements.
  const required: Record<string, number> = {};
  for (const id of order) required[id] = Infinity;
  for (const o of outs) required[o] = tpd;
  for (const id of [...order].reverse()) {
    const n = by.get(id)!;
    for (const i of n.inputs) required[i] = Math.min(required[i]!, required[id]! - n.delay);
  }
  const slack: Record<string, number> = {};
  for (const id of order) slack[id] = round(required[id]! - late[id]!);
  return {
    late,
    early,
    critical: trace(worst, lateFrom),
    shortest: trace(best, earlyFrom),
    tpd: round(tpd),
    tcd: round(early[best]!),
    paths: outs.reduce((s, o) => s + paths[o]!, 0),
    slack,
    order,
  };
}

const round = (x: number) => Math.round(x * 1000) / 1000;

/** The column of each node: 0 for inputs, else one more than its deepest input. */
export function levels(net: Network): Record<string, number> {
  const by = new Map(net.nodes.map((n) => [n.id, n]));
  const lv: Record<string, number> = {};
  for (const id of topological(net)) {
    const n = by.get(id)!;
    lv[id] = n.inputs.length === 0 ? 0 : 1 + Math.max(...n.inputs.map((i) => lv[i]!));
  }
  return lv;
}

// ── The networks of the figure ─────────────────────────────────────────────────

const gate = (id: string, type: GateType, inputs: string[], delays?: Partial<Record<GateType, number>>): TNode => ({ id, type, delay: delays?.[type] ?? DEFAULT_DELAY[type], inputs });
const input = (id: string): TNode => ({ id, type: 'in', delay: 0, inputs: [] });

/** An AND of eight inputs as a chain of two-input gates: (((x0·x1)·x2)·x3)… */
export function andChain(): Network {
  const nodes: TNode[] = Array.from({ length: 8 }, (_, i) => input(`x${i}`));
  let prev = 'x0';
  for (let i = 1; i < 8; i++) {
    nodes.push(gate(`a${i}`, 'and', [prev, `x${i}`]));
    prev = `a${i}`;
  }
  return { name: 'AND of 8 inputs, as a chain', nodes, outputs: [prev] };
}

/** The same AND as a balanced tree: three levels instead of seven. */
export function andTree(): Network {
  const nodes: TNode[] = Array.from({ length: 8 }, (_, i) => input(`x${i}`));
  let layer = nodes.map((n) => n.id);
  let k = 0;
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const id = `a${++k}`;
      nodes.push(gate(id, 'and', [layer[i]!, layer[i + 1]!]));
      next.push(id);
    }
    layer = next;
  }
  return { name: 'AND of 8 inputs, as a tree', nodes, outputs: layer };
}

/** A ripple-carry adder of `bits` bits, each full adder made of two XORs, two ANDs and an OR. */
export function rippleAdder(bits = 4): Network {
  const nodes: TNode[] = [input('cin')];
  for (let i = 0; i < bits; i++) nodes.push(input(`a${i}`), input(`b${i}`));
  let carry = 'cin';
  const outputs: string[] = [];
  for (let i = 0; i < bits; i++) {
    nodes.push(
      gate(`p${i}`, 'xor', [`a${i}`, `b${i}`]),
      gate(`s${i}`, 'xor', [`p${i}`, carry]),
      gate(`g${i}`, 'and', [`a${i}`, `b${i}`]),
      gate(`t${i}`, 'and', [`p${i}`, carry]),
      gate(`c${i + 1}`, 'or', [`g${i}`, `t${i}`]),
    );
    outputs.push(`s${i}`);
    carry = `c${i + 1}`;
  }
  outputs.push(carry);
  return { name: `${bits}-bit ripple-carry adder`, nodes, outputs };
}

/** Two paths of different lengths meeting at one gate: the smallest example with t_cd ≠ t_pd. */
export function twoPaths(): Network {
  return {
    name: 'Two paths of different lengths',
    nodes: [input('a'), input('b'), gate('n1', 'not', ['a']), gate('n2', 'not', ['n1']), gate('n3', 'not', ['n2']), gate('y', 'nand', ['n3', 'b'])],
    outputs: ['y'],
  };
}

/**
 * Two multiplexers in a row with the same select. The path through the slow inverters and the first mux, and then
 * through the second, needs the select to be 0 at the first and 1 at the second: no input pattern can do that, so it
 * is a false path. Static analysis still counts it.
 */
export function falsePath(): Network {
  return {
    name: 'Two muxes with one select',
    nodes: [
      input('s'),
      input('a'),
      input('b'),
      input('x'),
      gate('ns', 'not', ['s']),
      gate('d1', 'not', ['x']),
      gate('d2', 'not', ['d1']),
      gate('d3', 'not', ['d2']),
      gate('g1', 'and', ['s', 'a']),
      gate('g2', 'and', ['ns', 'd3']),
      gate('m1', 'or', ['g1', 'g2']),
      gate('g3', 'and', ['s', 'm1']),
      gate('g4', 'and', ['ns', 'b']),
      gate('y', 'or', ['g3', 'g4']),
    ],
    outputs: ['y'],
  };
}

export const PRESETS: { id: string; label: string; make: () => Network }[] = [
  { id: 'chain', label: 'AND chain', make: andChain },
  { id: 'tree', label: 'AND tree', make: andTree },
  { id: 'adder', label: '4-bit adder', make: () => rippleAdder(4) },
  { id: 'paths', label: 'Two paths', make: twoPaths },
  { id: 'false', label: 'False path', make: falsePath },
];

// ── Checking the analysis on the simulator ────────────────────────────────────

/** A network as a netlist of the digital engine: a toggle per input, a gate per gate, its delay in ns. */
export function netlistOf(net: Network) {
  const b = new NetlistBuilder();
  const wire = new Map<string, number>();
  for (const n of net.nodes) wire.set(n.id, b.net(n.id));
  for (const n of net.nodes) {
    if (n.type === 'in') b.add('toggle', n.id, { Y: wire.get(n.id)! });
    else {
      const pins: Record<string, number> = { Y: wire.get(n.id)! };
      n.inputs.forEach((s, i) => (pins[String.fromCharCode(65 + i)] = wire.get(s)!));
      b.add(n.type, `g_${n.id}`, pins, n.type === 'not' ? { delay: n.delay } : { inputs: n.inputs.length, delay: n.delay });
    }
  }
  return { flat: b.build(), wire };
}

export interface Measured {
  /** Largest time (ns) from an input flip to the last change of any output, over every state and input. */
  worst: number;
  /** Smallest time to the first change of an output, over the flips that change one. */
  first: number;
  /** The flip that gave `worst`. */
  input: string;
  state: number;
  runs: number;
}

/** Flip every input from every state (up to `maxStates` states, chosen evenly) and measure the output activity. */
export function measure(net: Network, maxStates = 512): Measured {
  const { flat, wire } = netlistOf(net);
  const inputs = net.nodes.filter((n) => n.type === 'in').map((n) => n.id);
  const outNets = net.outputs.map((o) => wire.get(o)!);
  const e = createDigitalEngine(flat);
  const total = 2 ** inputs.length;
  const stride = Math.max(1, Math.floor(total / maxStates));
  const set = (state: number) => inputs.forEach((id, i) => e.setParam(id, 'on', ((state >> i) & 1) === 1));
  let worst = 0;
  let first = Infinity;
  let worstInput = '';
  let worstState = 0;
  let runs = 0;
  const rec = e.watch(outNets);
  for (let s = 0; s < total; s += stride) {
    set(s);
    e.advance(500e-9);
    for (let i = 0; i < inputs.length; i++) {
      const t0 = e.time;
      const before = outNets.map((n) => e.logic(n));
      const mark = rec.times().length;
      e.setParam(inputs[i]!, 'on', ((s >> i) & 1) === 0);
      e.advance(500e-9);
      runs++;
      const times = rec.times();
      const vals = rec.values();
      let last = 0;
      let firstHere = Infinity;
      const prev: number[] = [...before];
      for (let r = mark; r < times.length; r++) {
        for (let k = 0; k < outNets.length; k++) {
          const v = vals[k]![r]!;
          if (v !== prev[k]) {
            prev[k] = v;
            const dt = (times[r]! - t0) * 1e9;
            last = Math.max(last, dt);
            firstHere = Math.min(firstHere, dt);
          }
        }
      }
      if (last > worst) {
        worst = last;
        worstInput = inputs[i]!;
        worstState = s;
      }
      if (firstHere < first) first = firstHere;
      e.setParam(inputs[i]!, 'on', ((s >> i) & 1) === 1);
      e.advance(500e-9);
      rec.trim(1e-6);
    }
  }
  rec.close();
  return { worst: round(worst), first: round(first), input: worstInput, state: worstState, runs };
}

// ── Drawing ────────────────────────────────────────────────────────────────────

export const NODE_W = 50;
export const NODE_H = 30;
export const COL_W = 74;
export const ROW_H = 46;

export interface Placement {
  x: number;
  y: number;
}

/**
 * A layered layout: one column per level, each node at the mean height of its inputs and pushed down until nothing
 * overlaps. Inputs keep the order of the list.
 */
export function layout(net: Network): { pos: Record<string, Placement>; width: number; height: number } {
  const lv = levels(net);
  const by = new Map(net.nodes.map((n) => [n.id, n]));
  const maxLevel = Math.max(...Object.values(lv));
  const cols: TNode[][] = Array.from({ length: maxLevel + 1 }, () => []);
  for (const n of net.nodes) cols[lv[n.id]!]!.push(n);
  const y: Record<string, number> = {};
  cols[0]!.forEach((n, i) => (y[n.id] = i * ROW_H));
  for (let c = 1; c <= maxLevel; c++) {
    const want = (n: TNode) => n.inputs.reduce((s, i) => s + y[i]!, 0) / n.inputs.length;
    const sorted = [...cols[c]!].sort((a, b) => want(a) - want(b));
    let floor = -Infinity;
    for (const n of sorted) {
      y[n.id] = Math.max(want(n), floor);
      floor = y[n.id]! + ROW_H;
    }
  }
  const top = Math.min(...Object.values(y));
  const pos: Record<string, Placement> = {};
  for (const n of net.nodes) pos[n.id] = { x: lv[n.id]! * COL_W, y: y[n.id]! - top };
  void by;
  return { pos, width: maxLevel * COL_W + NODE_W, height: Math.max(...Object.values(pos).map((p) => p.y)) + NODE_H };
}
