import { describe, expect, it } from 'vitest';
import { Bdd } from './bdd';
import { parseFormula } from './parse';
import { evalFormula, type Formula } from '../sat/encode';
import { rng } from '../util/random';

function randomFormula(r: ReturnType<typeof rng>, n: number, depth: number): Formula {
  if (depth === 0 || r.chance(0.2)) return r.chance(0.05) ? { k: 'const', value: r.chance(0.5) } : { k: 'var', v: r.int(1, n + 1) };
  const k = r.pick(['not', 'and', 'or', 'xor', 'imp', 'iff'] as const);
  if (k === 'not') return { k, a: randomFormula(r, n, depth - 1) };
  if (k === 'and' || k === 'or') return { k, args: [randomFormula(r, n, depth - 1), randomFormula(r, n, depth - 1), randomFormula(r, n, depth - 1)] };
  return { k, a: randomFormula(r, n, depth - 1), b: randomFormula(r, n, depth - 1) };
}

const assignments = (n: number) => Array.from({ length: 1 << n }, (_, m) => [false, ...Array.from({ length: n }, (_, i) => !!(m & (1 << i)))]);

describe('BDDs', () => {
  it('represent random formulas exactly, canonically, and count their models', () => {
    const r = rng(1986);
    const n = 6;
    const vars = Array.from({ length: n }, (_, i) => i + 1);
    for (let t = 0; t < 200; t++) {
      const b = new Bdd(r.shuffle(vars));
      const f = randomFormula(r, n, 4);
      const node = b.fromFormula(f);
      let count = 0n;
      for (const m of assignments(n)) {
        const want = evalFormula(f, m);
        expect(b.evaluate(node, (v) => m[v]!)).toBe(want);
        if (want) count++;
      }
      expect(b.satCount(node, vars)).toBe(count);
      // Canonicity: the same function built another way is the same node.
      expect(b.fromFormula({ k: 'not', a: { k: 'not', a: f } })).toBe(node);
      expect(b.fromFormula(b.toFormula(node))).toBe(node);
      // Quantification agrees with its definition.
      const ex = b.exists(node, new Set([2, 3]));
      const def = b.or(b.or(b.restrict(b.restrict(node, 2, false), 3, false), b.restrict(b.restrict(node, 2, true), 3, false)), b.or(b.restrict(b.restrict(node, 2, false), 3, true), b.restrict(b.restrict(node, 2, true), 3, true)));
      expect(ex).toBe(def);
      const g = b.fromFormula(randomFormula(r, n, 3));
      expect(b.andExists(node, g, new Set([1, 4]))).toBe(b.exists(b.and(node, g), new Set([1, 4])));
      // Renaming x1 ↔ x2 agrees with substitution.
      const sw = b.rename(node, new Map([[1, 2], [2, 1]]));
      for (const m of assignments(n)) expect(b.evaluate(sw, (v) => m[v === 1 ? 2 : v === 2 ? 1 : v]!)).toBe(b.evaluate(node, (v) => m[v]!));
    }
  });

  it('show the effect of variable order on a comparator', () => {
    // a1..an == b1..bn: linear when interleaved, exponential when all a's come first.
    const n = 8;
    const text = Array.from({ length: n }, (_, i) => `(a${i} <-> b${i})`).join(' & ');
    const p = parseFormula(text);
    const a = p.names.map((x, i) => [x, i + 1] as const);
    const inter = new Bdd(a.map(([, v]) => v));
    const sep = new Bdd([...a.filter(([x]) => x.startsWith('a')), ...a.filter(([x]) => x.startsWith('b'))].map(([, v]) => v));
    expect(inter.size(inter.fromFormula(p.formula))).toBe(3 * n + 2);
    expect(sep.size(sep.fromFormula(p.formula))).toBe(3 * 2 ** n - 1);
  });

  it('parse formulas with the usual operators and precedence', () => {
    const p = parseFormula('a & !b | c -> d <-> e ^ a');
    expect(p.names).toEqual(['a', 'b', 'c', 'd', 'e']);
    const b = new Bdd([1, 2, 3, 4, 5]);
    const f = b.fromFormula(p.formula);
    for (const m of assignments(5)) {
      const [, a, bb, c, d, e] = m as boolean[];
      const want = (!((a! && !bb!) || c!) || d!) === (e! !== a!);
      expect(b.evaluate(f, (v) => m[v]!)).toBe(want);
    }
    expect(() => parseFormula('a &')).toThrow();
    expect(() => parseFormula('(a | b')).toThrow();
  });
});
