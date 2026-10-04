/**
 * Two-variable linear problems for the simplex view: parse constraints over x and y, run the course's simplex
 * (src/lib/fv/smt/simplex.ts) one pivot at a time recording where the assignment goes, turn an infeasibility
 * explanation into a Farkas combination a reader can check by hand, and run branch and bound over the integers.
 */
import { Simplex, type Explanation } from '$lib/fv/smt/simplex';
import { Q } from '$lib/fv/logic/rational';

export type Rel = '<=' | '>=' | '=';
export interface Constraint {
  a: bigint;
  b: bigint;
  rel: Rel;
  k: bigint;
  text: string;
}

export class LpParseError extends Error {}

/** Parse `2x - y <= 3`, `x + 3*y >= -1`, `x = 2`; both sides may hold terms. */
export function parseConstraint(text: string): Constraint {
  const m = /^(.*?)(<=|>=|=|≤|≥)(.*)$/.exec(text.trim());
  if (!m) throw new LpParseError(`Write a constraint with <=, >= or =: “${text}”.`);
  const rel: Rel = m[2] === '≤' ? '<=' : m[2] === '≥' ? '>=' : (m[2] as Rel);
  const side = (s: string) => {
    let a = 0n;
    let b = 0n;
    let k = 0n;
    const src = s.replace(/\s+/g, '');
    if (!src) throw new LpParseError(`A side of “${text}” is empty.`);
    const re = /([+-]?)(\d*)\*?([xy]?)/y;
    let i = 0;
    while (i < src.length) {
      re.lastIndex = i;
      const t = re.exec(src);
      if (!t || t[0] === '') throw new LpParseError(`Cannot read “${src.slice(i)}” in “${text}”.`);
      const sign = t[1] === '-' ? -1n : 1n;
      if (!t[2] && !t[3]) throw new LpParseError(`Cannot read “${src.slice(i)}” in “${text}”.`);
      const c = sign * (t[2] ? BigInt(t[2]) : 1n);
      if (t[3] === 'x') a += c;
      else if (t[3] === 'y') b += c;
      else k += c;
      i = re.lastIndex;
    }
    return { a, b, k };
  };
  const l = side(m[1]!);
  const r = side(m[3]!);
  // l.a x + l.b y + l.k  rel  r.a x + r.b y + r.k
  return { a: l.a - r.a, b: l.b - r.b, rel, k: r.k - l.k, text: text.trim() };
}

export interface Point {
  x: number;
  y: number;
}
const toNum = (q: Q) => Number(q.toString().includes('/') ? Number(q.toString().split('/')[0]) / Number(q.toString().split('/')[1]) : Number(q.toString()));

export interface Run {
  /** Where the assignment was before the first pivot and after each one. */
  path: Point[];
  /** Exact values at the end. */
  x: Q;
  y: Q;
  feasible: boolean;
  /** For infeasible problems: the constraints combined and their multipliers. */
  farkas?: { index: number; mu: Q }[];
  pivots: number;
}

/** Build the tableau for the constraints plus extra bounds, and run simplex, recording the path. */
export function runSimplex(cs: Constraint[], extra: { v: 'x' | 'y'; rel: '<=' | '>='; k: bigint }[] = []): Run {
  const s = new Simplex();
  const X = s.newVar();
  const Y = s.newVar();
  const at = (): Point => ({ x: toNum(s.value[X]!), y: toNum(s.value[Y]!) });
  const path: Point[] = [];
  let conflict: Explanation | null = null;
  const all: { a: bigint; b: bigint; rel: Rel; k: bigint }[] = [...cs, ...extra.map((e) => ({ a: e.v === 'x' ? 1n : 0n, b: e.v === 'y' ? 1n : 0n, rel: e.rel, k: e.k }))];
  all.forEach((c, i) => {
    if (conflict) return;
    const v = c.a !== 0n && c.b === 0n && c.a === 1n ? X : c.b !== 0n && c.a === 0n && c.b === 1n ? Y : s.define([[X, Q.of(c.a)], [Y, Q.of(c.b)]]);
    const k = Q.of(c.k);
    if (c.rel !== '>=') conflict ??= s.assertBound(v, 'hi', k, i + 1);
    if (c.rel !== '<=') conflict ??= s.assertBound(v, 'lo', k, i + 1);
  });
  path.push(at());
  let pivots = 0;
  while (!conflict) {
    const r = s.check(1);
    path.push(at());
    if (r === null) break;
    if (r !== 'gave-up') {
      conflict = r;
      break;
    }
    pivots++;
    if (pivots > 200) break;
  }
  // Remove repeated points.
  const dedup = path.filter((p, i) => i === 0 || p.x !== path[i - 1]!.x || p.y !== path[i - 1]!.y);
  return {
    path: dedup,
    x: s.value[X]!,
    y: s.value[Y]!,
    feasible: !conflict,
    farkas: conflict ? (conflict as Explanation).lits.map((l) => ({ index: l.lit - 1, mu: l.coeff })) : undefined,
    pivots: s.pivots,
  };
}

/**
 * The Farkas combination in the form a reader checks by hand: each used constraint written as `form ≤ k`, a
 * non-negative multiplier, and their sum, which must read `0 ≤ k` with k negative.
 */
export function farkasSum(all: { a: bigint; b: bigint; rel: Rel; k: bigint }[], farkas: { index: number; mu: Q }[]): { rows: { index: number; m: Q; a: bigint; b: bigint; k: bigint }[]; sum: { a: Q; b: Q; k: Q } } {
  const rows = farkas.map(({ index, mu }) => {
    const c = all[index]!;
    // μ ≥ 0 for ≤; μ ≤ 0 for ≥ (flip to −form ≤ −k); any sign for = (use the side the sign picks).
    const flip = mu.sign() < 0;
    return { index, m: flip ? mu.neg() : mu, a: flip ? -c.a : c.a, b: flip ? -c.b : c.b, k: flip ? -c.k : c.k };
  });
  let a = Q.ZERO;
  let b = Q.ZERO;
  let k = Q.ZERO;
  for (const r of rows) {
    a = a.add(r.m.mul(Q.of(r.a)));
    b = b.add(r.m.mul(Q.of(r.b)));
    k = k.add(r.m.mul(Q.of(r.k)));
  }
  return { rows, sum: { a, b, k } };
}

export interface BbNode {
  id: number;
  parent?: number;
  /** The bound this node adds, e.g. "x ≤ 1". */
  branch?: string;
  extra: { v: 'x' | 'y'; rel: '<=' | '>='; k: bigint }[];
  run: Run;
  status: 'infeasible' | 'integral' | 'split' | 'unexplored';
}

/** Branch and bound for integer feasibility, depth first, splitting on the first fractional variable. */
export function branchAndBound(cs: Constraint[], maxNodes = 40): { nodes: BbNode[]; solution?: BbNode; exhausted: boolean } {
  const nodes: BbNode[] = [];
  const stack: Omit<BbNode, 'id' | 'run' | 'status'>[] = [{ extra: [] }];
  let solution: BbNode | undefined;
  while (stack.length && nodes.length < maxNodes && !solution) {
    const n = stack.pop()!;
    const run = runSimplex(cs, n.extra);
    const node: BbNode = { ...n, id: nodes.length, run, status: 'infeasible' };
    nodes.push(node);
    if (!run.feasible) continue;
    const frac = !run.x.isInt() ? 'x' : !run.y.isInt() ? 'y' : undefined;
    if (!frac) {
      node.status = 'integral';
      solution = node;
      break;
    }
    node.status = 'split';
    const val = frac === 'x' ? run.x : run.y;
    const f = val.floor();
    // Push the upper branch first so the lower one is explored first.
    stack.push({ parent: node.id, branch: `${frac} ≥ ${f + 1n}`, extra: [...n.extra, { v: frac, rel: '>=', k: f + 1n }] });
    stack.push({ parent: node.id, branch: `${frac} ≤ ${f}`, extra: [...n.extra, { v: frac, rel: '<=', k: f }] });
  }
  for (const s of stack) nodes.push({ ...s, id: nodes.length, run: { path: [], x: Q.ZERO, y: Q.ZERO, feasible: true, pivots: 0 }, status: 'unexplored' });
  return { nodes, solution, exhausted: !solution && stack.length === 0 };
}

export const qText = (q: Q) => q.toString();
export const qNum = toNum;
