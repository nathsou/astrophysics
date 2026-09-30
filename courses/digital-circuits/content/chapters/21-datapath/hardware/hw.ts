/**
 * A thin layer over the parts bin's `CircuitBuilder` for building Octet as a real circuit: the same
 * components the reader has built (`part:register`, `part:counter`, `part:adder8`, …) or, at the
 * `blocks` level, the simulator's own building blocks (`register`, `counter`, `adder`, `mux`, `ram`),
 * which behave identically but simulate several times faster.
 *
 * It records where every named net can be found, so a widget or a test can read a register or a bus
 * from the running engine by name (`net('PC3')`), and it can put a logic switch on every input, for
 * circuits that run on their own.
 */
import { CircuitBuilder, behaviourOf } from '$lib/partsbin';
import type { SubResolver } from '$lib/sim/netlist/connect';
import { topLevelNets } from '$lib/sim/netlist/flatten';
import type { Circuit, Params } from '$lib/sim/netlist/types';

/** `parts`: the reader's parts bin (reference parts unless they have built their own). `blocks`: the simulator's blocks. */
export type Level = 'parts' | 'blocks';

/** Resolver used while building (pin lists only); flattening takes its own. */
export const buildResolver: SubResolver = (type) => (type.startsWith('part:') ? behaviourOf(type.slice(5)) : undefined);

export const names = (prefix: string, n: number, from = 0): string[] => Array.from({ length: n }, (_, i) => `${prefix}${from + i}`);

interface PinRef {
  id: string;
  pin: string;
}

export class Hw {
  readonly b: CircuitBuilder;
  private readonly refs = new Map<string, PinRef>();
  /** Element ids of the logic switches put on inputs (by input name). */
  readonly switches = new Map<string, string>();
  private zeroNet: string | undefined;
  private oneNet: string | undefined;

  constructor(
    title: string,
    readonly level: Level,
    /** `toggles`: an input is a logic switch on the net; `ports`: an input port of a subcircuit. */
    readonly inputMode: 'toggles' | 'ports' = 'toggles',
  ) {
    this.b = new CircuitBuilder(title, { parts: buildResolver });
  }

  private note(id: string, pins: Record<string, string>): void {
    for (const [pin, net] of Object.entries(pins)) if (!this.refs.has(net)) this.refs.set(net, { id, pin });
  }

  /** Any component; returns its id. */
  comp(type: string, pins: Record<string, string>, params?: Params): string {
    const id = this.b.comp(type, pins, params);
    this.note(id, pins);
    return id;
  }

  part(id: string, pins: Record<string, string>): string {
    return this.comp(`part:${id}`, pins);
  }

  /** An input: a logic switch driving `name`, or an input port. */
  input(name: string, on = false): string {
    if (this.inputMode === 'ports') return this.b.input(name);
    const id = this.comp('toggle', { Y: name }, { on });
    this.switches.set(name, id);
    return name;
  }

  inputs(prefix: string, n: number): string[] {
    return names(prefix, n).map((x) => this.input(x));
  }

  output(name: string, net = name): void {
    if (this.inputMode === 'ports') this.b.output(name, net);
  }

  get zero(): string {
    if (this.zeroNet === undefined) {
      this.zeroNet = 'ZERO';
      this.comp('const', { Y: 'ZERO' }, { value: 0 });
    }
    return this.zeroNet;
  }
  get one(): string {
    if (this.oneNet === undefined) {
      this.oneNet = 'ONE';
      this.comp('const', { Y: 'ONE' }, { value: 1 });
    }
    return this.oneNet;
  }

  // Gates (catalog gates at either level).
  private gate(type: string, ins: string[], out?: string): string {
    const o = out ?? this.b.net();
    const pins: Record<string, string> = { Y: o };
    ins.forEach((n, i) => (pins[String.fromCharCode(65 + i)] = n));
    const params: Params = type === 'not' || type === 'buffer' || ins.length === 2 ? {} : { inputs: ins.length };
    this.comp(type, pins, params);
    return o;
  }
  not(a: string, out?: string): string {
    return this.gate('not', [a], out);
  }
  and(ins: string[], out?: string): string {
    return this.tree('and', ins, out);
  }
  or(ins: string[], out?: string): string {
    return this.tree('or', ins, out);
  }
  nor(ins: string[], out?: string): string {
    return this.gate('nor', ins, out);
  }
  xor(a: string, b: string, out?: string): string {
    return this.gate('xor', [a, b], out);
  }
  xnor(a: string, b: string, out?: string): string {
    return this.gate('xnor', [a, b], out);
  }
  buffer(a: string, out?: string): string {
    return this.gate('buffer', [a], out);
  }
  /** AND or OR of any number of nets, with gates of at most eight inputs. */
  private tree(type: 'and' | 'or', ins: string[], out?: string): string {
    if (ins.length === 0) throw new Error(`${type} of nothing`);
    if (ins.length === 1) return out ? this.buffer(ins[0]!, out) : ins[0]!;
    if (ins.length <= 8) return this.gate(type, ins, out);
    const groups: string[] = [];
    for (let i = 0; i < ins.length; i += 8) groups.push(this.tree(type, ins.slice(i, i + 8)));
    return this.tree(type, groups, out);
  }

  // Blocks that differ between the levels. Bit i of a bus is `prefix + i`.

  /**
   * A register (`part:register`, 8 bits, or the `register` block). Q nets are `q0…`, or the names given.
   * Returns the names of Q.
   */
  reg(q: string | string[], d: string[], o: { clk: string; en?: string; clr?: string; init?: number }): string[] {
    const qs = typeof q === 'string' ? names(q, d.length) : q;
    if (qs.length !== d.length) throw new Error('a register needs one Q name per D input');
    const pins: Record<string, string> = { CLK: o.clk, EN: o.en ?? this.one, CLR: o.clr ?? this.zero };
    d.forEach((n, i) => (pins[`D${i}`] = n));
    qs.forEach((n, i) => (pins[`Q${i}`] = n));
    if (this.level === 'parts') {
      if (d.length !== 8) throw new Error('part:register is 8 bits wide');
      this.part('register', pins);
    } else this.comp('register', pins, { bits: d.length, init: o.init ?? 0 });
    return qs;
  }

  /** A wider register made of 8-bit ones: the last one is padded with unused bits. */
  regs(q: string[], d: string[], o: { clk: string; en?: string; clr?: string }): string[] {
    for (let i = 0; i < q.length; i += 8) {
      const qi = q.slice(i, i + 8);
      const di = d.slice(i, i + 8);
      while (qi.length < 8) {
        qi.push(this.b.net('unused'));
        di.push(this.zero);
      }
      this.reg(qi, di, o);
    }
    return q;
  }

  /** An 8-bit counter with load and clear. */
  counter(q: string, d: string[], o: { clk: string; en: string; load: string; clr: string }): string[] {
    const qs = names(q, 8);
    const pins: Record<string, string> = { CLK: o.clk, EN: o.en, CLR: o.clr, LOAD: o.load };
    d.forEach((n, i) => (pins[`D${i}`] = n));
    qs.forEach((n, i) => (pins[`Q${i}`] = n));
    if (this.level === 'parts') this.part('counter', pins);
    else this.comp('counter', { ...pins, CO: this.b.net('co') }, { bits: 8 });
    return qs;
  }

  mux2(d0: string, d1: string, s: string, out?: string): string {
    const y = out ?? this.b.net();
    if (this.level === 'parts') this.part('mux2', { D0: d0, D1: d1, S: s, Y: y });
    else this.comp('mux', { D0: d0, D1: d1, S0: s, Y: y }, { select: 1 });
    return y;
  }

  mux4(d: string[], s0: string, s1: string, out?: string): string {
    const y = out ?? this.b.net();
    if (this.level === 'parts') this.part('mux4', { D0: d[0]!, D1: d[1]!, D2: d[2]!, D3: d[3]!, S0: s0, S1: s1, Y: y });
    else this.comp('mux', { D0: d[0]!, D1: d[1]!, D2: d[2]!, D3: d[3]!, S0: s0, S1: s1, Y: y }, { select: 2 });
    return y;
  }

  mux8(d: string[], s: string[], out?: string): string {
    const y = out ?? this.b.net();
    const pins: Record<string, string> = { Y: y };
    d.forEach((n, i) => (pins[`D${i}`] = n));
    s.forEach((n, i) => (pins[`S${i}`] = n));
    if (this.level === 'parts') this.part('mux8', pins);
    else this.comp('mux', pins, { select: 3 });
    return y;
  }

  /** A 2→4 decoder (one output high while `en` is high). */
  dec2(a0: string, a1: string, en: string, ys: string[]): void {
    const pins: Record<string, string> = { A0: a0, A1: a1, EN: en };
    ys.forEach((n, i) => (pins[`Y${i}`] = n));
    if (this.level === 'parts') this.part('dec2-4', pins);
    else this.comp('decoder', pins, { bits: 2 });
  }

  /** A 3→8 decoder. */
  dec3(a: string[], en: string, ys: string[]): void {
    const pins: Record<string, string> = { EN: en };
    a.forEach((n, i) => (pins[`A${i}`] = n));
    ys.forEach((n, i) => (pins[`Y${i}`] = n));
    if (this.level === 'parts') this.part('dec3-8', pins);
    else this.comp('decoder', pins, { bits: 3 });
  }

  tri(a: string, en: string, y: string): void {
    if (this.level === 'parts') this.part('tri-state', { A: a, EN: en, Y: y });
    else this.comp('tristate', { A: a, EN: en, Y: y });
  }

  /** The 256-byte RAM: DO follows the byte at A; DI is written at a rising edge of CLK while WE is 1. */
  ram(a: string[], di: string[], we: string, clk: string, doNames: string[]): string {
    const pins: Record<string, string> = { WE: we, CLK: clk };
    a.forEach((n, i) => (pins[`A${i}`] = n));
    di.forEach((n, i) => (pins[`DI${i}`] = n));
    doNames.forEach((n, i) => (pins[`DO${i}`] = n));
    return this.level === 'parts' ? this.part('ram', pins) : this.comp('ram', pins, { addrBits: 8, dataBits: 8 });
  }

  build(): Circuit {
    return this.b.build();
  }

  /** Where each named net can be found in the circuit (`pinNet` key) — for `netTable`. */
  netRefs(): Map<string, PinRef> {
    return this.refs;
  }
}

/**
 * The flat net number of every named net that some component pin touches. Flattening keeps the numbering
 * of the top level (see `flatten`), so these index the engine's nets directly (after the alias table).
 */
export function netTable(hw: Hw, circuit: Circuit, resolver: SubResolver, alias?: number[]): Map<string, number> {
  const conn = topLevelNets(circuit, resolver);
  const out = new Map<string, number>();
  for (const [net, { id, pin }] of hw.netRefs()) {
    const n = conn.pinNet.get(`${id}.${pin}`);
    if (n !== undefined) out.set(net, alias ? (alias[n] ?? n) : n);
  }
  return out;
}
