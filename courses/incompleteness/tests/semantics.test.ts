import { describe, expect, it } from 'vitest';
import * as A from '../src/engine/syntax/ast.ts';
import type { Formula, Term } from '../src/engine/syntax/ast.ts';
import { parseFormula, parseTerm } from '../src/engine/syntax/parse.ts';
import { expandDefined } from '../src/engine/syntax/ops.ts';
import { evaluate, lit, named } from '../src/engine/numbers/nat.ts';
import {
  arithmeticStructure, GENERIC, makeStructure, modArithmetic, pureStructure, StructureError, tuples, validateStructure, type Elem, type Structure,
} from '../src/engine/semantics/structure.ts';
import { allAssignments, assignment, isXVariant, showAssignment, variant, xVariants } from '../src/engine/semantics/assignment.ts';
import { decisivePath, formatTrace, type FormulaTrace } from '../src/engine/semantics/trace.ts';
import { evaluateTerm, extension, isModelOf, missingSymbols, satisfies, trueIn } from '../src/engine/semantics/satisfaction.ts';
import { checkQ, finiteQ1Q2Failure, qSentences } from '../src/engine/semantics/arithmetic.ts';
import { classify, delta0, evaluateInN, evaluateTermInN } from '../src/engine/semantics/standard.ts';
import {
  dedekindInfinityFO, S, solAssignment, solCount, solFin, solIdentity, solIdentityImp, solInf, solSatisfies, solTransitiveClosure, solTrueIn, fromFirstOrder,
} from '../src/engine/semantics/sol.ts';

const P = (s: string) => parseFormula(s);
const R2 = GENERIC.R(2);

/** {0, 1, 2} with R = {⟨0,1⟩, ⟨1,2⟩}. */
const chain = makeStructure({ name: 'M', domain: [0, 1, 2], relations: [{ ...R2, def: { tuples: [[0, 1], [1, 2]] } }] });

describe('structures', () => {
  it('builds structures from tables and functions', () => {
    const M = arithmeticStructure({ domain: ['a', 'b'], zero: 'a', succ: { values: ['b', 'a'] }, plus: { grid: [['a', 'b'], ['b', 'a']] }, times: () => 'a', less: { tuples: [['a', 'b']] } });
    expect(M.domain).toEqual(['a', 'b']);
    expect(trueIn(M, P("0′ = 0")).truth).toBe(false);
    expect(trueIn(M, P("0′′ = 0")).truth).toBe(true);
    expect(trueIn(M, P('0 < 1')).truth).toBe(true);
  });

  it('reports what is wrong with a specification', () => {
    const r = validateStructure({
      domain: [0, 1, 1],
      constants: { 0: 5 },
      functions: [
        { arity: 1, index: 0, def: { entries: [[[0], 1]] } },
        { arity: 2, index: 0, def: { entries: [[[0, 0], 0], [[0, 0], 1]] } },
      ],
      relations: [{ arity: 2, index: 0, def: { tuples: [[0, 7]] } }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const all = r.errors.join('\n');
    expect(all).toMatch(/listed twice/);
    expect(all).toMatch(/constant 0 is interpreted as 5, which is not in the domain/);
    expect(all).toMatch(/not total: no value for 1/);
    expect(all).toMatch(/not a function: ⟨0, 0⟩ is mapped both to 0 and to 1/);
    expect(all).toMatch(/contains 7, which is not in the domain/);
    expect(() => makeStructure({ domain: [] })).toThrow(StructureError);
    expect(() => makeStructure({ domain: [0, 1], functions: [{ arity: 1, index: 0, def: (x) => (x as number) + 1 }] })).toThrow(/maps 1 to 2, which is not in the domain/);
  });

  it('computes numerals by following successors (also huge ones)', () => {
    const Z5 = modArithmetic(5);
    expect(evaluateTerm(Z5, new Map(), parseTerm('7')).value).toBe(2);
    expect(evaluateTerm(Z5, new Map(), A.numeral(lit(10n ** 30n + 3n))).value).toBe(3);
    expect(evaluateTerm(modArithmetic(5, 'saturate'), new Map(), parseTerm('7')).value).toBe(4);
    expect(evaluateTerm(Z5, new Map(), A.numeral(named('G', 'G'))).value).toBe(null);
  });

  it('lists uninterpreted symbols', () => {
    expect(missingSymbols(chain, P('∀x (R(x, x) ∨ x < f(x))'))).toEqual(['the 2-place predicate symbol < (P^2_0)', 'the 1-place function symbol f (f^1_10)']);
    const t = satisfies(chain, assignment({ x: 0 }), P('x < x'));
    expect(t.truth).toBe('unknown');
    expect(t.reason).toMatch(/does not interpret the 2-place predicate symbol </);
  });
});

describe('assignments and x-variants', () => {
  it('builds s[m/x] and recognises x-variants', () => {
    const s = assignment({ x: 0, y: 1 });
    const s2 = variant(s, 0, 2);
    expect(s2.get(0)).toBe(2);
    expect(s.get(0)).toBe(0);
    expect(isXVariant(s, s2, 0)).toBe(true);
    expect(isXVariant(s, s2, 1)).toBe(false);
    expect(isXVariant(s, s, 1)).toBe(true);
    expect(xVariants([0, 1, 2], s, 1).map((v) => v.get(1))).toEqual([0, 1, 2]);
    expect(allAssignments([0, 1], [0, 1])).toHaveLength(4);
    expect(showAssignment(s2)).toBe('x ↦ 2, y ↦ 1');
  });

  it('satisfaction depends only on the free variables (Proposition)', () => {
    const f = P('∃y R(x, y)');
    for (const z of [0, 1, 2]) expect(satisfies(chain, assignment({ x: 0, z }), f).truth).toBe(true);
  });
});

describe('satisfaction with traces', () => {
  it('finds witnesses for ∃', () => {
    const t = satisfies(chain, assignment({ x: 0 }), P('∃y R(x, y)'));
    expect(t.truth).toBe(true);
    expect(t.clause).toMatch(/∃y B: satisfied iff at least one y-variant/);
    expect(t.quantifier?.witness).toBe(1);
    expect(t.quantifier?.variants.map((v) => [v.element, v.truth])).toEqual([[0, false], [1, true]]);
    const leaf = t.children[1];
    expect(leaf.detail).toBe('⟨0, 1⟩ ∈ R^M');
    expect(leaf.terms.map((x) => x.value)).toEqual([0, 1]);
    const f = satisfies(chain, assignment({ x: 2 }), P('∃y R(x, y)'));
    expect(f.truth).toBe(false);
    expect(f.quantifier?.variants).toHaveLength(3);
    expect(f.detail).toMatch(/none of the 3 y-variants/);
  });

  it('finds counterexamples for ∀ and reads off the counterexample assignment', () => {
    const t = trueIn(chain, P('∀x ∃y R(x, y)'));
    expect(t.truth).toBe(false);
    expect(t.quantifier?.counterexample).toBe(2);
    const p = decisivePath(t);
    expect(p.bindings.map((b) => [b.variable, b.element, b.role])).toEqual([[0, 2, 'counterexample']]);
    expect(p.leaf.formula.k).toBe('exists');
    expect(formatTrace(t)).toContain('∀x ∃y R(x, y)');
  });

  it('every variant in the trace is an x-variant of the assignment at its quantifier', () => {
    const t = satisfies(chain, assignment({ z: 1 }), P('∀x ∃y (R(x, y) ∨ R(y, x))'), { exhaustive: true });
    const check = (n: FormulaTrace<Elem>) => {
      if (n.quantifier) {
        expect(n.quantifier.variants).toHaveLength(3);
        for (const v of n.quantifier.variants) {
          expect(isXVariant(n.assignment, v.trace!.assignment, n.quantifier.variable)).toBe(true);
          expect(v.trace!.assignment.get(n.quantifier.variable)).toBe(v.element);
        }
      }
      n.children.forEach(check);
    };
    check(t);
    expect(t.truth).toBe(true);
  });

  it('follows the definitions of ⊤ and ↔, and agrees with their expansions', () => {
    const Z4 = modArithmetic(4);
    expect(trueIn(Z4, P('⊤')).truth).toBe(true);
    expect(trueIn(Z4, P('⊤')).clause).toMatch(/defined as ¬⊥/);
    const fs = ['∀x (x < 2 ↔ (x = 0 ∨ x = 1))', '∃x ((x + x) = 0 ↔ ¬x = 0)', '∀x ∀y ((x < y ↔ y < x) → x = y)', '⊤ ↔ ∃x x′ = 0'];
    for (const s of fs) {
      const f = P(s);
      expect(trueIn(Z4, f).truth).toBe(trueIn(Z4, expandDefined(f)).truth);
    }
  });

  it('cannot evaluate named formulas or unassigned variables', () => {
    const f = A.abbr('Prov', '\\mathrm{Prov}', [0], [A.zero()]);
    const t = trueIn(modArithmetic(3), A.or(f, A.bot()));
    expect(t.truth).toBe('unknown');
    expect(t.reason).toMatch(/Prov stands for a formula/);
    // …but a decisive disjunct still decides.
    expect(trueIn(modArithmetic(3), A.or(f, A.top())).truth).toBe(true);
    const u = satisfies(chain, new Map(), P('R(x, y)'));
    expect(u.truth).toBe('unknown');
    expect(u.reason).toMatch(/does not assign a value to x/);
    expect(trueIn(chain, P('R(x, y)')).reason).toMatch(/not a sentence/);
  });

  it('computes the relation a formula defines', () => {
    const ext = extension(chain, P('∃z (R(x, z) ∧ R(z, y))'));
    expect(ext.map((s) => [s.get(0), s.get(1)])).toEqual([[0, 2]]);
  });

  it('can switch traces off', () => {
    const t = trueIn(modArithmetic(6), P('∀x ∀y (x + y) = (y + x)'), { trace: false });
    expect(t.truth).toBe(true);
    expect(t.children).toHaveLength(0);
    expect(t.quantifier?.variants).toHaveLength(6);
  });
});

describe('arithmetic mod n', () => {
  const Z5 = modArithmetic(5);
  const Z6 = modArithmetic(6);
  it('satisfies the facts of modular arithmetic', () => {
    expect(trueIn(Z5, P('(2 × 3) = 1')).truth).toBe(true);
    expect(trueIn(Z5, P('∀x ∀y (x + y) = (y + x)')).truth).toBe(true);
    expect(trueIn(Z5, P('∀x ∀y ∀z (x × (y + z)) = ((x × y) + (x × z))')).truth).toBe(true);
    const sq = trueIn(Z5, P('∃x (x × x) = 4'));
    expect(sq.quantifier?.witness).toBe(2);
    expect(trueIn(Z5, P('∃x (x × x) = 2')).truth).toBe(false);
    // ℤ_6 has zero divisors, ℤ_5 does not.
    const zd = P('∃x ∃y (¬x = 0 ∧ ¬y = 0 ∧ (x × y) = 0)');
    const t6 = trueIn(Z6, zd);
    expect(t6.truth).toBe(true);
    expect(decisivePath(t6).bindings.map((b) => b.element)).toEqual([2, 3]);
    expect(trueIn(Z5, zd).truth).toBe(false);
    // every non-zero element of ℤ_5 has an inverse
    expect(trueIn(Z5, P('∀x (x = 0 ∨ ∃y (x × y) = 1)')).truth).toBe(true);
  });

  it('checks Q1–Q8 and reports the first failing axiom with its counterexample', () => {
    const r = checkQ(Z5);
    expect(r.ok).toBe(false);
    expect(r.results.map((x) => [x.name, x.truth])).toEqual([
      ['Q1', true], ['Q2', false], ['Q3', true], ['Q4', true], ['Q5', true], ['Q6', true], ['Q7', true], ['Q8', false],
    ]);
    expect(r.firstFailure?.name).toBe('Q2');
    expect(r.firstFailure?.counterexample.map((b) => [b.variable, b.element])).toEqual([[0, 4]]);
    expect(r.firstFailure?.leaf.detail).toBe('both values are 0');
    const sat = checkQ(modArithmetic(5, 'saturate'));
    expect(sat.firstFailure?.name).toBe('Q1');
    expect(sat.firstFailure?.counterexample.map((b) => b.element)).toEqual([3, 4]);
    expect(sat.results.find((x) => x.name === 'Q2')?.truth).toBe(true);
    const stop = isModelOf(Z5, qSentences(), { stopAtFirstFailure: true });
    expect(stop.results).toHaveLength(2);
  });

  it('no finite structure satisfies both Q1 and Q2', () => {
    const structures: Structure[] = [];
    for (let n = 1; n <= 6; n++) structures.push(modArithmetic(n), modArithmetic(n, 'saturate'));
    // every successor function on {0, 1, 2}, with every choice of 0
    const D = [0, 1, 2];
    for (const vals of tuples(D, 3)) for (const z of D) structures.push(arithmeticStructure({ domain: D, zero: z, succ: { values: vals } }));
    for (const M of structures) {
      const r = finiteQ1Q2Failure(M);
      if ('fail' in r) throw new Error(r.fail);
      expect(r.trace.truth).toBe(false);
      expect(r.witnessTrace.truth).toBe(false);
      expect(trueIn(M, A.and(qSentences()[0].formula, qSentences()[1].formula)).truth).toBe(false);
      const succ = (e: Elem) => evaluateTerm(M, assignment({ x: e }), parseTerm("x'")).value;
      if (r.axiom === 'Q2') expect(succ(r.elements.x)).toBe(M.constants.get(0));
      else {
        expect(r.elements.x).not.toBe(r.elements.y);
        expect(succ(r.elements.x)).toBe(succ(r.elements.y!));
      }
    }
    const z5 = finiteQ1Q2Failure(modArithmetic(5));
    expect(z5).toMatchObject({ axiom: 'Q2', orbit: [0, 1, 2, 3, 4], elements: { x: 4 } });
    const s5 = finiteQ1Q2Failure(modArithmetic(5, 'saturate'));
    expect(s5).toMatchObject({ axiom: 'Q1', elements: { x: 3, y: 4 } });
    if (!('fail' in s5)) expect(s5.argument).toMatch(/not injective/);
    expect(finiteQ1Q2Failure(chain)).toHaveProperty('fail');
  });
});

describe('Δ0, Σ1, Π1', () => {
  it('classifies formulas as in the book', () => {
    const c = (s: string) => classify(P(s));
    expect(c('x = 0').level).toBe('Δ0');
    expect(c('∀y (y < x → ¬y = 3)')).toMatchObject({ level: 'Δ0', bounded: [expect.any(String)] });
    expect(c('∃y (y < x ∧ (y + y) = x)').level).toBe('Δ0');
    expect(c('∀y (y < (x × x) → ∃z (z < y ∧ z = z))').bounded).toHaveLength(2);
    expect(c('∃x (x + x) = y')).toMatchObject({ level: 'Σ1', unbounded: { kind: 'exists', variable: 0 } });
    expect(c('∀x ¬x′ = 0').level).toBe('Π1');
    expect(c('∃x ∃y (x + y) = 3').explanation).toMatch(/more than one unbounded ∃/);
    expect(c('∃x ∃y (x + y) = 3').level).toBe('other');
    expect(c('¬∃x x = 0').level).toBe('other');
    expect(c('∃x (x < y ∧ P(x))').explanation).toMatch(/predicate symbol P is not a symbol of the language of arithmetic/);
    expect(c('∀x ∃y y = x′').level).toBe('other');
    const selfBound = delta0(P('∀x (x < x′ → x = x)'));
    expect(selfBound.ok).toBe(false);
    if (!selfBound.ok) expect(selfBound.reason).toMatch(/contains x itself/);
    expect(c('∀x (x < x′ → x = x)').level).toBe('Π1');
    const nested = delta0(P('∃x ((x < y ∧ x = 1) ∧ x = 1)'));
    if (!nested.ok) expect(nested.reason).toMatch(/nested/);
    expect(c('⊤ ↔ x < 3').level).toBe('Δ0');
    expect(classify(A.abbr('Prov', 'Prov', [0], [A.v(0)])).level).toBe('other');
  });

  it('evaluates terms with numerals in ℕ', () => {
    expect(evaluateTermInN(parseTerm("(x + 3) × y'"), new Map([[0, 4n], [1, 5n]])).value).toBe(42n);
    const big = evaluateTermInN(A.numeral({ k: 'pow', base: lit(2), exp: lit(5000) }));
    expect(big.value).toBe(null);
    expect(big.reason).toMatch(/too large/);
    expect(evaluateInN(A.eq(A.numeral({ k: 'pow', base: lit(2), exp: lit(5000) }), A.zero())).truth).toBe('unknown');
  });

  // An independent brute-force evaluator: bounded quantifiers are checked on every m up to the
  // bound + 3 (so the vacuous cases beyond the bound are checked too).
  function bfTerm(t: Term, s: Map<number, bigint>): bigint {
    switch (t.k) {
      case 'var':
        return s.get(t.index)!;
      case 'const':
        return 0n;
      case 'numeral':
        return evaluate(t.value)!;
      case 'app': {
        const a = t.args.map((x) => bfTerm(x, s));
        return t.arity === 1 ? a[0] + 1n : t.index === 0 ? a[0] + a[1] : a[0] * a[1];
      }
    }
  }
  function bf(f: Formula, s: Map<number, bigint>): boolean {
    switch (f.k) {
      case 'bot': return false;
      case 'top': return true;
      case 'eq': return bfTerm(f.l, s) === bfTerm(f.r, s);
      case 'pred': return bfTerm(f.args[0], s) < bfTerm(f.args[1], s);
      case 'not': return !bf(f.a, s);
      case 'and': return bf(f.a, s) && bf(f.b, s);
      case 'or': return bf(f.a, s) || bf(f.b, s);
      case 'imp': return !bf(f.a, s) || bf(f.b, s);
      case 'iff': return bf(f.a, s) === bf(f.b, s);
      case 'forall':
      case 'exists': {
        const body = f.body as Formula & { a: Formula & { k: 'pred' } };
        const n = bfTerm(body.a.args[1], s);
        const vals: boolean[] = [];
        for (let m = 0n; m < n + 3n; m++) vals.push(bf(f.body, new Map(s).set(f.v.index, m)));
        return f.k === 'forall' ? vals.every(Boolean) : vals.some(Boolean);
      }
      default: throw new Error('unexpected');
    }
  }

  it('decides Δ0 formulas in ℕ exactly, agreeing with brute force', () => {
    const named: [string, (x: bigint) => boolean][] = [
      ['¬x = 0 ∧ ¬x = 1 ∧ ∀y (y < x → ∀z (z < x → ¬(y × z) = x))', (x) => x > 1n && [...Array(Number(x)).keys()].slice(2).every((d) => x % BigInt(d) !== 0n)],
      ['∃y (y < x′ ∧ (y × y) = x)', (x) => Number.isInteger(Math.sqrt(Number(x)))],
      ['∃y (y < x′ ∧ (y + y) = x)', (x) => x % 2n === 0n],
      ['∀y (y < x → y < 5)', (x) => x <= 5n],
    ];
    for (const [src, want] of named) {
      const f = P(src);
      expect(classify(f).level).toBe('Δ0');
      for (let x = 0n; x < 30n; x++) {
        const r = evaluateInN(f, new Map([[0, x]]));
        expect(r.truth, `${src} at x = ${x}`).toBe(want(x));
      }
    }
    // A trace of a bounded quantifier runs through the values below the bound only.
    const t = evaluateInN(P('∀y (y < x → ¬(y × y) = 7)'), new Map([[0, 4n]]));
    expect(t.truth).toBe(true);
    expect(t.trace?.quantifier?.variants.map((v) => v.element)).toEqual([0n, 1n, 2n, 3n]);
    expect(t.trace?.quantifier?.bound?.value).toBe(4n);
    expect(t.trace?.detail).toMatch(/for y ≥ 4 the antecedent y < x is not satisfied/);
    const w = evaluateInN(P('∃y (y < 10 ∧ (y × y) = 49)'));
    expect(w).toMatchObject({ truth: true, trace: { quantifier: { witness: 7n } } });

    // Random Δ0 formulas.
    let seed = 12345;
    const rnd = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    const term = (d: number, avoid: number): Term => {
      const k = d === 0 ? rnd(3) : rnd(6);
      const vars = [0, 1, 2].filter((i) => i !== avoid);
      switch (k) {
        case 0: return A.v(vars[rnd(vars.length)]);
        case 1: return A.zero();
        case 2: return A.numeral(lit(rnd(4)));
        case 3: return A.succ(term(d - 1, avoid));
        case 4: return A.plus(term(d - 1, avoid), term(d - 1, avoid));
        default: return A.times(term(d - 1, avoid), term(d - 1, avoid));
      }
    };
    const formula = (d: number): Formula => {
      const k = d === 0 ? rnd(2) : rnd(9);
      switch (k) {
        case 0: return A.eq(term(1, -1), term(1, -1));
        case 1: return A.less(term(1, -1), term(1, -1));
        case 2: return A.not(formula(d - 1));
        case 3: return A.and(formula(d - 1), formula(d - 1));
        case 4: return A.or(formula(d - 1), formula(d - 1));
        case 5: return A.imp(formula(d - 1), formula(d - 1));
        case 6: return A.iff(formula(d - 1), formula(d - 1));
        default: {
          const x = rnd(3);
          const t = term(1, x);
          return k === 7 ? A.forall(A.v(x), A.imp(A.less(A.v(x), t), formula(d - 1))) : A.exists(A.v(x), A.and(A.less(A.v(x), t), formula(d - 1)));
        }
      }
    };
    let checked = 0;
    for (let i = 0; i < 150; i++) {
      const f = formula(3);
      expect(classify(f).level).toBe('Δ0');
      for (const s of allAssignments([0n, 1n, 3n], [0, 1, 2])) {
        const r = evaluateInN(f, s);
        expect(r.truth).toBe(bf(f, new Map(s)));
        checked++;
      }
    }
    expect(checked).toBe(150 * 27);
  });

  it('searches for Σ1 witnesses, never claiming falsity', () => {
    const sq = P('∃y (y × y) = x');
    expect(classify(sq).level).toBe('Σ1');
    const yes = evaluateInN(sq, new Map([[0, 49n]]));
    expect(yes).toMatchObject({ truth: true, witness: 7n, message: 'true (witness found: y = 7)' });
    expect(yes.trace?.children[0].truth).toBe(true);
    const no = evaluateInN(sq, new Map([[0, 50n]]), { limit: 100 });
    expect(no).toMatchObject({ truth: 'unknown', searched: 100n, message: 'no witness below 100' });
    // Π1: counterexample search.
    const pi = P('∀y ¬(y × y) = x');
    expect(evaluateInN(pi, new Map([[0, 49n]]))).toMatchObject({ truth: false, counterexample: 7n });
    expect(evaluateInN(pi, new Map([[0, 50n]]), { limit: 20 })).toMatchObject({ truth: 'unknown', message: 'no counterexample below 20' });
    // A Σ1 sentence with bounded quantifiers inside: there is a prime above 20.
    const prime = P('∃x (20 < x ∧ ∀y (y < x → ∀z (z < x → ¬(y × z) = x)) ∧ 1 < x)');
    expect(classify(prime).level).toBe('Σ1');
    expect(evaluateInN(prime).witness).toBe(23n);
    // Not evaluated: not Δ0, Σ1 or Π1; unassigned variables.
    expect(evaluateInN(P('∀x ∃y x < y')).message).toMatch(/not evaluated/);
    expect(evaluateInN(P('x = 0')).message).toMatch(/no value to x/);
  });
});

describe('second-order logic on finite domains', () => {
  it('Inf (Dedekind infinity) is false and Fin true in every finite structure', () => {
    for (let n = 1; n <= 4; n++) {
      const M = pureStructure(Array.from({ length: n }, (_, i) => i));
      const inf = solTrueIn(M, solInf());
      expect(inf.truth).toBe(false);
      expect(inf.quantifier).toMatchObject({ tried: n ** n, total: n ** n });
      expect(solTrueIn(M, solFin()).truth).toBe(true);
    }
    // The first-order version: false whatever f is interpreted as.
    const D = ['a', 'b', 'c'];
    for (const vals of tuples(D, 3)) {
      const M = makeStructure({ domain: D, functions: [{ ...GENERIC.f(1), def: { values: vals } }] });
      expect(trueIn(M, dedekindInfinityFO()).truth).toBe(false);
    }
  });

  it('Count is true in finite structures, with a witnessing z and u', () => {
    for (let n = 1; n <= 3; n++) {
      const t = solTrueIn(pureStructure(Array.from({ length: n }, (_, i) => i)), solCount());
      expect(t.truth).toBe(true);
      expect(t.quantifier?.witness).toMatchObject({ kind: 'object' });
      expect(t.children[0].quantifier?.witness).toMatchObject({ kind: 'function' });
    }
  });

  it('∀X (X(x) ↔ X(y)) and ∀X (X(x) → X(y)) define identity', () => {
    const M = pureStructure(['a', 'b', 'c']);
    for (const a of M.domain) for (const b of M.domain) {
      const s = solAssignment({ obj: { x: a, y: b } });
      expect(solSatisfies(M, s, solIdentity()).truth).toBe(a === b);
      const t = solSatisfies(M, s, solIdentityImp());
      expect(t.truth).toBe(a === b);
      if (a !== b) expect(t.quantifier?.counterexample).toEqual({ kind: 'relation', tuples: [[a]] });
    }
  });

  it('R*(X) holds exactly when X is the transitive closure of R', () => {
    const M = makeStructure({ domain: [0, 1, 2], relations: [{ ...R2, def: { tuples: [[0, 1], [1, 2]] } }] });
    const X = S.X(0, 2);
    const star = solTransitiveClosure(R2, X);
    const withX = (ts: Elem[][]) => solSatisfies(M, solAssignment({ rel: [{ X, tuples: ts }] }), star).truth;
    expect(withX([[0, 1], [1, 2], [0, 2]])).toBe(true);
    expect(withX([[0, 1], [1, 2]])).toBe(false);
    expect(withX([[0, 1], [1, 2], [0, 2], [2, 2]])).toBe(false);
  });

  it('embeds first-order formulas and refuses domains that are too large', () => {
    const f = fromFirstOrder(P('∀x ∃y R(x, y)'));
    expect(solTrueIn(chain, f).truth).toBe(false);
    const big = solTrueIn(pureStructure([0, 1, 2, 3, 4, 5, 6, 7]), solInf());
    expect(big.truth).toBe('unknown');
    expect(big.reason).toMatch(/at most 6/);
    const many = solTrueIn(pureStructure([0, 1, 2, 3, 4, 5]), S.allR(S.X(0, 2), S.top()));
    expect(many.reason).toMatch(/68719476736 values/);
  });
});

