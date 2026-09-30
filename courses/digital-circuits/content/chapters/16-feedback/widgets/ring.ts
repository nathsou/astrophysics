/**
 * Rings of inverters on the digital engine.
 *
 * An inverter's output is the opposite of its input. Close a ring of n of them and every wire is asked to be the
 * opposite of the one before it. If n is odd that cannot be satisfied and the edge chases itself round the ring for
 * ever; the period is 2 × n × delay, since the edge has to go round twice (once to make every wire 1, once to make
 * every wire 0). If n is even, there are two ways to satisfy it, and the ring stays in whichever one it powered up in.
 */
import '$lib/sim/netlist/catalog';
import { NetlistBuilder, createDigitalEngine, type DigitalEngine } from '$lib/sim/digital';

export interface Ring {
  engine: DigitalEngine;
  n: number;
  /** Delay of each inverter, ns. */
  delay: number;
  /** The net at the output of each inverter (nodes[k] is what inverter k + 1 reads). */
  nodes: number[];
}

export function makeRing(n: number, delayNs: number, seed = 1): Ring {
  const b = new NetlistBuilder();
  const nodes = b.nets(n, 'n');
  for (let k = 0; k < n; k++) b.add('not', `U${k + 1}`, { A: nodes[k]!, Y: nodes[(k + 1) % n]! }, { delay: delayNs });
  // The output of inverter k is node k + 1: rename so nodes[k] is the output of inverter k.
  return { engine: createDigitalEngine(b.build(), { seed }), n, delay: delayNs, nodes: nodes.map((_, k) => nodes[(k + 1) % n]!) };
}

/** Period predicted by the theory: an odd ring of n inverters with delay d. NaN for an even ring or no delay. */
export function predictedPeriod(n: number, delayNs: number): number {
  return n % 2 === 1 && delayNs > 0 ? 2 * n * delayNs : NaN;
}

/** Real frequency in Hz for a period in ns. */
export const frequencyHz = (periodNs: number): number => 1e9 / periodNs;

/** Measured period (ns) of a net, from the times of its last rising edges; NaN if it does not oscillate. */
export function measuredPeriod(times: Float64Array, values: Float64Array): number {
  const rises: number[] = [];
  for (let i = 1; i < times.length; i++) if (values[i - 1] === 0 && values[i] === 1) rises.push(times[i]!);
  if (rises.length < 3) return NaN;
  const last = rises.slice(-4);
  return ((last[last.length - 1]! - last[0]!) / (last.length - 1)) * 1e9;
}

/**
 * The tone that stands for an oscillation of `hz`: the real frequency divided by 125,000, so that 100 MHz is
 * 800 Hz, and each factor of two in the ring's frequency is one octave. Kept between 40 Hz and 4 kHz.
 */
export const SCALE = 125_000;
export function audibleHz(hz: number): number {
  return Math.min(4000, Math.max(40, hz / SCALE));
}

/** "167 MHz", "16.7 MHz", "2.5 kHz". */
export function formatHz(hz: number): string {
  if (!Number.isFinite(hz)) return '—';
  if (hz >= 1e9) return `${+(hz / 1e9).toPrecision(3)} GHz`;
  if (hz >= 1e6) return `${+(hz / 1e6).toPrecision(3)} MHz`;
  if (hz >= 1e3) return `${+(hz / 1e3).toPrecision(3)} kHz`;
  return `${+hz.toPrecision(3)} Hz`;
}

// ── Drawing ────────────────────────────────────────────────────────────────────

export interface RingGeometry {
  /** Where inverter k is drawn, and the angle (degrees, clockwise, 0 = pointing right) it points along. */
  gates: { x: number; y: number; angle: number }[];
  /** The wire from inverter k to inverter k + 1, as an SVG arc path. */
  arcs: string[];
}

/** Inverters spaced round a circle of radius `r` centred on (cx, cy), the first at the top, pointing clockwise. */
export function ringGeometry(n: number, r = 84, cx = 110, cy = 110, half = 15): RingGeometry {
  const rad = (d: number) => (d * Math.PI) / 180;
  const at = (deg: number) => ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });
  const step = 360 / n;
  const gap = (half / r) * (180 / Math.PI);
  const gates = Array.from({ length: n }, (_, k) => {
    const deg = -90 + k * step;
    return { ...at(deg), angle: deg + 90 };
  });
  const arcs = Array.from({ length: n }, (_, k) => {
    const a = at(-90 + k * step + gap + 4);
    const b = at(-90 + (k + 1) * step - gap - 4);
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} A${r} ${r} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  });
  return { gates, arcs };
}
