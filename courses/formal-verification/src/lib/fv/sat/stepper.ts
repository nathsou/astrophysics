/**
 * A CDCL solver that runs one small step at a time, for the stepper of chapter 7. It is the same algorithm as
 * ./solver.ts without the engineering (no watched literals, no heuristics beyond the simplest), so that every
 * intermediate state can be shown: the trail with its decision levels, the reason of each implied literal (the
 * implication graph), the conflict, the resolution steps of conflict analysis down to the first unique
 * implication point, the learned clause and the level it sends the search back to.
 *
 * Literals are DIMACS integers. Tests compare its answers with ./solver.ts.
 */

export interface Assigned {
  lit: number;
  level: number;
  /** Index of the clause that forced it, or -1 for a decision. */
  reason: number;
}

export type StepEvent =
  | { kind: 'decide'; lit: number; level: number }
  | { kind: 'propagate'; lit: number; clause: number }
  | { kind: 'conflict'; clause: number }
  | { kind: 'learn'; clause: number[]; uip: number; backjump: number; resolutions: { pivot: number; with: number; result: number[] }[] }
  | { kind: 'backjump'; level: number }
  | { kind: 'sat' }
  | { kind: 'unsat' };

export interface Analysis {
  learned: number[];
  uip: number;
  backjump: number;
  resolutions: { pivot: number; with: number; result: number[] }[];
}

export class Stepper {
  clauses: number[][];
  /** How many of the clauses are the input (the rest were learned). */
  readonly inputCount: number;
  trail: Assigned[] = [];
  level = 0;
  status: 'running' | 'conflict' | 'sat' | 'unsat' = 'running';
  conflict = -1;
  /** The analysis of the current conflict (computed when the conflict is found). */
  analysis?: Analysis;
  log: StepEvent[] = [];
  stats = { decisions: 0, propagations: 0, conflicts: 0, learned: 0 };

  constructor(
    clauses: number[][],
    readonly nvars: number,
  ) {
    this.clauses = clauses.map((c) => [...c]);
    this.inputCount = clauses.length;
  }

  value(lit: number): boolean | undefined {
    const a = this.trail.find((t) => Math.abs(t.lit) === Math.abs(lit));
    if (!a) return undefined;
    return a.lit === lit;
  }

  assigned(v: number): Assigned | undefined {
    return this.trail.find((t) => Math.abs(t.lit) === v);
  }

  /** The status of a clause: satisfied, false (conflict), unit (with its open literal), or open. */
  clauseState(i: number): { kind: 'sat' } | { kind: 'false' } | { kind: 'unit'; lit: number } | { kind: 'open' } {
    let open = 0;
    let last = 0;
    for (const l of this.clauses[i]!) {
      const v = this.value(l);
      if (v === true) return { kind: 'sat' };
      if (v === undefined) {
        open++;
        last = l;
      }
    }
    if (open === 0) return { kind: 'false' };
    if (open === 1) return { kind: 'unit', lit: last };
    return { kind: 'open' };
  }

  /** The next unit propagation, if any (lowest clause index first). */
  nextUnit(): { lit: number; clause: number } | undefined {
    for (let i = 0; i < this.clauses.length; i++) {
      const s = this.clauseState(i);
      if (s.kind === 'unit') return { lit: s.lit, clause: i };
    }
    return undefined;
  }

  falseClause(): number {
    for (let i = 0; i < this.clauses.length; i++) if (this.clauseState(i).kind === 'false') return i;
    return -1;
  }

  unassignedVars(): number[] {
    const out: number[] = [];
    for (let v = 1; v <= this.nvars; v++) if (!this.assigned(v)) out.push(v);
    return out;
  }

  /** Make a decision (the reader's choice, or the default: the lowest unassigned variable, false first). */
  decide(lit?: number): void {
    if (this.status !== 'running') return;
    const choice = lit ?? -(this.unassignedVars()[0] ?? 0);
    if (!choice || this.assigned(Math.abs(choice))) throw new Error('That variable is already assigned.');
    this.level++;
    this.trail.push({ lit: choice, level: this.level, reason: -1 });
    this.stats.decisions++;
    this.log.push({ kind: 'decide', lit: choice, level: this.level });
    this.check();
  }

  /** Propagate one unit clause. Returns false if there was none. */
  propagateOne(): boolean {
    if (this.status !== 'running') return false;
    const u = this.nextUnit();
    if (!u) return false;
    this.trail.push({ lit: u.lit, level: this.level, reason: u.clause });
    this.stats.propagations++;
    this.log.push({ kind: 'propagate', lit: u.lit, clause: u.clause });
    this.check();
    return true;
  }

  /** Propagate until no unit clause is left (or a conflict appears). */
  propagateAll(): void {
    while (this.status === 'running' && this.propagateOne()) {
      /* keep going */
    }
  }

  private check(): void {
    const f = this.falseClause();
    if (f >= 0) {
      this.stats.conflicts++;
      this.log.push({ kind: 'conflict', clause: f });
      if (this.level === 0) {
        this.status = 'unsat';
        this.log.push({ kind: 'unsat' });
        return;
      }
      this.status = 'conflict';
      this.conflict = f;
      this.analysis = this.analyse(f);
      return;
    }
    if (this.unassignedVars().length === 0 && !this.nextUnit()) {
      this.status = 'sat';
      this.log.push({ kind: 'sat' });
    }
  }

  /**
   * Conflict analysis: resolve the conflict clause with the reasons of its literals assigned at the current level,
   * latest first, until exactly one literal of the current level is left: the first unique implication point.
   */
  analyse(conflict: number): Analysis {
    let clause = [...this.clauses[conflict]!];
    const resolutions: Analysis['resolutions'] = [];
    const atLevel = (c: number[]) => c.filter((l) => this.assigned(Math.abs(l))!.level === this.level);
    const pos = (l: number) => this.trail.findIndex((t) => Math.abs(t.lit) === Math.abs(l));
    while (atLevel(clause).length > 1) {
      // The literal of this level assigned last.
      const latest = atLevel(clause).sort((a, b) => pos(b) - pos(a))[0]!;
      const a = this.assigned(Math.abs(latest))!;
      const reason = this.clauses[a.reason]!;
      const merged = [...clause.filter((l) => l !== latest), ...reason.filter((l) => l !== -latest)];
      clause = [...new Set(merged)];
      resolutions.push({ pivot: Math.abs(latest), with: a.reason, result: [...clause] });
    }
    const uip = atLevel(clause)[0]!;
    const others = clause.filter((l) => l !== uip).map((l) => this.assigned(Math.abs(l))!.level);
    const backjump = others.length ? Math.max(...others) : 0;
    return { learned: [uip, ...clause.filter((l) => l !== uip)], uip, backjump, resolutions };
  }

  /** Learn the analysed clause and jump back; the learned clause is then unit and propagates. */
  learnAndBackjump(): void {
    if (this.status !== 'conflict' || !this.analysis) return;
    const { learned, backjump, uip, resolutions } = this.analysis;
    this.clauses.push(learned);
    this.stats.learned++;
    this.log.push({ kind: 'learn', clause: learned, uip, backjump, resolutions });
    this.trail = this.trail.filter((t) => t.level <= backjump);
    this.level = backjump;
    this.log.push({ kind: 'backjump', level: backjump });
    this.status = 'running';
    this.conflict = -1;
    this.analysis = undefined;
    this.check();
  }

  /** One automatic step: propagate if possible, else resolve a conflict, else decide. */
  step(): void {
    if (this.status === 'conflict') return this.learnAndBackjump();
    if (this.status !== 'running') return;
    if (this.propagateOne()) return;
    this.decide();
  }

  run(maxSteps = 10000): void {
    for (let i = 0; i < maxSteps && (this.status === 'running' || this.status === 'conflict'); i++) this.step();
  }

  /**
   * The implication graph: one node per assigned literal, edges from the negations of the other literals of its
   * reason clause; plus a conflict node fed by the literals of the false clause.
   */
  graph(): { nodes: Assigned[]; edges: { from: number; to: number | 'conflict' }[] } {
    const edges: { from: number; to: number | 'conflict' }[] = [];
    for (const t of this.trail) {
      if (t.reason < 0) continue;
      for (const l of this.clauses[t.reason]!) if (l !== t.lit) edges.push({ from: -l, to: t.lit });
    }
    if (this.conflict >= 0) for (const l of this.clauses[this.conflict]!) edges.push({ from: -l, to: 'conflict' });
    return { nodes: [...this.trail], edges };
  }
}
