import { describe, expect, test } from 'vitest';
import { coverFromMinterms, coverFromStrings, cubeToString, literalCount } from './cube';
import { functionFromEquations } from './expr';
import { minimise } from './minimise';
import { minimiseMulti, minimiseMultiPolarity, multiImplements, type MultiSpec } from './multi';
import { mulberry32 } from './random';

function specFromEquations(text: string): MultiSpec {
  const f = functionFromEquations(text);
  return { n: f.inputs.length, on: f.on, dc: f.dc };
}

describe('multi-output minimisation', () => {
  test('a shared term is used once', () => {
    // f = AB + CD, g = AB + C̄D̄: AB is shared, so 3 terms rather than 4.
    const spec = specFromEquations('F = A&B | C&D\nG = A&B | !C&!D', );
    const r = minimiseMulti(spec);
    expect(multiImplements(r.terms, spec)).toBe(true);
    expect(r.cost.terms).toBe(3);
    const shared = r.terms.filter((t) => t.outputs.length === 2);
    expect(shared.length).toBe(1);
    expect(cubeToString(shared[0]!.cube, 4)).toBe('11--');
  });

  test('a shared term found only by intersecting primes', () => {
    // f = A + B, g = A + C … the term A serves both; and h = A·B (an intersection) is free.
    const spec = specFromEquations('F = A | B\nG = A | C\nH = A & B');
    const r = minimiseMulti(spec);
    expect(multiImplements(r.terms, spec)).toBe(true);
    // A, B, C plus AB: but AB is also implied by A… H needs AB itself (1 term), so 4 in all.
    expect(r.cost.terms).toBeLessThanOrEqual(4);
  });

  test('the full adder cannot share (7 terms)', () => {
    const spec = specFromEquations('S = A^B^C\nCO = A&B | A&C | B&C');
    const r = minimiseMulti(spec);
    expect(multiImplements(r.terms, spec)).toBe(true);
    expect(r.cost.terms).toBe(7);
  });

  test('7-segment decoder with don’t cares beats the independent covers', () => {
    // BCD digits 0–9; codes 10–15 are don't cares. Segments a..g of a common-cathode display.
    const seg: Record<string, number[]> = {
      a: [0, 2, 3, 5, 6, 7, 8, 9],
      b: [0, 1, 2, 3, 4, 7, 8, 9],
      c: [0, 1, 3, 4, 5, 6, 7, 8, 9],
      d: [0, 2, 3, 5, 6, 8, 9],
      e: [0, 2, 6, 8],
      f: [0, 4, 5, 6, 8, 9],
      g: [2, 3, 4, 5, 6, 8, 9],
    };
    const dc = coverFromMinterms(4, [10, 11, 12, 13, 14, 15]);
    const spec: MultiSpec = { n: 4, on: Object.values(seg).map((ms) => coverFromMinterms(4, ms)), dc: Object.values(seg).map(() => dc) };
    const r = minimiseMulti(spec);
    expect(multiImplements(r.terms, spec)).toBe(true);
    const independent = spec.on.reduce((s, c, j) => s + minimise(c, spec.dc![j]).cubes.length, 0);
    expect(r.cost.terms).toBeLessThan(independent);
    console.log(`7-segment BCD decoder: ${independent} independent terms, ${r.cost.terms} shared (${r.cost.literals} literals, ${r.cost.connections} connections)`);
  });

  test('random multi-output functions: correct, never worse than merged independent covers', () => {
    const rng = mulberry32(99);
    let independent = 0;
    let shared = 0;
    const trials = 60;
    for (let t = 0; t < trials; t++) {
      const n = 4 + rng.int(3);
      const m = 2 + rng.int(4);
      const on = [];
      const dc = [];
      for (let j = 0; j < m; j++) {
        const o: number[] = [];
        const d: number[] = [];
        for (let x = 0; x < 2 ** n; x++) {
          const v = rng.next();
          if (v < 0.3) o.push(x);
          else if (v < 0.4) d.push(x);
        }
        on.push(coverFromMinterms(n, o));
        dc.push(coverFromMinterms(n, d));
      }
      const spec: MultiSpec = { n, on, dc };
      const r = minimiseMulti(spec);
      expect(multiImplements(r.terms, spec)).toBe(true);
      // Baseline: the independent covers with identical cubes merged.
      const seen = new Set<string>();
      let base = 0;
      for (let j = 0; j < m; j++)
        for (const c of minimise(on[j]!, dc[j]).cubes) {
          const k = cubeToString(c, n);
          if (!seen.has(k)) {
            seen.add(k);
            base++;
          }
        }
      expect(r.cost.terms).toBeLessThanOrEqual(base);
      independent += base;
      shared += r.cost.terms;
    }
    console.log(`Shared-term minimisation on ${trials} random multi-output functions: ${shared} terms vs ${independent} for merged independent covers`);
  });

  test('constant outputs and empty functions', () => {
    const n = 3;
    const spec: MultiSpec = { n, on: [coverFromStrings(['---']), { n, cubes: [] }, coverFromStrings(['1--'])] };
    const r = minimiseMulti(spec);
    expect(multiImplements(r.terms, spec)).toBe(true);
    expect(r.covers[1]!.cubes.length).toBe(0);
    expect(literalCount(r.covers[0]!.cubes[0]!, n)).toBe(0);
  });
});

describe('output polarity for multi-output functions', () => {
  test('auto picks the inverted form when it is cheaper', () => {
    // Y = NAND(A,B,C,D): 4 terms active high, 1 term active low.
    const spec = specFromEquations('Y = !(A&B&C&D)\nZ = A&B');
    const r = minimiseMultiPolarity(spec, 'auto');
    expect(r.polarity).toEqual(['low', 'high']);
    expect(r.cost.terms).toBe(2);
  });

  test('fixed polarity is honoured', () => {
    const spec = specFromEquations('Y = !(A&B&C&D)');
    const hi = minimiseMultiPolarity(spec, 'high');
    expect(hi.cost.terms).toBe(4);
    const lo = minimiseMultiPolarity(spec, ['low']);
    expect(lo.cost.terms).toBe(1);
  });
});
