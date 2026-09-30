/**
 * Where things are on a circuit, in grid units: pin positions and bounding boxes of every placed
 * component. The editor's hit-testing, routing and selection work from this; the renderer computes
 * its own richer model (labels, wire paths) separately.
 */
import type { Circuit, ComponentDef, Placed } from '../../sim/netlist/types';
import { defOf, placedPins, subResolver, type PlacedPin, type SubResolver } from '../../sim/netlist/connect';
import { boundsOf, withDefaults } from '../../sim/netlist/catalog';
import { transformBox, type Box } from '../geometry';

export type Pt = [number, number];

export interface LayoutComp {
  c: Placed;
  def: ComponentDef;
  pins: PlacedPin[];
  /** Bounding box in grid units (after rotation and flip). */
  box: Box;
}

export interface Layout {
  comps: LayoutComp[];
  byId: Map<string, LayoutComp>;
}

const cache = new WeakMap<Circuit, Layout>();

/** Layout of a circuit (cached per circuit object; circuits are immutable). Unknown types are skipped. */
export function layoutOf(circuit: Circuit, resolve?: SubResolver): Layout {
  const hit = cache.get(circuit);
  if (hit) return hit;
  const comps: LayoutComp[] = [];
  const res = resolve ?? subResolver(circuit);
  for (const c of circuit.components) {
    try {
      const def = defOf(c, res);
      comps.push({ c, def, pins: placedPins(c, res), box: transformBox(boundsOf(def, withDefaults(def, c.params)), c) });
    } catch {
      /* an unknown type: the renderer will complain; the editor ignores it */
    }
  }
  const out = { comps, byId: new Map(comps.map((l) => [l.c.id, l])) };
  cache.set(circuit, out);
  return out;
}

export const key = (p: readonly number[]): string => `${p[0]},${p[1]}`;
export const samePoint = (a: readonly number[], b: readonly number[]): boolean => a[0] === b[0] && a[1] === b[1];

/** Union of the boxes of some components (grid units). */
export function boxOf(layout: Layout, ids: Iterable<string>): Box | undefined {
  let u: Box | undefined;
  for (const id of ids) {
    const l = layout.byId.get(id);
    if (!l) continue;
    u = u ? { x0: Math.min(u.x0, l.box.x0), y0: Math.min(u.y0, l.box.y0), x1: Math.max(u.x1, l.box.x1), y1: Math.max(u.y1, l.box.y1) } : { ...l.box };
  }
  return u;
}

/** Everything drawn on a circuit: components and wire points (grid units). */
export function circuitBox(circuit: Circuit, layout = layoutOf(circuit)): Box | undefined {
  let u = boxOf(layout, layout.byId.keys());
  for (const w of circuit.wires)
    for (const [x, y] of w.points) u = u ? { x0: Math.min(u.x0, x), y0: Math.min(u.y0, y), x1: Math.max(u.x1, x), y1: Math.max(u.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
  return u;
}
