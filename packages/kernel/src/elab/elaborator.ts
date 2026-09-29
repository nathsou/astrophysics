// Term elaboration: surface syntax ⟶ core expressions.

import {
  type Expr,
  type FVar,
  abstractFVars,
  exprEq,
  getAppArgs,
  getAppFn,
  instantiate1,
  mkApp,
  mkConst,
  mkFVar,
  mkLet,
  mkSort,
  mkPi,
  liftLooseBVars,
} from '../core/expr.ts';
import { type Level, lofNat, lparam, lsucc, lzero, lmax, limax, toNat } from '../core/level.ts';
import { Environment, LocalContext, type LocalDecl, freshFVarId } from '../core/env.ts';
import { KernelError, type Msg, structureProjections } from '../core/typechecker.ts';
import type { SArg, SBinder, SLevel, STerm, Span, Tactic } from '../syntax/ast.ts';
import type { TacticStep } from './tactics.ts';
import { MetaCtx, Unifier, type MVarKind } from './meta.ts';
import { elabMatch } from './match.ts';
import { synthInstance } from './instances.ts';
import { runTacticBlock } from './tactics.ts';
import { elabCalc, elabSubst } from './calc.ts';
import { ElabError, AutoBound } from './errors.ts';

export { ElabError, AutoBound };

export interface InfoItem {
  span: Span;
  expr: Expr;
  lctx: LocalContext;
  /** expected type, if known */
  expected?: Expr;
  kind: 'term' | 'binder' | 'const' | 'sort';
}

export interface Warning {
  span: Span;
  msg: Msg;
}

export interface RecInfo {
  fn: FVar;
  name: string;
}

const AUTO_BOUND_RE = /^[a-zA-Zα-κμ-ω][0-9₀-₉']*$/;

export class Elaborator {
  readonly mctx = new MetaCtx();
  readonly u: Unifier;
  infos: InfoItem[] = [];
  warnings: Warning[] = [];
  /** universe level names in scope */
  levelNames: string[] = [];
  /** automatically bind unknown universe names / single-letter identifiers */
  autoBoundLevels = false;
  autoBoundImplicits = false;
  newLevelParams: string[] = [];
  namespace = '';
  /** pattern variables bound by match compilation */
  aliases = new Map<string, Expr>();
  usesSorry = false;
  rec?: RecInfo;
  /** well-founded recursion: rewrites the recursive calls of each leaf of a match, in the leaf's context */
  leafHook?: (rhs: Expr) => Expr;
  /** the local standing for a function defined by well-founded recursion (for its equation lemmas) */
  wfFn?: FVar;
  /** elaboration problems postponed until their expected type is known */
  pending: { m: Expr; s: STerm; lctx: LocalContext; aliases: Map<string, Expr>; type: Expr }[] = [];
  /** instance arguments still to be synthesized */
  instPending: { m: Expr; lctx: LocalContext; span: Span }[] = [];
  /** tactic blocks still to be run */
  tacticBlocks: { m: Expr; tac: Tactic; lctx: LocalContext; aliases: Map<string, Expr>; span: Span }[] = [];
  /** the goals before and after each tactic, for the infoview and the lens */
  tacticSteps: TacticStep[] = [];
  /** errors that did not abort elaboration (failed tactics are reported and their goals admitted) */
  errors: { span: Span; msg: Msg; goals?: import('./tactics.ts').GoalSnap[] }[] = [];
  /** fuel for tactic blocks (reset per declaration) */
  tacticDepth = 0;
  /** leaves of the case tree of the definition being elaborated (for its equation lemmas) */
  eqnLeaves?: import('./match.ts').EqnLeaf[];
  /** called whenever a synthetic hole `?x` is elaborated (tactics use it to find the goals of a match) */
  holeHook?: (name: string, m: Expr, aliases: Map<string, Expr>) => void;

  constructor(readonly env: Environment) {
    this.u = new Unifier(env, this.mctx);
  }

  get lctx(): LocalContext {
    return this.u.lctx;
  }
  set lctx(l: LocalContext) {
    this.u.lctx = l;
  }

  get cube(): boolean {
    return this.env.features.cube !== undefined;
  }

  // -------------------------------------------------------------------------
  // utilities

  err(span: Span, ...msg: Msg): never {
    throw new ElabError(msg, span);
  }

  term(e: Expr): { e: Expr; lctx: LocalContext } {
    // pattern variables are shown under the names the user gave them
    return { e: this.mctx.instantiate(e), lctx: this.lctxWithAliases() };
  }

  instantiate(e: Expr): Expr {
    return this.mctx.instantiate(e);
  }

  whnf(e: Expr): Expr {
    return this.u.whnf(e);
  }

  inferType(e: Expr, span?: Span): Expr {
    try {
      return this.u.inferType(e);
    } catch (err) {
      if (err instanceof KernelError && span) throw new ElabError(err.msg, span);
      throw err;
    }
  }

  isDefEq(a: Expr, b: Expr): boolean {
    return this.u.isDefEq(a, b);
  }

  pushLocal(name: string, type: Expr, binfo: LocalDecl['binfo'] = 'default', value?: Expr): FVar {
    const d: LocalDecl = { id: freshFVarId(), name, type, binfo, value };
    this.lctx = this.lctx.push(d);
    return mkFVar(d.id) as FVar;
  }

  withSavedLctx<T>(f: () => T): T {
    const saved = this.lctx;
    const savedAliases = new Map(this.aliases);
    try {
      return f();
    } finally {
      this.lctx = saved;
      this.aliases = savedAliases;
    }
  }

  mkBinding(kind: 'lam' | 'pi', fvars: Expr[], body: Expr): Expr {
    const ids = fvars.map((f) => (f as FVar).id);
    let r = abstractFVars(this.instantiate(body), ids);
    for (let i = ids.length - 1; i >= 0; i--) {
      const d = this.lctx.get(ids[i])!;
      const ty = abstractFVars(this.instantiate(d.type), ids.slice(0, i));
      r = kind === 'pi' ? { ...mkPiLike('pi', d.name, ty, r, d.binfo ?? 'default') } : mkPiLike('lam', d.name, ty, r, d.binfo ?? 'default');
    }
    return r;
  }

  newMVar(type: Expr, kind: MVarKind = 'natural', extra: { span?: Span; what?: string; name?: string } = {}): Expr {
    return this.mctx.newMVar(kind === 'synthetic' ? this.lctxWithAliases() : this.lctx, type, kind, extra);
  }

  /** the local context with pattern variables shown under the names the user gave them */
  lctxWithAliases(): LocalContext {
    if (this.aliases.size === 0) return this.lctx;
    const rename = new Map<number, string>();
    for (const [n, e] of this.aliases) {
      const v = this.instantiate(e);
      if (v.k === 'fvar' && this.lctx.get(v.id) && !n.startsWith('__')) rename.set(v.id, n);
    }
    if (rename.size === 0) return this.lctx;
    // a later local with the same name shadows the pattern variable: keep the original names then
    let l = LocalContext.empty;
    for (const d of this.lctx.decls) l = l.push(rename.has(d.id) ? { ...d, name: rename.get(d.id)! } : d);
    return l;
  }

  /** a metavariable for an instance argument; it is solved by type-class resolution */
  newInstMVar(type: Expr, span?: Span): Expr {
    const m = this.newMVar(type, 'instance', { span, what: 'instance argument' });
    this.instPending.push({ m, lctx: this.lctx, span: span ?? { from: 0, to: 0 } });
    return m;
  }

  newTypeMVar(span?: Span, what?: string): Expr {
    return this.newMVar(mkSort(this.mctx.newLevel()), 'natural', { span, what });
  }

  record(span: Span, expr: Expr, kind: InfoItem['kind'] = 'term', expected?: Expr): void {
    this.infos.push({ span, expr, lctx: this.lctx, kind, expected });
  }

  // -------------------------------------------------------------------------
  // name resolution

  resolveGlobal(name: string): string | undefined {
    const env = this.env;
    // current namespace and its parents
    if (this.namespace) {
      const parts = this.namespace.split('.');
      for (let i = parts.length; i > 0; i--) {
        const cand = parts.slice(0, i).join('.') + '.' + name;
        if (env.has(cand)) return cand;
      }
    }
    if (env.has(name)) return name;
    for (const ns of env.opened) {
      const cand = ns + '.' + name;
      if (env.has(cand)) return cand;
    }
    return undefined;
  }

  private constExpr(name: string, levels: SLevel[] | undefined, span: Span): { e: Expr; type: Expr } {
    const d = this.env.get(name)!;
    let ls: Level[];
    if (levels) {
      if (levels.length !== d.levelParams.length) this.err(span, `'${name}' has ${d.levelParams.length} universe parameter(s), but ${levels.length} were given`);
      ls = levels.map((l) => this.elabLevel(l, span));
    } else ls = d.levelParams.map(() => this.mctx.newLevel());
    const e = mkConst(name, ls);
    const type = this.inferType(e, span);
    return { e, type };
  }

  /** resolve an identifier to a head expression, without inserting implicit arguments */
  private resolveIdent(s: Extract<STerm, { k: 'ident' }>): Resolved {
    const name = s.name;
    if (s.root && this.env.has(name)) return this.constExpr(name, s.levels, s.span);
    // pattern aliases
    const al = this.aliases.get(name);
    if (al) return { e: al, type: this.inferType(al, s.span) };
    // locals
    const local = this.lctx.findByName(name);
    if (local) return { e: mkFVar(local.id), type: local.type };
    // the function being defined, by its short name (`hasDecEq` inside `def List.hasDecEq`)
    if (this.rec && this.namespace && `${this.namespace}.${name}` === this.rec.name) return { e: this.rec.fn, type: this.lctx.get(this.rec.fn.id)!.type };
    // globals
    const g = this.resolveGlobal(name);
    if (g) return this.constExpr(g, s.levels, s.span);
    // dotted: field access on a local or global prefix
    const parts = name.split('.');
    for (let k = parts.length - 1; k >= 1; k--) {
      const prefix = parts.slice(0, k).join('.');
      const base: STerm = { k: 'ident', name: prefix, explicit: false, span: { from: s.span.from, to: s.span.from + prefix.length } };
      if (this.aliases.has(prefix) || this.lctx.findByName(prefix) || this.resolveGlobal(prefix)) {
        let r = this.resolveIdent(base as Extract<STerm, { k: 'ident' }>);
        r = { e: r.e, type: r.type };
        // insert implicits of the base before projecting
        const ins = this.insertImplicits(r.e, r.type);
        let cur = ins;
        let off = s.span.from + prefix.length + 1;
        let res: Resolved = cur;
        for (const field of parts.slice(k)) {
          if (res.base) this.err(s.span, `field notation '.${field}' applied to a partial application; add parentheses and arguments`);
          res = this.fieldAccess(res.e, res.type, field, { from: s.span.from, to: off + field.length });
          off += field.length + 1;
        }
        return res;
      }
    }
    if (this.autoBoundImplicits && AUTO_BOUND_RE.test(name)) throw new AutoBound(name);
    this.err(s.span, `unknown identifier '${name}'`);
  }

  /** generalized field notation: `e.f` where e : I … resolves to I.f with e as the first explicit argument of type I */
  fieldAccess(base: Expr, baseType: Expr, field: string, span: Span): Resolved {
    // the type's own name first (`env.set` with `env : Env`, where Env unfolds to a function type)
    const t0 = this.instantiate(baseType);
    const h0 = getAppFn(t0);
    const t = h0.k === 'const' && this.env.has(`${h0.name}.${field}`) ? t0 : this.whnf(t0);
    const head = getAppFn(t);
    if (head.k !== 'const') {
      if (t.k === 'pi') this.err(span, `invalid field notation '.${field}': the value is a function`);
      if (t.k === 'sort' && base.k === 'const') this.err(span, `unknown identifier '${base.name}.${field}'`);
      this.err(span, `invalid field notation '.${field}': the type of the value is not known yet (`, this.term(baseType), `)`);
    }
    const I = head.name;
    let fname: string | undefined;
    if (/^[0-9]+$/.test(field)) {
      const projs = structureProjections(this.env, I);
      const idx = Number(field) - 1;
      if (!projs || idx < 0 || idx >= projs.length) this.err(span, `invalid projection '.${field}' for a value of type `, this.term(t));
      fname = projs[idx];
    } else if (this.env.has(`${I}.${field}`)) fname = `${I}.${field}`;
    // the function being defined, called through field notation (`t.size` inside `Tree.size`)
    let fc: { e: Expr; type: Expr } | undefined;
    if (!fname && this.rec && (this.namespace && !this.rec.name.startsWith(this.namespace + '.') && !this.rec.name.includes('.') ? `${this.namespace}.${this.rec.name}` : this.rec.name) === `${I}.${field}`) {
      fname = this.rec.name;
      fc = { e: this.rec.fn, type: this.lctx.get(this.rec.fn.id)!.type };
    }
    if (!fname) this.err(span, `invalid field '${field}': the environment does not contain '${I}.${field}'`);
    fc ??= this.constExpr(fname, undefined, span);
    let e = fc.e;
    let ft = fc.type;
    for (let guard = 0; guard < 64; guard++) {
      const w = this.whnf(ft);
      if (w.k !== 'pi') break;
      const d0 = getAppFn(this.instantiate(w.type));
      const dh = d0.k === 'const' && d0.name === I ? d0 : getAppFn(this.whnf(w.type));
      if (w.binfo === 'default' && dh.k === 'const' && dh.name === I) {
        if (!this.isDefEq(w.type, baseType)) this.err(span, `type mismatch in field notation: '${fname}' expects a value of type\n  `, this.term(w.type), '\nbut the value has type\n  ', this.term(baseType));
        e = mkApp(e, base);
        ft = instantiate1(w.body, base);
        this.record(span, e, 'const');
        return { e, type: ft };
      }
      if (w.binfo === 'default') {
        // the value goes to the first explicit argument of type I, as in Lean 4:
        // `xs.map f` is `List.map f xs`
        const idx = explicitIndexOfType(ft, I);
        if (idx === undefined) this.err(span, `invalid field notation: '${fname}' does not take an explicit argument of type ${I}`);
        this.record(span, fc.e, 'const');
        return { e: fc.e, type: fc.type, base: { idx, e: base, type: baseType } };
      }
      const m = this.newMVar(w.type, 'implicit', { span, what: `implicit argument '${w.name}' of '${fname}'` });
      e = mkApp(e, m);
      ft = instantiate1(w.body, m);
    }
    this.err(span, `invalid field notation: '${fname}' does not take an argument of type ${I}`);
  }

  /** instantiate leading implicit Π binders with fresh metavariables */
  insertImplicits(e: Expr, type: Expr, span?: Span): { e: Expr; type: Expr } {
    for (let guard = 0; guard < 256; guard++) {
      const w = this.whnf(type);
      if (w.k !== 'pi' || w.binfo === 'default') return { e, type };
      const m = w.binfo === 'inst' ? this.newInstMVar(w.type, span) : this.newMVar(w.type, 'implicit', { span, what: `implicit argument '${w.name}'` });
      e = mkApp(e, m);
      type = instantiate1(w.body, m);
    }
    return { e, type };
  }

  // -------------------------------------------------------------------------
  // universe levels

  elabLevel(l: SLevel, span: Span): Level {
    switch (l.k) {
      case 'num':
        return lofNat(l.n);
      case 'hole':
        return this.mctx.newLevel();
      case 'param':
        if (this.levelNames.includes(l.name)) return lparam(l.name);
        if (this.autoBoundLevels) {
          this.levelNames.push(l.name);
          this.newLevelParams.push(l.name);
          return lparam(l.name);
        }
        this.err(span, `unknown universe level '${l.name}'`);
      // eslint-disable-next-line no-fallthrough
      case 'succ': {
        let r = this.elabLevel(l.l, span);
        for (let i = 0; i < l.n; i++) r = lsucc(r);
        return r;
      }
      case 'max':
      case 'imax': {
        const ls = l.args.map((a) => this.elabLevel(a, span));
        return ls.reduce((a, b) => (l.k === 'max' ? lmax(a, b) : limax(a, b)));
      }
    }
  }

  // -------------------------------------------------------------------------
  // main entry points

  /** elaborate `s`, checking it against `expected` if given */
  elab(s: STerm, expected?: Expr): Expr {
    if (expected && !this.cube) {
      // implicit λ introduction: expected {x : A} → B and the term is not an implicit λ
      const w = this.whnf(this.instantiate(expected));
      if (w.k === 'pi' && w.binfo !== 'default' && !isImplicitLam(s) && !(s.k === 'ident' && s.explicit) && s.k !== 'hole' && s.k !== 'synthHole' && s.k !== 'sorry') {
        const fv = this.pushLocal(w.name, w.type, w.binfo);
        try {
          const body = this.elab(s, instantiate1(w.body, fv));
          return this.mkBinding('lam', [fv], body);
        } finally {
          this.lctx = popLocal(this.lctx, fv.id);
        }
      }
    }
    return this.elabCore(s, expected);
  }

  /** elaborate a type, returning it and its universe level */
  elabType(s: STerm): { e: Expr; level: Level } {
    const e = this.elab(s);
    const t = this.whnf(this.inferType(e, s.span));
    if (t.k === 'sort') return { e, level: t.level };
    if (getAppFn(t).k === 'mvar') {
      const l = this.mctx.newLevel();
      if (this.isDefEq(t, mkSort(l))) return { e, level: l };
    }
    this.err(s.span, 'type expected, but\n  ', this.term(e), '\nhas type\n  ', this.term(t));
  }

  /** check that `e : eType` fits the expected type */
  ensureHasType(e: Expr, eType: Expr, expected: Expr | undefined, span: Span): Expr {
    if (!expected) return e;
    if (this.isDefEq(eType, expected)) return e;
    const c = this.coerce(e, eType, expected, span);
    if (c) return c;
    const eh = getAppFn(e);
    const xw = this.whnf(this.instantiate(expected));
    if (eh.k === 'const' && (eh.name === 'rfl' || eh.name === 'Eq.refl') && getAppFn(xw).k === 'const' && (getAppFn(xw) as { name: string }).name === 'Eq') {
      const [, l, r] = getAppArgs(xw);
      this.err(span, 'rfl failed: the two sides are not equal by computation.\n  ', this.term(l), '\nand\n  ', this.term(r), '\ndo not compute to the same value');
    }
    this.err(span, 'type mismatch: the term\n  ', this.term(e), '\nhas type\n  ', this.term(eType), '\nbut is expected to have type\n  ', this.term(expected));
  }

  /** the two coercions of Lean's core: a decidable proposition where a Bool is expected (`decide p`), and a Bool where a proposition is expected (`b = true`) */
  private coerce(e: Expr, eType: Expr, expected: Expr, span: Span): Expr | undefined {
    if (!this.env.has('Decidable.decide')) return undefined;
    const t = this.whnf(this.instantiate(eType));
    const x = this.whnf(this.instantiate(expected));
    const isBool = (y: Expr) => y.k === 'const' && y.name === 'Bool';
    const isProp = (y: Expr) => y.k === 'sort' && toNat(this.mctx.instantiateLevel(y.level)) === 0;
    if (isProp(t) && isBool(x)) {
      const inst = this.newInstMVar(mkApp(mkConst('Decidable'), e), span);
      return mkApp(mkApp(mkConst('Decidable.decide'), e), inst);
    }
    if (isBool(t) && isProp(x)) {
      return mkApp(mkApp(mkApp(mkConst('Eq', [lsucc(lzero)]), mkConst('Bool')), e), mkConst('Bool.true'));
    }
    return undefined;
  }

  private elabCore(s: STerm, expected: Expr | undefined, noPostpone = false): Expr {
    switch (s.k) {
      case 'paren':
        return this.elab(s.term, expected);
      case 'ident': {
        const r = this.resolveIdent(s);
        if (r.base) return this.elabApp(s, [], expected, s.span);
        const ins = s.explicit ? r : this.insertImplicits(r.e, r.type, s.span);
        this.record(s.span, ins.e, r.e.k === 'const' ? 'const' : 'term', expected);
        return this.ensureHasType(ins.e, ins.type, expected, s.span);
      }
      case 'dotIdent': {
        if (!noPostpone && this.unknownType(expected)) return this.postpone(s, expected);
        const name = this.resolveDotIdent(s.name, expected, s.span);
        const r = this.constExpr(name, undefined, s.span);
        const ins = this.insertImplicits(r.e, r.type, s.span);
        this.record(s.span, ins.e, 'const', expected);
        return this.ensureHasType(ins.e, ins.type, expected, s.span);
      }
      case 'sort':
        return this.elabSort(s, expected);
      case 'app':
        return this.elabApp(s.fn, s.args, expected, s.span);
      case 'lam':
        return this.elabLam(s.binders, s.body, expected, s.span);
      case 'pi':
        return this.elabPi(s.binders, s.body, expected, s.span);
      case 'arrow': {
        const a = this.elabType(s.dom);
        const fv = this.pushLocal('a✝', a.e);
        try {
          const b = this.elabType(s.cod);
          const e = this.mkBinding('pi', [fv], b.e);
          this.lctx = popLocal(this.lctx, fv.id);
          const t = this.inferType(e, s.span);
          this.record(s.span, e, 'term', expected);
          return this.ensureHasType(e, t, expected, s.span);
        } finally {
          this.lctx = popLocal(this.lctx, fv.id);
        }
      }
      case 'exists': {
        // ∃ x y, p   ⟶   Exists (λ x, Exists (λ y, p))
        let body: STerm = s.body;
        const flat: SBinder[] = [];
        for (const b of s.binders) for (const n of b.names) flat.push({ names: [n], type: b.type, binfo: 'default', span: b.span });
        for (let i = flat.length - 1; i >= 0; i--) {
          body = {
            k: 'app',
            fn: { k: 'ident', name: 'Exists', explicit: false, span: s.span },
            args: [{ arg: { k: 'lam', binders: [flat[i]], body, span: s.span } }],
            span: s.span,
          };
        }
        return this.elab(body, expected);
      }
      case 'let':
        return this.elabLet(s, expected);
      case 'hole': {
        const t = expected ?? this.newTypeMVar(s.span);
        const m = this.newMVar(t, 'natural', { span: s.span, what: 'placeholder _' });
        this.record(s.span, m, 'term', expected);
        return m;
      }
      case 'synthHole': {
        const t = expected ?? this.newTypeMVar(s.span);
        const m = this.newMVar(t, 'synthetic', { span: s.span, name: s.name });
        this.record(s.span, m, 'term', expected);
        this.holeHook?.(s.name, m, this.aliases);
        return m;
      }
      case 'sorry': {
        if (!this.env.has('sorryAx')) this.err(s.span, 'sorry is not available in this calculus');
        const t = expected ?? this.newTypeMVar(s.span);
        const tt = this.whnf(this.inferType(t));
        const l = tt.k === 'sort' ? tt.level : this.mctx.newLevel();
        this.usesSorry = true;
        const e = mkApp(mkConst('sorryAx', [l]), t);
        this.record(s.span, e, 'term', expected);
        return e;
      }
      case 'num':
        return this.elabNum(s.value, expected, s.span);
      case 'anon':
        return this.elabAnon(s, expected, noPostpone);
      case 'structInst':
        return this.elabStructInst(s, expected, noPostpone);
      case 'ascribe': {
        const t = this.elabType(s.type);
        const e = this.elab(s.term, t.e);
        return this.ensureHasType(e, t.e, expected, s.span);
      }
      case 'show': {
        const t = this.elabType(s.type);
        const e = this.elab(s.term, t.e);
        return this.ensureHasType(e, t.e, expected, s.span);
      }
      case 'proj': {
        const base = this.elab(s.term);
        const bt = this.inferType(base, s.term.span);
        const r = this.fieldAccess(base, bt, s.field, s.fieldSpan);
        if (r.base) return this.elabApp(s, [], expected, s.span);
        const ins = this.insertImplicits(r.e, r.type, s.span);
        return this.ensureHasType(ins.e, ins.type, expected, s.span);
      }
      case 'match':
        return elabMatch(this, s, expected);
      case 'elaborated':
        return this.ensureHasType(s.e, s.type ?? this.inferType(s.e, s.span), expected, s.span);
      case 'by': {
        const type = expected ?? this.newTypeMVar(s.span, 'the type of a tactic block');
        const m = this.newMVar(type, 'synthetic', { span: s.span, what: 'tactic block' });
        const block = { m, tac: s.tac, lctx: this.lctx, aliases: new Map(this.aliases), span: s.span };
        // run now when everything the tactics can see is known; otherwise at the end, like Lean
        const known = (t: Expr) => this.mctx.collectMVars(this.instantiate(t)).size === 0;
        if (known(type) && this.lctx.decls.every((d) => known(d.type))) runTacticBlock(this, block);
        else this.tacticBlocks.push(block);
        return m;
      }
      case 'if':
        return this.elabIf(s, expected);
      case 'have': {
        let typeS = s.type;
        let valueS = s.value;
        if (s.binders.length > 0) {
          if (typeS) typeS = { k: 'pi', binders: s.binders, body: typeS, style: 'arrow', span: typeS.span };
          valueS = { k: 'lam', binders: s.binders, body: valueS, span: valueS.span };
        }
        let type: Expr;
        let value: Expr;
        if (typeS) {
          type = this.elabType(typeS).e;
          value = this.elab(valueS, type);
        } else {
          value = this.elab(valueS);
          type = this.inferType(value, valueS.span);
        }
        const fv = this.pushLocal(s.name, this.instantiate(type));
        this.record(s.nameSpan, fv, 'binder');
        try {
          const body = this.elab(s.body, expected);
          const lam = this.mkBinding('lam', [fv], body);
          return mkApp(lam, value);
        } finally {
          this.lctx = popLocal(this.lctx, fv.id);
        }
      }
      case 'calc':
        return elabCalc(this, s, expected);
      case 'subst':
        return elabSubst(this, s, expected);
      case 'lamPat':
        this.err(s.span, 'internal error: unexpected pattern λ');
    }
  }

  private elabIf(s: Extract<STerm, { k: 'if' }>, expected: Expr | undefined): Expr {
    let c = this.elab(s.cond);
    this.synthesizePending(false);
    const ct = this.whnf(this.inferType(c, s.cond.span));
    const h = getAppFn(ct);
    if (h.k === 'const' && h.name === 'Bool') {
      // `if b then …` for a Boolean b means `if b = true then …`
      c = mkApp(mkApp(mkApp(mkConst('Eq', [lsucc(lzero)]), mkConst('Bool')), c), mkConst('Bool.true'));
    } else if (!(ct.k === 'sort' && toNat(this.mctx.instantiateLevel(ct.level)) === 0)) {
      this.err(s.cond.span, 'the condition of `if` must be a proposition (with a Decidable instance) or a Bool, but it has type\n  ', this.term(ct));
    }
    const cS: STerm = { k: 'elaborated', e: c, span: s.cond.span };
    const id = (name: string): STerm => ({ k: 'ident', name, explicit: false, span: s.span });
    if (s.name === undefined) {
      return this.elabApp(id('ite'), [{ arg: cS }, { arg: s.then }, { arg: s.else }], expected, s.span);
    }
    const nsp = s.nameSpan ?? s.span;
    const notC: STerm = { k: 'app', fn: id('Not'), args: [{ arg: cS }], span: s.cond.span };
    const thenF: STerm = { k: 'lam', binders: [{ names: [{ name: s.name, span: nsp }], type: cS, binfo: 'default', span: nsp }], body: s.then, span: s.then.span };
    const elseF: STerm = { k: 'lam', binders: [{ names: [{ name: s.name, span: nsp }], type: notC, binfo: 'default', span: nsp }], body: s.else, span: s.else.span };
    return this.elabApp(id('dite'), [{ arg: cS }, { arg: thenF }, { arg: elseF }], expected, s.span);
  }

  resolveDotIdent(name: string, expected: Expr | undefined, span: Span): string {
    if (!expected) this.err(span, `invalid dotted identifier '.${name}': the expected type is not known`);
    let t = this.whnf(this.instantiate(expected));
    // for a function type, look at the result type
    let guard = 0;
    while (t.k === 'pi' && guard++ < 32) {
      const fv = this.pushLocal(t.name, t.type);
      t = this.whnf(instantiate1(t.body, fv));
    }
    const h = getAppFn(t);
    if (h.k !== 'const') this.err(span, `invalid dotted identifier '.${name}': the expected type `, this.term(t), ' is not of the form C …');
    const cand = `${h.name}.${name}`;
    if (!this.env.has(cand)) this.err(span, `unknown constant '${cand}'`);
    return cand;
  }

  private elabSort(s: Extract<STerm, { k: 'sort' }>, expected: Expr | undefined): Expr {
    let e: Expr;
    if (this.cube) {
      if (s.sort === 'star') e = mkSort(lzero);
      else if (s.sort === 'box') e = mkSort(lsucc(lzero));
      else this.err(s.span, `in ${this.env.features.name} the sorts are written * and □`);
    } else {
      switch (s.sort) {
        case 'Prop':
          e = mkSort(lzero);
          break;
        case 'Type':
          e = mkSort(lsucc(s.level ? this.elabLevel(s.level, s.span) : lzero));
          break;
        case 'Sort':
          e = mkSort(this.elabLevel(s.level!, s.span));
          break;
        default:
          this.err(s.span, `the sorts * and □ belong to the λ-cube; in ${this.env.features.name} write Prop, Type or Sort u`);
      }
    }
    this.record(s.span, e, 'sort', expected);
    return this.ensureHasType(e, this.inferType(e, s.span), expected, s.span);
  }

  private elabNum(n: number, expected: Expr | undefined, span: Span): Expr {
    if (!this.env.has('Nat.zero') || !this.env.has('Nat.succ')) this.err(span, 'numerals need the type Nat to be defined');
    if (n > 5000) this.err(span, 'numeral too large for unary representation');
    if (expected) {
      const w = this.whnf(this.instantiate(expected));
      const h = getAppFn(w);
      if (!(h.k === 'const' && h.name === 'Nat') && h.k !== 'mvar') {
        this.err(span, `numerals denote natural numbers in this course (there is no OfNat type class), but the expected type is `, this.term(expected));
      }
    }
    let e: Expr = mkConst('Nat.zero');
    for (let i = 0; i < n; i++) e = mkApp(mkConst('Nat.succ'), e);
    this.record(span, e, 'term', expected);
    return this.ensureHasType(e, mkConst('Nat'), expected, span);
  }

  /** postpone `s` until its expected type is known */
  private postpone(s: STerm, expected: Expr | undefined): Expr {
    const type = expected ?? this.newTypeMVar(s.span);
    const m = this.newMVar(type, 'postponed', { span: s.span });
    this.pending.push({ m, s, lctx: this.lctx, aliases: new Map(this.aliases), type });
    return m;
  }

  private unknownType(expected: Expr | undefined): boolean {
    if (!expected) return true;
    return getAppFn(this.whnf(this.instantiate(expected))).k === 'mvar';
  }

  /** retry postponed problems; with `force`, elaborate them even without type information */
  synthesizePending(force: boolean): void {
    this.synthesizePostponed(force);
    this.synthesizeInstances(false);
    if (force) {
      this.synthesizePostponed(true);
      this.synthesizeInstances(true);
      this.runTacticBlocks(true);
      this.synthesizeInstances(true);
    }
  }

  /** try to solve the pending instance problems; with `force`, report the ones that fail */
  synthesizeInstances(force: boolean): void {
    for (let round = 0; round < 8 && this.instPending.length > 0; round++) {
      let progress = false;
      const list = this.instPending;
      this.instPending = [];
      for (const p of list) {
        const id = (getAppFn(p.m) as { id: number }).id;
        if (this.mctx.isAssigned(id)) {
          progress = true;
          continue;
        }
        const saved = this.lctx;
        this.lctx = p.lctx;
        try {
          const type = this.instantiate(this.mctx.get(id)!.localType);
          if (!force && this.mctx.collectMVars(type).size > 0) {
            this.instPending.push(p);
            continue;
          }
          const r = synthInstance(this, type);
          if (r === undefined) {
            if (force) this.err(p.span, 'failed to synthesize an instance of\n  ', this.term(type), '\n(no instance of this type class applies)');
            this.instPending.push(p);
            continue;
          }
          if (!this.isDefEq(p.m, r)) this.err(p.span, 'the synthesized instance\n  ', this.term(r), '\ndoes not match the expected one');
          progress = true;
        } finally {
          this.lctx = saved;
        }
      }
      if (!progress) break;
    }
  }

  /** run the tactic blocks whose goal no longer contains metavariables (all of them with `force`) */
  runTacticBlocks(force: boolean): void {
    for (let round = 0; round < 16 && this.tacticBlocks.length > 0; round++) {
      const list = this.tacticBlocks;
      this.tacticBlocks = [];
      let progress = false;
      for (const b of list) {
        const id = (getAppFn(b.m) as { id: number }).id;
        const type = this.instantiate(this.mctx.get(id)!.localType);
        if (!force && (this.mctx.collectMVars(type).size > 0 || b.lctx.decls.some((d) => this.mctx.collectMVars(this.instantiate(d.type)).size > 0))) {
          this.tacticBlocks.push(b);
          continue;
        }
        runTacticBlock(this, b);
        progress = true;
      }
      if (!progress) break;
    }
  }

  private synthesizePostponed(force: boolean): void {
    for (let round = 0; round < 32 && this.pending.length > 0; round++) {
      let progress = false;
      const list = this.pending;
      this.pending = [];
      for (const p of list) {
        if (this.mctx.isAssigned((getAppFn(p.m) as { id: number }).id) && !force) {
          // assigned by unification: still elaborate to check it
        }
        if (!force && this.unknownTypeIn(p)) {
          this.pending.push(p);
          continue;
        }
        const saved = this.lctx;
        const savedAliases = this.aliases;
        this.lctx = p.lctx;
        this.aliases = p.aliases;
        try {
          const e = this.elabCore(p.s, this.instantiate(p.type), true);
          if (!this.isDefEq(p.m, e)) this.err(p.s.span, 'type mismatch in postponed term');
        } finally {
          this.lctx = saved;
          this.aliases = savedAliases;
        }
        progress = true;
      }
      if (!progress && !force) return;
    }
  }

  private unknownTypeIn(p: { lctx: LocalContext; type: Expr }): boolean {
    const saved = this.lctx;
    this.lctx = p.lctx;
    try {
      return this.unknownType(p.type);
    } finally {
      this.lctx = saved;
    }
  }

  private elabAnon(s: Extract<STerm, { k: 'anon' }>, expected: Expr | undefined, noPostpone = false): Expr {
    if (!noPostpone && this.unknownType(expected)) return this.postpone(s, expected);
    if (!expected) this.err(s.span, 'invalid ⟨…⟩ notation: the expected type is not known');
    const t = this.whnf(this.instantiate(expected));
    const h = getAppFn(t);
    const ind = h.k === 'const' ? this.env.get(h.name) : undefined;
    if (!ind || ind.kind !== 'inductive' || ind.ctors.length !== 1) {
      this.err(s.span, 'invalid ⟨…⟩ notation: the expected type\n  ', this.term(expected), '\nis not an inductive type with exactly one constructor');
    }
    const ctorName = ind.ctors[0];
    const ctor = this.env.get(ctorName)!;
    // count explicit fields
    let ct = ctor.type;
    let explicit = 0;
    let i = 0;
    while (ct.k === 'pi') {
      if (i >= ind.numParams && ct.binfo === 'default') explicit++;
      ct = ct.body;
      i++;
    }
    let args = s.args;
    if (args.length > explicit && explicit >= 1) {
      const rest: STerm = { k: 'anon', args: args.slice(explicit - 1), span: { from: args[explicit - 1].span.from, to: s.span.to } };
      args = [...args.slice(0, explicit - 1), rest];
    }
    const fn: STerm = { k: 'ident', name: ctorName, explicit: false, span: { from: s.span.from, to: s.span.from + 1 } };
    return this.elabApp(fn, args.map((a) => ({ arg: a })), expected, s.span);
  }

  /** `{ x := a, y := b }`: the constructor of the expected structure, with arguments by field name */
  private elabStructInst(s: Extract<STerm, { k: 'structInst' }>, expected: Expr | undefined, noPostpone = false): Expr {
    if (!noPostpone && this.unknownType(expected)) return this.postpone(s, expected);
    if (!expected) this.err(s.span, 'invalid structure instance: the expected type is not known');
    const t = this.whnf(this.instantiate(expected));
    const h = getAppFn(t);
    const ind = h.k === 'const' ? this.env.get(h.name) : undefined;
    if (!ind || ind.kind !== 'inductive' || ind.ctors.length !== 1) {
      this.err(s.span, 'invalid structure instance: the expected type\n  ', this.term(expected), '\nis not a structure');
    }
    const ctorName = ind.ctors[0];
    const fieldNames: string[] = [];
    let ct = this.env.get(ctorName)!.type;
    for (let i = 0; ct.k === 'pi'; i++, ct = ct.body) if (i >= ind.numParams) fieldNames.push(ct.name);
    for (const f of s.fields) {
      if (!fieldNames.includes(f.name)) this.err(f.nameSpan, `'${f.name}' is not a field of '${h.k === 'const' ? h.name : ''}' (fields: ${fieldNames.join(', ')})`);
    }
    const missing = fieldNames.filter((n) => !s.fields.some((f) => f.name === n));
    if (missing.length) this.err(s.span, `missing field${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
    const fn: STerm = { k: 'ident', name: ctorName, explicit: false, span: { from: s.span.from, to: s.span.from + 1 } };
    return this.elabApp(fn, s.fields.map((f) => ({ named: f.name, arg: f.value })), expected, s.span);
  }

  private elabLet(s: Extract<STerm, { k: 'let' }>, expected: Expr | undefined): Expr {
    // let f (x : A) : B := v; body   ⟶   let f : (x : A) → B := λ x, v; body
    let typeS = s.type;
    let valueS = s.value;
    if (s.binders.length > 0) {
      if (typeS) typeS = { k: 'pi', binders: s.binders, body: typeS, style: 'arrow', span: typeS.span };
      valueS = { k: 'lam', binders: s.binders, body: valueS, span: valueS.span };
    }
    let type: Expr;
    let value: Expr;
    if (typeS) {
      type = this.elabType(typeS).e;
      value = this.elab(valueS, type);
    } else {
      value = this.elab(valueS);
      type = this.inferType(value, valueS.span);
    }
    const fv = this.pushLocal(s.name, type, 'default', value);
    this.record(s.nameSpan, fv, 'binder');
    try {
      const body = this.elab(s.body, expected);
      const b = abstractFVars(this.instantiate(body), [fv.id]);
      return mkLet(s.name, this.instantiate(type), this.instantiate(value), b);
    } finally {
      this.lctx = popLocal(this.lctx, fv.id);
    }
  }

  // -------------------------------------------------------------------------
  // binders

  private elabLam(binders: SBinder[], bodyS: STerm, expected: Expr | undefined, span: Span): Expr {
    const saved = this.lctx;
    const fvars: FVar[] = [];
    let exp = expected ? this.instantiate(expected) : undefined;
    try {
      for (const b of binders) {
        for (const nm of b.names) {
          let w = exp ? this.whnf(exp) : undefined;
          // skip over implicit binders of the expected type when the λ binder is explicit
          while (w && w.k === 'pi' && w.binfo !== 'default' && b.binfo === 'default' && !this.cube) {
            const fvi = this.pushLocal(w.name, w.type, w.binfo);
            fvars.push(fvi);
            exp = instantiate1(w.body, fvi);
            w = this.whnf(exp);
          }
          let dom: Expr;
          if (b.type) {
            dom = this.elabType(b.type).e;
            if (w && w.k === 'pi' && !this.isDefEq(dom, w.type)) {
              this.err(b.type.span, 'the binder type\n  ', this.term(dom), '\ndoes not match the expected domain\n  ', this.term(w.type));
            }
          } else if (w && w.k === 'pi') dom = w.type;
          else dom = this.newTypeMVar(nm.span, `type of '${nm.name}'`);
          const name = nm.name === '_' ? 'x✝' : nm.name;
          const fv = this.pushLocal(name, dom, b.binfo);
          fvars.push(fv);
          this.record(nm.span, fv, 'binder');
          exp = w && w.k === 'pi' ? instantiate1(w.body, fv) : undefined;
        }
      }
      const body = this.elab(bodyS, exp);
      const bodyType = exp ?? this.inferType(body, bodyS.span);
      const e = this.mkBinding('lam', fvars, body);
      const t = this.mkBinding('pi', fvars, bodyType);
      this.lctx = saved;
      // in a PTS the type of a λ must itself be a well-formed Π-type
      if (this.cube) this.inferType(t, span);
      return this.ensureHasType(e, t, expected, span);
    } finally {
      this.lctx = saved;
    }
  }

  private elabPi(binders: SBinder[], bodyS: STerm, expected: Expr | undefined, span: Span): Expr {
    const saved = this.lctx;
    const fvars: FVar[] = [];
    try {
      for (const b of binders) {
        const dom = b.type ? this.elabType(b.type).e : undefined;
        for (const nm of b.names) {
          const d = dom ?? this.newTypeMVar(nm.span, `type of '${nm.name}'`);
          const fv = this.pushLocal(nm.name, d, b.binfo);
          fvars.push(fv);
          this.record(nm.span, fv, 'binder');
        }
      }
      const body = this.elabType(bodyS).e;
      const e = this.mkBinding('pi', fvars, body);
      this.lctx = saved;
      const t = this.inferType(e, span);
      this.record(span, e, 'term', expected);
      return this.ensureHasType(e, t, expected, span);
    } finally {
      this.lctx = saved;
    }
  }

  // -------------------------------------------------------------------------
  // applications

  private elabHead(s: STerm, expected: Expr | undefined): Resolved & { explicit: boolean; name?: string } {
    if (s.k === 'ident') {
      const r = this.resolveIdent(s);
      this.record(s.span, r.e, r.e.k === 'const' ? 'const' : 'term');
      return { ...r, explicit: s.explicit, name: s.name };
    }
    if (s.k === 'dotIdent') {
      const name = this.resolveDotIdent(s.name, expected, s.span);
      const r = this.constExpr(name, undefined, s.span);
      this.record(s.span, r.e, 'const');
      return { ...r, explicit: false, name };
    }
    if (s.k === 'paren') return this.elabHead(s.term, expected);
    if (s.k === 'proj') {
      const base = this.elab(s.term);
      const bt = this.inferType(base, s.term.span);
      const r = this.fieldAccess(base, bt, s.field, s.fieldSpan);
      return { ...r, explicit: false };
    }
    const e = this.elab(s);
    return { e, type: this.inferType(e, s.span), explicit: false };
  }

  elabApp(fnS: STerm, args: SArg[], expected: Expr | undefined, span: Span): Expr {
    const head = this.elabHead(fnS, expected);
    let e = head.e;
    let ft = head.type;
    const positional = args.filter((a) => !a.named).map((a) => a.arg);
    const named = new Map(args.filter((a) => a.named).map((a) => [a.named!, a.arg]));
    // explicit arguments are first represented by placeholders, so that the
    // expected type can be propagated before they are elaborated
    const pending: { m: Expr; s: STerm; type: Expr; late: boolean; num?: boolean; done?: boolean }[] = [];
    const elabPending = (p: (typeof pending)[number]) => {
      p.done = true;
      const a = this.elab(p.s, this.instantiate(p.type));
      if (!this.isDefEq(p.m, a)) {
        this.err(p.s.span, 'type mismatch: the argument\n  ', this.term(a), '\nhas type\n  ', this.term(this.inferType(a)), '\nbut is expected to have type\n  ', this.term(p.type));
      }
    };
    // numerals whose type is known by now are elaborated early: `⟨10, rfl⟩` needs the 10 before the rfl
    // so are the other terms that only need the head of their type: `⟨.lit 0, rfl⟩` needs the `.lit 0` first
    const isLate = (p: (typeof pending)[number]) => p.late && !(headOnly(p.s) && !this.unknownType(this.instantiate(p.type)));
    const flush = (late: boolean) => {
      for (const p of pending) if (!p.done && (late || !isLate(p))) elabPending(p);
    };
    let i = 0;
    const fnName = head.name ?? 'function';
    // generalized field notation with the value at a later explicit position
    let explicitSeen = 0;
    let baseDone = !head.base;
    for (let guard = 0; guard < 512; guard++) {
      if (i >= positional.length && named.size === 0 && baseDone) {
        // trailing implicit arguments
        if (head.explicit) break;
        const w = this.whnf(ft);
        if (w.k === 'pi' && w.binfo !== 'default' && !this.expectsImplicitPi(expected)) {
          const m = w.binfo === 'inst' ? this.newInstMVar(w.type, span) : this.newMVar(w.type, 'implicit', { span, what: `implicit argument '${w.name}' of '${fnName}'` });
          e = mkApp(e, m);
          ft = instantiate1(w.body, m);
          continue;
        }
        break;
      }
      let w = this.whnf(ft);
      if (w.k !== 'pi' && pending.some((p) => !p.done)) {
        // the function type is not yet known: elaborate the arguments seen so far
        flush(false);
        w = this.whnf(ft);
        if (w.k !== 'pi') {
          flush(true);
          w = this.whnf(ft);
        }
      }
      if (w.k !== 'pi' && i < positional.length && getAppFn(this.instantiate(w)).k === 'mvar') {
        // a function of a type not yet known (`∀ w, … w y …`): it is some function type α → β
        // (α and β live in the context of the unknown type, not in the current one)
        const md = this.mctx.get((getAppFn(this.instantiate(w)) as { id: number }).id)!;
        const A = this.mctx.newMVar(md.lctx, mkSort(this.mctx.newLevel()), 'natural', { span });
        const B = this.mctx.newMVar(md.lctx, mkSort(this.mctx.newLevel()), 'natural', { span });
        if (this.isDefEq(w, mkPi('x', A, liftLooseBVars(B, 0, 1)))) w = this.whnf(ft);
      }
      if (w.k !== 'pi') {
        if (i < positional.length) {
          const argS = positional[i];
          this.err(argS.span, 'function expected: the term\n  ', this.term(e), '\nhas type\n  ', this.term(ft), '\nand cannot be applied to more arguments');
        }
        const [n] = named.keys();
        this.err(span, `invalid named argument '${n}': '${fnName}' has no such parameter`);
      }
      let arg: Expr;
      if (named.has(w.name)) {
        const s = named.get(w.name)!;
        named.delete(w.name);
        arg = this.newMVar(w.type, 'postponed', { span: s.span });
        pending.push({ m: arg, s, type: w.type, late: false });
      } else if (w.binfo !== 'default' && !head.explicit) {
        arg = w.binfo === 'inst' ? this.newInstMVar(w.type, span) : this.newMVar(w.type, 'implicit', { span, what: `implicit argument '${w.name}' of '${fnName}'` });
      } else if (!baseDone && explicitSeen === head.base!.idx) {
        explicitSeen++;
        baseDone = true;
        arg = head.base!.e;
        if (!this.isDefEq(w.type, head.base!.type)) this.err(span, `type mismatch in field notation: '${fnName}' expects a value of type\n  `, this.term(w.type), '\nbut the value has type\n  ', this.term(head.base!.type));
      } else {
        explicitSeen++;
        if (i >= positional.length) {
          if (!baseDone) this.err(span, `missing arguments: with field notation, the arguments of '${fnName}' before the value must be given`);
          const [n] = named.keys();
          this.err(span, `named argument '${n}' refers to a parameter after the missing explicit arguments`);
        }
        const s = positional[i++];
        if (s.k === 'hole') {
          arg = this.newMVar(w.type, 'natural', { span: s.span, what: 'placeholder _' });
          this.record(s.span, arg, 'term', w.type);
        } else {
          arg = this.newMVar(w.type, 'postponed', { span: s.span });
          // numerals of a known type are elaborated early: `⟨10, rfl⟩` needs the 10 before the rfl
          pending.push({ m: arg, s, type: w.type, late: shouldPostpone(s), num: s.k === 'num' });
        }
      }
      e = mkApp(e, arg);
      ft = instantiate1(w.body, arg);
    }
    // propagate the expected type — only when the result type does not depend
    // on the explicit arguments (as in Lean's `propagateExpectedType`)
    const placeholderIds = new Set(pending.map((p) => (getAppFn(p.m) as { id: number }).id));
    const dependsOnArgs = [...this.mctx.collectMVars(ft)].some((id) => placeholderIds.has(id));
    if (expected && pending.some((p) => !p.done) && !dependsOnArgs) {
      const cp = this.mctx.checkpoint();
      if (!this.isDefEq(ft, expected)) this.mctx.rollback(cp);
    }
    // instances whose type is known by now: `of_decide_eq_true rfl` needs the instance before the rfl
    if (this.instPending.length && pending.some((p) => !p.done)) this.synthesizeInstances(false);
    flush(false);
    flush(true);
    this.record(span, e, 'term', expected);
    const r = this.ensureHasType(e, ft, expected, span);
    if (this.pending.length) this.synthesizePending(false);
    return r;
  }

  private expectsImplicitPi(expected: Expr | undefined): boolean {
    if (!expected) return false;
    const w = this.whnf(this.instantiate(expected));
    return w.k === 'pi' && w.binfo !== 'default';
  }
}

/** a resolved head; `base` is set when field notation places the value at explicit argument `idx` > 0 */
type Resolved = { e: Expr; type: Expr; base?: { idx: number; e: Expr; type: Expr } };

/** the index, among explicit binders, of the first explicit binder whose type is headed by `I` */
function explicitIndexOfType(t: Expr, I: string): number | undefined {
  let idx = 0;
  while (t.k === 'pi') {
    if (t.binfo === 'default') {
      const h = getAppFn(t.type);
      if (h.k === 'const' && h.name === I) return idx;
      idx++;
    }
    t = t.body;
  }
  return undefined;
}

function shouldPostpone(s: STerm): boolean {
  switch (s.k) {
    case 'lam':
      return s.binders.some((b) => !b.type);
    case 'anon':
    case 'structInst':
    case 'dotIdent':
    case 'match':
    case 'num':
      return true;
    case 'paren':
      return shouldPostpone(s.term);
    case 'app':
      return s.fn.k === 'dotIdent';
    default:
      return false;
  }
}

/** terms that postpone only until the head of their expected type is known */
function headOnly(s: STerm): boolean {
  switch (s.k) {
    case 'num':
    case 'dotIdent':
    case 'anon':
    case 'structInst':
      return true;
    case 'paren':
      return headOnly(s.term);
    case 'app':
      return s.fn.k === 'dotIdent';
    default:
      return false;
  }
}

function isImplicitLam(s: STerm): boolean {
  if (s.k === 'paren') return isImplicitLam(s.term);
  return s.k === 'lam' && s.binders[0]?.binfo !== 'default';
}

export function popLocal(l: LocalContext, id: number): LocalContext {
  if (!l.get(id)) return l;
  let r = LocalContext.empty;
  for (const d of l.decls) {
    if (d.id === id) break;
    r = r.push(d);
  }
  return r;
}

import { mkBinder } from '../core/expr.ts';
function mkPiLike(k: 'lam' | 'pi', name: string, type: Expr, body: Expr, binfo: LocalDecl['binfo'] & string): Expr {
  return mkBinder(k, name, type, body, binfo);
}

export { exprEq, getAppArgs, toNat };
