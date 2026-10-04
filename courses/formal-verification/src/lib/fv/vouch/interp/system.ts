/**
 * The meaning of a `system`: a transition system with initial states and labelled steps (docs/VOUCH.md, "Systems").
 *
 * - State: every state variable, plus, for each running copy of each process, its local variables and its program
 *   counter (the label of the step it will take next).
 * - Steps: an enabled action with parameter values (its guard holds), or one atomic step of one process (from its
 *   current label to the next label it reaches). A step whose `await` is false is not enabled. `choose` makes a
 *   step nondeterministic: it has one successor per value chosen.
 *
 * Processes are compiled to a small instruction list (label, statement, await, branch, jump), so a step runs the
 * instructions from one label to the next. Every engine that checks systems (explorer, BMC, IC3, BDDs) is tested
 * against this definition, and every counterexample trace is replayed through it.
 */
import type * as A from '../syntax/ast';
import { isBlock } from '../syntax/ast';
import type { Span } from '../syntax/lexer';
import type { Checked, ContainerInfo, FnInfo, ProcessInfo } from '../check/checker';
import { conjuncts } from '../check/checker';
import type { Sym } from '../check/symbols';
import type { Ty } from '../check/types';
import { Heap, RuntimeFailure, type Env } from './eval';
import { Runner } from './exec';
import { collItems } from './eval';
import { enumerate, funcConst, key, show, type Value } from './values';

export type Instr =
  | { op: 'label'; name: string; span: Span }
  | { op: 'stmt'; stmt: A.Stmt }
  | { op: 'await'; cond: A.Expr; span: Span }
  | { op: 'jmp'; to: number }
  | { op: 'br'; cond: A.Expr; then: number; else: number }
  | { op: 'halt' };

export interface Instance {
  proc: ProcessInfo;
  args: Value[];
  /** Index of this instance's first slot in the state vector. */
  base: number;
  name: string;
}

export interface StepLabel {
  kind: 'action' | 'process';
  /** Action or process name. */
  name: string;
  args: Value[];
  /** For process steps: the label left and the label reached. */
  from?: string;
  to?: string;
  /** Index of the process instance (for fairness and partial-order reduction). */
  instance?: number;
  text: string;
}

export interface State {
  vals: Value[];
}

export interface Successor {
  label: StepLabel;
  state: State;
}

export interface StepFailure {
  label: StepLabel;
  failure: RuntimeFailure;
  /** The state the failing step started from. */
  from: State;
}

export interface SlotInfo {
  name: string;
  kind: 'state' | 'local' | 'pc';
  ty?: Ty;
  instance?: number;
}

const DONE = -1n;

export class SystemRuntime {
  readonly info: ContainerInfo;
  readonly runner: Runner;
  readonly slots: SlotInfo[] = [];
  readonly instances: Instance[] = [];
  readonly code = new Map<ProcessInfo, Instr[]>();
  readonly actionCode = new Map<A.ActionDecl, Instr[]>();
  /** A placeholder function context for executing statements. */
  private ctxFn: FnInfo;

  constructor(
    readonly checked: Checked,
    name: string,
    opts: { fuel?: number } = {},
  ) {
    const info = checked.containers.get(name);
    if (!info || info.kind !== 'system') throw new Error(`No system called ${name}`);
    this.info = info;
    this.runner = new Runner(checked, { fuel: opts.fuel ?? 100_000_000 });
    this.ctxFn = { decl: { k: 'fn', flavour: 'fn', ghost: false, name, nameSpan: info.decl.nameSpan, params: [], spec: { requires: [], ensures: [] }, span: info.decl.span }, sym: info.sym, params: [], locals: [] };
    for (const v of info.vars) this.slots.push({ name: v.name, kind: 'state', ty: v.ty });
    for (const p of info.processes) {
      this.code.set(p, compileProcess(p.decl.body));
      const domains = p.params.map((s) => {
        const d = enumerate(s.ty);
        if (!d) throw new RuntimeFailure('internal', s.def, `Process parameter ${s.name} must have a finite type.`);
        return d;
      });
      for (const args of cartesian(domains)) {
        const base = this.slots.length;
        const name = `${p.decl.name}${args.length ? `(${args.map(show).join(', ')})` : ''}`;
        for (const l of p.locals) this.slots.push({ name: `${name}.${l.name}`, kind: 'local', ty: l.ty, instance: this.instances.length });
        this.slots.push({ name: `${name}.pc`, kind: 'pc', instance: this.instances.length });
        this.instances.push({ proc: p, args, base, name });
      }
    }
    for (const a of info.actions) this.actionCode.set(a.decl, compileBlock(a.decl.body));
  }

  // ── Environments ──
  /** An environment for evaluating expressions in a state (state variables; `at` for process locations). */
  env(s: State): Env {
    const vals = new Map<number, Value>();
    this.info.vars.forEach((v, i) => vals.set(v.id, s.vals[i]!));
    return { vals, heap: new Heap(), at: (proc, args, label) => this.at(s, proc, args, label) };
  }

  at(s: State, proc: Sym, args: Value[], label: string): boolean {
    const k = args.map(key).join(',');
    for (const inst of this.instances) {
      if (inst.proc.sym !== proc || inst.args.map(key).join(',') !== k) continue;
      const pc = s.vals[inst.base + inst.proc.locals.length] as bigint;
      if (pc === DONE) return false;
      const ins = this.code.get(inst.proc)![Number(pc)];
      return ins?.op === 'label' && ins.name === label;
    }
    return false;
  }

  pcLabel(s: State, i: number): string {
    const inst = this.instances[i]!;
    const pc = s.vals[inst.base + inst.proc.locals.length] as bigint;
    if (pc === DONE) return 'done';
    const ins = this.code.get(inst.proc)![Number(pc)];
    return ins?.op === 'label' ? ins.name : `@${pc}`;
  }

  /** Does a condition hold in a state? */
  holds(e: A.Expr, s: State): boolean {
    return !!this.runner.ev.eval(e, this.env(s));
  }

  key(s: State): string {
    let out = '';
    for (const v of s.vals) out += key(v) + '|';
    return out;
  }

  /** The state as name → value text, for traces. */
  describe(s: State): { name: string; value: string; kind: SlotInfo['kind'] }[] {
    return this.slots.map((slot, i) => ({ name: slot.name, value: slot.kind === 'pc' ? this.pcLabel(s, slot.instance!) : show(s.vals[i]!), kind: slot.kind }));
  }

  // ── Initial states ──
  initial(): { states: State[]; failures: StepFailure[] } {
    this.runner.ev.steps = 0;
    const failures: StepFailure[] = [];
    const ev = this.runner.ev;
    // State variables: their initial value, or every value of the type when there is none.
    let partial: Map<number, Value>[] = [new Map()];
    for (const v of this.info.vars) {
      const decl = v.decl?.k === 'var' ? v.decl : undefined;
      const next: Map<number, Value>[] = [];
      for (const vals of partial) {
        const env: Env = { vals, heap: new Heap() };
        if (decl?.init) {
          let x = ev.eval(decl.init, env);
          if (v.ty.k === 'func' && !(x !== null && typeof x === 'object' && x.t === 'func')) x = funcConst(x);
          const m = new Map(vals);
          m.set(v.id, this.runner.fit(x, v.ty, decl.init.span));
          next.push(m);
        } else {
          const dom = enumerate(v.ty);
          if (!dom) throw new RuntimeFailure('internal', v.def, `State variable ${v.name} has no initial value and its type is not finite.`);
          for (const x of dom) {
            const m = new Map(vals);
            m.set(v.id, x);
            next.push(m);
          }
        }
      }
      partial = next;
    }
    // The init block may choose, assume and assign.
    let envs: Env[] = partial.map((vals) => ({ vals, heap: new Heap() }));
    if (this.info.init) {
      const code = compileBlock(this.info.init.body);
      const out: Env[] = [];
      for (const env of envs) {
        try {
          for (const r of this.run(code, 0, env, undefined)) if (r.pc === DONE || code[Number(r.pc)]?.op === 'halt') out.push(r.env);
        } catch (e) {
          if (!(e instanceof RuntimeFailure)) throw e;
          failures.push({ label: { kind: 'action', name: 'init', args: [], text: 'init' }, failure: e, from: { vals: [] } });
        }
      }
      envs = out;
    }
    // Processes start at their first label (statements before it, such as local declarations, run now).
    const states: State[] = [];
    for (const env of envs) {
      let worlds: { vals: Value[]; env: Env }[] = [{ vals: this.info.vars.map((v) => env.vals.get(v.id)!), env }];
      for (let i = 0; i < this.instances.length; i++) {
        const inst = this.instances[i]!;
        const code = this.code.get(inst.proc)!;
        const next: typeof worlds = [];
        for (const w of worlds) {
          const penv: Env = { ...w.env, vals: new Map(w.env.vals) };
          inst.proc.params.forEach((p, k) => penv.vals.set(p.id, inst.args[k]!));
          for (const r of this.run(code, 0, penv, inst)) {
            const locals = inst.proc.locals.map((l) => r.env.vals.get(l.id) ?? null);
            next.push({ vals: [...w.vals, ...locals, r.pc], env: w.env });
          }
        }
        worlds = next;
      }
      for (const w of worlds) states.push({ vals: w.vals });
    }
    // Facts are assumptions about the initial states (a fixed ring, an order on identifiers): keep the states
    // that satisfy them.
    const facts = (this.info.facts ?? []) as { expr: A.Expr }[];
    if (facts.length) {
      const kept = states.filter((st) => facts.every((f) => this.holds(f.expr, st)));
      states.length = 0;
      states.push(...kept);
    }
    // Deduplicate.
    const seen = new Set<string>();
    return { states: states.filter((s) => (seen.has(this.key(s)) ? false : (seen.add(this.key(s)), true))), failures };
  }

  /**
   * Is this an initial state? Without an init block or processes, checked directly (each variable equals its
   * initial value, or lies in its type when it has none), so that unconstrained wide variables need not be
   * enumerated. Otherwise the initial states are enumerated and compared with `same`.
   */
  initialMatching(vals: Value[], same: (a: State, vals: Value[]) => boolean): State | undefined {
    if (this.info.init || this.instances.length || this.info.facts?.length) return this.initial().states.find((s) => same(s, vals));
    const env: Env = { vals: new Map(), heap: new Heap() };
    const out: Value[] = [];
    for (let i = 0; i < this.info.vars.length; i++) {
      const v = this.info.vars[i]!;
      const decl = v.decl?.k === 'var' ? v.decl : undefined;
      let x: Value;
      if (decl?.init) {
        x = this.runner.ev.eval(decl.init, env);
        if (v.ty.k === 'func' && !(x !== null && typeof x === 'object' && x.t === 'func')) x = funcConst(x);
        x = this.runner.fit(x, v.ty, decl.init.span);
      } else {
        x = vals[i]!;
        try {
          x = this.runner.fit(x, v.ty, v.def);
        } catch {
          return undefined;
        }
      }
      env.vals.set(v.id, x);
      out.push(x);
    }
    const s: State = { vals: out };
    return same(s, vals) ? s : undefined;
  }

  // ── Steps ──
  successors(s: State): { succs: Successor[]; failures: StepFailure[] } {
    this.runner.ev.steps = 0;
    const succs: Successor[] = [];
    const failures: StepFailure[] = [];
    // Actions.
    for (const a of this.info.actions) {
      for (const args of this.actionArgs(a.decl, a.params, s)) {
        const env = this.env(s);
        a.params.forEach((p, i) => env.vals.set(p.id, args[i]!));
        const label: StepLabel = { kind: 'action', name: a.decl.name, args, text: `${a.decl.name}${args.length ? `(${a.params.map((p, i) => `${p.name} = ${show(args[i]!)}`).join(', ')})` : ''}` };
        try {
          if (a.decl.guard && !this.runner.ev.eval(a.decl.guard, env)) continue;
          const code = this.actionCode.get(a.decl)!;
          for (const r of this.run(code, 0, env, undefined)) {
            const vals = [...s.vals];
            this.info.vars.forEach((v, i) => (vals[i] = r.env.vals.get(v.id)!));
            succs.push({ label, state: { vals } });
          }
        } catch (e) {
          if (!(e instanceof RuntimeFailure)) throw e;
          failures.push({ label, failure: e, from: s });
        }
      }
    }
    // Process steps.
    this.instances.forEach((inst, i) => {
      const pcSlot = inst.base + inst.proc.locals.length;
      const pc = s.vals[pcSlot] as bigint;
      if (pc === DONE) return;
      const code = this.code.get(inst.proc)!;
      const env = this.env(s);
      inst.proc.params.forEach((p, k) => env.vals.set(p.id, inst.args[k]!));
      inst.proc.locals.forEach((l, k) => env.vals.set(l.id, s.vals[inst.base + k]!));
      const from = this.pcLabel(s, i);
      try {
        for (const r of this.run(code, Number(pc) + 1, env, inst)) {
          const vals = [...s.vals];
          this.info.vars.forEach((v, k) => (vals[k] = r.env.vals.get(v.id)!));
          inst.proc.locals.forEach((l, k) => (vals[inst.base + k] = r.env.vals.get(l.id) ?? null));
          vals[pcSlot] = r.pc;
          const ns: State = { vals };
          const to = this.pcLabel(ns, i);
          succs.push({ label: { kind: 'process', name: inst.proc.decl.name, args: inst.args, from, to, instance: i, text: `${inst.name}: ${from} → ${to}` }, state: ns });
        }
      } catch (e) {
        if (!(e instanceof RuntimeFailure)) throw e;
        failures.push({ label: { kind: 'process', name: inst.proc.decl.name, args: inst.args, from, instance: i, text: `${inst.name}: ${from}` }, failure: e, from: s });
      }
    });
    return { succs, failures };
  }

  /** The successors of one action with given arguments (used to replay traces whose inputs are too many to enumerate). */
  actionSuccessors(s: State, name: string, args: Value[]): { succs: Successor[]; failures: StepFailure[] } {
    const succs: Successor[] = [];
    const failures: StepFailure[] = [];
    const a = this.info.actions.find((x) => x.decl.name === name);
    if (!a) return { succs, failures };
    const env = this.env(s);
    a.params.forEach((p, i) => env.vals.set(p.id, args[i]!));
    const label: StepLabel = { kind: 'action', name, args, text: `${name}${args.length ? `(${a.params.map((p, i) => `${p.name} = ${show(args[i]!)}`).join(', ')})` : ''}` };
    try {
      if (a.decl.guard && !this.runner.ev.eval(a.decl.guard, env)) return { succs, failures };
      for (const r of this.run(this.actionCode.get(a.decl)!, 0, env, undefined)) {
        const vals = [...s.vals];
        this.info.vars.forEach((v, i) => (vals[i] = r.env.vals.get(v.id)!));
        succs.push({ label, state: { vals } });
      }
    } catch (e) {
      if (!(e instanceof RuntimeFailure)) throw e;
      failures.push({ label, failure: e, from: s });
    }
    return { succs, failures };
  }

  /** Parameter values for an action: each parameter's finite type, or the set its guard draws it from. */
  *actionArgs(d: A.ActionDecl, params: Sym[], s: State): Generator<Value[]> {
    const guardSets = new Map<number, A.Expr>();
    if (d.guard) {
      for (const c of conjuncts(d.guard)) {
        if (c.k === 'binary' && c.op === 'in' && c.left.k === 'var') {
          const sym = this.checked.refs.get(c.left);
          if (sym && params.includes(sym) && !guardSets.has(sym.id)) guardSets.set(sym.id, c.right);
        }
      }
    }
    const go = function* (this: SystemRuntime, k: number, acc: Value[]): Generator<Value[]> {
      if (k === params.length) {
        yield acc;
        return;
      }
      const p = params[k]!;
      let dom: Value[] | undefined;
      const fromSet = guardSets.get(p.id);
      if (fromSet) {
        const env = this.env(s);
        params.slice(0, k).forEach((q, i) => env.vals.set(q.id, acc[i]!));
        try {
          dom = collItems(this.runner.ev.eval(fromSet, env));
        } catch {
          dom = undefined;
        }
      }
      dom ??= enumerate(p.ty);
      if (!dom) throw new RuntimeFailure('internal', p.def, `Cannot enumerate parameter ${p.name}.`);
      for (const v of dom) yield* go.call(this, k + 1, [...acc, v]);
    };
    yield* go.call(this, 0, []);
  }

  /**
   * Run instructions from `pc` until the next label (or the end). Returns every outcome (several when the step
   * chooses), or none when an `await` blocks.
   */
  run(code: Instr[], pc: number, env: Env, inst: Instance | undefined): { env: Env; pc: bigint }[] {
    const out: { env: Env; pc: bigint }[] = [];
    const go = (pc: number, env: Env, fuel: number) => {
      for (;;) {
        if (fuel-- <= 0) throw new RuntimeFailure('fuel', code[pc] && 'stmt' in code[pc]! ? (code[pc] as { stmt: A.Stmt }).stmt.span : this.info.decl.span, 'A single step runs for too long: does a loop inside it lack a label?');
        const ins = code[pc];
        if (!ins || ins.op === 'halt') {
          out.push({ env, pc: DONE });
          return;
        }
        switch (ins.op) {
          case 'label':
            out.push({ env, pc: BigInt(pc) });
            return;
          case 'jmp':
            pc = ins.to;
            continue;
          case 'br':
            pc = this.runner.ev.eval(ins.cond, env) ? ins.then : ins.else;
            continue;
          case 'await':
            if (!this.runner.ev.eval(ins.cond, env)) return; // blocked: this step is not enabled
            pc++;
            continue;
          case 'stmt': {
            const s = ins.stmt;
            if (s.k === 'choose') {
              const sym = this.checked.refs.get(s)!;
              const dom = enumerate(sym.ty) ?? [];
              for (const v of dom) {
                const e2: Env = { ...env, vals: new Map(env.vals) };
                e2.vals.set(sym.id, v);
                if (s.where && !this.runner.ev.eval(s.where, e2)) continue;
                go(pc + 1, e2, fuel);
              }
              return;
            }
            if (s.k === 'assume') {
              if (!this.runner.ev.eval(s.cond, env)) return;
              pc++;
              continue;
            }
            this.runner.stmt(s, env, this.ctxFn);
            pc++;
            continue;
          }
        }
      }
    };
    void inst;
    go(pc, { ...env, vals: new Map(env.vals) }, 100_000);
    return out;
  }
}

function* cartesian(domains: Value[][]): Generator<Value[]> {
  if (!domains.length) {
    yield [];
    return;
  }
  const [first, ...rest] = domains;
  for (const x of first!) for (const tail of cartesian(rest)) yield [x, ...tail];
}

// ── Compilation of process bodies ──

/** Compile a block with no labels (an action body, an init block). */
export function compileBlock(b: A.Block): Instr[] {
  const c = new Compiler();
  c.block(b);
  c.emit({ op: 'halt' });
  return c.code;
}

export function compileProcess(b: A.Block): Instr[] {
  return compileBlock(b);
}

class Compiler {
  code: Instr[] = [];
  private loops: { breaks: number[] }[] = [];

  emit(i: Instr): number {
    this.code.push(i);
    return this.code.length - 1;
  }

  block(b: A.Block): void {
    for (const s of b.stmts) this.stmt(s);
  }

  stmt(s: A.Stmt, head?: number): void {
    switch (s.k) {
      case 'label': {
        const at = this.emit({ op: 'label', name: s.label, span: s.labelSpan });
        this.stmt(s.stmt, at);
        return;
      }
      case 'if': {
        const br = this.emit({ op: 'br', cond: s.cond, then: 0, else: 0 });
        (this.code[br] as { then: number }).then = this.code.length;
        this.block(s.then);
        const jmp = this.emit({ op: 'jmp', to: 0 });
        (this.code[br] as { else: number }).else = this.code.length;
        if (s.else) !isBlock(s.else) ? this.stmt(s.else) : this.block(s.else);
        (this.code[jmp] as { to: number }).to = this.code.length;
        return;
      }
      case 'while': {
        const top = head ?? this.code.length;
        const br = this.emit({ op: 'br', cond: s.cond, then: 0, else: 0 });
        (this.code[br] as { then: number }).then = this.code.length;
        this.loops.push({ breaks: [] });
        this.block(s.body);
        this.emit({ op: 'jmp', to: top });
        const end = this.code.length;
        (this.code[br] as { else: number }).else = end;
        for (const b of this.loops.pop()!.breaks) (this.code[b] as { to: number }).to = end;
        return;
      }
      case 'loop': {
        const top = head ?? this.code.length;
        this.loops.push({ breaks: [] });
        this.block(s.body);
        this.emit({ op: 'jmp', to: top });
        const end = this.code.length;
        for (const b of this.loops.pop()!.breaks) (this.code[b] as { to: number }).to = end;
        return;
      }
      case 'break': {
        const j = this.emit({ op: 'jmp', to: 0 });
        this.loops.at(-1)?.breaks.push(j);
        return;
      }
      case 'await':
        this.emit({ op: 'await', cond: s.cond, span: s.span });
        return;
      case 'atomic':
      case 'block':
        this.block(s.body);
        return;
      default:
        this.emit({ op: 'stmt', stmt: s });
    }
  }
}
