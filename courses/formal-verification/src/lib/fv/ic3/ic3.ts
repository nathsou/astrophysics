/**
 * IC3 / property-directed reachability (Bradley, 2011; Eén, Mishchenko and Brayton, 2011), chapter 24.
 *
 * IC3 keeps a sequence of frames F0 = I, F1, …, FN. Each Fi over-approximates the states reachable in at most i
 * steps, and is a conjunction of clauses; Fi+1 ⊆ Fi is not required of the sets, but every clause of Fi+1 is also in
 * Fi (here: a clause is stored at the highest level where it holds, and Fi is every clause stored at level i or
 * above). Every Fi with i ≥ 1 implies the property P once level i has been worked on.
 *
 * - Blocking: while FN ∧ ¬P has a model (a bad state), try to show the bad state is unreachable in N steps. A state
 *   (a cube s) is blocked at level i when Fi−1 ∧ ¬s ∧ T ∧ s′ is unsatisfiable: no state of Fi−1 other than s itself
 *   leads to s (relative induction). Then ¬s, generalised by dropping literals while the query stays unsatisfiable
 *   and no initial state is excluded, becomes a clause of Fi. Otherwise the model gives a predecessor, which becomes
 *   a proof obligation at level i − 1. An obligation that is an initial state is a real counterexample.
 * - Propagation: after adding a frame, push each clause of Fi to Fi+1 when Fi ∧ T ∧ ¬c′ is unsatisfiable. If some
 *   level is left with no clauses of its own, Fi = Fi+1: Fi is an inductive invariant that implies P.
 *
 * The invariant is the certificate: I ⇒ Inv, Inv ∧ T ⇒ Inv′ and Inv ⇒ P are re-checked on fresh solvers and
 * their DRAT proofs checked. A counterexample is replayed by the reference interpreter.
 */
import type { Verdict, Trace } from '../engines';
import type { SystemRuntime } from '../vouch/interp/system';
import type { Value } from '../vouch/interp/values';
import type { Formula } from '../sat/encode';
import { and, not } from '../bmc/symbolic';
import { replay } from '../bmc/bmc';
import type { StepInstance } from '../bmc/symbolic';
import { toTrace, describeInstance } from '../explore/explorer';
import { SystemModel, IncrementalSolver, type Lit, type CertifiedQuery } from './model';

export type Ic3Event =
  | { k: 'bad'; level: number; cube: Lit[] }
  | { k: 'predecessor'; level: number; cube: Lit[]; of: Lit[] }
  | { k: 'blocked'; level: number; cube: Lit[]; clause: Lit[] }
  | { k: 'frame'; level: number }
  | { k: 'propagated'; from: number; clause: Lit[] }
  | { k: 'fixpoint'; level: number }
  | { k: 'counterexample'; length: number };

export interface Ic3Snapshot {
  event: Ic3Event;
  /** Clauses (as blocked cubes) stored at each level 1…N. */
  frames: Lit[][][];
  /** Open proof obligations: level and cube, most urgent last. */
  obligations: { level: number; cube: Lit[] }[];
}

export interface Ic3Result {
  status: 'proved' | 'violated' | 'unknown';
  /** Number of frames N at the end. */
  frames: number;
  /** The inductive invariant, as blocked cubes and as text. */
  invariant?: { cubes: Lit[][]; text: string[] };
  certificate?: { init: CertifiedQuery; step: CertifiedQuery; implies: CertifiedQuery };
  /** The counterexample's states, and whether the interpreter replayed it. */
  trace?: { states: Value[][]; replayed: boolean; trace?: Trace; violated: string };
  log: Ic3Snapshot[];
  stats: { queries: number; obligations: number; clauses: number; ms: number };
}

export interface Ic3Options {
  timeout?: number;
  maxFrames?: number;
  only?: string[];
  signal?: AbortSignal;
  /** Record a snapshot of the frames at every event (for the stepper). */
  record?: boolean;
  /** Time for re-checking the invariant's three queries (ms); 0 skips the check. */
  certifyBudget?: number;
}

interface Obligation {
  level: number;
  cube: Lit[];
  state: Value[];
  parent?: Obligation;
}

export class Ic3 {
  readonly m: SystemModel;
  private inc: IncrementalSolver;
  private actT: number;
  private actI: number;
  private actBad: number;
  private acts: number[] = [0];
  /** frames[i]: cubes blocked at level i (the clause ¬cube holds in F1 … Fi). */
  frames: Lit[][][] = [[]];
  private log: Ic3Snapshot[] = [];
  private queue: Obligation[] = [];
  private stats = { queries: 0, obligations: 0, clauses: 0, ms: 0 };
  private deadline: number;

  constructor(
    readonly rt: SystemRuntime,
    readonly opts: Ic3Options = {},
  ) {
    this.m = new SystemModel(rt, opts.only);
    this.inc = new IncrementalSolver(this.m.pool);
    this.actT = this.inc.guarded(this.m.trans, 'T');
    this.actI = this.inc.guarded(this.m.init, 'I');
    this.actBad = this.inc.guarded(not(this.m.property()), '¬P');
    this.deadline = Date.now() + (opts.timeout ?? 8000);
  }

  private get N(): number {
    return this.frames.length - 1;
  }
  private stop(): boolean {
    return Date.now() > this.deadline || !!this.opts.signal?.aborted;
  }
  private solve(assumptions: number[]): 'sat' | 'unsat' | 'unknown' {
    this.stats.queries++;
    return this.inc.solve(assumptions, () => this.stop());
  }
  /** Assumptions that switch on Fk. */
  private F(k: number): number[] {
    return k === 0 ? [this.actI] : this.acts.slice(k);
  }
  private emit(event: Ic3Event) {
    if (!this.opts.record || this.log.length > 2000) return;
    this.log.push({ event, frames: this.frames.map((f) => f.map((c) => [...c])), obligations: this.queue.map((o) => ({ level: o.level, cube: o.cube })) });
  }
  private newFrame() {
    this.frames.push([]);
    this.acts.push(this.m.pool.fresh(`F${this.frames.length - 1}`));
    this.emit({ k: 'frame', level: this.N });
  }
  private addClause(cube: Lit[], level: number) {
    // A clause ¬cube makes every weaker clause (a cube with more literals) at this level or below redundant.
    for (let i = 1; i <= level; i++) this.frames[i] = this.frames[i]!.filter((c) => !cube.every((l) => c.includes(l)));
    this.frames[level]!.push(cube);
    this.inc.clause([-this.acts[level]!, ...cube.map((l) => -l)]);
    this.stats.clauses++;
  }

  /** Is the cube an initial state (does it intersect I)? */
  private initial(cube: Lit[]): boolean {
    return this.solve([this.actI, ...cube]) !== 'unsat';
  }

  /** Relative induction: Fk−1 ∧ ¬cube ∧ T ∧ cube′. Returns 'unsat' with the primed literals used, or a model. */
  private relInd(cube: Lit[], level: number): { r: 'sat' | 'unsat' | 'unknown'; core?: Lit[] } {
    const tmp = this.m.pool.fresh('tmp');
    this.inc.clause([-tmp, ...cube.map((l) => -l)]);
    const primed = cube.map((l) => this.m.primed(l));
    const r = this.solve([...this.F(level - 1), tmp, this.actT, ...primed]);
    let core: Lit[] | undefined;
    if (r === 'unsat') {
      const failed = new Set(this.inc.failed);
      core = cube.filter((_, i) => failed.has(primed[i]!));
    }
    this.inc.clause([-tmp]);
    return { r, core };
  }

  /** Shrink a blocked cube: unsat core, then drop literals one by one while still blocked and not initial. */
  private generalise(cube: Lit[], core: Lit[], level: number): Lit[] {
    let g = core.length ? core : cube;
    if (this.initial(g)) {
      // The core may have dropped what kept the cube away from the initial states: add literals back.
      const extra = cube.filter((l) => !g.includes(l));
      for (const l of extra) {
        g = [...g, l];
        if (!this.initial(g)) break;
      }
      if (this.initial(g)) g = cube;
    }
    for (const l of [...g]) {
      if (g.length <= 1 || this.stop()) break;
      const cand = g.filter((x) => x !== l);
      if (this.initial(cand)) continue;
      const q = this.relInd(cand, level);
      if (q.r === 'unsat') g = q.core && q.core.length && !this.initial(q.core) ? q.core : cand;
    }
    return g;
  }

  /** Block a bad state at level N; false when it is reachable (a counterexample is left in `cex`). */
  private cex?: Obligation;
  private block(bad: Obligation): boolean | undefined {
    this.queue = [bad];
    while (this.queue.length) {
      if (this.stop()) return undefined;
      this.queue.sort((a, b) => b.level - a.level);
      const ob = this.queue.at(-1)!;
      if (this.initial(ob.cube)) {
        this.cex = ob;
        return false;
      }
      // Already blocked at this level by a clause added meanwhile?
      if (this.solve([...this.F(ob.level), ...ob.cube]) === 'unsat') {
        this.queue.pop();
        continue;
      }
      const q = this.relInd(ob.cube, ob.level);
      if (q.r === 'unknown') return undefined;
      if (q.r === 'sat') {
        const model = this.inc.model;
        const pred: Obligation = { level: ob.level - 1, cube: this.m.cube(model), state: this.m.decode(model), parent: ob };
        this.stats.obligations++;
        this.queue.push(pred);
        this.emit({ k: 'predecessor', level: pred.level, cube: pred.cube, of: ob.cube });
        continue;
      }
      this.queue.pop();
      const g = this.generalise(ob.cube, q.core ?? [], ob.level);
      this.addClause(g, ob.level);
      this.emit({ k: 'blocked', level: ob.level, cube: ob.cube, clause: g });
    }
    return true;
  }

  /** Push clauses forward; returns the level i where Fi = Fi+1, if any. */
  private propagate(): number | undefined {
    for (let i = 1; i < this.N; i++) {
      for (const c of [...this.frames[i]!]) {
        if (this.stop()) return undefined;
        const r = this.solve([...this.F(i), this.actT, ...c.map((l) => this.m.primed(l))]);
        if (r === 'unsat') {
          this.frames[i] = this.frames[i]!.filter((x) => x !== c);
          this.addClause(c, i + 1);
          this.stats.clauses--;
          this.emit({ k: 'propagated', from: i, clause: c });
        }
      }
      if (!this.frames[i]!.length) return i;
    }
    return undefined;
  }

  private invariantFormula(cubes: Lit[][], next: boolean): Formula {
    return and(...cubes.map((c) => not(this.m.cubeFormula(c, next))));
  }

  run(): Ic3Result {
    const t0 = Date.now();
    const done = (r: Omit<Ic3Result, 'log' | 'stats' | 'frames'>): Ic3Result => ({ ...r, frames: this.N, log: this.log, stats: { ...this.stats, ms: Date.now() - t0 } });
    // Depth 0: an initial state that violates the property.
    if (this.solve([this.actI, this.actBad]) === 'sat') {
      const model = this.inc.model;
      return done({ status: 'violated', trace: this.trace({ level: 0, cube: this.m.cube(model), state: this.m.decode(model) }) });
    }
    this.newFrame();
    const maxFrames = this.opts.maxFrames ?? 60;
    while (this.N <= maxFrames) {
      // Block every bad state in FN.
      for (;;) {
        if (this.stop()) return done({ status: 'unknown' });
        const r = this.solve([...this.F(this.N), this.actBad]);
        if (r === 'unknown') return done({ status: 'unknown' });
        if (r === 'unsat') break;
        const model = this.inc.model;
        const bad: Obligation = { level: this.N, cube: this.m.cube(model), state: this.m.decode(model) };
        this.stats.obligations++;
        this.emit({ k: 'bad', level: this.N, cube: bad.cube });
        const b = this.block(bad);
        if (b === undefined) return done({ status: 'unknown' });
        if (!b) {
          let len = 0;
          for (let o = this.cex; o?.parent; o = o.parent) len++;
          this.emit({ k: 'counterexample', length: len });
          return done({ status: 'violated', trace: this.trace(this.cex!) });
        }
      }
      this.newFrame();
      const fix = this.propagate();
      if (fix !== undefined) {
        this.emit({ k: 'fixpoint', level: fix });
        const cubes = this.frames.slice(fix + 1).flat();
        const Inv = this.invariantFormula(cubes, false);
        const Inv2 = this.invariantFormula(cubes, true);
        const deadline = Date.now() + (this.opts.certifyBudget ?? 5000);
        const certificate =
          this.opts.certifyBudget === 0
            ? undefined
            : {
                init: this.m.certify([this.m.init, not(Inv)], deadline),
                step: this.m.certify([Inv, this.m.trans, not(Inv2)], deadline),
                implies: this.m.certify([Inv, not(this.m.property())], deadline),
              };
        return done({ status: 'proved', invariant: { cubes, text: cubes.map((c) => this.m.showBlocked(c)) }, certificate });
      }
    }
    return done({ status: 'unknown' });
  }

  /** The counterexample from an initial obligation up through its parents, replayed by the interpreter. */
  private trace(first: Obligation): Ic3Result['trace'] {
    const states: Value[][] = [];
    for (let o: Obligation | undefined = first; o; o = o.parent) states.push(o.state);
    const last = { vals: states.at(-1)! };
    const inv = this.rt.info.invariants.filter((i) => !this.opts.only || this.opts.only.includes(i.name ?? 'invariant')).find((i) => !this.rt.holds(i.expr, last));
    const steps: StepInstance[] = states.slice(1).map(() => ({ kind: 'stutter', name: '', text: '', args: [] }));
    const r = replay(this.rt, states, steps, inv?.expr);
    return { states, replayed: r.ok, trace: r.ok ? toTrace(this.rt, r.states, r.labels) : undefined, violated: inv?.name ?? 'invariant' };
  }
}

export function ic3(rt: SystemRuntime, opts: Ic3Options = {}): Ic3Result {
  return new Ic3(rt, opts).run();
}

export function ic3Verdicts(rt: SystemRuntime, r: Ic3Result, m?: SystemModel): Verdict[] {
  const instance = describeInstance(rt);
  const assumptions = [instance, 'the SAT encoding of the system matches its semantics (counterexamples are replayed; proofs rest on the encoding)'];
  if (m?.hasChecks) assumptions.push('run-time checks inside steps (assert, overflow) are not covered: the explorer and BMC check those');
  const stats = { frames: r.frames, queries: r.stats.queries, clauses: r.invariant?.cubes.length ?? r.stats.clauses, ms: r.stats.ms };
  return rt.info.invariants.map((inv): Verdict => {
    const name = inv.name ?? 'invariant';
    const subject = `invariant ${name}`;
    if (r.status === 'violated' && r.trace && r.trace.violated === name) {
      return {
        engine: 'ic3', status: 'violated', subject, badge: { kind: 'violated', replayed: r.trace.replayed },
        certificate: { kind: 'trace', checked: r.trace.replayed, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance], stats, trace: r.trace.trace,
        message: `IC3 finds a run of ${r.trace.states.length - 1} step${r.trace.states.length === 2 ? '' : 's'} that violates it.`, span: inv.span,
      };
    }
    if (r.status === 'proved') {
      const c = r.certificate;
      const checked = !!c && c.init.checked && c.step.checked && c.implies.checked;
      return {
        engine: 'ic3', status: 'verified', subject, badge: { kind: 'verified', scope: 'every reachable state' },
        certificate: { kind: 'inductive-invariant', checked, checker: checked ? 'the DRAT checker (initiation, consecution and implication)' : 'not re-checked (the DRAT check did not finish)', detail: r.invariant?.text.join('\n') },
        assumptions, stats,
        message: `IC3 found an inductive invariant of ${r.invariant!.cubes.length} clause${r.invariant!.cubes.length === 1 ? '' : 's'} that implies the invariants, after ${r.frames} frames.`,
        span: inv.span,
      };
    }
    return {
      engine: 'ic3', status: r.status === 'violated' ? 'unknown' : 'timeout', subject, badge: { kind: 'unknown', reason: r.status === 'violated' ? 'another invariant fails first' : 'no invariant found in time' },
      certificate: { kind: 'none', checked: false, checker: '' }, assumptions, stats, message: r.status === 'violated' ? `IC3 stopped at a violation of ${r.trace?.violated}.` : 'IC3 did not converge within the time limit.', span: inv.span,
    };
  });
}

