/**
 * Symbolic reachability with BDDs (Burch, Clarke, McMillan, Dill and Hwang, 1990), chapter 11.
 *
 * Sets of states are BDDs over the state's Boolean variables (the encoding of ../bmc/symbolic.ts); the transition
 * relation is a BDD over current and next-state variables. Starting from the initial states,
 *
 *     R₀ = I,   Rᵢ₊₁ = Rᵢ ∪ Image(Rᵢ),   Image(X) = (∃S. X(S) ∧ T(S, S′))[S′ := S]
 *
 * until nothing new appears. Each iteration adds every state one step further, all at once, however many there are.
 *
 * The result is checked without trusting the BDD package: the reachable set R is exported as a formula and three
 * SAT queries, with DRAT-checked proofs, confirm that it is an inductive invariant that implies the property:
 * I ⇒ R, R ∧ T ⇒ R′, and R ⇒ P. A violation is reported at the depth where it appears and its trace is produced by
 * bounded model checking to that depth, replayed by the runtime.
 */
import { Bdd, type Node } from './bdd';
import { SystemEncoder, VarPool, BmcError, not, or, and, type SymState, type SV } from '../bmc/symbolic';
import { replay } from '../bmc/bmc';
import type { StepInstance } from '../bmc/symbolic';
import type { Value } from '../vouch/interp/values';
import { SystemRuntime } from '../vouch/interp/system';
import { tseitin, type Formula } from '../sat/encode';
import { Solver } from '../sat/solver';
import { checkDrat } from '../sat/check/drat';
import type { Verdict } from '../engines';
import { describeInstance, toTrace } from '../explore/explorer';

const clausesFormula = (cs: number[][]): Formula => and(...cs.map((c) => or(...c.map((l) => (l > 0 ? ({ k: 'var', v: l } as Formula) : not({ k: 'var', v: -l }))))));

function formulaVars(f: Formula): Set<number> {
  const out = new Set<number>();
  const seen = new Set<Formula>();
  const stack = [f];
  while (stack.length) {
    const g = stack.pop()!;
    if (seen.has(g)) continue;
    seen.add(g);
    if (g.k === 'var') out.add(g.v);
    else if (g.k === 'not') stack.push(g.a);
    else if (g.k === 'and' || g.k === 'or') stack.push(...g.args);
    else if (g.k !== 'const') stack.push(g.a, g.b);
  }
  return out;
}

/** The Boolean variables of a symbolic state, in slot order. */
function varsOf(S: SymState): number[] {
  const out: number[] = [];
  const add = (f: Formula) => {
    if (f.k === 'var') out.push(f.v);
    else if (f.k === 'not' && f.a.k === 'var') out.push(f.a.v);
  };
  const walk = (x: SV) => {
    if (x.k === 'cases') for (const c of x.cs) add(c.cond);
    else if (x.k === 'bits') x.bits.forEach(add);
    else if (x.k === 'set') x.mem.forEach(add);
    else x.at.forEach(walk);
  };
  S.slots.forEach(walk);
  return [...new Set(out)];
}

export interface ReachIteration {
  i: number;
  /** States reachable in at most i steps. */
  states: bigint;
  /** New states found at this iteration. */
  frontier: bigint;
  reachNodes: number;
  frontierNodes: number;
  ms: number;
}

export interface ReachResult {
  iterations: ReachIteration[];
  /** The total number of reachable states (when the fixpoint was reached). */
  states?: bigint;
  done: boolean;
  /** Per invariant: the depth at which a reachable state violates it, if any. */
  violations: Map<string, number>;
  transitionNodes: number;
  stateVars: number;
  /** For invariants that hold: whether the exported reachable set passed the three SAT checks. */
  certificate?: { checked: boolean; clauses: number; ms: number };
}

export class Reachability {
  readonly bdd = new Bdd();
  readonly pool = new VarPool();
  readonly enc: SystemEncoder;
  readonly S: SymState;
  readonly S2: SymState;
  readonly cur: number[];
  readonly next: number[];
  private T: Node;
  private stepFormula: Formula;
  private sides: Formula;
  private initFormula: Formula;
  private toNext: Map<number, number>;
  private validityClauses: number;
  private toCur: Map<number, number>;
  private quantCur: Set<number>;
  R: Node;
  frontier: Node;
  readonly iterations: ReachIteration[] = [];
  readonly violations = new Map<string, number>();
  /** The new states of each iteration (for extracting counterexamples). */
  readonly frontiers: Node[] = [];
  private props: { name: string; P: Node; expr: Parameters<SystemRuntime['holds']>[0] }[];

  constructor(readonly rt: SystemRuntime) {
    this.enc = new SystemEncoder(rt, this.pool);
    const sideStart = this.pool.sideClauses.length;
    this.S = this.enc.freshState('s');
    this.S2 = this.enc.freshState("s'");
    this.validityClauses = this.pool.sideClauses.length - sideStart;
    this.cur = varsOf(this.S);
    this.next = varsOf(this.S2);
    const validityCls = this.pool.sideClauses.slice(sideStart, sideStart + this.validityClauses);
    const parts = this.enc.stepParts(this.S, this.S2);
    const initSide = this.pool.sideClauses.length;
    const init = this.enc.init(this.S);
    const initSides = clausesFormula(this.pool.sideClauses.slice(initSide));
    const state = new Set([...this.cur, ...this.next]);
    // Variable order: auxiliary variables (symbolic parameters, choices, counter helpers) first, so that a step's
    // relation branches on them before the state and they can be quantified cheaply; then current and next-state
    // variables interleaved, the usual choice for transition relations.
    for (let v = 1; v < this.pool.next; v++) if (!state.has(v)) this.bdd.addVar(v);
    this.cur.forEach((v, i) => {
      this.bdd.addVar(v, this.pool.names.get(v));
      this.bdd.addVar(this.next[i]!, this.pool.names.get(this.next[i]!));
    });
    // One-hot validity of S and S′ (its sequential-counter helpers are quantified away).
    const validityAux = new Set<number>();
    for (const c of validityCls) for (const l of c) if (!state.has(Math.abs(l))) validityAux.add(Math.abs(l));
    const validity = this.bdd.exists(this.bdd.fromFormula(clausesFormula(validityCls)), validityAux);
    const auxOf = (from: number) => {
      const s = new Set<number>();
      for (let v = from; v < this.pool.next; v++) if (!state.has(v)) s.add(v);
      return s;
    };
    // T = validity(S′) ∧ ∨ over steps of ∃(that step's auxiliary variables). step(S, S′)
    let T: Node = 0;
    for (const p of parts) {
      // The step's own constraints (one-hot choices) first: they keep the BDD of the relation small.
      const local = and(clausesFormula(this.pool.sideClauses.slice(p.sideStart, p.sideEnd)), p.formula);
      const aux = new Set<number>();
      for (const c of this.pool.sideClauses.slice(p.sideStart, p.sideEnd)) for (const l of c) if (!state.has(Math.abs(l))) aux.add(Math.abs(l));
      for (const v of formulaVars(p.formula)) if (!state.has(v)) aux.add(v);
      T = this.bdd.or(T, this.bdd.exists(this.bdd.fromFormula(local), aux));
    }
    this.T = this.bdd.and(T, validity);
    const I = this.bdd.exists(this.bdd.and(this.bdd.fromFormula(and(init, initSides)), validity), new Set([...auxOf(1), ...this.next]));
    // For the SAT certificate: the same relation as a formula (with selectors, as BMC uses it).
    this.stepFormula = or(...parts.map((p) => and(p.formula, clausesFormula(this.pool.sideClauses.slice(p.sideStart, p.sideEnd)))));
    this.sides = clausesFormula(this.pool.sideClauses.slice(sideStart, sideStart + this.validityClauses));
    this.initFormula = and(init, initSides);
    this.toNext = new Map(this.cur.map((v, i) => [v, this.next[i]!]));
    this.toCur = new Map(this.next.map((v, i) => [v, this.cur[i]!]));
    this.quantCur = new Set(this.cur);
    this.R = I;
    this.frontier = I;
    this.props = rt.info.invariants.map((p) => ({ name: p.name ?? 'invariant', expr: p.expr, P: this.bdd.fromFormula(this.enc.holds(p.expr, this.S)) }));
    this.record(0, 0);
  }

  get transitionNodes(): number {
    return this.bdd.size(this.T);
  }

  private record(i: number, t0: number) {
    this.frontiers.push(this.frontier);
    for (const p of this.props) if (!this.violations.has(p.name) && this.bdd.and(this.frontier, this.bdd.not(p.P)) !== 0) this.violations.set(p.name, i);
    this.iterations.push({
      i,
      states: this.bdd.satCount(this.R, this.cur),
      frontier: this.bdd.satCount(this.frontier, this.cur),
      reachNodes: this.bdd.size(this.R),
      frontierNodes: this.bdd.size(this.frontier),
      ms: t0 ? Date.now() - t0 : 0,
    });
  }

  get done(): boolean {
    return this.frontier === 0;
  }

  /** One image computation. */
  step(): ReachIteration {
    const t0 = Date.now();
    const img = this.bdd.rename(this.bdd.andExists(this.frontier, this.T, this.quantCur), this.toCur);
    this.frontier = this.bdd.and(img, this.bdd.not(this.R));
    this.R = this.bdd.or(this.R, this.frontier);
    this.record(this.iterations.length, t0);
    return this.iterations.at(-1)!;
  }

  /** One complete assignment to the current-state variables within a non-empty set. */
  private pick(f: Node): Map<number, boolean> {
    const m = new Map<number, boolean>();
    let g = f;
    for (const v of this.cur) {
      const lo = this.bdd.restrict(g, v, false);
      if (lo !== 0) {
        m.set(v, false);
        g = lo;
      } else {
        m.set(v, true);
        g = this.bdd.restrict(g, v, true);
      }
    }
    return m;
  }
  private cube(m: Map<number, boolean>, rename?: Map<number, number>): Node {
    let c: Node = 1;
    for (const [v, b] of m) {
      const x = this.bdd.variable(rename?.get(v) ?? v);
      c = this.bdd.and(c, b ? x : this.bdd.not(x));
    }
    return c;
  }

  /**
   * A shortest run to a state violating `name`, from the frontiers: pick a bad state in the frontier where the
   * violation appeared, then repeatedly a predecessor in the previous frontier. Returns the states' slot values.
   */
  counterexample(name: string): Value[][] | undefined {
    const d = this.violations.get(name);
    const prop = this.props.find((p) => p.name === name);
    if (d === undefined || !prop) return undefined;
    let m = this.pick(this.bdd.and(this.frontiers[d]!, this.bdd.not(prop.P)));
    const states = [m];
    for (let i = d - 1; i >= 0; i--) {
      const succ = this.cube(m, this.toNext);
      const pre = this.bdd.and(this.bdd.andExists(this.T, succ, new Set(this.next)), this.frontiers[i]!);
      m = this.pick(pre);
      states.unshift(m);
    }
    return states.map((st) => {
      const arr: boolean[] = [];
      for (const [v, b] of st) arr[v] = b;
      return this.enc.decode(this.S, arr);
    });
  }

  /**
   * Check, by SAT with DRAT-checked proofs, that the reachable set is an inductive invariant implying every
   * invariant: I ∧ ¬R, R ∧ T ∧ ¬R′ and R ∧ ¬P are all unsatisfiable.
   */
  certify(): { checked: boolean; clauses: number; ms: number } {
    const t0 = Date.now();
    const Rf = this.bdd.toFormula(this.R);
    const R2 = this.bdd.toFormula(this.bdd.rename(this.R, this.toNext));
    const queries: Formula[] = [
      and(this.initFormula, this.sides, not(Rf)),
      and(Rf, this.stepFormula, this.sides, not(R2)),
      ...this.props.map((p) => and(Rf, this.sides, not(this.enc.holds(p.expr, this.S)))),
    ];
    let ok = true;
    let clauses = 0;
    for (const q of queries) {
      const cnf = tseitin(q, this.pool.next);
      clauses += cnf.clauses.length;
      const s = new Solver({ proof: true });
      s.ensureVars(cnf.nvars);
      for (const c of cnf.clauses) s.addClause(c);
      if (s.solve() !== 'unsat' || !checkDrat(cnf.clauses, s.proof).ok) {
        ok = false;
      }
    }
    return { checked: ok, clauses, ms: Date.now() - t0 };
  }

  run(opts: { maxIterations?: number; timeout?: number } = {}): ReachResult {
    const deadline = Date.now() + (opts.timeout ?? 8000);
    while (!this.done && this.iterations.length <= (opts.maxIterations ?? 10_000) && Date.now() < deadline) this.step();
    const result: ReachResult = {
      iterations: this.iterations,
      states: this.done ? this.iterations.at(-1)!.states : undefined,
      done: this.done,
      violations: this.violations,
      transitionNodes: this.transitionNodes,
      stateVars: this.cur.length,
    };
    if (this.done && this.violations.size < this.props.length) result.certificate = this.certify();
    return result;
  }
}

/** Verdicts: holds (with the certified reachable set) or violated (with a BMC trace to the depth found). */
export function reachVerdicts(rt: SystemRuntime, r: ReachResult, reach?: Reachability): Verdict[] {
  const instance = describeInstance(rt);
  const out: Verdict[] = [];
  for (const inv of rt.info.invariants) {
    const name = inv.name ?? 'invariant';
    const stats = { iterations: r.iterations.length - 1, states: Number(r.states ?? r.iterations.at(-1)?.states ?? 0), 'transition BDD nodes': r.transitionNodes, 'reachable-set BDD nodes': r.iterations.at(-1)?.reachNodes ?? 0, 'state variables': r.stateVars };
    const depth = r.violations.get(name);
    if (depth !== undefined) {
      const decoded = reach?.counterexample(name);
      const steps = decoded ? decoded.slice(1).map((): StepInstance => ({ kind: 'stutter', name: '', text: '', args: [] })) : [];
      const rp = decoded ? replay(rt, decoded, steps, inv.expr) : undefined;
      out.push({
        engine: 'bdd',
        status: 'violated',
        subject: `invariant ${name}`,
        badge: { kind: 'violated', replayed: !!rp?.ok },
        certificate: { kind: 'trace', checked: !!rp?.ok, checker: 'trace replay by the reference interpreter' },
        assumptions: [instance],
        stats,
        trace: rp?.states.length ? toTrace(rt, rp.states, rp.labels) : undefined,
        message: `A state reachable in ${depth} step${depth === 1 ? '' : 's'} violates ${name}.`,
        span: inv.span,
      });
    } else if (r.done) {
      out.push({
        engine: 'bdd',
        status: 'verified',
        subject: `invariant ${name}`,
        badge: { kind: 'exhaustive', states: Number(r.states ?? 0n), instance },
        certificate: { kind: 'inductive-invariant', checked: !!r.certificate?.checked, checker: 'the reachable set, exported as an inductive invariant, re-checked by SAT with DRAT proofs' },
        assumptions: [instance],
        stats,
        message: `All ${(r.states ?? 0n).toLocaleString('en-GB')} reachable states satisfy ${name}.`,
        span: inv.span,
      });
    } else {
      out.push({ engine: 'bdd', status: 'timeout', subject: `invariant ${name}`, badge: { kind: 'bounded', bound: r.iterations.length - 1, what: 'depth' }, certificate: { kind: 'none', checked: false, checker: '' }, assumptions: [instance], stats, message: 'Stopped before the fixpoint.', span: inv.span });
    }
  }
  return out;
}

export { BmcError };
