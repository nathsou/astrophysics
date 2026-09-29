import '../netlist/catalog';
import { getDef, pinsOf, withDefaults } from '../netlist/catalog';
import type { FlatElement, FlatNetlist, Params } from '../netlist/types';

/**
 * Builds flat netlists for tests: nets are named ("0" or "gnd" is ground), elements list their
 * pins by name.
 *
 *   const c = circuit();
 *   c.add('B1', 'battery', { '-': 'gnd', '+': 'vcc' }, { voltage: 9 });
 *   const netlist = c.build();
 */
export function circuit() {
  const names = new Map<string, number>();
  const elements: FlatElement[] = [];
  const net = (name: string) => {
    const key = name === '0' ? 'gnd' : name;
    let n = names.get(key);
    if (n === undefined) {
      n = names.size;
      names.set(key, n);
    }
    return n;
  };
  net('gnd');
  return {
    net,
    add(id: string, type: string, pins: Record<string, string>, params?: Params) {
      const def = getDef(type);
      if (!def) throw new Error(`unknown type ${type}`);
      const full = withDefaults(def, params);
      const defs = pinsOf(def, full);
      for (const k of Object.keys(pins)) if (!defs.some((d) => d.name === k)) throw new Error(`${type} has no pin ${k}`);
      const unused = (i: number) => `__${id}_${i}`;
      elements.push({
        id,
        type,
        params: full,
        pins: defs.map((d, i) => net(pins[d.name] ?? unused(i))),
        pinNames: defs.map((d) => d.name),
      });
      return this;
    },
    build(withGround = true): FlatNetlist {
      const netNames: (string | undefined)[] = [];
      for (const [k, v] of names) netNames[v] = k;
      return { netCount: names.size, netNames, elements, ground: withGround ? 0 : undefined };
    },
  };
}
