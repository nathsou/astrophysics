/**
 * A plain-text summary of what the outputs of a circuit show right now ("S: on. C: off. L1: lit."),
 * for screen readers: the schematic itself is a picture, so the widget announces changes here after
 * the reader flips a switch.
 */
import type { Engine } from '../sim/engine';
import type { Circuit, Connectivity } from '../sim/netlist/types';
import { formatReadout, logicChar } from './format';
import { AMMETER_FLOOR, VOLTMETER_FLOOR, floored } from '../sim/analog/meter-floors';

const OUTPUTS = new Set(['indicator', 'probe', 'led', 'lamp', 'hex-display', 'seven-seg', 'voltmeter', 'ammeter']);

export function describeOutputs(circuit: Circuit, conn: Connectivity, engine: Engine): string {
  const net = (n: number | undefined) => (n === undefined ? -1 : (engine.netlist.alias?.[n] ?? n));
  const parts: string[] = [];
  for (const c of circuit.components) {
    if (!OUTPUTS.has(c.type)) continue;
    const name = c.label || c.id;
    let s: ReturnType<Engine['state']> = {};
    try {
      s = engine.state(c.id) ?? {};
    } catch {
      /* no state for this element */
    }
    const pin = (p: string) => net(conn.pinNet.get(`${c.id}.${p}`));
    let text: string | undefined;
    switch (c.type) {
      case 'indicator': {
        const lit = s.brightness !== undefined ? s.brightness > 0.5 : pin('A') >= 0 && engine.logic(pin('A')) === 1;
        text = lit ? 'on' : 'off';
        break;
      }
      case 'probe':
        text = pin('A') >= 0 ? logicChar(engine.logic(pin('A'))) : undefined;
        break;
      case 'led':
      case 'lamp': {
        const b = Number(s.brightness ?? 0);
        text = s.burned ? 'burned out' : b > 0.7 ? 'bright' : b > 0.05 ? 'dim' : 'off';
        break;
      }
      case 'hex-display':
        text = s.value !== undefined ? Number(s.value).toString(16).toUpperCase() : undefined;
        break;
      case 'seven-seg':
        text = s.segments !== undefined ? `segments ${Number(s.segments).toString(2).padStart(8, '0')}` : undefined;
        break;
      // A meter announces what it displays (see symbols/Meters.svelte): its state's `value`, which is zero below the noise floor (1 µV, 1 nA),
      // not the solver's leakage ("3.9 pA" on an open circuit). An engine without that state gets the same floors here.
      case 'voltmeter': {
        const shown = Number(s.value ?? s.reading);
        const v = Number.isFinite(shown) ? shown : pin('+') >= 0 && pin('-') >= 0 ? floored(engine.voltage(pin('+')) - engine.voltage(pin('-')), VOLTMETER_FLOOR) : undefined;
        text = v === undefined ? undefined : formatReadout(v, 'V');
        break;
      }
      case 'ammeter': {
        const shown = Number(s.value ?? s.reading);
        const i = Number.isFinite(shown) ? shown : floored(engine.current(c.id, 0), AMMETER_FLOOR);
        text = formatReadout(i, 'A');
        break;
      }
    }
    if (text) parts.push(`${name}: ${text}`);
  }
  return parts.join('. ');
}
