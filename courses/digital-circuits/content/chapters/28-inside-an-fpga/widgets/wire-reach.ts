/**
 * Wire segments of different lengths: the fastest way across a row of tiles when a wire can be tapped only at its
 * far end, using the delays of the vFPGA's published delay model (`VFPGA_DELAYS`).
 *
 * A hop along a wire of span s costs one routing multiplexer plus the wire itself (`switch + spanS`); the last
 * multiplexer, in front of the LUT pin, costs one more `switch`. That is the model the router and the timing
 * analysis of Chapter 30 use, so the numbers here are the ones the tools would report for a net in a straight row.
 */
import { VFPGA_DELAYS as D } from '$lib/pld/devices/vfpga-arch';

export type Span = 1 | 4 | 12;
export type WireSet = 'one' | 'one-four' | 'all';

export const WIRE_SETS: { id: WireSet; label: string; spans: Span[]; title: string }[] = [
  { id: 'one', label: 'Span 1 only', spans: [1], title: 'Only wires that reach the next tile (vFPGA-S)' },
  { id: 'one-four', label: 'Spans 1 and 4', spans: [1, 4], title: 'Add wires that skip three tiles' },
  { id: 'all', label: 'Spans 1, 4 and 12', spans: [1, 4, 12], title: 'The mix of vFPGA-M and vFPGA-L' },
];

/** Delay of one hop over a wire of the given span: its multiplexer and the wire. */
export const hopDelay = (span: Span): number => D.switch + { 1: D.span1, 4: D.span4, 12: D.span12 }[span];

export interface Hop {
  from: number;
  to: number;
  span: Span;
  delay: number;
}

export interface Reach {
  hops: Hop[];
  /** Wire delay plus the connection-box multiplexer at the sink, ns. */
  delay: number;
  /** Routing multiplexers passed, including the one at the sink. */
  muxes: number;
}

/** The fastest route over `distance` tiles from tile 0, on a row of `width` tiles (wires may overshoot and come back). */
export function fastest(distance: number, set: WireSet, width = 36): Reach {
  const spans = WIRE_SETS.find((s) => s.id === set)!.spans;
  if (distance < 0 || distance >= width) throw new RangeError('distance outside the row');
  const best = new Array<number>(width).fill(Infinity);
  const prev = new Array<{ from: number; span: Span } | undefined>(width).fill(undefined);
  best[0] = 0;
  const done = new Array<boolean>(width).fill(false);
  for (;;) {
    let u = -1;
    for (let i = 0; i < width; i++) if (!done[i] && best[i]! < Infinity && (u < 0 || best[i]! < best[u]!)) u = i;
    if (u < 0) break;
    done[u] = true;
    for (const s of spans) {
      for (const v of [u + s, u - s]) {
        if (v < 0 || v >= width) continue;
        const d = best[u]! + hopDelay(s);
        if (d < best[v]! - 1e-12) {
          best[v] = d;
          prev[v] = { from: u, span: s };
        }
      }
    }
  }
  const hops: Hop[] = [];
  for (let v = distance; v !== 0; ) {
    const p = prev[v]!;
    hops.push({ from: p.from, to: v, span: p.span, delay: hopDelay(p.span) });
    v = p.from;
  }
  hops.reverse();
  return { hops, delay: best[distance]! + D.switch, muxes: hops.length + 1 };
}
