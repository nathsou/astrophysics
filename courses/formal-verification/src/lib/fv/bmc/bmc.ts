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
import { SystemEncoder, VarPool, BmcError, and, not, or, decodeSV, type SymState, type StepInstance } from './symbolic';
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
  flushSide(): void {
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

export function bmc(rt: SystemRuntime, opts: BmcOptions = {}): BmcRun {
  const maxK = opts.maxK ?? 20;
  const deadline = Date.now() + (opts.timeout ?? 8000);
  const pool = new VarPool();
  const enc = new SystemEncoder(rt, pool);
  const inc = new Incremental(pool);
  const invariants = rt.info.invariants.filter((i) => !opts.only || opts.only.includes(i.name ?? ''));
  const props: (BmcProperty & { expr?: (typeof invariants)[number]['expr'] })[] = invariants.map((i) => ({ name: i.name ?? 'invariant', subject: `invariant ${i.name ?? ''}`.trim(), expr: i.expr }));
  const failureProp: BmcProperty = { name: 'failure', subject: 'no step fails' };
  let checkFailures = false;
  const states: SymState[] = [enc.freshState('0')];
  const selectors: { step: StepInstance; sel: number; params?: import('./symbolic').SV[] }[][] = [];
  inc.add(enc.init(states[0]!));
  const bounds: BoundStats[] = [];
  let reached = -1;
  for (let k = 0; k <= maxK; k++) {
    if (opts.signal?.aborted || Date.now() > deadline) break;
    const t0 = Date.now();
    if (k > 0) {
      const S = enc.freshState(String(k));
      const st = enc.step(states[k - 1]!, S);
      states.push(S);
      selectors.push(st.selectors);
      inc.add(st.formula);
      if (st.failures.length) {
        checkFailures = true;
        const act = pool.fresh(`check failure ${k}`);
        inc.add(or(not({ k: 'var', v: act }), st.failure));
        if (failureProp.foundAt === undefined && inc.solver.solve({ assumptions: [act] }) === 'sat') record(failureProp, k, true);
        inc.solver.addClause([-act]);
      }
    }
    for (const p of props) {
      if (p.foundAt !== undefined || !p.expr) continue;
      const act = pool.fresh(`check ${p.name} at ${k}`);
      inc.add(or(not({ k: 'var', v: act }), not(enc.holds(p.expr, states[k]!))));
      if (inc.solver.solve({ assumptions: [act], shouldStop: () => Date.now() > deadline }) === 'sat') record(p, k, false);
      inc.solver.addClause([-act]);
    }
    const b = { k, vars: pool.next - 1, clauses: inc.clauses, ms: Date.now() - t0 };
    bounds.push(b);
    opts.onBound?.(b);
    reached = k;
    if (props.every((p) => p.foundAt !== undefined) && (!checkFailures || failureProp.foundAt !== undefined) && props.length) break;
  }

  function record(p: BmcProperty & { expr?: unknown }, k: number, failure: boolean) {
    const m = inc.solver.model;
    const decodedStates = states.slice(0, k + 1).map((S) => enc.decode(S, m));
    const steps = selectors.slice(0, k).map((sels): StepInstance => {
      const hit = sels.find((s) => m[s.sel]);
      if (!hit) return { kind: 'stutter', name: '?', text: '?', args: [] };
      // Symbolic parameters: read their values from the model.
      return hit.params ? { ...hit.step, args: hit.params.map((p) => decodeSV(p, m)) } : hit.step;
    });
    p.foundAt = k;
    p.decoded = { states: decodedStates, steps };
    const r = replay(rt, decodedStates, steps, failure ? undefined : (p as { expr: Parameters<SystemRuntime['holds']>[0] }).expr);
    p.states = r.states;
    p.labels = r.labels;
    p.replayed = r.ok;
    p.message = failure ? r.failure : undefined;
  }

  const all = checkFailures ? [...props, failureProp] : props;
  return { properties: all.map(({ ...p }) => { delete (p as { expr?: unknown }).expr; return p; }), bounds, reached, complete: reached === maxK };
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
  const init = rt.initial().states.find((s) => sameState(rt, s, decoded[0]!));
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
