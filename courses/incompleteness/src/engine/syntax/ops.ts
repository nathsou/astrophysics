// Basic syntactic operations: free variables, identity of expressions, constants, abbreviations.

import * as A from './ast.ts';
import type { Formula, Node, NodeId, Term, Var } from './ast.ts';
import { lit, natEq, type Nat } from '../numbers/nat.ts';

/** The variables with a free occurrence in a term or formula. */
export function freeVars(n: Node, bound: Set<number> = new Set()): Set<number> {
  const out = new Set<number>();
  const go = (x: Node, b: Set<number>) => {
    if (x.k === 'var') {
      if (!b.has(x.index)) out.add(x.index);
      return;
    }
    if (x.k === 'forall' || x.k === 'exists') {
      const nb = new Set(b);
      nb.add(x.v.index);
      go(x.body, nb);
      return;
    }
    if (x.k === 'abbr') {
      for (const a of x.args) go(a, b);
      return;
    }
    for (const ch of A.children(x)) go(ch, b);
  };
  go(n, bound);
  return out;
}

export interface Occurrence {
  node: Var;
  free: boolean;
  /** For bound occurrences: the quantifier that binds it. */
  binder?: NodeId;
  /** The quantifiers (innermost last) whose scope contains the occurrence. */
  scopes: { id: NodeId; index: number }[];
}

/** Every occurrence of the variable v_index (not counting the variable right after ∀/∃). */
export function occurrences(f: Node, index: number): Occurrence[] {
  const out: Occurrence[] = [];
  const go = (x: Node, scopes: { id: NodeId; index: number }[]) => {
    if (x.k === 'var') {
      if (x.index === index) {
        const binder = [...scopes].reverse().find((s) => s.index === index);
        out.push({ node: x, free: !binder, binder: binder?.id, scopes });
      }
      return;
    }
    if (x.k === 'forall' || x.k === 'exists') {
      go(x.body, [...scopes, { id: x.id, index: x.v.index }]);
      return;
    }
    for (const ch of A.children(x)) go(ch, scopes);
  };
  go(f, []);
  return out;
}

export function isClosed(t: Term): boolean {
  return freeVars(t).size === 0;
}

export function isSentence(f: Formula): boolean {
  return freeVars(f).size === 0;
}

/** The constants c_i occurring in an expression. */
export function constants(n: Node): Set<number> {
  const out = new Set<number>();
  A.walk(n, (x) => {
    if (x.k === 'const') out.add(x.index);
  });
  return out;
}

/** If the term is a numeral (0, n̄, or s′ with s a numeral), its value. */
export function numeralValue(t: Term): Nat | null {
  if (t.k === 'numeral') return t.value;
  if (t.k === 'const' && t.index === 0) return lit(0);
  if (t.k === 'app' && t.arity === 1 && t.index === 0) {
    const v = numeralValue(t.args[0]);
    if (!v) return null;
    return v.k === 'lit' ? lit(v.v + 1n) : { k: 'add', ts: [v, lit(1)] };
  }
  return null;
}

/**
 * Syntactic identity. A numeral node is the term 0′′…′ it abbreviates, so 3̄ ≡ 0′′′ ≡ 2̄′.
 */
export function termEq(a: Term, b: Term): boolean {
  if (a.k === 'numeral' || b.k === 'numeral' || (a.k === 'const' && a.index === 0) || (b.k === 'const' && b.index === 0)) {
    const va = numeralValue(a);
    const vb = numeralValue(b);
    if (va && vb) return natEq(va, vb) === 'equal';
    if (va || vb) {
      // A numeral against a non-numeral term: equal only if the other is s′ with s ≡ predecessor.
      return false;
    }
  }
  if (a.k !== b.k) {
    // succ(t) vs numeral: covered above; otherwise different.
    return false;
  }
  switch (a.k) {
    case 'var':
      return a.index === (b as Var).index;
    case 'const':
      return a.index === (b as A.Const).index;
    case 'app': {
      const bb = b as A.App;
      return a.arity === bb.arity && a.index === bb.index && a.args.every((x, i) => termEq(x, bb.args[i]));
    }
    case 'numeral':
      return natEq(a.value, (b as A.Numeral).value) === 'equal';
  }
}

export function formulaEq(a: Formula, b: Formula): boolean {
  if (a.k !== b.k) return false;
  switch (a.k) {
    case 'bot':
    case 'top':
      return true;
    case 'eq': {
      const bb = b as typeof a;
      return termEq(a.l, bb.l) && termEq(a.r, bb.r);
    }
    case 'pred': {
      const bb = b as typeof a;
      return a.arity === bb.arity && a.index === bb.index && a.args.every((x, i) => termEq(x, bb.args[i]));
    }
    case 'abbr': {
      const bb = b as typeof a;
      return a.name === bb.name && a.args.length === bb.args.length && a.args.every((x, i) => termEq(x, bb.args[i]));
    }
    case 'not':
      return formulaEq(a.a, (b as typeof a).a);
    case 'and':
    case 'or':
    case 'imp':
    case 'iff': {
      const bb = b as typeof a;
      return formulaEq(a.a, bb.a) && formulaEq(a.b, bb.b);
    }
    case 'forall':
    case 'exists': {
      const bb = b as typeof a;
      return a.v.index === bb.v.index && formulaEq(a.body, bb.body);
    }
  }
}

export function nodeEq(a: Node, b: Node): boolean {
  if (A.isTerm(a) !== A.isTerm(b)) return false;
  return A.isTerm(a) ? termEq(a, b as Term) : formulaEq(a, b as Formula);
}

export interface Expansion {
  /** The id of the abbreviated node that was expanded. */
  from: NodeId;
  kind: 'iff' | 'top';
  note: string;
}

/**
 * Replaces the defined connectives of this book by their definitions (the book is configured
 * with ↔ and ⊤ defined: A ↔ B is (A → B) ∧ (B → A), and ⊤ is ¬⊥). Unchanged subtrees keep
 * their ids.
 */
export function expandDefined(f: Formula, expansions: Expansion[] = []): Formula {
  const go = (x: Formula): Formula => {
    switch (x.k) {
      case 'top': {
        const r = A.not(A.bot());
        expansions.push({ from: x.id, kind: 'top', note: '⊤ abbreviates ¬⊥' });
        return r;
      }
      case 'iff': {
        const a = go(x.a);
        const b = go(x.b);
        expansions.push({ from: x.id, kind: 'iff', note: 'A ↔ B abbreviates (A → B) ∧ (B → A)' });
        return A.and(A.imp(a, b), A.imp(A.cloneFresh(b), A.cloneFresh(a)));
      }
      case 'not': {
        const a = go(x.a);
        return a === x.a ? x : { ...x, a };
      }
      case 'and':
      case 'or':
      case 'imp': {
        const a = go(x.a);
        const b = go(x.b);
        return a === x.a && b === x.b ? x : { ...x, a, b };
      }
      case 'forall':
      case 'exists': {
        const body = go(x.body);
        return body === x.body ? x : { ...x, body };
      }
      default:
        return x;
    }
  };
  return go(f);
}

/** A variable index not free or bound anywhere in the given expressions. */
export function freshVarIndex(avoid: Iterable<Node>, prefer: number[] = []): number {
  const used = new Set<number>();
  for (const n of avoid) A.walk(n, (x) => {
    if (x.k === 'var') used.add(x.index);
    if (x.k === 'abbr') for (const p of x.params) used.add(p);
  });
  for (const p of prefer) if (!used.has(p)) return p;
  let i = 0;
  while (used.has(i)) i++;
  return i;
}

/** A constant index ≥ 1 (an eigenvariable a, b, c, …) not occurring in the given expressions. */
export function freshConstIndex(avoid: Iterable<Node>): number {
  const used = new Set<number>();
  for (const n of avoid) for (const c of constants(n)) used.add(c);
  let i = 1;
  while (used.has(i)) i++;
  return i;
}

export function size(n: Node): number {
  let s = 0;
  A.walk(n, () => s++);
  return s;
}
