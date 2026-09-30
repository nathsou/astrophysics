import { describe, expect, test } from 'vitest';
import { mulberry32 } from '../twolevel/random';
import { Aig, rebuild } from './aig';
import { mapLuts } from './map';

function randomAig(seed: number, nIn: number, gates: number) {
  const rng = mulberry32(seed);
  const a = new Aig();
  const lits = Array.from({ length: nIn }, () => a.addPi());
  for (let i = 0; i < gates; i++) {
    const x = lits[rng.int(lits.length)]! ^ rng.int(2);
    const y = lits[rng.int(lits.length)]! ^ rng.int(2);
    lits.push(rng.chance(0.3) ? a.xor(x, y) : a.and(x, y));
  }
  return { a, roots: lits.slice(-4) };
}

describe('AIG', () => {
  test('hashing, constants and local rules', () => {
    const a = new Aig();
    const x = a.addPi();
    const y = a.addPi();
    expect(a.and(x, y)).toBe(a.and(y, x));
    expect(a.and(x, 0)).toBe(0);
    expect(a.and(x, 1)).toBe(x);
    expect(a.and(x, x ^ 1)).toBe(0);
    const xy = a.and(x, y);
    expect(a.and(xy, x)).toBe(xy); // absorption
    expect(a.and(xy, x ^ 1)).toBe(0);
    expect(a.xor(x, x)).toBe(0);
    expect(a.xor(x, 1)).toBe(x ^ 1);
  });

  test('rebuilding and balancing keep the function; balancing does not deepen', () => {
    for (let s = 1; s <= 10; s++) {
      const { a, roots } = randomAig(s, 8, 120);
      const b = rebuild(a, roots, true);
      const c = rebuild(a, roots, false);
      for (let v = 0; v < 256; v++) {
        const pi = (node: number) => (v >> (node - 1)) & 1;
        const want = a.evaluate(roots, pi);
        expect(b.aig.evaluate(b.roots, pi)).toEqual(want);
        expect(c.aig.evaluate(c.roots, pi)).toEqual(want);
      }
      expect(b.aig.depth(b.roots)).toBeLessThanOrEqual(a.depth(roots));
    }
  });

  test('a long AND chain is balanced to logarithmic depth', () => {
    const a = new Aig();
    const xs = Array.from({ length: 32 }, () => a.addPi());
    let acc = xs[0]!;
    for (const x of xs.slice(1)) acc = a.and(acc, x);
    expect(a.depth([acc])).toBe(31);
    expect(rebuild(a, [acc], true).aig.depth([rebuild(a, [acc], true).roots[0]!])).toBe(5);
  });
});

describe('LUT mapping', () => {
  test('LUTs compute the AIG, depth is optimal, and area recovery never adds LUTs', () => {
    for (let s = 1; s <= 8; s++) {
      const { a, roots } = randomAig(s, 8, 150);
      const m = mapLuts(a, roots, undefined);
      expect(m.depth).toBe(m.trace.optimalDepth);
      const luts = m.trace.passes.map((p) => p.luts);
      expect(luts[luts.length - 1]).toBeLessThanOrEqual(luts[0]!);
      expect(m.luts.every((l) => l.leaves.length <= 4)).toBe(true);
      for (let v = 0; v < 256; v++) {
        const pi = (node: number) => (v >> (node - 1)) & 1;
        const val = new Map<number, number>();
        const get = (n: number): number => (a.isPi(n) ? pi(n) : val.get(n)!);
        for (const l of m.luts) {
          let row = 0;
          l.leaves.forEach((leaf, i) => (row |= get(leaf) << i));
          val.set(l.node, (l.tt >> row) & 1);
        }
        const got = roots.map((r) => (r >> 1 === 0 ? r & 1 : get(r >> 1) ^ (r & 1)));
        expect(got).toEqual(a.evaluate(roots, pi));
      }
    }
  });

  test('a 4-input function is one LUT and a 9-input parity takes two levels', () => {
    const a = new Aig();
    const xs = Array.from({ length: 9 }, () => a.addPi());
    const p = a.xorN(xs);
    const m = mapLuts(a, [p], undefined);
    expect(m.depth).toBe(2);
    const q = new Aig();
    const ys = Array.from({ length: 4 }, () => q.addPi());
    expect(mapLuts(q, [q.xorN(ys)], undefined).luts.length).toBe(1);
  });
});
