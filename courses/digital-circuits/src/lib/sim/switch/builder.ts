import type { FlatElement, FlatNetlist, Params } from '../netlist/types';
import { getDef, pinsOf, withDefaults } from '../netlist/catalog';
import type { TransistorSize } from './engine';

/**
 * Build transistor-level flat netlists in code: for tests, generated circuits (the gate compiler,
 * the abstraction dial) and memory arrays. Pins not mentioned get a net of their own.
 *
 *   const b = new SwitchBuilder();
 *   const a = b.input('A'), y = b.net('Y');
 *   b.inv('U1', a, y);
 *   const engine = createSwitchEngine(b.build());
 */
export class SwitchBuilder {
  private readonly names: (string | undefined)[] = [];
  private readonly elements: FlatElement[] = [];
  private readonly ids = new Set<string>();
  private groundNet: number | undefined;
  private vddNet: number | undefined;

  net(name?: string): number {
    return this.names.push(name) - 1;
  }

  nets(count: number, prefix?: string): number[] {
    return Array.from({ length: count }, (_, i) => this.net(prefix === undefined ? undefined : `${prefix}${i}`));
  }

  /** The ground net (0 at supply strength). */
  gnd(): number {
    return (this.groundNet ??= this.net('GND'));
  }

  /** The +5 V rail (a `rail` element). */
  vdd(): number {
    if (this.vddNet === undefined) {
      this.vddNet = this.net('VDD');
      this.add('rail', 'VDD', { v: this.vddNet });
    }
    return this.vddNet;
  }

  /** A net driven by a `toggle` with the same id (set it with engine.setParam(id, 'on', …)). */
  input(id: string, on = false): number {
    const n = this.net(id);
    this.add('toggle', id, { Y: n }, { on });
    return n;
  }

  /** Add an element of a catalog type; `pins` maps pin names to nets. */
  add(type: string, id: string, pins: Record<string, number>, params?: Params): FlatElement {
    const def = getDef(type);
    if (!def) throw new Error(`unknown component type "${type}"`);
    if (this.ids.has(id)) throw new Error(`duplicate element id "${id}"`);
    this.ids.add(id);
    const full = withDefaults(def, params);
    const defs = pinsOf(def, full);
    for (const name of Object.keys(pins)) {
      if (!defs.some((p) => p.name === name)) throw new Error(`${type} ${id} has no pin ${name}`);
    }
    const el: FlatElement = {
      id,
      type,
      params: full,
      pins: defs.map((p) => pins[p.name] ?? this.net()),
      pinNames: defs.map((p) => p.name),
    };
    this.elements.push(el);
    return el;
  }

  nmos(id: string, g: number, d: number, s: number, size?: TransistorSize): FlatElement {
    return this.add('nmos', id, { G: g, D: d, S: s }, size ? { strength: size } : undefined);
  }

  pmos(id: string, g: number, s: number, d: number, size?: TransistorSize): FlatElement {
    return this.add('pmos', id, { G: g, S: s, D: d }, size ? { strength: size } : undefined);
  }

  /** CMOS inverter (2 transistors). */
  inv(id: string, a: number, y: number): void {
    this.pmos(`${id}.p`, a, this.vdd(), y);
    this.nmos(`${id}.n`, a, y, this.gnd());
  }

  /** CMOS NAND: parallel pMOS pull-up, series nMOS pull-down. */
  nand(id: string, ins: number[], y: number): void {
    ins.forEach((a, i) => this.pmos(`${id}.p${i}`, a, this.vdd(), y));
    let top = y;
    ins.forEach((a, i) => {
      const bottom = i === ins.length - 1 ? this.gnd() : this.net();
      this.nmos(`${id}.n${i}`, a, top, bottom);
      top = bottom;
    });
  }

  /** CMOS NOR: series pMOS pull-up, parallel nMOS pull-down. */
  nor(id: string, ins: number[], y: number): void {
    let top = this.vdd();
    ins.forEach((a, i) => {
      const bottom = i === ins.length - 1 ? y : this.net();
      this.pmos(`${id}.p${i}`, a, top, bottom);
      top = bottom;
    });
    ins.forEach((a, i) => this.nmos(`${id}.n${i}`, a, y, this.gnd()));
  }

  /** Transmission gate between a and b: conducts when en = 1 (and enb = 0). */
  tgate(id: string, a: number, b: number, en: number, enb: number): void {
    this.nmos(`${id}.n`, en, a, b);
    this.pmos(`${id}.p`, enb, a, b);
  }

  build(): FlatNetlist {
    return { netCount: this.names.length, netNames: [...this.names], elements: [...this.elements], ground: this.groundNet };
  }
}
