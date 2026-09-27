import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseFormula, parseTerm } from '../src/engine/syntax/parse.ts';
import { formulaEq, nodeEq } from '../src/engine/syntax/ops.ts';
import { formulaText } from '../src/engine/syntax/print.ts';
import { symbolCode, symbolFromCodeSeq, LOGICAL } from '../src/engine/syntax/language.ts';
import { decode, godel } from '../src/engine/coding/godel.ts';
import { hSubst } from '../src/engine/coding/arith.ts';
import { encodeSeq, evaluate, lit, named, natEq, seqItems } from '../src/engine/numbers/nat.ts';
import * as A from '../src/engine/syntax/ast.ts';
import { varIndex } from '../src/engine/syntax/language.ts';

describe('symbol codes (Definition in Coding Symbols)', () => {
  it('follows the table: ⊥ ↦ ⟨0,0⟩ … , ↦ ⟨0,10⟩', () => {
    LOGICAL.forEach((name, i) => expect(symbolCode({ k: 'logical', name })).toBe(encodeSeq([0n, BigInt(i)])));
    expect(symbolCode({ k: 'var', index: 5 })).toBe(2n ** 2n * 3n ** 6n); // the book: c_{v5} = ⟨1,5⟩ = 2^2·3^6
    expect(symbolCode({ k: 'fn', arity: 2, index: 1 })).toBe(encodeSeq([3n, 2n, 1n]));
    expect(symbolCode({ k: 'pred', arity: 2, index: 0 })).toBe(encodeSeq([4n, 2n, 0n]));
  });

  it('is injective and decodable', () => {
    const syms = [...LOGICAL.map((name) => ({ k: 'logical' as const, name })), ...[0, 1, 7].map((index) => ({ k: 'var' as const, index })), { k: 'const' as const, index: 0 }, { k: 'fn' as const, arity: 1, index: 0 }, { k: 'pred' as const, arity: 3, index: 2 }];
    const codes = syms.map(symbolCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(symbolFromCodeSeq([5n, 1n])).toHaveProperty('error');
  });
});

describe('Gödel numbers (Coding Terms/Formulas)', () => {
  it('reproduces the book’s example #=(v0,c0)# = 2^13123 · 3^39367 · 5^13 · 7^354295 · 11^25 · 13^118099', () => {
    const f = parseFormula('x = 0'); // x is v0, 0 is c0
    const g = godel(f);
    expect(g.items.map((i) => (i.k === 'sym' ? i.sym : null))).toEqual([
      { k: 'logical', name: '=' }, { k: 'logical', name: '(' }, { k: 'var', index: 0 }, { k: 'logical', name: ',' }, { k: 'const', index: 0 }, { k: 'logical', name: ')' },
    ]);
    const exact = 2n ** 13123n * 3n ** 39367n * 5n ** 13n * 7n ** 354295n * 11n ** 25n * 13n ** 118099n;
    expect(evaluate(g.number, 1 << 22)).toBe(exact);
  });

  it('distinguishes the code of a symbol from the Gödel number of a term (Explanation)', () => {
    const t = A.v(5);
    const g = godel(t);
    const c = symbolCode({ k: 'var', index: 5 });
    expect(evaluate(g.number, 1 << 16)).toBe(2n ** (c + 1n));
  });

  it('writes numerals as ′(′(…0…)) and keeps huge ones symbolic', () => {
    const small = godel(parseTerm('2'));
    expect(small.items.length).toBe(7); // ′ ( ′ ( 0 ) )
    const huge = godel(A.numeral(named('N', 'N')));
    expect(huge.items).toHaveLength(1);
    expect(huge.items[0].k).toBe('numeral');
    expect(seqItems(huge.number)).toBeNull();
  });

  it('expands ↔ before coding', () => {
    const g = godel(parseFormula('P(x) ↔ Q(x)'));
    expect(g.expansions).toHaveLength(1);
    expect(formulaEq(g.expanded as never, parseFormula('(P(x) → Q(x)) ∧ (Q(x) → P(x))'))).toBe(true);
  });

  const formulas = ['x = 0', '∀x (x = 0 ∨ ∃y x = y′)', '¬(x + 2) = y × z', '∃z (z′ + x) = y', 'P(f(x, y), 0) → ⊥', '∀x ∀y (x < y → ¬ y < x)'];
  it.each(formulas)('decodes the Gödel number of %s back to the formula', (s) => {
    const f = parseFormula(s);
    const g = godel(f);
    const d = decode(g.number, { expect: 'formula' });
    expect(d.ok).toBe(true);
    if (d.ok) expect(nodeEq(d.node, g.expanded)).toBe(true);
    // and from the plain integer, by factoring
    const v = evaluate(g.number, 1 << 23);
    if (v !== null && v.toString(2).length < 200_000) {
      const d2 = decode(lit(v), { expect: 'formula' });
      expect(d2.ok).toBe(true);
    }
  });

  it('round-trips random formulas (property)', () => {
    const arbTerm: fc.Arbitrary<string> = fc.letrec((tie) => ({
      term: fc.oneof({ maxDepth: 3 }, fc.constantFrom('x', 'y', 'z', '0', '1', '3'), fc.tuple(tie('term'), tie('term')).map(([a, b]) => `(${a} + ${b})`), tie('term').map((a) => `${a}′`)),
    })).term as fc.Arbitrary<string>;
    const arbFormula: fc.Arbitrary<string> = fc.letrec((tie) => ({
      f: fc.oneof(
        { maxDepth: 3 },
        fc.tuple(arbTerm, arbTerm).map(([a, b]) => `${a} = ${b}`),
        fc.tuple(arbTerm, arbTerm).map(([a, b]) => `${a} < ${b}`),
        tie('f').map((a) => `¬${a}`),
        fc.tuple(tie('f'), tie('f'), fc.constantFrom('∧', '∨', '→')).map(([a, b, op]) => `(${a} ${op} ${b})`),
        fc.tuple(fc.constantFrom('∀', '∃'), fc.constantFrom('x', 'y'), tie('f')).map(([q, v, a]) => `${q}${v} ${a}`),
      ),
    })).f as fc.Arbitrary<string>;
    fc.assert(
      fc.property(arbFormula, (s) => {
        const f = parseFormula(s);
        const g = godel(f);
        const d = decode(g.number, { expect: 'formula' });
        expect(d.ok).toBe(true);
        if (d.ok) expect(nodeEq(d.node, g.expanded), `${formulaText(d.node as never)} vs ${formulaText(g.expanded as never)}`).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it('rejects numbers that do not code formulas, saying why', () => {
    expect(decode(lit(10)).ok).toBe(false); // not a sequence code
    const notSymbol = decode(lit(encodeSeq([7n])));
    expect(notSymbol.ok).toBe(false);
    if (!notSymbol.ok) expect(notSymbol.stage).toBe('symbols');
    const ill = godel(parseFormula('x = 0')).items.slice(0, 3);
    void ill;
    const bad = decode(lit(encodeSeq([symbolCode({ k: 'logical', name: '(' }), symbolCode({ k: 'var', index: 0 })])), { expect: 'formula' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.stage).toBe('syntax');
  });
});

describe('arithmetized substitution (Proposition: Subst is primitive recursive)', () => {
  const x = varIndex('x')!;
  it.each([
    ['∀y (x = y ∨ x < 2)', '3'],
    ['x = 0 ∧ ∀x x = x', "y'"],
    ['∃y x = y′', 'y'], // not free for: still agrees with the (book's) substitution
  ])('hSubst on #%s# with t = %s agrees with #A[t/x]#', (a, t) => {
    const r = hSubst(parseFormula(a), parseTerm(t), x);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.agrees).toBe('equal');
      expect(natEq(r.resultNumber, r.expected)).toBe('equal');
    }
  });

  it('marks exactly the free occurrences', () => {
    const r = hSubst(parseFormula('x = 0 ∧ ∀x x = x'), parseTerm('1'), x);
    if (!r.ok) throw new Error();
    expect(r.steps.filter((s) => s.freeOcc)).toHaveLength(1);
  });
});
