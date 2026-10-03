/**
 * TRUSTED. The DRAT proof checker: the only part of the SAT pipeline that must be correct for an UNSAT answer to
 * be believed. It is deliberately small and plain (no watched literals, no clever data structures).
 *
 * A proof is a list of lines. "a C" adds clause C, which must be RUP (reverse unit propagation: assuming every
 * literal of C false and unit-propagating over the clauses so far reaches a conflict) or, failing that, RAT on its
 * first literal. "d C" deletes C. "t C" adds a theory lemma, which a theory checker must accept (SMT). The proof
 * proves the input unsatisfiable when the empty clause is added.
 */
import type { ProofLine } from '../solver';

export interface DratResult {
  ok: boolean;
  /** Index of the first proof line that failed, and why. */
  failedAt?: number;
  message?: string;
  /** Number of clauses checked. */
  checked: number;
}

const key = (c: readonly number[]) => [...c].sort((a, b) => a - b).join(' ');

/** The clause database: a multiset of clauses keyed by their sorted literals, with occurrence lists. */
class Db {
  private byKey = new Map<string, { clause: number[]; count: number }>();
  /** literal → clauses containing it (clauses are shared arrays; deleted ones are skipped). */
  private occ = new Map<number, Set<number[]>>();
  units: number[][] = [];

  add(c: number[]): void {
    const k = key(c);
    const e = this.byKey.get(k);
    if (e) {
      e.count++;
      return;
    }
    const clause = [...c];
    this.byKey.set(k, { clause, count: 1 });
    for (const l of clause) {
      let s = this.occ.get(l);
      if (!s) this.occ.set(l, (s = new Set()));
      s.add(clause);
    }
    if (clause.length === 1) this.units.push(clause);
  }

  delete(c: number[]): void {
    const k = key(c);
    const e = this.byKey.get(k);
    if (!e || --e.count > 0) return;
    this.byKey.delete(k);
    for (const l of e.clause) this.occ.get(l)?.delete(e.clause);
    if (e.clause.length === 1) this.units = this.units.filter((u) => u !== e.clause);
  }

  clausesWith(l: number): Iterable<number[]> {
    return this.occ.get(l) ?? [];
  }
}

export function checkDrat(input: number[][], proof: readonly ProofLine[], theory?: (clause: number[]) => boolean): DratResult {
  const db = new Db();
  for (const c of input) {
    if (c.length === 0) return { ok: true, checked: 0 };
    db.add(c);
  }
  let checked = 0;
  for (let i = 0; i < proof.length; i++) {
    const line = proof[i]!;
    if (line.kind === 'd') {
      db.delete(line.lits);
      continue;
    }
    if (line.kind === 't') {
      if (!theory || !theory(line.lits)) return { ok: false, failedAt: i, message: `Theory lemma ${line.lits.join(' ')} was not justified by a theory certificate.`, checked };
    } else if (!rup(db, line.lits) && !rat(db, line.lits)) {
      return { ok: false, failedAt: i, message: `Clause ${line.lits.join(' ') || '(empty)'} does not follow by unit propagation (RUP) or RAT.`, checked };
    }
    checked++;
    if (line.lits.length === 0) return { ok: true, checked };
    db.add(line.lits);
  }
  return { ok: false, message: 'The proof never derives the empty clause.', checked };
}

/**
 * Unit propagation from `assigned` (a set of true literals) over the database. Returns true when some clause has
 * every literal false (a conflict). Each newly true literal l only affects the clauses containing ¬l.
 */
function propagatesToConflict(db: Db, assigned: Set<number>): boolean {
  const queue = [...assigned];
  for (const u of db.units) {
    const l = u[0]!;
    if (assigned.has(-l)) return true;
    if (!assigned.has(l)) {
      assigned.add(l);
      queue.push(l);
    }
  }
  while (queue.length) {
    const t = queue.pop()!;
    for (const clause of db.clausesWith(-t)) {
      let unassigned = 0;
      let last = 0;
      let satisfied = false;
      for (const l of clause) {
        if (assigned.has(l)) {
          satisfied = true;
          break;
        }
        if (!assigned.has(-l)) {
          unassigned++;
          last = l;
          if (unassigned > 1) break;
        }
      }
      if (satisfied || unassigned > 1) continue;
      if (unassigned === 0) return true;
      assigned.add(last);
      queue.push(last);
    }
  }
  return false;
}

function rup(db: Db, c: number[]): boolean {
  for (const l of c) if (c.includes(-l)) return true;
  const assigned = new Set<number>(c.map((l) => -l));
  return propagatesToConflict(db, assigned);
}

/** Resolution asymmetric tautology on the first literal (the pivot). */
function rat(db: Db, c: number[]): boolean {
  const p = c[0];
  if (p === undefined) return false;
  for (const clause of [...db.clausesWith(-p)]) {
    const resolvent = [...c, ...clause.filter((l) => l !== -p)];
    if (resolvent.some((l) => resolvent.includes(-l))) continue; // a tautology is fine
    if (!rup(db, resolvent)) return false;
  }
  return true;
}
