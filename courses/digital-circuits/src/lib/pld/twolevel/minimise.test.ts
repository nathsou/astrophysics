import { describe, expect, test } from 'vitest';
import { coverFromStrings, cubeToString } from './cube';
import { parseSop } from './expr';
import { choosePolarity, minimise, minimiseComplement } from './minimise';
import { implementsFunction, offSet } from './unate';

describe('minimise', () => {
  test('only the support takes part (3 of 22 variables, exact)', () => {
    const vars = Array.from({ length: 22 }, (_, i) => `x${i}`);
    const { cover } = parseSop('x3 & x7 & !x20 | x3 & !x7 & !x20 | x3 & x20', vars);
    const m = minimise(cover, undefined, { method: 'exact' });
    expect(m.cubes.length).toBe(1);
    expect(cubeToString(m.cubes[0]!, 22)).toBe('---1------------------');
  });

  test('heuristic and exact agree on a textbook function', () => {
    const on = coverFromStrings(['0000', '0001', '0010', '0101', '0110', '0111', '1000', '1001', '1010', '1110']);
    const a = minimise(on, undefined, { method: 'exact' });
    const b = minimise(on, undefined, { method: 'heuristic' });
    expect(a.cubes.length).toBe(3);
    expect(b.cubes.length).toBe(3);
    expect(implementsFunction(a, on)).toBe(true);
    expect(implementsFunction(b, on)).toBe(true);
  });

  test('constants', () => {
    const one = minimise(coverFromStrings(['1-', '0-']));
    expect(one.cubes.map((c) => cubeToString(c, 2))).toEqual(['--']);
    expect(minimise({ n: 2, cubes: [] }).cubes).toEqual([]);
  });
});

describe('output polarity', () => {
  test('a function with many ones is cheaper inverted', () => {
    // NAND of four inputs: 4 terms active high (Ā + B̄ + C̄ + D̄), 1 term active low (ABCD).
    const { cover } = parseSop('!(A & B & C & D)', ['A', 'B', 'C', 'D']);
    const p = choosePolarity(cover);
    expect(p.high.cubes.length).toBe(4);
    expect(p.low.cubes.length).toBe(1);
    expect(p.polarity).toBe('low');
    expect(implementsFunction(p.low, offSet(cover))).toBe(true);
  });

  test('ties keep active high', () => {
    const { cover } = parseSop('A ^ B', ['A', 'B']);
    const p = choosePolarity(cover);
    expect(p.high.cubes.length).toBe(2);
    expect(p.low.cubes.length).toBe(2);
    expect(p.polarity).toBe('high');
  });

  test('don’t cares are shared by both polarities', () => {
    const vars = ['A', 'B', 'C'];
    const on = parseSop('A & B & C', vars).cover;
    const dc = parseSop('!A', vars).cover;
    const low = minimiseComplement(on, dc);
    // Off-set is A·¬(B·C); with ¬A as don't care, ¬(B·C) = B̄ + C̄ suffices.
    expect(low.cubes.length).toBe(2);
  });
});
