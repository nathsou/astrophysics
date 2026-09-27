import { describe, expect, it } from 'vitest';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { fixedPoint, PROV, validateB } from '../src/engine/fixedpoint/fixedpoint.ts';
import { formulaEq, freeVars } from '../src/engine/syntax/ops.ts';
import { magnitude, seqItems } from '../src/engine/numbers/nat.ts';
import { check } from '../src/engine/proof/nd.ts';
import { Q } from '../src/engine/proof/q.ts';

describe('the fixed-point lemma', () => {
  const cases = ['∃z (z + z) = x', '¬Prov(x)', 'x = 0'];
  it.each(cases)('B(x) = %s', (b) => {
    const B = parseFormula(b, { abbreviations: [PROV] });
    const c = fixedPoint(B);
    // A is a sentence
    expect(freeVars(c.fixed).size).toBe(0);
    // diag(#E#) = #A#, computed independently by decoding #E#
    expect(c.diagCheck.error).toBeUndefined();
    expect(c.diagCheck.agrees).toBe('equal');
    // the numbers involved are never expanded
    expect(seqItems(c.encA.number)).toBeNull();
    // its size is unknown (D_diag is known by name), but bounded below: its digit count has many digits
    expect(magnitude(c.encA.number)).toBeNull();
    const lower = magnitude(c.encA.number, { lowerBound: true });
    expect(lower && 'LL' in lower).toBe(true);
    // Q, with the two representability hypotheses, derives A ↔ B(⌜A⌝)
    expect(c.checked.errors).toEqual([]);
    expect(c.checked.hypotheses.sort()).toEqual(['repdiag1', 'repdiag2']);
    expect(c.checked.axioms).toEqual([]);
    const concl = c.derivation.concl;
    expect(concl.k).toBe('and');
    if (concl.k === 'and' && concl.a.k === 'imp') {
      expect(formulaEq(concl.a.a, c.fixed)).toBe(true);
      expect(formulaEq(concl.a.b, c.BofA)).toBe(true);
    }
  });

  it('requires exactly one free variable x', () => {
    expect(validateB(parseFormula('x = y'))).toMatch(/exactly one/);
    expect(validateB(parseFormula('0 = 0'))).toMatch(/exactly one/);
  });

  it('detects a tampered derivation', () => {
    const c = fixedPoint(parseFormula('x = 0'));
    // swap the final ∧Intro's premises: the conclusion no longer matches
    const bad = { ...c.derivation, premises: [...c.derivation.premises].reverse() };
    expect(check(bad, { axioms: Q() }).valid).toBe(false);
  });
});
