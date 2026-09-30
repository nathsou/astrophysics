/**
 * Hit-testing on the editor canvas, in grid units: which pin, wire or component is under a point.
 * Distances are in grid units; the canvas converts its pixel tolerances using the zoom.
 */
import type { Circuit } from '../../sim/netlist/types';
import type { Layout, Pt } from './layout';

export type Hit =
  | { kind: 'pin'; comp: string; pin: string; index: number; x: number; y: number }
  | { kind: 'wire'; wire: number; seg: number; x: number; y: number; onEnd: boolean }
  | { kind: 'comp'; id: string };

export interface HitOptions {
  /** Radius around a pin that counts as hitting it. */
  pinRadius?: number;
  /** Distance from a wire that counts as hitting it. */
  wireTolerance?: number;
  /** Only pins and wires (for choosing probe points and wire ends). */
  points?: boolean;
}

/** Nearest point on the segment a–b to p, and its distance. */
export function nearestOnSegment(p: Pt, a: Pt, b: Pt): { x: number; y: number; d: number } {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
  const x = a[0] + t * dx;
  const y = a[1] + t * dy;
  return { x, y, d: Math.hypot(p[0] - x, p[1] - y) };
}

/**
 * What is at (gx, gy): a pin (closest within its radius), else a wire (closest within its tolerance),
 * else the smallest component box containing the point.
 */
export function hitTest(circuit: Circuit, layout: Layout, gx: number, gy: number, options: HitOptions = {}): Hit | undefined {
  const { pinRadius = 0.7, wireTolerance = 0.45 } = options;
  const p: Pt = [gx, gy];

  let bestPin: Hit | undefined;
  let bestD = pinRadius;
  for (const l of layout.comps)
    for (const pin of l.pins) {
      const d = Math.hypot(pin.x - gx, pin.y - gy);
      if (d <= bestD) {
        bestD = d;
        bestPin = { kind: 'pin', comp: l.c.id, pin: pin.pin, index: pin.index, x: pin.x, y: pin.y };
      }
    }
  if (bestPin) return bestPin;

  let bestWire: Hit | undefined;
  let wd = wireTolerance;
  circuit.wires.forEach((w, wi) => {
    for (let j = 1; j < w.points.length; j++) {
      const a = w.points[j - 1] as Pt;
      const b = w.points[j] as Pt;
      const n = nearestOnSegment(p, a, b);
      if (n.d <= wd) {
        wd = n.d;
        const x = Math.round(n.x);
        const y = Math.round(n.y);
        const last = w.points[w.points.length - 1]!;
        bestWire = { kind: 'wire', wire: wi, seg: j - 1, x, y, onEnd: (x === w.points[0]![0] && y === w.points[0]![1]) || (x === last[0] && y === last[1]) };
      }
    }
  });
  if (bestWire) return bestWire;
  if (options.points) return undefined;

  let best: Hit | undefined;
  let area = Infinity;
  const m = 0.3;
  for (const l of layout.comps) {
    const b = l.box;
    if (gx >= b.x0 - m && gx <= b.x1 + m && gy >= b.y0 - m && gy <= b.y1 + m) {
      const a = (b.x1 - b.x0 + 2 * m) * (b.y1 - b.y0 + 2 * m);
      if (a < area) {
        area = a;
        best = { kind: 'comp', id: l.c.id };
      }
    }
  }
  return best;
}
