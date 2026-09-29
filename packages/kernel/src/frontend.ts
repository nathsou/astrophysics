// The frontend: processes a source file command by command.
//
//   source ──parse──▶ commands ──elaborate──▶ core terms ──kernel──▶ environment
//
// Every declaration is re-checked by the kernel after elaboration: the
// elaborator is untrusted, only the kernel decides what enters the
// environment (the "de Bruijn criterion").

import {
  type Expr,
  type FVar,
  abstractFVars,
  collectFVars,
  getAppFn,
  instantiate1,
  mkApps,
  mkConst,
  mkFVar,
  mkPi,
  mkSort,
  forEachExpr,
  replaceExpr,
} from './core/expr.ts';
import { type Level, collectParams, lparam, lmax, lone, replaceLevel, toNat, simplifyLevel } from './core/level.ts';
import { type Decl, Environment, LocalContext, type LocalDecl, freshFVarId } from './core/env.ts';
import { KernelError, type Msg, OutOfFuel, TypeChecker } from './core/typechecker.ts';
import { addInductive, promoteIndices, type InductiveTypeInput } from './core/inductive.ts';
import { type CalculusId, type Features, calculi } from './core/calculus.ts';
import type { Command, SAlt, SBinder, STerm, Span } from './syntax/ast.ts';
import { ParseError, Parser } from './syntax/parser.ts';
import { AutoBound, ElabError, Elaborator, type InfoItem, popLocal } from './elab/elaborator.ts';
import { compileEquations } from './elab/match.ts';

export type Severity = 'error' | 'warning' | 'info';

export interface Goal {
  name?: string;
  lctx: LocalContext;
  type: Expr;
  span: Span;
}

export interface Message {
  severity: Severity;
  span: Span;
  msg: Msg;
  goals?: Goal[];
}

export type Output =
  | { k: 'check'; expr: Expr; type: Expr; lctx: LocalContext; constName?: string }
  | { k: 'reduce'; input: Expr; result: Expr; lctx: LocalContext; mode: 'reduce' | 'whnf' | 'eval' }
  | { k: 'decl'; names: string[]; main: string }
  | { k: 'print'; decl: Decl; axioms?: string[] };

export interface CommandResult {
  cmd: Command;
  span: Span;
  messages: Message[];
  output?: Output;
}

export interface ProcessResult {
  env: Environment;
  results: CommandResult[];
  messages: Message[];
  infos: InfoItem[];
  /** section variables at the end of the file */
  sectionCtx: LocalContext;
}

export interface PPState {
  explicit: boolean;
  universes: boolean;
}

// ---------------------------------------------------------------------------

interface Scope {
  kind: 'namespace' | 'section';
  name?: string;
  levelNames: string[];
  sectionCtx: LocalContext;
  opened: string[];
  varBinfos: Map<number, LocalDecl['binfo']>;
}

export class Processor {
  env: Environment;
  results: CommandResult[] = [];
  infos: InfoItem[] = [];
  private scopes: Scope[] = [];
  private levelNames: string[] = [];
  sectionCtx = LocalContext.empty;
  private varBinfos = new Map<number, LocalDecl['binfo']>();
  private namespace = '';
  parser!: Parser;

  constructor(env: Environment) {
    this.env = env;
  }

  process(src: string): ProcessResult {
    this.parser = new Parser(src, this.env.notations);
    const allMessages: Message[] = [];
    for (;;) {
      const nErr = this.parser.errors.length;
      const cmd = this.parser.nextCommand();
      if (!cmd) break;
      const res: CommandResult = { cmd, span: cmd.span, messages: [] };
      for (const pe of this.parser.errors.slice(nErr)) res.messages.push({ severity: 'error', span: pe.span, msg: [pe.message] });
      if (cmd.k !== 'error') {
        try {
          this.command(cmd, res);
        } catch (e) {
          res.messages.push(this.errorMessage(e, cmd.span));
        }
      }
      this.results.push(res);
      allMessages.push(...res.messages);
    }
    return { env: this.env, results: this.results, messages: allMessages, infos: this.infos, sectionCtx: this.sectionCtx };
  }

  private errorMessage(e: unknown, span: Span): Message {
    if (e instanceof ElabError) return { severity: 'error', span: e.span, msg: e.msg, goals: (e as { goals?: Goal[] }).goals };
    if (e instanceof KernelError) return { severity: 'error', span, msg: ['(kernel) ', ...e.msg] };
    if (e instanceof OutOfFuel) return { severity: 'error', span, msg: [e.message] };
    if (e instanceof ParseError) return { severity: 'error', span: e.span, msg: [e.message] };
    if (e instanceof RangeError && !process.env.DEBUG_STACK) return { severity: 'error', span, msg: ['maximum recursion depth reached (the term is too large or does not terminate)'] };
    console.error(e);
    if (process.env.DEBUG_STACK) console.error((e as Error).stack?.split("\n").slice(0, 40).join("\n"));
    return { severity: 'error', span, msg: [`internal error: ${(e as Error).message ?? String(e)}`] };
  }

  private fullName(n: string): string {
    return this.namespace ? `${this.namespace}.${n}` : n;
  }

  private newElaborator(env = this.env): Elaborator {
    const el = new Elaborator(env);
    el.lctx = this.sectionCtx;
    el.levelNames = [...this.levelNames];
    el.namespace = this.namespace;
    return el;
  }

  private command(cmd: Command, res: CommandResult): void {
    switch (cmd.k) {
      case 'def':
        return this.defCommand(cmd, res);
      case 'axiom':
        return this.axiomCommand(cmd, res);
      case 'inductive':
        return this.inductiveCommand(cmd.types, res, undefined, cmd.doc);
      case 'structure':
        return this.structureCommand(cmd, res);
      case 'variable':
        return this.variableCommand(cmd.binders, res);
      case 'universe':
        for (const n of cmd.names) if (!this.levelNames.includes(n)) this.levelNames.push(n);
        return;
      case 'check':
        return this.checkCommand(cmd.term, res);
      case 'reduce':
        return this.reduceCommand(cmd.term, cmd.mode, res);
      case 'print':
        return this.printCommand(cmd.name, cmd.axioms, cmd.span, res);
      case 'notation': {
        const target = this.newElaborator().resolveGlobal(cmd.target) ?? cmd.target;
        this.env.notations = [...this.env.notations.filter((n) => n.symbol !== cmd.symbol || n.kind === 'prefix' !== (cmd.kind === 'prefix')), { kind: cmd.kind, symbol: cmd.symbol, prec: cmd.prec, target }];
        this.parser.setNotations(this.env.notations);
        return;
      }
      case 'open':
        for (const n of cmd.names) if (!this.env.opened.includes(n)) this.env.opened = [...this.env.opened, n];
        return;
      case 'namespace':
      case 'section':
        this.scopes.push({
          kind: cmd.k,
          name: cmd.k === 'namespace' ? cmd.name : cmd.name,
          levelNames: [...this.levelNames],
          sectionCtx: this.sectionCtx,
          opened: [...this.env.opened],
          varBinfos: new Map(this.varBinfos),
        });
        if (cmd.k === 'namespace') this.namespace = this.fullName(cmd.name);
        return;
      case 'end': {
        const sc = this.scopes.pop();
        if (!sc) throw new ElabError(['unexpected end: no namespace or section is open'], cmd.span);
        if (sc.kind === 'namespace') {
          const parts = this.namespace.split('.');
          const last = parts.pop();
          if (cmd.name && cmd.name !== last && !this.namespace.endsWith(cmd.name)) throw new ElabError([`invalid end: expected 'end ${last}'`], cmd.span);
          this.namespace = parts.join('.');
        }
        this.levelNames = sc.levelNames;
        this.sectionCtx = sc.sectionCtx;
        this.env.opened = sc.opened;
        this.varBinfos = sc.varBinfos;
        return;
      }
      case 'setOption':
        return this.setOption(cmd.name, cmd.value, cmd.span, res);
      case 'initQuot':
        return this.initQuot(res);
      case 'error':
        return;
    }
  }

  private setOption(name: string, value: string, span: Span, res: CommandResult): void {
    const b = value === 'true';
    const f = { ...this.env.features };
    switch (name) {
      case 'kernel.typeInType':
        f.typeInType = b;
        break;
      case 'kernel.positivity':
        f.positivity = b;
        break;
      case 'kernel.restrictPropElim':
        f.restrictPropElim = b;
        break;
      case 'kernel.proofIrrelevance':
        f.proofIrrelevance = b;
        break;
      case 'kernel.eta':
        f.eta = b;
        break;
      case 'kernel.impredicativeProp':
        f.impredicativeProp = b;
        break;
      default:
        throw new ElabError([`unknown option '${name}' (available: kernel.typeInType, kernel.positivity, kernel.restrictPropElim, kernel.proofIrrelevance, kernel.eta, kernel.impredicativeProp)`], span);
    }
    this.env.features = f;
    if (b && (name === 'kernel.typeInType' || (name === 'kernel.positivity' && !b))) {
      res.messages.push({ severity: 'warning', span, msg: ['this option makes the logic inconsistent'] });
    }
    if (!b && (name === 'kernel.positivity' || name === 'kernel.restrictPropElim')) {
      res.messages.push({ severity: 'warning', span, msg: [`disabling ${name.slice(7)} makes the logic inconsistent`] });
    }
  }

  // -------------------------------------------------------------------------
  // headers

  /**
   * Elaborate binders (and optionally a type) with auto-bound implicits:
   * unknown single-letter identifiers become implicit arguments `{α : Sort ?u}`.
   */
  private elabHeader(binders: SBinder[], typeS: STerm | undefined, levelParams: string[] | undefined, env = this.env): { el: Elaborator; fvars: FVar[]; type?: Expr } {
    const autoNames: string[] = [];
    for (let attempt = 0; attempt < 32; attempt++) {
      const el = this.newElaborator(env);
      el.levelNames = [...this.levelNames, ...(levelParams ?? [])];
      el.autoBoundLevels = levelParams === undefined;
      el.autoBoundImplicits = !el.cube;
      const fvars: FVar[] = [];
      try {
        for (const n of autoNames) {
          fvars.push(el.pushLocal(n, mkSort(el.mctx.newLevel()), 'implicit'));
        }
        for (const b of binders) {
          const ty = b.type ? el.elabType(b.type).e : undefined;
          for (const nm of b.names) {
            const t = ty ?? el.newTypeMVar(nm.span, `type of '${nm.name}'`);
            const fv = el.pushLocal(nm.name === '_' ? 'x✝' : nm.name, t, b.binfo);
            fvars.push(fv);
            el.record(nm.span, fv, 'binder');
          }
        }
        const type = typeS ? el.elabType(typeS).e : undefined;
        el.autoBoundImplicits = false;
        return { el, fvars, type };
      } catch (e) {
        if (e instanceof AutoBound && !autoNames.includes(e.name)) {
          autoNames.push(e.name);
          continue;
        }
        throw e;
      }
    }
    throw new Error('too many auto-bound implicits');
  }

  /** report unassigned metavariables in `e` */
  private checkNoMVars(el: Elaborator, exprs: Expr[], span: Span): void {
    el.synthesizePending(true);
    const ids = new Set<number>();
    for (const e of exprs) el.mctx.collectMVars(e, ids);
    if (ids.size === 0) return;
    const goals: Goal[] = [];
    const msgs: Msg = [];
    let synthetic = false;
    for (const id of ids) {
      const d = el.mctx.get(id)!;
      if (d.kind === 'synthetic') synthetic = true;
      goals.push({ name: d.name, lctx: d.lctx, type: el.instantiate(d.localType), span: d.span ?? span });
    }
    const first = el.mctx.get([...ids][0])!;
    if (synthetic) msgs.push(`unsolved goal${ids.size > 1 ? 's' : ''}: the holes ?… must be filled in`);
    else msgs.push(`don't know how to synthesize ${first.what ?? 'placeholder'}; the elaborator could not infer it`);
    throw new GoalsError(msgs, first.span ?? span, goals);
  }

  /** turn remaining universe metavariables into universe parameters */
  private generalizeLevels(el: Elaborator, exprs: Expr[], levelParams: string[]): { exprs: Expr[]; params: string[] } {
    const fails = el.u.processPendingLevels();
    if (fails.length > 0) {
      throw new ElabError([`universe constraint cannot be satisfied: ${fails.map(([a, b]) => `${lvlStr(a)} = ${lvlStr(b)}`).join(', ')}`], { from: 0, to: 0 });
    }
    const inst = exprs.map((e) => el.instantiate(e));
    const mvIds: number[] = [];
    for (const e of inst) {
      forEachExpr(e, (x) => {
        if (!x.mv) return false;
        const ls = x.k === 'sort' ? [x.level] : x.k === 'const' ? x.levels : [];
        for (const l of ls)
          replaceLevel(l, (y) => {
            if (y.k === 'mvar' && !mvIds.includes(y.id)) mvIds.push(y.id);
            return undefined;
          });
        return undefined;
      });
    }
    const params = [...levelParams];
    let k = 1;
    for (const id of mvIds) {
      let nm: string;
      do nm = `u_${k++}`;
      while (params.includes(nm) || this.levelNames.includes(nm));
      params.push(nm);
      el.mctx.assignLevel(id, lparam(nm));
    }
    return { exprs: inst.map((e) => el.instantiate(e)), params };
  }

  /** abstract the section variables used by a declaration */
  private closeOverSection(el: Elaborator, type: Expr, value: Expr | undefined): { type: Expr; value?: Expr } {
    if (this.sectionCtx.size === 0) return { type, value };
    const used = new Set<number>();
    collectFVars(type, used);
    if (value) collectFVars(value, used);
    // include dependencies
    const decls = this.sectionCtx.decls;
    for (let i = decls.length - 1; i >= 0; i--) {
      if (used.has(decls[i].id)) collectFVars(decls[i].type, used);
    }
    const vars = decls.filter((d) => used.has(d.id)).map((d) => mkFVar(d.id));
    if (vars.length === 0) return { type, value };
    const saved = el.lctx;
    el.lctx = this.sectionCtx;
    // variables keep the binder info they were declared with
    const t = el.mkBinding('pi', vars, type);
    const v = value ? el.mkBinding('lam', vars, value) : undefined;
    el.lctx = saved;
    return { type: t, value: v };
  }

  // -------------------------------------------------------------------------
  // declarations

  private addDecl(d: Decl, res: CommandResult, span: Span): void {
    // the kernel re-checks everything
    const tc = new TypeChecker(this.env);
    const s = tc.infer(d.type);
    tc.ensureSort(s);
    if (d.kind === 'def' || d.kind === 'theorem' || d.kind === 'opaque') tc.check(d.value, d.type);
    if (d.kind === 'theorem' && !this.env.features.cube) {
      const sort = tc.whnf(tc.infer(d.type));
      if (sort.k !== 'sort' || toNat(sort.level) !== 0) {
        throw new ElabError(['a theorem must state a proposition (its type must be in Prop); use def for data'], span);
      }
    }
    this.env.add(d);
    res.output = { k: 'decl', names: [d.name], main: d.name };
  }

  private defCommand(cmd: Extract<Command, { k: 'def' }>, res: CommandResult): void {
    const name = cmd.kind === 'example' ? '_example' : this.fullName(cmd.name);
    if (cmd.kind !== 'example' && this.env.has(name)) throw new ElabError([`'${name}' has already been declared`], cmd.nameSpan);
    const { el, fvars, type: typeH } = this.elabHeader(cmd.binders, cmd.type, cmd.levelParams);
    this.infosFrom(el, () => {
      const recursive = cmd.kind !== 'example' && mentionsName(cmd, cmd.name, name);
      let type = typeH;
      let value: Expr;
      let compiled: { recursive: boolean; decreasing?: number; argName?: string } | undefined;
      if (cmd.body.k === 'equations') {
        if (!type) throw new ElabError(['definitions by pattern matching need a type signature'], cmd.nameSpan);
        const alts = cmd.body.alts;
        const nPats = alts[0].pats.length;
        // open the explicit binders of the type that the patterns match
        const cols: FVar[] = [];
        let t = type;
        let explicitSeen = 0;
        const saved = el.lctx;
        const padded: number[] = []; // positions of implicit columns
        while (explicitSeen < nPats) {
          const w = el.whnf(t);
          if (w.k !== 'pi') throw new ElabError([`too many patterns: the type has only ${explicitSeen} explicit argument(s)`], alts[0].span);
          const fv = el.pushLocal(columnName(el, w.name, w.type, cols.length), w.type, w.binfo);
          if (w.binfo !== 'default') padded.push(cols.length);
          else explicitSeen++;
          cols.push(fv);
          t = instantiate1(w.body, fv);
        }
        const paddedAlts: SAlt[] = alts.map((a) => {
          const pats: STerm[] = [];
          let k = 0;
          for (let c = 0; c < cols.length; c++) pats.push(padded.includes(c) ? { k: 'hole', span: a.span } : a.pats[k++]);
          return { ...a, pats };
        });
        const fullType = el.mkBinding('pi', [...fvars, ...cols], t);
        const r = compileEquations(el, {
          name: cmd.name,
          args: [...fvars, ...cols],
          colIdx: cols.map((_, i) => fvars.length + i),
          alts: paddedAlts,
          target: t,
          recursive,
          span: cmd.nameSpan,
          fullType,
        });
        const all = [...fvars, ...cols];
        compiled = { recursive, decreasing: r.decreasing, argName: r.decreasing !== undefined ? el.lctx.get(all[r.decreasing].id)?.name : undefined };
        value = el.mkBinding('lam', cols, r.body);
        el.lctx = saved;
      } else if (recursive) {
        const body = unparen(cmd.body.term);
        if (!type) throw new ElabError(['recursive definitions need a type signature'], cmd.nameSpan);
        if (body.k !== 'match') {
          throw new ElabError([`'${cmd.name}' is defined recursively; in this course recursion is compiled via pattern matching (use equations '| pattern => …' or 'match')`], cmd.nameSpan);
        }
        const cols: FVar[] = [];
        for (const d of body.discrs) {
          const u = unparen(d);
          const fv = u.k === 'ident' ? fvars.find((f) => el.lctx.get(f.id)?.name === u.name) : undefined;
          if (!fv) throw new ElabError(['a recursive definition may only match on its arguments (variables)'], d.span);
          cols.push(fv);
        }
        const fullType = el.mkBinding('pi', fvars, type);
        const r = compileEquations(el, {
          name: cmd.name,
          args: fvars,
          colIdx: cols.map((c) => fvars.indexOf(c)),
          alts: body.alts,
          target: type,
          recursive: true,
          span: cmd.nameSpan,
          fullType,
        });
        compiled = { recursive: true, decreasing: r.decreasing, argName: r.decreasing !== undefined ? el.lctx.get(fvars[r.decreasing].id)?.name : undefined };
        value = r.body;
      } else {
        value = el.elab(cmd.body.term, type);
        if (!type) type = el.inferType(value, cmd.body.term.span);
      }
      let vT = el.mkBinding('pi', fvars, type!);
      let vV = el.mkBinding('lam', fvars, value);
      this.checkNoMVars(el, [vT, vV], cmd.span);
      const g = this.generalizeLevels(el, [vT, vV], [...(cmd.levelParams ?? []), ...el.newLevelParams]);
      [vT, vV] = g.exprs;
      ({ type: vT, value: vV } = this.closeOverSection(el, vT, vV) as { type: Expr; value: Expr });
      const params = usedLevelParams(g.params, [vT, vV], cmd.levelParams);
      if (el.usesSorry) res.messages.push({ severity: 'warning', span: cmd.nameSpan, msg: [`declaration uses 'sorry'`] });
      if (cmd.kind === 'example') {
        const tc = new TypeChecker(this.env);
        tc.check(vV, vT);
        res.output = { k: 'check', expr: vV, type: vT, lctx: LocalContext.empty };
        return;
      }
      const kind = cmd.kind === 'theorem' ? 'theorem' : 'def';
      const decl: Decl =
        kind === 'theorem'
          ? { kind: 'theorem', name, levelParams: params, type: vT, value: vV, doc: cmd.doc }
          : { kind: 'def', name, levelParams: params, type: vT, value: vV, height: defHeight(this.env, vV), doc: cmd.doc, compiled };
      this.addDecl(decl, res, cmd.nameSpan);
    });
  }

  private axiomCommand(cmd: Extract<Command, { k: 'axiom' }>, res: CommandResult): void {
    const name = this.fullName(cmd.name);
    if (this.env.has(name)) throw new ElabError([`'${name}' has already been declared`], cmd.nameSpan);
    const { el, fvars, type } = this.elabHeader(cmd.binders, cmd.type, cmd.levelParams);
    this.infosFrom(el, () => {
      let t = el.mkBinding('pi', fvars, type!);
      this.checkNoMVars(el, [t], cmd.span);
      const g = this.generalizeLevels(el, [t], [...(cmd.levelParams ?? []), ...el.newLevelParams]);
      t = this.closeOverSection(el, g.exprs[0], undefined).type;
      this.addDecl({ kind: 'axiom', name, levelParams: usedLevelParams(g.params, [t], cmd.levelParams), type: t, doc: cmd.doc }, res, cmd.nameSpan);
    });
  }

  private variableCommand(binders: SBinder[], res: CommandResult): void {
    if (this.env.features.cube) return this.cubeVariables(binders, res);
    const el = this.newElaborator();
    el.autoBoundLevels = true;
    this.infosFrom(el, () => {
      for (const b of binders) {
        const ty = b.type ? el.elabType(b.type).e : el.newTypeMVar(b.span);
        for (const nm of b.names) {
          const fv = el.pushLocal(nm.name, ty, b.binfo);
          el.record(nm.span, fv, 'binder');
        }
      }
      // metavariables are not allowed in variables
      const all = el.lctx.decls.map((d) => d.type);
      this.checkNoMVars(el, all, binders[0].span);
      const g = this.generalizeLevels(el, all, []);
      for (const p of el.newLevelParams) if (!this.levelNames.includes(p)) this.levelNames.push(p);
      for (const p of g.params) if (!this.levelNames.includes(p)) this.levelNames.push(p);
      let l = LocalContext.empty;
      el.lctx.decls.forEach((d) => {
        l = l.push({ ...d, type: el.instantiate(d.type) });
      });
      this.sectionCtx = l;
      void res;
    });
  }

  /** in the λ-cube, `variable` declares global constants (base types and such) */
  private cubeVariables(binders: SBinder[], res: CommandResult): void {
    const names: string[] = [];
    for (const b of binders) {
      if (!b.type) throw new ElabError(['variables need a type in the λ-cube'], b.span);
      for (const nm of b.names) {
        const el = this.newElaborator();
        this.infosFrom(el, () => {
          const t = el.instantiate(el.elabType(b.type!).e);
          this.checkNoMVars(el, [t], b.span);
          const name = this.fullName(nm.name);
          if (this.env.has(name)) throw new ElabError([`'${name}' has already been declared`], nm.span);
          const tc = new TypeChecker(this.env);
          tc.ensureSort(tc.infer(t));
          this.env.add({ kind: 'axiom', name, levelParams: [], type: t, doc: 'declared with variable' });
          el.record(nm.span, mkConst(name), 'const');
          names.push(name);
        });
      }
    }
    res.output = { k: 'decl', names, main: names[0] };
  }

  private checkCommand(term: STerm, res: CommandResult): void {
    const el = this.newElaborator();
    el.autoBoundLevels = true;
    this.infosFrom(el, () => {
      const t = unparen(term);
      // `#check c` shows the signature of a constant
      if (t.k === 'ident' && !t.levels) {
        const g = el.lctx.findByName(t.name) ? undefined : el.resolveGlobal(t.name);
        if (g) {
          const d = this.env.get(g)!;
          const e = mkConst(g, d.levelParams.map(lparam));
          el.record(t.span, e, 'const');
          res.output = { k: 'check', expr: e, type: d.type, lctx: this.sectionCtx, constName: g };
          return;
        }
      }
      const e = el.elab(term);
      el.synthesizePending(true);
      const ty = el.instantiate(el.inferType(e, term.span));
      el.u.processPendingLevels();
      res.output = { k: 'check', expr: el.instantiate(e), type: el.instantiate(ty), lctx: this.sectionCtx };
      const mv = el.mctx.collectMVars(e);
      if (mv.size === 0) {
        // the kernel has the last word
        new TypeChecker(this.env, this.sectionCtx).infer(el.instantiate(e));
      }
      if (mv.size > 0) {
        try {
          this.checkNoMVars(el, [e], term.span);
        } catch (err) {
          if (err instanceof GoalsError) res.messages.push({ severity: 'info', span: term.span, msg: err.msg, goals: err.goals });
        }
      }
    });
  }

  private reduceCommand(term: STerm, mode: 'reduce' | 'whnf' | 'eval', res: CommandResult): void {
    const el = this.newElaborator();
    this.infosFrom(el, () => {
      let e = el.elab(term);
      this.checkNoMVars(el, [e], term.span);
      e = el.instantiate(e);
      const tc = new TypeChecker(this.env, this.sectionCtx, { fuel: 300_000 });
      tc.infer(e);
      const r = mode === 'whnf' ? tc.whnf(e) : tc.normalize(e);
      res.output = { k: 'reduce', input: e, result: r, lctx: this.sectionCtx, mode };
    });
  }

  private printCommand(name: string, axioms: boolean, span: Span, res: CommandResult): void {
    const el = this.newElaborator();
    const g = el.resolveGlobal(name);
    if (!g) throw new ElabError([`unknown constant '${name}'`], span);
    const d = this.env.get(g)!;
    res.output = { k: 'print', decl: d, axioms: axioms ? collectAxioms(this.env, g) : undefined };
  }

  private inductiveCommand(types: import('./syntax/ast.ts').SInductive[], res: CommandResult, structure?: { fieldNames: string[] }, doc?: string): void {
    if (!this.env.features.inductives) throw new ElabError([`inductive types are not part of ${this.env.features.name}`], types[0].nameSpan);
    const first = types[0];
    const names = types.map((t) => this.fullName(t.name));
    for (const [i, n] of names.entries()) if (this.env.has(n)) throw new ElabError([`'${n}' has already been declared`], types[i].nameSpan);
    // parameters
    const { el, fvars: params, type: firstType } = this.elabHeader(first.binders, first.type, first.levelParams);
    this.infosFrom(el, () => {
      // types of the inductive types (after the parameters)
      const typeExprs: Expr[] = [];
      const inferLevel: (Level | undefined)[] = [];
      for (const t of types) {
        if (t === first && firstType) {
          typeExprs.push(firstType);
          inferLevel.push(undefined);
        } else if (t.type) {
          typeExprs.push(el.elabType(t.type).e);
          inferLevel.push(undefined);
        } else {
          const l = el.mctx.newLevel();
          typeExprs.push(mkSort(l));
          inferLevel.push(l);
        }
      }
      // temporary environment in which the types exist as axioms
      const levelParamsSoFar = [...(first.levelParams ?? []), ...el.newLevelParams];
      const tmpEnv = this.env.clone();
      const closedTypes = typeExprs.map((t) => el.mkBinding('pi', params, t));
      types.forEach((_, i) => {
        tmpEnv.add({ kind: 'axiom', name: names[i], levelParams: levelParamsSoFar, type: closedTypes[i] });
      });
      // elaborate constructors in the temporary environment
      const savedEnv = el.u.env;
      (el.u as unknown as { env: Environment }).env = tmpEnv;
      (el.u.tc as unknown as { env: Environment }).env = tmpEnv;
      (el as unknown as { env: Environment }).env = tmpEnv;
      const ctorTypes: { name: string; type: Expr; doc?: string }[][] = [];
      try {
        types.forEach((t, i) => {
          const list: { name: string; type: Expr; doc?: string }[] = [];
          for (const c of t.ctors) {
            const saved = el.lctx;
            const cfv: FVar[] = [];
            for (const b of c.binders) {
              const ty = b.type ? el.elabType(b.type).e : el.newTypeMVar(b.span);
              for (const nm of b.names) {
                const fv = el.pushLocal(nm.name, ty, b.binfo);
                cfv.push(fv);
                el.record(nm.span, fv, 'binder');
              }
            }
            let ct: Expr;
            if (c.type) ct = el.elabType(c.type).e;
            else ct = el.instantiate(mkAppsConst(names[i], levelParamsSoFar, params));
            const full = el.mkBinding('pi', cfv, ct);
            el.lctx = saved;
            list.push({ name: `${names[i]}.${c.name}`, type: full, doc: c.doc });
            el.record(c.nameSpan, mkConst(names[i]), 'const');
          }
          ctorTypes.push(list);
        });
      } finally {
        (el.u as unknown as { env: Environment }).env = savedEnv;
        (el.u.tc as unknown as { env: Environment }).env = savedEnv;
        (el as unknown as { env: Environment }).env = savedEnv;
      }
      // infer omitted result universes: the smallest Sort (max 1 …) containing all fields
      inferLevel.forEach((lv, i) => {
        if (!lv) return;
        let need: Level = lone;
        const tc = el.u.makeTC(el.lctx);
        (tc as unknown as { env: Environment }).env = tmpEnv;
        for (const c of ctorTypes[i]) {
          let t = el.instantiate(c.type);
          while (t.k === 'pi') {
            try {
              const s = tc.whnf(tc.inferOnly(t.type));
              if (s.k === 'sort') {
                const sl = el.mctx.instantiateLevel(s.level);
                // recursive occurrences live in the universe being inferred
                const selfRef = JSON.stringify(sl).includes(`"mvar","id":${(lv as { id: number }).id}}`);
                if (!selfRef) need = lmax(need, sl);
              }
            } catch {
              /* ignore */
            }
            const d: LocalDecl = { id: freshFVarId(), name: t.name, type: t.type };
            tc.lctx = tc.lctx.push(d);
            t = instantiate1(t.body, mkFVar(d.id));
          }
        }
        el.mctx.assignLevel((lv as { id: number }).id, simplifyLevel(need));
      });
      // close over the parameters (implicit in constructors)
      const indTypes = typeExprs.map((t) => el.mkBinding('pi', params, t));
      const ctorFull = ctorTypes.map((list) =>
        list.map((c) => {
          const saved = el.lctx;
          const decls = el.lctx.decls.map((d) => (params.some((p) => p.id === d.id) ? { ...d, binfo: 'implicit' as const } : d));
          let l = LocalContext.empty;
          for (const d of decls) l = l.push(d);
          el.lctx = l;
          const t = el.mkBinding('pi', params, c.type);
          el.lctx = saved;
          return { ...c, type: t };
        }),
      );
      const all = [...indTypes, ...ctorFull.flat().map((c) => c.type)];
      this.checkNoMVars(el, all, first.span);
      const g = this.generalizeLevels(el, all, [...(first.levelParams ?? []), ...el.newLevelParams]);
      const inst = g.exprs;
      const tys = inst.slice(0, types.length);
      let k = types.length;
      const inputs: InductiveTypeInput[] = types.map((t, i) => ({
        name: names[i],
        type: tys[i],
        doc: i === 0 ? (t.doc ?? doc) : t.doc,
        ctors: ctorFull[i].map((c) => ({ name: c.name, type: inst[k++], doc: c.doc })),
      }));
      // level params: all those used
      const used = new Set<string>();
      for (const e of inst) forEachExpr(e, (x) => {
        if (x.k === 'sort') collectParams(x.level, used);
        if (x.k === 'const') x.levels.forEach((l) => collectParams(l, used));
      });
      const levelParams = g.params.filter((p) => used.has(p) || (first.levelParams ?? []).includes(p));
      // the temporary axioms used levelParamsSoFar; fix up constants to use the final params list
      const fixed = inputs.map((inp) => ({
        ...inp,
        type: fixConstLevels(inp.type, names, levelParams),
        ctors: inp.ctors.map((c) => ({ ...c, type: fixConstLevels(c.type, names, levelParams) })),
      }));
      const numParams = types.length === 1 && !structure ? promoteIndices(this.env, { levelParams, numParams: params.length, types: fixed }) : params.length;
      const r = addInductive(this.env, { levelParams, numParams, types: fixed, structure });
      if (r.nonPositive.length > 0) {
        res.messages.push({ severity: 'warning', span: first.nameSpan, msg: [`accepted non-positive constructor argument(s) because the positivity check is disabled: ${r.nonPositive.join(', ')}`] });
      }
      res.output = { k: 'decl', names: r.added, main: names[0] };
    });
  }

  private structureCommand(cmd: Extract<Command, { k: 'structure' }>, res: CommandResult): void {
    const ctorName = cmd.ctorName ?? 'mk';
    const fieldNames = cmd.fields.flatMap((f) => f.names.map((n) => n.name));
    const ind: import('./syntax/ast.ts').SInductive = {
      name: cmd.name,
      nameSpan: cmd.nameSpan,
      levelParams: cmd.levelParams,
      binders: cmd.binders,
      type: cmd.type,
      ctors: [{ name: ctorName, nameSpan: cmd.nameSpan, binders: cmd.fields.map((f) => ({ ...f, binfo: 'default' as const })) }],
      span: cmd.span,
      doc: cmd.doc,
    };
    this.inductiveCommand([ind], res, { fieldNames }, cmd.doc);
  }

  private initQuot(res: CommandResult): void {
    if (this.env.has('Quot')) return;
    if (!this.env.has('Eq')) throw new ElabError(['init_quot requires Eq to be declared first'], res.span);
    const src = [
      ['Quot', 'type', '{α : Sort u} → (α → α → Prop) → Sort u'],
      ['Quot.mk', 'mk', '{α : Sort u} → (r : α → α → Prop) → α → @Quot α r'],
      ['Quot.lift', 'lift', '{α : Sort u} → {r : α → α → Prop} → {β : Sort v} → (f : α → β) → (∀ (a b : α), r a b → @Eq β (f a) (f b)) → @Quot α r → β'],
      ['Quot.ind', 'ind', '{α : Sort u} → {r : α → α → Prop} → {β : @Quot α r → Prop} → (mk : ∀ (a : α), β (@Quot.mk α r a)) → ∀ (q : @Quot α r), β q'],
    ] as const;
    for (const [name, kind, ty] of src) {
      const p = new Parser(ty, this.env.notations);
      const term = p.term();
      const el = new Elaborator(this.env);
      el.levelNames = ['u', 'v'];
      const e = el.instantiate(el.elabType(term).e);
      const params = kind === 'lift' ? ['u', 'v'] : ['u'];
      new TypeChecker(this.env).infer(e);
      this.env.add({ kind: 'quot', quotKind: kind, name, levelParams: params, type: e, builtin: true });
    }
    res.output = { k: 'decl', names: ['Quot', 'Quot.mk', 'Quot.lift', 'Quot.ind'], main: 'Quot' };
  }

  private infosFrom(el: Elaborator, f: () => void): void {
    try {
      f();
    } finally {
      for (const i of el.infos) {
        this.infos.push({ ...i, expr: el.instantiate(i.expr), expected: i.expected ? el.instantiate(i.expected) : undefined, lctx: instLctx(el, i.lctx) });
      }
      for (const w of el.warnings) {
        const r = this.results[this.results.length];
        void r;
        this.pendingWarnings.push({ severity: 'warning', span: w.span, msg: w.msg });
      }
    }
  }
  pendingWarnings: Message[] = [];
}

class GoalsError extends ElabError {
  constructor(
    msg: Msg,
    span: Span,
    readonly goals: Goal[],
  ) {
    super(msg, span);
  }
}

function instLctx(el: Elaborator, l: LocalContext): LocalContext {
  let r = LocalContext.empty;
  for (const d of l.decls) r = r.push({ ...d, type: el.instantiate(d.type), value: d.value ? el.instantiate(d.value) : undefined });
  return r;
}

function lvlStr(l: Level): string {
  return JSON.stringify(l);
}

/** a readable name for an argument introduced by an equation compiler column */
function columnName(el: Elaborator, name: string, type: Expr, k: number): string {
  if (name !== '_' && !name.endsWith('✝')) return name;
  const h = getAppFn(el.whnf(type));
  const base = h.k === 'const' ? h.name.split('.').pop()!.charAt(0).toLowerCase() : 'x';
  const used = new Set(el.lctx.decls.map((d) => d.name));
  let n = /[a-z]/.test(base) ? base : 'x';
  let i = 1;
  while (used.has(n)) n = `${base}${'₀₁₂₃₄₅₆₇₈₉'[i++ % 10]}`;
  void k;
  return n;
}

function unparen(t: STerm): STerm {
  return t.k === 'paren' ? unparen(t.term) : t;
}

function mkAppsConst(name: string, levelParams: string[], params: FVar[]): Expr {
  return mkApps(mkConst(name, levelParams.map(lparam)), params);
}

/** constants referring to the inductive types being defined must use the final level parameters */
function fixConstLevels(e: Expr, names: string[], params: string[]): Expr {
  return replaceExpr(e, (x) => {
    if (x.k === 'const' && names.includes(x.name)) return mkConst(x.name, params.map(lparam));
    return undefined;
  });
}

function usedLevelParams(params: string[], exprs: Expr[], explicit?: string[]): string[] {
  const used = new Set<string>();
  for (const e of exprs)
    forEachExpr(e, (x) => {
      if (!x.lp) return false;
      if (x.k === 'sort') collectParams(x.level, used);
      if (x.k === 'const') x.levels.forEach((l) => collectParams(l, used));
      return undefined;
    });
  return params.filter((p) => used.has(p) || (explicit ?? []).includes(p));
}

function defHeight(env: Environment, v: Expr): number {
  let h = 0;
  forEachExpr(v, (x) => {
    if (x.k === 'const') {
      const d = env.get(x.name);
      if (d?.kind === 'def') h = Math.max(h, d.height);
    }
  });
  return h + 1;
}

function mentionsName(cmd: Extract<Command, { k: 'def' }>, short: string, full: string): boolean {
  let found = false;
  const visit = (t: STerm | undefined): void => {
    if (!t || found) return;
    switch (t.k) {
      case 'ident':
        if (t.name === short || t.name === full) found = true;
        return;
      case 'app':
        visit(t.fn);
        t.args.forEach((a) => visit(a.arg));
        return;
      case 'lam':
      case 'pi':
      case 'exists':
        t.binders.forEach((b) => visit(b.type));
        visit(t.body);
        return;
      case 'arrow':
        visit(t.dom);
        visit(t.cod);
        return;
      case 'let':
        visit(t.type);
        visit(t.value);
        visit(t.body);
        return;
      case 'anon':
        t.args.forEach(visit);
        return;
      case 'ascribe':
        visit(t.term);
        visit(t.type);
        return;
      case 'match':
        t.discrs.forEach(visit);
        t.alts.forEach((a) => visit(a.rhs));
        return;
      case 'proj':
      case 'paren':
        visit(t.term);
        return;
      case 'show':
        visit(t.type);
        visit(t.term);
        return;
    }
  };
  if (cmd.body.k === 'term') visit(cmd.body.term);
  else cmd.body.alts.forEach((a) => visit(a.rhs));
  return found;
}

/** axioms a declaration depends on (transitively) */
export function collectAxioms(env: Environment, name: string): string[] {
  const seen = new Set<string>();
  const axioms: string[] = [];
  const go = (n: string) => {
    if (seen.has(n)) return;
    seen.add(n);
    const d = env.get(n);
    if (!d) return;
    if (d.kind === 'axiom') axioms.push(n);
    const visit = (e: Expr) =>
      forEachExpr(e, (x) => {
        if (x.k === 'const') go(x.name);
      });
    visit(d.type);
    if (d.kind === 'def' || d.kind === 'theorem' || d.kind === 'opaque') visit(d.value);
    if (d.kind === 'ctor' || d.kind === 'rec') go(d.induct);
    if (d.kind === 'inductive') d.ctors.forEach(go);
  };
  go(name);
  return axioms.sort();
}

// ---------------------------------------------------------------------------
// environments with preludes

const envCache = new Map<string, { env: Environment; messages: Message[] }>();

export function builtinEnv(features: Features): Environment {
  const env = new Environment(features);
  if (!features.cube) {
    // sorryAx.{u} : (α : Sort u) → α
    const u = lparam('u');
    env.add({
      kind: 'axiom',
      name: 'sorryAx',
      levelParams: ['u'],
      type: mkPi('α', mkSort(u), { k: 'bvar', i: 0, lb: 1, fv: false, mv: false, lp: false }),
      builtin: true,
      doc: 'The axiom behind `sorry`: it proves anything, so any declaration using it is suspect.',
    });
  }
  return env;
}

/**
 * Environment for a calculus with the given prelude sources processed.
 * Results are cached; a fresh clone is returned.
 */
export function makeEnv(calculus: CalculusId | Features, preludes: { id: string; src: string }[] = []): { env: Environment; messages: Message[] } {
  const features = typeof calculus === 'string' ? calculi[calculus] : calculus;
  const key = features.id + JSON.stringify(features) + '|' + preludes.map((p) => p.id).join(',');
  let cached = envCache.get(key);
  if (!cached) {
    const env = builtinEnv(features);
    const messages: Message[] = [];
    for (const p of preludes) {
      const proc = new Processor(env);
      const r = proc.process(p.src);
      messages.push(...r.messages.filter((m) => m.severity === 'error'));
      if (r.messages.some((m) => m.severity === 'error')) {
        console.error(`prelude ${p.id} has errors`, r.messages);
      }
    }
    for (const d of env.all()) (d as { builtin?: boolean }).builtin = true;
    cached = { env, messages };
    envCache.set(key, cached);
  }
  return { env: cached.env.clone(), messages: cached.messages };
}

/** Process a source file in a fresh copy of the given environment. */
export function processSource(src: string, base: Environment): ProcessResult & { warnings: Message[] } {
  const env = base.clone();
  const proc = new Processor(env);
  const r = proc.process(src);
  // attach warnings to the results they belong to (by position)
  for (const w of proc.pendingWarnings) {
    const res = r.results.find((x) => x.span.from <= w.span.from && w.span.to <= x.span.to + 1);
    if (res) res.messages.push(w);
    r.messages.push(w);
  }
  r.messages.sort((a, b) => a.span.from - b.span.from);
  return { ...r, warnings: proc.pendingWarnings };
}

export { abstractFVars, getAppFn, popLocal };
