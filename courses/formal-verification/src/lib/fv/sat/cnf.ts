/**
 * CNF formulas in the DIMACS convention: variables are 1, 2, 3, …; a literal is +v or −v; a clause is a list of
 * literals (their disjunction); a formula is a list of clauses (their conjunction).
 */

export interface Cnf {
  nvars: number;
  clauses: number[][];
}

export function parseDimacs(text: string): Cnf {
  let nvars = 0;
  const clauses: number[][] = [];
  let cur: number[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('c') || line.startsWith('%')) continue;
    if (line.startsWith('p')) {
      const parts = line.split(/\s+/);
      nvars = Number(parts[2]);
      continue;
    }
    for (const tok of line.split(/\s+/)) {
      const n = Number(tok);
      if (!Number.isInteger(n)) throw new Error(`DIMACS: not a literal: ${tok}`);
      if (n === 0) {
        clauses.push(cur);
        cur = [];
      } else {
        cur.push(n);
        nvars = Math.max(nvars, Math.abs(n));
      }
    }
  }
  if (cur.length) clauses.push(cur);
  return { nvars, clauses };
}

export function printDimacs(cnf: Cnf): string {
  return `p cnf ${cnf.nvars} ${cnf.clauses.length}\n${cnf.clauses.map((c) => `${c.join(' ')} 0`).join('\n')}\n`;
}

/** Does an assignment (index v → value of variable v) satisfy every clause? This is how SAT answers are checked. */
export function satisfies(cnf: Cnf, model: readonly boolean[]): boolean {
  return cnf.clauses.every((c) => c.some((l) => (l > 0 ? model[l] === true : model[-l] === false)));
}

/** The first clause an assignment falsifies, if any. */
export function falsified(cnf: Cnf, model: readonly boolean[]): number[] | undefined {
  return cnf.clauses.find((c) => !c.some((l) => (l > 0 ? model[l] === true : model[-l] === false)));
}
