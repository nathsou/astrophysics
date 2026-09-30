/**
 * Canonical form and isomorphism of diagrams.
 *
 * Two diagrams are the same if there is a one-to-one map of the vertices that maps every line to a line of the same
 * particle with the same arrow, and fixes the external legs. By default the external legs are labelled: leg i of
 * the initial state is distinct from leg j, even if both are electrons, so that the t- and u-channel diagrams of
 * Møller scattering are different. With `labelledLegs: false` legs of the same particle are interchangeable
 * (the "topology" of the diagram).
 */
import { isSelfConjugate } from './process.ts';
import type { Diagram } from './types.ts';

export interface CanonicalOptions {
  /** Distinguish identical external particles by their position in the process. Default true. */
  labelledLegs?: boolean;
}

interface CEdge {
  u: number;
  v: number;
  p: number;
  directed: boolean;
}

function buildEdges(d: Diagram, index: Map<number, number>): CEdge[] {
  return d.edges.map((e) => {
    let u = index.get(e.from)!;
    let v = index.get(e.to)!;
    let p = e.pdg;
    if (isSelfConjugate(p)) return { u: Math.min(u, v), v: Math.max(u, v), p: Math.abs(p), directed: false };
    if (p < 0) {
      [u, v] = [v, u];
      p = -p;
    }
    return { u, v, p, directed: true };
  });
}

/** Refine colours until stable. Colours are ranks (0…k-1) that depend only on the structure. */
function refine(colours: number[], edges: CEdge[]): number[] {
  const n = colours.length;
  let cur = colours;
  let classes = new Set(cur).size;
  for (;;) {
    const sig: string[][] = Array.from({ length: n }, () => []);
    for (const e of edges) {
      if (e.directed) {
        sig[e.u]!.push(`>${e.p}:${cur[e.v]}`);
        sig[e.v]!.push(`<${e.p}:${cur[e.u]}`);
      } else {
        sig[e.u]!.push(`-${e.p}:${cur[e.v]}`);
        sig[e.v]!.push(`-${e.p}:${cur[e.u]}`);
      }
    }
    const strings = cur.map((c, i) => `${String(c).padStart(4, '0')}[${sig[i]!.sort().join(',')}]`);
    const uniq = [...new Set(strings)].sort();
    const rank = new Map(uniq.map((s, i) => [s, i]));
    const next = strings.map((s) => rank.get(s)!);
    const k = uniq.length;
    cur = next;
    if (k === classes) return cur;
    classes = k;
  }
}

function serialise(colours: number[], init: string[], edges: CEdge[]): string {
  // colours are all distinct: they give the position of each node.
  const n = colours.length;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => colours[a]! - colours[b]!);
  const pos = new Array<number>(n);
  order.forEach((node, i) => (pos[node] = i));
  const es = edges
    .map((e) => {
      const a = pos[e.u]!;
      const b = pos[e.v]!;
      return e.directed ? `${a}>${b}:${e.p}` : `${Math.min(a, b)}-${Math.max(a, b)}:${e.p}`;
    })
    .sort();
  return `${order.map((i) => init[i]).join(';')}|${es.join(',')}`;
}

function search(colours: number[], init: string[], edges: CEdge[]): string {
  const c = refine(colours, edges);
  const n = c.length;
  const count = new Map<number, number[]>();
  c.forEach((col, i) => {
    if (!count.has(col)) count.set(col, []);
    count.get(col)!.push(i);
  });
  if (count.size === n) return serialise(c, init, edges);
  // Individualise each member of the first non-trivial cell.
  const cells = [...count.entries()].sort((a, b) => a[0] - b[0]).filter(([, m]) => m.length > 1);
  const cell = cells[0]![1];
  let best: string | null = null;
  for (const node of cell) {
    const next = c.map((col, i) => col * 2 + (i === node ? 0 : 1));
    // Rank again so that colours stay small.
    const uniq = [...new Set(next)].sort((a, b) => a - b);
    const rank = new Map(uniq.map((x, i) => [x, i]));
    const s = search(next.map((x) => rank.get(x)!), init, edges);
    if (best === null || s < best) best = s;
  }
  return best!;
}

/** A string that is equal for two diagrams exactly when they are isomorphic (respecting particles and arrows). */
export function canonicalForm(d: Diagram, opts: CanonicalOptions = {}): string {
  const labelled = opts.labelledLegs ?? true;
  const index = new Map(d.nodes.map((n, i) => [n.id, i]));
  const init = d.nodes.map((n) => (n.kind === 'vertex' ? 'V' : labelled ? `${n.kind}${n.leg}:${n.pdg}` : `${n.kind}:${n.pdg}`));
  const uniq = [...new Set(init)].sort();
  const colours = init.map((s) => uniq.indexOf(s));
  return search(colours, init, buildEdges(d, index));
}

/** Are the two diagrams the same graph, with the same particles and arrows on the lines? */
export function sameDiagram(a: Diagram, b: Diagram, opts: CanonicalOptions = {}): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  return canonicalForm(a, opts) === canonicalForm(b, opts);
}

/** Index of the first diagram of `list` that is the same as `d`, or -1. */
export function findDiagram(list: readonly Diagram[], d: Diagram, opts: CanonicalOptions = {}): number {
  const c = canonicalForm(d, opts);
  return list.findIndex((x) => x.nodes.length === d.nodes.length && x.edges.length === d.edges.length && canonicalForm(x, opts) === c);
}

/** Remove isomorphic duplicates, keeping the first of each class and the order. */
export function dedupe(list: readonly Diagram[], opts: CanonicalOptions = {}): Diagram[] {
  const seen = new Set<string>();
  const out: Diagram[] = [];
  for (const d of list) {
    const c = canonicalForm(d, opts);
    if (!seen.has(c)) {
      seen.add(c);
      out.push(d);
    }
  }
  return out;
}

/**
 * The number of automorphisms of the diagram: maps of the vertices (external legs fixed) that leave the diagram unchanged,
 * counting the exchange of identical parallel lines and the reversal of a photon or gluon that starts and ends at the same vertex.
 * The symmetry factor of the diagram is 1 over this number. Tree diagrams with labelled external legs have 1.
 * Diagrams with more than 8 vertices are not searched and return 1.
 */
export function automorphismCount(d: Diagram): number {
  const verts = d.nodes.filter((n) => n.kind === 'vertex').map((n) => n.id);
  if (verts.length > 8) return 1;
  const index = new Map(d.nodes.map((n, i) => [n.id, i]));
  const edges = buildEdges(d, index);
  const key = (e: CEdge) => (e.directed ? `${e.u}>${e.v}:${e.p}` : `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}:${e.p}`);
  const base = new Map<string, number>();
  for (const e of edges) base.set(key(e), (base.get(key(e)) ?? 0) + 1);
  const baseSorted = [...base.entries()].sort().join('|');
  let mult = 1;
  for (const c of base.values()) for (let i = 2; i <= c; i++) mult *= i;
  for (const e of edges) if (!e.directed && e.u === e.v) mult *= 2;
  const vIdx = verts.map((id) => index.get(id)!);
  let count = 0;
  const perm = new Array<number>(d.nodes.length).fill(0).map((_, i) => i);
  const used = new Array<boolean>(vIdx.length).fill(false);
  const place = (k: number) => {
    if (k === vIdx.length) {
      const m = new Map<string, number>();
      for (const e of edges) {
        const u = perm[e.u]!;
        const v = perm[e.v]!;
        const kk = e.directed ? `${u}>${v}:${e.p}` : `${Math.min(u, v)}-${Math.max(u, v)}:${e.p}`;
        m.set(kk, (m.get(kk) ?? 0) + 1);
      }
      if ([...m.entries()].sort().join('|') === baseSorted) count++;
      return;
    }
    for (let j = 0; j < vIdx.length; j++) {
      if (used[j]) continue;
      used[j] = true;
      perm[vIdx[k]!] = vIdx[j]!;
      place(k + 1);
      used[j] = false;
    }
  };
  place(0);
  return Math.max(1, count) * mult;
}

export const symmetryFactor = (d: Diagram): number => 1 / automorphismCount(d);

/** The factor 1/n! for each group of n identical particles in the final state (for cross-sections). */
export function identicalParticleFactor(final: readonly number[]): number {
  const counts = new Map<number, number>();
  for (const p of final) counts.set(p, (counts.get(p) ?? 0) + 1);
  let f = 1;
  for (const c of counts.values()) for (let i = 2; i <= c; i++) f /= i;
  return f;
}
