/**
 * Bubble pushing: the model behind Figure 11.2.
 *
 * A network is a tree of AND and OR gates. Any input pin and any gate output may carry an inversion
 * bubble. De Morgan's laws say that a gate may be redrawn as its dual with the bubbles moved across it:
 *
 *      ¬(A·B) = ¬A + ¬B        an AND with a bubble at its output is an OR with bubbles at its inputs
 *
 * `pushThrough` is that move: swap AND and OR, flip every bubble on the gate's pins and the bubble at its
 * output. It never changes the function. Two bubbles in a row on one wire are ¬¬ and cancel.
 */

export type Kind = 'and' | 'or';

/** An input pin of a gate: what feeds it (a variable name or a gate id) and whether it has a bubble. */
export interface Pin {
  src: string;
  inv: boolean;
}

export interface BGate {
  id: string;
  kind: Kind;
  ins: Pin[];
  /** A bubble at the output. */
  outInv: boolean;
}

export interface Net {
  vars: string[];
  gates: BGate[];
  /** The gate whose output is the network's output. */
  root: string;
}

export const clone = (net: Net): Net => ({ vars: [...net.vars], root: net.root, gates: net.gates.map((g) => ({ ...g, ins: g.ins.map((p) => ({ ...p })) })) });

export const gateOf = (net: Net, id: string): BGate | undefined => net.gates.find((g) => g.id === id);
const isGate = (net: Net, s: string) => net.gates.some((g) => g.id === s);

/** The pins fed by a signal (a gate's output or a variable). */
export function consumers(net: Net, signal: string): { gate: BGate; pin: number }[] {
  const out: { gate: BGate; pin: number }[] = [];
  for (const g of net.gates) g.ins.forEach((p, pin) => p.src === signal && out.push({ gate: g, pin }));
  return out;
}

// ---------------------------------------------------------------------------------------------
// Evaluation

export function evalNet(net: Net, env: Record<string, number>): number {
  const memo = new Map<string, number>();
  const value = (s: string): number => {
    const g = gateOf(net, s);
    if (!g) return env[s] ? 1 : 0;
    const known = memo.get(s);
    if (known !== undefined) return known;
    const ins = g.ins.map((p) => value(p.src) ^ (p.inv ? 1 : 0));
    const raw = g.kind === 'and' ? +ins.every(Boolean) : +ins.some(Boolean);
    const v = raw ^ (g.outInv ? 1 : 0);
    memo.set(s, v);
    return v;
  };
  return value(net.root);
}

/** The value on every wire, for colouring: after each gate's output bubble, and at each pin before and after its bubble. */
export interface WireValues {
  /** Value of each signal (a variable, or a gate's output after its bubble). */
  signal: Record<string, number>;
  /** Value of each gate's body (before the output bubble). */
  body: Record<string, number>;
}

export function wireValues(net: Net, env: Record<string, number>): WireValues {
  const signal: Record<string, number> = {};
  const body: Record<string, number> = {};
  for (const v of net.vars) signal[v] = env[v] ? 1 : 0;
  const rec = (id: string): number => {
    if (signal[id] !== undefined) return signal[id]!;
    const g = gateOf(net, id)!;
    const ins = g.ins.map((p) => rec(p.src) ^ (p.inv ? 1 : 0));
    const raw = g.kind === 'and' ? +ins.every(Boolean) : +ins.some(Boolean);
    body[id] = raw;
    signal[id] = raw ^ (g.outInv ? 1 : 0);
    return signal[id]!;
  };
  rec(net.root);
  return { signal, body };
}

export function rowEnv(vars: string[], m: number): Record<string, number> {
  return Object.fromEntries(vars.map((v, i) => [v, (m >> (vars.length - 1 - i)) & 1]));
}

export interface Comparison {
  rows: { m: number; original: number; now: number; same: boolean }[];
  same: boolean;
  differing: number;
  /** The first row that differs, if any. */
  counterexample?: { m: number; env: Record<string, number>; original: number; now: number };
}

export function compare(original: Net, now: Net): Comparison {
  const vars = original.vars;
  const rows = Array.from({ length: 2 ** vars.length }, (_, m) => {
    const env = rowEnv(vars, m);
    const a = evalNet(original, env);
    const b = evalNet(now, env);
    return { m, original: a, now: b, same: a === b };
  });
  const bad = rows.find((r) => !r.same);
  return {
    rows,
    same: !bad,
    differing: rows.filter((r) => !r.same).length,
    counterexample: bad && { m: bad.m, env: rowEnv(vars, bad.m), original: bad.original, now: bad.now },
  };
}

// ---------------------------------------------------------------------------------------------
// Moves

export interface MoveResult {
  net: Net;
  /** What happened, in a sentence. */
  say: string;
  /** Slots that changed, for the animation: 'out' or the pin number. */
  changed: { gate: string; slot: 'out' | number; on: boolean }[];
  /** Wires whose two bubbles cancelled. */
  cancelled: { gate: string; pin: number }[];
}

/** The standard name of a gate drawn with the given kind and bubbles, if it has one. */
export function gateName(g: BGate): string | undefined {
  const allIn = g.ins.every((p) => p.inv);
  const noIn = g.ins.every((p) => !p.inv);
  if (noIn) return g.kind === 'and' ? (g.outInv ? 'NAND' : 'AND') : g.outInv ? 'NOR' : 'OR';
  if (allIn) {
    if (g.kind === 'and') return g.outInv ? 'OR' : 'NOR';
    return g.outInv ? 'AND' : 'NAND';
  }
  return undefined;
}

/** Remove pairs of bubbles that meet on a wire. A gate's output bubble is shared by all its pins. */
export function cancelDoubles(net: Net): { net: Net; cancelled: { gate: string; pin: number }[] } {
  const n = clone(net);
  const cancelled: { gate: string; pin: number }[] = [];
  for (const src of n.gates) {
    if (!src.outInv) continue;
    const users = consumers(n, src.id);
    if (users.length > 0 && users.every((u) => u.gate.ins[u.pin]!.inv)) {
      src.outInv = false;
      for (const u of users) {
        u.gate.ins[u.pin]!.inv = false;
        cancelled.push({ gate: u.gate.id, pin: u.pin });
      }
    }
  }
  return { net: n, cancelled };
}

/**
 * De Morgan's move on one gate: dual kind, every pin bubble flipped and the output bubble flipped. Bubbles
 * that then meet on a wire cancel.
 */
export function pushThrough(net: Net, id: string): MoveResult {
  const n = clone(net);
  const g = gateOf(n, id);
  if (!g) throw new Error(`no gate ${id}`);
  const before = gateName(g);
  const changed: MoveResult['changed'] = [{ gate: id, slot: 'out', on: !g.outInv }];
  g.kind = g.kind === 'and' ? 'or' : 'and';
  g.outInv = !g.outInv;
  g.ins.forEach((p, i) => {
    p.inv = !p.inv;
    changed.push({ gate: id, slot: i, on: p.inv });
  });
  const c = cancelDoubles(n);
  const after = gateName(gateOf(c.net, id)!);
  const rule = g.kind === 'or' ? 'AND became OR' : 'OR became AND';
  const an = (w: string) => (/^[AOX]/.test(w) ? 'an' : 'a');
  const it = after ? (after === before ? '. It is the same gate, drawn the other way round' : `. It is now ${an(after)} ${after}`) : '';
  const say = `${before ? `The ${before}` : 'The gate'}: ${rule}, and every bubble on it flipped (De Morgan)${it}${c.cancelled.length ? `. Two bubbles met on a wire and cancelled: ¬¬x = x` : ''}.`;
  return { net: c.net, say, changed, cancelled: c.cancelled };
}

/** Toggle a single bubble (this does change the function). */
export function toggleBubble(net: Net, id: string, slot: 'out' | number): MoveResult {
  const n = clone(net);
  const g = gateOf(n, id)!;
  let on: boolean;
  if (slot === 'out') on = g.outInv = !g.outInv;
  else on = g.ins[slot]!.inv = !g.ins[slot]!.inv;
  const c = cancelDoubles(n);
  return {
    net: c.net,
    say: c.cancelled.length ? 'A bubble met another on the same wire and both vanished: that wire is no longer inverted.' : `A single bubble ${on ? 'added' : 'removed'}: this is not a De Morgan move, so the function may change.`,
    changed: [{ gate: id, slot, on }],
    cancelled: c.cancelled,
  };
}

/**
 * What dragging a bubble across a gate does. An output bubble dragged back goes through its own gate; dragged
 * forward, through the gate it feeds. An input bubble dragged forward goes through its own gate; dragged back,
 * through the gate that feeds it. Returns the gate to transform, or a reason why nothing can happen.
 */
export function dragTarget(net: Net, id: string, slot: 'out' | number, direction: 'back' | 'forward'): { gate: string } | { why: string } {
  const g = gateOf(net, id)!;
  if (slot === 'out') {
    if (direction === 'back') return { gate: id };
    const users = consumers(net, id);
    if (users.length === 0) return { why: 'This is the output of the whole circuit: there is nothing further along to push the bubble through.' };
    if (users.length > 1) return { why: 'This output feeds more than one gate, so its bubble cannot move on as one.' };
    return { gate: users[0]!.gate.id };
  }
  if (direction === 'forward') return { gate: id };
  const src = g.ins[slot]!.src;
  if (!isGate(net, src)) return { why: `${src} is an input of the circuit: a bubble on it stays as a complemented literal.` };
  if (consumers(net, src).length > 1) return { why: `${src} feeds more than one gate, so the bubble cannot move back through it.` };
  return { gate: src };
}

// ---------------------------------------------------------------------------------------------
// Expressions

export function exprOf(net: Net): string {
  /** The gate's expression without its own output bubble or brackets. */
  const inner = (id: string): string => {
    const g = gateOf(net, id)!;
    return g.ins
      .map((p) => {
        const child = gateOf(net, p.src);
        if (!child) return (p.inv ? '¬' : '') + p.src;
        const body = inner(p.src);
        // Bubbles on a wire: an odd number is a ¬; an even number cancels.
        if (p.inv !== child.outInv) return `¬(${body})`;
        // · binds tighter than +, so only a sum inside a product needs brackets.
        return child.kind === g.kind || g.kind === 'or' ? body : `(${body})`;
      })
      .join(g.kind === 'and' ? '·' : ' + ');
  };
  const root = gateOf(net, net.root)!;
  return root.outInv ? `¬(${inner(net.root)})` : inner(net.root);
}

// ---------------------------------------------------------------------------------------------
// Presets

const G = (id: string, kind: Kind, srcs: (string | [string, boolean])[], outInv = false): BGate => ({
  id,
  kind,
  outInv,
  ins: srcs.map((s) => (typeof s === 'string' ? { src: s, inv: false } : { src: s[0], inv: s[1] })),
});

export interface BubblePreset {
  id: string;
  label: string;
  net: Net;
  note: string;
}

export const PRESETS: BubblePreset[] = [
  {
    id: 'nand',
    label: 'NAND',
    net: { vars: ['A', 'B'], root: 'g1', gates: [G('g1', 'and', ['A', 'B'], true)] },
    note: 'Push the bubble at the output back through the AND: it becomes an OR with a bubble on each input. NAND is “either input is 0”.',
  },
  {
    id: 'nor',
    label: 'NOR',
    net: { vars: ['A', 'B'], root: 'g1', gates: [G('g1', 'or', ['A', 'B'], true)] },
    note: 'NOR is “both inputs are 0”: an AND with a bubble on each input.',
  },
  {
    id: 'nandnand',
    label: 'NAND–NAND',
    net: {
      vars: ['A', 'B', 'C', 'D'],
      root: 'g3',
      gates: [G('g1', 'and', ['A', 'B'], true), G('g2', 'and', ['C', 'D'], true), G('g3', 'and', ['g1', 'g2'], true)],
    },
    note: 'Three NANDs. Push the last one back: its input bubbles meet the output bubbles of the first two and cancel, leaving AND, AND, OR. Y = A·B + C·D.',
  },
  {
    id: 'norrnor',
    label: 'NOR–NOR',
    net: {
      vars: ['A', 'B', 'C', 'D'],
      root: 'g3',
      gates: [G('g1', 'or', ['A', 'B'], true), G('g2', 'or', ['C', 'D'], true), G('g3', 'or', ['g1', 'g2'], true)],
    },
    note: 'The dual: three NORs become OR, OR, AND. Y = (A + B)·(C + D), a product of sums.',
  },
  {
    id: 'aoi',
    label: 'AND-OR-INVERT',
    net: { vars: ['A', 'B', 'C'], root: 'g2', gates: [G('g1', 'and', ['A', 'B']), G('g2', 'or', ['g1', 'C'], true)] },
    note: 'A standard CMOS gate, ¬(A·B + C). Push its output bubble back through the OR, then the bubble that lands on the AND’s output back through the AND.',
  },
];

// ---------------------------------------------------------------------------------------------
// Geometry (SVG units)

export const GATE_W = 52;
export const GATE_H = 44;
export const BUBBLE_R = 5;
export const COL_W = 150;
export const ROW_H = 54;
export const LEFT = 64;

export interface GateGeom {
  id: string;
  x: number;
  /** Vertical centre. */
  y: number;
  depth: number;
  /** Where each input wire meets the gate (before the input bubble, at the gate's left edge), and the body's edge at that height. */
  pins: { y: number; edge: number }[];
}

export interface NetGeom {
  width: number;
  height: number;
  vars: { name: string; x: number; y: number }[];
  gates: GateGeom[];
  output: { x: number; y: number };
}

/** Left edge of the body of a gate at a vertical offset from its centre (the OR's back is concave). */
export function bodyEdge(kind: Kind, dy: number): number {
  if (kind === 'and') return 0;
  const t = (GATE_H / 2 - dy) / GATE_H;
  return 24 * t * (1 - t);
}

export function layoutNet(net: Net): NetGeom {
  const depth = new Map<string, number>();
  const d = (s: string): number => {
    const g = gateOf(net, s);
    if (!g) return 0;
    const known = depth.get(s);
    if (known !== undefined) return known;
    const v = 1 + Math.max(...g.ins.map((p) => d(p.src)));
    depth.set(s, v);
    return v;
  };
  d(net.root);
  // Variables in the order the tree reads them, top to bottom.
  const order: string[] = [];
  const visit = (s: string) => {
    const g = gateOf(net, s);
    if (!g) {
      if (!order.includes(s)) order.push(s);
      return;
    }
    g.ins.forEach((p) => visit(p.src));
  };
  visit(net.root);
  const yOfVar = new Map(order.map((v, i) => [v, 30 + i * ROW_H]));
  const yOf = new Map<string, number>();
  const gy = (s: string): number => {
    const g = gateOf(net, s);
    if (!g) return yOfVar.get(s)!;
    const known = yOf.get(s);
    if (known !== undefined) return known;
    const ys = g.ins.map((p) => gy(p.src));
    const v = (Math.min(...ys) + Math.max(...ys)) / 2;
    yOf.set(s, v);
    return v;
  };
  gy(net.root);
  const maxDepth = depth.get(net.root)!;
  const gates: GateGeom[] = net.gates.map((g) => {
    const k = g.ins.length;
    const y = gy(g.id);
    const pinDy = (i: number) => (k === 1 ? 0 : (i - (k - 1) / 2) * Math.min(22, (GATE_H - 8) / (k - 1)));
    return {
      id: g.id,
      x: LEFT + (depth.get(g.id)! - 1) * COL_W + 36,
      y,
      depth: depth.get(g.id)!,
      pins: g.ins.map((_, i) => ({ y: y + pinDy(i), edge: bodyEdge(g.kind, pinDy(i)) })),
    };
  });
  const root = gates.find((g) => g.id === net.root)!;
  return {
    width: LEFT + maxDepth * COL_W + 50,
    height: 30 + (order.length - 1) * ROW_H + 40,
    vars: order.map((name) => ({ name, x: 20, y: yOfVar.get(name)! })),
    gates,
    output: { x: root.x + GATE_W + BUBBLE_R * 2 + 30, y: root.y },
  };
}

/** SVG path of a gate body. */
export function bodyPath(kind: Kind): string {
  const h = GATE_H / 2;
  return kind === 'and'
    ? `M0 ${-h} H${GATE_W - h} A${h} ${h} 0 0 1 ${GATE_W - h} ${h} H0 Z`
    : `M0 ${-h} Q${GATE_W * 0.55} ${-h} ${GATE_W} 0 Q${GATE_W * 0.55} ${h} 0 ${h} Q${GATE_W * 0.23} 0 0 ${-h} Z`;
}
