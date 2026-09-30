/**
 * The engine of the diagram sketchpad and of the diagram exercise: the answer key for a process, the feedback (in words)
 * for the diagram the reader has drawn so far, and helpers for node positions. Pure TypeScript, no DOM.
 */
import {
  amplitudeOrderLabel, describeDiagram, enumerateTreeDiagrams, findDiagram, incidentEdges, nodeById, normalizeEdge, orderLabel,
  processSymbols, symbolOf, validateDiagram, type Diagram, type DiagramNode, type EnumerateOptions, type Force, type Process, type ValidationResult,
} from '../hep/diagrams/index.ts';
import { layoutDiagram } from './layout.ts';
import type { Pt } from './geometry.ts';

export interface SketchKey {
  process: Process;
  forces: Force[];
  /** The diagrams the reader is asked to find. */
  key: Diagram[];
  /** Every tree diagram the Standard Model allows for the process (all interactions, all generation mixing, all Yukawa couplings). */
  broad: Diagram[];
  options: EnumerateOptions;
}

const ALL_FORCES: Force[] = ['qed', 'qcd', 'weak', 'higgs'];

export function buildKey(process: Process, options: EnumerateOptions = {}): SketchKey {
  const key = enumerateTreeDiagrams(process.initial, process.final, options);
  const forces: Force[] = options.forces ? [...options.forces] : ['qed', 'qcd', 'weak', ...(([...process.initial, ...process.final].some((p) => Math.abs(p) === 25) ? ['higgs'] : []) as Force[])];
  const broad = enumerateTreeDiagrams(process.initial, process.final, { forces: [...ALL_FORCES, ...(forces.includes('fermi') ? (['fermi'] as Force[]) : [])], ckm: 'full', minYukawaMass: 0 });
  return { process, forces, key, broad, options };
}

/** Number the vertices 1, 2, 3 … in the order they were created. */
export function vertexNumber(d: Diagram, id: number): number {
  return d.nodes.filter((n) => n.kind === 'vertex').findIndex((n) => n.id === id) + 1;
}
export const vertexName = (d: Diagram, id: number): string => `Vertex ${vertexNumber(d, id)}`;

export function legName(n: DiagramNode): string {
  return `${n.kind === 'in' ? 'incoming' : 'outgoing'} ${symbolOf(n.pdg!)}`;
}

/** What to call a node in a sentence. */
export function nodeName(d: Diagram, id: number): string {
  const n = nodeById(d, id);
  if (!n) return 'a point';
  return n.kind === 'vertex' ? vertexName(d, id) : `the ${legName(n)}`;
}

export interface FeedbackLine {
  tone: 'bad' | 'todo' | 'ok' | 'note';
  text: string;
  node?: number;
  edge?: number;
}

export interface Feedback {
  /** The one-sentence summary. */
  headline: string;
  tone: 'empty' | 'todo' | 'bad' | 'ok' | 'dup' | 'note';
  details: FeedbackLine[];
  /** Order in the couplings of the vertices drawn so far, or null if there is no vertex. */
  order: { rate: string; amplitude: string; text: string } | null;
  /** Index in the answer key of the diagram drawn, or -1. */
  matchIndex: number;
  /** The drawn diagram is new (not among those already found). */
  isNew: boolean;
  badNodes: number[];
  badEdges: number[];
  validation: ValidationResult;
}

const plural = (n: number, w: string) => `${n} ${n === 1 ? w : w === 'vertex' ? 'vertices' : `${w}s`}`;

function forceName(f: Force): string {
  return { qed: 'electromagnetic (QED)', qcd: 'strong (QCD)', weak: 'weak', higgs: 'Higgs', fermi: 'Fermi contact' }[f];
}

/** Describe in words what the reader has drawn, and whether it is one of the diagrams of the answer key. */
export function analyse(d: Diagram, k: SketchKey, found: readonly number[]): Feedback {
  const fullForces: Force[] = [...ALL_FORCES, ...(k.forces.includes('fermi') ? (['fermi'] as Force[]) : [])];
  const validation = validateDiagram(d, { forces: fullForces, ckm: 'full', minYukawaMass: 0 });
  const details: FeedbackLine[] = [];
  const badNodes: number[] = [];
  const badEdges: number[] = [];
  const vertices = d.nodes.filter((n) => n.kind === 'vertex');
  for (const i of validation.issues) {
    if (i.severity === 'error') {
      if (i.node !== undefined && nodeById(d, i.node)?.kind === 'vertex') badNodes.push(i.node);
      if (i.edge !== undefined) badEdges.push(i.edge);
      if (i.node !== undefined && nodeById(d, i.node)?.kind !== 'vertex' && i.edge === undefined) badNodes.push(i.node);
      const name = i.node !== undefined && nodeById(d, i.node)?.kind === 'vertex' ? `${vertexName(d, i.node)}: ` : '';
      details.push({ tone: 'bad', text: `${name}${i.message}${i.more?.length ? ` (${i.more.join(' ')})` : ''}`, node: i.node, edge: i.edge });
    } else if (i.severity === 'todo') {
      details.push({ tone: 'todo', text: i.node !== undefined && nodeById(d, i.node)?.kind === 'vertex' ? `${vertexName(d, i.node)}: ${i.message}` : i.message, node: i.node });
    } else {
      details.push({ tone: 'note', text: i.node !== undefined ? `${vertexName(d, i.node)}: ${i.message}` : i.message, node: i.node });
    }
  }
  // Vertices that are fine: say which rule lets them stand.
  for (const v of validation.vertices) {
    if (v.ok && v.complete && v.rule) {
      const lines = incidentEdges(d, v.node).map((e) => symbolOf(normalizeEdge(e).pdg));
      details.push({ tone: 'ok', text: `${vertexName(d, v.node)} (${lines.join(', ')}): allowed, a ${v.rule.name} vertex with coupling ${v.rule.coupling}.`, node: v.node });
    }
  }
  const order = vertices.length && validation.vertices.some((v) => v.rule)
    ? (() => {
        const o = validation.order;
        const nv = validation.vertices.filter((v) => v.rule).length;
        return {
          rate: orderLabel(o),
          amplitude: amplitudeOrderLabel(o),
          text: `${plural(nv, 'vertex')} so far: the amplitude is proportional to ${amplitudeOrderLabel(o)}, so the diagram contributes to the rate at order ${orderLabel(o)}.`,
        };
      })()
    : null;

  const errors = validation.issues.filter((i) => i.severity === 'error');
  const nLegs = d.nodes.filter((n) => n.kind !== 'vertex').length;
  const nConnected = d.nodes.filter((n) => n.kind !== 'vertex' && incidentEdges(d, n.id).length > 0).length;
  const base = { details, order, badNodes, badEdges, validation, matchIndex: -1, isNew: false };

  if (!d.edges.length && !vertices.length) {
    return { ...base, tone: 'empty', headline: `Draw a Feynman diagram for ${processSymbols(k.process)}. Place a vertex, then join every external particle to a vertex, and the vertices to each other.` };
  }
  if (errors.length) {
    const first = errors[0]!;
    const where = first.node !== undefined && nodeById(d, first.node)?.kind === 'vertex' ? `${vertexName(d, first.node)} is not allowed: ` : '';
    const rest = details.filter((x) => !(x.tone === 'bad' && x.edge === first.edge && x.node === first.node && x.text.includes(first.message)));
    return { ...base, details: rest, tone: 'bad', headline: `${where}${first.message}` };
  }
  if (!validation.complete) {
    const todo = validation.issues.find((i) => i.severity === 'todo');
    return { ...base, tone: 'todo', headline: `Not finished: ${nConnected} of ${plural(nLegs, 'external particle')} connected so far. ${todo ? todo.message : ''}`.trim() };
  }
  // A complete, rule-abiding diagram.
  if (validation.loops > 0) {
    return { ...base, tone: 'note', headline: `That is a valid diagram with ${plural(validation.loops, 'loop')}. Each loop adds two powers of a coupling, so it is a correction to a tree diagram. This exercise asks for the tree diagrams.` };
  }
  const idx = findDiagram(k.key, d);
  if (idx >= 0) {
    const isNew = !found.includes(idx);
    const total = k.key.length;
    const nowFound = isNew ? found.length + 1 : found.length;
    return {
      ...base,
      matchIndex: idx,
      isNew,
      tone: isNew ? 'ok' : 'dup',
      headline: isNew
        ? `Correct: a valid tree diagram for ${processSymbols(k.process)}, the ${describeDiagram(k.key[idx]!)} diagram. Found ${nowFound} of ${total}.`
        : `That diagram is valid, but you have already found it (the ${describeDiagram(k.key[idx]!)} diagram). Found ${found.length} of ${total}.`,
    };
  }
  const offForces = [...new Set(validation.vertices.flatMap((v) => (v.rule ? v.rule.force : [])))].filter((f) => !k.forces.includes(f));
  if (offForces.length) {
    return { ...base, tone: 'note', headline: `The vertices are allowed in the Standard Model, but this one uses the ${offForces.map(forceName).join(' and ')} interaction, which this exercise leaves out.` };
  }
  if (findDiagram(k.broad, d) >= 0) {
    return { ...base, tone: 'note', headline: 'A valid diagram, but it is not in the answer key: it needs a coupling that is left out as negligible (a Higgs coupling to a very light fermion) or a generation-changing W vertex.' };
  }
  return { ...base, tone: 'bad', headline: 'Every vertex is allowed, but this is not a diagram for this process: check which external particle each line starts from and the particles on the internal lines.' };
}

// ── Connecting ──────────────────────────────────────────────────────────────

/**
 * The line that joins two nodes. A line at an external leg is typed by the leg's particle (an incoming e⁺ is a positron line
 * whose arrow points out of the diagram), so the reader only chooses the particle of internal lines; between two vertices the line
 * carries `pdg` from `a` to `b`.
 */
export function connectNodes(d: Diagram, a: number, b: number, pdg: number): { edge: { from: number; to: number; pdg: number } } | { error: string } {
  const na = nodeById(d, a);
  const nb = nodeById(d, b);
  if (!na || !nb) return { error: 'Choose two points to join.' };
  if (a === b) return { error: 'A line must join two different points.' };
  const legA = na.kind !== 'vertex';
  const legB = nb.kind !== 'vertex';
  if (legA && legB) return { error: 'Two external particles cannot be joined directly: a particle that never interacts is not part of the diagram. Put a vertex between them.' };
  for (const n of [na, nb]) {
    if (n.kind !== 'vertex' && incidentEdges(d, n.id).length > 0) return { error: `The ${legName(n)} already has a line. Remove it first to draw another.` };
  }
  if (legA || legB) {
    const leg = legA ? na : nb;
    const v = legA ? b : a;
    // An incoming particle flows from its leg into the vertex; an outgoing particle flows from the vertex to its leg.
    return leg.kind === 'in' ? { edge: { from: leg.id, to: v, pdg: leg.pdg! } } : { edge: { from: v, to: leg.id, pdg: leg.pdg! } };
  }
  return { edge: { from: a, to: b, pdg } };
}

// ── Positions ───────────────────────────────────────────────────────────────

export interface Canvas {
  width: number;
  height: number;
  /** Room for leg labels. */
  margin: { l: number; r: number; t: number; b: number };
}
export const DEFAULT_CANVAS: Canvas = { width: 640, height: 360, margin: { l: 56, r: 56, t: 34, b: 34 } };

/** A narrower, taller canvas for phones, so that the labels stay readable. */
export const NARROW_CANVAS: Canvas = { width: 360, height: 340, margin: { l: 40, r: 40, t: 30, b: 30 } };

export const unitToPixel = (p: Pt, c: Canvas): Pt => ({ x: c.margin.l + p.x * (c.width - c.margin.l - c.margin.r), y: c.margin.t + p.y * (c.height - c.margin.t - c.margin.b) });
export const pixelToUnit = (p: Pt, c: Canvas): Pt => ({ x: (p.x - c.margin.l) / (c.width - c.margin.l - c.margin.r), y: (p.y - c.margin.t) / (c.height - c.margin.t - c.margin.b) });

/** Positions for every node of the diagram from the automatic layout, in canvas pixels. */
export function tidyPositions(d: Diagram, c: Canvas = DEFAULT_CANVAS): Record<number, Pt> {
  const out: Record<number, Pt> = {};
  for (const [id, p] of layoutDiagram(d).pos) out[id] = unitToPixel(p, c);
  return out;
}

/** The nearest node to a point within `radius`, or undefined. */
export function nodeAt(d: Diagram, pos: Record<number, Pt>, p: Pt, radius: number): number | undefined {
  let best: { id: number; dist: number } | undefined;
  for (const n of d.nodes) {
    const q = pos[n.id];
    if (!q) continue;
    const dist = Math.hypot(q.x - p.x, q.y - p.y);
    if (dist <= radius && (!best || dist < best.dist)) best = { id: n.id, dist };
  }
  return best?.id;
}

/** A free spot for a vertex added without a click (from the form builder): the middle, stepping aside from existing nodes. */
export function freeSpot(d: Diagram, pos: Record<number, Pt>, c: Canvas = DEFAULT_CANVAS): Pt {
  const cx = c.width / 2;
  const cy = c.height / 2;
  for (let i = 0; i < 40; i++) {
    const a = i * 2.4;
    const r = i === 0 ? 0 : 38 + 10 * Math.sqrt(i) * 2;
    const p = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    if (p.x < c.margin.l + 30 || p.x > c.width - c.margin.r - 30 || p.y < c.margin.t + 20 || p.y > c.height - c.margin.b - 20) continue;
    if (!nodeAt(d, pos, p, 40)) return p;
  }
  return { x: cx, y: cy };
}

/** Presets of the sketchpad: the processes of the chapter. */
export interface Preset {
  label: string;
  process: string;
  /** Interactions of the answer key. */
  forces?: Force[];
  note?: string;
}
export const PRESETS: Preset[] = [
  { label: 'e⁺e⁻ → μ⁺μ⁻ (photon only)', process: 'e+ e- > mu+ mu-', forces: ['qed'], note: 'Annihilation into a virtual photon, which makes a muon pair.' },
  { label: 'e⁺e⁻ → μ⁺μ⁻ (photon and Z)', process: 'e+ e- > mu+ mu-', forces: ['qed', 'weak'] },
  { label: 'Bhabha: e⁺e⁻ → e⁺e⁻', process: 'e+ e- > e+ e-', forces: ['qed'] },
  { label: 'Møller: e⁻e⁻ → e⁻e⁻', process: 'e- e- > e- e-', forces: ['qed'] },
  { label: 'Compton: e⁻γ → e⁻γ', process: 'e- gamma > e- gamma', forces: ['qed'] },
  { label: 'Pair annihilation: e⁺e⁻ → γγ', process: 'e+ e- > gamma gamma', forces: ['qed'] },
  { label: 'Pair production: γγ → e⁺e⁻', process: 'gamma gamma > e+ e-', forces: ['qed'] },
  { label: 'e⁺e⁻ → μ⁺μ⁻γ', process: 'e+ e- > mu+ mu- gamma', forces: ['qed'] },
  { label: 'qq̄ → gg', process: 'u u~ > g g', forces: ['qcd'] },
  { label: 'gg → gg', process: 'g g > g g', forces: ['qcd'] },
  { label: 'ud̄ → e⁺ν_e (W)', process: 'u d~ > e+ nu_e', forces: ['weak'] },
  { label: 'Muon decay (W exchange)', process: 'mu- > e- nu_e~ nu_mu', forces: ['weak'] },
  { label: 'Muon decay (Fermi contact)', process: 'mu- > e- nu_e~ nu_mu', forces: ['fermi'] },
  { label: 'Beta decay at quark level: d → u e⁻ ν̄_e', process: 'd > u e- nu_e~', forces: ['weak'] },
  { label: 'e⁺e⁻ → W⁺W⁻', process: 'e+ e- > W+ W-', forces: ['qed', 'weak'] },
  { label: 'e⁺e⁻ → ZH', process: 'e+ e- > Z H', forces: ['weak', 'higgs'] },
];
