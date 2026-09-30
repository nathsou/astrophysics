import { describe, expect, test } from 'vitest';
import { PRESETS, fmt, gaussSteps, matmul, multiply, permute, solveWithLU, type Matrix } from './gauss';

const close = (a: number[], b: number[], d = 9) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, d));

describe('presets', () => {
  test('the textbook system', () => {
    const p = PRESETS.find((x) => x.id === 'classic')!;
    close(gaussSteps(p.A, p.b).x!, [2, 3, -1]);
  });
  test('the ladder has the voltages 30/7, 12/7, 6/7', () => {
    const p = PRESETS.find((x) => x.id === 'ladder')!;
    for (const rule of ['first-nonzero', 'largest'] as const) close(gaussSteps(p.A, p.b, rule).x!, [30 / 7, 12 / 7, 6 / 7], 9);
  });
  test('the ladder satisfies Kirchhoff’s current law at every node', () => {
    const p = PRESETS.find((x) => x.id === 'ladder')!;
    const [a, b, c] = gaussSteps(p.A, p.b).x! as [number, number, number];
    // mA into node A from the source: 9 − A. Leaving: A/2 (R2), A − B (R3).
    expect(9 - a).toBeCloseTo(a / 2 + (a - b), 9);
    expect(a - b).toBeCloseTo(b + (b - c), 9);
    expect(b - c).toBeCloseTo(c, 9);
  });
  test('the swap system needs a swap and is solved by it', () => {
    const p = PRESETS.find((x) => x.id === 'swap')!;
    const s = gaussSteps(p.A, p.b);
    expect(s.steps.some((st) => st.kind === 'swap')).toBe(true);
    close(s.x!, [1, 2, 3]);
  });
  test('the floating-node system is reported singular, with an explanation', () => {
    const p = PRESETS.find((x) => x.id === 'floating')!;
    const s = gaussSteps(p.A, p.b);
    expect(s.singular).toBe(true);
    expect(s.x).toBeUndefined();
    expect(s.steps.at(-1)!.kind).toBe('singular');
    expect(s.steps.at(-1)!.text).toMatch(/floating node/);
  });
});

describe('random systems', () => {
  // A small deterministic generator, so that the test does not change from run to run.
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  const matrix = (n: number): Matrix => Array.from({ length: n }, () => Array.from({ length: n }, () => Math.round(rnd() * 9)));

  test('solutions satisfy A·x = b, with either pivot rule', () => {
    for (let trial = 0; trial < 60; trial++) {
      const n = 2 + (trial % 4);
      const A = matrix(n);
      const b = Array.from({ length: n }, () => Math.round(rnd() * 20));
      for (const rule of ['first-nonzero', 'largest'] as const) {
        const s = gaussSteps(A, b, rule);
        if (s.singular) continue;
        const r = multiply(A, s.x!);
        r.forEach((v, i) => expect(Math.abs(v - b[i]!)).toBeLessThan(1e-6));
      }
    }
  });

  test('P·A = L·U', () => {
    for (let trial = 0; trial < 40; trial++) {
      const A = matrix(3 + (trial % 2));
      for (const rule of ['first-nonzero', 'largest'] as const) {
        const s = gaussSteps(A, A.map(() => 0), rule);
        if (s.singular) continue;
        const LU = matmul(s.L, s.U);
        const PA = permute(A, s.perm);
        LU.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(PA[i]![j]!, 6)));
      }
    }
  });

  test('the stored L and U solve any right-hand side with two sweeps', () => {
    const A: Matrix = [
      [2.5, -1, 0],
      [-1, 3, -1],
      [0, -1, 2],
    ];
    const s = gaussSteps(A, [0, 0, 0], 'largest');
    for (const b of [[9, 0, 0], [0, 1, 0], [1, 2, 3]]) {
      const x = solveWithLU(s.L, s.U, s.perm, b);
      const r = multiply(A, x);
      r.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 9));
    }
  });
});

describe('the steps', () => {
  test('they start with the matrix and end solved', () => {
    const p = PRESETS[1]!;
    const s = gaussSteps(p.A, p.b);
    expect(s.steps[0]!.kind).toBe('start');
    expect(s.steps[0]!.m).toEqual([[2, 1, -1, 8], [-3, -1, 2, -11], [-2, 1, 2, -3]]);
    expect(s.steps.at(-1)!.kind).toBe('solved');
    // 3 unknowns: at most 3 eliminations (fewer if an entry is already 0) and 3 back-substitution steps
    expect(s.steps.filter((x) => x.kind === 'back').length).toBe(3);
    expect(s.steps.filter((x) => x.kind === 'eliminate').length).toBe(3);
  });
  test('each elimination step zeroes the entry under the pivot', () => {
    const p = PRESETS[1]!;
    for (const st of gaussSteps(p.A, p.b).steps.filter((x) => x.kind === 'eliminate')) {
      const [r, c] = [st.rows[0]!, st.pivot![1]];
      expect(st.m[r]![c]).toBe(0);
    }
  });
  test('the multipliers of the first pivot are −3/2 and −1', () => {
    const p = PRESETS[1]!;
    const s = gaussSteps(p.A, p.b);
    expect(s.L[1]![0]).toBeCloseTo(-1.5, 12);
    expect(s.L[2]![0]).toBeCloseTo(-1, 12);
  });
  test('steps never change the caller’s matrix', () => {
    const A: Matrix = [[1, 2], [3, 4]];
    gaussSteps(A, [5, 6]);
    expect(A).toEqual([[1, 2], [3, 4]]);
  });
  test('a 1×1 system', () => {
    close(gaussSteps([[4]], [10]).x!, [2.5]);
  });
  test('number format', () => {
    expect(fmt(0)).toBe('0');
    expect(fmt(-0)).toBe('0');
    expect(fmt(2.5)).toBe('2.5');
    expect(fmt(-1)).toBe('−1');
    expect(fmt(30 / 7)).toBe('4.286');
    expect(fmt(1e-15)).toBe('0');
    expect(fmt(1234567)).toBe('1235000');
  });
});
