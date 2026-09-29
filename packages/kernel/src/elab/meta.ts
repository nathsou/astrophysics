// Metavariables and unification.
//
// The elaborator turns surface syntax with omitted information (implicit
// arguments, `_`, unannotated binders, universe levels) into fully explicit
// core terms. Omitted pieces become metavariables, solved by unification.
//
// We use "contextual" metavariables in the style of Kovács' elaboration-zoo:
// a hole created in local context x₁ … xₙ is a closed metavariable
//     ?m : Π (x₁ : A₁) … (xₙ : Aₙ), T
// applied to x₁ … xₙ. Equations `?m a₁ … aₙ =?= t` with distinct local
// variables aᵢ are Miller patterns and have the most general solution
//     ?m := λ a₁ … aₙ, t.

import {
  type Expr,
  abstractFVars,
  collectFVars,
  exprEq,
  getAppArgs,
  getAppFn,
  headBeta,
  instantiate1,
  mkApps,
  mkBinder,
  mkConst,
  mkFVar,
  mkLam,
  mkMVar,
  mkPi,
  mkSort,
  replaceExpr,
} from '../core/expr.ts';
import { type Level, hasLevelMVar, levelEq, levelStructEq, lmax, lmvar, lsucc, lzero, replaceLevel, toNat, isNeverZero } from '../core/level.ts';
import { Environment, LocalContext, type LocalDecl, freshFVarId } from '../core/env.ts';
import { TypeChecker, structureProjections } from '../core/typechecker.ts';
import type { Span } from '../syntax/ast.ts';

export type MVarKind = 'natural' | 'synthetic' | 'implicit' | 'postponed' | 'instance';

export interface MVarDecl {
  id: number;
  /** closed type Π ctx, T */
  type: Expr;
  /** creation context and the type in that context (for goal display) */
  lctx: LocalContext;
  localType: Expr;
  ctx: number[];
  kind: MVarKind;
  name?: string;
  span?: Span;
  value?: Expr;
  /** human description for error messages, e.g. "implicit argument α of id" */
  what?: string;
}

let mvarCounter = 1;

export class MetaCtx {
  readonly mvars = new Map<number, MVarDecl>();
  readonly levels = new Map<number, Level | undefined>();
  private trail: ({ k: 'e'; id: number } | { k: 'l'; id: number })[] = [];
  /** postponed universe constraints */
  pendingLevels: [Level, Level][] = [];

  checkpoint(): number {
    return this.trail.length;
  }

  rollback(cp: number): void {
    while (this.trail.length > cp) {
      const t = this.trail.pop()!;
      if (t.k === 'e') this.mvars.get(t.id)!.value = undefined;
      else this.levels.set(t.id, undefined);
    }
  }

  newLevel(): Level {
    const id = mvarCounter++;
    this.levels.set(id, undefined);
    return lmvar(id);
  }

  assignLevel(id: number, l: Level): void {
    this.levels.set(id, l);
    this.trail.push({ k: 'l', id });
  }

  assign(id: number, v: Expr): void {
    this.mvars.get(id)!.value = v;
    this.trail.push({ k: 'e', id });
  }

  isAssigned(id: number): boolean {
    return this.mvars.get(id)?.value !== undefined;
  }

  /** create a metavariable of type `type` in `lctx`, returning `?m x₁ … xₙ` */
  newMVar(lctx: LocalContext, type: Expr, kind: MVarKind, extra: Partial<MVarDecl> = {}): Expr {
    const id = mvarCounter++;
    const ctx = lctx.decls.map((d) => d.id);
    let closed = abstractFVars(type, ctx);
    for (let i = lctx.decls.length - 1; i >= 0; i--) {
      const d = lctx.decls[i];
      closed = mkPi(d.name, abstractFVars(d.type, ctx.slice(0, i)), closed);
    }
    this.mvars.set(id, { id, type: closed, lctx, localType: type, ctx, kind, ...extra });
    return mkApps(mkMVar(id), ctx.map(mkFVar));
  }

  get(id: number): MVarDecl | undefined {
    return this.mvars.get(id);
  }

  /** number of metavariables created so far (for `createdSince`) */
  get count(): number {
    return this.mvars.size;
  }

  /** ids of the metavariables created after `count` was `n` */
  createdSince(n: number): number[] {
    return [...this.mvars.keys()].slice(n);
  }

  instantiateLevel(l: Level): Level {
    if (!hasLevelMVar(l)) return l;
    return replaceLevel(l, (x) => {
      if (x.k === 'mvar') {
        const v = this.levels.get(x.id);
        return v ? this.instantiateLevel(v) : x;
      }
      return undefined;
    });
  }

  /** replace all assigned metavariables (and β-reduce the resulting redexes) */
  instantiate(e: Expr): Expr {
    if (!e.mv) return e;
    return replaceExpr(e, (x) => {
      if (!x.mv) return x;
      if (x.k === 'sort') return mkSort(this.instantiateLevel(x.level));
      if (x.k === 'const') return mkConst(x.name, x.levels.map((l) => this.instantiateLevel(l)));
      if (x.k === 'mvar') {
        const v = this.mvars.get(x.id)?.value;
        return v ? this.instantiate(v) : x;
      }
      if (x.k === 'app') {
        const fn = getAppFn(x);
        if (fn.k === 'mvar') {
          const v = this.mvars.get(fn.id)?.value;
          if (v) {
            const args = getAppArgs(x).map((a) => this.instantiate(a));
            return this.instantiate(headBeta(mkApps(v, args)));
          }
        }
      }
      return undefined;
    });
  }

  /** unassigned metavariables occurring in `e` */
  collectMVars(e: Expr, out = new Set<number>()): Set<number> {
    const go = (x: Expr) => {
      if (!x.mv) return;
      replaceExpr(x, (y) => {
        if (!y.mv) return y;
        if (y.k === 'mvar' && !this.isAssigned(y.id)) out.add(y.id);
        return undefined;
      });
    };
    go(this.instantiate(e));
    return out;
  }
}

// ---------------------------------------------------------------------------

export class Unifier {
  tc: TypeChecker;
  constructor(
    readonly env: Environment,
    readonly mctx: MetaCtx,
  ) {
    this.tc = this.makeTC(LocalContext.empty);
  }

  makeTC(lctx: LocalContext): TypeChecker {
    return new TypeChecker(this.env, lctx, {
      fuel: 400_000,
      meta: {
        mvarType: (id) => this.mctx.get(id)?.type,
        mvarValue: (id) => this.mctx.get(id)?.value,
      },
    });
  }

  get lctx(): LocalContext {
    return this.tc.lctx;
  }
  set lctx(l: LocalContext) {
    this.tc.lctx = l;
  }

  whnf(e: Expr): Expr {
    return this.instHead(this.tc.whnf(this.mctx.instantiate(e)));
  }

  whnfCore(e: Expr): Expr {
    return this.tc.whnfCore(e);
  }

  inferType(e: Expr): Expr {
    return this.tc.inferOnly(this.mctx.instantiate(e));
  }

  private instHead(e: Expr): Expr {
    const fn = getAppFn(e);
    if (fn.k === 'mvar') {
      const v = this.mctx.get(fn.id)?.value;
      if (v) return this.instHead(headBeta(mkApps(v, getAppArgs(e))));
    }
    return e;
  }

  // -------------------------------------------------------------------------
  // universe levels

  unifyLevel(a: Level, b: Level): boolean {
    a = this.mctx.instantiateLevel(a);
    b = this.mctx.instantiateLevel(b);
    if (levelStructEq(a, b)) return true;
    if (this.env.features.typeInType && !hasLevelMVar(a) && !hasLevelMVar(b)) return this.tc.levelDefEq(a, b);
    if (a.k === 'mvar' && !occursLevel(a.id, b)) {
      this.mctx.assignLevel(a.id, b);
      return true;
    }
    if (b.k === 'mvar' && !occursLevel(b.id, a)) {
      this.mctx.assignLevel(b.id, a);
      return true;
    }
    if (a.k === 'succ' && b.k === 'succ') return this.unifyLevel(a.l, b.l);
    if (!hasLevelMVar(a) && !hasLevelMVar(b)) return this.tc.levelDefEq(a, b);
    // ?u+1 =?= n+1 handled above; max ?u ?v =?= 0
    if (toNat(b) === 0 && (a.k === 'max' || a.k === 'imax')) {
      return this.unifyLevel(a.b, lzero) && (a.k === 'imax' || this.unifyLevel(a.a, lzero));
    }
    if (toNat(a) === 0 && (b.k === 'max' || b.k === 'imax')) {
      return this.unifyLevel(b.b, lzero) && (b.k === 'imax' || this.unifyLevel(b.a, lzero));
    }
    if (a.k === 'succ' && toNat(b) === 0) return false;
    if (b.k === 'succ' && toNat(a) === 0) return false;
    if (a.k === 'succ' && isNeverZero(b) && b.k === 'max') {
      // (?u+1) =?= max (v+1) (w+1)  ⇒  ?u := max v w
      const pb = predLevel(b);
      if (pb) return this.unifyLevel(a.l, pb);
    }
    if (b.k === 'succ' && isNeverZero(a) && a.k === 'max') {
      const pa = predLevel(a);
      if (pa) return this.unifyLevel(pa, b.l);
    }
    if (levelEq(a, b)) return true;
    // postpone
    this.mctx.pendingLevels.push([a, b]);
    return true;
  }

  /** try to discharge postponed level constraints; returns the failing ones */
  processPendingLevels(): [Level, Level][] {
    let changed = true;
    let pending = this.mctx.pendingLevels;
    while (changed) {
      changed = false;
      const next: [Level, Level][] = [];
      for (const [a0, b0] of pending) {
        const a = this.mctx.instantiateLevel(a0);
        const b = this.mctx.instantiateLevel(b0);
        if (!hasLevelMVar(a) && !hasLevelMVar(b)) {
          if (!this.tc.levelDefEq(a, b)) next.push([a, b]);
          else changed = true;
          continue;
        }
        const before = this.mctx.pendingLevels.length;
        this.mctx.pendingLevels = [];
        if (a.k === 'mvar' || b.k === 'mvar' || (a.k === 'succ' && b.k === 'succ')) {
          this.unifyLevel(a, b);
          changed = true;
          next.push(...this.mctx.pendingLevels);
        } else next.push([a, b]);
        this.mctx.pendingLevels = [];
        void before;
      }
      pending = next;
      if (!changed) break;
    }
    // remaining constraints with metavariables: approximate  ?u =?= max a b  style
    const fails: [Level, Level][] = [];
    for (const [a0, b0] of pending) {
      const a = this.mctx.instantiateLevel(a0);
      const b = this.mctx.instantiateLevel(b0);
      if (!hasLevelMVar(a) && !hasLevelMVar(b)) {
        if (!this.tc.levelDefEq(a, b)) fails.push([a, b]);
      } else if (!levelEq(a, b)) {
        // last resort: set remaining mvars in `a` or `b` to make them equal
        const mv = firstLevelMVar(a) ?? firstLevelMVar(b);
        if (mv !== undefined) {
          this.mctx.assignLevel(mv, lzero);
          if (!levelEq(this.mctx.instantiateLevel(a), this.mctx.instantiateLevel(b))) fails.push([a, b]);
        }
      }
    }
    this.mctx.pendingLevels = [];
    return fails;
  }

  // -------------------------------------------------------------------------
  // expressions

  isDefEq(a: Expr, b: Expr): boolean {
    const cp = this.mctx.checkpoint();
    const r = this.defEq(a, b, 0);
    if (!r) this.mctx.rollback(cp);
    return r;
  }

  private withLocal<T>(name: string, type: Expr, f: (fv: Expr) => T): T {
    const d: LocalDecl = { id: freshFVarId(), name, type };
    const saved = this.tc.lctx;
    this.tc.lctx = saved.push(d);
    try {
      return f(mkFVar(d.id));
    } finally {
      this.tc.lctx = saved;
    }
  }

  private defEq(a: Expr, b: Expr, depth: number): boolean {
    if (depth > 400) return false;
    a = this.instHead(a);
    b = this.instHead(b);
    if (a === b || exprEq(a, b)) return true;
    const fa = getAppFn(a);
    const fb = getAppFn(b);
    const aFlex = fa.k === 'mvar';
    const bFlex = fb.k === 'mvar';
    if (aFlex && bFlex && fa.id === fb.id) {
      const as = getAppArgs(a);
      const bs = getAppArgs(b);
      if (as.length === bs.length) {
        const cp = this.mctx.checkpoint();
        if (as.every((x, i) => this.defEq(x, bs[i], depth + 1))) return true;
        this.mctx.rollback(cp);
      }
    }
    if (aFlex && (!bFlex || fb.id > fa.id)) {
      if (this.solve(a, b, depth)) return true;
    }
    if (bFlex) {
      if (this.solve(b, a, depth)) return true;
    }
    if (aFlex && !bFlex && this.solve(a, b, depth)) return true;

    // structural cases
    if (a.k === 'sort' && b.k === 'sort') return this.unifyLevel(a.level, b.level);
    if ((a.k === 'lam' && b.k === 'lam') || (a.k === 'pi' && b.k === 'pi')) {
      if (!this.defEq(a.type, b.type, depth + 1)) return false;
      return this.withLocal(a.name, a.type, (fv) => this.defEq(instantiate1(a.body, fv), instantiate1(b.body, fv), depth + 1));
    }

    // first try same-head constants / applications without unfolding
    if (fa.k === 'const' && fb.k === 'const' && fa.name === fb.name && fa.levels.length === fb.levels.length) {
      const cp = this.mctx.checkpoint();
      const as = getAppArgs(a);
      const bs = getAppArgs(b);
      if (as.length === bs.length && fa.levels.every((l, i) => this.unifyLevel(l, fb.levels[i])) && as.every((x, i) => this.defEq(x, bs[i], depth + 1))) return true;
      this.mctx.rollback(cp);
    }
    if (fa.k === 'fvar' && fb.k === 'fvar' && fa.id === fb.id) {
      const as = getAppArgs(a);
      const bs = getAppArgs(b);
      const cp = this.mctx.checkpoint();
      if (as.length === bs.length && as.every((x, i) => this.defEq(x, bs[i], depth + 1))) return true;
      this.mctx.rollback(cp);
    }

    // reduce
    const a1 = this.instHead(this.tc.whnfCore(a));
    const b1 = this.instHead(this.tc.whnfCore(b));
    if (!exprEq(a1, a) || !exprEq(b1, b)) return this.defEq(a1, b1, depth + 1);

    // proof irrelevance
    if (this.env.features.proofIrrelevance && !aFlex && !bFlex) {
      const pa = this.proofType(a);
      if (pa) {
        const pb = this.proofType(b);
        if (pb && this.defEq(pa, pb, depth + 1)) return true;
      }
    }

    // δ: unfold the side with the larger height
    const ha = this.height(a);
    const hb = this.height(b);
    if (ha >= 0 || hb >= 0) {
      if (ha >= 0 && (ha >= hb || hb < 0)) {
        const a2 = this.tc.unfoldDefinition(a);
        if (a2 && !(hb >= 0 && ha === hb)) return this.defEq(a2, b, depth + 1);
        if (a2 && hb >= 0) {
          const b2 = this.tc.unfoldDefinition(b)!;
          return this.defEq(a2, b2, depth + 1);
        }
        if (a2) return this.defEq(a2, b, depth + 1);
      }
      const b2 = this.tc.unfoldDefinition(b);
      if (b2) return this.defEq(a, b2, depth + 1);
    }

    // η
    if (this.env.features.eta) {
      if (a.k === 'lam' && b.k !== 'lam') return this.withLocal(a.name, a.type, (fv) => this.defEq(instantiate1(a.body, fv), mkApps(b, [fv]), depth + 1));
      if (b.k === 'lam' && a.k !== 'lam') return this.withLocal(b.name, b.type, (fv) => this.defEq(mkApps(a, [fv]), instantiate1(b.body, fv), depth + 1));
    }
    // structure η
    if (this.env.features.structEta) {
      if (this.structEta(a, b, depth) || this.structEta(b, a, depth)) return true;
    }
    // flex with non-pattern arguments: first-order approximation
    if (aFlex || bFlex) {
      const [f, r] = aFlex ? [a, b] : [b, a];
      if (this.firstOrder(f, r, depth)) return true;
    }
    return false;
  }

  private height(e: Expr): number {
    const fn = getAppFn(e);
    if (fn.k !== 'const') return -1;
    const d = this.env.get(fn.name);
    if (!d) return -1;
    if (d.kind === 'def') return d.height;
    if (d.kind === 'theorem') return 0;
    return -1;
  }

  private proofType(e: Expr): Expr | undefined {
    try {
      const t = this.inferType(e);
      const s = this.whnf(this.inferType(t));
      return s.k === 'sort' && toNat(this.mctx.instantiateLevel(s.level)) === 0 ? t : undefined;
    } catch {
      return undefined;
    }
  }

  private structEta(a: Expr, b: Expr, depth: number): boolean {
    const fa = getAppFn(a);
    if (fa.k !== 'const') return false;
    const cd = this.env.get(fa.name);
    if (!cd || cd.kind !== 'ctor') return false;
    const projs = structureProjections(this.env, cd.induct);
    if (!projs) return false;
    const args = getAppArgs(a);
    if (args.length !== cd.numParams + cd.numFields) return false;
    const params = args.slice(0, cd.numParams);
    const cp = this.mctx.checkpoint();
    for (let i = 0; i < cd.numFields; i++) {
      if (!this.defEq(args[cd.numParams + i], mkApps(mkConst(projs[i], fa.levels), [...params, b]), depth + 1)) {
        this.mctx.rollback(cp);
        return false;
      }
    }
    return true;
  }

  private firstOrder(f: Expr, r: Expr, depth: number): boolean {
    // ?m a₁ … aₙ =?= g b₁ … bₖ bₖ₊₁ … bₖ₊ₙ  ⇒  ?m := g b₁ … bₖ, aᵢ =?= bₖ₊ᵢ
    const fargs = getAppArgs(f);
    const rargs = getAppArgs(r);
    if (rargs.length < fargs.length) return false;
    const k = rargs.length - fargs.length;
    const cp = this.mctx.checkpoint();
    const head = mkApps(getAppFn(r), rargs.slice(0, k));
    if (this.defEq(getAppFn(f), head, depth + 1) && fargs.every((x, i) => this.defEq(x, rargs[k + i], depth + 1))) return true;
    this.mctx.rollback(cp);
    return false;
  }

  /** solve ?m a₁ … aₙ =?= rhs by Miller pattern unification */
  private solve(lhs: Expr, rhs: Expr, depth: number): boolean {
    const m = getAppFn(lhs) as Extract<Expr, { k: 'mvar' }>;
    const decl = this.mctx.get(m.id);
    if (!decl || decl.value) return false;
    const args = getAppArgs(lhs).map((x) => this.instHead(x));
    // Miller patterns need distinct variables; we approximate slightly beyond
    // that: a repeated variable is abstracted at its last occurrence.
    const ids: number[] = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a.k !== 'fvar') return false;
      const later = args.slice(i + 1).some((b) => b.k === 'fvar' && b.id === a.id);
      ids.push(later ? -1 : a.id);
    }
    let r = this.mctx.instantiate(rhs);
    // occurs check
    if (occursMVar(m.id, r)) {
      // try to get rid of it by reduction
      r = this.mctx.instantiate(this.tc.whnf(r));
      if (occursMVar(m.id, r)) return false;
    }
    // scope check: all free variables of r must be among the arguments
    const fvs = collectFVars(r);
    for (const id of fvs) {
      if (!ids.includes(id) || id < 0) {
        // let-bound variables can be unfolded
        const d = this.tc.lctx.get(id);
        if (d?.value) {
          r = replaceExpr(r, (x) => (x.k === 'fvar' && x.id === id ? d.value : undefined));
          continue;
        }
        // try pruning via reduction
        const r2 = this.mctx.instantiate(this.tc.whnf(r));
        const fvs2 = collectFVars(r2);
        if ([...fvs2].every((x) => ids.includes(x))) {
          r = r2;
          break;
        }
        return false;
      }
    }
    // build λ over the arguments, taking binder types from ?m's type
    let body = abstractFVars(r, ids);
    // the type may mention metavariables solved since ?m was created
    let t = this.mctx.instantiate(decl.type);
    const doms: { name: string; type: Expr }[] = [];
    for (let i = 0; i < args.length; i++) {
      if (t.k !== 'pi') t = this.tc.whnf(t);
      if (t.k !== 'pi') return false;
      doms.push({ name: t.name, type: t.type });
      t = t.body;
    }
    for (let i = args.length - 1; i >= 0; i--) body = mkLam(doms[i].name, doms[i].type, body);
    // check the types agree (this also solves universe metavariables)
    const cp = this.mctx.checkpoint();
    this.mctx.assign(m.id, body);
    try {
      // the declared type of ?m, instantiated with the arguments
      let tl = this.mctx.instantiate(decl.type);
      for (const a of args) {
        const w = tl.k === 'pi' ? tl : this.tc.whnf(tl);
        if (w.k !== 'pi') throw new Error('bad mvar type');
        tl = instantiate1(w.body, a);
      }
      const tr = this.inferType(rhs);
      if (!this.defEq(tl, tr, depth + 1)) {
        this.mctx.rollback(cp);
        return false;
      }
    } catch {
      // if types cannot be inferred we keep the assignment
    }
    return true;
  }
}

function occursMVar(id: number, e: Expr): boolean {
  if (!e.mv) return false;
  let found = false;
  replaceExpr(e, (x) => {
    if (found || !x.mv) return x;
    if (x.k === 'mvar' && x.id === id) {
      found = true;
      return x;
    }
    return undefined;
  });
  return found;
}

function occursLevel(id: number, l: Level): boolean {
  switch (l.k) {
    case 'mvar':
      return l.id === id;
    case 'succ':
      return occursLevel(id, l.l);
    case 'max':
    case 'imax':
      return occursLevel(id, l.a) || occursLevel(id, l.b);
    default:
      return false;
  }
}

function firstLevelMVar(l: Level): number | undefined {
  switch (l.k) {
    case 'mvar':
      return l.id;
    case 'succ':
      return firstLevelMVar(l.l);
    case 'max':
    case 'imax':
      return firstLevelMVar(l.a) ?? firstLevelMVar(l.b);
    default:
      return undefined;
  }
}

/** l - 1 when l is a max of successors */
function predLevel(l: Level): Level | undefined {
  if (l.k === 'succ') return l.l;
  if (l.k === 'max') {
    const a = predLevel(l.a);
    const b = predLevel(l.b);
    if (a && b) return lmax(a, b);
  }
  return undefined;
}

export { lsucc, mkBinder };
