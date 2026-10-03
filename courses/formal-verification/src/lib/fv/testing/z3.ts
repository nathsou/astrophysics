/**
 * Z3 as a differential-testing oracle (tests only; never shipped to the browser). The course's solvers must agree
 * with Z3 on satisfiability for every query the tests generate.
 */
import type { Cnf } from '../sat/cnf';

type Z3Context = { Solver: new () => { fromString(s: string): void; check(): Promise<'sat' | 'unsat' | 'unknown'>; release?: () => void } };
let ctxPromise: Promise<Z3Context> | undefined;

export async function z3(): Promise<Z3Context> {
  ctxPromise ??= (async () => {
    const { init } = await import('z3-solver');
    const { Context } = await init();
    return new (Context as unknown as new (name: string) => Z3Context)('main');
  })();
  return ctxPromise;
}

/** Satisfiability of an SMT-LIB 2 script (declarations and assertions; no check-sat needed). */
export async function z3Check(smtlib: string): Promise<'sat' | 'unsat' | 'unknown'> {
  const ctx = await z3();
  const s = new ctx.Solver();
  s.fromString(smtlib);
  return s.check();
}

export function cnfToSmtlib(cnf: Cnf): string {
  const decls = Array.from({ length: cnf.nvars }, (_, i) => `(declare-const b${i + 1} Bool)`).join('\n');
  const lit = (l: number) => (l > 0 ? `b${l}` : `(not b${-l})`);
  const asserts = cnf.clauses.map((c) => (c.length === 0 ? '(assert false)' : `(assert (or ${c.map(lit).join(' ')} false))`)).join('\n');
  return `${decls}\n${asserts}\n`;
}
