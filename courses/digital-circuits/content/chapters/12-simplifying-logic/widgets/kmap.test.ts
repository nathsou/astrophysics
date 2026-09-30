import { describe, expect, test } from 'vitest';
import { EXAMPLES, cellOf, cellsOfExample, colLabel, dagOf, groupFromSpans, groupProblem, mintermAt, mintermsOf, minimum, piecesOf, realised, rowLabel, shapeOf, spanOf, status, textOf, type Mode } from './kmap';
import { evalDag } from '../../11-boolean-algebra/widgets/layout';

describe('the map', () => {
  test('rows and columns are in Gray-code order, so neighbours differ in one bit', () => {
    const s = shapeOf(4);
    expect(Array.from({ length: 4 }, (_, r) => rowLabel(s, r))).toEqual(['00', '01', '11', '10']);
    expect(Array.from({ length: 4 }, (_, c) => colLabel(s, c))).toEqual(['00', '01', '11', '10']);
    const pop = (x: number) => x.toString(2).replace(/0/g, '').length;
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        expect(pop(mintermAt(s, r, c) ^ mintermAt(s, r, (c + 1) % 4))).toBe(1);
        expect(pop(mintermAt(s, r, c) ^ mintermAt(s, (r + 1) % 4, c))).toBe(1);
      }
  });
  test('every minterm has exactly one cell, and cellOf inverts mintermAt', () => {
    for (const n of [2, 3, 4]) {
      const s = shapeOf(n);
      const seen = new Set<number>();
      for (let r = 0; r < s.rows; r++)
        for (let c = 0; c < s.cols; c++) {
          const m = mintermAt(s, r, c);
          expect(cellOf(s, m)).toEqual({ r, c });
          seen.add(m);
        }
      expect(seen.size).toBe(2 ** n);
    }
  });
  test('the shapes: 2×2, 2×4, 4×4', () => {
    expect([2, 3, 4].map((n) => [shapeOf(n).rows, shapeOf(n).cols])).toEqual([[2, 2], [2, 4], [4, 4]]);
  });
});

describe('groups', () => {
  const s = shapeOf(4);
  test('the four corners are one group, ¬B·¬D', () => {
    // Drag from the top-left cell off the right edge, and off the bottom edge: spans wrap.
    const g = groupFromSpans(s, spanOf(3, 4, 4), spanOf(3, 4, 4));
    expect(g).toEqual({ ok: true, pattern: '-0-0' });
    expect(mintermsOf('-0-0')).toEqual([0, 2, 8, 10]);
  });
  test('a whole row is a group of four; the whole map is the constant 1', () => {
    expect(groupFromSpans(s, spanOf(1, 1, 4), spanOf(0, 3, 4))).toEqual({ ok: true, pattern: '01--' });
    expect(groupFromSpans(s, spanOf(0, 3, 4), spanOf(0, 3, 4))).toEqual({ ok: true, pattern: '----' });
  });
  test('three cells are not a group', () => {
    const g = groupFromSpans(s, spanOf(0, 0, 4), spanOf(0, 2, 4));
    expect(g.ok).toBe(false);
  });
  test('a drag longer than the map is clamped to the whole side', () => {
    expect(spanOf(0, 9, 4)).toEqual({ first: 0, len: 4 });
    expect(spanOf(2, -1, 4)).toEqual({ first: 3, len: 4 });
    expect(spanOf(-1, 0, 4)).toEqual({ first: 3, len: 2 });
  });
  test('a wrapping group is drawn in two pieces with open sides', () => {
    const p = piecesOf(s, '-0-0');
    expect(p).toHaveLength(4);
    expect(p.filter((x) => x.openRight || x.openBottom)).not.toHaveLength(0);
    expect(piecesOf(s, '0-01')).toHaveLength(1);
    expect(piecesOf(s, '-0--')).toHaveLength(2);
  });
  test('a group with a 0 in it is refused, and says which', () => {
    const cells = cellsOfExample(EXAMPLES.find((e) => e.id === 'corners')!);
    expect(groupProblem(s, cells, '-0-0', 'sop')).toBeUndefined();
    expect(groupProblem(s, cells, '-0--', 'sop')).toMatch(/contains 4 0s/);
  });
});

describe('minima', () => {
  const ex = (id: string) => EXAMPLES.find((e) => e.id === id)!;
  const min = (id: string, mode: Mode = 'sop') => {
    const e = ex(id);
    return minimum(shapeOf(e.n), cellsOfExample(e), mode);
  };
  test('majority: three groups of two', () => {
    const m = min('majority');
    expect(m.cost).toEqual({ terms: 3, literals: 6 });
    expect(textOf(m.patterns, 'sop', ['A', 'B', 'C']).split(' + ').sort()).toEqual(['A·B', 'A·C', 'B·C']);
  });
  test('four corners: one term of two literals', () => {
    expect(min('corners').patterns).toEqual(['-0-0']);
  });
  test('segment a with don’t-cares is A + C + B·D + ¬B·¬D', () => {
    const m = min('seg-a');
    expect([...m.patterns].sort()).toEqual(['--1-', '-0-0', '-1-1', '1---'].sort());
    expect(m.cost).toEqual({ terms: 4, literals: 6 });
  });
  test('without the don’t-cares the same segment is bigger', () => {
    const e = ex('seg-a');
    const cells = cellsOfExample({ ...e, dc: [] });
    const m = minimum(shapeOf(4), cells, 'sop');
    expect(m.cost.literals).toBeGreaterThan(6);
  });
  test('XOR has two groups of one cell each', () => {
    expect(min('xor').cost).toEqual({ terms: 2, literals: 4 });
  });
  test('the cyclic function has no essential prime and three groups', () => {
    const m = min('cyclic');
    expect(m.essential).toEqual([]);
    expect(m.primes).toHaveLength(6);
    expect(m.cost).toEqual({ terms: 3, literals: 6 });
  });
  test('the product of sums of the majority function from the zeros', () => {
    const m = min('majority', 'pos');
    expect(m.cost).toEqual({ terms: 3, literals: 6 });
    const sums = [...textOf(m.patterns, 'pos', ['A', 'B', 'C']).matchAll(/\(([^)]*)\)/g)].map((x) => x[1]).sort();
    expect(sums).toEqual(['A + B', 'A + C', 'B + C']);
  });
  test('A ≥ B', () => {
    const m = min('ge');
    console.log('ge', m.patterns, m.essential, m.primes.length);
    expect(m.cost.terms).toBeGreaterThan(0);
  });
});

describe('every cover the minimiser gives realises the map, in both modes, and the gates draw it', () => {
  for (const e of EXAMPLES) {
    for (const mode of ['sop', 'pos'] as Mode[]) {
      test(`${e.id} ${mode}`, () => {
        const s = shapeOf(e.n);
        const cells = cellsOfExample(e);
        const m = minimum(s, cells, mode);
        const st = status(s, cells, m.patterns, mode, m.primes);
        expect(st.complete).toBe(true);
        expect(st.redundant).toEqual([]);
        expect(st.growable).toEqual([]);
        const out = realised(e.n, m.patterns, mode);
        const dag = dagOf(e.n, m.patterns, mode);
        for (let row = 0; row < 2 ** e.n; row++) {
          if (cells[row] !== 2) expect(out[row]).toBe(cells[row]);
          const env = Object.fromEntries(['A', 'B', 'C', 'D'].slice(0, e.n).map((nm, v) => [nm, (row >> (e.n - 1 - v)) & 1]));
          expect(evalDag(dag, env).Y, `${e.id} ${mode} row ${row}`).toBe(out[row]);
        }
      });
    }
  }
});

describe('status', () => {
  test('a cover that misses a cell, contains a redundant group, or can still grow', () => {
    const e = EXAMPLES.find((x) => x.id === 'majority')!;
    const s = shapeOf(3);
    const cells = cellsOfExample(e);
    const m = minimum(s, cells, 'sop');
    const one = status(s, cells, m.patterns.slice(0, 2), 'sop', m.primes);
    expect(one.uncovered.length).toBeGreaterThan(0);
    const extra = status(s, cells, [...m.patterns, '111'], 'sop', m.primes);
    expect(extra.redundant).toContain('111');
    expect(extra.growable).toContain('111');
  });
});

import { outlinePath } from './kmap';
describe('outlines', () => {
  test('a closed rectangle is one rounded path; an open side is left out', () => {
    const closed = outlinePath(0, 0, 40, 20, 6);
    expect(closed.match(/M/g)).toHaveLength(1);
    expect(closed.match(/A/g)).toHaveLength(4);
    const open = outlinePath(0, 0, 40, 20, 6, { right: true });
    expect(open.match(/M/g)).toHaveLength(2);
    expect(open.match(/A/g)).toHaveLength(2);
  });
});
