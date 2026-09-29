/**
 * Resolve the names a chapter uses for timing-diagram traces ("A,B,Y", "U1.Y", "S") to nets.
 */
import type { Circuit, Connectivity } from '../sim/netlist/types';

export interface Trace {
  name: string;
  net: number;
}

/**
 * A trace name is, in order of preference: a component pin "U1.Y"; a net name (a label, a port, a
 * rail such as "+5V", or "GND"); the id of a component with a single pin (a toggle "A", an
 * indicator "S"), or with an output pin named Y. Unknown names are reported in `missing`.
 */
export function resolveTraces(spec: string | string[], circuit: Circuit, conn: Connectivity): { traces: Trace[]; missing: string[] } {
  const names = (Array.isArray(spec) ? spec : spec.split(',')).map((s) => s.trim()).filter(Boolean);
  const traces: Trace[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const net = resolveOne(name, circuit, conn);
    if (net === undefined) missing.push(name);
    else traces.push({ name, net });
  }
  return { traces, missing };
}

function resolveOne(name: string, circuit: Circuit, conn: Connectivity): number | undefined {
  const direct = conn.pinNet.get(name);
  if (direct !== undefined) return direct;
  const byName = conn.netNames.indexOf(name);
  if (byName >= 0) return byName;
  const comp = circuit.components.find((c) => c.id === name);
  if (comp) {
    const pins = [...conn.pinNet.keys()].filter((k) => k.startsWith(`${name}.`));
    if (pins.length === 1) return conn.pinNet.get(pins[0]!);
    const y = conn.pinNet.get(`${name}.Y`);
    if (y !== undefined) return y;
  }
  return undefined;
}
