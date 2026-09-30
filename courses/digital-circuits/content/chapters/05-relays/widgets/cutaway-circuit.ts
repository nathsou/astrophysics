/**
 * The circuit behind the relay cutaway: a bench supply drives the coil of a 5 V, 70 Ω relay, and its
 * two contacts light a green LED (COM–NO) and a red LED (COM–NC) through 150 Ω resistors. It is built
 * as a flat netlist because the figure draws its own picture; the numbers are the engine's.
 */
import '$lib/sim/netlist/catalog';
import { getDef, pinsOf, withDefaults } from '$lib/sim/netlist/catalog';
import type { FlatElement, FlatNetlist, Params } from '$lib/sim/netlist/types';

export const COIL_VOLTAGE = 5;
export const COIL_RESISTANCE = 70;
export const OPERATE_TIME = 0.005;
/** Rated coil current, and the fractions at which the engine pulls the armature in and lets it go (models/switches.ts). */
export const RATED_CURRENT = COIL_VOLTAGE / COIL_RESISTANCE;
export const PULL_IN_FRACTION = 0.7;
export const DROP_OUT_FRACTION = 0.3;
export const PULL_IN_CURRENT = PULL_IN_FRACTION * RATED_CURRENT;
export const DROP_OUT_CURRENT = DROP_OUT_FRACTION * RATED_CURRENT;

export function cutawayNetlist(): FlatNetlist {
  const names = new Map<string, number>([['gnd', 0]]);
  const net = (n: string) => {
    let k = names.get(n);
    if (k === undefined) names.set(n, (k = names.size));
    return k;
  };
  const elements: FlatElement[] = [];
  const add = (id: string, type: string, pins: Record<string, string>, params?: Params) => {
    const def = getDef(type);
    if (!def) throw new Error(`unknown type ${type}`);
    const full = withDefaults(def, params);
    const defs = pinsOf(def, full);
    elements.push({ id, type, params: full, pins: defs.map((d, i) => net(pins[d.name] ?? `nc:${id}:${i}`)), pinNames: defs.map((d) => d.name) });
  };
  add('S', 'supply', { '-': 'gnd', '+': 'coil' }, { voltage: 0, limit: 1 });
  add('K1', 'relay', { A: 'coil', B: 'gnd', COM: 'com', NO: 'no', NC: 'nc' }, { coilVoltage: COIL_VOLTAGE, coilResistance: COIL_RESISTANCE, coilInductance: 0.1, operateTime: OPERATE_TIME });
  add('V', 'rail', { v: 'com' }, { voltage: 5 });
  add('R1', 'resistor', { '1': 'no', '2': 'ledno' }, { resistance: 150 });
  add('D1', 'led', { A: 'ledno', K: 'gnd' }, { color: 'green' });
  add('R2', 'resistor', { '1': 'nc', '2': 'lednc' }, { resistance: 150 });
  add('D2', 'led', { A: 'lednc', K: 'gnd' }, { color: 'red' });
  const netNames: (string | undefined)[] = [];
  for (const [k, v] of names) netNames[v] = k;
  return { netCount: names.size, netNames, elements, ground: 0 };
}
