// Data and geometry for the course map (see CourseMap.tsx).
//
// Two hand-placed layouts share one graph: a horizontal one for wide
// containers and a vertical one for narrow ones (phones), so that labels are
// never scaled below a readable size and nothing hides in a scroll box.  Every
// label position is explicit; tests/coursemap.test.ts checks that no label
// overlaps a node or another label and that the text stays readable.

export interface MapNode {
  id: string;
  label: string;
  sub: string;
  /** chapter slug the node links to */
  ch: string;
}

export const mapNodes: MapNode[] = [
  { id: 'l', label: 'λ', sub: 'untyped', ch: 'lambda' },
  { id: 'stlc', label: 'λ→', sub: 'simple types', ch: 'stlc' },
  { id: 'f', label: 'λ2', sub: 'System F', ch: 'system-f' },
  { id: 'w', label: 'λω', sub: 'Fω', ch: 'fomega' },
  { id: 'p', label: 'λP', sub: 'LF', ch: 'dependent' },
  { id: 'c', label: 'λC', sub: 'CoC', ch: 'coc' },
  { id: 'ecc', label: 'ECC', sub: '+ universes', ch: 'universes' },
  { id: 'cic', label: 'CIC', sub: '+ inductives', ch: 'inductive' },
  { id: 'lean', label: 'Lean 4', sub: 'the real thing', ch: 'lean' },
];

export const mapEdges: [from: string, to: string, label: string][] = [
  ['l', 'stlc', 'types'],
  ['stlc', 'f', 'polymorphism'],
  ['f', 'w', 'type operators'],
  ['stlc', 'p', 'dependency'],
  ['w', 'c', ''],
  ['p', 'c', ''],
  ['c', 'ecc', 'universes'],
  ['ecc', 'cic', 'inductives'],
  ['cic', 'lean', 'quotients, …'],
];

export type Anchor = 'start' | 'middle' | 'end';
export interface TextPos {
  x: number;
  /** baseline */
  y: number;
  anchor: Anchor;
}
export interface PlacedNode {
  x: number;
  y: number;
  r: number;
  sub: TextPos;
}
export interface MapLayout {
  name: 'horizontal' | 'vertical';
  width: number;
  height: number;
  /** font sizes in user units */
  labelSize: number;
  textSize: number;
  nodes: Record<string, PlacedNode>;
  /** edge label positions, keyed `from-to` */
  edgeLabels: Record<string, TextPos>;
}

/** node radius: large enough for the label (bold, `size` user units) with some air */
export function nodeRadius(label: string, size: number): number {
  return Math.max(30, Math.ceil(textWidth(label, size, 'bold') / 2 + 6));
}

/**
 * A conservative estimate of the rendered width of `s` in DM Sans.  Used for
 * layout checks only; wide glyphs are over-estimated rather than under.
 */
export function textWidth(s: string, size: number, style: 'regular' | 'bold' | 'italic' = 'regular'): number {
  let em = 0;
  for (const ch of s) {
    if (ch === ' ') em += 0.26;
    else if (/[,.]/.test(ch)) em += 0.26;
    else if (/[iljtf]/.test(ch)) em += 0.3;
    else if (/[mwMWω…]/.test(ch)) em += 0.86;
    else if (/[A-Z0-9λ→]/.test(ch)) em += 0.66;
    else em += 0.55;
  }
  return em * size * (style === 'bold' ? 1.08 : 1);
}

const H_LABEL = 19;
const H_TEXT = 14.5;

function hNode(x: number, y: number, label: string, subAbove = false): PlacedNode {
  const r = nodeRadius(label, H_LABEL);
  return { x, y, r, sub: { x, y: subAbove ? y - r - 10 : y + r + 19, anchor: 'middle' } };
}

/** wide containers: the road runs left to right, λ2/λω above and λP below */
export const horizontal: MapLayout = {
  name: 'horizontal',
  width: 1030,
  height: 300,
  labelSize: H_LABEL,
  textSize: H_TEXT,
  nodes: {
    l: hNode(40, 150, 'λ'),
    stlc: hNode(148, 150, 'λ→'),
    f: hNode(280, 65, 'λ2', true),
    w: hNode(452, 65, 'λω', true),
    p: hNode(280, 245, 'λP'),
    c: hNode(572, 150, 'λC'),
    ecc: hNode(697, 150, 'ECC'),
    cic: hNode(822, 150, 'CIC'),
    lean: hNode(982, 150, 'Lean 4'),
  },
  edgeLabels: {
    'l-stlc': { x: 94, y: 131, anchor: 'middle' },
    // the two branches: labels sit inside the fork, clear of the arrows
    'stlc-f': { x: 222, y: 124, anchor: 'start' },
    'stlc-p': { x: 222, y: 187, anchor: 'start' },
    'f-w': { x: 366, y: 46, anchor: 'middle' },
    'c-ecc': { x: 634.5, y: 131, anchor: 'middle' },
    'ecc-cic': { x: 759.5, y: 131, anchor: 'middle' },
    'cic-lean': { x: 897, y: 131, anchor: 'middle' },
  },
};

const V_LABEL = 19;
const V_TEXT = 14;

function vNode(x: number, y: number, label: string): PlacedNode {
  const r = nodeRadius(label, V_LABEL);
  return { x, y, r, sub: { x: x + r + 10, y: y + 5, anchor: 'start' } };
}

/** narrow containers: the road runs top to bottom; sub-labels right, edge labels left */
export const vertical: MapLayout = {
  name: 'vertical',
  width: 320,
  height: 905,
  labelSize: V_LABEL,
  textSize: V_TEXT,
  nodes: {
    l: vNode(160, 45, 'λ'),
    stlc: vNode(160, 150, 'λ→'),
    f: vNode(85, 270, 'λ2'),
    w: vNode(85, 405, 'λω'),
    p: vNode(235, 335, 'λP'),
    c: vNode(160, 525, 'λC'),
    ecc: vNode(160, 635, 'ECC'),
    cic: vNode(160, 745, 'CIC'),
    lean: vNode(160, 858, 'Lean 4'),
  },
  edgeLabels: {
    'l-stlc': { x: 148, y: 103, anchor: 'end' },
    'stlc-f': { x: 112, y: 200, anchor: 'end' },
    'stlc-p': { x: 210, y: 238, anchor: 'start' },
    'f-w': { x: 97, y: 343, anchor: 'start' },
    'c-ecc': { x: 148, y: 585, anchor: 'end' },
    'ecc-cic': { x: 148, y: 695, anchor: 'end' },
    'cic-lean': { x: 148, y: 806, anchor: 'end' },
  },
};

/** the visible segment of an edge: from circle boundary to circle boundary (with room for the arrow head) */
export function edgeSegment(layout: MapLayout, a: string, b: string) {
  const A = layout.nodes[a];
  const B = layout.nodes[b];
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.hypot(dx, dy);
  return {
    x1: A.x + (dx / d) * (A.r + 2),
    y1: A.y + (dy / d) * (A.r + 2),
    x2: B.x - (dx / d) * (B.r + 5),
    y2: B.y - (dy / d) * (B.r + 5),
  };
}

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** approximate bounding box of a text run (baseline at `p.y`) */
export function textBox(p: TextPos, s: string, size: number, style: 'regular' | 'italic' = 'regular'): Box {
  const w = textWidth(s, size, style);
  const x0 = p.anchor === 'start' ? p.x : p.anchor === 'end' ? p.x - w : p.x - w / 2;
  return { x0, y0: p.y - size * 0.78, x1: x0 + w, y1: p.y + size * 0.24 };
}
