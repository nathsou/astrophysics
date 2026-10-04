/**
 * A system's state as Boolean variables, for the induction-based engines of Part V (k-induction in chapter 23, IC3
 * in chapter 24). It wraps the SAT encoding of chapter 10 (src/lib/fv/bmc/symbolic.ts): `init(S)`, `step(S, S′)`
 * with failing paths leading nowhere, and each invariant as a formula over S.
 *
 * It also turns models into cubes (one literal per Boolean "group" of the state: the true variable of a one-hot
 * group, or a single variable with its polarity), cubes into readable conditions, and builds fresh,
 * non-incremental queries whose UNSAT answers are re-checked by the DRAT checker.
 */
import type { Formula } from '../sat/encode';
import { tseitin } from '../sat/encode';
import { Solver } from '../sat/solver';
import { checkDrat } from '../sat/check/drat';
import type { SystemRuntime } from '../vouch/interp/system';
import type { Value } from '../vouch/interp/values';
import { SystemEncoder, VarPool, and, not, type SV, type SymState, type StepInstance } from '../bmc/symbolic';

/** A literal over the current-state variables (DIMACS: positive or negative variable number). */
export type Lit = number;

/** One group of a state's variables: a one-hot group (exactly one is true) or a single free variable. */
interface Group {
  vars: number[];
  oneHot: boolean;
}

function groupsOf(x: SV, out: Group[] = []): Group[] {
  if (x.k === 'cases') {
    const vs = x.cs.map((c) => c.cond);
    if (vs.length === 2 && vs[0]!.k === 'var' && vs[1]!.k === 'not' && vs[1]!.a.k === 'var' && vs[1]!.a.v === vs[0]!.v) out.push({ vars: [vs[0]!.v], oneHot: false });
    else if (vs.every((c) => c.k === 'var')) out.push({ vars: vs.map((c) => (c as { v: number }).v), oneHot: vs.length > 1 });
    // Constant slots (a single case with condition true) carry no variables.
    return out;
  }
  if (x.k === 'bits') {
    for (const b of x.bits) if (b.k === 'var') out.push({ vars: [b.v], oneHot: false });
    return out;
  }
  if (x.k === 'set') {
    for (const m of x.mem) if (m.k === 'var') out.push({ vars: [m.v], oneHot: false });
    return out;
  }
  for (const a of x.at) groupsOf(a, out);
  return out;
}

export interface CertifiedQuery {
  unsat: boolean;
  /** The DRAT checker accepted the proof. */
  checked: boolean;
  clauses: number;
  /** The solver or the checker ran out of time. */
  stopped?: boolean;
  proofLines?: number;
}

export class SystemModel {
  readonly pool = new VarPool();
  readonly enc: SystemEncoder;
  /** Current and next state. */
  readonly S: SymState;
  readonly S2: SymState;
  readonly groups: Group[];
  readonly groups2: Group[];
  /** current var → next var, and back. */
  readonly toNext = new Map<number, number>();
  readonly toCur = new Map<number, number>();
  readonly init: Formula;
  readonly trans: Formula;
  /** Each invariant (by name) over S, and over S′. */
  readonly props: { name: string; at: Formula; next: Formula }[];
  /** Does some step contain a run-time check (assert, arithmetic overflow)? Those are not covered here. */
  readonly hasChecks: boolean;
  /** The selector variable of each step instance in `trans` (true when that step is the one taken). */
  readonly selectors: { step: StepInstance; sel: number }[];

  constructor(
    readonly rt: SystemRuntime,
    only?: string[],
    keep?: ConstructorParameters<typeof SystemEncoder>[2],
  ) {
    this.enc = new SystemEncoder(rt, this.pool, keep);
    this.S = this.enc.freshState('s');
    this.S2 = this.enc.freshState('s′');
    this.groups = this.S.slots.flatMap((x) => groupsOf(x));
    this.groups2 = this.S2.slots.flatMap((x) => groupsOf(x));
    this.groups.forEach((g, i) =>
      g.vars.forEach((x, j) => {
        const y = this.groups2[i]!.vars[j]!;
        this.toNext.set(x, y);
        this.toCur.set(y, x);
      }),
    );
    this.init = this.enc.init(this.S);
    const st = this.enc.step(this.S, this.S2, { blockFailures: true });
    this.trans = st.formula;
    this.hasChecks = st.failures.length > 0;
    this.selectors = st.selectors;
    this.props = rt.info.invariants
      .filter((i) => !only || only.includes(i.name ?? 'invariant'))
      .map((i) => ({ name: i.name ?? 'invariant', at: this.enc.holds(i.expr, this.S), next: this.enc.holds(i.expr, this.S2) }));
  }

  /** The conjunction of the invariants, over S (or S′). */
  property(next = false): Formula {
    return and(...this.props.map((p) => (next ? p.next : p.at)));
  }

  /** A fresh state (for unrollings), with its own variables. */
  freshState(tag: string): SymState {
    return this.enc.freshState(tag);
  }

  /** The cube of a model over the current state: one literal per group. */
  cube(model: readonly boolean[], next = false): Lit[] {
    const gs = next ? this.groups2 : this.groups;
    const out: Lit[] = [];
    for (const g of gs) {
      if (g.oneHot) {
        const on = g.vars.find((x) => model[x]);
        if (on !== undefined) out.push(next ? this.toCur.get(on)! : on);
      } else {
        const x = g.vars[0]!;
        const c = next ? this.toCur.get(x)! : x;
        out.push(model[x] ? c : -c);
      }
    }
    return out;
  }

  /** A literal over S, moved to S′. */
  primed(l: Lit): Lit {
    const y = this.toNext.get(Math.abs(l))!;
    return l > 0 ? y : -y;
  }

  /** The cube as a formula over S (or S′). */
  cubeFormula(c: Lit[], next = false): Formula {
    return and(...c.map((l): Formula => {
      const x = next ? this.toNext.get(Math.abs(l))! : Math.abs(l);
      return l > 0 ? { k: 'var', v: x } : not({ k: 'var', v: x });
    }));
  }

  /** The slot values of the state a model gives to S. */
  decode(model: readonly boolean[], S: SymState = this.S): Value[] {
    return this.enc.decode(S, model);
  }

  /** A literal as a condition in Vouch syntax: `turn == 1`, `P(0) at critical`, `flag[0]`, `!flag[0]`. */
  showLit(l: Lit): string {
    const name = (this.pool.names.get(Math.abs(l)) ?? `v${Math.abs(l)}`).replace(/@s′?/g, '');
    let m = /^(.*)\.pc = (.*)$/.exec(name);
    if (m) return l > 0 ? `${m[1]} at ${m[2]}` : `!(${m[1]} at ${m[2]})`;
    m = /^(.*) = (.*)$/.exec(name);
    if (m) return `${m[1]} ${l > 0 ? '==' : '!='} ${m[2]}`;
    m = /^(.*) bit (\d+)$/.exec(name);
    if (m) return `bit ${m[2]} of ${m[1]} is ${l > 0 ? 1 : 0}`;
    return l > 0 ? name : name.includes(' ') ? `!(${name})` : `!${name}`;
  }

  /** A clause ¬cube, shown as "never all of these at once". */
  showBlocked(cube: Lit[]): string {
    if (cube.length === 1) {
      const s = this.showLit(-cube[0]!);
      return s;
    }
    return `!(${cube.map((l) => this.showLit(l)).join(' && ')})`;
  }

  /** Every always-true side constraint (one-hot groups, symbolic parameters), as clauses, and the next free variable. */
  private sideCnf(): { clauses: number[][]; next: number } {
    const clauses = [...this.pool.sideClauses];
    let next = this.pool.next;
    for (const f of this.pool.side) {
      const t = tseitin(f, next);
      next = Math.max(next, t.nvars + 1);
      clauses.push(...t.clauses);
    }
    return { clauses, next };
  }

  /**
   * Decide a conjunction of formulas on a fresh solver with proof logging; when it is unsatisfiable, re-check the
   * proof with the DRAT checker. Used for the certificates. The check stops (and reports `checked: false`) at the
   * deadline, if one is given.
   */
  certify(fs: Formula[], deadline?: number): CertifiedQuery {
    const side = this.sideCnf();
    const t = tseitin(and(...fs), side.next);
    const clauses = [...side.clauses, ...t.clauses];
    const s = new Solver({ proof: true });
    s.ensureVars(Math.max(t.nvars, side.next) + 1);
    for (const c of clauses) if (!s.addClause(c)) break;
    const stop = deadline === undefined ? undefined : () => Date.now() > deadline;
    const r = s.solve({ shouldStop: stop });
    if (r !== 'unsat') return { unsat: false, checked: false, clauses: clauses.length, stopped: r === 'unknown' };
    const d = checkDrat(clauses, s.proof, undefined, stop);
    return { unsat: true, checked: d.ok, clauses: clauses.length, stopped: !d.ok && !!stop?.(), proofLines: s.proof.length };
  }
}

/** A solver to which formulas over the model's variables are added as they are built (with the side constraints). */
export class IncrementalSolver {
  readonly solver = new Solver();
  private clausesDone = 0;
  private sideDone = 0;
  constructor(readonly pool: VarPool) {}
  private flush(): void {
    this.solver.ensureVars(this.pool.next);
    while (this.clausesDone < this.pool.sideClauses.length) this.solver.addClause(this.pool.sideClauses[this.clausesDone++]!);
    while (this.sideDone < this.pool.side.length) this.addRaw(this.pool.side[this.sideDone++]!);
  }
  private addRaw(f: Formula): void {
    const t = tseitin(f, this.pool.next);
    this.pool.next = Math.max(this.pool.next, t.nvars + 1);
    this.solver.ensureVars(this.pool.next);
    for (const c of t.clauses) this.solver.addClause(c);
  }
  /** Assert a formula for good. */
  add(f: Formula): void {
    this.flush();
    this.addRaw(f);
  }
  /** Assert a formula under a fresh activation literal; returns the literal (assume it to switch the formula on). */
  guarded(f: Formula, name?: string): number {
    const a = this.pool.fresh(name);
    this.add({ k: 'or', args: [{ k: 'not', a: { k: 'var', v: a } }, f] });
    return a;
  }
  /** Add a clause directly (DIMACS literals). */
  clause(lits: number[]): void {
    this.flush();
    this.solver.addClause(lits);
  }
  solve(assumptions: number[], shouldStop?: () => boolean): 'sat' | 'unsat' | 'unknown' {
    this.flush();
    return this.solver.solve({ assumptions, shouldStop });
  }
  get model(): boolean[] {
    return this.solver.model;
  }
  get failed(): number[] {
    return this.solver.failedAssumptions;
  }
}

/** Every state the variables can describe (not only the reachable ones), as models over S, up to a limit. */
export function allStates(m: SystemModel, limit = 600): boolean[][] | undefined {
  const inc = new IncrementalSolver(m.pool);
  const out: boolean[][] = [];
  const vars = m.groups.flatMap((g) => g.vars);
  while (out.length <= limit) {
    if (inc.solve([]) !== 'sat') return out;
    const model = [...inc.model];
    out.push(model);
    inc.clause(vars.map((x) => (model[x] ? -x : x)));
  }
  return undefined;
}

/** Does the state (a model over S) satisfy the cube? */
export function inCube(model: readonly boolean[], cube: Lit[]): boolean {
  return cube.every((l) => (l > 0 ? model[l] : !model[-l]));
}
