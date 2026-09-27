// Substitution A[t/x] with a structured trace.
//
// `naive` is the book's operation: every free occurrence of x is replaced by t, whether or not t
// is free for x. When it is not, a variable of t is *captured* by a quantifier; the trace
// records each capture. `avoid` renames the capturing bound variable first (α-conversion), which
// is what one does in practice.
//
// Unchanged subtrees are shared with the input (same ids). Rebuilt ancestors keep the id of the
// node they replace, so the input and the result can be cross-highlighted. Each copy of t gets
// fresh ids, mapped back to t's nodes in `origin`.

import * as A from './ast.ts';
import type { Formula, Node, NodeId, Term } from './ast.ts';
import { freeVars, freshVarIndex, occurrences } from './ops.ts';
import { varName } from './language.ts';

export type SubstMode = 'naive' | 'avoid';

export type SubstStep =
  | { kind: 'replace'; node: NodeId; copy: NodeId; note: string }
  | { kind: 'bound'; node: NodeId; binder: NodeId; note: string }
  | { kind: 'binder-stop'; node: NodeId; note: string }
  | { kind: 'capture'; node: NodeId; binder: NodeId; variable: number; note: string }
  | { kind: 'rename'; node: NodeId; from: number; to: number; note: string };

export interface SubstResult<T extends Node = Node> {
  result: T;
  steps: SubstStep[];
  /** result node id → where it came from */
  origin: Map<NodeId, { from: NodeId; via: 'kept' | 'term' | 'renamed' }>;
  captures: { occurrence: NodeId; binder: NodeId; variable: number }[];
  renamed: { binder: NodeId; from: number; to: number }[];
  /** Whether t was free for x in the input (Definition "free for"). */
  freeFor: boolean;
  replaced: number;
}

/** Is t free for x in f? Returns the capturing binders if not. */
export function freeFor(t: Term, x: number, f: Node): { ok: boolean; hazards: { occurrence: NodeId; binder: NodeId; variable: number }[] } {
  const tv = freeVars(t);
  const hazards: { occurrence: NodeId; binder: NodeId; variable: number }[] = [];
  for (const occ of occurrences(f, x)) {
    if (!occ.free) continue;
    for (const s of occ.scopes) if (tv.has(s.index)) hazards.push({ occurrence: occ.node.id, binder: s.id, variable: s.index });
  }
  return { ok: hazards.length === 0, hazards };
}

export function substitute<T extends Node>(f: T, x: number, t: Term, mode: SubstMode = 'naive'): SubstResult<T> {
  const steps: SubstStep[] = [];
  const origin = new Map<NodeId, { from: NodeId; via: 'kept' | 'term' | 'renamed' }>();
  const captures: SubstResult['captures'] = [];
  const renamed: SubstResult['renamed'] = [];
  const tFree = freeVars(t);
  const ff = freeFor(t, x, f);
  let replaced = 0;
  const xn = varName(x);

  const keep = <N extends Node>(n: N): N => {
    A.walk(n, (m) => origin.set(m.id, { from: m.id, via: 'kept' }));
    return n;
  };

  const goTerm = (s: Term, scopes: { id: NodeId; index: number }[]): Term => {
    switch (s.k) {
      case 'var': {
        if (s.index !== x) return keep(s);
        const binder = [...scopes].reverse().find((b) => b.index === x);
        if (binder) {
          steps.push({ kind: 'bound', node: s.id, binder: binder.id, note: `this ${xn} is bound, so it stays` });
          return keep(s);
        }
        const termOrigin = new Map<NodeId, NodeId>();
        const copy = A.cloneFresh(t, termOrigin);
        for (const [n, o] of termOrigin) origin.set(n, { from: o, via: 'term' });
        replaced++;
        steps.push({ kind: 'replace', node: s.id, copy: copy.id, note: `free occurrence of ${xn}: replaced` });
        for (const b of scopes) {
          if (tFree.has(b.index)) {
            captures.push({ occurrence: s.id, binder: b.id, variable: b.index });
            steps.push({ kind: 'capture', node: s.id, binder: b.id, variable: b.index, note: `the ${varName(b.index)} of the substituted term is captured by a quantifier` });
          }
        }
        return copy;
      }
      case 'const':
      case 'numeral':
        return keep(s);
      case 'app': {
        const args = s.args.map((a) => goTerm(a, scopes));
        origin.set(s.id, { from: s.id, via: 'kept' });
        return args.every((a, i) => a === s.args[i]) ? s : { ...s, args };
      }
    }
  };

  const go = (g: Formula, scopes: { id: NodeId; index: number }[]): Formula => {
    origin.set(g.id, { from: g.id, via: 'kept' });
    switch (g.k) {
      case 'bot':
      case 'top':
        return g;
      case 'eq': {
        const l = goTerm(g.l, scopes);
        const r = goTerm(g.r, scopes);
        return l === g.l && r === g.r ? g : { ...g, l, r };
      }
      case 'pred':
      case 'abbr': {
        const args = g.args.map((a) => goTerm(a, scopes));
        return args.every((a, i) => a === g.args[i]) ? g : { ...g, args };
      }
      case 'not': {
        const a = go(g.a, scopes);
        return a === g.a ? g : { ...g, a };
      }
      case 'and':
      case 'or':
      case 'imp':
      case 'iff': {
        const a = go(g.a, scopes);
        const b = go(g.b, scopes);
        return a === g.a && b === g.b ? g : { ...g, a, b };
      }
      case 'forall':
      case 'exists': {
        if (g.v.index === x) {
          steps.push({ kind: 'binder-stop', node: g.id, note: `${xn} is bound by this quantifier: nothing inside is free` });
          return keep(g);
        }
        const xFreeInside = freeVars(g.body).has(x);
        if (mode === 'avoid' && xFreeInside && tFree.has(g.v.index)) {
          // α-rename the bound variable to a fresh one, then substitute.
          const fresh = freshVarIndex([g, t], []);
          const inner = substitute(g.body, g.v.index, A.v(fresh), 'naive');
          const nv: A.Var = { k: 'var', id: A.freshId('t'), index: fresh };
          origin.set(nv.id, { from: g.v.id, via: 'renamed' });
          renamed.push({ binder: g.id, from: g.v.index, to: fresh });
          steps.push({ kind: 'rename', node: g.id, from: g.v.index, to: fresh, note: `rename the bound ${varName(g.v.index)} to ${varName(fresh)} so that the ${varName(g.v.index)} in the term is not captured` });
          for (const [k, o] of inner.origin) if (!origin.has(k)) origin.set(k, o);
          const body = go(inner.result, [...scopes, { id: g.id, index: fresh }]);
          return { ...g, v: nv, body };
        }
        const body = go(g.body, [...scopes, { id: g.id, index: g.v.index }]);
        origin.set(g.v.id, { from: g.v.id, via: 'kept' });
        return body === g.body ? g : { ...g, body };
      }
    }
  };

  const result = (A.isTerm(f) ? goTerm(f, []) : go(f as Formula, [])) as T;
  return { result, steps, origin, captures, renamed, freeFor: ff.ok, replaced };
}

/** A[t/x] as the book defines it (no renaming). */
export function subst<T extends Node>(f: T, x: number, t: Term): T {
  return substitute(f, x, t, 'naive').result;
}
