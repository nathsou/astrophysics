/**
 * From a gate network to a drawn circuit: a layered layout with orthogonal wires.
 *
 * The input is a `Dag`: named inputs, gates that read signals (an input's name or another gate's id)
 * and named outputs. The output is a `Circuit` for the digital engine that `Schematic` can draw:
 * toggles on the left, one column of gates per logic level, indicators on the right.
 *
 * The rules that keep the drawing correct, because the circuit model connects wires by geometry:
 *
 *  - Every wire between two columns runs along its own vertical track in the channel between them
 *    (a signal with several readers shares one track, "trunk and branches"). Different signals
 *    never share a track.
 *  - A signal that is needed more than one column further on passes through the columns in between
 *    on a straight horizontal wire at a row of its own (a dummy node, as in layered graph drawing).
 *  - In a channel, the rows on which signals leave a column and the rows on which they enter the next
 *    one are disjoint, except for the same signal. Otherwise a wire end could land on another
 *    signal's wire, and the model would join the two nets.
 *
 * The property test in layout.test.ts checks the result by simulation: every random network is laid
 * out, flattened, run on the digital engine, and compared with a direct evaluation.
 */
import type { Circuit, Placed, Wire } from '$lib/sim/netlist/types';

export type GateKind = 'and' | 'or' | 'nand' | 'nor' | 'xor' | 'xnor' | 'not' | 'buffer';

export interface DagGate {
  id: string;
  kind: GateKind;
  /** Signals read, in pin order: an input name, '0', '1' or the id of another gate. */
  inputs: string[];
}

export interface Dag {
  inputs: string[];
  gates: DagGate[];
  outputs: { name: string; signal: string }[];
}

export interface LayoutOptions {
  title?: string;
  /** Draw inputs that nothing reads (default false). */
  keepUnused?: boolean;
  /** Initial input values. */
  values?: Record<string, boolean>;
  /** Draw the gate ids as labels (default false). */
  gateLabels?: boolean;
  /**
   * Preferred top-to-bottom order of the gates (by id) and of the signals that pass through a column (by
   * name), to keep unrelated circuits in one drawing in separate bands. Nodes not listed keep the order
   * that puts each near the rows that feed it, below those that are listed.
   */
  order?: string[];
  /** Draw ports (as in a parts-bin part or an exercise answer) instead of toggles and indicators. */
  ports?: boolean;
}

/** Ids used in the circuit for the inputs, outputs and gates, so tests and widgets can find them. */
export const inputId = (name: string) => `in_${name}`;
export const outputId = (name: string) => `out_${name}`;

type NodeKind = 'src' | 'gate' | 'sink' | 'dummy';

interface Node {
  key: string;
  kind: NodeKind;
  level: number;
  /** For src, gate and dummy: the signal it provides. */
  signal: string;
  /** Signals read, in pin order. */
  reads: string[];
  gate?: DagGate;
  outputName?: string;
  y: number;
  x: number;
  /** Position of the output pin relative to the node's origin. */
  outDx: number;
  outDy: number;
  order: number;
}

const isConst = (s: string) => s === '0' || s === '1';

const width = (n: Node): number => n.outDx;

/** Number of inputs of a gate, and the geometry of its pins (see the catalog). */
function arity(g: DagGate): number {
  return g.kind === 'not' || g.kind === 'buffer' ? 1 : Math.max(2, g.inputs.length);
}

export function layoutDag(dag: Dag, opts: LayoutOptions = {}): Circuit {
  const gateById = new Map(dag.gates.map((g) => [g.id, g]));
  if (gateById.size !== dag.gates.length) throw new Error('layoutDag: duplicate gate ids');
  const inputSet = new Set(dag.inputs);

  // --- Levels ----------------------------------------------------------------------------------
  const level = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (s: string): number => {
    const known = level.get(s);
    if (known !== undefined) return known;
    const g = gateById.get(s);
    if (!g) {
      if (!inputSet.has(s) && !isConst(s)) throw new Error(`layoutDag: unknown signal "${s}"`);
      level.set(s, 0);
      return 0;
    }
    if (visiting.has(s)) throw new Error(`layoutDag: feedback through "${s}"`);
    visiting.add(s);
    const l = 1 + Math.max(0, ...g.inputs.map(levelOf));
    visiting.delete(s);
    level.set(s, l);
    return l;
  };
  for (const g of dag.gates) levelOf(g.id);
  for (const o of dag.outputs) levelOf(o.signal);
  const maxGateLevel = Math.max(0, ...dag.gates.map((g) => level.get(g.id)!));
  const sinkLevel = maxGateLevel + 1;

  // Only gates that some output depends on are drawn.
  const live = new Set<string>();
  const mark = (s: string) => {
    if (live.has(s)) return;
    live.add(s);
    gateById.get(s)?.inputs.forEach(mark);
  };
  dag.outputs.forEach((o) => mark(o.signal));

  // --- Nodes -----------------------------------------------------------------------------------
  const nodes: Node[] = [];
  const mk = (n: Partial<Node> & Pick<Node, 'key' | 'kind' | 'level' | 'signal' | 'reads' | 'outDx' | 'outDy'>): Node => {
    const node: Node = { y: 0, x: 0, order: nodes.length, ...n };
    nodes.push(node);
    return node;
  };
  const used = new Set<string>();
  dag.gates.filter((g) => live.has(g.id)).forEach((g) => g.inputs.forEach((s) => used.add(s)));
  dag.outputs.forEach((o) => used.add(o.signal));
  for (const name of dag.inputs) {
    if (opts.keepUnused || used.has(name)) mk({ key: `src:${name}`, kind: 'src', level: 0, signal: name, reads: [], outDx: 3, outDy: 0 });
  }
  for (const c of ['0', '1']) if (used.has(c) && !inputSet.has(c)) mk({ key: `src:${c}`, kind: 'src', level: 0, signal: c, reads: [], outDx: 2, outDy: 0 });
  for (const g of dag.gates) {
    if (!live.has(g.id)) continue;
    const k = arity(g);
    mk({ key: `gate:${g.id}`, kind: 'gate', level: level.get(g.id)!, signal: g.id, reads: g.inputs, gate: g, outDx: k === 1 ? 5 : 6, outDy: k === 1 ? 0 : k - 1 });
  }
  for (const o of dag.outputs) mk({ key: `sink:${o.name}`, kind: 'sink', level: sinkLevel, signal: '', reads: [o.signal], outputName: o.name, outDx: 3, outDy: 0 });

  // The last column that reads each signal, and a dummy node for every column it must cross.
  const lastUse = new Map<string, number>();
  for (const n of nodes) for (const s of n.reads) lastUse.set(s, Math.max(lastUse.get(s) ?? 0, n.level));
  for (const [s, last] of lastUse) {
    for (let c = level.get(s)! + 1; c < last; c++) mk({ key: `dummy:${s}:${c}`, kind: 'dummy', level: c, signal: s, reads: [s], outDx: 0, outDy: 0 });
  }
  const columns: Node[][] = Array.from({ length: sinkLevel + 1 }, () => []);
  for (const n of nodes) columns[n.level]!.push(n);

  /** Node that provides `signal` to the column after `column`. */
  const providerAt = new Map<string, Node>();
  for (const n of nodes) if (n.kind !== 'sink') providerAt.set(`${n.signal}@${n.level}`, n);
  const providerFor = (signal: string, readerLevel: number): Node => {
    const p = providerAt.get(`${signal}@${readerLevel - 1}`) ?? providerAt.get(`${signal}@${level.get(signal)}`);
    if (!p) throw new Error(`layoutDag: no provider for ${signal} at level ${readerLevel}`);
    return p;
  };

  // --- Rows ------------------------------------------------------------------------------------
  // Column 0: one row every two units, so two adjacent inputs meet a gate straight.
  columns[0]!.forEach((n, i) => (n.y = 2 * i));
  const rowOfOut = (n: Node) => n.y + n.outDy;
  const pinRows = (n: Node): number[] => (n.kind === 'gate' ? Array.from({ length: arity(n.gate!) }, (_, i) => n.y + 2 * i) : [n.y]);
  const top = (n: Node) => n.y - (n.kind === 'dummy' ? 0 : 1);
  const bottom = (n: Node) => n.y + (n.kind === 'dummy' ? 0 : n.kind === 'gate' ? 2 * arity(n.gate!) - 1 : 1);

  for (let c = 1; c < columns.length; c++) {
    const col = columns[c]!;
    // Provider rows in the channel before this column.
    const providers = new Set<Node>();
    for (const n of col) for (const s of n.reads) providers.add(providerFor(s, c));
    const forbidden = new Map<number, Node>();
    for (const p of providers) forbidden.set(rowOfOut(p), p);
    const bary = (n: Node) => n.reads.reduce((sum, s) => sum + rowOfOut(providerFor(s, c)), 0) / Math.max(1, n.reads.length);
    const ranks = opts.order;
    const rank = (n: Node): number => {
      if (!ranks) return 0;
      const i = ranks.indexOf(n.kind === 'gate' ? n.gate!.id : n.kind === 'sink' ? n.reads[0]! : n.signal);
      return i < 0 ? ranks.length : i;
    };
    const sorted = [...col].sort((a, b) => rank(a) - rank(b) || bary(a) - bary(b) || a.order - b.order);
    let prevBottom = -Infinity;
    for (const n of sorted) {
      const k = n.kind === 'gate' ? arity(n.gate!) : 1;
      const desired = Math.round(bary(n) - (k - 1));
      let y = Math.max(desired, prevBottom + 1 + (n.kind === 'dummy' ? 0 : 1));
      for (;;) {
        n.y = y;
        const ok = pinRows(n).every((r, i) => {
          const owner = forbidden.get(r);
          return owner === undefined || owner === providerFor(n.reads[i]!, c);
        });
        // Rows of the next channel: this node's own output row must not be ambiguous either, but that is
        // checked when the next column is placed.
        if (ok) break;
        y++;
      }
      prevBottom = bottom(n);
    }
  }
  // Shift so that the topmost bound is at y = 1.
  const minTop = Math.min(...nodes.map(top));
  for (const n of nodes) n.y += 2 - minTop;

  // --- Channels and x positions ----------------------------------------------------------------
  interface Trunk {
    signal: string;
    provider: Node;
    readers: { node: Node; pin: number }[];
    lo: number;
    hi: number;
    straight: boolean;
    x: number;
  }
  const channels: Trunk[][] = [];
  const colWidth = columns.map((col) => Math.max(2, ...col.map((n) => (n.kind === 'dummy' ? 2 : width(n)))));
  const colX: number[] = [0];
  for (let c = 1; c < columns.length; c++) {
    const bySignal = new Map<string, Trunk>();
    for (const n of columns[c]!) {
      n.reads.forEach((s, pin) => {
        const p = providerFor(s, c);
        let t = bySignal.get(s);
        if (!t) {
          t = { signal: s, provider: p, readers: [], lo: rowOfOut(p), hi: rowOfOut(p), straight: false, x: 0 };
          bySignal.set(s, t);
        }
        t.readers.push({ node: n, pin });
        const r = pinRows(n)[pin]!;
        t.lo = Math.min(t.lo, r);
        t.hi = Math.max(t.hi, r);
      });
    }
    const trunks = [...bySignal.values()];
    for (const t of trunks) t.straight = t.lo === t.hi;
    // Order the vertical tracks to reduce crossings: for s left of t, count t's source wire crossing s's
    // trunk and s's branches crossing t's trunk.
    const rows = (t: Trunk) => t.readers.map((r) => pinRows(r.node)[r.pin]!);
    const cross = (s: Trunk, t: Trunk): number => {
      let k = 0;
      const a = rowOfOut(t.provider);
      if (a >= s.lo && a <= s.hi) k++;
      for (const d of rows(s)) if (d >= t.lo && d <= t.hi) k++;
      return k;
    };
    const need = trunks.filter((t) => !t.straight).sort((a, b) => rowOfOut(a.provider) - rowOfOut(b.provider));
    for (let pass = 0; pass < 20; pass++) {
      let changed = false;
      for (let i = 0; i + 1 < need.length; i++) {
        const [s, t] = [need[i]!, need[i + 1]!];
        if (cross(t, s) < cross(s, t)) {
          need[i] = t;
          need[i + 1] = s;
          changed = true;
        }
      }
      if (!changed) break;
    }
    const x0 = colX[c - 1]! + colWidth[c - 1]!;
    need.forEach((t, i) => (t.x = x0 + 1 + i));
    colX[c] = x0 + need.length + 2;
    channels[c] = trunks;
  }
  const X = 2;
  for (const n of nodes) n.x = X + colX[n.level]!;
  for (const trunks of channels) for (const t of trunks ?? []) t.x += X;

  // --- Components ------------------------------------------------------------------------------
  const components: Placed[] = [];
  const wires: Wire[] = [];
  const idOf = new Map<Node, string>();
  let gateCount = 0;
  for (const n of nodes) {
    if (n.kind === 'src') {
      const id = inputId(n.signal);
      idOf.set(n, id);
      if (isConst(n.signal)) components.push({ id: `const${n.signal}`, type: 'const', x: n.x, y: n.y, params: { value: Number(n.signal) }, label: n.signal });
      else if (opts.ports) components.push({ id: n.signal, type: 'port', x: n.x + 3, y: n.y, params: { name: n.signal, dir: 'in' }, label: '' });
      else components.push({ id, type: 'toggle', x: n.x, y: n.y, label: n.signal, ...(opts.values?.[n.signal] ? { params: { on: true } } : {}) });
    } else if (n.kind === 'gate') {
      const g = n.gate!;
      const k = arity(g);
      const id = `g${++gateCount}`;
      idOf.set(n, id);
      components.push({ id, type: g.kind, x: n.x, y: n.y, label: opts.gateLabels ? g.id : '', ...(k > 2 ? { params: { inputs: k } } : {}) });
    } else if (n.kind === 'sink') {
      const id = outputId(n.outputName!);
      idOf.set(n, id);
      if (opts.ports) components.push({ id: n.outputName!, type: 'port', x: n.x, y: n.y, flip: true, params: { name: n.outputName!, dir: 'out' }, label: '' });
      else components.push({ id, type: 'indicator', x: n.x, y: n.y, label: n.outputName!, params: { color: 'amber' } });
    }
  }

  const outPin = (p: Node): [number, number] => [p.x + (p.kind === 'dummy' ? colWidth[p.level]! : p.outDx), p.y + p.outDy];
  const inPin = (n: Node, pin: number): [number, number] => [n.x, pinRows(n)[pin]!];
  for (const n of nodes) {
    if (n.kind === 'dummy') wires.push({ points: [[n.x, n.y], [n.x + colWidth[n.level]!, n.y]] });
  }
  for (let c = 1; c < columns.length; c++) {
    for (const t of channels[c]!) {
      const [sx, sy] = outPin(t.provider);
      if (t.straight) {
        const r = t.readers[0]!;
        wires.push({ points: [[sx, sy], inPin(r.node, r.pin)] });
        continue;
      }
      wires.push({ points: [[sx, sy], [t.x, sy]] });
      wires.push({ points: [[t.x, t.lo], [t.x, t.hi]] });
      for (const r of t.readers) {
        const [dx, dy] = inPin(r.node, r.pin);
        wires.push({ points: [[t.x, dy], [dx, dy]] });
      }
    }
  }
  return { version: 1, title: opts.title ?? 'Generated circuit', engine: 'digital', components, wires };
}

// ---------------------------------------------------------------------------------------------
// Reference evaluation, for tests and for widgets that want the truth table of a network.

export function evalGate(kind: GateKind, ins: number[]): number {
  switch (kind) {
    case 'and':
      return ins.every(Boolean) ? 1 : 0;
    case 'or':
      return ins.some(Boolean) ? 1 : 0;
    case 'nand':
      return ins.every(Boolean) ? 0 : 1;
    case 'nor':
      return ins.some(Boolean) ? 0 : 1;
    case 'xor':
      return ins.reduce((a, b) => a ^ b, 0);
    case 'xnor':
      return 1 - ins.reduce((a, b) => a ^ b, 0);
    case 'not':
      return ins[0] ? 0 : 1;
    case 'buffer':
      return ins[0]! ? 1 : 0;
  }
}

/** Evaluate every output of a network for the given input values. */
export function evalDag(dag: Dag, values: Record<string, number>): Record<string, number> {
  const gates = new Map(dag.gates.map((g) => [g.id, g]));
  const memo = new Map<string, number>();
  const val = (s: string): number => {
    if (s === '0') return 0;
    if (s === '1') return 1;
    const m = memo.get(s);
    if (m !== undefined) return m;
    const g = gates.get(s);
    const v = g ? evalGate(g.kind, g.inputs.map(val)) : (values[s] ?? 0);
    memo.set(s, v);
    return v;
  };
  return Object.fromEntries(dag.outputs.map((o) => [o.name, val(o.signal)]));
}

/** Gates of each kind, for the cost lines under a figure. */
export function countGates(dag: Dag): Record<string, number> {
  const out: Record<string, number> = {};
  const seen = new Set<string>();
  const mark = (s: string) => {
    if (seen.has(s)) return;
    seen.add(s);
    dag.gates.find((g) => g.id === s)?.inputs.forEach(mark);
  };
  dag.outputs.forEach((o) => mark(o.signal));
  for (const g of dag.gates) if (seen.has(g.id)) out[g.kind] = (out[g.kind] ?? 0) + 1;
  return out;
}

/** Number of gate inputs (the classical size measure of a two-level circuit) in the part of the network that the outputs use. */
export function gateInputs(dag: Dag): number {
  const seen = new Set<string>();
  const mark = (s: string) => {
    if (seen.has(s)) return;
    seen.add(s);
    dag.gates.find((g) => g.id === s)?.inputs.forEach(mark);
  };
  dag.outputs.forEach((o) => mark(o.signal));
  return dag.gates.filter((g) => seen.has(g.id)).reduce((sum, g) => sum + g.inputs.length, 0);
}
