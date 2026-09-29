/**
 * `GateBuilder`: builds the bit-level netlist gate by gate, with constant folding, and tags every element
 * with the RTL cell it implements.
 *
 * Folding keeps the result readable. `value + 1` is a chain of half adders, not full adders with a constant
 * input; `state == 3` is an AND of literals; a multiplexer with a constant arm is one gate. Constants are
 * virtual (`CONST0`, `CONST1`) until they reach something that needs a real net.
 */
import type { FlatElement, Params } from '../../sim/netlist/types';
import { NetlistBuilder } from '../../sim/digital/builder';
import type { RtlCell } from '../rtl';
import type { Span } from '../span';
import { CONST0, CONST1, isConst, type Bit, type ElementInfo, type LowerOptions } from './types';

/** The context that tags the elements being built. */
export interface Tag {
  cell: number;
  kind: string;
  path: string;
  src?: Span;
  bit?: number;
}

/** Catalog types the pruning pass may remove when nothing reads their outputs. */
const PRUNABLE = new Set(['not', 'and', 'or', 'xor', 'xnor', 'nand', 'nor', 'mux', 'adder', 'const']);
/** Catalog types with a `delay` parameter. */
const DELAYED = new Set(['not', 'and', 'or', 'xor', 'xnor', 'nand', 'nor', 'mux', 'adder', 'ram']);

export class GateBuilder {
  readonly nb = new NetlistBuilder();
  readonly info: Record<string, ElementInfo> = {};
  readonly cells: Record<number, string[]> = {};
  private readonly ins = new Map<string, number[]>();
  private readonly outs = new Map<string, number[]>();
  private readonly order: string[] = [];
  private used = new Map<string, number>();
  /** Output of a NOT gate → its input, so that NOT NOT x is x. */
  private notSrc = new Map<Bit, Bit>();
  /** Gates already built, by type and inputs (common subexpressions are built once and shared). */
  private shareMap = new Map<string, { net: number; id: string }>();
  private tag: Tag = { cell: -1, kind: 'port', path: '' };
  readonly maxFanIn: number;
  readonly muxBlocks: boolean;
  readonly delayNs: number | undefined;
  /** Name of the top module: element ids leave out this prefix of the path (`add4/…`, and `alu/add4/…` inside instance `alu`). */
  private readonly top: string;

  constructor(options: Required<Omit<LowerOptions, 'delayNs'>> & { delayNs?: number }, top = '') {
    this.top = top;
    this.maxFanIn = Math.max(2, Math.min(8, Math.floor(options.maxFanIn)));
    this.muxBlocks = options.muxes === 'block';
    this.delayNs = options.delayNs;
  }

  /** Starts tagging elements as belonging to `cell`. */
  begin(t: Tag): void {
    this.tag = t;
  }

  /** A gate built earlier from the same inputs, if any; the current cell is recorded as one of its users. */
  private reuse(key: string): number | undefined {
    const hit = this.shareMap.get(key);
    if (!hit) return undefined;
    const cell = this.tag.cell;
    const info = this.info[hit.id];
    if (info && cell >= 0 && info.cell !== cell) {
      const list = (this.cells[cell] ??= []);
      if (!list.includes(hit.id)) list.push(hit.id);
      const shared = (info.shared ??= []);
      if (!shared.includes(cell)) shared.push(cell);
    }
    return hit.net;
  }

  private remember(key: string, net: number, id: string): void {
    this.shareMap.set(key, { net, id });
  }

  /** Tags the following elements with a bit of the result. */
  bit(i: number | undefined): void {
    this.tag = { ...this.tag, bit: i };
  }

  get current(): Tag {
    return this.tag;
  }

  net(name?: string): number {
    return this.nb.net(name);
  }

  // ---------------------------------------------------------------------------------- elements

  /** A constant as a real net, driven by a `const` element tagged with the current cell. */
  constNet(value: 0 | 1): number {
    const y = this.nb.net();
    this.emit('const', {}, { Y: y }, { value }, value ? 'one' : 'zero');
    return y;
  }

  /** A real net for a bit: constants get an element of their own. */
  real(b: Bit): number {
    return b === CONST0 ? this.constNet(0) : b === CONST1 ? this.constNet(1) : b;
  }

  /** Adds an element. `ins` and `outs` map pin names to bits (constants among `ins` become `const` elements). */
  emit(type: string, ins: Record<string, Bit>, outs: Record<string, number>, params: Params, role: string, idOverride?: string, label?: string): string {
    const t = this.tag;
    const local = t.path === this.top ? '' : t.path.startsWith(`${this.top}.`) ? t.path.slice(this.top.length + 1) : t.path;
    const stem = `${local ? `${local}/` : ''}${t.kind}${t.cell >= 0 ? t.cell : ''}`;
    const part = `${t.bit === undefined ? '' : `${t.bit}.`}${role}`;
    let id = idOverride ?? `${stem}/${part}`;
    const n = this.used.get(id) ?? 0;
    this.used.set(id, n + 1);
    if (n > 0) id = `${id}#${n + 1}`;
    const pins: Record<string, number> = { ...outs };
    for (const [pin, b] of Object.entries(ins)) pins[pin] = this.real(b);
    if (this.delayNs !== undefined && DELAYED.has(type)) params = { ...params, delay: this.delayNs };
    this.nb.add(type, id, pins, params);
    this.info[id] = { cell: t.cell, kind: t.kind, path: t.path, role, bit: t.bit, src: t.src, ...(label === undefined ? {} : { label }) };
    (this.cells[t.cell] ??= []).push(id);
    this.ins.set(id, Object.keys(ins).map((p) => pins[p]!));
    this.outs.set(id, Object.values(outs));
    this.order.push(id);
    return id;
  }

  // ---------------------------------------------------------------------------------- gates

  not(a: Bit): Bit {
    if (a === CONST0) return CONST1;
    if (a === CONST1) return CONST0;
    const src = this.notSrc.get(a);
    if (src !== undefined) return src;
    const key = `not|${a}`;
    const hit = this.reuse(key);
    if (hit !== undefined) return hit;
    const y = this.nb.net();
    const id = this.emit('not', { A: a }, { Y: y }, {}, 'not');
    this.notSrc.set(y, a);
    this.remember(key, y, id);
    return y;
  }

  /** Are a and b complements (one is the output of a NOT gate whose input is the other)? */
  private complement(a: Bit, b: Bit): boolean {
    return this.notSrc.get(a) === b || this.notSrc.get(b) === a;
  }

  private gate(type: 'and' | 'or' | 'xor' | 'xnor' | 'nand' | 'nor', bits: Bit[], role: string): Bit {
    const sorted = [...bits].sort((a, b) => a - b);
    const key = `${type}|${sorted.join(',')}`;
    const hit = this.reuse(key);
    if (hit !== undefined) return hit;
    const y = this.nb.net();
    const ins: Record<string, Bit> = {};
    sorted.forEach((b, i) => (ins[String.fromCharCode(65 + i)] = b));
    const id = this.emit(type, ins, { Y: y }, { inputs: bits.length }, role);
    this.remember(key, y, id);
    return y;
  }

  and2(a: Bit, b: Bit, role = 'and'): Bit {
    if (a === CONST0 || b === CONST0) return CONST0;
    if (a === CONST1) return b;
    if (b === CONST1) return a;
    if (a === b) return a;
    if (this.complement(a, b)) return CONST0;
    return this.gate('and', [a, b], role);
  }

  or2(a: Bit, b: Bit, role = 'or'): Bit {
    if (a === CONST1 || b === CONST1) return CONST1;
    if (a === CONST0) return b;
    if (b === CONST0) return a;
    if (a === b) return a;
    if (this.complement(a, b)) return CONST1;
    return this.gate('or', [a, b], role);
  }

  xor2(a: Bit, b: Bit, role = 'xor'): Bit {
    if (a === CONST0) return b;
    if (b === CONST0) return a;
    if (a === CONST1) return this.not(b);
    if (b === CONST1) return this.not(a);
    if (a === b) return CONST0;
    if (this.complement(a, b)) return CONST1;
    return this.gate('xor', [a, b], role);
  }

  xnor2(a: Bit, b: Bit, role = 'xnor'): Bit {
    if (a === CONST0) return this.not(b);
    if (b === CONST0) return this.not(a);
    if (a === CONST1) return b;
    if (b === CONST1) return a;
    if (a === b) return CONST1;
    if (this.complement(a, b)) return CONST0;
    return this.gate('xnor', [a, b], role);
  }

  /** AND of any number of bits, as a tree of gates with at most `maxFanIn` inputs. */
  andN(bits: Bit[], role = 'and'): Bit {
    const xs: Bit[] = [];
    for (const b of bits) {
      if (b === CONST0) return CONST0;
      if (b !== CONST1 && !xs.includes(b)) xs.push(b);
    }
    for (const b of xs) if (this.notSrc.has(b) && xs.includes(this.notSrc.get(b)!)) return CONST0;
    return this.tree('and', xs, CONST1, role);
  }

  orN(bits: Bit[], role = 'or'): Bit {
    const xs: Bit[] = [];
    for (const b of bits) {
      if (b === CONST1) return CONST1;
      if (b !== CONST0 && !xs.includes(b)) xs.push(b);
    }
    for (const b of xs) if (this.notSrc.has(b) && xs.includes(this.notSrc.get(b)!)) return CONST1;
    return this.tree('or', xs, CONST0, role);
  }

  xorN(bits: Bit[], role = 'xor'): Bit {
    // A balanced tree of 2-input gates keeps the depth at log n.
    let xs = bits.filter((b) => b !== CONST0 && b !== CONST1);
    const ones = bits.filter((b) => b === CONST1).length;
    while (xs.length > 1) {
      const next: Bit[] = [];
      for (let i = 0; i < xs.length; i += 2) next.push(i + 1 < xs.length ? this.xor2(xs[i]!, xs[i + 1]!, role) : xs[i]!);
      xs = next;
    }
    const acc = xs.length ? xs[0]! : CONST0;
    return ones & 1 ? this.not(acc) : acc;
  }

  private tree(type: 'and' | 'or', xs: Bit[], empty: Bit, role: string): Bit {
    if (xs.length === 0) return empty;
    let level = xs;
    while (level.length > 1) {
      const next: Bit[] = [];
      for (let i = 0; i < level.length; i += this.maxFanIn) {
        const group = level.slice(i, i + this.maxFanIn);
        next.push(group.length === 1 ? group[0]! : this.gate(type, group, role));
      }
      level = next;
    }
    return level[0]!;
  }

  /** `s ? b : a` (the RTL `mux`: `a` when s = 0). */
  mux(s: Bit, a: Bit, b: Bit, role = 'mux'): Bit {
    if (s === CONST0) return a;
    if (s === CONST1) return b;
    if (a === b) return a;
    if (a === CONST0 && b === CONST1) return s;
    if (a === CONST1 && b === CONST0) return this.not(s);
    if (isConst(a) || isConst(b) || !this.muxBlocks) {
      // (¬s ∧ a) ∨ (s ∧ b), folded where an arm is constant.
      if (a === CONST0) return this.and2(s, b, role);
      if (b === CONST0) return this.and2(this.not(s), a, role);
      if (a === CONST1) return this.or2(this.not(s), b, role);
      if (b === CONST1) return this.or2(s, a, role);
      return this.or2(this.and2(this.not(s), a, `${role}.lo`), this.and2(s, b, `${role}.hi`), `${role}.or`);
    }
    const key = `mux|${s},${a},${b}`;
    const hit = this.reuse(key);
    if (hit !== undefined) return hit;
    const y = this.nb.net();
    const id = this.emit('mux', { D0: a, D1: b, S0: s }, { Y: y }, { select: 1 }, role);
    this.remember(key, y, id);
    return y;
  }

  // ---------------------------------------------------------------------------------- arithmetic

  /** `a + b + cin` on bit vectors of equal width, as a ripple-carry chain. Returns the sum and the carry out. */
  add(a: Bit[], b: Bit[], cin: Bit = CONST0, role = 'fa'): { sum: Bit[]; cout: Bit } {
    const sum: Bit[] = [];
    let c = cin;
    for (let i = 0; i < a.length; i++) {
      this.bit(i);
      const x = this.xor2(a[i]!, b[i]!, `${role}.xor1`);
      sum.push(this.xor2(x, c, `${role}.xor2`));
      const g = this.and2(a[i]!, b[i]!, `${role}.and1`);
      const p = this.and2(x, c, `${role}.and2`);
      c = this.or2(g, p, `${role}.or`);
    }
    this.bit(undefined);
    return { sum, cout: c };
  }

  /** Increment (`a + inc`, with a one-bit `inc`): a chain of half adders. */
  inc(a: Bit[], inc: Bit, role = 'ha'): { sum: Bit[]; cout: Bit } {
    const sum: Bit[] = [];
    let c = inc;
    for (let i = 0; i < a.length; i++) {
      this.bit(i);
      sum.push(this.xor2(a[i]!, c, `${role}.xor`));
      c = this.and2(a[i]!, c, `${role}.and`);
    }
    this.bit(undefined);
    return { sum, cout: c };
  }

  // ---------------------------------------------------------------------------------- finishing

  /** Removes elements (gates, multiplexers, constants) whose outputs nothing reads, repeatedly. */
  prune(keep: Iterable<number> = []): void {
    const readers = new Map<number, number>();
    for (const n of keep) readers.set(n, (readers.get(n) ?? 0) + 1);
    for (const [id, ins] of this.ins) if (this.info[id]) for (const n of ins) readers.set(n, (readers.get(n) ?? 0) + 1);
    const producer = new Map<number, string>();
    for (const [id, outs] of this.outs) for (const n of outs) producer.set(n, id);
    const removed = new Set<string>();
    const queue: string[] = [];
    const typeOf = new Map<string, string>();
    for (const el of this.nb.build().elements) typeOf.set(el.id, el.type);
    const dead = (id: string) => PRUNABLE.has(typeOf.get(id) ?? '') && this.outs.get(id)!.every((n) => (readers.get(n) ?? 0) === 0);
    for (const id of this.order) if (dead(id)) queue.push(id);
    while (queue.length) {
      const id = queue.pop()!;
      if (removed.has(id) || !dead(id)) continue;
      removed.add(id);
      for (const n of this.ins.get(id)!) {
        readers.set(n, (readers.get(n) ?? 1) - 1);
        const p = producer.get(n);
        if (p !== undefined && !removed.has(p) && dead(p)) queue.push(p);
      }
    }
    if (removed.size === 0) return;
    this.removed = removed;
    for (const id of removed) {
      delete this.info[id];
    }
    for (const k of Object.keys(this.cells)) {
      const ids = this.cells[Number(k)]!.filter((id) => !removed.has(id));
      this.cells[Number(k)] = ids;
    }
  }

  removed = new Set<string>();

  /** The finished netlist elements (after pruning). */
  elements(): FlatElement[] {
    return this.nb.build().elements.filter((e) => !this.removed.has(e.id));
  }

  netCount(): number {
    return this.nb.build().netCount;
  }

  netNames(): (string | undefined)[] {
    return this.nb.build().netNames;
  }

  /** Records a cell that produced no elements (wiring), so that `cells` has an entry for every RTL cell. */
  touch(cell: RtlCell): void {
    this.cells[cell.id] ??= [];
  }

  /** The ids of the elements, in creation order (after pruning). */
  ids(): string[] {
    return this.order.filter((id) => !this.removed.has(id));
  }

  inputsOf(id: string): number[] {
    return this.ins.get(id) ?? [];
  }

  outputsOf(id: string): number[] {
    return this.outs.get(id) ?? [];
  }
}
