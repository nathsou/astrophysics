import { describe, expect, test } from 'vitest';
import { minGates, tableOf } from './search';

describe('exhaustive search for the fewest gates', () => {
  test('XOR from NAND takes four gates (the classic), and three are not enough', () => {
    const xor = tableOf(2, (b) => (b[0]! ^ b[1]!) as 0 | 1);
    expect(minGates(xor, ['nand'], 4, 2)).toBe(4);
  });
  test('XOR with an XOR gate takes one, without it three', () => {
    const xor = tableOf(2, (b) => (b[0]! ^ b[1]!) as 0 | 1);
    expect(minGates(xor, ['xor'], 2)).toBe(1);
  });
  test('an OR needs one OR, or three NANDs', () => {
    const or = tableOf(2, (b) => (b[0]! | b[1]!) as 0 | 1);
    expect(minGates(or, ['or', 'and', 'not'], 3)).toBe(1);
    expect(minGates(or, ['nand'], 4, 2)).toBe(3);
  });
});
