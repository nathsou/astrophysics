/**
 * Running Vouch programs with every contract checked at run time: preconditions, postconditions, loop
 * invariants (on entry and after every iteration), termination measures, assertions, and every obligation the
 * evaluator checks (overflow, bounds, division, null, narrowing).
 *
 * This is the "tested" rung of the badge ladder, and the oracle for soundness fuzzing: a program the verifier
 * accepts must never fail here.
 */
import type * as A from '../syntax/ast';
import { isBlock } from '../syntax/ast';
import type { Span } from '../syntax/lexer';
import type { Checked, FnInfo } from '../check/checker';
import { assignable, intBounds, type Ty } from '../check/types';
import { Evaluator, Heap, RuntimeFailure, type Env, type EvalOptions } from './eval';
import { equal, show, type StructV, type Value } from './values';
import { spatialHolds } from './spatial';

export interface TraceStep {
  span: Span;
  fn: string;
  /** Values of the variables in scope after the step, rendered. */
  vars: Record<string, string>;
}

export interface RunResult {
  /** Normal completion with every contract satisfied. */
  ok: boolean;
  result?: Value;
  /** Final values of inout parameters. */
  outs: Record<string, Value>;
  failure?: RuntimeFailure;
  /** The run was discarded because an `assume` (or the precondition of the entry function) did not hold. */
  discarded?: boolean;
  /** Contracts that could not be evaluated at run time (unbounded quantifiers). */
  unchecked: Span[];
  trace: TraceStep[];
  steps: number;
}

export interface RunOptions extends EvalOptions {
  /** Record a trace of at most this many steps (0: none). */
  trace: number;
}

class Discard extends Error {}

type Flow = undefined | { k: 'return' } | { k: 'break' };

export class Runner {
  readonly ev: Evaluator;
  unchecked: Span[] = [];
  trace: TraceStep[] = [];
  private traceLimit: number;

  constructor(
    readonly checked: Checked,
    opts: Partial<RunOptions> = {},
  ) {
    this.ev = new Evaluator(checked, opts);
    this.traceLimit = opts.trace ?? 0;
  }

  fn(name: string): FnInfo {
    const f = this.checked.fns.get(name);
    if (!f) throw new Error(`No function ${name}`);
    return f;
  }

  /** Run a top-level function on argument values. */
  run(name: string, args: Value[], heap = new Heap()): RunResult {
    const info = this.fn(name);
    const env: Env = { vals: new Map(), heap };
    let result: Value | undefined;
    const outs: Record<string, Value> = {};
    try {
      info.params.forEach((p, i) => env.vals.set(p.id, args[i]!));
      // An input that violates the entry precondition is not a valid test: discard it.
      for (const r of info.decl.spec.requires) {
        const ok = this.cond(r.value, env, r.span);
        if (ok === false) return { ok: false, discarded: true, outs, unchecked: this.unchecked, trace: this.trace, steps: this.ev.steps };
      }
      result = this.invoke(info, env, info.decl.nameSpan, true);
      info.params.forEach((p) => {
        if (p.inout) outs[p.name] = env.vals.get(p.id)!;
      });
      return { ok: true, result, outs, unchecked: this.unchecked, trace: this.trace, steps: this.ev.steps };
    } catch (e) {
      if (e instanceof Discard) return { ok: false, discarded: true, outs, unchecked: this.unchecked, trace: this.trace, steps: this.ev.steps };
      if (e instanceof RuntimeFailure) return { ok: false, failure: e, outs, unchecked: this.unchecked, trace: this.trace, steps: this.ev.steps };
      throw e;
    }
  }

  /** Evaluate a condition, recording it as unchecked if it cannot be evaluated. Heap assertions use spatial semantics. */
  cond(e: A.Expr, env: Env, span: Span): boolean | undefined {
    try {
      if (this.checked.types.get(e)?.k === 'heapprop') return spatialHolds(this.ev, e, env);
      return !!this.ev.eval(e, env);
    } catch (err) {
      if (err instanceof RuntimeFailure && err.kind === 'unbounded-quantifier') {
        if (!this.unchecked.some((s) => s.start === span.start)) this.unchecked.push(span);
        return undefined;
      }
      throw err;
    }
  }

  require(e: A.Expr, env: Env, span: Span, kind: RuntimeFailure['kind'], what: string): void {
    if (this.cond(e, env, span) === false) throw new RuntimeFailure(kind, span, `${what} does not hold.`, this.snapshot(env));
  }

  snapshot(env: Env): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [id, v] of env.vals) {
      const s = this.checked.symbols[id - 1];
      if (s && (s.kind === 'local' || s.kind === 'param' || s.kind === 'result')) out[s.name] = show(v);
    }
    return out;
  }

  /**
   * Run a function body in `env` (parameters already bound). Checks the postconditions; returns the result.
   * `top` marks the entry function (its preconditions were checked by the caller of run()).
   */
  invoke(info: FnInfo, env: Env, callSpan: Span, top = false): Value | undefined {
    const d = info.decl;
    if (!top) for (const r of d.spec.requires) this.require(r.value, env, callSpan, 'precondition', `The precondition of ${d.name}${r.label ? ` (${r.label})` : ''}`);
    if (!d.body) throw new RuntimeFailure('internal', d.nameSpan, `${d.name} has no body to run.`);
    // old(…) refers to the values at entry, heap included.
    env.old = { vals: new Map(env.vals), heap: env.heap.clone() };
    if (info.result) env.vals.set(info.result.id, defaultFor(info.result.ty));
    if ('stmts' in d.body) {
      const flow = this.block(d.body, env, info);
      void flow;
    } else {
      env.vals.set(info.result!.id, this.ev.eval(d.body, env));
    }
    for (const e of d.spec.ensures) this.require(e.value, env, e.span, 'postcondition', `The postcondition${e.label ? ` ${e.label}` : ''} of ${d.name}`);
    return info.result ? env.vals.get(info.result.id) : undefined;
  }

  record(span: Span, env: Env, info: FnInfo): void {
    if (this.trace.length < this.traceLimit) this.trace.push({ span, fn: info.decl.name, vars: this.snapshot(env) });
  }

  block(b: A.Block, env: Env, info: FnInfo): Flow {
    for (const s of b.stmts) {
      const f = this.stmt(s, env, info);
      if (f) return f;
    }
    return undefined;
  }

  stmt(s: A.Stmt, env: Env, info: FnInfo): Flow {
    this.ev.tick(s.span);
    const flow = this.stmtInner(s, env, info);
    if (s.k !== 'block' && s.k !== 'if' && s.k !== 'while' && s.k !== 'for') this.record(s.span, env, info);
    return flow;
  }

  stmtInner(s: A.Stmt, env: Env, info: FnInfo): Flow {
    switch (s.k) {
      case 'let': {
        const sym = this.checked.refs.get(s)!;
        if (s.init) env.vals.set(sym.id, this.fit(this.rhs(s.init, env, info), sym.ty, s.init.span));
        else env.vals.set(sym.id, defaultFor(sym.ty));
        return;
      }
      case 'assign': {
        let v = this.rhs(s.value, env, info);
        if (s.op !== '=') {
          const cur = this.ev.eval(s.target, env) as bigint;
          const t = this.checked.types.get(s.target);
          v = this.ev.arith(s.op[0]!, cur, v as bigint, t, s.span, () => ({ left: cur.toString(), right: show(v) }));
        }
        this.assignTo(s.target, v, env);
        return;
      }
      case 'multi': {
        const vals = s.values.map((x) => this.rhs(x, env, info));
        s.targets.forEach((t, i) => {
          if (s.declare && t.k === 'var') env.vals.set(this.checked.refs.get(t)!.id, vals[i]!);
          else this.assignTo(t, vals[i]!, env);
        });
        return;
      }
      case 'if':
        if (this.ev.eval(s.cond, env)) return this.block(s.then, env, info);
        if (s.else) return !isBlock(s.else) ? this.stmt(s.else, env, info) : this.block(s.else, env, info);
        return;
      case 'while':
        return this.loop(s, env, info, () => !!this.ev.eval(s.cond, env), () => {}, s.body);
      case 'for': {
        const v = this.checked.refs.get(s)!;
        const lo = this.ev.eval(s.lo, env) as bigint;
        const hi = (this.ev.eval(s.hi, env) as bigint) + (s.inclusive ? 1n : 0n);
        env.vals.set(v.id, lo);
        // As in Dafny: the loop variable runs from lo to hi, and the invariant may mention i == hi at the end.
        if (lo > hi) return;
        return this.loop(s, env, info, () => (env.vals.get(v.id) as bigint) < hi, () => env.vals.set(v.id, (env.vals.get(v.id) as bigint) + 1n), s.body);
      }
      case 'loop': {
        for (;;) {
          const f = this.block(s.body, env, info);
          if (f?.k === 'return') return f;
          if (f?.k === 'break') return;
        }
      }
      case 'match': {
        const v = this.ev.eval(s.scrutinee, env);
        for (const arm of s.arms) {
          const bound = this.ev.matchPattern(arm.pattern, v, env);
          if (bound) {
            for (const [k, x] of bound) env.vals.set(k, x);
            return this.block(arm.body, env, info);
          }
        }
        throw new RuntimeFailure('match', s.span, `No case matches ${show(v)}.`);
      }
      case 'return':
        if (s.value && info.result) env.vals.set(info.result.id, this.fit(this.rhs(s.value, env, info), info.result.ty, s.value.span));
        return { k: 'return' };
      case 'break':
        return { k: 'break' };
      case 'assert':
        this.require(s.cond, env, s.span, 'assert', `The assertion${s.label ? ` ${s.label}` : ''}`);
        return;
      case 'assume':
        if (this.cond(s.cond, env, s.span) === false) throw new Discard();
        return;
      case 'expr':
        this.rhs(s.expr, env, info);
        return;
      case 'block':
        return this.block(s.body, env, info);
      case 'label':
        return this.stmt(s.stmt, env, info);
      case 'skip':
        return;
      case 'free': {
        const r = this.ev.eval(s.target, env);
        const o = this.ev.deref(r, s.target.span, env);
        o.freed = true;
        return;
      }
      case 'atomic':
        return this.block(s.body, env, info);
      case 'await':
      case 'choose':
        throw new RuntimeFailure('internal', s.span, `\`${s.k}\` only runs inside a system.`);
    }
  }

  loop(s: A.Stmt & { k: 'while' | 'for' }, env: Env, info: FnInfo, cond: () => boolean, step: () => void, body: A.Block): Flow {
    const invs = s.spec.invariants;
    for (const inv of invs) this.require(inv.value, env, inv.span, 'invariant-entry', `The loop invariant${inv.label ? ` ${inv.label}` : ''} on entry`);
    let measure = this.measure(s.spec.decreases, env);
    for (;;) {
      if (!cond()) return;
      const f = this.block(body, env, info);
      if (f?.k === 'return') return f;
      if (f?.k === 'break') return;
      step();
      for (const inv of invs) this.require(inv.value, env, inv.span, 'invariant-preserved', `The loop invariant${inv.label ? ` ${inv.label}` : ''} after an iteration`);
      const next = this.measure(s.spec.decreases, env);
      if (measure && next) {
        if (!decreases(next, measure)) throw new RuntimeFailure('decreases', s.spec.decreases![0]!.span, `The termination measure did not decrease: ${measure.map(show).join(', ')} → ${next.map(show).join(', ')}.`, this.snapshot(env));
        if (typeof next[0] === 'bigint' && next[0] < 0n && cond()) throw new RuntimeFailure('decreases', s.spec.decreases![0]!.span, `The termination measure went below zero (${next[0]}) while the loop goes on.`, this.snapshot(env));
      }
      measure = next;
    }
  }

  measure(ds: A.Expr[] | undefined, env: Env): Value[] | undefined {
    return ds?.map((d) => this.ev.eval(d, env));
  }

  /** A right-hand side: an executable call, or an expression. */
  rhs(e: A.Expr, env: Env, info: FnInfo): Value {
    if (e.k === 'call') {
      const s = this.checked.refs.get(e);
      if (s?.kind === 'fn' && s.decl?.k === 'fn' && (s.decl.flavour === 'fn' || s.decl.flavour === 'lemma')) return this.callExec(e, env, info) ?? null;
    }
    return this.ev.eval(e, env);
  }

  callExec(e: A.Expr & { k: 'call' }, env: Env, caller: FnInfo): Value | undefined {
    const callee = this.ev.fnInfo(this.checked.refs.get(e)!);
    // Lemmas are proofs: running them has no effect (their preconditions are still checked).
    const args = e.args.map((a) => this.ev.eval(a, env));
    const frame: Env = { vals: new Map(), heap: env.heap, at: env.at, universe: env.universe };
    callee.params.forEach((p, i) => frame.vals.set(p.id, args[i]!));
    if (callee.decl.flavour === 'lemma') {
      for (const r of callee.decl.spec.requires) this.require(r.value, frame, e.span, 'precondition', `The precondition of lemma ${callee.decl.name}`);
      return undefined;
    }
    const result = this.invoke(callee, frame, e.span);
    callee.params.forEach((p, i) => {
      if (p.inout) this.assignTo(e.args[i]!, frame.vals.get(p.id)!, env);
    });
    void caller;
    return result;
  }

  assignTo(lv: A.Expr, v: Value, env: Env): void {
    switch (lv.k) {
      case 'var': {
        const s = this.checked.refs.get(lv)!;
        env.vals.set(s.id, this.fit(v, s.ty, lv.span));
        return;
      }
      case 'index': {
        const cur = this.ev.eval(lv.target, env);
        const t = this.checked.types.get(lv);
        this.assignTo(lv.target, this.ev.store(cur, lv.indices.map((i) => this.ev.eval(i, env)), this.fit(v, t, lv.span), lv.span), env);
        return;
      }
      case 'field': {
        const tt = this.checked.types.get(lv.target);
        if (tt?.k === 'struct') {
          const cur = this.ev.eval(lv.target, env) as StructV;
          const i = tt.fields.findIndex((f) => f.name === lv.name);
          const fields = [...cur.fields];
          fields[i] = this.fit(v, tt.fields[i]!.ty, lv.span);
          this.assignTo(lv.target, { ...cur, fields }, env);
          return;
        }
        // An object on the heap.
        const r = this.ev.eval(lv.target, env);
        const o = this.ev.deref(r, lv.target.span, env);
        const cls = this.checked.globals.lookup(o.cls)?.ty;
        const i = cls?.k === 'struct' ? cls.fields.findIndex((f) => f.name === lv.name) : -1;
        o.fields[i] = v;
        return;
      }
    }
    throw new RuntimeFailure('internal', lv.span, 'Cannot assign here.');
  }

  /** A value stored into a variable of a range or nat type must fit (machine integers were checked by arithmetic). */
  fit(v: Value, t: Ty | undefined, span: Span): Value {
    if (typeof v !== 'bigint' || !t) return v;
    if (t.k === 'range' || t.k === 'nat') return this.ev.fit(v, t, span, 'range', 'Value out of range');
    if (t.k === 'mach') {
      const [lo, hi] = intBounds(t);
      if ((lo !== undefined && v < lo) || (hi !== undefined && v > hi)) return this.ev.fit(v, t, span, 'overflow', 'Value does not fit');
    }
    return v;
  }
}

function defaultFor(t: Ty): Value {
  switch (t.k) {
    case 'bool':
      return false;
    case 'range':
      return t.lo;
    case 'int':
    case 'nat':
    case 'mach':
    case 'bv':
      return 0n;
    case 'seq':
      return { t: 'seq', items: [] };
    case 'ref':
      return null;
    default:
      return null;
  }
}

/** Lexicographic decrease of termination measures (integers, or collections by size). */
function decreases(next: Value[], prev: Value[]): boolean {
  for (let i = 0; i < Math.min(next.length, prev.length); i++) {
    const a = rank(next[i]!);
    const b = rank(prev[i]!);
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

function rank(v: Value): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'boolean') return v ? 1n : 0n;
  if (v !== null && typeof v === 'object' && (v.t === 'seq' || v.t === 'set')) return BigInt(v.items.length);
  if (v !== null && typeof v === 'object' && v.t === 'mset') return BigInt(v.items.reduce((s, [, n]) => s + n, 0));
  return 0n;
}

export { equal, assignable };
