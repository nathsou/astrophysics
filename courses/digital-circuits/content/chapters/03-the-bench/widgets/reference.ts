/**
 * "Where is zero?" A 9 V battery across R1 (6 kΩ) and R2 (3 kΩ). Voltages are always measured relative to
 * something: choose which node the ground symbol sits on and every node voltage shifts, while the voltage
 * across each part does not change.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from './flat';

export type Node = 'T' | 'M' | 'B';
export const NODES: Node[] = ['T', 'M', 'B'];

export interface Voltages {
  T: number;
  M: number;
  B: number;
  /** Across R1 (T relative to M) and R2 (M relative to B). */
  r1: number;
  r2: number;
}

export function voltages(ground: Node): Voltages {
  const c = netlist();
  const name = (n: Node) => (n === ground ? 'gnd' : n);
  c.add('BAT', 'battery', { '-': name('B'), '+': name('T') }, { voltage: 9, resistance: 0.001 });
  c.add('R1', 'resistor', { '1': name('T'), '2': name('M') }, { resistance: 6000 });
  c.add('R2', 'resistor', { '1': name('M'), '2': name('B') }, { resistance: 3000 });
  const e = createAnalogEngine(c.build());
  const v = (n: Node) => e.voltage(c.net(name(n)));
  const T = v('T');
  const M = v('M');
  const B = v('B');
  return { T, M, B, r1: T - M, r2: M - B };
}
