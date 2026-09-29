import type { Circuit, FlatElement, FlatNetlist } from './types';
import { connect, defOf, globalName, subResolver, type SubResolver } from './connect';
import { pinsOf, withDefaults } from './catalog';

/** Components that only make connections; they do not become elements. */
const PURE_WIRING = new Set(['ground', 'label', 'port']);

/**
 * Expand a drawn circuit into a flat netlist. Subcircuits are inlined recursively: their ports
 * join the nets of the parent's pins, their other nets get fresh numbers, and ground and rails are
 * global. Element ids are hierarchical ("U1/R3").
 *
 * `parts` resolves "part:<name>" types from the parts bin.
 */
export function flatten(circuit: Circuit, parts?: SubResolver): FlatNetlist {
  const netNames: (string | undefined)[] = [];
  const elements: FlatElement[] = [];
  const globals = new Map<string, number>();
  const fresh = (name?: string) => netNames.push(name) - 1;

  function expand(c: Circuit, prefix: string, resolve: SubResolver, portNets: Map<string, number> | undefined, depth: number): void {
    if (depth > 32) throw new Error(`subcircuits nested too deeply at ${prefix} (a subcircuit that contains itself?)`);
    const conn = connect(c, resolve);
    const local = new Array<number | undefined>(conn.netCount);
    // The top level keeps connect()'s numbering, so renderers can map wires to flat nets directly.
    if (depth === 0) for (let n = 0; n < conn.netCount; n++) local[n] = fresh(conn.netNames[n]);

    // Ports of this level map to the parent's nets; ground and rails to the global nets.
    for (const comp of c.components) {
      const g = globalName(comp);
      const pinKey = `${comp.id}.${comp.type === 'ground' ? 'g' : 'v'}`;
      if (g) {
        const n = conn.pinNet.get(pinKey)!;
        if (!globals.has(g)) globals.set(g, local[n] ?? fresh(conn.netNames[n]));
        local[n] = globals.get(g)!;
      }
      if (comp.type === 'port' && portNets) {
        const outer = portNets.get(String(comp.params?.name ?? comp.id));
        if (outer !== undefined) local[conn.pinNet.get(`${comp.id}.p`)!] = outer;
      }
    }
    const netOf = (n: number) => (local[n] ??= fresh(prefix ? undefined : conn.netNames[n]));

    for (const comp of c.components) {
      if (PURE_WIRING.has(comp.type)) continue;
      const def = defOf(comp, resolve);
      const params = withDefaults(def, comp.params);
      const pins = pinsOf(def, params);
      const nets = pins.map((p) => netOf(conn.pinNet.get(`${comp.id}.${p.name}`)!));
      const sub = getDefIsSub(comp.type) ? resolve(comp.type) : undefined;
      if (sub) {
        const map = new Map(pins.map((p, i) => [p.name, nets[i]!]));
        expand(sub, `${prefix}${comp.id}/`, subResolver(sub, resolve), map, depth + 1);
        continue;
      }
      elements.push({ id: `${prefix}${comp.id}`, type: comp.type, params, pins: nets, pinNames: pins.map((p) => p.name) });
    }
    // Nets with no element pin still get numbers, so wires can be coloured.
    for (let n = 0; n < conn.netCount; n++) netOf(n);
  }

  expand(circuit, '', subResolver(circuit, undefined, parts), undefined, 0);
  return { netCount: netNames.length, netNames, elements, ground: globals.get('GND') };
}

const getDefIsSub = (type: string) => type.startsWith('sub:') || type.startsWith('part:');

/**
 * Connectivity of the top level of a circuit. flatten() gives the top level's nets the numbers
 * 0 … netCount − 1 in the same order as connect(), so the renderer can colour wires and pins with
 * the values an engine reports for the flat netlist.
 */
export function topLevelNets(circuit: Circuit, parts?: SubResolver) {
  return connect(circuit, subResolver(circuit, undefined, parts));
}
