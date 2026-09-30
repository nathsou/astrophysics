/**
 * Orthogonal wire routing: an L-shaped route between two grid points, choosing the bend that stays
 * clear of components when it can. Wires are then adjustable by dragging their segments (ops.ts).
 */
import { segmentHitsBox, simplify, type Box } from '../geometry';
import type { LayoutComp, Pt } from './layout';

export type Axis = 'h' | 'v';

/** The L from a to b that moves along `first` first: [a, corner, b] (fewer points when straight). */
export function routeL(a: Pt, b: Pt, first: Axis = 'h'): Pt[] {
  if (a[0] === b[0] || a[1] === b[1]) return simplify([a, b]);
  return [a, first === 'h' ? [b[0], a[1]] : [a[0], b[1]], b];
}

const shrink = (b: Box, m: number): Box => ({ x0: b.x0 + m, y0: b.y0 + m, x1: b.x1 - m, y1: b.y1 - m });

/** How many obstacle boxes (shrunk a little, so pins on their edge do not count) a path crosses. */
export function crossings(path: Pt[], obstacles: Box[]): number {
  let n = 0;
  for (const o of obstacles) {
    const s = shrink(o, 0.6);
    if (s.x1 <= s.x0 || s.y1 <= s.y0) continue;
    for (let i = 1; i < path.length; i++) {
      if (segmentHitsBox(path[i - 1]!, path[i]!, s)) {
        n++;
        break;
      }
    }
  }
  return n;
}

export interface RouteOptions {
  /** Axis to prefer when both bends are equally good (usually the direction the start pin points). */
  first?: Axis;
  /** Boxes to avoid (component bounds, grid units). */
  obstacles?: Box[];
}

/** An L route from a to b: the bend with fewer crossings wins, then the preferred axis. */
export function autoRoute(a: Pt, b: Pt, options: RouteOptions = {}): Pt[] {
  const first = options.first ?? 'h';
  const other: Axis = first === 'h' ? 'v' : 'h';
  const preferred = routeL(a, b, first);
  if (preferred.length <= 2) return preferred;
  const alternative = routeL(a, b, other);
  const obstacles = options.obstacles ?? [];
  return crossings(alternative, obstacles) < crossings(preferred, obstacles) ? alternative : preferred;
}

/** The axis a pin points along, from the component's box: a pin on the left or right edge points horizontally. */
export function pinAxis(l: LayoutComp, pin: { x: number; y: number }): Axis {
  const cx = (l.box.x0 + l.box.x1) / 2;
  const cy = (l.box.y0 + l.box.y1) / 2;
  const dx = (pin.x - cx) / Math.max(1, l.box.x1 - l.box.x0);
  const dy = (pin.y - cy) / Math.max(1, l.box.y1 - l.box.y0);
  return Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
}

/** Axis of the last segment of a path ('h' when it has none). */
export function lastAxis(path: Pt[]): Axis {
  if (path.length < 2) return 'h';
  const a = path[path.length - 2]!;
  const b = path[path.length - 1]!;
  return a[1] === b[1] && a[0] !== b[0] ? 'h' : 'v';
}
