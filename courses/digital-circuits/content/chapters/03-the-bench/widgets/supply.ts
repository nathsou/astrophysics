/**
 * The bench supply lab's physics: a supply with a voltage setting and a current limit connected to a load.
 * The engine runs 0.3 s of simulated time from switch-on, long enough for a badly connected LED to burn.
 */
import { createAnalogEngine } from '$lib/sim/analog';
import { netlist } from './flat';

export type Load = 'resistor' | 'led' | 'led-resistor' | 'short';

export const LOADS: { value: Load; label: string; text: string }[] = [
  { value: 'resistor', label: '1 kΩ resistor', text: 'A 1 kΩ resistor: current = voltage ÷ 1 kΩ.' },
  { value: 'led', label: 'LED, no resistor', text: 'A red LED wired straight to the supply: the mistake that kills LEDs.' },
  { value: 'led-resistor', label: 'LED + 330 Ω', text: 'An LED with its series resistor, as it should be.' },
  { value: 'short', label: 'Short circuit', text: 'A wire across the output: a fault, or a slip of the probe.' },
];

export interface Outcome {
  /** Voltage at the output terminals and current delivered. */
  volts: number;
  amps: number;
  /** The supply is limiting its current (the CC light). */
  cc: boolean;
  /** The LED burned out (or the load was destroyed). */
  burned: boolean;
  /** LED brightness 0–1, when there is one. */
  brightness: number | null;
  /** Messages from the engine about damaged parts. */
  messages: string[];
}

export function runSupply(load: Load, volts: number, limit: number, connected = true): Outcome {
  const c = netlist();
  c.add('P', 'supply', { '-': 'gnd', '+': 'out' }, { voltage: volts, limit });
  if (connected) {
    if (load === 'resistor') c.add('R', 'resistor', { '1': 'out', '2': 'gnd' }, { resistance: 1000 });
    else if (load === 'led') c.add('D', 'led', { A: 'out', K: 'gnd' }, { color: 'red' });
    else if (load === 'led-resistor') {
      c.add('R', 'resistor', { '1': 'out', '2': 'x' }, { resistance: 330 });
      c.add('D', 'led', { A: 'x', K: 'gnd' }, { color: 'red' });
    } else c.add('W', 'switch', { '1': 'out', '2': 'gnd' }, { closed: true });
  }
  const e = createAnalogEngine(c.build());
  e.advance(0.3);
  const p = e.state('P');
  const d = load === 'led' || load === 'led-resistor' ? e.state('D') : undefined;
  return {
    volts: Number(p.value),
    amps: Number(p.current),
    cc: !!p.cc,
    burned: connected && !!(d?.burned || e.state('R').burned),
    brightness: connected && d ? Number(d.brightness ?? 0) : null,
    messages: e.messages.filter((m) => m.level === 'warning').map((m) => m.text),
  };
}
