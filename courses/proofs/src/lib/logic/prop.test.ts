import { describe, expect, test } from 'vitest';
import { parseFormula, show, isTautology, equivalent, entails, toNand, dnfFromTable, evaluate, variables, formulaTex } from './prop';

describe('propositional logic', () => {
  test('parse and print', () => {
    expect(show(parseFormula('p -> q -> r'))).toBe('p → q → r');
    expect(show(parseFormula('(p -> q) -> r'))).toBe('(p → q) → r');
    expect(show(parseFormula('~p & q | r'))).toBe('¬p ∧ q ∨ r');
    expect(show(parseFormula('¬(p ∧ q) ↔ ¬p ∨ ¬q'))).toBe('¬(p ∧ q) ↔ ¬p ∨ ¬q');
    expect(formulaTex(parseFormula('p1 -> q'))).toBe('p_{1} \\to q');
  });
  test('tautologies', () => {
    expect(isTautology(parseFormula('p | ~p')).ok).toBe(true);
    expect(isTautology(parseFormula('((p -> q) -> p) -> p')).ok).toBe(true); // Peirce's law
    expect(isTautology(parseFormula('(p -> q) -> (q -> p)')).ok).toBe(false);
  });
  test('equivalence and entailment', () => {
    expect(equivalent(parseFormula('p -> q'), parseFormula('~q -> ~p')).ok).toBe(true);
    expect(equivalent(parseFormula('p -> q'), parseFormula('q -> p')).ok).toBe(false);
    expect(entails([parseFormula('p -> q'), parseFormula('p')], parseFormula('q')).ok).toBe(true);
    expect(entails([parseFormula('p -> q'), parseFormula('q')], parseFormula('p')).ok).toBe(false);
  });
  test('NAND is functionally complete', () => {
    for (const src of ['p & q', 'p | q', 'p -> q', 'p <-> q', 'p xor q', '~p', 'p nor q']) {
      const f = parseFormula(src);
      expect(equivalent(f, toNand(f)).ok).toBe(true);
    }
  });
  test('DNF from a truth table', () => {
    const f = parseFormula('p xor q xor r');
    const vars = variables(f);
    const dnf = dnfFromTable(vars, (env) => evaluate(f, env));
    expect(equivalent(f, dnf).ok).toBe(true);
  });
});
