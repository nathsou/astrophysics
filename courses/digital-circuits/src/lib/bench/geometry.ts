/**
 * Pure geometry for the schematic renderer: component transforms, boxes, wire paths with rounded
 * corners, upright text inside rotated symbols, and label placement. Grid units unless a name
 * says px; one grid unit is GRID_PX pixels.
 */
import { GRID_PX, type Placed, type Rot } from '../sim/netlist/types';
import { transformPoint } from '../sim/netlist/catalog';

export const G = GRID_PX;

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Pose = Pick<Placed, 'x' | 'y' | 'rot' | 'flip'>;

/** SVG transform of a placed component: its own coordinates (px) → schematic px. */
export function componentTransform(c: Pose): string {
  const parts = [`translate(${c.x * G} ${c.y * G})`];
  if (c.rot) parts.push(`rotate(${c.rot})`);
  if (c.flip) parts.push('scale(-1 1)');
  return parts.join(' ');
}

/** Axis-aligned box of a component-space box after the component's transform. */
export function transformBox(b: Box, c: Pose): Box {
  const a = transformPoint({ x: b.x0, y: b.y0 }, c);
  const d = transformPoint({ x: b.x1, y: b.y1 }, c);
  return { x0: Math.min(a[0], d[0]), y0: Math.min(a[1], d[1]), x1: Math.max(a[0], d[0]), y1: Math.max(a[1], d[1]) };
}

export const scaleBox = (b: Box, k: number): Box => ({ x0: b.x0 * k, y0: b.y0 * k, x1: b.x1 * k, y1: b.y1 * k });
export const growBox = (b: Box, m: number): Box => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });

export function unionBox(boxes: Box[]): Box | undefined {
  if (!boxes.length) return undefined;
  const u = { ...boxes[0]! };
  for (const b of boxes) {
    u.x0 = Math.min(u.x0, b.x0);
    u.y0 = Math.min(u.y0, b.y0);
    u.x1 = Math.max(u.x1, b.x1);
    u.y1 = Math.max(u.y1, b.y1);
  }
  return u;
}

export const boxesOverlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/** Does the axis-aligned segment a–b pass through the box? */
export function segmentHitsBox(a: [number, number], b: [number, number], box: Box): boolean {
  const x0 = Math.min(a[0], b[0]);
  const x1 = Math.max(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const y1 = Math.max(a[1], b[1]);
  return x0 <= box.x1 && x1 >= box.x0 && y0 <= box.y1 && y1 >= box.y0;
}

/** Remove repeated points and merge collinear runs, so corners are real corners. */
export function simplify(points: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last[0] === p[0] && last[1] === p[1]) continue;
    const prev = out[out.length - 2];
    if (last && prev && ((prev[0] === last[0] && last[0] === p[0]) || (prev[1] === last[1] && last[1] === p[1]))) {
      // Collinear: extend unless the path doubles back on itself.
      const back = (last[0] - prev[0]) * (p[0] - last[0]) + (last[1] - prev[1]) * (p[1] - last[1]) < 0;
      if (!back) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/**
 * SVG path of a polyline (points in grid units) with rounded corners of radius `radius` px (less on
 * short segments). The path starts and ends exactly on the first and last points.
 */
export function roundedPath(points: [number, number][], radius = 3): string {
  const p = simplify(points).map(([x, y]) => [x * G, y * G] as [number, number]);
  if (p.length === 0) return '';
  if (p.length === 1) return `M${r2(p[0]![0])} ${r2(p[0]![1])}`;
  let d = `M${r2(p[0]![0])} ${r2(p[0]![1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = p[i - 1]!;
    const [bx, by] = p[i]!;
    const [cx, cy] = p[i + 1]!;
    const l1 = Math.hypot(bx - ax, by - ay);
    const l2 = Math.hypot(cx - bx, cy - by);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const ux = (bx - ax) / l1;
    const uy = (by - ay) / l1;
    const vx = (cx - bx) / l2;
    const vy = (cy - by) / l2;
    d += ` L${r2(bx - ux * r)} ${r2(by - uy * r)} Q${r2(bx)} ${r2(by)} ${r2(bx + vx * r)} ${r2(by + vy * r)}`;
  }
  const last = p[p.length - 1]!;
  d += ` L${r2(last[0])} ${r2(last[1])}`;
  return d;
}

/** Length of a polyline (grid units). */
export function polylineLength(points: [number, number][]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += Math.abs(points[i]![0] - points[i - 1]![0]) + Math.abs(points[i]![1] - points[i - 1]![1]);
  return l;
}

/**
 * The midpoint of a polyline and the direction there (degrees, 0 = +x, clockwise), for arrows.
 */
export function polylineMidpoint(points: [number, number][]): { x: number; y: number; angle: number } {
  const half = polylineLength(points) / 2;
  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    const l = Math.abs(bx - ax) + Math.abs(by - ay);
    if (acc + l >= half && l > 0) {
      const t = (half - acc) / l;
      return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t, angle: (Math.atan2(by - ay, bx - ax) * 180) / Math.PI };
    }
    acc += l;
  }
  const p = points[0] ?? [0, 0];
  return { x: p[0], y: p[1], angle: 0 };
}

/**
 * Transform (in the symbol's own px coordinates) that keeps text at (cx, cy) upright and unmirrored
 * whatever the component's rotation and flip.
 */
export function uprightAt(cx: number, cy: number, rot: Rot | undefined, flip: boolean | undefined): string | undefined {
  if (!rot && !flip) return undefined;
  const parts = [`translate(${cx} ${cy})`];
  if (flip) parts.push('scale(-1 1)');
  if (rot) parts.push(`rotate(${-rot})`);
  parts.push(`translate(${-cx} ${-cy})`);
  return parts.join(' ');
}

/** Monospace text metrics (labels use the mono face, so widths are predictable). */
export const textWidth = (text: string, size: number): number => [...text].length * size * 0.6;

export interface LabelPlacement {
  /** Text anchor point (px): start of the baseline. */
  x: number;
  y: number;
  box: Box;
}

/**
 * Place a label of the given size (px) next to a component box (px), avoiding other boxes and wire
 * segments. Horizontal parts try above, below, right, left; upright parts try right, left, above,
 * below. Returns the first candidate with no collision, else the least bad one.
 */
export function placeLabel(
  target: Box,
  w: number,
  h: number,
  obstacles: Box[],
  segments: [[number, number], [number, number]][],
  gap = 3,
): LabelPlacement {
  const cx = (target.x0 + target.x1) / 2;
  const cy = (target.y0 + target.y1) / 2;
  const wide = target.x1 - target.x0 >= target.y1 - target.y0;
  const above: Box = { x0: cx - w / 2, y0: target.y0 - gap - h, x1: cx + w / 2, y1: target.y0 - gap };
  const below: Box = { x0: cx - w / 2, y0: target.y1 + gap, x1: cx + w / 2, y1: target.y1 + gap + h };
  const right: Box = { x0: target.x1 + gap + 1, y0: cy - h / 2, x1: target.x1 + gap + 1 + w, y1: cy + h / 2 };
  const left: Box = { x0: target.x0 - gap - 1 - w, y0: cy - h / 2, x1: target.x0 - gap - 1, y1: cy + h / 2 };
  // Upright parts: also try beside the top and bottom halves, clear of a wire entering the middle.
  const rightHigh: Box = { ...right, y0: target.y0, y1: target.y0 + h };
  const rightLow: Box = { ...right, y0: target.y1 - h, y1: target.y1 };
  const leftHigh: Box = { ...left, y0: target.y0, y1: target.y0 + h };
  const candidates = wide ? [above, below, right, left] : [right, rightHigh, rightLow, left, leftHigh, above, below];
  let best = candidates[0]!;
  let bestScore = Infinity;
  for (const [i, c] of candidates.entries()) {
    let score = i * 0.01;
    for (const o of obstacles) if (boxesOverlap(c, o)) score += 1;
    for (const [a, b] of segments) if (segmentHitsBox(a, b, growBox(c, 1))) score += 1;
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
    if (score < 1) break;
  }
  return { x: best.x0, y: best.y1 - h * 0.22, box: best };
}
