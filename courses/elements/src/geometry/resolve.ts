// Links the lettered labels of Heath's text to the objects of a figure.
//
// Heath names objects by their letters: the point A, the straight line AB, the angle ABC, the
// triangle ABC, the circle BCD (through B, C, D), the parallelogram BL (by a diagonal), the number A.
// The word before a label tells what kind of object it is, and a list ("the angles ABC, ACB")
// keeps the kind of its first member. `resolve` turns a label in its context into a target: the
// shape to highlight, and a key that identifies the object independently of letter order (so that
// AB and BA, or the angles ABC and CBA, are one object, with one Byrne colour).

import type { Inline } from '../text/types';
import { angle as angleAt, circumcircle, collinear, dist, type Circle, type V } from './vec';
import type { Element, Scene } from './figure';

export type Kind = 'point' | 'line' | 'angle' | 'triangle' | 'figure' | 'circle' | 'arc' | 'solid' | 'plane' | 'number' | null;

export type Shape =
  | { t: 'point'; p: V }
  | { t: 'seg'; a: V; b: V }
  | { t: 'path'; pts: V[] }
  | { t: 'angle'; a: V; b: V; c: V }
  | { t: 'poly'; pts: V[] }
  | { t: 'circle'; c: V; r: number }
  | { t: 'arc'; c: V; r: number; a0: number; a1: number }
  | { t: 'element'; index: number };

export interface Target {
  key: string;
  shape: Shape;
  /** The figure element this is, if it is one. */
  element?: number;
  /** The named points involved. */
  points: string[];
}

const KIND_WORDS: [RegExp, Kind][] = [
  [/\bangles?$/, 'angle'],
  [/\btriangles?$/, 'triangle'],
  [/\b(circles?|semicircles?)$/, 'circle'],
  [/\b(circumferences?|arcs?|segments? of (?:a |the )?circles?)$/, 'arc'],
  [/\b(parallelograms?|squares?|rectangles?|rhombus|trapezium|quadrilaterals?|figures?|pentagons?|hexagons?|polygons?|gnomons?|complements?|areas?|bases?(?= of the pyramid)|parallelepipeds?)$/, 'figure'],
  [/\b(pyramids?|prisms?|solids?|cones?|cylinders?|spheres?|cubes?|octahedron|icosahedron|dodecahedron|polyhedral solids?)$/, 'solid'],
  [/\bplanes?$/, 'plane'],
  [/\bpoints?$/, 'point'],
  [/\b(straight lines?|lines?|sides?|bases?|diameters?|radii|radius|perpendiculars?|tangents?|diagonals?|remainders?|segments?|axis|axes|chords?|annex|apotomes?)$/, 'line'],
  [/\b(numbers?|units?|magnitudes?|products?|parts?)$/, 'number'],
];

/** The kind of object announced by the text immediately before a label, if any. */
export function kindBefore(text: string): Kind | undefined {
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/[\s(]+$/, '')
    .replace(/\b(whole|remaining|given|same|other|each of the|two|three|four|equal|said|similar|greater|less|least|greatest|right|acute|obtuse|interior|exterior|opposite|adjacent|rectilineal|equilateral|isosceles|scalene|straight line)\s*$/i, (m) => (/straight line/i.test(m) ? m : ''))
    .trim()
    .toLowerCase();
  for (const [re, k] of KIND_WORDS) if (re.test(t)) return k;
  return undefined;
}

export interface Mention {
  label: string;
  kind: Kind;
}

/** Labels of a paragraph with the kind of object each is announced as. */
export function mentions(c: Inline[]): Mention[] {
  const out: Mention[] = [];
  let prevText = '';
  let prevKind: Kind = null;
  // "Let ABC be a circle": the kind can also follow the label.
  let pending: number | null = null;
  const walk = (xs: Inline[]) => {
    for (const x of xs) {
      if (typeof x === 'string') {
        if (pending !== null) {
          const m = /^\s*(?:be|is)\s+(?:a|an|the|the given|any)\s+(?:given\s+)?(\w+(?: \w+)?)/.exec(x);
          if (m) {
            const k = kindBefore(m[1]);
            if (k) out[pending].kind = k;
          }
          pending = null;
        }
        prevText += x;
        continue;
      }
      if (x.t === 'label') {
        const k = kindBefore(prevText);
        // A list continues the kind of its first member: "the angles ABC, ACB", "AB, BC and CA".
        const listSep = /^(,|,? and|,? or)\s*$/.test(prevText.trim()) || /^\s*(,|and|or|, and)\s*$/.test(prevText);
        const kind: Kind = k !== undefined ? k : listSep ? prevKind : null;
        out.push({ label: x.v, kind });
        pending = kind === null ? out.length - 1 : null;
        prevKind = kind;
        prevText = '';
        continue;
      }
      if (x.t === 'ref') {
        prevText += ' ';
        continue;
      }
      walk(x.c);
    }
  };
  walk(c);
  return out;
}

/** Split a label into point names: "ABC" → A, B, C; primes stay attached ("A′B" → A′, B). */
export function letters(label: string): string[] {
  return label.match(/[A-Z](?:\d+|′+|'+)?/g) ?? [];
}

const sortKey = (xs: string[]) => [...xs].sort().join('');

function elementPoints(e: Element): string[] {
  return e.names;
}

function polygonHasOpposite(e: Element, a: string, b: string): boolean {
  if (e.kind !== 'polygon' || e.names.length !== 4) return false;
  const i = e.names.indexOf(a);
  const j = e.names.indexOf(b);
  return i >= 0 && j >= 0 && Math.abs(i - j) === 2;
}

function arcThrough(k: Circle, ps: V[]): Shape {
  // from the first to the last point, passing through the middle ones (if any)
  const ang = (p: V) => Math.atan2(p.y - k.c.y, p.x - k.c.x);
  const a0 = ang(ps[0]);
  let a1 = ang(ps[ps.length - 1]);
  while (a1 <= a0) a1 += 2 * Math.PI;
  if (ps.length > 2) {
    let m = ang(ps[1]);
    while (m <= a0) m += 2 * Math.PI;
    if (m > a1) return { t: 'arc', c: k.c, r: k.r, a0: a1 - 2 * Math.PI, a1: a0 };
  }
  return { t: 'arc', c: k.c, r: k.r, a0, a1 };
}

/**
 * Resolve a label in a scene. `project` maps figure coordinates to drawing coordinates (identity in
 * the plane, the camera projection for solid figures).
 */
export function resolve(scene: Scene, label: string, kind: Kind, project: (p: V) => V = (p) => p): Target | null {
  const els = scene.elements;
  const byName = els.findIndex((e) => (Array.isArray(e.name) ? e.name.includes(label) : e.name === label));
  const ls = letters(label);
  const pt = (n: string) => scene.points.get(n);
  const P = (n: string) => project(pt(n)!.p);
  const have = ls.length > 0 && ls.every((n) => pt(n));

  if (byName >= 0) return { key: `el:${byName}`, shape: { t: 'element', index: byName }, element: byName, points: elementPoints(els[byName]) };
  if (ls.length === 0) return null;

  if (ls.length === 1) {
    if (!have) return null;
    return { key: `pt:${ls[0]}`, shape: { t: 'point', p: P(ls[0]) }, points: ls };
  }

  // circles and circumferences: a circle element through all the named points
  if (kind === 'circle' || kind === 'arc') {
    const known = ls.filter((n) => pt(n));
    const idx = els.findIndex(
      (e) => (e.kind === 'circle' || e.kind === 'arc' || e.kind === 'circle3' || e.kind === 'sphere' || e.kind === 'curve') && known.length >= Math.min(2, ls.length) && known.every((n) => e.names.includes(n)),
    );
    if (kind === 'circle' && idx >= 0) return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: known };
    if (idx >= 0 && have && (els[idx].kind === 'circle' || els[idx].kind === 'arc')) {
      const e = els[idx] as Extract<Element, { kind: 'circle' | 'arc' }>;
      const k = { c: project(e.c), r: e.r };
      // arcs are drawn in the projected plane only for plane figures
      if (scene.dim === 2) return { key: `arc:${ls.join('')}`, shape: arcThrough(k, ls.map(P)), points: ls };
      return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: known };
    }
    if (idx >= 0) return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: known };
    if (have && ls.length >= 3) {
      try {
        const k = circumcircle(P(ls[0]), P(ls[1]), P(ls[2]));
        return kind === 'arc' ? { key: `arc:${ls.join('')}`, shape: arcThrough(k, ls.map(P)), points: ls } : { key: `circ:${sortKey(ls)}`, shape: { t: 'circle', ...k }, points: ls };
      } catch {
        return null;
      }
    }
    if (have && ls.length === 2) return { key: `arc:${ls.join('')}`, shape: { t: 'seg', a: P(ls[0]), b: P(ls[1]) }, points: ls };
    return null;
  }

  if (kind === 'angle' && ls.length === 3 && have) {
    return { key: `ang:${ls[1]}:${sortKey([ls[0], ls[2]])}`, shape: { t: 'angle', a: P(ls[0]), b: P(ls[1]), c: P(ls[2]) }, points: ls };
  }

  // figures named by a diagonal: "the parallelogram BL"
  if ((kind === 'figure' || kind === 'solid') && ls.length === 2) {
    const idx = els.findIndex((e) => polygonHasOpposite(e, ls[0], ls[1]));
    if (idx >= 0) return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: els[idx].names };
  }

  if (kind === 'solid') {
    const idx = els.findIndex((e) => (e.kind === 'sphere' || e.kind === 'circle3' || e.kind === 'curve') && ls.filter((n) => pt(n)).every((n) => e.names.includes(n)) && ls.some((n) => e.names.includes(n)));
    if (idx >= 0 && ls.length < 3) return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: ls.filter((n) => pt(n)) };
  }

  if (ls.length >= 3 && (kind === 'triangle' || kind === 'figure' || kind === 'solid' || kind === 'plane' || kind === null || kind === 'angle')) {
    const set = sortKey(ls);
    const idx = els.findIndex((e) => e.kind === 'polygon' && sortKey(e.names) === set);
    if (idx >= 0) return { key: `el:${idx}`, shape: { t: 'element', index: idx }, element: idx, points: ls };
    if (have) {
      const ps = ls.map(P);
      if (kind === 'angle' || (kind === null && ls.length === 3 && scene.dim === 2 && isAngleLike(ps))) {
        // an unqualified three-letter label with a marked angle at the middle letter
        const ai = els.findIndex((e) => e.kind === 'angle' && e.names[1] === ls[1] && sortKey([e.names[0], e.names[2]]) === sortKey([ls[0], ls[2]]));
        if (ai >= 0 || kind === 'angle') return { key: `ang:${ls[1]}:${sortKey([ls[0], ls[2]])}`, shape: { t: 'angle', a: ps[0], b: ps[1], c: ps[2] }, points: ls };
      }
      if (ps.length === 3 && collinear(ps[0], ps[1], ps[2], 1e-6) && kind !== 'triangle') return { key: `path:${sortKey(ls)}`, shape: { t: 'path', pts: ps }, points: ls };
      if (kind === 'plane') return { key: `plane:${set}`, shape: { t: 'poly', pts: ps }, points: ls };
      return { key: `poly:${set}`, shape: { t: 'poly', pts: ps }, points: ls };
    }
    return null;
  }

  if (!have) return null;
  if (ls.length === 2) {
    // a named segment element (a magnitude or a number drawn as a line) takes precedence
    const set = sortKey(ls);
    const idx = els.findIndex((e) => (e.kind === 'segment' || e.kind === 'line' || e.kind === 'ray') && sortKey(e.names) === set);
    return { key: `seg:${set}`, shape: { t: 'seg', a: P(ls[0]), b: P(ls[1]) }, element: idx >= 0 ? idx : undefined, points: ls };
  }
  // four or more letters with no kind: a broken line through them, or a polygon
  const ps = ls.map(P);
  return { key: `poly:${sortKey(ls)}`, shape: { t: 'poly', pts: ps }, points: ls };
}

function isAngleLike(ps: V[]): boolean {
  try {
    const a = angleAt(ps[0], ps[1], ps[2]);
    return a > 1e-3 && a < Math.PI - 1e-3 && dist(ps[0], ps[1]) > 0;
  } catch {
    return false;
  }
}

/** Byrne's palette, in order of first use. */
export const BYRNE: { colour: string; dash?: string }[] = [
  { colour: 'var(--byrne-red)' },
  { colour: 'var(--byrne-blue)' },
  { colour: 'var(--byrne-yellow)' },
  { colour: 'var(--byrne-black)' },
  { colour: 'var(--byrne-red)', dash: '6 4' },
  { colour: 'var(--byrne-blue)', dash: '6 4' },
  { colour: 'var(--byrne-yellow)', dash: '6 4' },
  { colour: 'var(--byrne-black)', dash: '6 4' },
  { colour: 'var(--byrne-red)', dash: '1.5 3.5' },
  { colour: 'var(--byrne-blue)', dash: '1.5 3.5' },
  { colour: 'var(--byrne-yellow)', dash: '1.5 3.5' },
  { colour: 'var(--byrne-black)', dash: '1.5 3.5' },
];

const COLOUR_INDEX: Record<string, number> = { red: 0, blue: 1, yellow: 2, black: 3 };
const LINE_ORDER = [0, 1, 2, 3];
const POLY_ORDER = [2, 0, 1, 3];

/**
 * Assigns Byrne colours to the objects of a proposition in order of first mention. Objects of
 * different kinds are coloured independently (an angle and a line may share red), as in Byrne.
 */
export function byrneColours(targets: Target[], scene: Scene): Map<string, { colour: string; dash?: string }> {
  const out = new Map<string, { colour: string; dash?: string }>();
  const counters = new Map<string, number>();
  for (const t of targets) {
    if (out.has(t.key)) continue;
    const family = t.key.startsWith('ang:') ? 'angle' : t.key.startsWith('pt:') ? 'point' : t.shape.t === 'poly' || (t.element !== undefined && scene.elements[t.element].kind === 'polygon') ? 'poly' : 'line';
    if (family === 'point') continue;
    const el = t.element !== undefined ? scene.elements[t.element] : undefined;
    if (el?.colour) {
      out.set(t.key, BYRNE[COLOUR_INDEX[el.colour]]);
      continue;
    }
    const i = counters.get(family) ?? 0;
    counters.set(family, i + 1);
    // Byrne's polygons are yellow first; everything else starts with red
    const order = family === 'poly' ? POLY_ORDER : LINE_ORDER;
    out.set(t.key, BYRNE[(Math.floor(i / 4) % 3) * 4 + order[i % 4]]);
  }
  return out;
}
