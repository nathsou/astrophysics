// Tactics: programs that build proof terms.
//
// A tactic block `by tac` elaborates to a metavariable — the main goal. The
// tactics assign goals with terms that may contain new metavariables, the new
// goals. When the block finishes, the main goal has been assigned a complete
// term, which the kernel re-checks like any other term: a tactic can fail, but
// it cannot make the kernel accept something false.
//
// Every tactic step records the goals before and after it, and the proof term
// built so far, so that the course can show both the goal view (as in Lean's
// infoview) and the program the tactics are writing.

import {
  type Expr,
  type FVar,
  collectFVars,
  exprEq,
  getAppArgs,
  getAppFn,
  hasFVar,
  headBeta,
  instantiate1,
  mkApp,
  mkApps,
  mkConst,
  mkFVar,
  mkMVar,
  replaceExpr,
} from '../core/expr.ts';
import { toNat } from '../core/level.ts';
import { LocalContext, type LocalDecl, freshFVarId } from '../core/env.ts';
import type { Msg } from '../core/typechecker.ts';
import type { Location, RPat, STerm, Span, TacAlt, Tactic } from '../syntax/ast.ts';
import { type Elaborator, popLocal } from './elaborator.ts';
import { ElabError } from './errors.ts';
import { synthInstance } from './instances.ts';
import { simpTactic, unfoldTactic, rewriteTarget } from './simp.ts';
import { omegaTactic } from './omega.ts';

export interface GoalSnap {
  id: number;
  tag?: string;
  lctx: LocalContext;
  type: Expr;
}

export interface TacticStep {
  span: Span;
  kind: string;
  blockSpan: Span;
  before: GoalSnap[];
  after: GoalSnap[];
  /** the proof term of the whole block after this step (unsolved goals are metavariables) */
  term: Expr;
  /** the lctx of the block (the term above lives in it) */
  lctx: LocalContext;
  /** goals assigned by this step: the parts of the term it wrote */
  filled: number[];
  mainId: number;
  error?: boolean;
}

/** a tactic failed; `try`, `first` and `any_goals` catch these */
export class TacticError extends ElabError {
  goals?: GoalSnap[];
}

/** thrown by a tactic that could not be parsed (the parse error is already reported) */
class Abort extends Error {}

type Block = Elaborator['tacticBlocks'][number];

export function runTacticBlock(el: Elaborator, block: Block): void {
  new TacticRunner(el, block).run();
}

const short = (n: string) => n.split('.').pop()!;

export class TacticRunner {
  goals: number[];
  readonly main: number;
  constructor(
    readonly el: Elaborator,
    readonly block: Block,
  ) {
    this.main = (getAppFn(block.m) as { id: number }).id;
    this.goals = [this.main];
  }

  // -------------------------------------------------------------------------
  // running

  run(): void {
    const el = this.el;
    const saved = { lctx: el.lctx, aliases: el.aliases, rec: el.rec };
    try {
      this.exec(this.block.tac);
      this.goals = this.goals.filter((g) => !this.assigned(g));
      if (this.goals.length > 0) {
        const end = { from: this.block.span.from, to: Math.min(this.block.span.to, this.block.span.from + 2) };
        el.errors.push({ span: end, msg: [`unsolved goal${this.goals.length > 1 ? 's' : ''}`], goals: this.snap() });
        this.admitAll();
      }
    } catch (e) {
      if (e instanceof Abort) {
        this.admitAll();
      } else if (e instanceof ElabError) {
        el.errors.push({ span: e.span, msg: e.msg, goals: (e as TacticError).goals ?? this.snap() });
        this.admitAll();
      } else throw e;
    } finally {
      el.lctx = saved.lctx;
      el.aliases = saved.aliases;
      el.rec = saved.rec;
    }
  }

  private admitAll(): void {
    for (const g of this.goals) if (!this.assigned(g)) this.admit(g);
    this.goals = [];
    // goals created by a step that failed half-way are not in the list: close whatever is left
    for (const id of this.el.mctx.collectMVars(this.el.instantiate(this.block.m))) {
      const d = this.decl(id);
      if (!this.assigned(id) && d) this.admit(id);
    }
  }

  private admit(g: number): void {
    this.withGoal(g, () => {
      const t = this.type(g);
      const s = this.el.whnf(this.el.inferType(t));
      const l = s.k === 'sort' ? s.level : this.el.mctx.newLevel();
      this.assign(g, mkApp(mkConst('sorryAx', [l]), t));
    });
  }

  // -------------------------------------------------------------------------
  // goals

  decl(g: number) {
    return this.el.mctx.get(g)!;
  }

  assigned(g: number): boolean {
    return this.el.mctx.isAssigned(g);
  }

  type(g: number): Expr {
    return this.el.instantiate(this.decl(g).localType);
  }

  tag(g: number): string | undefined {
    const n = this.decl(g).name;
    return n && n !== '_' && !n.startsWith('__') ? n : undefined;
  }

  withGoal<T>(g: number, f: () => T): T {
    const el = this.el;
    const saved = { lctx: el.lctx, aliases: el.aliases };
    el.lctx = this.decl(g).lctx;
    el.aliases = new Map();
    try {
      return f();
    } finally {
      el.lctx = saved.lctx;
      el.aliases = saved.aliases;
    }
  }

  /** a new goal of type `type` in the current local context */
  mkGoal(type: Expr, tag?: string, lctx: LocalContext = this.el.lctx): number {
    const m = this.el.mctx.newMVar(lctx, type, 'synthetic', { name: tag });
    return (getAppFn(m) as { id: number }).id;
  }

  goalTerm(g: number): Expr {
    return mkApps(mkMVar(g), this.decl(g).ctx.map(mkFVar));
  }

  /** assign goal g (the value lives in g's local context) */
  assign(g: number, v: Expr): void {
    const d = this.decl(g);
    const el = this.el;
    const saved = el.lctx;
    el.lctx = d.lctx;
    try {
      const val = el.instantiate(v);
      const ctx = new Set(d.ctx);
      for (const id of collectFVars(val)) {
        if (!ctx.has(id)) throw new Error(`internal error: a tactic produced a term with a variable outside its goal's context`);
      }
      el.mctx.assign(g, el.mkBinding('lam', d.ctx.map(mkFVar), val));
    } finally {
      el.lctx = saved;
    }
  }

  snapGoal(g: number): GoalSnap {
    const d = this.decl(g);
    let l = LocalContext.empty;
    for (const x of d.lctx.decls) l = l.push({ ...x, type: this.el.instantiate(x.type), value: x.value ? this.el.instantiate(x.value) : undefined });
    return { id: g, tag: this.tag(g), lctx: l, type: this.type(g) };
  }

  snap(): GoalSnap[] {
    return this.goals.filter((g) => !this.assigned(g)).map((g) => this.snapGoal(g));
  }

  fail(span: Span, ...msg: Msg): never {
    const e = new TacticError(msg, span);
    e.goals = this.snap();
    throw e;
  }

  mainGoal(span: Span): number {
    this.goals = this.goals.filter((g) => !this.assigned(g));
    if (this.goals.length === 0) this.fail(span, 'no goals to be proved');
    return this.goals[0];
  }

  /** replace the main goal by `gs` */
  replaceMain(gs: number[]): void {
    this.goals = [...gs.filter((g) => !this.assigned(g)), ...this.goals.slice(1)];
  }

  // -------------------------------------------------------------------------
  // elaborating terms inside a goal

  /**
   * Elaborate `s` (against `expected`) in the context of the current goal,
   * isolated from the enclosing term's postponed problems.
   * Returns the term and the metavariables it created that are still unassigned.
   */
  elabTerm(s: STerm, expected?: Expr, opts: { allowNatural?: boolean; span?: Span } = {}): { e: Expr; natural: number[]; synthetic: number[] } {
    const el = this.el;
    const saved = { pending: el.pending, inst: el.instPending, blocks: el.tacticBlocks };
    el.pending = [];
    el.instPending = [];
    el.tacticBlocks = [];
    const n0 = el.mctx.count;
    try {
      const e = el.elab(s, expected);
      el.synthesizePending(true);
      const created = el.mctx.createdSince(n0).filter((id) => !el.mctx.isAssigned(id));
      const out = el.instantiate(e);
      const occurring = el.mctx.collectMVars(out);
      const natural: number[] = [];
      const synthetic: number[] = [];
      for (const id of created) {
        if (!occurring.has(id)) continue;
        const d = el.mctx.get(id)!;
        if (d.kind === 'synthetic') synthetic.push(id);
        else natural.push(id);
      }
      if (natural.length > 0 && !opts.allowNatural) {
        const d = el.mctx.get(natural[0])!;
        const e2 = new TacticError([`don't know how to synthesize ${d.what ?? 'placeholder'}`], d.span ?? opts.span ?? s.span);
        e2.goals = natural.map((id) => {
          const dd = el.mctx.get(id)!;
          return { id, lctx: dd.lctx, type: el.instantiate(dd.localType) };
        });
        throw e2;
      }
      return { e: out, natural, synthetic };
    } finally {
      el.pending = saved.pending;
      el.instPending = saved.inst;
      el.tacticBlocks = saved.blocks;
    }
  }

  /** elaborate a term built from already-elaborated pieces */
  E(e: Expr, span: Span): STerm {
    return { k: 'elaborated', e, span };
  }

  id(name: string, span: Span, explicit = false): STerm {
    return { k: 'ident', name, explicit, span };
  }

  app(fn: string | STerm, args: STerm[], span: Span): STerm {
    return { k: 'app', fn: typeof fn === 'string' ? this.id(fn, span) : fn, args: args.map((arg) => ({ arg })), span };
  }

  hole(span: Span): STerm {
    return { k: 'synthHole', name: '_', span };
  }

  /** refine the main goal with a term; its `?_` holes become the new goals */
  refineWith(g: number, s: STerm, span: Span): number[] {
    return this.withGoal(g, () => {
      const r = this.elabTerm(s, this.type(g), { span });
      this.assign(g, r.e);
      return r.synthetic;
    });
  }

  // -------------------------------------------------------------------------
  // local context surgery

  /** a copy of goal g with a different local context and/or type; g is assigned */
  replaceGoal(g: number, lctx: LocalContext, type: Expr): number {
    const ng = this.mkGoal(type, this.decl(g).name, lctx);
    this.assign(g, this.goalTerm(ng));
    return ng;
  }

  renameHyp(g: number, id: number, name: string): number {
    const d = this.decl(g);
    if (!d.lctx.get(id)) return g;
    let l = LocalContext.empty;
    for (const x of d.lctx.decls) l = l.push(x.id === id ? { ...x, name } : x);
    return this.replaceGoal(g, l, this.type(g));
  }

  /** remove hypotheses that nothing depends on any more */
  clearStale(g: number, ids: number[]): number {
    const d = this.decl(g);
    const drop = new Set<number>();
    const type = this.type(g);
    const decls = d.lctx.decls;
    for (let i = decls.length - 1; i >= 0; i--) {
      const x = decls[i];
      if (!ids.includes(x.id)) continue;
      if (hasFVar(type, x.id)) continue;
      const usedLater = decls.slice(i + 1).some((y) => !drop.has(y.id) && (hasFVar(this.el.instantiate(y.type), x.id) || (y.value !== undefined && hasFVar(this.el.instantiate(y.value), x.id))));
      if (usedLater) continue;
      drop.add(x.id);
    }
    if (drop.size === 0) return g;
    let l = LocalContext.empty;
    for (const x of decls) if (!drop.has(x.id)) l = l.push(x);
    return this.replaceGoal(g, l, type);
  }

  /** replace hypothesis h by a new one of type `newType`, proved by `proof` (in g's context) */
  replaceHyp(g: number, h: number, newType: Expr, proof: Expr): number {
    const d = this.decl(g);
    const old = d.lctx.get(h)!;
    let l = LocalContext.empty;
    const dependents = d.lctx.decls.filter((x) => x.id !== h && hasFVar(this.el.instantiate(x.type), h));
    for (const x of d.lctx.decls) if (x.id !== h) l = l.push(x);
    if (dependents.length > 0 || hasFVar(this.type(g), h)) {
      // keep the old hypothesis (something depends on it) and add the new one
      l = d.lctx;
    }
    const nd: LocalDecl = { id: freshFVarId(), name: old.name, type: newType };
    l = l.push(nd);
    const ng = this.mkGoal(this.type(g), d.name, l);
    // (λ h'. ?ng) proof
    const el = this.el;
    const saved = el.lctx;
    el.lctx = l;
    let lam: Expr;
    try {
      lam = el.mkBinding('lam', [mkFVar(nd.id)], this.goalTerm(ng));
    } finally {
      el.lctx = saved;
    }
    this.assign(g, mkApp(lam, proof));
    return ng;
  }

  /** add a hypothesis name : type := proof (proof in g's context); returns the new goal and the new local */
  addHyp(g: number, name: string, type: Expr, proof: Expr): { goal: number; fv: FVar } {
    const d = this.decl(g);
    const nd: LocalDecl = { id: freshFVarId(), name, type };
    const l = d.lctx.push(nd);
    const ng = this.mkGoal(this.type(g), d.name, l);
    const el = this.el;
    const saved = el.lctx;
    el.lctx = l;
    let lam: Expr;
    try {
      lam = el.mkBinding('lam', [mkFVar(nd.id)], this.goalTerm(ng));
    } finally {
      el.lctx = saved;
    }
    this.assign(g, mkApp(lam, proof));
    return { goal: ng, fv: mkFVar(nd.id) as FVar };
  }

  findHyp(g: number, name: string, span: Span): LocalDecl {
    const d = this.decl(g).lctx.findByName(name);
    if (!d) this.fail(span, `unknown hypothesis '${name}'`);
    return d;
  }

  // -------------------------------------------------------------------------
  // the interpreter

  exec(t: Tactic): void {
    switch (t.k) {
      case 'seq':
        for (const x of t.tacs) this.exec(x);
        return;
      case 'then': {
        this.step(t, () => {
          const g = this.mainGoal(t.span);
          const rest = this.goals.slice(1);
          this.goals = [g];
          this.exec(t.first);
          const produced = this.goals.filter((x) => !this.assigned(x));
          const out: number[] = [];
          for (const p of produced) {
            this.goals = [p];
            this.exec(t.rest);
            out.push(...this.goals);
          }
          this.goals = [...out, ...rest];
        });
        return;
      }
      case 'focus':
        return this.focus(t, t.tac);
      case 'case':
      case 'next': {
        const live = this.goals.filter((x) => !this.assigned(x));
        let g: number | undefined;
        if (t.k === 'next') g = live[0];
        else g = live.find((x) => this.tag(x) === t.tag) ?? live.find((x) => this.tag(x) && short(this.tag(x)!) === t.tag);
        if (g === undefined) {
          if (t.k === 'case') this.fail(t.tagSpan, `no goal with tag '${t.tag}' (goals: ${live.map((x) => this.tag(x) ?? '_').join(', ') || 'none'})`);
          this.fail(t.span, 'no goals');
        }
        this.goals = [g, ...live.filter((x) => x !== g)];
        if (t.names.length > 0) this.goals[0] = this.renameInaccessible(g, t.names.map((n) => n.name));
        return this.focus(t, t.tac);
      }
      case 'combinator':
        return this.combinator(t);
      case 'first': {
        this.step(t, () => {
          let last: unknown;
          for (const alt of t.alts) {
            const st = this.save();
            try {
              this.exec(alt);
              return;
            } catch (e) {
              if (!(e instanceof ElabError)) throw e;
              last = e;
              this.restore(st);
            }
          }
          throw last;
        });
        return;
      }
      case 'error':
        throw new Abort();
      default:
        this.step(t, () => this.leaf(t));
    }
  }

  private focus(t: Tactic, inner: Tactic): void {
    this.step(t, () => {
      const g = this.mainGoal(t.span);
      const rest = this.goals.slice(1);
      this.goals = [g];
      this.exec(inner);
      const left = this.goals.filter((x) => !this.assigned(x));
      if (left.length > 0) {
        const e = new TacticError([`unsolved goal${left.length > 1 ? 's' : ''}`], { from: t.span.from, to: t.span.from + 1 });
        e.goals = left.map((x) => this.snapGoal(x));
        throw e;
      }
      this.goals = rest;
    });
  }

  private combinator(t: Extract<Tactic, { k: 'combinator' }>): void {
    this.step(t, () => {
      switch (t.name) {
        case 'focus':
          return this.focus(t, t.tac);
        case 'try': {
          const st = this.save();
          try {
            this.exec(t.tac);
          } catch (e) {
            if (!(e instanceof ElabError)) throw e;
            this.restore(st);
          }
          return;
        }
        case 'repeat': {
          for (let i = 0; i < 128; i++) {
            const st = this.save();
            try {
              this.exec(t.tac);
            } catch (e) {
              if (!(e instanceof ElabError)) throw e;
              this.restore(st);
              return;
            }
            if (this.goals.length === st.goals.length && this.goals.every((g, k) => g === st.goals[k])) return;
          }
          return;
        }
        case 'all_goals':
        case 'any_goals': {
          const gs = this.goals.filter((x) => !this.assigned(x));
          const out: number[] = [];
          let ok = 0;
          let lastErr: unknown;
          for (const g of gs) {
            const st = this.save();
            this.goals = [g];
            try {
              this.exec(t.tac);
              out.push(...this.goals);
              ok++;
            } catch (e) {
              if (!(e instanceof ElabError) || t.name === 'all_goals') throw e;
              lastErr = e;
              this.restore(st);
              out.push(g);
            }
          }
          if (t.name === 'any_goals' && ok === 0) throw lastErr;
          this.goals = out;
          return;
        }
      }
    });
  }

  private save() {
    return { goals: [...this.goals], cp: this.el.mctx.checkpoint(), steps: this.el.tacticSteps.length, errors: this.el.errors.length };
  }

  private restore(st: ReturnType<TacticRunner['save']>): void {
    this.goals = st.goals;
    this.el.mctx.rollback(st.cp);
    this.el.tacticSteps.length = st.steps;
    this.el.errors.length = st.errors;
  }

  /** run f as one recorded step */
  private step(t: Tactic, f: () => void): void {
    const before = this.snap();
    const beforeIds = this.goals.filter((g) => !this.assigned(g));
    const idx = this.el.tacticSteps.length;
    try {
      f();
    } catch (e) {
      if (e instanceof ElabError && !(e as TacticError).goals) (e as TacticError).goals = before;
      throw e;
    }
    this.goals = this.goals.filter((g) => !this.assigned(g));
    const step: TacticStep = {
      span: t.span,
      kind: t.k === 'atom' ? t.name : t.k === 'term' ? t.name : t.k,
      blockSpan: this.block.span,
      before,
      after: this.snap(),
      term: this.el.instantiate(this.block.m),
      lctx: this.block.lctx,
      filled: beforeIds.filter((g) => this.assigned(g)),
      mainId: this.main,
    };
    // keep steps in source order: nested steps were pushed while f ran
    this.el.tacticSteps.splice(idx, 0, step);
  }

  // -------------------------------------------------------------------------
  // leaf tactics

  private leaf(t: Tactic): void {
    switch (t.k) {
      case 'intro':
        return this.intro(t.pats, t.span);
      case 'rintro':
        return this.intro(t.pats, t.span);
      case 'intros': {
        const g = this.mainGoal(t.span);
        if (t.names.length > 0) {
          let cur = g;
          for (const n of t.names) cur = this.introOne(cur, n.name, t.span).goal;
          return this.replaceMain([cur]);
        }
        let cur = g;
        for (let i = 0; i < 64; i++) {
          const ty = this.type(cur);
          if (ty.k !== 'pi' && ty.k !== 'let') break;
          cur = this.introOne(cur, undefined, t.span).goal;
        }
        return this.replaceMain([cur]);
      }
      case 'term':
        return this.termTactic(t);
      case 'exists': {
        const g = this.mainGoal(t.span);
        const s: STerm = { k: 'anon', args: [...t.terms, this.hole(t.span)], span: t.span };
        const gs = this.refineWith(g, s, t.span);
        this.replaceMain(gs);
        // like Lean, try to close what is left with `trivial`
        for (const x of gs) {
          const st = this.save();
          this.goals = [x, ...this.goals.filter((y) => y !== x)];
          try {
            this.trivial(t.span, x);
          } catch (e) {
            if (!(e instanceof ElabError)) throw e;
            this.restore(st);
          }
        }
        return;
      }
      case 'atom':
        return this.atom(t.name, t.span);
      case 'decide':
        return this.decide(t.span);
      case 'cases':
        return this.cases(t);
      case 'induction':
        return this.induction(t);
      case 'rcases': {
        const g = this.mainGoal(t.span);
        const x = this.hypOrHave(g, t.target, undefined, t.span);
        return this.replaceMain(this.rcasesOn(x.goal, x.fv, t.pat, t.span));
      }
      case 'obtain': {
        const g = this.mainGoal(t.span);
        if (!t.value) {
          if (!t.type) this.fail(t.span, 'obtain needs `: type` or `:= proof`');
          // obtain pat : T   — prove T first
          const tg = this.withGoal(g, () => this.mkGoal(this.elabType(t.type!, t.span)));
          const x = this.withGoal(g, () => this.addHyp(g, 'h✝', this.type(tg), this.goalTerm(tg)));
          this.goals = [tg, ...this.rcasesOn(x.goal, x.fv.id, t.pat, t.span), ...this.goals.slice(1)];
          return;
        }
        const x = this.hypOrHave(g, t.value, t.type, t.span);
        return this.replaceMain(this.rcasesOn(x.goal, x.fv, t.pat, t.span));
      }
      case 'rw':
        return this.rewrite(t);
      case 'simp': {
        const g = this.mainGoal(t.span);
        return this.replaceMain(simpTactic(this, g, t));
      }
      case 'unfold': {
        const g = this.mainGoal(t.span);
        return this.replaceMain(unfoldTactic(this, g, t));
      }
      case 'have':
        return this.have(t);
      case 'suffices': {
        const g = this.mainGoal(t.span);
        const T = this.withGoal(g, () => this.elabType(t.type, t.span));
        const tg = this.withGoal(g, () => this.mkGoal(T));
        const x = this.withGoal(g, () => this.addHyp(g, t.name ?? 'this', T, this.goalTerm(tg)));
        if (t.value) {
          const r = this.withGoal(x.goal, () => this.elabTerm(t.value!, this.type(x.goal), { span: t.span }));
          this.assign(x.goal, r.e);
          this.goals = [tg, ...this.goals.slice(1)];
        } else if (t.tac) {
          const rest = this.goals.slice(1);
          this.goals = [x.goal];
          this.exec(t.tac);
          if (this.goals.some((y) => !this.assigned(y))) this.fail(t.span, 'unsolved goals after `suffices … by`');
          this.goals = [tg, ...rest];
        } else this.goals = [x.goal, tg, ...this.goals.slice(1)];
        return;
      }
      case 'calc': {
        const g = this.mainGoal(t.span);
        return this.replaceMain(this.refineWith(g, t.term, t.span));
      }
      case 'names':
        return this.namesTactic(t);
      case 'injection':
        this.fail(t.span, '`injection` is not available in this course; use `cases h` (it performs injection and substitution)');
      // eslint-disable-next-line no-fallthrough
      case 'by_cases':
        return this.byCases(t);
      case 'generalize':
        return this.generalize(t);
      default:
        this.fail(t.span, `tactic '${t.k}' is not supported here`);
    }
  }

  elabType(s: STerm, span: Span): Expr {
    const el = this.el;
    const saved = { pending: el.pending, inst: el.instPending, blocks: el.tacticBlocks };
    el.pending = [];
    el.instPending = [];
    el.tacticBlocks = [];
    try {
      const t = el.elabType(s).e;
      el.synthesizePending(true);
      const r = el.instantiate(t);
      if (el.mctx.collectMVars(r).size > 0) this.fail(span, 'the type contains holes that could not be filled: ', { e: r, lctx: el.lctx });
      return r;
    } finally {
      el.pending = saved.pending;
      el.instPending = saved.inst;
      el.tacticBlocks = saved.blocks;
    }
  }

  // ----- intro

  introOne(g: number, name: string | undefined, span: Span): { goal: number; fv: FVar } {
    return this.withGoal(g, () => {
      let ty = this.type(g);
      if (ty.k !== 'pi' && ty.k !== 'let') ty = this.el.whnf(ty);
      if (ty.k === 'let') {
        const fv = this.el.pushLocal(name ?? ty.name, ty.type, 'default', ty.value);
        const body = instantiate1(ty.body, fv);
        const ng = this.mkGoal(body, this.decl(g).name);
        const lam = this.el.mkBinding('lam', [fv], this.goalTerm(ng));
        this.el.lctx = popLocal(this.el.lctx, fv.id);
        // a let in the goal: introduce it as a let-bound hypothesis
        this.assign(g, instantiate1((lam as Extract<Expr, { k: 'lam' }>).body, ty.value));
        return { goal: ng, fv };
      }
      if (ty.k !== 'pi') this.fail(span, 'no more hypotheses to introduce: the goal\n  ', { e: this.type(g), lctx: this.el.lctx }, '\nis not a function type (∀, → or ¬)');
      const nm = name && name !== '_' ? name : inaccessibleName(ty.name);
      const fv = this.el.pushLocal(nm, ty.type, 'default');
      const ng = this.mkGoal(instantiate1(ty.body, fv), this.decl(g).name);
      const lam = this.el.mkBinding('lam', [fv], this.goalTerm(ng));
      this.el.lctx = popLocal(this.el.lctx, fv.id);
      this.assign(g, lam);
      return { goal: ng, fv };
    });
  }

  private intro(pats: RPat[], span: Span): void {
    const g = this.mainGoal(span);
    if (pats.length === 0) {
      const r = this.introOne(g, undefined, span);
      return this.replaceMain([r.goal]);
    }
    let goals = [g];
    for (const p of pats) {
      const next: number[] = [];
      for (const cur of goals) {
        if (p.k === 'var' || p.k === 'wild') {
          next.push(this.introOne(cur, p.k === 'var' ? p.name : undefined, p.span).goal);
        } else {
          const r = this.introOne(cur, undefined, p.span);
          next.push(...this.rcasesOn(r.goal, r.fv.id, p, p.span));
        }
      }
      goals = next;
    }
    this.replaceMain(goals);
  }

  /** `case tag x y` names the most recent inaccessible hypotheses */
  private renameInaccessible(g: number, names: string[]): number {
    const d = this.decl(g);
    const inacc = d.lctx.decls.filter((x) => x.name.endsWith('✝'));
    const targets = inacc.slice(Math.max(0, inacc.length - names.length));
    let cur = g;
    targets.forEach((x, i) => {
      if (names[i] !== '_') cur = this.renameHyp(cur, x.id, names[i]);
    });
    return cur;
  }

  // ----- exact / apply / refine / …

  private termTactic(t: Extract<Tactic, { k: 'term' }>): void {
    const g = this.mainGoal(t.span);
    switch (t.name) {
      case 'exact': {
        this.withGoal(g, () => {
          const r = this.elabTerm(t.term, this.type(g), { span: t.span });
          if (r.synthetic.length > 0) this.fail(t.span, 'exact: the term still has holes ?_ (use refine to leave them as new goals)');
          this.assign(g, r.e);
        });
        return this.replaceMain([]);
      }
      case 'refine': {
        const gs = this.refineWith(g, t.term, t.span);
        return this.replaceMain(gs);
      }
      case 'apply': {
        const gs = this.withGoal(g, () => {
          const r = this.elabTerm(t.term, undefined, { allowNatural: true, span: t.span });
          return this.applyExpr(g, r.e, t.span, r.natural);
        });
        return this.replaceMain(gs);
      }
      case 'specialize': {
        const ng = this.withGoal(g, () => {
          const r = this.elabTerm(t.term, undefined, { span: t.span });
          const h = getAppFn(r.e);
          if (h.k !== 'fvar') this.fail(t.span, 'specialize: expected a hypothesis applied to arguments, like `specialize h x`');
          return this.replaceHyp(g, h.id, this.el.instantiate(this.el.inferType(r.e)), r.e);
        });
        return this.replaceMain([ng]);
      }
      case 'show':
      case 'change': {
        if (t.loc && !t.loc.goal) {
          let cur = g;
          for (const hn of t.loc.hyps) {
            cur = this.withGoal(cur, () => {
              const h = this.findHyp(cur, hn.name, hn.span);
              const T = this.elabTerm(t.term, undefined, { allowNatural: true, span: t.span }).e;
              if (!this.el.isDefEq(T, h.type)) this.fail(t.span, 'change: the new type\n  ', { e: T, lctx: this.el.lctx }, '\nis not definitionally equal to\n  ', { e: h.type, lctx: this.el.lctx });
              return this.replaceHyp(cur, h.id, this.el.instantiate(T), mkFVar(h.id));
            });
          }
          return this.replaceMain([cur]);
        }
        const ng = this.withGoal(g, () => {
          const r = this.elabTerm(t.term, undefined, { allowNatural: true, span: t.span });
          if (!this.el.isDefEq(r.e, this.type(g))) {
            this.fail(t.span, `${t.name}: the type\n  `, { e: r.e, lctx: this.el.lctx }, '\ndoes not match the goal\n  ', { e: this.type(g), lctx: this.el.lctx });
          }
          const T = this.el.instantiate(r.e);
          const ng = this.mkGoal(T, this.decl(g).name);
          this.assign(g, this.goalTerm(ng));
          return ng;
        });
        return this.replaceMain([ng]);
      }
      default:
        this.fail(t.span, `tactic '${t.name}' is not supported`);
    }
  }

  /**
   * apply f: find how many arguments f needs for its conclusion to match the
   * goal; the arguments that remain unknown become new goals.
   */
  applyExpr(g: number, f: Expr, span: Span, extra: number[] = []): number[] {
    const el = this.el;
    const goal = this.type(g);
    let e = f;
    let ft = el.instantiate(el.inferType(f));
    const args: { id: number; binfo: string; name: string }[] = [];
    const n0 = el.mctx.count;
    for (let i = 0; i < 64; i++) {
      const cp = el.mctx.checkpoint();
      if (el.isDefEq(ft, goal)) {
        // solve instance arguments, and the rest become goals
        for (const a of args) {
          if (a.binfo !== 'inst' || el.mctx.isAssigned(a.id)) continue;
          const d = el.mctx.get(a.id)!;
          const inst = synthInstance(el, el.instantiate(d.localType));
          if (!inst || !el.isDefEq(mkApps(mkMVar(a.id), d.ctx.map(mkFVar)), inst)) this.fail(span, 'apply: failed to synthesize an instance of\n  ', { e: el.instantiate(d.localType), lctx: el.lctx });
        }
        this.assign(g, e);
        const fresh = [...extra, ...el.mctx.createdSince(n0)].filter((id) => !el.mctx.isAssigned(id));
        const seen = new Set<number>();
        const newGoals = fresh.filter((id) => {
          if (seen.has(id)) return false;
          seen.add(id);
          return el.mctx.collectMVars(el.instantiate(e)).has(id);
        });
        // non-dependent goals first
        const dependent = (id: number) => newGoals.some((o) => o !== id && el.mctx.collectMVars(el.instantiate(el.mctx.get(o)!.localType)).has(id));
        const ordered = [...newGoals.filter((id) => !dependent(id)), ...newGoals.filter(dependent)];
        for (const id of ordered) {
          const d = el.mctx.get(id)!;
          d.kind = 'synthetic';
        }
        return ordered;
      }
      el.mctx.rollback(cp);
      const w = el.whnf(ft);
      if (w.k !== 'pi') {
        this.fail(span, 'apply failed: could not unify the conclusion of\n  ', { e: el.instantiate(el.inferType(f)), lctx: el.lctx }, '\nwith the goal\n  ', { e: goal, lctx: el.lctx });
      }
      const m = el.mctx.newMVar(el.lctx, w.type, 'natural', { name: w.name.endsWith('✝') || w.name === '_' ? undefined : w.name, what: `argument '${w.name}'` });
      args.push({ id: (getAppFn(m) as { id: number }).id, binfo: w.binfo, name: w.name });
      e = mkApp(e, m);
      ft = instantiate1(w.body, m);
    }
    this.fail(span, 'apply: too many arguments');
  }

  // ----- atoms

  private atom(name: string, span: Span): void {
    switch (name) {
      case 'skip':
        return;
      case 'done':
        if (this.goals.some((g) => !this.assigned(g))) this.fail(span, 'unsolved goals');
        return;
      case 'sorry': {
        const g = this.mainGoal(span);
        this.el.usesSorry = true;
        this.admit(g);
        return this.replaceMain([]);
      }
      case 'rfl':
        return this.rfl(span);
      case 'constructor': {
        const g = this.mainGoal(span);
        const ind = this.goalInductive(g, span);
        for (const c of ind.ctors) {
          const st = this.save();
          try {
            const gs = this.withGoal(g, () => this.applyExpr(g, this.el.elab(this.id(c, span)), span));
            return this.replaceMain(gs);
          } catch (e) {
            if (!(e instanceof ElabError)) throw e;
            this.restore(st);
          }
        }
        this.fail(span, 'constructor: no constructor of ', { e: this.type(g), lctx: this.decl(g).lctx }, ' applies');
      }
      // eslint-disable-next-line no-fallthrough
      case 'left':
      case 'right': {
        const g = this.mainGoal(span);
        const ind = this.goalInductive(g, span);
        if (ind.ctors.length !== 2) this.fail(span, `${name}: the goal must be an inductive type with exactly two constructors (like ∨)`);
        const c = ind.ctors[name === 'left' ? 0 : 1];
        const gs = this.withGoal(g, () => this.applyExpr(g, this.el.elab(this.id(c, span)), span));
        return this.replaceMain(gs);
      }
      case 'exfalso': {
        const g = this.mainGoal(span);
        return this.replaceMain(this.refineWith(g, this.app('False.elim', [this.hole(span)], span), span));
      }
      case 'contradiction':
        return this.contradiction(span);
      case 'assumption':
        return this.assumption(span);
      case 'trivial':
        return this.trivial(span, this.mainGoal(span));
      case 'omega': {
        const g = this.mainGoal(span);
        omegaTactic(this, g, span);
        return this.replaceMain([]);
      }
      case 'split':
        return this.split(span);
      case 'nofun': {
        const g = this.mainGoal(span);
        const r = this.introOne(g, undefined, span);
        this.replaceMain([r.goal]);
        return this.replaceMain(this.refineWith(r.goal, { k: 'match', discrs: [{ k: 'elaborated', e: r.fv, span }], alts: [], span }, span));
      }
      default:
        this.fail(span, `unknown tactic '${name}'`);
    }
  }

  private goalInductive(g: number, span: Span) {
    const t = this.withGoal(g, () => this.el.whnf(this.type(g)));
    const h = getAppFn(t);
    const d = h.k === 'const' ? this.el.env.get(h.name) : undefined;
    if (!d || d.kind !== 'inductive') this.fail(span, 'the goal is not an inductive type: ', { e: this.type(g), lctx: this.decl(g).lctx });
    return d;
  }

  private rfl(span: Span): void {
    const g = this.mainGoal(span);
    this.withGoal(g, () => {
      const T = this.type(g);
      const h = getAppFn(T);
      const lemmas = h.k === 'const' ? ({ Eq: 'rfl', Iff: 'Iff.rfl', 'Nat.le': 'Nat.le.refl', HEq: 'HEq.refl' } as Record<string, string>)[h.name] : undefined;
      if (!lemmas || !this.el.env.has(lemmas === 'rfl' ? 'rfl' : lemmas)) this.fail(span, 'rfl: the goal is not a reflexive relation (=, ↔, ≤): ', { e: T, lctx: this.el.lctx });
      const cp = this.el.mctx.checkpoint();
      try {
        const r = this.elabTerm(this.id(lemmas, span), T, { span });
        this.assign(g, r.e);
      } catch (e) {
        if (!(e instanceof ElabError)) throw e;
        this.el.mctx.rollback(cp);
        const args = getAppArgs(T);
        this.fail(span, 'rfl failed: the two sides are not definitionally equal:\n  ', { e: args[args.length - 2], lctx: this.el.lctx }, '\nand\n  ', { e: args[args.length - 1], lctx: this.el.lctx });
      }
    });
    this.replaceMain([]);
  }

  private assumption(span: Span): void {
    const g = this.mainGoal(span);
    const ok = this.withGoal(g, () => {
      const T = this.type(g);
      const ds = this.decl(g).lctx.decls;
      for (let i = ds.length - 1; i >= 0; i--) {
        const cp = this.el.mctx.checkpoint();
        if (this.el.isDefEq(ds[i].type, T)) {
          this.assign(g, mkFVar(ds[i].id));
          return true;
        }
        this.el.mctx.rollback(cp);
      }
      return false;
    });
    if (!ok) this.fail(span, 'assumption: no hypothesis matches the goal');
    this.replaceMain([]);
  }

  trivial(span: Span, g: number): void {
    const attempts: (() => void)[] = [
      () => this.rfl(span),
      () => this.assumption(span),
      () => this.replaceMain(this.refineWith(g, this.id('True.intro', span), span)),
      () => this.decide(span),
      () => {
        const gs = this.refineWith(g, this.app('And.intro', [this.hole(span), this.hole(span)], span), span);
        this.replaceMain(gs);
        for (let i = 0; i < gs.length; i++) this.trivial(span, this.mainGoal(span));
      },
    ];
    for (const f of attempts) {
      const st = this.save();
      this.goals = [g, ...this.goals.filter((x) => x !== g)];
      try {
        f();
        return;
      } catch (e) {
        if (!(e instanceof ElabError)) throw e;
        this.restore(st);
      }
    }
    this.fail(span, 'trivial failed to close the goal');
  }

  private contradiction(span: Span): void {
    const g = this.mainGoal(span);
    const el = this.el;
    const ok = this.withGoal(g, () => {
      const ds = this.decl(g).lctx.decls;
      const T = this.type(g);
      const tryTerm = (s: STerm): boolean => {
        const cp = el.mctx.checkpoint();
        const nerr = el.errors.length;
        const nw = el.warnings.length;
        try {
          const r = this.elabTerm(s, T, { span });
          this.assign(g, r.e);
          return true;
        } catch (e) {
          if (!(e instanceof ElabError)) throw e;
          el.mctx.rollback(cp);
          el.errors.length = nerr;
          el.warnings.length = nw;
          return false;
        }
      };
      for (let i = ds.length - 1; i >= 0; i--) {
        const d = ds[i];
        const ty = el.whnf(el.instantiate(d.type));
        const h = getAppFn(ty);
        const hyp = this.E(mkFVar(d.id), span);
        if (h.k === 'const') {
          const decl = el.env.get(h.name);
          // False, Empty, and other types without constructors
          if (decl?.kind === 'inductive' && decl.ctors.length === 0 && tryTerm({ k: 'match', discrs: [hyp], alts: [], span })) return true;
          // c₁ … = c₂ …  with different constructors
          if (h.name === 'Eq') {
            const [, a, b] = getAppArgs(ty);
            const ca = getAppFn(el.whnf(a));
            const cb = getAppFn(el.whnf(b));
            if (ca.k === 'const' && cb.k === 'const' && ca.name !== cb.name && el.env.get(ca.name)?.kind === 'ctor' && el.env.get(cb.name)?.kind === 'ctor') {
              if (tryTerm({ k: 'match', discrs: [hyp], alts: [], span })) return true;
            }
          }
        }
        // ¬p together with p
        if (ty.k === 'pi') {
          for (const d2 of ds) {
            if (d2.id === d.id) continue;
            const cp = el.mctx.checkpoint();
            if (el.isDefEq(d2.type, ty.type)) {
              if (tryTerm(this.app('absurd', [this.E(mkFVar(d2.id), span), hyp], span))) return true;
            }
            el.mctx.rollback(cp);
          }
          // a ≠ a
          const dom = el.whnf(ty.type);
          const dh = getAppFn(dom);
          if (dh.k === 'const' && dh.name === 'Eq') {
            const [, a, b] = getAppArgs(dom);
            if (el.isDefEq(a, b) && tryTerm(this.app('absurd', [this.id('rfl', span), hyp], span))) return true;
          }
        }
      }
      return false;
    });
    if (!ok) this.fail(span, 'contradiction: no contradictory hypotheses found (looked for False, ¬p together with p, a ≠ a, and equations between different constructors)');
    this.replaceMain([]);
  }

  decide(span: Span): void {
    const g = this.mainGoal(span);
    this.withGoal(g, () => {
      const el = this.el;
      const T = this.type(g);
      if (el.mctx.collectMVars(T).size > 0) this.fail(span, 'decide: the goal contains metavariables');
      const decT = mkApp(mkConst('Decidable'), T);
      const inst = synthInstance(el, decT);
      if (!inst) this.fail(span, 'decide failed: no Decidable instance for the proposition\n  ', { e: T, lctx: el.lctx });
      const dec = mkApps(mkConst('Decidable.decide'), [T, inst]);
      let v: Expr;
      try {
        v = el.whnf(dec);
      } catch {
        this.fail(span, 'decide failed: the decision procedure did not finish within the allotted fuel');
      }
      const vh = getAppFn(v);
      if (!(vh.k === 'const' && vh.name === 'Bool.true')) {
        if (vh.k === 'const' && vh.name === 'Bool.false') this.fail(span, 'decide failed: the proposition\n  ', { e: T, lctx: el.lctx }, '\nis false (its decision procedure returns false)');
        this.fail(span, 'decide failed: the decision procedure did not reduce to true or false (does the proposition have free variables?)');
      }
      const proof = mkApps(mkConst('of_decide_eq_true'), [T, inst, mkApps(mkConst('Eq.refl', [{ k: 'succ', l: { k: 'zero' } }]), [mkConst('Bool'), mkConst('Bool.true')])]);
      this.assign(g, proof);
    });
    this.replaceMain([]);
  }

  // ----- cases and friends

  /**
   * Case analysis on `target` (a term in g's context), by elaborating a `match`
   * whose right-hand sides are new goals. The match compiler does the work:
   * dependent elimination, index unification, reverting hypotheses.
   */
  casesCore(g: number, target: Expr, span: Span, names: Map<string, string[]> = new Map(), tagPrefix?: string): { goal: number; ctor: string; fields: FVar[] }[] {
    const el = this.el;
    return this.withGoal(g, () => {
      const tt = el.whnf(el.instantiate(el.inferType(target)));
      const h = getAppFn(tt);
      const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
      if (!ind || ind.kind !== 'inductive') this.fail(span, 'cases: the type of the target\n  ', { e: tt, lctx: el.lctx }, '\nis not an inductive type');
      const holes: { tag: string; ctor: string; fieldNames: string[]; m?: Expr; aliases?: Map<string, Expr> }[] = [];
      const alts = ind.ctors.map((c, k) => {
        const cd = el.env.get(c) as { numFields: number };
        const user = names.get(short(c)) ?? names.get(c) ?? [];
        // user names go to the explicit fields, in order
        const explicit = explicitFields(el, c);
        let u = 0;
        const fieldNames = Array.from({ length: cd.numFields }, (_, i) => {
          const n = explicit[i] ? user[u++] : undefined;
          return n && n !== '_' ? n : `__f${k}_${i}`;
        });
        const tag = `__case${k}`;
        holes.push({ tag, ctor: c, fieldNames });
        const pat: STerm = { k: 'app', fn: this.id(c, span, true), args: fieldNames.map((n) => ({ arg: this.id(n, span) })), span };
        return { pats: [cd.numFields === 0 ? this.id(c, span, true) : pat], rhs: { k: 'synthHole' as const, name: tag, span }, span };
      });
      const savedHook = el.holeHook;
      const nw = el.warnings.length;
      el.holeHook = (name, m, aliases) => {
        const hole = holes.find((x) => x.tag === name);
        if (hole) {
          hole.m = m;
          hole.aliases = new Map(aliases);
        }
      };
      let r: ReturnType<TacticRunner['elabTerm']>;
      try {
        el.aliases.set('__discr', target);
        r = this.elabTerm({ k: 'match', discrs: [this.id('__discr', span)], alts, span }, this.type(g), { span });
      } finally {
        el.holeHook = savedHook;
        el.warnings.length = nw;
        el.aliases.delete('__discr');
      }
      this.assign(g, r.e);
      // stale hypotheses: the target, what depended on it, and its index variables
      const stale: number[] = [];
      const t0 = el.instantiate(target);
      if (t0.k === 'fvar') {
        stale.push(t0.id);
        for (const ix of getAppArgs(tt)) if (ix.k === 'fvar') stale.push(ix.id);
        for (const d of this.decl(g).lctx.decls) {
          const ty = el.instantiate(d.type);
          if (stale.some((id) => hasFVar(ty, id))) stale.push(d.id);
        }
      }
      const out: { goal: number; ctor: string; fields: FVar[] }[] = [];
      for (const hole of holes) {
        if (!hole.m) continue; // an impossible case
        let goal = (getAppFn(hole.m) as { id: number }).id;
        if (el.mctx.isAssigned(goal)) continue;
        const fields = hole.fieldNames.map((n) => el.instantiate(hole.aliases!.get(n)!) as FVar).filter((f) => f && f.k === 'fvar');
        this.decl(goal).name = tagPrefix ?? short(hole.ctor);
        // hypotheses that the match reverted and reintroduced: the originals are shadowed and stale
        const gl = this.decl(goal).lctx.decls;
        const shadowed = this.decl(g).lctx.decls.filter((d) => gl.some((x, i) => x.id !== d.id && x.name === d.name && i > gl.findIndex((y) => y.id === d.id))).map((d) => d.id);
        goal = this.clearStale(goal, [...stale, ...shadowed].filter((id) => !fields.some((f) => f.id === id)));
        out.push({ goal, ctor: hole.ctor, fields });
      }
      return out;
    });
  }

  private cases(t: Extract<Tactic, { k: 'cases' }>): void {
    const g = this.mainGoal(t.span);
    if (t.hname) this.fail(t.span, '`cases h : e` is not supported; use `generalize h : e = x` first');
    const target = this.withGoal(g, () => this.elabTerm(t.target, undefined, { span: t.span }).e);
    const names = new Map<string, string[]>();
    for (const a of t.alts ?? []) names.set(a.ctor.replace(/^\./, ''), a.names.map((n) => n.name));
    const res = this.casesCore(g, target, t.span, names);
    this.runAlts(res, t.alts, t.span);
  }

  private runAlts(res: { goal: number; ctor: string }[], alts: TacAlt[] | undefined, span: Span): void {
    if (!alts) return this.replaceMain(res.map((r) => r.goal));
    const rest = this.goals.slice(1);
    const out: number[] = [];
    const used = new Set<TacAlt>();
    for (const r of res) {
      const alt = alts.find((a) => a.ctor.replace(/^\./, '') === short(r.ctor) || a.ctor === r.ctor) ?? alts.find((a) => a.ctor === '_');
      if (!alt) this.fail(span, `alternative '${short(r.ctor)}' has not been provided`);
      used.add(alt);
      this.goals = [r.goal];
      this.exec(alt.tac);
      out.push(...this.goals.filter((x) => !this.assigned(x)));
    }
    for (const a of alts) if (!used.has(a) && a.ctor !== '_') this.el.warnings.push({ span: a.span, msg: [`unused alternative '${a.ctor}' (this case is impossible or does not exist)`] });
    this.goals = [...out, ...rest];
  }

  /** a hypothesis for the term: the local itself, or a new `have` */
  private hypOrHave(g: number, s: STerm, typeS: STerm | undefined, span: Span): { goal: number; fv: number } {
    return this.withGoal(g, () => {
      const T = typeS ? this.elabType(typeS, span) : undefined;
      const e = this.elabTerm(s, T, { span }).e;
      if (e.k === 'fvar' && !T && !this.decl(g).lctx.get(e.id)?.value) return { goal: g, fv: e.id };
      const r = this.addHyp(g, 'h✝', T ?? this.el.instantiate(this.el.inferType(e)), e);
      return { goal: r.goal, fv: r.fv.id };
    });
  }

  /** rcases patterns on hypothesis x of goal g */
  rcasesOn(g: number, x: number, pat: RPat, span: Span): number[] {
    switch (pat.k) {
      case 'var':
        return [this.renameHyp(g, x, pat.name)];
      case 'wild':
        return [g];
      case 'typed': {
        const ng = this.withGoal(g, () => {
          const T = this.elabType(pat.type, span);
          const d = this.decl(g).lctx.get(x)!;
          if (!this.el.isDefEq(T, d.type)) this.fail(pat.span, 'the pattern type does not match the hypothesis');
          return this.replaceHyp(g, x, T, mkFVar(x));
        });
        const nd = this.decl(ng).lctx.decls[this.decl(ng).lctx.decls.length - 1];
        return this.rcasesOn(ng, nd.id, pat.pat, span);
      }
      case 'rfl': {
        const res = this.casesCore(g, mkFVar(x), span);
        return res.map((r) => r.goal);
      }
      case 'tuple':
      case 'alts': {
        const res = this.casesCore(g, mkFVar(x), span);
        const out: number[] = [];
        const ind = this.withGoal(g, () => {
          const tt = this.el.whnf(this.el.instantiate(this.decl(g).lctx.get(x)!.type));
          return this.el.env.get((getAppFn(tt) as { name: string }).name) as { ctors: string[] };
        });
        for (const r of res) {
          const k = ind.ctors.indexOf(r.ctor);
          let sub: RPat = pat;
          if (pat.k === 'alts') sub = pat.pats[k] ?? { k: 'wild', span: pat.span };
          const pats: RPat[] = sub.k === 'tuple' ? sub.pats : [sub];
          // explicit fields only (implicit ones are unnamed)
          const fields = r.fields;
          let goals = [r.goal];
          const n = fields.length;
          for (let i = 0; i < n && i < pats.length; i++) {
            let p = pats[i];
            if (i === n - 1 && pats.length > n) p = { k: 'tuple', pats: pats.slice(i), span: p.span };
            const next: number[] = [];
            for (const gg of goals) {
              // the field keeps its id across the renaming/clearing of other hypotheses
              const fd = this.decl(gg).lctx.decls.find((d) => d.id === fields[i].id);
              if (!fd) {
                next.push(gg);
                continue;
              }
              next.push(...this.rcasesOn(gg, fd.id, p, span));
            }
            goals = next;
          }
          out.push(...goals);
        }
        return out;
      }
    }
  }

  // ----- induction

  private induction(t: Extract<Tactic, { k: 'induction' }>): void {
    const g = this.mainGoal(t.span);
    const el = this.el;
    const res = this.withGoal(g, () => {
      const x = this.elabTerm(t.target, undefined, { span: t.span }).e;
      if (x.k !== 'fvar') this.fail(t.target.span, 'induction: the target must be a variable (use `generalize h : e = x` first)');
      const xd = el.lctx.get(x.id)!;
      const xt = el.whnf(el.instantiate(xd.type));
      const h = getAppFn(xt);
      const ind = h.k === 'const' ? el.env.get(h.name) : undefined;
      if (!ind || ind.kind !== 'inductive' || h.k !== 'const') this.fail(t.target.span, 'induction: the type of the target\n  ', { e: xt, lctx: el.lctx }, '\nis not an inductive type');
      if (ind.all.length > 1) this.fail(t.span, 'induction on mutual inductive types is not supported');
      const targs = getAppArgs(xt);
      const ps = targs.slice(0, ind.numParams);
      const is = targs.slice(ind.numParams);
      for (const ix of is) {
        if (ix.k !== 'fvar' || ps.some((p) => hasFVar(p, ix.id)) || is.filter((y) => exprEq(y, ix)).length > 1) {
          this.fail(t.target.span, 'induction: an index of the target\'s type is not a variable:\n  ', { e: ix, lctx: el.lctx }, '\n(generalize it first, e.g. `generalize h : e = y`)');
        }
      }
      const idxIds = is.map((ix) => (ix as FVar).id);
      // hypotheses to revert: those named in `generalizing`, and everything that depends on x or the indices
      const decls = el.lctx.decls;
      const revIds = new Set<number>();
      for (const n of t.generalizing) {
        const d = el.lctx.findByName(n.name);
        if (!d) this.fail(n.span, `unknown variable '${n.name}'`);
        revIds.add(d.id);
      }
      const mentions = (d: LocalDecl, ids: Iterable<number>) => {
        const ty = el.instantiate(d.type);
        for (const id of ids) if (hasFVar(ty, id)) return true;
        return false;
      };
      for (const d of decls) {
        if (d.id === x.id || idxIds.includes(d.id)) continue;
        if (mentions(d, [x.id, ...idxIds, ...revIds])) revIds.add(d.id);
      }
      const reverted = decls.filter((d) => revIds.has(d.id));
      const keep = decls.filter((d) => d.id !== x.id && !idxIds.includes(d.id) && !revIds.has(d.id));
      for (const d of keep) {
        if (mentions(d, [x.id, ...idxIds, ...revIds])) this.fail(t.span, `induction: hypothesis '${d.name}' depends on the target; revert it or add it to 'generalizing'`);
      }
      let base = LocalContext.empty;
      for (const d of keep) base = base.push(d);
      const goal = this.type(g);
      // motive := λ is' x'. Π reverted', goal
      const motive = el.withSavedLctx(() => {
        el.lctx = base;
        const sigma = new Map<number, Expr>();
        const idxLocals: FVar[] = [];
        let it = el.whnf(el.inferType(mkApps(mkConst(h.name, h.levels), ps)));
        for (let k = 0; k < is.length; k++) {
          const pi = el.whnf(it) as Extract<Expr, { k: 'pi' }>;
          const fv = el.pushLocal(el.lctx.get(idxIds[k])?.name ?? pi.name, pi.type);
          idxLocals.push(fv);
          sigma.set(idxIds[k], fv);
          it = instantiate1(pi.body, fv);
        }
        const xl = el.pushLocal(xd.name, mkApps(mkConst(h.name, h.levels), [...ps, ...idxLocals]));
        sigma.set(x.id, xl);
        const rl: FVar[] = [];
        for (const r of reverted) {
          const nl = el.pushLocal(r.name, substFVars(el.instantiate(r.type), sigma), r.binfo);
          sigma.set(r.id, nl);
          rl.push(nl);
        }
        const body = el.mkBinding('pi', rl, substFVars(goal, sigma));
        return el.mkBinding('lam', [...idxLocals, xl], body);
      });
      // universe of the motive
      const mlevel = el.withSavedLctx(() => {
        el.lctx = base;
        let mt = el.inferType(motive);
        for (let i = 0; i < 64; i++) {
          mt = el.whnf(mt);
          if (mt.k !== 'pi') break;
          mt = instantiate1(mt.body, el.pushLocal(mt.name, mt.type));
        }
        return mt.k === 'sort' ? el.mctx.instantiateLevel(mt.level) : undefined;
      });
      if (!mlevel) this.fail(t.span, 'induction: internal error computing the motive');
      if (ind.elimOnlyProp && toNat(mlevel) !== 0) this.fail(t.span, `induction: '${ind.name}' is a proposition; it can only be used to prove propositions`);
      const levels = ind.elimOnlyProp ? h.levels : [mlevel, ...h.levels];
      const recHead = mkApps(mkConst(`${ind.name}.rec`, levels), [...ps, motive]);
      // minors
      const altNames = new Map<string, string[]>();
      for (const a of t.alts ?? []) altNames.set(a.ctor.replace(/^\./, ''), a.names.map((n) => n.name));
      const minors: Expr[] = [];
      const produced: { goal: number; ctor: string }[] = [];
      el.withSavedLctx(() => {
        el.lctx = base;
        let rt = el.inferType(recHead);
        for (const c of ind.ctors) {
          const pi = el.whnf(rt) as Extract<Expr, { k: 'pi' }>;
          const cd = el.env.get(c) as { numFields: number };
          const user = altNames.get(short(c)) ?? [];
          const explicit = explicitFields(el, c);
          const minor = el.withSavedLctx(() => {
            let mt = pi.type;
            const opened: FVar[] = [];
            let k = 0;
            let u = 0;
            // the minor premise is Π fields, Π induction hypotheses, motive …: open exactly those binders
            while (mt.k === 'pi') {
              const w = mt;
              const isField = k < cd.numFields;
              // names go to explicit fields, then to the induction hypotheses
              const given = !isField || explicit[k] ? user[u++] : undefined;
              const nm = given && given !== '_' ? given : isField ? inaccessibleName(w.name) : 'ih✝';
              const fv = el.pushLocal(nm, betaAll(el.instantiate(w.type)));
              opened.push(fv);
              mt = instantiate1(w.body, fv);
              k++;
            }
            // mt = motive idx (c …): reintroduce the reverted hypotheses
            let rest = el.whnf(mt);
            const back: FVar[] = [];
            for (const r of reverted) {
              rest = el.whnf(rest);
              if (rest.k !== 'pi') break;
              const fv = el.pushLocal(r.name, rest.type, r.binfo);
              back.push(fv);
              rest = instantiate1(rest.body, fv);
            }
            const ng = this.mkGoal(rest, short(c));
            produced.push({ goal: ng, ctor: c });
            return el.mkBinding('lam', [...opened, ...back], this.goalTerm(ng));
          });
          minors.push(minor);
          rt = instantiate1(pi.body, minor);
        }
      });
      const proof = mkApps(recHead, [...minors, ...is, x, ...reverted.map((r) => mkFVar(r.id))]);
      this.assign(g, proof);
      return produced;
    });
    this.runAlts(res, t.alts, t.span);
  }

  // ----- rewriting

  private rewrite(t: Extract<Tactic, { k: 'rw' }>): void {
    let g = this.mainGoal(t.span);
    const extra: number[] = [];
    for (const rule of t.rules) {
      const r = rewriteTarget(this, g, rule, t.loc, t.span);
      g = r.goal;
      extra.push(...r.newGoals);
    }
    this.replaceMain([g, ...extra]);
    if (t.loc.goal && !this.assigned(g)) {
      // like Lean, try to close the goal with rfl
      const st = this.save();
      try {
        this.goals = [g, ...this.goals.filter((x) => x !== g)];
        this.rfl(t.span);
      } catch (e) {
        if (!(e instanceof ElabError)) throw e;
        this.restore(st);
      }
    }
    if (t.assumption) this.assumption(t.span);
  }

  // ----- have

  private have(t: Extract<Tactic, { k: 'have' }>): void {
    const g = this.mainGoal(t.span);
    const name = t.name ?? (t.pat ? 'h✝' : 'this');
    const T = t.type ? this.withGoal(g, () => this.elabType(t.type!, t.span)) : undefined;
    if (!t.value) {
      const tg = this.withGoal(g, () => this.mkGoal(T!));
      const x = this.withGoal(g, () => this.addHyp(g, name, T!, this.goalTerm(tg)));
      const main = t.pat ? this.rcasesOn(x.goal, x.fv.id, t.pat, t.span) : [x.goal];
      this.goals = [tg, ...main, ...this.goals.slice(1)];
      return;
    }
    const r = this.withGoal(g, () => {
      const v = this.elabTerm(t.value!, T, { span: t.span });
      const ty = T ?? this.el.instantiate(this.el.inferType(v.e));
      if (this.el.mctx.collectMVars(ty).size > 0) this.fail(t.span, 'have: cannot determine the type of the new hypothesis; add a type ascription');
      const x = this.addHyp(g, name, ty, v.e);
      return { ...x, holes: v.synthetic };
    });
    const main = t.pat ? this.rcasesOn(r.goal, r.fv.id, t.pat, t.span) : [r.goal];
    this.replaceMain([...main, ...r.holes]);
  }

  // ----- misc

  private namesTactic(t: Extract<Tactic, { k: 'names' }>): void {
    const g = this.mainGoal(t.span);
    const el = this.el;
    switch (t.name) {
      case 'subst': {
        let cur = [g];
        for (const n of t.names) {
          const next: number[] = [];
          for (const gg of cur) {
            const d = this.findHyp(gg, n.name, n.span);
            const ty = this.withGoal(gg, () => el.whnf(el.instantiate(d.type)));
            const hh = getAppFn(ty);
            let eq: LocalDecl | undefined = hh.k === 'const' && hh.name === 'Eq' ? d : undefined;
            if (!eq) {
              // `subst x`: find an equation x = e or e = x
              eq = this.decl(gg).lctx.decls.find((e) => {
                const et = el.instantiate(e.type);
                const eh = getAppFn(et);
                if (!(eh.k === 'const' && eh.name === 'Eq')) return false;
                const [, a, b] = getAppArgs(et);
                return (a.k === 'fvar' && a.id === d.id) || (b.k === 'fvar' && b.id === d.id);
              });
              if (!eq) this.fail(n.span, `subst: no equation about '${n.name}' in the context`);
            }
            next.push(...this.casesCore(gg, mkFVar(eq.id), n.span).map((r) => r.goal));
          }
          cur = next;
        }
        return this.replaceMain(cur);
      }
      case 'revert': {
        const ng = this.withGoal(g, () => {
          const ids = new Set(t.names.map((n) => this.findHyp(g, n.name, n.span).id));
          const decls = el.lctx.decls;
          for (const d of decls) if ([...ids].some((id) => hasFVar(el.instantiate(d.type), id))) ids.add(d.id);
          const rev = decls.filter((d) => ids.has(d.id));
          let l = LocalContext.empty;
          for (const d of decls) if (!ids.has(d.id)) l = l.push(d);
          const T = el.mkBinding('pi', rev.map((d) => mkFVar(d.id)), this.type(g));
          const ng = this.mkGoal(T, this.decl(g).name, l);
          this.assign(g, mkApps(this.goalTerm(ng), rev.map((d) => mkFVar(d.id))));
          return ng;
        });
        return this.replaceMain([ng]);
      }
      case 'clear': {
        let cur = g;
        for (const n of t.names) {
          const d = this.findHyp(cur, n.name, n.span);
          const before = cur;
          cur = this.clearStale(cur, [d.id]);
          if (cur === before) this.fail(n.span, `clear: '${n.name}' is used by the goal or another hypothesis`);
        }
        return this.replaceMain([cur]);
      }
      case 'funext': {
        if (!el.env.has('funext')) this.fail(t.span, 'funext is not available');
        const gs = this.withGoal(g, () => this.applyExpr(g, el.elab(this.id('funext', t.span)), t.span));
        this.replaceMain(gs);
        let cur = this.mainGoal(t.span);
        const names = t.names.length ? t.names.map((n) => n.name) : [undefined];
        for (const n of names) cur = this.introOne(cur, n, t.span).goal;
        return this.replaceMain([cur]);
      }
      case 'injection_names':
        return;
    }
  }

  private byCases(t: Extract<Tactic, { k: 'by_cases' }>): void {
    const g = this.mainGoal(t.span);
    const el = this.el;
    const name = t.name ?? 'h';
    const res = this.withGoal(g, () => {
      const p = this.elabType(t.prop, t.span);
      let inst = synthInstance(el, mkApp(mkConst('Decidable'), p));
      if (!inst && el.env.has('Classical.propDecidable')) inst = mkApp(mkConst('Classical.propDecidable'), p);
      if (!inst) this.fail(t.span, 'by_cases: no Decidable instance for\n  ', { e: p, lctx: el.lctx });
      return this.casesCore(g, inst, t.span, new Map([['isTrue', [name]], ['isFalse', [name]]]));
    });
    for (const r of res) this.decl(r.goal).name = short(r.ctor) === 'isTrue' ? 'pos' : 'neg';
    // put the positive case first
    res.sort((a, b) => (short(a.ctor) === 'isTrue' ? -1 : 0) - (short(b.ctor) === 'isTrue' ? -1 : 0));
    this.replaceMain(res.map((r) => r.goal));
  }

  /** split an `if … then … else …` in the goal into its two cases */
  private split(span: Span): void {
    const g = this.mainGoal(span);
    const el = this.el;
    const T = this.type(g);
    let found: Expr | undefined;
    replaceExpr(T, (e) => {
      if (found) return e;
      const h = getAppFn(e);
      if (h.k === 'const' && (h.name === 'ite' || h.name === 'dite') && getAppArgs(e).length >= 5) {
        found = e;
        return e;
      }
      return undefined;
    });
    if (!found) this.fail(span, 'split: no `if … then … else …` in the goal');
    const args = getAppArgs(found);
    const inst = args[2];
    const res = this.casesCore(g, inst, span, new Map([['isTrue', ['h']], ['isFalse', ['h']]]));
    const out: number[] = [];
    for (const r of res) {
      // the ite now reduces: replace it by the branch
      const ng = this.withGoal(r.goal, () => {
        const ty = this.type(r.goal);
        const red = replaceExpr(ty, (e) => {
          const h = getAppFn(e);
          if (h.k === 'const' && (h.name === 'ite' || h.name === 'dite') && getAppArgs(e).length >= 5) {
            const w = el.u.whnfCore(e);
            return w !== e ? w : undefined;
          }
          return undefined;
        });
        const nt = this.mkGoal(red, short(r.ctor) === 'isTrue' ? 'pos' : 'neg');
        this.assign(r.goal, this.goalTerm(nt));
        return nt;
      });
      out.push(ng);
    }
    out.sort((a, b) => (this.tag(a) === 'pos' ? -1 : 0) - (this.tag(b) === 'pos' ? -1 : 0));
    this.replaceMain(out);
  }

  private generalize(t: Extract<Tactic, { k: 'generalize' }>): void {
    const g = this.mainGoal(t.span);
    const el = this.el;
    const ng = this.withGoal(g, () => {
      const e = this.elabTerm(t.term, undefined, { span: t.span }).e;
      const T = el.instantiate(el.inferType(e));
      const goal = this.type(g);
      const x = el.pushLocal(t.var, T);
      const body = replaceExpr(goal, (s) => (exprEq(s, e) ? x : undefined));
      let full: Expr;
      let args: Expr[];
      if (t.name) {
        const eqT = el.elab(this.app('Eq', [this.E(e, t.span), this.E(x, t.span)], t.span));
        const hh = el.pushLocal(t.name, eqT);
        full = el.mkBinding('pi', [x, hh], body);
        args = [e, el.elab(this.app('Eq.refl', [this.E(e, t.span)], t.span))];
      } else {
        full = el.mkBinding('pi', [x], body);
        args = [e];
      }
      el.lctx = this.decl(g).lctx;
      const ng = this.mkGoal(full, this.decl(g).name);
      this.assign(g, mkApps(this.goalTerm(ng), args));
      return ng;
    });
    let cur = this.introOne(ng, t.var, t.span).goal;
    if (t.name) cur = this.introOne(cur, t.name, t.span).goal;
    this.replaceMain([cur]);
  }

  location(loc: Location): Location {
    return loc;
  }
}

function inaccessibleName(n: string): string {
  if (n.endsWith('✝')) return n;
  if (n === '_' || n === 'x✝') return 'a✝';
  return `${n}✝`;
}

/** for each field of constructor c: is it explicit? */
function explicitFields(el: Elaborator, c: string): boolean[] {
  const cd = el.env.get(c) as { numParams: number; numFields: number; type: Expr };
  const out: boolean[] = [];
  let t = cd.type;
  let i = 0;
  while (t.k === 'pi') {
    if (i >= cd.numParams) out.push(t.binfo === 'default');
    t = t.body;
    i++;
  }
  return out;
}

/** β-reduce the motive applications that appear in recursor minor premises */
function betaAll(e: Expr): Expr {
  return replaceExpr(e, (x) => (x.k === 'app' && getAppFn(x).k === 'lam' ? betaAll(headBeta(x)) : undefined));
}

function substFVars(e: Expr, m: Map<number, Expr>): Expr {
  if (m.size === 0 || !e.fv) return e;
  return replaceExpr(e, (x) => {
    if (!x.fv) return x;
    if (x.k === 'fvar') return m.get(x.id) ?? x;
    return undefined;
  });
}
