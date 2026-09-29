// Core expressions, in the locally-nameless style used by Lean 4's kernel.
//
//  * bound variables are de Bruijn indices (`bvar`), counted outward from the
//    innermost binder;
//  * free variables (`fvar`) are hypotheses of the local context, referenced by
//    a unique id;
//  * metavariables (`mvar`) are holes the elaborator still has to fill; the
//    kernel never sees them.
//
// Every node caches `lb` — one more than the largest loose bound variable
// (0 for closed terms) — and two flags, so that substitution can skip closed
// subterms without traversing them.

import { type Level, hasLevelMVar, hasLevelParam, instantiateLevelParams, levelStructEq } from './level.ts';

export type BinderInfo = 'default' | 'implicit' | 'strictImplicit' | 'inst';

interface Base {
  readonly lb: number; // loose bvar range
  readonly fv: boolean; // contains fvars
  readonly mv: boolean; // contains expression or level metavariables
  readonly lp: boolean; // contains level parameters
}

export type Expr =
  | (Base & { readonly k: 'bvar'; readonly i: number })
  | (Base & { readonly k: 'fvar'; readonly id: number })
  | (Base & { readonly k: 'mvar'; readonly id: number })
  | (Base & { readonly k: 'sort'; readonly level: Level })
  | (Base & { readonly k: 'const'; readonly name: string; readonly levels: readonly Level[] })
  | (Base & { readonly k: 'app'; readonly fn: Expr; readonly arg: Expr })
  | (Base & BinderFields & { readonly k: 'lam' })
  | (Base & BinderFields & { readonly k: 'pi' })
  | (Base & {
      readonly k: 'let';
      readonly name: string;
      readonly type: Expr;
      readonly value: Expr;
      readonly body: Expr;
    });

interface BinderFields {
  readonly name: string;
  readonly binfo: BinderInfo;
  readonly type: Expr;
  readonly body: Expr;
}

export type Binder = Extract<Expr, { k: 'lam' | 'pi' }>;
export type Lam = Extract<Expr, { k: 'lam' }>;
export type Pi = Extract<Expr, { k: 'pi' }>;
export type FVar = Extract<Expr, { k: 'fvar' }>;
export type App = Extract<Expr, { k: 'app' }>;
export type Const = Extract<Expr, { k: 'const' }>;

// ---------------------------------------------------------------------------
// constructors

const bvarCache: Expr[] = [];
export function mkBVar(i: number): Expr {
  if (i < 64) {
    return (bvarCache[i] ??= { k: 'bvar', i, lb: i + 1, fv: false, mv: false, lp: false });
  }
  return { k: 'bvar', i, lb: i + 1, fv: false, mv: false, lp: false };
}
export const mkFVar = (id: number): Expr => ({ k: 'fvar', id, lb: 0, fv: true, mv: false, lp: false });
export const mkMVar = (id: number): Expr => ({ k: 'mvar', id, lb: 0, fv: false, mv: true, lp: false });
export const mkSort = (level: Level): Expr => ({
  k: 'sort',
  level,
  lb: 0,
  fv: false,
  mv: hasLevelMVar(level),
  lp: hasLevelParam(level),
});
export const mkConst = (name: string, levels: readonly Level[] = []): Expr => ({
  k: 'const',
  name,
  levels,
  lb: 0,
  fv: false,
  mv: levels.some(hasLevelMVar),
  lp: levels.some(hasLevelParam),
});
export const mkApp = (fn: Expr, arg: Expr): Expr => ({
  k: 'app',
  fn,
  arg,
  lb: Math.max(fn.lb, arg.lb),
  fv: fn.fv || arg.fv,
  mv: fn.mv || arg.mv,
  lp: fn.lp || arg.lp,
});
export function mkApps(fn: Expr, args: readonly Expr[]): Expr {
  let e = fn;
  for (const a of args) e = mkApp(e, a);
  return e;
}
export const mkBinder = (k: 'lam' | 'pi', name: string, type: Expr, body: Expr, binfo: BinderInfo = 'default'): Expr => ({
  k,
  name,
  binfo,
  type,
  body,
  lb: Math.max(type.lb, body.lb - 1, 0),
  fv: type.fv || body.fv,
  mv: type.mv || body.mv,
  lp: type.lp || body.lp,
});
export const mkLam = (name: string, type: Expr, body: Expr, binfo: BinderInfo = 'default') =>
  mkBinder('lam', name, type, body, binfo);
export const mkPi = (name: string, type: Expr, body: Expr, binfo: BinderInfo = 'default') =>
  mkBinder('pi', name, type, body, binfo);
export const mkArrow = (a: Expr, b: Expr) => mkPi('_', a, liftLooseBVars(b, 0, 1));
export const mkLet = (name: string, type: Expr, value: Expr, body: Expr): Expr => ({
  k: 'let',
  name,
  type,
  value,
  body,
  lb: Math.max(type.lb, value.lb, body.lb - 1, 0),
  fv: type.fv || value.fv || body.fv,
  mv: type.mv || value.mv || body.mv,
  lp: type.lp || value.lp || body.lp,
});

// ---------------------------------------------------------------------------
// application spines

export function getAppFn(e: Expr): Expr {
  while (e.k === 'app') e = e.fn;
  return e;
}

export function getAppArgs(e: Expr): Expr[] {
  const args: Expr[] = [];
  while (e.k === 'app') {
    args.push(e.arg);
    e = e.fn;
  }
  return args.reverse();
}

export function getAppNumArgs(e: Expr): number {
  let n = 0;
  while (e.k === 'app') {
    n++;
    e = e.fn;
  }
  return n;
}

export function isConstOf(e: Expr, name: string): boolean {
  return e.k === 'const' && e.name === name;
}

// ---------------------------------------------------------------------------
// generic traversal

/**
 * Rebuild `e`, calling `f(sub, depth)` on each subterm first; if `f` returns an
 * expression it replaces the subterm. `depth` counts binders crossed.
 */
export function replaceExpr(e: Expr, f: (e: Expr, depth: number) => Expr | undefined, depth = 0): Expr {
  const cache = new Map<Expr, Expr>();
  const go = (e: Expr, d: number): Expr => {
    const r = f(e, d);
    if (r !== undefined) return r;
    const useCache = d === depth;
    if (useCache) {
      const c = cache.get(e);
      if (c) return c;
    }
    let out: Expr;
    switch (e.k) {
      case 'app': {
        const fn = go(e.fn, d);
        const arg = go(e.arg, d);
        out = fn === e.fn && arg === e.arg ? e : mkApp(fn, arg);
        break;
      }
      case 'lam':
      case 'pi': {
        const t = go(e.type, d);
        const b = go(e.body, d + 1);
        out = t === e.type && b === e.body ? e : mkBinder(e.k, e.name, t, b, e.binfo);
        break;
      }
      case 'let': {
        const t = go(e.type, d);
        const v = go(e.value, d);
        const b = go(e.body, d + 1);
        out = t === e.type && v === e.value && b === e.body ? e : mkLet(e.name, t, v, b);
        break;
      }
      default:
        out = e;
    }
    if (useCache) cache.set(e, out);
    return out;
  };
  return go(e, depth);
}

export function forEachExpr(e: Expr, f: (e: Expr, depth: number) => boolean | void, depth = 0): void {
  if (f(e, depth) === false) return;
  switch (e.k) {
    case 'app':
      forEachExpr(e.fn, f, depth);
      forEachExpr(e.arg, f, depth);
      break;
    case 'lam':
    case 'pi':
      forEachExpr(e.type, f, depth);
      forEachExpr(e.body, f, depth + 1);
      break;
    case 'let':
      forEachExpr(e.type, f, depth);
      forEachExpr(e.value, f, depth);
      forEachExpr(e.body, f, depth + 1);
      break;
  }
}

// ---------------------------------------------------------------------------
// de Bruijn manipulation

/** Add `d` to every loose bvar with index ≥ `s`. */
export function liftLooseBVars(e: Expr, s: number, d: number): Expr {
  if (d === 0 || e.lb <= s) return e;
  return replaceExpr(e, (x, off) => {
    if (x.lb <= s + off) return x;
    if (x.k === 'bvar') return mkBVar(x.i + d);
    return undefined;
  });
}

/** Subtract `d` from every loose bvar with index ≥ `s` (they must be ≥ s+d). */
export function lowerLooseBVars(e: Expr, s: number, d: number): Expr {
  if (d === 0 || e.lb <= s) return e;
  return replaceExpr(e, (x, off) => {
    if (x.lb <= s + off) return x;
    if (x.k === 'bvar') return mkBVar(x.i - d);
    return undefined;
  });
}

/**
 * Replace loose bvars 0..n-1 by `subst`, where bvar i ↦ subst[n - 1 - i]
 * (so `subst` is listed outermost-first, matching the order binders are
 * opened), and lower the remaining loose bvars by n.
 */
export function instantiateRev(e: Expr, subst: readonly Expr[]): Expr {
  const n = subst.length;
  if (n === 0 || e.lb === 0) return e;
  return replaceExpr(e, (x, off) => {
    if (x.lb <= off) return x;
    if (x.k === 'bvar') {
      const i = x.i - off;
      if (i < n) return liftLooseBVars(subst[n - 1 - i], 0, off);
      return mkBVar(x.i - n);
    }
    return undefined;
  });
}

/** Replace bvar 0 by `v`. */
export const instantiate1 = (body: Expr, v: Expr): Expr => instantiateRev(body, [v]);

export function hasLooseBVar(e: Expr, i: number): boolean {
  if (e.lb <= i) return false;
  let found = false;
  forEachExpr(e, (x, off) => {
    if (found || x.lb <= i + off) return false;
    if (x.k === 'bvar' && x.i === i + off) found = true;
    return undefined;
  });
  return found;
}

/**
 * Abstract the free variables `fvars` (outermost-first): fvars[j] becomes
 * bvar (n - 1 - j + depth).
 */
export function abstractFVars(e: Expr, fvars: readonly number[]): Expr {
  if (fvars.length === 0 || !e.fv) return e;
  const n = fvars.length;
  return replaceExpr(e, (x, off) => {
    if (!x.fv) return x;
    if (x.k === 'fvar') {
      const j = fvars.lastIndexOf(x.id);
      if (j >= 0) return mkBVar(n - 1 - j + off);
    }
    return undefined;
  });
}

export function instantiateLevelParamsExpr(e: Expr, names: readonly string[], ls: readonly Level[]): Expr {
  if (names.length === 0 || !e.lp) return e;
  return replaceExpr(e, (x) => {
    if (!x.lp) return x;
    if (x.k === 'sort') return mkSort(instantiateLevelParams(x.level, names, ls));
    if (x.k === 'const') return mkConst(x.name, x.levels.map((l) => instantiateLevelParams(l, names, ls)));
    return undefined;
  });
}

export function hasFVar(e: Expr, id: number): boolean {
  if (!e.fv) return false;
  let found = false;
  forEachExpr(e, (x) => {
    if (found || !x.fv) return false;
    if (x.k === 'fvar' && x.id === id) found = true;
    return undefined;
  });
  return found;
}

export function collectFVars(e: Expr, out = new Set<number>()): Set<number> {
  forEachExpr(e, (x) => {
    if (!x.fv) return false;
    if (x.k === 'fvar') out.add(x.id);
    return undefined;
  });
  return out;
}

export function occursConst(e: Expr, name: string): boolean {
  let found = false;
  forEachExpr(e, (x) => {
    if (found) return false;
    if (x.k === 'const' && x.name === name) found = true;
    return undefined;
  });
  return found;
}

/** Structural (α-)equality; binder names and infos are ignored. */
export function exprEq(a: Expr, b: Expr): boolean {
  if (a === b) return true;
  if (a.k !== b.k || a.lb !== b.lb) return false;
  switch (a.k) {
    case 'bvar':
      return a.i === (b as typeof a).i;
    case 'fvar':
    case 'mvar':
      return a.id === (b as typeof a).id;
    case 'sort':
      return levelStructEq(a.level, (b as typeof a).level);
    case 'const': {
      const bb = b as typeof a;
      return a.name === bb.name && a.levels.length === bb.levels.length && a.levels.every((l, i) => levelStructEq(l, bb.levels[i]));
    }
    case 'app':
      return exprEq(a.fn, (b as typeof a).fn) && exprEq(a.arg, (b as typeof a).arg);
    case 'lam':
    case 'pi':
      return exprEq(a.type, (b as typeof a).type) && exprEq(a.body, (b as typeof a).body);
    case 'let': {
      const bb = b as typeof a;
      return exprEq(a.type, bb.type) && exprEq(a.value, bb.value) && exprEq(a.body, bb.body);
    }
  }
}

/** Head beta: (λx.b) a ↦ b[a/x], repeated at the head. */
export function headBeta(e: Expr): Expr {
  if (e.k !== 'app') return e;
  const fn = getAppFn(e);
  if (fn.k !== 'lam') return e;
  const args = getAppArgs(e);
  let f: Expr = fn;
  let i = 0;
  while (f.k === 'lam' && i < args.length) {
    f = f.body;
    i++;
  }
  return headBeta(mkApps(instantiateRev(f, args.slice(0, i)), args.slice(i)));
}

export function exprSize(e: Expr): number {
  let n = 0;
  forEachExpr(e, () => {
    n++;
  });
  return n;
}

/** Number of leading Π binders. */
export function piArity(e: Expr): number {
  let n = 0;
  while (e.k === 'pi') {
    n++;
    e = e.body;
  }
  return n;
}
