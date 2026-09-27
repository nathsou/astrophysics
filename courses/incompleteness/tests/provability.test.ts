import { describe, expect, it } from 'vitest';
import { atom, bot, checkProof, imp, lob, not, prov, secondIncompleteness, tarski, tautology } from '../src/engine/provability/pl.ts';

describe('provability reasoning (sections 5.6–5.9)', () => {
  it('checks tautologies by truth tables, treating Prov(⌜…⌝) as atoms', () => {
    const A = atom('A');
    expect(tautology(imp(A, A)).ok).toBe(true);
    expect(tautology(imp(prov(A), A)).ok).toBe(false);
    expect(tautology(imp(prov(imp(A, A)), prov(imp(A, A)))).ok).toBe(true);
  });

  it.each([
    ['second incompleteness', secondIncompleteness()],
    ['Löb', lob()],
    ['Tarski', tarski()],
  ])('the book’s proof of %s checks', (_n, lines) => {
    const c = checkProof(lines);
    for (const l of lines) expect(c.get(l.n)!.errors, `line ${l.n}`).toEqual([]);
  });

  it('second incompleteness needs P3 (and P1, P2)', () => {
    const lines = secondIncompleteness();
    for (const cond of ['P1', 'P2', 'P3'] as const) {
      const c = checkProof(lines, { conditions: { [cond]: false } });
      expect(c.get(12)!.ok, cond).toBe(false);
    }
    expect([...checkProof(lines).get(12)!.uses].sort()).toEqual(['P1', 'P2', 'P3', 'fixed point: G is a Gödel sentence']);
  });

  it('rejects a wrong use of logic, with a counterexample', () => {
    const G = atom('G');
    const c = checkProof([
      { n: 1, f: imp(G, not(prov(G))), just: { r: 'hyp', name: 'h' } },
      { n: 2, f: G, just: { r: 'logic', from: [1] } },
    ]);
    expect(c.get(2)!.ok).toBe(false);
    expect(c.get(2)!.errors[0]).toMatch(/counterexample/);
  });

  it('rejects fake instances of P2, P3 and P1', () => {
    const A = atom('A');
    const c = checkProof([
      { n: 1, f: imp(prov(A), A), just: { r: 'P3' } },
      { n: 2, f: imp(prov(imp(A, bot)), prov(bot)), just: { r: 'P2' } },
      { n: 3, f: A, just: { r: 'hyp', name: 'h' } },
      { n: 4, f: prov(bot), just: { r: 'P1', from: 3 } },
    ]);
    expect(c.get(1)!.ok).toBe(false);
    expect(c.get(2)!.ok).toBe(false);
    expect(c.get(4)!.ok).toBe(false);
  });
});
