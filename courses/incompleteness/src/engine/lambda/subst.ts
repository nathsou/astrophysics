// Substitution M[N/x] in the lambda calculus, with a structured trace.
//
// The book (section "Reduction of Lambda Terms"): "we can use M[N/x] to denote the result of
// substituting N for x in M, after renaming any bound variables of M that would interfere with
// the free variables of N after the substitution." `substitute` does exactly that: at a binder λy
// with y ∈ FV(N) and x free in the body, it first renames y to a fresh y′ (α-conversion). The
// trace says, node by node, what happened. `naiveSubstitute` replaces blindly and records every
// capture, to show why renaming is needed.
//
// Ids: unchanged subtrees are shared with M (same ids, absent from `origin`). Rebuilt ancestors
// keep the id of the node they replace (`via: 'rebuilt'`, label dropped). Each copy of N gets
// fresh ids, mapped back to N's nodes (`via: 'term'`). Occurrences of a renamed bound variable
// keep their ids (`via: 'renamed'`).

import type { Abs, NodeId, Path, Term } from './term.ts';
import { allNames, cloneFresh, freeOccurrences, freeVars, freshName, isFree, nodeById, pathOf, VAR_NAME, withLabel } from './term.ts';

export type SubstStep =
  /** A free occurrence of x: replaced by a copy of N (whose root is `copy`). */
  | { kind: 'replace'; node: NodeId; path: Path; copy: NodeId; note: string }
  /** λx…: x is bound here, so nothing below is a free occurrence of x. */
  | { kind: 'binder-stop'; node: NodeId; path: Path; note: string }
  /** λy… with y ∈ FV(N) and x free in the body: y is renamed first. */
  | { kind: 'rename'; node: NodeId; path: Path; from: string; to: string; note: string }
  /** Naive substitution only: the copy of N placed at `node` has its free `variable` captured by `binder`. */
  | { kind: 'capture'; node: NodeId; path: Path; binder: NodeId; variable: string; note: string };

export type OriginVia = 'rebuilt' | 'term' | 'renamed';

export interface Capture {
  /** The replaced occurrence of x (id in M). */
  occurrence: NodeId;
  /** The binder in M that captures. */
  binder: NodeId;
  /** The free variable of N that gets captured. */
  variable: string;
}

export interface SubstResult {
  result: Term;
  steps: SubstStep[];
  /** New or rebuilt node id in the result → the id it came from. Ids not listed are unchanged nodes of M. */
  origin: Map<NodeId, { from: NodeId; via: OriginVia }>;
  /** Binders renamed to avoid capture (ids of abstraction nodes in M; they keep their ids). */
  renamed: { binder: NodeId; from: string; to: string }[];
  /** Captures that happened (naive substitution only; always empty for `substitute`). */
  captures: Capture[];
  /** Number of free occurrences of x replaced. */
  replaced: number;
  /** Whether N was free for x in M (no renaming or capture was needed). */
  freeFor: boolean;
}

/** Is N free for x in M? If not, lists the (occurrence, binder, variable) hazards. */
export function freeFor(n: Term, x: string, m: Term): { ok: boolean; hazards: Capture[] } {
  const nv = freeVars(n);
  const hazards: Capture[] = [];
  for (const occ of freeOccurrences(m, x)) for (const s of occ.scopes) if (nv.has(s.param)) hazards.push({ occurrence: occ.node, binder: s.id, variable: s.param });
  return { ok: hazards.length === 0, hazards };
}

/** Renames free occurrences of y to z in M, assuming z does not occur in M at all (so nothing can be captured). */
function renameFreeUnsafe(m: Term, y: string, z: string, origin: Map<NodeId, { from: NodeId; via: OriginVia }>): Term {
  if (!isFree(y, m)) return m;
  const bare = withLabel(m, undefined);
  switch (bare.k) {
    case 'var':
      origin.set(bare.id, { from: bare.id, via: 'renamed' });
      return { ...bare, name: z };
    case 'app':
      origin.set(bare.id, { from: bare.id, via: 'rebuilt' });
      return { ...bare, fn: renameFreeUnsafe(bare.fn, y, z, origin), arg: renameFreeUnsafe(bare.arg, y, z, origin) };
    case 'abs':
      origin.set(bare.id, { from: bare.id, via: 'rebuilt' });
      return { ...bare, body: renameFreeUnsafe(bare.body, y, z, origin) };
  }
}

function run(m: Term, x: string, n: Term, avoidCapture: boolean): SubstResult {
  const steps: SubstStep[] = [];
  const origin = new Map<NodeId, { from: NodeId; via: OriginVia }>();
  const captures: Capture[] = [];
  const renamed: SubstResult['renamed'] = [];
  const nFree = freeVars(n);
  const ff = freeFor(n, x, m);
  let replaced = 0;

  const go = (s: Term, path: Path, scopes: { id: NodeId; param: string }[]): Term => {
    if (!isFree(x, s)) {
      if (s.k === 'abs' && s.param === x && isFree(x, s.body)) steps.push({ kind: 'binder-stop', node: s.id, path, note: `λ${x} binds ${x} here: the ${x}’s inside are not free, so they stay` });
      return s;
    }
    switch (s.k) {
      case 'var': {
        const map = new Map<NodeId, NodeId>();
        const traced = cloneFresh(n, map);
        for (const [k, o] of map) origin.set(k, { from: o, via: 'term' });
        replaced++;
        steps.push({ kind: 'replace', node: s.id, path, copy: traced.id, note: `free occurrence of ${x}: replaced by a copy of the substituted term` });
        for (const b of scopes) {
          if (nFree.has(b.param)) {
            captures.push({ occurrence: s.id, binder: b.id, variable: b.param });
            steps.push({ kind: 'capture', node: s.id, path, binder: b.id, variable: b.param, note: `the free ${b.param} of the substituted term is captured by λ${b.param}` });
          }
        }
        return traced;
      }
      case 'app': {
        origin.set(s.id, { from: s.id, via: 'rebuilt' });
        const fn = go(s.fn, [...path, 0], scopes);
        const arg = go(s.arg, [...path, 1], scopes);
        return { ...withLabel(s, undefined), fn, arg };
      }
      case 'abs': {
        // x is free in s, so s.param !== x and x is free in the body.
        origin.set(s.id, { from: s.id, via: 'rebuilt' });
        if (avoidCapture && nFree.has(s.param)) {
          const avoid = new Set([...allNames(s.body), ...allNames(n), x, s.param]);
          const fresh = freshName(s.param, avoid);
          renamed.push({ binder: s.id, from: s.param, to: fresh });
          steps.push({
            kind: 'rename',
            node: s.id,
            path,
            from: s.param,
            to: fresh,
            note: `${s.param} is free in the substituted term and ${x} is free in the body of λ${s.param}: rename the bound ${s.param} to ${fresh} first`,
          });
          const body0 = renameFreeUnsafe(s.body, s.param, fresh, origin);
          const body = go(body0, [...path, 0], [...scopes, { id: s.id, param: fresh }]);
          return { ...withLabel(s, undefined), param: fresh, body };
        }
        const body = go(s.body, [...path, 0], [...scopes, { id: s.id, param: s.param }]);
        return { ...withLabel(s, undefined), body };
      }
    }
  };

  const result = go(m, [], []);
  return { result, steps, origin, captures, renamed, replaced, freeFor: ff.ok };
}

/** M[N/x], renaming bound variables of M where they would capture free variables of N. */
export function substitute(m: Term, x: string, n: Term): SubstResult {
  return run(m, x, n, true);
}

/**
 * Naive replacement of every free occurrence of x in M by N, without renaming. When N is not
 * free for x in M this is *wrong* (variables of N get captured); `captures` lists each capture.
 */
export function naiveSubstitute(m: Term, x: string, n: Term): SubstResult {
  return run(m, x, n, false);
}

/** The term M[N/x] (capture-avoiding). */
export function subst(m: Term, x: string, n: Term): Term {
  return run(m, x, n, true).result;
}

// ------------------------------------------------------------------ α-renaming

export type AlphaRenameResult =
  | { ok: true; result: Term; binder: NodeId; from: string; to: string; occurrences: NodeId[] }
  | { ok: false; error: string; conflicts: NodeId[] };

/**
 * Renames the variable bound by the abstraction `binderId` to `newName`: λy.B becomes λz.B[z/y].
 * This is an α-conversion only if z is not free in B and no free occurrence of y in B lies under
 * a λz (which would capture the new z); otherwise an error explains why.
 */
export function alphaRename(m: Term, binderId: NodeId, newName: string): AlphaRenameResult {
  const path = pathOf(m, binderId);
  const node = path === null ? null : nodeById(m, binderId);
  if (path === null || node === null) return { ok: false, error: 'no such node', conflicts: [] };
  if (node.k !== 'abs') return { ok: false, error: 'that node is not a λ-abstraction', conflicts: [] };
  if (!VAR_NAME.test(newName)) return { ok: false, error: `“${newName}” is not a variable name (a lowercase letter followed by letters, digits, _ or ′)`, conflicts: [] };
  const abs: Abs = node;
  const y = abs.param;
  const occs = freeOccurrences(abs.body, y);
  if (newName === y) return { ok: true, result: m, binder: binderId, from: y, to: y, occurrences: [] };
  const zFree = freeOccurrences(abs.body, newName);
  if (zFree.length > 0) {
    return {
      ok: false,
      error: `${newName} occurs free in the body of λ${y}; after renaming it would be bound by λ${newName}`,
      conflicts: zFree.map((o) => o.node),
    };
  }
  const captured = occs.filter((o) => o.scopes.some((s) => s.param === newName));
  if (captured.length > 0) {
    return {
      ok: false,
      error: `an occurrence of ${y} lies inside a λ${newName}; renaming it to ${newName} would be captured by that λ${newName}`,
      conflicts: captured.flatMap((o) => [o.node, ...o.scopes.filter((s) => s.param === newName).map((s) => s.id)]),
    };
  }
  // Rename occurrences inside the body (all free occurrences of y are safe now).
  const occSet = new Set(occs.map((o) => o.node));
  const ren = (s: Term): Term => {
    if (!isFree(y, s)) return s;
    switch (s.k) {
      case 'var':
        return occSet.has(s.id) ? { ...withLabel(s, undefined), name: newName } : s;
      case 'app':
        return { ...withLabel(s, undefined), fn: ren(s.fn), arg: ren(s.arg) };
      case 'abs':
        return { ...withLabel(s, undefined), body: ren(s.body) };
    }
  };
  // The renamed abstraction and its ancestors are α-equivalent to what they were: keep labels.
  const renamedAbs: Abs = { ...abs, param: newName, body: ren(abs.body) };
  const rebuild = (s: Term, p: Path): Term => {
    if (p.length === 0) return renamedAbs;
    const [i, ...rest] = p;
    if (s.k === 'app') return i === 0 ? { ...s, fn: rebuild(s.fn, rest) } : { ...s, arg: rebuild(s.arg, rest) };
    if (s.k === 'abs') return { ...s, body: rebuild(s.body, rest) };
    return s;
  };
  return { ok: true, result: rebuild(m, path), binder: binderId, from: y, to: newName, occurrences: occs.map((o) => o.node) };
}
