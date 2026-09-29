// The trusted kernel.
//
// `TypeChecker` implements type inference, weak-head normalisation and
// definitional equality for every calculus in the course. It works on fully
// elaborated terms (no metavariables) and optionally records a derivation tree
// — the proof that the term is well typed — for the visualisations.

import {
  type Expr,
  type FVar,
  abstractFVars,
  exprEq,
  getAppArgs,
  getAppFn,
  instantiate1,
  instantiateLevelParamsExpr,
  instantiateRev,
  mkApp,
  mkApps,
  mkConst,
  mkFVar,
  mkLam,
  mkPi,
  mkSort,
} from './expr.ts';
import { type Level, isNeverZero, levelEq, limax, lmax, lsucc, lzero, toNat } from './level.ts';
import { type Decl, Environment, LocalContext, type LocalDecl, freshFVarId } from './env.ts';
import { cubeAllows } from './calculus.ts';

// ---------------------------------------------------------------------------
// messages and errors

export type MsgPart = string | { e: Expr; lctx: LocalContext };
export type Msg = MsgPart[];

export class KernelError extends Error {
  constructor(
    readonly msg: Msg,
    readonly deriv?: Deriv,
  ) {
    super(msg.map((p) => (typeof p === 'string' ? p : '‹term›')).join(''));
  }
}

export class OutOfFuel extends Error {
  constructor() {
    super('deterministic timeout: reduction did not finish within the allotted fuel (the term may not terminate)');
  }
}

// ---------------------------------------------------------------------------
// derivations

export type SideCond =
  | { k: 'conv'; a: Expr; b: Expr; lctx: LocalContext; ok: boolean }
  | { k: 'whnf'; from: Expr; to: Expr; lctx: LocalContext }
  | { k: 'text'; text: string; ok?: boolean }
  | { k: 'lookup'; name: string; type: Expr; lctx: LocalContext };

export interface Deriv {
  rule: string;
  lctx: LocalContext;
  term: Expr;
  type: Expr | undefined; // undefined when the check failed at this node
  premises: Deriv[];
  side: SideCond[];
  failed?: boolean;
}

export interface TraceEvent {
  depth: number;
  kind: 'infer' | 'whnf' | 'defeq' | 'unfold' | 'iota' | 'beta';
  e: Expr;
  e2?: Expr;
  lctx: LocalContext;
  result?: Expr | boolean;
}

/** Hooks through which the elaborator lets the kernel machinery see metavariables. */
export interface MetaHooks {
  mvarType(id: number): Expr | undefined;
  mvarValue(id: number): Expr | undefined;
}

export interface TCOptions {
  meta?: MetaHooks;
  derive?: boolean;
  trace?: boolean;
  maxTrace?: number;
  fuel?: number;
}

// ---------------------------------------------------------------------------

export class TypeChecker {
  readonly env: Environment;
  lctx: LocalContext;
  private fuel: number;
  readonly derive: boolean;
  readonly traceOn: boolean;
  readonly traceEvents: TraceEvent[] = [];
  private maxTrace: number;
  private depth = 0;
  private whnfCache = new Map<Expr, Expr>();
  private whnfCoreCache = new Map<Expr, Expr>();
  private inferCache = new Map<Expr, Expr>();
  readonly meta?: MetaHooks;

  constructor(env: Environment, lctx: LocalContext = LocalContext.empty, opts: TCOptions = {}) {
    this.env = env;
    this.lctx = lctx;
    this.fuel = opts.fuel ?? 200_000;
    this.derive = opts.derive ?? false;
    this.traceOn = opts.trace ?? false;
    this.maxTrace = opts.maxTrace ?? 2000;
    this.meta = opts.meta;
  }

  /** remaining fuel (for reporting) */
  get fuelLeft(): number {
    return this.fuel;
  }

  setFuel(n: number): void {
    this.fuel = n;
  }

  get features() {
    return this.env.features;
  }

  private tick(): void {
    if (--this.fuel < 0) throw new OutOfFuel();
  }

  private trace(ev: Omit<TraceEvent, 'depth' | 'lctx'>): TraceEvent | undefined {
    if (!this.traceOn || this.traceEvents.length >= this.maxTrace) return undefined;
    const t: TraceEvent = { ...ev, depth: this.depth, lctx: this.lctx };
    this.traceEvents.push(t);
    return t;
  }

  private withLocal<T>(name: string, type: Expr, value: Expr | undefined, f: (fv: Expr, d: LocalDecl) => T): T {
    const d: LocalDecl = { id: freshFVarId(), name, type, value };
    const saved = this.lctx;
    this.lctx = this.lctx.push(d);
    try {
      return f(mkFVar(d.id), d);
    } finally {
      this.lctx = saved;
    }
  }

  // -------------------------------------------------------------------------
  // sorts

  /** the sort of a sort: Sort l : Sort (l+1) */
  private sortOfSort(l: Level): Level {
    if (this.features.cube) {
      if (toNat(l) === 0) return lsucc(lzero);
      throw new KernelError(['□ has no type: in a Pure Type System of the λ-cube the top sort is not typable']);
    }
    return lsucc(l);
  }

  /** the sort of Π (x : A), B where A : Sort u, B : Sort v */
  private piSort(u: Level, v: Level, lctx: LocalContext, dom: Expr, cod: Expr): Level {
    const f = this.features;
    if (f.cube) {
      const s1 = toNat(u)!;
      const s2 = toNat(v)!;
      if (!cubeAllows(f, s1, s2)) {
        const nm = (s: number) => (s === 0 ? '*' : '□');
        throw new KernelError([
          `the product rule (${nm(s1)}, ${nm(s2)}) is not available in ${f.name}: cannot form a Π-type whose domain `,
          { e: dom, lctx },
          ` : ${nm(s1)} and whose codomain `,
          { e: cod, lctx },
          ` : ${nm(s2)}`,
        ]);
      }
      return v;
    }
    return f.impredicativeProp ? limax(u, v) : lmax(u, v);
  }

  levelDefEq(a: Level, b: Level): boolean {
    if (this.features.typeInType) {
      const za = toNat(a) === 0;
      const zb = toNat(b) === 0;
      if (za || zb) return za === zb;
      return isNeverZero(a) === isNeverZero(b) || levelEq(a, b);
    }
    return levelEq(a, b);
  }

  // -------------------------------------------------------------------------
  // type inference

  /** Infer the type of `e`, fully checking it. */
  infer(e: Expr): Expr {
    return this.inferCore(e, true).type;
  }

  /** Infer the type of a term already known to be well-typed. */
  inferOnly(e: Expr): Expr {
    return this.inferCore(e, false).type;
  }

  /** Check `e` and return its derivation (requires `derive`). */
  inferDeriv(e: Expr): { type: Expr; deriv?: Deriv } {
    const r = this.inferCore(e, true);
    return { type: r.type, deriv: r.deriv };
  }

  /** Check `e : expected`, returning the derivation (with a final Conv step if needed). */
  check(e: Expr, expected: Expr): { deriv?: Deriv } {
    const r = this.inferCore(e, true);
    if (exprEq(r.type, expected)) return { deriv: r.deriv };
    const ok = this.isDefEq(r.type, expected);
    const deriv = this.derive
      ? {
          rule: 'conv',
          lctx: this.lctx,
          term: e,
          type: ok ? expected : undefined,
          premises: r.deriv ? [r.deriv] : [],
          side: [{ k: 'conv' as const, a: r.type, b: expected, lctx: this.lctx, ok }],
          failed: !ok,
        }
      : undefined;
    if (!ok) {
      throw new KernelError(
        ['type mismatch: the term\n  ', { e, lctx: this.lctx }, '\nhas type\n  ', { e: r.type, lctx: this.lctx }, '\nbut is expected to have type\n  ', { e: expected, lctx: this.lctx }],
        deriv,
      );
    }
    return { deriv };
  }

  private node(rule: string, term: Expr, type: Expr, premises: (Deriv | undefined)[], side: SideCond[] = []): Deriv | undefined {
    if (!this.derive) return undefined;
    return { rule, lctx: this.lctx, term, type, premises: premises.filter((p): p is Deriv => p !== undefined), side };
  }

  private failNode(rule: string, term: Expr, premises: (Deriv | undefined)[], side: SideCond[] = []): Deriv | undefined {
    if (!this.derive) return undefined;
    return { rule, lctx: this.lctx, term, type: undefined, premises: premises.filter((p): p is Deriv => p !== undefined), side, failed: true };
  }

  /** attach a failed partial derivation to errors thrown by `f` */
  private guard<T>(rule: string, term: Expr, premises: () => (Deriv | undefined)[], f: () => T): T {
    try {
      return f();
    } catch (err) {
      if (err instanceof KernelError && this.derive) {
        const ps = premises();
        const inner = err.deriv ? [...ps, err.deriv] : ps;
        throw new KernelError(err.msg, this.failNode(rule, term, inner));
      }
      throw err;
    }
  }

  private inferCore(e: Expr, check: boolean): { type: Expr; deriv?: Deriv } {
    if (!check && !this.derive) {
      const c = this.inferCache.get(e);
      if (c && !e.fv && !e.mv) return { type: c };
    }
    this.tick();
    const ev = this.trace({ kind: 'infer', e });
    this.depth++;
    try {
      const r = this.inferInner(e, check);
      if (ev) ev.result = r.type;
      if (!check && !this.derive && !e.fv && !e.mv) this.inferCache.set(e, r.type);
      return r;
    } finally {
      this.depth--;
    }
  }

  private inferInner(e: Expr, check: boolean): { type: Expr; deriv?: Deriv } {
    switch (e.k) {
      case 'bvar':
        throw new KernelError(['internal error: unexpected loose bound variable']);
      case 'mvar': {
        const t = this.meta?.mvarType(e.id);
        if (!t) throw new KernelError(['the kernel cannot check a term that still contains a hole (metavariable)']);
        return { type: t };
      }
      case 'fvar': {
        const d = this.lctx.get(e.id);
        if (!d) throw new KernelError(['unknown free variable']);
        return { type: d.type, deriv: this.node('var', e, d.type, [], [{ k: 'lookup', name: d.name, type: d.type, lctx: this.lctx }]) };
      }
      case 'sort': {
        const t = mkSort(this.sortOfSort(e.level));
        return { type: t, deriv: this.node('sort', e, t, []) };
      }
      case 'const': {
        const d = this.env.get(e.name);
        if (!d) throw new KernelError([`unknown constant '${e.name}'`]);
        if (d.levelParams.length !== e.levels.length) {
          throw new KernelError([`constant '${e.name}' expects ${d.levelParams.length} universe level argument(s), got ${e.levels.length}`]);
        }
        const t = instantiateLevelParamsExpr(d.type, d.levelParams, e.levels);
        return { type: t, deriv: this.node('const', e, t, [], [{ k: 'text', text: `${e.name} ∈ Σ (${declKindText(d)})` }]) };
      }
      case 'app':
        return this.inferApp(e, check);
      case 'lam':
        return this.inferLam(e, check);
      case 'pi':
        return this.inferPi(e, check);
      case 'let':
        return this.inferLet(e, check);
    }
  }

  private inferApp(e: Extract<Expr, { k: 'app' }>, check: boolean): { type: Expr; deriv?: Deriv } {
    const fr = this.inferCore(e.fn, check);
    let fnType = fr.type;
    const side: SideCond[] = [];
    let piT = this.whnf(fnType);
    if (piT.k !== 'pi') {
      throw new KernelError(
        ['function expected: the term\n  ', { e: e.fn, lctx: this.lctx }, '\nhas type\n  ', { e: fnType, lctx: this.lctx }, '\nwhich is not a Π-type, so it cannot be applied to\n  ', { e: e.arg, lctx: this.lctx }],
        this.failNode('app', e, [fr.deriv]),
      );
    }
    if (this.derive && !exprEq(piT, fnType)) side.push({ k: 'whnf', from: fnType, to: piT, lctx: this.lctx });
    const ar = this.guard('app', e, () => [fr.deriv], () => this.inferCore(e.arg, check));
    if (check) {
      const ok = exprEq(ar.type, piT.type) || this.isDefEq(ar.type, piT.type);
      if (this.derive && !exprEq(ar.type, piT.type)) side.push({ k: 'conv', a: ar.type, b: piT.type, lctx: this.lctx, ok });
      if (!ok) {
        throw new KernelError(
          [
            'application type mismatch: in\n  ',
            { e, lctx: this.lctx },
            '\nthe argument\n  ',
            { e: e.arg, lctx: this.lctx },
            '\nhas type\n  ',
            { e: ar.type, lctx: this.lctx },
            '\nbut the function expects an argument of type\n  ',
            { e: piT.type, lctx: this.lctx },
          ],
          this.failNode('app', e, [fr.deriv, ar.deriv], side),
        );
      }
    }
    const t = instantiate1(piT.body, e.arg);
    return { type: t, deriv: this.node('app', e, t, [fr.deriv, ar.deriv], side) };
  }

  /** infer the sort of a type, failing if it is not a type */
  private inferSort(t: Expr, check: boolean, ctxTerm: Expr): { level: Level; deriv?: Deriv } {
    const r = this.inferCore(t, check);
    const s = this.whnf(r.type);
    if (s.k !== 'sort') {
      throw new KernelError(
        ['type expected: the term\n  ', { e: t, lctx: this.lctx }, '\nhas type\n  ', { e: r.type, lctx: this.lctx }, '\nwhich is not a sort, so it cannot be used as the type of a variable in\n  ', { e: ctxTerm, lctx: this.lctx }],
        r.deriv,
      );
    }
    return { level: s.level, deriv: r.deriv };
  }

  private inferLam(e: Extract<Expr, { k: 'lam' }>, check: boolean): { type: Expr; deriv?: Deriv } {
    // open all consecutive λs at once
    const fvars: number[] = [];
    const saved = this.lctx;
    const tyDerivs: (Deriv | undefined)[] = [];
    const domSorts: Level[] = [];
    let cur: Expr = e;
    try {
      while (cur.k === 'lam') {
        const ty = instantiateRev(cur.type, fvars.map(mkFVar));
        if (check) {
          const sr = this.guard('lam', e, () => tyDerivs, () => this.inferSort(ty, true, e));
          tyDerivs.push(sr.deriv);
          domSorts.push(sr.level);
        }
        const d: LocalDecl = { id: freshFVarId(), name: cur.name, type: ty, binfo: cur.binfo };
        this.lctx = this.lctx.push(d);
        fvars.push(d.id);
        cur = cur.body;
        if (this.derive) break; // one binder per derivation node
      }
      const body = instantiateRev(cur, fvars.map(mkFVar));
      const br = this.guard('lam', e, () => tyDerivs, () => this.inferCore(body, check));
      const premises: (Deriv | undefined)[] = [...tyDerivs, br.deriv];
      // In a PTS the resulting Π-type must itself be formable.
      if (check && this.features.cube) {
        const bs = this.guard('lam', e, () => premises, () => this.inferSort(br.type, true, e));
        this.piSort(domSorts[domSorts.length - 1], bs.level, this.lctx, this.lctx.get(fvars[fvars.length - 1])!.type, br.type);
      }
      let type = abstractFVars(br.type, fvars);
      let resBody: Expr = type;
      for (let i = fvars.length - 1; i >= 0; i--) {
        const d = this.lctx.get(fvars[i])!;
        resBody = mkPi(d.name, abstractFVars(d.type, fvars.slice(0, i)), resBody, d.binfo);
      }
      type = resBody;
      this.lctx = saved;
      return { type, deriv: this.node('lam', e, type, premises) };
    } finally {
      this.lctx = saved;
    }
  }

  private inferPi(e: Extract<Expr, { k: 'pi' }>, check: boolean): { type: Expr; deriv?: Deriv } {
    const saved = this.lctx;
    try {
      const dom = e.type;
      const ds = this.guard('pi', e, () => [], () => this.inferSort(dom, check, e));
      const d: LocalDecl = { id: freshFVarId(), name: e.name, type: dom, binfo: e.binfo };
      this.lctx = this.lctx.push(d);
      const cod = instantiate1(e.body, mkFVar(d.id));
      const cs = this.guard('pi', e, () => [ds.deriv], () => this.inferSort(cod, check, e));
      this.lctx = saved;
      const lvl = this.guard('pi', e, () => [ds.deriv, cs.deriv], () => this.piSort(ds.level, cs.level, this.lctx.push(d), dom, cod));
      const t = mkSort(lvl);
      const side: SideCond[] = [];
      if (this.derive && this.features.cube) {
        const nm = (l: Level) => (toNat(l) === 0 ? '*' : '□');
        side.push({ k: 'text', text: `(${nm(ds.level)}, ${nm(cs.level)}) ∈ R` });
      }
      return { type: t, deriv: this.node('pi', e, t, [ds.deriv, cs.deriv], side) };
    } finally {
      this.lctx = saved;
    }
  }

  private inferLet(e: Extract<Expr, { k: 'let' }>, check: boolean): { type: Expr; deriv?: Deriv } {
    const premises: (Deriv | undefined)[] = [];
    const side: SideCond[] = [];
    if (check) {
      const ts = this.inferSort(e.type, true, e);
      premises.push(ts.deriv);
      const vr = this.inferCore(e.value, true);
      premises.push(vr.deriv);
      const ok = this.isDefEq(vr.type, e.type);
      if (this.derive && !exprEq(vr.type, e.type)) side.push({ k: 'conv', a: vr.type, b: e.type, lctx: this.lctx, ok });
      if (!ok) {
        throw new KernelError(['let: the value\n  ', { e: e.value, lctx: this.lctx }, '\nhas type\n  ', { e: vr.type, lctx: this.lctx }, '\nbut the declared type is\n  ', { e: e.type, lctx: this.lctx }], this.failNode('let', e, premises, side));
      }
    }
    return this.withLocal(e.name, e.type, e.value, (fv, d) => {
      const br = this.inferCore(instantiate1(e.body, fv), check);
      premises.push(br.deriv);
      const t = instantiate1(abstractFVars(br.type, [d.id]), e.value);
      return { type: t, deriv: this.node('let', e, t, premises, side) };
    });
  }

  // -------------------------------------------------------------------------
  // weak head normal form

  /** β, ζ, ι and quotient reduction at the head, but no δ-unfolding. */
  whnfCore(e: Expr): Expr {
    switch (e.k) {
      case 'mvar': {
        const v = this.meta?.mvarValue(e.id);
        return v ? this.whnfCore(v) : e;
      }
      case 'bvar':
      case 'sort':
      case 'pi':
      case 'lam':
      case 'const':
        return e;
      case 'fvar': {
        const d = this.lctx.get(e.id);
        if (d?.value) return this.whnfCore(d.value);
        return e;
      }
      default:
        break;
    }
    const cached = this.whnfCoreCache.get(e);
    if (cached && !e.fv && !e.mv) return cached;
    this.tick();
    let r: Expr;
    if (e.k === 'let') {
      r = this.whnfCore(instantiate1(e.body, e.value));
    } else {
      const fn0 = getAppFn(e);
      const fn = this.whnfCore(fn0);
      const args = getAppArgs(e);
      if (fn.k === 'lam') {
        let f: Expr = fn;
        let i = 0;
        while (f.k === 'lam' && i < args.length) {
          f = f.body;
          i++;
        }
        this.trace({ kind: 'beta', e });
        r = this.whnfCore(mkApps(instantiateRev(f, args.slice(0, i)), args.slice(i)));
      } else if (fn.k === 'const') {
        const red = this.reduceRecursor(fn, args) ?? this.reduceQuot(fn, args);
        r = red ? this.whnfCore(red) : fn === fn0 ? e : mkApps(fn, args);
      } else {
        r = fn === fn0 ? e : mkApps(fn, args);
      }
    }
    if (!e.fv && !e.mv) this.whnfCoreCache.set(e, r);
    return r;
  }

  /** δ-unfold the head constant once, if it is a definition. */
  unfoldDefinition(e: Expr): Expr | undefined {
    const fn = getAppFn(e);
    if (fn.k !== 'const') return undefined;
    const d = this.env.get(fn.name);
    if (!d || (d.kind !== 'def' && d.kind !== 'theorem')) return undefined;
    if (d.levelParams.length !== fn.levels.length) return undefined;
    this.tick();
    this.trace({ kind: 'unfold', e: fn });
    const v = instantiateLevelParamsExpr(d.value, d.levelParams, fn.levels);
    return mkApps(v, getAppArgs(e));
  }

  whnf(e: Expr): Expr {
    switch (e.k) {
      case 'mvar': {
        const v = this.meta?.mvarValue(e.id);
        return v ? this.whnf(v) : e;
      }
      case 'bvar':
      case 'sort':
      case 'pi':
      case 'lam':
        return e;
      default:
        break;
    }
    const cached = this.whnfCache.get(e);
    if (cached && !e.fv && !e.mv) return cached;
    let t: Expr = e;
    for (;;) {
      const t1 = this.whnfCore(t);
      const t2 = this.unfoldDefinition(t1);
      if (!t2) {
        t = t1;
        break;
      }
      t = t2;
    }
    if (!e.fv && !e.mv) this.whnfCache.set(e, t);
    return t;
  }

  private reduceRecursor(fn: Extract<Expr, { k: 'const' }>, args: Expr[]): Expr | undefined {
    const d = this.env.get(fn.name);
    if (!d || d.kind !== 'rec') return undefined;
    if (args.length <= d.majorIdx) return undefined;
    let major = this.whnf(args[d.majorIdx]);
    if (d.k) major = this.toCtorWhenK(d, major, args) ?? major;
    let ctorFn = getAppFn(major);
    if (ctorFn.k !== 'const') {
      major = this.toCtorWhenStructure(d, major) ?? major;
      ctorFn = getAppFn(major);
      if (ctorFn.k !== 'const') return undefined;
    }
    const cfn = ctorFn;
    const rule = d.rules.find((r) => r.ctor === cfn.name);
    if (!rule) return undefined;
    const majorArgs = getAppArgs(major);
    if (majorArgs.length !== d.numParams + rule.nfields) return undefined;
    this.trace({ kind: 'iota', e: mkApps(fn, args) });
    const rhs = instantiateLevelParamsExpr(rule.rhs, d.levelParams, fn.levels);
    const pmm = args.slice(0, d.numParams + d.numMotives + d.numMinors);
    const fields = majorArgs.slice(d.numParams);
    return mkApps(mkApps(mkApps(rhs, pmm), fields), args.slice(d.majorIdx + 1));
  }

  /** K-like reduction: for Eq-like types the major premise can be replaced by the constructor. */
  private toCtorWhenK(d: Extract<Decl, { kind: 'rec' }>, major: Expr, args: Expr[]): Expr | undefined {
    const ind = this.env.get(d.induct);
    if (!ind || ind.kind !== 'inductive') return undefined;
    let mt: Expr;
    try {
      mt = this.whnf(this.inferOnly(major));
    } catch {
      return undefined;
    }
    const h = getAppFn(mt);
    if (h.k !== 'const' || h.name !== d.induct) return undefined;
    const ctorName = ind.ctors[0];
    const ctor = mkApps(mkConst(ctorName, h.levels), getAppArgs(mt).slice(0, d.numParams));
    let ct: Expr;
    try {
      ct = this.inferOnly(ctor);
    } catch {
      return undefined;
    }
    void args;
    return this.isDefEq(mt, ct) ? ctor : undefined;
  }

  /** structure η in ι-reduction: rec m p ↦ rec m ⟨p.1, …, p.n⟩ */
  private toCtorWhenStructure(d: Extract<Decl, { kind: 'rec' }>, major: Expr): Expr | undefined {
    if (!this.features.structEta) return undefined;
    const ind = this.env.get(d.induct);
    if (!ind || ind.kind !== 'inductive' || !ind.isStructure) return undefined;
    const projs = structureProjections(this.env, ind.name);
    if (!projs) return undefined;
    let mt: Expr;
    try {
      mt = this.whnf(this.inferOnly(major));
    } catch {
      return undefined;
    }
    const h = getAppFn(mt);
    if (h.k !== 'const' || h.name !== ind.name) return undefined;
    // Prop-valued structures are handled by proof irrelevance instead
    if (this.isPropType(mt)) return undefined;
    const params = getAppArgs(mt);
    const fields = projs.map((p) => mkApps(mkConst(p, h.levels), [...params, major]));
    return mkApps(mkConst(ind.ctors[0], h.levels), [...params, ...fields]);
  }

  private reduceQuot(fn: Extract<Expr, { k: 'const' }>, args: Expr[]): Expr | undefined {
    const d = this.env.get(fn.name);
    if (!d || d.kind !== 'quot') return undefined;
    let mkPos: number, argPos: number;
    if (d.quotKind === 'lift') {
      mkPos = 5;
      argPos = 3;
    } else if (d.quotKind === 'ind') {
      mkPos = 4;
      argPos = 3;
    } else return undefined;
    if (args.length <= mkPos) return undefined;
    const mk = this.whnf(args[mkPos]);
    const mkFn = getAppFn(mk);
    if (mkFn.k !== 'const' || mkFn.name !== 'Quot.mk') return undefined;
    const mkArgs = getAppArgs(mk);
    if (mkArgs.length !== 3) return undefined;
    return mkApps(mkApp(args[argPos], mkArgs[2]), args.slice(mkPos + 1));
  }

  // -------------------------------------------------------------------------
  // definitional equality

  isPropType(t: Expr): boolean {
    try {
      const s = this.whnf(this.inferOnly(t));
      return s.k === 'sort' && toNat(s.level) === 0;
    } catch {
      return false;
    }
  }

  /** is `e` a proof (a term whose type is a proposition)? returns its type */
  private isProof(e: Expr): Expr | undefined {
    try {
      const t = this.inferOnly(e);
      return this.isPropType(t) ? t : undefined;
    } catch {
      return undefined;
    }
  }

  isDefEq(a: Expr, b: Expr): boolean {
    const ev = this.trace({ kind: 'defeq', e: a, e2: b });
    this.depth++;
    try {
      const r = this.isDefEqCore(a, b);
      if (ev) ev.result = r;
      return r;
    } finally {
      this.depth--;
    }
  }

  private isDefEqCore(a: Expr, b: Expr): boolean {
    this.tick();
    if (a === b || exprEq(a, b)) return true;
    const q = this.quickDefEq(a, b);
    if (q !== undefined) return q;

    // proof irrelevance
    if (this.features.proofIrrelevance) {
      const ta = this.isProof(a);
      if (ta) {
        const tb = this.isProof(b);
        if (tb) return this.isDefEq(ta, tb);
      }
    }

    let a1 = this.whnfCore(a);
    let b1 = this.whnfCore(b);
    if (a1 !== a || b1 !== b) {
      if (exprEq(a1, b1)) return true;
      const q2 = this.quickDefEq(a1, b1);
      if (q2 !== undefined) return q2;
    }

    // lazy δ-reduction: unfold the side with the larger definitional height
    for (;;) {
      const ha = this.defHeight(a1);
      const hb = this.defHeight(b1);
      if (ha < 0 && hb < 0) break;
      const fa = getAppFn(a1);
      const fb = getAppFn(b1);
      if (ha >= 0 && hb >= 0 && fa.k === 'const' && fb.k === 'const' && fa.name === fb.name) {
        // same head: try comparing arguments before unfolding
        if (fa.levels.every((l, i) => this.levelDefEq(l, fb.levels[i])) && this.isDefEqArgs(a1, b1)) return true;
        a1 = this.whnfCore(this.unfoldDefinition(a1)!);
        b1 = this.whnfCore(this.unfoldDefinition(b1)!);
      } else if (ha >= hb) {
        a1 = this.whnfCore(this.unfoldDefinition(a1)!);
      } else {
        b1 = this.whnfCore(this.unfoldDefinition(b1)!);
      }
      if (exprEq(a1, b1)) return true;
      const q3 = this.quickDefEq(a1, b1);
      if (q3 !== undefined) return q3;
    }

    // both in whnf
    const fa = getAppFn(a1);
    const fb = getAppFn(b1);
    if (fa.k === 'const' && fb.k === 'const' && fa.name === fb.name) {
      if (fa.levels.length === fb.levels.length && fa.levels.every((l, i) => this.levelDefEq(l, fb.levels[i])) && this.isDefEqArgs(a1, b1)) return true;
    }
    if (fa.k === 'fvar' && fb.k === 'fvar' && fa.id === fb.id) {
      if (this.isDefEqArgs(a1, b1)) return true;
    }
    // η for functions
    if (this.features.eta) {
      if (a1.k === 'lam' && b1.k !== 'lam') return this.tryEta(a1, b1);
      if (b1.k === 'lam' && a1.k !== 'lam') return this.tryEta(b1, a1);
    }
    // η for structures and unit-like types
    if (this.features.structEta) {
      if (this.tryStructEta(a1, b1) || this.tryStructEta(b1, a1)) return true;
      if (this.isDefEqUnitLike(a1, b1)) return true;
    }
    return false;
  }

  /** decide equality structurally for binders and sorts; undefined = don't know */
  private quickDefEq(a: Expr, b: Expr): boolean | undefined {
    if (a.k === 'sort' && b.k === 'sort') return this.levelDefEq(a.level, b.level);
    if ((a.k === 'lam' && b.k === 'lam') || (a.k === 'pi' && b.k === 'pi')) {
      if (!this.isDefEq(a.type, b.type)) return false;
      return this.withLocal(a.name, a.type, undefined, (fv) => this.isDefEq(instantiate1(a.body, fv), instantiate1(b.body, fv)));
    }
    return undefined;
  }

  private isDefEqArgs(a: Expr, b: Expr): boolean {
    const as = getAppArgs(a);
    const bs = getAppArgs(b);
    if (as.length !== bs.length) return false;
    for (let i = 0; i < as.length; i++) if (!this.isDefEq(as[i], bs[i])) return false;
    return true;
  }

  private tryEta(lam: Extract<Expr, { k: 'lam' }>, other: Expr): boolean {
    // λ x, t  ≡  f   iff   t ≡ f x
    return this.withLocal(lam.name, lam.type, undefined, (fv) => this.isDefEq(instantiate1(lam.body, fv), mkApp(other, fv)));
  }

  private tryStructEta(a: Expr, b: Expr): boolean {
    // a = mk f₁ … fₙ  and b : S params   ⟹   fᵢ ≡ projᵢ b
    const fa = getAppFn(a);
    if (fa.k !== 'const') return false;
    const cd = this.env.get(fa.name);
    if (!cd || cd.kind !== 'ctor') return false;
    const ind = this.env.get(cd.induct);
    if (!ind || ind.kind !== 'inductive' || !ind.isStructure) return false;
    const args = getAppArgs(a);
    if (args.length !== cd.numParams + cd.numFields) return false;
    const projs = structureProjections(this.env, ind.name);
    if (!projs) return false;
    let bt: Expr;
    try {
      bt = this.inferOnly(b);
    } catch {
      return false;
    }
    if (!this.isDefEq(this.inferOnly(a), bt)) return false;
    const params = args.slice(0, cd.numParams);
    for (let i = 0; i < cd.numFields; i++) {
      const pi = mkApps(mkConst(projs[i], fa.levels), [...params, b]);
      if (!this.isDefEq(args[cd.numParams + i], pi)) return false;
    }
    return true;
  }

  private isDefEqUnitLike(a: Expr, b: Expr): boolean {
    let t: Expr;
    try {
      t = this.whnf(this.inferOnly(a));
    } catch {
      return false;
    }
    const h = getAppFn(t);
    if (h.k !== 'const') return false;
    const ind = this.env.get(h.name);
    if (!ind || ind.kind !== 'inductive' || ind.ctors.length !== 1 || ind.isRec || ind.numIndices !== 0) return false;
    const c = this.env.get(ind.ctors[0]);
    if (!c || c.kind !== 'ctor' || c.numFields !== 0) return false;
    try {
      return this.isDefEq(t, this.inferOnly(b));
    } catch {
      return false;
    }
  }

  /** definitional height of the head constant; −1 if it cannot be unfolded */
  private defHeight(e: Expr): number {
    const fn = getAppFn(e);
    if (fn.k !== 'const') return -1;
    const d = this.env.get(fn.name);
    if (!d) return -1;
    if (d.kind === 'def') return d.height;
    if (d.kind === 'theorem') return 0;
    return -1;
  }

  // -------------------------------------------------------------------------
  // helpers used by other kernel modules

  ensureSort(t: Expr): Level {
    const s = this.whnf(t);
    if (s.k !== 'sort') throw new KernelError(['type expected, got\n  ', { e: t, lctx: this.lctx }]);
    return s.level;
  }

  ensurePi(t: Expr): Extract<Expr, { k: 'pi' }> {
    const s = this.whnf(t);
    if (s.k !== 'pi') throw new KernelError(['function type expected, got\n  ', { e: t, lctx: this.lctx }]);
    return s;
  }

  /** open a telescope of Π binders into the local context, returning the fvars and the rest */
  openPis(t: Expr, n = Infinity, whnfFirst = false): { fvars: FVar[]; body: Expr } {
    const fvars: FVar[] = [];
    let cur = t;
    while (fvars.length < n) {
      if (cur.k !== 'pi' && whnfFirst) cur = this.whnf(cur);
      if (cur.k !== 'pi') break;
      const d: LocalDecl = { id: freshFVarId(), name: cur.name, type: cur.type, binfo: cur.binfo };
      this.lctx = this.lctx.push(d);
      const fv = mkFVar(d.id) as FVar;
      fvars.push(fv);
      cur = instantiate1(cur.body, fv);
    }
    return { fvars, body: cur };
  }

  /** abstract fvars (created in this.lctx) into Π or λ binders */
  mkBinding(kind: 'pi' | 'lam', fvars: Expr[], body: Expr): Expr {
    const ids = fvars.map((f) => (f as Extract<Expr, { k: 'fvar' }>).id);
    let r = abstractFVars(body, ids);
    for (let i = ids.length - 1; i >= 0; i--) {
      const d = this.lctx.get(ids[i])!;
      const ty = abstractFVars(d.type, ids.slice(0, i));
      r = kind === 'pi' ? mkPi(d.name, ty, r, d.binfo) : mkLam(d.name, ty, r, d.binfo);
    }
    return r;
  }

  /** full normalisation (strong reduction), used by #reduce */
  normalize(e: Expr): Expr {
    const w = this.whnf(e);
    switch (w.k) {
      case 'lam':
      case 'pi': {
        const ty = this.normalize(w.type);
        return this.withLocal(w.name, w.type, undefined, (fv, d) => {
          const b = this.normalize(instantiate1(w.body, fv));
          const ab = abstractFVars(b, [d.id]);
          return w.k === 'lam' ? mkLam(w.name, ty, ab, w.binfo) : mkPi(w.name, ty, ab, w.binfo);
        });
      }
      case 'app': {
        const fn = getAppFn(w);
        const args = getAppArgs(w).map((a) => this.normalize(a));
        return mkApps(fn, args);
      }
      default:
        return w;
    }
  }
}

function declKindText(d: Decl): string {
  switch (d.kind) {
    case 'axiom':
      return 'axiom';
    case 'def':
      return 'definition';
    case 'theorem':
      return 'theorem';
    case 'opaque':
      return 'opaque';
    case 'inductive':
      return 'inductive type';
    case 'ctor':
      return 'constructor';
    case 'rec':
      return 'recursor';
    case 'quot':
      return 'quotient primitive';
  }
}

/** names of the projection functions of a structure-like inductive, if generated */
export function structureProjections(env: Environment, ind: string): string[] | undefined {
  const d = env.get(ind);
  if (!d || d.kind !== 'inductive' || !d.isStructure) return undefined;
  const c = env.get(d.ctors[0]);
  if (!c || c.kind !== 'ctor') return undefined;
  const names = d.projs;
  if (!names || names.length !== c.numFields) return undefined;
  return names;
}

export { lzero, lsucc };
