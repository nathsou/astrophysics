/**
 * Measuring a track the way a scanner does: a circle through points (curvature → radius → momentum), the length of
 * a stretch, the angle between two directions, the ionisation relative to a minimum-ionising particle.
 *
 * All positions are in millimetres in the picture plane (x right, y up). Orientation +1 means anticlockwise, as the
 * viewer sees it; a positive particle in a field pointing out of the page (B > 0) circles clockwise.
 */
import { CURVATURE_CONST, mipLoss, resolveMedium, type Material, type MediumName } from './material.ts';
import type { Track, TrackPoint } from './track.ts';

export interface Pt {
  x: number;
  y: number;
}

export interface CircleFit {
  cx: number;
  cy: number;
  /** Radius (mm); Infinity for a straight line. */
  R: number;
  /** RMS distance of the points from the circle (mm). */
  rms: number;
  n: number;
  /** +1 anticlockwise, −1 clockwise, 0 if straight, in the order the points were given. */
  orientation: 1 | -1 | 0;
  /** Largest distance of a point from the chord between the first and last points (mm). */
  sagitta: number;
  /** Distance between the first and last points (mm). */
  chord: number;
  /** True when the arc is indistinguishable from a straight line at this precision. */
  straight: boolean;
}

/**
 * Least-squares circle by Taubin's algebraic method with Newton iteration (Chernov's formulation), which has no
 * bias towards small circles and stays stable for nearly straight arcs. Needs at least three points.
 */
export function fitCircle(pts: readonly Pt[]): CircleFit | null {
  const n = pts.length;
  if (n < 3) return null;
  let mx = 0;
  let my = 0;
  for (const p of pts) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let Mxx = 0, Myy = 0, Mxy = 0, Mxz = 0, Myz = 0, Mzz = 0;
  for (const p of pts) {
    const x = p.x - mx;
    const y = p.y - my;
    const z = x * x + y * y;
    Mxx += x * x;
    Myy += y * y;
    Mxy += x * y;
    Mxz += x * z;
    Myz += y * z;
    Mzz += z * z;
  }
  Mxx /= n; Myy /= n; Mxy /= n; Mxz /= n; Myz /= n; Mzz /= n;
  const Mz = Mxx + Myy;
  const cov = Mxx * Myy - Mxy * Mxy;
  const A3 = 4 * Mz;
  const A2 = -3 * Mz * Mz - Mzz;
  const A1 = Mzz * Mz + 4 * cov * Mz - Mxz * Mxz - Myz * Myz - Mz * Mz * Mz;
  const A0 = Mxz * Mxz * Myy + Myz * Myz * Mxx - Mzz * cov - 2 * Mxz * Myz * Mxy + Mz * Mz * cov;
  const A22 = A2 + A2;
  const A33 = A3 + A3 + A3;
  let x = 0;
  let y = A0;
  for (let it = 0; it < 99; it++) {
    const Dy = A1 + x * (A22 + x * A33);
    const xn = x - y / Dy;
    if (!Number.isFinite(xn) || xn === x) break;
    const yn = A0 + xn * (A1 + xn * (A2 + xn * A3));
    if (Math.abs(yn) >= Math.abs(y)) break;
    x = xn;
    y = yn;
  }
  const det = x * x - x * Mz + cov;
  const first = pts[0]!;
  const last = pts[n - 1]!;
  const chord = Math.hypot(last.x - first.x, last.y - first.y);
  // Sagitta: the largest distance from the chord.
  let sag = 0;
  if (chord > 0) {
    const ex = (last.x - first.x) / chord;
    const ey = (last.y - first.y) / chord;
    for (const p of pts) sag = Math.max(sag, Math.abs((p.x - first.x) * -ey + (p.y - first.y) * ex));
  }
  let cx = Infinity;
  let cy = Infinity;
  let R = Infinity;
  if (Math.abs(det) > 1e-18) {
    const xc = (Mxz * (Myy - x) - Myz * Mxy) / det / 2;
    const yc = (Myz * (Mxx - x) - Mxz * Mxy) / det / 2;
    R = Math.sqrt(xc * xc + yc * yc + Mz - 2 * x);
    cx = xc + mx;
    cy = yc + my;
  }
  let rms = 0;
  if (Number.isFinite(R)) {
    for (const p of pts) rms += (Math.hypot(p.x - cx, p.y - cy) - R) ** 2;
    rms = Math.sqrt(rms / n);
  } else {
    rms = Math.sqrt(Mxx + Myy);
  }
  // Orientation: sign of the turning of the polyline about the fitted centre (or of the chord deviation).
  let orient: 1 | -1 | 0 = 0;
  if (Number.isFinite(R)) {
    let cr = 0;
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1]!;
      const b = pts[i]!;
      cr += (a.x - cx) * (b.y - cy) - (a.y - cy) * (b.x - cx);
    }
    orient = cr > 0 ? 1 : cr < 0 ? -1 : 0;
  }
  const straight = !Number.isFinite(R) || R > 200 * Math.max(chord, 1e-9) || sag < 1e-9;
  return { cx, cy, R: straight && !Number.isFinite(R) ? Infinity : R, rms, n, orientation: straight ? 0 : orient, sagitta: sag, chord, straight };
}

/** The circle through three points (the scanning-table tool). Null if they are collinear. */
export function circleThrough(a: Pt, b: Pt, c: Pt): { cx: number; cy: number; R: number; orientation: 1 | -1 } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  const cx = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const cy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  // Orientation of the path a → b → c.
  const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  return { cx, cy, R: Math.hypot(a.x - cx, a.y - cy), orientation: cross > 0 ? 1 : -1 };
}

/** Angle at `vertex` between the directions to `a` and to `b`, in degrees (0–180). */
export function angleAt(vertex: Pt, a: Pt, b: Pt): number {
  const ax = a.x - vertex.x;
  const ay = a.y - vertex.y;
  const bx = b.x - vertex.x;
  const by = b.y - vertex.y;
  const c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Distance between two points (mm). */
export const distance = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Transverse momentum (GeV/c) from a radius in mm: p = 0.29979 · |q| · B · R, with R in metres. */
export function momentumFromRadiusMm(Rmm: number, B: number, charge = 1): number {
  return CURVATURE_CONST * Math.abs(charge) * Math.abs(B) * (Rmm / 1000);
}

/**
 * Sign of the charge from the sense of rotation and the field. `orientation` is +1 for anticlockwise (as seen) in the
 * direction of travel. With B > 0 (out of the page) a positive charge goes round clockwise: F = q v × B.
 */
export function chargeSign(orientation: 1 | -1, B: number): 1 | -1 {
  if (B === 0) return 1;
  return orientation * Math.sign(B) > 0 ? -1 : 1;
}

export interface SegmentMeasurement {
  /** Index range of the points used. */
  from: number;
  to: number;
  /** Plate layer (0 = chamber medium). */
  layer: number;
  length: number;
  fit: CircleFit | null;
  /** Transverse momentum from the fit (GeV/c, charge ±1 assumed); Infinity when straight. */
  pT: number;
}

export interface TrackMeasurement {
  /** Visible path length (mm). */
  length: number;
  /** Mean ionisation relative to a minimum-ionising particle. */
  ionisation: number;
  segments: SegmentMeasurement[];
  /** Did the track end inside the chamber (a stopping particle has a range)? */
  endsInside: boolean;
}

/**
 * Split a track's visible points into stretches (one per layer and per visible run) and fit each: what a
 * scanner would do for a track crossing a plate.
 */
export function measureTrack(track: Track, B: number, medium: MediumName | Material = 'air+alcohol vapour', noise?: (i: number) => [number, number]): TrackMeasurement {
  const mat = resolveMedium(medium);
  const mip = (mipLoss(mat, true) * mat.density) / 10;
  const segs: SegmentMeasurement[] = [];
  let start = -1;
  const pts = track.points;
  const flush = (end: number) => {
    if (start < 0) return;
    const slice = pts.slice(start, end + 1);
    if (slice.length >= 3) {
      const xy = slice.map((p, k) => {
        const [dx, dy] = noise ? noise(start + k) : [0, 0];
        return { x: p.x + dx, y: p.y + dy };
      });
      const fit = fitCircle(xy);
      let L = 0;
      for (let i = 1; i < slice.length; i++) L += Math.hypot(slice[i]!.x - slice[i - 1]!.x, slice[i]!.y - slice[i - 1]!.y);
      segs.push({
        from: start,
        to: end,
        layer: slice[0]!.layer,
        length: L,
        fit,
        pT: fit && Number.isFinite(fit.R) && !fit.straight && B !== 0 ? momentumFromRadiusMm(fit.R, B, Math.abs(track.charge) || 1) : Infinity,
      });
    }
    start = -1;
  };
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    if (p.visible) {
      if (start >= 0 && pts[start]!.layer !== p.layer) flush(i - 1);
      if (start < 0) start = i;
    } else flush(i - 1);
  }
  flush(pts.length - 1);
  let length = 0;
  let ion = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (!(a.visible && b.visible)) continue;
    const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    length += d;
    ion += 0.5 * (a.dedx + b.dedx) * d;
  }
  return { length, ionisation: length > 0 ? ion / length / mip : 0, segments: segs, endsInside: track.end === 'range' || track.end === 'decay' || track.end === 'conversion' };
}

/** A visible stretch of a track as (x, y) points at roughly even spacing `dx` mm: what the eye sees. */
export function sampleTrack(track: Track, dx = 1): TrackPoint[] {
  const out: TrackPoint[] = [];
  let last = -Infinity;
  for (const p of track.points) {
    if (!p.visible) continue;
    if (p.s - last >= dx || out.length === 0) {
      out.push(p);
      last = p.s;
    }
  }
  return out;
}

