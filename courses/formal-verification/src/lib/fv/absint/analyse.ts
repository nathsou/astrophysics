/**
 * Abstract interpretation of a Vouch function (chapter 26; Cousot and Cousot, 1977). The function's statements
 * are executed on abstract states. Branches are joined; each loop is iterated from its entry state until the
 * state at its head stops growing, with widening after a few iterations so that the iteration always stops, then
 * a step or two of narrowing to win back precision. The result is an abstract state at every program point that
 * contains every concrete state the function can reach there.
 *
 * A second pass, with every loop head fixed at its final state, checks the operations that can fail: assertions,
 * division by zero, array indices, and overflow of machine integers. A check is *proved* when the abstract state
 * rules the failure out, and an *alarm* otherwise. An alarm may be false: the abstraction over-approximates. The
 * triage step (triage.ts) asks symbolic execution for an input that really fails.
 */
import type * as A from '../vouch/syntax/ast';
import type { Span } from '../vouch/syntax/lexer';
import type { Checked, FnInfo } from '../vouch/check/checker';
import type { Ty } from '../vouch/check/types';
import * as I from './interval';
import type { StateDomain, VarDesc } from './domain';

export interface Shown {
  vars: Record<string, string>;
  relations: string[];
}

export interface LoopTrace {
  span: Span;
  line: number;
  /** The state at the loop head after each iteration (the first is the entry state). */
  iterations: { state: Shown; how: 'entry' | 'join' | 'widen' | 'narrow' | 'stable' }[];
  capped: boolean;
}

export type CheckKind = 'assert' | 'division' | 'index' | 'overflow' | 'nat' | 'conversion';

export interface Check {
  kind: CheckKind;
  span: Span;
  line: number;
  status: 'proved' | 'alarm';
  message: string;
}

export interface AnalysisResult {
  domain: string;
  /** The state after each statement (and at each loop head), by statement. */
  points: { span: Span; line: number; state: Shown; loopHead?: boolean }[];
  loops: LoopTrace[];
  checks: Check[];
  /** At the end of the function (joined over every return). */
  exit: Shown;
}

export interface AnalysisOptions {
  /** Widen after this many plain iterations (0 widens at once). */
  widenDelay?: number;
  /** Turn widening off: iterate plain joins until stable, or until the cap. */
  noWidening?: boolean;
  /** Narrowing steps after the fixpoint. */
  narrowing?: number;
  /** Iteration cap per loop (without widening, an infinite ascending chain stops here, unsoundly). */
  maxIterations?: number;
}

function boundsOf(ty: Ty | undefined): I.IntervalV | undefined {
  if (!ty) return undefined;
  switch (ty.k) {
    case 'int':
      return I.TOP;
    case 'nat':
      return { lo: 0n, hi: null };
    case 'bool':
      return { lo: 0n, hi: 1n };
    case 'range':
      return { lo: ty.lo, hi: ty.hi - 1n };
    case 'mach': {
      const b = BigInt(ty.bits);
      return ty.signed ? { lo: -(1n << (b - 1n)), hi: (1n << (b - 1n)) - 1n } : { lo: 0n, hi: (1n << b) - 1n };
    }
  }
  return undefined;
}

const syn = <T extends A.Expr>(e: T): T => e;

export class Analyzer<S> {
  private vars: VarDesc[] = [];
  private bounds = new Map<string, I.IntervalV>();
  private fix = new Map<A.Stmt, S>();
  private phase: 'fix' | 'check' = 'fix';
  private points = new Map<A.Stmt, { state: S; shown: Shown; loopHead?: boolean }>();
  private loops = new Map<A.Stmt, LoopTrace>();
  private checks = new Map<string, Check>();
  private breaks: S[][] = [];
  private returns: S[] = [];
  private lineStarts: number[] = [0];
  /** Variables in scope so far (parameters, then locals as their declarations are passed), for display. */
  private declared = new Set<string>();
  readonly opts: Required<AnalysisOptions>;

  constructor(
    private checked: Checked,
    private info: FnInfo,
    readonly D: StateDomain<S>,
    source: string,
    opts: AnalysisOptions = {},
  ) {
    for (let i = 0; i < source.length; i++) if (source[i] === '\n') this.lineStarts.push(i + 1);
    this.opts = { widenDelay: opts.widenDelay ?? 2, noWidening: opts.noWidening ?? false, narrowing: opts.narrowing ?? 1, maxIterations: opts.maxIterations ?? 60 };
    const add = (name: string, ty: Ty | undefined) => {
      const b = boundsOf(ty);
      if (b && !this.bounds.has(name)) {
        this.bounds.set(name, b);
        this.vars.push({ name, bounds: b });
      }
      if (ty?.k === 'seq' && !this.bounds.has(`|${name}|`)) {
        this.bounds.set(`|${name}|`, { lo: 0n, hi: null });
        this.vars.push({ name: `|${name}|`, bounds: { lo: 0n, hi: null } });
      }
    };
    for (const p of info.params) add(p.name, p.ty);
    for (const l of info.locals) add(l.name, l.ty);
    for (const p of info.params) this.declared.add(p.name).add(`|${p.name}|`);
  }

  private shown(s: S): Shown {
    const sh = this.D.show(s);
    const keep = (name: string) => this.declared.has(name);
    return { vars: Object.fromEntries(Object.entries(sh.vars).filter(([k]) => keep(k))), relations: sh.relations.filter((r) => [...r.matchAll(/\|?[A-Za-z_]\w*\|?/g)].every((m) => keep(m[0]) || !this.bounds.has(m[0]))) };
  }

  lineOf(off: number): number {
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  run(): AnalysisResult {
    let s0 = this.D.top(this.vars);
    for (const r of this.info.decl.spec.requires) s0 = this.D.assume(s0, r.value, true);
    const body = this.info.decl.body as A.Block;
    this.phase = 'fix';
    this.returns = [];
    this.exec(body.stmts, s0);
    this.phase = 'check';
    this.points.clear();
    this.declared = new Set([...this.info.params.flatMap((p) => [p.name, `|${p.name}|`])]);
    this.returns = [];
    const end = this.exec(body.stmts, s0);
    const exit = [...this.returns, end].reduce((a, b) => this.D.join(a, b), this.D.bottom());
    return {
      domain: this.D.name,
      points: [...this.points].map(([st, p]) => ({ span: st.span, line: this.lineOf(st.span.start), state: p.shown, loopHead: p.loopHead })).sort((a, b) => a.span.start - b.span.start),
      loops: [...this.loops.values()],
      checks: [...this.checks.values()].sort((a, b) => a.span.start - b.span.start),
      exit: this.shown(exit),
    };
  }

  private record(st: A.Stmt, s: S, loopHead = false) {
    if (this.phase !== 'check') return;
    const prev = this.points.get(st);
    const state = prev ? this.D.join(prev.state, s) : s;
    this.points.set(st, { state, shown: this.shown(state), loopHead });
  }

  private check(kind: CheckKind, span: Span, ok: boolean, okMsg: string, alarmMsg: string) {
    if (this.phase !== 'check') return;
    const k = `${kind}:${span.start}:${span.end}`;
    const prev = this.checks.get(k);
    if (prev?.status === 'alarm') return;
    this.checks.set(k, { kind, span, line: this.lineOf(span.start), status: ok ? 'proved' : 'alarm', message: ok ? okMsg : alarmMsg });
  }

  private proves(s: S, cond: A.Expr): boolean {
    return this.D.isBottom(this.D.assume(s, cond, false));
  }

  /** Check every operation inside an expression that can fail. */
  private checkExpr(e: A.Expr | undefined, s: S): void {
    if (!e || this.D.isBottom(s) || this.phase !== 'check') return;
    const ty = this.checked.types.get(e) as Ty | undefined;
    switch (e.k) {
      case 'binary': {
        this.checkExpr(e.left, s);
        this.checkExpr(e.right, s);
        if (e.op === '/' || e.op === '%') {
          const d = this.D.range(s, e.right);
          this.check('division', e.span, !I.contains(d, 0n), 'The divisor is never 0.', `The divisor may be 0: it lies in ${I.show(d)}.`);
        }
        if (['+', '-', '*', '/'].includes(e.op) && ty?.k === 'mach') {
          const r = this.D.range(s, e);
          const b = boundsOf(ty)!;
          this.check('overflow', e.span, I.leq(r, b), `No overflow: the result lies in ${I.show(r)}.`, `May overflow ${ty.signed ? 'i' : 'u'}${ty.bits}: the result lies in ${I.show(r)}, beyond ${I.show(b)}.`);
        }
        return;
      }
      case 'cast': {
        this.checkExpr(e.arg, s);
        const to = ty && boundsOf(ty);
        if (to && ty?.k === 'mach') {
          const r = this.D.range(s, e.arg);
          this.check('conversion', e.span, I.leq(r, to), `The value always fits in ${ty.signed ? 'i' : 'u'}${ty.bits}: ${I.show(r)}.`, `The value may not fit in ${ty.signed ? 'i' : 'u'}${ty.bits}: it lies in ${I.show(r)}, beyond ${I.show(to)}.`);
        }
        return;
      }
      case 'index': {
        this.checkExpr(e.target, s);
        e.indices.forEach((i) => this.checkExpr(i, s));
        const idx = e.indices[0];
        if (idx && e.target.k === 'var' && this.bounds.has(`|${e.target.name}|`)) {
          const len = syn<A.Expr>({ k: 'call', callee: 'len', calleeSpan: e.span, args: [e.target], inout: [false], span: e.span });
          const lower = this.proves(s, { k: 'binary', op: '>=', left: idx, right: { k: 'int', value: 0n, span: e.span }, span: e.span });
          const upper = this.proves(s, { k: 'binary', op: '<', left: idx, right: len, span: e.span });
          const r = this.D.range(s, idx);
          this.check('index', e.span, lower && upper, 'The index is always within the array.', `The index may be out of bounds: it lies in ${I.show(r)}${!upper ? `, and it is not shown to be below len(${e.target.name})` : ''}.`);
        }
        return;
      }
      default:
        for (const v of Object.values(e)) {
          if (v && typeof v === 'object' && 'k' in v && 'span' in v) this.checkExpr(v as A.Expr, s);
          else if (Array.isArray(v)) for (const x of v) if (x && typeof x === 'object' && 'k' in x && 'span' in x) this.checkExpr(x as A.Expr, s);
        }
    }
  }

  /** x := e, with the checks of e and of the assignment (overflow of a machine integer, a negative nat). */
  private assignVar(s: S, x: string, e: A.Expr, span: Span): S {
    this.checkExpr(e, s);
    const b = this.bounds.get(x);
    if (!b) return s;
    const ty = this.info.locals.concat(this.info.params).find((v) => v.name === x)?.ty;
    // Machine arithmetic is checked where it happens (checkExpr); the assignment adds nothing then.
    const checkedOp = e.k === 'binary' && ['+', '-', '*', '/'].includes(e.op) && (this.checked.types.get(e) as Ty | undefined)?.k === 'mach';
    if (ty && (ty.k === 'mach' || ty.k === 'nat' || ty.k === 'range') && !checkedOp) {
      const r = this.D.range(s, e);
      this.check(ty.k === 'nat' ? 'nat' : 'overflow', span, I.leq(r, b), `The value always fits: ${I.show(r)}.`, ty.k === 'nat' ? `May be negative: the value lies in ${I.show(r)}.` : `May not fit in ${x}'s type: the value lies in ${I.show(r)}, beyond ${I.show(b)}.`);
    }
    return this.D.assign(s, x, e, b);
  }

  exec(stmts: A.Stmt[], s: S): S {
    for (const st of stmts) {
      if (st.k === 'let') this.declared.add(st.name).add(`|${st.name}|`);
      if (st.k === 'for') this.declared.add(st.v);
      // A return is shown with the state in which it returns.
      if (st.k === 'return') this.record(st, s);
      s = this.stmt(st, s);
      if (st.k !== 'while' && st.k !== 'for' && st.k !== 'loop' && st.k !== 'return') this.record(st, s);
    }
    return s;
  }

  private stmt(st: A.Stmt, s: S): S {
    if (this.D.isBottom(s)) return s;
    switch (st.k) {
      case 'let':
        if (st.init) return this.assignVar(s, st.name, st.init, st.span);
        return this.bounds.has(st.name) ? this.D.havoc(s, st.name, this.bounds.get(st.name)!) : s;
      case 'assign': {
        const t = st.target;
        const value: A.Expr = st.op === '=' ? st.value : { k: 'binary', op: st.op[0] as A.BinOp, left: t, right: st.value, span: st.span };
        if (t.k === 'var') return this.assignVar(s, t.name, value, st.span);
        // Writing an array element, a field: check the index; integer state is unchanged.
        this.checkExpr(t, s);
        this.checkExpr(st.value, s);
        return s;
      }
      case 'multi': {
        // Simultaneous assignment: through temporaries when a target is read by another value.
        const names = st.targets.map((t) => (t.k === 'var' ? t.name : undefined));
        st.values.forEach((v) => this.checkExpr(v, s));
        const temps = st.values.map((v, i) => {
          const tmp = `$${i}`;
          if (!this.bounds.has(tmp)) this.bounds.set(tmp, I.TOP);
          s = this.D.assign(s, tmp, v, I.TOP);
          return { tmp, target: names[i] };
        });
        for (const t of temps) if (t.target && this.bounds.has(t.target)) s = this.assignVar(s, t.target, { k: 'var', name: t.tmp, span: st.span }, st.span);
        for (const t of temps) s = this.D.havoc(s, t.tmp, I.TOP);
        return s;
      }
      case 'if': {
        this.checkExpr(st.cond, s);
        const t = this.exec(st.then.stmts, this.D.assume(s, st.cond, true));
        const fs = this.D.assume(s, st.cond, false);
        const f = !st.else ? fs : 'stmts' in st.else ? this.exec((st.else as A.Block).stmts, fs) : this.exec([st.else as A.Stmt], fs);
        return this.D.join(t, f);
      }
      case 'while':
        return this.loop(st, st.cond, st.body.stmts, s);
      case 'loop':
        return this.loop(st, { k: 'bool', value: true, span: st.span }, st.body.stmts, s);
      case 'for': {
        // for i in lo..hi { body }  is  i = lo; while i < hi { body; i = i + 1 }
        const i: A.Expr = { k: 'var', name: st.v, span: st.vSpan };
        s = this.assignVar(s, st.v, st.lo, st.span);
        const cond: A.Expr = { k: 'binary', op: st.inclusive ? '<=' : '<', left: i, right: st.hi, span: st.span };
        const incr: A.Stmt = { k: 'assign', target: i, op: '=', value: { k: 'binary', op: '+', left: i, right: { k: 'int', value: 1n, span: st.span }, span: st.span }, span: st.span };
        return this.loop(st, cond, [...st.body.stmts, incr], s);
      }
      case 'assert':
        this.checkExpr(st.cond, s);
        this.check('assert', st.span, this.proves(s, st.cond), 'The assertion always holds here.', 'The assertion may fail: the abstract state does not rule out a state where it is false.');
        return this.D.assume(s, st.cond, true);
      case 'assume':
        return this.D.assume(s, st.cond, true);
      case 'return':
        this.checkExpr(st.value, s);
        this.returns.push(s);
        return this.D.bottom();
      case 'break':
        this.breaks.at(-1)?.push(s);
        return this.D.bottom();
      case 'expr':
        this.checkExpr(st.expr, s);
        return s;
      case 'block':
        return this.exec(st.body.stmts, s);
      case 'label':
        return this.stmt(st.stmt, s);
      case 'skip':
        return s;
    }
    // Anything else: forget what we knew about every variable it might change.
    return this.D.top(this.vars);
  }

  private loop(st: A.Stmt, cond: A.Expr, body: A.Stmt[], entry: S): S {
    let X: S;
    if (this.phase === 'check' && this.fix.has(st)) {
      X = this.fix.get(st)!;
    } else {
      const trace: LoopTrace = { span: st.span, line: this.lineOf(st.span.start), iterations: [{ state: this.shown(entry), how: 'entry' }], capped: false };
      X = entry;
      let k = 0;
      for (;;) {
        k++;
        this.breaks.push([]);
        const after = this.exec(body, this.D.assume(X, cond, true));
        this.breaks.pop();
        const next = this.D.join(entry, after);
        if (this.D.leq(next, X)) {
          trace.iterations.push({ state: this.shown(X), how: 'stable' });
          break;
        }
        const widen = !this.opts.noWidening && k > this.opts.widenDelay;
        X = widen ? this.D.widen(X, next) : this.D.join(X, next);
        trace.iterations.push({ state: this.shown(X), how: widen ? 'widen' : 'join' });
        if (k >= this.opts.maxIterations) {
          trace.capped = true;
          break;
        }
      }
      for (let n = 0; n < this.opts.narrowing && !trace.capped; n++) {
        this.breaks.push([]);
        const after = this.exec(body, this.D.assume(X, cond, true));
        this.breaks.pop();
        const Y = this.D.narrow(X, this.D.join(entry, after));
        if (this.D.leq(X, Y)) break;
        X = Y;
        trace.iterations.push({ state: this.shown(X), how: 'narrow' });
      }
      this.fix.set(st, X);
      this.loops.set(st, trace);
    }
    this.record(st, X, true);
    this.checkExpr(cond, X);
    this.breaks.push([]);
    this.exec(body, this.D.assume(X, cond, true));
    const broke = this.breaks.pop()!;
    return broke.reduce((a, b) => this.D.join(a, b), this.D.assume(X, cond, false));
  }
}

export function analyse<S>(checked: Checked, info: FnInfo, D: StateDomain<S>, source: string, opts: AnalysisOptions = {}): AnalysisResult {
  return new Analyzer(checked, info, D, source, opts).run();
}
