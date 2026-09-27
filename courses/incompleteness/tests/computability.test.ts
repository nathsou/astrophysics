import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { arity, evaluate, R, type RF } from '../src/engine/recursive/rf.ts';
import * as Lib from '../src/engine/computability/library.ts';
import { ackermann, bigG, gHierarchy } from '../src/engine/computability/ackermann.ts';
import { beta, betaCodes, encodeWithBeta, gcd, isqrt, J, K, L, leastBetaCode, primRecViaBeta, unpair } from '../src/engine/computability/beta.ts';
import {
  decodeIndex,
  diagonalize,
  diagonalTable,
  enumerateUnary,
  haltsWithin,
  indexOf,
  phi,
  sameDefinition,
  showDefinition,
  stripDefs,
  termOf,
} from '../src/engine/computability/indices.ts';

const run = (f: RF, args: bigint[], fuel = 2_000_000): bigint | undefined => {
  const r = evaluate(f, args, { fuel, maxTraceDepth: -1 });
  return r.status === 'ok' ? r.value : undefined;
};

/** Only zero, succ, projections, composition and primitive recursion (and named definitions). */
function isPrimitiveRecursiveTerm(f: RF): boolean {
  switch (f.k) {
    case 'zero':
    case 'succ':
    case 'proj':
      return true;
    case 'basic':
    case 'min':
      return false;
    case 'def':
      return isPrimitiveRecursiveTerm(f.body);
    case 'comp':
      return isPrimitiveRecursiveTerm(f.f) && f.gs.every(isPrimitiveRecursiveTerm);
    case 'rec':
      return isPrimitiveRecursiveTerm(f.f) && isPrimitiveRecursiveTerm(f.g);
  }
}

function tuples(arityN: number, max: number): bigint[][] {
  if (arityN === 0) return [[]];
  const rest = tuples(arityN - 1, max);
  const out: bigint[][] = [];
  for (let v = 0; v <= max; v++) for (const t of rest) out.push([BigInt(v), ...t]);
  return out;
}

describe('library of primitive recursive functions', () => {
  const ranges: Record<string, number> = { exp: 3, fac: 5, cond: 3, divides: 5, Prime: 7 };
  for (const entry of Lib.LIBRARY) {
    it(`${entry.name}: ${entry.note}`, () => {
      const f = entry.build();
      expect(arity(f)).toEqual({ ok: true, arity: entry.arity });
      expect(isPrimitiveRecursiveTerm(f)).toBe(true);
      for (const args of tuples(entry.arity, ranges[entry.name] ?? 6)) {
        expect(run(f, args), `${entry.name}(${args.join(', ')})`).toBe(entry.spec(args));
      }
    });
  }

  it('returns fresh terms each time', () => {
    expect(Lib.add().id).not.toBe(Lib.add().id);
    expect(sameDefinition(Lib.add(), Lib.add())).toBe(true);
  });

  it('pred follows the book: pred′(zero(y), y) with a dummy parameter', () => {
    const p = Lib.pred();
    expect(p.k).toBe('def');
    expect(showDefinition(stripDefs(p))).toBe('Comp(Rec(zero, P^3_1); zero, P^1_0)');
  });

  it('constants with several arguments', () => {
    const c = Lib.constN(4, 3);
    expect(arity(c)).toEqual({ ok: true, arity: 3 });
    expect(run(c, [7n, 8n, 9n])).toBe(4n);
  });

  it('Boolean combinations of relations', () => {
    const lt = Lib.chiLt();
    const eq = Lib.chiEq();
    const le = Lib.charOr(lt, eq);
    const notLt = Lib.charNot(Lib.chiLt());
    const both = Lib.charAnd(Lib.chiLeq(), Lib.charNot(Lib.chiEq()));
    const imp = Lib.charImplies(Lib.chiEq(), Lib.chiLeq());
    for (const [x, y] of tuples(2, 4)) {
      expect(run(le, [x, y])).toBe(x <= y ? 1n : 0n);
      expect(run(notLt, [x, y])).toBe(x < y ? 0n : 1n);
      expect(run(both, [x, y])).toBe(x < y ? 1n : 0n);
      expect(run(imp, [x, y])).toBe(1n);
    }
    expect(() => Lib.charAnd(Lib.chiEq(), Lib.isZero())).toThrow();
  });

  it('definition by cases', () => {
    // f(x) = 10 if x = 0; x + x if x < 3; x otherwise.
    const isZ = Lib.isZero();
    const lt3 = R.comp(Lib.chiLt(), [R.proj(1, 0), Lib.constN(3)]);
    const f = Lib.byCases(
      [
        { rel: isZ, fn: Lib.constN(10) },
        { rel: lt3, fn: R.comp(Lib.add(), [R.proj(1, 0), R.proj(1, 0)]) },
      ],
      Lib.id(),
      { name: 'f', tex: 'f' },
    );
    expect(arity(f)).toEqual({ ok: true, arity: 1 });
    expect([0n, 1n, 2n, 3n, 4n, 5n].map((x) => run(f, [x]))).toEqual([10n, 2n, 4n, 3n, 4n, 5n]);
  });

  it('bounded quantifiers (with and without parameters)', () => {
    // R(x, z) ⟺ z + z = x (x is even, witnessed below the bound)
    const r = R.comp(Lib.chiEq(), [R.comp(Lib.add(), [R.proj(2, 1), R.proj(2, 1)]), R.proj(2, 0)]);
    const ex = Lib.bexists(r);
    const all = Lib.bforall(r);
    const exLeq = Lib.bexistsLeq(r);
    expect(arity(ex)).toEqual({ ok: true, arity: 2 });
    for (const [x, y] of tuples(2, 5)) {
      const zs = Array.from({ length: Number(y) }, (_, z) => BigInt(z));
      expect(run(ex, [x, y])).toBe(zs.some((z) => 2n * z === x) ? 1n : 0n);
      expect(run(all, [x, y])).toBe(zs.every((z) => 2n * z === x) ? 1n : 0n);
      expect(run(exLeq, [x, y])).toBe([...zs, y].some((z) => 2n * z === x) ? 1n : 0n);
    }
    // One-place relation: ∀z < y (z ≤ 3), via the dummy-parameter trick.
    const small = R.comp(Lib.chiLeq(), [R.proj(1, 0), Lib.constN(3)]);
    const allSmall = Lib.bforall(small);
    expect(arity(allSmall)).toEqual({ ok: true, arity: 1 });
    expect([0n, 1n, 4n, 5n, 6n].map((y) => run(allSmall, [y]))).toEqual([1n, 1n, 1n, 0n, 0n]);
  });

  it('bounded minimization returns the least z < y, or y', () => {
    // R(x, z) ⟺ x ≤ z + z
    const r = R.comp(Lib.chiLeq(), [R.proj(2, 0), R.comp(Lib.add(), [R.proj(2, 1), R.proj(2, 1)])]);
    const m = Lib.bmin(r);
    for (const [x, y] of tuples(2, 6)) {
      let expected = y;
      for (let z = 0n; z < y; z++)
        if (x <= 2n * z) {
          expected = z;
          break;
        }
      expect(run(m, [x, y]), `m(${x}, ${y})`).toBe(expected);
    }
    // unary relation: least z < y with z ≥ 2
    const m1 = Lib.bmin(R.comp(Lib.chiLeq(), [Lib.constN(2), R.proj(1, 0)]));
    expect([0n, 1n, 2n, 3n, 5n].map((y) => run(m1, [y]))).toEqual([0n, 1n, 2n, 2n, 2n]);
  });
});

describe('Ackermann–Péter', () => {
  it('the g-hierarchy of the book: g₁(x) = 2x, g₂(x) = 2^x·x', () => {
    for (let x = 0n; x <= 6n; x++) {
      expect(gHierarchy(0, x)).toMatchObject({ status: 'ok', value: x + 1n });
      expect(gHierarchy(1, x)).toMatchObject({ status: 'ok', value: 2n * x });
      expect(gHierarchy(2, x)).toMatchObject({ status: 'ok', value: 2n ** x * x });
    }
    expect([0, 1, 2].map((x) => (bigG(x) as { value?: bigint }).value)).toEqual([1n, 2n, 8n]);
    const g3 = bigG(3, { fuel: 50_000 });
    expect(g3.status).toBe('out-of-fuel');
    expect(g3.steps).toBe(50_000);
  });

  it('keeps a bounded trace', () => {
    const r = gHierarchy(2, 3, { maxTrace: 10 });
    expect(r.trace.length).toBe(10);
    expect(r.traceTruncated).toBe(true);
    expect(r.trace[0]).toMatchObject({ n: 2, x: 3n, value: 24n, depth: 0 });
    expect(r.trace[0].note).toBe('g₂(3) = g₁(g₁(g₁(3)))');
  });

  it('A(m, n) for small values', () => {
    const closed = [(n: bigint) => n + 1n, (n: bigint) => n + 2n, (n: bigint) => 2n * n + 3n, (n: bigint) => 2n ** (n + 3n) - 3n];
    for (let m = 0; m <= 3; m++)
      for (let n = 0n; n <= 4n; n++) {
        const r = ackermann(m, n, { fuel: 1_000_000 });
        expect(r.status).toBe('ok');
        expect(r.status === 'ok' && r.value).toBe(closed[m](n));
      }
    const t = ackermann(1, 1);
    expect(t.trace.map((s) => s.expr)).toEqual(['A(1, 1)', 'A(0, A(1, 0))', 'A(0, A(0, 1))', 'A(0, 2)']);
    expect(ackermann(4, 2, { fuel: 10_000 }).status).toBe('out-of-fuel');
  });
});

describe('the β-function', () => {
  it('pairing J with inverses K, L', () => {
    for (let x = 0n; x < 30n; x++) for (let y = 0n; y < 30n; y++) expect(unpair(J(x, y))).toEqual({ x, y });
    for (let z = 0n; z < 500n; z++) expect(J(K(z), L(z))).toBe(z);
    const big = 12345678901234567890123456789n;
    expect(isqrt(big * big)).toBe(big);
    expect(isqrt(big * big - 1n)).toBe(big - 1n);
  });

  it('encodes a short sequence by the book’s construction', () => {
    const enc = encodeWithBeta([2, 0, 3]);
    expect(enc.n).toBe(2);
    expect(enc.j).toBe(4n); // max(2, 3, 1, 4)
    expect(enc.d1).toBe(12n); // lcm(1, 2, 3, 4)
    expect(enc.moduli).toEqual([13n, 25n, 37n]);
    expect(enc.pairwiseCoprime).toBe(true);
    expect(enc.d0 % 13n).toBe(2n);
    expect(enc.d0 % 25n).toBe(0n);
    expect(enc.d0 % 37n).toBe(3n);
    expect(enc.d0 < 13n * 25n * 37n).toBe(true);
    expect(enc.d).toBe(J(enc.d0, 12n));
    expect(enc.ok).toBe(true);
    expect(enc.crt).toHaveLength(3);
    expect(enc.explanation.length).toBeGreaterThan(4);
  });

  it('Gödel’s factorial variant works too', () => {
    const enc = encodeWithBeta([5, 1, 4, 1], { d1Rule: 'factorial' });
    expect(enc.d1).toBe(720n); // 6!
    expect(enc.ok).toBe(true);
  });

  it('decodes random short sequences', () => {
    fc.assert(
      fc.property(fc.array(fc.nat({ max: 40 }), { minLength: 1, maxLength: 8 }), (xs) => {
        const enc = encodeWithBeta(xs);
        expect(enc.ok).toBe(true);
        expect(enc.pairs.every((p) => gcd(enc.moduli[p.i], enc.moduli[p.k]) === 1n)).toBe(true);
        xs.forEach((a, i) => expect(beta(enc.d, i)).toBe(BigInt(a)));
      }),
      { numRuns: 200 },
    );
  });

  it('finds the least code by search, as the minimization would', () => {
    const r = leastBetaCode([2]);
    expect(r).toEqual({ found: true, d: 12n }); // J(2, 2): d₀ = 2, d₁ = 2
    const r2 = leastBetaCode([1, 0, 1], 100_000n);
    expect(r2.found).toBe(true);
    if (r2.found) {
      expect(betaCodes(r2.d, [1, 0, 1])).toBe(true);
      for (let d = 0n; d < r2.d; d++) expect(betaCodes(d, [1, 0, 1])).toBe(false);
      expect(r2.d <= encodeWithBeta([1, 0, 1]).d).toBe(true);
    }
    expect(leastBetaCode([50, 50, 50], 1000n)).toEqual({ found: false, searchedBelow: 1000n });
  });

  it('simulates primitive recursion: h(x⃗, y) = β(ĥ(x⃗, y), y)', () => {
    const cases: [RF, bigint[], bigint][] = [
      [Lib.add(), [2n, 3n], 5n],
      [Lib.mult(), [3n, 4n], 12n],
      [Lib.exp(), [2n, 5n], 32n],
      [Lib.tsub(), [7n, 3n], 4n],
    ];
    for (const [h, args, value] of cases) {
      const r = primRecViaBeta(h, args);
      if (!r.ok) throw new Error(r.reason);
      expect(r.verified).toBe(true);
      expect(r.value).toBe(value);
      expect(r.values).toHaveLength(Number(args[args.length - 1]) + 1);
      expect(r.values[r.values.length - 1]).toBe(value);
      expect(r.base.ok && r.conditions.every((c) => c.ok)).toBe(true);
    }
    const small = primRecViaBeta(Lib.add(), [1n, 1n], { searchLeastBelow: 1_000_000n });
    if (!small.ok) throw new Error(small.reason);
    expect(small.values).toEqual([1n, 2n]);
    expect(small.least?.found).toBe(true);
    if (small.least?.found) expect(betaCodes(small.least.d, [1n, 2n])).toBe(true);
    expect(primRecViaBeta(Lib.dist(), [1n, 2n])).toMatchObject({ ok: false });
  });
});

describe('indices', () => {
  it('the coding is a bijection on small indices', () => {
    for (let e = 0n; e < 3000n; e++) expect(indexOf(termOf(e))).toBe(e);
    expect(indexOf(R.zero())).toBe(0n);
    expect(indexOf(R.succ())).toBe(1n);
    expect(indexOf(R.proj(1, 0))).toBe(2n);
    expect(indexOf(R.min(R.proj(2, 1)))).toBe(45n);
  });

  it('round-trips the library definitions', () => {
    for (const entry of Lib.LIBRARY.slice(0, 12)) {
      const f = entry.build();
      const e = indexOf(f);
      const d = decodeIndex(e);
      expect(d.ok).toBe(true);
      if (d.ok) {
        expect(d.arity).toBe(entry.arity);
        expect(sameDefinition(d.rf, stripDefs(f))).toBe(true);
      }
    }
    expect(() => indexOf(R.basic('add'))).toThrow();
  });

  it('reports ill-formed definitions', () => {
    const d = decodeIndex(4n); // Rec(zero, zero)
    expect(d.ok).toBe(false);
    expect(phi(4n, 0n)).toMatchObject({ kind: 'notAFunction' });
    expect(phi(5n, 0n)).toMatchObject({ kind: 'notAFunction' }); // Min(zero) has no arguments
  });

  it('enumerates the unary definitions in index order', () => {
    const us = enumerateUnary({ maxIndex: 500n });
    expect(us.slice(0, 4).map((u) => u.e)).toEqual([0n, 1n, 2n, 3n]);
    for (let i = 1; i < us.length; i++) expect(us[i].e > us[i - 1].e).toBe(true);
    for (const u of us) expect(arity(u.rf)).toEqual({ ok: true, arity: 1 });
    const count = us.length;
    let direct = 0;
    for (let e = 0n; e <= 500n; e++) {
      const d = decodeIndex(e);
      if (d.ok && d.arity === 1) direct++;
    }
    expect(count).toBe(direct);
    expect(enumerateUnary({ count: 5 })).toHaveLength(5);
  });

  it('φₑ(x) with fuel: values, out of fuel, never "undefined"', () => {
    expect(phi(1n, 7n)).toMatchObject({ kind: 'value', value: 8n });
    // Min(P^2_1): μx P^2_1(x, z) = 0 if z = 0, and a search that never ends otherwise.
    expect(phi(45n, 0n)).toMatchObject({ kind: 'value', value: 0n });
    expect(phi(45n, 3n, 500)).toMatchObject({ kind: 'outOfFuel' });
    const add = Lib.add();
    const e = indexOf(R.comp(add, [R.proj(1, 0), R.proj(1, 0)]));
    expect(phi(e, 21n)).toMatchObject({ kind: 'value', value: 42n });
    expect(haltsWithin(45n, 0n, 10)).toMatchObject({ halts: true, value: 0n });
    expect(haltsWithin(45n, 1n, 100)).toMatchObject({ halts: false, reason: 'out-of-fuel' });
    expect(haltsWithin(4n, 1n, 100)).toMatchObject({ halts: false, reason: 'not-a-function' });
  });

  it('builds the table of φₑ(x)', () => {
    const t = diagonalTable(10, 6, 1000);
    expect(t).toHaveLength(10);
    expect(t[1].cells.map((c) => (c.kind === 'value' ? c.value : null))).toEqual([1n, 2n, 3n, 4n, 5n, 6n]);
    const u = diagonalTable(8, 4, 1000, { rows: 'unary' });
    expect(u.every((row) => row.cells.every((c) => c.kind !== 'notAFunction'))).toBe(true);
  });

  it('the diagonal function differs from every row it could be checked against', () => {
    for (const rows of ['indices', 'unary'] as const) {
      const { table, diagonal } = diagonalize(50, 50, 2000, { rows });
      let fullyComputed = 0;
      diagonal.forEach((entry, x) => {
        const cell = table[x].cells[x];
        if (cell.kind === 'value') {
          expect(entry.d).toBe(cell.value + 1n);
          expect(entry.differs).toBe(true);
        } else if (cell.kind === 'outOfFuel') {
          expect(entry.d).toBe('unknown');
          expect(entry.differs).toBe('unknown');
        } else {
          expect(entry.d).toBe(1n); // the book's convention: such rows are the constant 0 function
        }
        if (entry.rowFullyComputed) {
          fullyComputed++;
          const row = table[x].cells.map((c) => (c.kind === 'value' ? c.value : null));
          const d = diagonal.map((de) => de.d);
          expect(row.some((v, i) => typeof d[i] === 'bigint' && v !== d[i])).toBe(true);
        }
      });
      expect(fullyComputed).toBeGreaterThan(5);
      expect(diagonal.some((de) => de.d === 'unknown')).toBe(true); // partial functions do occur
    }
    const excl = diagonalize(10, 10, 500, { nonFunctionRows: 'excluded' });
    expect(excl.diagonal[4]).toMatchObject({ d: 'n/a', differs: 'n/a' });
  });
});
