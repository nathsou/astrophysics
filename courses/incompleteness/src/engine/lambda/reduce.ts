// β-reduction (section "Reduction of Lambda Terms"), reduction strategies, η-reduction and
// bounded reduction graphs (for the Church–Rosser property).
//
// A redex is a term (λx.M)N; its contractum is M[N/x]. P →β P′ in one step if P′ comes from P by
// contracting one redex somewhere inside it. A term with no redex is β-normal.
//
// Strategies choose which redex to contract:
//   normal order       — the leftmost-outermost redex (finds a normal form whenever there is one);
//   applicative order  — the leftmost-innermost redex (arguments first);
//   call by name       — weak head reduction: only the head redex, never under λ or in arguments;
//   call by value      — weak, left to right, and (λx.M)N only once N is a value (variable or λ).
// Runs are bounded by fuel. Running out of fuel says only that: it never claims that a term has
// no normal form.

import type { Abs, NodeId, Path, Term } from './term.ts';
import { alphaEq, alphaKey, freeVars, pathOf, replaceAt, atPath, size } from './term.ts';
import { substitute, type SubstResult } from './subst.ts';

export interface Redex {
  /** The application node (λx.M)N. */
  id: NodeId;
  path: Path;
  /** The abstraction λx.M, its parameter, its body M and the argument N. */
  abs: NodeId;
  param: string;
  body: NodeId;
  arg: NodeId;
  /** Lies inside the body of some λ. */
  underLambda: boolean;
  /** Not inside another redex. */
  outermost: boolean;
  /** Contains no other redex. */
  innermost: boolean;
  leftmostOutermost: boolean;
  leftmostInnermost: boolean;
}

export function isRedex(t: Term): t is Term & { k: 'app'; fn: Abs } {
  return t.k === 'app' && t.fn.k === 'abs';
}

function isPrefix(p: Path, q: Path): boolean {
  return p.length < q.length && p.every((x, i) => q[i] === x);
}

/** All β-redexes of M, in pre-order (outer before inner, left before right). */
export function redexes(m: Term): Redex[] {
  const found: { t: Term & { k: 'app'; fn: Abs }; path: Path; underLambda: boolean }[] = [];
  const path: number[] = [];
  const go = (s: Term, under: boolean) => {
    switch (s.k) {
      case 'var':
        return;
      case 'app':
        if (isRedex(s)) found.push({ t: s, path: [...path], underLambda: under });
        path.push(0);
        go(s.fn, under);
        path[path.length - 1] = 1;
        go(s.arg, under);
        path.pop();
        return;
      case 'abs':
        path.push(0);
        go(s.body, true);
        path.pop();
    }
  };
  go(m, false);
  const out: Redex[] = found.map(({ t, path, underLambda }) => ({
    id: t.id,
    path,
    abs: t.fn.id,
    param: t.fn.param,
    body: t.fn.body.id,
    arg: t.arg.id,
    underLambda,
    outermost: !found.some((o) => isPrefix(o.path, path)),
    innermost: !found.some((o) => isPrefix(path, o.path)),
    leftmostOutermost: false,
    leftmostInnermost: false,
  }));
  if (out.length > 0) out[0]!.leftmostOutermost = true;
  const li = out.find((r) => r.innermost);
  if (li) li.leftmostInnermost = true;
  return out;
}

export function hasRedex(m: Term): boolean {
  switch (m.k) {
    case 'var':
      return false;
    case 'app':
      return m.fn.k === 'abs' || hasRedex(m.fn) || hasRedex(m.arg);
    case 'abs':
      return hasRedex(m.body);
  }
}

/** β-normal: no redexes. */
export const isNormal = (m: Term): boolean => !hasRedex(m);

export interface Contraction {
  before: Term;
  /** The whole term after contracting the redex. */
  result: Term;
  /** The contracted redex (id and path in `before`). */
  redex: NodeId;
  path: Path;
  /** (λx.M)N: the abstraction, x, the body M and the argument N (ids in `before`). */
  abs: NodeId;
  param: string;
  body: NodeId;
  arg: NodeId;
  /** The contractum M[N/x], which sits at `path` in `result`. */
  contractum: Term;
  /** The substitution M[N/x] that was performed, with its trace (renamings, replaced occurrences). */
  subst: SubstResult;
  /** How many copies of N were made (0: N was discarded, since x is not free in M). */
  copies: number;
}

/** Contracts the redex with the given id. Throws if there is no such redex. */
export function contract(m: Term, redexId: NodeId): Contraction {
  const path = pathOf(m, redexId);
  if (path === null) throw new Error(`contract: no node ${redexId} in the term`);
  return contractAt(m, path);
}

/** Contracts the redex at `path`. Throws if the subterm there is not a redex. */
export function contractAt(m: Term, path: Path): Contraction {
  const r = atPath(m, path);
  if (!r || !isRedex(r)) throw new Error('contract: that subterm is not a redex (λx.M)N');
  const abs = r.fn;
  const s = substitute(abs.body, abs.param, r.arg);
  return {
    before: m,
    result: replaceAt(m, path, s.result),
    redex: r.id,
    path,
    abs: abs.id,
    param: abs.param,
    body: abs.body.id,
    arg: r.arg.id,
    contractum: s.result,
    subst: s,
    copies: s.replaced,
  };
}

// ------------------------------------------------------------------ strategies

export type Strategy = 'normal' | 'applicative' | 'cbn' | 'cbv';

export const STRATEGY_NAMES: Record<Strategy, string> = {
  normal: 'normal order (leftmost-outermost)',
  applicative: 'applicative order (leftmost-innermost)',
  cbn: 'call by name (weak head reduction)',
  cbv: 'call by value',
};

// The finders push onto a shared path while descending and pop when backtracking, so a search
// costs time proportional to the nodes it visits.

function leftmostOutermost(t: Term, path: number[]): boolean {
  switch (t.k) {
    case 'var':
      return false;
    case 'app':
      if (t.fn.k === 'abs') return true;
      path.push(0);
      if (leftmostOutermost(t.fn, path)) return true;
      path[path.length - 1] = 1;
      if (leftmostOutermost(t.arg, path)) return true;
      path.pop();
      return false;
    case 'abs':
      path.push(0);
      if (leftmostOutermost(t.body, path)) return true;
      path.pop();
      return false;
  }
}

function leftmostInnermost(t: Term, path: number[]): boolean {
  switch (t.k) {
    case 'var':
      return false;
    case 'app':
      path.push(0);
      if (leftmostInnermost(t.fn, path)) return true;
      path[path.length - 1] = 1;
      if (leftmostInnermost(t.arg, path)) return true;
      path.pop();
      return t.fn.k === 'abs';
    case 'abs':
      path.push(0);
      if (leftmostInnermost(t.body, path)) return true;
      path.pop();
      return false;
  }
}

function headRedex(t: Term): Path | null {
  // Walk down the function spine: t = h A₁ … Aₖ. If h is a λ and k ≥ 1, (h A₁) is the head redex.
  let depth = 0;
  let cur = t;
  while (cur.k === 'app') {
    cur = cur.fn;
    depth++;
  }
  if (cur.k !== 'abs' || depth === 0) return null;
  return Array<number>(depth - 1).fill(0);
}

function cbvRedex(t: Term, path: number[]): boolean {
  if (t.k !== 'app') return false;
  path.push(0);
  if (cbvRedex(t.fn, path)) return true;
  path[path.length - 1] = 1;
  if (cbvRedex(t.arg, path)) return true;
  path.pop();
  return t.fn.k === 'abs' && t.arg.k !== 'app';
}

const found = (f: (t: Term, path: number[]) => boolean, t: Term): Path | null => {
  const path: number[] = [];
  return f(t, path) ? path : null;
};

/** The path of the redex the strategy contracts next, or null if it has no step. */
export function strategyRedexPath(m: Term, strategy: Strategy): Path | null {
  switch (strategy) {
    case 'normal':
      return found(leftmostOutermost, m);
    case 'applicative':
      return found(leftmostInnermost, m);
    case 'cbn':
      return headRedex(m);
    case 'cbv':
      return found(cbvRedex, m);
  }
}

/** The id of the redex the strategy contracts next, or null. */
export function strategyRedex(m: Term, strategy: Strategy): NodeId | null {
  const p = strategyRedexPath(m, strategy);
  return p === null ? null : atPath(m, p)!.id;
}

/** One step of the strategy, or null if it has none. */
export function step(m: Term, strategy: Strategy): Contraction | null {
  const p = strategyRedexPath(m, strategy);
  return p === null ? null : contractAt(m, p);
}

export type RunStatus =
  /** No β-redex left: the term is β-normal. */
  | 'normal-form'
  /** The strategy has no further step, but the term still has redexes (under λ, or blocked). */
  | 'stopped'
  /** The step limit was reached. Says nothing about whether a normal form exists. */
  | 'out-of-fuel'
  /** The term grew beyond the size limit. Says nothing about whether a normal form exists. */
  | 'size-limit';

export interface ReduceOptions {
  /** Maximum number of steps (default 1000). */
  fuel?: number;
  /** Stop when the term has more nodes than this (default 50 000; checked every 8 steps). */
  maxSize?: number;
  /** Record each contraction (default true). Without it only the count and final term are kept. */
  trace?: boolean;
}

export interface ReductionRun {
  strategy: Strategy;
  start: Term;
  final: Term;
  /** The contractions performed, in order (empty when `trace: false`). */
  steps: Contraction[];
  count: number;
  status: RunStatus;
  /** A plain-language explanation of the status. */
  note: string;
}

export function reduce(m: Term, strategy: Strategy, opts: ReduceOptions = {}): ReductionRun {
  const fuel = opts.fuel ?? 1000;
  const maxSize = opts.maxSize ?? 50_000;
  const trace = opts.trace ?? true;
  const steps: Contraction[] = [];
  let cur = m;
  let count = 0;
  for (;;) {
    const p = strategyRedexPath(cur, strategy);
    if (p === null) {
      if (!hasRedex(cur)) return { strategy, start: m, final: cur, steps, count, status: 'normal-form', note: `normal form reached after ${count} step${count === 1 ? '' : 's'}` };
      const why =
        strategy === 'cbn'
          ? 'weak head normal form: call by name does not reduce under λ or inside arguments'
          : strategy === 'cbv'
            ? 'call by value has no further step: it does not reduce under λ, and contracts (λx.M)N only when N is a value'
            : 'no further step';
      return { strategy, start: m, final: cur, steps, count, status: 'stopped', note: `${why}; the term still contains redexes` };
    }
    if (count >= fuel)
      return {
        strategy,
        start: m,
        final: cur,
        steps,
        count,
        status: 'out-of-fuel',
        note: `stopped after ${count} steps without reaching a normal form; this alone does not show that there is none`,
      };
    if (count % 8 === 0 && size(cur) > maxSize)
      return { strategy, start: m, final: cur, steps, count, status: 'size-limit', note: `stopped after ${count} steps: the term grew beyond ${maxSize} nodes` };
    const c = contractAt(cur, p);
    if (trace) steps.push(c);
    cur = c.result;
    count++;
  }
}

export const normalOrder = (m: Term, opts?: ReduceOptions) => reduce(m, 'normal', opts);
export const applicativeOrder = (m: Term, opts?: ReduceOptions) => reduce(m, 'applicative', opts);
export const callByName = (m: Term, opts?: ReduceOptions) => reduce(m, 'cbn', opts);
export const callByValue = (m: Term, opts?: ReduceOptions) => reduce(m, 'cbv', opts);

/** The normal form of M by normal order, or null if none was reached within the limits. */
export function normalize(m: Term, opts: Omit<ReduceOptions, 'trace'> = {}): Term | null {
  const r = reduce(m, 'normal', { ...opts, trace: false });
  return r.status === 'normal-form' ? r.final : null;
}

/**
 * M =β N? Decided by comparing normal forms (normal order): true or false when both were found,
 * null when either run gave up.
 */
export function betaEquivalent(a: Term, b: Term, opts: Omit<ReduceOptions, 'trace'> = {}): boolean | null {
  const na = normalize(a, opts);
  const nb = normalize(b, opts);
  if (na === null || nb === null) return null;
  return alphaEq(na, nb);
}

// ------------------------------------------------------------------ η

export interface EtaRedex {
  /** The abstraction λx.(M x) with x ∉ FV(M). */
  id: NodeId;
  path: Path;
  param: string;
  /** M. */
  fn: NodeId;
}

export function etaRedexes(m: Term): EtaRedex[] {
  const out: EtaRedex[] = [];
  const go = (s: Term, path: Path) => {
    if (s.k === 'app') {
      go(s.fn, [...path, 0]);
      go(s.arg, [...path, 1]);
    } else if (s.k === 'abs') {
      const b = s.body;
      if (b.k === 'app' && b.arg.k === 'var' && b.arg.name === s.param && !freeVars(b.fn).has(s.param)) out.push({ id: s.id, path, param: s.param, fn: b.fn.id });
      go(s.body, [...path, 0]);
    }
  };
  go(m, []);
  return out;
}

/** λx.(M x) →η M (x ∉ FV(M)). Throws if the node is not an η-redex. */
export function etaContract(m: Term, id: NodeId): Term {
  const r = etaRedexes(m).find((e) => e.id === id);
  if (!r) throw new Error('etaContract: not an η-redex λx.(M x) with x not free in M');
  const abs = atPath(m, r.path) as Abs;
  const body = abs.body as Term & { k: 'app' };
  return replaceAt(m, r.path, body.fn);
}

// ------------------------------------------------------------------ reduction graphs

export interface GraphNode {
  index: number;
  /** α-invariant key (terms are identified up to α-equivalence). */
  key: string;
  term: Term;
  /** Length of a shortest reduction from the start. */
  depth: number;
  normal: boolean;
  /** All one-step reducts are in the graph. */
  expanded: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
  /** The redex contracted (id in the `from` term) and its path. */
  redex: NodeId;
  path: Path;
  leftmostOutermost: boolean;
}

export interface ReductionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Every node was expanded: the graph is the whole reduction graph of the start term. */
  complete: boolean;
  /** Indices of the β-normal nodes. */
  normalForms: number[];
}

export interface GraphOptions {
  /** Maximum number of distinct terms (default 40). */
  maxNodes?: number;
  /** Do not expand terms further than this many steps from the start (default unbounded). */
  maxDepth?: number;
  /** Do not expand terms with more nodes than this (default 400). */
  maxSize?: number;
}

/**
 * The terms reachable from M by one-step β-reductions (up to α-equivalence), breadth first, with
 * an edge for each contraction. Bounded; `complete` says whether the bounds were hit.
 */
export function reductionGraph(m: Term, opts: GraphOptions = {}): ReductionGraph {
  const maxNodes = opts.maxNodes ?? 40;
  const maxDepth = opts.maxDepth ?? Infinity;
  const maxSize = opts.maxSize ?? 400;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const byKey = new Map<string, number>();
  const add = (t: Term, depth: number): number => {
    const key = alphaKey(t);
    const idx = nodes.length;
    nodes.push({ index: idx, key, term: t, depth, normal: !hasRedex(t), expanded: false });
    byKey.set(key, idx);
    return idx;
  };
  add(m, 0);
  let complete = true;
  for (let q = 0; q < nodes.length; q++) {
    const node = nodes[q]!;
    if (node.normal) {
      node.expanded = true;
      continue;
    }
    if (node.depth >= maxDepth || size(node.term) > maxSize) {
      complete = false;
      continue;
    }
    let all = true;
    for (const r of redexes(node.term)) {
      const c = contractAt(node.term, r.path);
      const key = alphaKey(c.result);
      let to = byKey.get(key);
      if (to === undefined) {
        if (nodes.length >= maxNodes) {
          all = false;
          continue;
        }
        to = add(c.result, node.depth + 1);
      }
      edges.push({ from: node.index, to, redex: r.id, path: r.path, leftmostOutermost: r.leftmostOutermost });
    }
    node.expanded = all;
    if (!all) complete = false;
  }
  return { nodes, edges, complete, normalForms: nodes.filter((n) => n.normal).map((n) => n.index) };
}
