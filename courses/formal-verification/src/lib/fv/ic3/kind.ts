/**
 * k-induction (Sheeran, Singh and Stålmarck, 2000), chapter 23. An invariant P is proved when
 *
 *   base:  no run of fewer than k steps from an initial state reaches a state violating P
 *          (bounded model checking, chapter 10), and
 *   step:  from any k consecutive distinct states that all satisfy P, one more step cannot reach a state that
 *          violates P:   P(S0) ∧ T(S0,S1) ∧ … ∧ P(Sk−1) ∧ T(Sk−1,Sk) ∧ distinct(S0…Sk) ∧ ¬P(Sk)  is unsatisfiable.
 *
 * With k = 1 the step is plain induction: P ∧ T ⇒ P′. When the step query is satisfiable, its model is a
 * counterexample to induction (a CTI): states that satisfy P but lead out of it, though they may be unreachable.
 * The distinctness constraint (no state repeats in the unrolling) makes the method complete for finite systems.
 *
 * P is the conjunction of the system's invariants, so that a reader can strengthen an invariant by adding another
 * one. Both final queries are re-run on a fresh solver and their DRAT proofs checked.
 */
import type { Verdict, Trace } from '../engines';
import type { Formula } from '../sat/encode';
import type { SystemRuntime } from '../vouch/interp/system';
import type { Value } from '../vouch/interp/values';
import { and, not, or, eqSV, type SymState } from '../bmc/symbolic';
import { BmcSession, type BmcProperty } from '../bmc/bmc';
import { toTrace, describeInstance } from '../explore/explorer';
import { SystemModel, IncrementalSolver, type CertifiedQuery } from './model';

export interface Cti {
  /** The states S0 … Sk of the step query's model, as slot values. */
  states: Value[][];
  /** Invariants that hold in S0 … Sk−1 (all of them) and fail in Sk. */
  failing: string[];
  trace: Trace;
}

export interface KindRound {
  k: number;
  /** Base case: runs of up to k − 1 steps checked. */
  baseDepth: number;
  inductive: boolean;
  cti?: Cti;
}

export interface KindResult {
  status: 'proved' | 'violated' | 'unknown';
  rounds: KindRound[];
  /** The k at which the step became unsatisfiable. */
  k?: number;
  violations: BmcProperty[];
  certificate?: { base: CertifiedQuery; step: CertifiedQuery };
  ms: number;
}

export interface KindOptions {
  maxK?: number;
  timeout?: number;
  only?: string[];
  signal?: AbortSignal;
  /** Time for re-checking the final queries' proofs (ms); 0 skips the check. */
  certifyBudget?: number;
}

export class KInduction {
  readonly m: SystemModel;
  private inc: IncrementalSolver;
  private states: SymState[] = [];
  private props: { name: string; expr: Parameters<SystemRuntime['holds']>[0] }[];
  private base: BmcSession;
  private stepFormulas: Formula[] = [];
  private distinct: Formula[] = [];
  private asserted = 0;
  readonly rounds: KindRound[] = [];
  private deadline: number;

  constructor(
    readonly rt: SystemRuntime,
    readonly opts: KindOptions = {},
  ) {
    this.m = new SystemModel(rt, opts.only);
    this.inc = new IncrementalSolver(this.m.pool);
    this.props = rt.info.invariants.filter((i) => !opts.only || opts.only.includes(i.name ?? 'invariant')).map((i) => ({ name: i.name ?? 'invariant', expr: i.expr }));
    this.base = new BmcSession(rt, { only: opts.only, maxK: 1000, timeout: opts.timeout ?? 8000, signal: opts.signal });
    this.deadline = Date.now() + (opts.timeout ?? 8000);
  }

  private P(S: SymState): Formula {
    return and(...this.props.map((p) => this.m.enc.holds(p.expr, S)));
  }

  private ensureStates(k: number) {
    while (this.states.length <= k) {
      const i = this.states.length;
      const S = this.m.freshState(String(i));
      this.states.push(S);
      if (i > 0) {
        const T = this.m.enc.step(this.states[i - 1]!, S, { blockFailures: true }).formula;
        this.stepFormulas.push(T);
        this.inc.add(T);
        for (let j = 0; j < i; j++) {
          const d = not(and(...this.states[j]!.slots.map((x, n) => eqSV(x, S.slots[n]!))));
          this.distinct.push(d);
          this.inc.add(d);
        }
      }
    }
  }

  /** Base case up to depth k − 1: returns the invariants violated (with replayed traces). */
  checkBase(k: number): BmcProperty[] {
    while (this.base.k < k - 1 && !this.base.done) this.base.next();
    return this.base.result().properties.filter((p) => p.foundAt !== undefined);
  }

  /** The step query for k. */
  checkStep(k: number): KindRound {
    this.ensureStates(k);
    // P holds in S0 … Sk−1 (asserted for good: every later query needs them too).
    while (this.asserted < k) this.inc.add(this.P(this.states[this.asserted++]!));
    const act = this.inc.guarded(not(this.P(this.states[k]!)), `¬P at ${k}`);
    const r = this.inc.solve([act], () => Date.now() > this.deadline || !!this.opts.signal?.aborted);
    this.inc.clause([-act]);
    const round: KindRound = { k, baseDepth: k - 1, inductive: r === 'unsat' };
    if (r === 'sat') {
      const model = this.inc.model;
      const states = this.states.slice(0, k + 1).map((S) => this.m.decode(model, S));
      const last = { vals: states[k]! };
      const failing = this.props.filter((p) => !this.rt.holds(p.expr, last)).map((p) => p.name);
      const trace: Trace = { steps: states.map((vals, i) => ({ label: i ? 'one step' : undefined, state: { values: this.rt.describe({ vals }) } })) };
      round.cti = { states, failing, trace };
    }
    if (r === 'unknown') round.inductive = false;
    this.rounds.push(round);
    return round;
  }

  /** Re-check the final base and step queries for k with DRAT proofs. */
  certify(k: number, deadline = Date.now() + (this.opts.certifyBudget ?? 5000)): { base: CertifiedQuery; step: CertifiedQuery } {
    const S = this.states;
    const init = this.m.enc.init(S[0]!);
    const T = this.stepFormulas.slice(0, k);
    const base = k === 1 ? this.m.certify([init, not(this.P(S[0]!))], deadline) : this.m.certify([init, ...T.slice(0, k - 1), or(...S.slice(0, k).map((s) => not(this.P(s))))], deadline);
    const nDistinct = (k * (k + 1)) / 2;
    const step = this.m.certify([...S.slice(0, k).map((s) => this.P(s)), ...T, ...this.distinct.slice(0, nDistinct), not(this.P(S[k]!))], deadline);
    return { base, step };
  }

  run(): KindResult {
    const t0 = Date.now();
    const maxK = this.opts.maxK ?? 8;
    for (let k = 1; k <= maxK; k++) {
      if (Date.now() > this.deadline || this.opts.signal?.aborted) break;
      const v = this.checkBase(k);
      if (v.length) return { status: 'violated', rounds: this.rounds, violations: v, ms: Date.now() - t0 };
      const r = this.checkStep(k);
      if (r.inductive) {
        // The base must also hold up to depth k − 1 (checked above); certify both queries.
        const certificate = this.opts.certifyBudget === 0 ? undefined : this.certify(k);
        return { status: 'proved', rounds: this.rounds, k, violations: [], certificate, ms: Date.now() - t0 };
      }
    }
    return { status: 'unknown', rounds: this.rounds, violations: [], ms: Date.now() - t0 };
  }
}

export function kInduction(rt: SystemRuntime, opts: KindOptions = {}): KindResult {
  return new KInduction(rt, opts).run();
}

export function kindVerdicts(rt: SystemRuntime, r: KindResult, m?: SystemModel): Verdict[] {
  const instance = describeInstance(rt);
  const invs = rt.info.invariants;
  const assumptions = [instance, 'the SAT encoding of the system matches its semantics (counterexamples are replayed; proofs rest on the encoding)'];
  if (m?.hasChecks) assumptions.push('run-time checks inside steps (assert, overflow) are not covered: the explorer and BMC check those');
  return invs.map((inv): Verdict => {
    const name = inv.name ?? 'invariant';
    const subject = `invariant ${name}`;
    const v = r.violations.find((p) => p.name === name);
    if (v) {
      return {
        engine: 'kind', status: 'violated', subject, badge: { kind: 'violated', replayed: !!v.replayed },
        certificate: { kind: 'trace', checked: !!v.replayed, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance], stats: { depth: v.foundAt ?? 0 },
        trace: v.states?.length ? toTrace(rt, v.states, v.labels ?? []) : undefined,
        message: `The base case fails: a run of ${v.foundAt} step${v.foundAt === 1 ? '' : 's'} reaches a state that violates it.`, span: inv.span,
      };
    }
    if (r.status === 'proved') {
      const c = r.certificate;
      const checked = !!c && c.base.checked && c.step.checked;
      const stopped = !!c && (c.base.stopped || c.step.stopped);
      return {
        engine: 'kind', status: 'verified', subject, badge: { kind: 'verified', scope: 'every reachable state' },
        certificate: { kind: 'drat', checked, checker: checked ? 'the DRAT checker (base and step queries)' : stopped ? 'not re-checked: the DRAT check ran out of time' : 'not re-checked' },
        assumptions, stats: { k: r.k!, ...(c ? { clauses: c.base.clauses + c.step.clauses } : {}), ms: r.ms },
        message: r.k === 1 ? 'The invariants together are inductive: they hold initially, and every step from a state satisfying them leads to one that does.' : `The invariants together are ${r.k}-inductive: no run of fewer than ${r.k} steps breaks them, and ${r.k} consecutive states satisfying them are always followed by one that does.`,
        span: inv.span,
      };
    }
    const last = r.rounds.at(-1);
    return {
      engine: 'kind', status: 'unknown', subject, badge: { kind: 'unknown', reason: 'not inductive' },
      certificate: { kind: 'none', checked: false, checker: '' }, assumptions, stats: { k: last?.k ?? 0, ms: r.ms },
      message: last?.cti ? `Not ${last.k}-inductive: a counterexample to induction leads from states satisfying the invariants to one where ${last.cti.failing.join(', ') || 'one'} fails. It may be unreachable; strengthen the invariant to rule it out.` : 'Not proved within the time limit.',
      span: inv.span,
    };
  });
}
