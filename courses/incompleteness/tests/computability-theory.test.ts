import { describe, expect, it } from 'vitest';
import { R } from '../src/engine/recursive/rf.ts';
import * as Lib from '../src/engine/computability/library.ts';
import { decodeIndex, indexOf, phi, termOf } from '../src/engine/computability/indices.ts';
import {
  checkRecord,
  computationRecord,
  countNodes,
  decodeRecord,
  describeCodeSize,
  encodeRecord,
  flattenRecord,
  recordCodeSize,
  recordFromIndex,
  searchNormalForm,
  seqCode,
  seqDecode,
  shapeOf,
  T,
  U,
} from '../src/engine/computability/records.ts';
import { certainlyUndefined, ignoresArg, neverZero, nowhereDefined } from '../src/engine/computability/divergence.ts';
import { compareSmn, compIndex, constIndex, constIndexN, padIndex, projIndex, runIndex, smn } from '../src/engine/computability/smn.ts';
import {
  bookRangeFunction,
  boundedDeciderCounterexample,
  enumerateK,
  enumerateK0,
  enumerateW,
  inverseSearch,
  race,
  rangeEnumeration,
  witnessPair,
} from '../src/engine/computability/ce.ts';
import { copies, craigElement, inGamma, readings } from '../src/engine/computability/craig.ts';
import { parseFormula } from '../src/engine/syntax/parse.ts';
import { formulaEq } from '../src/engine/syntax/ops.ts';

const P = R.proj;

/** Parity: par(0) = 0, par(y + 1) = IsZero(par(y)) — with the book's dummy parameter. */
function parity() {
  const parP = R.rec(R.zero(), R.comp(Lib.isZero(), [P(3, 2)]));
  return R.comp(parP, [R.zero(), P(1, 0)]);
}
/** Halts (with 0) exactly on the even numbers: μz par(x). */
const haltsOnEvens = () => R.min(R.comp(parity(), [P(2, 1)]));
/** Halts exactly on the odd numbers: μz IsZero(par(x)). */
const haltsOnOdds = () => R.min(R.comp(Lib.isZero(), [R.comp(parity(), [P(2, 1)])]));

describe('shapes of indices', () => {
  it('agree with termOf on the top constructor and the parts', () => {
    for (let e = 0n; e < 3000n; e++) {
      const s = shapeOf(e);
      const t = termOf(e);
      expect(s.k).toBe(t.k);
      if (s.k === 'comp' && t.k === 'comp') {
        expect(s.f).toBe(indexOf(t.f));
        expect(s.gs).toEqual(t.gs.map(indexOf));
      }
      if (s.k === 'rec' && t.k === 'rec') expect([s.f, s.g]).toEqual([indexOf(t.f), indexOf(t.g)]);
      if (s.k === 'min' && t.k === 'min') expect(s.f).toBe(indexOf(t.f));
      if (s.k === 'proj' && t.k === 'proj') expect([s.n, s.i]).toEqual([t.n, t.i]);
    }
  });
});

describe('computation records, T and U', () => {
  it('lists are coded bijectively', () => {
    for (let c = 0n; c < 2000n; c++) expect(seqCode(seqDecode(c))).toBe(c);
    expect(seqCode([])).toBe(0n);
    expect(seqDecode(seqCode([3n, 0n, 7n]))).toEqual([3n, 0n, 7n]);
  });

  it('the record agrees with φₑ(x), and T accepts it', () => {
    let checked = 0;
    for (let e = 0n; e < 1500n; e++) {
      for (let x = 0n; x < 4n; x++) {
        const o = phi(e, x, 3000);
        const r = computationRecord(e, x, 3000);
        if (o.kind === 'notAFunction') {
          expect(r.kind).toBe('notAFunction');
          continue;
        }
        if (o.kind === 'value') {
          expect(r.kind).toBe('halted');
          if (r.kind !== 'halted') continue;
          expect(r.root.value).toBe(o.value);
          expect(checkRecord(r.root, e, [x]).holds).toBe(true);
          const s = encodeRecord(r.root, 14);
          if (s !== null) {
            checked++;
            const t = T(e, x, s);
            expect(t.holds).toBe(true);
            expect(U(s)).toBe(o.value);
            expect(T(e, x + 1n, s).holds).toBe(false);
            expect(decodeRecord(s)).toMatchObject({ e, args: [x], value: o.value });
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('tampering with a record is caught at the tampered node', () => {
    const add = Lib.add();
    const e = indexOf(R.comp(add, [P(1, 0), P(1, 0)])); // x + x
    const r = computationRecord(e, 3n);
    if (r.kind !== 'halted') throw new Error('should halt');
    expect(r.root.value).toBe(6n);
    const flat = flattenRecord(r.root);
    expect(flat.length).toBe(countNodes(r.root));
    // Change a value deep inside.
    const victim = flat[flat.length - 1];
    victim.node.value += 1n;
    const t = checkRecord(r.root, e, [3n]);
    expect(t.holds).toBe(false);
    expect(t.failure!.path.length).toBeGreaterThan(0);
    // Changing the output at the root is caught at the root.
    victim.node.value -= 1n;
    r.root.value = 7n;
    const t2 = checkRecord(r.root, e, [3n]);
    expect(t2.holds).toBe(false);
    expect(t2.failure!.path).toEqual([]);
  });

  it('the record is unique: a literal search finds exactly the encoded record', () => {
    const cases: [bigint, bigint][] = [
      [0n, 0n],
      [1n, 0n],
      [1n, 1n],
      [2n, 3n],
      [0n, 2n],
    ];
    for (const [e, x] of cases) {
      const r = computationRecord(e, x);
      if (r.kind !== 'halted') throw new Error('halts');
      const s = encodeRecord(r.root)!;
      const search = searchNormalForm(e, x, s + 50n);
      expect(search.found).toBe(s);
      // nothing else below s + 50 satisfies T
      let count = 0;
      for (let t = 0n; t < s + 50n; t++) if (T(e, x, t).holds) count++;
      expect(count).toBe(1);
      expect(U(s)).toBe(phi(e, x).kind === 'value' ? (phi(e, x) as { value: bigint }).value : -1n);
    }
    const succ0 = computationRecord(1n, 0n);
    expect(succ0.kind === 'halted' && encodeRecord(succ0.root)).toBe(37n);
    const none = searchNormalForm(45n, 2n, 5000n);
    expect(none.found).toBe(null);
    expect(none.tested).toBe(5000n);
    expect(none.rejected.length).toBe(8);
  });

  it('sizes are estimated without computing the code', () => {
    const r = computationRecord(indexOf(Lib.add()), 0n);
    expect(r.kind).toBe('notAFunction'); // add is binary
    const big = recordFromIndex(indexOf(Lib.add()), [5n, 20n]);
    if (big.kind !== 'halted') throw new Error('halts');
    const size = recordCodeSize(big.root);
    expect(size).toBeGreaterThan(20);
    expect(encodeRecord(big.root)).toBe(null);
    expect(describeCodeSize(size).text).toMatch(/digits/);
    const small = computationRecord(1n, 5n);
    if (small.kind !== 'halted') throw new Error('halts');
    const s = encodeRecord(small.root)!;
    const est = describeCodeSize(recordCodeSize(small.root)).digits!;
    expect(Math.abs(est - s.toString().length)).toBeLessThanOrEqual(Math.max(3, s.toString().length));
  });

  it('out of fuel is not "undefined"', () => {
    expect(computationRecord(45n, 3n, 200)).toMatchObject({ kind: 'outOfFuel' });
    expect(computationRecord(4n, 0n)).toMatchObject({ kind: 'notAFunction' });
    expect(T(4n, 0n, 12345n).holds).toBe(false);
  });
});

describe('certain divergence (sound, incomplete)', () => {
  it('never claims "undefined" for a computation that halts', () => {
    let claims = 0;
    for (let e = 0n; e < 4000n; e++) {
      const d = decodeIndex(e);
      if (!d.ok || d.arity !== 1) continue;
      const nowhere = nowhereDefined(d.rf);
      for (let x = 0n; x < 5n; x++) {
        const why = certainlyUndefined(d.rf, [x]);
        const o = phi(e, x, 20_000);
        if (why || nowhere) {
          claims++;
          expect(o.kind, `φ_${e}(${x}): ${why}`).not.toBe('value');
        }
      }
    }
    expect(claims).toBeGreaterThan(10);
  });

  it('recognises the simple cases', () => {
    expect(neverZero(R.comp(R.succ(), [P(2, 0)]))).toBe(true);
    expect(nowhereDefined(R.min(R.comp(R.succ(), [P(2, 0)])))).toBe(true);
    expect(ignoresArg(P(2, 1), 0)).toBe(true);
    expect(certainlyUndefined(R.min(P(2, 1)), [3n])).toMatch(/does not depend/);
    expect(certainlyUndefined(R.min(P(2, 1)), [0n])).toBe(null);
    expect(certainlyUndefined(haltsOnEvens(), [3n])).toMatch(/value here is 1/);
    expect(certainlyUndefined(haltsOnEvens(), [4n])).toBe(null);
    // true, but beyond these tests: μz (z + x = 0) at x = 1 depends on z
    expect(certainlyUndefined(R.min(Lib.add()), [1n])).toBe(null);
  });
});

describe('s-m-n and padding', () => {
  it('index arithmetic matches indexOf', () => {
    expect(projIndex(3, 1)).toBe(indexOf(P(3, 1)));
    expect(compIndex(1n, [0n])).toBe(indexOf(R.comp(R.succ(), [R.zero()])));
    for (let a = 0; a <= 4; a++) expect(constIndex(a)).toBe(indexOf(Lib.constN(a)));
    expect(constIndexN(2, 3)).toBe(indexOf(Lib.constN(2, 3)));
    expect(() => constIndex(20)).toThrow();
  });

  it('s¹₁(e, a) computes λy.φ²ₑ(a, y) on samples', () => {
    for (const [f, a] of [
      [Lib.add(), 3],
      [Lib.mult(), 2],
      [Lib.tsub(), 5],
    ] as const) {
      const e = indexOf(f);
      const c = compareSmn(e, [a], 1, [[0n], [1n], [4n], [7n]], 50_000);
      expect(c.rows.every((r) => r.verdict === 'agree')).toBe(true);
      const d = decodeIndex(c.index);
      expect(d.ok && d.arity).toBe(1);
    }
    // m = 2, n = 1 on a 3-place function; m = 1, n = 2 on the same function
    const cond = indexOf(Lib.cond());
    expect(compareSmn(cond, [0, 5], 1, [[1n], [9n]]).rows.every((r) => r.verdict === 'agree')).toBe(true);
    expect(compareSmn(cond, [1], 2, [[1n, 2n], [4n, 3n]]).rows.every((r) => r.verdict === 'agree')).toBe(true);
    // wrong arity: neither side is a function
    expect(compareSmn(1n, [2], 1, [[0n]]).rows[0].verdict).toBe('both-not-functions');
    expect(smn(1n, [2], 1)).toBe(compIndex(1n, [constIndex(2), projIndex(1, 0)]));
  });

  it('padding gives new indices of the same function', () => {
    const e = indexOf(R.comp(Lib.add(), [P(1, 0), P(1, 0)]));
    const p1 = padIndex(e);
    const p2 = padIndex(p1);
    expect(p1 > e && p2 > p1).toBe(true);
    for (const x of [0n, 3n, 10n]) {
      const v = runIndex(e, [x]);
      expect(runIndex(p1, [x])).toMatchObject({ kind: 'value', value: (v as { value: bigint }).value });
      expect(runIndex(p2, [x])).toMatchObject({ kind: 'value', value: (v as { value: bigint }).value });
    }
  });
});

describe('computably enumerable sets', () => {
  it('dovetailing W_e: members appear at the stage their computation fits', () => {
    const evens = indexOf(haltsOnEvens());
    const w = enumerateW(evens, 200);
    const listed = w.byStage.flat().map(Number).sort((a, b) => a - b);
    expect(listed.every((x) => x % 2 === 0)).toBe(true);
    expect(listed.length).toBeGreaterThan(5);
    w.members.forEach((m, x) => {
      if (m.kind === 'in') expect(x % 2).toBe(0);
    });
    // stages are consistent with a stage-by-stage computation
    for (let s = 1; s <= 200; s += 7) {
      const direct = Array.from({ length: s }, (_, x) => x).filter((x) => {
        const o = phi(evens, BigInt(x), s);
        return o.kind === 'value';
      });
      const upTo = w.byStage
        .slice(0, s + 1)
        .flat()
        .map(Number)
        .sort((a, b) => a - b);
      expect(upTo).toEqual(direct);
    }
  });

  it('K and K₀', () => {
    const k = enumerateK(80);
    expect(k.members[1]).toMatchObject({ kind: 'in' }); // succ(1)
    expect(k.members[4]).toMatchObject({ kind: 'out' }); // not a function
    expect(k.members[45]).toMatchObject({ kind: 'out' }); // Min(P^2_1) at 45
    const g = enumerateK0(6, 6, 50);
    expect(g[1][3]).toMatchObject({ kind: 'in' });
    for (let e = 0; e < 6; e++) expect(g[e][e].kind === 'in').toBe(k.members[e].kind === 'in');
  });

  it('the range enumeration and the book’s f', () => {
    const dbl = indexOf(R.comp(Lib.add(), [P(1, 0), P(1, 0)]));
    const steps = rangeEnumeration(dbl, 0n, 400);
    for (const st of steps) expect(st.out % 2n).toBe(0n);
    expect(steps.filter((s) => s.hit).length).toBeGreaterThan(3);
    const w = witnessPair(1n, 2n)!;
    expect(bookRangeFunction(1n, 99n, w.z)).toMatchObject({ holds: true, out: 3n, x: 2n });
    expect(bookRangeFunction(1n, 99n, w.z + 1n)).toMatchObject({ holds: false, out: 99n });
    expect(inverseSearch(dbl, 6n, 20)).toEqual({ kind: 'found', x: 3n });
    expect(inverseSearch(dbl, 7n, 20)).toMatchObject({ kind: 'notFound', searched: 20 });
  });

  it('racing A against its complement decides A', () => {
    const d = indexOf(haltsOnEvens());
    const e = indexOf(haltsOnOdds());
    for (let x = 0n; x < 12n; x++) expect(race(d, e, x, 5000).verdict).toBe(x % 2n === 0n ? 'inA' : 'inComplement');
    expect(race(d, d, 2n, 5000).verdict).toBe('both');
    expect(race(45n, 45n, 3n, 500).verdict).toBe('unknown');
  });

  it('every bounded halting test is wrong somewhere', () => {
    const c = boundedDeciderCounterexample(50, 3000);
    expect(c).not.toBe(null);
    if (c) {
      expect(c.calls).toBeGreaterThan(50);
      expect(phi(c.e, c.e, 50).kind).toBe('outOfFuel');
    }
  });
});

describe("Craig's trick", () => {
  const A = (s: string) => parseFormula(s);
  const enumeration = [A('0 = 0'), A('∀x x = x'), A('0 < 1 ∧ 0 < 1'), A('1 = 1')];
  const at = (n: number) => enumeration[n] ?? null;

  it('Γ contains its elements and nothing else of that shape', () => {
    enumeration.forEach((An, n) => {
      const el = craigElement(An, n);
      expect(inGamma(el, at).member, `element ${n}`).toBe(true);
    });
    expect(inGamma(A('0 = 0 ∧ 0 = 0'), at).member).toBe(false); // two copies of A₀, but A₁ is not 0 = 0
    expect(inGamma(A('∀x x = x'), at).member).toBe(false); // A₁ itself (one copy) is not in Γ
  });

  it('a conjunction of identical conjuncts can be the first element', () => {
    const tricky = [A('0 = 0 ∧ 0 = 0'), A('0 = 0')];
    const F = craigElement(tricky[0], 0);
    const r = readings(F);
    expect(r.map((x) => x.k)).toEqual([1, 2]);
    expect(inGamma(F, (n) => tricky[n] ?? null).member).toBe(true);
    expect(formulaEq(copies(A('0 = 0'), 3), A('0 = 0 ∧ (0 = 0 ∧ 0 = 0)'))).toBe(true);
  });
});
