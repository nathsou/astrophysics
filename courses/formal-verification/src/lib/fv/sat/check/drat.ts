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

export function checkDrat(input: number[][], proof: readonly ProofLine[], theory?: (clause: number[]) => boolean): DratResult {
  // The clause database, as a multiset keyed by sorted literals.
  const db = new Map<string, { clause: number[]; count: number }>();
  const add = (c: number[]) => {
    const k = key(c);
    const e = db.get(k);
    if (e) e.count++;
    else db.set(k, { clause: [...c], count: 1 });
  };
  for (const c of input) {
    if (c.length === 0) return { ok: true, checked: 0 };
    add(c);
  }
  let checked = 0;
  for (let i = 0; i < proof.length; i++) {
    const line = proof[i]!;
    if (line.kind === 'd') {
      const e = db.get(key(line.lits));
      if (e && --e.count === 0) db.delete(key(line.lits));
      continue;
    }
    if (line.kind === 't') {
      if (!theory || !theory(line.lits)) return { ok: false, failedAt: i, message: `Theory lemma ${line.lits.join(' ')} was not justified by a theory certificate.`, checked };
    } else if (!rup(db, line.lits) && !rat(db, line.lits)) {
      return { ok: false, failedAt: i, message: `Clause ${line.lits.join(' ') || '(empty)'} does not follow by unit propagation (RUP) or RAT.`, checked };
    }
    checked++;
    if (line.lits.length === 0) return { ok: true, checked };
    add(line.lits);
  }
  return { ok: false, message: 'The proof never derives the empty clause.', checked };
}

/** Unit propagation from `assigned` over the database. Returns true when a clause becomes false (a conflict). */
function propagatesToConflict(db: Map<string, { clause: number[] }>, assigned: Set<number>): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const { clause } of db.values()) {
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
        }
      }
      if (satisfied) continue;
      if (unassigned === 0) return true;
      if (unassigned === 1) {
        assigned.add(last);
        changed = true;
      }
    }
  }
  return false;
}

function rup(db: Map<string, { clause: number[] }>, c: number[]): boolean {
  const assigned = new Set<number>(c.map((l) => -l));
  return propagatesToConflict(db, assigned);
}

/** Resolution asymmetric tautology on the first literal (the pivot). */
function rat(db: Map<string, { clause: number[] }>, c: number[]): boolean {
  const p = c[0];
  if (p === undefined) return false;
  for (const { clause } of db.values()) {
    if (!clause.includes(-p)) continue;
    const resolvent = [...c, ...clause.filter((l) => l !== -p)];
    if (resolvent.some((l) => resolvent.includes(-l))) continue; // a tautology is fine
    if (!rup(db, resolvent)) return false;
  }
  return true;
}
