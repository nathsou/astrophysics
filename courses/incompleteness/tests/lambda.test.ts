import { describe, expect, it } from 'vitest';
import {
  alphaEq,
  alphaKey,
  alphaRename,
  app,
  applicativeOrder,
  applyNamed,
  betaEquivalent,
  binderMap,
  callByName,
  callByValue,
  churchBoolean,
  churchNumeral,
  combinator,
  composition,
  contract,
  decodeBoolean,
  decodeNumeral,
  decodePair,
  etaContract,
  etaRedexes,
  freeFor,
  freeVars,
  freshName,
  identical,
  lam,
  minimization,
  naiveSubstitute,
  nodeById,
  normalOrder,
  numeralValue,
  pair,
  parseLambda,
  primitiveRecursion,
  print,
  printTokens,
  projection,
  redexes,
  reduce,
  reductionGraph,
  step,
  strategyRedex,
  substitute,
  toTex,
  tryParseLambda,
  variable,
  walk,
  type Term,
} from '../src/engine/lambda/lambda.ts';

const P = (s: string) => parseLambda(s);
const nf = (t: Term, fuel = 5000) => normalOrder(t, { fuel, trace: false });
const ids = (t: Term) => {
  const out: string[] = [];
  walk(t, (n) => out.push(n.id));
  return out;
};

describe('parsing and printing', () => {
  const samples = [
    'x',
    'λx.x',
    'x y z',
    'x (y z)',
    '(λx.x x y) λz.z',
    '(λx.x) (λy.y) z',
    'λx.(λy.y) x',
    'λf x.f (f x)',
    '(λx.(λy.y x) z) v',
    'λx y z.x z (y z)',
    "λx'.x' y_1",
    '(λx.x x) λx.x x',
  ];
  it.each(samples)('round-trips %s', (s) => {
    const t = P(s);
    const printed = print(t);
    expect(printed).toBe(s);
    expect(alphaEq(P(printed), t)).toBe(true);
  });

  it('follows the book’s conventions: left-associative application, widest-scope λ, several binders', () => {
    const t = P('M N P Q'.replace(/[MNPQ]/g, (c) => c.toLowerCase()));
    expect(identical(t, app(app(app(variable('m'), variable('n')), variable('p')), variable('q')))).toBe(true);
    const u = P('λx.m n p');
    expect(u.k === 'abs' && u.body.k === 'app').toBe(true);
    expect(identical(P('λx y z.m'), P('λx.λy.λz.m'))).toBe(true);
    expect(identical(P('\\x.x'), P('λx.x'))).toBe(true);
  });

  it('reads the book’s single-letter notation λxy.xxyx λz.xz', () => {
    const t = parseLambda('λxy.xxyx λz.xz', { singleLetter: true });
    expect(identical(t, P('λx.λy.((((x x) y) x) (λz.(x z)))'))).toBe(true);
    expect(print(t)).toBe('λx y.x x y x λz.x z');
    expect(toTex(t)).toBe('\\lambda xy.\\, xxyx\\,\\lambda z.\\, xz');
  });

  it('reads digits as Church numerals λf x.fⁿ(x), labelled n̄', () => {
    const three = P('3');
    expect(print(three)).toBe('λf x.f (f (f x))');
    expect(three.label).toBe('3̄');
    expect(print(three, { labels: true })).toBe('3̄');
    expect(alphaEq(P('3̄'), three)).toBe(true);
    expect(toTex(P('Succ 2'), { labels: true })).toBe('\\mathrm{Succ}\\,\\overline{2}');
  });

  it('expands named terms from the book, case-insensitively, as fresh labelled copies', () => {
    expect(print(P('Succ'))).toBe('λa f x.f (a f x)');
    expect(toTex(P('Succ'))).toBe('\\lambda afx.\\, f(afx)');
    expect(alphaEq(P('SUCC'), P('Succ'))).toBe(true);
    expect(alphaEq(P('TRUE'), P('λx y.x'))).toBe(true);
    expect(print(P('K I Ω'), { labels: true })).toBe('K I Ω');
    expect(toTex(P('K I Ω'), { labels: true })).toBe('K\\,I\\,\\Omega');
    expect(alphaEq(P('Y'), P('(λu x.x (u u x)) λu x.x (u u x)'))).toBe(true);
    const a = P('K K');
    const [l, r] = a.k === 'app' ? [a.fn, a.arg] : [a, a];
    expect(new Set([...ids(l), ...ids(r)]).size).toBe(ids(l).length + ids(r).length);
  });

  it('accepts user definitions and ⟨M, N⟩ pairs', () => {
    const t = parseLambda('Twice 2', { defs: { Twice: 'λf x.f (f x)' } });
    expect(print(t, { labels: true })).toBe('Twice 2̄');
    expect(print(P('⟨x, y⟩'))).toBe('λf.f x y');
    expect(print(P('<f, g>'))).toBe("λf'.f' f g");
  });

  it('reports errors with positions', () => {
    const cases: [string, number][] = [
      ['λ.x', 1],
      ['(x y', 4],
      ['x )', 2],
      ['λx x', 4],
      ['Foo', 0],
      ['x # y', 2],
    ];
    for (const [src, pos] of cases) {
      const r = tryParseLambda(src);
      expect(r.ok, src).toBe(false);
      if (!r.ok) expect(r.pos, src).toBe(pos);
    }
    const circ = tryParseLambda('A', { defs: { A: 'λx.B', B: 'A x' } });
    expect(!circ.ok && circ.error).toMatch(/circular/);
  });

  it('prints with collapsed numerals and known terms', () => {
    const t = nf(P('Add 2 3')).final;
    expect(print(t, { numerals: true })).toBe('5̄');
    expect(print(P('λx.x x'), { known: [{ label: 'ω', term: P('λy.y y') }] })).toBe('ω');
    expect(print(P('p (λm n.m)'))).toBe('p λm n.m');
    expect(print(P('p (λm n.m)'), { absArgParens: true })).toBe('p (λm n.m)');
    expect(print(P('λx.x'), { ascii: true })).toBe('\\x.x');
  });

  it('prints the official, fully parenthesised syntax', () => {
    const t = parseLambda('λxy.xxyx λz.xz', { singleLetter: true });
    expect(print(t, { parens: 'full' })).toBe('(λx.(λy.((((x x) y) x) (λz.(x z)))))');
    expect(toTex(P('λx.x y'), { parens: 'full' })).toBe('(\\lambda x.\\, (xy))');
    expect(alphaEq(P(print(t, { parens: 'full' })), t)).toBe(true);
  });

  it('maps each occurrence to its binder', () => {
    const t = P('λx.x (λx.x) y');
    const m = binderMap(t);
    const vars: { name: string; binder: string | null }[] = [];
    walk(t, (n) => {
      if (n.k === 'var') vars.push({ name: n.name, binder: m.get(n.id)! });
    });
    expect(vars[0]!.binder).toBe(t.id);
    expect(vars[1]!.binder).not.toBe(t.id);
    expect(vars[1]!.binder).not.toBe(null);
    expect(vars[2]!.binder).toBe(null);
  });

  it('gives tokens with the ids of the nodes they belong to', () => {
    const t = P('(λx.x) y');
    const toks = printTokens(t);
    expect(toks.map((k) => k.text).join('')).toBe('(λx.x) y');
    const binder = toks.find((k) => k.kind === 'binder')!;
    expect(nodeById(t, binder.id)!.k).toBe('abs');
    expect(toks.every((k) => k.owners[0] === t.id)).toBe(true);
  });
});

describe('the book’s lowercase true and false', () => {
  it('are read as the truth values, as the book writes them', () => {
    expect(alphaEq(P('true'), churchBoolean(true))).toBe(true);
    expect(alphaEq(P('false'), churchBoolean(false))).toBe(true);
    // an answer to the book's problem on Or, written with the book's names
    for (const [x, y] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      const r = nf(app(app(P('λx y. x true y'), churchBoolean(x)), churchBoolean(y)));
      expect(alphaEq(r.final, churchBoolean(x || y))).toBe(true);
    }
  });
  it('do not swallow longer variable names, and are variables when no definitions are given', () => {
    expect(print(P('λtruth. truth'))).toBe('λtruth.truth');
    expect(freeVars(parseLambda('true', { defs: {} }))).toEqual(new Set(['true']));
    const r = tryParseLambda('λtrue. true');
    expect(r.ok).toBe(false);
  });
});

describe('variables and α-equivalence', () => {
  it('computes free variables: in (λz.yz)x, y and x are free and z is bound', () => {
    expect([...freeVars(P('(λz.y z) x'))].sort()).toEqual(['x', 'y']);
    expect(freeVars(P('λx y.x y')).size).toBe(0);
  });

  it('identifies terms up to renaming of bound variables', () => {
    expect(alphaEq(P('λx.x'), P('λy.y'))).toBe(true);
    expect(alphaEq(P('λx y.x y'), P('λy x.y x'))).toBe(true);
    expect(alphaEq(P('λx y.x'), P('λx y.y'))).toBe(false);
    expect(alphaEq(P('λx.y'), P('λz.z'))).toBe(false);
    expect(alphaEq(P('λx.y'), P('λx.z'))).toBe(false);
    expect(alphaEq(P('λx.λx.x'), P('λy.λz.z'))).toBe(true);
    expect(alphaKey(P('λx.x y'))).toBe(alphaKey(P('λz.z y')));
  });

  it('makes fresh names', () => {
    expect(freshName('y', new Set(['x']))).toBe('y');
    expect(freshName('y', new Set(['y']))).toBe("y'");
    expect(freshName('y', new Set(['y', "y'", "y''", "y'''"]))).toBe('y_1');
  });
});

describe('substitution M[N/x]', () => {
  it('reproduces the book’s example (λw.xxw)[yyz/x] = λw.(yyz)(yyz)w', () => {
    const r = substitute(P('λw.x x w'), 'x', P('y y z'));
    expect(print(r.result)).toBe('λw.y y z (y y z) w');
    expect(alphaEq(r.result, P('λw.(y y z) (y y z) w'))).toBe(true);
    expect(r.replaced).toBe(2);
    expect(r.steps.filter((s) => s.kind === 'replace')).toHaveLength(2);
    expect(r.renamed).toEqual([]);
    expect(r.freeFor).toBe(true);
  });

  it('renames a binder that would capture: (λy.x)[y/x] is λy′.y, not λy.y', () => {
    const m = P('λy.x');
    const r = substitute(m, 'x', P('y'));
    expect(print(r.result)).toBe("λy'.y");
    expect(alphaEq(r.result, P('λy.y'))).toBe(false);
    expect(r.renamed).toEqual([{ binder: m.id, from: 'y', to: "y'" }]);
    expect(r.steps[0]!.kind).toBe('rename');
    expect(r.freeFor).toBe(false);
    expect(r.captures).toEqual([]);
    // the renamed binder keeps its id
    expect(r.result.id).toBe(m.id);
  });

  it('shows the capture that naive substitution causes', () => {
    const m = P('λy.x');
    const r = naiveSubstitute(m, 'x', P('y'));
    expect(print(r.result)).toBe('λy.y');
    expect(r.captures).toHaveLength(1);
    expect(r.captures[0]!.binder).toBe(m.id);
    expect(r.steps.some((s) => s.kind === 'capture')).toBe(true);
    const ff = freeFor(P('y'), 'x', m);
    expect(ff.ok).toBe(false);
    expect(ff.hazards[0]!.variable).toBe('y');
  });

  it('stops at a binder of x and substitutes under other binders', () => {
    const m = P('λx.x');
    const r = substitute(m, 'x', P('y'));
    expect(r.result).toBe(m);
    expect(r.steps.map((s) => s.kind)).toEqual(['binder-stop']);
    const n = substitute(P('λz.x (λx.x) z'), 'x', P('w'));
    expect(print(n.result)).toBe('λz.w (λx.x) z');
    expect(n.replaced).toBe(1);
  });

  it('keeps ids of unchanged subtrees and maps copies back to the substituted term', () => {
    const m = P('(λu.u) (x x)');
    const nTerm = P('f a');
    const r = substitute(m, 'x', nTerm);
    const left = m.k === 'app' ? m.fn : m;
    expect(r.result.k === 'app' && r.result.fn).toBe(left);
    const froms = [...r.origin.values()].filter((o) => o.via === 'term').map((o) => o.from);
    expect(new Set(froms)).toEqual(new Set(ids(nTerm)));
    expect(new Set(ids(r.result)).size).toBe(ids(r.result).length);
  });

  it('renames a binder where needed, deep inside', () => {
    const r = substitute(P('λa.λy.x y a'), 'x', P('λz.y'));
    expect(alphaEq(r.result, P('λa.λw.(λz.y) w a'))).toBe(true);
    expect(freeVars(r.result).has('y')).toBe(true);
  });
});

describe('α-renaming', () => {
  it('renames a chosen binder and its occurrences', () => {
    const t = P('λx.λy.x y');
    const r = alphaRename(t, t.id, 'z');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(print(r.result)).toBe('λz y.z y');
      expect(alphaEq(r.result, t)).toBe(true);
      expect(r.occurrences).toHaveLength(1);
      expect(r.result.id).toBe(t.id);
    }
  });

  it('refuses a name that is free in the body', () => {
    const t = P('λx.x y');
    const r = alphaRename(t, t.id, 'y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/free/);
  });

  it('refuses a name that would be captured by an inner binder', () => {
    const t = P('λx.λy.x');
    const r = alphaRename(t, t.id, 'y');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/captured/);
  });

  it('rejects non-variables and invalid names', () => {
    const t = P('x y');
    expect(alphaRename(t, t.id, 'z').ok).toBe(false);
    const u = P('λx.x');
    expect(alphaRename(u, u.id, 'Z').ok).toBe(false);
  });
});

describe('β-reduction', () => {
  it('does not capture: (λx.λy.x) y reduces to λy′.y, not λy.y', () => {
    const t = P('(λx.λy.x) y');
    const c = contract(t, t.id);
    expect(alphaEq(c.result, P("λy'.y"))).toBe(true);
    expect(alphaEq(c.result, P('λy.y'))).toBe(false);
    expect(c.subst.renamed).toHaveLength(1);
    expect(c.param).toBe('x');
  });

  it('lists redexes with leftmost-outermost / leftmost-innermost flags', () => {
    const t = P('(λx.(λy.y x) z) v');
    const rs = redexes(t);
    expect(rs).toHaveLength(2);
    expect(rs[0]!.id).toBe(t.id);
    expect(rs[0]!.leftmostOutermost).toBe(true);
    expect(rs[0]!.innermost).toBe(false);
    expect(rs[1]!.leftmostInnermost).toBe(true);
    expect(rs[1]!.underLambda).toBe(true);
    expect(rs[1]!.path).toEqual([0, 0]);
    // the book: both ways lead on to z v
    expect(print(contract(t, rs[0]!.id).result)).toBe('(λy.y v) z');
    expect(print(contract(t, rs[1]!.id).result)).toBe('(λx.z x) v');
    expect(() => contract(t, 'nope')).toThrow();
  });

  it('keeps ids of the untouched parts', () => {
    const t = P('w ((λx.x) y)');
    const c = step(t, 'normal')!;
    expect(c.result.id).toBe(t.id);
    expect(t.k === 'app' && c.result.k === 'app' && c.result.fn === t.fn).toBe(true);
  });

  it('reduces the book’s example (λx.xxy)λz.z to y in three steps', () => {
    const r = normalOrder(P('(λx.x x y) λz.z'));
    expect(r.status).toBe('normal-form');
    expect(r.steps.map((s) => print(s.result))).toEqual(['(λz.z) (λz.z) y', '(λz.z) y', 'y']);
  });

  it('reports Ω as out of fuel — never as divergent', () => {
    for (const run of [normalOrder, applicativeOrder, callByName, callByValue]) {
      const r = run(P('(λx.x x) λx.x x'), { fuel: 25 });
      expect(r.status).toBe('out-of-fuel');
      expect(r.count).toBe(25);
      expect(alphaEq(r.final, P('Ω'))).toBe(true);
      expect(r.note).toMatch(/does not show/);
    }
  });

  it('K I Ω: normal order and call by name find I; applicative order and call by value run out of fuel', () => {
    const n = normalOrder(P('K I Ω'));
    expect(n.status).toBe('normal-form');
    expect(alphaEq(n.final, P('λx.x'))).toBe(true);
    expect(n.count).toBe(2);
    const b = callByName(P('K I Ω'));
    expect(b.status).toBe('normal-form');
    expect(alphaEq(b.final, P('I'))).toBe(true);
    expect(applicativeOrder(P('K I Ω'), { fuel: 100 }).status).toBe('out-of-fuel');
    expect(callByValue(P('K I Ω'), { fuel: 100 }).status).toBe('out-of-fuel');
  });

  it('call by name and call by value do not reduce under λ', () => {
    const t = P('λx.(λy.y) x');
    for (const run of [callByName, callByValue]) {
      const r = run(t);
      expect(r.status).toBe('stopped');
      expect(r.count).toBe(0);
    }
    expect(print(normalOrder(t).final)).toBe('λx.x');
    expect(callByName(P('x ((λy.y) z)')).status).toBe('stopped');
    expect(callByValue(P('x ((λy.y) z)')).status).toBe('normal-form');
  });

  it('call by value evaluates the argument first; normal order does not', () => {
    const t = P('(λx.y) ((λz.z) w)');
    expect(strategyRedex(t, 'cbv')).not.toBe(t.id);
    expect(strategyRedex(t, 'normal')).toBe(t.id);
    expect(strategyRedex(t, 'cbn')).toBe(t.id);
    expect(callByValue(t).count).toBe(2);
    expect(normalOrder(t).count).toBe(1);
  });

  it('respects a size limit', () => {
    const r = reduce(P('(λx.x x x) λx.x x x'), 'normal', { fuel: 10_000, maxSize: 200 });
    expect(r.status).toBe('size-limit');
  });

  it('η-reduces λx.f x to f, but not λx.x x', () => {
    const t = P('λx.f x');
    const es = etaRedexes(t);
    expect(es).toHaveLength(1);
    expect(print(etaContract(t, es[0]!.id))).toBe('f');
    expect(etaRedexes(P('λx.x x'))).toHaveLength(0);
  });

  it('decides β-equivalence by normal forms, when they are found', () => {
    expect(betaEquivalent(P('Add 1 1'), P('2'))).toBe(true);
    expect(betaEquivalent(P('Add 1 1'), P('3'))).toBe(false);
    expect(betaEquivalent(P('Ω'), P('Ω'), { fuel: 20 })).toBe(null);
  });
});

describe('Church encodings (chapter “Lambda Definability”)', () => {
  it('encodes and decodes numerals, up to α-equivalence', () => {
    for (let n = 0; n <= 12; n++) {
      expect(numeralValue(churchNumeral(n))).toBe(n);
      expect(decodeNumeral(churchNumeral(n))).toBe(n);
    }
    expect(decodeNumeral(P('λg y.g (g y)'))).toBe(2);
    expect(decodeNumeral(P('λx.λx.x'))).toBe(0);
    expect(decodeNumeral(P('λf.λf.f (f f)'))).toBe(null);
    expect(decodeNumeral(P('λf x.f'))).toBe(null);
    expect(decodeNumeral(P('Ω'), { fuel: 50 })).toBe(null);
  });

  it('computes Succ 0̄ as in the book', () => {
    const r = normalOrder(P('Succ 0'));
    expect(r.steps.map((s) => print(s.result))).toEqual(['λf x.f ((λf x.x) f x)', 'λf x.f ((λx.x) x)', 'λf x.f x']);
    expect(decodeNumeral(r.final)).toBe(1);
  });

  it('adds, multiplies and exponentiates', () => {
    expect(decodeNumeral(P('Add 2 3'))).toBe(5);
    expect(decodeNumeral(P('Mult 2 3'))).toBe(6);
    expect(decodeNumeral(P('Exp 2 3'))).toBe(8);
    expect(decodeNumeral(applyNamed('Add', 2, 3))).toBe(5);
    expect(decodeNumeral(P("Add' 2 3"))).toBe(5);
    expect(decodeNumeral(P("Mult' 2 3"))).toBe(6);
    expect(decodeNumeral(P("Exp' 2 3"))).toBe(8);
    expect(decodeNumeral(P("Succ' 4"))).toBe(5);
    const r = normalOrder(P('Add 2 3'));
    expect(r.status).toBe('normal-form');
    expect(alphaEq(r.final, churchNumeral(5))).toBe(true);
  });

  it('computes predecessor and subtraction with pairs', () => {
    expect(decodeNumeral(P('Pred 3'))).toBe(2);
    expect(decodeNumeral(P('Pred 0'))).toBe(0);
    expect(decodeNumeral(P('Sub 5 2'))).toBe(3);
    expect(decodeNumeral(P('Sub 2 5'))).toBe(0);
  });

  it('has truth values as selectors', () => {
    expect(decodeBoolean(churchBoolean(true))).toBe(true);
    expect(decodeBoolean(P('False'))).toBe(false);
    expect(decodeBoolean(P('IsZero 0'))).toBe(true);
    expect(decodeBoolean(P('IsZero 2'))).toBe(false);
    expect(decodeBoolean(P('Not True'))).toBe(false);
    expect(decodeBoolean(P('Not False'))).toBe(true);
    expect(decodeBoolean(P('And True True'))).toBe(true);
    expect(decodeBoolean(P('And True False'))).toBe(false);
    expect(decodeBoolean(P('And False True'))).toBe(false);
    expect(decodeBoolean(P('λx.x'))).toBe(null);
    expect(print(nf(P('True m n')).final)).toBe('m');
    expect(print(nf(P('False m n')).final)).toBe('n');
  });

  it('has pairs and projections', () => {
    expect(decodeNumeral(P('Fst (Pair 1 2)'))).toBe(1);
    expect(decodeNumeral(P('Snd ⟨1, 2⟩'))).toBe(2);
    const d = decodePair(P('Pair 3 4'));
    expect(d && d.map((x) => numeralValue(x))).toEqual([3, 4]);
    const p = pair(variable('f'), variable('x'));
    expect(p.k === 'abs' && p.param).not.toBe('f');
    expect(print(nf(app(combinator('Fst'), p)).final)).toBe('f');
  });

  it('Turing’s Y: Y g ↠ g (Y g)', () => {
    const y = combinator('Y');
    const t = app(y, variable('g'));
    const r = normalOrder(t, { fuel: 2 });
    expect(r.status).toBe('out-of-fuel');
    expect(alphaEq(r.final, app(variable('g'), app(combinator('Y'), variable('g'))))).toBe(true);
  });

  it('Church’s Y_C: Y_C g and g (Y_C g) reduce to a common term', () => {
    const a = normalOrder(P('Y_C g'), { fuel: 2 }).final;
    const b = normalOrder(P('g (Y_C g)'), { fuel: 1 }).final;
    expect(alphaEq(a, b)).toBe(true);
    expect(alphaEq(a, P('g ((λx.g (x x)) λx.g (x x))'))).toBe(true);
  });

  it('computes the factorial Fac ≡ Y Fac′ by normal order', () => {
    const r = normalOrder(P('Fac 3'), { fuel: 5000, trace: false });
    expect(r.status).toBe('normal-form');
    expect(decodeNumeral(r.final)).toBe(6);
    expect(decodeNumeral(P("Y_C Fac' 2"))).toBe(2);
    // applicative order unfolds Y forever
    expect(applicativeOrder(P('Fac 1'), { fuel: 200, trace: false }).status).not.toBe('normal-form');
  });

  it('builds the terms of the λ-definability proofs', () => {
    expect(decodeNumeral(app(app(app(projection(3, 1), churchNumeral(4)), churchNumeral(5)), churchNumeral(6)))).toBe(5);
    expect(decodeNumeral(app(app(composition(combinator('Succ'), [combinator('Add')], 2), churchNumeral(2)), churchNumeral(3)))).toBe(6);
    // h(x, 0) = x, h(x, y + 1) = h(x, y) + 1: addition by primitive recursion
    const add = primitiveRecursion(P('λx.x'), P('λx y z.Succ z'));
    expect(decodeNumeral(app(app(add, churchNumeral(2)), churchNumeral(3)))).toBe(5);
    // μy [x ∸ y = 0] = x
    const h = minimization(P('Sub'), 1);
    expect(decodeNumeral(app(h, churchNumeral(2)), { fuel: 20_000 })).toBe(2);
    expect(() => composition(variable('f'), [], 1)).toThrow();
  });
});

describe('reduction graphs (Church–Rosser)', () => {
  it('the book’s example (λx.(λy.yx)z)v: two ways, one normal form z v', () => {
    const g = reductionGraph(P('(λx.(λy.y x) z) v'));
    expect(g.complete).toBe(true);
    expect(g.nodes).toHaveLength(4);
    expect(g.edges).toHaveLength(4);
    expect(g.normalForms).toHaveLength(1);
    expect(print(g.nodes[g.normalForms[0]!]!.term)).toBe('z v');
  });

  it('a term with several reduction paths still has a unique normal form', () => {
    const g = reductionGraph(P('(λx.x x) ((λy.y) z)'));
    expect(g.complete).toBe(true);
    expect(g.normalForms).toHaveLength(1);
    expect(print(g.nodes[g.normalForms[0]!]!.term)).toBe('z z');
    expect(g.nodes.length).toBeGreaterThan(3);
    // every node reaches the normal form
    const reach = (i: number, seen = new Set<number>()): boolean => {
      if (g.normalForms.includes(i)) return true;
      seen.add(i);
      return g.edges.some((e) => e.from === i && !seen.has(e.to) && reach(e.to, seen));
    };
    expect(g.nodes.every((n) => reach(n.index))).toBe(true);
  });

  it('Ω is a single term with a loop and no normal form; (λx.y)Ω has one', () => {
    const g = reductionGraph(P('Ω'));
    expect(g.nodes).toHaveLength(1);
    expect(g.edges).toEqual([expect.objectContaining({ from: 0, to: 0 })]);
    expect(g.normalForms).toEqual([]);
    const h = reductionGraph(P('(λx.y) Ω'));
    expect(h.complete).toBe(true);
    expect(h.normalForms.map((i) => print(h.nodes[i]!.term))).toEqual(['y']);
  });

  it('is bounded', () => {
    const g = reductionGraph(P('(λx.x x x) λx.x x x'), { maxNodes: 5 });
    expect(g.complete).toBe(false);
    expect(g.nodes.length).toBeLessThanOrEqual(5);
  });
});

describe('constructors', () => {
  it('builds terms with fresh ids', () => {
    const t = lam('x', app(variable('x'), variable('x')));
    expect(print(t)).toBe('λx.x x');
    expect(new Set(ids(t)).size).toBe(4);
  });
});
