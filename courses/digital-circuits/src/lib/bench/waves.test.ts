import { describe, expect, test } from 'vitest';
import { spans, ticks, voltageToLogic } from './waves';

describe('timing-diagram spans', () => {
  test('samples become spans clipped to the window', () => {
    const t = [0, 2, 5, 9];
    const v = [0, 1, 0, 3];
    expect(spans(t, v, 3, 10)).toEqual([
      { t0: 3, t1: 5, v: 1 },
      { t0: 5, t1: 9, v: 0 },
      { t0: 9, t1: 10, v: 3 },
    ]);
  });
  test('equal neighbours merge; nothing before the first sample', () => {
    expect(spans([4, 6], [1, 1], 0, 8)).toEqual([{ t0: 4, t1: 8, v: 1 }]);
    expect(spans([], [], 0, 1)).toEqual([]);
  });
  test('analog samples use CMOS thresholds', () => {
    expect([0.2, 2.5, 4.9, NaN].map(voltageToLogic)).toEqual([0, 2, 1, 3]);
    expect(spans([0, 1], [5, 0.1], 0, 2, true)).toEqual([
      { t0: 0, t1: 1, v: 1 },
      { t0: 1, t1: 2, v: 0 },
    ]);
  });
});

describe('ticks', () => {
  test('1-2-5 steps', () => {
    expect(ticks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    const ns = ticks(3e-9, 13e-9, 5);
    expect(ns[0]).toBeCloseTo(4e-9, 15);
    expect(ns).toHaveLength(5);
    expect(ticks(1, 1)).toEqual([]);
  });
});
