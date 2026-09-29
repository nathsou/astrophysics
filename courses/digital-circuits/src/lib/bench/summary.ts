/**
 * A plain-text summary of what the outputs of a circuit show right now ("S: on. C: off. L1: lit."),
 * for screen readers: the schematic itself is a picture, so the widget announces changes here after
 * the reader flips a switch.
 */
import type { Engine } from '../sim/engine';
import type { Circuit, Connectivity } from '../sim/netlist/types';
import { formatReadout, logicChar } from './format';

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
      case 'voltmeter':
        text = pin('+') >= 0 && pin('-') >= 0 ? formatReadout(engine.voltage(pin('+')) - engine.voltage(pin('-')), 'V') : undefined;
        break;
      case 'ammeter':
        text = formatReadout(engine.current(c.id, 0), 'A');
        break;
    }
    if (text) parts.push(`${name}: ${text}`);
  }
  return parts.join('. ');
}
