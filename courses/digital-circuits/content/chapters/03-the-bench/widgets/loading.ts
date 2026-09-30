/**
 * Meter loading: a voltmeter is a resistor (its input resistance) connected across the part it measures. On a
 * divider whose own resistance is comparable, that resistor changes the very voltage being measured.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from './flat';

export interface Loading {
  /** What the node would read with no meter attached. */
  ideal: number;
  /** What the meter reads. */
  reading: number;
  /** (reading − ideal) / ideal. */
  error: number;
}

/** A source `vs` across R1 (top) and R2 (bottom); the meter, of input resistance `rin`, is across R2. */
export function loading(vs: number, r1: number, r2: number, rin: number): Loading {
  const c = netlist();
  c.add('V', 'rail', { v: 'top' }, { voltage: vs });
  c.add('R1', 'resistor', { '1': 'top', '2': 'mid' }, { resistance: r1, power: 100 });
  c.add('R2', 'resistor', { '1': 'mid', '2': 'gnd' }, { resistance: r2, power: 100 });
  c.add('M', 'resistor', { '1': 'mid', '2': 'gnd' }, { resistance: rin, power: 100 });
  const e = createAnalogEngine(c.build());
  const reading = e.voltage(c.net('mid'));
  const ideal = (vs * r2) / (r1 + r2);
  return { ideal, reading, error: (reading - ideal) / ideal };
}

/** The exact answer: R2 in parallel with the meter. */
export function loadedRatio(r1: number, r2: number, rin: number): number {
  const p = (r2 * rin) / (r2 + rin);
  return p / (r1 + p);
}
