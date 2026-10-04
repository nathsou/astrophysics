/**
 * Encoding problems into CNF (chapter 6): a small Boolean formula type, Tseitin's transformation, cardinality
 * constraints, model enumeration and counting, and generators for the course's benchmark families.
 */
import type { Cnf } from './cnf';
import { Solver, type SolverOptions } from './solver';
import type { Rng } from '../util/random';

export type Formula =
  | { k: 'var'; v: number }
  | { k: 'const'; value: boolean }
  | { k: 'not'; a: Formula }
  | { k: 'and'; args: Formula[] }
  | { k: 'or'; args: Formula[] }
  | { k: 'imp'; a: Formula; b: Formula }
  | { k: 'iff'; a: Formula; b: Formula }
  | { k: 'xor'; a: Formula; b: Formula };

export const fv = (v: number): Formula => ({ k: 'var', v });
export const fnot = (a: Formula): Formula => ({ k: 'not', a });
export const fand = (...args: Formula[]): Formula => ({ k: 'and', args });
export const forr = (...args: Formula[]): Formula => ({ k: 'or', args });
export const fimp = (a: Formula, b: Formula): Formula => ({ k: 'imp', a, b });
export const fiff = (a: Formula, b: Formula): Formula => ({ k: 'iff', a, b });
export const fxor = (a: Formula, b: Formula): Formula => ({ k: 'xor', a, b });

export function evalFormula(f: Formula, model: readonly boolean[]): boolean {
  switch (f.k) {
    case 'var':
      return model[f.v] === true;
    case 'const':
      return f.value;
    case 'not':
      return !evalFormula(f.a, model);
    case 'and':
      return f.args.every((x) => evalFormula(x, model));
    case 'or':
      return f.args.some((x) => evalFormula(x, model));
    case 'imp':
      return !evalFormula(f.a, model) || evalFormula(f.b, model);
    case 'iff':
      return evalFormula(f.a, model) === evalFormula(f.b, model);
    case 'xor':
      return evalFormula(f.a, model) !== evalFormula(f.b, model);
  }
}

export function maxVar(f: Formula): number {
  // Formulas may share subformulas (a DAG): visit each node once.
  const seen = new Set<Formula>();
  let max = 0;
  const stack: Formula[] = [f];
  while (stack.length) {
    const g = stack.pop()!;
    if (seen.has(g)) continue;
    seen.add(g);
    switch (g.k) {
      case 'var':
        if (g.v > max) max = g.v;
        break;
      case 'const':
        break;
      case 'not':
        stack.push(g.a);
        break;
      case 'and':
      case 'or':
        stack.push(...g.args);
        break;
      default:
        stack.push(g.a, g.b);
    }
  }
  return max;
}

/**
 * Tseitin's transformation (1968): one fresh variable per connective, with clauses saying it equals the
 * connective applied to its arguments. The result is equisatisfiable with f and only linearly larger.
 */
export function tseitin(f: Formula, firstFresh = maxVar(f) + 1): Cnf & { root: number; fresh: number } {
  const clauses: number[][] = [];
  let next = firstFresh;
  // A subformula shared by reference (a DAG, as relational encodings build) gets one variable, not one per use.
  const memo = new Map<Formula, number>();
  let maxInput = 0;
  const go = (g: Formula): number => {
    if (g.k === 'var') {
      if (g.v > maxInput) maxInput = g.v;
      return g.v;
    }
    if (g.k === 'not') return -go(g.a);
    const m = memo.get(g);
    if (m !== undefined) return m;
    const x = node(g);
    memo.set(g, x);
    return x;
  };
  const node = (g: Formula): number => {
    switch (g.k) {
      case 'var':
        return g.v;
      case 'const': {
        const x = next++;
        clauses.push([g.value ? x : -x]);
        return x;
      }
      case 'not':
        return -go(g.a);
      case 'and':
      case 'or': {
        const xs = g.args.map(go);
        const x = next++;
        if (g.k === 'and') {
          for (const a of xs) clauses.push([-x, a]);
          clauses.push([x, ...xs.map((a) => -a)]);
        } else {
          for (const a of xs) clauses.push([x, -a]);
          clauses.push([-x, ...xs]);
        }
        return x;
      }
      case 'imp':
        return go({ k: 'or', args: [{ k: 'not', a: g.a }, g.b] });
      case 'iff':
      case 'xor': {
        const a = go(g.a);
        const b = go(g.b);
        const x = next++;
        const bb = g.k === 'xor' ? -b : b;
        clauses.push([-x, -a, bb], [-x, a, -bb], [x, a, bb], [x, -a, -bb]);
        return x;
      }
    }
  };
  const root = go(f);
  clauses.push([root]);
  return { nvars: Math.max(next - 1, maxInput), clauses, root, fresh: next - firstFresh };
}

/** The naive CNF of a formula by distribution (exponential in general: the contrast for chapter 6). */
export function naiveCnf(f: Formula): number[][] {
  const nnf = (g: Formula, pos: boolean): Formula => {
    switch (g.k) {
      case 'var':
        return pos ? g : fnot(g);
      case 'const':
        return { k: 'const', value: pos ? g.value : !g.value };
      case 'not':
        return nnf(g.a, !pos);
      case 'and':
        return { k: pos ? 'and' : 'or', args: g.args.map((x) => nnf(x, pos)) };
      case 'or':
        return { k: pos ? 'or' : 'and', args: g.args.map((x) => nnf(x, pos)) };
      case 'imp':
        return nnf(forr(fnot(g.a), g.b), pos);
      case 'iff':
        return nnf(fand(fimp(g.a, g.b), fimp(g.b, g.a)), pos);
      case 'xor':
        return nnf(fnot(fiff(g.a, g.b)), pos);
    }
  };
  const cnf = (g: Formula): number[][] => {
    switch (g.k) {
      case 'var':
        return [[g.v]];
      case 'not':
        return [[-(g.a as { v: number }).v]];
      case 'const':
        return g.value ? [] : [[]];
      case 'and':
        return g.args.flatMap(cnf);
      case 'or':
        return g.args.map(cnf).reduce<number[][]>((acc, cs) => acc.flatMap((a) => cs.map((c) => [...a, ...c])), [[]]);
      default:
        return cnf(nnf(g, true));
    }
  };
  return cnf(nnf(f, true));
}

// ── Cardinality constraints ──
export function atMostOnePairwise(xs: number[]): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) out.push([-xs[i]!, -xs[j]!]);
  return out;
}

/** Sinz's sequential counter for at-most-k (2005): O(n·k) clauses and auxiliary variables. */
export function atMostK(xs: number[], k: number, fresh: () => number): number[][] {
  const n = xs.length;
  if (k >= n) return [];
  if (k === 0) return xs.map((x) => [-x]);
  const out: number[][] = [];
  // s[i][j]: at least j+1 of the first i+1 variables are true.
  const s: number[][] = Array.from({ length: n }, () => Array.from({ length: k }, () => fresh()));
  out.push([-xs[0]!, s[0]![0]!]);
  for (let j = 1; j < k; j++) out.push([-s[0]![j]!]);
  for (let i = 1; i < n; i++) {
    out.push([-xs[i]!, s[i]![0]!]);
    out.push([-s[i - 1]![0]!, s[i]![0]!]);
    for (let j = 1; j < k; j++) {
      out.push([-xs[i]!, -s[i - 1]![j - 1]!, s[i]![j]!]);
      out.push([-s[i - 1]![j]!, s[i]![j]!]);
    }
    out.push([-xs[i]!, -s[i - 1]![k - 1]!]);
  }
  return out;
}

export function exactlyOne(xs: number[]): number[][] {
  return [xs, ...atMostOnePairwise(xs)];
}

// ── Models: enumeration and counting ──

/**
 * Every model, projected on `vars` (default: all variables of the CNF), found by adding a blocking clause after
 * each one. Used by `encode` exercises: an encoding is exact when it has exactly the expected number of solutions.
 */
export function enumerateModels(cnf: Cnf, opts: { vars?: number[]; limit?: number; solver?: SolverOptions } = {}): boolean[][] {
  const s = new Solver({ ...opts.solver });
  s.ensureVars(cnf.nvars);
  for (const c of cnf.clauses) if (!s.addClause(c)) return [];
  const vars = opts.vars ?? Array.from({ length: cnf.nvars }, (_, i) => i + 1);
  const out: boolean[][] = [];
  const limit = opts.limit ?? 100_000;
  while (out.length < limit && s.solve() === 'sat') {
    const m = s.model;
    out.push(m);
    if (!s.addClause(vars.map((v) => (m[v] ? -v : v)))) break;
    if (!vars.length) break;
  }
  return out;
}

export function countModels(cnf: Cnf, vars?: number[], limit?: number): number {
  return enumerateModels(cnf, { vars, limit }).length;
}

// ── Generators ──

/** Uniform random k-SAT with n variables and m clauses (distinct variables in each clause). */
export function randomKSat(r: Rng, n: number, m: number, k = 3): Cnf {
  const clauses: number[][] = [];
  for (let i = 0; i < m; i++) {
    const vars = new Set<number>();
    while (vars.size < k) vars.add(r.int(1, n + 1));
    clauses.push([...vars].map((v) => (r.chance(0.5) ? v : -v)));
  }
  return { nvars: n, clauses };
}

/** The pigeonhole principle PHP(p, h): p pigeons in h holes, at most one per hole. Unsatisfiable when p > h. */
export function pigeonhole(p: number, h: number): Cnf & { v: (i: number, j: number) => number } {
  const v = (i: number, j: number) => i * h + j + 1;
  const clauses: number[][] = [];
  for (let i = 0; i < p; i++) clauses.push(Array.from({ length: h }, (_, j) => v(i, j)));
  for (let j = 0; j < h; j++) for (let a = 0; a < p; a++) for (let b = a + 1; b < p; b++) clauses.push([-v(a, j), -v(b, j)]);
  return { nvars: p * h, clauses, v };
}

/** N queens on an N×N board: one variable per square. */
export function nQueens(n: number): Cnf & { v: (r: number, c: number) => number } {
  const v = (r: number, c: number) => r * n + c + 1;
  const clauses: number[][] = [];
  for (let r = 0; r < n; r++) {
    const row = Array.from({ length: n }, (_, c) => v(r, c));
    clauses.push(row, ...atMostOnePairwise(row));
  }
  for (let c = 0; c < n; c++) clauses.push(...atMostOnePairwise(Array.from({ length: n }, (_, r) => v(r, c))));
  for (let d = -(n - 1); d <= n - 1; d++) {
    const diag: number[] = [];
    const anti: number[] = [];
    for (let r = 0; r < n; r++) {
      const c = r + d;
      if (c >= 0 && c < n) diag.push(v(r, c));
      const c2 = n - 1 - r + d;
      if (c2 >= 0 && c2 < n) anti.push(v(r, c2));
    }
    clauses.push(...atMostOnePairwise(diag), ...atMostOnePairwise(anti));
  }
  return { nvars: n * n, clauses, v };
}

/** Sudoku of box size b (board n = b², digits 1…n). `givens` holds 0 for empty squares, row by row. */
export function sudoku(b: number, givens: number[]): Cnf & { v: (r: number, c: number, d: number) => number; decode: (m: boolean[]) => number[] } {
  const n = b * b;
  const v = (r: number, c: number, d: number) => (r * n + c) * n + (d - 1) + 1;
  const clauses: number[][] = [];
  const groups: number[][][] = [];
  for (let i = 0; i < n; i++) {
    groups.push(Array.from({ length: n }, (_, j) => [i, j]), Array.from({ length: n }, (_, j) => [j, i]));
    const br = Math.floor(i / b) * b;
    const bc = (i % b) * b;
    groups.push(Array.from({ length: n }, (_, j) => [br + Math.floor(j / b), bc + (j % b)]));
  }
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) clauses.push(...exactlyOne(Array.from({ length: n }, (_, d) => v(r, c, d + 1))));
  for (const g of groups) for (let d = 1; d <= n; d++) clauses.push(...exactlyOne(g.map(([r, c]) => v(r!, c!, d))));
  givens.forEach((d, i) => {
    if (d) clauses.push([v(Math.floor(i / n), i % n, d)]);
  });
  const decode = (m: boolean[]) => {
    const out: number[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) for (let d = 1; d <= n; d++) if (m[v(r, c, d)]) out.push(d);
    return out;
  };
  return { nvars: n * n * n, clauses, v, decode };
}
