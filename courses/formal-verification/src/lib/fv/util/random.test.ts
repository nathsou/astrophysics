import { describe, expect, it } from 'vitest';
import { rng } from './random';

describe('rng', () => {
  it('is deterministic for a seed and differs between seeds', () => {
    const a = rng(42), b = rng(42), c = rng(43);
    const xs = Array.from({ length: 5 }, () => a.nextU32());
    expect(Array.from({ length: 5 }, () => b.nextU32())).toEqual(xs);
    expect(Array.from({ length: 5 }, () => c.nextU32())).not.toEqual(xs);
  });
  it('int stays in range and covers it', () => {
    const r = rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(-3, 4);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(4);
      seen.add(v);
    }
    expect(seen.size).toBe(7);
  });
  it('shuffle is a permutation', () => {
    const r = rng(1);
    expect([...r.shuffle([1, 2, 3, 4, 5])].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
