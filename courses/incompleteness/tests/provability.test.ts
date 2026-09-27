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

import { parsePF, show, eq, p2Instance, truthTable } from '../src/engine/provability/pl.ts';

describe('parsing provability formulas', () => {
  it('round-trips the book’s lines', () => {
    for (const l of [...secondIncompleteness(), ...lob(), ...tarski()]) {
      expect(eq(parsePF(show(l.f)), l.f), show(l.f)).toBe(true);
    }
  });
  it('reads ASCII, Con, and unquoted arguments', () => {
    expect(show(parsePF('Con -> ~Prov(G)'))).toBe('¬Prov(⌜⊥⌝) → ¬Prov(⌜G⌝)');
    expect(show(parsePF('A /\\ B \\/ C <-> D'))).toBe('((A ∧ B) ∨ C) ↔ D');
    expect(() => parsePF('A ->')).toThrow();
    expect(() => parsePF('Prov(⌜A)')).toThrow(/⌝/);
  });
  it('finds instances and truth tables', () => {
    expect(show(p2Instance(parsePF('Prov(A -> B) -> (Prov(A) -> Prov(B))'))!.B)).toBe('B');
    expect(truthTable(parsePF('A -> A'))!.rows).toHaveLength(2);
  });
});

describe('Löb’s theorem as a rule', () => {
  it('gives the second incompleteness theorem and the Henkin sentence', () => {
    const lines = [
      { n: 1, f: parsePF('Con'), just: { r: 'hyp' as const, name: 'suppose T ⊢ Con' } },
      { n: 2, f: parsePF('Prov(⊥) -> ⊥'), just: { r: 'logic' as const, from: [1] } },
      { n: 3, f: parsePF('⊥'), just: { r: 'Lob' as const, from: 2 } },
    ];
    expect(checkProof(lines).get(3)!.ok).toBe(true);
    const bad = checkProof([{ n: 1, f: parsePF('Prov(A) -> B'), just: { r: 'hyp', name: 'h' } }, { n: 2, f: parsePF('B'), just: { r: 'Lob', from: 1 } }]);
    expect(bad.get(2)!.ok).toBe(false);
  });
});

import { analyseRosser } from '../src/engine/provability/rosser.ts';

describe('Rosser toy model', () => {
  it('RProv and Prov agree in consistent situations, and differ only in inconsistent ones', () => {
    for (const proof of [null, 0, 3, 7]) {
      for (const refutation of [null, 1, 3, 9]) {
        if (proof !== null && proof === refutation) continue;
        const a = analyseRosser({ proof, refutation });
        if (a.consistent) expect(a.rprov).toBe(a.prov);
        else expect(a.rprov).toBe(proof! < refutation!);
      }
    }
    expect(analyseRosser({ proof: null, refutation: null }).verdict).toBe('independent');
  });
});

describe('the chapter 5 exercises are solvable', () => {
  it('G → Con', () => {
    const L = (n: number, f: string, just: import('../src/engine/provability/pl.ts').Just) => ({ n, f: parsePF(f), just });
    const lines = [
      L(1, 'G <-> ~Prov(G)', { r: 'hyp', name: 'fp' }),
      L(2, '_|_ -> G', { r: 'logic', from: [] }),
      L(3, 'Prov(_|_ -> G)', { r: 'P1', from: 2 }),
      L(4, 'Prov(_|_ -> G) -> (Prov(_|_) -> Prov(G))', { r: 'P2' }),
      L(5, 'Prov(_|_) -> Prov(G)', { r: 'logic', from: [3, 4] }),
      L(6, 'G -> Con', { r: 'logic', from: [1, 5] }),
    ];
    const c = checkProof(lines);
    for (const l of lines) expect(c.get(l.n)!.errors, String(l.n)).toEqual([]);
  });
});
