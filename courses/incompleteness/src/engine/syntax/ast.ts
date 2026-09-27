// Terms and formulas of first-order logic, as typed trees with stable node identities.
//
// Every node carries an `id`. Operations that build new trees (substitution, diagonalisation,
// expansion of abbreviations) reuse unchanged subtrees — and so their ids — and give fresh ids
// to new nodes, recording where each new node came from. The interface uses the ids to link
// an occurrence in one view to the same occurrence elsewhere.

import type { Nat } from '../numbers/nat.ts';

export type NodeId = string;

let counter = 0;
/** A fresh node id. Ids are unique within a session; tests may reset the counter. */
export function freshId(prefix = 'n'): NodeId {
  return `${prefix}${++counter}`;
}
export function resetIds() {
  counter = 0;
}

/** A variable v_i (displayed x, y, z, u, w, x₀, y₀, …; see language.ts). */
export interface Var {
  k: 'var';
  id: NodeId;
  index: number;
}

/** A constant c_i. In the language of arithmetic, c_0 is 0. */
export interface Const {
  k: 'const';
  id: NodeId;
  index: number;
}

/** An application f^n_i(t_1, …, t_n) of an n-place function symbol. */
export interface App {
  k: 'app';
  id: NodeId;
  arity: number;
  index: number;
  args: Term[];
}

/**
 * The standard numeral n̄ = 0′′…′ (n primes), kept as one node so that numerals for huge
 * numbers — such as the numeral for a Gödel number — can be written down at all. It *is* the
 * term 0′′…′: equality, substitution and coding treat it as that term.
 */
export interface Numeral {
  k: 'numeral';
  id: NodeId;
  value: Nat;
  /**
   * Display: when the value is the Gödel number of an expression, the numeral is written with
   * corner quotes around that expression, ⌜E⌝, as in the book. This is TeX for the expression.
   */
  quotes?: string;
}

export type Term = Var | Const | App | Numeral;

export type Formula =
  | { k: 'bot'; id: NodeId }
  /** ⊤ — not primitive in this book; it abbreviates ¬⊥. */
  | { k: 'top'; id: NodeId }
  | { k: 'pred'; id: NodeId; arity: number; index: number; args: Term[] }
  | { k: 'eq'; id: NodeId; l: Term; r: Term }
  | { k: 'not'; id: NodeId; a: Formula }
  | { k: 'and' | 'or' | 'imp'; id: NodeId; a: Formula; b: Formula }
  /** A ↔ B — not primitive in this book; it abbreviates (A → B) ∧ (B → A). */
  | { k: 'iff'; id: NodeId; a: Formula; b: Formula }
  | { k: 'forall' | 'exists'; id: NodeId; v: Var; body: Formula }
  /**
   * A named formula of the language of arithmetic, applied to terms: e.g. Prov(t) or
   * D_diag(s, t). It stands for a definite (very long) formula `name(x_1, …, x_n)` with the
   * displayed free variables, whose bound variables are assumed distinct from every variable used
   * here. Its Gödel number is known by name only.
   */
  | { k: 'abbr'; id: NodeId; name: string; tex: string; params: number[]; args: Term[] };

export type Node = Term | Formula;
export type BinaryKind = 'and' | 'or' | 'imp' | 'iff';

// ------------------------------------------------------------------ constructors

export const v = (index: number): Var => ({ k: 'var', id: freshId('t'), index });
export const c = (index: number): Const => ({ k: 'const', id: freshId('t'), index });
export const zero = (): Const => c(0);
export const app = (arity: number, index: number, args: Term[]): App => ({ k: 'app', id: freshId('t'), arity, index, args });
export const succ = (t: Term): App => app(1, 0, [t]);
export const plus = (a: Term, b: Term): App => app(2, 0, [a, b]);
export const times = (a: Term, b: Term): App => app(2, 1, [a, b]);
export const numeral = (value: Nat, quotes?: string): Numeral => (quotes === undefined ? { k: 'numeral', id: freshId('t'), value } : { k: 'numeral', id: freshId('t'), value, quotes });

export const bot = (): Formula => ({ k: 'bot', id: freshId('f') });
export const top = (): Formula => ({ k: 'top', id: freshId('f') });
export const pred = (arity: number, index: number, args: Term[]): Formula => ({ k: 'pred', id: freshId('f'), arity, index, args });
export const less = (a: Term, b: Term): Formula => pred(2, 0, [a, b]);
export const eq = (l: Term, r: Term): Formula => ({ k: 'eq', id: freshId('f'), l, r });
export const not = (a: Formula): Formula => ({ k: 'not', id: freshId('f'), a });
export const bin = (k: BinaryKind, a: Formula, b: Formula): Formula => ({ k, id: freshId('f'), a, b });
export const and = (a: Formula, b: Formula) => bin('and', a, b);
export const or = (a: Formula, b: Formula) => bin('or', a, b);
export const imp = (a: Formula, b: Formula) => bin('imp', a, b);
export const iff = (a: Formula, b: Formula) => bin('iff', a, b);
export const forall = (x: Var, body: Formula): Formula => ({ k: 'forall', id: freshId('f'), v: x, body });
export const exists = (x: Var, body: Formula): Formula => ({ k: 'exists', id: freshId('f'), v: x, body });
export const abbr = (name: string, tex: string, params: number[], args: Term[]): Formula => ({ k: 'abbr', id: freshId('f'), name, tex, params, args });

export function isTerm(n: Node): n is Term {
  return n.k === 'var' || n.k === 'const' || n.k === 'app' || n.k === 'numeral';
}

/** Children in left-to-right order (terms and formulas). */
export function children(n: Node): Node[] {
  switch (n.k) {
    case 'var':
    case 'const':
    case 'numeral':
    case 'bot':
    case 'top':
      return [];
    case 'app':
    case 'pred':
    case 'abbr':
      return n.args;
    case 'eq':
      return [n.l, n.r];
    case 'not':
      return [n.a];
    case 'and':
    case 'or':
    case 'imp':
    case 'iff':
      return [n.a, n.b];
    case 'forall':
    case 'exists':
      return [n.v, n.body];
  }
}

/** Visits every node (pre-order) with its parent. */
export function walk(n: Node, f: (node: Node, parent: Node | null, path: number[]) => void, parent: Node | null = null, path: number[] = []) {
  f(n, parent, path);
  children(n).forEach((ch, i) => walk(ch, f, n, [...path, i]));
}

export function nodeById(root: Node, id: NodeId): Node | null {
  let found: Node | null = null;
  walk(root, (n) => {
    if (!found && n.id === id) found = n;
  });
  return found;
}

/** A structural copy with fresh ids; `origin` maps each new id to the id it was copied from. */
export function cloneFresh<T extends Node>(n: T, origin?: Map<NodeId, NodeId>): T {
  const copy = (x: Node): Node => {
    const id = freshId(isTerm(x) ? 't' : 'f');
    origin?.set(id, x.id);
    switch (x.k) {
      case 'var':
      case 'const':
      case 'numeral':
      case 'bot':
      case 'top':
        return { ...x, id };
      case 'app':
        return { ...x, id, args: x.args.map((a) => copy(a) as Term) };
      case 'pred':
      case 'abbr':
        return { ...x, id, args: x.args.map((a) => copy(a) as Term) };
      case 'eq':
        return { ...x, id, l: copy(x.l) as Term, r: copy(x.r) as Term };
      case 'not':
        return { ...x, id, a: copy(x.a) as Formula };
      case 'and':
      case 'or':
      case 'imp':
      case 'iff':
        return { ...x, id, a: copy(x.a) as Formula, b: copy(x.b) as Formula };
      case 'forall':
      case 'exists':
        return { ...x, id, v: copy(x.v) as Var, body: copy(x.body) as Formula };
    }
  };
  return copy(n) as T;
}
