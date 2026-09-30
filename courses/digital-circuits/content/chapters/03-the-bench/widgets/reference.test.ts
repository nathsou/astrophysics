import { describe, expect, test } from 'vitest';
import { voltages } from './reference';

describe('measuring relative to something', () => {
  test('moving the ground shifts every node but not the drops across the parts', () => {
    const top = voltages('T');
    const mid = voltages('M');
    const bot = voltages('B');
    expect([top.T, top.M, top.B]).toEqual([0, expect.closeTo(-6, 2), expect.closeTo(-9, 2)]);
    expect([mid.T, mid.M, mid.B]).toEqual([expect.closeTo(6, 2), 0, expect.closeTo(-3, 2)]);
    expect([bot.T, bot.M, bot.B]).toEqual([expect.closeTo(9, 2), expect.closeTo(3, 2), 0]);
    for (const v of [top, mid, bot]) {
      expect(v.r1).toBeCloseTo(6, 2);
      expect(v.r2).toBeCloseTo(3, 2);
    }
  });
});
