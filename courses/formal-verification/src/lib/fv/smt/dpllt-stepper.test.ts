import { describe, expect, it } from 'vitest';
import { DplltStepper, parseEufClauses } from './dpllt-stepper';
import { checkSat } from './solver';
import { and, eq, not, or } from '../logic/term';
import { rng } from '../util/random';

function run(lines: string[]) {
  const { clauses, atoms } = parseEufClauses(lines);
  const s = new DplltStepper(clauses, atoms);
  for (let i = 0; i < 1000 && !s.done; i++) s.next();
  return { s, atoms, clauses };
}

describe('DPLL(T) stepper', () => {
  it('refutes the classic example with a theory lemma', () => {
    const { s } = run(['g(a) = c', 'f(g(a)) != f(c) | g(a) = d', 'c != d']);
    expect(s.log.at(-1)!.kind).toBe('unsat');
    expect(s.log.some((m) => m.who === 'theory' && m.kind === 'conflict')).toBe(true);
  });
  it('finds models that respect congruence', () => {
    const { s } = run(['a = b | a = c', 'f(a) != f(b)']);
    expect(s.log.at(-1)!.kind).toBe('sat');
    const { euf } = s.egraph();
    expect(euf.find(s.atoms[0]!.a) === euf.find(s.atoms[0]!.b)).toBe(false);
  });
  it('agrees with the SMT solver on random formulas', () => {
    const r = rng(12);
    const names = ['a', 'b', 'c', 'f(a)', 'f(b)', 'f(c)', 'g(a, b)', 'g(b, a)', 'f(f(a))'];
    for (let t = 0; t < 60; t++) {
      const lines = Array.from({ length: r.int(2, 6) }, () => Array.from({ length: r.int(1, 3) }, () => `${r.pick(names)} ${r.chance(0.5) ? '=' : '!='} ${r.pick(names)}`).join(' | '));
      const { s, atoms, clauses } = run(lines);
      const term = and(...clauses.map((c) => or(...c.map((l) => { const a = atoms[Math.abs(l) - 1]!; const e = eq(a.a, a.b); return l > 0 ? e : not(e); }))));
      const smt = checkSat([term]);
      expect(s.log.at(-1)!.kind, lines.join(' ; ')).toBe(smt.status === 'sat' ? 'sat' : 'unsat');
    }
  });
});
