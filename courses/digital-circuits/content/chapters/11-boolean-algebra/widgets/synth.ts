/**
 * From a truth table to a gate network: canonical sum of products (one AND per row with a 1, one OR),
 * canonical product of sums (one OR per row with a 0, one AND), and the minimised sum of products of
 * Chapter 12. The network is a `Dag` for layout.ts, which draws it and simulates it.
 */
import { ONE, ZERO, getVar, mintermCube, quineMcCluskey, type Cube } from '$lib/pld/twolevel';
import { countGates, gateInputs, type Dag, type DagGate } from './layout';

export const NAMES = ['A', 'B', 'C', 'D'];

export type Form = 'sop' | 'pos' | 'min';

/** A literal of a term: variable index and whether it is complemented. */
export interface Lit {
  v: number;
  neg: boolean;
}

export interface Synth {
  form: Form;
  n: number;
  names: string[];
  /** The terms: products for 'sop' and 'min', sums for 'pos'. Empty when the function is constant. */
  terms: Lit[][];
  /** Constant function ('0' or '1'), if it is one. */
  constant?: '0' | '1';
  dag: Dag;
  /** Gates and gate inputs, of the drawn network. */
  gates: number;
  inverters: number;
  gateInputs: number;
}

export const rowCount = (n: number) => 2 ** n;

/** The bit of variable `v` (0 = A, the most significant) in row `m`. */
export const bitOf = (m: number, v: number, n: number): number => (m >> (n - 1 - v)) & 1;

export function ones(outs: number[]): number[] {
  return outs.flatMap((o, m) => (o ? [m] : []));
}
export function zeros(outs: number[]): number[] {
  return outs.flatMap((o, m) => (o ? [] : [m]));
}

export function litsOfCube(c: Cube, n: number, flip: boolean): Lit[] {
  const out: Lit[] = [];
  for (let v = 0; v < n; v++) {
    const f = getVar(c, v);
    if (f === ONE) out.push({ v, neg: flip });
    else if (f === ZERO) out.push({ v, neg: !flip });
  }
  return out;
}

/** Chunk `signals` into gates of at most `fan` inputs, level by level, until one signal is left. */
function wide(gates: DagGate[], kind: 'and' | 'or', signals: string[], fan: number, prefix: string): string {
  let level = signals;
  let k = 0;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += fan) {
      const group = level.slice(i, i + fan);
      if (group.length === 1) next.push(group[0]!);
      else {
        const id = `${prefix}${k++}`;
        gates.push({ id, kind, inputs: group });
        next.push(id);
      }
    }
    level = next;
  }
  return level[0]!;
}

/**
 * The two-level network of a list of terms. For a sum of products every term is an AND of literals and
 * the terms are ORed; for a product of sums the roles swap. `fan` limits the fan-in of the gates.
 */
export function twoLevelDag(n: number, names: string[], terms: Lit[][], outer: 'or' | 'and', fan = 4, outName = 'Y'): Dag {
  const inner = outer === 'or' ? 'and' : 'or';
  const gates: DagGate[] = [];
  const inputs = names.slice(0, n);
  const inverted = new Map<number, string>();
  const literal = (l: Lit): string => {
    if (!l.neg) return inputs[l.v]!;
    let id = inverted.get(l.v);
    if (!id) {
      id = `n${l.v}`;
      gates.push({ id, kind: 'not', inputs: [inputs[l.v]!] });
      inverted.set(l.v, id);
    }
    return id;
  };
  let signal: string;
  if (terms.length === 0) signal = outer === 'or' ? '0' : '1';
  else {
    const termSignals = terms.map((t, i) => (t.length === 0 ? (inner === 'and' ? '1' : '0') : wide(gates, inner, t.map(literal), fan, `t${i}_`)));
    signal = termSignals.length === 1 ? termSignals[0]! : wide(gates, outer, termSignals, fan, 'o');
  }
  return { inputs, gates, outputs: [{ name: outName, signal }] };
}

export function synthesise(n: number, outs: number[], form: Form, names = NAMES): Synth {
  const on = ones(outs);
  const off = zeros(outs);
  let terms: Lit[][];
  let outer: 'or' | 'and';
  let constant: '0' | '1' | undefined;
  if (form === 'sop') {
    outer = 'or';
    terms = on.map((m) => litsOfCube(mintermCube(m, n), n, false));
    if (on.length === 0) constant = '0';
  } else if (form === 'pos') {
    outer = 'and';
    // A maxterm is 0 in exactly one row: the sum of the literals that are 0 in that row.
    terms = off.map((m) => litsOfCube(mintermCube(m, n), n, true));
    if (off.length === 0) constant = '1';
  } else {
    outer = 'or';
    if (on.length === 0) {
      terms = [];
      constant = '0';
    } else if (off.length === 0) {
      terms = [[]];
      constant = '1';
    } else {
      const q = quineMcCluskey(n, on, []);
      terms = q.cover.cubes.map((c) => litsOfCube(c, n, false));
    }
  }
  const dag = twoLevelDag(n, names, terms, outer);
  const counts = countGates(dag);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { form, n, names: names.slice(0, n), terms, constant, dag, gates: total, inverters: counts.not ?? 0, gateInputs: gateInputs(dag) };
}

/** The expression of a synthesis as tokens for display: a literal, or joining text. */
export type Token = { t: 'lit'; name: string; neg: boolean } | { t: 'op'; text: string };

export function tokens(s: Synth): Token[] {
  if (s.constant) return [{ t: 'op', text: s.constant }];
  const out: Token[] = [];
  const product = s.form !== 'pos';
  s.terms.forEach((term, i) => {
    if (i > 0) out.push({ t: 'op', text: product ? ' + ' : ' ' });
    const wrap = !product && s.terms.length > 1;
    if (wrap) out.push({ t: 'op', text: '(' });
    term.forEach((l, j) => {
      if (j > 0) out.push({ t: 'op', text: product ? '·' : ' + ' });
      out.push({ t: 'lit', name: s.names[l.v]!, neg: l.neg });
    });
    if (term.length === 0) out.push({ t: 'op', text: '1' });
    if (wrap) out.push({ t: 'op', text: ')' });
  });
  return out;
}

/** Plain text of the expression, for aria labels and tests: ¬ for NOT. */
export function expressionText(s: Synth): string {
  return tokens(s)
    .map((t) => (t.t === 'op' ? t.text : (t.neg ? '¬' : '') + t.name))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// Presets

export interface Preset {
  id: string;
  label: string;
  n: number;
  /** Output for each row (A is the most significant bit). */
  fn: (bits: number[]) => number;
  note: string;
}

const pop = (b: number[]) => b.reduce((a, x) => a + x, 0);

export const PRESETS: Preset[] = [
  { id: 'and', label: 'AND', n: 2, fn: (b) => b[0]! & b[1]!, note: 'One row with a 1, so one product term.' },
  { id: 'xor', label: 'XOR', n: 2, fn: (b) => b[0]! ^ b[1]!, note: 'Two rows, two terms: A·B̄ + Ā·B. XOR cannot be simplified further as a sum of products.' },
  { id: 'majority', label: 'Majority', n: 3, fn: (b) => +(pop(b) >= 2), note: 'Carry out of a full adder: at least two of the three inputs are 1.' },
  { id: 'sum', label: 'Full-adder sum', n: 3, fn: (b) => pop(b) & 1, note: 'Odd parity of three inputs: four terms, none of which merge.' },
  { id: 'mux', label: 'Multiplexer', n: 3, fn: (b) => (b[2] ? b[1]! : b[0]!), note: 'C chooses: Y = B when C = 1, and A when C = 0.' },
  { id: 'ge', label: '2-bit A ≥ B', n: 4, fn: (b) => +(b[0]! * 2 + b[1]! >= b[2]! * 2 + b[3]!), note: 'A = AB, B = CD as two-bit numbers: ten rows are 1.' },
  { id: 'parity4', label: '4-bit parity', n: 4, fn: (b) => pop(b) & 1, note: 'Eight terms of four literals each: the worst case for a sum of products.' },
];

export function outsOfPreset(p: Preset): number[] {
  return Array.from({ length: 2 ** p.n }, (_, m) => p.fn(Array.from({ length: p.n }, (_, v) => bitOf(m, v, p.n))));
}
