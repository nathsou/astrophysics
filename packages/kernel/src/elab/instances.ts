// Type-class resolution.
//
// A deliberately small version of Lean's algorithm: to find an instance of a
// class application `C a₁ … aₙ`, try the local hypotheses and then the declared
// instances of C (most recent first). An instance's own instance arguments
// become subgoals, solved recursively (depth-first, with a depth bound). There
// is no tabling and no priority system; the course's classes (Decidable,
// DecidableEq, Inhabited, …) do not need them.

import { type Expr, getAppFn, instantiate1, mkApp, mkConst, mkFVar } from '../core/expr.ts';
import type { Elaborator } from './elaborator.ts';

const MAX_DEPTH = 16;

/** the class a type is an application of (after unfolding reducible definitions), if any */
export function classOf(el: Elaborator, type: Expr): string | undefined {
  let t = el.instantiate(type);
  for (let i = 0; i < 8; i++) {
    const h = getAppFn(t);
    if (h.k === 'const' && el.env.classes.has(h.name)) return h.name;
    const w = el.whnf(t);
    if (w === t) break;
    t = w;
    while (t.k === 'pi') t = t.body;
  }
  return undefined;
}

export function synthInstance(el: Elaborator, type: Expr): Expr | undefined {
  return synth(el, el.instantiate(type), 0);
}

function synth(el: Elaborator, type: Expr, depth: number): Expr | undefined {
  if (depth > MAX_DEPTH) return undefined;
  // Π-types: introduce the binders, as in `DecidableEq α := (a b : α) → Decidable (a = b)`
  let t = type;
  let head = getAppFn(t);
  if (!(head.k === 'const' && el.env.classes.has(head.name))) {
    t = el.whnf(t);
    head = getAppFn(t);
  }
  if (t.k === 'pi') {
    return el.withSavedLctx(() => {
      const fv = el.pushLocal(t.k === 'pi' ? t.name : 'x', (t as Extract<Expr, { k: 'pi' }>).type, 'default');
      const body = synth(el, instantiate1((t as Extract<Expr, { k: 'pi' }>).body, fv), depth + 1);
      return body === undefined ? undefined : el.mkBinding('lam', [fv], body);
    });
  }
  if (head.k !== 'const' || !el.env.classes.has(head.name)) return undefined;
  const cls = head.name;
  // local instances (hypotheses whose type is an application of the class)
  for (let i = el.lctx.decls.length - 1; i >= 0; i--) {
    const d = el.lctx.decls[i];
    if (classOf(el, d.type) !== cls) continue;
    const r = tryInstance(el, mkFVar(d.id), d.type, t, depth);
    if (r) return r;
  }
  const insts = el.env.instances.get(cls) ?? [];
  for (let i = insts.length - 1; i >= 0; i--) {
    const d = el.env.get(insts[i]);
    if (!d) continue;
    const c = mkConst(d.name, d.levelParams.map(() => el.mctx.newLevel()));
    const r = tryInstance(el, c, el.inferType(c), t, depth);
    if (r) return r;
  }
  return undefined;
}

function tryInstance(el: Elaborator, inst: Expr, instType: Expr, goal: Expr, depth: number): Expr | undefined {
  const cp = el.mctx.checkpoint();
  let e = inst;
  let it = instType;
  const subgoals: { m: Expr; type: Expr }[] = [];
  for (let guard = 0; guard < 64; guard++) {
    const gh = getAppFn(el.instantiate(it));
    if (gh.k === 'const' && el.env.classes.has(gh.name)) break;
    const w = el.whnf(it);
    if (w.k !== 'pi') break;
    const m = el.newMVar(w.type, 'natural', { what: 'instance argument' });
    if (w.binfo === 'inst') subgoals.push({ m, type: w.type });
    e = mkApp(e, m);
    it = instantiate1(w.body, m);
  }
  if (!el.isDefEq(it, goal)) {
    el.mctx.rollback(cp);
    return undefined;
  }
  for (const g of subgoals) {
    if (el.mctx.isAssigned((getAppFn(g.m) as { id: number }).id)) continue;
    const r = synth(el, el.instantiate(g.type), depth + 1);
    if (r === undefined || !el.isDefEq(g.m, r)) {
      el.mctx.rollback(cp);
      return undefined;
    }
  }
  const out = el.instantiate(e);
  if (el.mctx.collectMVars(out).size > 0) {
    el.mctx.rollback(cp);
    return undefined;
  }
  return out;
}
