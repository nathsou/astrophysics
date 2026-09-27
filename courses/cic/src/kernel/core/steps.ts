// Small-step reduction of core terms, for visualisation.
//
// The kernel reduces terms with an efficient weak-head strategy. Here we
// expose the individual steps: β (application of a λ), δ (unfolding a
// definition), ζ (let), ι (a recursor meeting a constructor) and quotient
// reduction, contracting one redex at a time in a "lazy normal order":
// first reduce to weak head normal form, then normalise the arguments and
// binder bodies from left to right.

import {
  type Expr,
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateLevelParamsExpr,
  instantiateRev,
  mkApp,
  mkApps,
  mkBinder,
  mkLet,
  exprSize,
} from './expr.ts';
import type { Environment } from './env.ts';

export type StepKind = 'beta' | 'delta' | 'zeta' | 'iota' | 'quot';

export interface TStep {
  kind: StepKind;
  /** path to the redex (app: 0 fn / 1 arg; binder: 0 type / 1 body; let: 0/1/2) */
  path: number[];
  before: Expr;
  after: Expr;
  /** for δ and ι: the constant involved */
  name?: string;
}

export const stepKindInfo: Record<StepKind, { name: string; symbol: string; blurb: string }> = {
  beta: { name: 'β-reduction', symbol: 'β', blurb: 'apply a function: (λ x, t) a ⟶ t[a/x]' },
  delta: { name: 'δ-reduction', symbol: 'δ', blurb: 'unfold a definition by its body' },
  zeta: { name: 'ζ-reduction', symbol: 'ζ', blurb: 'substitute a let-bound value: let x := v; t ⟶ t[v/x]' },
  iota: { name: 'ι-reduction', symbol: 'ι', blurb: 'a recursor applied to a constructor computes by the matching minor premise' },
  quot: { name: 'quotient reduction', symbol: 'ι', blurb: 'Quot.lift f h (Quot.mk r a) ⟶ f a' },
};

/** replace the subterm at `path` */
export function replaceAtPath(e: Expr, path: number[], f: (x: Expr) => Expr, i = 0): Expr {
  if (i === path.length) return f(e);
  const k = path[i];
  switch (e.k) {
    case 'app':
      return k === 0 ? mkApp(replaceAtPath(e.fn, path, f, i + 1), e.arg) : mkApp(e.fn, replaceAtPath(e.arg, path, f, i + 1));
    case 'lam':
    case 'pi':
      return k === 0 ? mkBinder(e.k, e.name, replaceAtPath(e.type, path, f, i + 1), e.body, e.binfo) : mkBinder(e.k, e.name, e.type, replaceAtPath(e.body, path, f, i + 1), e.binfo);
    case 'let':
      if (k === 0) return mkLet(e.name, replaceAtPath(e.type, path, f, i + 1), e.value, e.body);
      if (k === 1) return mkLet(e.name, e.type, replaceAtPath(e.value, path, f, i + 1), e.body);
      return mkLet(e.name, e.type, e.value, replaceAtPath(e.body, path, f, i + 1));
    default:
      throw new Error('bad path');
  }
}

export function atPath(e: Expr, path: number[]): Expr {
  let cur = e;
  for (const k of path) {
    if (cur.k === 'app') cur = k === 0 ? cur.fn : cur.arg;
    else if (cur.k === 'lam' || cur.k === 'pi') cur = k === 0 ? cur.type : cur.body;
    else if (cur.k === 'let') cur = k === 0 ? cur.type : k === 1 ? cur.value : cur.body;
    else throw new Error('bad path');
  }
  return cur;
}

const spinePath = (nargs: number, i: number): number[] => [...Array(nargs - 1 - i).fill(0), 1];

export class Stepper {
  constructor(
    readonly env: Environment,
    readonly opts: { unfoldTheorems?: boolean; delta?: boolean } = {},
  ) {}

  /** find the next redex, or undefined if `e` is in normal form */
  next(e: Expr): { path: number[]; kind: StepKind; name?: string } | undefined {
    const h = this.headRedex(e);
    if (h) return h;
    // e is in weak head normal form: reduce inside
    switch (e.k) {
      case 'lam':
      case 'pi': {
        const t = this.next(e.type);
        if (t) return { ...t, path: [0, ...t.path] };
        const b = this.next(e.body);
        if (b) return { ...b, path: [1, ...b.path] };
        return undefined;
      }
      case 'app': {
        const fn = getAppFn(e);
        const args = getAppArgs(e);
        const fr = this.next(fn);
        if (fr) return { ...fr, path: [...Array(args.length).fill(0), ...fr.path] };
        for (let i = 0; i < args.length; i++) {
          const r = this.next(args[i]);
          if (r) return { ...r, path: [...spinePath(args.length, i), ...r.path] };
        }
        return undefined;
      }
      default:
        return undefined;
    }
  }

  /** a redex that must be contracted to reach weak head normal form */
  private headRedex(e: Expr): { path: number[]; kind: StepKind; name?: string } | undefined {
    if (e.k === 'let') return { path: [], kind: 'zeta' };
    const fn = getAppFn(e);
    const args = getAppArgs(e);
    if (fn.k === 'lam' && args.length > 0) {
      // the innermost application of the spine that is a redex: (λx.b) a₁
      return { path: Array(args.length - 1).fill(0), kind: 'beta' };
    }
    if (fn.k === 'let') {
      const r = this.headRedex(fn);
      return r ? { ...r, path: [...Array(args.length).fill(0), ...r.path] } : undefined;
    }
    if (fn.k !== 'const') return undefined;
    const d = this.env.get(fn.name);
    if (!d) return undefined;
    if ((d.kind === 'def' || (d.kind === 'theorem' && this.opts.unfoldTheorems)) && this.opts.delta !== false) {
      return { path: Array(args.length).fill(0), kind: 'delta', name: fn.name };
    }
    if (d.kind === 'rec' && args.length > d.majorIdx) {
      const major = args[d.majorIdx];
      const mfn = getAppFn(major);
      if (mfn.k === 'const' && this.env.get(mfn.name)?.kind === 'ctor') {
        const cd = this.env.get(mfn.name)!;
        if (cd.kind === 'ctor' && getAppArgs(major).length === cd.numParams + cd.numFields) {
          return { path: Array(args.length - 1 - d.majorIdx).fill(0), kind: 'iota', name: fn.name };
        }
      }
      // force the major premise
      const r = this.headRedex(major);
      if (r) return { ...r, path: [...spinePath(args.length, d.majorIdx), ...r.path] };
      return undefined;
    }
    if (d.kind === 'quot' && (d.quotKind === 'lift' || d.quotKind === 'ind')) {
      const mkPos = d.quotKind === 'lift' ? 5 : 4;
      if (args.length <= mkPos) return undefined;
      const mk = args[mkPos];
      const mfn = getAppFn(mk);
      if (mfn.k === 'const' && mfn.name === 'Quot.mk' && getAppArgs(mk).length === 3) {
        return { path: Array(args.length - 1 - mkPos).fill(0), kind: 'quot', name: fn.name };
      }
      const r = this.headRedex(mk);
      if (r) return { ...r, path: [...spinePath(args.length, mkPos), ...r.path] };
    }
    return undefined;
  }

  /** contract the redex at `path` */
  contract(e: Expr, r: { path: number[]; kind: StepKind }): Expr {
    return replaceAtPath(e, r.path, (x) => this.contractHere(x, r.kind));
  }

  private contractHere(x: Expr, kind: StepKind): Expr {
    switch (kind) {
      case 'beta': {
        if (x.k === 'app' && x.fn.k === 'lam') return instantiate1(x.fn.body, x.arg);
        throw new Error('not a β-redex');
      }
      case 'zeta': {
        if (x.k === 'let') return instantiate1(x.body, x.value);
        throw new Error('not a ζ-redex');
      }
      case 'delta': {
        const fn = getAppFn(x);
        if (fn.k !== 'const') throw new Error('not a δ-redex');
        const d = this.env.get(fn.name)!;
        if (d.kind !== 'def' && d.kind !== 'theorem') throw new Error('not a δ-redex');
        return mkApps(instantiateLevelParamsExpr(d.value, d.levelParams, fn.levels), getAppArgs(x));
      }
      case 'iota': {
        const fn = getAppFn(x);
        const args = getAppArgs(x);
        if (fn.k !== 'const') throw new Error('not a ι-redex');
        const d = this.env.get(fn.name)!;
        if (d.kind !== 'rec') throw new Error('not a ι-redex');
        const major = args[d.majorIdx];
        const cfn = getAppFn(major) as Extract<Expr, { k: 'const' }>;
        const rule = d.rules.find((r) => r.ctor === cfn.name)!;
        const rhs = instantiateLevelParamsExpr(rule.rhs, d.levelParams, fn.levels);
        const pmm = args.slice(0, d.numParams + d.numMotives + d.numMinors);
        const fields = getAppArgs(major).slice(d.numParams);
        // apply and β-reduce the administrative redexes of the rule at once
        let body = rhs;
        const all = [...pmm, ...fields];
        let n = 0;
        while (body.k === 'lam' && n < all.length) {
          body = body.body;
          n++;
        }
        return mkApps(instantiateRev(body, all.slice(0, n)), [...all.slice(n), ...args.slice(d.majorIdx + 1)]);
      }
      case 'quot': {
        const fn = getAppFn(x) as Extract<Expr, { k: 'const' }>;
        const args = getAppArgs(x);
        const d = this.env.get(fn.name)!;
        const mkPos = d.kind === 'quot' && d.quotKind === 'lift' ? 5 : 4;
        const a = getAppArgs(args[mkPos])[2];
        return mkApps(mkApp(args[3], a), args.slice(mkPos + 1));
      }
    }
  }

  /** run up to `max` steps */
  trace(e: Expr, max = 200, maxSize = 4000): { steps: TStep[]; final: Expr; normal: boolean } {
    const steps: TStep[] = [];
    let cur = e;
    for (let i = 0; i < max; i++) {
      const r = this.next(cur);
      if (!r) return { steps, final: cur, normal: true };
      const after = this.contract(cur, r);
      steps.push({ kind: r.kind, path: r.path, before: cur, after, name: r.name });
      cur = after;
      if (exprSize(cur) > maxSize) break;
    }
    return { steps, final: cur, normal: false };
  }
}
