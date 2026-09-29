/**
 * Probe points: where an instrument is attached to the circuit. A probe is remembered by place, not
 * by net number (nets are renumbered on every edit): a component pin ("R1.2"), a point on a wire, or a
 * net name ("GND", a net label).
 */
import type { Circuit, Connectivity } from '../../sim/netlist/types';
import type { Hit } from '../editor/hit';
import type { Layout, Pt } from '../editor/layout';
import { strictlyInside } from '../editor/ops';

export type ProbeRef = { pin: string } | { at: [number, number] } | { net: string };

export const GROUND = { net: 'GND' } as const satisfies ProbeRef;

export const sameProbe = (a: ProbeRef | undefined, b: ProbeRef | undefined): boolean => {
  if (!a || !b) return a === b;
  if ('pin' in a) return 'pin' in b && a.pin === b.pin;
  if ('net' in a) return 'net' in b && a.net === b.net;
  return 'at' in b && a.at[0] === b.at[0] && a.at[1] === b.at[1];
};

/** The probe for a click on the schematic: pins and wires can be probed, part bodies cannot. */
export function probeFromHit(hit: Hit | undefined): ProbeRef | undefined {
  if (!hit) return undefined;
  if (hit.kind === 'pin') return { pin: `${hit.comp}.${hit.pin}` };
  if (hit.kind === 'wire') return { at: [hit.x, hit.y] };
  return undefined;
}

/** Index of the wire that passes through (or ends at) a grid point. */
function wireAt(circuit: Circuit, p: Pt): number {
  return circuit.wires.findIndex((w) => {
    const pts = w.points as Pt[];
    return pts.some((q) => q[0] === p[0] && q[1] === p[1]) || pts.slice(1).some((q, j) => strictlyInside(p, pts[j]!, q));
  });
}

/** The net (top-level numbering of `conn`) a probe is on, if the place still has one. */
export function probeNet(ref: ProbeRef | undefined, circuit: Circuit, conn: Connectivity): number | undefined {
  if (!ref) return undefined;
  if ('pin' in ref) return conn.pinNet.get(ref.pin);
  if ('net' in ref) {
    const n = conn.netNames.indexOf(ref.net);
    return n >= 0 ? n : undefined;
  }
  const w = wireAt(circuit, ref.at);
  if (w >= 0) return conn.wireNet[w];
  return undefined;
}

/** A short name for a probe: the net's name when it has one, else the pin or the point. */
export function probeLabel(ref: ProbeRef | undefined, conn?: Connectivity, circuit?: Circuit): string {
  if (!ref) return '—';
  if ('net' in ref) return ref.net;
  if (conn && circuit) {
    const n = probeNet(ref, circuit, conn);
    const named = n === undefined ? undefined : conn.netNames[n];
    if (named) return named;
  }
  if ('pin' in ref) return ref.pin;
  return `(${ref.at[0]}, ${ref.at[1]})`;
}

/** Where to draw the marker for a probe (grid units). Net-name probes have no place. */
export function probePoint(ref: ProbeRef | undefined, layout: Layout): Pt | undefined {
  if (!ref) return undefined;
  if ('at' in ref) return ref.at;
  if ('pin' in ref) {
    const dot = ref.pin.indexOf('.');
    const l = layout.byId.get(ref.pin.slice(0, dot));
    const p = l?.pins.find((x) => x.pin === ref.pin.slice(dot + 1));
    return p ? [p.x, p.y] : undefined;
  }
  return undefined;
}

/** Rewrite the pin probes of a part that was renamed, anywhere in a JSON-like value (instrument settings). */
export function renameInProbes<T>(value: T, from: string, to: string): T {
  if (Array.isArray(value)) return value.map((v) => renameInProbes(v, from, to)) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'pin' && typeof v === 'string' && v.startsWith(`${from}.`)) out[k] = `${to}${v.slice(from.length)}`;
      else out[k] = renameInProbes(v, from, to);
    }
    return out as T;
  }
  return value;
}
