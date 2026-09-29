import { describe, expect, test } from 'vitest';
import { envelope, niceCeil, peakBetween } from './scope';

describe('scope helpers', () => {
  test('a one-sample spike survives reduction to a few columns', () => {
    const times = [0, 1, 2, 2.01, 3, 10];
    const values = [5, 5, 5, 500, 5, 5];
    const cols = envelope(times, values, 0, 10, 5);
    expect(cols.map((c) => c?.max)).toEqual([5, 500, 5, 5, 5]);
    expect(Math.max(...cols.map((c) => c!.max))).toBe(500);
  });
  test('a value is carried through columns with no new sample', () => {
    const cols = envelope([0, 9], [3, 7], 0, 10, 5);
    expect(cols[2]).toEqual({ min: 3, max: 3 });
    expect(cols[4]).toEqual({ min: 3, max: 7 });
  });
  test('columns before the first sample are empty', () => {
    const cols = envelope([5], [1], 0, 10, 10);
    expect(cols[0]).toBeUndefined();
    expect(cols[5]).toEqual({ min: 1, max: 1 });
  });
  test('niceCeil', () => {
    expect(niceCeil(505)).toBe(1000);
    expect(niceCeil(5.8)).toBe(10);
    expect(niceCeil(150)).toBe(200);
    expect(niceCeil(1)).toBe(1);
    expect(niceCeil(0)).toBe(1);
  });
  test('peakBetween', () => {
    expect(peakBetween([0, 1, 2, 3], [1, 9, 4, 20], 0.5, 2.5)).toBe(9);
  });
});
