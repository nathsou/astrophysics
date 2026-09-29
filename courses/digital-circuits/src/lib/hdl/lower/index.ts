/**
 * # Lowering word-level RTL to a bit-level netlist
 *
 * `lowerToNetlist(design, top)` expands every RTL cell (rtl.ts) into elements of the course's netlist model
 * (`FlatNetlist`): gates from the digital catalog, `mux` blocks, `dff`s, `ram` blocks and `const`s. The result
 * runs on the digital engine, and agrees with the RTL simulator bit for bit (`lower.test.ts` checks random
 * designs and the reference designs).
 *
 * ## Scheme
 *
 * | RTL cell | Becomes | Cost for w bits |
 * |---|---|---|
 * | `and` `or` `xor` `not` | one gate per bit | w |
 * | `add` `sub` `neg` | ripple-carry full adders (XOR, XOR, AND, AND, OR); a constant operand folds them into half adders or wires; `sub` is `a + ¬b + 1`; with `adders: 'blocks'`, `adder` blocks of up to 16 bits | 5 w |
 * | `mul` | shift-and-add: AND partial products summed by ripple adders (low w bits) | ≈ 6 w² / 2 |
 * | `shl` `shr` | a barrel shifter: ⌈log₂ w⌉ stages of multiplexers, then one row that clears the result for larger amounts | w ⌈log₂ w⌉ muxes |
 * | `eq` `ne` | XNOR (XOR) per bit, then an AND (OR) tree; against a constant, an AND of literals | w + tree |
 * | `lt` `le` `gt` `ge` | a chain from the least significant bit: XOR "differ", then a mux picks the deciding bit | 2 w |
 * | `mux` | one `mux` block per bit (or AND-OR gates with `muxes: 'gates'`) | w |
 * | `pmux` | decoders (an AND of literals per case) + AND-OR per bit | cases × (w + fan-in) |
 * | `reduce_and` `reduce_or` | a tree of gates with at most `maxFanIn` inputs | ≈ w / 3 |
 * | `reduce_xor` | a tree of 2-input XORs | w − 1 |
 * | `popcount` | a counter grown one bit at a time (half adders) | ≈ w log w |
 * | `slice` `concat` `repeat` `zext` `sext` | nothing: they only rename wires | 0 |
 * | `const` | nothing: constants fold into the gates that read them | 0 |
 * | `reg` | one `dff` per bit (with its power-up value) | w |
 * | `mem` | `ram` blocks (≤ 32 bits each, one per read port) + a `dff` per read data bit, so that reads are synchronous | |
 *
 * Constants are folded: a constant only becomes a `const` element where it reaches a register, a memory or an
 * output. Gates that nothing reads are removed (an adder's unused carry-out, for example).
 *
 * ## Names and tags
 *
 * Every element id reads `<path>/<kind><cell id>/<bit>.<role>`, for example `add4/2.fa.xor1` (the first XOR of the
 * full adder of bit 2 of cell 4) or, inside instance `alu` of the top module, `alu/add4/2.fa.xor1`. `Lowered.elements`
 * maps ids to the cell, full path, source span and role; `Lowered.cells` maps each RTL cell to its elements. Input bits are `in/<name>[i]`
 * (`toggle`s) and output bits `out/<name>[i]` (`indicator`s).
 *
 * ## Memories
 *
 * A `ram` block starts filled with zeros, so the initial contents of a memory are in `Lowered.memories`;
 * `applyMemoryInit` writes them into an engine (call it after creating or resetting the engine).
 */
import { flattenRtl, type RtlCell, type RtlDesign, type RtlModule, type SigId } from '../rtl';
import type { FlatNetlist } from '../../sim/netlist/types';
import { addBits, lowerCell } from './cells';
import { GateBuilder } from './builder';
import {
  CONST0,
  CONST1,
  isConst,
  type Bit,
  type Lowered,
  type LoweredMemory,
  type LoweredPort,
  type LoweredStats,
  type LowerOptions,
} from './types';

export * from './types';
export { GateBuilder } from './builder';

const DEFAULTS = { adders: 'gates', muxes: 'block', maxFanIn: 4, prune: true, io: true } as const;

function ceilLog2(n: number): number {
  let s = 0;
  while (2 ** s < n) s++;
  return s;
}

export class LowerError extends Error {}

/** Lowers a design (or an already flat module) to a bit-level netlist. */
export function lowerToNetlist(design: RtlDesign | RtlModule, top?: string, options: LowerOptions = {}): Lowered {
  const mod = 'modules' in design ? flattenRtl(design, top) : design;
  const opts = { ...DEFAULTS, ...options } as Lowered['options'];
  for (const k of Object.keys(opts) as (keyof typeof opts)[]) if (opts[k] === undefined) delete opts[k];
  const gb = new GateBuilder(opts, mod.name);
  const width = (s: SigId) => mod.signals[s]!.width;
  const bits = new Map<SigId, Bit[]>();
  const get = (s: SigId): Bit[] => {
    const b = bits.get(s);
    if (!b) throw new LowerError(`signal %${s} is read before it is driven`);
    return b;
  };
  const path = mod.name;

  // ---- ports and state outputs get their nets first
  const ports: LoweredPort[] = [];
  const netNameOf = new Map<number, string>();
  const nameNets = (name: string, ns: Bit[]) => {
    ns.forEach((n, i) => {
      if (n >= 0 && !netNameOf.has(n)) netNameOf.set(n, ns.length === 1 ? name : `${name}[${i}]`);
    });
  };
  for (const p of mod.inputs) {
    const nets = Array.from({ length: p.width }, () => gb.net());
    bits.set(p.sig, nets);
    nameNets(p.name, nets);
    const elements: string[] = [];
    if (opts.io) {
      gb.begin({ cell: -1, kind: 'input', path });
      nets.forEach((n, i) => {
        gb.bit(i);
        const label = p.width === 1 ? p.name : `${p.name}[${i}]`;
        elements.push(gb.emit('toggle', {}, { Y: n }, { on: false }, p.name, `in/${label}`, label));
      });
    }
    ports.push({ name: p.name, dir: 'in', width: p.width, clock: p.clock, nets, elements });
  }
  const combinational = new Map<SigId, RtlCell>();
  const drivers = new Map<SigId, RtlCell>();
  for (const c of mod.cells) if (c.kind === 'const') drivers.set(c.y, c);
  /** Register bits that can never change: the next value is a constant equal to the power-up value. */
  for (const c of mod.cells) {
    if (c.kind === 'reg') {
      const d = drivers.get(c.d);
      const q = Array.from({ length: width(c.y) }, (_, i): Bit => {
        if (d && d.kind === 'const' && ((d.value >> BigInt(i)) & 1n) === ((c.init >> BigInt(i)) & 1n)) return (d.value >> BigInt(i)) & 1n ? CONST1 : CONST0;
        return gb.net();
      });
      bits.set(c.y, q);
    } else if (c.kind === 'mem') for (const r of c.reads) bits.set(r.data, Array.from({ length: width(r.data) }, () => gb.net()));
    else combinational.set(c.y, c);
  }

  // ---- combinational cells, in dependency order (an explicit stack: designs can be deep)
  const done = new Set<number>();
  const inputsOf = (c: RtlCell): SigId[] => {
    switch (c.kind) {
      case 'const': return [];
      case 'not': case 'neg': case 'slice': case 'repeat': case 'zext': case 'sext':
      case 'reduce_and': case 'reduce_or': case 'reduce_xor': case 'popcount': return [c.a];
      case 'mux': return [c.s, c.a, c.b];
      case 'pmux': return [c.s, ...c.cases.map((k) => k.data), c.default];
      case 'concat': return c.parts;
      case 'reg': case 'mem': return [];
      default: return [c.a, c.b];
    }
  };
  const lower = (c: RtlCell) => {
    gb.begin({ cell: c.id, kind: c.kind, path: c.path, src: c.src });
    const out = lowerCell(gb, c, get, width, opts.adders === 'blocks');
    if (out.length !== width(c.y)) throw new LowerError(`cell ${c.id} (${c.kind}) produced ${out.length} bits for a ${width(c.y)}-bit signal`);
    bits.set(c.y, out);
    gb.touch(c);
  };
  for (const root of mod.cells) {
    if (root.kind === 'reg' || root.kind === 'mem' || done.has(root.id)) continue;
    const stack: { c: RtlCell; next: number }[] = [{ c: root, next: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const ins = inputsOf(top.c);
      if (top.next < ins.length) {
        const dep = combinational.get(ins[top.next++]!);
        if (dep && !done.has(dep.id) && !stack.some((f) => f.c === dep)) stack.push({ c: dep, next: 0 });
        continue;
      }
      stack.pop();
      if (done.has(top.c.id)) continue;
      done.add(top.c.id);
      lower(top.c);
    }
  }

  // ---- registers and memories
  const memories: LoweredMemory[] = [];
  for (const c of mod.cells) {
    if (c.kind === 'reg') {
      gb.begin({ cell: c.id, kind: 'reg', path: c.path, src: c.src });
      const d = get(c.d);
      const clk = get(c.clk)[0]!;
      const q = get(c.y);
      const name = mod.signals[c.y]?.name ?? `r${c.id}`;
      q.forEach((n, i) => {
        if (isConst(n)) return;
        gb.bit(i);
        gb.emit('dff', { D: d[i]!, CLK: clk }, { Q: n }, { init: (c.init >> BigInt(i)) & 1n ? '1' : '0' }, 'dff', undefined, q.length === 1 ? name : `${name}[${i}]`);
      });
      gb.touch(c);
    } else if (c.kind === 'mem') {
      memories.push(lowerMem(gb, c, get, opts.adders === 'blocks'));
    }
  }

  // ---- outputs
  for (const p of mod.outputs) {
    gb.begin({ cell: -1, kind: 'output', path });
    const src = get(p.sig);
    const nets = src.map((b, i) => {
      gb.bit(i);
      return gb.real(b);
    });
    nameNets(p.name, nets);
    const elements: string[] = [];
    if (opts.io) {
      nets.forEach((n, i) => {
        gb.bit(i);
        const label = p.width === 1 ? p.name : `${p.name}[${i}]`;
        elements.push(gb.emit('indicator', { A: n }, {}, { color: 'green' }, p.name, `out/${label}`, label));
      });
    }
    ports.push({ name: p.name, dir: 'out', width: p.width, clock: false, nets, elements });
  }

  // ---- named signals (a named wire is something the reader wrote, so it stays even if nothing reads it)
  const signals: Record<string, number[]> = {};
  for (const [name, sig] of Object.entries(mod.names)) {
    const b = bits.get(sig);
    if (!b) continue;
    signals[name] = b;
    nameNets(name, b);
  }
  if (opts.prune) gb.prune(Object.values(signals).flat().filter((n) => n >= 0));

  const names = gb.netNames();
  for (const [n, name] of netNameOf) names[n] = name;
  const netlist: FlatNetlist = { netCount: gb.netCount(), netNames: names, elements: gb.elements() };
  const elements: Lowered['elements'] = {};
  for (const id of gb.ids()) elements[id] = gb.info[id]!;
  const cells: Lowered['cells'] = {};
  for (const [k, v] of Object.entries(gb.cells)) if (Number(k) >= 0) cells[Number(k)] = v;
  const removed = gb.removed;
  for (const m of memories) m.rams = m.rams.filter((r) => !removed.has(r.id));

  return { netlist, ports, cells, elements, signals, memories, stats: statistics(gb, netlist, opts), rtl: mod, options: opts };
}

// ------------------------------------------------------------------------------------ memories

/**
 * A memory becomes `ram` blocks when every port uses the same address (a single-port RAM, as on an FPGA):
 * one block per read port, each followed by a register, so that reads are synchronous. Otherwise it becomes
 * an array of flip-flops with a write decoder and one read multiplexer per port.
 */
function lowerMem(
  gb: GateBuilder,
  c: Extract<RtlCell, { kind: 'mem' }>,
  get: (s: SigId) => Bit[],
  blocks: boolean,
): LoweredMemory {
  gb.begin({ cell: c.id, kind: 'mem', path: c.path, src: c.src });
  const A = Math.max(1, ceilLog2(c.depth));
  if (c.depth * c.width > 262144) throw new LowerError(`memory ${c.name}: ${c.depth} × ${c.width} bits is too large to draw or simulate as gates`);
  const clk = get(c.clk)[0]!;
  const addrs = [...c.reads.map((r) => get(r.addr)), ...c.writes.map((x) => get(x.addr))];
  const same = addrs.every((a) => a.length === addrs[0]!.length && a.every((b, i) => b === addrs[0]![i]));
  if (A <= 16 && same && addrs.length > 0) return lowerRamBlocks(gb, c, get, A, clk);
  return lowerFlopMemory(gb, c, get, A, clk, blocks);
}

function lowerRamBlocks(gb: GateBuilder, c: Extract<RtlCell, { kind: 'mem' }>, get: (s: SigId) => Bit[], A: number, clk: Bit): LoweredMemory {
  const w = c.width;
  const chunks = Math.ceil(w / 32);
  const write = c.writes[0];
  const a0 = get((c.reads[0]?.addr ?? write!.addr));
  const low = Array.from({ length: A }, (_, i) => a0[i] ?? CONST0);
  // Is the address inside the memory? (Reads outside give 0, writes outside are ignored.)
  const inside: Bit[] = [];
  if (a0.length > A) inside.push(gb.not(gb.orN(a0.slice(A), 'range')));
  if (c.depth < 2 ** A) {
    const dep = Array.from({ length: A }, (_, i) => ((BigInt(c.depth) >> BigInt(i)) & 1n ? CONST1 : CONST0));
    inside.push(lessThanBits(gb, low, dep));
  }
  const ok = gb.andN(inside, 'range.and');
  const we = write ? gb.and2(get(write.en)[0]!, ok, 'we') : CONST0;
  const wData = write ? get(write.data) : Array.from({ length: w }, () => CONST0);
  const rams: LoweredMemory['rams'] = [];
  c.reads.forEach((r, port) => {
    const data = get(r.data);
    for (let k = 0; k < chunks; k++) {
      const lo = k * 32;
      const n = Math.min(32, w - lo);
      const ins: Record<string, Bit> = { WE: we, CLK: clk };
      const outs: Record<string, number> = {};
      low.forEach((b, i) => (ins[`A${i}`] = b));
      for (let i = 0; i < n; i++) {
        ins[`DI${i}`] = wData[lo + i]!;
        outs[`DO${i}`] = gb.net();
      }
      gb.bit(undefined);
      const id = gb.emit('ram', ins, outs, { addrBits: A, dataBits: n }, `r${port}.ram${chunks > 1 ? k : ''}`);
      rams.push({ id, bitLo: lo, bits: n });
      for (let i = 0; i < n; i++) {
        gb.bit(lo + i);
        // Reads are synchronous: register the word, forcing 0 outside the memory.
        const d = gb.and2(outs[`DO${i}`]!, ok, 'inrange');
        gb.emit('dff', { D: d, CLK: clk }, { Q: data[lo + i]! }, { init: '0' }, `r${port}.dff`);
      }
    }
  });
  gb.touch(c);
  return { name: c.name, path: c.path, depth: c.depth, width: w, init: c.init, rams };
}

function lowerFlopMemory(gb: GateBuilder, c: Extract<RtlCell, { kind: 'mem' }>, get: (s: SigId) => Bit[], A: number, clk: Bit, blocks: boolean): LoweredMemory {
  const w = c.width;
  const write = c.writes[0];
  const words: Bit[][] = Array.from({ length: c.depth }, () => Array.from({ length: w }, () => gb.net()));
  if (write) {
    const wa = get(write.addr);
    const en = get(write.en)[0]!;
    const data = get(write.data);
    words.forEach((q, k) => {
      gb.bit(undefined);
      const hit = gb.and2(en, eqConstBits(gb, wa, BigInt(k)), 'we');
      q.forEach((n, i) => {
        gb.bit(i);
        const d = gb.mux(hit, n, data[i]!, `w${k}.mux`);
        gb.emit('dff', { D: d, CLK: clk }, { Q: n }, { init: (c.init[k] ?? 0n) >> BigInt(i) & 1n ? '1' : '0' }, `w${k}.dff`);
      });
    });
  } else {
    words.forEach((q, k) =>
      q.forEach((n, i) => {
        gb.bit(i);
        gb.emit('dff', { D: n, CLK: clk }, { Q: n }, { init: (c.init[k] ?? 0n) >> BigInt(i) & 1n ? '1' : '0' }, `w${k}.dff`);
      }),
    );
  }
  c.reads.forEach((r, port) => {
    const ra = get(r.addr);
    const data = get(r.data);
    const sels = words.map((_, k) => eqConstBits(gb, ra, BigInt(k)));
    for (let i = 0; i < w; i++) {
      gb.bit(i);
      const d = gb.orN(words.map((q, k) => gb.and2(sels[k]!, q[i]!, 'read')), 'read.or');
      gb.emit('dff', { D: d, CLK: clk }, { Q: data[i]! }, { init: '0' }, `r${port}.dff`);
    }
  });
  gb.bit(undefined);
  gb.touch(c);
  void blocks;
  void A;
  return { name: c.name, path: c.path, depth: c.depth, width: w, init: c.init, rams: [] };
}

function eqConstBits(gb: GateBuilder, s: Bit[], m: bigint): Bit {
  if (m >> BigInt(s.length)) return CONST0;
  return gb.andN(
    s.map((x, i) => ((m >> BigInt(i)) & 1n ? x : gb.not(x))),
    'decode',
  );
}

/** Unsigned a < b on equal-width bit vectors (used for range checks). */
function lessThanBits(gb: GateBuilder, a: Bit[], b: Bit[]): Bit {
  let lt = CONST0;
  for (let i = 0; i < a.length; i++) {
    const differ = gb.xor2(a[i]!, b[i]!, 'range.differ');
    lt = gb.mux(differ, lt, b[i]!, 'range.mux');
  }
  return lt;
}

// ------------------------------------------------------------------------------------ statistics

const GATE_TYPES = new Set(['not', 'and', 'or', 'xor', 'xnor', 'nand', 'nor', 'mux']);

function statistics(gb: GateBuilder, netlist: FlatNetlist, opts: Lowered['options']): LoweredStats {
  const byType: Record<string, number> = {};
  let gates = 0;
  let equivalents = 0;
  let flops = 0;
  let mems = 0;
  const depth = new Map<number, number>();
  let maxDepth = 0;
  const delay = opts.delayNs ?? 1;
  for (const el of netlist.elements) {
    const t = el.type;
    if (t !== 'toggle' && t !== 'indicator' && t !== 'const') byType[t] = (byType[t] ?? 0) + 1;
    if (GATE_TYPES.has(t)) {
      gates++;
      equivalents += t === 'mux' ? 3 : t === 'not' ? 1 : Number(el.params.inputs ?? 2) - 1;
    } else if (t === 'adder') equivalents += 5 * Number(el.params.bits ?? 1);
    if (t === 'dff') flops++;
    if (t === 'ram') mems++;
    const ins = gb.inputsOf(el.id);
    const outs = gb.outputsOf(el.id);
    let d = 0;
    if (t === 'dff' || t === 'toggle' || t === 'const') d = 0;
    else {
      let m = 0;
      for (const n of t === 'ram' ? ins.slice(0, Number(el.params.addrBits ?? 0)) : ins) m = Math.max(m, depth.get(n) ?? 0);
      d = m + 1;
    }
    for (const n of outs) depth.set(n, d);
    maxDepth = Math.max(maxDepth, d);
  }
  // A path also ends at a register's D input, one more gate away than the deepest net that feeds it.
  return {
    elements: netlist.elements.length,
    byType,
    gates,
    gateEquivalents: equivalents,
    flipFlops: flops,
    memories: mems,
    depth: maxDepth,
    settleNs: Math.max(20, (maxDepth + 6) * delay),
  };
}

// ------------------------------------------------------------------------------------ helpers

export { addBits };
export { isConst, CONST0, CONST1 };
