/**
 * # Word-level RTL
 *
 * The output of elaboration and the input of the RTL simulator and of the later lowerings (to gates, to
 * two-level logic, to LUTs). It is plain data (structured-clone safe; constants are BigInts), so it can
 * cross to a worker.
 *
 * ## Design and modules
 *
 * An `RtlDesign` is a set of `RtlModule`s keyed by specialisation (`Counter`, `Fifo<8, 4>`), plus the key
 * of the top one. A module is a list of **signals**, **cells** and child **instances**. The hierarchy is
 * kept; `flattenRtl()` inlines it into one module whose names and cell paths are hierarchical.
 *
 * ## Signals and values
 *
 * `signals[id]` is a bit vector of `width` bits (width ≥ 1), unsigned; signedness lives in the cells that
 * care (`shr`, comparisons, `sext`). Each signal is driven by exactly one cell output, or is an input port
 * (clock inputs are 1-bit signals too). There are no multi-driver nets, no tri-states and no latches.
 * Aggregates are flattened: an array value has element 0 in its least significant bits; a struct is the
 * concatenation of its fields, the first field most significant; an enum is its encoding.
 *
 * `names` maps readable names to signals: ports, `let`s, registers, register-array elements (`x[3]`),
 * memory read ports (`m.read0`). In a flattened module they are hierarchical (`register_file.x[3]`), and
 * `let`s declared in `for` loops are named after their iteration (`t#2`).
 *
 * ## Cells
 *
 * Every cell has an output signal `y` (except `mem`, whose outputs are its read ports' `data`), a source
 * span `src` (the DCL expression or declaration it implements, in its file) and a hierarchical `path` (the
 * module key, or, after flattening, the instance path such as `riscv32.arithmetic`). Widths:
 *
 * | kind | operands | result |
 * |---|---|---|
 * | `const` | `value`: the bit pattern (BigInt) | width(y) |
 * | `add` `sub` `mul` | `a`, `b` of width(y) | wraps modulo 2^width |
 * | `and` `or` `xor` | `a`, `b` of width(y) | bitwise |
 * | `not` `neg` | `a` of width(y) | bitwise not; two's-complement negation |
 * | `shl` | `a` of width(y); amount `b` of any width | amounts ≥ width give 0 |
 * | `shr` | as `shl`; `signed` selects an arithmetic shift | amounts ≥ width give 0 (or all sign bits) |
 * | `eq` `ne` | `a`, `b` of equal width | 1 bit |
 * | `lt` `le` `gt` `ge` | `a`, `b` of equal width; `signed` for two's-complement order | 1 bit |
 * | `mux` | select `s` (1 bit), `a`, `b` of width(y) | `a` when s = 0, `b` when s = 1 (`if s { b } else { a }`) |
 * | `pmux` | select `s` (any width); `cases[i] = { match: values, data }`; `default` | the `data` of the case whose `match` contains s, else `default`; cases are disjoint, so it is one parallel multiplexer (a `match`, or a dynamic array index) |
 * | `slice` | `a`, `lo` | bits [lo, lo + width(y)) of a; truncation is a slice with lo = 0 |
 * | `concat` | `parts`, most significant first | the sum of the widths |
 * | `repeat` | `a`, `n` | n copies of a |
 * | `zext` `sext` | `a`, narrower than y | zero or sign extension |
 * | `reduce_and` `reduce_or` `reduce_xor` | `a` | 1 bit (`all`, `any`, parity) |
 * | `popcount` | `a` | the number of ones, on ⌈log₂(width(a) + 1)⌉ bits |
 * | `reg` | `d` of width(y), clock `clk` (a clock input), `init` | y is the value of d latched at the previous rising edge of clk; `init` at power-up |
 * | `mem` | `clk`, `width`, `depth`, `init[]`, `name`, `reads[] = { addr, data }`, `writes[] = { addr, data, en }` | synchronous: at each rising edge of clk, every read port's `data` becomes the word at `addr` (read before that edge's write), then the write is done if `en`; out-of-range reads give 0 and out-of-range writes are ignored |
 *
 * `bits(x)`, `signed(x)`, enum values and struct fields need no cells of their own (fields are slices).
 *
 * ## Instances
 *
 * `instances[i] = { name, module, inputs, outputs, src, path }` connects a child module: `inputs[port]` is
 * the signal of this module driving the child's input (clock ports included), in the child's port order,
 * and `outputs[port]` is the signal of this module that the child's output drives.
 */
import type { Span } from './span';
import type { Type } from './tir';

export type SigId = number;

export interface RtlSignal {
  id: SigId;
  width: number;
  /** A readable name, if the signal is a port, a `let`, a register or a register array element. */
  name?: string;
}

interface CellBase {
  id: number;
  y: SigId;
  src: Span;
  path: string;
}

export type RtlCell = CellBase &
  (
    | { kind: 'const'; value: bigint }
    | { kind: 'add' | 'sub' | 'mul' | 'and' | 'or' | 'xor'; a: SigId; b: SigId }
    | { kind: 'not' | 'neg'; a: SigId }
    | { kind: 'shl'; a: SigId; b: SigId }
    | { kind: 'shr'; a: SigId; b: SigId; signed: boolean }
    | { kind: 'eq' | 'ne'; a: SigId; b: SigId }
    | { kind: 'lt' | 'le' | 'gt' | 'ge'; a: SigId; b: SigId; signed: boolean }
    | { kind: 'mux'; s: SigId; a: SigId; b: SigId }
    | { kind: 'pmux'; s: SigId; cases: { match: bigint[]; data: SigId }[]; default: SigId }
    | { kind: 'slice'; a: SigId; lo: number }
    | { kind: 'concat'; parts: SigId[] }
    | { kind: 'repeat'; a: SigId; n: number }
    | { kind: 'zext' | 'sext'; a: SigId }
    | { kind: 'reduce_and' | 'reduce_or' | 'reduce_xor' | 'popcount'; a: SigId }
    | { kind: 'reg'; d: SigId; clk: SigId; init: bigint }
    | {
        kind: 'mem';
        clk: SigId;
        width: number;
        depth: number;
        init: bigint[];
        reads: { addr: SigId; data: SigId }[];
        writes: { addr: SigId; data: SigId; en: SigId }[];
        name: string;
      }
  );

export type RtlCellKind = RtlCell['kind'];

export interface RtlPort {
  name: string;
  width: number;
  sig: SigId;
  type: Type;
  clock: boolean;
}

export interface RtlInstance {
  name: string;
  module: string;
  inputs: Record<string, SigId>;
  outputs: Record<string, SigId>;
  src: Span;
  path: string;
}

export interface RtlModule {
  name: string;
  inputs: RtlPort[];
  outputs: RtlPort[];
  signals: RtlSignal[];
  cells: RtlCell[];
  instances: RtlInstance[];
  names: Record<string, SigId>;
}

export interface RtlDesign {
  top: string;
  modules: Record<string, RtlModule>;
}

/** Operand signals of a cell (for `mem`: addresses, write data and enables, and the clock). */
export function cellInputs(c: RtlCell): SigId[] {
  switch (c.kind) {
    case 'const':
      return [];
    case 'not':
    case 'neg':
    case 'slice':
    case 'repeat':
    case 'zext':
    case 'sext':
    case 'reduce_and':
    case 'reduce_or':
    case 'reduce_xor':
    case 'popcount':
      return [c.a];
    case 'mux':
      return [c.s, c.a, c.b];
    case 'pmux':
      return [c.s, ...c.cases.map((x) => x.data), c.default];
    case 'concat':
      return c.parts;
    case 'reg':
      return [c.d, c.clk];
    case 'mem':
      return [c.clk, ...c.reads.map((r) => r.addr), ...c.writes.flatMap((w) => [w.addr, w.data, w.en])];
    default:
      return [c.a, c.b];
  }
}

/** Output signals of a cell. */
export function cellOutputs(c: RtlCell): SigId[] {
  return c.kind === 'mem' ? c.reads.map((r) => r.data) : [c.y];
}

/** Rewrites the signals a cell refers to. */
export function mapCellSignals(c: RtlCell, f: (s: SigId) => SigId): RtlCell {
  const y = c.kind === 'mem' ? -1 : f(c.y);
  switch (c.kind) {
    case 'const':
      return { ...c, y };
    case 'not':
    case 'neg':
    case 'slice':
    case 'repeat':
    case 'zext':
    case 'sext':
    case 'reduce_and':
    case 'reduce_or':
    case 'reduce_xor':
    case 'popcount':
      return { ...c, y, a: f(c.a) };
    case 'mux':
      return { ...c, y, s: f(c.s), a: f(c.a), b: f(c.b) };
    case 'pmux':
      return { ...c, y, s: f(c.s), cases: c.cases.map((x) => ({ match: x.match, data: f(x.data) })), default: f(c.default) };
    case 'concat':
      return { ...c, y, parts: c.parts.map(f) };
    case 'reg':
      return { ...c, y, d: f(c.d), clk: f(c.clk) };
    case 'mem':
      return {
        ...c,
        y,
        clk: f(c.clk),
        reads: c.reads.map((r) => ({ addr: f(r.addr), data: f(r.data) })),
        writes: c.writes.map((w) => ({ addr: f(w.addr), data: f(w.data), en: f(w.en) })),
      };
    default:
      return { ...c, y, a: f(c.a), b: f(c.b) };
  }
}

/**
 * Inlines the hierarchy below `top` into one module. Signals are renumbered; child ports are merged with
 * the parent signals they connect to; names and cell paths become hierarchical (`inst.sub.name`).
 */
export function flattenRtl(design: RtlDesign, top = design.top): RtlModule {
  const root = design.modules[top];
  if (!root) throw new Error(`unknown module ${top}`);
  const signals: RtlSignal[] = [];
  const cells: RtlCell[] = [];
  const names: Record<string, SigId> = {};
  // Union-find: alias[x] = the signal x is merged into (its driver).
  const alias: SigId[] = [];
  const find = (x: SigId): SigId => {
    let r = x;
    while (alias[r] !== r) r = alias[r]!;
    while (alias[x] !== r) {
      const n = alias[x]!;
      alias[x] = r;
      x = n;
    }
    return r;
  };
  const newSig = (width: number, name?: string): SigId => {
    const id = signals.length;
    signals.push({ id, width, name });
    alias.push(id);
    return id;
  };

  const inline = (mod: RtlModule, prefix: string, path: string): Map<SigId, SigId> => {
    const map = new Map<SigId, SigId>();
    for (const s of mod.signals) map.set(s.id, newSig(s.width, s.name === undefined ? undefined : prefix + s.name));
    const m = (s: SigId) => map.get(s)!;
    for (const c of mod.cells) cells.push({ ...mapCellSignals(c, m), id: cells.length, path });
    for (const [n, s] of Object.entries(mod.names)) names[prefix + n] = m(s);
    for (const inst of mod.instances) {
      const child = design.modules[inst.module];
      if (!child) throw new Error(`unknown module ${inst.module}`);
      const cmap = inline(child, `${prefix}${inst.name}.`, `${path}.${inst.name}`);
      for (const p of child.inputs) {
        const parent = inst.inputs[p.name];
        if (parent !== undefined) alias[find(cmap.get(p.sig)!)] = find(m(parent));
      }
      for (const p of child.outputs) {
        const parent = inst.outputs[p.name];
        if (parent !== undefined) {
          const a = find(m(parent));
          const b = find(cmap.get(p.sig)!);
          if (a !== b) alias[a] = b;
        }
      }
    }
    return map;
  };
  const map = inline(root, '', root.name);
  const f = (s: SigId) => find(s);
  const outCells = cells.map((c) => mapCellSignals(c, f));
  const outNames: Record<string, SigId> = {};
  for (const [n, s] of Object.entries(names)) outNames[n] = find(s);
  const port = (p: RtlPort): RtlPort => ({ ...p, sig: find(map.get(p.sig)!) });
  return {
    name: root.name,
    inputs: root.inputs.map(port),
    outputs: root.outputs.map(port),
    signals,
    cells: outCells,
    instances: [],
    names: outNames,
  };
}

/** A readable listing of a module, for debugging and the Studio's text view. */
export function printRtl(mod: RtlModule): string {
  const sig = (s: SigId) => {
    const x = mod.signals[s];
    return x?.name ? `%${s}(${x.name})` : `%${s}`;
  };
  const lines = [`module ${mod.name}`];
  for (const p of mod.inputs) lines.push(`  input ${p.name}: ${p.clock ? 'clock' : p.width} = ${sig(p.sig)}`);
  for (const p of mod.outputs) lines.push(`  output ${p.name}: ${p.width} = ${sig(p.sig)}`);
  for (const c of mod.cells) {
    const w = c.kind === 'mem' ? '' : `:${mod.signals[c.y]?.width}`;
    const args = cellInputs(c).map(sig).join(', ');
    const extra =
      c.kind === 'const' ? ` ${c.value}` : c.kind === 'slice' ? ` lo=${c.lo}` : c.kind === 'pmux' ? ` [${c.cases.map((x) => x.match.join('|')).join('; ')}]` : '';
    const call = c.kind === 'const' ? '' : `(${args})`;
    lines.push(`  ${c.kind === 'mem' ? c.reads.map((r) => sig(r.data)).join(', ') : sig(c.y) + w} = ${c.kind}${extra}${call}  @${c.src.line}:${c.src.col}`);
  }
  for (const i of mod.instances) {
    lines.push(`  inst ${i.name}: ${i.module}(${Object.entries(i.inputs).map(([k, v]) => `${k}: ${sig(v)}`).join(', ')}) -> (${Object.entries(i.outputs).map(([k, v]) => `${k}: ${sig(v)}`).join(', ')})`);
  }
  return lines.join('\n');
}
