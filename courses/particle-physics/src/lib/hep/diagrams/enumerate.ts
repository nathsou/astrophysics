/**
 * Enumeration of Feynman diagrams from the vertex rules.
 *
 * Tree level. With every leg treated as incoming (crossing), a tree diagram with n legs is built by taking the
 * last leg as the root and splitting the remaining legs into 2 or 3 groups (a cubic or a quartic vertex at the root),
 * each group being a leg or a smaller tree whose root line carries a particle that makes the vertex allowed.
 * A labelled tree has exactly one such decomposition, so every diagram is produced once; isomorphic graphs are
 * still removed by the canonical form as a safety net. The number of diagrams grows fast (25 for gg → ggg, 220 for
 * gg → gggg); the algorithm memoises on (group of legs, root particle).
 *
 * One loop. Take the tree diagrams of the process with two extra legs X and X̄ and glue them together: every
 * one-loop diagram is obtained, each several times, and the duplicates are removed. Tadpoles and self-energy
 * insertions on external legs are dropped (they are absorbed in the definition of the external particles).
 */
import { antiId, particle } from '../particles/index.ts';
import { dedupe, canonicalForm } from './canonical.ts';
import { addEdge, addVertex, diagramOrder, emptyDiagram, incidentEdges, loopCount, nodeById, normalizeEdge } from './model.ts';
import { matchVertex, type MatchContext, type VertexRule } from './rules.ts';
import type { Diagram, DiagramEdge, EnumerateOptions, Force, LoopOptions } from './types.ts';

/** Every particle that can run on an internal line. */
const CANDIDATES: readonly number[] = [
  1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 11, -11, 12, -12, 13, -13, 14, -14, 15, -15, 16, -16, 21, 22, 23, 24, -24, 25,
];

interface Leaf {
  leaf: number;
  /** The label flowing into the parent vertex. */
  out: number;
}
interface Tree {
  out: number;
  rule: VertexRule;
  children: (Leaf | Tree)[];
  mask: number;
}

interface Resolved {
  forces: Force[];
  ctx: MatchContext;
}

function resolve(initial: readonly number[], final: readonly number[], opts: EnumerateOptions): Resolved {
  const forces: Force[] = opts.forces ? [...opts.forces] : ['qed', 'qcd', 'weak'];
  if (!opts.forces && [...initial, ...final].some((p) => Math.abs(p) === 25)) forces.push('higgs');
  return { forces, ctx: { forces, ckm: opts.ckm ?? 'auto', minYukawaMass: opts.minYukawaMass ?? 0.01 } };
}

const popcount = (m: number): number => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/** All trees for the legs `labels` (all-incoming labels); the last leg is the root. */
function enumerateTrees(labels: readonly number[], ctx: MatchContext): Tree[] {
  const n = labels.length;
  if (n < 3) return [];
  const memo = new Map<string, (Leaf | Tree)[]>();
  const rootsMemo = new Map<number, number[]>();

  const roots = (mask: number): number[] => {
    let r = rootsMemo.get(mask);
    if (r) return r;
    if (popcount(mask) === 1) r = [labels[31 - Math.clz32(mask)]!];
    else r = CANDIDATES.filter((p) => sub(mask, p, false).length > 0);
    rootsMemo.set(mask, r);
    return r;
  };

  const sub = (mask: number, out: number, rootExt: boolean): (Leaf | Tree)[] => {
    if (popcount(mask) === 1) {
      const i = 31 - Math.clz32(mask);
      return labels[i] === out ? [{ leaf: i, out }] : [];
    }
    const key = `${mask}:${out}:${rootExt ? 1 : 0}`;
    const hit = memo.get(key);
    if (hit) return hit;
    const result: Tree[] = [];
    const low = mask & -mask;
    const rest = mask ^ low;
    const tryBlocks = (blocks: number[]) => {
      const pools = blocks.map(roots);
      if (pools.some((p) => p.length === 0)) return;
      const combos: number[][] = [[]];
      for (const p of pools) {
        const next: number[][] = [];
        for (const c of combos) for (const x of p) next.push([...c, x]);
        combos.length = 0;
        combos.push(...next);
      }
      for (const combo of combos) {
        const lab = [...combo, antiId(out)];
        const ext = [...blocks.map((b) => popcount(b) === 1), rootExt];
        const rule = matchVertex(lab, { ...ctx, external: ext });
        if (!rule) continue;
        const lists = blocks.map((b, i) => sub(b, combo[i]!, false));
        if (lists.some((l) => l.length === 0)) continue;
        // Cartesian product of the children's trees.
        let prod: (Leaf | Tree)[][] = [[]];
        for (const l of lists) {
          const next: (Leaf | Tree)[][] = [];
          for (const c of prod) for (const t of l) next.push([...c, t]);
          prod = next;
        }
        for (const children of prod) result.push({ out, rule, children, mask });
      }
    };
    // k = 2: {low ∪ s, the rest}
    for (let s = rest; ; s = (s - 1) & rest) {
      const b1 = low | s;
      const b2 = mask ^ b1;
      if (b2) tryBlocks([b1, b2]);
      if (s === 0) break;
    }
    // k = 3: three non-empty groups.
    if (popcount(mask) >= 3) {
      for (let s = rest; ; s = (s - 1) & rest) {
        const b1 = low | s;
        const rem = mask ^ b1;
        if (popcount(rem) >= 2) {
          const low2 = rem & -rem;
          const rest2 = rem ^ low2;
          for (let t = rest2; ; t = (t - 1) & rest2) {
            const b2 = low2 | t;
            const b3 = rem ^ b2;
            if (b3) tryBlocks([b1, b2, b3]);
            if (t === 0) break;
          }
        }
        if (s === 0) break;
      }
    }
    memo.set(key, result);
    return result;
  };

  const full = (1 << (n - 1)) - 1;
  return sub(full, antiId(labels[n - 1]!), true) as Tree[];
}

/** Turn a tree into a diagram. `legIds[i]` is the node that carries leg i of `labels`. */
function realise(base: Diagram, labels: readonly number[], legIds: readonly number[], tree: Tree): Diagram {
  let d = base;
  const build = (t: Tree): number => {
    const a = addVertex(d);
    d = a.diagram;
    const v = a.id;
    for (const c of t.children) {
      const from = 'leaf' in c ? legIds[c.leaf]! : build(c);
      d = addEdge(d, from, v, c.out).diagram;
    }
    return v;
  };
  const root = build(tree);
  d = addEdge(d, legIds[labels.length - 1]!, root, labels[labels.length - 1]!).diagram;
  return { ...d, edges: d.edges.map(normalizeEdge) };
}

function cutsKey(t: Tree, full: number): number[] {
  const out: number[] = [];
  const walk = (x: Tree) => {
    for (const c of x.children) if (!('leaf' in c)) {
      out.push(c.mask & 1 ? c.mask : full ^ c.mask);
      walk(c);
    }
  };
  walk(t);
  return out.sort((a, b) => a - b);
}
const pdgsKey = (t: Tree): number[] => {
  const out: number[] = [];
  const walk = (x: Tree) => {
    for (const c of x.children) if (!('leaf' in c)) {
      out.push(Math.abs(c.out));
      walk(c);
    }
  };
  walk(t);
  return out.sort((a, b) => a - b);
};
const cmpLex = (a: number[], b: number[]): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return a.length - b.length;
};

function orderOk(d: Diagram, ctx: MatchContext, max: EnumerateOptions['maxOrder']): boolean {
  if (max === undefined) return true;
  const o = diagramOrder(d, ctx);
  if (typeof max === 'number') return o.total <= max;
  return (max.ew === undefined || o.ew <= max.ew) && (max.s === undefined || o.s <= max.s);
}

/**
 * All connected tree-level diagrams of a process (PDG IDs, antiparticles negative).
 *
 * The external legs are labelled: swapping the two gluons of qq̄ → gg gives the u-channel from the t-channel, so
 * both are listed. The result is ordered: fewer four-point vertices first, then by channel (s, then t, then u, using
 * the legs on the side of the first incoming particle), then by the particles on the internal lines (γ before Z).
 * Charge, baryon and lepton number are conserved by construction. Returns [] when the process has no tree diagram
 * (for instance gg → H, which is loop-induced: see `enumerateOneLoopDiagrams`).
 */
export function enumerateTreeDiagrams(initial: readonly number[], final: readonly number[], opts: EnumerateOptions = {}): Diagram[] {
  const { ctx } = resolve(initial, final, opts);
  const labels = [...initial, ...final.map(antiId)];
  const trees = enumerateTrees(labels, ctx);
  const n = labels.length;
  const full = (1 << n) - 1;
  const base = emptyDiagram(initial, final);
  const legIds = base.nodes.map((x) => x.id);
  const sorted = trees
    .map((t) => ({ t, cuts: cutsKey(t, full), pdgs: pdgsKey(t) }))
    .sort((a, b) => b.cuts.length - a.cuts.length || cmpLex(a.cuts, b.cuts) || cmpLex(a.pdgs, b.pdgs));
  const list = sorted.map(({ t }) => realise(base, labels, legIds, t)).filter((d) => orderOk(d, ctx, opts.maxOrder));
  return dedupe(list);
}

/** The number of tree diagrams, without building them. */
export const countTreeDiagrams = (initial: readonly number[], final: readonly number[], opts: EnumerateOptions = {}): number =>
  enumerateTreeDiagrams(initial, final, opts).length;

// ── One loop ────────────────────────────────────────────────────────────────

const LOOP_CANDIDATES = [1, 2, 3, 4, 5, 6, 11, 12, 13, 14, 15, 16, 21, 22, 23, 24, 25];

/** Bridges of the graph (edges whose removal disconnects it), with the node set on the `from` side. */
function bridgeSides(d: Diagram): { edge: DiagramEdge; side: Set<number> }[] {
  const out: { edge: DiagramEdge; side: Set<number> }[] = [];
  for (const e of d.edges) {
    if (e.from === e.to) continue;
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
    if (!seen.has(e.to)) out.push({ edge: e, side: seen });
  }
  return out;
}

function acceptableLoop(d: Diagram, keepExternalSelfEnergies: boolean): boolean {
  // No line that starts and ends at the same vertex.
  if (d.edges.some((e) => e.from === e.to)) return false;
  for (const { edge, side } of bridgeSides(d)) {
    const a = nodeById(d, edge.from)!;
    const b = nodeById(d, edge.to)!;
    if (a.kind !== 'vertex' || b.kind !== 'vertex') continue; // a leg's own line
    const legsFrom = d.nodes.filter((n) => n.kind !== 'vertex' && side.has(n.id)).length;
    const legsTo = d.nodes.filter((n) => n.kind !== 'vertex' && !side.has(n.id)).length;
    const min = Math.min(legsFrom, legsTo);
    if (min === 0) return false; // tadpole
    if (min === 1 && !keepExternalSelfEnergies) return false; // self-energy on an external leg
  }
  return true;
}

/**
 * One-loop diagrams of a process, built by gluing the tree diagrams of the process with two extra legs.
 * Intended for small processes: e⁺e⁻ → μ⁺μ⁻ gives the vertex corrections, the photon's vacuum polarisation (one diagram
 * per fermion flavour) and the two boxes. Self-energies on external legs and tadpoles are not included.
 * Ghost loops are not modelled, so the gluon-loop diagrams of pure QCD are listed without them.
 */
export function enumerateOneLoopDiagrams(initial: readonly number[], final: readonly number[], opts: LoopOptions = {}): Diagram[] {
  const { ctx } = resolve(initial, final, opts);
  const labels0 = [...initial, ...final.map(antiId)];
  const only = opts.loopParticles ? new Set(opts.loopParticles.map(Math.abs)) : null;
  const base0 = emptyDiagram(initial, final);
  const found: Diagram[] = [];
  for (const x of LOOP_CANDIDATES) {
    if (only && !only.has(x)) continue;
    const xs = particle(x).selfConjugate ? [x] : [x, -x];
    for (const X of xs) {
      const labels = [...labels0, X, antiId(X)];
      const trees = enumerateTrees(labels, ctx);
      for (const t of trees) {
        // Extra leg nodes live in the vertex id range; they are removed after gluing.
        let d = base0;
        const a = addVertex(d);
        d = a.diagram;
        const b = addVertex(d);
        d = b.diagram;
        const legIds = [...base0.nodes.map((q) => q.id), a.id, b.id];
        d = realise(d, labels, legIds, t);
        // A leg node has exactly one edge: the glue legs A (a.id) and B (b.id).
        const ea = incidentEdges(d, a.id)[0]!;
        const eb = incidentEdges(d, b.id)[0]!;
        const va = ea.from === a.id ? ea.to : ea.from;
        const vb = eb.from === b.id ? eb.to : eb.from;
        // A carries X into its vertex, B carries X̄ into its vertex: X flows from B's vertex to A's vertex.
        const glued: Diagram = {
          ...d,
          nodes: d.nodes.filter((q) => q.id !== a.id && q.id !== b.id),
          edges: [...d.edges.filter((e) => e.id !== ea.id && e.id !== eb.id), { id: Math.max(...d.edges.map((e) => e.id)) + 1, from: vb, to: va, pdg: X }].map(normalizeEdge),
        };
        if (loopCount(glued) !== 1) continue;
        if (!orderOk(glued, ctx, opts.maxOrder)) continue;
        if (!acceptableLoop(glued, opts.keepExternalSelfEnergies ?? false)) continue;
        found.push(glued);
      }
    }
  }
  const unique = dedupe(found);
  return unique
    .map((d) => ({ d, key: canonicalForm(d) }))
    .sort((p, q) => p.d.nodes.length - q.d.nodes.length || (p.key < q.key ? -1 : p.key > q.key ? 1 : 0))
    .map(({ d }) => d);
}

/** The number of one-loop diagrams (see `enumerateOneLoopDiagrams`). */
export const countOneLoopDiagrams = (initial: readonly number[], final: readonly number[], opts: LoopOptions = {}): number =>
  enumerateOneLoopDiagrams(initial, final, opts).length;

// ── Loop-induced processes ──────────────────────────────────────────────────

export interface LoopInducedEntry {
  id: string;
  initial: number[];
  final: number[];
  title: string;
  /** Why there is no tree diagram, and what replaces it. */
  description: string;
  /** PDG IDs that run in the loop, in order of importance. */
  dominant: number[];
  /** Options to pass to `enumerateOneLoopDiagrams` to get the leading diagrams. */
  options: LoopOptions;
}

/**
 * Processes with no tree-level diagram that matter at the LHC, with the leading one-loop diagrams.
 * gg → H has no tree diagram: the Higgs does not couple to gluons, which are massless and carry no mass-proportional charge,
 * and it couples to quarks in proportion to their mass. Two gluons turn into a Higgs boson through a closed quark loop (a triangle),
 * dominated by the top quark because the coupling is proportional to the quark mass. The triangle exists with both orientations of the
 * fermion arrow. H → γγ goes through a top loop and, with opposite sign and a larger magnitude, a W loop.
 */
export const LOOP_INDUCED: readonly LoopInducedEntry[] = [
  {
    id: 'gg>H',
    initial: [21, 21],
    final: [25],
    title: 'gg → H (gluon fusion)',
    description: 'There is no tree diagram: gluons are massless and colour-charged, the Higgs couples to mass. Two gluons fuse into a Higgs boson through a closed quark loop, a triangle with a Higgs–quark–quark vertex; the top quark dominates because the coupling is proportional to the quark mass. Both orientations of the fermion arrow are listed.',
    dominant: [6, 5, 4],
    options: { forces: ['qcd', 'higgs'], loopParticles: [6] },
  },
  {
    id: 'H>gg',
    initial: [25],
    final: [21, 21],
    title: 'H → gg',
    description: 'The same top-quark triangle read backwards in time: the Higgs boson decays to two gluons through a quark loop.',
    dominant: [6, 5, 4],
    options: { forces: ['qcd', 'higgs'], loopParticles: [6] },
  },
  {
    id: 'H>γγ',
    initial: [25],
    final: [22, 22],
    title: 'H → γγ',
    description: 'Photons are massless and the Higgs couples to mass, so there is no tree diagram. The decay goes through a loop of charged particles: the W (dominant, opposite in sign) and the top quark. Only the W and top triangles with a cubic vertex are shown.',
    dominant: [24, 6],
    options: { forces: ['qed', 'weak', 'higgs'], loopParticles: [6, 24] },
  },
];

/** The loop-induced entry for a process, if it has one. */
export function loopInducedEntry(initial: readonly number[], final: readonly number[]): LoopInducedEntry | undefined {
  const key = (p: readonly number[]) => [...p].sort((a, b) => a - b).join(',');
  return LOOP_INDUCED.find((e) => key(e.initial) === key(initial) && key(e.final) === key(final));
}

/** The leading one-loop diagrams of a loop-induced process, or [] if the process is not in the registry. */
export function loopInducedDiagrams(initial: readonly number[], final: readonly number[]): Diagram[] {
  const e = loopInducedEntry(initial, final);
  return e ? enumerateOneLoopDiagrams(initial, final, e.options) : [];
}

