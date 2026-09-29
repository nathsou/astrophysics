import { describe, expect, test } from 'vitest';
import { loadedRatio, loading } from './loading';

describe('meter loading', () => {
  test('a 10 MΩ meter on a 10 MΩ + 10 MΩ divider reads 3.33 V instead of 5 V', () => {
    const l = loading(10, 1e7, 1e7, 1e7);
    expect(l.ideal).toBeCloseTo(5, 6);
    expect(l.reading).toBeCloseTo(10 / 3, 4);
    expect(l.error).toBeCloseTo(-1 / 3, 4);
  });

  test('a 10 kΩ divider is not disturbed by the same meter', () => {
    const l = loading(10, 1e4, 1e4, 1e7);
    expect(Math.abs(l.error)).toBeLessThan(0.001);
  });

  test('a 100 MΩ meter cuts the error to about 5 %; a 200 kΩ analogue meter is much worse', () => {
    expect(loading(10, 1e7, 1e7, 1e8).error).toBeCloseTo(-0.0476, 3);
    expect(loading(10, 1e7, 1e7, 2e5).reading).toBeLessThan(0.2);
  });

  test('the engine agrees with the parallel-resistance formula', () => {
    for (const [r1, r2, rin] of [[1e6, 2e6, 1e7], [4.7e3, 1e3, 1e6], [1e7, 1e7, 1e7]] as const) {
      expect(loading(9, r1, r2, rin).reading).toBeCloseTo(9 * loadedRatio(r1, r2, rin), 4);
    }
  });
});
