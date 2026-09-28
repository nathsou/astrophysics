import { describe, expect, test } from 'vitest';
import { Checker, checkEqual, parseExpr, toTex, evalNum, derivative, Canon, Rat } from './index';

const eq = (a: string, b: string, opts = {}) => checkEqual(a, b, opts);

describe('rationals', () => {
  test('normalise and parse', () => {
    expect(Rat.of(6, -4).toString()).toBe('-3/2');
    expect(Rat.parse('0.125').toString()).toBe('1/8');
    expect(Rat.parse('-7/21').toString()).toBe('-1/3');
  });
});

describe('parser', () => {
  test('implicit multiplication and unicode', () => {
    expect(evalNum(parseExpr('2n(n+1)'), { n: 3 })).toBe(24);
    expect(evalNum(parseExpr('x² + 2xy'), { x: 2, y: 5 })).toBe(24);
    expect(evalNum(parseExpr('−x^2'), { x: 3 })).toBe(-9);
    expect(evalNum(parseExpr('√16 + |−3|'), {})).toBe(7);
    expect(evalNum(parseExpr('(n+1)!'), { n: 4 })).toBe(120);
    expect(evalNum(parseExpr('binom(5, 2)'), {})).toBe(10);
    expect(evalNum(parseExpr('2^3^2'), {})).toBe(512);
    expect(evalNum(parseExpr('sum(k^2, k, 1, n)'), { n: 4 })).toBe(30);
    expect(evalNum(parseExpr('a_1 + a_{12}'), { a_1: 1, a_12: 2 })).toBe(3);
  });
  test('abs bars with implicit multiplication', () => {
    expect(evalNum(parseExpr('|a - b| + 2|a|'), { a: -1, b: 2 })).toBe(5);
  });
  test('errors carry positions', () => {
    expect(() => parseExpr('2 + * 3')).toThrow();
    expect(() => parseExpr('(1 + 2')).toThrow(/Expected/);
  });
});

describe('exact identities', () => {
  test('polynomials', () => {
    expect(eq('(a+b)^2', 'a^2 + 2ab + b^2')).toEqual({ ok: true, how: 'exact' });
    expect(eq('(a+b)^3', 'a^3 + 3a^2 b + 3ab^2 + b^3').how).toBe('exact');
    expect(eq('n(n+1)/2 + (n+1)', '(n+1)(n+2)/2').how).toBe('exact');
  });
  test('rational functions', () => {
    expect(eq('1/n - 1/(n+1)', '1/(n(n+1))').how).toBe('exact');
    expect(eq('(x^2 - 1)/(x - 1)', 'x + 1').how).toBe('exact');
  });
  test('powers with symbolic exponents', () => {
    expect(eq('2^(n+1)', '2*2^n').how).toBe('exact');
    expect(eq('4^n', '2^(2n)').how).toBe('exact');
    expect(eq('2^(n+1) - 1', '2(2^n - 1) + 1').how).toBe('exact');
    expect(eq('6^n', '2^n 3^n').how).toBe('exact');
    expect(eq('(2^n)^2', '4^n').how).toBe('exact');
    expect(eq('x^n x^m', 'x^(n+m)').how).toBe('exact');
    expect(eq('(-1)^(2n)', '1', { domains: { n: 'int' } }).how).toBe('exact');
  });
  test('roots', () => {
    expect(eq('sqrt(8)', '2 sqrt(2)').how).toBe('exact');
    expect(eq('1/sqrt(2)', 'sqrt(2)/2').how).toBe('exact');
    expect(eq('((1 + sqrt(5))/2)^2', '(1 + sqrt(5))/2 + 1').how).toBe('exact');
    expect(eq('sqrt(x)^2', 'x').how).toBe('exact');
  });
  test('factorials, binomials and sums', () => {
    expect(eq('(n+1)!', '(n+1) n!').how).toBe('exact');
    expect(eq('binom(n, k) + binom(n, k-1)', 'binom(n+1, k)').how).toBe('exact');
    expect(eq('sum(k, k, 1, n+1)', 'sum(k, k, 1, n) + n + 1').how).toBe('exact');
    expect(eq('sum(j^3, j, 1, n+1) - sum(k^3, k, 1, n)', '(n+1)^3').how).toBe('exact');
  });
  test('absolute values', () => {
    expect(eq('|x|^2', 'x^2').how).toBe('exact');
    expect(eq('|-x|', '|x|').how).toBe('exact');
  });
});

describe('numeric fallback and counterexamples', () => {
  test('trig identity is only tested', () => {
    expect(eq('sin(x)^2 + cos(x)^2', '1').how).toBe('tested');
  });
  test('wrong steps get counterexamples', () => {
    const v = eq('(a+b)^2', 'a^2 + b^2');
    expect(v.ok).toBe(false);
    expect(v.how).toBe('counterexample');
  });
  test('sqrt(x^2) = x needs x >= 0', () => {
    expect(eq('sqrt(x^2)', 'x').ok).toBe(false);
    expect(eq('sqrt(x^2)', 'x', { domains: { x: 'nonneg' } }).ok).toBe(true);
  });
  test('n^2 + n + 41 is not always prime (checked via a counterexample value)', () => {
    const c = new Checker({ domains: { n: 'nat' } });
    const v = c.relation(parseExpr('mod(n^2 + n + 41, 41)'), '!=', parseExpr('0'));
    expect(v.ok).toBe(false);
  });
});

describe('inequalities', () => {
  test('sum of squares is exact', () => {
    const c = new Checker();
    expect(c.claim('a^2 + b^2 >= 2ab').steps[0]!.verdict.how).toBe('exact');
  });
  test('AM-GM for positives', () => {
    const c = new Checker({ domains: { a: 'pos', b: 'pos' } });
    expect(c.claim('(a+b)/2 >= sqrt(ab)').steps[0]!.verdict.ok).toBe(true);
  });
  test('Bernoulli counterexample without assumptions', () => {
    const c = new Checker({ domains: { n: 'nat' } });
    expect(c.claim('(1+x)^n >= 1 + n x').steps[0]!.verdict.ok).toBe(false);
    const c2 = new Checker({ domains: { n: 'nat' }, assume: ['x >= -1'] });
    expect(c2.claim('(1+x)^n >= 1 + n x').steps[0]!.verdict.ok).toBe(true);
  });
  test('chains', () => {
    const c = new Checker({ domains: { n: 'posint' } });
    const r = c.claim('1/(n+1)^2 < 1/(n(n+1)) = 1/n - 1/(n+1)');
    expect(r.steps.map((s) => s.verdict.ok)).toEqual([true, true]);
  });
});

describe('definitions', () => {
  test('induction step with a defined S(n)', () => {
    const c = new Checker({ defs: { S: { params: ['n'], body: 'n(n+1)/2' } } });
    expect(c.claim('S(n) + (n+1) = S(n+1)').steps[0]!.verdict.how).toBe('exact');
  });
});

describe('tex', () => {
  test('fractions and signs', () => {
    expect(toTex(parseExpr('n(n+1)/2'))).toBe('\\frac{n \\left(n + 1\\right)}{2}'.replace(' \\left', '\\left'));
    expect(toTex(parseExpr('a - 2b'))).toBe('a - 2b');
    expect(toTex(parseExpr('sqrt(2)'))).toBe('\\sqrt{2}');
    expect(toTex(parseExpr('x^(n+1)'))).toBe('x^{n + 1}');
  });
});

describe('calculus', () => {
  test('derivatives', () => {
    const d = derivative(parseExpr('x^3 + 2x'), 'x');
    expect(new Canon().equal(d, parseExpr('3x^2 + 2'))).toBe(true);
    const d2 = derivative(parseExpr('sin(x^2)'), 'x');
    expect(evalNum(d2, { x: 1 })).toBeCloseTo(2 * Math.cos(1));
  });
});

describe('constant definitions', () => {
  test('p stands for q√n', () => {
    const c = new Checker({ defs: { p: { params: [], body: 'q sqrt(n)' } }, domains: { n: 'pos', q: 'pos' } });
    expect(c.claim('(n q - k p)/(p - k q) = sqrt(n)').steps[0]!.verdict.how).toBe('exact');
  });
});

describe('towers of exponents', () => {
  test('Fermat numbers', () => {
    const c = new Checker({ defs: { F: { params: ['n'], body: '2^(2^n) + 1' } }, domains: { n: 'nat' } });
    expect(c.claim('(F(n) - 2) F(n) = F(n+1) - 2').steps[0]!.verdict.how).toBe('exact');
  });
});

describe('binomials with symbolic arguments', () => {
  test('C(2m+1, 3)/C(2m+1, 1)', () => {
    expect(checkEqual('binom(2m+1, 3)/binom(2m+1, 1)', 'm(2m-1)/3', { domains: { m: 'posint' } }).how).toBe('exact');
  });
});
