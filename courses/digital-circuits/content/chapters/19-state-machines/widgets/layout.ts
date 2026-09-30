/**
 * Where the bubbles and arrows of the diagram go. Pure geometry, in a 520 × 390 canvas that the widget scales.
 *
 *  - States sit on an ellipse, the first (reset) state at the top, going clockwise; the reader can drag one
 *    or nudge it with the arrow keys, and `positions` then overrides the default.
 *  - All arrows between the same two states share one curve, with one label line per arrow. When there are
 *    arrows both ways the two curves bend apart. A self-loop points away from the middle of the drawing.
 */
import { guardText, type Fsm } from './fsm';

export const W = 520;
export const H = 390;
/** Machines with many states get a taller canvas so that the bubbles do not touch. */
export const heightFor = (n: number): number => (n > 8 ? 500 : H);
export const R = 36;

export interface Pt {
  x: number;
  y: number;
}

export function defaultPositions(names: string[]): Record<string, Pt> {
  const n = names.length;
  const out: Record<string, Pt> = {};
  if (n === 1) return { [names[0]!]: { x: W / 2, y: H / 2 } };
  const cy = heightFor(n) / 2;
  if (n === 2) {
    out[names[0]!] = { x: W * 0.28, y: cy };
    out[names[1]!] = { x: W * 0.72, y: cy };
    return out;
  }
  const h = heightFor(n);
  const rx = W / 2 - 100;
  const ry = h / 2 - 100;
  names.forEach((name, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    out[name] = { x: Math.round(W / 2 + rx * Math.cos(a)), y: Math.round(h / 2 + ry * Math.sin(a)) };
  });
  return out;
}

export const clampPt = (p: Pt, h = H): Pt => ({ x: Math.max(R + 6, Math.min(W - R - 6, p.x)), y: Math.max(R + 6, Math.min(h - R - 6, p.y)) });

export interface Edge {
  key: string;
  from: string;
  to: string;
  /** SVG path of the curve, from the rim of one bubble to the rim of the other (arrowhead at the end). */
  d: string;
  /** Where the label block is centred. */
  label: Pt;
  /** One line per arrow. */
  lines: string[];
  /** Indices into `fsm.transitions`. */
  arrows: number[];
  self: boolean;
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y);

/**
 * The label of one arrow. With one input the guard is written as the input (`tick`, `!x`); with several, as the
 * classic pattern of bits in the order of the input list (`10`, `1-`), which stays short; a Mealy arrow adds
 * `/outputs`. The widget's legend spells out the order.
 */
export function arrowLine(fsm: Fsm, i: number): string {
  const t = fsm.transitions[i]!;
  const guard = fsm.inputs.length === 1 ? (guardText(t.when, fsm.inputs) === 'any' ? '' : guardText(t.when, fsm.inputs)) : fsm.inputs.length === 0 ? '' : t.when;
  if (fsm.kind === 'mealy') return `${guard || '1'}/${t.out ?? ''}`;
  return guard || '✓';
}

export function edges(fsm: Fsm, pos: Record<string, Pt>): Edge[] {
  const groups = new Map<string, number[]>();
  fsm.transitions.forEach((t, i) => {
    if (!pos[t.from] || !pos[t.to]) return;
    const k = `${t.from}\u0000${t.to}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const names = Object.keys(pos);
  const centre: Pt = { x: names.reduce((s, n) => s + pos[n]!.x, 0) / (names.length || 1), y: names.reduce((s, n) => s + pos[n]!.y, 0) / (names.length || 1) };
  const out: Edge[] = [];
  for (const [k, arrows] of groups) {
    const [from, to] = k.split('\u0000') as [string, string];
    const a = pos[from]!;
    const b = pos[to]!;
    const lines = arrows.map((i) => arrowLine(fsm, i));
    if (from === to) {
      let dx = a.x - centre.x;
      let dy = a.y - centre.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) {
        dx = 0;
        dy = -1;
      } else {
        dx /= len;
        dy /= len;
      }
      const px = -dy;
      const py = dx;
      const s1 = { x: a.x + dx * R * 0.8 + px * R * 0.6, y: a.y + dy * R * 0.8 + py * R * 0.6 };
      const s2 = { x: a.x + dx * R * 0.8 - px * R * 0.6, y: a.y + dy * R * 0.8 - py * R * 0.6 };
      const c1 = { x: a.x + dx * R * 2.7 + px * R * 1.4, y: a.y + dy * R * 2.7 + py * R * 1.4 };
      const c2 = { x: a.x + dx * R * 2.7 - px * R * 1.4, y: a.y + dy * R * 2.7 - py * R * 1.4 };
      out.push({
        key: k, from, to, arrows, lines, self: true,
        d: `M${s1.x.toFixed(1)} ${s1.y.toFixed(1)} C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${s2.x.toFixed(1)} ${s2.y.toFixed(1)}`,
        label: { x: a.x + dx * R * 2.45, y: a.y + dy * R * 2.45 },
      });
      continue;
    }
    const both = groups.has(`${to}\u0000${from}`);
    const d0 = dist(a, b) || 1;
    const ux = (b.x - a.x) / d0;
    const uy = (b.y - a.y) / d0;
    // Perpendicular to the right of the direction of travel; the reverse arrow bends to its own right.
    // A chord of the ring (not between neighbours) would cross the middle of the drawing, where every label piles up:
    // bend it out of the way, to the right of its direction of travel.
    const gap = Math.abs(names.indexOf(from) - names.indexOf(to));
    const chord = names.length > 3 && gap > 1 && gap < names.length - 1;
    const bend = both ? 34 : chord ? 46 : 0;
    const mid = { x: (a.x + b.x) / 2 - uy * bend, y: (a.y + b.y) / 2 + ux * bend };
    // The control point of a quadratic that passes through `mid`.
    const ctl = { x: 2 * mid.x - (a.x + b.x) / 2, y: 2 * mid.y - (a.y + b.y) / 2 };
    const towards = (p: Pt, q: Pt): Pt => {
      const l = dist(p, q) || 1;
      return { x: p.x + ((q.x - p.x) / l) * R, y: p.y + ((q.y - p.y) / l) * R };
    };
    const s = towards(a, ctl);
    const e = towards(b, ctl);
    out.push({
      key: k, from, to, arrows, lines, self: false,
      d: `M${s.x.toFixed(1)} ${s.y.toFixed(1)} Q${ctl.x.toFixed(1)} ${ctl.y.toFixed(1)} ${e.x.toFixed(1)} ${e.y.toFixed(1)}`,
      label: { x: mid.x - uy * 14, y: mid.y + ux * 14 },
    });
  }
  return out;
}

/** The height of a label block, so the widget can keep it clear of the edge of the canvas. */
export const labelHeight = (e: Edge): number => e.lines.length * 15;

export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of the canvas that has something in it, with room for labels and self-loops, so that a small machine
 * is drawn large (on a phone the diagram is only a few hundred pixels wide). Never larger than the canvas.
 */
export function fitView(pos: Record<string, Pt>, es: Edge[], h: number = H): ViewBox {
  const pts = Object.values(pos);
  if (!pts.length) return { x: 0, y: 0, w: W, h };
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (x: number, y: number, rx: number, ry: number) => {
    x0 = Math.min(x0, x - rx);
    x1 = Math.max(x1, x + rx);
    y0 = Math.min(y0, y - ry);
    y1 = Math.max(y1, y + ry);
  };
  for (const p of pts) grow(p.x, p.y, R + 34, R + 18);
  for (const e of es) grow(e.label.x, e.label.y, 8 * Math.max(...e.lines.map((l) => l.length), 1) * 0.5 + 14, labelHeight(e) / 2 + 10);
  x0 = Math.max(0, x0);
  y0 = Math.max(0, y0);
  x1 = Math.min(W, x1);
  y1 = Math.min(h, y1);
  // Keep a sensible aspect ratio: no wider than 4:3 relative to the height, at least 2:1 as tall as wide.
  let w = Math.max(300, x1 - x0);
  let ht = Math.max(220, y1 - y0);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  w = Math.min(W, w);
  ht = Math.min(h, ht);
  return { x: Math.max(0, Math.min(W - w, cx - w / 2)), y: Math.max(0, Math.min(h - ht, cy - ht / 2)), w, h: ht };
}
