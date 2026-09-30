/**
 * From a diagram and node positions to drawable primitives (paths, arrows, labels, dots) and to an SVG string.
 * The Svelte components draw the same primitives, so the static export and the live figure agree.
 *
 * Styles. Fermions: a straight line with an arrow at the middle, pointing along the flow of the particle's charge (so the arrow of an
 * antifermion points against the flow of time). Photon, W and Z: wavy. Gluon: a coil. Higgs: dashed. W and Z also carry
 * their symbol. The line style carries the meaning; colour from the particle tokens is an addition, and `mono` switches it off.
 */
import { lineKind, particleLabel, symbolOf, describeDiagram, type Diagram, type DiagramNode, type ParticleLabel } from '../hep/diagrams/index.ts';
import { arrowAt, baseCurve, coilPath, distanceToCurve, loopCurve, straightPath, wavyPath, Curve, type Pt } from './geometry.ts';
import { layoutDiagram } from './layout.ts';

export interface RenderOptions {
  width?: number;
  height?: number;
  /** Room left of the incoming legs and right of the outgoing legs for their labels. */
  margin?: { l?: number; r?: number; t?: number; b?: number };
  fontSize?: number;
  /** Draw in the ink colour only. */
  mono?: boolean;
  /** Draw particle labels. */
  labels?: boolean;
  /** Put a * after the symbol of virtual (internal) neutral bosons. */
  virtualStar?: boolean;
  lineWidth?: number;
  /** Node positions in the unit square (from `layoutDiagram`); computed if absent. */
  unit?: Map<number, Pt>;
  /** Node positions in pixels; overrides `unit`. */
  pixels?: Map<number, Pt>;
  /** Show the momentum-free name of each vertex (for the sketchpad): not drawn by default. */
  vertexRadius?: number;
}

export interface RenderLine {
  id: number;
  kind: ReturnType<typeof lineKind>;
  pdg: number;
  path: string;
  stroke: string;
  width: number;
  dash?: string;
  arrow?: { x: number; y: number; angle: number };
  /** Approximate mid-point, for hit testing and label placement. */
  mid: Pt;
}
export interface RenderLabel {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  label: ParticleLabel;
  star: boolean;
  fontSize: number;
  box: { x0: number; y0: number; x1: number; y1: number };
  /** The edge or node the label belongs to. */
  edge?: number;
  node?: number;
}
export interface RenderDot {
  id: number;
  x: number;
  y: number;
  r: number;
}
export interface RenderModel {
  width: number;
  height: number;
  lines: RenderLine[];
  labels: RenderLabel[];
  dots: RenderDot[];
  /** Node positions in pixels. */
  pos: Map<number, Pt>;
  description: string;
}

/** The CSS colour of a line, with a fixed fallback for contexts where the theme variables are absent. */
export function lineColour(pdg: number, mono = false): string {
  if (mono) return 'var(--ink, #1c2127)';
  const a = Math.abs(pdg);
  if (a === 11) return 'var(--p-electron, #0b7088)';
  if (a === 13) return 'var(--p-muon, #c2342c)';
  if (a === 15) return 'var(--p-tau, #b3358f)';
  if (a === 12 || a === 14 || a === 16) return 'var(--p-neutrino, #5b6b7e)';
  if (a >= 1 && a <= 6) return 'var(--p-hadron, #6a48c0)';
  if (a === 21) return 'var(--p-jet, #b4601a)';
  if (a === 22) return 'var(--p-photon, #a87d00)';
  if (a === 23 || a === 24) return 'var(--p-boson, #0b7247)';
  if (a === 25) return 'var(--p-higgs, #1c2127)';
  return 'var(--ink, #1c2127)';
}

/** Estimated width of a label in pixels. */
export function labelWidth(l: ParticleLabel, fontSize: number, star = false): number {
  const base = [...l.base].length * 0.62 * fontSize;
  const small = (l.sub ? [...l.sub].length * 0.6 : 0) + (l.sup ? [...l.sup].length * 0.6 : 0) + (star ? 0.6 : 0);
  return base + small * fontSize * 0.72 + 1;
}

function boxOf(x: number, y: number, anchor: 'start' | 'middle' | 'end', w: number, fs: number): RenderLabel['box'] {
  const x0 = anchor === 'start' ? x : anchor === 'end' ? x - w : x - w / 2;
  return { x0, x1: x0 + w, y0: y - fs * 0.85, y1: y + fs * 0.4 };
}

export const boxesOverlap = (a: RenderLabel['box'], b: RenderLabel['box'], pad = 0): boolean =>
  a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;

/** Build the drawable model of a diagram. */
export function renderDiagram(d: Diagram, opts: RenderOptions = {}): RenderModel {
  const width = opts.width ?? 360;
  const height = opts.height ?? 230;
  const fs = opts.fontSize ?? 15;
  const m = { l: opts.margin?.l ?? fs * 2.6, r: opts.margin?.r ?? fs * 2.6, t: opts.margin?.t ?? fs * 1.6, b: opts.margin?.b ?? fs * 1.6 };
  const mono = opts.mono ?? false;
  const lw = opts.lineWidth ?? 1.9;
  const showLabels = opts.labels ?? true;
  const star = opts.virtualStar ?? false;
  const dotR = opts.vertexRadius ?? 2.8;

  let pos: Map<number, Pt>;
  if (opts.pixels) pos = opts.pixels;
  else {
    const unit = opts.unit ?? layoutDiagram(d).pos;
    pos = new Map();
    for (const [id, p] of unit) pos.set(id, { x: m.l + p.x * (width - m.l - m.r), y: m.t + p.y * (height - m.t - m.b) });
  }
  const nodeById = new Map(d.nodes.map((n) => [n.id, n]));

  // Parallel lines between the same two nodes are drawn as bows.
  const groups = new Map<string, number[]>();
  d.edges.forEach((e, i) => {
    const key = `${Math.min(e.from, e.to)}:${Math.max(e.from, e.to)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(i);
  });

  const curves: Curve[] = [];
  const lines: RenderLine[] = [];
  d.edges.forEach((e, i) => {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) {
      curves.push(new Curve([{ x: 0, y: 0 }]));
      return;
    }
    let curve: Curve;
    if (e.from === e.to) {
      // A line that starts and ends at one vertex: a loop pointing away from the diagram's centre.
      const cx = [...pos.values()].reduce((s, p) => s + p.x, 0) / pos.size;
      const cy = [...pos.values()].reduce((s, p) => s + p.y, 0) / pos.size;
      const dx = a.x - cx;
      const dy = a.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      curve = loopCurve(a, { x: dx / len || 0, y: dy / len || -1 }, 22);
    } else {
      const key = `${Math.min(e.from, e.to)}:${Math.max(e.from, e.to)}`;
      const g = groups.get(key)!;
      let bow = 0;
      if (g.length > 1) {
        const k = g.indexOf(i);
        const len = Math.hypot(a.x - b.x, a.y - b.y);
        const step = Math.min(0.22 * len, 30);
        bow = (k - (g.length - 1) / 2) * 2 * step;
        // Bows are measured relative to the direction low id → high id, so two lines with opposite directions still separate.
        if (e.from > e.to) bow = -bow;
      }
      curve = baseCurve(a, b, bow);
    }
    curves.push(curve);
    const kind = lineKind(e.pdg);
    let path: string;
    let dash: string | undefined;
    let width_ = lw;
    if (kind === 'photon' || kind === 'W' || kind === 'Z') path = wavyPath(curve);
    else if (kind === 'gluon') path = coilPath(curve);
    else {
      path = straightPath(curve);
      if (kind === 'higgs') dash = '7 5';
      if (Math.abs(e.pdg) === 13) width_ = lw * 1.5;
    }
    const arrow = kind === 'fermion' && curve.length > 14 ? arrowAt(curve, 0.5) : undefined;
    const mid = curve.at(curve.length / 2);
    lines.push({ id: e.id, kind, pdg: e.pdg, path, stroke: lineColour(e.pdg, mono), width: width_, dash, arrow, mid });
  });

  const labels: RenderLabel[] = [];
  if (showLabels) {
    const place = (x: number, y: number, anchor: RenderLabel['anchor'], pdg: number, extra: Partial<RenderLabel>, withStar = false) => {
      const label = particleLabel(pdg);
      const w = labelWidth(label, fs, withStar);
      labels.push({ x, y, anchor, label, star: withStar, fontSize: fs, box: boxOf(x, y + fs * 0.35, anchor, w, fs), ...extra });
    };
    // External legs: outside the end of the leg.
    for (const n of d.nodes) {
      if (n.kind === 'vertex') continue;
      const p = pos.get(n.id);
      if (!p) continue;
      const e = d.edges.find((x) => x.from === n.id || x.to === n.id);
      let ux = n.kind === 'in' ? -1 : 1;
      let uy = 0;
      if (e) {
        const other = pos.get(e.from === n.id ? e.to : e.from);
        if (other) {
          const dx = p.x - other.x;
          const dy = p.y - other.y;
          const len = Math.hypot(dx, dy);
          if (len > 1) {
            ux = dx / len;
            uy = dy / len;
          }
        }
      }
      const off = fs * 0.55;
      const anchor = ux > 0.35 ? 'start' : ux < -0.35 ? 'end' : 'middle';
      const x = p.x + ux * off + (anchor === 'middle' ? 0 : 0);
      const y = p.y + uy * off + (anchor === 'middle' ? (uy > 0 ? fs * 0.7 : -fs * 0.25) : 0);
      place(x, y, anchor, n.pdg!, { node: n.id });
    }
    // Internal lines: beside the middle of the line, on the side with more room.
    const all = lines.map((_, i) => i);
    d.edges.forEach((e, i) => {
      const a = nodeById.get(e.from) as DiagramNode;
      const b = nodeById.get(e.to) as DiagramNode;
      if (!a || !b || a.kind !== 'vertex' || b.kind !== 'vertex') return;
      const c = curves[i]!;
      if (c.length < 1) return;
      const mid = c.at(c.length / 2);
      const nx = -mid.ty;
      const ny = mid.tx;
      const label = particleLabel(e.pdg);
      const withStar = star && ['photon', 'Z', 'gluon', 'higgs'].includes(lineKind(e.pdg));
      const w = labelWidth(label, fs, withStar);
      const standoff = (lineKind(e.pdg) === 'fermion' || lineKind(e.pdg) === 'higgs' ? 11 : 15) + (Math.abs(ny) < 0.5 ? w / 2 : 0);
      let best: { x: number; y: number; score: number } | null = null;
      for (const side of [1, -1]) {
        const x = mid.x + nx * side * standoff;
        const y = mid.y + ny * side * standoff;
        let score = Infinity;
        for (const j of all) if (j !== i && curves[j]!.length > 1) score = Math.min(score, distanceToCurve(curves[j]!, { x, y }));
        for (const [, q] of pos) score = Math.min(score, Math.hypot(q.x - x, q.y - y) * 0.9);
        for (const l of labels) score = Math.min(score, Math.hypot((l.box.x0 + l.box.x1) / 2 - x, (l.box.y0 + l.box.y1) / 2 - y) * 0.7);
        // Prefer the upper side (and the right-hand side of vertical lines) when equal.
        score += side * ny < 0 || (Math.abs(ny) < 0.2 && side * nx > 0) ? 0.5 : 0;
        if (!best || score > best.score + 1e-6) best = { x, y, score };
      }
      place(best!.x, best!.y + fs * 0.0, 'middle', e.pdg, { edge: e.id }, withStar);
    });
  }

  const dots: RenderDot[] = d.nodes.filter((n) => n.kind === 'vertex' && pos.has(n.id)).map((n) => ({ id: n.id, x: pos.get(n.id)!.x, y: pos.get(n.id)!.y, r: dotR }));
  return { width, height, lines, labels, dots, pos, description: describeDiagram(d) };
}

// ── SVG text ────────────────────────────────────────────────────────────────

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (x: number): string => (Math.round(x * 10) / 10).toString();

function labelSVG(l: RenderLabel): string {
  const p = l.label;
  const small = `font-size="${f1(l.fontSize * 0.7)}"`;
  let inner = `<tspan${p.bar ? ' text-decoration="overline"' : ''} font-style="${/^[a-zA-Zα-ωΑ-Ω]$/.test(p.base) && !['W', 'Z', 'H', 'γ'].includes(p.base) ? 'italic' : 'normal'}">${esc(p.base)}</tspan>`;
  if (p.sub) inner += `<tspan ${small} dy="${f1(l.fontSize * 0.25)}" font-style="normal">${esc(p.sub)}</tspan>`;
  if (p.sup) inner += `<tspan ${small} dy="${f1(-l.fontSize * 0.42)}" font-style="normal">${esc(p.sup)}</tspan>`;
  if (l.star) inner += `<tspan ${small} dy="${p.sup ? f1(l.fontSize * 0.0) : f1(-l.fontSize * 0.42)}" font-style="normal">*</tspan>`;
  return `<text x="${f1(l.x)}" y="${f1(l.y + l.fontSize * 0.35)}" text-anchor="${l.anchor}" font-size="${f1(l.fontSize)}" style="fill:var(--ink,#1c2127);font-family:var(--font-body,'Newsreader',Georgia,serif)">${inner}</text>`;
}

/** A standalone SVG document string of the model (no scripts; theme variables with light-theme fallbacks). */
export function modelToSVG(m: RenderModel, title?: string): string {
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(m.width)} ${f1(m.height)}" width="${f1(m.width)}" height="${f1(m.height)}" role="img" aria-label="${esc(title ?? m.description)}">`);
  parts.push(`<title>${esc(title ?? m.description)}</title>`);
  for (const l of m.lines) {
    parts.push(`<path d="${l.path}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${f1(l.width)}"${l.dash ? ` stroke-dasharray="${l.dash}"` : ''} style="stroke:${l.stroke}"/>`);
    if (l.arrow) parts.push(`<path d="M-4.6 -3.6L4.6 0L-4.6 3.6z" transform="translate(${f1(l.arrow.x)} ${f1(l.arrow.y)}) rotate(${f1(l.arrow.angle)})" style="fill:${l.stroke}"/>`);
  }
  for (const dot of m.dots) parts.push(`<circle cx="${f1(dot.x)}" cy="${f1(dot.y)}" r="${dot.r}" style="fill:var(--ink,#1c2127)"/>`);
  for (const l of m.labels) parts.push(labelSVG(l));
  parts.push('</svg>');
  return parts.join('');
}

/** Render a diagram straight to an SVG string. */
export function diagramToSVG(d: Diagram, opts: RenderOptions & { title?: string } = {}): string {
  return modelToSVG(renderDiagram(d, opts), opts.title);
}

/** Labels that overlap each other or sit on top of a vertex (used by the tests and by layout checks). */
export function overlappingLabels(m: RenderModel): [RenderLabel, RenderLabel][] {
  const out: [RenderLabel, RenderLabel][] = [];
  for (let i = 0; i < m.labels.length; i++) for (let j = i + 1; j < m.labels.length; j++) if (boxesOverlap(m.labels[i]!.box, m.labels[j]!.box, 1)) out.push([m.labels[i]!, m.labels[j]!]);
  return out;
}

export { symbolOf };
