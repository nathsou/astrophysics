import type { FlatElement, FlatNetlist, Params } from '../netlist/types';
import { getDef, pinsOf, withDefaults } from '../netlist/catalog';

/**
 * Build a flat netlist in code, without drawing a circuit: for tests, checkers and generated
 * circuits. Pins not mentioned get a net of their own (unconnected).
 *
 *   const b = new NetlistBuilder();
 *   const a = b.net('A'), y = b.net('Y');
 *   b.add('toggle', 'SA', { Y: a });
 *   b.add('not', 'U1', { A: a, Y: y });
 *   const engine = createDigitalEngine(b.build());
 */
export class NetlistBuilder {
  private readonly names: (string | undefined)[] = [];
  private readonly elements: FlatElement[] = [];
  private groundNet: number | undefined;

  /** A new net. */
  net(name?: string): number {
    return this.names.push(name) - 1;
  }

  /** Several new nets, named prefix0, prefix1, … when a prefix is given. */
  nets(count: number, prefix?: string): number[] {
    return Array.from({ length: count }, (_, i) => this.net(prefix === undefined ? undefined : `${prefix}${i}`));
  }

  /** The ground net (driven 0 by the digital engine). */
  ground(): number {
    return (this.groundNet ??= this.net('GND'));
  }

  /**
   * Add an element of a catalog type. `pins` maps pin names (or positions) to nets; parameters
   * missing from `params` take the catalog defaults.
   */
  add(type: string, id: string, pins: Record<string, number> | number[], params?: Params): FlatElement {
    const def = getDef(type);
    if (!def) throw new Error(`unknown component type "${type}"`);
    const full = withDefaults(def, params);
    const defs = pinsOf(def, full);
    const byName = Array.isArray(pins) ? undefined : pins;
    if (byName) {
      for (const name of Object.keys(byName)) {
        if (!defs.some((p) => p.name === name)) throw new Error(`${type} ${id} has no pin ${name}`);
      }
    }
    const el: FlatElement = {
      id,
      type,
      params: full,
      pins: defs.map((p, i) => (byName ? byName[p.name] : (pins as number[])[i]) ?? this.net()),
      pinNames: defs.map((p) => p.name),
    };
    this.elements.push(el);
    return el;
  }

  build(): FlatNetlist {
    return { netCount: this.names.length, netNames: [...this.names], elements: [...this.elements], ground: this.groundNet };
  }
}
