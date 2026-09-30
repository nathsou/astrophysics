/**
 * Design on the left, chip on the right: a design's hierarchy (modules that own outputs) and where the course's real
 * vCPLD-32 fitter put each output. `mode: 'spread'` pins the outputs round-robin over the four function blocks, the
 * opposite of what the fitter does when left alone, to show what packing buys (fewer signals through the
 * interconnect matrix) and what it does not change (the delays).
 */
import { bcdDisplayDesign, fitCpld, trafficDesign, designFromEquations, type CpldDesign, type CpldFit } from '$lib/pld/cpld';
import { FB_INPUTS, FUNCTION_BLOCKS, MACROCELLS_PER_FB } from '$lib/pld/devices/vcpld32-arch';

export type FloorMode = 'fitter' | 'spread';

/** A module of the design hierarchy: it owns outputs and/or sub-modules. */
export interface ModuleNode {
  id: string;
  label: string;
  outputs?: string[];
  children?: ModuleNode[];
}

export interface FloorDesign {
  id: string;
  label: string;
  story: string;
  design(): CpldDesign;
  tree: ModuleNode;
}

const leaves = (names: string[]): string[] => names;

function adder8Design(): CpldDesign {
  const eq: string[] = [];
  for (let i = 0; i < 8; i++) {
    const cin = i === 0 ? 'CIN' : `C${i}`;
    if (i < 7) eq.push(`C${i + 1} = A${i} & B${i} | A${i} & ${cin} | B${i} & ${cin}`);
    eq.push(`S${i} = A${i} ^ B${i} ^ ${cin}`);
  }
  eq.push('COUT = A7 & B7 | A7 & C7 | B7 & C7');
  const inputs = [...Array.from({ length: 8 }, (_, i) => `A${i}`), ...Array.from({ length: 8 }, (_, i) => `B${i}`), 'CIN'];
  return designFromEquations(eq.join('\n'), { inputs, buried: Array.from({ length: 7 }, (_, i) => `C${i + 1}`), title: '8-bit adder with buried carries', usercode: 'ADD8' });
}

export const DESIGNS: readonly FloorDesign[] = [
  {
    id: 'bcd',
    label: 'BCD counter and display',
    story: 'A decade counter (four registers) drives a seven-segment decoder (seven combinational outputs). Two modules, eleven macrocells.',
    design: bcdDisplayDesign,
    tree: {
      id: 'top',
      label: 'bcd_display',
      children: [
        { id: 'counter', label: 'counter', outputs: ['Q3', 'Q2', 'Q1', 'Q0'] },
        { id: 'decoder', label: 'decoder', outputs: leaves(['Sa', 'Sb', 'Sc', 'Sd', 'Se', 'Sf', 'Sg']) },
      ],
    },
  },
  {
    id: 'traffic',
    label: 'Traffic light',
    story: 'The state machine of Chapter 19: two state registers and six lamps decoded from them.',
    design: trafficDesign,
    tree: {
      id: 'top',
      label: 'traffic',
      children: [
        { id: 'state', label: 'state', outputs: ['Q1', 'Q0'] },
        { id: 'main', label: 'main road lamps', outputs: ['MG', 'MA', 'MR'] },
        { id: 'side', label: 'side road lamps', outputs: ['SG', 'SA', 'SR'] },
      ],
    },
  },
  {
    id: 'adder8',
    label: '8-bit adder',
    story: 'Eight bit slices, each a sum and a carry. The carries C1 to C7 are buried macrocells: they use no pin, but they are macrocells all the same. Sixteen macrocells, so two blocks at least.',
    design: adder8Design,
    tree: {
      id: 'top',
      label: 'adder8',
      children: Array.from({ length: 8 }, (_, i) => ({
        id: `slice${i}`,
        label: `slice ${i}`,
        outputs: i < 7 ? [`C${i + 1}`, `S${i}`] : ['S7', 'COUT'],
      })),
    },
  },
];

export interface CellView {
  fb: number;
  mc: number;
  name: string;
  kind: 'D' | 'T' | 'comb';
  buried: boolean;
  terms: number;
  borrowed: number;
  lent: number;
  /** Module id path from the top, e.g. ['top', 'counter']. */
  path: string[];
  /** Combinational macrocells a signal crosses before this output (each adds tFB). */
  depth: number;
  tpd: number | undefined;
  /** The stored sum of products, and the signals it reads. */
  sum: string;
  polarity: 'high' | 'low';
  reads: string[];
}

export interface FbView {
  fb: number;
  inputs: number;
  inputNames: string[];
  cells: (CellView | null)[];
  termsUsed: number;
}

export interface FloorResult {
  fit: CpldFit;
  fbs: FbView[];
  moduleOf: Record<string, string[]>;
  totals: { macrocells: number; blockInputs: number; blockInputCapacity: number; borrowed: number; tpd: number; fmax: number; tsu: number; tco: number };
}

/** The path of module ids that lead to an output. */
export function modulePath(tree: ModuleNode, output: string, prefix: string[] = []): string[] | null {
  const here = [...prefix, tree.id];
  if (tree.outputs?.includes(output)) return here;
  for (const c of tree.children ?? []) {
    const p = modulePath(c, output, here);
    if (p) return p;
  }
  return null;
}

export function moduleNodes(tree: ModuleNode, depth = 0): { node: ModuleNode; depth: number }[] {
  return [{ node: tree, depth }, ...(tree.children ?? []).flatMap((c) => moduleNodes(c, depth + 1))];
}

/** Every output below a module. */
export function outputsOf(node: ModuleNode): string[] {
  return [...(node.outputs ?? []), ...(node.children ?? []).flatMap(outputsOf)];
}

export function floorplan(d: FloorDesign, mode: FloorMode): FloorResult {
  const design = d.design();
  if (mode === 'spread') {
    // Output k goes to macrocell floor(k / 4) of block k mod 4: consecutive outputs land in different blocks.
    design.outputs.forEach((o, k) => {
      o.pin = (k % FUNCTION_BLOCKS) * MACROCELLS_PER_FB + Math.floor(k / FUNCTION_BLOCKS);
    });
  }
  const fit = fitCpld(design);
  const fbs: FbView[] = fit.fbs.map((f) => ({
    fb: f.fb,
    inputs: f.inputsUsed,
    inputNames: f.inputNames,
    termsUsed: f.termsUsed,
    cells: Array.from({ length: MACROCELLS_PER_FB }, (_, mc) => {
      const o = fit.outputs.find((x) => x.fb === f.fb && x.mc === mc);
      if (!o) return null;
      return {
        fb: f.fb,
        mc,
        name: o.name,
        kind: o.ff,
        buried: o.buried,
        terms: o.terms,
        borrowed: o.borrowed,
        lent: o.lent,
        path: modulePath(d.tree, o.name) ?? [d.tree.id],
        depth: o.timing.combDepth,
        tpd: o.timing.tpd,
        sum: o.sum,
        polarity: o.polarity,
        reads: o.reads,
      };
    }),
  }));
  const moduleOf: Record<string, string[]> = {};
  for (const o of fit.outputs) moduleOf[o.name] = modulePath(d.tree, o.name) ?? [d.tree.id];
  const t = fit.timing;
  return {
    fit,
    fbs,
    moduleOf,
    totals: {
      macrocells: fit.utilisation.macrocells,
      blockInputs: fit.utilisation.blockInputs,
      blockInputCapacity: fit.utilisation.blockInputCapacity,
      borrowed: fit.utilisation.borrowedTerms,
      tpd: t.worstTpd,
      fmax: t.fmaxMHz,
      tsu: t.worstTsu,
      tco: t.worstTco,
    },
  };
}

export const BLOCK_INPUTS = FB_INPUTS;
