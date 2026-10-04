import { describe, expect, it } from 'vitest';
import { add, and, app, arraySort, bvbin, bvnum, bvSort, eq, forall, ge, gt, INT, le, lt, mul, not, num, or, select, store, sub, uSort, v, imp, div, mod, smtlibScript, type Term } from '../logic/term';
import { checkSat } from './solver';

const x = v('x');
const y = v('y');
const z = v('z');

describe('SMT: linear integer arithmetic', () => {
  it('finds models and refutes', () => {
    expect(checkSat([gt(x, num(2)), lt(x, num(5)), eq(add(x, y), num(10))]).status).toBe('sat');
    expect(checkSat([gt(x, num(2)), lt(x, num(3))]).status).toBe('unsat');
    expect(checkSat([eq(mul(num(2), x), add(mul(num(2), y), num(1)))]).status).toBe('unsat');
  });
  it('needs branch and bound', () => {
    // 3x + 3y = 4 has rational but no integer solutions … gcd reasoning; and 2 ≤ 3x ≤ 2... 
    expect(checkSat([le(num(1), mul(num(3), x)), le(mul(num(3), x), num(2))]).status).toBe('unsat');
    expect(checkSat([ge(add(mul(num(2), x), mul(num(4), y)), num(1)), le(add(mul(num(2), x), mul(num(4), y)), num(1))]).status).toBe('unsat');
  });
  it('handles disequalities and Boolean structure', () => {
    expect(checkSat([ge(x, num(0)), le(x, num(1)), not(eq(x, num(0))), not(eq(x, num(1)))]).status).toBe('unsat');
    expect(checkSat([or(lt(x, num(0)), gt(x, num(10))), ge(x, num(0)), le(x, num(10))]).status).toBe('unsat');
  });
  it('handles division by constants', () => {
    expect(checkSat([eq(div(x, num(2)), num(3)), gt(x, num(7))]).status).toBe('unsat');
    expect(checkSat([eq(mod(x, num(3)), num(2)), eq(div(x, num(3)), num(1))]).status).toBe('sat');
  });
});

describe('SMT: equality and functions', () => {
  const U = uSort('U');
  const a = v('a', U);
  const b = v('b', U);
  const c = v('c', U);
  const f = (t: Term) => app('f', [t], U);
  it('congruence', () => {
    expect(checkSat([eq(a, b), not(eq(f(a), f(b)))]).status).toBe('unsat');
    expect(checkSat([eq(f(f(f(a))), a), eq(f(f(f(f(f(a))))), a), not(eq(f(a), a))]).status).toBe('unsat');
    expect(checkSat([eq(a, b), not(eq(b, c))]).status).toBe('sat');
  });
  it('combines with arithmetic', () => {
    const g = (t: Term) => app('g', [t], INT);
    expect(checkSat([eq(x, y), not(eq(g(x), g(y)))]).status).toBe('unsat');
    expect(checkSat([le(x, y), le(y, x), not(eq(g(x), g(y)))]).status).toBe('unsat');
    expect(checkSat([eq(g(add(x, num(1))), num(3)), eq(y, add(x, num(1))), eq(g(y), num(4))]).status).toBe('unsat');
  });
});

describe('SMT: arrays', () => {
  const A = v('A', arraySort(INT, INT));
  it('read over write', () => {
    expect(checkSat([not(eq(select(store(A, x, num(5)), x), num(5)))]).status).toBe('unsat');
    expect(checkSat([not(eq(x, y)), not(eq(select(store(A, x, num(5)), y), select(A, y)))]).status).toBe('unsat');
    expect(checkSat([eq(select(store(A, x, num(5)), y), num(6))]).status).toBe('sat');
  });
});

describe('SMT: bit-vectors', () => {
  const p = v('p', bvSort(8));
  const q = v('q', bvSort(8));
  it('overflow and signedness', () => {
    // p + 1 < p (unsigned) only when p = 255.
    expect(checkSat([bvbin('bvult', bvbin('bvadd', p, bvnum(1n, 8)), p), not(eq(p, bvnum(255n, 8)))]).status).toBe('unsat');
    expect(checkSat([bvbin('bvslt', bvbin('bvadd', p, bvnum(1n, 8)), p)]).status).toBe('sat');
    expect(checkSat([eq(bvbin('bvmul', p, q), bvnum(143n, 8)), bvbin('bvult', bvnum(1n, 8), p), bvbin('bvult', bvnum(1n, 8), q), bvbin('bvult', p, bvnum(16n, 8)), bvbin('bvult', q, bvnum(16n, 8))]).status).toBe('sat');
  });
});

describe('SMT: quantifiers', () => {
  const A = v('A', arraySort(INT, INT));
  const i = v('i');
  const j = v('j');
  it('instantiates by E-matching', () => {
    // All elements of A in [0, n) are positive; A[k] ≤ 0 for some k in range: unsat.
    const n = v('n');
    const k = v('k');
    const all = forall([i], imp(and(le(num(0), i), lt(i, n)), gt(select(A, i), num(0))));
    expect(checkSat([all, le(num(0), k), lt(k, n), le(select(A, k), num(0))]).status).toBe('unsat');
  });
  it('sortedness', () => {
    const n = v('n');
    const sorted = forall([i, j], imp(and(le(num(0), i), le(i, j), lt(j, n)), le(select(A, i), select(A, j))));
    expect(checkSat([sorted, le(num(0), x), lt(x, y), lt(y, n), gt(select(A, x), select(A, y))]).status).toBe('unsat');
    void sub;
    void smtlibScript;
  });
});

// ── Differential testing against Z3, with every unsat certificate re-checked ──
import { rng } from '../util/random';
import { z3Check } from '../testing/z3';
import { checkUnsatCertificate } from './check/certificate';
import { iff, ite } from '../logic/term';

function randomFormula(r: ReturnType<typeof rng>, withUf: boolean): Term[] {
  const vars = [v('x'), v('y'), v('z'), v('w')];
  const f = (t: Term) => app('f', [t], INT);
  const term = (d: number): Term => {
    const k = r.int(0, d > 0 ? 5 : 2);
    if (k === 0) return num(r.int(-4, 5));
    if (k <= 2 || d === 0) return r.pick(vars);
    if (k === 3) return add(term(d - 1), term(d - 1));
    if (k === 4) return mul(num(r.int(-3, 4)), term(d - 1));
    return withUf ? f(term(d - 1)) : sub(term(d - 1), term(d - 1));
  };
  const atom = (): Term => {
    const a = term(2);
    const b = term(2);
    return r.pick([le, lt, eq, ge])(a, b);
  };
  const formula = (d: number): Term => {
    if (d === 0) return atom();
    const k = r.int(0, 6);
    if (k === 0) return not(formula(d - 1));
    if (k === 1) return or(formula(d - 1), formula(d - 1));
    if (k === 2) return imp(formula(d - 1), formula(d - 1));
    if (k === 3) return iff(formula(d - 1), formula(d - 1));
    if (k === 4) return eq(ite(formula(d - 1), term(1), term(1)), term(1));
    return atom();
  };
  return Array.from({ length: r.int(2, 6) }, () => formula(2));
}

describe('SMT: agrees with Z3', () => {
  for (const withUf of [false, true]) {
    it(`random ${withUf ? 'UFLIA' : 'LIA'} formulas, certified`, async () => {
      const r = rng(withUf ? 77 : 42);
      let unsat = 0;
      for (let n = 0; n < 150; n++) {
        const fs = randomFormula(r, withUf);
        const ours = checkSat(fs, { proof: true });
        const theirs = await z3Check(smtlibScript(fs));
        expect(ours.status, smtlibScript(fs)).toBe(theirs);
        if (ours.status === 'unsat') {
          unsat++;
          const c = checkUnsatCertificate(ours.proof!);
          expect(c.ok, `${c.message}\n${smtlibScript(fs)}`).toBe(true);
        }
      }
      expect(unsat).toBeGreaterThan(20);
    }, 120000);
  }
});

describe('SMT certificates', () => {
  const A = v('A', arraySort(INT, INT));
  const i = v('i');
  const n = v('n');
  const k = v('k');
  const cases: [string, Term[]][] = [
    ['arith', [gt(x, num(2)), lt(x, num(3))]],
    ['euf+arith', [eq(x, y), not(eq(app('g', [x], INT), app('g', [y], INT)))]],
    ['arrays', [not(eq(x, y)), not(eq(select(store(A, x, num(5)), y), select(A, y)))]],
    ['quantifier', [forall([i], imp(and(le(num(0), i), lt(i, n)), gt(select(A, i), num(0)))), le(num(0), k), lt(k, n), le(select(A, k), num(0))]],
    ['bit-vectors', [bvbin('bvult', bvbin('bvadd', v('p', bvSort(4)), bvnum(1n, 4)), v('p', bvSort(4))), not(eq(v('p', bvSort(4)), bvnum(15n, 4)))]],
  ];
  for (const [name, fs] of cases) {
    it(`checks the ${name} certificate`, () => {
      const r = checkSat(fs, { proof: true });
      expect(r.status).toBe('unsat');
      const c = checkUnsatCertificate(r.proof!);
      expect(c.ok, c.message).toBe(true);
    });
  }
  it('rejects a tampered Farkas certificate', () => {
    const r = checkSat([gt(x, num(2)), lt(x, num(3))], { proof: true });
    for (const j of r.proof!.justifications.values()) if (j.kind === 'farkas') j.coeffs = j.coeffs.map(([l, c]) => [l, c.add(c)] as [number, typeof c]).slice(1);
    expect(checkUnsatCertificate(r.proof!).ok).toBe(false);
  });
});

describe('SMT: bit-vectors agree with Z3', () => {
  it('random 4-bit formulas', async () => {
    const r = rng(5);
    const W = 4;
    const vars = [v('a', bvSort(W)), v('b', bvSort(W)), v('c', bvSort(W))];
    const ops = ['bvadd', 'bvsub', 'bvmul', 'bvudiv', 'bvurem', 'bvsdiv', 'bvsrem', 'bvand', 'bvor', 'bvxor', 'bvshl', 'bvlshr', 'bvashr'] as const;
    const term = (d: number): Term => (d === 0 || r.chance(0.3) ? (r.chance(0.3) ? bvnum(BigInt(r.int(0, 16)), W) : r.pick(vars)) : bvbin(r.pick([...ops]), term(d - 1), term(d - 1)));
    const atom = () => (r.chance(0.3) ? eq(term(2), term(2)) : bvbin(r.pick(['bvult', 'bvule', 'bvslt', 'bvsle']), term(2), term(2)));
    let unsat = 0;
    for (let n = 0; n < 120; n++) {
      const fs = Array.from({ length: r.int(1, 4) }, () => (r.chance(0.3) ? not(atom()) : atom()));
      const ours = checkSat(fs, { proof: true });
      const theirs = await z3Check(smtlibScript(fs));
      expect(ours.status, smtlibScript(fs)).toBe(theirs);
      if (ours.status === 'unsat') {
        unsat++;
        expect(checkUnsatCertificate(ours.proof!).ok).toBe(true);
      }
    }
    expect(unsat).toBeGreaterThan(5);
  }, 120000);
});

describe('non-linear integer arithmetic (incremental linearisation)', () => {
  it('proves simple product facts with checked certificates', async () => {
    const { v, mul, ge, lt, le, eq, num, and } = await import('../logic/term');
    const { SmtSolver } = await import('./solver');
    const { checkUnsatCertificate } = await import('./check/certificate');
    const x = v('x');
    const y = v('y');
    for (const f of [lt(mul(x, x), num(0)), and(ge(x, num(2)), le(x, num(3)), ge(y, num(2)), le(y, num(3)), eq(mul(x, y), num(5))), and(ge(x, num(1)), ge(y, num(1)), lt(mul(x, y), num(0)))]) {
      const s = new SmtSolver({ proof: true });
      s.assert(f);
      const r = s.solve();
      expect(r.status).toBe('unsat');
      expect(checkUnsatCertificate(r.proof!).ok).toBe(true);
    }
  });
  it('agrees with brute force on bounded random products', async () => {
    const { v, mul, add, ge, le, eq, num, and, or, not } = await import('../logic/term');
    const { SmtSolver } = await import('./solver');
    const { checkUnsatCertificate } = await import('./check/certificate');
    const { rng } = await import('../util/random');
    const r = rng(1970);
    const x = v('x');
    const y = v('y');
    const z = v('z');
    for (let t = 0; t < 40; t++) {
      const lits = [];
      const vars = [x, y, z];
      const pick = () => r.pick(vars);
      for (let i = 0; i < 3; i++) {
        const lhs = r.chance(0.6) ? mul(pick(), pick()) : add(pick(), mul(num(r.int(-3, 4)), pick()));
        const k = num(r.int(-6, 10));
        const atom = r.chance(0.5) ? le(lhs, k) : eq(lhs, k);
        lits.push(r.chance(0.3) ? not(atom) : atom);
      }
      const bounds = vars.flatMap((w) => [ge(w, num(-3)), le(w, num(3))]);
      const f = and(...bounds, or(lits[0]!, lits[1]!), lits[2]!);
      // Brute force over the box.
      let sat = false;
      const val = (term: import('../logic/term').Term, env: Map<string, bigint>): bigint => {
        if (term.op === 'num') return term.value!;
        if (term.op === 'var') return env.get(term.name!)!;
        if (term.op === 'mul') return val(term.args[0]!, env) * val(term.args[1]!, env);
        if (term.op === 'add') return term.args.reduce((s, a) => s + val(a, env), 0n);
        throw new Error(term.op);
      };
      const holds = (term: import('../logic/term').Term, env: Map<string, bigint>): boolean => {
        switch (term.op) {
          case 'and': return term.args.every((a) => holds(a, env));
          case 'or': return term.args.some((a) => holds(a, env));
          case 'not': return !holds(term.args[0]!, env);
          case 'le': return val(term.args[0]!, env) <= val(term.args[1]!, env);
          case 'ge': return val(term.args[0]!, env) >= val(term.args[1]!, env);
          case 'eq': return val(term.args[0]!, env) === val(term.args[1]!, env);
          case 'true': return true;
          case 'false': return false;
        }
        throw new Error(term.op);
      };
      for (let a = -3n; a <= 3n && !sat; a++) for (let b = -3n; b <= 3n && !sat; b++) for (let c = -3n; c <= 3n && !sat; c++) if (holds(f, new Map([['x', a], ['y', b], ['z', c]]))) sat = true;
      const s = new SmtSolver({ proof: true });
      s.assert(f);
      const res = s.solve();
      if (res.status !== (sat ? 'sat' : 'unsat')) { const { smtlib } = await import('../logic/term'); console.log('FAILCASE', smtlib(f), JSON.stringify([...(res.model?.vars ?? [])].map(([k, v]) => [k, String(v)]))); }
      expect(res.status).toBe(sat ? 'sat' : 'unsat');
      if (res.status === 'unsat') expect(checkUnsatCertificate(res.proof!).ok).toBe(true);
    }
  });
});
