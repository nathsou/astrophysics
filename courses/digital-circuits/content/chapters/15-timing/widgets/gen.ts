/**
 * The drawn circuits of the glitch hunt, generated from gate networks with Chapter 11's layered layout.
 *
 * `circuits.test.ts` checks that the JSON files under `circuits/` are exactly what this module produces
 * (and rewrites them when the environment variable GEN_CIRCUITS is set), so the pictures and the networks
 * they come from cannot drift apart. Nothing in the page imports this file.
 */
import { layoutDag, type Dag, type GateKind } from '../../11-boolean-algebra/widgets/layout';
import type { Circuit } from '$lib/sim/netlist/types';

interface Net {
  file: string;
  title: string;
  inputs: string[];
  /** Initial input values. */
  values: Record<string, boolean>;
  gates: { id: string; kind: GateKind; inputs: string[] }[];
  /** The signal that is the output. */
  out: string;
  /** Gate ids drawn with a label (the rest get none). */
  labels?: string[];
}

const NOT_DELAY = 2;

export const NETS: Net[] = [
  {
    file: 'race',
    title: 'A signal racing its own inverse',
    inputs: ['A'],
    values: { A: false },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: 'Y', kind: 'and', inputs: ['A', "A′"] },
    ],
    out: 'Y',
    labels: ["A′"],
  },
  {
    file: 'sop-hazard',
    title: 'Sum of products with a hazard',
    inputs: ['A', 'B', 'C'],
    values: { A: true, B: true, C: true },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: 'A·B', kind: 'and', inputs: ['A', 'B'] },
      { id: 'A′·C', kind: 'and', inputs: ['A′', 'C'] },
      { id: 'F', kind: 'or', inputs: ['A·B', 'A′·C'] },
    ],
    out: 'F',
    labels: ["A′", 'A·B', 'A′·C'],
  },
  {
    file: 'sop-fixed',
    title: 'The same function with the consensus term',
    inputs: ['A', 'B', 'C'],
    values: { A: true, B: true, C: true },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: 'A·B', kind: 'and', inputs: ['A', 'B'] },
      { id: 'A′·C', kind: 'and', inputs: ['A′', 'C'] },
      { id: 'B·C', kind: 'and', inputs: ['B', 'C'] },
      { id: 'F', kind: 'or', inputs: ['A·B', 'A′·C', 'B·C'] },
    ],
    out: 'F',
    labels: ["A′", 'A·B', 'A′·C', 'B·C'],
  },
  {
    file: 'pos-hazard',
    title: 'Product of sums with a hazard',
    inputs: ['A', 'B', 'C'],
    values: { A: true, B: true, C: true },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: 'A+B', kind: 'or', inputs: ['A', 'B'] },
      { id: 'A′+C', kind: 'or', inputs: ['A′', 'C'] },
      { id: 'F', kind: 'and', inputs: ['A+B', 'A′+C'] },
    ],
    out: 'F',
    labels: ["A′", 'A+B', 'A′+C'],
  },
  {
    file: 'pos-fixed',
    title: 'The product of sums with the consensus term',
    inputs: ['A', 'B', 'C'],
    values: { A: true, B: true, C: true },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: 'A+B', kind: 'or', inputs: ['A', 'B'] },
      { id: 'A′+C', kind: 'or', inputs: ['A′', 'C'] },
      { id: 'B+C', kind: 'or', inputs: ['B', 'C'] },
      { id: 'F', kind: 'and', inputs: ['A+B', 'A′+C', 'B+C'] },
    ],
    out: 'F',
    labels: ["A′", 'A+B', 'A′+C', 'B+C'],
  },
  {
    file: 'mux-hazard',
    title: 'A multiplexer from NAND gates',
    inputs: ['S', 'A', 'B'],
    values: { S: false, A: false, B: false },
    gates: [
      { id: 'S′', kind: 'not', inputs: ['S'] },
      { id: 'p', kind: 'nand', inputs: ['A', 'S′'] },
      { id: 'q', kind: 'nand', inputs: ['B', 'S'] },
      { id: 'Y', kind: 'nand', inputs: ['p', 'q'] },
    ],
    out: 'Y',
    labels: ['S′', 'p', 'q'],
  },
  {
    file: 'mux-fixed',
    title: 'The multiplexer with a third NAND',
    inputs: ['S', 'A', 'B'],
    values: { S: false, A: false, B: false },
    gates: [
      { id: 'S′', kind: 'not', inputs: ['S'] },
      { id: 'p', kind: 'nand', inputs: ['A', 'S′'] },
      { id: 'q', kind: 'nand', inputs: ['B', 'S'] },
      { id: 'r', kind: 'nand', inputs: ['A', 'B'] },
      { id: 'Y', kind: 'nand', inputs: ['p', 'q', 'r'] },
    ],
    out: 'Y',
    labels: ['S′', 'p', 'q', 'r'],
  },
  {
    file: 'four-hazard',
    title: 'Three terms, four inputs',
    inputs: ['A', 'B', 'C', 'D'],
    values: { A: false, B: false, C: false, D: false },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: "B′", kind: 'not', inputs: ['B'] },
      { id: 'A·B', kind: 'and', inputs: ['A', 'B'] },
      { id: 'A′·C', kind: 'and', inputs: ['A′', 'C'] },
      { id: 'B′·D', kind: 'and', inputs: ['B′', 'D'] },
      { id: 'F', kind: 'or', inputs: ['A·B', 'A′·C', 'B′·D'] },
    ],
    out: 'F',
    labels: ["A′", "B′", 'A·B', 'A′·C', 'B′·D'],
  },
  {
    file: 'four-fixed',
    title: 'Three terms, four inputs, with the consensus terms',
    inputs: ['A', 'B', 'C', 'D'],
    values: { A: false, B: false, C: false, D: false },
    gates: [
      { id: "A′", kind: 'not', inputs: ['A'] },
      { id: "B′", kind: 'not', inputs: ['B'] },
      { id: 'A·B', kind: 'and', inputs: ['A', 'B'] },
      { id: 'A′·C', kind: 'and', inputs: ['A′', 'C'] },
      { id: 'B′·D', kind: 'and', inputs: ['B′', 'D'] },
      { id: 'B·C', kind: 'and', inputs: ['B', 'C'] },
      { id: 'A·D', kind: 'and', inputs: ['A', 'D'] },
      { id: 'F', kind: 'or', inputs: ['A·B', 'A′·C', 'B′·D', 'B·C', 'A·D'] },
    ],
    out: 'F',
    labels: ["A′", "B′", 'A·B', 'A′·C', 'B′·D', 'B·C', 'A·D'],
  },
];

/** Draw one network as a circuit for the page: friendly ids, inverter delays, one lamp. */
export function build(net: Net): Circuit {
  const dag: Dag = { inputs: net.inputs, gates: net.gates, outputs: [{ name: net.out, signal: net.out }] };
  const c = layoutDag(dag, { title: net.title, values: net.values, gateLabels: true });
  // layoutDag numbers the gates g1, g2, … in the order of the network, and names inputs in_X and outputs out_X.
  const gateId = new Map(net.gates.map((g, i) => [`g${i + 1}`, g.id]));
  const labelled = new Set(net.labels ?? []);
  for (const p of c.components) {
    if (gateId.has(p.id)) {
      const name = gateId.get(p.id)!;
      p.id = name;
      p.label = labelled.has(name) ? name : '';
      if (p.type === 'not') p.params = { ...p.params, delay: NOT_DELAY };
    } else if (p.id.startsWith('in_')) p.id = p.id.slice(3);
    else if (p.id.startsWith('out_')) p.id = 'lamp';
  }
  return c;
}
