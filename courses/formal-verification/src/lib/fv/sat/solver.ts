/**
 * A conflict-driven clause-learning (CDCL) SAT solver, written to be read (chapter 7) and fast enough for the
 * course's problems in a browser worker.
 *
 *   - two watched literals per clause (Chaff, 2001), so propagation only looks at clauses that might become unit;
 *   - 1-UIP conflict analysis with clause minimisation, and non-chronological backjumping (GRASP, 1996);
 *   - VSIDS decision heuristic with a binary heap, phase saving, Luby restarts;
 *   - learned-clause deletion by literal block distance (LBD, from Glucose);
 *   - assumptions (solve under a set of literals; report the ones responsible for UNSAT), incremental clauses;
 *   - DRAT proof output, checked by the small trusted checker in ./check;
 *   - a theory hook for DPLL(T) (the SMT solver), and an event stream for the CDCL stepper.
 *
 * Literals in the API are DIMACS integers (+v / −v). Internally a literal is 2v (positive) or 2v+1 (negative).
 */

export type Lbool = 1 | -1 | 0;

/** A DRAT proof line: a clause added (derived by RUP), deleted, or added by a theory (checked by that theory). */
export interface ProofLine {
  kind: 'a' | 'd' | 't';
  lits: number[];
}

export interface Clause {
  lits: number[];
  learnt: boolean;
  lbd: number;
  activity: number;
  deleted: boolean;
  /** For the stepper: original index of an input clause, or −1 for learned clauses. */
  id: number;
}

export type SolverEvent =
  | { type: 'decide'; lit: number; level: number }
  | { type: 'propagate'; lit: number; level: number; reason: number[] }
  | { type: 'conflict'; clause: number[]; level: number }
  | { type: 'learn'; clause: number[]; uip: number; backjump: number; lbd: number }
  | { type: 'backjump'; level: number }
  | { type: 'restart' }
  | { type: 'theory-conflict'; clause: number[] }
  | { type: 'theory-propagate'; lit: number; reason: number[] }
  | { type: 'sat' }
  | { type: 'unsat' };

/** What a theory (DPLL(T)) sees and can do. All literals are DIMACS integers. */
export interface Theory {
  /**
   * Called when Boolean propagation has reached a fixpoint without conflict. `trail` lists the literals assigned
   * since the last call (in order); `full` is true when every variable is assigned (the final check).
   * Return a conflict clause (every literal false now) to make the solver backtrack, or implied literals with
   * their explanations (clauses that are unit under the current assignment), or lemmas (new clauses).
   */
  check(newLits: number[], full: boolean): TheoryResult;
  /** The solver undid every assignment above `level`; `trailSize` literals remain. */
  backtrack(trailSize: number): void;
}

export interface TheoryResult {
  conflict?: number[];
  implied?: { lit: number; reason: number[] }[];
  lemmas?: number[][];
}

export interface SolveOptions {
  assumptions?: number[];
  /** Give up after this many conflicts (result 'unknown'). */
  conflictLimit?: number;
  /** Abort (result 'unknown') when this returns true; checked every 256 conflicts. */
  shouldStop?: () => boolean;
}

export type SolveResult = 'sat' | 'unsat' | 'unknown';

export interface SolverOptions {
  /** Record a DRAT proof. */
  proof?: boolean;
  /** Learn clauses (CDCL); false gives plain DPLL with chronological backtracking. */
  learn?: boolean;
  /** Use VSIDS (otherwise decide on the lowest-numbered unassigned variable). */
  vsids?: boolean;
  restarts?: boolean;
  /** Receive every event (for the stepper). Slows the solver down. */
  onEvent?: (e: SolverEvent) => void;
  /** Choose the next decision (DIMACS literal) yourself; return 0 to let the solver pick. */
  decide?: (s: Solver) => number;
  theory?: Theory;
  seed?: number;
}

export interface Stats {
  decisions: number;
  propagations: number;
  conflicts: number;
  learned: number;
  deleted: number;
  restarts: number;
}

const lit = (d: number) => (d > 0 ? d << 1 : (-d << 1) | 1);
const dimacs = (l: number) => (l & 1 ? -(l >> 1) : l >> 1);
const neg = (l: number) => l ^ 1;
const varOf = (l: number) => l >> 1;

export class Solver {
  nvars = 0;
  clauses: Clause[] = [];
  learnts: Clause[] = [];
  private watches: Clause[][] = [];
  private assign: Int8Array = new Int8Array(1);
  private levelOf: Int32Array = new Int32Array(1);
  private reasonOf: (Clause | null)[] = [null];
  trail: number[] = [];
  private trailLim: number[] = [];
  private qhead = 0;
  private activity: Float64Array = new Float64Array(1);
  private varInc = 1;
  private clauseInc = 1;
  private phase: Int8Array = new Int8Array(1);
  private heap: number[] = [];
  private heapIndex: Int32Array = new Int32Array(1);
  private seen: Uint8Array = new Uint8Array(1);
  private ok = true;
  /** DRAT proof: lines of "a l1 l2 …" (added) and "d …" (deleted), as DIMACS literals. */
  proof: ProofLine[] = [];
  stats: Stats = { decisions: 0, propagations: 0, conflicts: 0, learned: 0, deleted: 0, restarts: 0 };
  /** After 'unsat' under assumptions: the assumptions that were used (DIMACS). */
  failedAssumptions: number[] = [];
  /** After 'sat': model[v] for v = 1…nvars. */
  model: boolean[] = [];
  readonly opts: Required<Pick<SolverOptions, 'proof' | 'learn' | 'vsids' | 'restarts'>> & SolverOptions;
  private theoryTrail = 0;
  private nextInputId = 0;
  private rngState: number;

  constructor(opts: SolverOptions = {}) {
    this.opts = { proof: false, learn: true, vsids: true, restarts: true, ...opts };
    this.rngState = (opts.seed ?? 91648253) >>> 0;
  }

  // ── Setup ──
  newVar(): number {
    this.ensureVars(this.nvars + 1);
    return this.nvars;
  }

  ensureVars(n: number): void {
    if (n <= this.nvars) return;
    const grow = <T extends Int8Array | Int32Array | Float64Array | Uint8Array>(a: T, size: number, C: new (n: number) => T): T => {
      const b = new C(size);
      b.set(a);
      return b;
    };
    const size = n + 1;
    this.assign = grow(this.assign, size, Int8Array);
    this.levelOf = grow(this.levelOf, size, Int32Array);
    this.activity = grow(this.activity, size, Float64Array);
    this.phase = grow(this.phase, size, Int8Array);
    this.heapIndex = grow(this.heapIndex, size, Int32Array);
    this.seen = grow(this.seen, size, Uint8Array);
    for (let v = this.nvars + 1; v <= n; v++) {
      this.reasonOf[v] = null;
      this.watches[2 * v] = [];
      this.watches[2 * v + 1] = [];
      this.heapIndex[v] = -1;
      this.phase[v] = -1;
      this.heapInsert(v);
    }
    this.nvars = n;
  }

  /** Add a clause (DIMACS literals). Returns false if the formula is now known to be unsatisfiable. */
  addClause(dimacsLits: number[]): boolean {
    const id = this.nextInputId++;
    if (!this.ok) return false;
    if (this.trailLim.length) this.backtrackTo(0);
    let max = 0;
    for (const d of dimacsLits) max = Math.max(max, Math.abs(d));
    this.ensureVars(max);
    // Remove duplicates and false literals; drop tautologies and satisfied clauses.
    const lits: number[] = [];
    for (const d of dimacsLits) {
      const l = lit(d);
      if (lits.includes(neg(l))) return true;
      if (this.value(l) === 1 && this.levelOf[varOf(l)] === 0) return true;
      if (this.value(l) === -1 && this.levelOf[varOf(l)] === 0) continue;
      if (!lits.includes(l)) lits.push(l);
    }
    if (lits.length < dimacsLits.length && this.opts.proof && lits.length !== new Set(dimacsLits).size) this.logAdd(lits);
    if (lits.length === 0) {
      this.ok = false;
      if (this.opts.proof) this.logAdd([]);
      return false;
    }
    if (lits.length === 1) {
      this.enqueue(lits[0]!, null);
      if (this.propagate()) {
        this.ok = false;
        if (this.opts.proof) this.logAdd([]);
        return false;
      }
      return true;
    }
    const c: Clause = { lits, learnt: false, lbd: 0, activity: 0, deleted: false, id };
    this.clauses.push(c);
    this.attach(c);
    return true;
  }

  private attach(c: Clause): void {
    this.watches[c.lits[0]!]!.push(c);
    this.watches[c.lits[1]!]!.push(c);
  }

  // ── Values ──
  private value(l: number): Lbool {
    const a = this.assign[varOf(l)]!;
    return (l & 1 ? -a : a) as Lbool;
  }
  /** The value of a DIMACS literal: 1 true, −1 false, 0 unassigned. */
  valueOf(d: number): Lbool {
    return d > 0 ? (this.assign[d]! as Lbool) : (-this.assign[-d]! as Lbool);
  }
  level(v: number): number {
    return this.levelOf[v]!;
  }
  decisionLevel(): number {
    return this.trailLim.length;
  }
  /** The reason clause (DIMACS) of an implied variable, or undefined for a decision. */
  reason(v: number): number[] | undefined {
    return this.reasonOf[v]?.lits.map(dimacs);
  }

  private enqueue(l: number, reason: Clause | null): void {
    const v = varOf(l);
    this.assign[v] = l & 1 ? -1 : 1;
    this.levelOf[v] = this.trailLim.length;
    this.reasonOf[v] = reason;
    this.trail.push(l);
    if (reason && this.opts.onEvent) this.opts.onEvent({ type: 'propagate', lit: dimacs(l), level: this.trailLim.length, reason: reason.lits.map(dimacs) });
  }

  /** Unit propagation with two watched literals. Returns a conflicting clause, or null. */
  private propagate(): Clause | null {
    while (this.qhead < this.trail.length) {
      const p = this.trail[this.qhead++]!;
      const falseLit = neg(p);
      const ws = this.watches[falseLit]!;
      let i = 0;
      let j = 0;
      while (i < ws.length) {
        const c = ws[i++]!;
        if (c.deleted) continue;
        const lits = c.lits;
        // Make sure the false literal is lits[1].
        if (lits[0] === falseLit) {
          lits[0] = lits[1]!;
          lits[1] = falseLit;
        }
        // If the other watch is true, the clause is satisfied: keep watching.
        if (this.value(lits[0]!) === 1) {
          ws[j++] = c;
          continue;
        }
        // Look for a new literal to watch.
        let found = false;
        for (let k = 2; k < lits.length; k++) {
          if (this.value(lits[k]!) !== -1) {
            lits[1] = lits[k]!;
            lits[k] = falseLit;
            this.watches[lits[1]!]!.push(c);
            found = true;
            break;
          }
        }
        if (found) continue;
        // The clause is unit (or conflicting) under the current assignment.
        ws[j++] = c;
        if (this.value(lits[0]!) === -1) {
          // Conflict: keep the remaining watches and stop.
          while (i < ws.length) ws[j++] = ws[i++]!;
          ws.length = j;
          this.qhead = this.trail.length;
          return c;
        }
        this.stats.propagations++;
        this.enqueue(lits[0]!, c);
      }
      ws.length = j;
    }
    return null;
  }

  // ── VSIDS heap (max-heap on activity) ──
  private heapLess(a: number, b: number): boolean {
    return this.activity[a]! > this.activity[b]!;
  }
  private heapUp(i: number): void {
    const v = this.heap[i]!;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.heapLess(v, this.heap[p]!)) break;
      this.heap[i] = this.heap[p]!;
      this.heapIndex[this.heap[i]!] = i;
      i = p;
    }
    this.heap[i] = v;
    this.heapIndex[v] = i;
  }
  private heapDown(i: number): void {
    const v = this.heap[i]!;
    const n = this.heap.length;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && this.heapLess(this.heap[c + 1]!, this.heap[c]!)) c++;
      if (!this.heapLess(this.heap[c]!, v)) break;
      this.heap[i] = this.heap[c]!;
      this.heapIndex[this.heap[i]!] = i;
      i = c;
    }
    this.heap[i] = v;
    this.heapIndex[v] = i;
  }
  private heapInsert(v: number): void {
    if (this.heapIndex[v]! >= 0) return;
    this.heap.push(v);
    this.heapIndex[v] = this.heap.length - 1;
    this.heapUp(this.heap.length - 1);
  }
  private heapPop(): number {
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    this.heapIndex[top] = -1;
    if (this.heap.length) {
      this.heap[0] = last;
      this.heapIndex[last] = 0;
      this.heapDown(0);
    }
    return top;
  }
  private bump(v: number): void {
    if ((this.activity[v]! += this.varInc) > 1e100) {
      for (let k = 1; k <= this.nvars; k++) this.activity[k]! *= 1e-100;
      this.varInc *= 1e-100;
    }
    const i = this.heapIndex[v]!;
    if (i >= 0) this.heapUp(i);
  }

  // ── Search ──
  private pickBranch(): number {
    if (this.opts.decide) {
      const d = this.opts.decide(this);
      if (d !== 0 && this.valueOf(d) === 0) return lit(d);
    }
    if (!this.opts.vsids) {
      for (let v = 1; v <= this.nvars; v++) if (this.assign[v] === 0) return (v << 1) | (this.phase[v] === 1 ? 0 : 1);
      return -1;
    }
    while (this.heap.length) {
      const v = this.heapPop();
      if (this.assign[v] === 0) return (v << 1) | (this.phase[v] === 1 ? 0 : 1);
    }
    return -1;
  }

  backtrackTo(level: number): void {
    if (this.trailLim.length <= level) return;
    const stop = this.trailLim[level]!;
    for (let i = this.trail.length - 1; i >= stop; i--) {
      const v = varOf(this.trail[i]!);
      this.phase[v] = this.assign[v]!;
      this.assign[v] = 0;
      this.reasonOf[v] = null;
      this.heapInsert(v);
    }
    this.trail.length = stop;
    this.trailLim.length = level;
    this.qhead = stop;
    if (this.theoryTrail > stop) {
      this.theoryTrail = stop;
      this.opts.theory?.backtrack(stop);
    }
    this.opts.onEvent?.({ type: 'backjump', level });
  }

  /** 1-UIP conflict analysis: the learned clause (asserting literal first) and the level to jump back to. */
  analyze(confl: Clause): { learnt: number[]; backjump: number } {
    const seen = this.seen;
    const learnt: number[] = [-1];
    let pathC = 0;
    let p = -1;
    let index = this.trail.length - 1;
    let c: Clause | null = confl;
    const level = this.trailLim.length;
    do {
      if (c!.learnt) this.bumpClause(c!);
      for (const q of c!.lits) {
        if (q === p) continue;
        const v = varOf(q);
        if (!seen[v] && this.levelOf[v]! > 0) {
          seen[v] = 1;
          if (this.opts.vsids) this.bump(v);
          if (this.levelOf[v]! >= level) pathC++;
          else learnt.push(q);
        }
      }
      while (!seen[varOf(this.trail[index]!)]) index--;
      p = this.trail[index--]!;
      c = this.reasonOf[varOf(p)]!;
      seen[varOf(p)] = 0;
      pathC--;
    } while (pathC > 0);
    learnt[0] = neg(p);
    // Minimisation: drop literals implied by the rest of the clause (one level of reasons).
    const keep = [learnt[0]!];
    for (let i = 1; i < learnt.length; i++) {
      const q = learnt[i]!;
      const r = this.reasonOf[varOf(q)];
      if (!r || !r.lits.every((x) => varOf(x) === varOf(q) || seen[varOf(x)] || this.levelOf[varOf(x)] === 0)) keep.push(q);
    }
    for (const q of learnt) seen[varOf(q)] = 0;
    // Backjump to the second-highest level in the clause; put that literal second (it becomes a watch).
    let backjump = 0;
    let maxI = 1;
    for (let i = 1; i < keep.length; i++) {
      const lv = this.levelOf[varOf(keep[i]!)]!;
      if (lv > backjump) {
        backjump = lv;
        maxI = i;
      }
    }
    if (keep.length > 1) [keep[1], keep[maxI]] = [keep[maxI]!, keep[1]!];
    return { learnt: keep, backjump };
  }

  private bumpClause(c: Clause): void {
    if ((c.activity += this.clauseInc) > 1e20) {
      for (const l of this.learnts) l.activity *= 1e-20;
      this.clauseInc *= 1e-20;
    }
  }

  private lbd(lits: number[]): number {
    const levels = new Set<number>();
    for (const l of lits) levels.add(this.levelOf[varOf(l)]!);
    return levels.size;
  }

  private logAdd(lits: number[]): void {
    this.proof.push({ kind: 'a', lits: lits.map(dimacs) });
  }
  private logDelete(lits: number[]): void {
    this.proof.push({ kind: 'd', lits: lits.map(dimacs) });
  }

  private reduceDb(): void {
    const candidates = this.learnts.filter((c) => !c.deleted && c.lbd > 2 && !this.isReason(c));
    candidates.sort((a, b) => b.lbd - a.lbd || a.activity - b.activity);
    for (const c of candidates.slice(0, Math.floor(candidates.length / 2))) {
      c.deleted = true;
      this.stats.deleted++;
      if (this.opts.proof) this.logDelete(c.lits);
    }
    this.learnts = this.learnts.filter((c) => !c.deleted);
    // Watch lists drop deleted clauses lazily during propagation.
  }

  private isReason(c: Clause): boolean {
    const v = varOf(c.lits[0]!);
    return this.reasonOf[v] === c && this.assign[v] !== 0;
  }

  private luby(i: number): number {
    let size = 1;
    let seq = 0;
    while (size < i + 1) {
      seq++;
      size = 2 * size + 1;
    }
    let x = i;
    while (size - 1 !== x) {
      size = (size - 1) >> 1;
      seq--;
      x = x % size;
    }
    return 2 ** seq;
  }

  /** Add a clause learned from the theory or from conflict analysis; returns it (or null for a unit). */
  private addLearnt(lits: number[], fromTheory: boolean): Clause | null {
    if (this.opts.proof) this.logAdd(lits);
    if (lits.length === 1) return null;
    const c: Clause = { lits, learnt: true, lbd: this.lbd(lits), activity: 0, deleted: false, id: -1 };
    if (!fromTheory || this.opts.learn) {
      this.learnts.push(c);
      this.attach(c);
    }
    return c;
  }

  /**
   * Handle a conflict clause (all literals false). Returns false when the formula is unsatisfiable.
   */
  private handleConflict(confl: Clause): boolean {
    this.stats.conflicts++;
    this.opts.onEvent?.({ type: 'conflict', clause: confl.lits.map(dimacs), level: this.trailLim.length });
    if (this.trailLim.length === 0) {
      if (this.opts.proof) this.logAdd([]);
      this.ok = false;
      return false;
    }
    // The conflict may be entirely below the current level (theory conflicts): jump down first.
    const top = Math.max(...confl.lits.map((l) => this.levelOf[varOf(l)]!));
    if (top < this.trailLim.length) this.backtrackTo(top);
    if (top === 0) {
      if (this.opts.proof) this.logAdd([]);
      this.ok = false;
      return false;
    }
    if (!this.opts.learn) {
      // Plain DPLL: undo the last decision and try the other value.
      const d = this.trail[this.trailLim[this.trailLim.length - 1]!]!;
      this.backtrackTo(this.trailLim.length - 1);
      this.opts.onEvent?.({ type: 'learn', clause: [dimacs(neg(d))], uip: dimacs(neg(d)), backjump: this.trailLim.length, lbd: 0 });
      // Record the flip as a decision-free implication at this level (DPLL semantics via a pseudo-reason).
      const flip: Clause = { lits: [neg(d), ...this.trailLim.map((i) => neg(this.trail[i]!))], learnt: true, lbd: 0, activity: 0, deleted: false, id: -1 };
      this.enqueue(neg(d), flip.lits.length > 1 ? flip : null);
      return true;
    }
    const { learnt, backjump } = this.analyze(confl);
    this.stats.learned++;
    this.opts.onEvent?.({ type: 'learn', clause: learnt.map(dimacs), uip: dimacs(learnt[0]!), backjump, lbd: this.lbd(learnt) });
    this.backtrackTo(backjump);
    const c = this.addLearnt(learnt, false);
    this.enqueue(learnt[0]!, c);
    this.varInc /= 0.95;
    this.clauseInc /= 0.999;
    return true;
  }

  /** Ask the theory about the newly assigned literals. Returns a conflict to handle, or null. */
  private theoryCheck(full: boolean): Clause | 'progress' | null {
    const th = this.opts.theory;
    if (!th) return null;
    const newLits = this.trail.slice(this.theoryTrail).map(dimacs);
    this.theoryTrail = this.trail.length;
    const r = th.check(newLits, full);
    for (const lemma of r.lemmas ?? []) {
      // Lemmas are new clauses implied by the theory; add them and re-propagate.
      const lits = lemma.map(lit);
      this.ensureVars(Math.max(...lemma.map(Math.abs)));
      if (this.opts.proof) this.proof.push({ kind: 't', lits: [...lemma] });
      const c: Clause = { lits, learnt: true, lbd: lits.length, activity: 0, deleted: false, id: -1 };
      // Order the watches: unassigned/true literals first.
      lits.sort((a, b) => (this.value(b) === -1 ? -1 : 0) - (this.value(a) === -1 ? -1 : 0));
      if (lits.length === 1) {
        if (this.value(lits[0]!) === -1) return c;
        if (this.value(lits[0]!) === 0) this.enqueue(lits[0]!, null);
        continue;
      }
      if (lits.every((l) => this.value(l) === -1)) return c;
      this.learnts.push(c);
      this.attach(c);
      if (this.value(lits[0]!) === 0 && lits.slice(1).every((l) => this.value(l) === -1)) this.enqueue(lits[0]!, c);
    }
    if (r.conflict) {
      const lits = r.conflict.map(lit);
      this.opts.onEvent?.({ type: 'theory-conflict', clause: r.conflict });
      if (this.opts.proof) this.proof.push({ kind: 't', lits: [...r.conflict] });
      return { lits, learnt: true, lbd: lits.length, activity: 0, deleted: false, id: -1 };
    }
    for (const imp of r.implied ?? []) {
      const l = lit(imp.lit);
      if (this.value(l) === 1) continue;
      const lits = [l, ...imp.reason.map(lit).filter((x) => x !== l)];
      if (this.opts.proof) this.proof.push({ kind: 't', lits: lits.map(dimacs) });
      const c: Clause = { lits, learnt: true, lbd: lits.length, activity: 0, deleted: false, id: -1 };
      if (this.value(l) === -1) return c;
      this.opts.onEvent?.({ type: 'theory-propagate', lit: imp.lit, reason: imp.reason });
      if (lits.length > 1) {
        this.learnts.push(c);
        this.attach(c);
      }
      this.enqueue(l, lits.length > 1 ? c : null);
    }
    return this.qhead < this.trail.length || (r.lemmas?.length ?? 0) > 0 ? 'progress' : null;
  }

  solve(o: SolveOptions = {}): SolveResult {
    this.failedAssumptions = [];
    this.model = [];
    if (!this.ok) return this.finish('unsat');
    this.backtrackTo(0);
    if (this.propagate()) {
      this.ok = false;
      if (this.opts.proof) this.logAdd([]);
      return this.finish('unsat');
    }
    const assumptions = (o.assumptions ?? []).map(lit);
    for (const a of o.assumptions ?? []) this.ensureVars(Math.abs(a));
    let restartN = 0;
    let conflictsUntilRestart = this.opts.restarts ? this.luby(restartN) * 100 : Infinity;
    let maxLearnts = Math.max(1000, this.clauses.length / 3);
    const startConflicts = this.stats.conflicts;
    for (;;) {
      let confl = this.propagate();
      if (!confl) {
        const t = this.theoryCheck(false);
        if (t === 'progress') continue;
        if (t) confl = t;
      }
      if (confl) {
        if (!this.handleConflict(confl)) return this.finish('unsat');
        if (o.conflictLimit !== undefined && this.stats.conflicts - startConflicts >= o.conflictLimit) {
          this.backtrackTo(0);
          return this.finish('unknown');
        }
        if ((this.stats.conflicts & 255) === 0 && o.shouldStop?.()) {
          this.backtrackTo(0);
          return this.finish('unknown');
        }
        if (--conflictsUntilRestart <= 0) {
          restartN++;
          conflictsUntilRestart = this.luby(restartN) * 100;
          this.stats.restarts++;
          this.opts.onEvent?.({ type: 'restart' });
          this.backtrackTo(0);
        }
        if (this.learnts.length - this.trail.length >= maxLearnts) {
          this.reduceDb();
          maxLearnts *= 1.1;
        }
        continue;
      }
      // Assumptions are the first decisions.
      let next = -1;
      while (this.trailLim.length < assumptions.length) {
        const a = assumptions[this.trailLim.length]!;
        if (this.value(a) === 1) {
          this.trailLim.push(this.trail.length);
          continue;
        }
        if (this.value(a) === -1) {
          this.analyzeFinal(neg(a));
          return this.finish('unsat');
        }
        next = a;
        break;
      }
      if (next < 0) {
        next = this.pickBranch();
        if (next < 0) {
          // Every variable assigned: the final theory check.
          const t = this.theoryCheck(true);
          if (t === 'progress') continue;
          if (t) {
            if (!this.handleConflict(t)) return this.finish('unsat');
            continue;
          }
          this.model = [false];
          for (let v = 1; v <= this.nvars; v++) this.model[v] = this.assign[v] === 1;
          return this.finish('sat');
        }
        this.stats.decisions++;
      }
      this.trailLim.push(this.trail.length);
      this.opts.onEvent?.({ type: 'decide', lit: dimacs(next), level: this.trailLim.length });
      this.enqueue(next, null);
    }
  }

  /** Which assumptions led to `p` being false. */
  private analyzeFinal(p: number): void {
    const out = new Set<number>([dimacs(neg(p))]);
    const seen = new Uint8Array(this.nvars + 1);
    seen[varOf(p)] = 1;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const x = this.trail[i]!;
      const v = varOf(x);
      if (!seen[v]) continue;
      const r = this.reasonOf[v];
      if (!r) {
        if (this.levelOf[v]! > 0) out.add(dimacs(x));
      } else for (const q of r.lits) if (this.levelOf[varOf(q)]! > 0) seen[varOf(q)] = 1;
    }
    this.failedAssumptions = [...out];
  }

  private finish(r: SolveResult): SolveResult {
    this.opts.onEvent?.({ type: r === 'sat' ? 'sat' : 'unsat' });
    return r;
  }

  /** A pseudo-random number in [0, 1) (seeded), for tie-breaking in tests. */
  random(): number {
    this.rngState = (Math.imul(this.rngState, 1664525) + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  }

  /** The current trail as DIMACS literals with their levels and reasons (for the stepper). */
  snapshot(): { lit: number; level: number; reason?: number[] }[] {
    return this.trail.map((l) => ({ lit: dimacs(l), level: this.levelOf[varOf(l)]!, reason: this.reasonOf[varOf(l)]?.lits.map(dimacs) }));
  }
}

/** Convenience: solve a CNF in one call. */
export function solveCnf(cnf: { nvars: number; clauses: number[][] }, opts: SolverOptions & SolveOptions = {}): { result: SolveResult; model: boolean[]; solver: Solver } {
  const s = new Solver(opts);
  s.ensureVars(cnf.nvars);
  for (const c of cnf.clauses) if (!s.addClause(c)) break;
  const result = s.solve(opts);
  return { result, model: s.model, solver: s };
}
