// The simplifier, `rw` and `unfold`.
//
// `simp` rewrites a term bottom-up with equations (lemmas tagged @[simp], the
// lemmas and hypotheses it is given, the equation lemmas of definitions) until
// nothing applies. Every rewrite is justified: the result comes with a proof
// `e = e'` assembled from congruence lemmas (congrArg, congrFun, congr,
// funext, implies_congr, forall_congr). Definitional steps (β, ι, unfolding a
// definition, computing with numerals) need no proof. When the goal becomes
// `True`, it is closed with `of_eq_true`.

import {
  type Expr,
  type FVar,
  exprEq,
  getAppArgs,
  getAppFn,
  hasLooseBVar,
  headBeta,
  instantiate1,
  instantiateLevelParamsExpr,
  mkApp,
  mkApps,
  mkConst,
  mkFVar,
  replaceExpr,
} from '../core/expr.ts';
import { type Level, levelEq, toNat, lparam } from '../core/level.ts';
import { LocalContext } from '../core/env.ts';
import type { Location, RwRule, STerm, SimpArg, Span, Tactic } from '../syntax/ast.ts';
import type { Elaborator } from './elaborator.ts';
import { ElabError } from './errors.ts';
import { synthInstance } from './instances.ts';
import { mkNoConfusion } from './match.ts';
import type { TacticRunner } from './tactics.ts';

// ---------------------------------------------------------------------------
// rewrite rules

interface Rule {
  name: string;
  /** the proof, with its binders opened as pattern variables */
  proof: Expr;
  /** pattern variables, in binder order; hyps are propositions to discharge */
  vars: { id: number; type: Expr; isProp: boolean; binfo: string }[];
  /** level parameters of the lemma that are pattern variables */
  levelVars: string[];
  lhs: Expr;
  rhs: Expr;
  /** how the statement becomes an equation */
  kind: 'eq' | 'iff' | 'true' | 'false';
  /** the proof proves rhs = lhs (rewriting right to left) */
  rev: boolean;
  perm: boolean;
  /** head symbol of the lhs, for indexing */
  key: string;
}

function keyOf(e: Expr): string {
  const h = getAppFn(e);
  if (h.k === 'const') return h.name;
  if (h.k === 'fvar') return `#${h.id}`;
  if (h.k === 'sort') return 'Sort';
  if (h.k === 'pi') return 'Π';
  return '*';
}

/** open the statement of `proof : ∀ xs, lhs = rhs` (or ↔, or a proposition p, or ¬p) into a rule */
export function mkRule(el: Elaborator, name: string, proof: Expr, levelVars: string[] = [], rev = false): Rule | undefined {
  return el.withSavedLctx(() => {
    let type = el.instantiate(el.inferType(proof));
    const vars: Rule['vars'] = [];
    let pf = proof;
    for (let i = 0; i < 32; i++) {
      if (type.k !== 'pi') {
        const h0 = getAppFn(type);
        // ¬p and a ≠ b are rewrite rules p = False and (a = b) = False, not hypotheses
        if (h0.k === 'const' && (h0.name === 'Not' || h0.name === 'Ne')) break;
        const w = el.whnf(type);
        if (w.k !== 'pi') break;
        type = w;
      }
      if (type.k !== 'pi') break;
      let isProp = false;
      try {
        const s = el.whnf(el.inferType(type.type));
        isProp = s.k === 'sort' && toNat(el.mctx.instantiateLevel(s.level)) === 0;
      } catch {
        isProp = false;
      }
      // pattern variables are locals that exist only while the rule is being built
      const fv = el.pushLocal(type.name, type.type, type.binfo);
      vars.push({ id: fv.id, type: type.type, isProp, binfo: type.binfo });
      pf = mkApp(pf, fv);
      type = instantiate1(type.body, fv);
    }
    const h = getAppFn(type);
    const args = getAppArgs(type);
    let lhs: Expr;
    let rhs: Expr;
    let kind: Rule['kind'];
    if (h.k === 'const' && h.name === 'Eq' && args.length === 3) {
      [, lhs, rhs] = args;
      kind = 'eq';
    } else if (h.k === 'const' && h.name === 'Iff' && args.length === 2) {
      [lhs, rhs] = args;
      kind = 'iff';
    } else if (h.k === 'const' && h.name === 'Not' && args.length === 1) {
      lhs = args[0];
      rhs = mkConst('False');
      kind = 'false';
    } else if (h.k === 'const' && h.name === 'Ne' && args.length === 3) {
      lhs = mkApps(mkConst('Eq', h.levels), args);
      rhs = mkConst('False');
      kind = 'false';
    } else {
      lhs = type;
      rhs = mkConst('True');
      kind = 'true';
    }
    if (rev) {
      if (kind !== 'eq' && kind !== 'iff') return undefined;
      [lhs, rhs] = [rhs, lhs];
    }
    const perm = kind === 'eq' && isPermutation(lhs, rhs, new Set(vars.map((v) => v.id)));
    return { name, proof: pf, vars, levelVars, lhs, rhs, kind, rev, perm, key: keyOf(lhs) };
  });
}

function isPermutation(a: Expr, b: Expr, pvs: Set<number>): boolean {
  const m = new Map<number, number>();
  const go = (x: Expr, y: Expr): boolean => {
    if (x.k === 'fvar' && pvs.has(x.id)) {
      if (y.k !== 'fvar' || !pvs.has(y.id)) return false;
      const prev = m.get(x.id);
      if (prev === undefined) {
        m.set(x.id, y.id);
        return true;
      }
      return prev === y.id;
    }
    if (x.k !== y.k) return false;
    switch (x.k) {
      case 'app':
        return go(x.fn, (y as typeof x).fn) && go(x.arg, (y as typeof x).arg);
      case 'lam':
      case 'pi':
        return go(x.type, (y as typeof x).type) && go(x.body, (y as typeof x).body);
      default:
        return exprEq(x, y);
    }
  };
  return !exprEq(a, b) && go(a, b);
}

// ---------------------------------------------------------------------------
// matching

class Matcher {
  vals = new Map<number, Expr>();
  levels = new Map<string, Level>();
  constructor(
    readonly el: Elaborator,
    readonly pvs: Set<number>,
    readonly levelVars: string[],
  ) {}

  level(p: Level, t: Level): boolean {
    if (p.k === 'param' && this.levelVars.includes(p.name)) {
      const prev = this.levels.get(p.name);
      if (!prev) {
        this.levels.set(p.name, t);
        return true;
      }
      return levelEq(prev, t);
    }
    if (p.k === 'succ' && t.k === 'succ') return this.level(p.l, t.l);
    return levelEq(p, this.el.mctx.instantiateLevel(t));
  }

  match(p: Expr, t: Expr, depth = 0): boolean {
    if (depth > 200) return false;
    if (p.k === 'fvar' && this.pvs.has(p.id)) {
      const prev = this.vals.get(p.id);
      if (prev === undefined) {
        if (t.lb > 0) return false;
        this.vals.set(p.id, t);
        return true;
      }
      if (exprEq(prev, t)) return true;
      const cp = this.el.mctx.checkpoint();
      if (this.el.isDefEq(prev, t)) return true;
      this.el.mctx.rollback(cp);
      return false;
    }
    if (p.k === 'app') {
      const pf = getAppFn(p);
      const tf = getAppFn(t);
      const pa = getAppArgs(p);
      const ta = getAppArgs(t);
      if (pf.k === 'fvar' && this.pvs.has(pf.id)) {
        // a pattern variable applied to arguments: only first-order matching
        if (ta.length < pa.length) return false;
        const k = ta.length - pa.length;
        if (!this.match(pf, mkApps(tf, ta.slice(0, k)), depth + 1)) return false;
        return pa.every((x, i) => this.match(x, ta[k + i], depth + 1));
      }
      if (pf.k === 'const' && tf.k === 'const' && pf.name === tf.name && pa.length === ta.length) {
        const snapshot = new Map(this.vals);
        if (pf.levels.every((l, i) => this.level(l, tf.levels[i])) && pa.every((x, i) => this.match(x, ta[i], depth + 1))) return true;
        this.vals = snapshot;
      }
      if (pf.k === 'fvar' && tf.k === 'fvar' && pf.id === tf.id && pa.length === ta.length) {
        const snapshot = new Map(this.vals);
        if (pa.every((x, i) => this.match(x, ta[i], depth + 1))) return true;
        this.vals = snapshot;
      }
      // Nat.succ ?n  against  t + k  (k a numeral ≥ 1): t + k = succ (t + (k - 1))
      if (pf.k === 'const' && pf.name === 'Nat.succ' && tf.k === 'const' && tf.name === 'Nat.add' && ta.length === 2) {
        const k = numeral(ta[1]);
        if (k !== undefined && k > 0) {
          const inner = k === 1 ? ta[0] : mkApps(tf, [ta[0], mkNumeral(k - 1)]);
          return this.match(pa[0], inner, depth + 1);
        }
      }
      // a constructor pattern against a term that computes to a constructor (only if the result stays readable)
      if (pf.k === 'const' && this.el.env.get(pf.name)?.kind === 'ctor' && tf.k === 'const' && this.el.env.get(tf.name)?.kind !== 'ctor' && t.lb === 0) {
        const w = whnfBounded(this.el, t);
        if (w && !exprEq(w, t) && getAppFn(w).k === 'const' && this.el.env.get((getAppFn(w) as { name: string }).name)?.kind === 'ctor' && readable(this.el, w)) return this.match(p, w, depth + 1);
      }
      return false;
    }
    if (p.k !== t.k) {
      // a constructor constant (like Nat.zero) against a term that computes to it
      if (p.k === 'const' && this.el.env.get(p.name)?.kind === 'ctor' && t.lb === 0 && t.k === 'app') {
        const w = whnfBounded(this.el, t);
        if (w && w.k === 'const') return this.match(p, w, depth + 1);
      }
      return false;
    }
    switch (p.k) {
      case 'const':
        return p.name === (t as typeof p).name && p.levels.length === (t as typeof p).levels.length && p.levels.every((l, i) => this.level(l, (t as typeof p).levels[i]));
      case 'sort':
        return this.level(p.level, (t as typeof p).level);
      case 'fvar':
        return p.id === (t as typeof p).id;
      case 'bvar':
        return p.i === (t as typeof p).i;
      case 'lam':
      case 'pi':
        return this.match(p.type, (t as typeof p).type, depth + 1) && this.match(p.body, (t as typeof p).body, depth + 1);
      case 'let':
        return exprEq(p, t);
      default:
        return exprEq(p, t);
    }
  }

  subst(e: Expr): Expr {
    // the rule's own universe parameters first: the values may mention parameters with the same names
    const l = this.levelVars.length ? instantiateLevelParamsExpr(e, this.levelVars, this.levelVars.map((n) => this.levels.get(n) ?? lparam(n))) : e;
    return replaceExpr(l, (x) => {
      if (x.k === 'fvar' && this.pvs.has(x.id)) return this.vals.get(x.id) ?? x;
      return undefined;
    });
  }
}

function numeral(e: Expr): number | undefined {
  let n = 0;
  while (e.k === 'app' && e.fn.k === 'const' && e.fn.name === 'Nat.succ') {
    n++;
    e = e.arg;
  }
  return e.k === 'const' && e.name === 'Nat.zero' ? n : undefined;
}

function mkNumeral(n: number): Expr {
  let e: Expr = mkConst('Nat.zero');
  for (let i = 0; i < n; i++) e = mkApp(mkConst('Nat.succ'), e);
  return e;
}

/** no recursor or casesOn inside: the term is fit to show to the reader */
function readable(el: Elaborator, e: Expr): boolean {
  let ok = true;
  replaceExpr(e, (x) => {
    if (!ok) return x;
    if (x.k === 'const' && (x.name.endsWith('.rec') || x.name.endsWith('.casesOn'))) ok = false;
    return undefined;
  });
  void el;
  return ok;
}

function cheapDefEq(el: Elaborator, a: Expr, b: Expr): boolean {
  const tc = el.u.makeTC(el.lctx);
  tc.setFuel(3000);
  try {
    return tc.isDefEq(el.instantiate(a), el.instantiate(b));
  } catch {
    return false;
  }
}

function whnfBounded(el: Elaborator, t: Expr): Expr | undefined {
  const tc = el.u.makeTC(el.lctx);
  tc.setFuel(5000);
  try {
    return tc.whnf(el.instantiate(t));
  } catch {
    return undefined;
  }
}

/** a total order on terms, used to orient permutative rewrites (like a + b = b + a) */
function exprLt(a: Expr, b: Expr): boolean {
  return cmp(a, b) < 0;
}

const kindOrder = ['bvar', 'fvar', 'mvar', 'sort', 'const', 'app', 'lam', 'pi', 'let'];
function cmp(a: Expr, b: Expr): number {
  if (a === b) return 0;
  if (a.k !== b.k) return kindOrder.indexOf(a.k) - kindOrder.indexOf(b.k);
  switch (a.k) {
    case 'bvar':
      return a.i - (b as typeof a).i;
    case 'fvar':
    case 'mvar':
      return a.id - (b as typeof a).id;
    case 'const':
      return a.name < (b as typeof a).name ? -1 : a.name > (b as typeof a).name ? 1 : 0;
    case 'app': {
      const c = cmp(a.fn, (b as typeof a).fn);
      return c !== 0 ? c : cmp(a.arg, (b as typeof a).arg);
    }
    case 'lam':
    case 'pi': {
      const c = cmp(a.type, (b as typeof a).type);
      return c !== 0 ? c : cmp(a.body, (b as typeof a).body);
    }
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// the simplifier

interface Result {
  expr: Expr;
  /** proof of `original = expr`; undefined when the step is definitional */
  proof?: Expr;
}

export interface SimpConfig {
  rules: Rule[];
  /** definitions to unfold (from `simp [f]`) */
  unfold: Set<string>;
  maxSteps: number;
  /** use the default simp set and the built-in procedures */
  defaults: boolean;
}

export class Simplifier {
  steps = 0;
  private index = new Map<string, Rule[]>();
  private cache = new Map<Expr, Result>();
  used = new Set<string>();

  constructor(
    readonly el: Elaborator,
    readonly cfg: SimpConfig,
    readonly span: Span,
  ) {
    for (const r of cfg.rules) {
      const list = this.index.get(r.key) ?? [];
      list.push(r);
      this.index.set(r.key, list);
    }
  }

  private E(e: Expr): STerm {
    return { k: 'elaborated', e, span: this.span };
  }

  private app(fn: string, args: Expr[], expected?: Expr): Expr {
    const s: STerm = { k: 'app', fn: { k: 'ident', name: fn, explicit: false, span: this.span }, args: args.map((a) => ({ arg: this.E(a) })), span: this.span };
    return this.el.elab(s, expected);
  }

  private trans(a: Result, b: Result): Result {
    if (!a.proof) return { expr: b.expr, proof: b.proof };
    if (!b.proof) return { expr: b.expr, proof: a.proof };
    return { expr: b.expr, proof: this.app('Eq.trans', [a.proof, b.proof]) };
  }

  simp(e: Expr): Result {
    const c = this.cache.get(e);
    if (c) return c;
    // numerals are values: never rewritten
    if (numeral(e) !== undefined) return { expr: e };
    if (++this.steps > this.cfg.maxSteps) throw new ElabError(['simp failed: maximum number of steps exceeded (a rewrite rule may be looping)'], this.span);
    const inner = this.congr(e);
    let r: Result = inner;
    const root = this.rewriteRoot(inner.expr);
    if (root) {
      const again = this.simp(root.expr);
      r = this.trans(this.trans(inner, root), again);
    }
    this.cache.set(e, r);
    return r;
  }

  // ----- congruence

  private isProof(e: Expr): boolean {
    try {
      const t = this.el.inferType(e);
      const s = this.el.whnf(this.el.inferType(t));
      return s.k === 'sort' && toNat(this.el.mctx.instantiateLevel(s.level)) === 0;
    } catch {
      return false;
    }
  }

  private isProp(t: Expr): boolean {
    try {
      const s = this.el.whnf(this.el.inferType(t));
      return s.k === 'sort' && toNat(this.el.mctx.instantiateLevel(s.level)) === 0;
    } catch {
      return false;
    }
  }

  private isTypeLike(e: Expr): boolean {
    try {
      const t = this.el.whnf(this.el.inferType(e));
      let x: Expr = t;
      while (x.k === 'pi') x = x.body;
      return x.k === 'sort';
    } catch {
      return true;
    }
  }

  private congr(e: Expr): Result {
    const el = this.el;
    switch (e.k) {
      case 'app': {
        const fn = getAppFn(e);
        const args = getAppArgs(e);
        if (fn.k === 'lam') return { expr: headBeta(e) };
        if (fn.k === 'const' && (fn.name === 'ite' || fn.name === 'dite') && args.length >= 5) {
          const r = this.simpIte(e, fn.name);
          if (r) return r;
        }
        let ft: Expr;
        try {
          ft = el.whnf(el.inferType(fn));
        } catch {
          return { expr: e };
        }
        let cur: Expr = fn;
        let proof: Expr | undefined;
        let changed = false;
        for (const a of args) {
          ft = el.whnf(ft);
          const dependent = ft.k !== 'pi' || hasLooseBVar(ft.body, 0);
          const rewritable = !dependent && ft.k === 'pi' && ft.binfo !== 'inst' && !this.isTypeLike(a) && !this.isProof(a);
          let na = a;
          let pa: Expr | undefined;
          if (rewritable) {
            const r = this.simp(a);
            na = r.expr;
            pa = r.proof;
            if (!exprEq(na, a)) changed = true;
          }
          if (proof && pa) proof = this.app('congr', [proof, pa]);
          else if (proof) proof = this.app('congrFun', [proof, a]);
          else if (pa) proof = this.app('congrArg', [cur, pa]);
          cur = mkApp(cur, na);
          ft = ft.k === 'pi' ? instantiate1(ft.body, a) : ft;
        }
        return changed ? { expr: cur, proof } : { expr: e };
      }
      case 'pi': {
        if (!this.isProp(e)) return { expr: e };
        if (!hasLooseBVar(e.body, 0) && this.isProp(e.type)) {
          const a = this.simp(e.type);
          const b = this.simp(e.body);
          if (exprEq(a.expr, e.type) && exprEq(b.expr, e.body)) return { expr: e };
          const out = mkPiNd(a.expr, b.expr);
          if (!a.proof && !b.proof) return { expr: out };
          const pa = a.proof ?? this.app('Eq.refl', [e.type]);
          const pb = b.proof ?? this.app('Eq.refl', [e.body]);
          return { expr: out, proof: this.app('implies_congr', [pa, pb]) };
        }
        if (!el.env.has('forall_congr')) return { expr: e };
        // ∀ x, p x: simplify under the binder
        return el.withSavedLctx(() => {
          const x = el.pushLocal(e.name, e.type, e.binfo);
          const body = instantiate1(e.body, x);
          const r = this.simp(body);
          if (exprEq(r.expr, body)) return { expr: e };
          const ne = el.mkBinding('pi', [x], r.expr);
          if (!r.proof) return { expr: ne };
          const fnProof = el.mkBinding('lam', [x], r.proof);
          return { expr: ne, proof: this.app('forall_congr', [fnProof]) };
        });
      }
      case 'lam': {
        if (!el.env.has('funext')) return { expr: e };
        return el.withSavedLctx(() => {
          const x = el.pushLocal(e.name, e.type, e.binfo);
          const body = instantiate1(e.body, x);
          if (this.isProof(body)) return { expr: e };
          const r = this.simp(body);
          if (exprEq(r.expr, body)) return { expr: e };
          const ne = el.mkBinding('lam', [x], r.expr);
          if (!r.proof) return { expr: ne };
          return { expr: ne, proof: this.app('funext', [el.mkBinding('lam', [x], r.proof)]) };
        });
      }
      case 'let':
        return { expr: instantiate1(e.body, e.value) };
      default:
        return { expr: e };
    }
  }

  /** if c then t else e: decide the condition if simp can, otherwise simplify the branches */
  private simpIte(e: Expr, which: string): Result | undefined {
    const args = getAppArgs(e);
    const [, c, , t, f] = args;
    const rc = this.simp(c);
    const isConst = (x: Expr, n: string) => x.k === 'const' && x.name === n;
    if (isConst(rc.expr, 'True') || isConst(rc.expr, 'False')) {
      const pos = isConst(rc.expr, 'True');
      const hc = rc.proof ? this.app(pos ? 'of_eq_true' : 'not_of_eq_false', [rc.proof]) : pos ? mkConst('True.intro') : this.el.elab({ k: 'ident', name: 'not_false', explicit: false, span: this.span });
      const lemma = which === 'ite' ? (pos ? 'if_pos' : 'if_neg') : pos ? 'dif_pos' : 'dif_neg';
      if (!this.el.env.has(lemma)) return undefined;
      const res = which === 'ite' ? (pos ? t : f) : headBeta(mkApp(pos ? t : f, hc));
      const proof = this.el.elab({ k: 'app', fn: { k: 'ident', name: lemma, explicit: false, span: this.span }, args: [{ arg: this.E(hc) }], span: this.span }, this.eqType(e, res));
      return { expr: res, proof };
    }
    return undefined;
  }

  private eqType(a: Expr, b: Expr): Expr {
    return this.app('Eq', [a, b]);
  }

  // ----- rewriting at the root

  rewriteRoot(e: Expr): Result | undefined {
    const el = this.el;
    // β
    if (e.k === 'app' && getAppFn(e).k === 'lam') return { expr: headBeta(e) };
    const h = getAppFn(e);
    if (this.cfg.defaults) {
      // ι: recursors and casesOn applied to constructors
      if (h.k === 'const') {
        const d = el.env.get(h.name);
        if (d?.kind === 'rec' || h.name.endsWith('.casesOn')) {
          const w = el.u.whnfCore(e);
          if (!exprEq(w, e) && getAppFn(w) !== h) return { expr: w };
        }
      }
      const g = this.ground(e);
      if (g) return g;
      const b = this.builtinEq(e);
      if (b) return b;
    }
    // rules
    const cands = [...(this.index.get(keyOf(e)) ?? []), ...(this.index.get('*') ?? [])];
    for (let i = cands.length - 1; i >= 0; i--) {
      const r = this.tryRule(cands[i], e);
      if (r) return r;
    }
    // unfolding
    if (h.k === 'const' && this.cfg.unfold.has(h.name)) {
      const u = this.unfold(e);
      if (u) return u;
    }
    return undefined;
  }

  private tryRule(rule: Rule, e: Expr): Result | undefined {
    const el = this.el;
    const cp = el.mctx.checkpoint();
    const m = new Matcher(el, new Set(rule.vars.map((v) => v.id)), rule.levelVars);
    if (!m.match(rule.lhs, e)) {
      el.mctx.rollback(cp);
      return undefined;
    }
    // discharge the hypotheses of conditional rules
    for (const v of rule.vars) {
      if (m.vals.has(v.id)) continue;
      const ty = m.subst(v.type);
      if (ty.lb > 0) {
        el.mctx.rollback(cp);
        return undefined;
      }
      if (!v.isProp && !this.isProp(ty)) {
        // an instance argument
        if (v.binfo === 'inst') {
          const inst = synthInstance(el, ty);
          if (inst) {
            m.vals.set(v.id, inst);
            continue;
          }
        }
        el.mctx.rollback(cp);
        return undefined;
      }
      const p = this.discharge(ty);
      if (!p) {
        el.mctx.rollback(cp);
        return undefined;
      }
      m.vals.set(v.id, p);
    }
    const lhs = m.subst(rule.lhs);
    const rhs = el.instantiate(headBetaDeep(m.subst(rule.rhs)));
    if (rule.perm && !exprLt(rhs, lhs)) {
      el.mctx.rollback(cp);
      return undefined;
    }
    let proof: Expr;
    try {
      const base = m.subst(rule.proof);
      switch (rule.kind) {
        case 'eq':
          proof = rule.rev ? this.app('Eq.symm', [base]) : base;
          break;
        case 'iff':
          proof = this.app('propext', [rule.rev ? this.app('Iff.symm', [base]) : base]);
          break;
        case 'true':
          proof = this.app('eq_true', [base]);
          break;
        case 'false':
          proof = this.app('eq_false', [base]);
          break;
      }
      // the proof must really prove lhs = rhs (types can differ up to conversion)
      const pt = el.instantiate(el.inferType(proof));
      const ptArgs = getAppArgs(pt);
      if (!(getAppFn(pt).k === 'const' && ptArgs.length === 3 && el.isDefEq(ptArgs[1], e))) {
        el.mctx.rollback(cp);
        return undefined;
      }
    } catch (err) {
      if (!(err instanceof ElabError)) throw err;
      el.mctx.rollback(cp);
      return undefined;
    }
    this.used.add(rule.name);
    return { expr: rhs, proof };
  }

  /** prove a side condition: simplify it to True, or find it among the hypotheses */
  private discharge(p: Expr): Expr | undefined {
    const el = this.el;
    for (let i = el.lctx.decls.length - 1; i >= 0; i--) {
      const d = el.lctx.decls[i];
      if (exprEq(el.instantiate(d.type), p)) return mkFVar(d.id);
    }
    if (this.steps > this.cfg.maxSteps - 50) return undefined;
    const saved = this.steps;
    try {
      const r = this.simp(p);
      if (r.expr.k === 'const' && r.expr.name === 'True') return r.proof ? this.app('of_eq_true', [r.proof]) : mkConst('True.intro');
    } catch (e) {
      if (!(e instanceof ElabError)) throw e;
      this.steps = saved;
    }
    return undefined;
  }

  private unfold(e: Expr): Result | undefined {
    const el = this.el;
    const h = getAppFn(e) as Extract<Expr, { k: 'const' }>;
    const d = el.env.get(h.name);
    if (!d || d.kind !== 'def') return undefined;
    // with equation lemmas, unfold through them
    const eqns = el.env.equations.get(h.name);
    if (eqns) {
      for (const n of eqns) {
        const r = ruleForConst(el, n);
        if (!r) continue;
        const res = this.tryRule(r, e);
        if (res) return res;
      }
      return undefined;
    }
    // δ-unfold, but only when this makes progress (smart unfolding)
    const v = instantiateLevelParamsExpr(d.value, d.levelParams, h.levels);
    let n = 0;
    let x = v;
    while (x.k === 'lam') {
      n++;
      x = x.body;
    }
    if (getAppArgs(e).length < n) return undefined;
    const unfolded = headBeta(mkApps(v, getAppArgs(e)));
    const w = el.u.whnfCore(unfolded);
    const wh = getAppFn(w);
    if (wh.k === 'const') {
      const wd = el.env.get(wh.name);
      if (wd?.kind === 'rec' || wh.name.endsWith('.casesOn')) return undefined;
    }
    return { expr: w };
  }

  /** closed arithmetic on numerals, and decidable propositions about numerals */
  private ground(e: Expr): Result | undefined {
    const el = this.el;
    if (e.fv || e.mv || e.lb > 0) return undefined;
    const h = getAppFn(e);
    if (h.k !== 'const') return undefined;
    const arith = ['Nat.add', 'Nat.mul', 'Nat.sub', 'Nat.pred', 'Nat.div', 'Nat.mod', 'Nat.pow', 'Nat.min', 'Nat.max', 'List.length', 'not', 'and', 'or'];
    const args = getAppArgs(e);
    if (arith.includes(h.name) && args.every((a) => isValue(el, a))) {
      const w = normalizeBounded(el, e);
      if (w && !exprEq(w, e) && isValue(el, w)) return { expr: w };
    }
    const rel = ['Eq', 'Nat.le', 'Nat.lt', 'Nat.ge', 'Nat.gt', 'Ne'];
    if (rel.includes(h.name) && args.slice(h.name === 'Eq' || h.name === 'Ne' ? 1 : 0).every((a) => isValue(el, a)) && el.env.has('of_decide_eq_true')) {
      const inst = synthInstance(el, mkApp(mkConst('Decidable'), e));
      if (!inst) return undefined;
      const w = normalizeBounded(el, mkApps(mkConst('Decidable.decide'), [e, inst]));
      if (!w || w.k !== 'const') return undefined;
      const one = { k: 'succ', l: { k: 'zero' } } as Level;
      const refl = (b: string) => mkApps(mkConst('Eq.refl', [one]), [mkConst('Bool'), mkConst(b)]);
      if (w.name === 'Bool.true') return { expr: mkConst('True'), proof: this.app('eq_true', [mkApps(mkConst('of_decide_eq_true'), [e, inst, refl('Bool.true')])]) };
      if (w.name === 'Bool.false' && el.env.has('of_decide_eq_false')) return { expr: mkConst('False'), proof: this.app('eq_false', [mkApps(mkConst('of_decide_eq_false'), [e, inst, refl('Bool.false')])]) };
    }
    return undefined;
  }

  /** a = a,  c₁ … = c₂ …,  c x = c y */
  private builtinEq(e: Expr): Result | undefined {
    const el = this.el;
    const h = getAppFn(e);
    if (h.k !== 'const' || h.name !== 'Eq') return undefined;
    const args = getAppArgs(e);
    if (args.length !== 3) return undefined;
    const [T, a, b] = args;
    if (exprEq(a, b)) return { expr: mkConst('True'), proof: this.app('eq_self', [a]) };
    // sides that are equal by a short computation (like n + 1 and Nat.succ n)
    if (!a.mv && !b.mv && cheapDefEq(el, a, b)) return { expr: mkConst('True'), proof: this.app('eq_true', [mkApps(mkConst('Eq.refl', getAppFn(e).k === 'const' ? (getAppFn(e) as { levels: readonly Level[] }).levels : []), [T, a])]) };
    const ca = ctorOf(el, a);
    const cb = ctorOf(el, b);
    if (!ca || !cb) return undefined;
    const Tw = el.whnf(T);
    const Ti = el.env.get((getAppFn(Tw) as { name: string }).name ?? '');
    if (!Ti || Ti.kind !== 'inductive' || Ti.numIndices > 0 || Ti.elimOnlyProp) return undefined;
    try {
      if (ca.name !== cb.name) {
        // different constructors: the equation is False
        const nc = el.withSavedLctx(() => {
          const hh = el.pushLocal('h', e);
          const body = mkNoConfusion(el, T, mkConst('False'), a, b, hh, this.span);
          return el.mkBinding('lam', [hh], body);
        });
        return { expr: mkConst('False'), proof: this.app('eq_false', [nc]) };
      }
      // same constructor: the equation holds iff the fields are equal
      if (ca.fields.length === 0) return { expr: mkConst('True'), proof: this.app('eq_true', [this.app('Eq.refl', [a])]) };
      if (!el.env.has('And.intro')) return undefined;
      const eqs = ca.fields.map((x, i) => this.app('Eq', [x, cb.fields[i]]));
      const conj = eqs.reduceRight((acc, q) => this.app('And', [q, acc]));
      const mp = el.withSavedLctx(() => {
        const hh = el.pushLocal('h', e);
        // noConfusion gives (e₁ → … → P) → P with P the conjunction
        const nc = mkNoConfusion(el, T, conj, a, b, hh, this.span);
        const k = el.withSavedLctx(() => {
          const es = eqs.map((q, i) => el.pushLocal(`e${i}`, q));
          const tuple = es.slice(0, -1).reduceRight((acc: Expr, x) => this.app('And.intro', [x, acc]), es[es.length - 1] as Expr);
          return el.mkBinding('lam', es, tuple);
        });
        return el.mkBinding('lam', [hh], mkApp(nc, k));
      });
      const mpr = el.withSavedLctx(() => {
        const hh = el.pushLocal('h', conj);
        // rebuild the equation by congruence, one field at a time
        let proj: Expr = hh;
        const fieldProofs: Expr[] = [];
        for (let i = 0; i < eqs.length; i++) {
          if (i === eqs.length - 1) fieldProofs.push(proj);
          else {
            fieldProofs.push(this.app('And.left', [proj]));
            proj = this.app('And.right', [proj]);
          }
        }
        let cur: Expr = mkApps(getAppFn(a), getAppArgs(a).slice(0, getAppArgs(a).length - ca.fields.length));
        let pf: Expr | undefined;
        ca.fields.forEach((x, i) => {
          const p = fieldProofs[i];
          pf = pf ? this.app('congr', [pf, p]) : this.app('congrArg', [cur, p]);
          cur = mkApp(cur, x);
        });
        return el.mkBinding('lam', [hh], pf!);
      });
      return { expr: conj, proof: this.app('propext', [this.app('Iff.intro', [mp, mpr])]) };
    } catch (err) {
      if (!(err instanceof ElabError)) throw err;
      return undefined;
    }
  }
}

function headBetaDeep(e: Expr): Expr {
  return replaceExpr(e, (x) => (x.k === 'app' && getAppFn(x).k === 'lam' ? headBetaDeep(headBeta(x)) : undefined));
}

function mkPiNd(a: Expr, b: Expr): Expr {
  return { k: 'pi', name: '_', binfo: 'default', type: a, body: b, lb: Math.max(a.lb, b.lb - 1, 0), fv: a.fv || b.fv, mv: a.mv || b.mv, lp: a.lp || b.lp } as Expr;
}

function ctorOf(el: Elaborator, e: Expr): { name: string; fields: Expr[] } | undefined {
  const h = getAppFn(e);
  if (h.k !== 'const') return undefined;
  const d = el.env.get(h.name);
  if (!d || d.kind !== 'ctor') return undefined;
  const args = getAppArgs(e);
  if (args.length !== d.numParams + d.numFields) return undefined;
  return { name: h.name, fields: args.slice(d.numParams) };
}

/** a closed value built from constructors (numerals, lists of numerals, booleans …) */
function isValue(el: Elaborator, e: Expr): boolean {
  if (e.fv || e.mv || e.lb > 0) return false;
  const h = getAppFn(e);
  if (h.k !== 'const') return false;
  const d = el.env.get(h.name);
  if (!d || d.kind !== 'ctor') return false;
  return getAppArgs(e).slice(d.numParams).every((a) => isValue(el, a) || isTypeArg(a));
}

function isTypeArg(e: Expr): boolean {
  return e.k === 'sort' || (e.k === 'const' && /^[A-Z]/.test(e.name));
}

function normalizeBounded(el: Elaborator, e: Expr): Expr | undefined {
  const tc = el.u.makeTC(el.lctx);
  tc.setFuel(50_000);
  try {
    return tc.normalize(e);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// building the rule set

const ruleCache = new WeakMap<object, Map<string, Rule | null>>();

export function ruleForConst(el: Elaborator, name: string, rev = false): Rule | undefined {
  let cache = ruleCache.get(el.env);
  if (!cache) {
    cache = new Map();
    ruleCache.set(el.env, cache);
  }
  const key = `${name}|${rev}`;
  if (cache.has(key)) return cache.get(key) ?? undefined;
  const d = el.env.get(name);
  let r: Rule | undefined;
  if (d) {
    const c = mkConst(name, d.levelParams.map(lparam));
    const saved = el.lctx;
    el.lctx = LocalContext.empty;
    try {
      r = mkRule(el, name, c, d.levelParams, rev);
    } catch {
      r = undefined;
    } finally {
      el.lctx = saved;
    }
  }
  cache.set(key, r ?? null);
  return r;
}

function defaultRules(el: Elaborator): Rule[] {
  const out: Rule[] = [];
  for (const n of el.env.simpLemmas) {
    const r = ruleForConst(el, n);
    if (r) out.push(r);
  }
  return out;
}

interface Collected {
  rules: Rule[];
  unfold: Set<string>;
  star: boolean;
  erased: Set<string>;
}

function collectArgs(runner: TacticRunner, g: number, args: SimpArg[], span: Span): Collected {
  const el = runner.el;
  const out: Collected = { rules: [], unfold: new Set(), star: false, erased: new Set() };
  for (const a of args) {
    if (a.k === 'star') {
      out.star = true;
      continue;
    }
    if (a.k === 'erase') {
      out.erased.add(el.resolveGlobal(a.name) ?? a.name);
      continue;
    }
    const t = a.term;
    // a global name: a lemma, or a definition to unfold
    if (t.k === 'ident' && !el.lctx.findByName(t.name)) {
      const g2 = el.resolveGlobal(t.name);
      const d = g2 ? el.env.get(g2) : undefined;
      if (d && g2) {
        if (d.kind === 'def') {
          out.unfold.add(g2);
          for (const n of el.env.equations.get(g2) ?? []) {
            const r = ruleForConst(el, n, a.rev);
            if (r) out.rules.push(r);
          }
          continue;
        }
        const r = ruleForConst(el, g2, a.rev);
        if (!r) throw new ElabError([`simp: '${g2}' is not an equation, an iff, or a proposition`], t.span);
        out.rules.push(r);
        continue;
      }
    }
    const e = runner.elabTerm(t, undefined, { allowNatural: true, span }).e;
    const r = mkRule(el, pretty(t), e, [], a.rev);
    if (!r) throw new ElabError(['simp: cannot use this term as a rewrite rule'], t.span);
    out.rules.push(r);
  }
  void g;
  return out;
}

function pretty(t: STerm): string {
  return t.k === 'ident' ? t.name : 'term';
}

function hypRules(el: Elaborator, exclude: number[] = []): Rule[] {
  const out: Rule[] = [];
  for (const d of el.lctx.decls) {
    if (exclude.includes(d.id) || d.value) continue;
    let isProp = false;
    try {
      const s = el.whnf(el.inferType(d.type));
      isProp = s.k === 'sort' && toNat(el.mctx.instantiateLevel(s.level)) === 0;
    } catch {
      isProp = false;
    }
    if (!isProp) continue;
    const r = mkRule(el, d.name, mkFVar(d.id));
    if (r && !(r.lhs.k === 'fvar' && r.vars.some((v) => v.id === (r.lhs as FVar).id))) out.push(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// tactics

type SimpTac = Extract<Tactic, { k: 'simp' }>;

export function simpTactic(runner: TacticRunner, g: number, t: SimpTac): number[] {
  const el = runner.el;
  return runner.withGoal(g, () => {
    const c = collectArgs(runner, g, t.args, t.span);
    const base = t.only ? [] : defaultRules(el).filter((r) => !c.erased.has(r.name));
    const mkCfg = (exclude: number[]): SimpConfig => ({
      rules: [...base, ...(c.star || t.all ? hypRules(el, exclude) : []), ...c.rules],
      unfold: c.unfold,
      maxSteps: 4000,
      defaults: true,
    });
    if (t.all) return simpAll(runner, g, t, mkCfg);
    return simpLocations(runner, g, t.loc, mkCfg, t.span, 'simp');
  });
}

function simpLocations(runner: TacticRunner, g: number, loc: Location, mkCfg: (exclude: number[]) => SimpConfig, span: Span, what: string): number[] {
  const el = runner.el;
  let cur = g;
  let progress = false;
  const hyps = loc.wildcard ? el.lctx.decls.filter((d) => !d.value && isPropDecl(el, d.type)).map((d) => d.name) : loc.hyps.map((h) => h.name);
  for (const hn of hyps) {
    const r = runner.withGoal(cur, () => {
      const d = el.lctx.findByName(hn);
      if (!d) throw new ElabError([`unknown hypothesis '${hn}'`], span);
      const s = new Simplifier(el, mkCfg([d.id]), span);
      const res = s.simp(el.instantiate(d.type));
      if (exprEq(res.expr, el.instantiate(d.type))) return undefined;
      if (res.expr.k === 'const' && res.expr.name === 'False') {
        const hf = res.proof ? s['app']('Eq.mp', [res.proof, mkFVar(d.id)]) : mkFVar(d.id);
        runner.assign(cur, el.elab({ k: 'app', fn: { k: 'ident', name: 'False.elim', explicit: false, span }, args: [{ arg: { k: 'elaborated', e: hf, span } }], span }, runner.type(cur)));
        return { goal: undefined };
      }
      if (res.expr.k === 'const' && res.expr.name === 'True') return { goal: runner.clearStale(cur, [d.id]) };
      const proof = res.proof ? s['app']('Eq.mp', [res.proof, mkFVar(d.id)]) : mkFVar(d.id);
      return { goal: runner.replaceHyp(cur, d.id, res.expr, proof) };
    });
    if (!r) continue;
    progress = true;
    if (r.goal === undefined) return [];
    cur = r.goal;
  }
  if (loc.goal) {
    const r = runner.withGoal(cur, () => {
      const s = new Simplifier(el, mkCfg([]), span);
      const T = runner.type(cur);
      const res = s.simp(T);
      if (res.expr.k === 'const' && res.expr.name === 'True') {
        const proof = res.proof ? s['app']('of_eq_true', [res.proof]) : mkConst('True.intro');
        runner.assign(cur, proof);
        return { closed: true as const };
      }
      if (exprEq(res.expr, T)) return undefined;
      const ng = runner.mkGoal(res.expr, runner.decl(cur).name);
      const val = res.proof ? s['app']('Eq.mpr', [res.proof, runner.goalTerm(ng)]) : runner.goalTerm(ng);
      runner.assign(cur, val);
      return { goal: ng };
    });
    if (r) {
      progress = true;
      if ('closed' in r) return [];
      cur = r.goal;
    }
  }
  if (!progress) throw new ElabError([`${what} made no progress`], span);
  return [cur];
}

function isPropDecl(el: Elaborator, t: Expr): boolean {
  try {
    const s = el.whnf(el.inferType(t));
    return s.k === 'sort' && toNat(el.mctx.instantiateLevel(s.level)) === 0;
  } catch {
    return false;
  }
}

function simpAll(runner: TacticRunner, g: number, t: SimpTac, mkCfg: (exclude: number[]) => SimpConfig): number[] {
  const el = runner.el;
  let cur = g;
  let anyProgress = false;
  for (let round = 0; round < 6; round++) {
    let progress = false;
    const names = runner.withGoal(cur, () => el.lctx.decls.filter((d) => !d.value && isPropDecl(el, d.type)).map((d) => d.name));
    for (const n of names) {
      try {
        const r = simpLocations(runner, cur, { hyps: [{ name: n, span: t.span }], wildcard: false, goal: false }, mkCfg, t.span, 'simp_all');
        if (r.length === 0) return [];
        cur = r[0];
        progress = true;
      } catch (e) {
        if (!(e instanceof ElabError)) throw e;
      }
    }
    try {
      const r = simpLocations(runner, cur, { hyps: [], wildcard: false, goal: true }, mkCfg, t.span, 'simp_all');
      if (r.length === 0) return [];
      cur = r[0];
      progress = true;
    } catch (e) {
      if (!(e instanceof ElabError)) throw e;
    }
    if (!progress) break;
    anyProgress = true;
  }
  if (!anyProgress) throw new ElabError(['simp_all made no progress'], t.span);
  return [cur];
}

export function unfoldTactic(runner: TacticRunner, g: number, t: Extract<Tactic, { k: 'unfold' }>): number[] {
  const el = runner.el;
  return runner.withGoal(g, () => {
    const unfold = new Set<string>();
    const rules: Rule[] = [];
    for (const n of t.names) {
      const full = el.resolveGlobal(n.name);
      const d = full ? el.env.get(full) : undefined;
      if (!full || !d || d.kind !== 'def') throw new ElabError([`unfold: '${n.name}' is not a definition`], n.span);
      unfold.add(full);
      for (const q of el.env.equations.get(full) ?? []) {
        const r = ruleForConst(el, q);
        if (r) rules.push(r);
      }
    }
    const mkCfg = (): SimpConfig => ({ rules, unfold: rules.length ? new Set() : new Set(), maxSteps: 2000, defaults: false });
    // without equation lemmas, unfold by δ-reduction everywhere
    if (rules.length === 0) {
      const replaceIn = (T: Expr) =>
        replaceExpr(T, (x) => {
          const h = getAppFn(x);
          if (h.k !== 'const' || !unfold.has(h.name)) return undefined;
          const d = el.env.get(h.name) as Extract<import('../core/env.ts').Decl, { kind: 'def' }>;
          return headBetaDeep(headBeta(mkApps(instantiateLevelParamsExpr(d.value, d.levelParams, h.levels), getAppArgs(x))));
        });
      let cur = g;
      if (t.loc.goal) {
        const T = runner.type(cur);
        const nt = replaceIn(T);
        if (exprEq(nt, T)) throw new ElabError([`unfold: nothing to unfold in the goal`], t.span);
        cur = runner.replaceGoal(cur, runner.decl(cur).lctx, nt);
      }
      for (const hn of t.loc.hyps) {
        cur = runner.withGoal(cur, () => {
          const d = el.lctx.findByName(hn.name);
          if (!d) throw new ElabError([`unknown hypothesis '${hn.name}'`], hn.span);
          return runner.replaceHyp(cur, d.id, replaceIn(el.instantiate(d.type)), mkFVar(d.id));
        });
      }
      return [cur];
    }
    return simpLocations(runner, g, t.loc, mkCfg, t.span, 'unfold');
  });
}

// ---------------------------------------------------------------------------
// rw

export function rewriteTarget(runner: TacticRunner, g: number, rule: RwRule, loc: Location, span: Span): { goal: number; newGoals: number[] } {
  const el = runner.el;
  return runner.withGoal(g, () => {
    // the rule: a local, a global lemma, a definition (its equations), or any term
    let eqns: string[] | undefined;
    if (rule.term.k === 'ident' && !el.lctx.findByName(rule.term.name)) {
      const full = el.resolveGlobal(rule.term.name);
      const d = full ? el.env.get(full) : undefined;
      if (d?.kind === 'def') eqns = el.env.equations.get(full!) ?? [];
    }
    const candidates: { e: Expr; levels: string[] }[] = [];
    const constOf = (n: string) => {
      const d = el.env.get(n)!;
      return { e: mkConst(n, d.levelParams.map(lparam)), levels: d.levelParams };
    };
    if (eqns) {
      if (eqns.length === 0) throw new ElabError([`rw: '${(rule.term as { name: string }).name}' has no equation lemmas; use unfold`], rule.term.span);
      for (const n of eqns) candidates.push(constOf(n));
    } else if (rule.term.k === 'ident' && !el.lctx.findByName(rule.term.name) && el.resolveGlobal(rule.term.name)) {
      candidates.push(constOf(el.resolveGlobal(rule.term.name)!));
    } else {
      candidates.push({ e: runner.elabTerm(rule.term, undefined, { allowNatural: true, span }).e, levels: [] });
    }
    let lastErr: ElabError | undefined;
    for (const cand of candidates) {
      const cp = el.mctx.checkpoint();
      try {
        return rewriteWith(runner, g, cand.e, rule.rev, loc, rule.term.span, cand.levels);
      } catch (e) {
        if (!(e instanceof ElabError)) throw e;
        el.mctx.rollback(cp);
        lastErr = e;
      }
    }
    throw lastErr!;
  });
}

function rewriteWith(runner: TacticRunner, g: number, eqProof: Expr, rev: boolean, loc: Location, span: Span, levelVars: string[] = []): { goal: number; newGoals: number[] } {
  const el = runner.el;
  const rule = mkRule(el, 'rw', eqProof, levelVars, rev);
  if (!rule || (rule.kind !== 'eq' && rule.kind !== 'iff')) {
    throw new ElabError(['rw: the rule must be an equation or an iff, but it proves\n  ', { e: el.instantiate(el.inferType(eqProof)), lctx: el.lctx }], span);
  }
  const E = (e: Expr): STerm => ({ k: 'elaborated', e, span });
  const app = (fn: string, as: Expr[]) => el.elab({ k: 'app', fn: { k: 'ident', name: fn, explicit: false, span }, args: as.map((a) => ({ arg: E(a) })), span });
  const newGoals: number[] = [];

  const rewriteIn = (T: Expr): { newT: Expr; eq: Expr } => {
    const found = findInstance(el, T, rule);
    if (!found) throw new ElabError(['rw: did not find an instance of the pattern\n  ', { e: rule.lhs, lctx: el.lctx }, '\nin\n  ', { e: T, lctx: el.lctx }], span);
    const m = found.m;
    // arguments that the match did not determine: instances are synthesized, propositions become new goals
    for (const v of rule.vars) {
      if (m.vals.has(v.id)) continue;
      const ty = m.subst(v.type);
      if (v.binfo === 'inst') {
        const inst = synthInstance(el, ty);
        if (inst) {
          m.vals.set(v.id, inst);
          continue;
        }
      }
      if (!v.isProp) throw new ElabError(['rw: could not determine the argument of type\n  ', { e: ty, lctx: el.lctx }, '\n(give it explicitly)'], span);
      const ng = runner.mkGoal(ty);
      newGoals.push(ng);
      m.vals.set(v.id, runner.goalTerm(ng));
    }
    const l = m.subst(rule.lhs);
    const r = m.subst(rule.rhs);
    let pf = m.subst(rule.proof);
    if (rule.kind === 'iff') pf = app('propext', [rule.rev ? app('Iff.symm', [pf]) : pf]);
    else if (rule.rev) pf = app('Eq.symm', [pf]);
    const motive = el.withSavedLctx(() => {
      const x = el.pushLocal('x', el.inferType(l));
      const body = replaceExpr(T, (e) => (e.lb === 0 && exprEq(e, l) ? x : undefined));
      return el.mkBinding('lam', [x], body);
    });
    try {
      el.inferType(motive);
    } catch {
      throw new ElabError(['rw: motive is not type correct (the term to rewrite appears in a position where the other side would not typecheck)'], span);
    }
    const newT = el.instantiate(headBeta(mkApp(motive, r)));
    return { newT, eq: app('congrArg', [motive, pf]) };
  };

  let cur = g;
  for (const hn of loc.hyps) {
    cur = runner.withGoal(cur, () => {
      const d = el.lctx.findByName(hn.name);
      if (!d) throw new ElabError([`unknown hypothesis '${hn.name}'`], hn.span);
      const { newT, eq } = rewriteIn(el.instantiate(d.type));
      return runner.replaceHyp(cur, d.id, newT, app('Eq.mp', [eq, mkFVar(d.id)]));
    });
  }
  if (loc.goal) {
    cur = runner.withGoal(cur, () => {
      const T = runner.type(cur);
      const { newT, eq } = rewriteIn(T);
      const ng = runner.mkGoal(newT, runner.decl(cur).name);
      runner.assign(cur, app('Eq.mpr', [eq, runner.goalTerm(ng)]));
      return ng;
    });
  }
  return { goal: cur, newGoals };
}

/** the first subterm of T (in traversal order) that matches the rule's left-hand side */
function findInstance(el: Elaborator, T: Expr, rule: Rule): { e: Expr; m: Matcher } | undefined {
  const pk = rule.key;
  const pn = getAppArgs(rule.lhs).length;
  const pvs = new Set(rule.vars.map((v) => v.id));
  let found: { e: Expr; m: Matcher } | undefined;
  const visit = (e: Expr): void => {
    if (found) return;
    if (e.lb === 0 && (pk === '*' || keyOf(e) === pk) && (pk === '*' || getAppArgs(e).length === pn)) {
      const cp = el.mctx.checkpoint();
      const m = new Matcher(el, pvs, rule.levelVars);
      if (m.match(rule.lhs, e)) {
        found = { e, m };
        return;
      }
      el.mctx.rollback(cp);
    }
    switch (e.k) {
      case 'app':
        visit(e.fn);
        visit(e.arg);
        break;
      case 'lam':
      case 'pi':
        visit(e.type);
        visit(e.body);
        break;
      case 'let':
        visit(e.type);
        visit(e.value);
        visit(e.body);
        break;
    }
  };
  visit(T);
  return found;
}
