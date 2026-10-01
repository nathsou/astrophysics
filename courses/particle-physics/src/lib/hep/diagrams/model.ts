/**
 * The diagram graph: construction, editing (pure functions, so that a UI can keep an undo stack), validation,
 * coupling order, crossing and descriptions. See `types.ts` for the conventions.
 */
import { antiId, particle } from '../particles/index.ts';
import { checkVertex, couplingStrength, matchVertex, type MatchContext } from './rules.ts';
import { isFermion, isSelfConjugate, lineKind, symbolOf } from './process.ts';
import type { Diagram, DiagramEdge, DiagramNode, DiagramOrder, Issue, Process } from './types.ts';
import type { VertexRule, VertexReason } from './rules.ts';

// ── Construction and editing ────────────────────────────────────────────────

/** A diagram with the external legs of a process and no vertices or lines yet. Leg node ids: incoming 0…, then outgoing. */
export function emptyDiagram(initial: readonly number[], final: readonly number[]): Diagram {
  const nodes: DiagramNode[] = [];
  initial.forEach((pdg, i) => nodes.push({ id: nodes.length, kind: 'in', leg: i, pdg }));
  final.forEach((pdg, i) => nodes.push({ id: nodes.length, kind: 'out', leg: i, pdg }));
  return { initial: [...initial], final: [...final], nodes, edges: [] };
}

export const legNode = (d: Diagram, kind: 'in' | 'out', leg: number): DiagramNode | undefined => d.nodes.find((n) => n.kind === kind && n.leg === leg);
export const nodeById = (d: Diagram, id: number): DiagramNode | undefined => d.nodes.find((n) => n.id === id);
export const isLeg = (n: DiagramNode): boolean => n.kind !== 'vertex';
const nextNodeId = (d: Diagram): number => d.nodes.reduce((m, n) => Math.max(m, n.id), -1) + 1;
const nextEdgeId = (d: Diagram): number => d.edges.reduce((m, e) => Math.max(m, e.id), -1) + 1;

/** Add an interaction vertex. Returns the new diagram and the new node's id. */
export function addVertex(d: Diagram): { diagram: Diagram; id: number } {
  const id = nextNodeId(d);
  return { diagram: { ...d, nodes: [...d.nodes, { id, kind: 'vertex' }] }, id };
}

/** Add a line carrying `pdg` from `from` to `to` (see `types.ts`). */
export function addEdge(d: Diagram, from: number, to: number, pdg: number): { diagram: Diagram; id: number } {
  const id = nextEdgeId(d);
  return { diagram: { ...d, edges: [...d.edges, { id, from, to, pdg }] }, id };
}

export function removeEdge(d: Diagram, id: number): Diagram {
  return { ...d, edges: d.edges.filter((e) => e.id !== id) };
}

/** Remove a vertex and the lines attached to it. External legs cannot be removed. */
export function removeVertex(d: Diagram, id: number): Diagram {
  const n = nodeById(d, id);
  if (!n || n.kind !== 'vertex') return d;
  return { ...d, nodes: d.nodes.filter((x) => x.id !== id), edges: d.edges.filter((e) => e.from !== id && e.to !== id) };
}

/** Change the particle of a line (keeping its ends). */
export function setEdgeParticle(d: Diagram, id: number, pdg: number): Diagram {
  return { ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, pdg } : e)) };
}

/** Reverse the direction of a line: the same particle now travels the other way. */
export function reverseEdge(d: Diagram, id: number): Diagram {
  return { ...d, edges: d.edges.map((e) => (e.id === id ? { ...e, from: e.to, to: e.from } : e)) };
}

/** The same line written with a positive PDG ID (for particles that have an antiparticle). */
export function normalizeEdge(e: DiagramEdge): DiagramEdge {
  if (e.pdg < 0 && !isSelfConjugate(e.pdg)) return { ...e, from: e.to, to: e.from, pdg: -e.pdg };
  return e;
}

/** The lines that end at a node (a self-loop appears once). */
export const incidentEdges = (d: Diagram, node: number): DiagramEdge[] => d.edges.filter((e) => e.from === node || e.to === node);

/** The label (all-incoming convention) of a line at one of its ends. */
export function endLabel(e: DiagramEdge, node: number): number {
  return e.to === node ? e.pdg : antiId(e.pdg);
}

/** The labels of the lines meeting at a node, in the order of the edge list (a self-loop contributes both ends). */
export function vertexLabels(d: Diagram, node: number): number[] {
  const out: number[] = [];
  for (const e of d.edges) {
    if (e.to === node) out.push(e.pdg);
    if (e.from === node) out.push(antiId(e.pdg));
  }
  return out;
}

type Ref = string | number;
/**
 * Build a diagram from a compact description. Nodes are named `in0, in1, …`, `out0, out1, …` for external legs
 * and `v0, v1, …` for vertices (created as needed). Each edge is `[from, to, pdg]`, the particle flowing from
 * `from` to `to`. Example, e⁻ e⁺ → μ⁻ μ⁺ through an s-channel photon:
 * `buildDiagram(parseProcess('e- e+ > mu- mu+'), [['in0','v0',11],['v0','in1',11],['v1','out0',13],['out1','v1',13],['v0','v1',22]])`.
 */
export function buildDiagram(p: Process, edges: readonly [Ref, Ref, number][]): Diagram {
  let d = emptyDiagram(p.initial, p.final);
  const vmap = new Map<string, number>();
  const resolve = (r: Ref): number => {
    if (typeof r === 'number') return r;
    const m = /^(in|out)(\d+)$/.exec(r);
    if (m) {
      const n = legNode(d, m[1] as 'in' | 'out', Number(m[2]));
      if (!n) throw new Error(`no leg ${r}`);
      return n.id;
    }
    if (/^v\d+$/.test(r)) {
      let id = vmap.get(r);
      if (id === undefined) {
        const a = addVertex(d);
        d = a.diagram;
        id = a.id;
        vmap.set(r, id);
      }
      return id;
    }
    throw new Error(`bad node reference ${r}`);
  };
  for (const [a, b, pdg] of edges) {
    const from = resolve(a);
    const to = resolve(b);
    d = addEdge(d, from, to, pdg).diagram;
  }
  return d;
}

// ── Validation ──────────────────────────────────────────────────────────────

export interface VertexReport {
  node: number;
  /** Labels of the lines at the vertex, all-incoming convention. */
  labels: number[];
  /** Three or more lines meet here. */
  complete: boolean;
  /** No rule is broken (an unfinished vertex with fewer than three lines is `ok`). */
  ok: boolean;
  rule?: VertexRule;
  reasons: VertexReason[];
  notes: VertexReason[];
}

export interface ValidationResult {
  /** No rule is broken. An unfinished diagram can be ok. */
  ok: boolean;
  /** Finished: every leg is attached to a vertex, every vertex is complete, and the graph is connected. */
  complete: boolean;
  /** Finished and no rule broken: a legitimate diagram for the process. */
  valid: boolean;
  issues: Issue[];
  vertices: VertexReport[];
  order: DiagramOrder;
  connected: boolean;
  loops: number;
}

export interface ValidateOptions extends MatchContext {}

/** Connected components of the graph (as arrays of node ids). */
export function components(d: Diagram): number[][] {
  const parent = new Map<number, number>();
  const find = (x: number): number => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    while (parent.get(x) !== r) {
      const nx = parent.get(x)!;
      parent.set(x, r);
      x = nx;
    }
    return r;
  };
  for (const n of d.nodes) parent.set(n.id, n.id);
  for (const e of d.edges) if (parent.has(e.from) && parent.has(e.to)) parent.set(find(e.from), find(e.to));
  const groups = new Map<number, number[]>();
  for (const n of d.nodes) {
    const r = find(n.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(n.id);
  }
  return [...groups.values()];
}

/** Number of independent loops of the graph (0 for a tree): E − N + C. */
export function loopCount(d: Diagram): number {
  return d.edges.length - d.nodes.length + components(d).length;
}

const legWord = (n: DiagramNode): string => `${n.kind === 'in' ? 'incoming' : 'outgoing'} ${symbolOf(n.pdg!)}`;

/**
 * Check a diagram against the vertex rules and the process. Every problem is reported with the node it is about,
 * in words, so that a sketchpad can show it at the right place.
 */
export function validateDiagram(d: Diagram, ctx: ValidateOptions = {}): ValidationResult {
  const issues: Issue[] = [];
  const vertices: VertexReport[] = [];
  const nodeIds = new Set(d.nodes.map((n) => n.id));
  for (const e of d.edges) {
    if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) issues.push({ code: 'unknown', edge: e.id, severity: 'error', message: 'A line ends at a point that does not exist.' });
  }
  let allComplete = true;
  // External legs.
  for (const n of d.nodes) {
    if (n.kind === 'vertex') continue;
    const inc = incidentEdges(d, n.id);
    const legLabel = n.kind === 'in' ? n.pdg! : antiId(n.pdg!);
    if (inc.length === 0) {
      allComplete = false;
      issues.push({ code: 'leg-open', node: n.id, severity: 'todo', message: `The ${legWord(n)} is not connected to anything yet.` });
      continue;
    }
    if (inc.length > 1) {
      allComplete = false;
      issues.push({ code: 'leg-multiple', node: n.id, severity: 'error', message: `The ${legWord(n)} is a single particle: only one line can start from it.` });
      continue;
    }
    const e = inc[0]!;
    const other = e.from === n.id ? e.to : e.from;
    const otherNode = nodeById(d, other);
    if (otherNode && otherNode.kind !== 'vertex') {
      allComplete = false;
      issues.push({ code: 'leg-through', node: n.id, edge: e.id, severity: 'error', message: `The ${legWord(n)} goes straight to another external particle without interacting: a diagram needs a vertex in between.` });
      continue;
    }
    // The particle flowing into the far end must be the leg's label.
    const far = endLabel(e, other);
    if (far !== legLabel) {
      allComplete = false;
      const fromLeg = far; // the particle that flows from the leg into the diagram along this line
      const physical = n.kind === 'in' ? fromLeg : antiId(fromLeg);
      if (Math.abs(physical) !== Math.abs(n.pdg!)) {
        issues.push({ code: 'leg-particle', node: n.id, edge: e.id, severity: 'error', message: `The line at the ${legWord(n)} carries ${symbolOf(physical)}, but it must carry ${symbolOf(n.pdg!)}.` });
      } else {
        issues.push({ code: 'leg-particle', node: n.id, edge: e.id, severity: 'error', message: `The arrow on the line at the ${legWord(n)} points the wrong way: an arrow points along the flow of time for a particle and against it for an antiparticle.` });
      }
    }
  }
  // Vertices.
  let order: DiagramOrder = { ew: 0, s: 0, total: 0, alpha: 0, alphaS: 0, loops: 0 };
  for (const n of d.nodes) {
    if (n.kind !== 'vertex') continue;
    const labels = vertexLabels(d, n.id);
    const ext = incidentEdges(d, n.id).flatMap((e) => {
      const r: boolean[] = [];
      if (e.to === n.id) r.push(nodeById(d, e.from)?.kind !== 'vertex');
      if (e.from === n.id) r.push(nodeById(d, e.to)?.kind !== 'vertex');
      return r;
    });
    const check = checkVertex(labels, { ...ctx, external: ctx.external ?? ext });
    const complete = labels.length >= 3;
    if (!complete) {
      allComplete = false;
      issues.push({ code: 'degree', node: n.id, severity: 'todo', message: labels.length === 0 ? 'This vertex has no lines yet.' : `A vertex needs at least three lines; this one has ${labels.length}.` });
      vertices.push({ node: n.id, labels, complete, ok: true, reasons: [], notes: [] });
      continue;
    }
    vertices.push({ node: n.id, labels, complete, ok: check.ok, rule: check.rule, reasons: check.reasons, notes: check.notes });
    if (!check.ok) {
      issues.push({ code: check.reasons[0]!.code, node: n.id, severity: 'error', message: check.reasons[0]!.message, more: check.reasons.slice(1).map((r) => r.message) });
    } else {
      for (const note of check.notes) issues.push({ code: note.code, node: n.id, severity: 'note', message: note.message });
      order = addOrder(order, check.rule!);
    }
  }
  const comps = components(d);
  const connected = comps.length === 1;
  const hasVertex = d.nodes.some((n) => n.kind === 'vertex');
  if (!connected && hasVertex && comps.filter((c) => c.length > 1 || d.nodes.find((n) => n.id === c[0])!.kind === 'vertex').length > 1 && d.edges.length > 0) {
    issues.push({ code: 'disconnected', severity: 'todo', message: `The diagram falls into ${comps.length} separate pieces: every line must be part of one connected diagram.` });
  }
  const loops = loopCount(d);
  const complete = allComplete && connected && hasVertex;
  const ok = !issues.some((i) => i.severity === 'error');
  return { ok, complete, valid: ok && complete, issues, vertices, order: { ...order, loops }, connected, loops };
}

function addOrder(o: DiagramOrder, r: VertexRule): DiagramOrder {
  const ew = o.ew + r.order.ew;
  const s = o.s + r.order.s;
  return { ew, s, total: ew + s, alpha: ew, alphaS: s, loops: o.loops };
}

/** The order of a diagram in the couplings: the sum over its vertices. Vertices that match no rule are ignored. */
export function diagramOrder(d: Diagram, ctx: MatchContext = {}): DiagramOrder {
  let o: DiagramOrder = { ew: 0, s: 0, total: 0, alpha: 0, alphaS: 0, loops: 0 };
  for (const n of d.nodes) {
    if (n.kind !== 'vertex') continue;
    const r = matchVertex(vertexLabels(d, n.id), ctx);
    if (r) o = addOrder(o, r);
  }
  return { ...o, loops: loopCount(d) };
}

/** The rule at every vertex of a diagram, by node id. */
export function vertexRules(d: Diagram, ctx: MatchContext = {}): Map<number, VertexRule> {
  const m = new Map<number, VertexRule>();
  for (const n of d.nodes) {
    if (n.kind !== 'vertex') continue;
    const r = matchVertex(vertexLabels(d, n.id), ctx);
    if (r) m.set(n.id, r);
  }
  return m;
}

/**
 * A crude size of the diagram's contribution to a rate: the product of the squared coupling strengths of its
 * vertices (e², g_s², (√2 m_f/v)², …). It ignores propagators, spins and phase space and is meant only for
 * ranking diagrams of one process ("which is larger, γ or Z exchange, before the propagator is included?").
 */
export function estimateRate(d: Diagram, ctx: MatchContext = {}): number {
  let r = 1;
  for (const n of d.nodes) {
    if (n.kind !== 'vertex') continue;
    const labels = vertexLabels(d, n.id);
    const rule = matchVertex(labels, ctx);
    if (rule) r *= couplingStrength(rule, labels) ** 2;
  }
  return r;
}

/** Sort diagrams by decreasing coupling-only rate estimate, then by the order given (a stable ranking). */
export function rankDiagrams(ds: readonly Diagram[], ctx: MatchContext = {}): { diagram: Diagram; rate: number; order: DiagramOrder }[] {
  return ds
    .map((diagram, i) => ({ diagram, rate: estimateRate(diagram, ctx), order: diagramOrder(diagram, ctx), i }))
    .sort((a, b) => b.rate - a.rate || a.i - b.i)
    .map(({ diagram, rate, order }) => ({ diagram, rate, order }));
}

/** Format the order as the power of α in the rate: "α²", "α³", "α α_s", "α_s²". */
export function orderLabel(o: DiagramOrder): string {
  const pow = (sym: string, n: number) => (n === 0 ? '' : n === 1 ? sym : `${sym}${['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸'][n] ?? `^${n}`}`);
  const parts = [pow('α', o.ew), pow('αₛ', o.s)].filter(Boolean);
  return parts.length ? parts.join(' ') : '1';
}
/** The same, for the amplitude in terms of couplings: "e²", "g_s²", "e² g_s". */
export function amplitudeOrderLabel(o: DiagramOrder): string {
  const pow = (sym: string, n: number) => (n === 0 ? '' : n === 1 ? sym : `${sym}${['', '', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸'][n] ?? `^${n}`}`);
  const parts = [pow('e', o.ew), pow('gₛ', o.s)].filter(Boolean);
  return parts.length ? parts.join(' ') : '1';
}

// ── Crossing ────────────────────────────────────────────────────────────────

/** The process with one particle moved across the arrow and replaced by its antiparticle. */
export function crossProcess(p: Process, side: 'in' | 'out', index: number): Process {
  const initial = [...p.initial];
  const final = [...p.final];
  if (side === 'in') {
    const [x] = initial.splice(index, 1);
    if (x === undefined) throw new Error('no such incoming particle');
    final.push(antiId(x));
  } else {
    const [x] = final.splice(index, 1);
    if (x === undefined) throw new Error('no such outgoing particle');
    initial.push(antiId(x));
  }
  return { initial, final };
}

/**
 * Crossing: turn an incoming particle into an outgoing antiparticle (or the reverse). The graph is untouched — the
 * same lines, the same arrows — only the leg changes side and its label becomes the antiparticle. This is why
 * Bhabha scattering (e⁺e⁻ → e⁺e⁻) and e⁻μ⁻ scattering come from the same diagrams as e⁺e⁻ → μ⁺μ⁻.
 */
export function crossing(d: Diagram, side: 'in' | 'out', index: number): Diagram {
  const target = legNode(d, side, index);
  if (!target) throw new Error('no such leg');
  const p = crossProcess({ initial: d.initial, final: d.final }, side, index);
  const other = side === 'in' ? 'out' : 'in';
  const nodes = d.nodes.map((n): DiagramNode => {
    if (n.kind === 'vertex') return n;
    if (n.id === target.id) return { ...n, kind: other, leg: (other === 'in' ? p.initial : p.final).length - 1, pdg: antiId(n.pdg!) };
    if (n.kind === side && n.leg! > index) return { ...n, leg: n.leg! - 1 };
    return n;
  });
  return { ...d, initial: p.initial, final: p.final, nodes };
}

// ── Serialisation ───────────────────────────────────────────────────────────

export function diagramToJSON(d: Diagram): string {
  return JSON.stringify({ initial: d.initial, final: d.final, nodes: d.nodes, edges: d.edges, label: d.label });
}

/** Parse what `diagramToJSON` wrote; throws on malformed input. */
export function diagramFromJSON(text: string): Diagram {
  const o = JSON.parse(text) as Diagram;
  if (!Array.isArray(o.initial) || !Array.isArray(o.final) || !Array.isArray(o.nodes) || !Array.isArray(o.edges)) throw new Error('not a diagram');
  for (const n of o.nodes) if (typeof n.id !== 'number' || !['in', 'out', 'vertex'].includes(n.kind)) throw new Error('bad node');
  for (const e of o.edges) {
    if (typeof e.id !== 'number' || typeof e.from !== 'number' || typeof e.to !== 'number' || typeof e.pdg !== 'number') throw new Error('bad edge');
    particle(e.pdg);
  }
  return o;
}

// ── Descriptions ────────────────────────────────────────────────────────────

export interface Channel {
  edge: DiagramEdge;
  /** The particle on the line (positive ID for particles with an antiparticle). */
  pdg: number;
  /** Legs on the side of the first incoming leg. */
  near: DiagramNode[];
  far: DiagramNode[];
  /** For 2 → 2 processes: the Mandelstam channel. */
  type: 's' | 't' | 'u' | 'other';
}

/** The internal lines of a tree diagram, each with the external legs on its two sides. Empty for diagrams with loops. */
export function channels(d: Diagram): Channel[] {
  if (loopCount(d) !== 0) return [];
  const out: Channel[] = [];
  const first = legNode(d, 'in', 0) ?? d.nodes.find((n) => n.kind !== 'vertex');
  for (const e of d.edges) {
    const a = nodeById(d, e.from);
    const b = nodeById(d, e.to);
    if (!a || !b || a.kind !== 'vertex' || b.kind !== 'vertex') continue;
    // Nodes reachable from `e.from` without crossing e.
    const seen = new Set<number>([e.from]);
    const stack = [e.from];
    while (stack.length) {
      const x = stack.pop()!;
      for (const f of d.edges) {
        if (f.id === e.id) continue;
        const y = f.from === x ? f.to : f.to === x ? f.from : -1;
        if (y >= 0 && !seen.has(y)) {
          seen.add(y);
          stack.push(y);
        }
      }
    }
    const fromLegs = d.nodes.filter((n) => n.kind !== 'vertex' && seen.has(n.id));
    const toLegs = d.nodes.filter((n) => n.kind !== 'vertex' && !seen.has(n.id));
    const nearIsFrom = first ? seen.has(first.id) : true;
    const near = nearIsFrom ? fromLegs : toLegs;
    const far = nearIsFrom ? toLegs : fromLegs;
    let type: Channel['type'] = 'other';
    if (d.initial.length === 2 && d.final.length === 2) {
      const ins = near.filter((n) => n.kind === 'in').length;
      const outs = near.filter((n) => n.kind === 'out');
      if (ins === 2) type = 's';
      else if (ins === 1 && outs.length === 1) type = outs[0]!.leg === 0 ? 't' : 'u';
    }
    const ne = normalizeEdge(e);
    out.push({ edge: e, pdg: ne.pdg, near, far, type });
  }
  return out;
}

/** A one-line description: "s-channel γ", "t-channel e⁻", "γ radiated from the initial e⁻", "contact interaction". */
export function describeDiagram(d: Diagram): string {
  const vertices = d.nodes.filter((n) => n.kind === 'vertex');
  if (vertices.length === 0) return 'no interaction';
  if (loopCount(d) > 0) return describeLoop(d);
  const ch = channels(d);
  const parts: string[] = [];
  if (vertices.length === 1) return d.initial.length + d.final.length >= 4 ? 'contact interaction (one four-point vertex)' : 'a single vertex';
  if (d.initial.length === 2 && d.final.length === 2 && ch.length === 1) {
    const c = ch[0]!;
    parts.push(`${c.type}-channel ${symbolOf(c.pdg)}`);
  } else if (d.initial.length === 1 && ch.length === 1) {
    parts.push(`through a virtual ${symbolOf(ch[0]!.pdg)}`);
  } else {
    // Radiation from an external fermion leg: a vertex with one external boson, one external fermion and one internal line.
    for (const v of vertices) {
      const inc = incidentEdges(d, v.id);
      if (inc.length !== 3) continue;
      const legsHere = inc.map((e) => nodeById(d, e.from === v.id ? e.to : e.from)!).filter((n) => n.kind !== 'vertex');
      const bosonLeg = legsHere.find((n) => !isFermion(n.pdg!));
      const fermLeg = legsHere.find((n) => isFermion(n.pdg!));
      if (legsHere.length === 2 && bosonLeg && fermLeg && inc.some((e) => nodeById(d, e.from === v.id ? e.to : e.from)!.kind === 'vertex')) {
        const state = fermLeg.kind === 'in' ? 'initial' : 'final';
        parts.push(`${symbolOf(bosonLeg.pdg!)} ${bosonLeg.kind === 'in' ? 'absorbed by' : 'radiated from'} the ${state}-state ${symbolOf(fermLeg.pdg!)}`);
      }
    }
    const bosons = [...new Set(ch.filter((c) => !isFermion(c.pdg)).map((c) => symbolOf(c.pdg)))];
    if (bosons.length) parts.push(`through a virtual ${bosons.join(' or ')}`);
    else if (!parts.length) parts.push(`internal lines: ${[...new Set(ch.map((c) => symbolOf(c.pdg)))].join(', ')}`);
  }
  return parts.join('; ');
}

/** The vertices and lines of the loop of a one-loop diagram: what is left when every leg and every tree-like branch is trimmed away. */
export function loopCore(d: Diagram): { nodes: number[]; edges: DiagramEdge[] } {
  const alive = new Set(d.nodes.map((n) => n.id));
  const edges = d.edges.filter((e) => e.from !== e.to);
  for (let changed = true; changed; ) {
    changed = false;
    for (const id of [...alive]) {
      const deg = edges.filter((e) => alive.has(e.from) && alive.has(e.to) && (e.from === id || e.to === id)).length;
      if (deg <= 1) {
        alive.delete(id);
        changed = true;
      }
    }
  }
  return { nodes: [...alive], edges: edges.filter((e) => alive.has(e.from) && alive.has(e.to)) };
}

function describeLoop(d: Diagram): string {
  if (loopCount(d) !== 1) return `${loopCount(d)}-loop diagram`;
  const core = loopCore(d);
  const k = core.nodes.length;
  const particles = [...new Set(core.edges.map((e) => symbolOf(normalizeEdge(e).pdg)))].join(', ');
  if (k === 2) return `self-energy bubble (loop of ${particles})`;
  if (k === 3) return `vertex correction, triangle (loop of ${particles})`;
  if (k === 4) return `box (loop of ${particles})`;
  return `${k}-point loop (${particles})`;
}

export { lineKind };
