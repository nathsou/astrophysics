// `calc` chains and the `h ▸ e` rewriting notation.

import { type Expr, getAppArgs, getAppFn, mkApps, exprEq, replaceExpr } from '../core/expr.ts';
import type { STerm, Span } from '../syntax/ast.ts';
import type { Elaborator } from './elaborator.ts';

interface Rel {
  /** head constant of the relation (Eq, Iff, Nat.le, Nat.lt) */
  name: string;
  /** the relation applied to everything but its last two arguments */
  fn: Expr;
  lhs: Expr;
  rhs: Expr;
}

function relOf(el: Elaborator, t: Expr, span: Span): Rel {
  const e = el.instantiate(t);
  const h = getAppFn(e);
  const args = getAppArgs(e);
  if (h.k !== 'const' || args.length < 2) el.err(span, 'invalid calc step: expected a relation `a R b`, got\n  ', el.term(e));
  return { name: h.name, fn: mkApps(h, args.slice(0, -2)), lhs: args[args.length - 2], rhs: args[args.length - 1] };
}

/** a = b and b R c give a R c (and symmetrically); otherwise use a transitivity lemma */
function trans(el: Elaborator, r1: Rel, p1: Expr, r2: Rel, p2: Expr, span: Span): { rel: Rel; proof: Expr } {
  const el_ = (e: Expr): STerm => ({ k: 'elaborated', e, span });
  const app = (fn: string, args: Expr[]): Expr => el.elab({ k: 'app', fn: { k: 'ident', name: fn, explicit: false, span }, args: args.map((a) => ({ arg: el_(a) })), span });
  if (r1.name === 'Eq' && r2.name === 'Eq') {
    return { rel: { ...r1, rhs: r2.rhs }, proof: app('Eq.trans', [p1, p2]) };
  }
  if (r1.name === 'Eq') {
    // a = b, b R c ⊢ a R c   by rewriting b ↦ a in the second proof
    const target = mkApps(r2.fn, [r1.lhs, r2.rhs]);
    return { rel: { ...r2, lhs: r1.lhs }, proof: rewriteTo(el, app('Eq.symm', [p1]), p2, target, span) };
  }
  if (r2.name === 'Eq') {
    const target = mkApps(r1.fn, [r1.lhs, r2.rhs]);
    return { rel: { ...r1, rhs: r2.rhs }, proof: rewriteTo(el, p2, p1, target, span) };
  }
  const table: Record<string, string> = {
    'Iff,Iff': 'Iff.trans',
    'Nat.le,Nat.le': 'Nat.le_trans',
    'Nat.lt,Nat.le': 'Nat.lt_of_lt_of_le',
    'Nat.le,Nat.lt': 'Nat.lt_of_le_of_lt',
    'Nat.lt,Nat.lt': 'Nat.lt_trans',
  };
  const lemma = table[`${r1.name},${r2.name}`];
  if (!lemma || !el.env.has(lemma)) {
    el.err(span, `invalid calc step: don't know how to chain a '${r1.name}' step with a '${r2.name}' step`);
  }
  const res = r1.name === 'Nat.lt' || r2.name === 'Nat.lt' ? (r1.name === 'Nat.lt' ? r1 : r2) : r1;
  return { rel: { ...res, lhs: r1.lhs, rhs: r2.rhs, fn: res.fn }, proof: app(lemma, [p1, p2]) };
}

/**
 * Given `h : a = b` and `p : T` where T mentions a, produce a proof of `target`
 * (T with a replaced by b), using Eq.mpr with an explicit motive.
 */
export function rewriteTo(el: Elaborator, h: Expr, p: Expr, target: Expr, span: Span): Expr {
  // h : a = b,  p : T[a],  target = T[b]
  const hT = el.instantiate(el.whnf(el.inferType(h)));
  const b = el.instantiate(getAppArgs(hT)[2]);
  const tgt = el.instantiate(target);
  const motive = el.withSavedLctx(() => {
    const x = el.pushLocal('x', el.inferType(b));
    const body = replaceExpr(tgt, (e) => (exprEq(e, b) ? x : undefined));
    return el.mkBinding('lam', [x], body);
  });
  const E = (e: Expr): STerm => ({ k: 'elaborated', e, span });
  const app = (fn: string, args: STerm[]): STerm => ({ k: 'app', fn: { k: 'ident', name: fn, explicit: false, span }, args: args.map((arg) => ({ arg })), span });
  return el.elab(app('Eq.mpr', [app('congrArg', [E(motive), app('Eq.symm', [E(h)])]), E(p)]), tgt);
}

export function elabCalc(el: Elaborator, s: Extract<STerm, { k: 'calc' }>, expected: Expr | undefined): Expr {
  let acc: { rel: Rel; proof: Expr } | undefined;
  for (const step of s.steps) {
    const relE = el.elabType(step.rel).e;
    el.synthesizePending(false);
    const rel = relOf(el, relE, step.rel.span);
    if (acc && !el.isDefEq(rel.lhs, acc.rel.rhs)) {
      el.err(step.rel.span, 'invalid calc step: the left-hand side\n  ', el.term(rel.lhs), '\nshould be the previous right-hand side\n  ', el.term(acc.rel.rhs));
    }
    const proof = el.elab(step.proof, el.instantiate(relE));
    const cur = { rel: relOf(el, el.instantiate(relE), step.rel.span), proof };
    acc = acc ? trans(el, acc.rel, acc.proof, cur.rel, cur.proof, step.span) : cur;
  }
  const type = mkApps(acc!.rel.fn, [acc!.rel.lhs, acc!.rel.rhs]);
  return el.ensureHasType(acc!.proof, type, expected, s.span);
}

/** `h ▸ e`: rewrite the type of e with h : a = b (in either direction) to match the expected type */
export function elabSubst(el: Elaborator, s: Extract<STerm, { k: 'subst' }>, expected: Expr | undefined): Expr {
  const h = el.elab(s.eq);
  el.synthesizePending(false);
  const hT = el.instantiate(el.whnf(el.inferType(h, s.eq.span)));
  const hf = getAppFn(hT);
  if (hf.k !== 'const' || hf.name !== 'Eq') el.err(s.eq.span, 'invalid ▸: the left argument must be a proof of an equation, but it proves\n  ', el.term(hT));
  const [, a, b] = getAppArgs(hT);
  const span = s.span;
  const symm = (): Expr => el.elab({ k: 'app', fn: { k: 'ident', name: 'Eq.symm', explicit: false, span }, args: [{ arg: { k: 'elaborated', e: h, span } }], span });
  if (expected) {
    const T = el.instantiate(expected);
    const occurs = (t: Expr, x: Expr) => {
      let f = false;
      replaceExpr(t, (e) => {
        if (exprEq(e, x)) f = true;
        return f ? e : undefined;
      });
      return f;
    };
    // T mentions b: the argument must have type T[b := a]
    for (const [from, to, eq] of [
      [b, a, () => h],
      [a, b, symm],
    ] as const) {
      if (!occurs(T, el.instantiate(from))) continue;
      const src = replaceExpr(T, (e) => (exprEq(e, el.instantiate(from)) ? el.instantiate(to) : undefined));
      const cp = el.mctx.checkpoint();
      try {
        const e = el.elab(s.term, src);
        return rewriteTo(el, eq(), e, T, span);
      } catch (err) {
        el.mctx.rollback(cp);
        if (from === a) throw err;
      }
    }
    el.err(span, 'invalid ▸: the expected type\n  ', el.term(T), '\nmentions neither side of the equation\n  ', el.term(hT));
  }
  // no expected type: rewrite a into b in the type of e
  const e = el.elab(s.term);
  const E = el.instantiate(el.inferType(e));
  const target = replaceExpr(E, (x) => (exprEq(x, el.instantiate(a)) ? el.instantiate(b) : undefined));
  return rewriteTo(el, h, e, target, span);
}

