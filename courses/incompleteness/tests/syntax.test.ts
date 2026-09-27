import { describe, expect, it } from 'vitest';
import { parseFormula, parseTerm, tryParseFormula } from '../src/engine/syntax/parse.ts';
import { formulaText, formulaTex } from '../src/engine/syntax/print.ts';
import { expandDefined, formulaEq, freeVars, termEq } from '../src/engine/syntax/ops.ts';
import { substitute, freeFor } from '../src/engine/syntax/subst.ts';
import { varIndex, varName } from '../src/engine/syntax/language.ts';
import * as A from '../src/engine/syntax/ast.ts';
import { lit } from '../src/engine/numbers/nat.ts';

const P = (s: string) => parseFormula(s);

describe('parsing and printing', () => {
  const samples = ['∀x (x = 0 ∨ ∃y x = y′)', '¬⊥', '(x + y) = (y + x)', '∀x ∀y (x′ = y′ → x = y)', 'x < 3', 'P(x, f(y, 0))', '∃z ((z′ + x) = y)', '⊤ ↔ ¬⊥'];
  it.each(samples)('round-trips %s', (s) => {
    const f = P(s);
    expect(formulaEq(P(formulaText(f)), f)).toBe(true);
  });

  it('accepts ASCII notation', () => {
    expect(formulaEq(P("forall x (x = 0 | exists y x = y')"), P('∀x (x = 0 ∨ ∃y x = y′)'))).toBe(true);
    expect(formulaEq(P('A x ~x = x -> _|_'), P('∀x ¬x = x → ⊥'))).toBe(true);
  });

  it('gives quantifiers narrow scope and → right associativity', () => {
    const f = P('∀x P(x) ∧ Q(x)');
    expect(f.k).toBe('and');
    const g = P('A → B → C'.replace(/[ABC]/g, (c) => `${c === 'A' ? 'P' : c === 'B' ? 'Q' : 'R'}(x)`));
    expect(g.k === 'imp' && g.b.k === 'imp').toBe(true);
  });

  it('reports errors with positions', () => {
    const r = tryParseFormula('∀x (x = )');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.pos).toBeGreaterThan(5);
  });

  it('names variables v_i as x, y, z, u, w, x_0, …', () => {
    expect([0, 1, 4, 5, 6, 10].map(varName)).toEqual(['x', 'y', 'w', 'x_0', 'y_0', 'x_1']);
    for (let i = 0; i < 40; i++) expect(varIndex(varName(i))).toBe(i);
    expect(varIndex('v7')).toBe(7);
  });

  it('prints ¬ s = t as s ≠ t, as the book does', () => {
    expect(formulaTex(P('¬x = 0'))).toBe('x \\neq 0');
  });
});

describe('numerals', () => {
  it('treats n̄ as the term 0′′…′', () => {
    expect(termEq(parseTerm('3'), parseTerm("0'''"))).toBe(true);
    expect(termEq(parseTerm('3'), parseTerm("2'"))).toBe(true);
    expect(termEq(parseTerm('3'), parseTerm("0''"))).toBe(false);
    expect(termEq(A.numeral(lit(0)), A.zero())).toBe(true);
  });
});

describe('defined connectives (this book: ↔ and ⊤ are defined)', () => {
  it('expands A ↔ B to (A → B) ∧ (B → A)', () => {
    const f = expandDefined(P('P(x) ↔ Q(x)'));
    expect(formulaEq(f, P('(P(x) → Q(x)) ∧ (Q(x) → P(x))'))).toBe(true);
    expect(formulaEq(expandDefined(P('⊤')), P('¬⊥'))).toBe(true);
  });
});

describe('substitution', () => {
  const x = varIndex('x')!;
  const y = varIndex('y')!;

  it('replaces free occurrences only', () => {
    const f = P('x = 0 ∧ ∀x x = y');
    const r = substitute(f, x, parseTerm('3'));
    expect(formulaEq(r.result, P('3 = 0 ∧ ∀x x = y'))).toBe(true);
    expect(r.replaced).toBe(1);
    expect(r.steps.some((s) => s.kind === 'binder-stop')).toBe(true);
  });

  it('detects capture: y is not free for x in ∃y x = y′', () => {
    const f = P("∃y x = y'");
    expect(freeFor(parseTerm('y'), x, f).ok).toBe(false);
    const naive = substitute(f, x, parseTerm('y'), 'naive');
    expect(naive.freeFor).toBe(false);
    expect(naive.captures).toHaveLength(1);
    // The naive result changes the meaning: ∃y y = y′
    expect(formulaEq(naive.result, P("∃y y = y'"))).toBe(true);
  });

  it('avoids capture by renaming the bound variable', () => {
    const f = P("∃y x = y'");
    const r = substitute(f, x, parseTerm('y'), 'avoid');
    expect(r.renamed).toHaveLength(1);
    expect(r.captures).toHaveLength(0);
    const res = r.result;
    expect(res.k).toBe('exists');
    if (res.k === 'exists') {
      expect(res.v.index).not.toBe(y);
      expect(freeVars(res).has(y)).toBe(true);
    }
  });

  it('is a no-op when x does not occur free', () => {
    const f = P('∀x x = x');
    const r = substitute(f, x, parseTerm('5'));
    expect(r.result).toBe(f);
    expect(r.replaced).toBe(0);
  });

  it('keeps ids of unchanged subtrees and maps copies of t back to t', () => {
    const f = P('P(x) ∧ Q(z)');
    const t = parseTerm('y + 1');
    const r = substitute(f, x, t);
    if (r.result.k !== 'and' || f.k !== 'and') throw new Error();
    expect(r.result.b).toBe(f.b);
    const copy = r.result.a.k === 'pred' ? r.result.a.args[0] : null;
    expect(copy && r.origin.get(copy.id)).toEqual({ from: t.id, via: 'term' });
  });
});
