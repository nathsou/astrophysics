/**
 * Types of the lowering from word-level RTL to a bit-level netlist (see `index.ts` for the scheme).
 *
 * Everything here is plain data (structured-clone safe), so the result can be built in a worker.
 */
import type { FlatNetlist } from '../../sim/netlist/types';
import type { RtlModule } from '../rtl';
import type { Span } from '../span';

/**
 * A bit during lowering: a net number (≥ 0), or a constant that has not been given an element yet
 * (`CONST0`, `CONST1`). Constants are folded into the gates that use them; only where a constant
 * reaches a register, a memory or an output does it become a `const` element.
 */
export type Bit = number;
export const CONST0: Bit = -1;
export const CONST1: Bit = -2;
export const isConst = (b: Bit): boolean => b < 0;

export interface LowerOptions {
  /**
   * `gates` (default): adders are ripple-carry chains of full adders made from XOR, AND and OR gates.
   * `blocks`: an adder of up to 16 bits is one `adder` block from the parts bin (wider ones are chained).
   */
  adders?: 'gates' | 'blocks';
  /** `block` (default): a 2-way multiplexer is one `mux` element. `gates`: AND, OR and NOT gates. */
  muxes?: 'block' | 'gates';
  /** The widest AND/OR gate used for reductions and decoders (2–8, default 4). */
  maxFanIn?: number;
  /** Remove gates whose outputs nothing reads (default true). */
  prune?: boolean;
  /**
   * Add a `toggle` per input bit and an `indicator` per output bit (default true), so the netlist runs as it
   * is: flip the toggles with `setParam(id, 'on', …)` and read the LEDs. Without them the port nets are free.
   */
  io?: boolean;
  /** Gate delay in nanoseconds for every gate and block (default: the catalog's 1 ns). */
  delayNs?: number;
}

/** What one element of the netlist implements. */
export interface ElementInfo {
  /** The RTL cell it belongs to (`kind` of that cell, or `input`, `output`, `const`), or -1 for ports. */
  cell: number;
  kind: string;
  /** Hierarchical instance path of the cell, such as `riscv32.arithmetic`. */
  path: string;
  /** Part of the construct: `fa.xor1`, `dff`, `decode`, … */
  role: string;
  /** The bit of the result this element belongs to, if it is bit-sliced. */
  bit?: number;
  /** The DCL source span of the construct (undefined for ports). */
  src?: Span;
  /** A short name for drawings: `value[2]`, `count[0]`, `clk`. */
  label?: string;
  /** Other RTL cells that read this element's output instead of building the same gate again. */
  shared?: number[];
}

export interface LoweredPort {
  name: string;
  dir: 'in' | 'out';
  width: number;
  clock: boolean;
  /** Net of each bit, least significant first. */
  nets: number[];
  /** With `io`: the `toggle` (input) or `indicator` (output) element of each bit. */
  elements: string[];
}

export interface LoweredMemory {
  /** The memory's name in the source. */
  name: string;
  path: string;
  depth: number;
  width: number;
  init: bigint[];
  /** The `ram` elements that hold it (one per read port and per 32 bits of width). */
  rams: { id: string; bitLo: number; bits: number }[];
}

export interface LoweredStats {
  elements: number;
  /** Elements by catalog type, excluding the port elements (`toggle`, `indicator`) and constants. */
  byType: Record<string, number>;
  /** Logic gates (NOT, AND, OR, XOR, NAND, NOR, XNOR) and multiplexers. */
  gates: number;
  /** Two-input gate equivalents: an n-input gate counts n − 1, a multiplexer 3, an adder block 5 per bit. */
  gateEquivalents: number;
  flipFlops: number;
  memories: number;
  /** Longest path between registers, ports and memories, in gates. */
  depth: number;
  /** A time (ns) long enough for the outputs to settle after an input change, at the chosen delays. */
  settleNs: number;
}

export interface Lowered {
  netlist: FlatNetlist;
  ports: LoweredPort[];
  /** RTL cell id → the elements that implement it (empty for wiring cells: slices, concatenations, …). */
  cells: Record<number, string[]>;
  /** Element id → what it implements. Ids read `<path>/<kind><cell id>/<part>`. */
  elements: Record<string, ElementInfo>;
  /**
   * Named signals (ports, `let`s, registers, memory read ports, hierarchical) → their bits. A negative
   * number is a constant: `CONST0` (−1) or `CONST1` (−2).
   */
  signals: Record<string, number[]>;
  memories: LoweredMemory[];
  stats: LoweredStats;
  /** The flattened RTL module that was lowered (its cells carry the ids used in `cells`). */
  rtl: RtlModule;
  options: Required<Omit<LowerOptions, 'delayNs'>> & { delayNs?: number };
}
