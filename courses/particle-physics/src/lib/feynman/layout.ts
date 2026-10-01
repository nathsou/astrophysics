/**
 * Automatic layout of a Feynman diagram. Time runs from left to right: incoming legs sit on the left edge, outgoing legs
 * on the right edge, both in the unit square. The positions of the interaction vertices are the solution of a "spring"
 * problem (each vertex at the mean of its neighbours, Tutte's barycentric embedding) with the legs held fixed, and the
 * vertical order of the legs is chosen, among all permutations, to minimise the number of crossing lines.
 * The result depends only on the diagram, so the same diagram is always drawn the same way.
 */
import type { Diagram } from '../hep/diagrams/index.ts';

export interface Point {
  x: number;
  y: number;
}

export interface Layout {
  /** Position of every node, in the unit square (y downwards). */
  pos: Map<number, Point>;
  /** Number of pairs of lines that cross. */
  crossings: number;
}

function permutations<T>(items: T[], limit: number): T[][] {
  const out: T[][] = [];
  const rec = (rest: T[], cur: T[]) => {
    if (out.length >= limit) return;
    if (!rest.length) {
      out.push(cur);
      return;
    }
    for (let i = 0; i < rest.length; i++) rec([...rest.slice(0, i), ...rest.slice(i + 1)], [...cur, rest[i]!]);
  };
  rec(items, []);
  return out;
}

/** Positions of the vertices with the legs fixed (Gauss–Seidel on the barycentric equations). */
function relax(d: Diagram, fixed: Map<number, Point>): Map<number, Point> {
  const pos = new Map<number, Point>();
  const verts = d.nodes.filter((n) => n.kind === 'vertex').map((n) => n.id);
  for (const [id, p] of fixed) pos.set(id, p);
  verts.forEach((id, i) => pos.set(id, { x: 0.5 + 0.003 * ((i % 3) - 1), y: 0.5 + 0.003 * (Math.floor(i / 3) - 1) }));
  const nbr = new Map<number, number[]>();
  for (const id of verts) nbr.set(id, []);
  for (const e of d.edges) {
    if (e.from === e.to) continue;
    nbr.get(e.from)?.push(e.to);
    nbr.get(e.to)?.push(e.from);
  }
  for (let it = 0; it < 300; it++) {
    let move = 0;
    for (const id of verts) {
      const ns = nbr.get(id)!;
      if (!ns.length) continue;
      let x = 0;
      let y = 0;
      for (const n of ns) {
        const p = pos.get(n)!;
        x += p.x;
        y += p.y;
      }
      x /= ns.length;
      y /= ns.length;
      const old = pos.get(id)!;
      move = Math.max(move, Math.abs(x - old.x), Math.abs(y - old.y));
      pos.set(id, { x, y });
    }
    if (move < 1e-7) break;
  }
  return pos;
}

function segmentsCross(a: Point, b: Point, c: Point, e: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(a, b, c);
  const d2 = o(a, b, e);
  const d3 = o(c, e, a);
  const d4 = o(c, e, b);
  const eps = 1e-9;
  return ((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps));
}

/** Number of pairs of straight lines that cross (lines that share an end do not count). */
export function countCrossings(d: Diagram, pos: Map<number, Point>): number {
  let n = 0;
  for (let i = 0; i < d.edges.length; i++) {
    for (let j = i + 1; j < d.edges.length; j++) {
      const a = d.edges[i]!;
      const b = d.edges[j]!;
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      if (segmentsCross(pos.get(a.from)!, pos.get(a.to)!, pos.get(b.from)!, pos.get(b.to)!)) n++;
    }
  }
  return n;
}

/**
 * Pairs of vertices that (almost) coincide, and vertices that sit on a line they are not attached to. Symmetric
 * arrangements can collapse to one point, which has no crossings but is not a drawing; each such fault counts as a crossing.
 */
function crowding(d: Diagram, pos: Map<number, Point>): number {
  let n = 0;
  const verts = d.nodes.filter((x) => x.kind === 'vertex');
  for (let i = 0; i < verts.length; i++) {
    const a = pos.get(verts[i]!.id)!;
    for (let j = i + 1; j < verts.length; j++) {
      const b = pos.get(verts[j]!.id)!;
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.08) n++;
    }
    for (const e of d.edges) {
      if (e.from === verts[i]!.id || e.to === verts[i]!.id || e.from === e.to) continue;
      const p = pos.get(e.from)!;
      const q = pos.get(e.to)!;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const t = Math.max(0, Math.min(1, ((a.x - p.x) * dx + (a.y - p.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(p.x + t * dx - a.x, p.y + t * dy - a.y) < 0.03) n++;
    }
  }
  return n;
}

/**
 * The preferred vertical order of legs: particles above antiparticles (an e⁻ above an e⁺, as in textbooks), otherwise the order of
 * the process.
 */
function preferred(d: Diagram, ids: number[]): number[] {
  return [...ids].sort((a, b) => {
    const na = d.nodes.find((n) => n.id === a)!;
    const nb = d.nodes.find((n) => n.id === b)!;
    const ka = (na.pdg! < 0 ? 1 : 0) - (nb.pdg! < 0 ? 1 : 0);
    return ka || na.leg! - nb.leg!;
  });
}

/** The vertical positions of `n` legs spread over the height: 1 leg in the middle, 2 at ¼ and ¾, … */
const slot = (i: number, n: number): number => (n === 1 ? 0.5 : 0.12 + (0.76 * i) / (n - 1));

/** Lay out a diagram in the unit square. */
export function layoutDiagram(d: Diagram): Layout {
  const inIds = preferred(d, d.nodes.filter((n) => n.kind === 'in').map((n) => n.id));
  const outIds = preferred(d, d.nodes.filter((n) => n.kind === 'out').map((n) => n.id));
  const hasVertex = d.nodes.some((n) => n.kind === 'vertex');
  const place = (ins: number[], outs: number[]) => {
    const fixed = new Map<number, Point>();
    ins.forEach((id, i) => fixed.set(id, { x: 0, y: slot(i, ins.length) }));
    outs.forEach((id, i) => fixed.set(id, { x: 1, y: slot(i, outs.length) }));
    return fixed;
  };
  if (!hasVertex) {
    const fixed = place(inIds, outIds);
    return { pos: fixed, crossings: countCrossings(d, fixed) };
  }
  const limit = 720;
  const insPerms = permutations(inIds, limit);
  const outsPerms = permutations(outIds, Math.max(1, Math.floor(limit / insPerms.length)));
  // Preference rank of a permutation: how far it is from the preferred order.
  const disorder = (perm: number[], ref: number[]) => perm.reduce((s, id, i) => s + Math.abs(i - ref.indexOf(id)), 0);
  let best: { pos: Map<number, Point>; crossings: number; dis: number; len: number } | null = null;
  for (const ins of insPerms) {
    for (const outs of outsPerms) {
      const pos = relax(d, place(ins, outs));
      const crossings = countCrossings(d, pos) + crowding(d, pos);
      if (best && crossings > best.crossings) continue;
      const dis = disorder(ins, inIds) + disorder(outs, outIds);
      let len = 0;
      for (const e of d.edges) {
        const a = pos.get(e.from)!;
        const b = pos.get(e.to)!;
        len += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      }
      if (!best || crossings < best.crossings || (crossings === best.crossings && (dis < best.dis || (dis === best.dis && len < best.len - 1e-9)))) {
        best = { pos, crossings, dis, len };
      }
    }
  }
  return { pos: best!.pos, crossings: best!.crossings };
}
