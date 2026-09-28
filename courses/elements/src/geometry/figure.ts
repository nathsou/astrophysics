// Figures are small programs. A figure's `build` function receives a builder `g`, asks it for the
// given data (draggable points, points gliding on a line or circle, numeric parameters), computes
// the construction with the functions of vec.ts, and records what to draw. The builder is re-run
// on every drag, so a figure is always the construction applied to the current data — never a
// picture of one configuration.
//
// Figures also state their claims (`g.equal`, `g.claim`): the figure view shows them as live
// readouts, and the test suite checks them in many random configurations.

import { add, Degenerate, dist, lc, mul, perp, sub, unit, v, type Circle, type V } from './vec';

export type ByrneColour = 'red' | 'blue' | 'yellow' | 'black';

export interface Style {
  /** Name(s) the text uses for this object when it is not named by its points (e.g. the parallelogram BL, the magnitude A, a gnomon named two ways). */
  name?: string | string[];
  /** A thin line: construction lines, circles used only to find a point. */
  aux?: boolean;
  dashed?: boolean;
  /** Fill a polygon. */
  fill?: boolean;
  /** Force a Byrne colour. */
  colour?: ByrneColour;
  /** Show from this paragraph on (index into the proposition's paragraphs), overriding the automatic reveal. */
  from?: number;
  /** A text label drawn near the object. */
  text?: string;
}

export type Element =
  | ({ kind: 'segment'; a: V; b: V; names: string[]; ticks?: number } & Style)
  | ({ kind: 'line'; a: V; b: V; names: string[] } & Style)
  | ({ kind: 'ray'; a: V; b: V; names: string[] } & Style)
  | ({ kind: 'circle'; c: V; r: number; centre?: string; names: string[] } & Style)
  | ({ kind: 'arc'; c: V; r: number; a0: number; a1: number; names: string[] } & Style)
  | ({ kind: 'polygon'; pts: V[]; names: string[] } & Style)
  | ({ kind: 'angle'; a: V; b: V; c: V; names: string[]; right?: boolean; r?: number } & Style)
  | ({ kind: 'text'; at: V; names: string[] } & Style)
  /** A polyline (closed or not): a conic, a spiral, or a circle in space seen obliquely. */
  | ({ kind: 'curve'; pts: V[]; closed: boolean; names: string[] } & Style)
  /** A circle in space: centre, unit normal of its plane, radius. Drawn as the ellipse it projects to. */
  | ({ kind: 'circle3'; c: V; n: V; r: number; names: string[] } & Style)
  /** A sphere, drawn as its outline (a circle, since the projection is orthographic). */
  | ({ kind: 'sphere'; c: V; r: number; names: string[] } & Style);

export interface PointInfo {
  name: string;
  p: V;
  kind: 'free' | 'glider' | 'fixed';
  hidden?: boolean;
  /** Preferred label direction in degrees (0 = east, 90 = north), if the automatic placement is poor. */
  labelDir?: number;
  from?: number;
}

export interface GliderInfo {
  name: string;
  on: { kind: 'circle'; c: V; r: number } | { kind: 'segment' | 'line'; a: V; b: V };
}

export interface ParamInfo {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
}

export interface Claim {
  label: string;
  /** For equalities: both sides, shown as readouts. */
  lhs?: number;
  rhs?: number;
  ok: boolean;
}

export interface Readout {
  label: string;
  value: number | string;
}

export interface FigureState {
  free: Record<string, V>;
  glide: Record<string, number>;
  param: Record<string, number>;
}

export interface Scene {
  points: Map<string, PointInfo>;
  gliders: Map<string, GliderInfo>;
  elements: Element[];
  params: ParamInfo[];
  claims: Claim[];
  readouts: Readout[];
  dim: 2 | 3;
}

export interface Camera {
  yaw: number;
  pitch: number;
}

export interface FigureDef {
  build: (g: G) => void;
  dim?: 2 | 3;
  camera?: Camera;
  /** Labels that occur in the text but deliberately have no counterpart in the figure (with the reason). */
  unresolved?: Record<string, string>;
  /** A short caption shown under the figure. */
  caption?: string;
  /** Relative tolerance for claims (default 1e-6). */
  tolerance?: number;
  /** Amount by which the tests perturb free points, as a fraction of the figure size (default 0.08). */
  jitter?: number;
}

export const figure = (def: FigureDef): FigureDef => def;

/** A named point value. */
export type P = V & { readonly n?: string };

const named = (p: V, n: string): P => Object.assign({ x: p.x, y: p.y, ...(p.z === undefined ? {} : { z: p.z }) }, { n });
const nameOf = (p: V): string | undefined => (p as P).n;

export interface PointOpts {
  hidden?: boolean;
  labelDir?: number;
  from?: number;
}

export class G {
  readonly scene: Scene;
  private state: FigureState;
  private tolerance: number;
  constructor(state: FigureState, dim: 2 | 3, tolerance = 1e-6) {
    this.state = state;
    this.tolerance = tolerance;
    this.scene = { points: new Map(), gliders: new Map(), elements: [], params: [], claims: [], readouts: [], dim };
  }

  private addPoint(name: string, p: V, kind: PointInfo['kind'], o: PointOpts = {}): P {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || (p.z !== undefined && !Number.isFinite(p.z))) throw new Degenerate(`point ${name} is not finite`);
    if (this.scene.points.has(name)) throw new Error(`Point ${name} defined twice`);
    this.scene.points.set(name, { name, p, kind, ...o });
    return named(p, name);
  }

  // ------------------------------------------------------------------ data

  /** A draggable point, initially at (x, y). */
  free(name: string, x: number, y: number, o?: PointOpts): P {
    const s = this.state.free[name];
    return this.addPoint(name, s ?? v(x, y), 'free', o);
  }

  /** A point that can be dragged along a circle (t = angle in radians) or a segment/line (t = position, 0 at a, 1 at b). */
  glider(name: string, on: Circle | [V, V], t: number, o?: PointOpts & { line?: boolean }): P {
    const tt = this.state.glide[name] ?? t;
    let p: V;
    if (Array.isArray(on)) {
      const [a, b] = on;
      const k = o?.line ? tt : Math.max(0, Math.min(1, tt));
      p = add(a, mul(sub(b, a), k));
      this.scene.gliders.set(name, { name, on: { kind: o?.line ? 'line' : 'segment', a, b } });
    } else {
      p = v(on.c.x + on.r * Math.cos(tt), on.c.y + on.r * Math.sin(tt));
      this.scene.gliders.set(name, { name, on: { kind: 'circle', c: on.c, r: on.r } });
    }
    return this.addPoint(name, p, 'glider', o);
  }

  /** A numeric parameter with a slider. */
  param(name: string, value: number, o: { min: number; max: number; step?: number; label?: string }): number {
    const val = this.state.param[name] ?? value;
    this.scene.params.push({ name, value: val, min: o.min, max: o.max, step: o.step ?? (Number.isInteger(value) && Number.isInteger(o.min) ? 1 : (o.max - o.min) / 200), label: o.label ?? name });
    return val;
  }

  /** A computed point, labelled with `name`. */
  point(name: string, p: V, o?: PointOpts): P {
    return this.addPoint(name, p, 'fixed', o);
  }

  /** Several computed points at once: g.points({ D: p1, E: p2 }). */
  points<K extends string>(ps: Record<K, V>, o?: PointOpts): Record<K, P> {
    const out = {} as Record<K, P>;
    for (const k of Object.keys(ps) as K[]) out[k] = this.point(k, ps[k], o);
    return out;
  }

  // ------------------------------------------------------------------ drawing

  private names(...ps: V[]): string[] {
    return ps.map(nameOf).filter((x): x is string => !!x);
  }

  segment(a: V, b: V, s: Style & { ticks?: number } = {}): [V, V] {
    this.scene.elements.push({ kind: 'segment', a, b, names: this.names(a, b), ...s });
    return [a, b];
  }
  /** Segments joining consecutive points: g.path(A, B, C) draws AB and BC. */
  path(...args: (V | Style)[]): void {
    const pts = args.filter((x): x is V => typeof (x as V).x === 'number');
    const style = (args.find((x) => typeof (x as V).x !== 'number') ?? {}) as Style;
    for (let i = 0; i + 1 < pts.length; i++) this.segment(pts[i], pts[i + 1], style);
  }
  /** The infinite straight line through A and B (drawn to the edge of the figure). */
  line(a: V, b: V, s: Style = {}): [V, V] {
    this.scene.elements.push({ kind: 'line', a, b, names: this.names(a, b), ...s });
    return [a, b];
  }
  /** The ray from A through B. */
  ray(a: V, b: V, s: Style = {}): [V, V] {
    this.scene.elements.push({ kind: 'ray', a, b, names: this.names(a, b), ...s });
    return [a, b];
  }
  /** Circle with centre `c` through the point `through`, or with radius `through` if a number. */
  circle(c: V, through: V | number, s: Style = {}): Circle {
    const r = typeof through === 'number' ? through : dist(c, through);
    if (!(r > 0)) throw new Degenerate('circle of zero radius');
    this.scene.elements.push({ kind: 'circle', c, r, centre: nameOf(c), names: [], ...s });
    return { c, r };
  }
  /** Arc of the circle with centre c, counter-clockwise from the direction of `from` to the direction of `to`. */
  arc(c: V, from: V, to: V, s: Style & { r?: number } = {}): void {
    const r = s.r ?? dist(c, from);
    const a0 = Math.atan2(from.y - c.y, from.x - c.x);
    let a1 = Math.atan2(to.y - c.y, to.x - c.x);
    while (a1 <= a0) a1 += 2 * Math.PI;
    this.scene.elements.push({ kind: 'arc', c, r, a0, a1, names: this.names(from, to), ...s });
  }
  polygon(pts: V[], s: Style = {}): V[] {
    this.scene.elements.push({ kind: 'polygon', pts, names: this.names(...pts), ...s });
    return pts;
  }
  /** Mark the angle ABC (at B). */
  /** `r` is the radius of the mark in screen pixels (by default it adapts, and marks at one vertex are staggered). */
  angle(a: V, b: V, c: V, s: Style & { right?: boolean; r?: number } = {}): void {
    this.scene.elements.push({ kind: 'angle', a, b, c, names: this.names(a, b, c), ...s });
  }
  /** A polyline through the given points; closed if `closed`. */
  curve(pts: V[], s: Style & { closed?: boolean } = {}): void {
    const { closed, ...rest } = s;
    this.scene.elements.push({ kind: 'curve', pts, closed: !!closed, names: [], ...rest });
  }
  /** A circle in space with centre c, in the plane with normal n. */
  circle3(c: V, n: V, r: number, s: Style = {}): void {
    const l = Math.hypot(n.x, n.y, n.z ?? 0);
    this.scene.elements.push({ kind: 'circle3', c, n: { x: n.x / l, y: n.y / l, z: (n.z ?? 0) / l }, r, names: [], ...s });
  }
  sphere(c: V, r: number, s: Style = {}): void {
    this.scene.elements.push({ kind: 'sphere', c, r, names: [], ...s });
  }
  text(at: V, text: string, s: Style = {}): void {
    this.scene.elements.push({ kind: 'text', at, names: [], text, ...s });
  }

  // ------------------------------------------------------------------ claims and readouts

  equal(label: string, lhs: number, rhs: number): boolean {
    const ok = Math.abs(lhs - rhs) <= this.tolerance * Math.max(1, Math.abs(lhs), Math.abs(rhs));
    this.scene.claims.push({ label, lhs, rhs, ok });
    return ok;
  }
  claim(label: string, ok: boolean): boolean {
    this.scene.claims.push({ label, ok });
    return ok;
  }
  show(label: string, value: number | string): void {
    this.scene.readouts.push({ label, value });
  }
}

/** Runs a figure's construction for the given state. Throws Degenerate if the construction fails. */
export function evaluate(def: FigureDef, state: FigureState = { free: {}, glide: {}, param: {} }): Scene {
  const g = new G(state, def.dim ?? 2, def.tolerance);
  def.build(g);
  // Circles learn which named points lie on them, so that "the circle BCD" can be found.
  const pts = [...g.scene.points.values()];
  const tol = (r: number) => 1e-6 * Math.max(1, r);
  for (const e of g.scene.elements) {
    if (e.kind === 'circle' || e.kind === 'arc' || e.kind === 'sphere') {
      const on = pts.filter((q) => !q.hidden && Math.abs(dist(q.p, e.c) - e.r) <= tol(e.r)).map((q) => q.name);
      e.names = [...new Set([...e.names, ...on])];
    } else if (e.kind === 'circle3') {
      const on = pts
        .filter((q) => {
          const d = { x: q.p.x - e.c.x, y: q.p.y - e.c.y, z: (q.p.z ?? 0) - (e.c.z ?? 0) };
          const off = d.x * e.n.x + d.y * e.n.y + d.z * (e.n.z ?? 0);
          return !q.hidden && Math.abs(off) <= tol(e.r) && Math.abs(Math.hypot(d.x, d.y, d.z) - e.r) <= tol(e.r);
        })
        .map((q) => q.name);
      e.names = [...new Set([...e.names, ...on])];
    } else if (e.kind === 'curve') {
      const on = pts.filter((q) => !q.hidden && e.pts.some((p) => dist(p, q.p) <= tol(1))).map((q) => q.name);
      e.names = [...new Set([...e.names, ...on])];
    }
  }
  return g.scene;
}

// ------------------------------------------------------------------ 3D projection

export function project(p: V, cam: Camera): V {
  const z = p.z ?? 0;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const x1 = p.x * cy - p.y * sy;
  const y1 = p.x * sy + p.y * cy;
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  // x to the right, z up; y goes into the screen
  const depth = y1 * cp + z * sp;
  return { x: x1, y: z * cp - y1 * sp, z: depth };
}

/** Points of a circle in space (for drawing and for hit-testing). */
export function circle3Points(c: V, n: V, r: number, k = 72): V[] {
  // an orthonormal basis (u, w) of the plane
  const nz = n.z ?? 0;
  const a = Math.abs(n.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  let u = { x: n.y * a.z - nz * a.y, y: nz * a.x - n.x * a.z, z: n.x * a.y - n.y * a.x };
  const lu = Math.hypot(u.x, u.y, u.z);
  u = { x: u.x / lu, y: u.y / lu, z: u.z / lu };
  const w = { x: n.y * u.z - nz * u.y, y: nz * u.x - n.x * u.z, z: n.x * u.y - n.y * u.x };
  const cz = c.z ?? 0;
  return Array.from({ length: k }, (_, i) => {
    const t = (2 * Math.PI * i) / k;
    return { x: c.x + r * (Math.cos(t) * u.x + Math.sin(t) * w.x), y: c.y + r * (Math.cos(t) * u.y + Math.sin(t) * w.y), z: cz + r * (Math.cos(t) * u.z + Math.sin(t) * w.z) };
  });
}

/** Helper for 2D figures: a point at distance r from A perpendicular to AB, on its left. */
export const offLeft = (a: V, b: V, r: number) => add(a, mul(perp(unit(sub(b, a))), r));
export { lc };
