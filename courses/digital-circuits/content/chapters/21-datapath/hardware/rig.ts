/**
 * A built circuit on a running digital engine, with named access to its nets: what the widgets, the
 * tests and the differential harness all use.
 */
import '$lib/sim/netlist/catalog';
import { flatten } from '$lib/sim/netlist/flatten';
import type { SubResolver } from '$lib/sim/netlist/connect';
import type { Circuit, FlatNetlist, Logic } from '$lib/sim/netlist/types';
import { createDigitalEngine, type DigitalEngine, type DigitalEngineOptions } from '$lib/sim/digital';
import { partsResolver } from '$lib/partsbin/store-core';
import { Hw, netTable } from './hw';

/** A circuit, with what is needed to find its nets and switches again. */
export interface Built {
  circuit: Circuit;
  hw: Hw;
}

export function built(hw: Hw): Built {
  return { circuit: hw.build(), hw };
}

/** The reference parts (or the reader's, if a resolver for them is given). */
export const referenceParts: SubResolver = partsResolver(false);

export class Rig {
  readonly flat: FlatNetlist;
  readonly engine: DigitalEngine;
  private readonly nets: Map<string, number>;
  private readonly switches: Map<string, string>;
  /** The id of the RAM element, if the circuit has one. */
  readonly ramId: string | undefined;

  constructor(
    readonly b: Built,
    resolver: SubResolver = referenceParts,
    options?: DigitalEngineOptions,
  ) {
    this.flat = flatten(b.circuit, resolver);
    this.nets = netTable(b.hw, b.circuit, resolver, this.flat.alias);
    this.switches = b.hw.switches;
    this.engine = createDigitalEngine(this.flat, options);
    this.ramId = this.flat.elements.find((e) => e.type === 'ram')?.id;
  }

  /** Engine net number of a named net. */
  net(name: string): number {
    const n = this.nets.get(name);
    if (n === undefined) throw new Error(`no net called ${name}`);
    return n;
  }

  has(name: string): boolean {
    return this.nets.has(name);
  }

  logic(name: string): Logic {
    return this.engine.logic(this.net(name));
  }

  /** Bit i of a bus as 0 or 1; X and Z read as NaN. */
  bit(name: string): number {
    const v = this.logic(name);
    return v === 0 ? 0 : v === 1 ? 1 : NaN;
  }

  /** The number on a bus `prefix0 … prefix(n−1)`, or undefined while any bit is X or Z. */
  word(prefix: string, n = 8): number | undefined {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const b = this.bit(`${prefix}${i}`);
      if (Number.isNaN(b)) return undefined;
      v += b * 2 ** i;
    }
    return v;
  }

  /** A string of the bits, most significant first, with `?` for X and `z` for a floating wire. */
  bits(prefix: string, n = 8): string {
    let s = '';
    for (let i = n - 1; i >= 0; i--) {
      const v = this.logic(`${prefix}${i}`);
      s += v === 0 ? '0' : v === 1 ? '1' : v === 3 ? 'z' : '?';
    }
    return s;
  }

  /** Set a logic switch by input name (`CLK`, `OE_PC`, …). */
  set(name: string, value: number | boolean): void {
    const id = this.switches.get(name);
    if (id === undefined) throw new Error(`no input switch ${name}`);
    this.engine.setParam(id, 'on', !!value);
  }

  setWord(prefix: string, value: number, n = 8): void {
    for (let i = 0; i < n; i++) this.set(`${prefix}${i}`, (value >> i) & 1);
  }

  /** Read a RAM byte, or write one from outside. */
  peek(address: number): number {
    return this.engine.memory(this.ramId!)![address & 0xff]!;
  }
  poke(address: number, value: number): void {
    this.engine.writeMemory(this.ramId!, address & 0xff, value & 0xff);
  }

  /** Advance simulated time (seconds) and let everything settle. */
  run(seconds: number): void {
    this.engine.advance(seconds);
  }
}
