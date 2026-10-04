/**
 * Weakest preconditions (chapter 17; Dijkstra 1975), computed backwards over a small subset of Vouch: integer and
 * Boolean variables, assignments, `if`, `assert`, `assume`, `return`, and `while` with invariants. This is the
 * textbook calculus, kept separate from the course's real verification-condition generator (vc/gen.ts, which works
 * forwards), so that each step can be shown.
 *
 *   wp(x = e, Q)            = Q[x := e]
 *   wp(S1; S2, Q)           = wp(S1, wp(S2, Q))
 *   wp(if c {A} else {B}, Q) = (c ⟹ wp(A, Q)) ∧ (¬c ⟹ wp(B, Q))
 *   wp(assert c, Q)         = c ∧ Q
 *   wp(assume c, Q)         = c ⟹ Q
 *   wp(return e, _)         = Post[result := e]
 *   wp(while c inv I {B}, Q) = I, plus two side conditions, for all values of the variables B modifies:
 *                              I ∧ c ⟹ wp(B, I)   and   I ∧ ¬c ⟹ Q
 */
import type * as A from '../vouch/syntax/ast';
import type { Span } from '../vouch/syntax/lexer';
import { parse } from '../vouch/syntax/parser';
import {
  add, and, BOOL, bool, div, eq, forall, ge, gt, iff, imp, INT, ite, le, lt, mod, mul, neg, not, num, or, pretty, smtlibScript, sub, subst, subterms, v,
  type Term,
} from '../logic/term';
import { checkSat } from '../smt/solver';
import { evaluate, type MValue } from '../logic/term';

export class WpError extends Error {}

export type WStmt =
  | { k: 'assign'; xs: string[]; es: Term[]; span: Span; text: string }
  | { k: 'if'; c: Term; then: WStmt[]; else: WStmt[]; span: Span; text: string }
  | { k: 'assert'; c: Term; span: Span; text: string }
  | { k: 'assume'; c: Term; span: Span; text: string }
  | { k: 'return'; e?: Term; span: Span; text: string }
  | { k: 'while'; c: Term; inv: Term[]; dec?: Term; body: WStmt[]; span: Span; text: string };

export interface WpProgram {
  name: string;
  params: string[];
  pre: Term;
  post: Term;
  body: WStmt[];
  source: string;
  /** Sorts of the variables (Boolean or integer). */
  sorts: Map<string, 'int' | 'bool'>;
}

// ── From Vouch ──

export function fromVouch(source: string, fnName?: string): WpProgram {
  const p = parse(source);
  const errs = p.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new WpError(errs.map((e) => e.message).join(' '));
  const fns = p.program.decls.filter((d): d is A.FnDecl => d.k === 'fn' && !!d.body && 'stmts' in (d.body as object));
  const d = fnName ? fns.find((f) => f.name === fnName) : fns[fns.length - 1];
  if (!d) throw new WpError('There is no function with a body.');
  const sorts = new Map<string, 'int' | 'bool'>();
  for (const prm of d.params) sorts.set(prm.name, typeName(prm.type) === 'bool' ? 'bool' : 'int');
  if (d.result) sorts.set('result', typeName(d.result.type) === 'bool' ? 'bool' : 'int');
  const tr = new Translator(sorts, source);
  const pre = and(...d.spec.requires.map((r) => tr.expr(r.value)));
  const post = and(...d.spec.ensures.map((r) => tr.expr(r.value)));
  const body = tr.block((d.body as A.Block).stmts);
  return { name: d.name, params: d.params.map((x) => x.name), pre, post, body, source, sorts };
}

function typeName(t: A.TypeExpr | undefined): string {
  return t && 'name' in t ? String((t as { name: string }).name) : '';
}

class Translator {
  constructor(
    private sorts: Map<string, 'int' | 'bool'>,
    private source: string,
  ) {}

  private text(span: Span): string {
    return this.source.slice(span.start, span.end).split('\n')[0]!.trim();
  }

  block(stmts: A.Stmt[]): WStmt[] {
    const out: WStmt[] = [];
    for (const s of stmts) {
      const t = this.text(s.span);
      switch (s.k) {
        case 'let':
          if (!s.init) throw new WpError(`\`${s.name}\` needs an initial value.`);
          this.sorts.set(s.name, this.isBool(s.init) ? 'bool' : 'int');
          out.push({ k: 'assign', xs: [s.name], es: [this.expr(s.init)], span: s.span, text: t });
          break;
        case 'assign': {
          if (s.target.k !== 'var') throw new WpError('Only assignments to variables are supported here.');
          const x = s.target.name;
          const r = this.expr(s.value);
          const cur = this.v(x);
          const e = s.op === '=' ? r : s.op === '+=' ? add(cur, r) : s.op === '-=' ? sub(cur, r) : mul(cur, r);
          out.push({ k: 'assign', xs: [x], es: [e], span: s.span, text: t });
          break;
        }
        case 'multi':
          if (s.targets.some((x) => x.k !== 'var') || s.targets.length !== s.values.length) throw new WpError('Only parallel assignments to variables are supported here.');
          if (s.declare) s.targets.forEach((x, i) => this.sorts.set((x as { name: string }).name, this.isBool(s.values[i]!) ? 'bool' : 'int'));
          out.push({ k: 'assign', xs: s.targets.map((x) => (x as { name: string }).name), es: s.values.map((e) => this.expr(e)), span: s.span, text: t });
          break;
        case 'if': {
          const els = s.else ? ('stmts' in s.else ? this.block((s.else as A.Block).stmts) : this.block([s.else as A.Stmt])) : [];
          out.push({ k: 'if', c: this.expr(s.cond), then: this.block(s.then.stmts), else: els, span: s.span, text: t });
          break;
        }
        case 'assert':
          out.push({ k: 'assert', c: this.expr(s.cond), span: s.span, text: t });
          break;
        case 'assume':
          out.push({ k: 'assume', c: this.expr(s.cond), span: s.span, text: t });
          break;
        case 'return':
          out.push({ k: 'return', e: s.value ? this.expr(s.value) : undefined, span: s.span, text: t });
          break;
        case 'while':
          out.push({ k: 'while', c: this.expr(s.cond), inv: s.spec.invariants.map((i) => this.expr(i.value)), dec: s.spec.decreases?.[0] ? this.expr(s.spec.decreases[0]) : undefined, body: this.block(s.body.stmts), span: s.span, text: t });
          break;
        case 'skip':
          break;
        default:
          throw new WpError(`\`${s.k}\` statements are not supported by the wp calculator (it handles assignments, if, while, assert, assume and return).`);
      }
    }
    return out;
  }

  private v(x: string): Term {
    return v(x, this.sorts.get(x) === 'bool' ? BOOL : INT);
  }

  private isBool(e: A.Expr): boolean {
    if (e.k === 'bool' || e.k === 'chain' || e.k === 'quant') return true;
    if (e.k === 'unary') return e.op === '!';
    if (e.k === 'binary') return ['==', '!=', '<', '<=', '>', '>=', '&&', '||', '==>', '<==>'].includes(e.op);
    if (e.k === 'var') return this.sorts.get(e.name) === 'bool';
    if (e.k === 'if') return this.isBool(e.then);
    return false;
  }

  expr(e: A.Expr): Term {
    switch (e.k) {
      case 'int':
        return num(e.value);
      case 'bool':
        return bool(e.value);
      case 'var':
        return this.v(e.name);
      case 'unary':
        if (e.op === '-') return neg(this.expr(e.arg));
        if (e.op === '!') return not(this.expr(e.arg));
        break;
      case 'chain': {
        const parts: Term[] = [];
        for (let i = 0; i < e.ops.length; i++) parts.push(this.cmp(e.ops[i]!, this.expr(e.args[i]!), this.expr(e.args[i + 1]!)));
        return and(...parts);
      }
      case 'if':
        return ite(this.expr(e.cond), this.expr(e.then), this.expr(e.else));
      case 'old':
        return this.expr(e.arg);
      case 'binary': {
        const a = this.expr(e.left);
        const b = this.expr(e.right);
        switch (e.op) {
          case '+': return add(a, b);
          case '-': return sub(a, b);
          case '*': return mul(a, b);
          case '/': return div(a, b);
          case '%': return mod(a, b);
          case '==': return a.sort.k === 'bool' ? iff(a, b) : eq(a, b);
          case '!=': return not(a.sort.k === 'bool' ? iff(a, b) : eq(a, b));
          case '<': case '<=': case '>': case '>=': return this.cmp(e.op, a, b);
          case '&&': return and(a, b);
          case '||': return or(a, b);
          case '==>': return imp(a, b);
          case '<==>': return iff(a, b);
        }
        break;
      }
    }
    throw new WpError(`This expression is not supported by the wp calculator: ${this.text(e.span)}`);
  }

  private cmp(op: string, a: Term, b: Term): Term {
    return op === '<' ? lt(a, b) : op === '<=' ? le(a, b) : op === '>' ? gt(a, b) : ge(a, b);
  }
}

// ── The calculus ──

export interface Annotation {
  stmt: WStmt;
  /** wp of the statement: what must hold just before it. */
  pre: Term;
  /** What must hold just after it. */
  post: Term;
}

export interface SideCondition {
  label: string;
  formula: Term;
  span: Span;
}

export interface WpResult {
  wp: Term;
  annotations: Annotation[];
  side: SideCondition[];
}

/** Variables assigned anywhere in the statements. */
export function modified(ss: WStmt[], out = new Set<string>()): Set<string> {
  for (const s of ss) {
    if (s.k === 'assign') s.xs.forEach((x) => out.add(x));
    if (s.k === 'if') {
      modified(s.then, out);
      modified(s.else, out);
    }
    if (s.k === 'while') modified(s.body, out);
  }
  return out;
}

export function computeWp(prog: WpProgram): WpResult {
  const annotations: Annotation[] = [];
  const side: SideCondition[] = [];
  const sortOf = (x: string) => (prog.sorts.get(x) === 'bool' ? BOOL : INT);
  const go = (ss: WStmt[], q: Term): Term => {
    let cur = q;
    for (let i = ss.length - 1; i >= 0; i--) {
      const s = ss[i]!;
      const post = cur;
      let pre: Term;
      switch (s.k) {
        case 'assign':
          pre = subst(post, new Map(s.xs.map((x, k) => [v(x, sortOf(x)), s.es[k]!])));
          break;
        case 'if':
          pre = and(imp(s.c, go(s.then, post)), imp(not(s.c), go(s.else, post)));
          break;
        case 'assert':
          pre = and(s.c, post);
          break;
        case 'assume':
          pre = imp(s.c, post);
          break;
        case 'return':
          pre = s.e ? subst(prog.post, new Map([[v('result', sortOf('result')), s.e]])) : prog.post;
          break;
        case 'while': {
          const inv = and(...s.inv);
          const bodyWp = go(s.body, inv);
          const vars = [...modified(s.body)].map((x) => v(x, sortOf(x)));
          side.push({ label: 'the invariant is preserved by an iteration', formula: forall(vars, imp(and(inv, s.c), bodyWp)), span: s.span });
          side.push({ label: 'the invariant and the exit condition give what follows the loop', formula: forall(vars, imp(and(inv, not(s.c)), post)), span: s.span });
          pre = inv;
          break;
        }
      }
      annotations.push({ stmt: s, pre, post });
      cur = pre;
    }
    return cur;
  };
  // Falling off the end of a function without a result means the postcondition must hold there.
  const wp = go(prog.body, prog.post);
  return { wp, annotations, side };
}

export interface Validity {
  valid: boolean;
  status: 'valid' | 'invalid' | 'unknown';
  counterexample?: [string, string][];
  reason?: string;
}

/** Is the formula valid (true for every value of its free variables)? A leading ∀ is dropped: same question. */
export function valid(f: Term, names: string[] = []): Validity {
  while (f.op === 'forall') f = f.args[0]!;
  const r = checkSat([not(f)], { timeout: 4000 });
  if (r.status === 'unsat') return { valid: true, status: 'valid' };
  if (r.status === 'sat' && r.model) {
    const cex: [string, string][] = [];
    for (const [k, val] of r.model.vars) if (!k.includes('!') && (!names.length || names.includes(k))) cex.push([k, String(val)]);
    return { valid: false, status: 'invalid', counterexample: cex.sort() };
  }
  return { valid: false, status: 'unknown', reason: r.reason };
}

/** The verification condition: requires ⟹ wp(body, ensures), together with the loops' side conditions. */
export function verificationCondition(prog: WpProgram, r = computeWp(prog)): Term {
  return and(imp(prog.pre, r.wp), ...r.side.map((s) => s.formula));
}

/** Check the verification condition part by part: the main implication, then each side condition. */
export function checkVc(prog: WpProgram, r = computeWp(prog)): { label: string; formula: Term; result: Validity }[] {
  const parts = [{ label: 'the precondition implies the weakest precondition of the body', formula: imp(prog.pre, r.wp) }, ...r.side.map((s) => ({ label: s.label, formula: s.formula }))];
  return parts.map((p) => ({ ...p, result: valid(p.formula, prog.params) }));
}

export const showFormula = (t: Term) => pretty(t).replace(/!\d+/g, '');
export const smtlibOf = (prog: WpProgram, r = computeWp(prog)) => smtlibScript([not(verificationCondition(prog, r))]) + '(check-sat)\n';

/** Size of a formula: as a tree (every occurrence counted) and as a DAG (distinct subterms). */
export function formulaSize(t: Term): { tree: number; dag: number } {
  const memo = new Map<Term, number>();
  const tree = (x: Term): number => {
    const m = memo.get(x);
    if (m !== undefined) return m;
    const n = 1 + x.args.reduce((s, a) => s + tree(a), 0);
    memo.set(x, n);
    return n;
  };
  return { tree: tree(t), dag: subterms(t).size };
}

// ── Hoare-logic proof goals (the rule builder) ──

export interface Goal {
  id: number;
  pre: Term;
  stmts: WStmt[];
  post: Term;
  /** How the goal was closed or split. */
  rule?: string;
  children: number[];
  /** Side conditions sent to the solver when the rule was applied. */
  side: { text: string; formula: Term; result: Validity }[];
  closed: boolean;
}

export type RuleName = 'sequence' | 'assignment' | 'if' | 'assert' | 'assume' | 'return' | 'while' | 'empty';

/** Rules that apply to a goal: its first statement decides, or the sequence rule splits it. */
export function applicableRules(g: Goal): RuleName[] {
  if (!g.stmts.length) return ['empty'];
  if (g.stmts.length > 1) return ['sequence'];
  const s = g.stmts[0]!;
  return [s.k === 'assign' ? 'assignment' : s.k];
}

export class HoareProof {
  goals: Goal[] = [];
  readonly prog: WpProgram;
  constructor(prog: WpProgram) {
    this.prog = prog;
    this.goals.push({ id: 0, pre: prog.pre, stmts: prog.body, post: prog.post, children: [], side: [], closed: false });
  }

  private add(pre: Term, stmts: WStmt[], post: Term): number {
    const g: Goal = { id: this.goals.length, pre, stmts, post, children: [], side: [], closed: false };
    this.goals.push(g);
    return g.id;
  }

  private sideCondition(g: Goal, text: string, f: Term): void {
    g.side.push({ text, formula: f, result: valid(f) });
  }

  /**
   * Apply a rule to an open goal. The sequence rule splits off the first statement; its midpoint is `mid` or, if
   * not given, the weakest precondition of the rest (the usual choice, and always good enough).
   */
  apply(id: number, rule: RuleName, mid?: Term): void {
    const g = this.goals[id]!;
    if (g.rule) throw new WpError('This goal has already been handled.');
    const sortOf = (x: string) => (this.prog.sorts.get(x) === 'bool' ? BOOL : INT);
    g.rule = rule;
    switch (rule) {
      case 'empty':
        this.sideCondition(g, 'the precondition implies the postcondition', imp(g.pre, g.post));
        break;
      case 'sequence': {
        const [first, ...rest] = g.stmts;
        const r = mid ?? computeWp({ ...this.prog, body: rest, post: g.post }).wp;
        g.children = [this.add(g.pre, [first!], r), this.add(r, rest, g.post)];
        break;
      }
      case 'assignment': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'assign' }>;
        // The assignment axiom {Q[x := e]} x = e {Q}, with the consequence rule for the precondition.
        this.sideCondition(g, 'the precondition implies the postcondition with the assignment substituted', imp(g.pre, subst(g.post, new Map(s.xs.map((x, k) => [v(x, sortOf(x)), s.es[k]!])))));
        break;
      }
      case 'assert': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'assert' }>;
        this.sideCondition(g, 'the precondition implies the asserted condition and the postcondition', imp(g.pre, and(s.c, g.post)));
        break;
      }
      case 'assume': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'assume' }>;
        this.sideCondition(g, 'the precondition and the assumed condition imply the postcondition', imp(and(g.pre, s.c), g.post));
        break;
      }
      case 'return': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'return' }>;
        const q = s.e ? subst(this.prog.post, new Map([[v('result', sortOf('result')), s.e]])) : this.prog.post;
        this.sideCondition(g, 'the precondition implies the function’s postcondition for the returned value', imp(g.pre, q));
        break;
      }
      case 'if': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'if' }>;
        g.children = [this.add(and(g.pre, s.c), s.then, g.post), this.add(and(g.pre, not(s.c)), s.else, g.post)];
        break;
      }
      case 'while': {
        const s = g.stmts[0] as Extract<WStmt, { k: 'while' }>;
        const inv = mid ?? and(...s.inv);
        const vars = [...modified(s.body)].map((x) => v(x, sortOf(x)));
        this.sideCondition(g, 'the precondition implies the invariant', imp(g.pre, inv));
        this.sideCondition(g, 'the invariant and the exit condition imply the postcondition', forall(vars, imp(and(inv, not(s.c)), g.post)));
        g.children = [this.add(and(inv, s.c), s.body, inv)];
        break;
      }
    }
    this.refresh();
  }

  /** A goal is closed when its side conditions are valid and all its subgoals are closed. */
  private refresh(): void {
    for (let i = this.goals.length - 1; i >= 0; i--) {
      const g = this.goals[i]!;
      g.closed = !!g.rule && g.side.every((s) => s.result.valid) && g.children.every((c) => this.goals[c]!.closed);
    }
  }

  get done(): boolean {
    return this.goals[0]!.closed;
  }

  /** Apply the obvious rule everywhere (sequence with wp midpoints, the loop's own invariant). */
  auto(): void {
    for (let guard = 0; guard < 500; guard++) {
      const g = this.goals.find((x) => !x.rule);
      if (!g) return;
      this.apply(g.id, applicableRules(g)[0]!);
    }
  }
}


/** A formula typed by the reader, over the program's variables (Vouch expression syntax). */
export function formulaFromText(prog: WpProgram, text: string): Term {
  const src = `fn __formula() {\n  assert ${text}\n}`;
  const p = parse(src);
  const errs = p.diagnostics.filter((d) => d.severity === 'error');
  if (errs.length) throw new WpError(errs.map((e) => e.message).join(' '));
  const d = p.program.decls[0] as A.FnDecl;
  const s = (d.body as A.Block).stmts[0];
  if (!s || s.k !== 'assert') throw new WpError('Write one formula.');
  return new Translator(new Map(prog.sorts), src).expr(s.cond);
}

// ── Loops: the three lights, termination, counterexamples to induction (chapter 18) ──

export type Env = Map<string, bigint | boolean>;

export interface LoopReport {
  entry: Validity;
  preserved: Validity;
  exit: Validity;
  /** With a measure: it is non-negative and decreases on every iteration. */
  bounded?: Validity;
  decreases?: Validity;
  /** For a failed preservation check: a state satisfying the invariant and the condition, and its successor. */
  cti?: { before: Env; after?: Env };
}

/** The first top-level loop of the function and the statements around it. */
export function splitAtLoop(prog: WpProgram): { before: WStmt[]; loop: Extract<WStmt, { k: 'while' }>; after: WStmt[] } {
  const i = prog.body.findIndex((s) => s.k === 'while');
  if (i < 0) throw new WpError('The function has no loop.');
  return { before: prog.body.slice(0, i), loop: prog.body[i] as Extract<WStmt, { k: 'while' }>, after: prog.body.slice(i + 1) };
}

function envOfModel(vars: Map<string, MValue>, names: string[]): Env {
  const out: Env = new Map();
  for (const n of names) {
    const x = vars.get(n);
    if (typeof x === 'bigint' || typeof x === 'boolean') out.set(n, x);
  }
  return out;
}

export function loopVariables(prog: WpProgram): string[] {
  return [...new Set([...prog.params, ...prog.sorts.keys()])].filter((x) => x !== 'result');
}

export function checkLoop(prog: WpProgram, inv: Term, measure?: Term): LoopReport {
  const { before, loop, after } = splitAtLoop(prog);
  const sortOf = (x: string) => (prog.sorts.get(x) === 'bool' ? BOOL : INT);
  const sub = (ss: WStmt[], q: Term) => computeWp({ ...prog, body: ss, post: q }).wp;
  const entry = valid(imp(prog.pre, sub(before, inv)), prog.params);
  // The parameters are never assigned, so the precondition (about them) holds throughout and may be assumed.
  const pf = imp(and(prog.pre, inv, loop.c), sub(loop.body, inv));
  const preserved = valid(pf);
  // After the loop: the rest of the function with its postcondition (a return in the rest uses it too).
  const exit = valid(imp(and(prog.pre, inv, not(loop.c)), computeWp({ ...prog, body: after, post: prog.post }).wp));
  const report: LoopReport = { entry, preserved, exit };
  if (measure) {
    const m0 = v('measure_before', INT);
    report.bounded = valid(imp(and(prog.pre, inv, loop.c), ge(measure, num(0))));
    report.decreases = valid(subst(imp(and(prog.pre, inv, loop.c), sub(loop.body, lt(measure, m0))), new Map([[m0, measure]])));
  }
  if (preserved.status === 'invalid') {
    const r = checkSat([not(pf)], { timeout: 4000 });
    if (r.status === 'sat' && r.model) {
      const names = loopVariables(prog);
      const st = envOfModel(r.model.vars, names);
      for (const n of names) if (!st.has(n)) st.set(n, sortOf(n) === BOOL ? false : 0n);
      const next = runStmts(loop.body, new Map(st), prog);
      report.cti = { before: st, after: next.returned ? undefined : next.env };
    }
  }
  return report;
}

/** Run statements on concrete values (assertions and assumptions are not checked). */
export function runStmts(ss: WStmt[], env: Env, prog: WpProgram, fuel = { n: 10_000 }): { env: Env; returned?: bigint | boolean } {
  const val = (t: Term) => evaluate(t, { vars: new Map(env) as Map<string, MValue>, funs: new Map() }) as bigint | boolean;
  for (const s of ss) {
    if (--fuel.n < 0) throw new WpError('The run took too many steps.');
    switch (s.k) {
      case 'assign': {
        const vals = s.es.map(val);
        s.xs.forEach((x, i) => env.set(x, vals[i]!));
        break;
      }
      case 'if': {
        const r = runStmts(val(s.c) ? s.then : s.else, env, prog, fuel);
        if (r.returned !== undefined) return r;
        break;
      }
      case 'while':
        while (val(s.c)) {
          if (--fuel.n < 0) throw new WpError('The run took too many steps.');
          const r = runStmts(s.body, env, prog, fuel);
          if (r.returned !== undefined) return r;
        }
        break;
      case 'return':
        return { env, returned: s.e ? val(s.e) : true };
      default:
        break;
    }
  }
  return { env };
}

/** The states at the loop head, from a run on the given parameter values (at most `max`). */
export function loopStates(prog: WpProgram, params: Env, max = 80): Env[] {
  const { before, loop } = splitAtLoop(prog);
  const env: Env = new Map(params);
  runStmts(before, env, prog);
  const out: Env[] = [];
  const val = (t: Term) => evaluate(t, { vars: new Map(env) as Map<string, MValue>, funs: new Map() });
  for (let k = 0; k <= max; k++) {
    out.push(new Map(env));
    if (!val(loop.c)) break;
    const r = runStmts(loop.body, env, prog);
    if (r.returned !== undefined) break;
  }
  return out;
}

export function holdsAt(f: Term, env: Env): boolean {
  try {
    return evaluate(f, { vars: new Map(env) as Map<string, MValue>, funs: new Map() }) === true;
  } catch {
    return false;
  }
}

export function valueAt(t: Term, env: Env): bigint | undefined {
  try {
    const x = evaluate(t, { vars: new Map(env) as Map<string, MValue>, funs: new Map() });
    return typeof x === 'bigint' ? x : undefined;
  } catch {
    return undefined;
  }
}
