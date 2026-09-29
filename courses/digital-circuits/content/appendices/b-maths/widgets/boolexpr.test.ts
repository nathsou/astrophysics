import { describe, expect, test } from 'vitest';
import { ParseError, equivalent, evaluate, parse, truthTable, variables } from './boolexpr';
import { ALL_LAWS, equations, holds } from './laws';

const val = (src: string, env: Record<string, boolean>) => evaluate(parse(src), env);

describe('parser', () => {
  test('precedence: NOT, AND, XOR, OR', () => {
    // A + B · C is A + (B · C)
    expect(val('A + B · C', { A: true, B: false, C: false })).toBe(true);
    expect(val('(A + B) · C', { A: true, B: false, C: false })).toBe(false);
    // XOR binds tighter than OR, looser than AND: A ⊕ B · C = A ⊕ (B · C)
    expect(val('A ⊕ B · C', { A: true, B: true, C: true })).toBe(false);
    expect(val('A + B ⊕ C', { A: true, B: true, C: true })).toBe(true); // A + (B ⊕ C)
    expect(val('¬A · B', { A: false, B: true })).toBe(true); // (¬A) · B
    expect(val('¬(A · B)', { A: true, B: true })).toBe(false);
  });
  test('alternative spellings', () => {
    expect(equivalent("A' B + A B'", 'A ^ B').equal).toBe(true);
    expect(equivalent('!A & B | C', '¬A · B + C').equal).toBe(true);
    expect(equivalent('AB + C', 'A · B + C').equal).toBe(true);
    expect(equivalent("A''", 'A').equal).toBe(true);
    expect(equivalent('¬¬A', 'A').equal).toBe(true);
  });
  test('constants and variables', () => {
    expect(variables(parse('C + A · ¬B + A'))).toEqual(['A', 'B', 'C']);
    expect(val('1', {})).toBe(true);
    expect(val('0 + 0', {})).toBe(false);
  });
  test('errors', () => {
    expect(() => parse('')).toThrow(ParseError);
    expect(() => parse('A +')).toThrow(/ends too soon/);
    expect(() => parse('(A + B')).toThrow(/bracket/);
    expect(() => parse('A + B)')).toThrow(ParseError);
    expect(() => parse('a + b')).toThrow(/Unexpected/);
    expect(() => parse('A + + B')).toThrow(ParseError);
  });
});

describe('equivalence', () => {
  test('finds a counterexample', () => {
    const r = equivalent('A + B · C', '(A + B) · C');
    expect(r.equal).toBe(false);
    expect(r.counterexample).toBeDefined();
    const { env, left, right } = r.counterexample!;
    expect(evaluate(parse('A + B · C'), env)).toBe(left);
    expect(evaluate(parse('(A + B) · C'), env)).toBe(right);
    expect(left).not.toBe(right);
  });
  test('variables that appear on one side only are still compared', () => {
    expect(equivalent('A', 'A + A · B').equal).toBe(true);
    expect(equivalent('A', 'B').equal).toBe(false);
  });
  test('truth table order and size', () => {
    const t = truthTable('A · B');
    expect(t.vars).toEqual(['A', 'B']);
    expect(t.rows.map((r) => Number(r.value))).toEqual([0, 0, 0, 1]);
    expect(truthTable('A ⊕ B ⊕ C').rows.filter((r) => r.value).length).toBe(4);
  });
});

describe('the laws table', () => {
  test('every equation holds', () => {
    for (const eq of equations()) expect(holds(eq), `${eq.name}: ${eq.lhs} = ${eq.rhs}`).toBe(true);
  });
  test('the table is sizeable and names are present', () => {
    expect(ALL_LAWS.length).toBeGreaterThan(20);
    expect(equations().length).toBeGreaterThan(30);
    for (const l of ALL_LAWS) expect(l.name).toBeTruthy();
  });
  test('a plausible-looking wrong law is caught', () => {
    expect(holds({ lhs: '¬(A · B)', rhs: '¬A · ¬B' })).toBe(false);
    expect(holds({ lhs: 'A + B · C', rhs: '(A + B) · C' })).toBe(false);
  });
});
