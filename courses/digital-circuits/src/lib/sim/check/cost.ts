/**
 * Cost metrics for gate golf: gate count, an estimate of the transistors in a static-CMOS
 * implementation, and logic depth.
 */
import type { Circuit, FlatNetlist } from '../netlist/types';
import type { SubResolver } from '../netlist/connect';
import { flatten } from '../netlist/flatten';
import { getDef, pinsOf } from '../netlist/catalog';

export interface Cost {
  /** Logic elements: gates, flip-flops, latches and blocks (switches, indicators and wiring are free). */
  gates: number;
  /** Transistors in a standard static CMOS implementation. */
  transistors: number;
  /** The longest path, in gates, from an input or a storage element to an output or a storage element. */
  depth: number;
  byType: Record<string, number>;
}

const fanin = (params: Record<string, unknown>) => Math.max(2, Math.min(8, Number(params.inputs ?? 2)));

/**
 * Transistor estimates (static CMOS): NOT 2, NAND2/NOR2 4 (2 per input), AND2/OR2 6 (a NAND plus an inverter),
 * XOR2/XNOR2 8 (transmission-gate form), buffer 4, tri-state buffer 8, latches 8–10, D flip-flop 20.
 */
export function transistorsOf(type: string, params: Record<string, unknown>): number {
  const n = fanin(params);
  const bits = (k: string, d: number) => Math.max(1, Number(params[k] ?? d));
  switch (type) {
    case 'not':
      return 2;
    case 'buffer':
      return 4;
    case 'tristate':
      return 8;
    case 'nand':
    case 'nor':
      return 2 * n;
    case 'and':
    case 'or':
      return 2 * n + 2;
    case 'xor':
    case 'xnor':
      return 8 * (n - 1);
    case 'srlatch':
      return 8;
    case 'dlatch':
      return 10;
    case 'dff':
      return 20;
    case 'dffr':
      return 24;
    case 'dffe':
      return 28;
    case 'jkff':
      return 30;
    case 'tff':
      return 24;
    case 'mux':
      return 6 * ((1 << bits('select', 1)) - 1);
    case 'demux':
    case 'decoder':
      return 6 * (1 << bits(type === 'demux' ? 'select' : 'bits', 2));
    case 'encoder':
    case 'priority-encoder':
      return 6 * (1 << bits('bits', 2));
    case 'adder':
      return 28 * bits('bits', 4);
    case 'magnitude-comparator':
      return 30 * bits('bits', 4);
    case 'register':
      return 26 * bits('bits', 4);
    case 'counter':
      return 44 * bits('bits', 4);
    case 'shift-register':
      return 24 * bits('bits', 4);
    case 'lfsr':
      return 24 * bits('bits', 4) + 8;
    case 'ram':
      return 6 * (1 << bits('addrBits', 4)) * bits('dataBits', 8);
    case 'rom':
      return (1 << bits('addrBits', 4)) * bits('dataBits', 8);
    default:
      return 0;
  }
}

const COUNTED = new Set(['gate', 'sequential', 'block']);

export function costOfFlat(flat: FlatNetlist): Cost {
  const byType: Record<string, number> = {};
  let gates = 0;
  let transistors = 0;
  const counted = flat.elements.filter((e) => {
    const cat = getDef(e.type)?.category;
    return cat !== undefined && COUNTED.has(cat);
  });
  for (const e of counted) {
    gates++;
    transistors += transistorsOf(e.type, e.params);
    byType[e.type] = (byType[e.type] ?? 0) + 1;
  }
  return { gates, transistors, depth: depthOf(flat, new Set(counted.map((e) => e.id))), byType };
}

/** Longest chain of counted elements; storage elements start and end paths. */
function depthOf(flat: FlatNetlist, counted: Set<string>): number {
  const driver = new Map<number, number>();
  flat.elements.forEach((e, i) => {
    if (!counted.has(e.id)) return;
    const pins = pinsOf(getDef(e.type)!, e.params);
    pins.forEach((p, k) => {
      if (p.dir === 'out') driver.set(e.pins[k]!, i);
    });
  });
  const memo = new Map<number, number>();
  const visiting = new Set<number>();
  const level = (i: number): number => {
    const known = memo.get(i);
    if (known !== undefined) return known;
    if (visiting.has(i)) return 0; // a feedback loop: cut it here
    const e = flat.elements[i]!;
    const def = getDef(e.type)!;
    if (def.category === 'sequential') return 1;
    visiting.add(i);
    let best = 0;
    pinsOf(def, e.params).forEach((p, k) => {
      if (p.dir === 'out') return;
      const d = driver.get(e.pins[k]!);
      if (d !== undefined && getDef(flat.elements[d]!.type)!.category !== 'sequential') best = Math.max(best, level(d));
    });
    visiting.delete(i);
    memo.set(i, best + 1);
    return best + 1;
  };
  let depth = 0;
  for (const i of driver.values()) depth = Math.max(depth, level(i));
  return depth;
}

/** Cost of a drawn circuit, subcircuits and parts-bin parts expanded. */
export function costOf(circuit: Circuit, parts?: SubResolver): Cost {
  return costOfFlat(flatten(circuit, parts));
}
