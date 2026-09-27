import { expect, test } from '@lm/test';
import { HeadCache } from './solution.ts';

const f = (...xs: number[]) => Float32Array.from(xs);

test('the first token attends only to itself', () => {
  const out = new HeadCache().step(f(1, 0), f(0.5, 0.5), f(3, -1));
  expect(Array.from(out)).toEqual([3, -1]);
});

test('matches full causal attention computed from scratch at every step', () => {
  const qs = [f(1, 0), f(0, 1), f(1, 1), f(-1, 2)];
  const ks = [f(0.5, 0.2), f(-0.3, 1), f(1, -1), f(0.2, 0.2)];
  const vs = [f(1, 2), f(3, -1), f(0, 0.5), f(-2, 1)];
  const cache = new HeadCache();
  qs.forEach((q, t) => {
    const got = cache.step(q, ks[t]!, vs[t]!);
    const s = ks.slice(0, t + 1).map((k) => (k[0]! * q[0]! + k[1]! * q[1]!) / Math.SQRT2);
    const e = s.map(Math.exp), z = e.reduce((a, b) => a + b, 0);
    const want = [0, 1].map((i) => e.reduce((a, p, j) => a + (p / z) * vs[j]![i]!, 0));
    expect(got[0]!).toBeCloseTo(want[0]!, 5);
    expect(got[1]!).toBeCloseTo(want[1]!, 5);
  });
  expect(cache.keys).toHaveLength(4);
});

test('large scores do not overflow', () => {
  const cache = new HeadCache();
  cache.step(f(100, 0), f(100, 0), f(1, 0));
  const out = cache.step(f(100, 0), f(90, 0), f(0, 1));
  expect(Number.isFinite(out[0]!)).toBe(true);
  expect(out[0]!).toBeCloseTo(1, 5);
});
