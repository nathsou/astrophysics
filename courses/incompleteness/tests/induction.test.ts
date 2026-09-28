import { describe, expect, it } from 'vitest';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { inductionInstance, recognizeInduction } from '../src/engine/syntax/induction.ts';
import { formulaText } from '../src/engine/syntax/print.ts';

describe('induction schema', () => {
  it('builds and recognises instances', () => {
    for (const src of ['x + 0 = x', '0 + x = x', 'x + y = y + x', '∃z (x = z + z ∨ x = z + z′)', '0 = 0']) {
      const A = parseFormula(src);
      const I = inductionInstance(A, 0);
      const r = recognizeInduction(I);
      expect(r.instance, `${src}: ${formulaText(I)}`).toBe(true);
    }
  });
  it('rejects near misses', () => {
    const bad = [
      '(0 = 0 ∧ ∀x (x + 0 = x → x′ + 0 = x′)) → ∀x x + 0 = x', // antecedent A(0) is wrong
      '(0 + 0 = 0 ∧ ∀x (x + 0 = x → x′ + 0 = x)) → ∀x x + 0 = x',
      '((0 + y = y ∧ ∀x (x + y = y → x′ + y = y)) → ∀x x + y = y)', // y not bound
      '∀x x = x',
    ];
    for (const src of bad) expect(recognizeInduction(parseFormula(src)).instance, src).toBe(false);
    expect(recognizeInduction(parseFormula('(0 + 0 = 0 ∧ ∀x (x + 0 = x → x′ + 0 = x′)) → ∀x x + 0 = x')).instance).toBe(true);
  });
});
