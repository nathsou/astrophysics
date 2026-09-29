/**
 * The voltage landscape, without the drawing: the circuit's solution (from the course's analog engine), the
 * terrain built from it, and the balls that roll over it.
 *
 * The circuit is small and fixed: a battery B1 lifts charge from ground to the plateau P; R1 slopes down to
 * the plateau A; from A one path drops through R2 straight to ground and another through R3 to the plateau
 * B and through R4 to ground. Each node's *height* is its voltage. So:
 *   - a wire is a flat plateau (no drop),
 *   - a resistor is a slope whose height drop is I·R,
 *   - the battery is a lift, as high as its voltage,
 *   - current is a stream of balls (each stands for a fixed amount of charge) rolling downhill, and up the lift.
 *
 * Everything here is pure data (no DOM, no WebGL), so it is tested in landscape.test.ts and shared by the
 * WebGL renderer and the Canvas 2D fallback.
 */
import '$lib/sim/netlist/catalog';
import { createAnalogEngine, type AnalogEngine } from '$lib/sim/analog';
import type { FlatNetlist } from '$lib/sim/netlist/types';
import { project, type Mat4, type Vec3 } from './mat4';

// ── The circuit and its solution ────────────────────────────────────────────

export interface Params {
  /** Battery voltage (V). */
  vs: number;
  /** Resistances (Ω). */
  r1: number;
  r2: number;
  r3: number;
  r4: number;
}

export const DEFAULT_PARAMS: Params = { vs: 9, r1: 1000, r2: 2000, r3: 1000, r4: 1000 };
export const PARAM_LIMITS = { vs: [1, 12], r: [100, 10000] } as const;

export interface Solution {
  /** Node voltages relative to ground (V). */
  vP: number;
  vA: number;
  vB: number;
  /** Currents (A): the battery's (= through R1), through R2, and through R3 (= through R4). */
  iTotal: number;
  i2: number;
  i3: number;
}

/** The exact answer by hand: R3 and R4 in series, in parallel with R2, in series with R1. */
export function analytic(p: Params): Solution {
  const r34 = p.r3 + p.r4;
  const rPar = (p.r2 * r34) / (p.r2 + r34);
  const iTotal = p.vs / (p.r1 + rPar);
  const vA = iTotal * rPar;
  const i2 = vA / p.r2;
  const i3 = vA / r34;
  return { vP: p.vs, vA, vB: i3 * p.r4, iTotal, i2, i3 };
}

const KEY_OF: Record<keyof Params, [string, string]> = {
  vs: ['B1', 'voltage'],
  r1: ['R1', 'resistance'],
  r2: ['R2', 'resistance'],
  r3: ['R3', 'resistance'],
  r4: ['R4', 'resistance'],
};

/**
 * The analog engine on the landscape's circuit. The flat netlist comes from `circuits/landscape.json`; the
 * nodes are found from the elements' pins (P is the battery's +, A joins R1 to R2, B joins R3 to R4).
 */
export class LandscapeSolver {
  readonly engine: AnalogEngine;
  private readonly nets: { P: number; A: number; B: number };

  constructor(flat: FlatNetlist, params: Params = DEFAULT_PARAMS) {
    this.engine = createAnalogEngine(flat);
    const pin = (id: string, name: string) => {
      const el = flat.elements.find((e) => e.id === id);
      if (!el) throw new Error(`landscape circuit: no element ${id}`);
      const i = el.pinNames.indexOf(name);
      if (i < 0) throw new Error(`landscape circuit: ${id} has no pin ${name}`);
      return el.pins[i]!;
    };
    this.nets = { P: pin('B1', '+'), A: pin('R2', '1'), B: pin('R4', '1') };
    this.set(params);
  }

  /** Change parameters and re-solve (a DC circuit: the answer is immediate). */
  set(p: Partial<Params>): void {
    for (const k of Object.keys(p) as (keyof Params)[]) {
      const [id, key] = KEY_OF[k];
      this.engine.setParam(id, key, p[k]!);
    }
    this.engine.settle();
  }

  solve(): Solution {
    const e = this.engine;
    return {
      vP: e.voltage(this.nets.P),
      vA: e.voltage(this.nets.A),
      vB: e.voltage(this.nets.B),
      // The battery reports the current into its + pin: negative while it delivers.
      iTotal: -e.current('B1', 1),
      i2: e.current('R2', 0),
      i3: e.current('R3', 0),
    };
  }
}

// ── The terrain ─────────────────────────────────────────────────────────────

/** World units of height per volt. The tallest thing (12 V) is 3.6 units high. */
export const VOLT_SCALE = 0.3;
/** Thickness of the reference plane: 0 V sits at this height so that it has a visible edge. */
export const BASE = 0.05;

export const heightOf = (volts: number): number => BASE + Math.max(0, volts) * VOLT_SCALE;

export type RGB = [number, number, number];

export interface Palette {
  /** Colour of the terrain at a voltage (0–1 per channel). */
  volt(v: number): RGB;
  /** The 0 V floor. */
  floor: RGB;
  /** The lift's glass. */
  glass: RGB;
  /** Grid and ruler lines. */
  line: RGB;
  /** Accent lines (the lift's edges). */
  accent: RGB;
}

export interface Mesh {
  pos: number[];
  nrm: number[];
  /** RGBA per vertex. */
  col: number[];
}

export interface Lines {
  pos: number[];
  /** RGBA per vertex. */
  col: number[];
}

export type AnchorKind = 'node' | 'part' | 'tick';

/** Something the viewer labels and the reader can hover: a node, a component or a tick on the height ruler. */
export interface Anchor {
  id: string;
  kind: AnchorKind;
  pos: Vec3;
}

export interface Path {
  id: string;
  points: Vec3[];
  cum: number[];
  length: number;
  /** Current along the path (A), always ≥ 0: the paths are laid out along the conventional current. */
  current: number;
}

export interface Scene {
  opaque: Mesh;
  glass: Mesh;
  lines: Lines;
  paths: Path[];
  anchors: Anchor[];
}

const empty = (): Mesh => ({ pos: [], nrm: [], col: [] });

function quad(m: Mesh, p: [Vec3, Vec3, Vec3, Vec3], c: [RGB, RGB, RGB, RGB], outward: Vec3, alpha = 1): void {
  const [a, b, d, e] = p;
  // Normal from the first triangle, flipped to face `outward`.
  const u: Vec3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v: Vec3 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
  let n: Vec3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  let len = Math.hypot(n[0], n[1], n[2]);
  if (len < 1e-9) {
    // Degenerate first triangle (a zero-height edge): use the second one.
    const w: Vec3 = [e[0] - a[0], e[1] - a[1], e[2] - a[2]];
    n = [v[1] * w[2] - v[2] * w[1], v[2] * w[0] - v[0] * w[2], v[0] * w[1] - v[1] * w[0]];
    len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-9) return;
  }
  n = [n[0] / len, n[1] / len, n[2] / len];
  if (n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0) n = [-n[0], -n[1], -n[2]];
  for (const i of [0, 1, 2, 0, 2, 3]) {
    m.pos.push(...p[i]!);
    m.nrm.push(...n);
    m.col.push(...c[i]!, alpha);
  }
}

interface Slab {
  /** Footprint. */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** The axis along which the top is inclined, and the voltages at its low and high ends. */
  along: 'x' | 'z';
  v0: number;
  v1: number;
  /** Height of the underside (0 for a solid block on the floor). */
  bottom?: number;
}

/** A block whose top slopes linearly from voltage v0 (at the low end of `along`) to v1 (at the high end). */
function addSlab(m: Mesh, s: Slab, pal: Palette, floor = false): void {
  const h0 = floor ? BASE : heightOf(s.v0);
  const h1 = floor ? BASE : heightOf(s.v1);
  const bottom = s.bottom ?? 0;
  const c0: RGB = floor ? pal.floor : pal.volt(s.v0);
  const c1: RGB = floor ? pal.floor : pal.volt(s.v1);
  const { x0, x1, z0, z1 } = s;
  if (s.along === 'x') {
    quad(m, [[x0, h0, z0], [x1, h1, z0], [x1, h1, z1], [x0, h0, z1]], [c0, c1, c1, c0], [0, 1, 0]);
    quad(m, [[x0, bottom, z0], [x1, bottom, z0], [x1, h1, z0], [x0, h0, z0]], [c0, c1, c1, c0], [0, 0, -1]);
    quad(m, [[x0, bottom, z1], [x1, bottom, z1], [x1, h1, z1], [x0, h0, z1]], [c0, c1, c1, c0], [0, 0, 1]);
    quad(m, [[x0, bottom, z0], [x0, bottom, z1], [x0, h0, z1], [x0, h0, z0]], [c0, c0, c0, c0], [-1, 0, 0]);
    quad(m, [[x1, bottom, z0], [x1, bottom, z1], [x1, h1, z1], [x1, h1, z0]], [c1, c1, c1, c1], [1, 0, 0]);
  } else {
    quad(m, [[x0, h0, z0], [x0, h1, z1], [x1, h1, z1], [x1, h0, z0]], [c0, c1, c1, c0], [0, 1, 0]);
    quad(m, [[x0, bottom, z0], [x0, bottom, z1], [x0, h1, z1], [x0, h0, z0]], [c0, c1, c1, c0], [-1, 0, 0]);
    quad(m, [[x1, bottom, z0], [x1, bottom, z1], [x1, h1, z1], [x1, h0, z0]], [c0, c1, c1, c0], [1, 0, 0]);
    quad(m, [[x0, bottom, z0], [x1, bottom, z0], [x1, h0, z0], [x0, h0, z0]], [c0, c0, c0, c0], [0, 0, -1]);
    quad(m, [[x0, bottom, z1], [x1, bottom, z1], [x1, h1, z1], [x0, h1, z1]], [c1, c1, c1, c1], [0, 0, 1]);
  }
}

function makePath(id: string, points: Vec3[], current: number): Path {
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { id, points, cum, length: cum[cum.length - 1]!, current: Math.max(0, current) };
}

/** Where the plateaus and slopes stand (x, z), in world units. Shared by the mesh, the paths and the anchors. */
export const LAYOUT = {
  xP: -4,
  xA: 0,
  xB: 4,
  zTop: -2,
  zGround: 2,
  /** Half-size of a plateau. */
  pad: 0.7,
  /** Half-width of a slope. */
  strip: 0.5,
  /** Thickness of the floating plateau on the lift. */
  deck: 0.12,
};

/** The terrain, the lift, the ruler and the balls' paths for a solution. */
export function buildScene(sol: Solution, pal: Palette): Scene {
  const L = LAYOUT;
  const opaque = empty();
  const glass = empty();
  const lines: Lines = { pos: [], col: [] };
  const line = (a: Vec3, b: Vec3, c: RGB, alpha: number) => {
    lines.pos.push(...a, ...b);
    lines.col.push(...c, alpha, ...c, alpha);
  };
  const { xP, xA, xB, zTop, zGround, pad, strip } = L;
  const { vP, vA, vB } = sol;

  // Ground: the floor along the bottom, and the connector up to the foot of the lift.
  addSlab(opaque, { x0: xP - pad, x1: xB + pad + 0.3, z0: zGround - pad, z1: zGround + pad, along: 'x', v0: 0, v1: 0 }, pal, true);
  addSlab(opaque, { x0: xP - pad, x1: xP + pad, z0: zTop + pad, z1: zGround - pad, along: 'x', v0: 0, v1: 0 }, pal, true);
  addSlab(opaque, { x0: xP - pad, x1: xP + pad, z0: zTop - pad, z1: zTop + pad, along: 'x', v0: 0, v1: 0, bottom: 0 }, pal, true);

  // The deck on top of the lift (P), the plateaus A and B, and the four slopes.
  addSlab(opaque, { x0: xP - pad, x1: xP + pad, z0: zTop - pad, z1: zTop + pad, along: 'x', v0: vP, v1: vP, bottom: heightOf(vP) - L.deck }, pal);
  addSlab(opaque, { x0: xA - pad, x1: xA + pad, z0: zTop - pad, z1: zTop + pad, along: 'x', v0: vA, v1: vA }, pal);
  addSlab(opaque, { x0: xB - pad, x1: xB + pad, z0: zTop - pad, z1: zTop + pad, along: 'x', v0: vB, v1: vB }, pal);
  addSlab(opaque, { x0: xP + pad, x1: xA - pad, z0: zTop - strip, z1: zTop + strip, along: 'x', v0: vP, v1: vA }, pal); // R1
  addSlab(opaque, { x0: xA + pad, x1: xB - pad, z0: zTop - strip, z1: zTop + strip, along: 'x', v0: vA, v1: vB }, pal); // R3
  addSlab(opaque, { x0: xA - strip, x1: xA + strip, z0: zTop + pad, z1: zGround - pad, along: 'z', v0: vA, v1: 0 }, pal); // R2
  addSlab(opaque, { x0: xB - strip, x1: xB + strip, z0: zTop + pad, z1: zGround - pad, along: 'z', v0: vB, v1: 0 }, pal); // R4

  // The lift: a glass shaft from the floor to the deck, with copper edges.
  const top = heightOf(vP) - L.deck;
  const gx0 = xP - pad;
  const gx1 = xP + pad;
  const gz0 = zTop - pad;
  const gz1 = zTop + pad;
  const g = pal.glass;
  if (top > BASE + 0.02) {
    const wall = (a: Vec3, b: Vec3, out: Vec3) => quad(glass, [[a[0], BASE, a[2]], [b[0], BASE, b[2]], [b[0], top, b[2]], [a[0], top, a[2]]], [g, g, g, g], out, 0.22);
    wall([gx0, 0, gz0], [gx1, 0, gz0], [0, 0, -1]);
    wall([gx0, 0, gz1], [gx1, 0, gz1], [0, 0, 1]);
    wall([gx0, 0, gz0], [gx0, 0, gz1], [-1, 0, 0]);
    wall([gx1, 0, gz0], [gx1, 0, gz1], [1, 0, 0]);
    for (const [x, z] of [[gx0, gz0], [gx1, gz0], [gx0, gz1], [gx1, gz1]] as const) line([x, BASE, z], [x, top, z], pal.accent, 1);
  }

  // The floor grid and the height ruler (0–12 V).
  for (let x = -7; x <= 7; x++) line([x, 0, -4.5], [x, 0, 4.5], pal.line, 0.35);
  for (let z = -4; z <= 4; z++) line([-7, 0, z], [7, 0, z], pal.line, 0.35);
  const rulerX = -6.4;
  const rulerZ = -0.6;
  line([rulerX, 0, rulerZ], [rulerX, heightOf(12), rulerZ], pal.line, 1);
  const anchors: Anchor[] = [];
  for (const v of [0, 3, 6, 9, 12]) {
    line([rulerX - 0.15, heightOf(v), rulerZ], [rulerX + 0.15, heightOf(v), rulerZ], pal.line, 1);
    anchors.push({ id: `${v} V`, kind: 'tick', pos: [rulerX - 0.2, heightOf(v), rulerZ] });
  }

  // Anchors: nodes (just above their plateaus) and parts (on their slopes).
  const hP = heightOf(vP);
  const hA = heightOf(vA);
  const hB = heightOf(vB);
  anchors.push(
    { id: 'P', kind: 'node', pos: [xP, hP + 0.25, zTop] },
    { id: 'A', kind: 'node', pos: [xA, hA + 0.25, zTop] },
    { id: 'B', kind: 'node', pos: [xB, hB + 0.25, zTop] },
    { id: 'G', kind: 'node', pos: [xB + 0.9, BASE + 0.25, zGround] },
    { id: 'B1', kind: 'part', pos: [xP, (hP + BASE) / 2, zTop + pad] },
    { id: 'R1', kind: 'part', pos: [(xP + xA) / 2, (hP + hA) / 2 + 0.25, zTop] },
    { id: 'R3', kind: 'part', pos: [(xA + xB) / 2, (hA + hB) / 2 + 0.25, zTop] },
    { id: 'R2', kind: 'part', pos: [xA, hA / 2 + BASE / 2 + 0.25, (zTop + zGround) / 2] },
    { id: 'R4', kind: 'part', pos: [xB, hB / 2 + BASE / 2 + 0.25, (zTop + zGround) / 2] },
  );

  // The balls' paths, along the conventional current. Heights follow the terrain.
  const y = (v: number) => heightOf(v);
  const lift: Vec3[] = [[xP, BASE, zTop], [xP, y(vP), zTop]];
  const paths: Path[] = [
    makePath('ground-right', [[xB, BASE, zGround], [xA, BASE, zGround]], sol.i3),
    makePath('ground-left', [[xA, BASE, zGround], [xP, BASE, zGround], [xP, BASE, zTop]], sol.iTotal),
    makePath('lift', lift, sol.iTotal),
    makePath('R1', [[xP, y(vP), zTop], [xP + pad, y(vP), zTop], [xA - pad, y(vA), zTop], [xA, y(vA), zTop]], sol.iTotal),
    makePath('R2', [[xA, y(vA), zTop], [xA, y(vA), zTop + pad], [xA, y(0), zGround - pad], [xA, BASE, zGround]], sol.i2),
    makePath('R3', [[xA, y(vA), zTop], [xA + pad, y(vA), zTop], [xB - pad, y(vB), zTop], [xB, y(vB), zTop]], sol.i3),
    makePath('R4', [[xB, y(vB), zTop], [xB, y(vB), zTop + pad], [xB, y(0), zGround - pad], [xB, BASE, zGround]], sol.i3),
  ];
  return { opaque, glass, lines, paths, anchors };
}

// ── The balls ───────────────────────────────────────────────────────────────

/** Distance between neighbouring balls along a path (world units). */
export const BALL_SPACING = 0.8;
/** Radius of a ball (world units). */
export const BALL_RADIUS = 0.13;
/** Speed of the balls on the busiest path (world units per second). */
export const BALL_TOP_SPEED = 2;

/** Position at distance s along a path (clamped). */
export function pointAt(path: Path, s: number): Vec3 {
  const { points, cum } = path;
  if (s <= 0) return points[0]!;
  if (s >= path.length) return points[points.length - 1]!;
  let i = 1;
  while (cum[i]! < s) i++;
  const a = points[i - 1]!;
  const b = points[i]!;
  const t = (s - cum[i - 1]!) / (cum[i]! - cum[i - 1]! || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Speed of the balls on a path: proportional to its current, so that flux (balls per second) obeys KCL. */
export function ballSpeed(current: number, maxCurrent: number): number {
  return maxCurrent > 1e-12 ? (BALL_TOP_SPEED * current) / maxCurrent : 0;
}

/**
 * The balls: each path has its own phase (how far the pattern has slid), advanced at the path's speed. A
 * path with current I has balls I/(spacing) … per second passing any point, so the flux through R1 is the
 * sum of the fluxes through R2 and R3: Kirchhoff's current law, visible.
 */
export class BallField {
  private phase = new Map<string, number>();

  advance(dt: number, paths: Path[]): void {
    const max = Math.max(0, ...paths.map((p) => p.current));
    for (const p of paths) {
      const s = (this.phase.get(p.id) ?? 0) + ballSpeed(p.current, max) * dt;
      this.phase.set(p.id, p.length > 0 ? s % BALL_SPACING : 0);
    }
  }

  /** World positions of all balls (none where there is no current). */
  positions(paths: Path[], radius = BALL_RADIUS): Vec3[] {
    const out: Vec3[] = [];
    const max = Math.max(0, ...paths.map((p) => p.current));
    if (!(max > 1e-12)) return out;
    for (const p of paths) {
      if (!(p.current > max * 1e-3)) continue;
      const off = this.phase.get(p.id) ?? 0;
      for (let s = off; s < p.length; s += BALL_SPACING) {
        const q = pointAt(p, s);
        out.push([q[0], q[1] + radius, q[2]]);
      }
    }
    return out;
  }
}

// ── Picking ─────────────────────────────────────────────────────────────────

/** The node or part whose anchor is nearest to a pointer position, within `radius` pixels. */
export function pick(anchors: Anchor[], mvp: Mat4, width: number, height: number, px: number, py: number, radius = 34): Anchor | undefined {
  let best: Anchor | undefined;
  let bestD = radius;
  for (const a of anchors) {
    if (a.kind === 'tick') continue;
    const q = project(a.pos, mvp, width, height);
    if (!q.visible) continue;
    const d = Math.hypot(q.x - px, q.y - py);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
