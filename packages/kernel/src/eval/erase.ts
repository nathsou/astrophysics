// Erasure, shown as text: the program that actually runs once types and proofs are
// removed (the evaluator in compile.ts runs exactly this, as closures).
//
//   * binders of types and proofs disappear, and so do the corresponding arguments;
//   * numerals are shown as numbers;
//   * the recursors and casesOn of the compiled pattern matching are shown as they are.

import { type Expr, getAppArgs, getAppFn, instantiate1, mkFVar } from '../core/expr.ts';
import { toNat } from '../core/level.ts';
import { type Environment, LocalContext, freshFVarId } from '../core/env.ts';
import { TypeChecker } from '../core/typechecker.ts';

type Rel = 'data' | 'type' | 'proof';

const SHORT: Record<string, string> = { 'Bool.true': 'true', 'Bool.false': 'false', 'Option.some': 'some', 'Option.none': 'none', 'List.nil': '[]' };
const INFIX: Record<string, string> = { 'Nat.add': '+', 'Nat.mul': '*', 'Nat.sub': '-', 'List.cons': '::' };

function relevance(tc: TypeChecker, e: Expr): Rel {
  let t: Expr;
  try {
    t = tc.inferOnly(e);
  } catch {
    return 'data';
  }
  const w = tc.whnf(t);
  if (w.k === 'sort') return 'type';
  let x: Expr = w;
  while (x.k === 'pi') x = x.body;
  if (x.k === 'sort' && w.k === 'pi') return 'type';
  try {
    const s = tc.whnf(tc.inferOnly(t));
    if (s.k === 'sort' && toNat(s.level) === 0) return 'proof';
  } catch {
    /* ignore */
  }
  return 'data';
}

function numeral(e: Expr): number | undefined {
  let n = 0;
  while (e.k === 'app' && e.fn.k === 'const' && e.fn.name === 'Nat.succ') {
    n++;
    e = e.arg;
  }
  return e.k === 'const' && e.name === 'Nat.zero' ? n : undefined;
}

/** the erased form of a closed term, as text */
export function eraseToString(env: Environment, e: Expr, maxLen = 4000): string {
  const s = eraser(env)(e, 0);
  return s.length > maxLen ? s.slice(0, maxLen) + ' …' : s;
}

/**
 * The erased form of an equation lemma `∀ x⃗, f p⃗ = rhs`, as `f p⃗ = rhs` with the
 * type and proof arguments removed: how a definition by pattern matching reads once erased.
 */
export function eraseEquation(env: Environment, type: Expr): string | undefined {
  const go = eraser(env);
  return go(type, 0, true);
}

function eraser(env: Environment): (e: Expr, prec: number, eqn?: boolean) => string {
  const tc = new TypeChecker(env, LocalContext.empty, { fuel: 200_000 });
  const names = new Map<number, string>();
  const used = new Set<string>();
  const fresh = (n: string) => {
    let base = n.replace(/✝/g, '') || 'x';
    if (base === '_') base = 'x';
    let k = base;
    for (let i = 1; used.has(k); i++) k = `${base}${i}`;
    used.add(k);
    return k;
  };
  const go = (e: Expr, prec: number, eqn = false): string => {
    if (eqn) {
      // the binders of an equation lemma: named, never shown
      const saved = tc.lctx;
      try {
        while (e.k === 'pi') {
          const id = freshFVarId();
          tc.lctx = tc.lctx.push({ id, name: e.name, type: e.type });
          names.set(id, relevance(tc, mkFVar(id)) === 'data' ? fresh(e.name) : '◾');
          e = instantiate1(e.body, mkFVar(id));
        }
        const f = getAppFn(e);
        const a = getAppArgs(e);
        if (f.k !== 'const' || f.name !== 'Eq' || a.length !== 3) return '?';
        return `${go(a[1], 0)} = ${go(a[2], 0)}`;
      } finally {
        tc.lctx = saved;
      }
    }
    const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
    const n = numeral(e);
    if (n !== undefined) return String(n);
    switch (e.k) {
      case 'fvar':
        return names.get(e.id) ?? '?';
      case 'const':
        return SHORT[e.name] ?? e.name;
      case 'sort':
        return '□';
      case 'lam': {
        const binders: string[] = [];
        let body: Expr = e;
        const saved = tc.lctx;
        try {
          while (body.k === 'lam') {
            const id = freshFVarId();
            tc.lctx = tc.lctx.push({ id, name: body.name, type: body.type });
            const fv = mkFVar(id);
            const r = relevance(tc, fv);
            if (r === 'data') {
              const nm = fresh(body.name);
              names.set(id, nm);
              binders.push(nm);
            } else names.set(id, '◾');
            body = instantiate1(body.body, fv);
          }
          const b = go(body, 0);
          return binders.length ? par(`fun ${binders.join(' ')} => ${b}`, 0) : b;
        } finally {
          tc.lctx = saved;
        }
      }
      case 'let': {
        const saved = tc.lctx;
        try {
          const id = freshFVarId();
          const v = go(e.value, 0);
          tc.lctx = tc.lctx.push({ id, name: e.name, type: e.type, value: e.value });
          const nm = fresh(e.name);
          names.set(id, nm);
          return par(`let ${nm} := ${v}; ${go(instantiate1(e.body, mkFVar(id)), 0)}`, 0);
        } finally {
          tc.lctx = saved;
        }
      }
      case 'app': {
        const fn = getAppFn(e);
        const args = getAppArgs(e).filter((a) => relevance(tc, a) === 'data');
        if (fn.k === 'const' && INFIX[fn.name] && args.length === 2) return par(`${go(args[0], 2)} ${INFIX[fn.name]} ${go(args[1], 2)}`, 1);
        if (fn.k === 'const' && (fn.name === 'ite' || fn.name === 'dite') && args.length === 3) {
          return par(`if ${go(args[0], 0)} then ${go(args[1], 0)} else ${go(args[2], 0)}`, 0);
        }
        const head = fn.k === 'lam' ? `(${go(fn, 0)})` : go(fn, 3);
        if (args.length === 0) return head;
        return par([head, ...args.map((a) => go(a, 3))].join(' '), 2);
      }
      case 'pi':
        return '□';
      default:
        return '?';
    }
  };
  return go;
}
