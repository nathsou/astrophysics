/**
 * Linear temporal logic (chapter 3): formulas, their translation from Vouch properties, negation normal form, and
 * evaluation on lasso-shaped traces (a prefix followed by a cycle repeated forever), which is what every
 * counterexample to a liveness property looks like.
 */
import type * as A from '../vouch/syntax/ast';
import { printExpr } from '../vouch/syntax/printer';
import type { Value } from '../vouch/interp/values';

export type Ltl =
  | { k: 'true' }
  | { k: 'false' }
  /** An atomic proposition: a state condition, with values for the variables of enclosing quantifiers. */
  | { k: 'atom'; id: number }
  | { k: 'not'; a: Ltl }
  | { k: 'and'; a: Ltl; b: Ltl }
  | { k: 'or'; a: Ltl; b: Ltl }
  | { k: 'X'; a: Ltl }
  | { k: 'U'; a: Ltl; b: Ltl }
  | { k: 'R'; a: Ltl; b: Ltl };

export interface Atom {
  expr: A.Expr;
  /** Values of bound variables (symbol id → value) when the atom sits under a quantifier. */
  bind: Map<number, Value>;
  text: string;
}

export const T: Ltl = { k: 'true' };
export const F: Ltl = { k: 'false' };
export const not = (a: Ltl): Ltl => ({ k: 'not', a });
export const and = (a: Ltl, b: Ltl): Ltl => ({ k: 'and', a, b });
export const or = (a: Ltl, b: Ltl): Ltl => ({ k: 'or', a, b });
export const X = (a: Ltl): Ltl => ({ k: 'X', a });
export const U = (a: Ltl, b: Ltl): Ltl => ({ k: 'U', a, b });
export const R = (a: Ltl, b: Ltl): Ltl => ({ k: 'R', a, b });
export const G = (a: Ltl): Ltl => R(F, a);
export const Fev = (a: Ltl): Ltl => U(T, a);

const TEMPORAL_UNARY = new Set(['always', 'eventually', 'next']);

export function isTemporal(e: A.Expr): boolean {
  let found = false;
  const visit = (x: A.Expr) => {
    if ((x.k === 'unary' && TEMPORAL_UNARY.has(x.op)) || (x.k === 'binary' && (x.op === 'until' || x.op === '~>'))) found = true;
  };
  forEach(e, visit);
  return found;
}

function forEach(e: A.Expr, f: (e: A.Expr) => void): void {
  f(e);
  switch (e.k) {
    case 'unary':
      forEach(e.arg, f);
      break;
    case 'binary':
      forEach(e.left, f);
      forEach(e.right, f);
      break;
    case 'quant':
      forEach(e.body, f);
      break;
    case 'if':
      forEach(e.cond, f);
      forEach(e.then, f);
      forEach(e.else, f);
      break;
  }
}

/**
 * Translate a Vouch temporal expression to LTL. Non-temporal subexpressions become atoms. A quantifier whose body is
 * temporal is expanded over its (finite) domain: `forall p: Proc :: φ(p)` becomes φ(0) ∧ φ(1) ∧ ….
 */
export function fromExpr(e: A.Expr, atoms: Atom[], ctx: { bind: Map<number, Value>; domain: (b: A.Binder) => Value[]; sym: (b: A.Binder) => number }): Ltl {
  const go = (x: A.Expr, bind: Map<number, Value>): Ltl => {
    if (!isTemporal(x)) {
      if (x.k === 'bool') return x.value ? T : F;
      atoms.push({ expr: x, bind, text: printExpr(x) });
      return { k: 'atom', id: atoms.length - 1 };
    }
    switch (x.k) {
      case 'unary':
        if (x.op === 'always') return G(go(x.arg, bind));
        if (x.op === 'eventually') return Fev(go(x.arg, bind));
        if (x.op === 'next') return X(go(x.arg, bind));
        if (x.op === '!') return not(go(x.arg, bind));
        break;
      case 'binary': {
        const a = () => go(x.left, bind);
        const b = () => go(x.right, bind);
        switch (x.op) {
          case '&&':
            return and(a(), b());
          case '||':
            return or(a(), b());
          case '==>':
            return or(not(a()), b());
          case '<==':
            return or(a(), not(b()));
          case '<==>': {
            const l = a();
            const r = b();
            return and(or(not(l), r), or(not(r), l));
          }
          case 'until':
            return U(a(), b());
          case '~>':
            return G(or(not(a()), Fev(b())));
        }
        break;
      }
      case 'quant': {
        let acc: Ltl | undefined;
        const expand = (k: number, bind: Map<number, Value>) => {
          if (k === x.binders.length) {
            const f = go(x.body, bind);
            acc = acc ? (x.q === 'forall' ? and(acc, f) : or(acc, f)) : f;
            return;
          }
          const b = x.binders[k]!;
          for (const v of ctx.domain(b)) {
            const m = new Map(bind);
            m.set(ctx.sym(b), v);
            expand(k + 1, m);
          }
        };
        expand(0, bind);
        return acc ?? (x.q === 'forall' ? T : F);
      }
      case 'if': {
        const c = go(x.cond, bind);
        return or(and(c, go(x.then, bind)), and(not(c), go(x.else, bind)));
      }
    }
    throw new Error(`Cannot translate ${printExpr(x)} to LTL.`);
  };
  return go(e, ctx.bind);
}

/** Negation normal form: negations only on atoms. */
export function nnf(f: Ltl, neg = false): Ltl {
  switch (f.k) {
    case 'true':
      return neg ? F : T;
    case 'false':
      return neg ? T : F;
    case 'atom':
      return neg ? not(f) : f;
    case 'not':
      return nnf(f.a, !neg);
    case 'and':
      return neg ? or(nnf(f.a, true), nnf(f.b, true)) : and(nnf(f.a), nnf(f.b));
    case 'or':
      return neg ? and(nnf(f.a, true), nnf(f.b, true)) : or(nnf(f.a), nnf(f.b));
    case 'X':
      return X(nnf(f.a, neg));
    case 'U':
      return neg ? R(nnf(f.a, true), nnf(f.b, true)) : U(nnf(f.a), nnf(f.b));
    case 'R':
      return neg ? U(nnf(f.a, true), nnf(f.b, true)) : R(nnf(f.a), nnf(f.b));
  }
}

export function show(f: Ltl, atoms?: Atom[]): string {
  const p = (g: Ltl) => (g.k === 'atom' || g.k === 'true' || g.k === 'false' || g.k === 'not' || g.k === 'X' ? show(g, atoms) : `(${show(g, atoms)})`);
  switch (f.k) {
    case 'true':
      return 'true';
    case 'false':
      return 'false';
    case 'atom':
      return atoms ? atoms[f.id]!.text : `p${f.id}`;
    case 'not':
      return `!${p(f.a)}`;
    case 'and':
      return `${p(f.a)} && ${p(f.b)}`;
    case 'or':
      return `${p(f.a)} || ${p(f.b)}`;
    case 'X':
      return `next ${p(f.a)}`;
    case 'U':
      return f.a.k === 'true' ? `eventually ${p(f.b)}` : `${p(f.a)} until ${p(f.b)}`;
    case 'R':
      return f.a.k === 'false' ? `always ${p(f.b)}` : `${p(f.a)} release ${p(f.b)}`;
  }
}

/** A canonical string, used to identify subformulas in the tableau. */
export function id(f: Ltl): string {
  switch (f.k) {
    case 'true':
      return 'T';
    case 'false':
      return 'F';
    case 'atom':
      return `a${f.id}`;
    case 'not':
      return `!${id(f.a)}`;
    case 'X':
      return `X(${id(f.a)})`;
    default:
      return `${f.k}(${id(f.a)},${id(f.b)})`;
  }
}

/**
 * Evaluate an LTL formula at position 0 of a lasso: positions 0…n−1, after n−1 comes `loop`. `atom(i, id)` gives
 * the truth of atom `id` at position i. Until is a least fixpoint and release a greatest one, computed by
 * iterating around the lasso until nothing changes.
 */
export function evalLasso(f: Ltl, n: number, loop: number, atom: (pos: number, atomId: number) => boolean): boolean {
  return evalAll(f, n, loop, atom)[0]!;
}

export function evalAll(f: Ltl, n: number, loop: number, atom: (pos: number, atomId: number) => boolean): boolean[] {
  const next = (i: number) => (i + 1 < n ? i + 1 : loop);
  const memo = new Map<string, boolean[]>();
  const go = (g: Ltl): boolean[] => {
    const k = id(g);
    const m = memo.get(k);
    if (m) return m;
    let out: boolean[];
    switch (g.k) {
      case 'true':
        out = Array(n).fill(true);
        break;
      case 'false':
        out = Array(n).fill(false);
        break;
      case 'atom':
        out = Array.from({ length: n }, (_, i) => atom(i, g.id));
        break;
      case 'not': {
        const a = go(g.a);
        out = a.map((x) => !x);
        break;
      }
      case 'and': {
        const a = go(g.a);
        const b = go(g.b);
        out = a.map((x, i) => x && b[i]!);
        break;
      }
      case 'or': {
        const a = go(g.a);
        const b = go(g.b);
        out = a.map((x, i) => x || b[i]!);
        break;
      }
      case 'X': {
        const a = go(g.a);
        out = Array.from({ length: n }, (_, i) => a[next(i)]!);
        break;
      }
      case 'U':
      case 'R': {
        const a = go(g.a);
        const b = go(g.b);
        const least = g.k === 'U';
        out = Array(n).fill(!least);
        for (let changed = true; changed; ) {
          changed = false;
          for (let i = n - 1; i >= 0; i--) {
            const v = least ? b[i]! || (a[i]! && out[next(i)]!) : b[i]! && (a[i]! || out[next(i)]!);
            if (v !== out[i]) {
              out[i] = v;
              changed = true;
            }
          }
        }
        break;
      }
    }
    memo.set(k, out);
    return out;
  };
  return go(f);
}
