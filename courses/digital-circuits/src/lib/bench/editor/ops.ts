/**
 * Pure editing operations on a Circuit. Every function takes a circuit and returns a new one (the
 * input is never modified), so the editor's history is a list of circuits.
 *
 * Wires know nothing about what they are attached to: a wire is connected to whatever pin or wire end
 * lies on its points (see sim/netlist/connect.ts). The operations here keep that true while parts move:
 * wire ends at a moved pin follow it, with a jog to stay orthogonal, and `normalise` keeps wires tidy
 * (T-junctions are split into shared points, chains of two wires are merged, spurs are removed).
 * Grid coordinates are integers.
 */
import type { Circuit, Params, ParamValue, Placed, Rot } from '../../sim/netlist/types';
import { placedPins, subResolver, type SubResolver } from '../../sim/netlist/connect';
import { getDef } from '../../sim/netlist/catalog';
import { boxesOverlap, growBox, simplify, type Box } from '../geometry';
import { boxOf, key, layoutOf, samePoint, type Pt } from './layout';
import { routeL, type Axis } from './route';

export interface Selection {
  ids: ReadonlySet<string>;
  /** Indices into circuit.wires; only valid for the circuit they were chosen in. */
  wires: ReadonlySet<number>;
}

export const emptySelection: Selection = { ids: new Set(), wires: new Set() };

// ── Identifiers ──────────────────────────────────────────────────────────────

const PREFIX: Record<string, string> = {
  resistor: 'R',
  potentiometer: 'RV',
  capacitor: 'C',
  inductor: 'L',
  lamp: 'LP',
  battery: 'B',
  supply: 'PS',
  siggen: 'FG',
  switch: 'S',
  spdt: 'S',
  pushbutton: 'SW',
  relay: 'K',
  diode: 'D',
  led: 'D',
  npn: 'Q',
  pnp: 'Q',
  nmos: 'M',
  pmos: 'M',
  comparator: 'U',
  voltmeter: 'V',
  ammeter: 'A',
  ground: 'G',
  rail: 'VCC',
  label: 'N',
  port: 'P',
  toggle: 'IN',
  button: 'BTN',
  clock: 'CLK',
  const: 'K',
  indicator: 'OUT',
  probe: 'P',
  'seven-seg': 'DS',
  'hex-display': 'DS',
};

export function idPrefix(type: string): string {
  return PREFIX[type] ?? (type.startsWith('sub:') || type.startsWith('part:') ? 'X' : 'U');
}

/** The first free id with the prefix of `type`: R1, R2, … */
export function uniqueId(circuit: Circuit, type: string, taken: Iterable<string> = []): string {
  const used = new Set([...circuit.components.map((c) => c.id), ...taken]);
  const prefix = idPrefix(type);
  for (let n = 1; ; n++) if (!used.has(`${prefix}${n}`)) return `${prefix}${n}`;
}

/** The first single-letter net name (A, B, …) not used by a label yet. */
function freeLabelName(circuit: Circuit): string {
  const used = new Set(circuit.components.filter((c) => c.type === 'label').map((c) => String(c.params?.name ?? '')));
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  return `N${used.size + 1}`;
}

// ── Wires: tidying ───────────────────────────────────────────────────────────

/** Is p strictly inside the axis-aligned segment a–b (not at an end)? */
export function strictlyInside(p: Pt, a: Pt, b: Pt): boolean {
  if (a[0] === b[0] && p[0] === a[0]) return p[1] > Math.min(a[1], b[1]) && p[1] < Math.max(a[1], b[1]);
  if (a[1] === b[1] && p[1] === a[1]) return p[0] > Math.min(a[0], b[0]) && p[0] < Math.max(a[0], b[0]);
  return false;
}

/** Remove points where the path doubles back on itself (a spur), then merge collinear points. */
export function cleanSpikes(points: Pt[]): Pt[] {
  let pts = simplify(points);
  for (let guard = 0; guard < 64; guard++) {
    let changed = false;
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      const c = pts[i + 1]!;
      const collinear = (a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1]);
      if (collinear && (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0) {
        pts = simplify([...pts.slice(0, i), ...pts.slice(i + 1)]);
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return pts;
}

const wireKey = (pts: Pt[]) => pts.map(key).join(';');

/**
 * Tidy the wires of a circuit without changing what is connected to what:
 *  - drop wires shorter than a segment and merge collinear points;
 *  - split a wire where a pin or another wire's end lies inside one of its segments, so that the
 *    junction is a shared point (it is drawn with a dot, and moves and deletes cleanly);
 *  - merge two wires that meet end to end at a point where nothing else is (a wire drawn in several clicks);
 *  - drop duplicates.
 */
export function normalise(circuit: Circuit, resolve: SubResolver = subResolver(circuit)): Circuit {
  let wires: Pt[][] = circuit.wires.map((w) => simplify(w.points as Pt[])).filter((p) => p.length >= 2);
  const pinPts: Pt[] = circuit.components.flatMap((c) => placedPins(c, resolve).map((p) => [p.x, p.y] as Pt));

  // 1. Split at T-junctions (until none is left; each split adds a wire end, which may split another wire).
  for (let guard = 0; guard < 500; guard++) {
    const ends: Pt[] = [...pinPts, ...wires.flatMap((w) => [w[0]!, w[w.length - 1]!])];
    let split = false;
    outer: for (let wi = 0; wi < wires.length; wi++) {
      const pts = wires[wi]!;
      for (let j = 1; j < pts.length; j++) {
        const p = ends.find((e) => strictlyInside(e, pts[j - 1]!, pts[j]!));
        if (p) {
          wires.splice(wi, 1, [...pts.slice(0, j), p], [p, ...pts.slice(j)]);
          split = true;
          break outer;
        }
      }
    }
    if (!split) break;
  }
  wires = wires.map(simplify).filter((p) => p.length >= 2);

  // 2. Duplicates (the same points, either way round).
  const seen = new Set<string>();
  wires = wires.filter((w) => {
    const k = wireKey(w);
    const r = wireKey([...w].reverse());
    if (seen.has(k) || seen.has(r)) return false;
    seen.add(k);
    return true;
  });

  // 3. Merge chains of two wires that meet end to end.
  for (let guard = 0; guard < 500; guard++) {
    const at = new Map<string, { ends: { w: number; start: boolean }[]; other: number }>();
    const slot = (k: string) => {
      let s = at.get(k);
      if (!s) at.set(k, (s = { ends: [], other: 0 }));
      return s;
    };
    for (const p of pinPts) slot(key(p)).other++;
    wires.forEach((w, wi) => {
      slot(key(w[0]!)).ends.push({ w: wi, start: true });
      slot(key(w[w.length - 1]!)).ends.push({ w: wi, start: false });
      for (let j = 1; j < w.length - 1; j++) slot(key(w[j]!)).other++;
    });
    let merged = false;
    for (const s of at.values()) {
      if (s.other !== 0 || s.ends.length !== 2 || s.ends[0]!.w === s.ends[1]!.w) continue;
      const [e1, e2] = s.ends as [{ w: number; start: boolean }, { w: number; start: boolean }];
      const first = e1.start ? [...wires[e1.w]!].reverse() : wires[e1.w]!;
      const second = e2.start ? wires[e2.w]! : [...wires[e2.w]!].reverse();
      const joined = cleanSpikes([...first, ...second.slice(1)]);
      if (joined.length < 2) continue;
      wires = wires.filter((_, i) => i !== e1.w && i !== e2.w);
      wires.push(joined);
      merged = true;
      break;
    }
    if (!merged) break;
  }

  return { ...circuit, wires: wires.map((points) => ({ points })) };
}

/** Add a wire through the given points (grid, orthogonal) and tidy. */
export function addWire(circuit: Circuit, points: Pt[], resolve?: SubResolver): Circuit {
  const pts = simplify(points);
  if (pts.length < 2) return circuit;
  return normalise({ ...circuit, wires: [...circuit.wires, { points: pts }] }, resolve);
}

/** Replace a wire's route by a straight line or an L between its two ends, bending along `first` (a way to tidy a wire that has been pulled about). */
export function rerouteWire(circuit: Circuit, index: number, first: Axis = 'h', resolve?: SubResolver): Circuit {
  const w = circuit.wires[index];
  if (!w) return circuit;
  const a = w.points[0] as Pt;
  const b = w.points[w.points.length - 1] as Pt;
  const wires = circuit.wires.map((x, i) => (i === index ? { points: routeL(a, b, first) } : x));
  return normalise({ ...circuit, wires }, resolve);
}

/**
 * Move one segment of a wire sideways by `d` grid units (a horizontal segment moves in y, a vertical
 * one in x). The wire's ends stay where they are; extra corners are added as needed. Returns the new
 * circuit and the index of the moved wire in it (−1 if tidying merged or split it).
 */
export function moveSegment(circuit: Circuit, wire: number, seg: number, d: number, resolve?: SubResolver): { circuit: Circuit; wire: number } {
  const w = circuit.wires[wire];
  if (!w || !d) return { circuit, wire };
  const pts = simplify(w.points as Pt[]);
  const a = pts[seg];
  const b = pts[seg + 1];
  if (!a || !b) return { circuit, wire };
  const horizontal = a[1] === b[1];
  const A: Pt = horizontal ? [a[0], a[1] + d] : [a[0] + d, a[1]];
  const B: Pt = horizontal ? [b[0], b[1] + d] : [b[0] + d, b[1]];
  const out: Pt[] = pts.slice(0, seg);
  if (seg === 0) out.push(a);
  out.push(A, B);
  if (seg + 1 === pts.length - 1) out.push(b);
  out.push(...pts.slice(seg + 2));
  const moved = cleanSpikes(out);
  const wires = circuit.wires.map((x, i) => (i === wire ? { points: moved } : x));
  const next = normalise({ ...circuit, wires }, resolve);
  const k = wireKey(moved);
  const index = next.wires.findIndex((x) => wireKey(x.points as Pt[]) === k || wireKey([...(x.points as Pt[])].reverse()) === k);
  return { circuit: next, wire: index };
}

// ── Moving things: wires follow ──────────────────────────────────────────────

/** Move the first (or last) point of a path to `to`, adding a corner so it stays orthogonal. */
export function jog(points: Pt[], to: Pt, atStart: boolean): Pt[] {
  const pts = atStart ? [...points] : [...points].reverse();
  const p0 = pts[0]!;
  const p1 = pts[1]!;
  let next: Pt[];
  if (to[0] === p1[0] || to[1] === p1[1]) next = [to, ...pts.slice(1)];
  else {
    // Keep the direction of the original first segment: to → corner → p1.
    const horizontal = p0[1] === p1[1];
    const corner: Pt = horizontal ? [p1[0], to[1]] : [to[0], p1[1]];
    next = [to, corner, ...pts.slice(1)];
  }
  next = cleanSpikes(next);
  return atStart ? next : next.reverse();
}

function firstAxis(pts: Pt[]): Axis {
  const a = pts[0]!;
  const b = pts[1]!;
  return a[1] === b[1] ? 'h' : 'v';
}

/** Move the wire ends listed in `pm` (old point → new point). */
function reattach(points: Pt[], pm: Map<string, Pt>): Pt[] {
  const pts = simplify(points);
  if (pts.length < 2) return points;
  const a = pts[0]!;
  const b = pts[pts.length - 1]!;
  const na = pm.get(key(a));
  const nb = pm.get(key(b));
  if (!na && !nb) return points;
  if (na && nb) {
    const d1: Pt = [na[0] - a[0], na[1] - a[1]];
    const d2: Pt = [nb[0] - b[0], nb[1] - b[1]];
    if (d1[0] === d2[0] && d1[1] === d2[1]) return pts.map((p) => [p[0] + d1[0], p[1] + d1[1]] as Pt);
    return routeL(na, nb, firstAxis(pts));
  }
  return na ? jog(pts, na, true) : jog(pts, nb!, false);
}

/**
 * Replace some components (by id) with changed versions (a new position, rotation, flip or
 * parameters) and drag the wire ends attached to their pins along. `wireMap` gives new points for wires
 * that move wholesale (selected wires), whose ends drag their neighbours too.
 */
export function replaceComponents(circuit: Circuit, changes: Map<string, Placed>, wireMap?: Map<number, Pt[]>, resolve: SubResolver = subResolver(circuit)): Circuit {
  const pm = new Map<string, Pt>();
  for (const c of circuit.components) {
    const nc = changes.get(c.id);
    if (!nc) continue;
    const oldPins = placedPins(c, resolve);
    const newPins = new Map(placedPins(nc, resolve).map((p) => [p.pin, p]));
    for (const op of oldPins) {
      const np = newPins.get(op.pin);
      if (np && (np.x !== op.x || np.y !== op.y) && !pm.has(key([op.x, op.y]))) pm.set(key([op.x, op.y]), [np.x, np.y]);
    }
  }
  if (wireMap)
    for (const [i, pts] of wireMap) {
      const old = simplify(circuit.wires[i]!.points as Pt[]);
      const now = pts;
      for (const [a, b] of [
        [old[0]!, now[0]!],
        [old[old.length - 1]!, now[now.length - 1]!],
      ] as [Pt, Pt][])
        if (!samePoint(a, b) && !pm.has(key(a))) pm.set(key(a), b);
    }
  const components = circuit.components.map((c) => changes.get(c.id) ?? c);
  const wires = circuit.wires.map((w, i) => ({ points: wireMap?.has(i) ? wireMap.get(i)! : reattach(w.points as Pt[], pm) }));
  return normalise({ ...circuit, components, wires }, resolve);
}

function moved(c: Placed, x: number, y: number): Placed {
  return { ...c, x, y };
}

/** Move components (and selected wires) by a grid offset. */
export function moveSelection(circuit: Circuit, sel: Selection, dx: number, dy: number, resolve?: SubResolver): Circuit {
  if (!dx && !dy) return circuit;
  const changes = new Map<string, Placed>();
  for (const c of circuit.components) if (sel.ids.has(c.id)) changes.set(c.id, moved(c, c.x + dx, c.y + dy));
  const wireMap = new Map<number, Pt[]>();
  for (const i of sel.wires) {
    const w = circuit.wires[i];
    if (w) wireMap.set(i, simplify((w.points as Pt[]).map((p) => [p[0] + dx, p[1] + dy] as Pt)));
  }
  return replaceComponents(circuit, changes, wireMap, resolve);
}

/** The point rotations and mirrors pivot on: the component's origin for one part, else the middle of the selection. */
export function pivotOf(circuit: Circuit, sel: Selection, resolve?: SubResolver): Pt {
  if (sel.ids.size === 1 && !sel.wires.size) {
    const c = circuit.components.find((x) => sel.ids.has(x.id));
    if (c) return [c.x, c.y];
  }
  const layout = layoutOf(circuit, resolve);
  let box: Box | undefined = boxOf(layout, sel.ids);
  for (const i of sel.wires)
    for (const [x, y] of circuit.wires[i]?.points ?? []) box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x), y1: Math.max(box.y1, y) } : { x0: x, y0: y, x1: x, y1: y };
  return box ? [Math.round((box.x0 + box.x1) / 2), Math.round((box.y0 + box.y1) / 2)] : [0, 0];
}

/** Rotate the selection a quarter turn clockwise. */
export function rotateSelection(circuit: Circuit, sel: Selection, resolve?: SubResolver): Circuit {
  const [px, py] = pivotOf(circuit, sel, resolve);
  const turn = (p: Pt): Pt => [px - (p[1] - py), py + (p[0] - px)];
  const changes = new Map<string, Placed>();
  for (const c of circuit.components) {
    if (!sel.ids.has(c.id)) continue;
    const [x, y] = turn([c.x, c.y]);
    changes.set(c.id, { ...c, x, y, rot: (((c.rot ?? 0) + 90) % 360) as Rot });
  }
  const wireMap = new Map<number, Pt[]>();
  for (const i of sel.wires) if (circuit.wires[i]) wireMap.set(i, simplify((circuit.wires[i]!.points as Pt[]).map(turn)));
  return replaceComponents(circuit, changes, wireMap, resolve);
}

/** Mirror the selection left–right ('x') or top–bottom ('y') on the screen. */
export function mirrorSelection(circuit: Circuit, sel: Selection, axis: 'x' | 'y' = 'x', resolve?: SubResolver): Circuit {
  const [px, py] = pivotOf(circuit, sel, resolve);
  const mirror = (p: Pt): Pt => (axis === 'x' ? [2 * px - p[0], p[1]] : [p[0], 2 * py - p[1]]);
  const changes = new Map<string, Placed>();
  for (const c of circuit.components) {
    if (!sel.ids.has(c.id)) continue;
    const [x, y] = mirror([c.x, c.y]);
    // A mirror composed with a rotation is the opposite rotation of the mirrored part (a vertical mirror also turns it half a turn).
    const rot = ((((axis === 'x' ? 0 : 180) - (c.rot ?? 0)) % 360) + 360) % 360;
    changes.set(c.id, { ...c, x, y, rot: rot as Rot, flip: !c.flip });
  }
  const wireMap = new Map<number, Pt[]>();
  for (const i of sel.wires) if (circuit.wires[i]) wireMap.set(i, simplify((circuit.wires[i]!.points as Pt[]).map(mirror)));
  return replaceComponents(circuit, changes, wireMap, resolve);
}

// ── Placing, deleting, copying ───────────────────────────────────────────────

export interface PlaceOptions {
  rot?: Rot;
  flip?: boolean;
  params?: Params;
  id?: string;
}

/** Place a catalog component with its origin at (x, y). */
export function place(circuit: Circuit, type: string, x: number, y: number, options: PlaceOptions = {}, resolve?: SubResolver): { circuit: Circuit; id: string } {
  const id = options.id && !circuit.components.some((c) => c.id === options.id) ? options.id : uniqueId(circuit, type);
  const c: Placed = { id, type, x, y };
  if (options.rot) c.rot = options.rot;
  if (options.flip) c.flip = true;
  const params: Params = { ...(options.params ?? {}) };
  if (type === 'label' && params.name === undefined) params.name = freeLabelName(circuit);
  if (Object.keys(params).length) c.params = params;
  return { circuit: normalise({ ...circuit, components: [...circuit.components, c] }, resolve), id };
}

/**
 * Delete components and wires. Wires that hung from a deleted pin and connect to nothing else are
 * deleted with it, so no loose tails are left behind.
 */
export function removeSelection(circuit: Circuit, sel: Selection, resolve: SubResolver = subResolver(circuit)): Circuit {
  const gone = circuit.components.filter((c) => sel.ids.has(c.id));
  const kept = circuit.components.filter((c) => !sel.ids.has(c.id));
  const deletedPins = new Set(gone.flatMap((c) => placedPins(c, resolve).map((p) => key([p.x, p.y]))));
  let wires = circuit.wires.filter((_, i) => !sel.wires.has(i)).map((w) => simplify(w.points as Pt[]));

  const keptPins = kept.flatMap((c) => placedPins(c, resolve).map((p) => [p.x, p.y] as Pt));
  const dangling = (pts: Pt[], end: Pt, self: number): boolean => {
    if (!deletedPins.has(key(end))) return false;
    if (keptPins.some((p) => samePoint(p, end))) return false;
    return !wires.some((w, i) => {
      if (i === self) return w.slice(1, -1).some((p) => samePoint(p, end)) || (samePoint(w[0]!, w[w.length - 1]!) && samePoint(w[0]!, end));
      return w.some((p) => samePoint(p, end)) || w.slice(1).some((p, j) => strictlyInside(end, w[j]!, p));
    });
  };
  wires = wires.filter((w, i) => !(dangling(w, w[0]!, i) || dangling(w, w[w.length - 1]!, i)));
  return normalise({ ...circuit, components: kept, wires: wires.map((points) => ({ points })) }, resolve);
}

export interface Fragment {
  components: Placed[];
  wires: Pt[][];
}

/** The parts and wires of a selection, ready to paste: includes the wires that join selected pins. */
export function extract(circuit: Circuit, sel: Selection, resolve: SubResolver = subResolver(circuit)): Fragment {
  const components = circuit.components.filter((c) => sel.ids.has(c.id)).map((c) => structuredClone(c));
  const pins = new Set(components.flatMap((c) => placedPins(c, resolve).map((p) => key([p.x, p.y]))));
  const wires = circuit.wires.filter((w, i) => sel.wires.has(i) || (pins.has(key(w.points[0]!)) && pins.has(key(w.points[w.points.length - 1]!)))).map((w) => (w.points as Pt[]).map((p) => [...p] as Pt));
  return { components, wires };
}

/**
 * The nearest offset (in steps of two grid units, starting at (dx, dy)) at which a pasted fragment
 * touches nothing already there: no pin lands on a wire or another pin, and no wire runs through a pin.
 * Pins that touch wires would be connected to them, so pasting on top of a circuit would short it.
 */
export function freeOffset(circuit: Circuit, frag: Fragment, dx = 2, dy = 2, resolve: SubResolver = subResolver(circuit)): Pt {
  const existingPins: Pt[] = circuit.components.flatMap((c) => placedPins(c, resolve).map((p) => [p.x, p.y] as Pt));
  const segs: [Pt, Pt][] = circuit.wires.flatMap((w) => (w.points as Pt[]).slice(1).map((p, i) => [(w.points as Pt[])[i]!, p] as [Pt, Pt]));
  const onWire = (p: Pt) => segs.some(([a, b]) => samePoint(p, a) || samePoint(p, b) || strictlyInside(p, a, b));
  const fragPins: Pt[] = frag.components.flatMap((c) => placedPins(c, resolve).map((p) => [p.x, p.y] as Pt));
  // Bodies must not sit on top of each other either (a little air between them).
  const taken = layoutOf(circuit, resolve).comps.map((l) => growBox(l.box, 0.4));
  const bodies = layoutOf({ ...circuit, components: frag.components, wires: [] }, resolve).comps.map((l) => l.box);
  const clear = (ox: number, oy: number): boolean => {
    if (bodies.some((b) => taken.some((t) => boxesOverlap({ x0: b.x0 + ox, y0: b.y0 + oy, x1: b.x1 + ox, y1: b.y1 + oy }, t)))) return false;
    const pins = fragPins.map((p) => [p[0] + ox, p[1] + oy] as Pt);
    if (pins.some((p) => onWire(p) || existingPins.some((q) => samePoint(p, q)))) return false;
    for (const w of frag.wires) {
      const pts = w.map((p) => [p[0] + ox, p[1] + oy] as Pt);
      if (existingPins.some((q) => pts.some((p, i) => samePoint(p, q) || (i > 0 && strictlyInside(q, pts[i - 1]!, p))))) return false;
      if (pts.some((p) => onWire(p))) return false;
    }
    return true;
  };
  const step = 2;
  for (let ring = 0; ring < 12; ring++) {
    for (let i = 0; i <= ring; i++) {
      for (const [a, b] of [[ring, i], [i, ring]] as [number, number][]) {
        if (clear(dx + a * step, dy + b * step)) return [dx + a * step, dy + b * step];
      }
    }
  }
  return [dx, dy];
}

/** Paste a fragment offset by (dx, dy), with fresh ids. Returns the ids of the new parts. */
export function paste(circuit: Circuit, frag: Fragment, dx: number, dy: number, resolve?: SubResolver): { circuit: Circuit; ids: string[] } {
  const taken: string[] = [];
  const created: Placed[] = frag.components.map((c) => {
    const id = uniqueId(circuit, c.type, taken);
    taken.push(id);
    const copy: Placed = { ...structuredClone(c), id, x: c.x + dx, y: c.y + dy };
    // A label that was the default text of its part would now be wrong; keep only custom ones.
    if (copy.label === c.id) delete copy.label;
    return copy;
  });
  const wires = frag.wires.map((pts) => ({ points: pts.map((p) => [p[0] + dx, p[1] + dy] as Pt) }));
  return { circuit: normalise({ ...circuit, components: [...circuit.components, ...created], wires: [...circuit.wires, ...wires] }, resolve), ids: created.map((c) => c.id) };
}

export function duplicateSelection(circuit: Circuit, sel: Selection, dx = 2, dy = 2, resolve?: SubResolver): { circuit: Circuit; ids: string[] } {
  const frag = extract(circuit, sel, resolve);
  const [ox, oy] = freeOffset(circuit, frag, dx, dy, resolve);
  return paste(circuit, frag, ox, oy, resolve);
}

// ── Properties ───────────────────────────────────────────────────────────────

/** Set a parameter (removing it when it equals the catalog default). Wires follow if the pins move. */
export function setParam(circuit: Circuit, id: string, name: string, value: ParamValue, resolve?: SubResolver): Circuit {
  const c = circuit.components.find((x) => x.id === id);
  if (!c) return circuit;
  const dflt = getDef(c.type)?.params?.find((p) => p.key === name)?.default;
  const params: Params = { ...(c.params ?? {}) };
  if (value === dflt) delete params[name];
  else params[name] = value;
  const next: Placed = { ...c };
  if (Object.keys(params).length) next.params = params;
  else delete next.params;
  return replaceComponents(circuit, new Map([[id, next]]), undefined, resolve);
}

/** Set (or with undefined, clear) the text shown next to a part. */
export function setLabel(circuit: Circuit, id: string, label: string | undefined): Circuit {
  return { ...circuit, components: circuit.components.map((c) => (c.id === id ? withLabel(c, label) : c)) };
}

function withLabel(c: Placed, label: string | undefined): Placed {
  const next = { ...c };
  if (label === undefined) delete next.label;
  else next.label = label;
  return next;
}

/** Rename a part. Returns the circuit unchanged if the new id is empty or taken. */
export function renameId(circuit: Circuit, id: string, to: string): Circuit {
  const name = to.trim();
  if (!name || name === id || circuit.components.some((c) => c.id === name)) return circuit;
  return { ...circuit, components: circuit.components.map((c) => (c.id === id ? { ...c, id: name } : c)) };
}

export const setTitle = (circuit: Circuit, title: string): Circuit => ({ ...circuit, title: title || undefined });

// ── Selecting ────────────────────────────────────────────────────────────────

/** Components whose box meets the rectangle, and wires wholly inside it (grid units). */
export function selectInBox(circuit: Circuit, box: Box, resolve?: SubResolver): Selection {
  const layout = layoutOf(circuit, resolve);
  const ids = new Set(layout.comps.filter((l) => boxesOverlap(l.box, { x0: box.x0, y0: box.y0, x1: box.x1 + 1e-9, y1: box.y1 + 1e-9 })).map((l) => l.c.id));
  const wires = new Set<number>();
  circuit.wires.forEach((w, i) => {
    if (w.points.every(([x, y]) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1)) wires.add(i);
  });
  return { ids, wires };
}

export const selectAll = (circuit: Circuit): Selection => ({ ids: new Set(circuit.components.map((c) => c.id)), wires: new Set(circuit.wires.map((_, i) => i)) });
export const isEmpty = (s: Selection): boolean => s.ids.size === 0 && s.wires.size === 0;
