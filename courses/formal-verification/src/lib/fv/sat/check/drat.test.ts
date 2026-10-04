import { describe, expect, it } from 'vitest';
import { checkDrat } from './drat';

describe('DRAT checker', () => {
  it('accepts a resolution proof and rejects a bogus lemma', () => {
    const f = [[1, 2], [-1, 2], [1, -2], [-1, -2]];
    expect(checkDrat(f, [{ kind: 'a', lits: [2] }, { kind: 'a', lits: [] }]).ok).toBe(true);
    const bad = checkDrat([[1, 2], [-1, 2]], [{ kind: 'a', lits: [-2] }, { kind: 'a', lits: [] }]);
    expect(bad.ok).toBe(false);
    expect(bad.failedAt).toBe(0);
  });
  it('treats clauses as sets: a duplicated literal does not hide a unit clause', () => {
    // (x1 ∨ x2 ∨ x2) with ¬x1 assumed must propagate x2.
    const f = [[1, 2, 2], [-2, 3], [-3, -2]];
    expect(checkDrat(f, [{ kind: 'a', lits: [1] }]).failedAt).toBeUndefined();
    expect(checkDrat([...f, [-1]], [{ kind: 'a', lits: [] }]).ok).toBe(true);
  });
  it('requires the empty clause, and handles deletions', () => {
    expect(checkDrat([[1, 2]], [{ kind: 'a', lits: [1, 2] }]).ok).toBe(false);
    const f = [[1, 2], [-1, 2], [1, -2], [-1, -2]];
    const r = checkDrat(f, [{ kind: 'a', lits: [2] }, { kind: 'd', lits: [1, 2] }, { kind: 'd', lits: [-1, 2] }, { kind: 'a', lits: [] }]);
    expect(r.ok).toBe(true);
  });
});
