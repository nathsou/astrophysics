/**
 * Resolution proofs, for chapter 8. Not trusted: these are teaching views. The trusted check of a SAT solver's
 * UNSAT answer is the DRAT checker in ./check/drat.ts.
 *
 * - `resolve` and `checkStep`: the resolution rule, and a checker for a single step of a hand-written refutation.
 * - `refutation`: a resolution refutation (a DAG ending in the empty clause), extracted from a run of the CDCL
 *   stepper: each learned clause is the end of a chain of resolutions, and the final conflict at level 0 is resolved
 *   down to the empty clause.
 * - `explainRup`: the unit propagation that justifies one clause of a DRAT proof (or shows that it fails).
 * - `LyingStepper`: a CDCL stepper with a bug in conflict analysis, whose "proofs" the DRAT checker rejects.
 */
import { Stepper, type Analysis } from './stepper';
import type { ProofLine } from './solver';

const norm = (c: readonly number[]) => [...new Set(c)].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
export const sameClause = (a: readonly number[], b: readonly number[]) => {
  const x = norm(a);
  const y = norm(b);
  return x.length === y.length && x.every((l, i) => l === y[i]);
};

/** The variables on which two clauses clash (one has v, the other ¬v). */
export function clashes(a: readonly number[], b: readonly number[]): number[] {
  return [...new Set(a.filter((l) => b.includes(-l)).map(Math.abs))];
}

/** The resolvent of a and b on variable `pivot` (a contains one sign of it, b the other). */
export function resolve(a: readonly number[], b: readonly number[], pivot: number): number[] {
  return norm([...a.filter((l) => Math.abs(l) !== pivot), ...b.filter((l) => Math.abs(l) !== pivot)]);
}

export interface Step {
  /** Indices of the two premises (input clauses first, then the steps, in order). */
  left: number;
  right: number;
  pivot: number;
  clause: number[];
}

/** Check one step of a refutation given the clauses before it. Returns undefined if correct, else why not. */
export function checkStep(clauses: readonly (readonly number[])[], step: Step): string | undefined {
  const a = clauses[step.left];
  const b = clauses[step.right];
  if (!a || !b) return 'A premise does not exist yet.';
  const aPos = a.includes(step.pivot) && b.includes(-step.pivot);
  const aNeg = a.includes(-step.pivot) && b.includes(step.pivot);
  if (!aPos && !aNeg) return `The premises do not clash on the variable resolved on.`;
  const want = resolve(a, b, step.pivot);
  if (!sameClause(want, step.clause)) return `The resolvent of these premises is ${want.length ? want.join(' ∨ ') : 'the empty clause'}, not the clause written.`;
  return undefined;
}

export interface Refutation {
  /** All clauses: the input first, then derived ones in order. */
  clauses: number[][];
  inputCount: number;
  /** For each derived clause (index ≥ inputCount), its premises and pivot. */
  steps: Map<number, { left: number; right: number; pivot: number }>;
  /** Index of the empty clause. */
  empty: number;
  /** Indices of the clauses the empty clause depends on (the proof proper). */
  used: Set<number>;
}

/**
 * Run the stepper to UNSAT (deciding the lowest variable false, as the chapter-7 stepper does) and return the
 * resolution refutation it implicitly built. Returns undefined if the formula is satisfiable.
 */
export function refutation(input: number[][], nvars: number): Refutation | undefined {
  const s = new Stepper(input, nvars);
  const clauses: number[][] = input.map((c) => [...c]);
  const steps = new Map<number, { left: number; right: number; pivot: number }>();
  // Stepper clause index → refutation node.
  const node: number[] = input.map((_, i) => i);

  /** Replay a chain of resolutions starting from a clause node; returns the node of the final resolvent. */
  const chain = (start: number, links: { pivot: number; with: number; result: number[] }[]): number => {
    let cur = start;
    for (const r of links) {
      const other = node[r.with]!;
      clauses.push(norm(r.result));
      const id = clauses.length - 1;
      steps.set(id, { left: cur, right: other, pivot: r.pivot });
      cur = id;
    }
    return cur;
  };

  for (let guard = 0; guard < 100000; guard++) {
    if (s.status === 'sat') return undefined;
    if (s.status === 'unsat') break;
    if (s.status === 'conflict') {
      const a = s.analysis as Analysis;
      const end = chain(node[s.conflict]!, a.resolutions);
      // The learned clause is the last resolvent (or the conflict clause itself if no resolution was needed).
      s.learnAndBackjump();
      node[s.clauses.length - 1] = end;
      continue;
    }
    s.step();
  }
  if (s.status !== 'unsat') return undefined;

  // The final conflict at level 0: resolve the false clause with the reasons of its literals, latest first.
  const conflictIdx = s.log.findLast((e) => e.kind === 'conflict');
  if (!conflictIdx || conflictIdx.kind !== 'conflict') return undefined;
  let clause = [...s.clauses[conflictIdx.clause]!];
  const links: { pivot: number; with: number; result: number[] }[] = [];
  const pos = (l: number) => s.trail.findIndex((t) => Math.abs(t.lit) === Math.abs(l));
  while (clause.length) {
    const latest = [...clause].sort((x, y) => pos(y) - pos(x))[0]!;
    const a = s.assigned(Math.abs(latest))!;
    const reason = s.clauses[a.reason]!;
    clause = [...new Set([...clause.filter((l) => l !== latest), ...reason.filter((l) => l !== -latest)])];
    links.push({ pivot: Math.abs(latest), with: a.reason, result: [...clause] });
  }
  const empty = chain(node[conflictIdx.clause]!, links);

  const used = new Set<number>();
  const todo = [empty];
  while (todo.length) {
    const i = todo.pop()!;
    if (used.has(i)) continue;
    used.add(i);
    const st = steps.get(i);
    if (st) todo.push(st.left, st.right);
  }
  return { clauses, inputCount: input.length, steps, empty, used };
}

export interface RupExplanation {
  ok: boolean;
  /** The literals assumed (the negation of the clause). */
  assumed: number[];
  /** Literals forced by unit propagation, with the index of the clause that forced each. */
  forced: { lit: number; clause: number }[];
  /** The clause found false, if any. */
  conflict?: number;
}

/**
 * Explain a RUP check: assume the negation of `lemma`, unit-propagate over `db`, and report the propagation and the
 * clause that became false (or that propagation stopped without a conflict).
 */
export function explainRup(db: readonly (readonly number[])[], lemma: readonly number[]): RupExplanation {
  const assumed = lemma.map((l) => -l);
  const val = new Map<number, boolean>();
  const set = (l: number) => val.set(Math.abs(l), l > 0);
  const value = (l: number) => {
    const v = val.get(Math.abs(l));
    return v === undefined ? undefined : v === l > 0;
  };
  for (const l of assumed) {
    if (value(l) === false) return { ok: true, assumed, forced: [] }; // the lemma is a tautology
    set(l);
  }
  const forced: { lit: number; clause: number }[] = [];
  for (;;) {
    let progress = false;
    for (let i = 0; i < db.length; i++) {
      let open = 0;
      let last = 0;
      let sat = false;
      for (const l of db[i]!) {
        const v = value(l);
        if (v === true) {
          sat = true;
          break;
        }
        if (v === undefined) {
          open++;
          last = l;
        }
      }
      if (sat) continue;
      if (open === 0) return { ok: true, assumed, forced, conflict: i };
      if (open === 1) {
        set(last);
        forced.push({ lit: last, clause: i });
        progress = true;
      }
    }
    if (!progress) return { ok: false, assumed, forced };
  }
}

/**
 * A CDCL stepper with a bug: when a learned clause has literals from earlier levels, it drops the one from the
 * lowest level ("an optimisation that looked harmless"). The learned clause is then stronger than what the formula
 * implies, and the solver can report UNSAT on a satisfiable formula. Its proof is the list of clauses it learned.
 */
export class LyingStepper extends Stepper {
  override analyse(conflict: number): Analysis {
    const a = super.analyse(conflict);
    if (a.learned.length < 3) return a;
    const levelOf = (l: number) => this.assigned(Math.abs(l))!.level;
    const others = a.learned.slice(1);
    const lowest = others.reduce((m, l) => (levelOf(l) < levelOf(m) ? l : m));
    const learned = a.learned.filter((l) => l !== lowest);
    const rest = learned.slice(1).map(levelOf);
    return { ...a, learned, backjump: rest.length ? Math.max(...rest) : 0 };
  }
}

/** Run a stepper to the end and return its answer and its proof: every learned clause, then the empty clause. */
export function runWithProof(s: Stepper, maxSteps = 200000): { result: 'sat' | 'unsat' | 'unknown'; proof: ProofLine[] } {
  const proof: ProofLine[] = [];
  for (let i = 0; i < maxSteps && (s.status === 'running' || s.status === 'conflict'); i++) {
    if (s.status === 'conflict') {
      s.learnAndBackjump();
      proof.push({ kind: 'a', lits: [...s.clauses[s.clauses.length - 1]!] });
    } else s.step();
  }
  if (s.status === 'unsat') proof.push({ kind: 'a', lits: [] });
  return { result: s.status === 'sat' ? 'sat' : s.status === 'unsat' ? 'unsat' : 'unknown', proof };
}
