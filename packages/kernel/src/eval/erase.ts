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
  const go = (e: Expr, prec: number): string => {
    const par = (s: string, p: number) => (prec > p ? `(${s})` : s);
    const n = numeral(e);
    if (n !== undefined) return String(n);
    switch (e.k) {
      case 'fvar':
        return names.get(e.id) ?? '?';
      case 'const': {
        const short = e.name;
        return short;
      }
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
        const head = fn.k === 'lam' ? `(${go(fn, 0)})` : go(fn, 2);
        if (args.length === 0) return head;
        return par([head, ...args.map((a) => go(a, 2))].join(' '), 1);
      }
      case 'pi':
        return '□';
      default:
        return '?';
    }
  };
  const s = go(e, 0);
  return s.length > maxLen ? s.slice(0, maxLen) + ' …' : s;
}
