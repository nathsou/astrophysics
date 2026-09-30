/**
 * A tiny netlist builder for chapter widgets that run the analog engine on circuits built in code
 * (the bench tour, the scope lab, the RC lab). Nets are named; "gnd" (or "0") is the reference.
 *
 *   const c = netlist();
 *   c.add('B', 'battery', { '-': 'gnd', '+': 'a' }, { voltage: 9 });
 *   c.add('R1', 'resistor', { '1': 'a', '2': 'b' }, { resistance: 6000 });
 *   const flat = c.build();  // c.net('b') is the index of net b
 */
import '$lib/sim/netlist/catalog';
import { getDef, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
import type { FlatElement, FlatNetlist, Params } from '$lib/sim/netlist/types';

export function netlist() {
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
  const api = {
    net,
    add(id: string, type: string, pins: Record<string, string>, params?: Params) {
      const def = getDef(type);
      if (!def) throw new Error(`unknown component type ${type}`);
      const full = withDefaults(def, params);
      const defs = pinsOf(def, full);
      for (const k of Object.keys(pins)) if (!defs.some((d) => d.name === k)) throw new Error(`${type} has no pin ${k}`);
      elements.push({
        id,
        type,
        params: full,
        pins: defs.map((d, i) => net(pins[d.name] ?? `__${id}_${i}`)),
        pinNames: defs.map((d) => d.name),
      });
      return api;
    },
    build(): FlatNetlist {
      const netNames: (string | undefined)[] = [];
      for (const [k, v] of names) netNames[v] = k;
      return { netCount: names.size, netNames, elements, ground: 0 };
    },
  };
  return api;
}
