/**
 * # Word-level RTL
 *
 * The output of elaboration and the input of the RTL simulator and of the later lowerings (to gates, to
 * two-level logic, to LUTs). It is plain data (structured-clone safe; constants are BigInts), so it can
 * cross to a worker.
 *
 * ## Design and modules
 *
 * An `RtlDesign` is a set of `RtlModule`s keyed by specialisation (`Counter`, `Fifo<8, 4>`), plus the name
 * of the top one. A module is a list of **signals**, **cells** and child **instances**; the hierarchy is
 * kept, and `flattenRtl()` inlines it into one module whose cells carry their full instance path.
 *
 * ## Signals
 *
 * `signals[id]` is a bit vector of `width` bits (1 ≤ width). Each signal is driven by exactly one cell
 * output, or is an input port. There are no multi-driver nets and no tri-states. `names` maps readable
 * names (ports, `let`s, registers, `x[3]` for register array elements, `m.read0` for memory read ports) to
 * signals; in a flattened module they are hierarchical (`register_file.x[3]`).
 *
 * ## Cells
 *
 * Every cell has an output signal `y` (except `mem`, whose outputs are its read ports), a source span `src`
 * (the DCL expression it implements) and a hierarchical `path` (the module key, or the instance path such as
 * `riscv32.arithmetic` after flattening). Operand widths:
 *
 * | kind | operands | result |
 * |---|---|---|
 * | `const` | `value` (BigInt, the bit pattern) | width(y) |
 * | `add` `sub` `mul` `and` `or` `xor` | `a`, `b` of width(y) | wraps modulo 2^width |
 * | `not` `neg` | `a` of width(y) | |
 * | `shl` `shr` | `a` of width(y), amount `b` of any width; `shr` with `signed` is arithmetic | amounts ≥ width give 0 (or the sign) |
 * | `eq` `ne` `lt` `le` `gt` `ge` | `a`, `b` of equal width; `signed` for two's-complement order | 1 bit |
 * | `mux` | select `s` (1 bit), `a` when s = 0, `b` when s = 1 | |
 * | `pmux` | select `s`, `cases[i] = { match: values, data }`, `default` | the case containing s, else default (parallel: cases are disjoint) |
 * | `slice` | `a`, `lo` | bits [lo, lo + width(y)) of a |
 * | `concat` | `parts`, most significant first | sum of widths |
 * | `repeat` | `a`, `n` | n copies |
 * | `zext` `sext` | `a` narrower than y | |
 * | `reduce_and` `reduce_or` `reduce_xor` | `a` | 1 bit |
 * | `popcount` | `a` | ⌈log₂(width(a) + 1)⌉ bits |
 * | `reg` | `d`, clock `clk` (a clock input signal), `init` | y = the value latched at the previous rising edge of clk (init at power-up) |
 * | `mem` | `clk`, `depth`, `width`, `init[]`, `reads[] = { addr, data }`, `writes[] = { addr, data, en }` | synchronous: each read port's `data` is mem[addr] sampled at the edge (before the write); out-of-range reads give 0, writes are ignored |
 *
 * Truncation is a `slice` with `lo = 0`. `bits(x)`, `signed(x)` and enum values need no cell.
 *
 * ## Instances
 *
 * `instances[i] = { name, module, inputs, outputs }` connects the child's ports: `inputs[port]` is a signal
 * of this module driving the child's input (including clock ports), and `outputs[port]` is a signal of this
 * module driven by the child's output.
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
    lines.push(`  ${c.kind === 'mem' ? c.reads.map((r) => sig(r.data)).join(', ') : sig(c.y) + w} = ${c.kind}${extra}(${args})  @${c.src.line}:${c.src.col}`);
  }
  for (const i of mod.instances) {
    lines.push(`  inst ${i.name}: ${i.module}(${Object.entries(i.inputs).map(([k, v]) => `${k}: ${sig(v)}`).join(', ')}) -> (${Object.entries(i.outputs).map(([k, v]) => `${k}: ${sig(v)}`).join(', ')})`);
  }
  return lines.join('\n');
}
