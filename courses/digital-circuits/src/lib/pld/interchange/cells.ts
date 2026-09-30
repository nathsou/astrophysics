/**
 * The Yosys internal cell types the writer emits (`$add`, `$mux`, `$dff`, `$mem_v2`, …): their ports and the
 * width each port must have, given the cell's parameters. The definitions are those of the Yosys manual
 * (*Internal cell library*). The validator and the netlist evaluator share them with the writer.
 */
import type { YosysDirection, YosysValue } from './types';

/** The integer value of a parameter: a number, or a binary string written most significant bit first. */
export function paramInt(v: YosysValue | undefined): number {
  if (v === undefined) return NaN;
  if (typeof v === 'number') return v;
  const s = v.trim();
  return /^[01]+$/.test(s) ? parseInt(s, 2) : NaN;
}

/** A 32-bit integer parameter, the way Yosys writes it. */
export function intParam(n: number): string {
  return (n >>> 0).toString(2).padStart(32, '0');
}

/** A bit-vector parameter from its bits, least significant first: the string is most significant first. */
export function bitsParam(bits: (0 | 1)[]): string {
  return bits.slice().reverse().join('');
}

/**
 * A string parameter or attribute. Text made only of 0, 1, x and z gets a trailing space, as Yosys writes it,
 * so that it is not read back as a binary number.
 */
export function textParam(s: string): string {
  return /^[01xz]*$/.test(s) ? `${s} ` : s;
}

type P = (name: string) => number;

export interface InternalCellSpec {
  inputs: string[];
  outputs: string[];
  /** The width the port must have, or undefined for a port the type does not have. */
  width(port: string, p: P): number | undefined;
}

/** Cells with ports A, B and Y, and parameters A_WIDTH, B_WIDTH and Y_WIDTH. */
const arith: InternalCellSpec = {
  inputs: ['A', 'B'],
  outputs: ['Y'],
  width: (port, p) => ({ A: p('A_WIDTH'), B: p('B_WIDTH'), Y: p('Y_WIDTH') })[port as 'A' | 'B' | 'Y'],
};
const unary: InternalCellSpec = {
  inputs: ['A'],
  outputs: ['Y'],
  width: (port, p) => ({ A: p('A_WIDTH'), Y: p('Y_WIDTH') })[port as 'A' | 'Y'],
};

export const INTERNAL_CELLS: Record<string, InternalCellSpec> = {
  $add: arith,
  $sub: arith,
  $mul: arith,
  $and: arith,
  $or: arith,
  $xor: arith,
  $shl: arith,
  $shr: arith,
  $sshr: arith,
  $eq: arith,
  $ne: arith,
  $lt: arith,
  $le: arith,
  $gt: arith,
  $ge: arith,
  $not: unary,
  $neg: unary,
  $reduce_and: unary,
  $reduce_or: unary,
  $reduce_xor: unary,
  $mux: {
    inputs: ['A', 'B', 'S'],
    outputs: ['Y'],
    width: (port, p) => ({ A: p('WIDTH'), B: p('WIDTH'), S: 1, Y: p('WIDTH') })[port as 'A' | 'B' | 'S' | 'Y'],
  },
  $pmux: {
    inputs: ['A', 'B', 'S'],
    outputs: ['Y'],
    width: (port, p) => ({ A: p('WIDTH'), B: p('WIDTH') * p('S_WIDTH'), S: p('S_WIDTH'), Y: p('WIDTH') })[port as 'A' | 'B' | 'S' | 'Y'],
  },
  $dff: {
    inputs: ['CLK', 'D'],
    outputs: ['Q'],
    width: (port, p) => ({ CLK: 1, D: p('WIDTH'), Q: p('WIDTH') })[port as 'CLK' | 'D' | 'Q'],
  },
  $mem_v2: {
    inputs: ['RD_CLK', 'RD_EN', 'RD_ARST', 'RD_SRST', 'RD_ADDR', 'WR_CLK', 'WR_EN', 'WR_ADDR', 'WR_DATA'],
    outputs: ['RD_DATA'],
    width: (port, p) => {
      const r = p('RD_PORTS');
      const w = p('WR_PORTS');
      const a = p('ABITS');
      const d = p('WIDTH');
      return {
        RD_CLK: r, RD_EN: r, RD_ARST: r, RD_SRST: r, RD_ADDR: r * a, RD_DATA: r * d,
        WR_CLK: w, WR_EN: w * d, WR_ADDR: w * a, WR_DATA: w * d,
      }[port as 'RD_CLK'];
    },
  },
};

/** The parameters a cell type must have. */
export const REQUIRED_PARAMETERS: Record<string, string[]> = {
  $add: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $sub: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $mul: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $and: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $or: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $xor: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $shl: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $shr: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $sshr: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $eq: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $ne: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $lt: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $le: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $gt: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $ge: ['A_SIGNED', 'B_SIGNED', 'A_WIDTH', 'B_WIDTH', 'Y_WIDTH'],
  $not: ['A_SIGNED', 'A_WIDTH', 'Y_WIDTH'],
  $neg: ['A_SIGNED', 'A_WIDTH', 'Y_WIDTH'],
  $reduce_and: ['A_SIGNED', 'A_WIDTH', 'Y_WIDTH'],
  $reduce_or: ['A_SIGNED', 'A_WIDTH', 'Y_WIDTH'],
  $reduce_xor: ['A_SIGNED', 'A_WIDTH', 'Y_WIDTH'],
  $mux: ['WIDTH'],
  $pmux: ['WIDTH', 'S_WIDTH'],
  $dff: ['WIDTH', 'CLK_POLARITY'],
  $mem_v2: [
    'MEMID', 'SIZE', 'OFFSET', 'ABITS', 'WIDTH', 'INIT', 'RD_PORTS', 'RD_CLK_ENABLE', 'RD_CLK_POLARITY',
    'RD_TRANSPARENCY_MASK', 'RD_COLLISION_X_MASK', 'RD_WIDE_CONTINUATION', 'RD_CE_OVER_SRST', 'RD_ARST_VALUE',
    'RD_SRST_VALUE', 'RD_INIT_VALUE', 'WR_PORTS', 'WR_CLK_ENABLE', 'WR_CLK_POLARITY', 'WR_PRIORITY_MASK',
    'WR_WIDE_CONTINUATION',
  ],
};

export const directionOf = (spec: InternalCellSpec, port: string): YosysDirection => (spec.outputs.includes(port) ? 'output' : 'input');
