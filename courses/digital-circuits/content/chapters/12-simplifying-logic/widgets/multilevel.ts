/**
 * Two-level against multi-level: the same function as a sum of products (minimised, two layers of gates) and
 * as a factored, multi-level network, drawn side by side and measured.
 */
import { quineMcCluskey } from '$lib/pld/twolevel';
import { transistorsOf } from '$lib/sim/check';
import { evalDag, type Dag, type DagGate } from '../../11-boolean-algebra/widgets/layout';
import { litsOfCube, twoLevelDag } from '../../11-boolean-algebra/widgets/synth';
import { bitOf } from '../../11-boolean-algebra/widgets/synth';

export interface Metrics {
  gates: number;
  gateInputs: number;
  transistors: number;
  /** Longest path, in gates. */
  depth: number;
  /** Literals in the expression: gate inputs that come from a variable. */
  literals: number;
}

export interface Example {
  id: string;
  label: string;
  vars: string[];
  /** The function as a minimal sum of products text, for display. */
  flat: string;
  /** The factored form, for display. */
  factored: string;
  /** The multi-level network, output signal `Y`. */
  multi: Dag;
  /** Minterms of the function, for building the two-level circuit. */
  on: number[];
  note: string;
}

const g = (id: string, kind: DagGate['kind'], inputs: string[]): DagGate => ({ id, kind, inputs });
const truth = (n: number, dag: Dag): number[] => Array.from({ length: 2 ** n }, (_, m) => evalDag(dag, Object.fromEntries(dag.inputs.map((v, i) => [v, bitOf(m, i, n)]))).Y!);

function onOf(n: number, dag: Dag): number[] {
  return truth(n, dag).flatMap((v, m) => (v ? [m] : []));
}

const mk = (id: string, label: string, vars: string[], flat: string, factored: string, gates: DagGate[], note: string): Example => {
  const multi: Dag = { inputs: vars, gates, outputs: [{ name: 'Y', signal: gates[gates.length - 1]!.id }] };
  return { id, label, vars, flat, factored, multi, on: onOf(vars.length, multi), note };
};

export const EXAMPLES: Example[] = [
  mk('common', 'A common factor', ['A', 'B', 'C', 'D'], 'A·B + A·C + A·D', 'A·(B + C + D)', [g('o', 'or', ['B', 'C', 'D']), g('y', 'and', ['A', 'o'])], 'A appears in every term, so it can be taken out once: an OR and an AND instead of three ANDs and an OR.'),
  mk('product', 'Two sums multiplied', ['A', 'B', 'C', 'D'], 'A·C + A·D + B·C + B·D', '(A + B)·(C + D)', [g('s1', 'or', ['A', 'B']), g('s2', 'or', ['C', 'D']), g('y', 'and', ['s1', 's2'])], 'Four terms of two literals against three gates with four literals in all. No Karnaugh map or Quine–McCluskey run will find this: it is a different kind of simplification.'),
  mk('majority', 'Majority', ['A', 'B', 'C'], 'A·B + A·C + B·C', 'A·B + C·(A + B)', [g('a', 'and', ['A', 'B']), g('o', 'or', ['A', 'B']), g('c', 'and', ['C', 'o']), g('y', 'or', ['a', 'c'])], 'The carry of a full adder. With three-input gates both forms take four gates, but the factored one has fewer gate inputs and transistors, at the price of one more level of delay.'),
  mk('parity', '4-bit parity', ['A', 'B', 'C', 'D'], 'eight terms of four literals', 'A ⊕ B ⊕ C ⊕ D', [g('x1', 'xor', ['A', 'B']), g('x2', 'xor', ['C', 'D']), g('y', 'xor', ['x1', 'x2'])], 'The worst case for two levels. Every extra input doubles the sum of products, but adds just one XOR to the tree.'),
];

/** The minimal two-level network of an example. */
export function twoLevel(e: Example): Dag {
  const n = e.vars.length;
  const q = quineMcCluskey(n, e.on, [], { traceLimit: 0 });
  const terms = q.cover.cubes.map((c) => litsOfCube(c, n, false));
  return twoLevelDag(n, e.vars, terms, 'or');
}

export function prefixed(d: Dag, p: string, out: string): Dag {
  const rename = (s: string) => (d.gates.some((x) => x.id === s) ? p + s : s);
  return { inputs: d.inputs, gates: d.gates.map((x) => ({ ...x, id: p + x.id, inputs: x.inputs.map(rename) })), outputs: [{ name: out, signal: rename(d.outputs[0]!.signal) }] };
}

/** Both networks in one drawing, sharing the inputs. */
export function both(e: Example): { dag: Dag; order: string[] } {
  const a = prefixed(twoLevel(e), 's_', 'two levels');
  const b = prefixed(e.multi, 'm_', 'factored');
  return {
    dag: { inputs: e.vars, gates: [...a.gates, ...b.gates], outputs: [...a.outputs, ...b.outputs] },
    order: [...a.gates.map((x) => x.id), ...b.gates.map((x) => x.id)],
  };
}

export function metrics(d: Dag): Metrics {
  const byId = new Map(d.gates.map((x) => [x.id, x]));
  const seen = new Set<string>();
  const depth = new Map<string, number>();
  const visit = (s: string): number => {
    const x = byId.get(s);
    if (!x) return 0;
    seen.add(s);
    const known = depth.get(s);
    if (known !== undefined) return known;
    const v = 1 + Math.max(0, ...x.inputs.map(visit));
    depth.set(s, v);
    return v;
  };
  const dmax = Math.max(0, ...d.outputs.map((o) => visit(o.signal)));
  const used = d.gates.filter((x) => seen.has(x.id));
  return {
    gates: used.length,
    gateInputs: used.reduce((s, x) => s + x.inputs.length, 0),
    transistors: used.reduce((s, x) => s + transistorsOf(x.kind, x.kind === 'not' || x.kind === 'buffer' ? {} : { inputs: x.inputs.length }), 0),
    depth: dmax,
    literals: used.reduce((s, x) => s + x.inputs.filter((i) => !byId.has(i)).length, 0),
  };
}
