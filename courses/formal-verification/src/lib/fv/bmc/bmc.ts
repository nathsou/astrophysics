/**
 * Bounded model checking (Biere, Cimatti, Clarke and Zhu, 1999), chapter 10: unroll the transition relation k
 * times and ask a SAT solver for a run from an initial state that violates an invariant at step k:
 *
 *     I(S0) ∧ T(S0, S1) ∧ … ∧ T(Sk−1, Sk) ∧ ¬P(Sk)
 *
 * for k = 0, 1, 2, …. The first k with a model gives a shortest counterexample. One incremental solver keeps
 * everything it learned between bounds; each bound's ¬P is switched on by an activation literal passed as an
 * assumption. Every counterexample is replayed by the reference runtime before it is reported.
 */
import type { Verdict, Trace } from '../engines';
import { Solver } from '../sat/solver';
import { tseitin, type Formula } from '../sat/encode';
import { SystemRuntime, type State, type StepLabel } from '../vouch/interp/system';
import { SystemEncoder, VarPool, BmcError, and, not, or, decodeSV, type SymState, type StepInstance, type SV } from './symbolic';
import { compare, enumerate, funcGet, key, type Value, type FuncV } from '../vouch/interp/values';
import type { Ty } from '../vouch/check/types';
import { toTrace, describeInstance } from '../explore/explorer';

export interface BoundStats {
  k: number;
  /** Cumulative SAT variables and clauses after adding this bound. */
  vars: number;
  clauses: number;
  /** Time spent on this bound's solver calls, in milliseconds. */
  ms: number;
}

export interface BmcProperty {
  name: string;
  subject: string;
  /** The bound at which a violation was found, if any. */
  foundAt?: number;
  states?: State[];
  labels?: StepLabel[];
  replayed?: boolean;
  /** The decoded run, before replay (for the unrolling view). */
  decoded?: { states: Value[][]; steps: StepInstance[] };
  message?: string;
}

export interface BmcRun {
  properties: BmcProperty[];
  bounds: BoundStats[];
  /** The largest bound fully checked. */
  reached: number;
  complete: boolean;
}

/** Wraps a solver so formulas can be added incrementally with Tseitin variables drawn from the pool. */
class Incremental {
  readonly solver = new Solver();
  clauses = 0;
  private sideDone = 0;
  constructor(readonly pool: VarPool) {}
  add(f: Formula): void {
    this.flushSide();
    const t = tseitin(f, this.pool.next);
    this.pool.next = Math.max(this.pool.next, t.nvars + 1);
    this.solver.ensureVars(this.pool.next);
    for (const c of t.clauses) this.solver.addClause(c);
    this.clauses += t.clauses.length;
  }
  private clausesDone = 0;
  flushSide(): void {
    this.solver.ensureVars(this.pool.next);
    while (this.clausesDone < this.pool.sideClauses.length) {
      this.solver.addClause(this.pool.sideClauses[this.clausesDone++]!);
      this.clauses++;
    }
    while (this.sideDone < this.pool.side.length) {
      const f = this.pool.side[this.sideDone++]!;
      const t = tseitin(f, this.pool.next);
      this.pool.next = Math.max(this.pool.next, t.nvars + 1);
      this.solver.ensureVars(this.pool.next);
      for (const c of t.clauses) this.solver.addClause(c);
      this.clauses += t.clauses.length;
    }
  }
}

export interface BmcOptions {
  maxK?: number;
  timeout?: number;
  /** Only these invariants (by name). */
  only?: string[];
  signal?: AbortSignal;
  onBound?: (b: BoundStats) => void;
}

/** A BMC run that can be advanced one bound at a time (the widgets animate it). */
export class BmcSession {
  readonly pool = new VarPool();
  readonly enc: SystemEncoder;
  private inc: Incremental;
  private props: (BmcProperty & { expr?: Parameters<SystemRuntime['holds']>[0] })[];
  private failureProp: BmcProperty = { name: 'failure', subject: 'no step fails' };
  private checkFailures = false;
  private states: SymState[];
  private selectors: { step: StepInstance; sel: number; params?: SV[] }[][] = [];
  readonly bounds: BoundStats[] = [];
  k = -1;
  private deadline: number;

  constructor(
    readonly rt: SystemRuntime,
    readonly opts: BmcOptions = {},
  ) {
    this.enc = new SystemEncoder(rt, this.pool);
    this.inc = new Incremental(this.pool);
    const invariants = rt.info.invariants.filter((i) => !opts.only || opts.only.includes(i.name ?? ''));
    this.props = invariants.map((i) => ({ name: i.name ?? 'invariant', subject: `invariant ${i.name ?? ''}`.trim(), expr: i.expr }));
    this.states = [this.enc.freshState('0')];
    this.inc.add(this.enc.init(this.states[0]!));
    this.deadline = Date.now() + (opts.timeout ?? 8000);
  }

  get done(): boolean {
    const all = this.props.every((p) => p.foundAt !== undefined) && (!this.checkFailures || this.failureProp.foundAt !== undefined) && this.props.length > 0;
    return all || this.k >= (this.opts.maxK ?? 20) || Date.now() > this.deadline || !!this.opts.signal?.aborted;
  }

  /** Add and check the next bound. */
  next(): BoundStats {
    const k = ++this.k;
    const t0 = Date.now();
    const { enc, inc, pool } = this;
    if (k > 0) {
      const S = enc.freshState(String(k));
      const st = enc.step(this.states[k - 1]!, S);
      this.states.push(S);
      this.selectors.push(st.selectors);
      inc.add(st.formula);
      if (st.failures.length) {
        this.checkFailures = true;
        const act = pool.fresh(`check failure ${k}`);
        inc.add(or(not({ k: 'var', v: act }), st.failure));
        if (this.failureProp.foundAt === undefined && inc.solver.solve({ assumptions: [act] }) === 'sat') this.record(this.failureProp, k, undefined);
        inc.solver.addClause([-act]);
      }
    }
    for (const p of this.props) {
      if (p.foundAt !== undefined || !p.expr) continue;
      const act = pool.fresh(`check ${p.name} at ${k}`);
      inc.add(or(not({ k: 'var', v: act }), not(enc.holds(p.expr, this.states[k]!))));
      if (inc.solver.solve({ assumptions: [act], shouldStop: () => Date.now() > this.deadline }) === 'sat') this.record(p, k, p.expr);
      inc.solver.addClause([-act]);
    }
    const b = { k, vars: pool.next - 1, clauses: inc.clauses, ms: Date.now() - t0 };
    this.bounds.push(b);
    this.opts.onBound?.(b);
    return b;
  }

  private record(p: BmcProperty, k: number, inv: Parameters<SystemRuntime['holds']>[0] | undefined) {
    const m = this.inc.solver.model;
    const decodedStates = this.states.slice(0, k + 1).map((S) => this.enc.decode(S, m));
    const steps = this.selectors.slice(0, k).map((sels): StepInstance => {
      const hit = sels.find((s) => m[s.sel]);
      if (!hit) return { kind: 'stutter', name: '?', text: '?', args: [] };
      // Symbolic parameters: read their values from the model.
      return hit.params ? { ...hit.step, args: hit.params.map((x) => decodeSV(x, m)) } : hit.step;
    });
    p.foundAt = k;
    p.decoded = { states: decodedStates, steps };
    const r = replay(this.rt, decodedStates, steps, inv);
    p.states = r.states;
    p.labels = r.labels;
    p.replayed = r.ok;
    p.message = inv ? undefined : r.failure;
  }

  result(): BmcRun {
    const all = this.checkFailures ? [...this.props, this.failureProp] : this.props;
    return {
      properties: all.map((p) => {
        const { expr: _e, ...rest } = p as BmcProperty & { expr?: unknown };
        void _e;
        return rest;
      }),
      bounds: this.bounds,
      reached: this.k,
      complete: this.k >= (this.opts.maxK ?? 20),
    };
  }
}

export function bmc(rt: SystemRuntime, opts: BmcOptions = {}): BmcRun {
  const s = new BmcSession(rt, opts);
  while (!s.done) s.next();
  return s.result();
}

/** Compare slot values extensionally (functions by their values on the whole domain). */
export function sameValue(a: Value, b: Value, ty: Ty | undefined): boolean {
  if (ty?.k === 'func' && a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && a.t === 'func' && b.t === 'func') {
    const dom = ty.params.length === 1 ? enumerate(ty.params[0]!) : undefined;
    if (!dom) return key(a) === key(b);
    return dom.every((d) => {
      const x = funcGet(a as FuncV, d) ?? (a as FuncV).def;
      const y = funcGet(b as FuncV, d) ?? (b as FuncV).def;
      return sameValue(x, y, ty.result);
    });
  }
  return compare(a, b) === 0;
}

function sameState(rt: SystemRuntime, s: State, vals: Value[]): boolean {
  return rt.slots.every((slot, i) => sameValue(s.vals[i]!, vals[i]!, slot.ty));
}

/** Replay a decoded run with the runtime: same initial state, same steps, same states, and the property fails. */
export function replay(rt: SystemRuntime, decoded: Value[][], steps: StepInstance[], inv?: Parameters<SystemRuntime['holds']>[0]): { ok: boolean; states: State[]; labels: StepLabel[]; failure?: string } {
  const init = rt.initialMatching(decoded[0]!, (s, vals) => sameState(rt, s, vals));
  if (!init) return { ok: false, states: [], labels: [] };
  const states: State[] = [init];
  const labels: StepLabel[] = [];
  let cur = init;
  for (let t = 0; t < steps.length; t++) {
    const st = steps[t]!;
    const { succs, failures } = st.symbolic ? rt.actionSuccessors(cur, st.name, st.args) : rt.successors(cur);
    const sameStep = (l: StepLabel) => l.name === st.name && l.kind === st.kind && (st.kind !== 'process' || l.instance === st.instance) && (st.kind !== 'action' || l.args.every((a, i) => compare(a, st.args[i]!) === 0));
    if (t === steps.length - 1 && !inv) {
      const f = failures.find((x) => sameStep(x.label));
      if (f) {
        labels.push(f.label);
        return { ok: true, states, labels, failure: `The step ${f.label.text} fails: ${f.failure.message}` };
      }
      return { ok: false, states, labels };
    }
    const next = succs.find((s) => sameStep(s.label) && sameState(rt, s.state, decoded[t + 1]!)) ?? succs.find((s) => sameState(rt, s.state, decoded[t + 1]!));
    if (!next) return { ok: false, states, labels };
    labels.push(next.label);
    states.push(next.state);
    cur = next.state;
  }
  return { ok: !!inv && !rt.holds(inv, cur), states, labels };
}

/** Verdicts for the document pipeline and widgets. */
export function bmcVerdicts(rt: SystemRuntime, run: BmcRun): Verdict[] {
  const instance = describeInstance(rt);
  return run.properties.map((p): Verdict => {
    const stats = { bound: run.reached, variables: run.bounds.at(-1)?.vars ?? 0, clauses: run.bounds.at(-1)?.clauses ?? 0, ms: run.bounds.reduce((n, b) => n + b.ms, 0) };
    const span = rt.info.invariants.find((i) => i.name === p.name)?.span ?? rt.info.decl.nameSpan;
    if (p.foundAt !== undefined) {
      const trace: Trace | undefined = p.states?.length ? toTrace(rt, p.states, p.labels ?? []) : undefined;
      return {
        engine: 'bmc',
        status: 'violated',
        subject: p.subject,
        badge: { kind: 'violated', replayed: !!p.replayed },
        certificate: { kind: 'trace', checked: !!p.replayed, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance],
        stats,
        trace,
        message: p.message ?? `Bounded model checking finds a violation after ${p.foundAt} step${p.foundAt === 1 ? '' : 's'} (the shortest one).`,
        span,
      };
    }
    return {
      engine: 'bmc',
      status: 'unknown',
      subject: p.subject,
      badge: { kind: 'bounded', bound: run.reached, what: 'depth' },
      certificate: { kind: 'none', checked: false, checker: 'the SAT solver (each bound is a separate UNSAT answer)' },
      assumptions: [instance, 'only runs of at most this many steps were considered'],
      stats,
      message: `No violation in any run of up to ${run.reached} step${run.reached === 1 ? '' : 's'}.`,
      span,
    };
  });
}

export { BmcError, and };
