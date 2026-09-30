/**
 * Truth values and grading for the scanning table and the two exercises that use it (ScanExercise, IdentifyExercise).
 * Pure functions: a picture, the reader's numbers, a verdict.
 *
 * `answers` of a scan exercise maps what is to be measured to how it is judged:
 *
 *   momentum: { track: A, value?: 0.35, tolerance?: 0.1 }     p⊥ in GeV/c
 *   radius:   { track: A }                                      radius of curvature in mm
 *   length:   { track: B }                                      visible path length in mm
 *   angle:    { between: [B, C] }                               angle between the two tracks at their start, in degrees
 *   charge:   { track: A }                                      sign of the charge: +1 or −1
 *
 * `tolerance` is a fraction of the true value (0.1 = 10 %), and defaults to the exercise's `tolerance`, then to 0.1;
 * `toleranceAbs` gives an absolute tolerance in the unit of the quantity instead. `value` overrides the truth taken from
 * the simulated picture (for a number the author wants to fix).
 */
import { CURVATURE_CONST, type Picture, type PictureLabel, type Track } from '$lib/hep/chamber';
import { distance, type Pt } from '$lib/hep/chamber';
import type { Measurement } from './tools';

export interface AnswerSpec {
  track?: string | number;
  between?: [string | number, string | number];
  value?: number;
  tolerance?: number;
  toleranceAbs?: number;
  label?: string;
}

export type AnswerKey = 'momentum' | 'radius' | 'length' | 'angle' | 'charge';
export const ANSWER_UNITS: Record<AnswerKey, string> = { momentum: 'GeV/c', radius: 'mm', length: 'mm', angle: '°', charge: '' };
export const ANSWER_TITLES: Record<AnswerKey, string> = {
  momentum: 'Transverse momentum',
  radius: 'Radius of curvature',
  length: 'Length',
  angle: 'Angle',
  charge: 'Sign of the charge',
};

/** The track a label letter (or an index) refers to. */
export function trackOf(pic: Picture, ref: string | number | undefined): Track | null {
  if (ref === undefined) return pic.labels[0] ? (pic.set.tracks[pic.labels[0].trackId] ?? null) : null;
  if (typeof ref === 'number') return pic.set.tracks[ref] ?? null;
  const l = pic.labels.find((x) => x.letter === ref);
  return l ? (pic.set.tracks[l.trackId] ?? null) : null;
}

export function labelOf(pic: Picture, ref: string | number | undefined): PictureLabel | null {
  if (ref === undefined) return pic.labels[0] ?? null;
  if (typeof ref === 'number') return pic.labels.find((l) => l.trackId === ref) ?? null;
  return pic.labels.find((l) => l.letter === ref) ?? null;
}

/** Mean transverse momentum (GeV/c) over the visible part of a track, from the simulation's own momenta. */
export function truePT(t: Track): number {
  let sum = 0;
  let n = 0;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    if (!(a.visible && b.visible)) continue;
    const d3 = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (d3 <= 0) continue;
    const pt = 0.5 * (a.p + b.p) * (Math.hypot(b.x - a.x, b.y - a.y) / d3);
    sum += pt;
    n++;
  }
  return n ? sum / n : 0;
}

/** Radius of curvature (mm) for a transverse momentum (GeV/c) in a field (T) for a charge of ±e. */
export const radiusMm = (pT: number, B: number, q = 1): number => (B === 0 ? Infinity : (1000 * pT) / (CURVATURE_CONST * Math.abs(B) * Math.abs(q)));

export function visiblePathLength(t: Track): number {
  let L = 0;
  for (let i = 1; i < t.points.length; i++) {
    const a = t.points[i - 1]!;
    const b = t.points[i]!;
    if (a.visible && b.visible) L += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  return L;
}

/** The initial direction of a track in the picture plane, as an angle (radians). */
function startAngle(t: Track): number {
  const v = t.points.filter((p) => p.visible);
  const a = v[0]!;
  const b = v[Math.min(v.length - 1, 4)]!;
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function startPoint(t: Track): Pt {
  const v = t.points.filter((p) => p.visible);
  return { x: v[0]!.x, y: v[0]!.y };
}

export interface Truth {
  value: number;
  unit: string;
  what: string;
}

/** The true value of one requested quantity for a picture. */
export function truthFor(key: AnswerKey, spec: AnswerSpec, pic: Picture): Truth | null {
  if (spec.value !== undefined) return { value: spec.value, unit: ANSWER_UNITS[key], what: ANSWER_TITLES[key] };
  if (key === 'angle') {
    const a = trackOf(pic, spec.between?.[0]);
    const b = trackOf(pic, spec.between?.[1]);
    if (!a || !b) return null;
    // angle between the two tracks where they leave their common start: the difference of initial directions
    let d = Math.abs(startAngle(a) - startAngle(b));
    while (d > 2 * Math.PI) d -= 2 * Math.PI;
    if (d > Math.PI) d = 2 * Math.PI - d;
    return { value: (d * 180) / Math.PI, unit: '°', what: 'Angle between the two tracks at their common start' };
  }
  const t = trackOf(pic, spec.track);
  if (!t) return null;
  switch (key) {
    case 'momentum':
      return { value: truePT(t), unit: 'GeV/c', what: 'Mean transverse momentum' };
    case 'radius':
      return { value: radiusMm(truePT(t), pic.bField, Math.abs(t.charge) || 1), unit: 'mm', what: 'Radius of curvature' };
    case 'length':
      return { value: visiblePathLength(t), unit: 'mm', what: 'Visible path length' };
    case 'charge':
      return { value: Math.sign(t.charge), unit: '', what: 'Sign of the charge' };
  }
}

export interface Verdict {
  key: AnswerKey;
  title: string;
  unit: string;
  expected: number;
  entered: number | null;
  /** The half-width of the accepted interval, in the unit of the quantity. */
  allowed: number;
  ok: boolean;
  message: string;
}

const fmt = (x: number) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toPrecision(3));

/** Grade the reader's numbers against the truth. */
export function gradeAnswers(answers: Partial<Record<AnswerKey, AnswerSpec>>, pic: Picture, entered: Partial<Record<AnswerKey, number | null>>, defaultTolerance = 0.1): Verdict[] {
  const out: Verdict[] = [];
  for (const key of Object.keys(answers) as AnswerKey[]) {
    const spec = answers[key] ?? {};
    const truth = truthFor(key, spec, pic);
    const title = spec.label ?? ANSWER_TITLES[key];
    const v = entered[key] ?? null;
    if (!truth) {
      out.push({ key, title, unit: ANSWER_UNITS[key], expected: NaN, entered: v, allowed: 0, ok: false, message: 'This exercise refers to a track that is not in the picture.' });
      continue;
    }
    if (v === null || !Number.isFinite(v)) {
      out.push({ key, title, unit: truth.unit, expected: truth.value, entered: null, allowed: 0, ok: false, message: 'Enter a number.' });
      continue;
    }
    if (key === 'charge') {
      const ok = Math.sign(v) === truth.value;
      out.push({ key, title, unit: '', expected: truth.value, entered: v, allowed: 0, ok, message: ok ? `Correct: the charge is ${truth.value > 0 ? 'positive' : 'negative'}.` : `Not quite: look again at the sense of the curve, the direction of the field and the direction the particle moved.` });
      continue;
    }
    const tol = spec.tolerance ?? defaultTolerance;
    const allowed = spec.toleranceAbs ?? Math.abs(truth.value) * tol;
    const ok = Math.abs(v - truth.value) <= allowed;
    const rel = truth.value !== 0 ? (100 * (v - truth.value)) / truth.value : 0;
    out.push({
      key,
      title,
      unit: truth.unit,
      expected: truth.value,
      entered: v,
      allowed,
      ok,
      message: ok
        ? `Within tolerance: the simulation's value is ${fmt(truth.value)} ${truth.unit} (you were ${Math.abs(rel).toFixed(1)}% ${rel >= 0 ? 'above' : 'below'}; allowed ±${fmt(allowed)} ${truth.unit}).`
        : `${v > truth.value ? 'Too large' : 'Too small'}: ${fmt(v)} ${truth.unit}, where the simulation has ${fmt(truth.value)} ${truth.unit} (allowed ±${fmt(allowed)}).`,
    });
  }
  return out;
}

/** The nearest true point of the track a measurement was made on, for comparing a free measurement with the truth. */
export function compareMeasurement(m: Measurement, pic: Picture, tolerance = 0.1): { measured: number; truth: number; unit: string; what: string; ok: boolean; note: string } | null {
  const tracks = pic.set.tracks.filter((t) => !t.neutral);
  const nearest = (p: Pt): { t: Track; i: number; d: number } | null => {
    let best: { t: Track; i: number; d: number } | null = null;
    for (const t of tracks) {
      for (let i = 0; i < t.points.length; i++) {
        const q = t.points[i]!;
        if (!q.visible) continue;
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (!best || d < best.d) best = { t, i, d };
      }
    }
    return best && best.d < 6 ? best : null;
  };
  if (m.tool === 'circle') {
    const mid = nearest(m.points[1]!);
    if (!mid || !Number.isFinite(m.value)) return null;
    const p = mid.t.points[mid.i]!;
    const prev = mid.t.points[Math.max(0, mid.i - 1)]!;
    const next = mid.t.points[Math.min(mid.t.points.length - 1, mid.i + 1)]!;
    const d3 = Math.hypot(next.x - prev.x, next.y - prev.y, next.z - prev.z) || 1;
    const pT = p.p * (Math.hypot(next.x - prev.x, next.y - prev.y) / d3);
    const R = radiusMm(pT, pic.bField, Math.abs(mid.t.charge) || 1);
    if (!Number.isFinite(R)) return null;
    const ok = Math.abs(m.value - R) <= tolerance * R;
    return { measured: m.value, truth: R, unit: 'mm', what: 'radius of curvature at the middle point', ok, note: `p⊥ in the simulation there: ${pT >= 1 ? pT.toFixed(2) + ' GeV/c' : (pT * 1000).toFixed(0) + ' MeV/c'}` };
  }
  if (m.tool === 'ruler') {
    const a = nearest(m.points[0]!);
    const b = nearest(m.points[1]!);
    if (!a || !b || a.t !== b.t) return null;
    const sa = a.t.points[a.i]!.s;
    const sb = b.t.points[b.i]!.s;
    const path = Math.abs(sb - sa);
    const ok = Math.abs(m.value - path) <= Math.max(tolerance * path, 1.5);
    return { measured: m.value, truth: path, unit: 'mm', what: 'path length along the track between the two points', ok, note: path - m.value > 0.02 * path ? 'A chord is shorter than the arc it cuts off.' : '' };
  }
  if (m.tool === 'angle') {
    const v = m.points[0]!;
    const a = nearest(m.points[1]!);
    const b = nearest(m.points[2]!);
    if (!a || !b || a.t === b.t) return null;
    const tangent = (n: { t: Track; i: number }, arm: Pt): number => {
      const pts = n.t.points;
      const p0 = pts[Math.max(0, n.i - 1)]!;
      const p1 = pts[Math.min(pts.length - 1, n.i + 1)]!;
      let ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      // point the tangent away from the vertex
      const away = (arm.x - v.x) * Math.cos(ang) + (arm.y - v.y) * Math.sin(ang);
      if (away < 0) ang += Math.PI;
      return ang;
    };
    let d = Math.abs(tangent(a, m.points[1]!) - tangent(b, m.points[2]!));
    while (d > 2 * Math.PI) d -= 2 * Math.PI;
    if (d > Math.PI) d = 2 * Math.PI - d;
    const truth = (d * 180) / Math.PI;
    const ok = Math.abs(m.value - truth) <= Math.max(tolerance * truth, 3);
    return { measured: m.value, truth, unit: '°', what: 'angle between the tracks’ tangent directions at the two points', ok, note: 'For curved tracks the angle you measure depends on where you put the points.' };
  }
  return null;
}

/** Sampled, slightly noisy positions of a track (mm), for the keyboard and screen-reader alternative to the mouse tools. */
export function coordinateTable(t: Track, everyMm: number, noise: (i: number) => [number, number]): { s: number; x: number; y: number }[] {
  const out: { s: number; x: number; y: number }[] = [];
  let next = -Infinity;
  const v0 = t.points.find((p) => p.visible);
  const s0 = v0 ? v0.s : 0;
  t.points.forEach((p, i) => {
    if (!p.visible) return;
    if (p.s - s0 >= next) {
      const [dx, dy] = noise(i);
      out.push({ s: p.s - s0, x: p.x + dx, y: p.y + dy });
      next = p.s - s0 + everyMm;
    }
  });
  return out;
}

export { distance };
